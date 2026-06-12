import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

export function PriceAlertDialogButton() {
  return (
    <Link to="/app/search-reservations" className="h-9 px-3 inline-flex items-center gap-1.5 bg-neon text-[hsl(240_10%_4%)] text-[12.5px] font-semibold rounded-sm hover:brightness-110">
      <Plus className="h-3.5 w-3.5" /> 상품찾기예약
    </Link>
  );
}
