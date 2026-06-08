const rows = [
  { cat: "ChatGPT Plus", margin: 18, sample: 14.5, listed: 17.11 },
  { cat: "ChatGPT Pro", margin: 12, sample: 135.0, listed: 151.2 },
  { cat: "Claude Pro", margin: 20, sample: 16.0, listed: 19.2 },
  { cat: "Cursor Pro", margin: 22, sample: 12.5, listed: 15.25 },
  { cat: "Midjourney", margin: 15, sample: 22.0, listed: 25.3 },
  { cat: "Perplexity Pro", margin: 28, sample: 7.0, listed: 8.96 },
  { cat: "Runway Pro", margin: 14, sample: 26.0, listed: 29.64 },
];

export default function AdminPricing() {
  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-4xl">
      <div>
        <h1 className="font-display text-xl font-bold">판매가 자동 설정</h1>
        <p className="text-[12.5px] text-muted-foreground">수집가 × (1 + 마진%) = IDFIT 판매가. 카테고리별 마진 규칙을 적용합니다.</p>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] px-3 h-9 items-center bg-card text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span>카테고리</span><span>마진 %</span><span>샘플 수집가</span><span>표시 판매가</span>
        </div>
        {rows.map((row) => (
          <div key={row.cat} className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] px-3 h-11 items-center text-[12.5px] border-b border-border last:border-0">
            <span>{row.cat}</span>
            <span><input defaultValue={row.margin} className="w-16 h-7 px-2 bg-background border border-border rounded-sm font-mono text-[12px] focus:outline-none focus:border-neon" />%</span>
            <span className="font-mono text-muted-foreground">{row.sample.toFixed(2)}</span>
            <span className="font-mono text-usdt font-semibold">{row.listed.toFixed(2)} USDT</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button className="h-9 px-4 bg-neon text-[hsl(240_10%_4%)] text-[12.5px] font-semibold rounded-sm">일괄 적용</button>
        <button className="h-9 px-4 border border-border text-[12.5px] rounded-sm">미리보기</button>
      </div>
    </div>
  );
}
