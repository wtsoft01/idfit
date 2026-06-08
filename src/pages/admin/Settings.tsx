import { QrCode, Plus } from "lucide-react";

const wallets = [
  { net: "TRC20", addr: "TXk9Vbn3MqLp7sR4xPn8Vq2sLm7" },
  { net: "ERC20", addr: "0x9a3F...2b81C0eD4f7A2c3B" },
];

const sales = [
  { name: "이영업", code: "DS-SALES-A1", gmv: "$4,820", orders: 38 },
  { name: "박영업", code: "DS-SALES-A2", gmv: "$2,140", orders: 17 },
  { name: "정파트너", code: "DS-PART-K7", gmv: "$11,902", orders: 84 },
];

export default function AdminSettings() {
  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl">
      <h1 className="font-display text-xl font-bold">설정</h1>

      {/* Wallets */}
      <section className="border border-border rounded-md bg-card">
        <div className="px-4 h-10 flex items-center justify-between border-b border-border">
          <span className="text-[12.5px] font-semibold">수신 지갑 (USDT)</span>
          <button className="h-7 px-2.5 text-[11.5px] border border-border rounded-sm inline-flex items-center gap-1"><Plus className="h-3 w-3" />지갑 추가</button>
        </div>
        <div className="p-4 space-y-3">
          {wallets.map((w) => (
            <div key={w.net} className="flex items-start gap-3 border border-border rounded-sm p-3">
              <div className="h-16 w-16 bg-foreground rounded-sm flex items-center justify-center">
                <QrCode className="h-10 w-10 text-background" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10.5px] uppercase font-mono text-neon">{w.net} · USDT</div>
                <div className="font-mono text-[12px] break-all text-foreground mt-1">{w.addr}</div>
              </div>
              <button className="h-7 px-2.5 text-[11px] border border-border rounded-sm">편집</button>
            </div>
          ))}
        </div>
      </section>

      {/* Admins */}
      <section className="border border-border rounded-md bg-card">
        <div className="px-4 h-10 flex items-center justify-between border-b border-border">
          <span className="text-[12.5px] font-semibold">관리자 계정</span>
          <button className="h-7 px-2.5 text-[11.5px] border border-border rounded-sm inline-flex items-center gap-1"><Plus className="h-3 w-3" />관리자 초대</button>
        </div>
        <div className="px-4 py-3 text-[12.5px] space-y-2">
          {[
            { e: "owner@dealscout.io", r: "owner" },
            { e: "ops@dealscout.io", r: "admin" },
            { e: "support@dealscout.io", r: "support" },
          ].map((a) => (
            <div key={a.e} className="flex items-center justify-between border-b border-border last:border-0 py-1.5">
              <span className="font-mono">{a.e}</span>
              <span className="text-[10.5px] font-mono uppercase text-neon">{a.r}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Sales codes */}
      <section className="border border-border rounded-md bg-card">
        <div className="px-4 h-10 flex items-center justify-between border-b border-border">
          <span className="text-[12.5px] font-semibold">영업자 / 영업코드</span>
          <button className="h-7 px-2.5 text-[11.5px] border border-border rounded-sm inline-flex items-center gap-1"><Plus className="h-3 w-3" />영업자 생성</button>
        </div>
        <div>
          <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.6fr_auto] px-4 h-9 items-center text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
            <span>이름</span><span>영업코드</span><span>누적 GMV</span><span>주문</span><span></span>
          </div>
          {sales.map((s) => (
            <div key={s.code} className="grid grid-cols-[1.2fr_1fr_0.8fr_0.6fr_auto] px-4 h-11 items-center text-[12.5px] border-b border-border last:border-0">
              <span>{s.name}</span>
              <span className="font-mono text-neon">{s.code}</span>
              <span className="font-mono text-usdt">{s.gmv}</span>
              <span className="font-mono">{s.orders}</span>
              <button className="h-7 px-2.5 text-[11px] border border-border rounded-sm">상세</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
