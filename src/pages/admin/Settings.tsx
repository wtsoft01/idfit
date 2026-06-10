import { useEffect, useState } from "react";
import { Plus, QrCode, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { DEFAULT_NETWORK_BY_ASSET, DEFAULT_PAYMENT_SETTINGS, PAYMENT_ASSET_OPTIONS, getPaymentAssetNetworks, getPaymentQrImageUrl, isConfiguredPaymentAddress, normalizePaymentAsset, normalizePaymentNetwork, parsePaymentSettings, supportsAutoConfirm, type PaymentSettings, type PaymentWalletSetting } from "@/lib/payment-config";
import { cn } from "@/lib/utils";

const sales = [
  { name: "이영업", code: "IDFIT-SALES-A1", gmv: "$4,820", orders: 38 },
  { name: "박영업", code: "IDFIT-SALES-A2", gmv: "$2,140", orders: 17 },
  { name: "정파트너", code: "IDFIT-PART-K7", gmv: "$11,902", orders: 84 },
];

const PAYMENT_SETTINGS_DRAFT_KEY = "idfit.admin.paymentSettingsDraft";

const readPaymentSettingsDraft = () => {
  try {
    const saved = window.sessionStorage.getItem(PAYMENT_SETTINGS_DRAFT_KEY);
    return saved ? parsePaymentSettings(JSON.parse(saved)) : null;
  } catch {
    return null;
  }
};

const writePaymentSettingsDraft = (settings: PaymentSettings) => {
  try {
    window.sessionStorage.setItem(PAYMENT_SETTINGS_DRAFT_KEY, JSON.stringify(settings));
  } catch {
    // Ignore unavailable storage.
  }
};

const clearPaymentSettingsDraft = () => {
  try {
    window.sessionStorage.removeItem(PAYMENT_SETTINGS_DRAFT_KEY);
  } catch {
    // Ignore unavailable storage.
  }
};

export default function AdminSettings() {
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(() => readPaymentSettingsDraft() ?? DEFAULT_PAYMENT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsTableMissing, setSettingsTableMissing] = useState(false);

  const loadPaymentSettings = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "payment")
      .maybeSingle();

    if (error) {
      const missing = error.code === "42P01" || error.message.toLowerCase().includes("app_settings");
      setSettingsTableMissing(missing);
      toast.error(missing ? "지갑 설정 테이블이 아직 생성되지 않았습니다." : `지갑 설정 조회 실패: ${error.message}`);
    } else {
      setSettingsTableMissing(false);
      if (!readPaymentSettingsDraft()) setPaymentSettings(parsePaymentSettings(data?.value));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPaymentSettings();
  }, []);

  const updateWallet = (id: string, patch: Partial<PaymentWalletSetting>) => {
    setPaymentSettings((current) => ({
      ...current,
      wallets: current.wallets.map((wallet) => wallet.id === id ? { ...wallet, ...patch } : wallet),
    }));
  };

  useEffect(() => {
    writePaymentSettingsDraft(paymentSettings);
  }, [paymentSettings]);

  const addWallet = () => {
    const id = `wallet-${Date.now()}`;
    setPaymentSettings((current) => ({
      ...current,
      wallets: [
        ...current.wallets,
        { id, asset: "USDT", network: "TRC20", label: "USDT TRC20", address: "", enabled: false, autoConfirm: true, memo: "" },
      ],
    }));
  };

  const updateWalletAsset = (id: string, assetValue: string) => {
    const asset = normalizePaymentAsset(assetValue);
    const network = DEFAULT_NETWORK_BY_ASSET[asset] ?? "TRC20";
    updateWallet(id, { asset, network, label: `${asset} ${network}`, autoConfirm: supportsAutoConfirm(network, asset) });
  };

  const updateWalletNetwork = (id: string, currentAsset: string, networkValue: string) => {
    const asset = normalizePaymentAsset(currentAsset);
    const network = normalizePaymentNetwork(networkValue);
    updateWallet(id, { network, label: `${asset} ${network}`, autoConfirm: supportsAutoConfirm(network, asset) });
  };

  const removeWallet = (id: string) => {
    setPaymentSettings((current) => ({
      ...current,
      wallets: current.wallets.filter((wallet) => wallet.id !== id),
    }));
  };

  const savePaymentSettings = async () => {
    const invalidWallet = paymentSettings.wallets.find((wallet) => wallet.enabled && !isConfiguredPaymentAddress(wallet.network, wallet.address));
    if (invalidWallet) {
      toast.error(`${invalidWallet.label || `${invalidWallet.asset} ${invalidWallet.network}`} 지갑주소 형식이 올바르지 않습니다.`);
      return;
    }

    const normalizedSettings: PaymentSettings = {
      ...paymentSettings,
      wallets: paymentSettings.wallets.map((wallet, index) => {
        const asset = normalizePaymentAsset(wallet.asset);
        const network = normalizePaymentNetwork(wallet.network);
        return {
          ...wallet,
          id: wallet.id || `wallet-${index}`,
          asset,
          network,
          label: wallet.label?.trim() || `${asset} ${network}`,
          address: wallet.address.trim(),
          autoConfirm: Boolean(wallet.autoConfirm && supportsAutoConfirm(network, asset)),
        };
      }),
    };

    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "payment", value: normalizedSettings, updated_at: new Date().toISOString() }, { onConflict: "key" });

    setSaving(false);
    if (error) {
      const missing = error.code === "42P01" || error.message.toLowerCase().includes("app_settings");
      setSettingsTableMissing(missing);
      toast.error(missing ? "저장 실패: Supabase에 app_settings 테이블 생성이 먼저 필요합니다." : `지갑 설정 저장 실패: ${error.message}`);
    } else {
      setSettingsTableMissing(false);
      setPaymentSettings(normalizedSettings);
      clearPaymentSettingsDraft();
      toast.success("IDFIT 결제 지갑주소가 저장되었습니다.");
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl">
      <h1 className="font-display text-xl font-bold">설정</h1>

      <section className="border border-border rounded-md bg-card overflow-hidden">
        <div className="px-4 min-h-10 py-2 flex items-center justify-between gap-3 border-b border-border">
          <div>
            <span className="text-[12.5px] font-semibold">IDFIT 수신 지갑</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">여러 코인/네트워크 지갑을 저장할 수 있습니다. 자동입금 확인은 현재 USDT TRC20/BEP20만 지원합니다.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={addWallet} className="h-8 px-3 text-[11.5px] border border-border rounded-sm inline-flex items-center gap-1 hover:bg-muted"><Plus className="h-3 w-3" />지갑 추가</button>
            <button onClick={savePaymentSettings} disabled={saving || loading || !isSupabaseConfigured} className="h-8 px-3 text-[11.5px] bg-neon text-[hsl(240_10%_4%)] rounded-sm inline-flex items-center gap-1 font-semibold disabled:opacity-60">
              <Save className="h-3 w-3" /> {saving ? "저장중" : "저장"}
            </button>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {!isSupabaseConfigured && <div className="text-[12px] text-usdt border border-usdt/30 bg-usdt/10 rounded-sm p-2">Supabase 연결 전이라 저장할 수 없습니다.</div>}
          {settingsTableMissing && <div className="text-[12px] text-destructive border border-destructive/30 bg-destructive/10 rounded-sm p-2">저장 DB가 아직 준비되지 않았습니다. Supabase migration(app_settings 테이블) 적용 후 저장됩니다.</div>}
          {paymentSettings.wallets.map((wallet) => {
            const valid = !wallet.enabled || isConfiguredPaymentAddress(wallet.network, wallet.address);
            const autoConfirmSupported = supportsAutoConfirm(wallet.network, wallet.asset);
            const networkOptions = getPaymentAssetNetworks(wallet.asset);
            const qrImageUrl = getPaymentQrImageUrl(wallet.address, 160);
            return (
              <div key={wallet.id} className="grid md:grid-cols-[auto_minmax(0,1fr)_auto] gap-3 border border-border rounded-sm p-3 min-w-0">
                <div className="h-20 w-20 rounded-sm border border-border bg-background p-1.5 flex items-center justify-center">
                  {qrImageUrl ? (
                    <img src={qrImageUrl} alt={`${wallet.label || wallet.network} 입금 QR`} className="h-full w-full rounded-[2px] bg-white object-contain" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-[2px] bg-muted text-muted-foreground">
                      <QrCode className="h-7 w-7" />
                      <span className="text-[9px]">주소 입력</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10.5px] uppercase font-mono text-neon">{wallet.label || `${wallet.asset} ${wallet.network}`}</div>
                    <label className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                      <input type="checkbox" checked={wallet.enabled} onChange={(event) => updateWallet(wallet.id, { enabled: event.target.checked })} /> 사용
                    </label>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2">
                    <select
                      value={wallet.asset}
                      onChange={(event) => updateWalletAsset(wallet.id, event.target.value)}
                      className="w-full h-8 rounded-sm border border-border bg-background px-2.5 font-mono text-[12px] outline-none focus:border-neon"
                    >
                      {PAYMENT_ASSET_OPTIONS.map((asset) => <option key={asset.value} value={asset.value}>{asset.label}</option>)}
                    </select>
                    <select
                      value={wallet.network}
                      onChange={(event) => updateWalletNetwork(wallet.id, wallet.asset, event.target.value)}
                      className="w-full h-8 rounded-sm border border-border bg-background px-2.5 font-mono text-[12px] outline-none focus:border-neon"
                    >
                      {networkOptions.map((network) => <option key={network} value={network}>{network}</option>)}
                    </select>
                    <input
                      value={wallet.label ?? ""}
                      onChange={(event) => updateWallet(wallet.id, { label: event.target.value })}
                      placeholder="표시명 예: 운영 USDT"
                      className="w-full h-8 rounded-sm border border-border bg-background px-2.5 text-[12px] outline-none focus:border-neon"
                    />
                  </div>
                  <input
                    value={wallet.address}
                    onChange={(event) => updateWallet(wallet.id, { address: event.target.value.trim() })}
                    placeholder="입금 지갑주소"
                    className={cn("w-full h-9 rounded-sm border bg-background px-2.5 font-mono text-[12px] outline-none focus:border-neon", valid ? "border-border" : "border-destructive")}
                  />
                  <input
                    value={wallet.memo ?? ""}
                    onChange={(event) => updateWallet(wallet.id, { memo: event.target.value })}
                    placeholder="관리자 메모(선택)"
                    className="w-full h-8 rounded-sm border border-border bg-background px-2.5 text-[12px] outline-none focus:border-neon"
                  />
                  <label className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={Boolean(wallet.autoConfirm && autoConfirmSupported)} disabled={!autoConfirmSupported} onChange={(event) => updateWallet(wallet.id, { autoConfirm: event.target.checked })} /> 자동입금 확인 사용
                    {!autoConfirmSupported && <span className="text-usdt">현재 미지원 네트워크</span>}
                  </label>
                </div>
                <div className="flex md:flex-col gap-2 justify-end text-[11px] text-muted-foreground">
                  <span className={cn("px-2 py-1 rounded-sm border w-fit", wallet.enabled ? "border-neon/40 text-neon bg-neon/10" : "border-border")}>{wallet.enabled ? "활성" : "비활성"}</span>
                  <span className={cn("px-2 py-1 rounded-sm border w-fit", valid ? "border-border" : "border-destructive/40 text-destructive bg-destructive/10")}>{valid ? "주소 정상" : "주소 확인"}</span>
                  <button onClick={() => removeWallet(wallet.id)} className="px-2 py-1 rounded-sm border border-border w-fit inline-flex items-center gap-1 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3 w-3" />삭제</button>
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
