import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PARSER_VERSION = "idfit-manual-v1";
const DEFAULT_SOURCE = "@manual_idfit_test";
const DEFAULT_TEXT = "ChatGPT Plus 30일 1인 공유 / 재고 3 / 13.9 USDT / 로그인 전달 가능";

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
      const index = line.indexOf("=");
      if (index < 0) continue;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !env[key]) env[key] = value;
    }
  } catch {
    // .env is optional when variables are supplied by the shell/runtime.
  }
  return env;
}

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

  args.source = args.source.trim().startsWith("@") ? args.source.trim() : `@${args.source.trim()}`;
  args.text = args.text.trim();
  args.sender = args.sender.trim();
  return args;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requireEnv(env, needsWrite) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (needsWrite && !supabaseUrl) throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL");
  if (needsWrite && !serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return { supabaseUrl, serviceRoleKey };
}

async function getOrCreateManualSource(supabase, identifier, dryRun) {
  const { data: existing, error: selectError } = await supabase
    .from("telegram_sources")
    .select("id,name,telegram_identifier,source_type,status,auto_collect_enabled")
    .eq("telegram_identifier", identifier)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return { source: existing, created: false };

  const payload = {
    name: `Manual Test ${identifier}`,
    telegram_identifier: identifier,
    source_type: "manual",
    status: "live",
    auto_collect_enabled: false,
    metadata: { created_by_script: "ingest-manual-raw-message" },
  };

  if (dryRun) return { source: { id: "dry-run-source-id", ...payload }, created: true };

  const { data, error } = await supabase
    .from("telegram_sources")
    .insert(payload)
    .select("id,name,telegram_identifier,source_type,status,auto_collect_enabled")
    .single();

  if (error) throw error;
  return { source: data, created: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { supabaseUrl, serviceRoleKey } = requireEnv(loadEnv(), !args.dryRun);
  const supabase = args.dryRun
    ? null
    : createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

  const { source, created } = args.dryRun
    ? {
        source: {
          id: "dry-run-source-id",
          name: `Manual Test ${args.source}`,
          telegram_identifier: args.source,
          source_type: "manual",
          status: "live",
          auto_collect_enabled: false,
        },
        created: true,
      }
    : await getOrCreateManualSource(supabase, args.source, args.dryRun);
  const hashKey = sha256(`${source.id}:${args.source}:${args.text}`);
  const payload = {
    source_id: source.id,
    telegram_message_id: `manual-${hashKey.slice(0, 12)}`,
    sender_identifier: args.sender || null,
    message_text: args.text,
    message_media: [],
    original_url: null,
    received_at: new Date().toISOString(),
    parse_status: "pending",
    parser_version: PARSER_VERSION,
    hash_key: hashKey,
    metadata: { ingest_mode: "manual", dry_run: args.dryRun },
  };

  if (args.dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, sourceCreated: created, source, rawMessage: payload }, null, 2));
    return;
  }

  const { data, error } = await supabase
    .from("raw_messages")
    .upsert(payload, { onConflict: "source_id,hash_key", ignoreDuplicates: true })
    .select("id,source_id,message_text,parse_status,received_at,hash_key")
    .maybeSingle();

  if (error) throw error;
  console.log(JSON.stringify({ ok: true, dryRun: false, sourceCreated: created, source, rawMessage: data }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
