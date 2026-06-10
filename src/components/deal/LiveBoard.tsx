import { useEffect, useState } from "react";
import { DealMessage } from "./DealMessage";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Deal } from "@/lib/mockDeals";

type ProductRow = Pick<
  Tables<"products">,
  "id" | "service_name" | "title" | "sale_price_usdt" | "stock_state" | "stock_count" | "last_synced_at" | "updated_at" | "metadata" | "source_id"
> & {
  source?: { telegram_identifier: string | null; trust_override: number | null } | null;
};

function normalizeService(serviceName: string): Deal["service"] {
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

function metadataNumber(metadata: ProductRow["metadata"], key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata[key];
  return typeof value === "number" ? value : null;
}

function mapDeal(row: ProductRow): Deal {
  return {
    id: row.id,
    service: normalizeService(row.service_name || row.title),
    title: row.title,
    priceUsdt: Number(row.sale_price_usdt),
    warrantyDays: metadataNumber(row.metadata, "warranty_days") ?? metadataNumber(row.metadata, "warrantyDays") ?? 30,
    stock: row.stock_state === "sold_out" ? "soldout" : row.stock_state === "low" ? "low" : "in_stock",
    source: row.source?.telegram_identifier ?? "수집 소스",
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLiveDeals = async () => {
    if (!isSupabaseConfigured) {
      setDeals([]);
      setError("Supabase 연결 전입니다. 실제 수집 상품만 표시합니다.");
      setLoading(false);
      return;
    }

    const [{ data: products, error: productsError }, { count: sources }, { count: messages }] = await Promise.all([
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
        <div className="flex items-center justify-between gap-3 px-3 h-11 border-b border-border bg-card">
          <div className="flex items-center gap-2 text-[12px]">
            <Radio className="h-3.5 w-3.5 text-neon pulse-dot" />
            <span className="font-semibold text-foreground">IDFIT AI 실시간 스캔</span>
            <span className="hidden sm:inline text-muted-foreground">·</span>
            <span className="hidden sm:inline text-muted-foreground font-mono">{sourceCount.toLocaleString()}개 소스</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">누적 <span className="text-neon font-mono">{messageCount.toLocaleString()}</span>건 수집</span>
          </div>
          <div className="text-[10.5px] text-muted-foreground font-mono uppercase tracking-wider hidden md:block">live · real data</div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {loading ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">실제 수집 상품을 불러오는 중입니다.</div>
        ) : error ? (
          <div className="p-8 text-center text-[12px] text-usdt">{error}</div>
        ) : deals.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">현재 라이브 노출 가능한 실제 수집 상품이 없습니다.</div>
        ) : (
          deals.map((deal) => <DealMessage key={deal.id} deal={deal} />)
        )}
      </div>
    </div>
  );
}
