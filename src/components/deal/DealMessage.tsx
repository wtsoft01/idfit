import { Deal, timeAgo } from "@/lib/mockDeals";
import { ServiceLogo } from "./ServiceLogo";
import { cn } from "@/lib/utils";
import { ShoppingCart, ShieldCheck, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const stockLabel: Record<Deal["stock"], { text: string; cls: string }> = {
  in_stock: { text: "재고 충분", cls: "text-neon border-neon/40 bg-neon/10" },
  low: { text: "소량", cls: "text-usdt border-usdt/40 bg-usdt/10" },
  soldout: { text: "품절", cls: "text-muted-foreground border-border bg-muted" },
};

export function DealMessage({ deal, dense = false }: { deal: Deal; dense?: boolean }) {
  const stk = stockLabel[deal.stock];
  const { profile } = useAuth();
  const canSeeCost = profile?.role === "owner" || profile?.role === "admin";
  return (
    <div className="animate-slide-up-in flex gap-2 group min-w-0 max-w-full overflow-hidden">
      <div className="shrink-0 mt-0.5 h-7 w-7 rounded-sm bg-muted border border-border flex items-center justify-center">
        <ServiceLogo service={deal.service} size={16} />
      </div>

      <div className={cn("min-w-0 flex-1 rounded-md border border-border bg-card hover:border-neon/40 transition-colors p-2.5 overflow-hidden", dense && "p-2")}>
        <div className="grid grid-cols-[minmax(0,1fr)_78px_86px] md:grid-cols-[minmax(0,1fr)_96px_96px] gap-2 items-center min-w-0 max-w-full overflow-hidden">
          <div className="min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground min-w-0 overflow-hidden whitespace-nowrap">
              <span className="font-mono truncate max-w-[86px] md:max-w-[120px]">{deal.source}</span>
              <span className="shrink-0">·</span>
              <span>{timeAgo(deal.createdAt)}</span>
              <span className="shrink-0">·</span>
              <span className="inline-flex items-center gap-0.5 shrink-0">
                <Star className="h-3 w-3 fill-usdt text-usdt" />
                <span>{deal.trust}</span>
              </span>
            </div>
            <div className="mt-1 text-[13px] md:text-[13.5px] font-medium text-foreground truncate" title={deal.title}>{deal.title}</div>
            <div className="mt-1.5 flex items-center gap-1.5 min-w-0 overflow-hidden whitespace-nowrap">
              <span className={cn("shrink-0 text-[10px] md:text-[10.5px] px-1.5 py-0.5 border rounded-sm", stk.cls)}>{stk.text}</span>
              <span className="hidden sm:inline-flex shrink-0 text-[10px] md:text-[10.5px] px-1.5 py-0.5 border border-border rounded-sm text-muted-foreground items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> {deal.warrantyDays}일 보장
              </span>
              <span className="min-w-0 truncate text-[10px] md:text-[10.5px] px-1.5 py-0.5 border border-border rounded-sm text-muted-foreground">{deal.service}</span>
            </div>
          </div>

          <div className="text-right min-w-0 overflow-hidden">
              <div className="font-mono text-[14px] md:text-[16px] font-semibold text-usdt leading-none truncate">
                {deal.priceUsdt.toFixed(2)}
              </div>
              <div className="text-[9.5px] md:text-[10px] text-muted-foreground mt-1">판매가</div>
              {canSeeCost && deal.costUsdt != null && (
                <div className="mt-1 text-[10px] font-mono text-muted-foreground truncate">원가 {deal.costUsdt.toFixed(2)}</div>
              )}
          </div>
            <button
              disabled={deal.stock === "soldout"}
              className={cn(
                "justify-self-end shrink-0 h-9 w-[86px] md:w-[96px] px-2 inline-flex items-center justify-center gap-1 rounded-sm text-[11.5px] md:text-[12px] font-semibold transition-colors whitespace-nowrap",
                deal.stock === "soldout"
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-neon text-[hsl(240_10%_4%)] hover:brightness-110"
              )}
            >
              <ShoppingCart className="hidden sm:block h-3.5 w-3.5" />
              지금 구매
            </button>
        </div>
      </div>
    </div>
  );
}
