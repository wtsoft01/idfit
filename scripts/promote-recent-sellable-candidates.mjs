import { candidateProductPayload } from "./candidate-product.mjs";
import { createServiceSupabase, parseSalesCandidate } from "./sales-ingest-engine.mjs";

function parseArgs(argv = process.argv.slice(2)) {
  const args = { write: false, hours: 6, limit: 1000, dataReadySignals: 20, autoSalesSignals: 5 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === "--write") args.write = true;
    if (value === "--dry-run") args.write = false;
    if (value === "--hours" && next) args.hours = Number(next), index += 1;
    if (value === "--limit" && next) args.limit = Number(next), index += 1;
    if (value === "--data-ready-signals" && next) args.dataReadySignals = Number(next), index += 1;
    if (value === "--auto-sales-signals" && next) args.autoSalesSignals = Number(next), index += 1;
  }
  return args;
}

const args = parseArgs();
const since = new Date(Date.now() - Math.max(1, args.hours) * 60 * 60 * 1000).toISOString();
const supabase = createServiceSupabase();

async function writeProductWithLogoFallback(payload, productId = null) {
  const writeQuery = (nextPayload) => {
    const query = productId
      ? supabase.from("products").update(nextPayload).eq("id", productId)
      : supabase.from("products").insert(nextPayload);
    return query.select("id,candidate_id,title,status,stock_state,stock_count,last_synced_at").single();
  };

  let { data, error } = await writeQuery(payload);
  if (error && /service_logo_url|schema cache|column/i.test(error.message ?? "")) {
    const { service_logo_url, ...legacyPayload } = payload;
    legacyPayload.metadata = { ...(legacyPayload.metadata ?? {}), service_logo_url };
    ({ data, error } = await writeQuery(legacyPayload));
  }
  if (error) throw error;
  return data;
}

function isSellable(row) {
  return Number.isFinite(Number(row.supplier_cost_usdt))
    && Number(row.supplier_cost_usdt) > 0
    && ["in_stock", "low"].includes(row.stock_state);
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function sellerKey(row) {
  return row.seller_id ? `seller:${row.seller_id}` : row.source_id ? `source:${row.source_id}` : "unknown";
}

function productSellerKey(product) {
  return product.seller_id ? `seller:${product.seller_id}` : product.source_id ? `source:${product.source_id}` : "unknown";
}

async function loadSalesVerification() {
  const [{ data: sources, error: sourceError }, { data: sellers, error: sellerError }, { data: products, error: productError }, { data: orders, error: orderError }] = await Promise.all([
    supabase.from("telegram_sources").select("id,trust_override,metadata").limit(2000),
    supabase.from("sellers").select("id,source_id,trust_score,observed_sales_count,success_count,metadata").limit(2000),
    supabase.from("products").select("id,seller_id,source_id,status,stock_state,stock_count").limit(5000),
    supabase.from("orders").select("id,product_id,status").limit(5000),
  ]);
  if (sourceError) throw sourceError;
  if (sellerError) throw sellerError;
  if (productError) throw productError;
  if (orderError) throw orderError;

  const sourceById = new Map((sources ?? []).map((source) => [source.id, source]));
  const sellerById = new Map((sellers ?? []).map((seller) => [seller.id, seller]));
  const productById = new Map((products ?? []).map((product) => [product.id, product]));
  const salesByKey = new Map();
  const addSignal = (key, count = 1) => salesByKey.set(key, (salesByKey.get(key) ?? 0) + count);

  for (const seller of sellers ?? []) {
    const key = `seller:${seller.id}`;
    addSignal(key, Math.max(0, Number(seller.observed_sales_count ?? 0)) + Math.max(0, Number(seller.success_count ?? 0)));
    if (seller.source_id) addSignal(`source:${seller.source_id}`, Math.max(0, Number(seller.observed_sales_count ?? 0)) + Math.max(0, Number(seller.success_count ?? 0)));
  }

  for (const product of products ?? []) {
    if (product.stock_state === "sold_out" || product.status === "sold_out" || Number(product.stock_count ?? 1) <= 0) addSignal(productSellerKey(product));
  }

  for (const order of orders ?? []) {
    if (!["payment_confirmed", "purchasing", "delivered", "as_open"].includes(order.status)) continue;
    const product = productById.get(order.product_id);
    if (product) addSignal(productSellerKey(product), order.status === "delivered" ? 2 : 1);
  }

  const totalSalesSignals = [...salesByKey.values()].reduce((sum, count) => sum + count, 0);
  return { sourceById, sellerById, salesByKey, totalSalesSignals };
}

function verificationForCandidate(row, verification) {
  const seller = row.seller_id ? verification.sellerById.get(row.seller_id) : null;
  const source = row.source_id ? verification.sourceById.get(row.source_id) : null;
  const sourceMeta = asRecord(source?.metadata);
  const sellerMeta = asRecord(seller?.metadata);
  const sourceFilter = asRecord(sourceMeta.exposure_filter);
  const sellerFilter = asRecord(sellerMeta.exposure_filter);
  const directKey = sellerKey(row);
  const sourceKey = row.source_id ? `source:${row.source_id}` : null;
  const salesSignals = Math.max(verification.salesByKey.get(directKey) ?? 0, sourceKey ? verification.salesByKey.get(sourceKey) ?? 0 : 0);
  const explicitApplied = sourceFilter.mode === "applied" || sellerFilter.mode === "applied";
  const explicitExcluded = sourceFilter.mode === "excluded" || sellerFilter.mode === "excluded";
  const exposure = String(sourceFilter.exposure ?? sellerFilter.exposure ?? "");
  const trustScore = Math.max(Number(source?.trust_override ?? 0) * 20, Number(seller?.trust_score ?? 0));
  const dataReady = verification.totalSalesSignals >= args.dataReadySignals;

  if (explicitExcluded) return { ok: false, reason: "seller_excluded", dataReady, salesSignals, trustScore };
  if (explicitApplied && (exposure === "auto" || exposure === "all" || !exposure)) return { ok: true, reason: "exposure_filter_applied", dataReady, salesSignals, trustScore };
  if (salesSignals >= args.autoSalesSignals) return { ok: true, reason: "sales_signal_verified", dataReady, salesSignals, trustScore };
  if (!dataReady && salesSignals > 0) return { ok: true, reason: "early_sales_signal", dataReady, salesSignals, trustScore };
  if (trustScore >= 80 && salesSignals > 0) return { ok: true, reason: "trusted_sales_source", dataReady, salesSignals, trustScore };
  return { ok: false, reason: dataReady ? "sales_signal_below_threshold" : "awaiting_sales_verification", dataReady, salesSignals, trustScore };
}

function mergeParsedCandidate(row) {
  if (isSellable(row)) {
    return {
      ...row,
      status: "approved",
      metadata: { ...(row.metadata ?? {}), promoted_by: "promote-recent-candidates", promoted_at: new Date().toISOString(), promotion_source: "existing_candidate_fields" },
    };
  }

  const parsed = parseSalesCandidate(row.product_title, { collector: "promote-recent-candidates" });
  if (!parsed || parsed.status !== "approved") return null;

  const merged = {
    ...row,
    service_name: parsed.service_name ?? row.service_name,
    product_title: parsed.product_title ?? row.product_title,
    duration_days: parsed.duration_days ?? row.duration_days,
    supplier_cost_usdt: parsed.supplier_cost_usdt ?? row.supplier_cost_usdt,
    supplier_currency: parsed.supplier_currency ?? row.supplier_currency,
    supplier_original_amount: parsed.supplier_original_amount ?? row.supplier_original_amount,
    stock_state: parsed.stock_state ?? row.stock_state,
    stock_count: parsed.stock_count ?? row.stock_count,
    delivery_type: parsed.delivery_type ?? row.delivery_type,
    status: "approved",
    metadata: { ...(row.metadata ?? {}), ...(parsed.metadata ?? {}), promoted_by: "promote-recent-candidates", promoted_at: new Date().toISOString(), promotion_source: "reparsed_title" },
  };

  return isSellable(merged) ? merged : null;
}

const { data: candidates, error } = await supabase
  .from("product_candidates")
  .select("id,source_id,seller_id,raw_message_id,service_name,product_title,status,stock_state,stock_count,supplier_cost_usdt,supplier_currency,supplier_original_amount,duration_days,delivery_type,metadata,updated_at")
  .in("status", ["candidate", "approved"])
  .gte("updated_at", since)
  .order("updated_at", { ascending: false })
  .limit(args.limit);
if (error) throw error;

const verification = await loadSalesVerification();

const promoted = [];
const skipped = [];
const sellableRows = [];
for (const row of candidates ?? []) {
  const merged = mergeParsedCandidate(row);
  if (!merged) {
    skipped.push({ id: row.id, title: row.product_title, reason: "not_sellable", status: row.status, stock_state: row.stock_state, supplier_cost_usdt: row.supplier_cost_usdt });
    continue;
  }

  const verified = verificationForCandidate(merged, verification);
  if (!verified.ok) {
    skipped.push({ id: row.id, title: merged.product_title, reason: verified.reason, status: row.status, stock_state: merged.stock_state, supplier_cost_usdt: merged.supplier_cost_usdt, salesSignals: verified.salesSignals, trustScore: verified.trustScore, dataReady: verified.dataReady });
    continue;
  }

  merged.metadata = { ...(merged.metadata ?? {}), sales_verification: verified };

  sellableRows.push({ row, merged });
}

const existingProductByCandidateId = new Map();
const candidateIds = sellableRows.map((item) => item.row.id);
for (let index = 0; index < candidateIds.length; index += 500) {
  const ids = candidateIds.slice(index, index + 500);
  if (!ids.length) continue;
  const { data: existingProducts, error: existingError } = await supabase.from("products").select("id,candidate_id").in("candidate_id", ids);
  if (existingError) throw existingError;
  for (const product of existingProducts ?? []) existingProductByCandidateId.set(product.candidate_id, product.id);
}

for (const { row, merged } of sellableRows) {
  const existingProductId = existingProductByCandidateId.get(row.id) ?? null;

  if (!args.write) {
    promoted.push({ id: row.id, title: merged.product_title, stock_state: merged.stock_state, stock_count: merged.stock_count, supplier_cost_usdt: merged.supplier_cost_usdt, existingProductId, dryRun: true });
    continue;
  }

  const { data: updatedCandidate, error: updateError } = await supabase
    .from("product_candidates")
    .update({
      service_name: merged.service_name,
      product_title: merged.product_title,
      duration_days: merged.duration_days,
      supplier_cost_usdt: merged.supplier_cost_usdt,
      supplier_currency: merged.supplier_currency,
      supplier_original_amount: merged.supplier_original_amount,
      stock_state: merged.stock_state,
      stock_count: merged.stock_count,
      delivery_type: merged.delivery_type,
      status: "approved",
      admin_note: "Auto-approved by live sellable candidate promotion.",
      metadata: merged.metadata,
    })
    .eq("id", row.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  const productPayload = { ...candidateProductPayload(updatedCandidate, updatedCandidate.raw_message_id), last_synced_at: new Date().toISOString() };
  const product = await writeProductWithLogoFallback(productPayload, existingProductId);
  promoted.push({ candidateId: updatedCandidate.id, productId: product.id, title: product.title, status: product.status, stock_state: product.stock_state, stock_count: product.stock_count });
}

console.log(JSON.stringify({ ok: true, mode: args.write ? "write" : "dry-run", since, scanned: candidates?.length ?? 0, dataReadySignals: args.dataReadySignals, autoSalesSignals: args.autoSalesSignals, totalSalesSignals: verification.totalSalesSignals, promotedCount: promoted.length, skippedCount: skipped.length, promoted: promoted.slice(0, 30), skipped: skipped.slice(0, 20) }, null, 2));
