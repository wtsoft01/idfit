import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SupportChat } from "@/components/deal/SupportChat";
import { ShieldAlert, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AsTicketStatus = "open" | "investigating" | "replacement_sent" | "rejected" | "closed";
type AsIssueType = "invalid_login" | "used_code" | "expired" | "wrong_product" | "other";

type EligibleOrder = {
  id: string;
  order_no: string;
  status: "delivered" | "as_open";
  created_at: string;
  product: { title: string; service_name: string } | null;
};

type AsTicket = {
  id: string;
  order_id: string;
  status: AsTicketStatus;
  issue_type: AsIssueType;
  customer_message: string;
  admin_note: string | null;
  created_at: string;
  order: { order_no: string; product: { title: string; service_name: string } | null } | null;
};

const REASONS: { value: AsIssueType; label: string }[] = [
  { value: "invalid_login", label: "로그인이 안 됨 / 비밀번호 변경됨" },
  { value: "used_code", label: "이미 사용된 코드" },
  { value: "expired", label: "구독 만료 / 사용기간 문제" },
  { value: "wrong_product", label: "주문과 다른 상품 전달" },
  { value: "other", label: "기타 문제" },
];

const statusLabel: Record<AsTicketStatus, string> = {
  open: "접수됨",
  investigating: "확인중",
  replacement_sent: "대체 발송",
  rejected: "반려",
  closed: "종료",
};

const statusClass: Record<AsTicketStatus, string> = {
  open: "text-usdt",
  investigating: "text-usdt",
  replacement_sent: "text-neon",
  rejected: "text-destructive",
  closed: "text-muted-foreground",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function AS() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedOrderId = searchParams.get("order") ?? "";
  const [orders, setOrders] = useState<EligibleOrder[]>([]);
  const [tickets, setTickets] = useState<AsTicket[]>([]);
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState<AsIssueType>("invalid_login");
  const [memo, setMemo] = useState("");
  const [step, setStep] = useState<"form" | "submitted">("form");
  const [ticketId, setTicketId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const [{ data: orderRows, error: orderError }, { data: ticketRows, error: ticketError }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_no, status, created_at, product:products(title, service_name)")
        .eq("user_id", user.id)
        .in("status", ["delivered", "as_open"])
        .order("created_at", { ascending: false }),
      supabase
        .from("as_tickets")
        .select("id, order_id, status, issue_type, customer_message, admin_note, created_at, order:orders(order_no, product:products(title, service_name))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (orderError || ticketError) {
      setError(orderError?.message ?? ticketError?.message ?? "AS 정보를 불러오지 못했습니다.");
    } else {
      const nextOrders = (orderRows ?? []) as unknown as EligibleOrder[];
      setOrders(nextOrders);
      setTickets((ticketRows ?? []) as unknown as AsTicket[]);
      setOrderId((current) => {
        if (requestedOrderId && nextOrders.some((order) => order.id === requestedOrderId)) return requestedOrderId;
        if (current && nextOrders.some((order) => order.id === current)) return current;
        return nextOrders[0]?.id || "";
      });
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user?.id, requestedOrderId]);

  const selectedOrder = useMemo(() => orders.find((order) => order.id === orderId), [orders, orderId]);
  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.order_id === orderId && !["closed", "rejected"].includes(ticket.status)) ?? null,
    [tickets, orderId]
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return toast.error("로그인 후 AS를 신청할 수 있습니다.");
    if (!orderId) return toast.error("AS를 신청할 주문을 선택해주세요.");
    if (!memo.trim()) return toast.error("간단한 증상을 입력해주세요.");

    setSaving(true);
    const reasonLabel = REASONS.find((item) => item.value === reason)?.label ?? reason;
    const { data: ticket, error: insertError } = await supabase
      .from("as_tickets")
      .insert({
        order_id: orderId,
        user_id: user.id,
        issue_type: reason,
        customer_message: `[${reasonLabel}]\n${memo.trim()}`,
      })
      .select("id")
      .single();

    if (insertError) {
      toast.error(insertError.message);
      setSaving(false);
      return;
    }

    await supabase
      .from("support_messages" as never)
      .insert({
        user_id: user.id,
        order_id: orderId,
        as_ticket_id: ticket.id,
        topic: "AS 상담",
        sender_role: "customer",
        sender_id: user.id,
        body: `[AS 접수] ${reasonLabel}\n${memo.trim()}`,
        read_by_customer_at: new Date().toISOString(),
      } as never);

    const shortId = `AS-${ticket.id.slice(0, 8).toUpperCase()}`;
    setTicketId(shortId);
    setStep("submitted");
    setMemo("");
    toast.success(`${shortId} 접수 완료`);
    await loadData();
  };

  const reset = () => {
    setStep("form");
    setMemo("");
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-6xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest mb-1">warranty service</div>
          <h1 className="font-display text-xl md:text-2xl font-bold">AS 신청 / 보장 청구</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1">배송 완료된 주문에 문제가 생기면 AS를 접수하고 처리 상태를 확인합니다.</p>
        </div>
        <button onClick={loadData} disabled={loading} className="h-9 px-3 inline-flex items-center gap-1.5 border border-border text-[12px] rounded-sm disabled:opacity-60">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> 새로고침
        </button>
      </div>

      {error && <div className="border border-destructive/40 bg-destructive/10 text-destructive rounded-md px-3 py-2 text-[12px]">{error}</div>}

      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-4">
          {step === "form" ? (
            <form onSubmit={submit} className="rounded-md border border-border bg-card p-4 space-y-4">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold">
                <ShieldAlert className="h-4 w-4 text-usdt" /> 새 AS 신청
              </div>

              <div className="rounded-sm border border-usdt/35 bg-usdt/10 px-3 py-2 text-[11.5px] text-usdt space-y-1">
                <div className="font-semibold text-foreground">신청 전 꼭 확인해주세요.</div>
                <div>받은 코드/계정, 상품명, 사용기간, 로그인 오류 화면을 먼저 확인한 뒤 정확한 사유를 남겨주세요.</div>
                <div>내용이 불명확하면 처리가 늦어질 수 있습니다. 같은 주문의 기존 AS가 진행 중이면 추가 신청보다 상담창에 이어서 남겨주세요.</div>
              </div>

              <div>
                <div className="text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1.5">보장 대상 주문 선택</div>
                <div className="space-y-2">
                  {loading && orders.length === 0 ? (
                    <div className="px-3 py-4 text-[12px] text-muted-foreground border border-border rounded-sm">주문을 불러오는 중입니다.</div>
                  ) : orders.length === 0 ? (
                    <div className="px-3 py-4 text-[12px] text-muted-foreground border border-border rounded-sm">AS 신청 가능한 배송완료 주문이 없습니다.</div>
                  ) : orders.map((order) => (
                    <label
                      key={order.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 border rounded-sm cursor-pointer text-[12.5px] flex-wrap sm:flex-nowrap",
                        orderId === order.id ? "border-neon bg-neon/5" : "border-border hover:border-foreground/30"
                      )}
                    >
                      <input type="radio" checked={orderId === order.id} onChange={() => setOrderId(order.id)} className="accent-[hsl(var(--neon))]" />
                      <span className="font-mono text-muted-foreground w-36">{order.order_no}</span>
                      <span className="flex-1 text-foreground min-w-[180px]">{order.product?.title ?? "상품 정보 없음"}</span>
                      <span className="text-muted-foreground">{formatDate(order.created_at)}</span>
                      {order.status === "as_open" && <span className="font-mono px-1.5 py-0.5 border rounded-sm text-[10.5px] text-usdt border-usdt/40 bg-usdt/10">AS 진행중</span>}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1.5">증상</div>
                <select value={reason} onChange={(event) => setReason(event.target.value as AsIssueType)} className="h-9 w-full px-2 text-[12.5px] bg-background border border-border rounded-sm">
                  {REASONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>

              <div>
                <div className="text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1.5">상세 설명 · 스크린샷 URL</div>
                <Textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  placeholder="언제부터 / 어떤 화면에서 / 시도한 조치를 적어주세요. 스크린샷은 URL로 첨부 가능."
                  className="text-[12.5px] min-h-[120px]"
                />
              </div>

              <div className="rounded-sm border border-border bg-background/40 px-3 py-2 text-[11.5px] text-muted-foreground">
                선택 주문: <span className="font-mono text-foreground">{selectedOrder?.order_no ?? "없음"}</span> · 관리자가 확인 후 대체 계정 또는 환불 검토를 진행합니다.
              </div>

              <button disabled={saving || !orderId || orders.length === 0} className="w-full h-10 bg-neon text-[hsl(240_10%_4%)] text-[13px] font-semibold rounded-sm hover:brightness-110 disabled:opacity-60">
                {saving ? "접수 중" : "AS 접수하기"}
              </button>
            </form>
          ) : (
            <div className="rounded-md border border-neon/40 bg-neon/5 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-neon" />
                <div className="text-[14px] font-semibold">{ticketId} 접수 완료</div>
              </div>
              <div className="text-[12.5px] text-muted-foreground">관리자가 확인 후 대체 계정 또는 환불 검토를 진행합니다. 진행 상황은 최근 AS 내역에서 확인할 수 있습니다.</div>
              <button onClick={reset} className="h-9 px-3 text-[12px] border border-border rounded-sm hover:bg-muted">새 AS 신청</button>
            </div>
          )}

          <div className="rounded-md border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-background/40">
              <Clock className="h-3.5 w-3.5 text-cyan" />
              <span className="text-[12.5px] font-semibold">최근 AS 내역</span>
            </div>
            <div className="divide-y divide-border">
              {tickets.length === 0 ? (
                <div className="px-3 py-5 text-[12px] text-muted-foreground text-center">아직 AS 내역이 없습니다.</div>
              ) : tickets.map((ticket) => (
                <div key={ticket.id} className="px-3 py-2.5 flex items-center gap-3 text-[12.5px] flex-wrap sm:flex-nowrap">
                  <span className="font-mono text-muted-foreground w-28">AS-{ticket.id.slice(0, 8).toUpperCase()}</span>
                  <span className="font-mono text-muted-foreground w-36">{ticket.order?.order_no ?? "주문 없음"}</span>
                  <span className="flex-1 text-foreground truncate min-w-[160px]">{ticket.order?.product?.title ?? "상품 정보 없음"}</span>
                  <span className={cn("font-medium", statusClass[ticket.status])}>{statusLabel[ticket.status]}</span>
                  <span className="text-[11px] text-muted-foreground">{formatDate(ticket.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <SupportChat
            topic="AS 상담"
            orderId={orderId || selectedTicket?.order_id || null}
            asTicketId={selectedTicket?.id || null}
            height="h-[640px]"
          />
        </div>
      </div>
    </div>
  );
}
