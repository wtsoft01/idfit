const DEFAULT_MARGIN_RATE = 60;

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

  return {
    candidate_id: candidate.id,
    service_name: candidate.service_name ?? "AI Account",
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
    status: stockState === "in_stock" || stockState === "low" ? "visible" : stockState === "sold_out" ? "sold_out" : "hidden",
    last_synced_at: new Date().toISOString(),
    metadata: {
      auto_exposed: true,
      margin_rule: "default_60_percent",
      raw_message_id: rawMessageId ?? candidate.raw_message_id ?? null,
    },
  };
}

export { DEFAULT_MARGIN_RATE, salePriceForCost, productDescription, candidateProductPayload };
