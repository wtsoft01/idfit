const days = Array.from({ length: 14 }, (_, i) => ({
  d: `${i + 1}일`,
  v: Math.round(800 + Math.sin(i * 0.7) * 250 + Math.random() * 400),
}));
const max = Math.max(...days.map((x) => x.v));

const tickets = [
  { id: "AS-204", buyer: "alex***@p", svc: "Midjourney 30d", issue: "로그아웃 됨, 재발급 요청", age: "12분" },
  { id: "AS-202", buyer: "vn***@gx", svc: "Claude Pro 30d", issue: "2FA 코드 안옴", age: "1시간" },
  { id: "AS-198", buyer: "kim***@na", svc: "ChatGPT Plus 30d", issue: "환불 요청 (서비스 만족 X)", age: "3시간" },
];

export default function AdminRevenue() {
  return (
    <div className="p-4 lg:p-6 space-y-5">
      <h1 className="font-display text-xl font-bold">매출 & AS</h1>

      <div className="grid lg:grid-cols-3 gap-3">
        <Stat label="14일 GMV" value={`$${days.reduce((s, x) => s + x.v, 0).toLocaleString()}`} />
        <Stat label="14일 마진" value={`$${Math.round(days.reduce((s, x) => s + x.v, 0) * 0.17).toLocaleString()}`} accent />
        <Stat label="AS 처리 평균" value="38분" />
      </div>

      <div className="border border-border rounded-md p-4 bg-card">
        <div className="text-[12px] font-semibold mb-3">일별 GMV (USDT)</div>
        <div className="flex items-end gap-1.5 h-40">
          {days.map((d) => (
            <div key={d.d} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-gradient-to-t from-neon/80 to-neon/30 rounded-sm" style={{ height: `${(d.v / max) * 100}%` }} />
              <div className="text-[9.5px] text-muted-foreground font-mono">{d.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <div className="px-4 h-10 flex items-center border-b border-border text-[12.5px] font-semibold">AS 티켓</div>
        {tickets.map((t) => (
          <div key={t.id} className="grid grid-cols-[0.7fr_1fr_1.2fr_1.6fr_0.6fr_auto] gap-3 px-4 h-12 items-center text-[12px] border-b border-border last:border-0">
            <span className="font-mono text-destructive">{t.id}</span>
            <span className="font-mono text-muted-foreground truncate">{t.buyer}</span>
            <span>{t.svc}</span>
            <span className="text-muted-foreground truncate">{t.issue}</span>
            <span className="text-[11px] text-muted-foreground font-mono">{t.age}</span>
            <div className="flex gap-1.5">
              <button className="h-7 px-2.5 text-[11px] border border-border rounded-sm hover:bg-muted">재발급</button>
              <button className="h-7 px-2.5 text-[11px] border border-border rounded-sm hover:bg-muted">환불</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-border rounded-md p-4 bg-card">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono">{label}</div>
      <div className={"font-display text-2xl font-semibold mt-1 " + (accent ? "text-neon" : "")}>{value}</div>
    </div>
  );
}
