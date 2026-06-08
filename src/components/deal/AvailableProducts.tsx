import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ServiceLogo } from "./ServiceLogo";
import type { DealService } from "@/lib/mockDeals";
import { Boxes, ShieldCheck, ShoppingCart, Search, RefreshCw, Database } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatUsdt4, makeUniqueUsdtAmount } from "@/lib/payment-amount";

type Category =
  | "전체" | "ChatGPT" | "Claude" | "Cursor" | "Midjourney"
  | "Perplexity" | "Gemini" | "Suno" | "Runway" | "Notion";

const CATS: Category[] = ["전체", "ChatGPT", "Claude", "Cursor", "Midjourney", "Perplexity", "Gemini", "Suno", "Runway", "Notion"];

type VisibleProductRow = {
  id: string;
  service_name: string;
  title: string;
  description: string;
  sale_price_usdt: number;
  stock_state: "in_stock" | "low" | "sold_out" | "unknown";
  stock_count: number | null;
  last_synced_at: string | null;
  updated_at: string;
  metadata: Tables<"products">["metadata"];
  source_label: string;
  source_trust: number;
};

interface Product {
  id: string;
  service: DealService;
  title: string;
  priceUsdt: number;
  warrantyDays: number;
  stock: number;
  source: string;
  rating: number;
  lastSyncedAt: number;
  isDemo?: boolean;
}

const SEED: Omit<Product, "id" | "lastSyncedAt" | "isDemo">[] = [
  { service: "ChatGPT Plus", title: "ChatGPT Plus · 30일 · 1인 공유 · 즉시 로그인", priceUsdt: 13.9, warrantyDays: 30, stock: 24, source: "@gpt_market_kr", rating: 4.8 },
  { service: "ChatGPT Plus", title: "ChatGPT Plus · 90일 · 1인 전용", priceUsdt: 36.5, warrantyDays: 90, stock: 9, source: "@premium_acc_hub", rating: 4.7 },
  { service: "ChatGPT Pro", title: "ChatGPT Pro · 30일 · 무제한 GPT", priceUsdt: 128, warrantyDays: 30, stock: 4, source: "@stark_accounts", rating: 4.9 },
  { service: "Claude Pro", title: "Claude Pro · 30일 · 1인 공유", priceUsdt: 15.2, warrantyDays: 30, stock: 17, source: "@claude_market", rating: 4.6 },
  { service: "Claude Max", title: "Claude Max · 30일 · Sonnet+Opus 풀팩", priceUsdt: 78, warrantyDays: 30, stock: 6, source: "@claude_market", rating: 4.7 },
  { service: "Cursor Pro", title: "Cursor Pro · 90일 · 팀시트 5인", priceUsdt: 38, warrantyDays: 90, stock: 11, source: "@cursor_keys_tr", rating: 4.8 },
  { service: "Cursor Pro", title: "Cursor Pro · 30일 · 1인", priceUsdt: 12.4, warrantyDays: 30, stock: 21, source: "@ai_deals_global", rating: 4.6 },
  { service: "Midjourney", title: "Midjourney Standard · 30일", priceUsdt: 22.5, warrantyDays: 30, stock: 7, source: "@mj_pool_ru", rating: 4.5 },
  { service: "Perplexity Pro", title: "Perplexity Pro · 365일 · 코드 / 이메일 즉시 발급", priceUsdt: 6.9, warrantyDays: 365, stock: 48, source: "@subs_resell_id", rating: 4.9 },
  { service: "Gemini Advanced", title: "Gemini Advanced · 30일 · 2TB 포함", priceUsdt: 11.2, warrantyDays: 30, stock: 13, source: "@ai_deals_global", rating: 4.6 },
  { service: "Suno Pro", title: "Suno Pro · 30일", priceUsdt: 8.4, warrantyDays: 30, stock: 5, source: "@neon_deals_vn", rating: 4.4 },
  { service: "Runway Pro", title: "Runway Pro · 30일 · 625 credits", priceUsdt: 28.5, warrantyDays: 30, stock: 3, source: "@stark_accounts", rating: 4.7 },
  { service: "Notion AI", title: "Notion AI · 30일 · 무제한 AI 호출", priceUsdt: 7.2, warrantyDays: 30, stock: 19, source: "@account_bazaar", rating: 4.5 },
];

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
    priceUsdt: Number(row.sale_price_usdt),
    warrantyDays,
    stock,
    source: row.source_label,
    rating: Number(row.source_trust ?? 4.7),
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at).getTime() : new Date(row.updated_at).getTime(),
  };
}

function makeDemoProducts(): Product[] {
  const now = Date.now();
  return SEED.map((product, index) => ({ ...product, id: `DEMO-${index.toString().padStart(3, "0")}`, lastSyncedAt: now, isDemo: true }));
}

export function AvailableProducts({ className }: { className?: string }) {
  const [cat, setCat] = useState<Category>("전체");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  const loadProducts = async () => {
    if (!isSupabaseConfigured) {
      setItems(makeDemoProducts());
      setUsingDemo(true);
      setError("Supabase 연결 전이라 데모 상품을 표시합니다.");
      setLastSync(new Date());
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("visible_products")
      .select("*")
      .order("last_synced_at", { ascending: false, nullsFirst: false })
      .limit(80);

    if (queryError) {
      setItems(makeDemoProducts());
      setUsingDemo(true);
      setError(`상품 DB 조회 실패: ${queryError.message}`);
    } else {
      const products = ((data ?? []) as VisibleProductRow[]).map(mapProduct);
      setItems(products.length > 0 ? products : makeDemoProducts());
      setUsingDemo(products.length === 0);
      setError(products.length === 0 ? "아직 노출 중인 실제 상품이 없어 데모 상품을 표시합니다." : null);
    }

    setLastSync(new Date());
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      const okCat = cat === "전체" || serviceToCategory(p.service) === cat;
      const okQ = !q.trim() || (p.title + p.source + p.service).toLowerCase().includes(q.toLowerCase());
      return okCat && okQ;
    });
  }, [items, cat, q]);

  const manualSync = async () => {
    await loadProducts();
    toast.success(isSupabaseConfigured ? "상품 DB 동기화 완료" : "데모 상품 새로고침 완료");
  };

  return (
    <div className={cn("rounded-md border border-border bg-card/60 backdrop-blur overflow-hidden flex flex-col", className)}>
      <div className="flex items-center justify-between gap-3 px-3 h-auto min-h-11 py-2 border-b border-border bg-card flex-wrap">
        <div className="flex items-center gap-2 text-[12px] min-w-0">
          <Boxes className="h-3.5 w-3.5 text-neon shrink-0" />
          <span className="font-semibold text-foreground">실시간 구매가능 상품</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground font-mono">{filtered.length}건</span>
          {usingDemo && <span className="text-[10px] font-mono text-usdt border border-usdt/40 bg-usdt/10 rounded-sm px-1.5 py-0.5">DEMO</span>}
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
        {loading && items.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">상품 DB를 불러오는 중입니다.</div>
        ) : filtered.length === 0 ? (
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ordering, setOrdering] = useState(false);
  const stockTone =
    p.stock <= 3 ? "text-destructive border-destructive/40 bg-destructive/10"
    : p.stock <= 8 ? "text-usdt border-usdt/40 bg-usdt/10"
    : "text-neon border-neon/40 bg-neon/10";

  const createOrder = async () => {
    if (p.isDemo) {
      toast.error("데모 상품은 주문할 수 없습니다. 실제 수집 상품을 선택해 주세요.");
      return;
    }
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

    const paymentAmount = makeUniqueUsdtAmount(Number(product.sale_price_usdt));
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
        payment_network: "TRC20",
        payment_address: "TXk9bN3QzPmGv4Vc8a1Fx4Pn8Vq2sLm7",
        customer_note: `자동입금확인용 고유 입금액 ${formatUsdt4(paymentAmount)} USDT`,
      })
      .select("id, order_no")
      .single();

    setOrdering(false);
    if (orderError) {
      toast.error(orderError.message);
      return;
    }

    toast.success(`${order.order_no} 주문이 생성되었습니다. ${formatUsdt4(paymentAmount)} USDT를 정확히 입금하면 자동 확인됩니다.`);
    navigate("/app/orders");
  };

  return (
    <div className="px-3 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors flex-wrap sm:flex-nowrap">
      <div className="shrink-0 h-9 w-9 rounded-sm bg-muted border border-border flex items-center justify-center">
        <ServiceLogo service={p.service} size={20} />
      </div>
      <div className="min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-auto">
        <div className="text-[13px] font-medium text-foreground truncate">{p.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          <span className="font-mono">{p.source}</span>
          <span>·</span>
          <span>★ {p.rating.toFixed(1)}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-0.5"><ShieldCheck className="h-3 w-3" /> {p.warrantyDays}일 보장</span>
          {p.isDemo && <span className="text-usdt">· demo</span>}
        </div>
      </div>
      <span className={cn("text-[10.5px] font-mono px-1.5 py-0.5 border rounded-sm whitespace-nowrap", stockTone)}>
        재고 {p.stock}
      </span>
      <div className="text-right pl-2 min-w-[64px] ml-auto sm:ml-0">
        <div className="font-mono text-[14px] font-semibold text-usdt leading-none">{p.priceUsdt.toFixed(2)}~</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">USDT</div>
      </div>
      <button
        onClick={createOrder}
        disabled={ordering || p.stock <= 0}
        className="shrink-0 h-9 px-3 inline-flex items-center gap-1.5 rounded-sm text-[12px] font-semibold bg-neon text-[hsl(240_10%_4%)] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <ShoppingCart className="h-3.5 w-3.5" /> {ordering ? "주문중" : "구매"}
      </button>
    </div>
  );
}
