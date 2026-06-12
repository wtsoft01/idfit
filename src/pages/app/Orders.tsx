import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock3, Copy, LifeBuoy, PackageCheck, RefreshCw, ShieldAlert, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatUsdt4 } from "@/lib/payment-amount";

const ORDER_STATUSES = ["payment_pending", "payment_confirmed", "purchasing", "delivered", "as_open", "failed", "refunded_review"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

type DeliveryItem = {
  encrypted_payload: string;
  visible_to_customer: boolean;
  delivered_at: string | null;
};

type AsTicket = {
  id: string;
  status: string;
  issue_type: string;
  customer_message: string | null;
  admin_note: string | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  order_no: string;
  status: OrderStatus;
  sale_price_usdt: number;
  payment_network: string;
  payment_address: string | null;
  payment_tx_hash: string | null;
  payment_confirmed_at: string | null;
  customer_note: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  product: { title: string; service_name: string } | null;
  delivery_items: DeliveryItem[];
  as_tickets: AsTicket[];
};

const statusMeta: Record<OrderStatus, { label: string; tone: string; desc: string }> = {
  payment_pending: { label: "미입금", tone: "text-cyan border-cyan/40 bg-cyan/10", desc: "주문번호가 생성되었습니다. 지정 금액을 정확히 입금하면 자동 또는 수동체크로 확인됩니다." },
  payment_confirmed: { label: "입금완료", tone: "text-usdt border-usdt/40 bg-usdt/10", desc: "입금이 확인되었습니다. 관리자가 상품 전달을 준비하고 있습니다." },
  purchasing: { label: "구매 진행", tone: "text-usdt border-usdt/40 bg-usdt/10", desc: "상품 구매 및 코드 전달을 준비 중입니다." },
  delivered: { label: "전달 완료", tone: "text-neon border-neon/40 bg-neon/10", desc: "받은 코드를 확인할 수 있습니다." },
  as_open: { label: "AS 진행", tone: "text-usdt border-usdt/40 bg-usdt/10", desc: "AS 요청을 처리 중입니다." },
  failed: { label: "처리 실패", tone: "text-destructive border-destructive/40 bg-destructive/10", desc: "관리자 확인이 필요한 주문입니다." },
  refunded_review: { label: "환불 검토", tone: "text-destructive border-destructive/40 bg-destructive/10", desc: "환불 가능 여부를 검토 중입니다." },
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function statusIcon(status: OrderStatus) {
  if (status === "delivered") return <PackageCheck className="h-4 w-4" />;
  if (status === "failed" || status === "refunded_review") return <ShieldAlert className="h-4 w-4" />;
  if (status === "payment_pending") return <WalletCards className="h-4 w-4" />;
  return <Clock3 className="h-4 w-4" />;
}

function normalizeStatus(value: unknown): OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus) ? (value as OrderStatus) : "payment_pending";
}

export default function UserOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null);

  const loadOrders = async () => {
    if (!user) return;
    if (!isSupabaseConfigured) {
      setError("Supabase 연결 전입니다. 주문 데이터를 불러올 수 없습니다.");
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("orders")
      .select(`
        id,
        order_no,
        status,
        sale_price_usdt,
        payment_network,
        payment_address,
        payment_tx_hash,
        payment_confirmed_at,
        customer_note,
        admin_note,
        created_at,
        updated_at,
        product:products(title, service_name),
        delivery_items(encrypted_payload, visible_to_customer, delivered_at),
        as_tickets(id, status, issue_type, customer_message, admin_note, created_at)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryError) {
      setError(queryError.message);
      setOrders([]);
    } else {
      setOrders(((data ?? []) as unknown as OrderRow[]).map((order) => ({ ...order, status: normalizeStatus(order.status) })));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(loadOrders, 7000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  const confirmPayment = async (orderId: string) => {
    if (!user) return;
    setCheckingOrderId(orderId);
    setError(null);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError("로그인 세션을 확인하지 못했습니다.");
      setCheckingOrderId(null);
      return;
    }

    try {
      const response = await fetch("/api/orders/confirm-payment", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ orderId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "입금확인 요청에 실패했습니다.");
      await loadOrders();
      if (result?.alreadyProcessed) toast.success("이미 입금 처리된 주문입니다. 내 주문에서 진행 상태를 확인해주세요.");
      else if (result?.matched) toast.success("입금완료! 관리자가 상품 전달을 준비하고 있습니다.");
      else setError("아직 입금 내역을 찾지 못했습니다. 네트워크, 주소, 정확한 고유 입금액을 확인한 뒤 다시 체크해주세요.");
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "입금확인 요청에 실패했습니다.");
    } finally {
      setCheckingOrderId(null);
    }
  };

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} 복사 완료`);
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden p-3 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap min-w-0">
        <div className="min-w-0">
          <h1 className="font-display text-2xl md:text-3xl font-bold">내 주문</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1">입금 상태, 주문 상태, 받은 코드, AS 신청을 주문별로 확인합니다.</p>
        </div>
        <button onClick={loadOrders} disabled={loading} className="h-9 px-3 inline-flex items-center gap-1.5 border border-border text-[12px] rounded-sm disabled:opacity-60 hover:bg-muted">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> 새로고침
        </button>
      </div>

      {error && <div className="border border-destructive/40 bg-destructive/10 text-destructive rounded-md px-3 py-2 text-[12px] break-words">{error}</div>}

      <div className="space-y-3 min-w-0">
        {loading && orders.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-10 text-center text-[12px] text-muted-foreground">주문을 불러오는 중입니다.</div>
        ) : orders.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-10 text-center text-[12px] text-muted-foreground space-y-3">
            <div>아직 주문이 없습니다.</div>
            <Link to="/app/board" className="inline-flex h-9 items-center rounded-sm bg-neon px-3 text-[12px] font-semibold text-[hsl(240_10%_4%)] hover:brightness-110">상품 보러가기</Link>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-card overflow-hidden min-w-0">
            <div className="hidden lg:grid grid-cols-[64px_118px_minmax(220px,1fr)_150px_130px_180px] gap-3 border-b border-border bg-background/45 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
              <div className="text-center">연번</div>
              <div>구매날짜</div>
              <div>상품</div>
              <div>상태</div>
              <div>입금액</div>
              <div>관리</div>
            </div>
            <div className="divide-y divide-border">
              {orders.map((order, index) => (
                <OrderListItem
                  key={order.id}
                  order={order}
                  sequence={orders.length - index}
                  checking={checkingOrderId === order.id}
                  onConfirm={() => confirmPayment(order.id)}
                  onCopy={copyText}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderListItem({ order, sequence, checking, onConfirm, onCopy }: { order: OrderRow; sequence: number; checking: boolean; onConfirm: () => void; onCopy: (value: string, label: string) => void }) {
  const meta = statusMeta[order.status];
  const delivery = order.delivery_items?.find((item) => item.visible_to_customer) ?? null;
  const activeTicket = order.as_tickets?.find((ticket) => !["closed", "rejected"].includes(ticket.status)) ?? null;
  const canRequestAs = order.status === "delivered" || order.status === "as_open";

  return (
    <div className="grid gap-3 px-3 py-3 text-[12px] lg:grid-cols-[64px_118px_minmax(220px,1fr)_150px_130px_180px] lg:items-start hover:bg-muted/25">
      <div className="flex items-center justify-between gap-2 lg:block lg:text-center">
        <span className="lg:hidden text-muted-foreground">연번</span>
        <span className="font-mono text-[13px] font-semibold text-foreground">#{sequence}</span>
      </div>

      <div className="space-y-1 min-w-0">
        <div className="lg:hidden text-[10.5px] text-muted-foreground">구매날짜</div>
        <div className="font-mono text-foreground">{formatDate(order.created_at)}</div>
        <div className="font-mono text-[10.5px] text-muted-foreground truncate" title={order.order_no}>{order.order_no}</div>
      </div>

      <div className="space-y-2 min-w-0">
        <div className="text-[13px] font-semibold text-foreground break-words" title={order.product?.title ?? "상품 정보 없음"}>{order.product?.title ?? "상품 정보 없음"}</div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>{order.product?.service_name ?? "서비스 미분류"}</span>
          {order.payment_confirmed_at && <span className="text-usdt">입금확인 {formatDate(order.payment_confirmed_at)}</span>}
          {activeTicket && <span className="text-usdt">AS {activeTicket.issue_type}</span>}
        </div>
        {delivery ? (
          <div className="rounded-sm border border-neon/35 bg-neon/10 p-2 min-w-0">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-neon">받은 코드 / 계정</span>
              <button onClick={() => onCopy(delivery.encrypted_payload, "받은 코드")} className="h-6 px-2 inline-flex items-center gap-1 rounded-sm border border-neon/40 text-[10.5px] text-neon hover:bg-neon/10 shrink-0"><Copy className="h-3 w-3" /> 복사</button>
            </div>
            <pre className="max-h-20 overflow-auto whitespace-pre-wrap break-words font-mono text-[11.5px] text-foreground leading-relaxed">{delivery.encrypted_payload}</pre>
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">전달된 코드 없음</div>
        )}
      </div>

      <div className="space-y-1">
        <div className="lg:hidden text-[10.5px] text-muted-foreground">상태</div>
        <span className={cn("inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[11px] font-semibold", meta.tone)}>{statusIcon(order.status)} {meta.label}</span>
        <div className="text-[11px] text-muted-foreground leading-relaxed">{meta.desc}</div>
        {order.admin_note && <div className="text-[11px] text-muted-foreground break-words">관리자 메모: {order.admin_note}</div>}
      </div>

      <div className="space-y-1 min-w-0">
        <div className="lg:hidden text-[10.5px] text-muted-foreground">입금정보</div>
        <div className="font-mono text-[13px] font-bold text-usdt">{formatUsdt4(order.sale_price_usdt)} USDT</div>
        <div className="font-mono text-[11px] text-muted-foreground">{order.payment_network || "-"}</div>
        {order.payment_address && <button onClick={() => onCopy(order.payment_address!, "입금주소")} className="max-w-full truncate text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">주소 복사</button>}
        {order.payment_tx_hash && <div className="font-mono text-[10.5px] text-muted-foreground truncate" title={order.payment_tx_hash}>확인값 {order.payment_tx_hash}</div>}
      </div>

      <div className="flex flex-col gap-2">
        {order.status === "payment_pending" && (
          <button type="button" onClick={onConfirm} disabled={checking} className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-sm border border-usdt/50 text-usdt hover:bg-usdt/10 disabled:opacity-60">
            <RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} /> 입금 확인
          </button>
        )}
        {canRequestAs ? (
          <Link to={`/app/as?order=${order.id}`} className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-sm bg-usdt text-[hsl(240_10%_4%)] text-[12px] font-semibold hover:brightness-110">
            <LifeBuoy className="h-3.5 w-3.5" /> AS 신청
          </Link>
        ) : (
          <div className="rounded-sm border border-border bg-background/35 px-2 py-2 text-[11px] text-muted-foreground text-center">AS는 코드 전달 후 가능</div>
        )}
        {order.customer_note && <div className="text-[10.5px] text-muted-foreground break-words">안내: {order.customer_note}</div>}
      </div>
    </div>
  );
}
