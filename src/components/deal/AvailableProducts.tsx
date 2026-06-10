import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ServiceLogo } from "./ServiceLogo";
import type { DealService } from "@/lib/mockDeals";
import { Activity, Boxes, ShieldCheck, ShoppingCart, Search, RefreshCw, Database, Sparkles } from "lucide-react";
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
import { DEFAULT_PAYMENT_NETWORK, getCheckoutWallets, getEnabledWallet, parsePaymentSettings, type PaymentNetwork, type PaymentSettings } from "@/lib/payment-config";
import { maskSourceIdentifier } from "@/lib/source-privacy";

type Category =
  | "전체" | "ChatGPT" | "Claude" | "Cursor" | "Midjourney"
  | "Perplexity" | "Gemini" | "Suno" | "Runway" | "Notion";

const CATS: Category[] = ["전체", "ChatGPT", "Claude", "Cursor", "Midjourney", "Perplexity", "Gemini", "Suno", "Runway", "Notion"];

type VisibleProductRow = Pick<
  Tables<"products">,
  "id" | "service_name" | "title" | "description" | "sale_price_usdt" | "stock_state" | "stock_count" | "last_synced_at" | "updated_at" | "metadata"
> & {
  source?: { telegram_identifier: string | null; trust_override: number | null } | null;
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
}

function serviceToCategory(svc: string): Category {
  if (svc.startsWith("ChatGPT")) return "ChatGPT";
  if (svc.startsWith("Claude")) return "Claude";
  if (svc.startsWith("Cursor")) return "Cursor";
  if (svc.startsWith("Midjourney")) return "Midjourney";
  if (svc.startsWith("Perplexity")) return "Perplexity";
  if (svc.startsWith("Gemini")) return "Gemini";
  if (svc.startsWith("Suno")) return "Suno";
  if (svc.startsWith("Runway")) return "Runway";
  return "Notion";
}

function normalizeService(serviceName: string): DealService {
  if (serviceName.startsWith("ChatGPT Pro")) return "ChatGPT Pro";
  if (serviceName.startsWith("ChatGPT")) return "ChatGPT Plus";
  if (serviceName.startsWith("Claude Max")) return "Claude Max";
  if (serviceName.startsWith("Claude")) return "Claude Pro";
  if (serviceName.startsWith("Cursor")) return "Cursor Pro";
  if (serviceName.startsWith("Midjourney")) return "Midjourney";
  if (serviceName.startsWith("Perplexity")) return "Perplexity Pro";
  if (serviceName.startsWith("Gemini")) return "Gemini Advanced";
  if (serviceName.startsWith("Suno")) return "Suno Pro";
  if (serviceName.startsWith("Runway")) return "Runway Pro";
  return "Notion AI";
}

function metadataNumber(metadata: VisibleProductRow["metadata"], key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata[key];
  return typeof value === "number" ? value : null;
}

function mapProduct(row: VisibleProductRow): Product {
  const warrantyDays = metadataNumber(row.metadata, "warranty_days") ?? metadataNumber(row.metadata, "warrantyDays") ?? 30;
  const stock = row.stock_count ?? (row.stock_state === "low" ? 3 : 99);
  return {
    id: row.id,
    service: normalizeService(row.service_name || row.title),
    title: row.title,
    description: row.description,
    priceUsdt: Number(row.sale_price_usdt),
    warrantyDays,
    stock,
    source: maskSourceIdentifier(row.source?.telegram_identifier),
    rating: Number(row.source?.trust_override ?? 4.3),
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at).getTime() : new Date(row.updated_at).getTime(),
  };
}

export function AvailableProducts({ className }: { className?: string }) {
  const [cat, setCat] = useState<Category>("전체");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(parsePaymentSettings(null));

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

    const { data, error: queryError } = await supabase
      .from("products")
      .select("id,service_name,title,description,sale_price_usdt,stock_state,stock_count,last_synced_at,updated_at,metadata,source:telegram_sources(telegram_identifier,trust_override)")
      .eq("status", "visible")
      .in("stock_state", ["in_stock", "low"])
      .not("candidate_id", "is", null)
      .order("last_synced_at", { ascending: false, nullsFirst: false })
      .limit(80);

    if (queryError) {
      setItems([]);
      setError(`실제 상품 DB 조회 실패: ${queryError.message}`);
    } else {
      const products = ((data ?? []) as VisibleProductRow[]).map(mapProduct);
      setItems(products);
      setError(products.length === 0 ? "아직 노출 중인 실제 수집 상품이 없습니다." : null);
    }

    setLastSync(new Date());
    setLoading(false);
  };

  useEffect(() => {
    loadPaymentSettings();
    loadProducts();
    const timer = window.setInterval(loadProducts, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      const okCat = cat === "전체" || serviceToCategory(p.service) === cat;
      const okQ = !q.trim() || (p.title + p.service).toLowerCase().includes(q.toLowerCase());
      return okCat && okQ;
    });
  }, [items, cat, q]);

  const manualSync = async () => {
    await loadProducts();
    toast.success(isSupabaseConfigured ? "실제 수집 상품 동기화 완료" : "Supabase 연결 전입니다");
  };

  return (
    <div className={cn("rounded-md border border-border bg-card/60 backdrop-blur overflow-hidden flex flex-col", className)}>
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
          <span className="text-muted-foreground">·</span>
          <span className="font-semibold text-foreground">실시간 구매가능 상품</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground font-mono">{filtered.length}건</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10.5px] font-mono text-muted-foreground hidden md:inline">
            마지막 동기화 {lastSync.toLocaleTimeString("ko-KR", { hour12: false })}
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

      <div className="px-3 pt-3 pb-2 flex flex-wrap gap-2 items-center border-b border-border bg-background/40">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품명 검색" className="h-8 pl-8 text-[12px]" />
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
            <div>현재 선택된 카테고리에 즉시 구매 가능한 재고가 없습니다.</div>
            <div className="text-[11px] text-muted-foreground">필터 검증을 통과한 상품만 노출되므로 일시적으로 비어 보일 수 있습니다.</div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((p) => (
              <ProductRow key={p.id} p={p} paymentSettings={paymentSettings} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductRow({ p, paymentSettings }: { p: Product; paymentSettings: PaymentSettings }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ordering, setOrdering] = useState(false);
  const [open, setOpen] = useState(false);
  const [paymentNetwork, setPaymentNetwork] = useState<PaymentNetwork>(DEFAULT_PAYMENT_NETWORK);
  const [orderPreviewAmount, setOrderPreviewAmount] = useState(() => makeUniqueUsdtAmount(p.priceUsdt));
  const checkoutWallets = getCheckoutWallets(paymentSettings);
  const activeWallet = getEnabledWallet(paymentSettings, paymentNetwork);
  const availableWallets = checkoutWallets.length ? checkoutWallets : paymentSettings.wallets.filter((wallet) => wallet.enabled && wallet.asset === "USDT");
  const stockTone =
    p.stock <= 3 ? "text-destructive border-destructive/40 bg-destructive/10"
    : p.stock <= 8 ? "text-usdt border-usdt/40 bg-usdt/10"
    : "text-neon border-neon/40 bg-neon/10";
  const syncedAgoSeconds = Math.max(0, Math.round((Date.now() - p.lastSyncedAt) / 1000));
  const syncedLabel = syncedAgoSeconds < 60 ? `${syncedAgoSeconds}초 전` : `${Math.round(syncedAgoSeconds / 60)}분 전`;

  const openOrderDialog = () => {
    setOrderPreviewAmount(makeUniqueUsdtAmount(p.priceUsdt));
    setOpen(true);
  };

  const createOrder = async () => {
    if (!user) {
      toast.error("로그인 후 주문할 수 있습니다.");
      navigate("/auth");
      return;
    }

    setOrdering(true);
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, title, sale_price_usdt, supplier_cost_usdt, margin_usdt, status, stock_state")
      .eq("id", p.id)
      .single();

    if (productError || !product) {
      toast.error(productError?.message ?? "상품 정보를 확인하지 못했습니다.");
      setOrdering(false);
      return;
    }
    if (product.status !== "visible" || !["in_stock", "low"].includes(product.stock_state)) {
      toast.error("현재 구매 가능한 상품이 아닙니다.");
      setOrdering(false);
      return;
    }

    const paymentWallet = getEnabledWallet(paymentSettings, paymentNetwork);
    if (!paymentWallet) {
      toast.error(`${paymentNetwork} USDT 입금 주소가 아직 설정되지 않았습니다. 관리자에게 문의해주세요.`);
      setOrdering(false);
      return;
    }

    const paymentAmount = orderPreviewAmount || makeUniqueUsdtAmount(Number(product.sale_price_usdt));
    const supplierCost = Number(product.supplier_cost_usdt ?? 0);

    const { data: order, error: orderError } = await supabase
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

    setOrdering(false);
    if (orderError) {
      toast.error(orderError.message);
      return;
    }

    setOpen(false);
    toast.success(`${order.order_no} 주문이 생성되었습니다. ${paymentNetwork} ${formatUsdt4(paymentAmount)} USDT를 정확히 입금하면 자동 확인됩니다.`);
    navigate("/app/orders");
  };

  return (
    <div className="px-3 py-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] gap-3 items-center hover:bg-muted/30 transition-colors relative min-w-0">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-neon/70" />
      <div className="shrink-0 h-9 w-9 rounded-sm bg-muted border border-border flex items-center justify-center">
        <ServiceLogo service={p.service} size={20} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 rounded-sm bg-neon/10 border border-neon/40 text-[9.5px] text-neon font-mono shrink-0">LIVE</span>
          <div className="text-[13px] font-medium text-foreground truncate">{p.title}</div>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0 overflow-hidden whitespace-nowrap">
          <span className="font-mono truncate max-w-[120px]">{p.source}</span>
          <span className="shrink-0">·</span>
          <span className="shrink-0">★ {p.rating.toFixed(1)}</span>
          <span className="shrink-0">·</span>
          <span className="inline-flex items-center gap-0.5 shrink-0"><ShieldCheck className="h-3 w-3" /> {p.warrantyDays}일 보장</span>
          <span className="shrink-0">·</span>
          <span className="font-mono text-neon shrink-0">갱신 {syncedLabel}</span>
        </div>
      </div>
      <span className={cn("hidden sm:inline-flex text-[10.5px] font-mono px-1.5 py-0.5 border rounded-sm whitespace-nowrap", stockTone)}>
        재고 {p.stock}
      </span>
      <div className="text-right min-w-[68px] justify-self-end">
        <div className="font-mono text-[14px] font-semibold text-usdt leading-none">{p.priceUsdt.toFixed(2)}~</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">USDT</div>
      </div>
      <button
        onClick={openOrderDialog}
        disabled={ordering || p.stock <= 0}
        className="col-span-3 md:col-span-1 shrink-0 h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-sm text-[12px] font-semibold bg-neon text-[hsl(240_10%_4%)] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed md:w-[86px]"
      >
        <ShoppingCart className="h-3.5 w-3.5" /> 지금구매
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>구매 확인</DialogTitle>
            <DialogDescription>상품 정보와 결제 네트워크를 확인한 뒤 주문을 생성합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-[12.5px]">
            <div className="rounded-md border border-border bg-card p-3 space-y-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <ServiceLogo service={p.service} size={22} />
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{p.description || `${p.warrantyDays}일 보장 · 재고 ${p.stock}`}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-sm bg-background p-2"><span className="text-muted-foreground">상품가</span><div className="font-mono text-usdt">{p.priceUsdt.toFixed(2)} USDT</div></div>
                <div className="rounded-sm bg-background p-2"><span className="text-muted-foreground">입금액</span><div className="font-mono text-neon">{formatUsdt4(orderPreviewAmount)} USDT</div></div>
              </div>
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
            <div className="rounded-sm border border-border bg-background p-2">
              <div className="text-[10.5px] text-muted-foreground mb-1">입금 주소</div>
              <div className="font-mono text-[11.5px] break-all text-foreground">{activeWallet?.address || "관리자 지갑주소 설정 필요"}</div>
            </div>
            <div className="text-[11px] text-muted-foreground">주문 생성 후 {paymentSettings.paymentWindowMinutes}분 이내 입금 여부를 자동 확인합니다. 표시된 고유 입금액을 정확히 보내야 자동 반영됩니다.</div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button type="button" onClick={createOrder} disabled={ordering || !activeWallet} className="bg-neon text-[hsl(240_10%_4%)] hover:bg-neon/90">
              {ordering ? "주문 생성중" : "구매"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
