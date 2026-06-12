import { createServiceSupabase, cleanProductTitle } from "./sales-ingest-engine.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = !args.has("--write");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 1000;

const supabase = createServiceSupabase();

function shouldInspectTitle(title = "") {
  return /(?:\d+(?:\.\d+)?\s*(?:\$|USDT|USD|달러)|[$]\s*\d+(?:\.\d+)?|(?:\s|[|:：\-/])\d+(?:\.\d+)?\s*[kK]\b)/.test(String(title ?? ""));
}

function hasRealChange(from, to) {
  if (!to || from === to) return false;
  if (to.length > from.length + 10) return false;
  return true;
}

async function main() {
  const { data: candidates, error } = await supabase
    .from("product_candidates")
    .select("id, product_title, supplier_original_amount, supplier_currency, stock_count")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const changes = [];
  for (const candidate of candidates ?? []) {
    if (!shouldInspectTitle(candidate.product_title)) continue;
    const cleaned = cleanProductTitle(candidate.product_title, {
      originalPrice: candidate.supplier_original_amount,
      priceCurrency: candidate.supplier_currency,
      stockCount: candidate.stock_count,
    });
    if (!hasRealChange(candidate.product_title, cleaned)) continue;
    changes.push({ id: candidate.id, from: candidate.product_title, to: cleaned });
  }

  console.log(JSON.stringify({ dryRun, inspected: candidates?.length ?? 0, changes: changes.length, preview: changes.slice(0, 20) }, null, 2));
  if (dryRun) return;

  for (const change of changes) {
    const { error: candidateError } = await supabase
      .from("product_candidates")
      .update({ product_title: change.to })
      .eq("id", change.id);
    if (candidateError) throw candidateError;

    const { error: productError } = await supabase
      .from("products")
      .update({ title: change.to })
      .eq("candidate_id", change.id);
    if (productError) throw productError;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
