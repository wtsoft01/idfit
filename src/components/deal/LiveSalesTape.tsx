import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownRight, ShoppingCart } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { normalizeDisplayService } from "@/lib/service-classifier";

type ProductSnapshot = Pick<Tables<"products">, "id" | "service_name" | "title" | "stock_count" | "updated_at" | "last_synced_at">;
type OrderSnapshot = { created_at: string; sale_price_usdt: number | null; product?: { title: string | null; service_name: string | null } | null };

type TapeItem = {
  id: string;
  label: string;
  tone: "sale" | "stock";
};

function shortTitle(title: string | null | undefined, max = 30) {
  const text = String(title ?? "상품").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function LiveSalesTape() {
  const [products, setProducts] = useState<ProductSnapshot[]>([]);
  const [previousStock, setPreviousStock] = useState<Record<string, number>>({});
  const [stockEvents, setStockEvents] = useState<TapeItem[]>([]);
  const [orderEvents, setOrderEvents] = useState<TapeItem[]>([]);

  const loadTape = async () => {
    if (!isSupabaseConfigured) return;

    const [{ data: productRows }, { data: orders }] = await Promise.all([
      supabase
        .from("products")
        .select("id,service_name,title,stock_count,updated_at,last_synced_at")
        .eq("status", "visible")
        .in("stock_state", ["in_stock", "low"])
        .not("candidate_id", "is", null)
        .order("last_synced_at", { ascending: false, nullsFirst: false })
        .limit(30),
      supabase
        .from("orders")
        .select("created_at,sale_price_usdt,product:products(title,service_name)")
        .in("status", ["payment_confirmed", "purchasing", "delivered", "payment_pending"])
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    const nextProducts = (productRows ?? []) as ProductSnapshot[];
    setProducts(nextProducts);

    setPreviousStock((current) => {
      const nextStock: Record<string, number> = {};
      const nextEvents: TapeItem[] = [];

      for (const product of nextProducts) {
        const stock = Number(product.stock_count ?? 0);
        nextStock[product.id] = stock;
        const before = current[product.id];
        if (typeof before === "number" && before > stock) {
          nextEvents.push({
            id: `${product.id}-${Date.now()}`,
            tone: "stock",
            label: `${normalizeDisplayService(product.service_name, product.title)} 재고 ${before}→${stock} · ${shortTitle(product.title, 24)}`,
          });
        }
      }

      if (nextEvents.length) setStockEvents((events) => [...nextEvents, ...events].slice(0, 8));
      return nextStock;
    });

    setOrderEvents(
      ((orders ?? []) as OrderSnapshot[]).map((order, index) => ({
        id: `${order.created_at}-${index}`,
        tone: "sale",
        label: `${normalizeDisplayService(order.product?.service_name, order.product?.title)} 주문발생 · ${shortTitle(order.product?.title, 24)} · ${Number(order.sale_price_usdt ?? 0).toFixed(2)} USDT`,
      }))
    );
  };

  useEffect(() => {
    loadTape();
    const timer = window.setInterval(loadTape, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const items = useMemo<TapeItem[]>(() => {
    const fallback = products.slice(0, 8).map((product, index) => ({
      id: `${product.id}-stock-${index}`,
      tone: "stock" as const,
      label: `${normalizeDisplayService(product.service_name, product.title)} 재고 ${product.stock_count ?? "확인중"}개 · 판매중`,
    }));
    return [...stockEvents, ...orderEvents, ...fallback].slice(0, 12);
  }, [orderEvents, products, stockEvents]);

  if (!items.length) {
    return (
      <div className="hidden md:flex min-w-0 flex-1 items-center gap-2 rounded-sm border border-border bg-background/50 px-3 h-9 text-[11px] text-muted-foreground">
        <Activity className="h-3.5 w-3.5 text-neon pulse-dot" /> 실시간 판매/재고 변화를 감시 중입니다
      </div>
    );
  }

  return (
    <div className="hidden md:flex min-w-0 flex-1 overflow-hidden rounded-sm border border-neon/25 bg-background/60 h-9 items-center">
      <div className="ticker-track flex items-center gap-7 whitespace-nowrap px-3 text-[11px] font-mono">
        {[...items, ...items].map((item, index) => (
          <span key={`${item.id}-${index}`} className={item.tone === "sale" ? "inline-flex items-center gap-1.5 text-neon" : "inline-flex items-center gap-1.5 text-usdt"}>
            {item.tone === "sale" ? <ShoppingCart className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
