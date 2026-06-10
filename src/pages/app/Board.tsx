import { LiveBoard } from "@/components/deal/LiveBoard";
import { AIScanLog } from "@/components/deal/AIScanLog";
import { AvailableProducts } from "@/components/deal/AvailableProducts";
import { PriceAlertDialogButton } from "@/components/deal/PriceAlertDialog";
import { Activity } from "lucide-react";

export default function UserBoard() {
  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card/60 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative h-7 w-7 shrink-0 rounded-full border border-neon/40 bg-neon/10 flex items-center justify-center shadow-neon">
            <span className="absolute inset-0 rounded-full border border-neon/30 animate-ping" />
            <Activity className="relative h-3.5 w-3.5 text-neon pulse-dot" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-[14px] md:text-[15px] font-semibold leading-tight truncate">Global ID Market Scanner</div>
            <div className="text-[10.5px] text-muted-foreground font-mono uppercase tracking-wider">live monitoring active</div>
          </div>
        </div>
        <PriceAlertDialogButton />
      </div>

      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-9">
          <LiveBoard height="520px" />
        </div>
        <div className="lg:col-span-3">
          <AIScanLog className="h-[520px]" />
        </div>
      </div>

      <AvailableProducts className="h-[560px]" />
    </div>
  );
}
