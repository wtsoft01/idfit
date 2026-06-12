import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ServiceLogo } from "./ServiceLogo";
import type { DealService } from "@/lib/mockDeals";
import { Activity, Boxes, ShieldCheck, ShoppingCart, Search, RefreshCw, Database, Sparkles, QrCode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatUsdt4, makeUniqueUsdtAmount } from "@/lib/payment-amount";
import { DEFAULT_PAYMENT_NETWORK, getEnabledWallet, getPaymentQrImageUrl, isConfiguredPaymentAddress, normalizePaymentAsset, parsePaymentSettings, type PaymentNetwork, type PaymentSettings, type PaymentWalletSetting } from "@/lib/payment-config";
import { maskSourceIdentifier } from "@/lib/source-privacy";
import { normalizeDisplayService } from "@/lib/service-classifier";

type Category = string;

const FALLBACK_CATEGORY = "기타";
const CATEGORY_ALIASES: Array<[RegExp, string]> = [
  [/chat\s*gpt|openai|gpt/i, "ChatGPT"],
  [/claude|anthropic/i, "Claude"],
  [/cursor/i, "Cursor"],
  [/midjourney|mj\b/i, "Midjourney"],
  [/perplexity/i, "Perplexity"],
  [/gemini|google\s*ai/i, "Gemini"],
  [/suno/i, "Suno"],
  [/runway/i, "Runway"],
  [/openart/i, "OpenArt"],
  [/canva/i, "Canva"],
  [/higgsfield/i, "Higgsfield"],
  [/capcut/i, "CapCut"],
  [/grok/i, "Grok"],
  [/netflix/i, "Netflix"],
  [/spotify/i, "Spotify"],
  [/youtube/i, "YouTube"],
  [/figma/i, "Figma"],
  [/notion/i, "Notion"],
];

type BoardProductRow = Tables<"board_products">;

type ProductRowData = {
  id: string;
  service_name: string;
  title: string;
  description: string | null;
  sale_price_usdt: number;
  stock_state: BoardProductRow["stock_state"];
  stock_count: number | null;
  status: BoardProductRow["status"];
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: BoardProductRow["metadata"];
  source_label: string | null;
  source_trust: number | null;
};

type BoardTab = "available" | "ended";

type SortMode = "recent" | "price_low" | "price_high" | "sales_high";

const SORT_LABELS: Record<SortMode, string> = {
  recent: "최신등록순",
  price_low: "낮은가격순",
  price_high: "높은가격순",
  sales_high: "판매량순",
};

interface Product {
  id: string;
  service: DealService;
  title: string;
  description: string;
  priceUsdt: number;
  warrantyDays: number;
  stock: number;
  source: string;
  rating: number;
  lastSyncedAt: number;
  createdAt: number;
  status: BoardProductRow["status"];
  stockState: BoardProductRow["stock_state"];
  salesCount: number;
}

function inferCategory(product: Pick<Product, "service" | "title">): string {
  const text = `${product.service} ${product.title}`.trim();
  const matched = CATEGORY_ALIASES.find(([pattern]) => pattern.test(text));
  if (matched) return matched[1];

  const token = text
    .replace(/[·|()[\]{}:,_+]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .find((part) => /^[\p{L}\p{N}][\p{L}\p{N}.-]{2,}$/u.test(part) && !/^(pro|plus|max|slot|năm|nam|tháng|thang|link|chính|chu|chủ|nang|nâng|cap|cấp|ngày|day|days|month|months|year|years|account|shared|gói)$/i.test(part));

  return token ? token.charAt(0).toUpperCase() + token.slice(1) : FALLBACK_CATEGORY;
}

function serviceToCategory(product: Pick<Product, "service" | "title">): string {
  return inferCategory(product);
}

function metadataNumber(metadata: BoardProductRow["metadata"], key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata[key];
  return typeof value === "number" ? value : null;
}

function mapProduct(row: ProductRowData): Product {
  const warrantyDays = metadataNumber(row.metadata, "warranty_days") ?? metadataNumber(row.metadata, "warrantyDays") ?? 30;
  const stock = row.stock_count ?? (row.stock_state === "low" ? 3 : row.stock_state === "sold_out" ? 0 : 99);
  const salesCount = metadataNumber(row.metadata, "sales_count") ?? metadataNumber(row.metadata, "observed_sales_count") ?? 0;
  return {
    id: row.id,
    service: normalizeDisplayService(row.service_name, row.title),
    title: row.title,
    description: row.description,
    priceUsdt: Number(row.sale_price_usdt),
    warrantyDays,
    stock,
    source: maskSourceIdentifier(row.source_label),
    rating: Number(row.source_trust ?? 4.3),
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at).getTime() : new Date(row.updated_at).getTime(),
    createdAt: new Date(row.created_at).getTime(),
    status: row.status,
    stockState: row.stock_state,
    salesCount,
  };
}

function getPaymentWalletOptions(settings: PaymentSettings): PaymentWalletSetting[] {
  return settings.wallets.filter((wallet) =>
    wallet.enabled
    && normalizePaymentAsset(wallet.asset) === "USDT"
    && isConfiguredPaymentAddress(wallet.network, wallet.address)
  );
}

function normalizeProductRows(rows: ProductRowData[]) {
  const unique = new Map<string, ProductRowData>();
  for (const row of rows) unique.set(row.id, row);
  return Array.from(unique.values()).map(mapProduct);
}

async function fetchFallbackProducts() {
  const [available, ended] = await Promise.all([
    supabase
      .from("visible_products")
      .select("id,service_name,title,description,sale_price_usdt,stock_state,stock_count,last_synced_at,updated_at,metadata,source_label,source_trust")
      .or("stock_count.is.null,stock_count.gt.0")
      .order("last_synced_at", { ascending: false, nullsFirst: false })
      .limit(1000),
    supabase
      .from("products")
      .select("id,service_name,title,description,sale_price_usdt,stock_state,stock_count,status,last_synced_at,created_at,updated_at,metadata")
      .or("status.in.(sold_out,expired),stock_state.eq.sold_out,stock_count.lte.0")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1000),
  ]);

  if (available.error) return { products: [], error: available.error.message };
  const availableRows = ((available.data ?? []) as Tables<"visible_products">[]).map((row) => ({ ...row, status: "visible", created_at: row.updated_at } as ProductRowData));
  const endedRows = ended.error ? [] : ((ended.data ?? []) as Array<Omit<ProductRowData, "source_label" | "source_trust">>).map((row) => {
    const source = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? String(row.metadata.source ?? "판매종료") : "판매종료";
    return { ...row, source_label: source, source_trust: null } as ProductRowData;
  });
  return { products: normalizeProductRows([...availableRows, ...endedRows]), error: ended.error ? "판매종료 상품 일부 조회 권한이 제한되어 구매가능 상품만 표시합니다." : null };
}

async function getUnavailablePendingAmounts(paymentNetwork: PaymentNetwork, paymentAddress: string, windowMinutes: number) {
  if (!isSupabaseConfigured || !paymentAddress) return [];

  const cutoff = new Date(Date.now() - Math.max(Number(windowMinutes) || 60, 1) * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select("sale_price_usdt")
    .eq("status", "payment_pending")
    .eq("payment_network", paymentNetwork)
    .eq("payment_address", paymentAddress)
    .gte("created_at", cutoff);

  if (error) return [];
  return (data ?? []).map((row) => row.sale_price_usdt);
}

export function AvailableProducts({ className }: { className?: string }) {
  const [cat, setCat] = useState<Category>("전체");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<BoardTab>("available");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(parsePaymentSettings(null));
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const loadPaymentSettings = async () => {
    if (!isSupabaseConfigured) return;
    const { data, error: settingsError } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "payment")
      .maybeSingle();

    if (!settingsError) setPaymentSettings(parsePaymentSettings(data?.value));
  };

  const loadProducts = async () => {
    if (!isSupabaseConfigured) {
      setItems([]);
      setError("Supabase 연결 전입니다. 실제 수집 상품만 표시합니다.");
      setLastSync(new Date());
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: soldOutError } = await supabase.rpc("idfit_mark_depleted_products_sold_out");
      if (soldOutError && !/Could not find the function|schema cache/i.test(soldOutError.message)) {
        console.warn("재고소진 자동 이동 RPC 실패", soldOutError.message);
      }
    } catch {
      // Older databases may not have the RPC until the latest migration is applied.
    }

    const { data, error: queryError } = await supabase
      .from("board_products")
      .select("id,service_name,title,description,sale_price_usdt,stock_state,stock_count,status,last_synced_at,created_at,updated_at,metadata,source_label,source_trust")
      .order("last_synced_at", { ascending: false, nullsFirst: false })
      .limit(1000);

    if (queryError) {
      const fallback = await fetchFallbackProducts();

      if (fallback.error && fallback.products.length === 0) {
        setItems([]);
        setError(`실제 상품 DB 조회 실패: ${fallback.error}`);
      } else {
        setItems(fallback.products);
        setError(fallback.error);
      }
    } else {
      const products = normalizeProductRows((data ?? []) as BoardProductRow[]);
      setItems(products);
      setError(products.length === 0 ? "아직 노출 중인 실제 수집 상품이 없습니다." : null);
    }

    setLastSync(new Date());
    setLoading(false);
  };

  useEffect(() => {
    loadPaymentSettings();
    loadProducts();
    const productsTimer = window.setInterval(loadProducts, 5000);
    return () => {
      window.clearInterval(productsTimer);
    };
  }, []);

  const availableItems = useMemo(
    () => items.filter((item) => item.status === "visible" && ["in_stock", "low"].includes(item.stockState) && item.stock > 0),
    [items]
  );
  const endedItems = useMemo(
    () => items.filter((item) => item.status === "sold_out" || item.status === "expired" || item.stockState === "sold_out" || item.stock <= 0),
    [items]
  );

  const activeItems = tab === "available" ? availableItems : endedItems;
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of activeItems) {
      const category = serviceToCategory(item);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return counts;
  }, [activeItems]);
  const categories = useMemo(
    () => ["전체", ...Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([category]) => category)],
    [categoryCounts]
  );

  useEffect(() => {
    if (cat !== "전체" && !categoryCounts.has(cat)) setCat("전체");
  }, [cat, categoryCounts]);

  const filtered = useMemo(() => {
    const list = activeItems.filter((p) => {
      const okCat = cat === "전체" || serviceToCategory(p) === cat;
      const okQ = !q.trim() || (p.title + p.service).toLowerCase().includes(q.toLowerCase());
      return okCat && okQ;
    });
    return [...list].sort((a, b) => {
      if (sortMode === "price_low") return a.priceUsdt - b.priceUsdt;
      if (sortMode === "price_high") return b.priceUsdt - a.priceUsdt;
      if (sortMode === "sales_high") return b.salesCount - a.salesCount || b.lastSyncedAt - a.lastSyncedAt;
      return b.createdAt - a.createdAt || b.lastSyncedAt - a.lastSyncedAt;
    });
  }, [activeItems, cat, q, sortMode]);

  const manualSync = async () => {
    await loadProducts();
    toast.success(isSupabaseConfigured ? "실제 상품 데이터 동기화 완료" : "Supabase 연결 전입니다");
  };

  return (
    <div className={cn("rounded-md border border-border bg-card/60 backdrop-blur overflow-hidden flex flex-col min-w-0 max-w-full", className)}>
      <div className="flex items-center justify-between gap-3 px-3 h-auto min-h-11 py-2 border-b border-border bg-card flex-wrap">
        <div className="flex flex-wrap items-center gap-2 text-[12px] min-w-0">
          <span className="inline-flex items-center gap-1 rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-neon">
            <Activity className="h-3.5 w-3.5 pulse-dot" /> 실시간 제공
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-usdt/40 bg-usdt/10 px-2 py-0.5 text-usdt">
            <ShieldCheck className="h-3.5 w-3.5" /> 필터 통과
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> 즉시 구매 가능
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-neon">
            <ShoppingCart className="h-3.5 w-3.5" /> 구매가능 {availableItems.length.toLocaleString()}건
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-destructive">
            판매종료 {endedItems.length.toLocaleString()}건
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="font-semibold text-foreground">즉시구매상품</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground font-mono">{tab === "available" ? "구매가능" : "판매종료"} 표시 {filtered.length.toLocaleString()}건 / 전체 {activeItems.length.toLocaleString()}건</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10.5px] font-mono text-muted-foreground hidden md:inline">
            동기화 {lastSync.toLocaleTimeString("ko-KR", { hour12: false })}
          </span>
          <button onClick={manualSync} disabled={loading} className="h-7 px-2 inline-flex items-center gap-1 text-[11px] border border-border rounded-sm hover:bg-muted disabled:opacity-60">
            <RefreshCw className={"h-3 w-3 " + (loading ? "animate-spin" : "")} /> 동기화
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 border-b border-usdt/30 bg-usdt/10 text-usdt text-[11.5px] flex items-center gap-2">
          <Database className="h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}

      <div className="px-3 py-3 border-b border-border bg-background/40 space-y-2 min-w-0">
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <div className="text-[17px] font-bold text-foreground">즉시 구매 가능 상품</div>
            <div className="mt-1 flex items-center gap-1 rounded-sm border border-border bg-card/70 p-0.5 w-fit">
              <button
                onClick={() => setTab("available")}
                className={cn("h-7 px-2.5 rounded-[3px] text-[11.5px] font-semibold transition-colors", tab === "available" ? "bg-neon text-[hsl(240_10%_4%)]" : "text-muted-foreground hover:text-foreground")}
              >
                구매가능 {availableItems.length.toLocaleString()}
              </button>
              <button
                onClick={() => setTab("ended")}
                className={cn("h-7 px-2.5 rounded-[3px] text-[11.5px] font-semibold transition-colors", tab === "ended" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                판매종료 {endedItems.length.toLocaleString()}
              </button>
            </div>
          </div>
          <div className="hidden sm:block shrink-0 text-[10.5px] text-muted-foreground font-mono">{SORT_LABELS[sortMode]} · {filtered.length.toLocaleString()} / {activeItems.length.toLocaleString()}건</div>
        </div>
        <div className="flex flex-wrap gap-2 items-center min-w-0">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품명 검색" className="h-8 pl-8 text-[12px]" />
        </div>
        <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
          <SelectTrigger className="h-8 w-[132px] text-[11.5px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
              <SelectItem key={mode} value={mode}>{SORT_LABELS[mode]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-1">
          {categories.map((c) => (
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
              {c}{c !== "전체" ? ` ${categoryCounts.get(c) ?? 0}` : ` ${activeItems.length}`}
            </button>
          ))}
        </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {loading && items.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground space-y-3">
            <div className="mx-auto h-11 w-11 rounded-full border border-neon/40 bg-neon/10 flex items-center justify-center shadow-neon">
              <Boxes className="h-5 w-5 text-neon pulse-dot" />
            </div>
            <div className="font-medium text-foreground">상품을 실시간 필터링 중입니다</div>
            <div className="text-[11px] text-muted-foreground">수집된 대량 데이터에서 허위상품과 비정상 판매자를 걸러내고 있습니다.</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground space-y-2">
            <div className="mx-auto h-10 w-10 rounded-full border border-border bg-background flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>{tab === "ended" ? "현재 판매종료로 이동된 상품이 없습니다." : "현재 선택된 카테고리에 즉시 구매 가능한 재고가 없습니다."}</div>
            <div className="text-[11px] text-muted-foreground">{tab === "ended" ? "재고가 0이거나 판매 만료된 상품은 이 탭으로 자동 분리됩니다." : "필터 검증을 통과한 상품만 노출되므로 일시적으로 비어 보일 수 있습니다."}</div>
          </div>
        ) : (
          <div className="divide-y divide-border min-w-0">
            {filtered.map((p) => (
              <ProductRow key={p.id} p={p} paymentSettings={paymentSettings} ended={tab === "ended"} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductRow({ p, paymentSettings, ended = false }: { p: Product; paymentSettings: PaymentSettings; ended?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ordering, setOrdering] = useState(false);
  const [open, setOpen] = useState(false);
  const [paymentNetwork, setPaymentNetwork] = useState<PaymentNetwork>(DEFAULT_PAYMENT_NETWORK);
  const [orderPreviewAmount, setOrderPreviewAmount] = useState(() => makeUniqueUsdtAmount(p.priceUsdt));
  const availableWallets = getPaymentWalletOptions(paymentSettings);
  const activeWallet = getEnabledWallet(paymentSettings, paymentNetwork) ?? availableWallets[0] ?? null;
  const paymentQrImageUrl = getPaymentQrImageUrl(activeWallet?.address, 220);
  const stockTone =
    p.stock <= 3 ? "text-destructive border-destructive/40 bg-destructive/10"
    : p.stock <= 8 ? "text-usdt border-usdt/40 bg-usdt/10"
    : "text-neon border-neon/40 bg-neon/10";
  const statusLabel = ended ? (p.status === "expired" ? "기간만료" : "재고소진") : "구매가능";
  const statusTone = ended ? "bg-destructive/10 border-destructive/40 text-destructive" : "bg-neon/10 border-neon/40 text-neon";
  const registeredAgoSeconds = Math.max(0, Math.round((Date.now() - p.createdAt) / 1000));
  const registeredLabel = registeredAgoSeconds < 60 ? `${registeredAgoSeconds}초 전 등록` : `${Math.round(registeredAgoSeconds / 60)}분 전 등록`;
  const syncedAgoSeconds = Math.max(0, Math.round((Date.now() - p.lastSyncedAt) / 1000));
  const syncedLabel = syncedAgoSeconds < 60 ? `${syncedAgoSeconds}초 전` : `${Math.round(syncedAgoSeconds / 60)}분 전`;

  const openOrderDialog = () => {
    setOpen(true);
  };

  const requestPaymentConfirmation = async (orderId: string) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    fetch("/api/orders/confirm-payment", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderId }),
    }).catch(() => undefined);
  };

  useEffect(() => {
    if (!open || availableWallets.length === 0) return;
    if (!availableWallets.some((wallet) => wallet.network === paymentNetwork)) {
      setPaymentNetwork(availableWallets[0].network);
    }
  }, [availableWallets, open, paymentNetwork]);

  useEffect(() => {
    if (!open || !activeWallet) return;

    let ignore = false;
    getUnavailablePendingAmounts(paymentNetwork, activeWallet.address, paymentSettings.paymentWindowMinutes).then((amounts) => {
      if (!ignore) setOrderPreviewAmount(makeUniqueUsdtAmount(p.priceUsdt, amounts));
    });

    return () => {
      ignore = true;
    };
  }, [activeWallet?.address, open, p.priceUsdt, paymentNetwork, paymentSettings.paymentWindowMinutes]);

  const createOrder = async () => {
    if (!user) {
      toast.error("로그인 후 주문할 수 있습니다.");
      navigate("/auth");
      return;
    }

    setOrdering(true);
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, title, sale_price_usdt, supplier_cost_usdt, margin_usdt, status, stock_state, stock_count")
      .eq("id", p.id)
      .single();

    if (productError || !product) {
      toast.error(productError?.message ?? "상품 정보를 확인하지 못했습니다.");
      setOrdering(false);
      return;
    }
    if (product.status !== "visible" || !["in_stock", "low"].includes(product.stock_state) || Number(product.stock_count ?? 1) <= 0) {
      toast.error("현재 구매 가능한 상품이 아닙니다.");
      setOrdering(false);
      return;
    }
    const paymentWallet = getEnabledWallet(paymentSettings, paymentNetwork) ?? availableWallets[0] ?? null;
    if (!paymentWallet) {
      toast.error(`${paymentNetwork} USDT 입금 주소가 아직 설정되지 않았습니다. 관리자에게 문의해주세요.`);
      setOrdering(false);
      return;
    }

    const supplierCost = Number(product.supplier_cost_usdt ?? 0);

    let order: { id: string; order_no: string } | null = null;
    let orderError: { message: string; code?: string } | null = null;
    let paymentAmount = orderPreviewAmount || makeUniqueUsdtAmount(Number(product.sale_price_usdt));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const unavailableAmounts = await getUnavailablePendingAmounts(paymentNetwork, paymentWallet.address, paymentSettings.paymentWindowMinutes);
      paymentAmount = makeUniqueUsdtAmount(Number(product.sale_price_usdt), unavailableAmounts);

      const result = await supabase
        .from("orders")
        .insert({
          order_no: "",
          user_id: user.id,
          product_id: product.id,
          sale_price_usdt: paymentAmount,
          supplier_cost_usdt: supplierCost,
          margin_usdt: Number((paymentAmount - supplierCost).toFixed(4)),
          payment_network: paymentNetwork,
          payment_address: paymentWallet.address,
          customer_note: `자동입금확인용 고유 입금액 ${formatUsdt4(paymentAmount)} USDT · ${paymentSettings.paymentWindowMinutes}분 이내 자동확인`,
        })
        .select("id, order_no")
        .single();

      order = result.data;
      orderError = result.error;
      if (!orderError || orderError.code !== "23505") break;
    }

    setOrdering(false);
    if (orderError) {
      toast.error(orderError.message);
      return;
    }

    setOpen(false);
    requestPaymentConfirmation(order.id);
    toast.success(`${order.order_no} 주문이 생성되었습니다. ${paymentNetwork} ${formatUsdt4(paymentAmount)} USDT를 정확히 입금하면 자동 확인됩니다.`);
    navigate("/app/orders");
  };

  return (
    <div className="px-3 py-2.5 grid grid-cols-[auto_minmax(0,1fr)_82px] md:grid-cols-[auto_minmax(0,1fr)_72px_70px_96px] gap-2 md:gap-3 items-center hover:bg-muted/30 transition-colors relative min-w-0 max-w-full overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-neon/70" />
      <div className="shrink-0 h-9 w-9 rounded-sm bg-muted border border-border flex items-center justify-center">
        <ServiceLogo service={p.service} size={20} />
      </div>
      <div className="min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("px-1.5 py-0.5 rounded-sm border text-[9.5px] font-mono shrink-0", statusTone)}>{statusLabel}</span>
          <div className="min-w-0 max-w-full text-[13px] font-medium text-foreground truncate" title={p.title}>{p.title}</div>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0 max-w-full overflow-hidden whitespace-nowrap">
          <span className="font-mono truncate max-w-[120px]">{p.source}</span>
          <span className="shrink-0">·</span>
          <span className="shrink-0">★ {p.rating.toFixed(1)}</span>
          <span className="shrink-0">·</span>
          <span className="inline-flex items-center gap-0.5 shrink-0"><ShieldCheck className="h-3 w-3" /> {p.warrantyDays}일 보장</span>
          <span className="shrink-0">·</span>
          <span className="font-mono text-neon shrink-0">{registeredLabel}</span>
          <span className="shrink-0">·</span>
          <span className="font-mono text-muted-foreground shrink-0">갱신 {syncedLabel}</span>
        </div>
      </div>
      <span className={cn("hidden md:inline-flex justify-center text-[10.5px] font-mono px-1.5 py-0.5 border rounded-sm whitespace-nowrap", stockTone)}>
        재고 {p.stock}
      </span>
      <div className="hidden md:block text-right min-w-0 justify-self-end overflow-hidden">
        <div className="font-mono text-[14px] font-semibold text-usdt leading-none">{p.priceUsdt.toFixed(2)}~</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">USDT</div>
      </div>
      <button
        onClick={openOrderDialog}
        disabled={ordering || p.stock <= 0 || ended}
        className={cn(
          "shrink-0 h-9 px-2 md:px-3 inline-flex items-center justify-center gap-1 rounded-sm text-[11.5px] md:text-[12px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed w-[82px] md:w-[96px] justify-self-end whitespace-nowrap",
          ended ? "bg-muted text-muted-foreground" : "bg-neon text-[hsl(240_10%_4%)] hover:brightness-110"
        )}
      >
        <ShoppingCart className="hidden sm:block h-3.5 w-3.5" /> {ended ? "판매종료" : "지금구매"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-24px)] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>구매 확인</DialogTitle>
            <DialogDescription>상품 요약과 입금 네트워크를 확인한 뒤 주문을 생성합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-[12.5px] min-w-0">
            <div className="rounded-md border border-border bg-card p-3 space-y-3 min-w-0">
              <div className="flex items-start gap-2 min-w-0">
                <ServiceLogo service={p.service} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold leading-snug break-words">{p.title}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground break-words">{p.description || "수집 데이터 기준 즉시 구매 가능 상품입니다."}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="rounded-sm bg-background p-2"><span className="text-muted-foreground">카테고리</span><div className="font-medium truncate">{serviceToCategory(p)}</div></div>
                <div className="rounded-sm bg-background p-2"><span className="text-muted-foreground">재고</span><div className="font-mono text-neon">{p.stock}개</div></div>
                <div className="rounded-sm bg-background p-2"><span className="text-muted-foreground">보장</span><div className="font-mono">{p.warrantyDays}일</div></div>
                <div className="rounded-sm bg-background p-2"><span className="text-muted-foreground">마켓</span><div className="truncate">{p.source}</div></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div className="rounded-sm bg-background p-2">등록: <span className="font-mono text-foreground">{registeredLabel}</span></div>
                <div className="rounded-sm bg-background p-2">최근확인: <span className="font-mono text-foreground">{syncedLabel}</span></div>
              </div>
            </div>
            <div className="rounded-md border border-neon/40 bg-neon/10 p-4 text-center">
              <div className="text-[11px] font-medium text-muted-foreground">정확히 입금할 금액</div>
              <div className="mt-1 font-mono text-3xl sm:text-4xl font-bold text-neon tracking-tight">{formatUsdt4(orderPreviewAmount)}</div>
              <div className="mt-1 text-[12px] text-muted-foreground">USDT</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-muted-foreground">결제 네트워크</div>
              <Select value={paymentNetwork} onValueChange={(value) => setPaymentNetwork(value as PaymentNetwork)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableWallets.map((wallet) => (
                    <SelectItem key={wallet.id} value={wallet.network} disabled={!wallet.enabled}>{wallet.label || `${wallet.network} USDT`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-sm border border-border bg-background p-2.5 items-center min-w-0">
              <div className="h-28 w-28 rounded-sm border border-border bg-white p-1.5 flex items-center justify-center justify-self-center sm:justify-self-start">
                {paymentQrImageUrl ? (
                  <img src={paymentQrImageUrl} alt="입금 주소 QR" className="h-full w-full object-contain" loading="lazy" />
                ) : (
                  <QrCode className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[10.5px] text-muted-foreground mb-1">입금 주소 QR / 주소</div>
                <div className="font-mono text-[11.5px] break-all text-foreground">{activeWallet?.address || "관리자 지갑주소 설정 필요"}</div>
                <div className="mt-1 text-[10.5px] text-muted-foreground">QR은 선택된 네트워크의 지갑주소로 자동 생성됩니다.</div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">주문 생성 후 {paymentSettings.paymentWindowMinutes}분 이내 입금 여부를 자동 확인합니다. 표시된 고유 입금액을 정확히 보내야 자동 반영됩니다.</div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">취소</Button>
            <Button type="button" onClick={createOrder} disabled={ordering || !activeWallet} className="w-full sm:w-auto bg-neon text-[hsl(240_10%_4%)] hover:bg-neon/90">
              {ordering ? "주문 생성중" : "구매"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
