import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock3, Copy, LifeBuoy, PackageCheck, RefreshCw, ShieldAlert, WalletCards } from "lucide-react";
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
  payment_pending: { label: "입금 대기", tone: "text-cyan border-cyan/40 bg-cyan/10", desc: "입금 후 자동확인을 기다립니다." },
  payment_confirmed: { label: "입금 확인", tone: "text-usdt border-usdt/40 bg-usdt/10", desc: "입금 확인 완료, 구매 진행 대기 중입니다." },
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
      if (result?.alreadyProcessed) toast.success("이미 처리된 주문입니다.");
      else if (result?.matched) toast.success("입금이 확인되었습니다.");
      else setError("아직 일치하는 입금 내역이 없습니다. 정확한 고유 입금액 전송 후 다시 확인해주세요.");
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
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              checking={checkingOrderId === order.id}
              onConfirm={() => confirmPayment(order.id)}
              onCopy={copyText}
            />
          ))
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, checking, onConfirm, onCopy }: { order: OrderRow; checking: boolean; onConfirm: () => void; onCopy: (value: string, label: string) => void }) {
  const meta = statusMeta[order.status];
  const delivery = order.delivery_items?.find((item) => item.visible_to_customer) ?? null;
  const activeTicket = order.as_tickets?.find((ticket) => !["closed", "rejected"].includes(ticket.status)) ?? null;
  const canRequestAs = order.status === "delivered" || order.status === "as_open";

  return (
    <div className="rounded-md border border-border bg-card/70 overflow-hidden min-w-0 max-w-full">
      <div className="p-3 border-b border-border bg-background/30 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="font-mono text-[11.5px] text-muted-foreground truncate">{order.order_no}</span>
          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium", meta.tone)}>
            {statusIcon(order.status)} {meta.label}
          </span>
        </div>
        <div className="text-[15px] font-semibold text-foreground truncate" title={order.product?.title ?? "상품 정보 없음"}>{order.product?.title ?? "상품 정보 없음"}</div>
        <div className="text-[11px] text-muted-foreground truncate">{order.product?.service_name ?? "서비스 미분류"} · {formatDate(order.created_at)}</div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-3 p-3 min-w-0">
        <div className="space-y-3 min-w-0">
          <section className="rounded-sm border border-border bg-background/35 p-3 space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[12px] font-semibold text-foreground">주문 상태</div>
              <div className="font-mono text-[12px] text-usdt shrink-0">{formatUsdt4(order.sale_price_usdt)} USDT</div>
            </div>
            <div className="text-[12px] text-muted-foreground">{meta.desc}</div>
            {order.payment_confirmed_at && <div className="text-[11.5px] text-usdt">입금 확인: {formatDate(order.payment_confirmed_at)}</div>}
            {order.payment_tx_hash && <div className="font-mono text-[11px] text-muted-foreground truncate">확인값: {order.payment_tx_hash}</div>}
            {activeTicket && <div className="text-[11.5px] text-usdt">AS 진행중: {activeTicket.issue_type} · {formatDate(activeTicket.created_at)}</div>}
            {order.admin_note && <div className="text-[11.5px] text-muted-foreground break-words">관리자 메모: {order.admin_note}</div>}
          </section>

          <section className={cn("rounded-sm border p-3 min-w-0", delivery ? "border-neon/40 bg-neon/10" : "border-border bg-background/35")}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className={cn("text-[12px] font-semibold", delivery ? "text-neon" : "text-foreground")}>받은 코드 / 계정</div>
              {delivery && (
                <button onClick={() => onCopy(delivery.encrypted_payload, "받은 코드")} className="h-7 px-2 inline-flex items-center gap-1 rounded-sm border border-neon/40 text-[11px] text-neon hover:bg-neon/10 shrink-0">
                  <Copy className="h-3 w-3" /> 복사
                </button>
              )}
            </div>
            {delivery ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-foreground leading-relaxed">{delivery.encrypted_payload}</pre>
            ) : (
              <div className="text-[12px] text-muted-foreground">아직 전달된 코드가 없습니다.</div>
            )}
          </section>
        </div>

        <div className="rounded-sm border border-border bg-background/35 p-3 space-y-2 min-w-0 h-fit">
          <div className="text-[12px] font-semibold text-foreground">입금 정보</div>
          <InfoRow label="네트워크" value={order.payment_network || "-"} />
          <InfoRow label="입금액" value={`${formatUsdt4(order.sale_price_usdt)} USDT`} highlight />
          {order.payment_address && <InfoRow label="주소" value={order.payment_address} copy={() => onCopy(order.payment_address!, "입금주소")} />}
          {order.customer_note && <InfoRow label="안내" value={order.customer_note} />}
          {order.status === "payment_pending" && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={checking}
              className="w-full h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-sm border border-usdt/50 text-usdt hover:bg-usdt/10 disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} /> 입금 확인
            </button>
          )}
          {canRequestAs ? (
            <Link to={`/app/as?order=${order.id}`} className="w-full h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-sm bg-usdt text-[hsl(240_10%_4%)] text-[12px] font-semibold hover:brightness-110">
              <LifeBuoy className="h-3.5 w-3.5" /> 이 주문 AS 신청
            </Link>
          ) : (
            <div className="text-[11px] text-muted-foreground pt-1">AS는 코드 전달 후 신청할 수 있습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight, copy }: { label: string; value: string; highlight?: boolean; copy?: () => void }) {
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] gap-2 items-start text-[11.5px] min-w-0">
      <div className="text-muted-foreground">{label}</div>
      <div className={cn("min-w-0 break-words font-mono", highlight ? "text-usdt font-semibold" : "text-foreground")}>{value}</div>
      {copy && (
        <button onClick={copy} className="h-6 w-6 inline-flex items-center justify-center rounded-sm border border-border text-muted-foreground hover:text-foreground hover:bg-muted">
          <Copy className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
