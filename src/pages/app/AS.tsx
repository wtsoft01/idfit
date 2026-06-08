import { useState } from "react";
import { SupportChat } from "@/components/deal/SupportChat";
import { ShieldAlert, CheckCircle2, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ELIGIBLE_ORDERS = [
  { id: "DS-20294", service: "ChatGPT Plus", purchasedAt: "2026-05-20", warrantyEnd: "2026-06-19", daysLeft: 11 },
  { id: "DS-20281", service: "Cursor Pro 90일", purchasedAt: "2026-04-30", warrantyEnd: "2026-07-29", daysLeft: 51 },
  { id: "DS-20269", service: "Midjourney", purchasedAt: "2026-05-12", warrantyEnd: "2026-06-11", daysLeft: 3 },
];

const REASONS = [
  "로그인이 안 됨 (비밀번호 변경됨)",
  "2단계 인증 코드 요구",
  "계정 정지 / 차단",
  "구독이 만료되어 있음",
  "다른 사람이 동시 접속 중",
  "기타 (직접 작성)",
];

const TICKETS = [
  { id: "AS-3041", order: "DS-20251", service: "Claude Pro 30일", status: "대체 계정 발송됨", at: "2시간 전", tone: "text-neon" },
  { id: "AS-3022", order: "DS-20211", service: "ChatGPT Plus", status: "처리 중 · 관리자 확인", at: "어제", tone: "text-usdt" },
];

export default function AS() {
  const [orderId, setOrderId] = useState(ELIGIBLE_ORDERS[0].id);
  const [reason, setReason] = useState(REASONS[0]);
  const [memo, setMemo] = useState("");
  const [step, setStep] = useState<"form" | "submitted">("form");
  const [ticketId, setTicketId] = useState<string>("");

  const submit = () => {
    if (!memo.trim()) return toast.error("간단한 증상을 입력해주세요");
    const tid = "AS-" + Math.floor(3100 + Math.random() * 900);
    setTicketId(tid);
    setStep("submitted");
    toast.success(`${tid} 접수 완료 · 평균 18분 내 처리`);
  };

  const reset = () => {
    setStep("form");
    setMemo("");
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-6xl">
      <div>
        <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest mb-1">warranty service</div>
        <h1 className="font-display text-xl md:text-2xl font-bold">AS 신청 / 보장 청구</h1>
        <p className="text-[12.5px] text-muted-foreground mt-1">보장기간 내 문제 발생 시 1클릭 신청 → 평균 18분 처리</p>
      </div>

      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-4">
          {step === "form" ? (
            <div className="rounded-md border border-border bg-card p-4 space-y-4">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold">
                <ShieldAlert className="h-4 w-4 text-usdt" /> 새 AS 신청
              </div>

              <div>
                <div className="text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1.5">보장 대상 주문 선택</div>
                <div className="space-y-2">
                  {ELIGIBLE_ORDERS.map((o) => (
                    <label
                      key={o.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 border rounded-sm cursor-pointer text-[12.5px]",
                        orderId === o.id ? "border-neon bg-neon/5" : "border-border hover:border-foreground/30"
                      )}
                    >
                      <input
                        type="radio"
                        checked={orderId === o.id}
                        onChange={() => setOrderId(o.id)}
                        className="accent-[hsl(var(--neon))]"
                      />
                      <span className="font-mono text-muted-foreground w-24">{o.id}</span>
                      <span className="flex-1 text-foreground">{o.service}</span>
                      <span className="text-muted-foreground">~ {o.warrantyEnd}</span>
                      <span className={cn(
                        "font-mono px-1.5 py-0.5 border rounded-sm text-[10.5px]",
                        o.daysLeft <= 5 ? "text-destructive border-destructive/40 bg-destructive/10"
                        : "text-neon border-neon/40 bg-neon/10"
                      )}>
                        D-{o.daysLeft}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1.5">증상</div>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-9 w-full px-2 text-[12.5px] bg-background border border-border rounded-sm"
                >
                  {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <div className="text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1.5">상세 설명 · 스크린샷 URL</div>
                <Textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="언제부터 / 어떤 화면에서 / 시도한 조치를 적어주세요. 스크린샷은 imgur 등의 링크로 첨부 가능."
                  className="text-[12.5px] min-h-[120px]"
                />
              </div>

              <div>
                <div className="text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1.5">처리 방식</div>
                <div className="grid sm:grid-cols-2 gap-2 text-[12px]">
                  <button className="border border-neon bg-neon/5 text-foreground px-3 py-2 rounded-sm text-left">
                    <div className="font-semibold text-neon">대체 계정 즉시 발송 (권장)</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">평균 18분 · 동일 상품 자동 매칭</div>
                  </button>
                  <button className="border border-border px-3 py-2 rounded-sm text-left hover:border-foreground/30">
                    <div className="font-semibold">USDT 잔여 일수 환불</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">남은 보장일수 기준 일할 계산</div>
                  </button>
                </div>
              </div>

              <button
                onClick={submit}
                className="w-full h-10 bg-neon text-[hsl(240_10%_4%)] text-[13px] font-semibold rounded-sm hover:brightness-110"
              >
                AS 접수하기
              </button>
            </div>
          ) : (
            <div className="rounded-md border border-neon/40 bg-neon/5 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-neon" />
                <div className="text-[14px] font-semibold">{ticketId} 접수 완료</div>
              </div>
              <div className="text-[12.5px] text-muted-foreground">
                관리자가 확인 후 평균 18분 내에 대체 계정 또는 환불을 처리합니다. 처리 진행 상황은 우측 채팅창과 텔레그램으로 실시간 안내됩니다.
              </div>
              <div className="flex gap-2 text-[11.5px] font-mono">
                <span className="inline-flex items-center gap-1 px-2 py-1 border border-border rounded-sm"><Clock className="h-3 w-3" /> 평균 18분</span>
                <span className="inline-flex items-center gap-1 px-2 py-1 border border-border rounded-sm">SLA 보장 30분</span>
              </div>
              <button onClick={reset} className="h-9 px-3 text-[12px] border border-border rounded-sm hover:bg-muted">새 AS 신청</button>
            </div>
          )}

          <div className="rounded-md border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-background/40">
              <Clock className="h-3.5 w-3.5 text-cyan" />
              <span className="text-[12.5px] font-semibold">최근 AS 내역</span>
            </div>
            <div className="divide-y divide-border">
              {TICKETS.map((t) => (
                <div key={t.id} className="px-3 py-2.5 flex items-center gap-3 text-[12.5px]">
                  <span className="font-mono text-muted-foreground w-20">{t.id}</span>
                  <span className="font-mono text-muted-foreground w-20">{t.order}</span>
                  <span className="flex-1 text-foreground truncate">{t.service}</span>
                  <span className={cn("font-medium", t.tone)}>{t.status}</span>
                  <span className="text-[11px] text-muted-foreground">{t.at}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <SupportChat topic={ticketId ? `AS · ${ticketId}` : "AS 사전 상담"} height="h-[640px]" />
        </div>
      </div>
    </div>
  );
}
