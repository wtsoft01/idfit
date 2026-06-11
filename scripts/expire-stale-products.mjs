import { createServiceSupabase } from "./sales-ingest-engine.mjs";

function parseArgs(argv = process.argv.slice(2)) {
  const args = { dryRun: true };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--write") args.dryRun = false;
    if (value === "--dry-run") args.dryRun = true;
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const supabase = createServiceSupabase();

  const { data, error } = await supabase.rpc("idfit_expire_stale_products", {
    dry_run: args.dryRun,
  });

  if (error) {
    throw new Error(`idfit_expire_stale_products RPC failed. Apply the latest Supabase migrations first. ${error.message}`);
  }

  console.log(JSON.stringify({ ok: true, mode: args.dryRun ? "dry-run" : "write", result: data }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
