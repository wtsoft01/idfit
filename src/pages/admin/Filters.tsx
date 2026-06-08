import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Shield, Star } from "lucide-react";
import { ServiceLogo } from "@/components/deal/ServiceLogo";
import type { DealService } from "@/lib/mockDeals";

// ----- Per-product filter rule model -----
interface ProductRule {
  service: DealService;
  enabled: boolean;
  minTrust: number;       // 1.0 - 5.0 (가장 중요)
  minTrades: number;      // 판매자 누적 거래 수
  minWarrantyDays: number;
  minPrice: number;       // USDT
  maxPrice: number;       // USDT
  trustWeight: number;    // 0-100 (노출 스코어에서 신뢰도 가중)
  whitelist: string;      // 우선 노출 채널 (쉼표)
  blacklist: string;      // 차단 채널 (쉼표)
}

const SERVICES: DealService[] = [
  "ChatGPT Plus", "ChatGPT Pro", "Claude Pro", "Claude Max", "Cursor Pro",
  "Midjourney", "Perplexity Pro", "Gemini Advanced", "Suno Pro", "Runway Pro", "Notion AI",
];

const DEFAULTS: Record<DealService, Partial<ProductRule>> = {
  "ChatGPT Plus":    { minTrust: 4.2, minTrades: 50, minWarrantyDays: 30, minPrice: 8,  maxPrice: 25 },
  "ChatGPT Pro":     { minTrust: 4.6, minTrades: 80, minWarrantyDays: 30, minPrice: 100, maxPrice: 180 },
  "Claude Pro":      { minTrust: 4.3, minTrades: 40, minWarrantyDays: 30, minPrice: 10, maxPrice: 28 },
  "Claude Max":      { minTrust: 4.5, minTrades: 60, minWarrantyDays: 30, minPrice: 60, maxPrice: 120 },
  "Cursor Pro":      { minTrust: 4.0, minTrades: 30, minWarrantyDays: 14, minPrice: 6,  maxPrice: 22 },
  "Midjourney":      { minTrust: 4.1, minTrades: 35, minWarrantyDays: 30, minPrice: 14, maxPrice: 35 },
  "Perplexity Pro":  { minTrust: 3.9, minTrades: 25, minWarrantyDays: 14, minPrice: 3,  maxPrice: 16 },
  "Gemini Advanced": { minTrust: 4.0, minTrades: 30, minWarrantyDays: 14, minPrice: 5,  maxPrice: 20 },
  "Suno Pro":        { minTrust: 3.8, minTrades: 20, minWarrantyDays: 14, minPrice: 4,  maxPrice: 16 },
  "Runway Pro":      { minTrust: 4.2, minTrades: 40, minWarrantyDays: 30, minPrice: 18, maxPrice: 44 },
  "Notion AI":       { minTrust: 3.8, minTrades: 20, minWarrantyDays: 14, minPrice: 4,  maxPrice: 14 },
};

function makeRule(svc: DealService): ProductRule {
  const d = DEFAULTS[svc];
  return {
    service: svc,
    enabled: true,
    minTrust: d.minTrust ?? 4.0,
    minTrades: d.minTrades ?? 20,
    minWarrantyDays: d.minWarrantyDays ?? 14,
    minPrice: d.minPrice ?? 2,
    maxPrice: d.maxPrice ?? 500,
    trustWeight: 70, // 신뢰도가 더 중요 → 기본 70
    whitelist: "",
    blacklist: "",
  };
}

export default function AdminFilters() {
  const [rules, setRules] = useState<ProductRule[]>(() => SERVICES.map(makeRule));
  const [expanded, setExpanded] = useState<DealService | null>(null);
  const [globalTrustFloor, setGlobalTrustFloor] = useState(3.8);

  const update = (svc: DealService, patch: Partial<ProductRule>) =>
    setRules((rs) => rs.map((r) => (r.service === svc ? { ...r, ...patch } : r)));

  const stats = useMemo(() => {
    const enabled = rules.filter((r) => r.enabled).length;
    const avgTrust = (rules.reduce((s, r) => s + r.minTrust, 0) / rules.length).toFixed(2);
    return { enabled, avgTrust };
  }, [rules]);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold">노출 기준 / 필터 룰</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1 max-w-2xl">
            상품(서비스)별로 가격대가 다르므로 노출 우선순위는 <span className="text-foreground font-medium">가격 내림차순</span>으로 자동 정렬됩니다.
            대신 노출 자격을 결정하는 핵심은 <span className="text-neon font-medium">판매자 신뢰도</span>입니다. 상품별로 신뢰도 임계값을 정교하게 설정하세요.
          </p>
        </div>
        <div className="hidden md:flex gap-2 text-[11px]">
          <Pill label="활성 룰" value={`${stats.enabled}/${rules.length}`} />
          <Pill label="평균 신뢰도 컷" value={`${stats.avgTrust}★`} accent />
        </div>
      </div>

      {/* Global policy */}
      <div className="border border-border rounded-md bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-neon" />
          <span className="text-[12.5px] font-semibold">전역 정책 (모든 상품에 우선 적용)</span>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11.5px]">
              <span className="text-muted-foreground">전역 신뢰도 하한 (절대 컷)</span>
              <span className="font-mono text-usdt">{globalTrustFloor.toFixed(1)}★</span>
            </div>
            <input
              type="range" min={1} max={5} step={0.1}
              value={globalTrustFloor}
              onChange={(e) => setGlobalTrustFloor(parseFloat(e.target.value))}
              className="w-full accent-[hsl(var(--neon))]"
            />
            <div className="text-[10.5px] text-muted-foreground">
              이 점수 미만 판매자의 글은 상품 룰과 무관하게 차단됩니다.
            </div>
          </div>
          <InfoBox
            title="노출 정렬 (고정)"
            body={<>1순위: <b>신뢰도 자격</b> 통과 → 2순위: <b>가격 내림차순</b> → 3순위: 최신순</>}
          />
          <InfoBox
            title="스코어 공식"
            body={
              <span className="font-mono text-[11px]">
                score = price_norm × (100 − w) + trust_norm × w
              </span>
            }
            note="w = 상품별 신뢰도 가중치 (아래 표)"
          />
        </div>
      </div>

      {/* Per-product table */}
      <div className="border border-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[28px_1.4fr_0.8fr_0.7fr_0.7fr_1fr_1.1fr_28px] px-3 h-9 items-center bg-card text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span></span>
          <span>상품 / 서비스</span>
          <span className="flex items-center gap-1"><Star className="w-3 h-3 text-usdt" /> 최소 신뢰도</span>
          <span>최소 거래</span>
          <span>보장(일)</span>
          <span>가격대 (USDT)</span>
          <span>신뢰도 가중 (w)</span>
          <span></span>
        </div>

        {rules.map((r) => {
          const open = expanded === r.service;
          return (
            <div key={r.service} className="border-b border-border last:border-0">
              <div className={`grid grid-cols-[28px_1.4fr_0.8fr_0.7fr_0.7fr_1fr_1.1fr_28px] px-3 h-12 items-center text-[12.5px] ${r.enabled ? "" : "opacity-50"}`}>
                <input
                  type="checkbox" checked={r.enabled}
                  onChange={(e) => update(r.service, { enabled: e.target.checked })}
                  className="accent-[hsl(var(--neon))]"
                />
                <div className="flex items-center gap-2">
                  <ServiceLogo service={r.service} size={16} />
                  <span className="font-medium">{r.service}</span>
                </div>
                <TrustField value={r.minTrust} onChange={(v) => update(r.service, { minTrust: v })} />
                <NumField value={r.minTrades} step={5} onChange={(v) => update(r.service, { minTrades: v })} suffix="건" />
                <NumField value={r.minWarrantyDays} step={1} onChange={(v) => update(r.service, { minWarrantyDays: v })} />
                <div className="flex items-center gap-1.5">
                  <NumField value={r.minPrice} step={0.5} onChange={(v) => update(r.service, { minPrice: v })} compact />
                  <span className="text-muted-foreground">~</span>
                  <NumField value={r.maxPrice} step={1} onChange={(v) => update(r.service, { maxPrice: v })} compact />
                </div>
                <WeightSlider value={r.trustWeight} onChange={(v) => update(r.service, { trustWeight: v })} />
                <button
                  onClick={() => setExpanded(open ? null : r.service)}
                  className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-muted text-muted-foreground"
                  aria-label="세부 설정"
                >
                  {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>

              {open && (
                <div className="bg-background/40 px-3 py-4 border-t border-border grid md:grid-cols-2 gap-4">
                  <Detail label="우선 노출 채널 (화이트리스트)" hint="쉼표로 구분. 동일 가격일 때 우선 노출됩니다.">
                    <input
                      value={r.whitelist}
                      onChange={(e) => update(r.service, { whitelist: e.target.value })}
                      placeholder="@gpt_market_kr, @premium_acc_hub"
                      className="w-full h-8 px-2 bg-background border border-border rounded-sm text-[12px] font-mono focus:outline-none focus:border-neon"
                    />
                  </Detail>
                  <Detail label="차단 채널 (블랙리스트)" hint="아무리 가격이 싸도 노출되지 않습니다.">
                    <input
                      value={r.blacklist}
                      onChange={(e) => update(r.service, { blacklist: e.target.value })}
                      placeholder="@cheap_ai_china, @ai_grayzone"
                      className="w-full h-8 px-2 bg-background border border-border rounded-sm text-[12px] font-mono focus:outline-none focus:border-neon"
                    />
                  </Detail>
                  <Detail label="신뢰도 산정 가중" hint="판매자 신뢰도 = 평점×0.5 + AS응답속도×0.3 + 분쟁률(역)×0.2 (기본)">
                    <div className="flex flex-wrap gap-2 text-[11.5px]">
                      <Chip>평점 0.5</Chip>
                      <Chip>AS속도 0.3</Chip>
                      <Chip>분쟁률⁻¹ 0.2</Chip>
                      <Chip>+ 누적거래 {r.minTrades}건 이상</Chip>
                    </div>
                  </Detail>
                  <Detail label="요약" hint="이 상품의 현재 노출 조건">
                    <div className="text-[12px] text-muted-foreground leading-relaxed">
                      <span className="text-foreground">{r.service}</span> — 신뢰도{" "}
                      <span className="text-usdt font-mono">{r.minTrust.toFixed(1)}★</span> 이상,
                      거래 <span className="font-mono">{r.minTrades}</span>건 이상,
                      보장 <span className="font-mono">{r.minWarrantyDays}</span>일 이상,
                      가격 <span className="font-mono text-usdt">{r.minPrice}~{r.maxPrice} USDT</span>,
                      신뢰도 가중 <span className="font-mono">{r.trustWeight}%</span>.
                    </div>
                  </Detail>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="h-9 px-4 bg-neon text-[hsl(240_10%_4%)] text-[12.5px] font-semibold rounded-sm">
          저장하고 적용
        </button>
        <button
          onClick={() => setRules(SERVICES.map(makeRule))}
          className="h-9 px-4 border border-border text-[12.5px] rounded-sm hover:bg-muted"
        >
          기본값 복원
        </button>
        <button
          onClick={() => setRules((rs) => rs.map((r) => ({ ...r, minTrust: Math.min(5, r.minTrust + 0.1) })))}
          className="h-9 px-4 border border-border text-[12.5px] rounded-sm hover:bg-muted"
        >
          전체 신뢰도 +0.1
        </button>
      </div>
    </div>
  );
}

// ----- subcomponents -----
function Pill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-border rounded-sm px-2.5 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className={`font-mono text-[13px] ${accent ? "text-neon" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
function InfoBox({ title, body, note }: { title: string; body: React.ReactNode; note?: string }) {
  return (
    <div className="border border-border rounded-sm p-2.5 bg-background/40">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono mb-1">{title}</div>
      <div className="text-[12px]">{body}</div>
      {note && <div className="text-[10.5px] text-muted-foreground mt-1">{note}</div>}
    </div>
  );
}
function TrustField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number" step={0.1} min={1} max={5} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-14 h-7 px-2 bg-background border border-border rounded-sm font-mono text-[12px] text-usdt focus:outline-none focus:border-neon"
      />
      <span className="text-usdt text-[12px]">★</span>
    </div>
  );
}
function NumField({ value, onChange, step = 1, suffix, compact }: { value: number; onChange: (v: number) => void; step?: number; suffix?: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`${compact ? "w-14" : "w-16"} h-7 px-2 bg-background border border-border rounded-sm font-mono text-[12px] focus:outline-none focus:border-neon`}
      />
      {suffix && <span className="text-[11px] text-muted-foreground">{suffix}</span>}
    </div>
  );
}
function WeightSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 pr-2">
      <input
        type="range" min={0} max={100} step={5} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="flex-1 accent-[hsl(var(--neon))]"
      />
      <span className="font-mono text-[11.5px] w-16 text-right">
        <span className="text-muted-foreground">가격</span>
        <span className="text-foreground"> {100 - value}</span>
        <span className="text-muted-foreground"> · 신뢰</span>
        <span className="text-neon"> {value}</span>
      </span>
    </div>
  );
}
function Detail({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11.5px] font-semibold">{label}</div>
      {children}
      {hint && <div className="text-[10.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-0.5 border border-border rounded-sm font-mono">{children}</span>;
}
