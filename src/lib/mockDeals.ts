// Mock data + simulated live feed for IDFIT
export type { DisplayService as DealService } from "./service-classifier";
import type { DisplayService as DealService } from "./service-classifier";

export type StockState = "in_stock" | "low" | "soldout";

export interface Deal {
  id: string;
  service: DealService;
  title: string;
  priceUsdt: number;
  warrantyDays: number;
  stock: StockState;
  source: string;
  trust: number;
  createdAt: number;
}

const SERVICES: DealService[] = [
  "ChatGPT Plus", "ChatGPT Pro", "Claude Pro", "Claude Max", "Cursor Pro",
  "Midjourney", "Perplexity Pro", "Gemini Advanced", "Suno Pro", "Runway Pro", "Notion AI",
  "OpenArt", "Canva Pro", "Higgsfield", "CapCut Pro", "Grok", "Adobe", "DeepSeek",
];

const PRICE_RANGE: Record<DealService, [number, number]> = {
  "ChatGPT Plus": [12, 22],
  "ChatGPT Pro": [120, 175],
  "Claude Pro": [14, 26],
  "Claude Max": [70, 110],
  "Cursor Pro": [10, 19],
  "Midjourney": [18, 32],
  "Perplexity Pro": [4, 14],
  "Gemini Advanced": [8, 18],
  "Suno Pro": [6, 14],
  "Runway Pro": [22, 40],
  "Notion AI": [6, 12],
  "OpenArt": [0.2, 6],
  "Canva Pro": [1, 5],
  "Higgsfield": [8, 70],
  "CapCut Pro": [1, 6],
  "Kling AI": [3, 18],
  "Grok": [1, 18],
  "Lovable": [4, 18],
  "Adobe": [4, 12],
  "YouTube Premium": [2, 8],
  "Netflix": [2, 10],
  "Gmail": [0.1, 2],
  "Hotmail": [0.1, 2],
  "VPN": [0.2, 4],
  "DeepSeek": [2, 22],
  "Dreamina": [1, 12],
  "Xbox": [0.5, 8],
  "API Credit": [1, 20],
  "AI Account": [1, 12],
};

const SOURCES = [
  "@gpt_market_kr", "@ai_deals_global", "@premium_acc_hub", "@cheap_ai_china",
  "@stark_accounts", "@neon_deals_vn", "@account_bazaar", "@ai_market_vn",
  "@subs_resell_id", "@cursor_keys_tr", "@mj_pool_ru", "@claude_market",
];

export const SOURCE_COUNT = 327;

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomDeal(now = Date.now()): Deal {
  const service = pick(SERVICES);
  const [low, high] = PRICE_RANGE[service];
  const price = +(low + Math.random() * (high - low)).toFixed(2);
  const warranty = pick([7, 14, 30, 30, 60, 90, 180]);
  const stockRoll = Math.random();
  const stock: StockState = stockRoll > 0.85 ? "soldout" : stockRoll > 0.7 ? "low" : "in_stock";

  return {
    id: Math.random().toString(36).slice(2, 10),
    service,
    title: `${service} · ${warranty}일 보장 · ${pick(["1인", "1인", "2인", "공식"])}`,
    priceUsdt: price,
    warrantyDays: warranty,
    stock,
    source: pick(SOURCES),
    trust: +(3.6 + Math.random() * 1.4).toFixed(1),
    createdAt: now - Math.floor(Math.random() * 1000 * 60 * 9),
  };
}

export function seedDeals(count = 14): Deal[] {
  const now = Date.now();
  return Array.from({ length: count }, () => randomDeal(now)).sort((a, b) => b.createdAt - a.createdAt);
}

export const SCAN_LOG_TEMPLATES = [
  (source: string) => `${source} · 가격 이상치 감지(+38%) · 필터링`,
  (source: string) => `${source} · 신뢰도 4.8점 통과 · 후보 등록`,
  (source: string) => `${source} · 재고 0 / 자동 노출 제외`,
  (source: string) => `${source} · 워치리스트 매칭 완료`,
  (source: string) => `${source} · 판매자 트랙레코드 검증 중`,
  (source: string) => `${source} · 중복 글 감지, 병합 처리`,
  (source: string) => `${source} · 평균가 대비 -12.4% 베스트 후보`,
  (source: string) => `${source} · 결제 토큰 USDT-TRC20 매핑 완료`,
];

export function randomScanLog(): string {
  const source = pick(SOURCES);
  return pick(SCAN_LOG_TEMPLATES)(source);
}

export function timeAgo(ms: number, now = Date.now()): string {
  const seconds = Math.max(1, Math.floor((now - ms) / 1000));
  if (seconds < 60) return `${seconds}초 전`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  return `${hours}시간 전`;
}

export const REVIEWS = [
  { name: "Kim**", product: "ChatGPT Plus 3개월", text: "USDT 결제 후 빠르게 로그인 정보를 받았습니다.", time: "2분 전" },
  { name: "Lee**", product: "Claude Pro 30일", text: "가격과 보장 기간이 명확해서 좋았습니다.", time: "6분 전" },
  { name: "Park**", product: "Cursor Pro 90일", text: "대량 구매 문의도 상담이 빨랐습니다.", time: "11분 전" },
  { name: "Tan**", product: "Midjourney 30d", text: "Cheapest I've seen. Tron USDT, 1 min checkout.", time: "14분 전" },
  { name: "Choi**", product: "Perplexity Pro", text: "다른 곳보다 가격이 확실히 좋았습니다.", time: "20분 전" },
  { name: "Aleks**", product: "Runway Pro 30d", text: "Got it instantly, no KYC, support replied in chat.", time: "27분 전" },
  { name: "Jung**", product: "Gemini Advanced", text: "문제 발생 시 AS 흐름이 있어서 안심됩니다.", time: "33분 전" },
  { name: "Han**", product: "Suno Pro", text: "텔레그램 소스 기반이라 상품 업데이트가 빠릅니다.", time: "41분 전" },
];

export const SERVICE_ICON: Record<DealService, string> = {
  "ChatGPT Plus": "G",
  "ChatGPT Pro": "G+",
  "Claude Pro": "C",
  "Claude Max": "CM",
  "Cursor Pro": "CU",
  "Midjourney": "MJ",
  "Perplexity Pro": "P",
  "Gemini Advanced": "GE",
  "Suno Pro": "S",
  "Runway Pro": "R",
  "Notion AI": "N",
  "OpenArt": "OA",
  "Canva Pro": "CA",
  "Higgsfield": "HF",
  "CapCut Pro": "CC",
  "Kling AI": "KL",
  "Grok": "GR",
  "Lovable": "LO",
  "Adobe": "AD",
  "YouTube Premium": "YT",
  "Netflix": "NF",
  "Gmail": "GM",
  "Hotmail": "HM",
  "VPN": "VP",
  "DeepSeek": "DS",
  "Dreamina": "DR",
  "Xbox": "XB",
  "API Credit": "API",
  "AI Account": "AI",
};
