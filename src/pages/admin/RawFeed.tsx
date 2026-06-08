import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type RawMessage = Tables<"raw_messages"> & {
  telegram_sources?: Pick<Tables<"telegram_sources">, "name" | "telegram_identifier" | "source_type"> | null;
};

type ParseStatus = RawMessage["parse_status"];

const parseStatusCls: Record<RawMessage["parse_status"], string> = {
  pending: "text-usdt border-usdt/40 bg-usdt/10",
  parsed: "text-neon border-neon/40 bg-neon/10",
  ignored: "text-muted-foreground border-border bg-muted",
  failed: "text-destructive border-destructive/40 bg-destructive/10",
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
    second: "2-digit",
  }).format(new Date(value));
}

function sourceLabel(item: RawMessage) {
  return item.telegram_sources?.telegram_identifier ?? item.sender_identifier ?? "unknown";
}

export default function AdminRaw() {
  const [items, setItems] = useState<RawMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ParseStatus>("all");
  const [search, setSearch] = useState("");
  const configured = useMemo(isSupabaseConfigured, []);

  const loadItems = async () => {
    if (!configured) {
      setError("Supabase publishable key가 아직 실제 전체 값이 아니라서 원본 피드 조회를 대기 중입니다.");
      return;
    }

    setLoading(true);
    setError(null);

    let query = supabase
      .from("raw_messages")
      .select("*, telegram_sources(name, telegram_identifier, source_type)")
      .order("received_at", { ascending: false })
      .limit(80);

    if (statusFilter !== "all") {
      query = query.eq("parse_status", statusFilter);
    }

    const keyword = search.trim();
    if (keyword) {
      query = query.ilike("message_text", `%${keyword}%`);
    }

    const { data, error: queryError } = await query;

    if (queryError) {
      setError(queryError.message);
    } else {
      setItems((data ?? []) as RawMessage[]);
    }

    setLoading(false);
  };

  const updateParseStatus = async (item: RawMessage, nextStatus: ParseStatus) => {
    if (!configured) return;

    const { error: updateError } = await supabase
      .from("raw_messages")
      .update({ parse_status: nextStatus })
      .eq("id", item.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, parse_status: nextStatus } : row)));
  };

  useEffect(() => {
    loadItems();
  }, []);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">원본 수집 피드</h1>
          <p className="text-[12.5px] text-muted-foreground">텔레그램 소스에서 저장된 원본 메시지와 파싱 상태</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && loadItems()}
            placeholder="메시지 검색"
            className="h-9 px-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon w-full sm:w-44"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | ParseStatus)}
            className="h-9 px-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon flex-1 sm:flex-none"
          >
            <option value="all">전체</option>
            <option value="pending">pending</option>
            <option value="parsed">parsed</option>
            <option value="ignored">ignored</option>
            <option value="failed">failed</option>
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

      <div className="hidden lg:grid grid-cols-[1fr_1fr_190px_150px] px-3 h-9 items-center text-[11px] uppercase tracking-wider text-muted-foreground font-mono border border-border bg-card rounded-t-md">
        <span>원본 메시지</span><span>메타</span><span>파싱 상태</span><span>수신 시간</span>
      </div>
      <div className="border lg:border-t-0 border-border rounded-md lg:rounded-t-none max-h-[calc(100vh-260px)] overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="grid lg:grid-cols-[1fr_1fr_190px_150px] gap-3 p-3 border-b border-border last:border-0 hover:bg-muted/30 items-start">
            <div className="font-mono text-[11.5px] text-muted-foreground min-w-0">
              <div className="text-neon mb-1 truncate">{sourceLabel(item)}</div>
              <div className="whitespace-pre-wrap break-words">{item.message_text || "메시지 본문 없음"}</div>
            </div>
            <div className="text-[12px] space-y-1 text-muted-foreground min-w-0">
              <div>source: <span className="font-mono text-foreground">{item.telegram_sources?.name ?? "—"}</span></div>
              <div>type: <span className="font-mono text-foreground">{item.telegram_sources?.source_type ?? "—"}</span></div>
              <div>hash: <span className="font-mono text-foreground break-all">{item.hash_key.slice(0, 16)}…</span></div>
            </div>
            <div>
              <span className={"text-[10.5px] px-1.5 py-0.5 border rounded-sm w-fit " + parseStatusCls[item.parse_status]}>
                {item.parse_status}
              </span>
              <div className="flex flex-wrap gap-1 mt-2">
                {(["pending", "parsed", "ignored", "failed"] as ParseStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => updateParseStatus(item, status)}
                    disabled={item.parse_status === status}
                    className="h-6 px-1.5 border border-border rounded-sm text-[10.5px] text-muted-foreground disabled:opacity-40 hover:text-foreground"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
            <div className="font-mono text-[11.5px] text-muted-foreground">{formatDate(item.received_at)}</div>
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div className="p-5 text-center text-[12.5px] text-muted-foreground">
            아직 저장된 원본 메시지가 없습니다. 텔레그램 수집기를 연결하기 전에는 수동 원문 주입 스크립트로 Raw Feed 표시를 먼저 확인할 수 있습니다.
          </div>
        )}
      </div>
    </div>
  );
}
