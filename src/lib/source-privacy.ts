export function maskSourceIdentifier(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "검증 소스";

  const normalized = raw.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "@");
  const atPrefix = normalized.startsWith("@");
  const body = atPrefix ? normalized.slice(1) : normalized;

  if (!body) return "검증 소스";
  if (body.length <= 2) return atPrefix ? "@**" : "**";

  const visible = Math.max(1, Math.floor(body.length * 0.35));
  const prefix = body.slice(0, visible);
  const maskedLength = Math.max(body.length - visible, Math.ceil(body.length / 2));
  return `${atPrefix ? "@" : ""}${prefix}${"*".repeat(maskedLength)}`;
}

export function redactDirectContactText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/https?:\/\/(?:t\.me|telegram\.me)\/[^\s)\]]+/gi, "[비공개 텔레그램]")
    .replace(/@[a-zA-Z0-9_]{3,}/g, (match) => maskSourceIdentifier(match));
}
