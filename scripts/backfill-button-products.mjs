import {
  createServiceSupabase,
  ingestRawSalesMessage,
  splitSalesCandidateTexts,
} from "./sales-ingest-engine.mjs";

function parseArgs(argv = process.argv.slice(2)) {
  return {
    help: argv.includes("--help") || argv.includes("-h"),
    write: argv.includes("--write"),
    dryRun: argv.includes("--dry-run") || !argv.includes("--write"),
  };
}

function printHelp() {
  console.log(`Usage: node scripts/backfill-button-products.mjs [options]

Options:
  --dry-run   Parse existing raw button rows without writing new rows (default)
  --write     Write parsed button products back into Supabase
  --help      Show this help`);
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }

  const supabase = createServiceSupabase();
  const { data: rows, error } = await supabase
    .from("raw_messages")
    .select("id,source_id,message_text,received_at,source:telegram_sources(*)")
    .or("message_text.ilike.%📦%,message_text.ilike.%$%")
    .order("received_at", { ascending: false })
    .limit(80);

  if (error) throw error;

  let attempted = 0;
  let products = 0;
  for (const row of rows ?? []) {
    const source = Array.isArray(row.source) ? row.source[0] : row.source;
    if (!source?.id) continue;

    const items = splitSalesCandidateTexts(row.message_text, { collector: "idfit-backfill-button-products", source_raw_message_id: row.id })
      .filter((item) => /(?:\$|USDT|USD|📦|stock|재고|warranty|gmail|hotmail|vpn|capcut|chatgpt|claude|gemini|kling|grok|lovable|netflix|adobe)/i.test(item.text));

    for (const [index, item] of items.entries()) {
      attempted += 1;
      const result = await ingestRawSalesMessage(supabase, {
        source,
        text: item.text,
        telegram_message_id: `${row.id}:backfill:${index}`,
        received_at: row.received_at,
        hash_key: `${source.id}:backfill-button-products:${row.id}:${index}:${item.text}`,
        metadata: { ...item.metadata, backfilled_from_raw_message_id: row.id },
      }, { parserVersion: "idfit-backfill-button-products-v1", dryRun: args.dryRun });
      products += result.products?.length ?? 0;
    }
  }

  console.log(JSON.stringify({ ok: true, mode: args.write ? "write" : "dry-run", rawRows: rows?.length ?? 0, attempted, products }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
