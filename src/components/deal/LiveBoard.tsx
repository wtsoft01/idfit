import { useEffect, useState } from "react";
import { DealMessage } from "./DealMessage";
import { Activity, Radio, ShieldCheck, Zap, Clock, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Deal } from "@/lib/mockDeals";
import { maskSourceIdentifier } from "@/lib/source-privacy";
import { normalizeDisplayService } from "@/lib/service-classifier";

type ProductRow = Tables<"visible_products">;

function metadataNumber(metadata: ProductRow["metadata"], key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata[key];
  return typeof value === "number" ? value : null;
}

function mapDeal(row: ProductRow): Deal {
  return {
    id: row.id,
    service: normalizeDisplayService(row.service_name, row.title),
    title: row.title,
    priceUsdt: Number(row.sale_price_usdt),
    costUsdt: null,
    warrantyDays: metadataNumber(row.metadata, "warranty_days") ?? metadataNumber(row.metadata, "warrantyDays") ?? 30,
    stock: row.stock_state === "sold_out" ? "soldout" : row.stock_state === "low" ? "low" : "in_stock",
    source: maskSourceIdentifier(row.source_label),
    trust: Number(row.source_trust ?? 4.3),
    createdAt: row.last_synced_at ? new Date(row.last_synced_at).getTime() : new Date(row.updated_at).getTime(),
  };
}

export function LiveBoard({
  height = "min(72vh, 720px)",
  intervalMs = 2200,
  className,
  header = true,
}: {
  height?: string;
  intervalMs?: number;
  className?: string;
  header?: boolean;
}) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [sourceCount, setSourceCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [salesStats, setSalesStats] = useState({ todayPaid: 0, recentPaid: 0, pending: 0 });
  const [lastCollectionAt, setLastCollectionAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLiveDeals = async () => {
    if (!isSupabaseConfigured) {
      setDeals([]);
      setError("Supabase 연결 전입니다. 실제 수집 상품만 표시합니다.");
      setLoading(false);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    const paidStatuses = ["payment_confirmed", "purchasing", "delivered"];

    const [{ data: products, error: productsError }, { count: sources }, { count: messages }, { count: todayPaid }, { count: recentPaid }, { count: pending }] = await Promise.all([
      supabase
        .from("visible_products")
        .select("id,service_name,title,sale_price_usdt,stock_state,stock_count,last_synced_at,updated_at,metadata,source_label,source_trust")
        .or("stock_count.is.null,stock_count.gt.0")
        .order("last_synced_at", { ascending: false, nullsFirst: false })
        .limit(40),
      supabase.from("telegram_sources").select("id", { count: "exact", head: true }).eq("status", "live").eq("auto_collect_enabled", true),
      supabase.from("raw_messages").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", paidStatuses).gte("created_at", today.toISOString()),
      supabase.from("orders").select("id", { count: "exact", head: true }).in("status", paidStatuses).gte("created_at", recent.toISOString()),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "payment_pending"),
    ]);

    if (productsError) {
      setDeals([]);
      setLastCollectionAt(null);
      setError(`실제 상품 DB 조회 실패: ${productsError.message}`);
    } else {
      const visibleDeals = ((products ?? []) as ProductRow[]).filter((row) => row.stock_count == null || row.stock_count > 0).map(mapDeal);
      setDeals(visibleDeals);
      setLastCollectionAt(visibleDeals[0]?.createdAt ? new Date(visibleDeals[0].createdAt).toISOString() : null);
      setError(null);
    }

    setSourceCount(sources ?? 0);
    setMessageCount(messages ?? 0);
    setSalesStats({ todayPaid: todayPaid ?? 0, recentPaid: recentPaid ?? 0, pending: pending ?? 0 });
    setLoading(false);
  };

  useEffect(() => {
    loadLiveDeals();
    const timer = window.setInterval(loadLiveDeals, Math.max(intervalMs, 5000));
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  const lastCollectionLabel = lastCollectionAt
    ? `${Math.max(0, Math.round((Date.now() - new Date(lastCollectionAt).getTime()) / 1000))}초 전 수집`
    : "수집 대기";

  return (
    <div className={cn("rounded-md border border-border bg-card/60 backdrop-blur overflow-hidden flex flex-col", className)} style={{ height }}>
      {header && (
        <div className="flex items-center justify-between gap-3 px-3 h-auto min-h-12 py-2 border-b border-border bg-card min-w-0 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/80 to-transparent animate-pulse" />
          <div className="flex flex-wrap items-center gap-2 text-[12px] min-w-0">
            <span className="text-[17px] font-bold text-foreground shrink-0">신규등록되는 판매상품</span>
            <span className="relative inline-flex items-center gap-1 overflow-hidden rounded-full border border-neon/50 bg-neon/10 px-2 py-0.5 text-neon shadow-[0_0_16px_hsl(var(--neon)/0.18)]">
              <span className="absolute inset-y-0 -left-8 w-8 bg-neon/25 blur-md animate-[pulse_1.2s_ease-in-out_infinite]" />
              <Radio className="relative h-3.5 w-3.5 animate-ping" />
              <Zap className="relative h-3.5 w-3.5" /> 실시간 감시중
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-usdt/40 bg-usdt/10 px-2 py-0.5 text-usdt">
              <ShieldCheck className="h-3.5 w-3.5" /> 필터 검증
            </span>
            <span className="hidden sm:inline text-muted-foreground">·</span>
            <span className="hidden sm:inline text-muted-foreground font-mono">{sourceCount.toLocaleString()}개 소스</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">누적 <span className="text-neon font-mono">{messageCount.toLocaleString()}</span>건 수집</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">노출 <span className="text-neon font-mono">{deals.length.toLocaleString()}</span>건</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {lastCollectionLabel}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">오늘 판매확정 <span className="text-neon font-mono">{salesStats.todayPaid.toLocaleString()}</span>건</span>
            <span className="hidden lg:inline text-muted-foreground">· 최근 1시간 {salesStats.recentPaid.toLocaleString()}건 / 결제대기 {salesStats.pending.toLocaleString()}건</span>
          </div>
          <div className="text-[10.5px] text-muted-foreground font-mono uppercase tracking-wider hidden md:flex items-center gap-1 shrink-0"><Database className="h-3 w-3" /> live · real data</div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-2.5 min-w-0">
        {loading ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground space-y-3">
            <div className="mx-auto h-11 w-11 rounded-full border border-neon/40 bg-neon/10 flex items-center justify-center shadow-neon">
              <Radio className="h-5 w-5 text-neon pulse-dot" />
            </div>
            <div className="font-medium text-foreground">실시간 수집·검증 중입니다</div>
            <div className="text-[11px] text-muted-foreground">대량 데이터 수집 → 허위상품/판매자 필터링 → 즉시 구매 가능한 ID만 노출하는 중입니다.</div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-[12px] text-usdt">{error}</div>
        ) : deals.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground space-y-2">
            <div className="mx-auto h-10 w-10 rounded-full border border-border bg-background flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>현재 라이브 노출 가능한 실제 수집 상품이 없습니다.</div>
            <div className="text-[11px] text-muted-foreground">검증 통과한 상품만 표시되므로, 필터링 단계에서 잠시 비어 보일 수 있습니다.</div>
          </div>
        ) : (
          deals.map((deal) => <DealMessage key={deal.id} deal={deal} />)
        )}
      </div>
    </div>
  );
}
