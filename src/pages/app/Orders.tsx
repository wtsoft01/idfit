import { Link } from "react-router-dom";
import { LifeBuoy } from "lucide-react";

const orders = [
  { id: "DS-20294", service: "ChatGPT Plus",  warranty: "30일", price: 14.8, status: "배송 완료",   color: "text-neon",  canAS: true },
  { id: "DS-20281", service: "Cursor Pro",    warranty: "90일", price: 38.0, status: "배송 완료",   color: "text-neon",  canAS: true },
  { id: "DS-20269", service: "Midjourney",    warranty: "30일", price: 22.5, status: "AS 진행중",   color: "text-usdt",  canAS: true },
  { id: "DS-20251", service: "Claude Pro",    warranty: "30일", price: 16.4, status: "결제 대기",   color: "text-cyan",  canAS: false },
];

export default function UserOrders() {
  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-5xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest mb-1">orders</div>
          <h1 className="font-display text-xl md:text-2xl font-bold">내 주문 / AS</h1>
        </div>
        <Link to="/app/as" className="h-9 px-3 inline-flex items-center gap-1.5 bg-usdt text-[hsl(240_10%_4%)] text-[12px] font-semibold rounded-sm hover:brightness-110">
          <LifeBuoy className="h-3.5 w-3.5" /> AS 신청
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Box k="총 주문" v="14" />
        <Box k="이번 달 사용" v="$184.20" />
        <Box k="활성 AS" v="1" />
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1fr_1.4fr_0.8fr_0.8fr_0.9fr_auto] px-3 h-9 items-center bg-card text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span>주문번호</span><span>상품</span><span>보장</span><span>USDT</span><span>상태</span><span></span>
        </div>
        {orders.map((o) => (
          <div key={o.id} className="grid grid-cols-[1fr_1.4fr_0.8fr_0.8fr_0.9fr_auto] px-3 h-12 items-center text-[12.5px] border-b border-border last:border-b-0 hover:bg-muted/30">
            <span className="font-mono text-muted-foreground">{o.id}</span>
            <span className="text-foreground">{o.service}</span>
            <span className="text-muted-foreground">{o.warranty}</span>
            <span className="font-mono text-usdt">{o.price.toFixed(2)}</span>
            <span className={"font-medium " + o.color}>{o.status}</span>
            <div className="flex gap-1.5">
              <button className="h-7 px-2.5 text-[11.5px] border border-border rounded-sm hover:bg-muted">상세</button>
              {o.canAS && (
                <Link to="/app/as" className="h-7 px-2.5 inline-flex items-center text-[11.5px] border border-usdt/50 text-usdt rounded-sm hover:bg-usdt/10">AS</Link>
              )}
            </div>
          </div>
        ))}
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
