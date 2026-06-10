import { useEffect, useState } from "react";
import { DealMessage } from "./DealMessage";
import { Activity, Radio, ShieldCheck, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Deal } from "@/lib/mockDeals";
import { maskSourceIdentifier } from "@/lib/source-privacy";
import { normalizeDisplayService } from "@/lib/service-classifier";

type ProductRow = Pick<
  Tables<"products">,
  "id" | "service_name" | "title" | "sale_price_usdt" | "stock_state" | "stock_count" | "last_synced_at" | "updated_at" | "metadata" | "source_id"
> & {
  source?: { telegram_identifier: string | null; trust_override: number | null } | null;
};

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
    warrantyDays: metadataNumber(row.metadata, "warranty_days") ?? metadataNumber(row.metadata, "warrantyDays") ?? 30,
    stock: row.stock_state === "sold_out" ? "soldout" : row.stock_state === "low" ? "low" : "in_stock",
    source: maskSourceIdentifier(row.source?.telegram_identifier),
    trust: Number(row.source?.trust_override ?? 4.3),
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
        .from("products")
        .select("id,service_name,title,sale_price_usdt,stock_state,stock_count,last_synced_at,updated_at,metadata,source_id,source:telegram_sources(telegram_identifier,trust_override)")
        .eq("status", "visible")
        .in("stock_state", ["in_stock", "low"])
        .not("candidate_id", "is", null)
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
      setError(`실제 상품 DB 조회 실패: ${productsError.message}`);
    } else {
      setDeals(((products ?? []) as ProductRow[]).map(mapDeal));
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

  return (
    <div className={cn("rounded-md border border-border bg-card/60 backdrop-blur overflow-hidden flex flex-col", className)} style={{ height }}>
      {header && (
        <div className="flex items-center justify-between gap-3 px-3 h-auto min-h-12 py-2 border-b border-border bg-card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 text-[12px] min-w-0">
            <span className="font-semibold text-foreground shrink-0">실시간 글로벌 스캔/딜 보드</span>
            <span className="hidden md:inline text-[10.5px] text-muted-foreground shrink-0">수집·검증 중인 전체 라이브 상품 흐름</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-neon/40 bg-neon/10 px-2 py-0.5 text-neon">
              <Activity className="h-3.5 w-3.5 pulse-dot" /> 실시간 감시
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-muted-foreground">
              <Globe className="h-3.5 w-3.5" /> 글로벌 수집
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-usdt/40 bg-usdt/10 px-2 py-0.5 text-usdt">
              <ShieldCheck className="h-3.5 w-3.5" /> 필터 검증
            </span>
            <span className="hidden sm:inline text-muted-foreground">·</span>
            <span className="hidden sm:inline text-muted-foreground font-mono">{sourceCount.toLocaleString()}개 소스</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">누적 <span className="text-neon font-mono">{messageCount.toLocaleString()}</span>건 수집</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">오늘 판매확정 <span className="text-neon font-mono">{salesStats.todayPaid.toLocaleString()}</span>건</span>
            <span className="hidden lg:inline text-muted-foreground">· 최근 1시간 {salesStats.recentPaid.toLocaleString()}건 / 결제대기 {salesStats.pending.toLocaleString()}건</span>
          </div>
          <div className="text-[10.5px] text-muted-foreground font-mono uppercase tracking-wider hidden md:block shrink-0">live · real data</div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
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
