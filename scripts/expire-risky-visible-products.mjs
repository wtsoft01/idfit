import { createServiceSupabase } from "./sales-ingest-engine.mjs";

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    dryRun: true,
    limit: 1000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === "--write") args.dryRun = false;
    if (value === "--dry-run") args.dryRun = true;
    if (value === "--limit" && next) args.limit = Number(next), index += 1;
  }
  return args;
}

function metadataText(metadata, key) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function hasSoldOutText(row) {
  const text = [
    row.title,
    row.description,
    metadataText(row.metadata, "raw_text"),
    metadataText(row.metadata, "button_text"),
    metadataText(row.metadata, "source_text"),
  ].join("\n");

  return /(?:품절|판매\s*(?:종료|중지|마감)|재고\s*없|sold\s*out|out\s*of\s*stock|h[eế]t\s*h[aà]ng|tạm\s*hết|ngừng\s*b[aá]n|📦\s*0(?:\D|$)|stock\s*[:：]?\s*0(?:\D|$))/i.test(text);
}

function classify(row) {
  const reasons = [];
  if (row.stock_state === "sold_out") reasons.push("stock_state=sold_out");
  if (row.stock_count != null && Number(row.stock_count) <= 0) reasons.push("stock_count<=0");
  if (hasSoldOutText(row)) reasons.push("sold_out_text");
  return reasons;
}

async function main() {
  const args = parseArgs();
  if (!Number.isFinite(args.limit) || args.limit <= 0) throw new Error("Invalid --limit");

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("id,candidate_id,service_name,title,description,stock_state,stock_count,status,last_synced_at,updated_at,created_at,metadata")
    .eq("status", "visible")
    .in("stock_state", ["in_stock", "low", "sold_out"])
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(args.limit);

  if (error) throw error;

  const candidates = (data ?? [])
    .map((row) => ({ row, reasons: classify(row) }))
    .filter((item) => item.reasons.length > 0);

  const summary = candidates.reduce((acc, item) => {
    for (const reason of item.reasons) acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});

  if (!args.dryRun && candidates.length > 0) {
    const ids = candidates.map((item) => item.row.id);
    const { error: updateError } = await supabase
      .from("products")
      .update({ status: "sold_out", stock_state: "sold_out", stock_count: 0, updated_at: new Date().toISOString() })
      .in("id", ids);
    if (updateError) throw updateError;

    const candidateIds = candidates.map((item) => item.row.candidate_id).filter(Boolean);
    if (candidateIds.length > 0) {
      const { error: candidateError } = await supabase
        .from("product_candidates")
        .update({ status: "expired", stock_state: "sold_out", stock_count: 0, updated_at: new Date().toISOString() })
        .in("id", candidateIds);
      if (candidateError) throw candidateError;
    }
  }

  console.log(JSON.stringify({
    ok: true,
    mode: args.dryRun ? "dry-run" : "write",
    rule: "현재 판매중이 아니거나 재고가 없다는 명시 신호만 판매종료 처리",
    scannedVisible: data?.length ?? 0,
    affected: candidates.length,
    summary,
    samples: candidates.slice(0, 20).map((item) => ({
      id: item.row.id,
      title: item.row.title,
      stock_count: item.row.stock_count,
      stock_state: item.row.stock_state,
      reasons: item.reasons,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
