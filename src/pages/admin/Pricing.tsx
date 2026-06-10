import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products"> & {
  source?: Pick<Tables<"telegram_sources">, "telegram_identifier" | "source_type"> | null;
};

type ProductTab = "active" | "ended";
type StockFilter = "all" | "in_stock" | "low" | "sold_out" | "unknown";

const DEFAULT_MARGIN_RATE = 60;

function isSupabaseConfigured() {
  const url = import.meta.env.VITE_SUPABASE_URL ?? "";
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  return Boolean(url && key && !key.includes("…"));
}

function calculatePrice(costValue: number, marginRateValue: number) {
  const cost = Number(costValue || 0);
  const marginRate = Number(marginRateValue || 0);
  const salePrice = Number((cost * (1 + marginRate / 100)).toFixed(4));
  const marginUsdt = Number((salePrice - cost).toFixed(4));
  return { salePrice, marginUsdt, marginRate: Number(marginRate.toFixed(4)) };
}

function isActiveProduct(product: Product) {
  return product.status === "visible" && ["in_stock", "low"].includes(product.stock_state);
}

function statusLabel(product: Product) {
  if (isActiveProduct(product)) return "판매중";
  if (product.status === "sold_out" || product.stock_state === "sold_out") return "품절";
  if (product.status === "expired") return "종료";
  if (product.status === "hidden") return "숨김";
  return product.status;
}

function money(value: number | null | undefined) {
  return Number(value ?? 0).toFixed(4);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminPricing() {
  const configured = useMemo(isSupabaseConfigured, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<ProductTab>("active");
  const [bulkMargin, setBulkMargin] = useState(String(DEFAULT_MARGIN_RATE));
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [productMargins, setProductMargins] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeProducts = useMemo(() => products.filter(isActiveProduct), [products]);
  const endedProducts = useMemo(() => products.filter((product) => !isActiveProduct(product)), [products]);
  const sourceOptions = useMemo(() => {
    return Array.from(new Set(products.map((product) => product.source?.telegram_identifier ?? "소스 없음"))).sort((a, b) => a.localeCompare(b));
  }, [products]);
  const visibleProducts = useMemo(() => {
    const base = tab === "active" ? activeProducts : endedProducts;
    const keyword = query.trim().toLowerCase();
    return base.filter((product) => {
      const sourceName = product.source?.telegram_identifier ?? "소스 없음";
      if (stockFilter !== "all" && product.stock_state !== stockFilter) return false;
      if (sourceFilter !== "all" && sourceName !== sourceFilter) return false;
      if (!keyword) return true;
      return [product.title, product.service_name, sourceName, product.status, product.stock_state]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [activeProducts, endedProducts, query, sourceFilter, stockFilter, tab]);

  const loadProducts = async () => {
    if (!configured) {
      setError("Supabase publishable key가 설정되지 않아 상품 조회를 대기 중입니다.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    const { data, error: queryError } = await supabase
      .from("products")
      .select("*, source:telegram_sources(telegram_identifier, source_type)")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Product[];
    setProducts(rows);
    setProductMargins(Object.fromEntries(rows.map((product) => [product.id, String(Number(product.margin_rate ?? 0))])));
    setLoading(false);
  };

  const updateProducts = async (targets: Product[], marginResolver: (product: Product) => number, successMessage: string) => {
    if (!targets.length) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    const updatedRows: Product[] = [];
    for (const product of targets) {
      const marginRate = marginResolver(product);
      const nextPrice = calculatePrice(Number(product.supplier_cost_usdt), marginRate);
      const { data, error: updateError } = await supabase
        .from("products")
        .update({
          sale_price_usdt: nextPrice.salePrice,
          margin_usdt: nextPrice.marginUsdt,
          margin_rate: nextPrice.marginRate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id)
        .select("*, source:telegram_sources(telegram_identifier, source_type)")
        .single();

      if (updateError) {
        setError(`${product.title}: ${updateError.message}`);
        setSaving(false);
        return;
      }

      updatedRows.push(data as Product);
    }

    setProducts((current) => current.map((product) => updatedRows.find((row) => row.id === product.id) ?? product));
    setProductMargins((current) => ({
      ...current,
      ...Object.fromEntries(updatedRows.map((product) => [product.id, String(Number(product.margin_rate ?? 0))])),
    }));
    setNotice(successMessage);
    setSaving(false);
  };

  const applyBulkMargin = async () => {
    const marginRate = Number(bulkMargin);
    if (!Number.isFinite(marginRate) || marginRate < 0) {
      setError("일괄 마진율은 0 이상의 숫자로 입력해주세요.");
      return;
    }

    const ok = window.confirm(`등록된 전체 상품 ${products.length}개에 마진 ${marginRate}%를 적용할까요?`);
    if (!ok) return;

    await updateProducts(products, () => marginRate, `전체 상품 ${products.length}개에 마진 ${marginRate}%를 적용했습니다.`);
  };

  const removeSoldOutFromActive = async () => {
    const targets = products.filter((product) => product.status === "visible" && (product.stock_state === "sold_out" || Number(product.stock_count ?? 1) <= 0));
    if (!targets.length) {
      await loadProducts();
      setNotice("현재 판매중 상품에서 제거할 품절 상품이 없습니다. 최신 재고 상태로 새로고침했습니다.");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const { data, error: updateError } = await supabase
      .from("products")
      .update({ status: "sold_out", stock_state: "sold_out", stock_count: 0, updated_at: new Date().toISOString() })
      .in("id", targets.map((product) => product.id))
      .select("*, source:telegram_sources(telegram_identifier, source_type)");

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    const updatedRows = (data ?? []) as Product[];
    setProducts((current) => current.map((product) => updatedRows.find((row) => row.id === product.id) ?? product));
    setNotice(`재고소진 상품 ${updatedRows.length}개를 판매중 목록에서 제거했습니다.`);
    setSaving(false);
  };

  const applyProductMargin = async (product: Product) => {
    const marginRate = Number(productMargins[product.id]);
    if (!Number.isFinite(marginRate) || marginRate < 0) {
      setError("개별 마진율은 0 이상의 숫자로 입력해주세요.");
      return;
    }

    await updateProducts([product], () => marginRate, `${product.title} 상품에 마진 ${marginRate}%를 적용했습니다.`);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">가격정책</h1>
          <p className="text-[12.5px] text-muted-foreground">기본 판매가는 수집 원가에 60% 마진을 가산합니다. 상품 검색/필터로 필요한 항목만 빠르게 찾을 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={removeSoldOutFromActive} disabled={loading || saving} className="h-9 px-3 border border-destructive/40 text-destructive rounded-sm text-[12.5px] inline-flex items-center gap-1 disabled:opacity-50 hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" />품절 판매중 정리
          </button>
          <button onClick={loadProducts} disabled={loading || saving} className="h-9 px-3 border border-border rounded-sm text-[12.5px] inline-flex items-center gap-1 disabled:opacity-50">
            <RefreshCw className={("h-3.5 w-3.5 " + (loading ? "animate-spin" : "")).trim()} />재고 리프레시
          </button>
        </div>
      </div>

      {error && <div className="border border-destructive/40 bg-destructive/10 text-destructive rounded-sm px-3 py-2 text-[12.5px]">{error}</div>}
      {notice && <div className="border border-neon/40 bg-neon/10 text-neon rounded-sm px-3 py-2 text-[12.5px]">{notice}</div>}

      <section className="border border-border rounded-md bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[12.5px] font-semibold">전체 상품 일괄 마진</div>
            <div className="text-[11.5px] text-muted-foreground">기본값은 수집 원가 + 60%입니다. 판매중/종료/숨김 포함 등록된 전체 상품 {products.length}개에 적용됩니다.</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={bulkMargin}
              onChange={(event) => setBulkMargin(event.target.value)}
              className="w-24 h-9 px-3 bg-background border border-border rounded-sm font-mono text-[12.5px] outline-none focus:border-neon"
              inputMode="decimal"
            />
            <span className="text-[12px] text-muted-foreground">%</span>
            <button onClick={applyBulkMargin} disabled={saving || loading || !products.length} className="h-9 px-4 bg-neon text-[hsl(240_10%_4%)] text-[12.5px] font-semibold rounded-sm disabled:opacity-50">
              전체 적용
            </button>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 border-b border-border">
        <button onClick={() => setTab("active")} className={`h-10 px-3 text-[12.5px] border-b-2 ${tab === "active" ? "border-neon text-neon" : "border-transparent text-muted-foreground"}`}>
          판매중 상품 {activeProducts.length}
        </button>
        <button onClick={() => setTab("ended")} className={`h-10 px-3 text-[12.5px] border-b-2 ${tab === "ended" ? "border-neon text-neon" : "border-transparent text-muted-foreground"}`}>
          종료된 상품 {endedProducts.length}
        </button>
      </div>

      <section className="border border-border rounded-md bg-card p-3 grid gap-2 md:grid-cols-[1fr_160px_220px_auto] items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="상품명, 서비스명, 수집소스 검색"
            className="w-full h-9 pl-9 pr-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon"
          />
        </div>
        <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value as StockFilter)} className="h-9 px-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon">
          <option value="all">전체 재고</option>
          <option value="in_stock">재고있음</option>
          <option value="low">재고적음</option>
          <option value="sold_out">품절</option>
          <option value="unknown">확인필요</option>
        </select>
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="h-9 px-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon min-w-0">
          <option value="all">전체 수집소스</option>
          {sourceOptions.map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
        <div className="text-[12px] text-muted-foreground whitespace-nowrap">표시 {visibleProducts.length}개 / 전체 {products.length}개</div>
      </section>

      <div className="border border-border rounded-md overflow-hidden bg-card">
        <div className="grid grid-cols-[1.5fr_0.55fr_0.55fr_0.65fr_0.65fr_0.65fr_0.7fr_0.8fr_auto] px-3 h-9 items-center text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span>상품</span><span>상태</span><span>재고</span><span>원가</span><span>현재 판매가</span><span>현재 마진</span><span>개별 마진</span><span>예상 판매가</span><span></span>
        </div>
        {loading ? (
          <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">상품을 불러오는 중입니다.</div>
        ) : visibleProducts.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">표시할 상품이 없습니다.</div>
        ) : visibleProducts.map((product) => {
          const draftMargin = Number(productMargins[product.id] ?? product.margin_rate ?? 0);
          const preview = calculatePrice(Number(product.supplier_cost_usdt), Number.isFinite(draftMargin) ? draftMargin : 0);
          return (
            <div key={product.id} className="grid grid-cols-[1.5fr_0.55fr_0.55fr_0.65fr_0.65fr_0.65fr_0.7fr_0.8fr_auto] px-3 min-h-14 items-center gap-2 text-[12.5px] border-b border-border last:border-0">
              <div className="min-w-0 py-2">
                <div className="font-medium truncate">{product.title}</div>
                <div className="text-[11px] text-muted-foreground truncate">{product.service_name} · {product.source?.telegram_identifier ?? "소스 없음"} · 갱신 {formatDate(product.updated_at)}</div>
              </div>
              <span className={isActiveProduct(product) ? "text-neon" : "text-muted-foreground"}>{statusLabel(product)}</span>
              <span className="font-mono text-muted-foreground">{product.stock_count ?? product.stock_state}</span>
              <span className="font-mono text-muted-foreground">{money(product.supplier_cost_usdt)}</span>
              <span className="font-mono text-usdt">{money(product.sale_price_usdt)}</span>
              <span className="font-mono">{Number(product.margin_rate ?? 0).toFixed(2)}%</span>
              <div className="flex items-center gap-1">
                <input
                  value={productMargins[product.id] ?? ""}
                  onChange={(event) => setProductMargins((current) => ({ ...current, [product.id]: event.target.value }))}
                  className="w-20 h-8 px-2 bg-background border border-border rounded-sm font-mono text-[12px] outline-none focus:border-neon"
                  inputMode="decimal"
                />
                <span className="text-[11px] text-muted-foreground">%</span>
              </div>
              <span className="font-mono text-neon">{money(preview.salePrice)}</span>
              <button onClick={() => applyProductMargin(product)} disabled={saving || loading} className="h-8 px-2.5 border border-border rounded-sm text-[11.5px] inline-flex items-center gap-1 disabled:opacity-50 hover:border-neon">
                <Save className="h-3 w-3" />적용
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
