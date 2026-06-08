const orders = [
  { id: "DS-20294", buyer: "tron***@gm", svc: "ChatGPT Plus 30d", cost: 12.4, price: 14.8, status: "결제완료", color: "text-neon" },
  { id: "DS-20293", buyer: "kim***@na", svc: "Cursor Pro 90d", cost: 32.0, price: 38.0, status: "자동구매 완료", color: "text-neon" },
  { id: "DS-20292", buyer: "alex***@p", svc: "Midjourney 30d", cost: 19.0, price: 22.5, status: "전송중", color: "text-usdt" },
  { id: "DS-20291", buyer: "vn***@gx", svc: "Claude Pro 30d", cost: 14.0, price: 16.4, status: "AS 요청", color: "text-destructive" },
  { id: "DS-20290", buyer: "jun***@gm", svc: "Runway Pro 30d", cost: 26.0, price: 29.6, status: "결제대기", color: "text-cyan" },
];

export default function AdminOrders() {
  return (
    <div className="p-4 lg:p-6 space-y-4">
      <h1 className="font-display text-xl font-bold">주문 관리</h1>
      <div className="border border-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1.4fr_0.8fr_0.8fr_0.8fr_1fr_auto] px-3 h-9 items-center bg-card text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span>주문ID</span><span>구매자</span><span>상품</span><span>매입가</span><span>판매가</span><span>마진</span><span>상태</span><span></span>
        </div>
        {orders.map((o) => {
          const margin = o.price - o.cost;
          const pct = ((margin / o.cost) * 100).toFixed(1);
          return (
            <div key={o.id} className="grid grid-cols-[1fr_1fr_1.4fr_0.8fr_0.8fr_0.8fr_1fr_auto] px-3 h-12 items-center text-[12px] border-b border-border last:border-0 hover:bg-muted/30">
              <span className="font-mono text-muted-foreground">{o.id}</span>
              <span className="font-mono text-foreground truncate">{o.buyer}</span>
              <span>{o.svc}</span>
              <span className="font-mono text-muted-foreground">{o.cost.toFixed(2)}</span>
              <span className="font-mono text-usdt">{o.price.toFixed(2)}</span>
              <span className="font-mono text-neon">+{margin.toFixed(2)} <span className="text-muted-foreground">({pct}%)</span></span>
              <span className={"font-medium " + o.color}>{o.status}</span>
              <button className="h-7 px-2.5 text-[11.5px] border border-border rounded-sm hover:bg-muted">로그</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
