import { REVIEWS } from "@/lib/mockDeals";

function Pill({ r }: { r: typeof REVIEWS[number] }) {
  const initial = r.name.charAt(0);
  return (
    <div className="shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-md border border-border bg-card mr-3 min-w-[340px] max-w-[420px]">
      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-neon/40 to-cyan/30 flex items-center justify-center text-[11px] font-semibold text-foreground">
        {initial}
      </div>
      <div className="min-w-0">
        <div className="text-[11.5px] text-foreground truncate">
          <span className="font-semibold">{r.name}</span>
          <span className="text-muted-foreground"> · {r.product}</span>
        </div>
        <div className="text-[11px] text-muted-foreground truncate">"{r.text}"</div>
      </div>
      <div className="ml-auto text-[10px] text-muted-foreground font-mono whitespace-nowrap">{r.time}</div>
    </div>
  );
}

export function ReviewMarquee() {
  const loop = [...REVIEWS, ...REVIEWS];
  return (
    <div className="relative overflow-hidden border-y border-border bg-card/40 py-3">
      <div className="flex animate-marquee" style={{ width: "max-content" }}>
        {loop.map((r, i) => <Pill key={i} r={r} />)}
      </div>
    </div>
  );
}
