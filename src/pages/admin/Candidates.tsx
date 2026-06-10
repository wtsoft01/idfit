import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { candidateProductPayload, salePriceForCost } from "@/lib/candidate-product";
import AdminRaw from "./RawFeed";

type Candidate = Tables<"product_candidates"> & {
  telegram_sources?: Pick<Tables<"telegram_sources">, "name" | "telegram_identifier" | "source_type"> | null;
  raw_messages?: Pick<Tables<"raw_messages">, "message_text" | "received_at"> | null;
};

type CandidateStatus = Candidate["status"];
type CurrencyFilter = "all" | "USDT" | "VND" | "other";
type StockFilter = "all" | Candidate["stock_state"];
type RiskFilter = "all" | "risk" | "safe";

const RISK_KEYWORDS = [
  "card",
  "cc",
  "bank",
  "invoice",
  "payment",
  "otp",
  "cookie",
  "token",
  "로그인",
  "카드",
  "은행",
  "인증",
  "결제",
  "쿠키",
  "토큰",
];

const statusCls: Record<CandidateStatus, string> = {
  candidate: "text-usdt border-usdt/40 bg-usdt/10",
  approved: "text-neon border-neon/40 bg-neon/10",
  hidden: "text-muted-foreground border-border bg-muted",
  expired: "text-orange-300 border-orange-300/40 bg-orange-300/10",
  rejected: "text-destructive border-destructive/40 bg-destructive/10",
};

const statusLabel: Record<CandidateStatus, string> = {
  candidate: "대기",
  approved: "자동 노출",
  hidden: "숨김",
  expired: "만료",
  rejected: "거절",
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
  return salePriceForCost(candidate.supplier_cost_usdt);
}

function supplierCurrencyFor(candidate: Candidate) {
  return String(candidate.supplier_currency ?? "UNKNOWN").toUpperCase();
}

function candidateRiskText(candidate: Candidate) {
  return [candidate.product_title, candidate.service_name, candidate.raw_messages?.message_text, JSON.stringify(candidate.metadata ?? {})]
    .join(" ")
    .toLowerCase();
}

function riskKeywordsFor(candidate: Candidate) {
  const text = candidateRiskText(candidate);
  return RISK_KEYWORDS.filter((keyword) => text.includes(keyword.toLowerCase()));
}

function marginPercentFor(candidate: Candidate) {
  const cost = Number(candidate.supplier_cost_usdt ?? 0);
  const salePrice = salePriceFor(candidate);
  if (!Number.isFinite(cost) || cost <= 0 || salePrice <= 0) return 0;
  return Number((((salePrice - cost) / cost) * 100).toFixed(1));
}

function currencyFilterMatches(candidate: Candidate, filter: CurrencyFilter) {
  if (filter === "all") return true;
  const currency = supplierCurrencyFor(candidate);
  if (filter === "other") return !["USDT", "VND"].includes(currency);
  return currency === filter;
}

export default function AdminCandidates() {
  const [activeTab, setActiveTab] = useState<"candidates" | "raw">("candidates");
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | CandidateStatus>("all");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [search, setSearch] = useState("");
  const configured = useMemo(isSupabaseConfigured, []);
  const visibleItems = useMemo(() => items.filter((item) => {
    if (!currencyFilterMatches(item, currencyFilter)) return false;
    if (stockFilter !== "all" && item.stock_state !== stockFilter) return false;
    const hasRisk = riskKeywordsFor(item).length > 0;
    if (riskFilter === "risk" && !hasRisk) return false;
    if (riskFilter === "safe" && hasRisk) return false;
    return true;
  }), [items, currencyFilter, stockFilter, riskFilter]);
  const summary = useMemo(() => ({
    total: items.length,
    visible: visibleItems.length,
    nonUsdt: items.filter((item) => supplierCurrencyFor(item) !== "USDT").length,
    risk: items.filter((item) => riskKeywordsFor(item).length > 0).length,
    soldOut: items.filter((item) => item.stock_state === "sold_out").length,
  }), [items, visibleItems]);

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
      setBusyId(null);
      return;
    }

    if (nextStatus === "approved") {
      const payload = candidateProductPayload({ ...candidate, status: nextStatus }, candidate.raw_message_id);
      const { data: existingProduct, error: findProductError } = await supabase
        .from("products")
        .select("id")
        .eq("candidate_id", candidate.id)
        .maybeSingle();

      if (findProductError) {
        setError(findProductError.message);
        setBusyId(null);
        return;
      }

      const productQuery = existingProduct?.id
        ? supabase.from("products").update(payload).eq("id", existingProduct.id)
        : supabase.from("products").insert(payload);
      const { error: productError } = await productQuery;

      if (productError) {
        setError(productError.message);
        setBusyId(null);
        return;
      }
    }

    if (["hidden", "rejected", "expired"].includes(nextStatus)) {
      const { error: productError } = await supabase
        .from("products")
        .update({ status: nextStatus === "expired" ? "expired" : "hidden" })
        .eq("candidate_id", candidate.id);

      if (productError) {
        setError(productError.message);
        setBusyId(null);
        return;
      }
    }

    setItems((current) => current.map((row) => (row.id === candidate.id ? { ...row, status: nextStatus } : row)));
    setBusyId(null);
  };

  useEffect(() => {
    loadItems();
  }, []);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">수집 데이터</h1>
          <p className="text-[12.5px] text-muted-foreground">수집 원본 메시지와 파싱된 상품 후보를 한 화면에서 확인하고 검수합니다.</p>
        </div>
        {activeTab === "candidates" && <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
            <option value="approved">자동 노출</option>
            <option value="candidate">대기</option>
            <option value="hidden">숨김</option>
            <option value="expired">만료</option>
            <option value="rejected">거절</option>
          </select>
          <select
            value={currencyFilter}
            onChange={(event) => setCurrencyFilter(event.target.value as CurrencyFilter)}
            className="h-9 px-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon flex-1 sm:flex-none"
          >
            <option value="all">통화 전체</option>
            <option value="USDT">USDT만</option>
            <option value="VND">VND만</option>
            <option value="other">기타통화</option>
          </select>
          <select
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value as StockFilter)}
            className="h-9 px-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon flex-1 sm:flex-none"
          >
            <option value="all">재고 전체</option>
            <option value="in_stock">재고 있음</option>
            <option value="low">재고 낮음</option>
            <option value="sold_out">품절</option>
            <option value="unknown">재고 미확인</option>
          </select>
          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
            className="h-9 px-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon flex-1 sm:flex-none"
          >
            <option value="all">위험 전체</option>
            <option value="risk">위험키워드</option>
            <option value="safe">위험 없음</option>
          </select>
          <button
            onClick={loadItems}
            disabled={loading}
            className="h-9 px-3 border border-border text-[12.5px] rounded-sm inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} /> 조회
          </button>
        </div>}
      </div>

      <div className="inline-flex rounded-md border border-border bg-card p-1 text-[12.5px]">
        <button
          onClick={() => setActiveTab("candidates")}
          className={"h-8 px-3 rounded-sm " + (activeTab === "candidates" ? "bg-neon text-[hsl(240_10%_4%)] font-semibold" : "text-muted-foreground hover:text-foreground")}
        >
          상품후보
        </button>
        <button
          onClick={() => setActiveTab("raw")}
          className={"h-8 px-3 rounded-sm " + (activeTab === "raw" ? "bg-neon text-[hsl(240_10%_4%)] font-semibold" : "text-muted-foreground hover:text-foreground")}
        >
          원본피드
        </button>
      </div>

      {activeTab === "raw" && <AdminRaw embedded />}

      {activeTab === "candidates" && <>

      {error && (
        <div className="border border-usdt/40 bg-usdt/10 text-usdt rounded-md px-3 py-2 text-[12.5px]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="border border-border bg-card rounded-md px-3 py-2"><div className="text-[11px] text-muted-foreground">전체 후보</div><div className="font-mono text-sm">{summary.total}</div></div>
        <div className="border border-border bg-card rounded-md px-3 py-2"><div className="text-[11px] text-muted-foreground">현재 표시</div><div className="font-mono text-sm text-neon">{summary.visible}</div></div>
        <div className="border border-border bg-card rounded-md px-3 py-2"><div className="text-[11px] text-muted-foreground">비USDT</div><div className="font-mono text-sm text-usdt">{summary.nonUsdt}</div></div>
        <div className="border border-border bg-card rounded-md px-3 py-2"><div className="text-[11px] text-muted-foreground">위험키워드</div><div className="font-mono text-sm text-orange-300">{summary.risk}</div></div>
        <div className="border border-border bg-card rounded-md px-3 py-2"><div className="text-[11px] text-muted-foreground">품절</div><div className="font-mono text-sm text-destructive">{summary.soldOut}</div></div>
      </div>

      <div className="hidden xl:grid grid-cols-[1.25fr_0.8fr_0.8fr_0.9fr_210px] px-3 h-9 items-center text-[11px] uppercase tracking-wider text-muted-foreground font-mono border border-border bg-card rounded-t-md">
        <span>후보 상품</span><span>원가/판매가</span><span>재고/신뢰도</span><span>소스</span><span>액션</span>
      </div>
      <div className="border xl:border-t-0 border-border rounded-md xl:rounded-t-none max-h-[calc(100vh-260px)] overflow-y-auto">
        {visibleItems.map((item) => {
          const salePrice = salePriceFor(item);
          const currency = supplierCurrencyFor(item);
          const riskKeywords = riskKeywordsFor(item);
          const hasRisk = riskKeywords.length > 0;
          const canApprove = currency === "USDT" && !hasRisk && item.stock_state !== "sold_out" && Number(item.supplier_cost_usdt ?? 0) > 0;
          const disabled = busyId === item.id;
          return (
            <div key={item.id} className="grid xl:grid-cols-[1.25fr_0.8fr_0.8fr_0.9fr_210px] gap-3 p-3 border-b border-border last:border-0 hover:bg-muted/30 items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-[13px]">{item.product_title}</span>
                  <span className={"text-[10.5px] px-1.5 py-0.5 border rounded-sm " + statusCls[item.status]}>{statusLabel[item.status]}</span>
                  <span className={"text-[10.5px] px-1.5 py-0.5 border rounded-sm " + (currency === "USDT" ? "text-neon border-neon/40 bg-neon/10" : "text-usdt border-usdt/40 bg-usdt/10")}>{currency}</span>
                  {hasRisk && <span className="text-[10.5px] px-1.5 py-0.5 border rounded-sm text-orange-300 border-orange-300/40 bg-orange-300/10">위험 {riskKeywords.slice(0, 2).join(", ")}</span>}
                </div>
                <div className="text-[11.5px] text-muted-foreground font-mono">{item.service_name || "unknown service"} · {item.delivery_type}</div>
                <div className="mt-2 text-[11.5px] text-muted-foreground line-clamp-2 break-words">{item.raw_messages?.message_text ?? "원문 없음"}</div>
              </div>
              <div className="font-mono text-[12px] space-y-1">
                <div>원가 <span className="text-muted-foreground">{money(item.supplier_cost_usdt)}</span></div>
                <div>판매 <span className="text-usdt font-semibold">{money(salePrice)}</span></div>
                <div className="text-[11px] text-muted-foreground">마진 {marginPercentFor(item).toFixed(1)}%</div>
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
                  onClick={() => updateStatus(item, "approved")}
                  disabled={disabled || item.status === "approved" || !canApprove}
                  title={canApprove ? "상품으로 노출" : "USDT·위험 없음·재고 있음·원가 확인 후보만 승인 가능"}
                  className="h-7 px-2 border border-neon/40 rounded-sm text-[11.5px] text-neon hover:bg-neon/10 inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <Eye className="h-3.5 w-3.5" /> 승인노출
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
            아직 표시할 상품 후보가 없습니다. 텔레그램 수집기가 원문을 파싱하면 후보 기록이 여기에 표시됩니다.
          </div>
        )}
        {!loading && items.length > 0 && visibleItems.length === 0 && (
          <div className="p-5 text-center text-[12.5px] text-muted-foreground">
            현재 필터 조건에 맞는 상품 후보가 없습니다.
          </div>
        )}
      </div>
      </>}
    </div>
  );
}
