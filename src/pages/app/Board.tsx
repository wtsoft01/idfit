import { LiveBoard } from "@/components/deal/LiveBoard";
import { AIScanLog } from "@/components/deal/AIScanLog";
import { AvailableProducts } from "@/components/deal/AvailableProducts";
import { PriceAlertDialogButton } from "@/components/deal/PriceAlertDialog";

export default function UserBoard() {
  return (
    <div className="p-3 lg:p-4 space-y-3">
      <div className="flex justify-end">
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
