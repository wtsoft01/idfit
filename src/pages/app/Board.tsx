import { LiveBoard } from "@/components/deal/LiveBoard";
import { AIScanLog } from "@/components/deal/AIScanLog";
import { AvailableProducts } from "@/components/deal/AvailableProducts";
import { PriceAlertDialogButton } from "@/components/deal/PriceAlertDialog";

export default function UserBoard() {
  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] text-neon font-mono uppercase tracking-widest mb-1">live · 실시간 잠금 해제됨</div>
          <h1 className="font-display text-xl md:text-2xl font-bold">Global ID Market Scanner</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1">전세계 공급처 데이터를 실시간 수집하고, 재고 있는 상품만 즉시 전시합니다.</p>
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
