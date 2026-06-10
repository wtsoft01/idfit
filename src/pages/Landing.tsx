import { Link } from "react-router-dom";
import { BrandLockup } from "@/components/Brand";
import { LockedOverlay } from "@/components/deal/LockedOverlay";
import { AIScanLog } from "@/components/deal/AIScanLog";
import { ReviewMarquee } from "@/components/deal/ReviewMarquee";
import { ServiceLogo } from "@/components/deal/ServiceLogo";
import type { DealService } from "@/lib/mockDeals";
import { Zap, ShieldCheck, Wallet, Sparkles, ArrowRight, Globe2, Radio, Filter, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";

const tickerItems: { svc: DealService; min: number; max: number }[] = [
  { svc: "ChatGPT Plus", min: 12.4, max: 21.8 },
  { svc: "Claude Pro", min: 14.0, max: 25.0 },
  { svc: "Cursor Pro", min: 10.2, max: 18.5 },
  { svc: "Midjourney", min: 18.8, max: 31.0 },
  { svc: "Perplexity Pro", min: 4.2, max: 13.6 },
  { svc: "Gemini Advanced", min: 8.4, max: 17.2 },
];

function PriceTicker() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-md border border-border bg-card divide-y divide-border">
      {tickerItems.map((item, index) => {
        const seed = (tick + index) % 7;
        const price = (item.min + (seed / 6) * (item.max - item.min)).toFixed(2);
        const isBest = seed < 2;
        return (
          <div key={item.svc} className={"flex items-center justify-between px-3 h-9 text-[12px] " + (isBest ? "ticker-blink" : "")}>
            <span className="flex items-center gap-2 text-foreground">
              <ServiceLogo service={item.svc} size={14} />
              {item.svc}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-usdt font-semibold">{price}</span>
              <span className="text-[10px] text-muted-foreground">USDT</span>
              {isBest && <span className="text-[9.5px] text-neon font-mono uppercase">best</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const signalStats = [
  { label: "Global sources", value: "327", tone: "text-cyan" },
  { label: "Raw signals", value: "24/7", tone: "text-neon" },
  { label: "Sold-out hidden", value: "AUTO", tone: "text-usdt" },
];

const livePreviewProducts = [
  { service: "ChatGPT Plus" as DealService, title: "ChatGPT Plus · 30일 보장", price: "4.50", stock: 7, age: "12초 전" },
  { service: "Claude Pro" as DealService, title: "Claude Pro · 즉시 전달", price: "6.20", stock: 2, age: "28초 전" },
  { service: "Cursor Pro" as DealService, title: "Cursor Pro · 신규 재고", price: "3.90", stock: 14, age: "43초 전" },
];

const liveTickerItems = [
  "Vietnam Telegram bot scanned 135 signals",
  "Sold-out and zero-stock items hidden instantly",
  "Global supplier data filtered into live products",
  "Only in-stock ID products stay visible",
];

const radarPoints = [
  "left-[18%] top-[26%] delay-0",
  "left-[62%] top-[18%] delay-150",
  "left-[78%] top-[48%] delay-300",
  "left-[36%] top-[64%] delay-500",
  "left-[52%] top-[42%] delay-700",
];

function GlobalScannerPanel() {
  return (
    <div className="relative overflow-hidden rounded-md border border-neon/25 bg-card/80 p-4 shadow-neon">
      <div className="absolute inset-0 grid-bg opacity-25" />
      <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-neon/10 blur-3xl" />
      <div className="relative flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground font-mono">
        <span className="flex items-center gap-1.5"><Radio className="h-3 w-3 text-neon pulse-dot" /> Global scanner</span>
        <span>live · filtered</span>
      </div>

      <div className="relative mt-4 h-56 rounded-sm border border-border/80 bg-background/70 overflow-hidden">
        <div className="absolute inset-6 rounded-full border border-neon/20" />
        <div className="absolute inset-14 rounded-full border border-cyan/15" />
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon shadow-neon" />
        <div className="scanner-sweep absolute left-1/2 top-1/2 h-[1px] w-28 origin-left bg-gradient-to-r from-neon to-transparent" />
        {radarPoints.map((point) => (
          <span key={point} className={`absolute ${point} h-2 w-2 rounded-full bg-neon shadow-neon pulse-dot`} />
        ))}
        <div className="absolute inset-x-4 bottom-4 space-y-1.5 text-[10.5px] font-mono">
          <PipelineStep icon={<Radio className="h-3 w-3" />} text="Telegram bot scanned" value="135 signals" />
          <PipelineStep icon={<Filter className="h-3 w-3" />} text="Duplicate / sold-out filtered" value="verified" />
          <PipelineStep icon={<EyeOff className="h-3 w-3" />} text="Zero stock removed from display" value="instant" />
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-3 gap-2">
        {signalStats.map((stat) => (
          <div key={stat.label} className="rounded-sm border border-border bg-background/70 px-2.5 py-2">
            <div className={`font-mono text-base font-bold ${stat.tone}`}>{stat.value}</div>
            <div className="text-[9.5px] text-muted-foreground uppercase font-mono truncate">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineStep({ icon, text, value }: { icon: React.ReactNode; text: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-sm border border-border bg-card/80 px-2 py-1.5 text-muted-foreground">
      <span className="flex items-center gap-1.5 text-foreground/85">{icon}{text}</span>
      <span className="text-neon uppercase">{value}</span>
    </div>
  );
}

function CollectionTicker() {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card/80 h-10 flex items-center">
      <div className="ticker-track flex items-center gap-8 whitespace-nowrap px-4 text-[11px] font-mono text-muted-foreground uppercase">
        {[...liveTickerItems, ...liveTickerItems].map((item, index) => (
          <span key={`${item}-${index}`} className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-neon pulse-dot" /> {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function LiveProductPreview() {
  return (
    <div className="rounded-md border border-border bg-card/70 overflow-hidden">
      <div className="flex items-center justify-between px-3 h-10 border-b border-border bg-card text-[11px] font-mono uppercase tracking-wider">
        <span className="flex items-center gap-2 text-foreground"><span className="text-neon">LIVE</span> 상품 카드</span>
        <span className="text-muted-foreground">stock verified</span>
      </div>
      <div className="divide-y divide-border">
        {livePreviewProducts.map((product) => (
          <div key={product.title} className="flex items-center gap-3 px-3 py-3 hover:bg-muted/30 transition-colors">
            <div className="h-9 w-9 rounded-sm border border-border bg-background flex items-center justify-center shrink-0">
              <ServiceLogo service={product.service} size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-1.5 py-0.5 rounded-sm bg-neon/10 border border-neon/40 text-[9.5px] text-neon font-mono">LIVE</span>
                <span className="text-[13px] font-medium truncate">{product.title}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10.5px] text-muted-foreground font-mono">
                <span>재고 {product.stock}</span><span>·</span><span>갱신 {product.age}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-usdt font-semibold text-[14px]">{product.price}</div>
              <div className="text-[10px] text-muted-foreground">USDT</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto h-14 px-4 flex items-center justify-between">
          <Link to="/"><BrandLockup size={18} /></Link>
          <nav className="hidden md:flex items-center gap-6 text-[12.5px] text-muted-foreground">
            <a href="#board" className="hover:text-foreground">Live Board</a>
            <a href="#reviews" className="hover:text-foreground">Reviews</a>
            <a href="#features" className="hover:text-foreground">Features</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="text-[12.5px] text-muted-foreground hover:text-foreground px-2">로그인</Link>
            <Link to="/auth" className="h-8 px-3 inline-flex items-center text-[12px] font-semibold bg-neon text-[hsl(240_10%_4%)] rounded-sm hover:brightness-110">
              시작하기
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
        <div className="absolute inset-x-0 -top-32 h-72 bg-gradient-to-b from-neon/10 via-neon/5 to-transparent blur-2xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-12 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm border border-border bg-card text-[11px] text-muted-foreground font-mono uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-neon pulse-dot" /> IDFIT · live AI account market
            </div>
            <div className="font-mono text-[13px] md:text-[14px] text-neon uppercase tracking-[0.24em]">Global ID Market Scanner</div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight whitespace-pre-line">
              전세계 공급처 데이터를 실시간 수집하고,{"\n"}
              <span className="text-neon glow-text">재고 있는 상품만</span> 즉시 전시합니다.
            </h1>
            <p className="text-[15px] text-muted-foreground max-w-xl leading-relaxed whitespace-pre-line">
              IDFIT은 텔레그램 봇·채널·공급처 신호를 빠르게 수집하고, 중복·품절·재고 없는 상품을 걸러 구매 가능한 ID 상품만 전시하는 실시간 마켓 스캐너입니다.{"\n"}
              빠르게 올라오고 빠르게 소진되는 상품을 놓치지 않도록, 수집부터 전시 제외까지 한 흐름으로 처리합니다.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/auth" className="h-11 px-5 inline-flex items-center gap-2 bg-neon text-[hsl(240_10%_4%)] text-[13.5px] font-semibold rounded-sm hover:brightness-110 shadow-neon">
                <Zap className="h-4 w-4" /> 관리자 시작하기
              </Link>
              <a href="#board" className="h-11 px-5 inline-flex items-center gap-2 border border-border text-[13.5px] rounded-sm hover:bg-muted">
                실시간 상품 보기 <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11.5px] text-muted-foreground font-mono">
              <span>· Global Telegram scanner</span><span>· Auto stock filtering</span><span>· Sold-out display removal</span>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3">
            <GlobalScannerPanel />
            <CollectionTicker />
            <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground font-mono pt-1">
              <span className="flex items-center gap-1.5"><Globe2 className="h-3 w-3 text-neon" /> Live products</span>
              <span>updated · just now</span>
            </div>
            <LiveProductPreview />
            <div className="text-[11px] text-muted-foreground">재고가 확인된 상품만 전시에 남고, 품절·재고 0 신호는 자동으로 숨김 처리됩니다.</div>
          </div>
        </div>
      </section>

      <section id="board" className="border-t border-border bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
            <div>
              <div className="text-[11px] text-neon font-mono uppercase tracking-widest mb-1">live deal board</div>
              <h2 className="font-display text-2xl md:text-3xl font-bold">수집 → 필터링 → 전시 제외까지 실시간 처리</h2>
              <p className="text-[13px] text-muted-foreground mt-1">전세계 공급처 신호를 빠르게 스캔하고, 구매 가능한 재고만 라이브 보드에 남기는 화면입니다.</p>
            </div>
            <Link to="/auth" className="text-[12px] text-neon hover:underline font-mono">관리자 로그인</Link>
          </div>

          <div className="grid lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 order-2 lg:order-1 relative overflow-hidden rounded-md border border-border bg-card/60 h-[min(72vh,720px)]">
              <AIScanLog className="h-full opacity-35 blur-[1px]" />
              <LockedOverlay />
            </div>
            <div className="lg:col-span-8 order-1 lg:order-2 relative overflow-hidden rounded-md border border-border bg-card/60 h-[min(72vh,720px)]">
              <div className="h-full p-4 opacity-70 blur-[0.5px]">
                <LiveProductPreview />
                <div className="mt-3 text-center text-[12px] text-muted-foreground">
                  로그인 후 실제 수집 상품과 재고를 실시간으로 확인할 수 있습니다.
                </div>
              </div>
              <LockedOverlay />
            </div>
          </div>
        </div>
      </section>

      <section id="reviews" className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-12 space-y-5">
          <div className="grid md:grid-cols-3 gap-3">
            <Stat label="글로벌 수집 소스" value="327" suffix="개" />
            <Stat label="재고 필터링" value="AUTO" />
            <Stat label="전시 제외" value="실시간" suffix="처리" />
          </div>
        </div>
        <ReviewMarquee />
      </section>

      <section id="features" className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-14 grid md:grid-cols-3 gap-4">
          <Feature
            icon={<Sparkles className="h-5 w-5 text-neon" />}
            title="전세계 소스 실시간 수집"
            text="텔레그램 채널·그룹·봇에서 빠르게 올라오는 ID 판매 신호를 모아 상품 후보로 정리합니다."
          />
          <Feature
            icon={<Wallet className="h-5 w-5 text-usdt" />}
            title="재고 있는 상품만 전시"
            text="재고 수량과 품절 신호를 기준으로 구매 가능한 상품만 남기고, unknown·재고 0 상품은 숨깁니다."
          />
          <Feature
            icon={<ShieldCheck className="h-5 w-5 text-cyan" />}
            title="빠른 소진 대응"
            text="소진 신호가 다시 들어오면 기존 노출 상품을 sold-out 처리해 사용자가 헛구매하지 않도록 줄입니다."
          />
        </div>
      </section>

      <section className="border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 py-20 text-center space-y-5">
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            IDFIT으로 <span className="text-neon">실시간 ID 마켓 스캐너</span>를 운영하세요.
          </h2>
          <p className="text-muted-foreground text-[14px]">핵심은 빠른 수집, 빠른 전시, 빠른 품절 제외입니다. 필요한 기능만 가볍게 유지합니다.</p>
          <Link to="/auth" className="inline-flex items-center gap-2 h-12 px-6 bg-neon text-[hsl(240_10%_4%)] text-[14px] font-semibold rounded-sm shadow-neon hover:brightness-110">
            <Zap className="h-4 w-4" /> 관리자 계정 만들기
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-8 flex items-center justify-between text-[11.5px] text-muted-foreground">
          <BrandLockup size={14} />
          <span>© {new Date().getFullYear()} IDFIT. AI account operations.</span>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="border border-border rounded-md p-4 bg-card">
      <div className="text-[11px] text-muted-foreground uppercase font-mono tracking-wider">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">
        {value}<span className="text-muted-foreground text-base font-normal ml-1">{suffix}</span>
      </div>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="border border-border rounded-md p-5 bg-card hover:border-neon/40 transition-colors">
      <div className="h-9 w-9 rounded-sm bg-muted border border-border flex items-center justify-center mb-3">{icon}</div>
      <div className="font-display text-base font-semibold">{title}</div>
      <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">{text}</p>
    </div>
  );
}
