import {
  createServiceSupabase,
  getOrCreateSource,
  ingestRawSalesMessage,
  loadEnv,
  normalizeSourceIdentifier,
} from "./sales-ingest-engine.mjs";

const PARSER_VERSION = "idfit-telegram-history-collector-v1";

function collectionTypeLabel(sourceType) {
  if (sourceType === "bot") return "텔레그램봇";
  if (sourceType === "website") return "사이트 URL";
  return "텔레그램 단체방";
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    target: "",
    sourceName: "",
    sourceType: "channel",
    limit: 30,
    sinceLast: false,
    write: false,
    dryRun: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--target" || value === "--channel" || value === "--group") args.target = argv[++index] ?? args.target;
    else if (value === "--source-name") args.sourceName = argv[++index] ?? args.sourceName;
    else if (value === "--source-type") args.sourceType = argv[++index] ?? args.sourceType;
    else if (value === "--limit") args.limit = Number(argv[++index] ?? args.limit);
    else if (value === "--since-last") args.sinceLast = true;
    else if (value === "--write") args.write = true;
    else if (value === "--dry-run") args.dryRun = true;
  }
  return args;
}

function compactText(message) {
  return String(message.message ?? message.text ?? "").trim();
}

function mediaSummary(message) {
  const media = [];
  const photo = message.photo ?? message.media?.photo;
  const document = message.document ?? message.media?.document;
  const video = message.video ?? message.media?.video;
  if (photo) media.push({ type: "photo", id: String(photo.id ?? message.id ?? "") });
  if (document) media.push({ type: "document", id: String(document.id ?? message.id ?? ""), mime_type: document.mimeType ?? null });
  if (video) media.push({ type: "video", id: String(video.id ?? message.id ?? "") });
  return media;
}

function originalUrl(target, message) {
  const normalized = String(target ?? "").replace(/^https:\/\/t\.me\//i, "@").replace(/^@/, "");
  if (!normalized || !message.id || /^[-\d]+$/.test(normalized)) return null;
  return `https://t.me/${normalized}/${message.id}`;
}

function entityProfile(entity, target) {
  return {
    id: entity?.id ? String(entity.id) : null,
    username: entity?.username ? `@${entity.username}` : null,
    title: entity?.title ?? entity?.firstName ?? entity?.first_name ?? String(target ?? ""),
    about: entity?.about ?? null,
    participants_count: entity?.participantsCount ?? entity?.participants_count ?? null,
    refreshed_at: new Date().toISOString(),
  };
}

async function refreshSourceProfile(supabase, source, entity, target, args) {
  if (!supabase || args.dryRun || !source?.id) return;
  const metadata = source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata) ? source.metadata : {};
  const profile = entityProfile(entity, target);
  const { error } = await supabase
    .from("telegram_sources")
    .update({
      name: source.name || profile.title || source.telegram_identifier,
      metadata: {
        ...metadata,
        profile_refresh_enabled: true,
        profile,
        profile_refreshed_at: profile.refreshed_at,
      },
    })
    .eq("id", source.id);
  if (error) console.error(`[history] profile refresh failed: ${error.message}`);
}

async function lastTelegramMessageId(supabase, sourceId) {
  if (!supabase || !sourceId) return 0;
  const { data, error } = await supabase
    .from("raw_messages")
    .select("telegram_message_id")
    .eq("source_id", sourceId)
    .not("telegram_message_id", "is", null)
    .order("received_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return (data ?? []).reduce((max, row) => {
    const id = Number(row.telegram_message_id ?? 0);
    return Number.isFinite(id) && id > max ? id : max;
  }, 0);
}

async function getMessagesAfter(client, entity, { limit, minId }) {
  const messages = [];
  let offsetId = 0;
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 100));

  while (messages.length < limit) {
    const batch = await client.getMessages(entity, { limit: Math.min(pageSize, limit - messages.length), offsetId });
    if (!batch.length) break;

    let oldestId = Number.MAX_SAFE_INTEGER;
    for (const message of batch) {
      const id = Number(message.id ?? 0);
      if (id && id < oldestId) oldestId = id;
      if (!minId || id > minId) messages.push(message);
    }

    if (!Number.isFinite(oldestId) || oldestId === Number.MAX_SAFE_INTEGER) break;
    if (minId && oldestId <= minId) break;
    offsetId = oldestId;
  }

  return messages;
}

async function importTelegramClient() {
  try {
    const telegram = await import("telegram");
    const sessions = await import("telegram/sessions/index.js");
    const input = await import("input");
    return { TelegramClient: telegram.TelegramClient, StringSession: sessions.StringSession, input: input.default ?? input };
  } catch {
    throw new Error("Missing packages. Run: npm install telegram input");
  }
}

async function main() {
  const args = parseArgs();
  if (!args.target) throw new Error("Missing --target. Example: --target @channel_name");

  const env = loadEnv();
  const apiId = Number(env.TELEGRAM_API_ID ?? 0);
  const apiHash = env.TELEGRAM_API_HASH;
  const sessionString = env.TELEGRAM_USER_SESSION ?? "";
  if (!apiId || !apiHash) throw new Error("Missing TELEGRAM_API_ID and TELEGRAM_API_HASH");

  const { TelegramClient, StringSession, input } = await importTelegramClient();
  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, { connectionRetries: 5 });
  await client.start({
    phoneNumber: async () => env.TELEGRAM_PHONE || input.text("Telegram phone: "),
    password: async () => env.TELEGRAM_2FA_PASSWORD || input.text("Telegram 2FA password: "),
    phoneCode: async () => input.text("Telegram login code: "),
    onError: (error) => console.error(`[history] login error: ${error.message}`),
  });

  const target = args.target.startsWith("https://t.me/") ? `@${args.target.split("/").filter(Boolean).pop()}` : args.target;
  const sourceType = args.sourceType;
  const identifier = normalizeSourceIdentifier(target, sourceType);
  const supabase = args.write || args.dryRun ? createServiceSupabase(env) : null;
  const { source } = supabase
    ? await getOrCreateSource(supabase, {
        name: args.sourceName || `Telegram ${sourceType} ${identifier}`,
        source_type: sourceType,
        telegram_identifier: identifier,
        status: "live",
        auto_collect_enabled: true,
        metadata: { collector: "telegram-user-client-history", target: args.target },
      }, { dryRun: args.dryRun })
    : { source: { id: "local-source", telegram_identifier: identifier, source_type: sourceType } };

  const entity = await client.getEntity(target);
  await refreshSourceProfile(supabase, source, entity, target, args);
  const minId = args.sinceLast && supabase ? await lastTelegramMessageId(supabase, source.id) : 0;
  const messages = await getMessagesAfter(client, entity, { limit: args.limit, minId });
  const results = [];

  for (const message of [...messages].reverse()) {
    const text = compactText(message);
    if (!text && !mediaSummary(message).length) continue;
    const result = supabase
      ? await ingestRawSalesMessage(supabase, {
          source,
          text,
          telegram_message_id: message.id ? String(message.id) : null,
          message_media: mediaSummary(message),
          original_url: originalUrl(identifier, message),
          received_at: message.date ? new Date(Number(message.date) * 1000).toISOString() : new Date().toISOString(),
          hash_key: `${source.id}:history:${message.id ?? "unknown"}:${text}`,
          metadata: {
            collector: "telegram-user-client-history",
            parser: PARSER_VERSION,
            target: args.target,
            source_type: sourceType,
            collection_type: sourceType === "bot" ? "telegram_bot" : "telegram_group",
            collection_type_label: collectionTypeLabel(sourceType),
          },
        }, { parserVersion: PARSER_VERSION, dryRun: args.dryRun })
      : { ok: true, dryRun: true };
    results.push({
      id: message.id,
      text: text.slice(0, 120),
      duplicate: result.duplicate ?? false,
      candidates: result.candidates?.length ?? 0,
      products: result.products?.length ?? 0,
      parseStatus: result.parseStatus ?? null,
    });
    console.log(`[history] ${identifier} message=${message.id} candidates=${result.candidates?.length ?? 0} products=${result.products?.length ?? 0} duplicate=${result.duplicate ?? false}`);
  }

  console.log(JSON.stringify({ ok: true, target: identifier, sourceType, messages: results.length, candidates: results.reduce((sum, item) => sum + item.candidates, 0), products: results.reduce((sum, item) => sum + item.products, 0) }, null, 2));
  await client.disconnect();
}

main().catch((error) => {
  console.error(`[history] ${error.message}`);
  process.exit(1);
});
