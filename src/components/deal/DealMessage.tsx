import { Deal, timeAgo } from "@/lib/mockDeals";
import { ServiceLogo } from "./ServiceLogo";
import { cn } from "@/lib/utils";
import { ShoppingCart, ShieldCheck, Star } from "lucide-react";

const stockLabel: Record<Deal["stock"], { text: string; cls: string }> = {
  in_stock: { text: "재고 충분", cls: "text-neon border-neon/40 bg-neon/10" },
  low: { text: "소량", cls: "text-usdt border-usdt/40 bg-usdt/10" },
  soldout: { text: "품절", cls: "text-muted-foreground border-border bg-muted" },
};

export function DealMessage({ deal, dense = false }: { deal: Deal; dense?: boolean }) {
  const stk = stockLabel[deal.stock];
  return (
    <div className="animate-slide-up-in flex gap-2 group">
      <div className="shrink-0 mt-0.5 h-7 w-7 rounded-sm bg-muted border border-border flex items-center justify-center">
        <ServiceLogo service={deal.service} size={16} />
      </div>

      <div className={cn("flex-1 rounded-md border border-border bg-card hover:border-neon/40 transition-colors p-3", dense && "p-2.5")}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono">{deal.source}</span>
              <span>·</span>
              <span>{timeAgo(deal.createdAt)}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-usdt text-usdt" />
                <span>{deal.trust}</span>
              </span>
            </div>
            <div className="mt-1 text-[13.5px] font-medium text-foreground truncate">{deal.title}</div>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className={cn("text-[10.5px] px-1.5 py-0.5 border rounded-sm", stk.cls)}>{stk.text}</span>
              <span className="text-[10.5px] px-1.5 py-0.5 border border-border rounded-sm text-muted-foreground inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> {deal.warrantyDays}일 보장
              </span>
              <span className="text-[10.5px] px-1.5 py-0.5 border border-border rounded-sm text-muted-foreground">{deal.service}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-[16px] font-semibold text-usdt leading-none">
                {deal.priceUsdt.toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">USDT</div>
            </div>
            <button
              disabled={deal.stock === "soldout"}
              className={cn(
                "shrink-0 h-9 px-3 inline-flex items-center gap-1.5 rounded-sm text-[12px] font-semibold transition-colors",
                deal.stock === "soldout"
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-neon text-[hsl(240_10%_4%)] hover:brightness-110"
              )}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              지금 구매
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
