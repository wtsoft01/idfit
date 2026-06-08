import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, EyeOff, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Candidate = Tables<"product_candidates"> & {
  telegram_sources?: Pick<Tables<"telegram_sources">, "name" | "telegram_identifier" | "source_type"> | null;
  raw_messages?: Pick<Tables<"raw_messages">, "message_text" | "received_at"> | null;
};

type CandidateStatus = Candidate["status"];

const statusCls: Record<CandidateStatus, string> = {
  candidate: "text-usdt border-usdt/40 bg-usdt/10",
  approved: "text-neon border-neon/40 bg-neon/10",
  hidden: "text-muted-foreground border-border bg-muted",
  expired: "text-orange-300 border-orange-300/40 bg-orange-300/10",
  rejected: "text-destructive border-destructive/40 bg-destructive/10",
};

const stockCls: Record<Candidate["stock_state"], string> = {
  in_stock: "text-neon",
  low: "text-usdt",
  sold_out: "text-destructive",
  unknown: "text-muted-foreground",
};

function isSupabaseConfigured() {
  const url = import.meta.env.VITE_SUPABASE_URL ?? "";
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  return Boolean(url && key && !key.includes("…"));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function money(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(2)} USDT`;
}

function salePriceFor(candidate: Candidate) {
  const cost = Number(candidate.supplier_cost_usdt ?? 0);
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  return Number((cost * 1.2).toFixed(4));
}

function productDescription(candidate: Candidate) {
  const parts = [
    candidate.duration_days ? `${candidate.duration_days}일 이용` : null,
    `전달 방식: ${candidate.delivery_type}`,
    candidate.stock_count !== null ? `재고 ${candidate.stock_count}개` : "재고 확인 필요",
  ].filter(Boolean);
  return parts.join(" · ");
}

export default function AdminCandidates() {
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | CandidateStatus>("candidate");
  const [search, setSearch] = useState("");
  const configured = useMemo(isSupabaseConfigured, []);

  const loadItems = async () => {
    if (!configured) {
      setError("Supabase publishable key가 아직 실제 전체 값이 아니라서 상품 후보 조회를 대기 중입니다.");
      return;
    }

    setLoading(true);
    setError(null);

    let query = supabase
      .from("product_candidates")
      .select("*, telegram_sources(name, telegram_identifier, source_type), raw_messages(message_text, received_at)")
      .order("created_at", { ascending: false })
      .limit(80);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const keyword = search.trim();
    if (keyword) {
      query = query.or(`product_title.ilike.%${keyword}%,service_name.ilike.%${keyword}%`);
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      setError(queryError.message);
    } else {
      setItems((data ?? []) as Candidate[]);
    }

    setLoading(false);
  };

  const updateStatus = async (candidate: Candidate, nextStatus: CandidateStatus) => {
    if (!configured) return;

    setBusyId(candidate.id);
    setError(null);

    const { error: updateError } = await supabase
      .from("product_candidates")
      .update({ status: nextStatus })
      .eq("id", candidate.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setItems((current) => current.map((row) => (row.id === candidate.id ? { ...row, status: nextStatus } : row)));
    }

    setBusyId(null);
  };

  const approveCandidate = async (candidate: Candidate) => {
    if (!configured) return;

    const supplierCost = Number(candidate.supplier_cost_usdt ?? 0);
    const salePrice = salePriceFor(candidate);
    const margin = Number((salePrice - supplierCost).toFixed(4));
    const marginRate = supplierCost > 0 ? Number(((margin / supplierCost) * 100).toFixed(4)) : 0;
    const productStatus = candidate.stock_state === "sold_out" ? "sold_out" : "visible";

    setBusyId(candidate.id);
    setError(null);

    const { error: productError } = await supabase.from("products").insert({
      candidate_id: candidate.id,
      service_name: candidate.service_name,
      title: candidate.product_title,
      description: productDescription(candidate),
      supplier_cost_usdt: supplierCost,
      sale_price_usdt: salePrice,
      margin_usdt: margin,
      margin_rate: marginRate,
      stock_state: candidate.stock_state,
      stock_count: candidate.stock_count,
      source_id: candidate.source_id,
      seller_id: candidate.seller_id,
      status: productStatus,
      last_synced_at: new Date().toISOString(),
      metadata: { approved_from_candidate: true, raw_message_id: candidate.raw_message_id },
    });

    if (productError) {
      setError(productError.message);
      setBusyId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("product_candidates")
      .update({ status: "approved" })
      .eq("id", candidate.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setItems((current) => current.map((row) => (row.id === candidate.id ? { ...row, status: "approved" } : row)));
    }

    setBusyId(null);
  };

  useEffect(() => {
    loadItems();
  }, []);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">상품 후보 검수</h1>
          <p className="text-[12.5px] text-muted-foreground">파싱된 원문 후보를 확인하고 승인 상품으로 전환합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && loadItems()}
            placeholder="서비스/상품 검색"
            className="h-9 px-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon w-full sm:w-44"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | CandidateStatus)}
            className="h-9 px-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon flex-1 sm:flex-none"
          >
            <option value="all">전체</option>
            <option value="candidate">candidate</option>
            <option value="approved">approved</option>
            <option value="hidden">hidden</option>
            <option value="expired">expired</option>
            <option value="rejected">rejected</option>
          </select>
          <button
            onClick={loadItems}
            disabled={loading}
            className="h-9 px-3 border border-border text-[12.5px] rounded-sm inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} /> 조회
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-usdt/40 bg-usdt/10 text-usdt rounded-md px-3 py-2 text-[12.5px]">
          {error}
        </div>
      )}

      <div className="hidden xl:grid grid-cols-[1.25fr_0.8fr_0.8fr_0.9fr_210px] px-3 h-9 items-center text-[11px] uppercase tracking-wider text-muted-foreground font-mono border border-border bg-card rounded-t-md">
        <span>후보 상품</span><span>원가/판매가</span><span>재고/신뢰도</span><span>소스</span><span>액션</span>
      </div>
      <div className="border xl:border-t-0 border-border rounded-md xl:rounded-t-none max-h-[calc(100vh-260px)] overflow-y-auto">
        {items.map((item) => {
          const salePrice = salePriceFor(item);
          const disabled = busyId === item.id;
          return (
            <div key={item.id} className="grid xl:grid-cols-[1.25fr_0.8fr_0.8fr_0.9fr_210px] gap-3 p-3 border-b border-border last:border-0 hover:bg-muted/30 items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-[13px]">{item.product_title}</span>
                  <span className={"text-[10.5px] px-1.5 py-0.5 border rounded-sm " + statusCls[item.status]}>{item.status}</span>
                </div>
                <div className="text-[11.5px] text-muted-foreground font-mono">{item.service_name || "unknown service"} · {item.delivery_type}</div>
                <div className="mt-2 text-[11.5px] text-muted-foreground line-clamp-2 break-words">{item.raw_messages?.message_text ?? "원문 없음"}</div>
              </div>
              <div className="font-mono text-[12px] space-y-1">
                <div>원가 <span className="text-muted-foreground">{money(item.supplier_cost_usdt)}</span></div>
                <div>판매 <span className="text-usdt font-semibold">{money(salePrice)}</span></div>
                <div className="text-[11px] text-muted-foreground">기본 마진 20%</div>
              </div>
              <div className="text-[12px] space-y-1">
                <div className={"font-mono " + stockCls[item.stock_state]}>{item.stock_state}</div>
                <div className="text-muted-foreground">수량: {item.stock_count ?? "확인 필요"}</div>
                <div className="text-muted-foreground">신뢰도: {Number(item.parsed_confidence ?? 0).toFixed(2)}</div>
              </div>
              <div className="text-[12px] space-y-1 text-muted-foreground min-w-0">
                <div className="font-mono text-foreground truncate">{item.telegram_sources?.telegram_identifier ?? "—"}</div>
                <div>{item.telegram_sources?.name ?? "소스 없음"}</div>
                <div>{formatDate(item.created_at)}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => approveCandidate(item)}
                  disabled={disabled || item.status === "approved"}
                  className="h-7 px-2 bg-neon text-[hsl(240_10%_4%)] rounded-sm text-[11.5px] font-semibold inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> 승인
                </button>
                <button
                  onClick={() => updateStatus(item, "hidden")}
                  disabled={disabled || item.status === "hidden"}
                  className="h-7 px-2 border border-border rounded-sm text-[11.5px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <EyeOff className="h-3.5 w-3.5" /> 숨김
                </button>
                <button
                  onClick={() => updateStatus(item, "rejected")}
                  disabled={disabled || item.status === "rejected"}
                  className="h-7 px-2 border border-border rounded-sm text-[11.5px] text-muted-foreground hover:text-destructive inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <XCircle className="h-3.5 w-3.5" /> 거절
                </button>
              </div>
            </div>
          );
        })}
        {!loading && items.length === 0 && (
          <div className="p-5 text-center text-[12.5px] text-muted-foreground">
            아직 검수할 상품 후보가 없습니다. 텔레그램 수집기가 원문을 파싱하면 candidate 상태 후보가 여기에 표시됩니다.
          </div>
        )}
      </div>
    </div>
  );
}
