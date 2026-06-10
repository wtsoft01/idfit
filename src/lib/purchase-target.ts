export type PurchaseSourceInfo = {
  source_type?: string | null;
  telegram_identifier?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PurchaseCandidateInfo = {
  metadata?: Record<string, unknown> | null;
  raw_message?: { original_url?: string | null; telegram_message_id?: string | null; metadata?: Record<string, unknown> | null } | null;
};

export type PurchaseProductInfo = {
  metadata?: Record<string, unknown> | null;
  source?: PurchaseSourceInfo | null;
  candidate?: PurchaseCandidateInfo | null;
};

function stringFrom(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstUrl(...values: unknown[]) {
  for (const value of values) {
    const candidate = stringFrom(value);
    if (candidate && /^https?:\/\//i.test(candidate)) return candidate;
  }
  return null;
}

function telegramUrl(identifier: string | null | undefined, messageId?: string | null) {
  if (!identifier) return null;
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("@")) {
    const username = trimmed.slice(1);
    return messageId ? `https://t.me/${username}/${encodeURIComponent(messageId)}` : `https://t.me/${username}`;
  }
  return null;
}

export function purchaseTargetForProduct(product: PurchaseProductInfo | null | undefined) {
  const source = product?.source;
  const productMetadata = product?.metadata ?? {};
  const candidateMetadata = product?.candidate?.metadata ?? {};
  const rawMetadata = product?.candidate?.raw_message?.metadata ?? {};
  const sourceMetadata = source?.metadata ?? {};
  const rawMessageId = product?.candidate?.raw_message?.telegram_message_id ?? null;

  const directUrl = firstUrl(
    productMetadata.purchase_url,
    productMetadata.order_url,
    productMetadata.source_url,
    candidateMetadata.purchase_url,
    candidateMetadata.order_url,
    candidateMetadata.source_url,
    candidateMetadata.original_url,
    rawMetadata.purchase_url,
    rawMetadata.order_url,
    rawMetadata.source_url,
    product?.candidate?.raw_message?.original_url,
    sourceMetadata.purchase_url,
    sourceMetadata.order_url,
    sourceMetadata.url,
    sourceMetadata.linked_url,
  );

  if (directUrl) return { url: directUrl, label: "상품 주문창 열기" };

  const sourceUrl = telegramUrl(source?.telegram_identifier, rawMessageId) ?? telegramUrl(stringFrom(sourceMetadata.username) ?? source?.telegram_identifier ?? null);
  if (sourceUrl) return { url: sourceUrl, label: source?.source_type === "bot" ? "수집봇 열기" : "수집방 열기" };

  return null;
}
