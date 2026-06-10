import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Shield, TrendingUp } from "lucide-react";
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
  sourceMetadata: Record<string, unknown>;
  currentTrust: number | null;
  calculatedTrust: number;
  soldOutSignals: number;
  confirmedOrders: number;
  successCount: number;
  salesSignals: number;
  applyMode: "applied" | "excluded" | "none";
  exposure: "all" | "auto" | "watch" | "limit";
  reason: string;
};

const DEFAULT_DATA_READY_SIGNALS = 20;
const DEFAULT_AUTO_SALES_SIGNALS = 5;

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
  if (exposure === "all") return "전체노출";
  if (exposure === "auto") return "자동노출";
  if (exposure === "watch") return "판매데이터 관찰";
  return "제한검토";
}

function exposureClass(exposure: SellerScore["exposure"]) {
  if (exposure === "all") return "border-cyan/40 bg-cyan/10 text-cyan";
  if (exposure === "auto") return "border-neon/40 bg-neon/10 text-neon";
  if (exposure === "watch") return "border-usdt/40 bg-usdt/10 text-usdt";
  return "border-orange-300/40 bg-orange-300/10 text-orange-300";
}

function applyModeLabel(mode: SellerScore["applyMode"]) {
  if (mode === "applied") return "반영적용";
  if (mode === "excluded") return "반영제외";
  return "미선택";
}

function calculateSalesTrust(salesSignals: number) {
  if (salesSignals <= 0) return 60;
  return clamp(60 + Math.log10(salesSignals + 1) * 22, 60, 100);
}

function buildScores(params: {
  sellers: Seller[];
  sources: Source[];
  products: Product[];
  orders: Order[];
  asTickets: AsTicket[];
  dataReadySignals: number;
  autoSalesSignals: number;
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
    const exposureFilter = asRecord(sourceMeta.exposure_filter as Json | undefined);
    const profile = asRecord(sourceMeta.profile as Json | undefined);

    const row: SellerScore = {
      key,
      sellerId: seller?.id ?? null,
      sourceId: seller?.source_id ?? source?.id ?? null,
      sellerName: seller?.display_name || String(profile.title ?? source?.name ?? source?.telegram_identifier ?? "미확인 판매자"),
      identifier: seller?.telegram_identifier ?? source?.telegram_identifier ?? "-",
      sourceLabel: source?.name ?? source?.telegram_identifier ?? "-",
      sourceStatus: source?.status ?? "unknown",
      autoCollect: Boolean(source?.auto_collect_enabled),
      sourceMetadata: sourceMeta,
      currentTrust: seller?.trust_score ?? source?.trust_override ?? null,
      calculatedTrust: 0,
      soldOutSignals: Math.max(0, seller?.observed_sales_count ?? 0),
      confirmedOrders: 0,
      successCount: Math.max(0, seller?.success_count ?? 0),
      salesSignals: 0,
      applyMode: exposureFilter.mode === "applied" || exposureFilter.mode === "excluded" ? exposureFilter.mode : "none",
      exposure: "all",
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
  }

  void params.asTickets;

  const totalSalesSignals = [...rows.values()].reduce((sum, row) => sum + row.soldOutSignals + row.confirmedOrders + row.successCount, 0);
  const dataReady = totalSalesSignals >= params.dataReadySignals;

  for (const row of rows.values()) {
    row.salesSignals = row.soldOutSignals + row.confirmedOrders + row.successCount;
    row.calculatedTrust = calculateSalesTrust(row.salesSignals);
    row.exposure = !dataReady ? "all" : row.salesSignals >= params.autoSalesSignals ? "auto" : row.salesSignals > 0 ? "watch" : "limit";
    row.reason = !dataReady
      ? `전체 판매데이터 ${totalSalesSignals}/${params.dataReadySignals}건 · 데이터 누적 전이라 전체노출`
      : `판매신호 ${row.salesSignals}건 · 재고소진 ${row.soldOutSignals}건 · 확정주문 ${row.confirmedOrders}건 · 성공 ${row.successCount}건`;
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
  const [dataReadySignals, setDataReadySignals] = useState(DEFAULT_DATA_READY_SIGNALS);
  const [autoSalesSignals, setAutoSalesSignals] = useState(DEFAULT_AUTO_SALES_SIGNALS);

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

  const scores = useMemo(
    () => buildScores({ sellers, sources, products, orders, asTickets, dataReadySignals, autoSalesSignals }),
    [sellers, sources, products, orders, asTickets, dataReadySignals, autoSalesSignals],
  );
  const totalSalesSignals = scores.reduce((sum, item) => sum + item.salesSignals, 0);
  const dataReady = totalSalesSignals >= dataReadySignals;
  const passCount = scores.filter((item) => item.exposure === "all" || item.exposure === "auto").length;
  const excludedCount = scores.filter((item) => item.applyMode === "excluded").length;
  const averageScore = scores.length ? scores.reduce((sum, item) => sum + item.calculatedTrust, 0) / scores.length : 0;

  const saveApplyMode = async (row: SellerScore, mode: "applied" | "excluded") => {
    setSavingKey(`${row.key}:${mode}`);
    setError(null);
    const score = Number((row.calculatedTrust / 20).toFixed(2));
    const sellerScore = Number(row.calculatedTrust.toFixed(2));
    const exposureFilter = {
      mode,
      basis: "sales_only_until_buyer_reviews_exist",
      data_ready: dataReady,
      data_ready_signals: dataReadySignals,
      auto_sales_signals: autoSalesSignals,
      calculated_trust: sellerScore,
      sales_signals: row.salesSignals,
      sold_out_signals: row.soldOutSignals,
      confirmed_orders: row.confirmedOrders,
      success_count: row.successCount,
      exposure: row.exposure,
      updated_at: new Date().toISOString(),
    };

    if (row.sellerId) {
      const { error: sellerError } = await supabase
        .from("sellers")
        .update({
          trust_score: sellerScore,
          observed_sales_count: row.soldOutSignals,
          success_count: row.successCount,
          metadata: {
            sales_signals: row.salesSignals,
            trust_formula: "sales_only_until_buyer_reviews_exist",
            exposure_filter: exposureFilter,
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
        .update({
          trust_override: mode === "applied" ? score : null,
          metadata: {
            ...row.sourceMetadata,
            exposure_filter: exposureFilter,
          },
        })
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
            초기에는 데이터가 부족하므로 <span className="text-cyan font-medium">전체노출</span>로 운영합니다.
            판매데이터가 충분히 쌓이면 많이 팔린 검증 판매자를 <span className="text-neon font-medium">자동노출</span>로 반영합니다.
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
        <Metric icon={AlertTriangle} label="반영제외 선택" value={`${excludedCount}`} tone="orange" />
        <Metric icon={TrendingUp} label="전체 판매 신호" value={`${totalSalesSignals}/${dataReadySignals}건`} tone="usdt" />
      </div>

      <div className="border border-border rounded-md bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-neon" />
          <span className="text-[13px] font-semibold">노출필터 운영 기준</span>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <InfoBox title="데이터 누적 전: 전체노출" body="전체 판매 신호가 기준치에 도달하기 전에는 판매자별 우열을 판단하지 않고 전체 노출로 둡니다." />
          <InfoBox title="판매데이터 기준" body="현재는 평가 데이터가 없으므로 재고소진, 확정주문, 성공주문만 판매 신호로 사용합니다." />
          <InfoBox title="선택 저장" body="관리자는 판매자별로 반영적용 또는 반영제외를 선택할 수 있습니다. 반영적용 시 수집소스 신뢰도에 계산값을 저장합니다." />
        </div>
        <div className="grid md:grid-cols-2 gap-4 max-w-2xl">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11.5px]">
              <span className="text-muted-foreground">데이터 반영 시작 기준</span>
              <span className="font-mono text-usdt">전체 {dataReadySignals}건</span>
            </div>
            <input type="range" min={5} max={100} step={5} value={dataReadySignals} onChange={(event) => setDataReadySignals(Number(event.target.value))} className="w-full accent-[hsl(var(--usdt))]" />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11.5px]">
              <span className="text-muted-foreground">자동노출 판매 신호 기준</span>
              <span className="font-mono text-neon">판매자별 {autoSalesSignals}건</span>
            </div>
            <input type="range" min={1} max={30} step={1} value={autoSalesSignals} onChange={(event) => setAutoSalesSignals(Number(event.target.value))} className="w-full accent-[hsl(var(--neon))]" />
          </div>
        </div>
        <div className="text-[11.5px] text-muted-foreground">현재 상태: {dataReady ? "판매데이터 기준 반영 가능" : "데이터 부족 — 전체노출 유지"}</div>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1.35fr_0.8fr_0.7fr_0.8fr_0.85fr_0.8fr_1.2fr_170px] px-3 h-9 items-center bg-card text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span>판매자</span><span>현재/계산</span><span>판매신호</span><span>재고소진</span><span>확정/성공</span><span>선택상태</span><span>판정 근거</span><span></span>
        </div>
        {scores.map((row) => (
          <div key={row.key} className="grid lg:grid-cols-[1.35fr_0.8fr_0.7fr_0.8fr_0.85fr_0.8fr_1.2fr_170px] gap-2 px-3 py-3 border-b border-border last:border-b-0 text-[12.5px] items-center hover:bg-muted/20">
            <div className="min-w-0">
              <div className="font-medium truncate">{row.sellerName}</div>
              <div className="font-mono text-[11.5px] text-muted-foreground truncate">{row.identifier} · {row.autoCollect ? "수집ON" : "수집OFF"}</div>
            </div>
            <div className="font-mono">
              <span className="text-muted-foreground">현재 </span><span className="text-usdt">{displayScore(row.currentTrust)}</span>
              <span className="text-muted-foreground"> / 계산 </span><span className="text-neon">{row.calculatedTrust.toFixed(1)}</span>
            </div>
            <div className="font-mono text-usdt">{row.salesSignals}건</div>
            <div className="font-mono">{row.soldOutSignals}건</div>
            <div className="font-mono">{row.confirmedOrders}/{row.successCount}</div>
            <div className="font-mono text-muted-foreground">{applyModeLabel(row.applyMode)}</div>
            <div className="space-y-1 min-w-0">
              <span className={"inline-flex px-1.5 py-0.5 border rounded-sm text-[10.5px] " + exposureClass(row.exposure)}>{exposureLabel(row.exposure)}</span>
              <div className="truncate text-[11.5px] text-muted-foreground" title={row.reason}>{row.reason}</div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => saveApplyMode(row, "applied")} disabled={savingKey === `${row.key}:applied`} className="h-8 px-2 border border-neon/40 text-neon rounded-sm text-[11.5px] hover:bg-neon/10 disabled:opacity-50">
                {savingKey === `${row.key}:applied` ? "저장중" : "반영적용"}
              </button>
              <button onClick={() => saveApplyMode(row, "excluded")} disabled={savingKey === `${row.key}:excluded`} className="h-8 px-2 border border-orange-300/40 text-orange-300 rounded-sm text-[11.5px] hover:bg-orange-300/10 disabled:opacity-50">
                {savingKey === `${row.key}:excluded` ? "저장중" : "반영제외"}
              </button>
            </div>
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
