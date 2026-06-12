const DEFAULT_MARGIN_RATE = 60;

const LOGO_BASE = "https://cdn.simpleicons.org";
const SERVICE_LOGOS = [
  [/chat\s*gpt|openai|gpt/i, ["ChatGPT Plus", `${LOGO_BASE}/openai/10A37F`]],
  [/claude|anthropic/i, ["Claude Pro", `${LOGO_BASE}/anthropic/D97757`]],
  [/cursor/i, ["Cursor Pro", `${LOGO_BASE}/cursor/FFFFFF`]],
  [/midjourney|\bmj\b/i, ["Midjourney", `${LOGO_BASE}/midjourney/FFFFFF`]],
  [/perplexity/i, ["Perplexity Pro", `${LOGO_BASE}/perplexity/20808D`]],
  [/gemini|google\s*ai|veo\s*3/i, ["Gemini Advanced", `${LOGO_BASE}/googlegemini/8E75B2`]],
  [/suno/i, ["Suno Pro", `${LOGO_BASE}/suno/FFFFFF`]],
  [/runway/i, ["Runway Pro", `${LOGO_BASE}/runway/FFFFFF`]],
  [/notion/i, ["Notion AI", `${LOGO_BASE}/notion/FFFFFF`]],
  [/canva/i, ["Canva Pro", `${LOGO_BASE}/canva/00C4CC`]],
  [/cap\s*cut|capcut/i, ["CapCut Pro", `${LOGO_BASE}/capcut/FFFFFF`]],
  [/grok/i, ["Grok", `${LOGO_BASE}/x/FFFFFF`]],
  [/deep\s*seek|deepseek/i, ["DeepSeek", `${LOGO_BASE}/deepseek/4D6BFF`]],
  [/adobe/i, ["Adobe", `${LOGO_BASE}/adobe/FA0F00`]],
  [/youtube/i, ["YouTube Premium", `${LOGO_BASE}/youtube/FF0000`]],
  [/netflix/i, ["Netflix", `${LOGO_BASE}/netflix/E50914`]],
  [/gmail/i, ["Gmail", `${LOGO_BASE}/gmail/EA4335`]],
  [/hotmail|outlook/i, ["Hotmail", `${LOGO_BASE}/microsoftoutlook/0078D4`]],
  [/\bvpn\b|hma/i, ["VPN", `${LOGO_BASE}/protonvpn/6D4AFF`]],
  [/xbox/i, ["Xbox", `${LOGO_BASE}/xbox/107C10`]],
];

function logoForCandidate(candidate) {
  const text = `${candidate.service_name ?? ""} ${candidate.product_title ?? ""}`;
  const match = SERVICE_LOGOS.find(([pattern]) => pattern.test(text));
  return match ? { serviceName: match[1][0], logoUrl: match[1][1] } : { serviceName: candidate.service_name ?? "AI Account", logoUrl: null };
}

function salePriceForCost(cost, marginRate = DEFAULT_MARGIN_RATE) {
  const supplierCost = Number(cost ?? 0);
  if (!Number.isFinite(supplierCost) || supplierCost <= 0) return 0;
  return Number((supplierCost * (1 + marginRate / 100)).toFixed(4));
}

function productDescription(candidate) {
  const parts = [
    candidate.duration_days ? `${candidate.duration_days}일 이용` : null,
    `전달 방식: ${candidate.delivery_type ?? "manual"}`,
    candidate.stock_count !== null && candidate.stock_count !== undefined ? `재고 ${candidate.stock_count}개` : "재고 확인 필요",
  ].filter(Boolean);
  return parts.join(" · ");
}

function candidateProductPayload(candidate, rawMessageId, marginRate = DEFAULT_MARGIN_RATE) {
  const supplierCost = Number(candidate.supplier_cost_usdt ?? 0);
  const salePrice = salePriceForCost(supplierCost, marginRate);
  const margin = Number((salePrice - supplierCost).toFixed(4));
  const computedMarginRate = supplierCost > 0 ? Number(((margin / supplierCost) * 100).toFixed(4)) : 0;
  const stockState = candidate.stock_state ?? "unknown";
  const logo = logoForCandidate(candidate);

  return {
    candidate_id: candidate.id,
    service_name: logo.serviceName,
    title: candidate.product_title,
    description: productDescription(candidate),
    supplier_cost_usdt: supplierCost,
    sale_price_usdt: salePrice,
    margin_usdt: margin,
    margin_rate: computedMarginRate,
    stock_state: stockState,
    stock_count: candidate.stock_count ?? null,
    source_id: candidate.source_id ?? null,
    seller_id: candidate.seller_id ?? null,
    service_logo_url: logo.logoUrl,
    status: stockState === "in_stock" || stockState === "low" ? "visible" : stockState === "sold_out" ? "sold_out" : "hidden",
    last_synced_at: new Date().toISOString(),
    metadata: {
      auto_exposed: true,
      margin_rule: "default_60_percent",
      raw_message_id: rawMessageId ?? candidate.raw_message_id ?? null,
      service_logo: logo,
    },
  };
}

export { DEFAULT_MARGIN_RATE, salePriceForCost, productDescription, candidateProductPayload };
