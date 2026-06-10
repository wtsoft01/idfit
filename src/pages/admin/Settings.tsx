import { FormEvent, useEffect, useMemo, useState } from "react";
import { BadgePercent, Copy, Plus, QrCode, Save, Search, Trash2, UserCog, Users } from "lucide-react";
import { toast } from "sonner";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { DEFAULT_NETWORK_BY_ASSET, DEFAULT_PAYMENT_SETTINGS, PAYMENT_ASSET_OPTIONS, getPaymentAssetNetworks, getPaymentQrImageUrl, isConfiguredPaymentAddress, normalizePaymentAsset, normalizePaymentNetwork, parsePaymentSettings, supportsAutoConfirm, type PaymentSettings, type PaymentWalletSetting } from "@/lib/payment-config";
import { formatUsdt4 } from "@/lib/payment-amount";
import { cn } from "@/lib/utils";

type AdminRole = "owner" | "admin" | "operator" | "support";
type AdminAccount = { id: string; email: string; full_name: string; role: AdminRole; status: "pending" | "active" | "suspended"; user_id: string | null; memo: string | null; created_at: string };
type SalesSummary = { id: string; code: string; name: string; email: string | null; status: "active" | "paused" | "suspended"; commission_percent: number; user_id: string | null; members_count: number; orders_count: number; gross_sales_usdt: number; net_profit_usdt: number; commission_usdt: number };
type AdminModalState = { email: string; full_name: string; role: AdminRole; memo: string };
type SalesModalState = { name: string; email: string; phone: string; code: string; commission_percent: string; memo: string };

const emptyAdminModal: AdminModalState = { email: "", full_name: "", role: "operator", memo: "" };
const emptySalesModal: SalesModalState = { name: "", email: "", phone: "", code: "", commission_percent: "10", memo: "" };
const adminRoles: AdminRole[] = ["admin", "operator", "support"];
const modalInputClass = "w-full h-9 rounded-sm border border-border bg-background px-2.5 text-[12.5px] outline-none focus:border-neon";

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
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [salesRows, setSalesRows] = useState<SalesSummary[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [adminModal, setAdminModal] = useState<AdminModalState | null>(null);
  const [salesModal, setSalesModal] = useState<SalesModalState | null>(null);
  const [directoryQuery, setDirectoryQuery] = useState("");

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
    loadDirectoryData();
  }, []);

  const loadDirectoryData = async () => {
    if (!isSupabaseConfigured) return;
    setDirectoryLoading(true);
    const [{ data: admins, error: adminsError }, { data: sales, error: salesError }] = await Promise.all([
      supabase.from("admin_accounts").select("id, email, full_name, role, status, user_id, memo, created_at").order("created_at", { ascending: false }),
      supabase.rpc("idfit_admin_sales_summary"),
    ]);
    if (adminsError && adminsError.code !== "42P01") toast.error(`관리자 목록 조회 실패: ${adminsError.message}`);
    if (salesError && salesError.code !== "42P01") toast.error(`영업팀 목록 조회 실패: ${salesError.message}`);
    setAdminAccounts((admins ?? []) as AdminAccount[]);
    setSalesRows((sales ?? []) as SalesSummary[]);
    setDirectoryLoading(false);
  };

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

  const filteredAdmins = useMemo(() => {
    const keyword = directoryQuery.trim().toLowerCase();
    if (!keyword) return adminAccounts;
    return adminAccounts.filter((account) => [account.email, account.full_name, account.role, account.status].some((value) => value?.toLowerCase().includes(keyword)));
  }, [adminAccounts, directoryQuery]);

  const filteredSales = useMemo(() => {
    const keyword = directoryQuery.trim().toLowerCase();
    if (!keyword) return salesRows;
    return salesRows.filter((row) => [row.code, row.name, row.email, row.status].some((value) => value?.toLowerCase().includes(keyword)));
  }, [directoryQuery, salesRows]);

  const salesTotals = useMemo(() => salesRows.reduce((acc, row) => ({
    members: acc.members + Number(row.members_count ?? 0),
    orders: acc.orders + Number(row.orders_count ?? 0),
    gmv: acc.gmv + Number(row.gross_sales_usdt ?? 0),
    profit: acc.profit + Number(row.net_profit_usdt ?? 0),
    commission: acc.commission + Number(row.commission_usdt ?? 0),
  }), { members: 0, orders: 0, gmv: 0, profit: 0, commission: 0 }), [salesRows]);

  const generateSalesCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  };

  const saveAdminAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adminModal) return;
    const email = adminModal.email.trim().toLowerCase();
    if (!email || !adminModal.full_name.trim()) {
      toast.error("관리자 이름과 이메일을 입력하세요.");
      return;
    }
    const { error } = await supabase.from("admin_accounts").insert({
      email,
      full_name: adminModal.full_name.trim(),
      role: adminModal.role,
      memo: adminModal.memo.trim() || null,
    });
    if (error) toast.error(`관리자 등록 실패: ${error.message}`);
    else {
      toast.success("관리자 등록정보를 저장했습니다. 해당 이메일로 가입하면 권한이 연결됩니다.");
      setAdminModal(null);
      await loadDirectoryData();
    }
  };

  const saveSalesCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!salesModal) return;
    const code = salesModal.code.trim().toUpperCase();
    const commission = Number(salesModal.commission_percent);
    if (!/^[A-Z0-9]{5}$/.test(code)) {
      toast.error("영업팀 코드는 영문+숫자 5자리여야 합니다.");
      return;
    }
    if (!salesModal.name.trim()) {
      toast.error("영업팀 이름을 입력하세요.");
      return;
    }
    if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
      toast.error("수익 %는 0~100 사이로 입력하세요.");
      return;
    }
    const { error } = await supabase.from("sales_team_codes").insert({
      code,
      name: salesModal.name.trim(),
      email: salesModal.email.trim().toLowerCase() || null,
      phone: salesModal.phone.trim() || null,
      commission_percent: commission,
      memo: salesModal.memo.trim() || null,
    });
    if (error) toast.error(`영업팀 코드 저장 실패: ${error.message}`);
    else {
      toast.success("영업팀 코드가 저장되었습니다.");
      setSalesModal(null);
      await loadDirectoryData();
    }
  };

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("복사했습니다.");
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

      <section className="border border-border rounded-md bg-card p-3 grid gap-2 md:grid-cols-[1fr_auto_auto] items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={directoryQuery} onChange={(event) => setDirectoryQuery(event.target.value)} placeholder="관리자, 영업팀, 코드, 이메일 검색" className="w-full h-9 pl-9 pr-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon" />
        </div>
        <button onClick={() => setAdminModal(emptyAdminModal)} className="h-9 px-3 text-[12px] border border-border rounded-sm inline-flex items-center gap-1 hover:bg-muted"><UserCog className="h-3.5 w-3.5" />관리자 등록</button>
        <button onClick={() => setSalesModal({ ...emptySalesModal, code: generateSalesCode() })} className="h-9 px-3 text-[12px] bg-neon text-[hsl(240_10%_4%)] rounded-sm inline-flex items-center gap-1 font-semibold"><BadgePercent className="h-3.5 w-3.5" />영업팀 코드 발부</button>
      </section>

      <section className="border border-border rounded-md bg-card overflow-hidden">
        <div className="px-4 h-10 flex items-center justify-between border-b border-border">
          <span className="text-[12.5px] font-semibold">관리자 계정</span>
          <span className="text-[11px] text-muted-foreground">등록 {filteredAdmins.length}명</span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-[1fr_1.4fr_0.7fr_0.7fr_0.8fr] px-4 h-9 items-center text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
              <span>이름</span><span>이메일</span><span>권한</span><span>상태</span><span>연결</span>
            </div>
            {directoryLoading ? <EmptyRow text="관리자 목록을 불러오는 중입니다..." /> : filteredAdmins.length === 0 ? <EmptyRow text="등록된 관리자 계정이 없습니다." /> : filteredAdmins.map((admin) => (
              <div key={admin.id} className="grid grid-cols-[1fr_1.4fr_0.7fr_0.7fr_0.8fr] px-4 min-h-11 py-2 items-center text-[12.5px] border-b border-border last:border-0 gap-2">
                <span className="truncate">{admin.full_name}</span>
                <span className="font-mono truncate">{admin.email}</span>
                <span className="font-mono uppercase text-neon">{admin.role}</span>
                <span className={cn("font-mono text-[11px]", admin.status === "active" ? "text-neon" : "text-usdt")}>{admin.status}</span>
                <span className="text-[11px] text-muted-foreground">{admin.user_id ? "가입연결" : "가입대기"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border border-border rounded-md bg-card overflow-hidden">
        <div className="px-4 min-h-10 py-2 flex items-center justify-between gap-3 border-b border-border">
          <div>
            <span className="text-[12.5px] font-semibold">영업팀 / 5자리 영업코드</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">커미션은 판매가에서 원가를 뺀 순수익 기준으로 계산됩니다.</p>
          </div>
          <div className="text-[11px] text-muted-foreground text-right">회원 {salesTotals.members}명 · 구매 {salesTotals.orders}건 · 커미션 {formatUsdt4(salesTotals.commission)} USDT</div>
        </div>
        <div className="grid sm:grid-cols-4 gap-px bg-border border-b border-border">
          <Summary label="추천가입" value={`${salesTotals.members}명`} />
          <Summary label="구매금액" value={`${formatUsdt4(salesTotals.gmv)} USDT`} />
          <Summary label="순수익" value={`${formatUsdt4(salesTotals.profit)} USDT`} />
          <Summary label="커미션" value={`${formatUsdt4(salesTotals.commission)} USDT`} accent />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[1fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] px-4 h-9 items-center text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
              <span>영업팀</span><span>코드</span><span>수익%</span><span>회원</span><span>구매</span><span>구매금액</span><span>순수익</span><span>커미션</span><span></span>
            </div>
            {directoryLoading ? <EmptyRow text="영업팀 목록을 불러오는 중입니다..." /> : filteredSales.length === 0 ? <EmptyRow text="발부된 영업팀 코드가 없습니다." /> : filteredSales.map((sale) => (
              <div key={sale.id} className="grid grid-cols-[1fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] px-4 min-h-11 py-2 items-center text-[12.5px] border-b border-border last:border-0 gap-2">
                <div className="min-w-0"><div className="truncate font-medium">{sale.name}</div><div className="truncate text-[10.5px] text-muted-foreground font-mono">{sale.email ?? "이메일 미등록"}</div></div>
                <button onClick={() => copyText(sale.code)} className="font-mono text-neon inline-flex items-center gap-1 text-left"><Copy className="h-3 w-3" />{sale.code}</button>
                <span className="font-mono">{sale.commission_percent}%</span>
                <span className="font-mono">{sale.members_count}</span>
                <span className="font-mono">{sale.orders_count}</span>
                <span className="font-mono text-usdt">{formatUsdt4(sale.gross_sales_usdt)}</span>
                <span className="font-mono text-neon">{formatUsdt4(sale.net_profit_usdt)}</span>
                <span className="font-mono text-neon">{formatUsdt4(sale.commission_usdt)}</span>
                <span className={cn("font-mono text-[11px]", sale.status === "active" ? "text-neon" : "text-usdt")}>{sale.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {adminModal && <AdminAccountModal value={adminModal} onChange={setAdminModal} onClose={() => setAdminModal(null)} onSubmit={saveAdminAccount} />}
      {salesModal && <SalesCodeModal value={salesModal} onChange={setSalesModal} onClose={() => setSalesModal(null)} onSubmit={saveSalesCode} onGenerate={() => setSalesModal((current) => current ? { ...current, code: generateSalesCode() } : current)} />}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">{text}</div>;
}

function Summary({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="bg-background px-4 py-3"><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono">{label}</div><div className={cn("font-display text-lg font-semibold mt-0.5", accent && "text-neon")}>{value}</div></div>;
}

function AdminAccountModal({ value, onChange, onClose, onSubmit }: { value: AdminModalState; onChange: (value: AdminModalState) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Modal title="관리자 신규 등록" desc="등록한 이메일로 사용자가 가입하면 지정한 관리자 권한이 자동 연결됩니다." onClose={onClose}>
    <form onSubmit={onSubmit} className="space-y-3">
      <input value={value.full_name} onChange={(event) => onChange({ ...value, full_name: event.target.value })} placeholder="관리자 이름" className={modalInputClass} required />
      <input type="email" value={value.email} onChange={(event) => onChange({ ...value, email: event.target.value })} placeholder="이메일" className={cn(modalInputClass, "font-mono")} required />
      <select value={value.role} onChange={(event) => onChange({ ...value, role: event.target.value as AdminRole })} className={modalInputClass}>
        {adminRoles.map((role) => <option key={role} value={role}>{role}</option>)}
      </select>
      <textarea value={value.memo} onChange={(event) => onChange({ ...value, memo: event.target.value })} placeholder="메모(선택)" rows={3} className={cn(modalInputClass, "min-h-20 py-2")} />
      <ModalActions onClose={onClose} submitLabel="관리자 저장" />
    </form>
  </Modal>;
}

function SalesCodeModal({ value, onChange, onClose, onSubmit, onGenerate }: { value: SalesModalState; onChange: (value: SalesModalState) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onGenerate: () => void }) {
  return <Modal title="영업팀 코드 발부" desc="코드는 영문+숫자 5자리입니다. 커미션은 판매가-원가 순수익 기준으로 계산됩니다." onClose={onClose}>
    <form onSubmit={onSubmit} className="space-y-3">
      <input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} placeholder="영업팀/영업자 이름" className={modalInputClass} required />
      <input type="email" value={value.email} onChange={(event) => onChange({ ...value, email: event.target.value })} placeholder="로그인 연결 이메일(선택)" className={cn(modalInputClass, "font-mono")} />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input value={value.code} onChange={(event) => onChange({ ...value, code: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) })} placeholder="A1B2C" maxLength={5} className={cn(modalInputClass, "font-mono uppercase")} required />
        <button type="button" onClick={onGenerate} className="h-9 px-3 border border-border rounded-sm text-[12px]">재발부</button>
      </div>
      <input type="number" min="0" max="100" step="0.01" value={value.commission_percent} onChange={(event) => onChange({ ...value, commission_percent: event.target.value })} placeholder="수익 %" className={cn(modalInputClass, "font-mono")} required />
      <input value={value.phone} onChange={(event) => onChange({ ...value, phone: event.target.value })} placeholder="연락처(선택)" className={modalInputClass} />
      <textarea value={value.memo} onChange={(event) => onChange({ ...value, memo: event.target.value })} placeholder="메모(선택)" rows={3} className={cn(modalInputClass, "min-h-20 py-2")} />
      <ModalActions onClose={onClose} submitLabel="영업팀 코드 저장" />
    </form>
  </Modal>;
}

function Modal({ title, desc, children, onClose }: { title: string; desc: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
    <div className="w-full max-w-lg border border-border bg-background rounded-md shadow-xl">
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3">
        <div><div className="font-semibold">{title}</div><p className="text-[11.5px] text-muted-foreground mt-0.5">{desc}</p></div>
        <button onClick={onClose} className="text-[12px] text-muted-foreground hover:text-foreground">닫기</button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  </div>;
}

function ModalActions({ onClose, submitLabel }: { onClose: () => void; submitLabel: string }) {
  return <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={onClose} className="h-9 px-3 border border-border rounded-sm text-[12px]">취소</button><button type="submit" className="h-9 px-3 bg-neon text-[hsl(240_10%_4%)] rounded-sm text-[12px] font-semibold">{submitLabel}</button></div>;
}
