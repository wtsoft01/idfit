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
          <h1 className="font-display text-xl md:text-2xl font-bold">Deal Board</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1">상단: 실시간 스캔 + AI 필터 로그 · 하단: 지금 바로 구매 가능한 재고. 원하는 조건은 딜 알림으로 받아보세요.</p>
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
