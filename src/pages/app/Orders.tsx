import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LifeBuoy, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type OrderStatus = "payment_pending" | "payment_confirmed" | "purchasing" | "delivered" | "as_open" | "failed" | "refunded_review";

type OrderRow = {
  id: string;
  order_no: string;
  status: OrderStatus;
  sale_price_usdt: number;
  payment_network: string;
  payment_address: string | null;
  payment_tx_hash: string | null;
  created_at: string;
  product: { title: string; service_name: string } | null;
  delivery_items: { encrypted_payload: string; visible_to_customer: boolean; delivered_at: string | null }[];
};

const statusLabel: Record<OrderStatus, string> = {
  payment_pending: "결제 대기",
  payment_confirmed: "입금 확인",
  purchasing: "구매 진행",
  delivered: "배송 완료",
  as_open: "AS 진행중",
  failed: "실패",
  refunded_review: "환불 검토",
};

const statusClass: Record<OrderStatus, string> = {
  payment_pending: "text-cyan",
  payment_confirmed: "text-usdt",
  purchasing: "text-usdt",
  delivered: "text-neon",
  as_open: "text-usdt",
  failed: "text-destructive",
  refunded_review: "text-destructive",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function UserOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    if (!user) return;
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
        created_at,
        product:products(title, service_name),
        delivery_items(encrypted_payload, visible_to_customer, delivered_at)
      `)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
    } else {
      setOrders((data ?? []) as unknown as OrderRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, [user?.id]);

  const stats = useMemo(() => {
    const total = orders.length;
    const spending = orders.reduce((sum, order) => sum + Number(order.sale_price_usdt ?? 0), 0);
    const activeAs = orders.filter((order) => order.status === "as_open").length;
    return { total, spending, activeAs };
  }, [orders]);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest mb-1">orders</div>
          <h1 className="font-display text-xl md:text-2xl font-bold">내 주문 / AS</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1">USDT 입금 대기부터 배송 완료까지 내 주문 상태를 확인합니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadOrders} disabled={loading} className="h-9 px-3 inline-flex items-center gap-1.5 border border-border text-[12px] rounded-sm disabled:opacity-60">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> 새로고침
          </button>
          <Link to="/app/as" className="h-9 px-3 inline-flex items-center gap-1.5 bg-usdt text-[hsl(240_10%_4%)] text-[12px] font-semibold rounded-sm hover:brightness-110">
            <LifeBuoy className="h-3.5 w-3.5" /> AS 신청
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Box k="총 주문" v={stats.total.toString()} />
        <Box k="누적 주문액" v={`${stats.spending.toFixed(2)} USDT`} />
        <Box k="활성 AS" v={stats.activeAs.toString()} />
      </div>

      {error && <div className="border border-destructive/40 bg-destructive/10 text-destructive rounded-md px-3 py-2 text-[12px]">{error}</div>}

      <div className="border border-border rounded-md overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_1.7fr_0.8fr_1fr_1fr] px-3 h-9 items-center bg-card text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span>주문번호</span><span>상품</span><span>USDT</span><span>상태</span><span>입금/배송</span>
        </div>
        {loading && orders.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">주문을 불러오는 중입니다.</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">아직 주문이 없습니다. 상품보드에서 구매를 눌러 주문을 생성해 보세요.</div>
        ) : (
          orders.map((order) => {
            const delivery = order.delivery_items?.find((item) => item.visible_to_customer);
            return (
              <div key={order.id} className="grid md:grid-cols-[1fr_1.7fr_0.8fr_1fr_1fr] gap-2 px-3 py-3 md:py-0 md:h-14 md:items-center text-[12.5px] border-b border-border last:border-b-0 hover:bg-muted/30">
                <div>
                  <div className="font-mono text-muted-foreground">{order.order_no}</div>
                  <div className="md:hidden text-[10.5px] text-muted-foreground">{formatDate(order.created_at)}</div>
                </div>
                <span className="text-foreground line-clamp-2">{order.product?.title ?? "상품 정보 없음"}</span>
                <span className="font-mono text-usdt">{Number(order.sale_price_usdt).toFixed(2)}</span>
                <span className={cn("font-medium", statusClass[order.status])}>{statusLabel[order.status]}</span>
                <div className="text-[11.5px] text-muted-foreground space-y-1">
                  {order.status === "payment_pending" && <div>{order.payment_network} 입금 대기</div>}
                  {order.payment_address && order.status === "payment_pending" && <div className="font-mono break-all">{order.payment_address}</div>}
                  {delivery ? <div className="text-neon whitespace-pre-wrap">{delivery.encrypted_payload}</div> : order.status !== "payment_pending" && <div>관리자 처리 중</div>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Box({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-border rounded-md p-3 bg-card">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono">{k}</div>
      <div className="font-display text-xl font-semibold mt-0.5">{v}</div>
    </div>
  );
}
