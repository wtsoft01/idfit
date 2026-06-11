import {
  createServiceSupabase,
  loadEnv,
  normalizeSourceIdentifier,
} from "./sales-ingest-engine.mjs";

function parseArgs(argv = process.argv.slice(2)) {
  const args = { dryRun: true, limit: 200, sourceId: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--write") args.dryRun = false;
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--limit") args.limit = Number(argv[++index] ?? args.limit);
    else if (value === "--source-id") args.sourceId = argv[++index] ?? args.sourceId;
  }
  return args;
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeTelegramUsername(value) {
  const cleaned = String(value ?? "").replace(/^@?https?:\/\/(?:t\.me|telegram\.me)\//i, "@").replace(/[/?#].*$/, "").trim();
  if (!cleaned || cleaned === "@") return "";
  return normalizeSourceIdentifier(cleaned, "bot");
}

function telegramReferenceType(value) {
  const identifier = normalizeTelegramUsername(value).toLowerCase();
  if (!identifier) return "group";
  if (identifier.endsWith("bot")) return "bot";
  return "group";
}

function extractDiscoveryTargets(text) {
  const content = String(text ?? "");
  const targets = [];

  for (const match of content.matchAll(/(?:^|\s)(@[a-zA-Z][a-zA-Z0-9_]{4,31})\b/g)) {
    const sourceType = telegramReferenceType(match[1]);
    targets.push({ source_type: sourceType, telegram_identifier: normalizeTelegramUsername(match[1]), evidence: match[0].trim(), collection_type: sourceType === "bot" ? "telegram_bot" : "telegram_group" });
  }

  for (const match of content.matchAll(/https?:\/\/(?:t\.me|telegram\.me)\/([a-zA-Z][a-zA-Z0-9_]{4,31})(?:\?[^\s]*)?/gi)) {
    const sourceType = telegramReferenceType(match[0]);
    targets.push({ source_type: sourceType, telegram_identifier: normalizeTelegramUsername(match[0]), evidence: match[0], collection_type: sourceType === "bot" ? "telegram_bot" : "telegram_group" });
  }

  for (const match of content.matchAll(/https?:\/\/[^\s"'<>）)]+/gi)) {
    const url = safeUrl(match[0].replace(/[.,，。]+$/g, ""));
    if (!url) continue;
    const host = url.hostname.toLowerCase();
    if (host === "t.me" || host === "telegram.me") continue;
    targets.push({ source_type: "website", telegram_identifier: url.origin, evidence: url.href, collection_type: "website_url" });
  }

  const unique = new Map();
  for (const target of targets) {
    if (!target.telegram_identifier) continue;
    const key = `${target.source_type}:${target.telegram_identifier.toLowerCase()}`;
    if (!unique.has(key)) unique.set(key, target);
  }
  return [...unique.values()];
}

async function recentRawMessages(supabase, args) {
  let query = supabase
    .from("raw_messages")
    .select("id,source_id,telegram_message_id,message_text,metadata,received_at")
    .order("received_at", { ascending: false })
    .limit(args.limit);
  if (args.sourceId) query = query.eq("source_id", args.sourceId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

function leadConfidence(target) {
  if (target.source_type === "website") return 0.75;
  if (target.evidence.startsWith("https://t.me") || target.evidence.startsWith("https://telegram.me")) return 0.85;
  return 0.70;
}

async function upsertSourceLead(supabase, target, message, args) {
  const normalized = target.telegram_identifier.toLowerCase();
  const payload = {
    source_type: target.source_type,
    identifier: target.telegram_identifier,
    normalized_identifier: normalized,
    status: "new",
    confidence: leadConfidence(target),
    evidence: target.evidence,
    evidence_kind: target.source_type === "website" ? "profile_or_message_url" : "telegram_reference",
    discovered_from_raw_message_id: message.id,
    discovered_from_source_id: message.source_id,
    metadata: {
      discovered_by: "source-discovery",
      parser_version: "source-discovery-v2",
      collection_type: target.collection_type ?? target.source_type,
      collection_type_label: target.collection_type === "telegram_bot" ? "텔레그램봇" : target.collection_type === "website_url" ? "사이트 URL" : "텔레그램 단체방",
      message_received_at: message.received_at,
    },
  };
  if (args.dryRun) return { lead: { id: "dry-run-source-lead-id", ...payload }, created: true };

  const { data, error } = await supabase
    .from("source_leads")
    .upsert(payload, { onConflict: "source_type,normalized_identifier", ignoreDuplicates: false })
    .select("*")
    .single();
  if (error) {
    if (String(error.message ?? "").includes("source_leads")) {
      throw new Error("Missing source_leads table. Apply migration supabase/migrations/20260609050500_create_source_leads.sql before running --write.");
    }
    throw error;
  }
  return { lead: data, created: data.created_at === data.updated_at };
}

async function main() {
  const args = parseArgs();
  const env = loadEnv();
  const supabase = createServiceSupabase(env);
  const messages = await recentRawMessages(supabase, args);
  const discovered = [];
  const seenTargets = new Set();

  for (const message of messages) {
    const buttonText = Array.isArray(message.metadata?.buttons)
      ? message.metadata.buttons.map((button) => button.text).join("\n")
      : "";
    const profileText = [message.metadata?.profile?.about, message.metadata?.profile?.description, message.metadata?.about, message.metadata?.description].filter(Boolean).join("\n");
    const targets = extractDiscoveryTargets([message.message_text, buttonText, profileText].filter(Boolean).join("\n"));

    for (const target of targets) {
      const targetKey = `${target.source_type}:${target.telegram_identifier.toLowerCase()}`;
      if (seenTargets.has(targetKey)) continue;
      seenTargets.add(targetKey);

      const result = await upsertSourceLead(supabase, target, message, args);
      discovered.push({ ...target, created: result.created, lead: result.lead });
    }
  }

  console.log(JSON.stringify({ ok: true, dryRun: args.dryRun, scanned: messages.length, discoveredCount: discovered.length, discovered }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});

export { extractDiscoveryTargets, upsertSourceLead };
