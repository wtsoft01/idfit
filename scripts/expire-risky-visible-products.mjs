import { createServiceSupabase } from "./sales-ingest-engine.mjs";

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    dryRun: true,
    maxAgeHours: 6,
    lowStockMaxAgeHours: 3,
    lowStockThreshold: 3,
    limit: 1000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === "--write") args.dryRun = false;
    if (value === "--dry-run") args.dryRun = true;
    if (value === "--max-age-hours" && next) args.maxAgeHours = Number(next), index += 1;
    if (value === "--low-stock-max-age-hours" && next) args.lowStockMaxAgeHours = Number(next), index += 1;
    if (value === "--low-stock-threshold" && next) args.lowStockThreshold = Number(next), index += 1;
    if (value === "--limit" && next) args.limit = Number(next), index += 1;
  }
  return args;
}

function isFinitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function ageHours(row, now = Date.now()) {
  const base = row.last_synced_at ?? row.updated_at ?? row.created_at;
  return (now - new Date(base).getTime()) / 36e5;
}

function classify(row, args) {
  const age = ageHours(row);
  const reasons = [];
  if (row.stock_state === "sold_out") reasons.push("stock_state=sold_out");
  if (row.stock_count != null && row.stock_count <= 0) reasons.push("stock_count<=0");
  if (row.stock_count != null && row.stock_count <= args.lowStockThreshold && age > args.lowStockMaxAgeHours) reasons.push(`low_stock_stale>${args.lowStockMaxAgeHours}h`);
  if (age > args.maxAgeHours) reasons.push(`stale>${args.maxAgeHours}h`);
  return { age, reasons };
}

async function main() {
  const args = parseArgs();
  if (!isFinitePositive(args.maxAgeHours) || !isFinitePositive(args.lowStockMaxAgeHours) || !Number.isFinite(args.lowStockThreshold)) {
    throw new Error("Invalid expiry thresholds");
  }

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("products")
    .select("id,candidate_id,service_name,title,stock_state,stock_count,status,last_synced_at,updated_at,created_at,metadata")
    .eq("status", "visible")
    .in("stock_state", ["in_stock", "low", "sold_out"])
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(args.limit);

  if (error) throw error;

  const candidates = (data ?? [])
    .map((row) => ({ row, ...classify(row, args) }))
    .filter((item) => item.reasons.length > 0);

  const summary = candidates.reduce((acc, item) => {
    for (const reason of item.reasons) acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});

  if (!args.dryRun && candidates.length > 0) {
    const ids = candidates.map((item) => item.row.id);
    const { error: updateError } = await supabase
      .from("products")
      .update({ status: "expired", stock_state: "sold_out", stock_count: 0, updated_at: new Date().toISOString() })
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
    thresholds: {
      maxAgeHours: args.maxAgeHours,
      lowStockMaxAgeHours: args.lowStockMaxAgeHours,
      lowStockThreshold: args.lowStockThreshold,
    },
    scannedVisible: data?.length ?? 0,
    affected: candidates.length,
    summary,
    samples: candidates.slice(0, 20).map((item) => ({
      id: item.row.id,
      title: item.row.title,
      stock_count: item.row.stock_count,
      stock_state: item.row.stock_state,
      ageHours: Number(item.age.toFixed(2)),
      reasons: item.reasons,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
