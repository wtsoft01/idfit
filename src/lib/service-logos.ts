export type ServiceLogoInfo = {
  slug: string;
  name: string;
  logoUrl: string;
  domain: string;
};

const LOGO_BASE = "https://cdn.simpleicons.org";

export const SERVICE_LOGO_MAP: Record<string, ServiceLogoInfo> = {
  "ChatGPT Plus": { slug: "openai", name: "ChatGPT Plus", logoUrl: `${LOGO_BASE}/openai/10A37F`, domain: "openai.com" },
  "ChatGPT Pro": { slug: "openai", name: "ChatGPT Pro", logoUrl: `${LOGO_BASE}/openai/10A37F`, domain: "openai.com" },
  "Claude Pro": { slug: "anthropic", name: "Claude Pro", logoUrl: `${LOGO_BASE}/anthropic/D97757`, domain: "anthropic.com" },
  "Claude Max": { slug: "anthropic", name: "Claude Max", logoUrl: `${LOGO_BASE}/anthropic/D97757`, domain: "anthropic.com" },
  "Cursor Pro": { slug: "cursor", name: "Cursor Pro", logoUrl: `${LOGO_BASE}/cursor/FFFFFF`, domain: "cursor.com" },
  "Midjourney": { slug: "midjourney", name: "Midjourney", logoUrl: `${LOGO_BASE}/midjourney/FFFFFF`, domain: "midjourney.com" },
  "Perplexity Pro": { slug: "perplexity", name: "Perplexity Pro", logoUrl: `${LOGO_BASE}/perplexity/20808D`, domain: "perplexity.ai" },
  "Gemini Advanced": { slug: "googlegemini", name: "Gemini Advanced", logoUrl: `${LOGO_BASE}/googlegemini/8E75B2`, domain: "gemini.google.com" },
  "Suno Pro": { slug: "suno", name: "Suno Pro", logoUrl: `${LOGO_BASE}/suno/FFFFFF`, domain: "suno.com" },
  "Runway Pro": { slug: "runway", name: "Runway Pro", logoUrl: `${LOGO_BASE}/runway/FFFFFF`, domain: "runwayml.com" },
  "Notion AI": { slug: "notion", name: "Notion AI", logoUrl: `${LOGO_BASE}/notion/FFFFFF`, domain: "notion.so" },
  "OpenArt": { slug: "openart", name: "OpenArt", logoUrl: `${LOGO_BASE}/openart/00A67E`, domain: "openart.ai" },
  "Canva Pro": { slug: "canva", name: "Canva Pro", logoUrl: `${LOGO_BASE}/canva/00C4CC`, domain: "canva.com" },
  "CapCut Pro": { slug: "capcut", name: "CapCut Pro", logoUrl: `${LOGO_BASE}/capcut/FFFFFF`, domain: "capcut.com" },
  "Grok": { slug: "x", name: "Grok", logoUrl: `${LOGO_BASE}/x/FFFFFF`, domain: "x.ai" },
  "DeepSeek": { slug: "deepseek", name: "DeepSeek", logoUrl: `${LOGO_BASE}/deepseek/4D6BFF`, domain: "deepseek.com" },
  "Adobe": { slug: "adobe", name: "Adobe", logoUrl: `${LOGO_BASE}/adobe/FA0F00`, domain: "adobe.com" },
  "YouTube Premium": { slug: "youtube", name: "YouTube Premium", logoUrl: `${LOGO_BASE}/youtube/FF0000`, domain: "youtube.com" },
  "Netflix": { slug: "netflix", name: "Netflix", logoUrl: `${LOGO_BASE}/netflix/E50914`, domain: "netflix.com" },
  "Gmail": { slug: "gmail", name: "Gmail", logoUrl: `${LOGO_BASE}/gmail/EA4335`, domain: "gmail.com" },
  "Hotmail": { slug: "microsoftoutlook", name: "Hotmail", logoUrl: `${LOGO_BASE}/microsoftoutlook/0078D4`, domain: "outlook.live.com" },
  "VPN": { slug: "protonvpn", name: "VPN", logoUrl: `${LOGO_BASE}/protonvpn/6D4AFF`, domain: "protonvpn.com" },
  "Xbox": { slug: "xbox", name: "Xbox", logoUrl: `${LOGO_BASE}/xbox/107C10`, domain: "xbox.com" },
};

export function serviceLogoInfo(service: string | null | undefined): ServiceLogoInfo | null {
  return SERVICE_LOGO_MAP[String(service ?? "").trim()] ?? null;
}
