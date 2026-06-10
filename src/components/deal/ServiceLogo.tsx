import type { DealService } from "@/lib/mockDeals";

// Stylized brand marks (not exact trademarks) — inline SVG, brand-tinted.
// Sizes: pass `size` in px. Square viewport.
export function ServiceLogo({ service, size = 16, className }: { service: DealService; size?: number; className?: string }) {
  const s = size;
  const base = service.startsWith("ChatGPT")
    ? "openai"
    : service.startsWith("Claude")
    ? "anthropic"
    : service === "Cursor Pro"
    ? "cursor"
    : service === "Midjourney"
    ? "midjourney"
    : service === "Perplexity Pro"
    ? "perplexity"
    : service === "Gemini Advanced"
    ? "gemini"
    : service === "Suno Pro"
    ? "suno"
    : service === "Runway Pro"
    ? "runway"
    : service === "OpenArt"
    ? "openart"
    : service === "Canva Pro"
    ? "canva"
    : service === "Higgsfield"
    ? "higgsfield"
    : service === "CapCut Pro"
    ? "capcut"
    : service === "Grok"
    ? "grok"
    : service === "DeepSeek"
    ? "deepseek"
    : service === "Adobe"
    ? "adobe"
    : "notion";

  const cls = "shrink-0 " + (className ?? "");

  switch (base) {
    case "openai":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <path
            fill="#10A37F"
            d="M22.28 9.8a5.4 5.4 0 0 0-.46-4.43 5.45 5.45 0 0 0-5.88-2.6A5.43 5.43 0 0 0 11.79 1a5.45 5.45 0 0 0-5.2 3.78 5.43 5.43 0 0 0-3.62 2.63 5.45 5.45 0 0 0 .68 6.4 5.4 5.4 0 0 0 .46 4.43 5.45 5.45 0 0 0 5.88 2.6 5.43 5.43 0 0 0 4.1 1.83 5.45 5.45 0 0 0 5.2-3.78 5.43 5.43 0 0 0 3.62-2.63 5.45 5.45 0 0 0-.63-6.46Zm-8.1 11.32a4.04 4.04 0 0 1-2.6-.94l.13-.07 4.32-2.5a.7.7 0 0 0 .35-.61v-6.1l1.83 1.06a.07.07 0 0 1 .04.05v5.05a4.06 4.06 0 0 1-4.07 4.06ZM5.45 17.6a4.04 4.04 0 0 1-.48-2.72l.13.08 4.32 2.5a.7.7 0 0 0 .7 0l5.28-3.05v2.11a.07.07 0 0 1-.03.06l-4.37 2.52a4.07 4.07 0 0 1-5.55-1.5ZM4.31 8.07a4.04 4.04 0 0 1 2.13-1.78v5.15a.7.7 0 0 0 .35.6l5.27 3.04-1.83 1.06a.07.07 0 0 1-.06 0L5.81 13.6a4.07 4.07 0 0 1-1.5-5.53Zm14.97 3.48-5.27-3.05 1.82-1.05a.07.07 0 0 1 .07 0l4.36 2.52a4.06 4.06 0 0 1-.61 7.32v-5.15a.7.7 0 0 0-.37-.59Zm1.82-2.74-.13-.08-4.32-2.5a.7.7 0 0 0-.7 0l-5.28 3.05V7.16a.07.07 0 0 1 .03-.06l4.37-2.52a4.07 4.07 0 0 1 6.03 4.23ZM9.7 12.58 7.87 11.5a.07.07 0 0 1-.04-.05V6.4a4.07 4.07 0 0 1 6.66-3.13l-.13.07-4.32 2.5a.7.7 0 0 0-.35.61Zm.99-2.14L13.04 9.1l2.35 1.36v2.71l-2.35 1.36-2.35-1.36Z"
          />
        </svg>
      );
    case "anthropic":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <rect width="24" height="24" rx="4" fill="#1A1A18" />
          <path fill="#D97757" d="M8.3 7h-2.1L2.6 17h2.2l.78-2.34h3.55L9.9 17H12L8.3 7Zm-2.1 6L7.4 9.4 8.6 13H6.2Zm10.36-6h-2.13L10.84 17h2.15l.78-2.34h3.55L18.1 17h2.13L16.56 7Zm-2.13 6 1.2-3.6 1.2 3.6h-2.4Z" />
        </svg>
      );
    case "cursor":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <path fill="currentColor" d="M3 3v18l9-5.2L21 21V3L12 8.2 3 3Z" opacity="0.9" />
        </svg>
      );
    case "midjourney":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <g fill="none" stroke="#1A1A1A" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 18c2-7 5-11 9-11s4 4 4 9" fill="#fff" />
            <path d="M21 18c-2-7-5-11-9-11" />
            <path d="M3 18h18" />
          </g>
        </svg>
      );
    case "perplexity":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <rect width="24" height="24" rx="4" fill="#20808D" />
          <path fill="#fff" d="M12 4 4 10v10h5v-5h6v5h5V10l-8-6Zm-4 7.5L12 8l4 3.5V14h-2v-3l-2-1.5L10 11v3H8v-2.5Z" />
        </svg>
      );
    case "gemini":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <defs>
            <linearGradient id="gem" x1="0" x2="1" y1="1" y2="0">
              <stop offset="0" stopColor="#1C7DFF" />
              <stop offset="0.5" stopColor="#9B72F2" />
              <stop offset="1" stopColor="#F94F8C" />
            </linearGradient>
          </defs>
          <path fill="url(#gem)" d="M12 2c.6 4.8 4.6 8.8 9.4 9.4v.2C16.6 12.2 12.6 16.2 12 21h-.2C11.2 16.2 7.2 12.2 2.4 11.6v-.2C7.2 10.8 11.2 6.8 11.8 2h.2Z" />
        </svg>
      );
    case "suno":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <rect width="24" height="24" rx="6" fill="#000" />
          <g fill="#fff">
            <rect x="5" y="10" width="2" height="4" rx="1" />
            <rect x="9" y="7" width="2" height="10" rx="1" />
            <rect x="13" y="9" width="2" height="6" rx="1" />
            <rect x="17" y="11" width="2" height="2" rx="1" />
          </g>
        </svg>
      );
    case "runway":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <rect width="24" height="24" rx="6" fill="#0D0D0D" />
          <path fill="#fff" d="M6 6h7a4 4 0 0 1 1.7 7.6L18 18h-3l-3-4h-3v4H6V6Zm3 5h4a2 2 0 0 0 0-4H9v4Z" />
        </svg>
      );
    case "openart":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <rect width="24" height="24" rx="6" fill="#111827" />
          <path fill="#A7F3D0" d="M12 4 20 18h-3l-1.4-2.6H8.4L7 18H4l8-14Zm-2.3 9h4.6L12 8.7 9.7 13Z" />
        </svg>
      );
    case "canva":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <defs><linearGradient id="canva-g" x1="0" x2="1" y1="1" y2="0"><stop offset="0" stopColor="#00C4CC" /><stop offset="1" stopColor="#7D2AE8" /></linearGradient></defs>
          <rect width="24" height="24" rx="12" fill="url(#canva-g)" />
          <path fill="#fff" d="M13.2 17.5c-3.7 0-6.2-2.2-6.2-5.2 0-3.4 2.9-5.8 6.2-5.8 1.9 0 3.2.7 3.9 1.7l-1.8 1.5c-.5-.6-1.1-.9-2-.9-1.7 0-3 1.3-3 3.3 0 1.8 1.2 3 3.2 3 .9 0 1.7-.3 2.3-.9l1.4 1.7c-.9 1-2.4 1.6-4 1.6Z" />
        </svg>
      );
    case "higgsfield":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <rect width="24" height="24" rx="6" fill="#20124D" />
          <path fill="#FACC15" d="M6 6h3v5h6V6h3v12h-3v-5H9v5H6V6Z" />
        </svg>
      );
    case "capcut":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <rect width="24" height="24" rx="5" fill="#050505" />
          <path fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M6 7h12l-5.2 5L18 17H6l5.2-5L6 7Z" />
        </svg>
      );
    case "grok":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <rect width="24" height="24" rx="6" fill="#0F172A" />
          <path fill="#E2E8F0" d="M6 7h12v2H9v2h7v2H9v2h9v2H6V7Z" />
        </svg>
      );
    case "deepseek":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <rect width="24" height="24" rx="6" fill="#123B7A" />
          <path fill="#7DD3FC" d="M5 12c0-4 3-7 7-7s7 3 7 7-3 7-7 7H5l2.1-2.1A6.9 6.9 0 0 1 5 12Zm7-4a4 4 0 0 0-3.7 5.5l.3.8-.8.8H12a4 4 0 0 0 0-8Z" />
        </svg>
      );
    case "adobe":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <rect width="24" height="24" rx="5" fill="#FA0F00" />
          <path fill="#fff" d="M13.6 5 19 19h-3l-.9-2.6H9L8.1 19H5L10.4 5h3.2Zm-3.8 9h4.4L12 7.8 9.8 14Z" />
        </svg>
      );
    case "notion":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={cls} aria-label={service}>
          <rect width="24" height="24" rx="4" fill="#fff" stroke="#1A1A1A" strokeWidth="1" />
          <path fill="#1A1A1A" d="M7 6h3l7 9V6h2v12h-3l-7-9v9H7V6Z" />
        </svg>
      );
  }
}
