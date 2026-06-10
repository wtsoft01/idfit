import { useEffect, useState } from "react";
import { Plus, QrCode, Save } from "lucide-react";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { DEFAULT_PAYMENT_SETTINGS, isConfiguredPaymentAddress, parsePaymentSettings, type PaymentNetwork, type PaymentSettings } from "@/lib/payment-config";
import { cn } from "@/lib/utils";

const sales = [
  { name: "이영업", code: "IDFIT-SALES-A1", gmv: "$4,820", orders: 38 },
  { name: "박영업", code: "IDFIT-SALES-A2", gmv: "$2,140", orders: 17 },
  { name: "정파트너", code: "IDFIT-PART-K7", gmv: "$11,902", orders: 84 },
];

export default function AdminSettings() {
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPaymentSettings = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "payment")
      .maybeSingle();

    if (error) toast.error(`지갑 설정 조회 실패: ${error.message}`);
    else setPaymentSettings(parsePaymentSettings(data?.value));
    setLoading(false);
  };

  useEffect(() => {
    loadPaymentSettings();
  }, []);

  const updateWallet = (network: PaymentNetwork, patch: Partial<PaymentSettings["wallets"][number]>) => {
    setPaymentSettings((current) => ({
      ...current,
      wallets: current.wallets.map((wallet) => wallet.network === network ? { ...wallet, ...patch } : wallet),
    }));
  };

  const savePaymentSettings = async () => {
    const invalidWallet = paymentSettings.wallets.find((wallet) => wallet.enabled && !isConfiguredPaymentAddress(wallet.network, wallet.address));
    if (invalidWallet) {
      toast.error(`${invalidWallet.network} 지갑주소 형식이 올바르지 않습니다.`);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "payment", value: paymentSettings, updated_at: new Date().toISOString() }, { onConflict: "key" });

    setSaving(false);
    if (error) toast.error(`지갑 설정 저장 실패: ${error.message}`);
    else toast.success("IDFIT 결제 지갑주소가 저장되었습니다.");
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl">
      <h1 className="font-display text-xl font-bold">설정</h1>

      <section className="border border-border rounded-md bg-card overflow-hidden">
        <div className="px-4 min-h-10 py-2 flex items-center justify-between gap-3 border-b border-border">
          <div>
            <span className="text-[12.5px] font-semibold">IDFIT 수신 지갑(USDT)</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">사용자 구매 모달과 주문 결제 주소에 그대로 연결됩니다.</p>
          </div>
          <button onClick={savePaymentSettings} disabled={saving || loading || !isSupabaseConfigured} className="h-8 px-3 text-[11.5px] bg-neon text-[hsl(240_10%_4%)] rounded-sm inline-flex items-center gap-1 font-semibold disabled:opacity-60">
            <Save className="h-3 w-3" /> {saving ? "저장중" : "저장"}
          </button>
        </div>
        <div className="p-4 space-y-3">
          {!isSupabaseConfigured && <div className="text-[12px] text-usdt border border-usdt/30 bg-usdt/10 rounded-sm p-2">Supabase 연결 전이라 저장할 수 없습니다.</div>}
          {paymentSettings.wallets.map((wallet) => {
            const valid = !wallet.enabled || isConfiguredPaymentAddress(wallet.network, wallet.address);
            return (
              <div key={wallet.network} className="grid md:grid-cols-[auto_minmax(0,1fr)_auto] gap-3 border border-border rounded-sm p-3 min-w-0">
                <div className="h-16 w-16 bg-foreground rounded-sm flex items-center justify-center">
                  <QrCode className="h-10 w-10 text-background" />
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10.5px] uppercase font-mono text-neon">{wallet.network} · USDT</div>
                    <label className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                      <input type="checkbox" checked={wallet.enabled} onChange={(event) => updateWallet(wallet.network, { enabled: event.target.checked })} /> 사용
                    </label>
                  </div>
                  <input
                    value={wallet.address}
                    onChange={(event) => updateWallet(wallet.network, { address: event.target.value.trim() })}
                    placeholder={wallet.network === "TRC20" ? "T로 시작하는 TRC20 주소" : "0x로 시작하는 BEP20 주소"}
                    className={cn("w-full h-9 rounded-sm border bg-background px-2.5 font-mono text-[12px] outline-none focus:border-neon", valid ? "border-border" : "border-destructive")}
                  />
                  <input
                    value={wallet.memo ?? ""}
                    onChange={(event) => updateWallet(wallet.network, { memo: event.target.value })}
                    placeholder="관리자 메모(선택)"
                    className="w-full h-8 rounded-sm border border-border bg-background px-2.5 text-[12px] outline-none focus:border-neon"
                  />
                </div>
                <div className="flex md:flex-col gap-2 justify-end text-[11px] text-muted-foreground">
                  <span className={cn("px-2 py-1 rounded-sm border w-fit", wallet.enabled ? "border-neon/40 text-neon bg-neon/10" : "border-border")}>{wallet.enabled ? "활성" : "비활성"}</span>
                  <span className={cn("px-2 py-1 rounded-sm border w-fit", valid ? "border-border" : "border-destructive/40 text-destructive bg-destructive/10")}>{valid ? "주소 정상" : "주소 확인"}</span>
                </div>
              </div>
            );
          })}
          <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-center rounded-sm border border-border bg-background p-3">
            <div>
              <div className="text-[12px] font-medium">자동 결제 확인 시간</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">주문 생성 후 이 시간 안에 들어온 고유 입금액만 자동 반영합니다.</p>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <input
                type="number"
                min={10}
                max={180}
                value={paymentSettings.paymentWindowMinutes}
                onChange={(event) => setPaymentSettings((current) => ({ ...current, paymentWindowMinutes: Number(event.target.value) || 60 }))}
                className="h-8 w-20 rounded-sm border border-border bg-background px-2 text-right font-mono text-[12px] outline-none focus:border-neon"
              />
              <span className="text-[12px] text-muted-foreground">분</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border border-border rounded-md bg-card">
        <div className="px-4 h-10 flex items-center justify-between border-b border-border">
          <span className="text-[12.5px] font-semibold">관리자 계정</span>
          <button className="h-7 px-2.5 text-[11.5px] border border-border rounded-sm inline-flex items-center gap-1"><Plus className="h-3 w-3" />관리자 초대</button>
        </div>
        <div className="px-4 py-3 text-[12.5px] space-y-2">
          {[
            { email: "owner@idfit.io", role: "owner" },
            { email: "ops@idfit.io", role: "admin" },
            { email: "support@idfit.io", role: "support" },
          ].map((admin) => (
            <div key={admin.email} className="flex items-center justify-between border-b border-border last:border-0 py-1.5 gap-3 min-w-0">
              <span className="font-mono truncate">{admin.email}</span>
              <span className="text-[10.5px] font-mono uppercase text-neon shrink-0">{admin.role}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-border rounded-md bg-card overflow-hidden">
        <div className="px-4 h-10 flex items-center justify-between border-b border-border">
          <span className="text-[12.5px] font-semibold">영업팀 / 영업코드</span>
          <button className="h-7 px-2.5 text-[11.5px] border border-border rounded-sm inline-flex items-center gap-1"><Plus className="h-3 w-3" />영업팀 생성</button>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.6fr_auto] px-4 h-9 items-center text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
              <span>이름</span><span>영업코드</span><span>누적 GMV</span><span>주문</span><span></span>
            </div>
            {sales.map((sale) => (
              <div key={sale.code} className="grid grid-cols-[1.2fr_1fr_0.8fr_0.6fr_auto] px-4 h-11 items-center text-[12.5px] border-b border-border last:border-0">
                <span className="truncate">{sale.name}</span>
                <span className="font-mono text-neon truncate">{sale.code}</span>
                <span className="font-mono text-usdt">{sale.gmv}</span>
                <span className="font-mono">{sale.orders}</span>
                <button className="h-7 px-2.5 text-[11px] border border-border rounded-sm">상세</button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
