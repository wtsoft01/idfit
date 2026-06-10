import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink, LifeBuoy, RefreshCw, Save, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatUsdt4 } from "@/lib/payment-amount";
import { purchaseTargetForProduct } from "@/lib/purchase-target";
import { toast } from "sonner";

type OrderStatus = "payment_pending" | "payment_confirmed" | "purchasing" | "delivered" | "as_open" | "failed" | "refunded_review";
type AsTicketStatus = "open" | "investigating" | "replacement_sent" | "rejected" | "closed";
type StatusFilter = "all" | "paid" | "as" | OrderStatus;

type RevenueOrder = {
  id: string;
  order_no: string;
  user_id: string;
  status: OrderStatus;
  sale_price_usdt: number;
  supplier_cost_usdt: number;
  margin_usdt: number;
  payment_confirmed_at: string | null;
  payment_tx_hash: string | null;
  admin_note: string | null;
  created_at: string;
  product: {
    title: string;
    service_name: string;
    metadata: Record<string, unknown> | null;
    source: { source_type: string; telegram_identifier: string; metadata: Record<string, unknown> | null } | null;
    candidate: { metadata: Record<string, unknown> | null; raw_message: { original_url: string | null; telegram_message_id: string | null; metadata: Record<string, unknown> | null } | null } | null;
  } | null;
  profile: { full_name: string; role: string } | null;
  as_tickets: { id: string; status: AsTicketStatus; issue_type: string; customer_message: string; admin_note: string | null; created_at: string }[];
};

const paidStatuses: OrderStatus[] = ["payment_confirmed", "purchasing", "delivered", "as_open"];
const activeAsStatuses: AsTicketStatus[] = ["open", "investigating", "replacement_sent"];

const statusLabel: Record<OrderStatus, string> = {
  payment_pending: "결제대기",
  payment_confirmed: "입금확인",
  purchasing: "구매진행",
  delivered: "배송완료",
  as_open: "AS 진행",
  failed: "실패",
  refunded_review: "환불검토",
};

const ticketLabel: Record<AsTicketStatus, string> = {
  open: "접수",
  investigating: "확인중",
  replacement_sent: "재전달",
  rejected: "거절",
  closed: "종료",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function activeTicket(order: RevenueOrder) {
  return order.as_tickets?.find((ticket) => activeAsStatuses.includes(ticket.status)) ?? order.as_tickets?.[0] ?? null;
}

export default function AdminRevenue() {
  const [orders, setOrders] = useState<RevenueOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("paid");
  const [selectedOrder, setSelectedOrder] = useState<RevenueOrder | null>(null);
  const [resultNote, setResultNote] = useState("");
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
        payment_confirmed_at,
        payment_tx_hash,
        admin_note,
        created_at,
        product:products(
          title,
          service_name,
          metadata,
          source:telegram_sources(source_type, telegram_identifier, metadata),
          candidate:product_candidates(metadata, raw_message:raw_messages(original_url, telegram_message_id, metadata))
        ),
        as_tickets(id, status, issue_type, customer_message, admin_note, created_at)
      `)
      .in("status", paidStatuses)
      .order("payment_confirmed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(300);

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as RevenueOrder[];
    const userIds = Array.from(new Set(rows.map((order) => order.user_id)));
    const { data: profiles } = userIds.length
      ? await supabase.from("idfit_profiles").select("user_id, full_name, role").in("user_id", userIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
    setOrders(rows.map((order) => ({ ...order, profile: profileMap.get(order.user_id) ?? null })));
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const stats = useMemo(() => {
    const gmv = orders.reduce((sum, order) => sum + Number(order.sale_price_usdt ?? 0), 0);
    const cost = orders.reduce((sum, order) => sum + Number(order.supplier_cost_usdt ?? 0), 0);
    const margin = orders.reduce((sum, order) => sum + Number(order.margin_usdt ?? 0), 0);
    const activeAs = orders.filter((order) => activeTicket(order) && activeAsStatuses.includes(activeTicket(order)!.status)).length;
    return { gmv, cost, margin, activeAs };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return orders.filter((order) => {
      const ticket = activeTicket(order);
      if (statusFilter === "as" && !ticket) return false;
      if (statusFilter === "paid" && !paidStatuses.includes(order.status)) return false;
      if (statusFilter !== "all" && statusFilter !== "paid" && statusFilter !== "as" && order.status !== statusFilter) return false;
      if (!keyword) return true;
      return [
        order.order_no,
        order.profile?.full_name,
        order.user_id,
        order.product?.title,
        order.product?.service_name,
        order.payment_tx_hash,
        ticket?.issue_type,
        ticket?.customer_message,
        statusLabel[order.status],
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [orders, query, statusFilter]);

  const openAs = (order: RevenueOrder) => {
    setSelectedOrder(order);
    setResultNote(activeTicket(order)?.admin_note ?? order.admin_note ?? "");
  };

  const openPurchaseSource = async (order: RevenueOrder) => {
    const target = purchaseTargetForProduct(order.product);
    if (!target) {
      toast.error("원 수집소스 연결 정보가 없습니다.");
      return;
    }
    const { data: existingJob } = await supabase.from("supplier_purchase_jobs").select("id").eq("order_id", order.id).maybeSingle();
    if (!existingJob) {
      await supabase.from("supplier_purchase_jobs").insert({
        order_id: order.id,
        status: "queued",
        expected_cost_usdt: order.supplier_cost_usdt,
        max_allowed_cost_usdt: order.supplier_cost_usdt,
        conversation_log: [{ type: "as_reorder_link_opened", url: target.url, at: new Date().toISOString() }],
      }).then(({ error: jobError }) => {
        if (jobError) toast.error(jobError.message);
      });
    }
    window.open(target.url, "_blank", "noopener,noreferrer");
  };

  const saveAsResult = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrder) return;
    const ticket = activeTicket(selectedOrder);
    if (!ticket) return;
    setSaving(true);
    const note = resultNote.trim() || null;
    const { error: ticketError } = await supabase.from("as_tickets").update({ status: "investigating", admin_note: note }).eq("id", ticket.id);
    const { error: orderError } = await supabase.from("orders").update({ status: "as_open", admin_note: note }).eq("id", selectedOrder.id);
    setSaving(false);
    if (ticketError || orderError) {
      toast.error(ticketError?.message ?? orderError?.message ?? "처리결과 저장 실패");
      return;
    }
    toast.success("AS 처리결과를 기록했습니다.");
    setSelectedOrder(null);
    await loadOrders();
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold">매출관리/AS</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1">결제 완료된 실제 주문을 기준으로 매출, 구매자, 상품, AS 접수내역을 관리합니다.</p>
        </div>
        <button onClick={loadOrders} disabled={loading} className="h-9 px-3 border border-border rounded-sm text-[12.5px] inline-flex items-center gap-1 disabled:opacity-50">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> 새로고침
        </button>
      </div>

      <div className="grid lg:grid-cols-4 gap-3">
        <Stat label="결제완료 매출" value={`${formatUsdt4(stats.gmv)} USDT`} />
        <Stat label="매입 원가" value={`${formatUsdt4(stats.cost)} USDT`} />
        <Stat label="확정 마진" value={`${formatUsdt4(stats.margin)} USDT`} accent />
        <Stat label="AS 접수" value={`${stats.activeAs}건`} />
      </div>

      <section className="border border-border rounded-md bg-card p-3 grid gap-2 lg:grid-cols-[1fr_180px_auto] items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="주문번호, 구매자, 상품, AS 내용 검색" className="w-full h-9 pl-9 pr-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon" />
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-9 px-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon">
          <option value="paid">결제완료 전체</option>
          <option value="as">AS 접수건</option>
          <option value="payment_confirmed">입금확인</option>
          <option value="purchasing">구매진행</option>
          <option value="delivered">배송완료</option>
          <option value="as_open">AS 진행</option>
          <option value="all">전체</option>
        </select>
        <div className="text-[12px] text-muted-foreground whitespace-nowrap">표시 {visibleOrders.length}개 / 전체 {orders.length}개</div>
      </section>

      {error && <div className="border border-destructive/40 bg-destructive/10 text-destructive rounded-md p-3 text-[12px]">{error}</div>}

      <div className="border border-border rounded-md overflow-hidden bg-background">
        <div className="hidden lg:grid grid-cols-[1fr_1.2fr_1.7fr_0.75fr_0.75fr_0.75fr_1fr_0.9fr_auto] px-3 h-9 items-center bg-card text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span>주문/날짜</span><span>구매자정보</span><span>상품정보</span><span>판매가</span><span>원가</span><span>마진</span><span>결제정보</span><span>상태</span><span></span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">매출 데이터를 불러오는 중입니다...</div>
        ) : visibleOrders.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">조건에 맞는 결제완료 주문이 없습니다.</div>
        ) : visibleOrders.map((order) => {
          const ticket = activeTicket(order);
          return (
            <div key={order.id} className={cn("grid lg:grid-cols-[1fr_1.2fr_1.7fr_0.75fr_0.75fr_0.75fr_1fr_0.9fr_auto] gap-2 px-3 py-3 lg:min-h-14 lg:items-center text-[12px] border-b border-border last:border-0", ticket && "bg-usdt/5")}>
              <div className="min-w-0"><div className="font-mono text-neon truncate">{order.order_no}</div><div className="text-[10.5px] text-muted-foreground">{formatDate(order.payment_confirmed_at ?? order.created_at)}</div></div>
              <div className="min-w-0"><div className="font-medium truncate">{order.profile?.full_name || "이름 미등록"}</div><div className="font-mono text-[10.5px] text-muted-foreground truncate">{order.user_id.slice(0, 8)} · {order.profile?.role ?? "member"}</div></div>
              <div className="min-w-0"><div className="font-medium truncate">{order.product?.title ?? "상품 정보 없음"}</div><div className="text-[10.5px] text-muted-foreground truncate">{order.product?.service_name ?? "-"}</div></div>
              <span className="font-mono">{formatUsdt4(order.sale_price_usdt)}</span>
              <span className="font-mono text-muted-foreground">{formatUsdt4(order.supplier_cost_usdt)}</span>
              <span className="font-mono text-neon">{formatUsdt4(order.margin_usdt)}</span>
              <div className="min-w-0"><div className="font-mono truncate">{order.payment_tx_hash ?? "-"}</div><div className="text-[10.5px] text-muted-foreground">{formatDate(order.payment_confirmed_at)}</div></div>
              <div className="space-y-1"><span className="inline-flex px-2 py-1 rounded-sm border border-border text-[11px]">{statusLabel[order.status]}</span>{ticket && <div className="text-[10.5px] text-usdt">AS-{ticket.id.slice(0, 8).toUpperCase()}</div>}</div>
              <div className="flex justify-end gap-1.5 flex-wrap">
                {ticket && <button onClick={() => openAs(order)} className="h-7 px-2.5 text-[11.5px] border border-usdt/50 text-usdt rounded-sm hover:bg-usdt/10 inline-flex items-center gap-1"><LifeBuoy className="h-3 w-3" /> AS접수내역</button>}
              </div>
            </div>
          );
        })}
      </div>

      {selectedOrder && (() => {
        const ticket = activeTicket(selectedOrder);
        const target = purchaseTargetForProduct(selectedOrder.product);
        return (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl border border-border bg-background rounded-md shadow-xl">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
                <div><div className="font-semibold">AS 접수내역</div><div className="text-[11.5px] text-muted-foreground">{selectedOrder.order_no} · {selectedOrder.product?.title}</div></div>
                <button onClick={() => setSelectedOrder(null)} className="text-[12px] text-muted-foreground hover:text-foreground">닫기</button>
              </div>
              <form onSubmit={saveAsResult} className="p-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-3 text-[12.5px]">
                  <Info label="구매자" value={`${selectedOrder.profile?.full_name || "이름 미등록"} / ${selectedOrder.user_id.slice(0, 8)}`} />
                  <Info label="상품" value={`${selectedOrder.product?.service_name ?? "-"} · ${selectedOrder.product?.title ?? "-"}`} />
                  <Info label="접수상태" value={ticket ? ticketLabel[ticket.status] : "-"} />
                  <Info label="접수일" value={formatDate(ticket?.created_at ?? null)} />
                </div>
                <div className="border border-border rounded-sm p-3 bg-card text-[12.5px]">
                  <div className="text-[11px] text-muted-foreground mb-1">접수 내용</div>
                  <div className="whitespace-pre-wrap">{ticket?.customer_message ?? "AS 접수 내용이 없습니다."}</div>
                </div>
                <textarea value={resultNote} onChange={(event) => setResultNote(event.target.value)} rows={5} placeholder="처리결과, 재주문/재전달 내역, 환불 검토 사유 등을 기록하세요." className="w-full bg-background border border-border rounded-sm p-3 text-[12.5px] outline-none focus:border-neon" />
                <div className="flex justify-between gap-2 flex-wrap">
                  <button type="button" onClick={() => openPurchaseSource(selectedOrder)} disabled={!target} className="h-9 px-3 border border-neon/50 text-neon rounded-sm text-[12px] inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"><ExternalLink className="h-3.5 w-3.5" /> 원 수집소스로 재주문</button>
                  <button type="submit" disabled={saving} className="h-9 px-3 bg-neon text-[hsl(240_10%_4%)] rounded-sm text-[12px] font-semibold inline-flex items-center gap-1 disabled:opacity-50"><Save className="h-3.5 w-3.5" /> {saving ? "저장 중" : "처리결과 저장"}</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="border border-border rounded-md p-4 bg-card"><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono">{label}</div><div className={"font-display text-2xl font-semibold mt-1 " + (accent ? "text-neon" : "")}>{value}</div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="border border-border rounded-sm p-3 bg-card"><div className="text-[11px] text-muted-foreground mb-1">{label}</div><div className="text-[12.5px] font-medium break-words">{value}</div></div>;
}
