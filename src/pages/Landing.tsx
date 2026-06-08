import { Link } from "react-router-dom";
import { BrandLockup } from "@/components/Brand";
import { AvailableProducts } from "@/components/deal/AvailableProducts";
import { AIScanLog } from "@/components/deal/AIScanLog";
import { ReviewMarquee } from "@/components/deal/ReviewMarquee";
import { ServiceLogo } from "@/components/deal/ServiceLogo";
import type { DealService } from "@/lib/mockDeals";
import { Zap, ShieldCheck, Wallet, Sparkles, ArrowRight, Globe2 } from "lucide-react";
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
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight whitespace-pre-line">
              AI 계정 판매 정보를 수집하고,{"\n"}
              <span className="text-neon glow-text">신뢰 가능한 상품만</span> 운영하세요.
            </h1>
            <p className="text-[15px] text-muted-foreground max-w-xl leading-relaxed whitespace-pre-line">
              IDFIT은 텔레그램 판매 소스의 AI 계정 정보를 수집하고, 판매자 신뢰도·재고·마진을 함께 관리하는 디지털 상품 운영 시스템입니다.{"\n"}
              결제는 USDT 중심으로 시작하고, 관리자 확인 후 상품 전달·AS까지 한 흐름으로 관리합니다.
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
              <span>· Telegram source tracking</span><span>· USDT payment ops</span><span>· Seller trust management</span>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5"><Globe2 className="h-3 w-3 text-neon" /> Live Pricing</span>
              <span>updated · just now</span>
            </div>
            <PriceTicker />
            <div className="text-[11px] text-muted-foreground">실제 판매 가격은 수집된 소스와 마진 규칙을 기준으로 계속 동기화됩니다.</div>
          </div>
        </div>
      </section>

      <section id="board" className="border-t border-border bg-background">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
            <div>
              <div className="text-[11px] text-neon font-mono uppercase tracking-widest mb-1">live deal board</div>
              <h2 className="font-display text-2xl md:text-3xl font-bold">AI 계정 상품 후보를 한 화면에서 확인</h2>
              <p className="text-[13px] text-muted-foreground mt-1">수집된 원본 메시지, 후보 상품, 가격 신호, 판매자 상태를 관리자 중심으로 확인하는 화면입니다.</p>
            </div>
            <Link to="/auth" className="text-[12px] text-neon hover:underline font-mono">관리자 로그인</Link>
          </div>

          <div className="grid lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 order-2 lg:order-1">
              <AIScanLog className="h-[min(72vh,720px)]" />
            </div>
            <div className="lg:col-span-8 order-1 lg:order-2 relative">
              <AvailableProducts className="h-[min(72vh,720px)]" />
            </div>
          </div>
        </div>
      </section>

      <section id="reviews" className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-12 space-y-5">
          <div className="grid md:grid-cols-3 gap-3">
            <Stat label="수집 소스" value="327" suffix="개" />
            <Stat label="운영 통화" value="USDT" />
            <Stat label="핵심 모드" value="관리자" suffix="확인" />
          </div>
        </div>
        <ReviewMarquee />
      </section>

      <section id="features" className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-14 grid md:grid-cols-3 gap-4">
          <Feature
            icon={<Sparkles className="h-5 w-5 text-neon" />}
            title="실시간 소스 관리"
            text="텔레그램 채널·그룹·봇을 등록하고 수집 상태, 신뢰도 보정, 자동수집 여부를 관리합니다."
          />
          <Feature
            icon={<Wallet className="h-5 w-5 text-usdt" />}
            title="USDT 결제 운영"
            text="MVP는 관리자 확인 기반 USDT 결제로 시작하고, 이후 지갑 watcher 자동화로 확장할 수 있습니다."
          />
          <Feature
            icon={<ShieldCheck className="h-5 w-5 text-cyan" />}
            title="판매자 신뢰도 관리"
            text="판매자 이력, 가격 이상치, 재고 신호를 함께 보며 위험한 상품 후보를 운영 단계에서 걸러냅니다."
          />
        </div>
      </section>

      <section className="border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 py-20 text-center space-y-5">
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            IDFIT으로 <span className="text-neon">AI 계정 판매 운영</span>을 시작하세요.
          </h2>
          <p className="text-muted-foreground text-[14px]">먼저 수집 소스와 관리자 화면을 안정화한 뒤 자동구매와 AS 자동화로 확장합니다.</p>
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
