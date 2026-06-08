import { useEffect, useState } from "react";
import { Copy, RefreshCw, CheckCircle2, AlertTriangle, Search, Bot, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

type Status = "checking" | "in_stock" | "oos" | "paying" | "ready" | "delivered";

interface QueueItem {
  id: string;
  order: string;
  source: string;
  svc: string;
  qty: number;
  expectedPrice: number; // USDT
  status: Status;
  payAddr?: string;
  payNet?: "TRC20" | "BEP20";
  payAmt?: number;
}

const SEED_RULES = [
  { src: "@gpt_market_kr", svc: "ChatGPT Plus", auto: true, success: 184, fail: 3 },
  { src: "@cursor_keys_tr", svc: "Cursor Pro", auto: true, success: 92, fail: 1 },
  { src: "@mj_pool_ru", svc: "Midjourney", auto: false, success: 0, fail: 0 },
  { src: "@claude_market", svc: "Claude Pro", auto: true, success: 141, fail: 8 },
];

const SEED_QUEUE: QueueItem[] = [
  { id: "q1", order: "DS-20294", source: "@gpt_market_kr", svc: "ChatGPT Plus 30d", qty: 1, expectedPrice: 11.2, status: "checking" },
  { id: "q2", order: "DS-20293", source: "@cursor_keys_tr", svc: "Cursor Pro 90d", qty: 1, expectedPrice: 28.4, status: "paying", payAddr: "TQrZ9...n4Lp", payNet: "TRC20", payAmt: 28.4 },
  { id: "q3", order: "DS-20291", source: "@claude_market", svc: "Claude Pro 30d", qty: 1, expectedPrice: 14.7, status: "oos" },
  { id: "q4", order: "DS-20290", source: "@gpt_market_kr", svc: "ChatGPT Plus 30d", qty: 1, expectedPrice: 11.4, status: "ready", payAddr: "TQrZ9...n4Lp", payNet: "TRC20", payAmt: 11.4 },
  { id: "q5", order: "DS-20288", source: "@mj_pool_ru", svc: "Midjourney Std", qty: 1, expectedPrice: 18.0, status: "delivered" },
];

const ALT_DEALS = [
  { src: "@ai_pool_global", svc: "Claude Pro 30d", price: 15.2, trust: 92, stock: 4 },
  { src: "@gpt_resale", svc: "Claude Pro 30d", price: 14.9, trust: 88, stock: 2 },
  { src: "@subs_market", svc: "Claude Pro 30d", price: 16.1, trust: 95, stock: 7 },
];

const LOGS = [
  { t: "12:04:21", msg: "@gpt_market_kr · ChatGPT Plus · DS-20294 stock check OK (1.1s)", ok: true },
  { t: "12:03:58", msg: "@cursor_keys_tr · Cursor Pro · DS-20293 USDT 결제정보 수신 (TRC20)", ok: true },
  { t: "12:02:11", msg: "@claude_market · Claude Pro · DS-20291 OOS — 유사 딜 탐색 시작", ok: false },
  { t: "12:01:44", msg: "@gpt_market_kr · ChatGPT Plus · DS-20290 결제정보 준비 완료", ok: true },
];

function StatusBadge({ s }: { s: Status }) {
  const { t } = useT();
  const map: Record<Status, { label: string; cls: string }> = {
    checking: { label: t("auto.status.checking"), cls: "border-muted-foreground/40 text-muted-foreground" },
    in_stock: { label: t("auto.status.in_stock"), cls: "border-neon/60 text-neon" },
    oos: { label: t("auto.status.oos"), cls: "border-destructive/60 text-destructive" },
    paying: { label: t("auto.status.paying"), cls: "border-usdt/60 text-usdt" },
    ready: { label: t("auto.status.ready"), cls: "border-neon/60 text-neon" },
    delivered: { label: t("auto.status.delivered"), cls: "border-border text-muted-foreground" },
  };
  const v = map[s];
  return <span className={`inline-flex items-center px-1.5 h-5 text-[10.5px] font-mono uppercase tracking-wider rounded-sm border ${v.cls}`}>{v.label}</span>;
}

export default function AdminAutomation() {
  const { t } = useT();
  const [queue, setQueue] = useState<QueueItem[]>(SEED_QUEUE);
  const [altOpenFor, setAltOpenFor] = useState<string | null>("q3");

  // Mock progression: checking → in_stock → paying → ready
  useEffect(() => {
    const id = setInterval(() => {
      setQueue((prev) =>
        prev.map((q) => {
          if (q.status === "checking") {
            return Math.random() > 0.3
              ? { ...q, status: "in_stock" as Status }
              : { ...q, status: "oos" as Status };
          }
          if (q.status === "in_stock") return { ...q, status: "paying" as Status, payNet: "TRC20", payAddr: "TQrZ9...n4Lp", payAmt: q.expectedPrice };
          if (q.status === "paying") return { ...q, status: "ready" as Status };
          return q;
        })
      );
    }, 6000);
    return () => clearInterval(id);
  }, []);

  const copy = (q: QueueItem) => {
    if (!q.payAddr) return;
    navigator.clipboard.writeText(`${q.payNet} ${q.payAddr} · ${q.payAmt} USDT`);
    toast.success("결제정보가 복사되었습니다");
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold">{t("auto.title")}</h1>
        <p className="text-[12.5px] text-muted-foreground mt-1 max-w-3xl">{t("auto.desc")}</p>
      </div>

      {/* Rules */}
      <div className="border border-border rounded-md overflow-hidden">
        <div className="px-3 h-10 flex items-center border-b border-border text-[12.5px] font-semibold gap-2">
          <Bot className="h-3.5 w-3.5 text-neon" /> {t("auto.rules")}
        </div>
        <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr_0.7fr_auto] px-3 h-9 items-center bg-card text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span>{t("auto.col.source")}</span><span>{t("auto.col.svc")}</span><span>{t("auto.col.auto")}</span><span>{t("auto.col.success")}</span><span>{t("auto.col.fail")}</span><span></span>
        </div>
        {SEED_RULES.map((r) => (
          <div key={r.src} className="grid grid-cols-[1.2fr_1fr_0.8fr_0.7fr_0.7fr_auto] px-3 h-11 items-center text-[12.5px] border-b border-border last:border-0">
            <span className="font-mono">{r.src}</span>
            <span>{r.svc}</span>
            <span className={r.auto ? "text-neon" : "text-muted-foreground"}>{r.auto ? "ON" : "OFF"}</span>
            <span className="font-mono text-neon">{r.success}</span>
            <span className="font-mono text-destructive">{r.fail}</span>
            <button className="h-7 px-2.5 text-[11px] border border-border rounded-sm hover:bg-muted">{t("auto.col.edit")}</button>
          </div>
        ))}
      </div>

      {/* Queue */}
      <div className="border border-border rounded-md overflow-hidden">
        <div className="px-3 h-10 flex items-center border-b border-border text-[12.5px] font-semibold gap-2">
          <Wallet className="h-3.5 w-3.5 text-usdt" /> {t("auto.queue")}
        </div>
        <div className="grid grid-cols-[110px_1.1fr_1.2fr_90px_1.4fr_120px_auto] px-3 h-9 items-center bg-card text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span>{t("auto.col.order")}</span>
          <span>{t("auto.col.source")}</span>
          <span>{t("auto.col.svc")}</span>
          <span>{t("auto.col.stock")}</span>
          <span>{t("auto.col.pay")}</span>
          <span>{t("auto.col.status")}</span>
          <span>{t("auto.col.action")}</span>
        </div>
        {queue.map((q) => (
          <div key={q.id} className="grid grid-cols-[110px_1.1fr_1.2fr_90px_1.4fr_120px_auto] px-3 py-2 items-center text-[12.5px] border-b border-border last:border-0">
            <span className="font-mono text-foreground">{q.order}</span>
            <span className="font-mono text-muted-foreground truncate">{q.source}</span>
            <span className="truncate">{q.svc}</span>
            <span>
              {q.status === "checking" && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
              {q.status === "oos" && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
              {(q.status === "in_stock" || q.status === "paying" || q.status === "ready" || q.status === "delivered") && <CheckCircle2 className="h-3.5 w-3.5 text-neon" />}
            </span>
            <span className="font-mono text-[11.5px] text-muted-foreground truncate">
              {q.payAddr ? <>
                <span className="text-usdt">{q.payNet}</span> · {q.payAddr} · <span className="text-foreground">{q.payAmt} USDT</span>
              </> : <span className="text-muted-foreground/60">—</span>}
            </span>
            <span><StatusBadge s={q.status} /></span>
            <div className="flex items-center gap-1 justify-end">
              {q.payAddr && (
                <button onClick={() => copy(q)} className="h-7 px-2 inline-flex items-center gap-1 text-[11px] border border-border rounded-sm hover:bg-muted">
                  <Copy className="h-3 w-3" /> {t("auto.act.copy")}
                </button>
              )}
              {q.status === "oos" && (
                <button onClick={() => setAltOpenFor(altOpenFor === q.id ? null : q.id)} className="h-7 px-2 inline-flex items-center gap-1 text-[11px] border border-usdt/60 text-usdt rounded-sm hover:bg-usdt/10">
                  <Search className="h-3 w-3" /> {t("auto.act.alt")}
                </button>
              )}
              {q.status === "ready" && (
                <button className="h-7 px-2 text-[11px] bg-neon text-[hsl(240_10%_4%)] font-semibold rounded-sm hover:brightness-110">{t("auto.act.deliver")}</button>
              )}
            </div>
          </div>
        ))}

        {/* Alt panel */}
        {altOpenFor && (() => {
          const q = queue.find((x) => x.id === altOpenFor);
          if (!q) return null;
          return (
            <div className="border-t border-border bg-card/40 p-3">
              <div className="flex items-baseline gap-2 mb-2">
                <Search className="h-3.5 w-3.5 text-usdt" />
                <span className="text-[12.5px] font-semibold">{t("auto.alt.title")} · {q.order}</span>
                <span className="text-[11px] text-muted-foreground">{t("auto.alt.subtitle")}</span>
              </div>
              <div className="grid md:grid-cols-3 gap-2">
                {ALT_DEALS.map((a, i) => {
                  const diff = ((a.price - q.expectedPrice) / q.expectedPrice) * 100;
                  return (
                    <div key={i} className="border border-border rounded-sm p-3 bg-background">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[11.5px] text-muted-foreground">{a.src}</span>
                        <span className={`text-[11px] font-mono ${a.trust >= 90 ? "text-neon" : "text-usdt"}`}>{t("auto.alt.trust")} {a.trust}</span>
                      </div>
                      <div className="text-[12.5px] mb-1">{a.svc}</div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="font-mono text-foreground text-[13.5px]">{a.price} USDT</span>
                        <span className={`text-[10.5px] font-mono ${diff <= 0 ? "text-neon" : "text-destructive"}`}>{diff >= 0 ? "+" : ""}{diff.toFixed(1)}%</span>
                        <span className="text-[10.5px] text-muted-foreground font-mono ml-auto">stock {a.stock}</span>
                      </div>
                      <button
                        onClick={() => {
                          setQueue((p) => p.map((x) => x.id === q.id ? { ...x, source: a.src, status: "paying", payNet: "TRC20", payAddr: "TQrZ9...alt7", payAmt: a.price } : x));
                          setAltOpenFor(null);
                          toast.success(`${a.src} 로 대안 발주를 진행합니다`);
                        }}
                        className="w-full h-7 text-[11px] bg-neon text-[hsl(240_10%_4%)] font-semibold rounded-sm hover:brightness-110"
                      >
                        {t("auto.alt.use")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Logs */}
      <div className="border border-border rounded-md">
        <div className="px-4 h-10 flex items-center border-b border-border text-[12.5px] font-semibold">{t("auto.logs")}</div>
        <div className="p-3 font-mono text-[11.5px] space-y-1">
          {LOGS.map((l, i) => (
            <div key={i} className={l.ok ? "text-foreground" : "text-destructive/90"}>
              <span className="text-neon/70">[{l.t}]</span> {l.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
