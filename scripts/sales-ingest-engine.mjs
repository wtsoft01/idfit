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

function normalizeSourceIdentifier(value, sourceType = "manual") {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (["channel", "group", "bot", "manual"].includes(sourceType) && !trimmed.startsWith("@") && !/^-?\d+$/.test(trimmed)) {
    return `@${trimmed}`;
  }
  return trimmed;
}

function parseSalesCandidate(text, options = {}) {
  const parserVersion = options.parserVersion ?? DEFAULT_PARSER_VERSION;
  const vndPerUsdt = Number(options.vndPerUsdt ?? DEFAULT_VND_PER_USDT);
  const normalized = String(text ?? "").replace(/,/g, "").replace(/\s+/g, " ").trim();
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
  const genericPriceMatch = priceMatch || normalized.match(/(?:¥|￥|CNY|RMB|商品单价|价格|售价|price|giá|gia)\s*[:：-]?\s*(\d+(?:\.\d+)?)/i) || kiloPriceMatch;
  const durationMatch = normalized.match(/(\d{1,3})\s*(일|ngày|ngay|days?|d\b)/i) || normalized.match(/(\d{1,2})\s*(개월|tháng|thang|months?|mo\b)/i) || normalized.match(/(\d{1,2})\s*(년|năm|nam|years?|y\b)/i);
  const durationUnit = durationMatch?.[2] ?? "";
  const stockMatch = normalized.match(/(?:재고|stock|qty|수량|잔여|库存|kho|📦)\s*[:：-]?\s*(\d+)/i);
  const soldOut = /sold\s*out|품절|재고\s*0|库存\s*0|📦\s*0|已售罄|售罄|마감/i.test(normalized);
  const lowStock = /마감\s*임박|low\s*stock|잔여|소량/i.test(normalized) && !soldOut;
  const hasSalesSignal = /판매|팝니다|분양|공유|구독|계정|账号|账户|成品号|自助|卡网|商品|发货|account|login|code|코드|재고|stock|库存|USDT|usd|달러|价格|售价|가격|price|sản phẩm|san pham|mua|bảo hành|bao hanh|bh\b|warranty|bảo trì|bao tri|📦|gmail|hotmail|outlook|canva|vpn|api|capcut|kling|grok|lovable|netflix|adobe/i.test(normalized);
  const confidence = [service !== "AI Account", !!genericPriceMatch, !!durationMatch, !!stockMatch || lowStock || soldOut, hasSalesSignal].filter(Boolean).length * 0.18 + 0.1;

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
    service_name: service,
    product_title: normalized.slice(0, 180),
    duration_days: durationMatch ? Number(durationMatch[1]) * (/^(?:년|năm|nam|years?|y)$/i.test(durationUnit) ? 365 : /^(?:개월|tháng|thang|months?|mo)$/i.test(durationUnit) ? 30 : 1) : null,
    supplier_cost_usdt: supplierCostUsdt,
    supplier_currency: priceCurrency ?? "USDT",
    supplier_original_amount: originalPrice,
    stock_state: soldOut ? "sold_out" : lowStock ? "low" : stockMatch ? Number(stockMatch[1]) <= 0 ? "sold_out" : "in_stock" : "unknown",
    stock_count: stockMatch ? Number(stockMatch[1]) : null,
    delivery_type: /code|코드|key|키/i.test(normalized) ? "code" : /login|로그인|계정|account|gmail|hotmail|outlook/i.test(normalized) ? "login" : "manual",
    parsed_confidence: Math.min(0.98, Number(confidence.toFixed(2))),
    freshness_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    status: shouldAutoExpose ? "approved" : soldOut ? "expired" : "candidate",
    metadata: { parser_version: parserVersion, auto_exposed: shouldAutoExpose, collector: options.collector ?? "unknown", price_currency: priceCurrency, original_price: originalPrice, vnd_per_usdt: priceCurrency === "VND" ? vndPerUsdt : null },
  };
}

function splitSalesCandidateTexts(text, metadata = {}) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const unique = new Map();

  for (const line of lines) {
    const hasTelegramProductButtonShape = /\|\s*(?:\$|USDT\s*)?\d+(?:\.\d+)?\s*(?:k|USDT|USD)?\s*\|\s*📦\s*(?:\d+|∞)/i.test(line)
      || /\|\s*📦\s*(?:\d+|∞)\s*\|\s*(?:\$|USDT\s*)?\d+(?:\.\d+)?\s*(?:k|USDT|USD)?\b/i.test(line);
    const item = {
      text: line,
      metadata: {
        ...metadata,
        split_strategy: hasTelegramProductButtonShape ? "telegram_product_button" : "line",
        source_text_kind: hasTelegramProductButtonShape ? "button_product_candidate" : metadata.source_text_kind,
      },
    };
    if (!unique.has(item.text)) unique.set(item.text, item);
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

  const { data: candidateRow, error: candidateError } = await supabase
    .from("product_candidates")
    .insert(insertPayload)
    .select("*")
    .single();
  if (candidateError) throw candidateError;

  const product = candidateRow.status === "approved"
    ? await saveProductFromCandidate(supabase, candidateRow, rawMessage.id, options)
    : candidateRow.status === "expired" || candidateRow.stock_state === "sold_out"
      ? await expireProductForCandidate(supabase, candidateRow)
      : null;
  return { candidateRow, product, duplicate: false };
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
    message_text: messageText,
    message_media: input.message_media ?? [],
    original_url: input.original_url ?? null,
    received_at: input.received_at ?? new Date().toISOString(),
    parse_status: "pending",
    parser_version: parserVersion,
    hash_key: hashKey,
    metadata: input.metadata ?? {},
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
  createServiceSupabase,
  getOrCreateSource,
  ingestRawSalesMessage,
  loadEnv,
  normalizeSourceIdentifier,
  parseSalesCandidate,
  sha256,
  splitSalesCandidateTexts,
};
