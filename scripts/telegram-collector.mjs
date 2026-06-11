import {
  createServiceSupabase,
  ingestRawSalesMessage,
  loadEnv,
  normalizeSourceIdentifier,
} from "./sales-ingest-engine.mjs";

const TELEGRAM_API = "https://api.telegram.org";
const PARSER_VERSION = "idfit-sales-engine-v1";
const env = loadEnv();
const POLL_TIMEOUT_SECONDS = Number(env.TELEGRAM_POLL_TIMEOUT_SECONDS ?? 25);
const POLL_LIMIT = Number(env.TELEGRAM_POLL_LIMIT ?? 50);
const LOOP_DELAY_MS = Number(env.TELEGRAM_LOOP_DELAY_MS ?? 800);

if (!env.TELEGRAM_BOT_TOKEN) {
  console.error("[collector] Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const telegramToken = env.TELEGRAM_BOT_TOKEN;
const supabase = createServiceSupabase(env);
let offset = Number(env.TELEGRAM_START_OFFSET ?? 0);
let sourceCache = [];
let sourceCacheAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactText(message) {
  return [message.text, message.caption].filter(Boolean).join("\n").trim();
}

function toOriginalUrl(message) {
  const username = message.chat?.username;
  if (!username || !message.message_id) return null;
  return `https://t.me/${username}/${message.message_id}`;
}

function mediaSummary(message) {
  const media = [];
  if (message.photo?.length) media.push({ type: "photo", count: message.photo.length });
  if (message.video) media.push({ type: "video", file_id: message.video.file_id });
  if (message.document) media.push({ type: "document", file_id: message.document.file_id, file_name: message.document.file_name });
  if (message.animation) media.push({ type: "animation", file_id: message.animation.file_id });
  return media;
}

function telegramMessageFromUpdate(update) {
  return update.channel_post || update.message || update.edited_channel_post || update.edited_message || null;
}

async function telegram(method, params = {}) {
  const url = new URL(`${TELEGRAM_API}/bot${telegramToken}/${method}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const res = await fetch(url);
  const body = await res.json();
  if (!body.ok) throw new Error(`Telegram ${method} failed: ${body.description ?? res.statusText}`);
  return body.result;
}

async function loadSources(force = false) {
  if (!force && Date.now() - sourceCacheAt < 60_000 && sourceCache.length) return sourceCache;
  const { data, error } = await supabase
    .from("telegram_sources")
    .select("*")
    .in("source_type", ["channel", "group", "bot"])
    .eq("status", "live")
    .eq("auto_collect_enabled", true);
  if (error) throw error;
  sourceCache = data ?? [];
  sourceCacheAt = Date.now();
  return sourceCache;
}

function sourceCandidates(message) {
  const chat = message.chat ?? {};
  const values = new Set();
  if (chat.username) values.add(`@${chat.username}`.toLowerCase());
  if (chat.id) values.add(String(chat.id));
  if (chat.title) values.add(chat.title.toLowerCase());
  return values;
}

async function findSource(message) {
  const sources = await loadSources();
  const candidates = sourceCandidates(message);
  return sources.find((source) => {
    const identifier = normalizeSourceIdentifier(source.telegram_identifier, source.source_type).toLowerCase();
    const metadataChatId = source.metadata?.telegram_chat_id ? String(source.metadata.telegram_chat_id) : "";
    return candidates.has(identifier) || (metadataChatId && candidates.has(metadataChatId));
  });
}

async function processUpdate(update) {
  const message = telegramMessageFromUpdate(update);
  if (!message) return { status: "skip", reason: "no-message" };

  const source = await findSource(message);
  if (!source) return { status: "skip", reason: "unregistered-source" };

  const result = await ingestRawSalesMessage(supabase, {
    source,
    text: compactText(message),
    telegram_message_id: message.message_id ? String(message.message_id) : null,
    sender_identifier: message.from?.username ? `@${message.from.username}` : message.author_signature ?? null,
    message_media: mediaSummary(message),
    original_url: toOriginalUrl(message),
    received_at: message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString(),
    metadata: {
      collector: "telegram-bot-api",
      update_id: update.update_id,
      chat_id: message.chat?.id,
      chat_title: message.chat?.title,
      chat_username: message.chat?.username,
    },
  }, { parserVersion: PARSER_VERSION });

  if (result.duplicate) return { status: "duplicate", source: source.telegram_identifier };
  if (result.product) return { status: "auto-visible", source: source.telegram_identifier, service: result.candidate?.service_name };
  if (result.candidate) return { status: "candidate", source: source.telegram_identifier, service: result.candidate?.service_name };
  return { status: "raw", source: source.telegram_identifier };
}

async function main() {
  console.log(`[collector] IDFIT Telegram collector started. parser=${PARSER_VERSION}`);
  await loadSources(true);

  while (true) {
    try {
      const updates = await telegram("getUpdates", {
        offset: offset || undefined,
        timeout: POLL_TIMEOUT_SECONDS,
        limit: POLL_LIMIT,
        allowed_updates: JSON.stringify(["message", "channel_post", "edited_message", "edited_channel_post"]),
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        const result = await processUpdate(update);
        if (result.status !== "skip") console.log(`[collector] ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.error(`[collector] ${error.message}`);
      await loadSources(true).catch((refreshError) => console.error(`[collector] source refresh failed: ${refreshError.message}`));
      await sleep(5_000);
    }

    await sleep(LOOP_DELAY_MS);
  }
}

main();
