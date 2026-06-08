import { useEffect, useState } from "react";
import { randomScanLog } from "@/lib/mockDeals";
import { Cpu } from "lucide-react";

function ts() {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function AIScanLog({ className }: { className?: string }) {
  const [lines, setLines] = useState<{ id: number; t: string; line: string }[]>(() =>
    Array.from({ length: 8 }, (_, i) => ({ id: i, t: ts(), line: randomScanLog() }))
  );

  useEffect(() => {
    let id = lines.length;
    const t = setInterval(() => {
      id += 1;
      setLines((prev) => [{ id, t: ts(), line: randomScanLog() }, ...prev].slice(0, 18));
    }, 1400);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={"rounded-md border border-border bg-card/60 flex flex-col overflow-hidden " + (className ?? "")}>
      <div className="flex items-center gap-2 px-3 h-9 border-b border-border bg-card text-[11px] uppercase tracking-wider text-muted-foreground">
        <Cpu className="h-3.5 w-3.5 text-neon" />
        AI Filter Log
      </div>
      <div className="flex-1 overflow-hidden p-3 font-mono text-[11.5px] leading-relaxed space-y-1">
        {lines.map((l) => (
          <div key={l.id} className="animate-slide-up-in text-muted-foreground">
            <span className="text-neon/70">[{l.t}]</span>{" "}
            <span className={l.line.endsWith("✓") ? "text-foreground" : l.line.endsWith("✕") ? "text-destructive/80" : "text-muted-foreground"}>
              {l.line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
