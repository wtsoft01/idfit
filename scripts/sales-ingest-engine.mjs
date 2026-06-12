import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { candidateProductPayload } from "./candidate-product.mjs";

const DEFAULT_PARSER_VERSION = "idfit-sales-engine-v1";
const DEFAULT_VND_PER_USDT = 25000;

function loadEnv(filePath = ".env") {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index < 0) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !env[key]) env[key] = value;
    }
  } catch {
    // Runtime env can provide all values; local .env is optional.
  }
  return env;
}

function createServiceSupabase(env = loadEnv()) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sanitizeStringForJson(value) {
  let output = "";
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        output += text[index] + text[index + 1];
        index += 1;
      } else {
        output += "�";
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      output += "�";
    } else {
      output += text[index];
    }
  }
  return output;
}

function sanitizeJsonValue(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return sanitizeStringForJson(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeJsonValue(item)).filter((item) => item !== undefined);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, sanitizeJsonValue(item)])
        .filter(([, item]) => item !== undefined),
    );
  }
  return String(value);
}

function normalizeSourceIdentifier(value, sourceType = "manual") {
  let trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const telegramUrlMatch = trimmed.match(/^@?https?:\/\/(?:t\.me|telegram\.me)\/([^/?#]+)/i);
  if (telegramUrlMatch) trimmed = telegramUrlMatch[1];
  if (sourceType === "website") {
    try {
      return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).href.replace(/\/$/, "");
    } catch {
      return trimmed;
    }
  }
  if (["channel", "group", "bot", "manual"].includes(sourceType) && !trimmed.startsWith("@") && !/^-?\d+$/.test(trimmed)) {
    return `@${trimmed}`;
  }
  return trimmed;
}

function removeNonDisplayAmounts(title, candidate = {}) {
  let output = sanitizeStringForJson(title ?? "");

  const amountPattern = /(?:[$]\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:[$]|USDT|USD|달러)|(?<=[\s|:：\-/([「【])\d+(?:\.\d+)?\s*[kK]\b(?!\s*(?:credit|credits?|token|tokens?|cre\b))(?:\s*\/\s*\d+)?|(?:¥|￥|CNY|RMB)\s*\d+(?:\.\d+)?|(?:상품단가|商品单价|价格|售价|price|giá|gia|가격)\s*[:：-]?\s*(?:[$]|USDT|USD)?\s*\d+(?:\.\d+)?\s*(?:USDT|USD|달러|k\b|K\b)?)/gi;

  output = output.replace(amountPattern, " ");

  return output
    .replace(/\s*[·•]\s*(?:📦|\?�|\?\?\?|�+)\s*(?:\d+|∞|\?\?)\s*/gi, " ")
    .replace(/\s*[·•]\s*�+\s*\d+\s*/g, " ")
    .replace(/(?:📦|\?�|\?\?\?|�+)\s*(?:\d+|∞|\?\?)/gi, " ")
    .replace(/\[\s*(?:còn|con)\s*(?:\d+|∞|\?\?)\s*\]/gi, " ")
    .replace(/\(\s*(?:còn|con|SL)\s*[:：]?\s*(?:\d+|∞|\?\?)\s*\)/gi, " ")
    .replace(/\s*[-–—]\s*(?=\||$)/g, " ")
    .replace(/(?:^|\s)(?:price|giá|gia|가격)\s*[:：-]?\s*$/i, " ")
    .replace(/\s*[:：]\s*(?=(?:\/[^\s]+\s*)?(?:$|[–—-]|\||📦|\?�|\?\?\?|�))/g, " ")
    .replace(/\s*[·•]\s*(?=$|\||📦|\?�|\?\?\?|�)/g, " ")
    .replace(/\s*[-–—]\s*(?=$|[·•]|\||📦|\?�|\?\?\?|�)/g, " ")
    .replace(/\|\s*\|/g, "|")
    .replace(/\s*\|\s*(?=$|📦|\?�|\?\?\?|�)/g, " ")
    .replace(/\s*\/\s*(?=(?:slot|tháng|thang|năm|nam|month|year)\b)/gi, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\[\s*\]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-–—•·|\s]+|[-–—•·|\s]+$/g, "")
    .trim();
}

function cleanProductTitle(text, candidate = {}) {
  let title = sanitizeStringForJson(text).replace(/\s+/g, " ").trim();
  title = title.replace(/^.*?(?:🛍️|(?:product|sản phẩm|san pham|상품)\s*[:：-])\s*/i, "");
  title = title.replace(/^\s*(\d+(?:\.\d+)?\s*k)\s*\|\s*(.+)$/i, "$2 | $1");
  title = title
    .replace(/\s*(?:✅\s*)?\+\d+\s+accounts?\s+added\b.*$/i, "")
    .replace(/\s*(?:🔥\s*)?total\s+in\s+stock\b.*$/i, "")
    .replace(/\s*(?:💰\s*)?price\s*[:：-].*$/i, "")
    .replace(/\s*\/menu\b.*$/i, "")
    .replace(/[🎁🔥🚀✅]+/g, "")
    .replace(/[━─]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-–—•·|\s]+|[-–—•·|\s]+$/g, "")
    .trim();

  title = removeNonDisplayAmounts(title, candidate);

  if (!title) title = String(text ?? "").replace(/\s+/g, " ").trim();
  const parts = [title];
  const alreadyHasStock = /(?:📦|\?�|\?\?\?|�|stock|재고|kho|SL|total\s+in\s+stock|\|\s*[^|\s]?\s*(?:\d+|∞|\?\?)\s*$)/i.test(title);
  if (!alreadyHasStock && candidate.stockCount !== null && candidate.stockCount !== undefined) parts.push(`📦 ${candidate.stockCount}`);
  return parts.join(" | ").slice(0, 180);
}

function extractStockCount(normalized) {
  const stockMatch = normalized.match(/(?:재고|stock|qty|수량|잔여|库存|kho|📦|còn|con|SL)\s*[:：\-\(]?\s*(\d+)/i)
    || normalized.match(/\[(?:còn|con)\s*(\d+)\]/i)
    || normalized.match(/\(\s*(?:còn|con|SL)\s*[:：]?\s*(\d+)\s*\)/i)
    || normalized.match(/(?:\?�|\?\?\?|�)\s*(\d+|∞|\?\?)/i);
  if (!stockMatch) return null;
  if (stockMatch[1] === "∞" || stockMatch[1] === "??") return null;
  return Number(stockMatch[1]);
}

function parseSalesCandidate(text, options = {}) {
  const parserVersion = options.parserVersion ?? DEFAULT_PARSER_VERSION;
  const vndPerUsdt = Number(options.vndPerUsdt ?? DEFAULT_VND_PER_USDT);
  const normalized = sanitizeStringForJson(text).replace(/,/g, "").replace(/\s+/g, " ").trim();
  if (!normalized || /^amount\s*[:：-]?\s*\d+(?:\.\d+)?\s*(?:USDT|usd|달러)?$/i.test(normalized) || /^\/start$/i.test(normalized)) return null;
  const serviceRules = [
    ["ChatGPT Pro", /chat\s*gpt\s*pro|gpt\s*pro/i],
    ["ChatGPT Plus", /chat\s*gpt\s*plus|gpt\s*plus/i],
    ["Claude Max", /claude\s*max/i],
    ["Claude Pro", /claude\s*pro/i],
    ["Cursor Pro", /cursor\s*pro|cursor/i],
    ["Perplexity Pro", /perplexity/i],
    ["Midjourney", /midjourney|mj\b/i],
    ["Gemini Advanced", /gemini/i],
    ["OpenArt", /open\s*art|openart/i],
    ["Higgsfield", /higgs\s*field|higgsfield/i],
    ["CapCut Pro", /cap\s*cut|capcut/i],
    ["Kling AI", /kling/i],
    ["Grok", /grok/i],
    ["Lovable", /lovable/i],
    ["Suno Pro", /suno/i],
    ["Runway Pro", /runway/i],
    ["DeepSeek", /deep\s*seek|deepseek/i],
    ["Dreamina", /dreamina/i],
    ["Notion AI", /notion/i],
    ["Canva Pro", /canva/i],
    ["Adobe", /adobe/i],
    ["YouTube Premium", /youtube\s*premium/i],
    ["Netflix", /netflix/i],
    ["Gmail", /gmail/i],
    ["Hotmail", /hotmail|outlook/i],
    ["VPN", /\bvpn\b/i],
    ["Xbox", /xbox/i],
    ["API Credit", /\bapi\b|credit/i],
  ];
  const service = serviceRules.find(([, regex]) => regex.test(normalized))?.[0] ?? "AI Account";
  const priceMatch = normalized.match(/(?:\$|USDT\s*)\s*(\d+(?:\.\d+)?)/i) || normalized.match(/(\d+(?:\.\d+)?)\s*(?:USDT|달러|usd)/i);
  const kiloPriceMatches = [...normalized.matchAll(/(?:^|\s|\|)(\d+(?:\.\d+)?)\s*k\b/gi)];
  const kiloPriceMatch = kiloPriceMatches.at(-1) ?? null;
  const genericPriceMatch = priceMatch || normalized.match(/(?:¥|￥|CNY|RMB|商品单价|价格|售价|price|giá|gia)\s*[:：-]?\s*(?:\$|USDT|USD)?\s*(\d+(?:\.\d+)?)/i) || kiloPriceMatch;
  const durationMatch = normalized.match(/(\d{1,3})\s*(일|ngày|ngay|days?|d\b)/i) || normalized.match(/(\d{1,2})\s*(개월|tháng|thang|months?|mo\b)/i) || normalized.match(/(\d{1,2})\s*(년|năm|nam|years?|y\b)/i);
  const durationUnit = durationMatch?.[2] ?? "";
  const stockCount = extractStockCount(normalized);
  const soldOut = /sold\s*out|품절|재고\s*0|库存\s*0|📦\s*0|còn\s*0|SL\s*[:：]?\s*0|\?�\s*0|已售罄|售罄|마감(?!\s*임박)|hết|het|❌/i.test(normalized) || stockCount === 0;
  const lowStock = /마감\s*임박|low\s*stock|잔여|소량|còn|SL/i.test(normalized) && !soldOut;
  const hasSalesSignal = /판매|팝니다|분양|공유|구독|계정|账号|账户|成品号|自助|卡网|商品|发货|account|login|code|코드|재고|stock|库存|USDT|usd|달러|价格|售价|가격|price|sản phẩm|san pham|mua|bảo hành|bao hanh|bh\b|warranty|bảo trì|bao tri|📦|gmail|hotmail|outlook|canva|vpn|api|capcut|kling|grok|lovable|netflix|adobe|gemini|claude|chat\s*gpt|gpt|slot|SL\s*[:：]?\s*\d+|còn\s*\d+|con\s*\d+/i.test(normalized);
  const confidence = [service !== "AI Account", !!genericPriceMatch, !!durationMatch, stockCount !== null || lowStock || soldOut, hasSalesSignal].filter(Boolean).length * 0.18 + 0.1;

  if ((!genericPriceMatch && service === "AI Account") || !hasSalesSignal) return null;

  const priceCurrency = priceMatch ? "USDT" : kiloPriceMatch ? "VND" : genericPriceMatch ? "unknown" : null;
  const originalPrice = genericPriceMatch ? Number(genericPriceMatch[1]) : null;
  const supplierCostUsdt = priceCurrency === "USDT"
    ? originalPrice
    : priceCurrency === "VND" && Number.isFinite(vndPerUsdt) && vndPerUsdt > 0 && originalPrice !== null
      ? Number(((originalPrice * 1000) / vndPerUsdt).toFixed(4))
      : null;
  const shouldAutoExpose = supplierCostUsdt !== null && supplierCostUsdt > 0 && ["USDT", "VND"].includes(priceCurrency ?? "") && !soldOut;

  return {
    service_name: sanitizeStringForJson(service),
    product_title: sanitizeStringForJson(cleanProductTitle(normalized, { priceCurrency, originalPrice, stockCount })),
    duration_days: durationMatch ? Number(durationMatch[1]) * (/^(?:년|năm|nam|years?|y)$/i.test(durationUnit) ? 365 : /^(?:개월|tháng|thang|months?|mo)$/i.test(durationUnit) ? 30 : 1) : null,
    supplier_cost_usdt: supplierCostUsdt,
    supplier_currency: priceCurrency ?? "USDT",
    supplier_original_amount: originalPrice,
    stock_state: soldOut ? "sold_out" : lowStock ? "low" : stockCount !== null ? stockCount <= 0 ? "sold_out" : "in_stock" : "unknown",
    stock_count: stockCount,
    delivery_type: /code|코드|key|키/i.test(normalized) ? "code" : /login|로그인|계정|account|gmail|hotmail|outlook/i.test(normalized) ? "login" : "manual",
    parsed_confidence: Math.min(0.98, Number(confidence.toFixed(2))),
    freshness_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    status: shouldAutoExpose ? "approved" : soldOut ? "expired" : "candidate",
    metadata: sanitizeJsonValue({ parser_version: parserVersion, auto_exposed: shouldAutoExpose, collector: options.collector ?? "unknown", price_currency: priceCurrency, original_price: originalPrice, vnd_per_usdt: priceCurrency === "VND" ? vndPerUsdt : null }),
  };
}

function splitInlineProductList(line) {
  const normalized = String(line ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const stockIconPattern = "(?:📦|\\?�|\\?\\?\\?|�+)";
  const priceStockPattern = new RegExp(`(?:\\$|USDT\\s*)?\\d+(?:\\.\\d+)?\\s*(?:k|USDT|USD)?\\s*(?:\\||[·•])\\s*${stockIconPattern}\\s*(?:\\d+|∞|\\?\\?)|${stockIconPattern}\\s*(?:\\d+|∞|\\?\\?)\\s*(?:\\||[·•])\\s*(?:\\$|USDT\\s*)?\\d+(?:\\.\\d+)?\\s*(?:k|USDT|USD)?`, "gi");
  const priceStockBoundaryPattern = new RegExp(`((?:\\$|USDT\\s*)?\\d+(?:\\.\\d+)?\\s*(?:k|USDT|USD)?\\s*(?:\\||[·•])\\s*${stockIconPattern}\\s*(?:\\d+|∞|\\?\\?))\\s*(?:\\|\\s*)?(?=[\\p{L}\\d\\[][^^|]{2,120}(?:\\||[-–—])\\s*(?:\\$|USDT\\s*)?\\d)`, "giu");
  const boundaryNormalized = normalized.replace(priceStockBoundaryPattern, "$1\n");
  if (boundaryNormalized !== normalized) {
    return boundaryNormalized
      .split(/\n+/)
      .map((item) => item.replace(/^[-–—•·\s]+|[-–—•·\s]+$/g, "").trim())
      .filter(Boolean);
  }
  const matches = [...normalized.matchAll(priceStockPattern)];
  if (matches.length <= 1) return [normalized];

  const segments = [];
  let start = 0;
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const matchEnd = (match.index ?? 0) + match[0].length;
    const nextMatchIndex = matches[index + 1]?.index;
    let end = normalized.length;

    if (nextMatchIndex !== undefined) {
      const between = normalized.slice(matchEnd, nextMatchIndex);
      const boundary = between.search(/\s+(?=[\p{L}\d][^|]{1,80}\|)/u);
      end = boundary >= 0 ? matchEnd + boundary : nextMatchIndex;
    }

    const segment = normalized.slice(start, end).replace(/^[-–—•·\s]+|[-–—•·\s]+$/g, "").trim();
    if (segment) segments.push(segment);
    start = end;
  }

  const tail = normalized.slice(start).replace(/^[-–—•·\s]+|[-–—•·\s]+$/g, "").trim();
  if (tail && !segments.includes(tail)) segments.push(tail);

  return segments.length > 1 ? segments : [normalized];
}

function splitSalesCandidateTexts(text, metadata = {}) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const unique = new Map();

  for (const line of lines) {
    const hasTelegramProductButtonShape = /(?:^|\|)\s*(?:\$|USDT\s*)?\d+(?:\.\d+)?\s*(?:k|USDT|USD)?\s*(?:\||[·•])\s*(?:📦|\?�|\?\?\?|�+)\s*(?:\d+|∞|\?\?)/i.test(line)
      || /(?:\||[·•])\s*(?:📦|\?�|\?\?\?|�+)\s*(?:\d+|∞|\?\?)\s*\|\s*(?:\$|USDT\s*)?\d+(?:\.\d+)?\s*(?:k|USDT|USD)?\b/i.test(line);
    const parts = hasTelegramProductButtonShape ? splitInlineProductList(line) : [line];
    for (const [partIndex, part] of parts.entries()) {
      const item = {
        text: part,
        metadata: {
          ...metadata,
          split_strategy: hasTelegramProductButtonShape ? parts.length > 1 ? "telegram_inline_product_list" : "telegram_product_button" : "line",
          ...(parts.length > 1 ? { split_index: partIndex } : {}),
          source_text_kind: hasTelegramProductButtonShape ? "button_product_candidate" : metadata.source_text_kind,
        },
      };
      item.metadata = sanitizeJsonValue(item.metadata);
      if (!unique.has(item.text)) unique.set(item.text, item);
    }
  }

  return [...unique.values()];
}

async function getOrCreateSource(supabase, input, options = {}) {
  const sourceType = input.source_type ?? input.sourceType ?? "manual";
  const identifier = normalizeSourceIdentifier(input.telegram_identifier ?? input.identifier, sourceType);
  if (!identifier) throw new Error("Missing source identifier");

  const { data: existing, error: selectError } = await supabase
    .from("telegram_sources")
    .select("*")
    .eq("source_type", sourceType)
    .eq("telegram_identifier", identifier)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return { source: existing, created: false };

  const payload = {
    name: input.name ?? `${sourceType.toUpperCase()} ${identifier}`,
    telegram_identifier: identifier,
    source_type: sourceType,
    status: input.status ?? "live",
    auto_collect_enabled: input.auto_collect_enabled ?? sourceType !== "manual",
    metadata: input.metadata ?? { created_by_engine: true },
  };

  if (options.dryRun) return { source: { id: "dry-run-source-id", ...payload }, created: true };

  const { data, error } = await supabase.from("telegram_sources").insert(payload).select("*").single();
  if (error) throw error;
  return { source: data, created: true };
}

async function saveProductFromCandidate(supabase, candidateRow, rawMessageId, options = {}) {
  const payload = {
    ...candidateProductPayload(candidateRow, rawMessageId, options.marginRate),
    last_synced_at: new Date().toISOString(),
  };
  const { data: existing, error: findError } = await supabase.from("products").select("id").eq("candidate_id", candidateRow.id).maybeSingle();
  if (findError) throw findError;

  if (existing?.id) {
    const { data, error } = await supabase.from("products").update(payload).eq("id", existing.id).select("id,title,status,sale_price_usdt,stock_state").single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from("products").insert(payload).select("id,title,status,sale_price_usdt,stock_state").single();
  if (error) throw error;
  return data;
}

async function expireProductForCandidate(supabase, candidateRow) {
  if (!candidateRow?.id) return null;
  const { data: existing, error: findError } = await supabase.from("products").select("id").eq("candidate_id", candidateRow.id).maybeSingle();
  if (findError) throw findError;
  if (!existing?.id) return null;

  const { data, error } = await supabase
    .from("products")
    .update({
      stock_state: "sold_out",
      stock_count: 0,
      status: "sold_out",
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select("id,title,status,sale_price_usdt,stock_state")
    .single();
  if (error) throw error;
  return data;
}

function candidateFingerprint(sourceId, candidate) {
  return sha256([
    String(sourceId ?? "").toLowerCase(),
    String(candidate.product_title ?? "").toLowerCase(),
    String(candidate.supplier_currency ?? "").toLowerCase(),
    String(candidate.supplier_original_amount ?? candidate.supplier_cost_usdt ?? ""),
  ].join("|"));
}

async function hasCandidateFingerprintColumns(supabase) {
  const { error } = await supabase
    .from("product_candidates")
    .select("candidate_fingerprint,supplier_original_amount")
    .limit(1);
  return !error;
}

async function insertCandidateFromParsed(supabase, source, rawMessage, candidate, options = {}) {
  const supportsFingerprint = options.supportsCandidateFingerprint !== false;
  const fingerprint = candidateFingerprint(source.id, candidate);
  if (supportsFingerprint) {
    const { data: existing, error: existingError } = await supabase
      .from("product_candidates")
      .select("*")
      .eq("source_id", source.id)
      .eq("candidate_fingerprint", fingerprint)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing?.id) {
      const { data: candidateRow, error: updateError } = await supabase
        .from("product_candidates")
        .update({
          raw_message_id: rawMessage.id,
          service_name: candidate.service_name,
          product_title: candidate.product_title,
          duration_days: candidate.duration_days,
          supplier_cost_usdt: candidate.supplier_cost_usdt,
          supplier_currency: candidate.supplier_currency ?? "USDT",
          supplier_original_amount: candidate.supplier_original_amount ?? candidate.metadata?.original_price ?? null,
          stock_state: candidate.stock_state,
          stock_count: candidate.stock_count,
          delivery_type: candidate.delivery_type,
          parsed_confidence: candidate.parsed_confidence,
          freshness_expires_at: candidate.freshness_expires_at,
          status: candidate.status,
          metadata: { ...(existing.metadata ?? {}), ...candidate.metadata, refreshed_at: new Date().toISOString() },
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (updateError) throw updateError;
      const product = candidateRow.status === "approved"
        ? await saveProductFromCandidate(supabase, candidateRow, rawMessage.id, options)
        : candidateRow.status === "expired" || candidateRow.stock_state === "sold_out"
          ? await expireProductForCandidate(supabase, candidateRow)
          : null;
      return { candidateRow, product, duplicate: true };
    }
  }

  const insertPayload = {
    raw_message_id: rawMessage.id,
    source_id: source.id,
    service_name: candidate.service_name,
    product_title: candidate.product_title,
    duration_days: candidate.duration_days,
    supplier_cost_usdt: candidate.supplier_cost_usdt,
    supplier_currency: candidate.supplier_currency ?? "USDT",
    stock_state: candidate.stock_state,
    stock_count: candidate.stock_count,
    delivery_type: candidate.delivery_type,
    parsed_confidence: candidate.parsed_confidence,
    freshness_expires_at: candidate.freshness_expires_at,
    status: candidate.status,
    admin_note: candidate.status === "approved" ? "자동 노출됨" : null,
    metadata: candidate.metadata,
  };
  if (supportsFingerprint) {
    insertPayload.supplier_original_amount = candidate.supplier_original_amount ?? candidate.metadata?.original_price ?? null;
    insertPayload.candidate_fingerprint = fingerprint;
  }

  const { data: insertedCandidateRow, error: candidateError } = await supabase
    .from("product_candidates")
    .insert(insertPayload)
    .select("*")
    .single();

  let candidateRow = insertedCandidateRow;
  let duplicate = false;
  if (candidateError) {
    const isFingerprintDuplicate = supportsFingerprint && /idx_product_candidates_source_fingerprint_unique|duplicate key value violates unique constraint/i.test(candidateError.message ?? "");
    if (!isFingerprintDuplicate) throw candidateError;

    duplicate = true;
    const { data: existing, error: refetchError } = await supabase
      .from("product_candidates")
      .select("*")
      .eq("source_id", source.id)
      .eq("candidate_fingerprint", fingerprint)
      .maybeSingle();
    if (refetchError) throw refetchError;
    if (!existing?.id) throw candidateError;

    const { data: updatedCandidateRow, error: updateError } = await supabase
      .from("product_candidates")
      .update({
        raw_message_id: rawMessage.id,
        service_name: candidate.service_name,
        product_title: candidate.product_title,
        duration_days: candidate.duration_days,
        supplier_cost_usdt: candidate.supplier_cost_usdt,
        supplier_currency: candidate.supplier_currency ?? "USDT",
        supplier_original_amount: candidate.supplier_original_amount ?? candidate.metadata?.original_price ?? null,
        stock_state: candidate.stock_state,
        stock_count: candidate.stock_count,
        delivery_type: candidate.delivery_type,
        parsed_confidence: candidate.parsed_confidence,
        freshness_expires_at: candidate.freshness_expires_at,
        status: candidate.status,
        metadata: { ...(existing.metadata ?? {}), ...candidate.metadata, refreshed_at: new Date().toISOString() },
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    candidateRow = updatedCandidateRow;
  }

  const product = candidateRow.status === "approved"
    ? await saveProductFromCandidate(supabase, candidateRow, rawMessage.id, options)
    : candidateRow.status === "expired" || candidateRow.stock_state === "sold_out"
      ? await expireProductForCandidate(supabase, candidateRow)
      : null;
  return { candidateRow, product, duplicate };
}

async function ingestRawSalesMessage(supabase, input, options = {}) {
  const parserVersion = options.parserVersion ?? DEFAULT_PARSER_VERSION;
  const source = input.source;
  if (!source?.id) throw new Error("Missing source");

  const messageText = String(input.message_text ?? input.text ?? "").trim();
  const hashBase = input.hash_key ?? `${source.id}:${input.external_id ?? input.telegram_message_id ?? input.original_url ?? ""}:${messageText}`;
  const hashKey = sha256(hashBase);
  const rawPayload = {
    source_id: source.id,
    telegram_message_id: input.telegram_message_id ?? input.external_id ?? null,
    sender_identifier: input.sender_identifier ?? input.sender ?? null,
    message_text: sanitizeStringForJson(messageText),
    message_media: sanitizeJsonValue(input.message_media ?? []),
    original_url: input.original_url ?? null,
    received_at: input.received_at ?? new Date().toISOString(),
    parse_status: "pending",
    parser_version: parserVersion,
    hash_key: hashKey,
    metadata: sanitizeJsonValue(input.metadata ?? {}),
  };

  const candidateItems = splitSalesCandidateTexts(messageText, input.metadata ?? {});
  const candidates = candidateItems.flatMap((item) => {
    const candidate = parseSalesCandidate(item.text, { parserVersion, collector: input.metadata?.collector, vndPerUsdt: options.vndPerUsdt ?? input.metadata?.vnd_per_usdt });
    if (!candidate) return [];
    return [{
      ...candidate,
      metadata: {
        ...candidate.metadata,
        ...item.metadata,
      },
    }];
  });

  if (options.dryRun) {
    const dryCandidates = candidates.map((candidate, index) => ({ ...candidate, id: `dry-run-candidate-id-${index + 1}`, source_id: source.id, raw_message_id: "dry-run-raw-message-id" }));
    const products = dryCandidates.filter((candidate) => candidate.status === "approved").map((candidate) => candidateProductPayload(candidate, "dry-run-raw-message-id", options.marginRate));
    return { ok: true, dryRun: true, duplicate: false, rawMessage: rawPayload, candidate: dryCandidates[0] ?? null, candidates: dryCandidates, product: products[0] ?? null, products };
  }

  const { data: rawMessage, error: rawError } = await supabase
    .from("raw_messages")
    .upsert(rawPayload, { onConflict: "source_id,hash_key", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();
  if (rawError) throw rawError;
  if (!rawMessage) return { ok: true, dryRun: false, duplicate: true, source };

  if (!candidates.length) {
    const { error: ignoredError } = await supabase
      .from("raw_messages")
      .update({ parse_status: "ignored", parser_version: parserVersion })
      .eq("id", rawMessage.id);
    if (ignoredError) throw ignoredError;
    return { ok: true, dryRun: false, duplicate: false, source, rawMessage, parseStatus: "ignored", candidate: null, candidates: [], product: null, products: [] };
  }

  const candidateSchemaOptions = options.supportsCandidateFingerprint === undefined
    ? { ...options, supportsCandidateFingerprint: await hasCandidateFingerprintColumns(supabase) }
    : options;
  const inserted = [];
  for (const candidate of candidates) {
    inserted.push(await insertCandidateFromParsed(supabase, source, rawMessage, candidate, candidateSchemaOptions));
  }

  const { error: parsedError } = await supabase
    .from("raw_messages")
    .update({ parse_status: "parsed", parser_version: parserVersion })
    .eq("id", rawMessage.id);
  if (parsedError) throw parsedError;

  return {
    ok: true,
    dryRun: false,
    duplicate: false,
    source,
    rawMessage,
    candidate: inserted[0]?.candidateRow ?? null,
    candidates: inserted.map((item) => item.candidateRow),
    product: inserted.find((item) => item.product)?.product ?? null,
    products: inserted.map((item) => item.product).filter(Boolean),
  };
}

export {
  DEFAULT_PARSER_VERSION,
  cleanProductTitle,
  createServiceSupabase,
  getOrCreateSource,
  ingestRawSalesMessage,
  loadEnv,
  normalizeSourceIdentifier,
  parseSalesCandidate,
  sha256,
  splitSalesCandidateTexts,
};
