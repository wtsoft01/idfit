export type DisplayService =
  | "ChatGPT Plus"
  | "ChatGPT Pro"
  | "Claude Pro"
  | "Claude Max"
  | "Cursor Pro"
  | "Midjourney"
  | "Perplexity Pro"
  | "Gemini Advanced"
  | "Suno Pro"
  | "Runway Pro"
  | "Notion AI"
  | "OpenArt"
  | "Canva Pro"
  | "Higgsfield"
  | "CapCut Pro"
  | "Kling AI"
  | "Grok"
  | "Lovable"
  | "Adobe"
  | "YouTube Premium"
  | "Netflix"
  | "Gmail"
  | "Hotmail"
  | "VPN"
  | "DeepSeek"
  | "Dreamina"
  | "Xbox"
  | "API Credit"
  | "AI Account";

type ServiceRule = [DisplayService, RegExp];

export const SERVICE_RULES: ServiceRule[] = [
  ["ChatGPT Pro", /chat\s*gpt\s*pro|gpt\s*pro/i],
  ["ChatGPT Plus", /chat\s*gpt\s*plus|gpt\s*plus|chatgpt\s*plus|cdk\s*chatgpt/i],
  ["Claude Max", /claude\s*max/i],
  ["Claude Pro", /claude\s*pro/i],
  ["Cursor Pro", /cursor\s*pro|\bcursor\b/i],
  ["Perplexity Pro", /perplexity/i],
  ["Midjourney", /midjourney|\bmj\b/i],
  ["Gemini Advanced", /gemini|google\s*ai\s*ultra|veo\s*3/i],
  ["OpenArt", /open\s*art|openart/i],
  ["Higgsfield", /higgs\s*field|higgsfield/i],
  ["Canva Pro", /canva/i],
  ["CapCut Pro", /cap\s*cut|capcut/i],
  ["Kling AI", /kling/i],
  ["Grok", /super\s*grok|\bgrok\b/i],
  ["Lovable", /lovable/i],
  ["Suno Pro", /suno/i],
  ["Runway Pro", /runway/i],
  ["DeepSeek", /deep\s*seek|deepseek/i],
  ["Dreamina", /dreamina/i],
  ["Notion AI", /notion/i],
  ["Adobe", /adobe/i],
  ["YouTube Premium", /youtube\s*premium/i],
  ["Netflix", /netflix/i],
  ["Gmail", /gmail/i],
  ["Hotmail", /hotmail|outlook/i],
  ["VPN", /\bvpn\b|\bhma\b/i],
  ["Xbox", /xbox/i],
  ["API Credit", /\bapi\b|credit|token/i],
];

const GENERIC_SERVICES = new Set(["AI Account", "API Credit", "Notion AI"]);

export function detectDisplayService(value: string | null | undefined): DisplayService {
  const text = String(value ?? "").trim();
  if (!text) return "AI Account";
  return SERVICE_RULES.find(([, regex]) => regex.test(text))?.[0] ?? "AI Account";
}

export function normalizeDisplayService(serviceName: string | null | undefined, title?: string | null): DisplayService {
  const titleService = detectDisplayService(title);
  const service = String(serviceName ?? "").trim();
  if (!service) return titleService;
  if (GENERIC_SERVICES.has(service) && titleService !== "AI Account") return titleService;
  return detectDisplayService(service) !== "AI Account" ? (service as DisplayService) : titleService;
}
