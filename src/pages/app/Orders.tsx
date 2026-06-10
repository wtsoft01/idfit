import { useEffect, useMemo, useState } from "react";
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

const statusMeta: Record<OrderStatus, { label: string; tone: string; desc: string; step: number }> = {
  payment_pending: { label: "입금 대기", tone: "text-cyan border-cyan/40 bg-cyan/10", desc: "고유 금액 입금 후 자동확인을 기다립니다.", step: 1 },
  payment_confirmed: { label: "입금 확인", tone: "text-usdt border-usdt/40 bg-usdt/10", desc: "입금 확인 완료, 구매 진행 대기 중입니다.", step: 2 },
  purchasing: { label: "구매 진행", tone: "text-usdt border-usdt/40 bg-usdt/10", desc: "소스 상품 구매 및 전달 정보를 준비 중입니다.", step: 3 },
  delivered: { label: "전달 완료", tone: "text-neon border-neon/40 bg-neon/10", desc: "계정/코드 전달이 완료되었습니다.", step: 4 },
  as_open: { label: "AS 진행", tone: "text-usdt border-usdt/40 bg-usdt/10", desc: "AS 요청을 확인하고 처리 중입니다.", step: 4 },
  failed: { label: "실패", tone: "text-destructive border-destructive/40 bg-destructive/10", desc: "처리 실패 상태입니다. 고객센터 확인이 필요합니다.", step: 4 },
  refunded_review: { label: "환불 검토", tone: "text-destructive border-destructive/40 bg-destructive/10", desc: "환불 가능 여부를 검토 중입니다.", step: 4 },
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

  const stats = useMemo(() => {
    const total = orders.length;
    const spending = orders.reduce((sum, order) => sum + Number(order.sale_price_usdt ?? 0), 0);
    const pending = orders.filter((order) => order.status === "payment_pending").length;
    const delivered = orders.filter((order) => order.status === "delivered").length;
    const activeAs = orders.filter((order) => order.status === "as_open" || order.as_tickets?.some((ticket) => !["closed", "rejected"].includes(ticket.status))).length;
    return { total, spending, pending, delivered, activeAs };
  }, [orders]);

  return (
    <div className="w-full max-w-full overflow-x-hidden p-3 lg:p-6 space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap min-w-0">
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest mb-1">my orders</div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">내 주문</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1">결제 대기, 입금 확인, 구매 진행, 전달 완료 상태를 실시간으로 확인합니다.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={loadOrders} disabled={loading} className="h-9 px-3 inline-flex items-center gap-1.5 border border-border text-[12px] rounded-sm disabled:opacity-60 hover:bg-muted">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> 새로고침
          </button>
          <Link to="/app/as" className="h-9 px-3 inline-flex items-center gap-1.5 bg-usdt text-[hsl(240_10%_4%)] text-[12px] font-semibold rounded-sm hover:brightness-110">
            <LifeBuoy className="h-3.5 w-3.5" /> AS 신청
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Box k="총 주문" v={stats.total.toString()} />
        <Box k="결제대기" v={stats.pending.toString()} />
        <Box k="전달완료" v={stats.delivered.toString()} />
        <Box k="활성 AS" v={stats.activeAs.toString()} />
        <Box k="누적 주문액" v={`${formatUsdt4(stats.spending)} USDT`} wide />
      </div>

      {error && <div className="border border-destructive/40 bg-destructive/10 text-destructive rounded-md px-3 py-2 text-[12px]">{error}</div>}

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
  const steps = ["주문", "입금", "구매", "전달"];

  return (
    <div className="rounded-md border border-border bg-card/70 overflow-hidden min-w-0 max-w-full">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 border-b border-border bg-background/30 min-w-0">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[12px] text-muted-foreground truncate">{order.order_no}</span>
            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium", meta.tone)}>
              {statusIcon(order.status)} {meta.label}
            </span>
          </div>
          <div className="text-[15px] font-semibold text-foreground truncate" title={order.product?.title ?? "상품 정보 없음"}>{order.product?.title ?? "상품 정보 없음"}</div>
          <div className="text-[11px] text-muted-foreground truncate">{order.product?.service_name ?? "서비스 미분류"} · 주문 {formatDate(order.created_at)} · 갱신 {formatDate(order.updated_at)}</div>
        </div>
        <div className="shrink-0 text-left lg:text-right">
          <div className="font-mono text-xl font-bold text-usdt">{formatUsdt4(order.sale_price_usdt)}</div>
          <div className="text-[10.5px] text-muted-foreground">USDT 결제금액</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-3 p-3 min-w-0">
        <div className="space-y-3 min-w-0">
          <div className="grid grid-cols-4 gap-1.5">
            {steps.map((step, index) => {
              const active = index + 1 <= meta.step;
              return (
                <div key={step} className={cn("h-8 rounded-sm border text-[11px] flex items-center justify-center gap-1", active ? "border-neon/40 bg-neon/10 text-neon" : "border-border text-muted-foreground bg-background/30")}>
                  {active && <CheckCircle2 className="h-3 w-3" />}{step}
                </div>
              );
            })}
          </div>

          <div className="rounded-sm border border-border bg-background/35 p-3 text-[12px] text-muted-foreground space-y-2 min-w-0">
            <div className="font-medium text-foreground">현재 상태</div>
            <div>{meta.desc}</div>
            {order.payment_confirmed_at && <div className="text-usdt">입금 확인: {formatDate(order.payment_confirmed_at)}</div>}
            {order.payment_tx_hash && <div className="font-mono truncate">확인값: {order.payment_tx_hash}</div>}
            {activeTicket && <div className="text-usdt">AS 진행중: {activeTicket.issue_type} · {formatDate(activeTicket.created_at)}</div>}
            {order.admin_note && <div className="text-muted-foreground">관리자 메모: {order.admin_note}</div>}
          </div>

          {delivery && (
            <div className="rounded-sm border border-neon/40 bg-neon/10 p-3 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[12px] font-semibold text-neon">전달 정보</div>
                <button onClick={() => onCopy(delivery.encrypted_payload, "전달 정보")} className="h-7 px-2 inline-flex items-center gap-1 rounded-sm border border-neon/40 text-[11px] text-neon hover:bg-neon/10">
                  <Copy className="h-3 w-3" /> 복사
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-foreground leading-relaxed">{delivery.encrypted_payload}</pre>
            </div>
          )}
        </div>

        <div className="rounded-sm border border-border bg-background/35 p-3 space-y-2 min-w-0">
          <div className="text-[12px] font-semibold text-foreground">결제 정보</div>
          <InfoRow label="네트워크" value={order.payment_network || "-"} />
          <InfoRow label="입금액" value={`${formatUsdt4(order.sale_price_usdt)} USDT`} highlight />
          {order.payment_address && <InfoRow label="입금주소" value={order.payment_address} copy={() => onCopy(order.payment_address!, "입금주소")} />}
          {order.customer_note && <InfoRow label="안내" value={order.customer_note} />}
          {order.status === "payment_pending" && (
            <div className="pt-2 space-y-2">
              <div className="text-[10.5px] text-muted-foreground">고유 입금액이 달라지면 자동확인이 지연될 수 있습니다.</div>
              <button
                type="button"
                onClick={onConfirm}
                disabled={checking}
                className="w-full h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-sm border border-usdt/50 text-usdt hover:bg-usdt/10 disabled:opacity-60"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} /> 입금확인 다시 시도
              </button>
            </div>
          )}
          {order.status !== "payment_pending" && !delivery && <div className="pt-2 text-[11.5px] text-muted-foreground">관리자가 전달 정보를 준비 중입니다.</div>}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight, copy }: { label: string; value: string; highlight?: boolean; copy?: () => void }) {
  return (
    <div className="grid grid-cols-[68px_minmax(0,1fr)_auto] gap-2 items-start text-[11.5px] min-w-0">
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

function Box({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={cn("border border-border rounded-md p-3 bg-card min-w-0", wide && "col-span-2 lg:col-span-1")}>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono truncate">{k}</div>
      <div className="font-display text-lg md:text-xl font-semibold mt-0.5 truncate">{v}</div>
    </div>
  );
}
