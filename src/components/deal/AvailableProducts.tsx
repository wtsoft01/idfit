import { useEffect, useMemo, useState } from "react";
import { ServiceLogo } from "./ServiceLogo";
import type { DealService } from "@/lib/mockDeals";
import { Boxes, ShieldCheck, ShoppingCart, Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Category =
  | "전체" | "ChatGPT" | "Claude" | "Cursor" | "Midjourney"
  | "Perplexity" | "Gemini" | "Suno" | "Runway" | "Notion";

const CATS: Category[] = ["전체", "ChatGPT", "Claude", "Cursor", "Midjourney", "Perplexity", "Gemini", "Suno", "Runway", "Notion"];

interface Product {
  id: string;
  service: DealService;
  title: string;
  priceUsdt: number;
  warrantyDays: number;
  stock: number;            // 실시간 재고
  source: string;
  rating: number;
  lastSyncedAt: number;
}

const SEED: Omit<Product, "id" | "lastSyncedAt">[] = [
  { service: "ChatGPT Plus",   title: "ChatGPT Plus · 30일 · 1인 공유 · 즉시 로그인",      priceUsdt: 13.9, warrantyDays: 30,  stock: 24, source: "@gpt_market_kr",   rating: 4.8 },
  { service: "ChatGPT Plus",   title: "ChatGPT Plus · 90일 · 1인 전용",                    priceUsdt: 36.5, warrantyDays: 90,  stock: 9,  source: "@premium_acc_hub", rating: 4.7 },
  { service: "ChatGPT Pro",    title: "ChatGPT Pro · 30일 · 무제한 GPT-5.2",               priceUsdt: 128,  warrantyDays: 30,  stock: 4,  source: "@stark_accounts",  rating: 4.9 },
  { service: "Claude Pro",     title: "Claude Pro · 30일 · 1인 공유",                       priceUsdt: 15.2, warrantyDays: 30,  stock: 17, source: "@claude_market",   rating: 4.6 },
  { service: "Claude Max",     title: "Claude Max · 30일 · Sonnet+Opus 풀팩",              priceUsdt: 78,   warrantyDays: 30,  stock: 6,  source: "@claude_market",   rating: 4.7 },
  { service: "Cursor Pro",     title: "Cursor Pro · 90일 · 팀시트 5인",                     priceUsdt: 38,   warrantyDays: 90,  stock: 11, source: "@cursor_keys_tr",  rating: 4.8 },
  { service: "Cursor Pro",     title: "Cursor Pro · 30일 · 1인",                            priceUsdt: 12.4, warrantyDays: 30,  stock: 21, source: "@ai_deals_global", rating: 4.6 },
  { service: "Midjourney",     title: "Midjourney Standard · 30일",                         priceUsdt: 22.5, warrantyDays: 30,  stock: 7,  source: "@mj_pool_ru",      rating: 4.5 },
  { service: "Perplexity Pro", title: "Perplexity Pro · 365일 · 코드 / 이메일 즉시 발급",   priceUsdt: 6.9,  warrantyDays: 365, stock: 48, source: "@subs_resell_id",  rating: 4.9 },
  { service: "Gemini Advanced",title: "Gemini Advanced · 30일 · 2TB 포함",                  priceUsdt: 11.2, warrantyDays: 30,  stock: 13, source: "@ai_deals_global", rating: 4.6 },
  { service: "Suno Pro",       title: "Suno Pro · 30일",                                    priceUsdt: 8.4,  warrantyDays: 30,  stock: 5,  source: "@neon_deals_vn",   rating: 4.4 },
  { service: "Runway Pro",     title: "Runway Pro · 30일 · 625 credits",                    priceUsdt: 28.5, warrantyDays: 30,  stock: 3,  source: "@stark_accounts",  rating: 4.7 },
  { service: "Notion AI",      title: "Notion AI · 30일 · 무제한 AI 호출",                  priceUsdt: 7.2,  warrantyDays: 30,  stock: 19, source: "@account_bazaar",  rating: 4.5 },
];

function serviceToCategory(svc: DealService): Category {
  if (svc.startsWith("ChatGPT")) return "ChatGPT";
  if (svc.startsWith("Claude")) return "Claude";
  if (svc === "Cursor Pro") return "Cursor";
  if (svc === "Midjourney") return "Midjourney";
  if (svc === "Perplexity Pro") return "Perplexity";
  if (svc === "Gemini Advanced") return "Gemini";
  if (svc === "Suno Pro") return "Suno";
  if (svc === "Runway Pro") return "Runway";
  return "Notion";
}

function makeProducts(): Product[] {
  const now = Date.now();
  return SEED.map((p, i) => ({ ...p, id: `P-${i.toString().padStart(3, "0")}`, lastSyncedAt: now }));
}

export function AvailableProducts({ className }: { className?: string }) {
  const [cat, setCat] = useState<Category>("전체");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Product[]>(() => makeProducts());
  const [lastSync, setLastSync] = useState<Date>(new Date());

  // 3분(180s) 단위로 재고 동기화: 0인 항목 제거, 일부 항목 재고 변동, 신규 입고도 가끔 발생
  useEffect(() => {
    const tick = () => {
      setItems((prev) => {
        const updated = prev
          .map((p) => {
            const drift = Math.random() < 0.55 ? -Math.floor(Math.random() * 4) : Math.floor(Math.random() * 3);
            return { ...p, stock: Math.max(0, p.stock + drift), lastSyncedAt: Date.now() };
          })
          .filter((p) => p.stock > 0);
        // 30% 확률로 신규 입고 (한 항목 복원)
        if (Math.random() < 0.3) {
          const pool = SEED.filter((s) => !updated.find((u) => u.title === s.title));
          if (pool.length) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            updated.unshift({ ...pick, id: `P-${Math.random().toString(36).slice(2, 6)}`, lastSyncedAt: Date.now() });
          }
        }
        return updated;
      });
      setLastSync(new Date());
    };
    const t = setInterval(tick, 180_000); // 3분
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      const okCat = cat === "전체" || serviceToCategory(p.service) === cat;
      const okQ = !q.trim() || (p.title + p.source + p.service).toLowerCase().includes(q.toLowerCase());
      return okCat && okQ;
    });
  }, [items, cat, q]);

  const manualSync = () => {
    setLastSync(new Date());
    setItems((p) => p.map((x) => ({ ...x, lastSyncedAt: Date.now() })));
    toast.success("재고 동기화 완료");
  };

  return (
    <div className={cn("rounded-md border border-border bg-card/60 backdrop-blur overflow-hidden flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3 px-3 h-11 border-b border-border bg-card">
        <div className="flex items-center gap-2 text-[12px]">
          <Boxes className="h-3.5 w-3.5 text-neon" />
          <span className="font-semibold text-foreground">실시간 구매가능 상품</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground font-mono">{filtered.length}건 즉시 구매</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-mono text-muted-foreground hidden md:inline">
            마지막 동기화 {lastSync.toLocaleTimeString("ko-KR", { hour12: false })} · 3분 주기 자동
          </span>
          <button onClick={manualSync} className="h-7 px-2 inline-flex items-center gap-1 text-[11px] border border-border rounded-sm hover:bg-muted">
            <RefreshCw className="h-3 w-3" /> 동기화
          </button>
        </div>
      </div>

      <div className="px-3 pt-3 pb-2 flex flex-wrap gap-2 items-center border-b border-border bg-background/40">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품명/채널 검색" className="h-8 pl-8 text-[12px]" />
        </div>
        <div className="flex flex-wrap gap-1">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "h-7 px-2.5 text-[11.5px] rounded-sm border transition-colors",
                cat === c
                  ? "bg-neon text-[hsl(240_10%_4%)] border-neon"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">
            현재 선택된 카테고리에 즉시 구매 가능한 재고가 없습니다.<br />
            상단의 가격 알림에 등록해두면 입고 시 알려드립니다.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((p) => (
              <ProductRow key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductRow({ p }: { p: Product }) {
  const stockTone =
    p.stock <= 3 ? "text-destructive border-destructive/40 bg-destructive/10"
    : p.stock <= 8 ? "text-usdt border-usdt/40 bg-usdt/10"
    : "text-neon border-neon/40 bg-neon/10";

  return (
    <div className="px-3 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors">
      <div className="shrink-0 h-9 w-9 rounded-sm bg-muted border border-border flex items-center justify-center">
        <ServiceLogo service={p.service} size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-foreground truncate">{p.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          <span className="font-mono">{p.source}</span>
          <span>·</span>
          <span>★ {p.rating}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-0.5"><ShieldCheck className="h-3 w-3" /> {p.warrantyDays}일 보장</span>
        </div>
      </div>
      <span className={cn("text-[10.5px] font-mono px-1.5 py-0.5 border rounded-sm whitespace-nowrap", stockTone)}>
        재고 {p.stock}
      </span>
      <div className="text-right pl-2 min-w-[64px]">
        <div className="font-mono text-[14px] font-semibold text-usdt leading-none">{p.priceUsdt.toFixed(2)}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">USDT</div>
      </div>
      <button
        onClick={() => toast.success(`${p.service} · 결제 시 즉시 로그인 정보가 발송됩니다`)}
        className="shrink-0 h-9 px-3 inline-flex items-center gap-1.5 rounded-sm text-[12px] font-semibold bg-neon text-[hsl(240_10%_4%)] hover:brightness-110"
      >
        <ShoppingCart className="h-3.5 w-3.5" /> 구매
      </button>
    </div>
  );
}
