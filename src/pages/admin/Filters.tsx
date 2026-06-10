import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Shield, Star, TrendingUp, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

type Seller = Tables<"sellers">;
type Source = Tables<"telegram_sources">;
type Product = Pick<Tables<"products">, "id" | "seller_id" | "source_id" | "status" | "stock_state" | "stock_count">;
type Order = Pick<Tables<"orders">, "id" | "product_id" | "status">;
type AsTicket = Pick<Tables<"as_tickets">, "id" | "order_id" | "status">;

type SellerScore = {
  key: string;
  sellerId: string | null;
  sourceId: string | null;
  sellerName: string;
  identifier: string;
  sourceLabel: string;
  sourceStatus: Source["status"] | "unknown";
  autoCollect: boolean;
  currentTrust: number | null;
  calculatedTrust: number;
  buyerRating: number;
  buyerReviewCount: number;
  soldOutSignals: number;
  confirmedOrders: number;
  asCount: number;
  failureCount: number;
  successCount: number;
  exposure: "auto" | "watch" | "limit" | "block";
  reason: string;
};

const PASS_FLOOR = 72;
const WATCH_FLOOR = 58;

function asRecord(value: Json | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberFrom(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function displayScore(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "auto";
  return Number(value).toFixed(1);
}

function exposureLabel(exposure: SellerScore["exposure"]) {
  if (exposure === "auto") return "자동노출";
  if (exposure === "watch") return "관찰";
  if (exposure === "limit") return "제한노출";
  return "차단검토";
}

function exposureClass(exposure: SellerScore["exposure"]) {
  if (exposure === "auto") return "border-neon/40 bg-neon/10 text-neon";
  if (exposure === "watch") return "border-cyan/40 bg-cyan/10 text-cyan";
  if (exposure === "limit") return "border-orange-300/40 bg-orange-300/10 text-orange-300";
  return "border-destructive/40 bg-destructive/10 text-destructive";
}

function scoreExposure(score: number, asCount: number, failureCount: number): SellerScore["exposure"] {
  if (failureCount >= 3 || score < 45) return "block";
  if (asCount >= 5 || score < WATCH_FLOOR) return "limit";
  if (score < PASS_FLOOR) return "watch";
  return "auto";
}

function calculateSellerTrust(input: {
  buyerRating: number;
  buyerReviewCount: number;
  soldOutSignals: number;
  confirmedOrders: number;
  asCount: number;
  failureCount: number;
  successCount: number;
}) {
  const ratingScore = clamp((input.buyerRating / 5) * 100);
  const ratingConfidence = clamp(input.buyerReviewCount / 20, 0.15, 1);
  const buyerScore = 60 + (ratingScore - 60) * ratingConfidence;

  const salesSignals = input.soldOutSignals + input.confirmedOrders + input.successCount;
  const salesScore = clamp(35 + Math.log10(salesSignals + 1) * 32, 35, 100);
  const asPenalty = Math.min(24, input.asCount * 4);
  const failPenalty = Math.min(32, input.failureCount * 8);

  return clamp(buyerScore * 0.52 + salesScore * 0.38 + 10 - asPenalty - failPenalty);
}

function buildScores(params: {
  sellers: Seller[];
  sources: Source[];
  products: Product[];
  orders: Order[];
  asTickets: AsTicket[];
}): SellerScore[] {
  const productById = new Map(params.products.map((product) => [product.id, product]));
  const sourceById = new Map(params.sources.map((source) => [source.id, source]));
  const rows = new Map<string, SellerScore>();

  const ensureRow = (seller: Seller | null, source: Source | null): SellerScore => {
    const key = seller?.id ? `seller:${seller.id}` : `source:${source?.id ?? "unknown"}`;
    const existing = rows.get(key);
    if (existing) return existing;

    const metadata = asRecord(seller?.metadata);
    const sourceMeta = asRecord(source?.metadata);
    const profile = asRecord(sourceMeta.profile as Json | undefined);
    const buyerRating = clamp(numberFrom(metadata.buyer_rating ?? metadata.avg_rating ?? sourceMeta.buyer_rating, 4.2), 1, 5);
    const buyerReviewCount = Math.max(0, Math.round(numberFrom(metadata.buyer_review_count ?? metadata.review_count ?? sourceMeta.buyer_review_count, 0)));

    const row: SellerScore = {
      key,
      sellerId: seller?.id ?? null,
      sourceId: seller?.source_id ?? source?.id ?? null,
      sellerName: seller?.display_name || String(profile.title ?? source?.name ?? source?.telegram_identifier ?? "미확인 판매자"),
      identifier: seller?.telegram_identifier ?? source?.telegram_identifier ?? "-",
      sourceLabel: source?.name ?? source?.telegram_identifier ?? "-",
      sourceStatus: source?.status ?? "unknown",
      autoCollect: Boolean(source?.auto_collect_enabled),
      currentTrust: seller?.trust_score ?? source?.trust_override ?? null,
      calculatedTrust: 0,
      buyerRating,
      buyerReviewCount,
      soldOutSignals: Math.max(0, seller?.observed_sales_count ?? 0),
      confirmedOrders: 0,
      asCount: Math.max(0, seller?.as_count ?? 0),
      failureCount: Math.max(0, seller?.failure_count ?? 0),
      successCount: Math.max(0, seller?.success_count ?? 0),
      exposure: "watch",
      reason: "",
    };

    rows.set(key, row);
    return row;
  };

  for (const source of params.sources) ensureRow(null, source);

  for (const seller of params.sellers) {
    ensureRow(seller, sourceById.get(seller.source_id) ?? null);
  }

  for (const product of params.products) {
    const seller = params.sellers.find((item) => item.id === product.seller_id) ?? null;
    const source = product.source_id ? sourceById.get(product.source_id) ?? null : null;
    const row = ensureRow(seller, source);
    if (product.stock_state === "sold_out" || product.status === "sold_out" || Number(product.stock_count ?? 1) <= 0) {
      row.soldOutSignals += 1;
    }
  }

  for (const order of params.orders) {
    const product = productById.get(order.product_id);
    if (!product) continue;
    const seller = params.sellers.find((item) => item.id === product.seller_id) ?? null;
    const source = product.source_id ? sourceById.get(product.source_id) ?? null : null;
    const row = ensureRow(seller, source);
    if (["payment_confirmed", "purchasing", "delivered", "as_open"].includes(order.status)) row.confirmedOrders += 1;
    if (["delivered"].includes(order.status)) row.successCount += 1;
    if (["failed", "refunded_review"].includes(order.status)) row.failureCount += 1;
  }

  for (const ticket of params.asTickets) {
    const order = params.orders.find((item) => item.id === ticket.order_id);
    const product = order ? productById.get(order.product_id) : null;
    if (!product) continue;
    const seller = params.sellers.find((item) => item.id === product.seller_id) ?? null;
    const source = product.source_id ? sourceById.get(product.source_id) ?? null : null;
    ensureRow(seller, source).asCount += 1;
  }

  for (const row of rows.values()) {
    row.calculatedTrust = calculateSellerTrust(row);
    row.exposure = scoreExposure(row.calculatedTrust, row.asCount, row.failureCount);
    row.reason = `평가 ${row.buyerRating.toFixed(1)}점/${row.buyerReviewCount}건 · 재고소진 ${row.soldOutSignals}건 · 확정주문 ${row.confirmedOrders}건 · AS ${row.asCount}건`;
  }

  return [...rows.values()].sort((a, b) => b.calculatedTrust - a.calculatedTrust);
}

export default function AdminFilters() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [asTickets, setAsTickets] = useState<AsTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minExposeScore, setMinExposeScore] = useState(PASS_FLOOR);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [sellerResult, sourceResult, productResult, orderResult, asResult] = await Promise.all([
      supabase.from("sellers").select("*").order("updated_at", { ascending: false }).limit(300),
      supabase.from("telegram_sources").select("*").order("updated_at", { ascending: false }).limit(500),
      supabase.from("products").select("id,seller_id,source_id,status,stock_state,stock_count").limit(3000),
      supabase.from("orders").select("id,product_id,status").limit(3000),
      supabase.from("as_tickets").select("id,order_id,status").limit(3000),
    ]);

    const firstError = sellerResult.error ?? sourceResult.error ?? productResult.error ?? orderResult.error ?? asResult.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setSellers(sellerResult.data ?? []);
    setSources(sourceResult.data ?? []);
    setProducts((productResult.data ?? []) as Product[]);
    setOrders((orderResult.data ?? []) as Order[]);
    setAsTickets((asResult.data ?? []) as AsTicket[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const scores = useMemo(() => buildScores({ sellers, sources, products, orders, asTickets }), [sellers, sources, products, orders, asTickets]);
  const passCount = scores.filter((item) => item.calculatedTrust >= minExposeScore && item.exposure !== "block").length;
  const blockedCount = scores.filter((item) => item.exposure === "block" || item.calculatedTrust < WATCH_FLOOR).length;
  const averageScore = scores.length ? scores.reduce((sum, item) => sum + item.calculatedTrust, 0) / scores.length : 0;

  const applyTrust = async (row: SellerScore) => {
    setSavingKey(row.key);
    setError(null);
    const score = Number((row.calculatedTrust / 20).toFixed(2));
    const sellerScore = Number(row.calculatedTrust.toFixed(2));

    if (row.sellerId) {
      const { error: sellerError } = await supabase
        .from("sellers")
        .update({
          trust_score: sellerScore,
          observed_sales_count: row.soldOutSignals,
          success_count: row.successCount,
          failure_count: row.failureCount,
          as_count: row.asCount,
          metadata: {
            buyer_rating: row.buyerRating,
            buyer_review_count: row.buyerReviewCount,
            trust_formula: "buyer_rating_52 + stock_depletion_sales_38 - as_failure_penalty",
            last_calculated_trust: sellerScore,
            last_calculated_at: new Date().toISOString(),
          },
        })
        .eq("id", row.sellerId);
      if (sellerError) setError(sellerError.message);
    }

    if (row.sourceId) {
      const { error: sourceError } = await supabase
        .from("telegram_sources")
        .update({ trust_override: score })
        .eq("id", row.sourceId);
      if (sourceError) setError(sourceError.message);
    }

    await loadData();
    setSavingKey(null);
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold">노출필터</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1 max-w-3xl">
            상품명이나 가격이 아니라 <span className="text-neon font-medium">판매자 신뢰도</span>로 노출 여부를 판단합니다.
            구매자 평가가 쌓이면 평가 점수를 반영하고, 수집 상품의 재고 소진 신호를 판매량으로 보고 신뢰도를 계산합니다.
          </p>
        </div>
        <button onClick={loadData} className="h-9 px-3 border border-border rounded-sm text-[12.5px] inline-flex items-center gap-1.5 hover:bg-muted" disabled={loading}>
          <RefreshCw className={(loading ? "animate-spin " : "") + "h-4 w-4"} /> 새로고침
        </button>
      </div>

      {error && <div className="border border-destructive/40 bg-destructive/10 text-destructive rounded-md p-3 text-[12.5px]">{error}</div>}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric icon={Shield} label="평균 판매자 신뢰도" value={`${averageScore.toFixed(1)}/100`} tone="neon" />
        <Metric icon={CheckCircle2} label="노출 가능 판매자" value={`${passCount}/${scores.length}`} tone="cyan" />
        <Metric icon={AlertTriangle} label="차단/제한 검토" value={`${blockedCount}`} tone="orange" />
        <Metric icon={TrendingUp} label="재고소진 판매 신호" value={`${scores.reduce((sum, item) => sum + item.soldOutSignals, 0)}건`} tone="usdt" />
      </div>

      <div className="border border-border rounded-md bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-neon" />
          <span className="text-[13px] font-semibold">판매자 신뢰도 계산 기준</span>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <InfoBox title="구매자 평가 52%" body="향후 주문 완료 후 구매자가 남긴 평점/리뷰 수를 반영합니다. 리뷰가 적으면 과신하지 않도록 보수적으로 계산합니다." />
          <InfoBox title="재고소진 판매량 38%" body="수집된 판매자 상품이 sold out 또는 재고 0으로 바뀐 횟수와 확정 주문을 판매 신호로 계산합니다." />
          <InfoBox title="AS/실패 패널티" body="AS 접수, 실패/환불검토 주문이 많으면 점수를 차감합니다. 상품명과 가격은 신뢰도 계산에서 제외합니다." />
        </div>
        <div className="space-y-1.5 max-w-md">
          <div className="flex justify-between text-[11.5px]">
            <span className="text-muted-foreground">자동노출 기준점</span>
            <span className="font-mono text-neon">{minExposeScore}/100</span>
          </div>
          <input type="range" min={45} max={90} step={1} value={minExposeScore} onChange={(event) => setMinExposeScore(Number(event.target.value))} className="w-full accent-[hsl(var(--neon))]" />
        </div>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1.35fr_0.8fr_0.75fr_0.8fr_0.85fr_0.8fr_1.2fr_120px] px-3 h-9 items-center bg-card text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span>판매자</span><span>현재/계산</span><span>구매자평가</span><span>재고소진</span><span>확정/성공</span><span>AS/실패</span><span>판정 근거</span><span></span>
        </div>
        {scores.map((row) => (
          <div key={row.key} className="grid lg:grid-cols-[1.35fr_0.8fr_0.75fr_0.8fr_0.85fr_0.8fr_1.2fr_120px] gap-2 px-3 py-3 border-b border-border last:border-b-0 text-[12.5px] items-center hover:bg-muted/20">
            <div className="min-w-0">
              <div className="font-medium truncate">{row.sellerName}</div>
              <div className="font-mono text-[11.5px] text-muted-foreground truncate">{row.identifier} · {row.autoCollect ? "수집ON" : "수집OFF"}</div>
            </div>
            <div className="font-mono">
              <span className="text-muted-foreground">현재 </span><span className="text-usdt">{displayScore(row.currentTrust)}</span>
              <span className="text-muted-foreground"> / 계산 </span><span className="text-neon">{row.calculatedTrust.toFixed(1)}</span>
            </div>
            <div className="font-mono text-usdt flex items-center gap-1"><Star className="h-3.5 w-3.5" />{row.buyerRating.toFixed(1)} <span className="text-muted-foreground">({row.buyerReviewCount})</span></div>
            <div className="font-mono">{row.soldOutSignals}건</div>
            <div className="font-mono">{row.confirmedOrders}/{row.successCount}</div>
            <div className="font-mono text-muted-foreground">{row.asCount}/{row.failureCount}</div>
            <div className="space-y-1 min-w-0">
              <span className={"inline-flex px-1.5 py-0.5 border rounded-sm text-[10.5px] " + exposureClass(row.exposure)}>{exposureLabel(row.exposure)}</span>
              <div className="truncate text-[11.5px] text-muted-foreground" title={row.reason}>{row.reason}</div>
            </div>
            <button onClick={() => applyTrust(row)} disabled={savingKey === row.key} className="h-8 px-2 border border-neon/40 text-neon rounded-sm text-[11.5px] hover:bg-neon/10 disabled:opacity-50">
              {savingKey === row.key ? "반영중" : "신뢰도 반영"}
            </button>
          </div>
        ))}
        {!loading && scores.length === 0 && <div className="p-6 text-center text-[12.5px] text-muted-foreground">평가할 판매자/수집소스가 없습니다.</div>}
        {loading && <div className="p-6 text-center text-[12.5px] text-muted-foreground">판매자 데이터를 불러오는 중입니다.</div>}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Shield; label: string; value: string; tone: "neon" | "cyan" | "orange" | "usdt" }) {
  const toneClass = tone === "neon" ? "text-neon" : tone === "cyan" ? "text-cyan" : tone === "orange" ? "text-orange-300" : "text-usdt";
  return (
    <div className="border border-border bg-card rounded-md p-3">
      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground"><Icon className={"h-4 w-4 " + toneClass} />{label}</div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
    </div>
  );
}

function InfoBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-border rounded-sm bg-background/40 p-3">
      <div className="text-[12px] font-semibold">{title}</div>
      <div className="mt-1 text-[11.5px] text-muted-foreground leading-relaxed">{body}</div>
    </div>
  );
}
