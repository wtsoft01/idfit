import { createHash } from "node:crypto";

const TELEGRAM_API = "https://api.telegram.org";
const PARSER_VERSION = "idfit-basic-v1";
const POLL_TIMEOUT_SECONDS = Number(process.env.TELEGRAM_POLL_TIMEOUT_SECONDS ?? 25);
const POLL_LIMIT = Number(process.env.TELEGRAM_POLL_LIMIT ?? 50);
const LOOP_DELAY_MS = Number(process.env.TELEGRAM_LOOP_DELAY_MS ?? 800);

const requiredEnv = ["TELEGRAM_BOT_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[collector] Missing ${key}`);
    process.exit(1);
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
if (!supabaseUrl) {
  console.error("[collector] Missing SUPABASE_URL or VITE_SUPABASE_URL");
  process.exit(1);
}

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let offset = Number(process.env.TELEGRAM_START_OFFSET ?? 0);
let sourceCache = [];
let sourceCacheAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeIdentifier(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed.toLowerCase() : trimmed.toLowerCase();
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

async function supabase(path, options = {}) {
  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer ?? "return=representation",
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status} ${text}`);
  return body;
}

async function loadSources(force = false) {
  if (!force && Date.now() - sourceCacheAt < 60_000 && sourceCache.length) return sourceCache;
  const query = "telegram_sources?select=*&status=eq.live&auto_collect_enabled=eq.true";
  sourceCache = await supabase(query, { headers: { Prefer: "" } });
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
    const identifier = normalizeIdentifier(source.telegram_identifier);
    const metadataChatId = source.metadata?.telegram_chat_id ? String(source.metadata.telegram_chat_id) : "";
    return candidates.has(identifier) || (metadataChatId && candidates.has(metadataChatId));
  });
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
    metadata: { parser_version: PARSER_VERSION },
  };
}

async function saveRawMessage(source, message, update) {
  const text = compactText(message);
  const messageId = message.message_id ? String(message.message_id) : null;
  const fallbackKey = `${message.chat?.id ?? "unknown"}:${message.date ?? ""}:${text}`;
  const hashKey = sha256(messageId ? `${source.id}:${messageId}` : `${source.id}:${fallbackKey}`);
  const payload = {
    source_id: source.id,
    telegram_message_id: messageId,
    sender_identifier: message.from?.username ? `@${message.from.username}` : message.author_signature ?? null,
    message_text: text,
    message_media: mediaSummary(message),
    original_url: toOriginalUrl(message),
    received_at: message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString(),
    parse_status: "pending",
    parser_version: PARSER_VERSION,
    hash_key: hashKey,
    metadata: {
      update_id: update.update_id,
      chat_id: message.chat?.id,
      chat_title: message.chat?.title,
      chat_username: message.chat?.username,
    },
  };

  const rows = await supabase("raw_messages?on_conflict=source_id,hash_key", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=representation",
    body: JSON.stringify(payload),
  });
  return rows?.[0] ?? null;
}

async function saveCandidate(source, rawMessage, candidate) {
  const payload = {
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
    status: candidate.stock_state === "sold_out" ? "expired" : "candidate",
    metadata: candidate.metadata,
  };

  await supabase("product_candidates", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await supabase(`raw_messages?id=eq.${rawMessage.id}`, {
    method: "PATCH",
    body: JSON.stringify({ parse_status: "parsed", parser_version: PARSER_VERSION }),
  });
}

async function markIgnored(rawMessage) {
  await supabase(`raw_messages?id=eq.${rawMessage.id}`, {
    method: "PATCH",
    body: JSON.stringify({ parse_status: "ignored", parser_version: PARSER_VERSION }),
  });
}

async function processUpdate(update) {
  const message = telegramMessageFromUpdate(update);
  if (!message) return { status: "skip", reason: "no-message" };

  const source = await findSource(message);
  if (!source) return { status: "skip", reason: "unregistered-source" };

  const rawMessage = await saveRawMessage(source, message, update);
  if (!rawMessage) return { status: "duplicate", source: source.telegram_identifier };

  const candidate = parseCandidate(rawMessage.message_text);
  if (candidate) {
    await saveCandidate(source, rawMessage, candidate);
    return { status: "candidate", source: source.telegram_identifier, service: candidate.service_name };
  }

  await markIgnored(rawMessage);
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
