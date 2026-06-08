import { useState } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { PriceAlertForm } from "./PriceAlertForm";

export function PriceAlertDialogButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="h-9 px-3 inline-flex items-center gap-1.5 bg-neon text-[hsl(240_10%_4%)] text-[12.5px] font-semibold rounded-sm hover:brightness-110">
          <Plus className="h-3.5 w-3.5" /> 딜 알림 추가
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl p-0 bg-background border-border">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="text-[14px]">가격 알림 설정</DialogTitle>
          <DialogDescription className="text-[12px]">
            키워드와 USDT 가격 범위를 등록해두면, 조건에 맞는 Deal이 올라올 때 자동으로 알림을 보내드립니다.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 pt-2">
          <PriceAlertForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}
