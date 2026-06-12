import { useState } from "react";
import { BellRing, Mail, MessageCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type NotifyMethod = "telegram" | "email";

export function PriceAlertDialogButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("");
  const [method, setMethod] = useState<NotifyMethod>("telegram");
  const [telegramAddress, setTelegramAddress] = useState("");
  const [emailAddress, setEmailAddress] = useState(user?.email ?? "");

  const addReservation = async () => {
    if (!isSupabaseConfigured) return toast.error("Supabase 연결이 필요합니다");
    if (!user) return toast.error("로그인이 필요합니다");

    const cleanKeyword = keyword.trim();
    const min = Number(minPrice || 0);
    const max = maxPrice.trim() ? Number(maxPrice) : null;
    const telegram = telegramAddress.trim();
    const email = emailAddress.trim();

    if (!cleanKeyword) return toast.error("찾을 상품 키워드를 입력하세요");
    if (!Number.isFinite(min) || min < 0 || (max != null && (!Number.isFinite(max) || max < min))) return toast.error("가격 범위를 확인하세요");
    if (method === "telegram" && !telegram) return toast.error("텔레그램 주소를 입력하세요");
    if (method === "email" && !email) return toast.error("이메일 주소를 입력하세요");

    setSaving(true);
    const { error } = await supabase.from("product_search_reservations").insert({
      user_id: user.id,
      keyword: cleanKeyword,
      min_price_usdt: min,
      max_price_usdt: max,
      notify_telegram: method === "telegram",
      telegram_address: method === "telegram" ? telegram : null,
      notify_email: method === "email",
      email_address: method === "email" ? email : null,
      enabled: true,
    });
    setSaving(false);

    if (error) {
      const message = error.message.includes("schema cache") || error.message.includes("product_search_reservations")
        ? "상품찾기등록 DB 테이블 적용 전입니다. Supabase 마이그레이션 적용 후 사용할 수 있습니다."
        : `상품찾기등록 실패: ${error.message}`;
      return toast.error(message);
    }

    toast.success("상품찾기등록이 완료되었습니다");
    setKeyword("");
    setMaxPrice("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="h-9 px-3 inline-flex items-center gap-1.5 bg-neon text-[hsl(240_10%_4%)] text-[12.5px] font-semibold rounded-sm hover:brightness-110">
          <Plus className="h-3.5 w-3.5" /> 상품찾기등록
        </button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-24px)] max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BellRing className="h-4 w-4 text-usdt" /> 상품찾기등록</DialogTitle>
          <DialogDescription>원하는 상품명, 가격범위, 알림방법을 등록하면 조건에 맞는 상품을 빠르게 찾을 수 있게 준비합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-[12.5px]">
          <div>
            <div className="mb-1 text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground">키워드</div>
            <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="예: Gemini Pro 18개월, CapCut Pro, Canva" className="h-9 text-[12.5px]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="mb-1 text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground">최소 USDT</div>
              <Input type="number" min={0} value={minPrice} onChange={(event) => setMinPrice(event.target.value)} className="h-9 text-[12.5px] font-mono" />
            </div>
            <div>
              <div className="mb-1 text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground">최대 USDT</div>
              <Input type="number" min={0} value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="제한 없음" className="h-9 text-[12.5px] font-mono" />
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground">알림방법</div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMethod("telegram")} className={cn("h-9 rounded-sm border text-[12px] font-semibold inline-flex items-center justify-center gap-1.5", method === "telegram" ? "border-neon bg-neon/10 text-neon" : "border-border text-muted-foreground")}><MessageCircle className="h-3.5 w-3.5" /> Telegram</button>
              <button onClick={() => setMethod("email")} className={cn("h-9 rounded-sm border text-[12px] font-semibold inline-flex items-center justify-center gap-1.5", method === "email" ? "border-neon bg-neon/10 text-neon" : "border-border text-muted-foreground")}><Mail className="h-3.5 w-3.5" /> Email</button>
            </div>
          </div>
          {method === "telegram" ? (
            <div>
              <div className="mb-1 text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground">텔레그램 주소</div>
              <Input value={telegramAddress} onChange={(event) => setTelegramAddress(event.target.value)} placeholder="@username 또는 chat id" className="h-9 text-[12.5px]" />
            </div>
          ) : (
            <div>
              <div className="mb-1 text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground">이메일</div>
              <Input type="email" value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} placeholder="name@example.com" className="h-9 text-[12.5px]" />
            </div>
          )}
          <Button onClick={addReservation} disabled={saving} className="h-9 w-full bg-neon text-[hsl(240_10%_4%)] hover:brightness-110">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> {saving ? "등록 중" : "상품찾기등록"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
