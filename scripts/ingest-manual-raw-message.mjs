import { createServiceSupabase, getOrCreateSource, ingestRawSalesMessage, loadEnv } from "./sales-ingest-engine.mjs";

const DEFAULT_SOURCE = "@manual_idfit_test";
const DEFAULT_TEXT = "ChatGPT Plus 30일 1인 공유 / 재고 3 / 13.9 USDT / 로그인 전달 가능";

function parseArgs(argv) {
  const args = {
    dryRun: true,
    source: DEFAULT_SOURCE,
    text: DEFAULT_TEXT,
    sender: "@manual_operator",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--write") args.dryRun = false;
    if (value === "--dry-run") args.dryRun = true;
    if (value === "--source") args.source = argv[++index] ?? args.source;
    if (value === "--text") args.text = argv[++index] ?? args.text;
    if (value === "--sender") args.sender = argv[++index] ?? args.sender;
  }

  args.text = args.text.trim();
  args.sender = args.sender.trim();
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = args.dryRun ? null : createServiceSupabase(loadEnv());
  const sourceInput = {
    name: `Manual Test ${args.source}`,
    source_type: "manual",
    telegram_identifier: args.source,
    status: "live",
    auto_collect_enabled: false,
    metadata: { created_by_script: "ingest-manual-raw-message" },
  };

  const { source, created } = args.dryRun
    ? { source: { id: "dry-run-source-id", ...sourceInput }, created: true }
    : await getOrCreateSource(supabase, sourceInput);

  const result = await ingestRawSalesMessage(supabase, {
    source,
    text: args.text,
    sender: args.sender,
    external_id: `manual:${args.source}:${args.text}`,
    metadata: { ingest_mode: "manual", collector: "manual-cli", source_created: created },
  }, { dryRun: args.dryRun });

  console.log(JSON.stringify({ ...result, sourceCreated: created, source }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
