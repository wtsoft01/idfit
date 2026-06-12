import { useEffect, useState } from "react";
import { Cpu, Radio, Zap } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { maskSourceIdentifier, redactDirectContactText } from "@/lib/source-privacy";

function ts() {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

type ScanLine = {
  id: string;
  t: string;
  line: string;
  ok?: boolean;
};

type RawScanRow = {
  id: string;
  message_text: string | null;
  parse_status: string | null;
  received_at: string | null;
  source?: { telegram_identifier: string | null } | { telegram_identifier: string | null }[] | null;
};

export function AIScanLog({ className }: { className?: string }) {
  const [lines, setLines] = useState<ScanLine[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    if (!isSupabaseConfigured) {
      setLines([{ id: "env", t: ts(), line: "Supabase 연결 전입니다. 실제 스캔 데이터만 표시합니다.", ok: false }]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("raw_messages")
      .select("id,message_text,parse_status,received_at,source:telegram_sources(telegram_identifier)")
      .order("received_at", { ascending: false })
      .limit(18);

    if (error) {
      setLines([{ id: "error", t: ts(), line: `실제 스캔 로그 조회 실패: ${error.message}`, ok: false }]);
      setLoading(false);
      return;
    }

    setLines(((data ?? []) as RawScanRow[]).map((item) => {
      const source = Array.isArray(item.source) ? item.source[0]?.telegram_identifier : item.source?.telegram_identifier;
      const status = item.parse_status === "parsed" ? "상품 후보 감지" : item.parse_status === "ignored" ? "무시됨" : item.parse_status ?? "대기";
      const text = redactDirectContactText(item.message_text).replace(/\s+/g, " ").slice(0, 80);
      return {
        id: item.id,
        t: item.received_at ? new Date(item.received_at).toLocaleTimeString("ko-KR", { hour12: false }) : ts(),
        line: `${maskSourceIdentifier(source)} · ${status} · ${text}`,
        ok: item.parse_status === "parsed",
      };
    }));
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
    const timer = setInterval(loadLogs, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={"rounded-md border border-neon/25 bg-card/70 flex flex-col overflow-hidden shadow-[0_0_24px_hsl(var(--neon)/0.08)] " + (className ?? "")}>
      <div className="flex items-center justify-between gap-2 px-3 h-10 border-b border-neon/20 bg-card text-[11px] uppercase tracking-wider text-muted-foreground relative overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-neon/70 to-transparent animate-pulse" />
        <div className="flex items-center gap-2 min-w-0">
          <Cpu className="h-3.5 w-3.5 text-neon pulse-dot" />
          <span className="text-neon font-semibold">AI FILTER LOG</span>
        </div>
        <div className="hidden sm:inline-flex items-center gap-1 text-[10px] text-usdt">
          <Radio className="h-3 w-3 animate-pulse" /> 5초 갱신
        </div>
      </div>
      <div className="px-3 py-2 border-b border-border/60 bg-background/35 text-[10.5px] text-muted-foreground flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-usdt animate-pulse" /> 원본 소스 수집 → 상품 후보 감지 → 재고/가격 필터링 로그
      </div>
      <div className="flex-1 overflow-hidden p-3 font-mono text-[12px] leading-relaxed space-y-1.5">
        {loading ? (
          <div className="text-muted-foreground">실제 스캔 로그를 불러오는 중입니다.</div>
        ) : lines.length === 0 ? (
          <div className="text-muted-foreground">아직 수집된 실제 스캔 로그가 없습니다.</div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="animate-slide-up-in rounded-sm border border-border/60 bg-background/35 px-2 py-1 text-muted-foreground min-w-0 overflow-hidden">
              <span className="text-neon/80">[{line.t}]</span>{" "}
              <span className={line.ok ? "text-foreground" : line.ok === false ? "text-destructive/80" : "text-muted-foreground"}>
                {line.line}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
