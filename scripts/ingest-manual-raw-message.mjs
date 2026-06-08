import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { candidateProductPayload } from "./candidate-product.mjs";

const PARSER_VERSION = "idfit-auto-v1";
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

function parseCandidate(text) {
  const normalized = text.replace(/,/g, "").trim();
  const serviceRules = [
    ["ChatGPT Pro", /chat\s*gpt\s*pro|gpt\s*pro/i],
    ["ChatGPT Plus", /chat\s*gpt\s*plus|gpt\s*plus/i],
    ["Claude Max", /claude\s*max/i],
    ["Claude Pro", /claude\s*pro/i],
    ["Cursor Pro", /cursor\s*pro|cursor/i],
    ["Perplexity Pro", /perplexity/i],
    ["Midjourney", /midjourney|mj\b/i],
    ["Gemini Advanced", /gemini/i],
    ["Suno Pro", /suno/i],
    ["Runway Pro", /runway/i],
    ["Notion AI", /notion/i],
  ];
  const service = serviceRules.find(([, regex]) => regex.test(normalized))?.[0] ?? "AI Account";
  const priceMatch = normalized.match(/(?:\$|USDT\s*)\s*(\d+(?:\.\d+)?)/i) || normalized.match(/(\d+(?:\.\d+)?)\s*(?:USDT|달러|usd)/i);
  const durationMatch = normalized.match(/(\d{1,3})\s*(?:일|days?|d\b)/i) || normalized.match(/(\d{1,2})\s*(?:개월|months?|mo\b)/i);
  const stockMatch = normalized.match(/(?:재고|stock|qty|수량)\s*[:：-]?\s*(\d+)/i);
  const soldOut = /sold\s*out|품절|재고\s*0/i.test(normalized);
  const lowStock = /마감\s*임박|low\s*stock|잔여/i.test(normalized);
  const confidence = [service !== "AI Account", !!priceMatch, !!durationMatch, !soldOut].filter(Boolean).length * 0.22 + 0.12;

  if (!text || (!priceMatch && service === "AI Account")) return null;

  return {
    service_name: service,
    product_title: normalized.slice(0, 180),
    duration_days: durationMatch ? Number(durationMatch[1]) * (/개월|months?|mo\b/i.test(durationMatch[0]) ? 30 : 1) : null,
    supplier_cost_usdt: priceMatch ? Number(priceMatch[1]) : null,
    stock_state: soldOut ? "sold_out" : lowStock ? "low" : stockMatch ? "in_stock" : "unknown",
    stock_count: stockMatch ? Number(stockMatch[1]) : null,
    delivery_type: /code|코드|key|키/i.test(normalized) ? "code" : /login|로그인|계정|account/i.test(normalized) ? "login" : "manual",
    parsed_confidence: Math.min(0.98, Number(confidence.toFixed(2))),
    freshness_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    status: soldOut ? "expired" : "approved",
    metadata: { parser_version: PARSER_VERSION, auto_exposed: !soldOut },
  };
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
    const candidate = parseCandidate(payload.message_text);
    const product = candidate
      ? candidateProductPayload({ ...candidate, id: "dry-run-candidate-id", source_id: source.id, raw_message_id: "dry-run-raw-message-id" }, "dry-run-raw-message-id")
      : null;
    console.log(JSON.stringify({ ok: true, dryRun: true, sourceCreated: created, source, rawMessage: payload, candidate, product }, null, 2));
    return;
  }

  const { data: rawMessage, error } = await supabase
    .from("raw_messages")
    .upsert(payload, { onConflict: "source_id,hash_key", ignoreDuplicates: true })
    .select("id,source_id,message_text,parse_status,received_at,hash_key")
    .maybeSingle();

  if (error) throw error;
  if (!rawMessage) {
    console.log(JSON.stringify({ ok: true, dryRun: false, duplicate: true, sourceCreated: created, source }, null, 2));
    return;
  }

  const candidate = parseCandidate(rawMessage.message_text);
  if (!candidate) {
    const { error: ignoredError } = await supabase
      .from("raw_messages")
      .update({ parse_status: "ignored", parser_version: PARSER_VERSION })
      .eq("id", rawMessage.id);
    if (ignoredError) throw ignoredError;
    console.log(JSON.stringify({ ok: true, dryRun: false, sourceCreated: created, source, rawMessage, parseStatus: "ignored" }, null, 2));
    return;
  }

  const { data: candidateRow, error: candidateError } = await supabase
    .from("product_candidates")
    .insert({
      raw_message_id: rawMessage.id,
      source_id: source.id,
      service_name: candidate.service_name,
      product_title: candidate.product_title,
      duration_days: candidate.duration_days,
      supplier_cost_usdt: candidate.supplier_cost_usdt,
      stock_state: candidate.stock_state,
      stock_count: candidate.stock_count,
      delivery_type: candidate.delivery_type,
      parsed_confidence: candidate.parsed_confidence,
      freshness_expires_at: candidate.freshness_expires_at,
      status: candidate.status,
      admin_note: candidate.status === "approved" ? "자동 노출됨" : null,
      metadata: candidate.metadata,
    })
    .select("*")
    .single();

  if (candidateError) throw candidateError;

  let product = null;
  if (candidateRow.status !== "expired") {
    const { data: existingProduct, error: findProductError } = await supabase
      .from("products")
      .select("id")
      .eq("candidate_id", candidateRow.id)
      .maybeSingle();
    if (findProductError) throw findProductError;

    if (existingProduct?.id) {
      const { data: productRow, error: productError } = await supabase
        .from("products")
        .update(candidateProductPayload(candidateRow, rawMessage.id))
        .eq("id", existingProduct.id)
        .select("id,title,status,sale_price_usdt,stock_state")
        .single();
      if (productError) throw productError;
      product = productRow;
    } else {
      const { data: productRow, error: productError } = await supabase
        .from("products")
        .insert(candidateProductPayload(candidateRow, rawMessage.id))
        .select("id,title,status,sale_price_usdt,stock_state")
        .single();
      if (productError) throw productError;
      product = productRow;
    }
  }

  const { error: parsedError } = await supabase
    .from("raw_messages")
    .update({ parse_status: "parsed", parser_version: PARSER_VERSION })
    .eq("id", rawMessage.id);
  if (parsedError) throw parsedError;

  console.log(JSON.stringify({ ok: true, dryRun: false, sourceCreated: created, source, rawMessage, candidate: candidateRow, product }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
