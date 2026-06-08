import { useEffect, useRef, useState } from "react";
import { Deal, randomDeal, seedDeals, SOURCE_COUNT } from "@/lib/mockDeals";
import { DealMessage } from "./DealMessage";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";

export function LiveBoard({
  height = "min(72vh, 720px)",
  intervalMs = 2200,
  className,
  header = true,
}: {
  height?: string;
  intervalMs?: number;
  className?: string;
  header?: boolean;
}) {
  const [deals, setDeals] = useState<Deal[]>(() => seedDeals(16));
  const [count, setCount] = useState(2841);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setDeals((prev) => [randomDeal(), ...prev].slice(0, 40));
      setCount((c) => c + Math.floor(1 + Math.random() * 3));
    }, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return (
    <div className={cn("rounded-md border border-border bg-card/60 backdrop-blur overflow-hidden flex flex-col", className)} style={{ height }}>
      {header && (
        <div className="flex items-center justify-between gap-3 px-3 h-11 border-b border-border bg-card">
          <div className="flex items-center gap-2 text-[12px]">
            <Radio className="h-3.5 w-3.5 text-neon pulse-dot" />
            <span className="font-semibold text-foreground">IDFIT AI 실시간 스캔</span>
            <span className="hidden sm:inline text-muted-foreground">·</span>
            <span className="hidden sm:inline text-muted-foreground font-mono">{SOURCE_COUNT}개 소스</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">오늘 <span className="text-neon font-mono">{count.toLocaleString()}</span>건 필터링</span>
          </div>
          <div className="text-[10.5px] text-muted-foreground font-mono uppercase tracking-wider hidden md:block">live · usdt</div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {deals.map((d) => <DealMessage key={d.id} deal={d} />)}
      </div>
    </div>
  );
}

