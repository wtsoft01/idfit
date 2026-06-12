import { candidateProductPayload } from "./candidate-product.mjs";
import { createServiceSupabase, parseSalesCandidate } from "./sales-ingest-engine.mjs";

const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const hoursArgIndex = process.argv.indexOf("--hours");
const hours = hoursArgIndex >= 0 ? Number(process.argv[hoursArgIndex + 1] ?? 6) : 6;
const since = new Date(Date.now() - Math.max(1, hours) * 60 * 60 * 1000).toISOString();
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

const { data: candidates, error } = await supabase
  .from("product_candidates")
  .select("id,source_id,raw_message_id,service_name,product_title,status,stock_state,stock_count,supplier_cost_usdt,supplier_currency,supplier_original_amount,duration_days,delivery_type,metadata,updated_at")
  .eq("status", "candidate")
  .gte("updated_at", since)
  .order("updated_at", { ascending: false })
  .limit(500);
if (error) throw error;

const promoted = [];
const skipped = [];
for (const row of candidates ?? []) {
  const parsed = parseSalesCandidate(row.product_title, { collector: "promote-recent-candidates" });
  const merged = parsed && parsed.status === "approved"
    ? {
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
        metadata: { ...(row.metadata ?? {}), ...(parsed.metadata ?? {}), promoted_by: "promote-recent-candidates", promoted_at: new Date().toISOString() },
      }
    : null;

  if (!merged || !Number.isFinite(Number(merged.supplier_cost_usdt)) || Number(merged.supplier_cost_usdt) <= 0 || !["in_stock", "low"].includes(merged.stock_state)) {
    skipped.push({ id: row.id, title: row.product_title, reason: "not_sellable_after_reparse", parsedStatus: parsed?.status ?? null, parsedCurrency: parsed?.supplier_currency ?? null });
    continue;
  }

  const { data: existingProduct, error: existingError } = await supabase.from("products").select("id").eq("candidate_id", row.id).maybeSingle();
  if (existingError) throw existingError;

  if (!write) {
    promoted.push({ id: row.id, title: merged.product_title, stock_state: merged.stock_state, stock_count: merged.stock_count, supplier_cost_usdt: merged.supplier_cost_usdt, dryRun: true });
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
      admin_note: "실시간 수집 보정으로 자동 노출됨",
      metadata: merged.metadata,
    })
    .eq("id", row.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  const productPayload = { ...candidateProductPayload(updatedCandidate, updatedCandidate.raw_message_id), last_synced_at: new Date().toISOString() };
  const product = await writeProductWithLogoFallback(productPayload, existingProduct?.id ?? null);
  promoted.push({ candidateId: updatedCandidate.id, productId: product.id, title: product.title, status: product.status, stock_state: product.stock_state, stock_count: product.stock_count });
}

console.log(JSON.stringify({ ok: true, mode: write ? "write" : "dry-run", since, scanned: candidates?.length ?? 0, promotedCount: promoted.length, skippedCount: skipped.length, promoted: promoted.slice(0, 30), skipped: skipped.slice(0, 20) }, null, 2));
