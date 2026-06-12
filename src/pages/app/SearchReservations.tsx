import { useEffect, useMemo, useState } from "react";
import { BellRing, Mail, MessageCircle, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Reservation = Tables<"product_search_reservations">;
type NotifyMethod = "telegram" | "email";

export default function SearchReservations() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [dbNotice, setDbNotice] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("");
  const [method, setMethod] = useState<NotifyMethod>("telegram");
  const [telegramAddress, setTelegramAddress] = useState("");
  const [emailAddress, setEmailAddress] = useState(user?.email ?? "");

  const activeCount = useMemo(() => reservations.filter((item) => item.enabled).length, [reservations]);

  const loadReservations = async () => {
    if (!isSupabaseConfigured || !user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("product_search_reservations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      setReservations([]);
      setDbNotice(error.message.includes("schema cache") || error.message.includes("product_search_reservations") ? "예약 저장용 DB 테이블 적용 전입니다. Supabase 마이그레이션 적용 후 사용할 수 있습니다." : null);
      toast.error(`예약 조회 실패: ${error.message}`);
      return;
    }
    setDbNotice(null);
    setReservations((data ?? []) as Reservation[]);
  };

  useEffect(() => {
    loadReservations();
  }, [user?.id]);

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
      setDbNotice(error.message.includes("schema cache") || error.message.includes("product_search_reservations") ? "예약 저장용 DB 테이블 적용 전입니다. Supabase 마이그레이션 적용 후 사용할 수 있습니다." : null);
      return toast.error(`예약 저장 실패: ${error.message}`);
    }
    toast.success("상품찾기예약이 등록되었습니다");
    setKeyword("");
    setMaxPrice("");
    await loadReservations();
  };

  const toggleReservation = async (item: Reservation) => {
    const { error } = await supabase.from("product_search_reservations").update({ enabled: !item.enabled }).eq("id", item.id);
    if (error) return toast.error(`상태 변경 실패: ${error.message}`);
    setReservations((prev) => prev.map((row) => row.id === item.id ? { ...row, enabled: !item.enabled } : row));
  };

  const deleteReservation = async (id: string) => {
    const { error } = await supabase.from("product_search_reservations").delete().eq("id", id);
    if (error) return toast.error(`삭제 실패: ${error.message}`);
    setReservations((prev) => prev.filter((row) => row.id !== id));
  };

  return (
    <div className="min-h-full bg-background p-3 md:p-5 text-foreground">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-md border border-border bg-card/70 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[18px] font-bold"><Search className="h-5 w-5 text-neon" /> 상품찾기예약</div>
            <div className="mt-1 text-[12px] text-muted-foreground">원하는 상품명, 가격범위, 알림방법을 저장하면 조건에 맞는 상품을 빠르게 찾을 수 있게 준비합니다.</div>
          </div>
          <Button variant="outline" size="sm" onClick={loadReservations} disabled={loading} className="h-8 text-[12px]"><RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} /> 현행화</Button>
        </div>

        {dbNotice && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
            {dbNotice}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-md border border-border bg-card overflow-hidden">
            <div className="h-10 px-3 border-b border-border bg-background/40 flex items-center gap-2 text-[12.5px] font-semibold"><BellRing className="h-4 w-4 text-usdt" /> 새 상품찾기예약 등록</div>
            <div className="p-4 space-y-3">
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
              <Button onClick={addReservation} disabled={saving} className="h-9 w-full bg-neon text-[hsl(240_10%_4%)] hover:brightness-110"><Plus className="mr-1.5 h-3.5 w-3.5" /> 예약 등록</Button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-card overflow-hidden">
            <div className="h-10 px-3 border-b border-border bg-background/40 flex items-center justify-between text-[12.5px]">
              <span className="font-semibold">내 예약</span>
              <span className="font-mono text-muted-foreground">ON {activeCount} / 전체 {reservations.length}</span>
            </div>
            <div className="divide-y divide-border max-h-[520px] overflow-auto">
              {reservations.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-muted-foreground">등록된 상품찾기예약이 없습니다.</div>
              ) : reservations.map((item) => (
                <div key={item.id} className="p-3 flex items-start gap-3 text-[12.5px]">
                  <Switch checked={item.enabled} onCheckedChange={() => toggleReservation(item)} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-foreground truncate">{item.keyword}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground font-mono">USDT {Number(item.min_price_usdt).toFixed(2)} – {item.max_price_usdt == null ? "제한없음" : Number(item.max_price_usdt).toFixed(2)}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{item.notify_telegram ? `Telegram · ${item.telegram_address}` : `Email · ${item.email_address}`}</div>
                    {item.last_matched_at && <div className="mt-1 text-[10.5px] text-neon">최근 매칭 {new Date(item.last_matched_at).toLocaleString()}</div>}
                  </div>
                  <button onClick={() => deleteReservation(item.id)} className="h-7 w-7 inline-flex items-center justify-center rounded-sm border border-border text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
