import { candidateProductPayload } from "./candidate-product.mjs";
import { createServiceSupabase, parseSalesCandidate } from "./sales-ingest-engine.mjs";

function parseArgs(argv = process.argv.slice(2)) {
  const args = { write: false, hours: 6, limit: 1000 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === "--write") args.write = true;
    if (value === "--dry-run") args.write = false;
    if (value === "--hours" && next) args.hours = Number(next), index += 1;
    if (value === "--limit" && next) args.limit = Number(next), index += 1;
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

const promoted = [];
const skipped = [];
const sellableRows = [];
for (const row of candidates ?? []) {
  const merged = mergeParsedCandidate(row);
  if (!merged) {
    skipped.push({ id: row.id, title: row.product_title, reason: "not_sellable", status: row.status, stock_state: row.stock_state, supplier_cost_usdt: row.supplier_cost_usdt });
    continue;
  }

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

console.log(JSON.stringify({ ok: true, mode: args.write ? "write" : "dry-run", since, scanned: candidates?.length ?? 0, promotedCount: promoted.length, skippedCount: skipped.length, promoted: promoted.slice(0, 30), skipped: skipped.slice(0, 20) }, null, 2));
