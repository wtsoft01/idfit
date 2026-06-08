import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, PackageCheck, RefreshCw, LifeBuoy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatUsdt4 } from "@/lib/payment-amount";

type OrderStatus = "payment_pending" | "payment_confirmed" | "purchasing" | "delivered" | "as_open" | "failed" | "refunded_review";
type DeliveryType = "code" | "login" | "invite_link" | "manual";
type AsTicketStatus = "open" | "investigating" | "replacement_sent" | "rejected" | "closed";

type AdminOrder = {
  id: string;
  order_no: string;
  user_id: string;
  status: OrderStatus;
  sale_price_usdt: number;
  supplier_cost_usdt: number;
  margin_usdt: number;
  payment_network: string;
  payment_address: string | null;
  payment_tx_hash: string | null;
  payment_confirmed_at: string | null;
  admin_note: string | null;
  created_at: string;
  product: { title: string; service_name: string } | null;
  profile: { full_name: string; role: string } | null;
  delivery_items: { id: string; encrypted_payload: string; visible_to_customer: boolean; delivered_at: string | null }[];
  as_tickets: { id: string; status: AsTicketStatus; issue_type: string; customer_message: string; admin_note: string | null; created_at: string }[];
};

const statusLabel: Record<OrderStatus, string> = {
  payment_pending: "결제대기",
  payment_confirmed: "입금확인",
  purchasing: "구매진행",
  delivered: "배송완료",
  as_open: "AS 진행",
  failed: "실패",
  refunded_review: "환불검토",
};

const statusClass: Record<OrderStatus, string> = {
  payment_pending: "text-cyan border-cyan/40 bg-cyan/10",
  payment_confirmed: "text-usdt border-usdt/40 bg-usdt/10",
  purchasing: "text-usdt border-usdt/40 bg-usdt/10",
  delivered: "text-neon border-neon/40 bg-neon/10",
  as_open: "text-usdt border-usdt/40 bg-usdt/10",
  failed: "text-destructive border-destructive/40 bg-destructive/10",
  refunded_review: "text-destructive border-destructive/40 bg-destructive/10",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deliveryOrder, setDeliveryOrder] = useState<AdminOrder | null>(null);
  const [deliveryPayload, setDeliveryPayload] = useState("");
  const [saving, setSaving] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("orders")
      .select(`
        id,
        order_no,
        user_id,
        status,
        sale_price_usdt,
        supplier_cost_usdt,
        margin_usdt,
        payment_network,
        payment_address,
        payment_tx_hash,
        payment_confirmed_at,
        admin_note,
        created_at,
        product:products(title, service_name),
        delivery_items(id, encrypted_payload, visible_to_customer, delivered_at),
        as_tickets(id, status, issue_type, customer_message, admin_note, created_at)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryError) {
      setError(queryError.message);
    } else {
      const rows = (data ?? []) as unknown as AdminOrder[];
      const userIds = Array.from(new Set(rows.map((order) => order.user_id)));
      const { data: profiles } = userIds.length > 0
        ? await supabase
            .from("dealfinder_profiles")
            .select("user_id, full_name, role")
            .in("user_id", userIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
      setOrders(rows.map((order) => ({ ...order, profile: profileMap.get(order.user_id) ?? null })));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const stats = useMemo(() => {
    const pending = orders.filter((order) => order.status === "payment_pending").length;
    const delivered = orders.filter((order) => order.status === "delivered").length;
    const activeAs = orders.filter((order) => order.status === "as_open" || order.as_tickets?.some((ticket) => !["closed", "rejected"].includes(ticket.status))).length;
    const margin = orders.reduce((sum, order) => sum + Number(order.margin_usdt ?? 0), 0);
    return { pending, delivered, activeAs, margin };
  }, [orders]);

  const confirmPayment = async (order: AdminOrder) => {
    const ok = window.confirm(`${order.order_no}\n${formatUsdt4(order.sale_price_usdt)} USDT 입금액이 확인되었나요?`);
    if (!ok) return;

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "payment_confirmed",
        payment_tx_hash: `amount-match:${formatUsdt4(order.sale_price_usdt)}`,
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    toast.success(`${order.order_no} 입금 확인 처리 완료`);
    await loadOrders();
  };

  const updateAsTicket = async (order: AdminOrder, status: AsTicketStatus) => {
    const ticket = order.as_tickets?.find((item) => !["closed", "rejected"].includes(item.status)) ?? order.as_tickets?.[0];
    if (!ticket) return;

    const note = window.prompt("관리자 처리 메모를 입력하세요.", ticket.admin_note ?? "");
    if (note === null) return;

    const { error: ticketError } = await supabase
      .from("as_tickets")
      .update({ status, admin_note: note.trim() || null })
      .eq("id", ticket.id);

    if (ticketError) {
      toast.error(ticketError.message);
      return;
    }

    const nextOrderStatus: OrderStatus = status === "closed" || status === "replacement_sent" ? "delivered" : status === "rejected" ? "failed" : "as_open";
    const { error: orderError } = await supabase
      .from("orders")
      .update({ status: nextOrderStatus, admin_note: note.trim() || `AS ${status}` })
      .eq("id", order.id);

    if (orderError) {
      toast.error(orderError.message);
      return;
    }

    toast.success(`${order.order_no} AS 상태 업데이트 완료`);
    await loadOrders();
  };

  const openDelivery = (order: AdminOrder) => {
    setDeliveryOrder(order);
    setDeliveryPayload(order.delivery_items?.find((item) => item.visible_to_customer)?.encrypted_payload ?? "");
  };

  const saveDelivery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deliveryOrder) return;
    if (!deliveryPayload.trim()) {
      toast.error("고객에게 전달할 계정/코드/안내를 입력하세요.");
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from("delivery_items").insert({
      order_id: deliveryOrder.id,
      delivery_type: "manual" as DeliveryType,
      encrypted_payload: deliveryPayload.trim(),
      visible_to_customer: true,
      delivered_at: new Date().toISOString(),
    });

    if (insertError) {
      toast.error(insertError.message);
      setSaving(false);
      return;
    }

    const { error: orderError } = await supabase
      .from("orders")
      .update({ status: "delivered", admin_note: "관리자 수동 배송 완료" })
      .eq("id", deliveryOrder.id);

    setSaving(false);
    if (orderError) {
      toast.error(orderError.message);
      return;
    }

    toast.success(`${deliveryOrder.order_no} 배송 완료 처리`);
    setDeliveryOrder(null);
    setDeliveryPayload("");
    await loadOrders();
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">주문 관리</h1>
          <p className="text-[12.5px] text-muted-foreground">주문별 고유 USDT 입금액을 기준으로 자동확인하고 배송을 수동 처리합니다.</p>
        </div>
        <button onClick={loadOrders} disabled={loading} className="h-9 px-3 border border-border text-[12px] rounded-sm inline-flex items-center gap-1.5 disabled:opacity-60">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> 새로고침
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="입금 대기" value={stats.pending.toString()} />
        <Stat label="배송 완료" value={stats.delivered.toString()} />
        <Stat label="AS 대기" value={stats.activeAs.toString()} />
        <Stat label="누적 마진" value={`${formatUsdt4(stats.margin)} USDT`} />
      </div>

      {error && <div className="border border-destructive/40 bg-destructive/10 text-destructive rounded-md px-3 py-2 text-[12px]">{error}</div>}

      <div className="border border-border rounded-md overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1fr_1fr_1.7fr_0.8fr_0.8fr_0.8fr_1fr_auto] px-3 h-9 items-center bg-card text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span>주문ID</span><span>구매자</span><span>상품</span><span>매입가</span><span>판매가</span><span>마진</span><span>상태</span><span></span>
        </div>
        {loading && orders.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">주문을 불러오는 중입니다.</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">아직 주문이 없습니다.</div>
        ) : (
          orders.map((order) => {
            const marginPct = order.supplier_cost_usdt > 0 ? ((order.margin_usdt / order.supplier_cost_usdt) * 100).toFixed(1) : "0.0";
            const activeTicket = order.as_tickets?.find((ticket) => !["closed", "rejected"].includes(ticket.status)) ?? null;
            return (
              <div key={order.id} className="grid lg:grid-cols-[1fr_1fr_1.7fr_0.8fr_0.8fr_0.8fr_1fr_auto] gap-2 px-3 py-3 lg:py-0 lg:h-14 lg:items-center text-[12px] border-b border-border last:border-0 hover:bg-muted/30">
                <div>
                  <div className="font-mono text-muted-foreground">{order.order_no}</div>
                  <div className="text-[10.5px] text-muted-foreground">{formatDate(order.created_at)}</div>
                </div>
                <span className="font-mono text-foreground truncate">{order.profile?.full_name || order.user_id.slice(0, 8)}</span>
                <span className="line-clamp-2">{order.product?.title ?? "상품 정보 없음"}</span>
                <span className="font-mono text-muted-foreground">{Number(order.supplier_cost_usdt).toFixed(2)}</span>
                <span className="font-mono text-usdt">{formatUsdt4(order.sale_price_usdt)}</span>
                <span className="font-mono text-neon">+{formatUsdt4(order.margin_usdt)} <span className="text-muted-foreground">({marginPct}%)</span></span>
                <span className={cn("w-fit px-1.5 py-0.5 border rounded-sm text-[11px] font-medium", statusClass[order.status])}>{statusLabel[order.status]}</span>
                <div className="flex flex-wrap gap-1.5 justify-start lg:justify-end">
                  {activeTicket && (
                    <div className="basis-full text-[10.5px] text-usdt flex items-start gap-1.5 lg:justify-end">
                      <LifeBuoy className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">AS-{activeTicket.id.slice(0, 8).toUpperCase()} · {activeTicket.issue_type}</span>
                    </div>
                  )}
                  {activeTicket && (
                    <>
                      <button onClick={() => updateAsTicket(order, "investigating")} className="h-7 px-2.5 text-[11.5px] border border-usdt/50 text-usdt rounded-sm hover:bg-usdt/10">확인중</button>
                      <button onClick={() => updateAsTicket(order, "replacement_sent")} className="h-7 px-2.5 text-[11.5px] border border-neon/50 text-neon rounded-sm hover:bg-neon/10">대체완료</button>
                      <button onClick={() => updateAsTicket(order, "closed")} className="h-7 px-2.5 text-[11.5px] border border-border rounded-sm hover:bg-muted">종료</button>
                    </>
                  )}
                  {order.status === "payment_pending" && (
                    <button onClick={() => confirmPayment(order)} className="h-7 px-2.5 text-[11.5px] border border-usdt/50 text-usdt rounded-sm hover:bg-usdt/10 inline-flex items-center gap-1" title={`${formatUsdt4(order.sale_price_usdt)} USDT 입금 매칭`}>
                      <CheckCircle2 className="h-3 w-3" /> 자동확인
                    </button>
                  )}
                  {order.status !== "delivered" && order.status !== "payment_pending" && (
                    <button onClick={() => openDelivery(order)} className="h-7 px-2.5 text-[11.5px] border border-neon/50 text-neon rounded-sm hover:bg-neon/10 inline-flex items-center gap-1">
                      <PackageCheck className="h-3 w-3" /> 배송입력
                    </button>
                  )}
                  {order.status === "delivered" && <span className="text-[11px] text-neon">전달 완료</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {deliveryOrder && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={saveDelivery} className="w-full max-w-lg border border-border bg-card rounded-md p-4 space-y-3 shadow-xl">
            <div>
              <h2 className="font-display font-bold text-lg">배송 정보 입력</h2>
              <p className="text-[12px] text-muted-foreground mt-1">{deliveryOrder.order_no} · 고객에게 그대로 표시됩니다.</p>
            </div>
            <textarea
              value={deliveryPayload}
              onChange={(event) => setDeliveryPayload(event.target.value)}
              placeholder="예: ID: example@mail.com\nPW: temporary-pass\n주의: 최초 로그인 후 비밀번호 변경"
              className="w-full min-h-40 rounded-sm border border-border bg-background px-3 py-2 text-[12.5px] font-mono outline-none focus:border-neon"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeliveryOrder(null)} className="h-9 px-3 border border-border rounded-sm text-[12px] hover:bg-muted">취소</button>
              <button type="submit" disabled={saving} className="h-9 px-3 bg-neon text-[hsl(240_10%_4%)] rounded-sm text-[12px] font-semibold disabled:opacity-60">
                {saving ? "저장중" : "배송 완료"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card rounded-md p-3">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono">{label}</div>
      <div className="font-display text-xl font-semibold mt-0.5">{value}</div>
    </div>
  );
}
