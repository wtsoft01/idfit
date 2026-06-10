import { useEffect, useMemo, useState } from "react";
import { Copy, QrCode, ArrowDownToLine, Wallet, History, Plus, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_PAYMENT_NETWORK,
  DEFAULT_PAYMENT_SETTINGS,
  getCheckoutWallets,
  getPaymentAssetNetworks,
  getPaymentQrImageUrl,
  isConfiguredPaymentAddress,
  normalizePaymentNetwork,
  parsePaymentSettings,
  type PaymentWalletSetting,
} from "@/lib/payment-config";

type RefundWallet = {
  id: string;
  user_id: string;
  asset: string;
  network: string;
  address: string;
  label: string;
  is_default: boolean;
  created_at: string;
};

type DepositRequest = {
  id: string;
  asset: string;
  network: string;
  amount_usdt: number;
  bonus_rate: number | null;
  bonus_usdt: number | null;
  credit_usdt: number | null;
  is_refundable: boolean | null;
  payment_address: string;
  status: "pending" | "confirmed" | "expired" | "rejected";
  payment_tx_hash: string | null;
  requested_at: string;
  confirmed_at: string | null;
};

type WalletLedger = {
  id: string;
  kind: "deposit" | "purchase" | "refund" | "adjustment";
  amount_usdt: number;
  status: "pending" | "confirmed" | "rejected";
  memo: string | null;
  created_at: string;
};

type WalletAccount = {
  balance_usdt: number;
  locked_usdt: number;
};

const tableMissingMessage = "예치금/환불지갑 테이블이 아직 배포 DB에 적용되지 않았습니다.";
const statusLabel: Record<DepositRequest["status"], string> = {
  pending: "입금 대기",
  confirmed: "충전 완료",
  expired: "만료",
  rejected: "반려",
};
const ledgerKindLabel: Record<WalletLedger["kind"], string> = {
  deposit: "충전",
  purchase: "구매",
  refund: "환불",
  adjustment: "조정",
};
const depositPresets = [50, 100, 300, 500, 1000];

function getDepositBonusRate(amount: number) {
  if (amount >= 500) return 10;
  if (amount >= 300) return 8;
  if (amount >= 100) return 6;
  return 5;
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || error?.message?.includes("does not exist");
}

function formatUsdt(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(4)} USDT`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function UserMe() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingWallet, setSavingWallet] = useState(false);
  const [creatingDeposit, setCreatingDeposit] = useState(false);
  const [dbMissing, setDbMissing] = useState(false);
  const [walletAccount, setWalletAccount] = useState<WalletAccount>({ balance_usdt: 0, locked_usdt: 0 });
  const [refundWallets, setRefundWallets] = useState<RefundWallet[]>([]);
  const [depositRequests, setDepositRequests] = useState<DepositRequest[]>([]);
  const [ledger, setLedger] = useState<WalletLedger[]>([]);
  const [paymentWallets, setPaymentWallets] = useState<PaymentWalletSetting[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState(DEFAULT_PAYMENT_NETWORK);
  const [depositAmount, setDepositAmount] = useState("");
  const [refundLabel, setRefundLabel] = useState("환불 지갑");
  const [refundNetwork, setRefundNetwork] = useState(DEFAULT_PAYMENT_NETWORK);
  const [refundAddress, setRefundAddress] = useState("");

  const activeDepositWallet = useMemo(() => (
    paymentWallets.find((wallet) => wallet.network === selectedNetwork) ?? paymentWallets[0]
  ), [paymentWallets, selectedNetwork]);
  const qrUrl = getPaymentQrImageUrl(activeDepositWallet?.address, 180);
  const latestPending = depositRequests.find((request) => request.status === "pending");
  const parsedDepositAmount = Number(depositAmount);
  const selectedBonusRate = Number.isFinite(parsedDepositAmount) && parsedDepositAmount >= 5 ? getDepositBonusRate(parsedDepositAmount) : 0;
  const selectedBonusUsdt = Number.isFinite(parsedDepositAmount) && parsedDepositAmount >= 5 ? Number((parsedDepositAmount * selectedBonusRate / 100).toFixed(4)) : 0;
  const selectedCreditUsdt = Number.isFinite(parsedDepositAmount) && parsedDepositAmount >= 5 ? Number((parsedDepositAmount + selectedBonusUsdt).toFixed(4)) : 0;

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setDbMissing(false);

    const [settingsResult, accountResult, refundResult, depositResult, ledgerResult] = await Promise.all([
      supabase.from("app_settings" as never).select("value").eq("key", "payment").maybeSingle(),
      supabase.from("user_wallet_accounts" as never).select("balance_usdt, locked_usdt").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_refund_wallets" as never).select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("user_deposit_requests" as never).select("id, asset, network, amount_usdt, bonus_rate, bonus_usdt, credit_usdt, is_refundable, payment_address, status, payment_tx_hash, requested_at, confirmed_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("user_wallet_ledger" as never).select("id, kind, amount_usdt, status, memo, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);

    if ([accountResult.error, refundResult.error, depositResult.error, ledgerResult.error].some(isMissingTable)) {
      setDbMissing(true);
      setLoading(false);
      return;
    }

    if (settingsResult.error && !isMissingTable(settingsResult.error)) {
      toast.error(`입금 지갑 설정 조회 실패: ${settingsResult.error.message}`);
    }
    if (accountResult.error) toast.error(`예치금 조회 실패: ${accountResult.error.message}`);
    if (refundResult.error) toast.error(`환불 지갑 조회 실패: ${refundResult.error.message}`);
    if (depositResult.error) toast.error(`충전 요청 조회 실패: ${depositResult.error.message}`);
    if (ledgerResult.error) toast.error(`거래 내역 조회 실패: ${ledgerResult.error.message}`);

    const paymentSettings = parsePaymentSettings((settingsResult.data as { value?: unknown } | null)?.value ?? DEFAULT_PAYMENT_SETTINGS);
    const checkoutWallets = getCheckoutWallets(paymentSettings);
    setPaymentWallets(checkoutWallets);
    setSelectedNetwork((current) => checkoutWallets.some((wallet) => wallet.network === current) ? current : checkoutWallets[0]?.network ?? DEFAULT_PAYMENT_NETWORK);
    setWalletAccount((accountResult.data as WalletAccount | null) ?? { balance_usdt: 0, locked_usdt: 0 });
    setRefundWallets((refundResult.data ?? []) as RefundWallet[]);
    setDepositRequests((depositResult.data ?? []) as DepositRequest[]);
    setLedger((ledgerResult.data ?? []) as WalletLedger[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 10_000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast.success("주소를 복사했습니다");
  };

  const saveRefundWallet = async () => {
    if (!user) return;
    const network = normalizePaymentNetwork(refundNetwork);
    const address = refundAddress.trim();
    if (!isConfiguredPaymentAddress(network, address)) return toast.error(`${network} 환불 지갑주소 형식이 올바르지 않습니다.`);
    setSavingWallet(true);
    const { error } = await supabase.from("user_refund_wallets" as never).upsert({
      user_id: user.id,
      asset: "USDT",
      network,
      address,
      label: refundLabel.trim() || "환불 지갑",
      is_default: true,
    } as never, { onConflict: "user_id,asset,network" });
    setSavingWallet(false);
    if (isMissingTable(error)) {
      setDbMissing(true);
      return;
    }
    if (error) return toast.error(`환불 지갑 저장 실패: ${error.message}`);
    toast.success("환불 지갑주소가 저장되었습니다.");
    setRefundAddress("");
    load();
  };

  const deleteRefundWallet = async (id: string) => {
    const { error } = await supabase.from("user_refund_wallets" as never).delete().eq("id", id);
    if (error) return toast.error(`환불 지갑 삭제 실패: ${error.message}`);
    toast.success("환불 지갑주소가 삭제되었습니다.");
    load();
  };

  const createDepositRequest = async () => {
    if (!user || !activeDepositWallet) return;
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount < 5) return toast.error("충전 요청 금액은 최소 5 USDT 이상이어야 합니다.");
    const bonusRate = getDepositBonusRate(amount);
    const bonusUsdt = Number((amount * bonusRate / 100).toFixed(4));
    const creditUsdt = Number((amount + bonusUsdt).toFixed(4));
    if (!isConfiguredPaymentAddress(activeDepositWallet.network, activeDepositWallet.address)) return toast.error("관리자 입금 지갑주소 설정이 필요합니다.");
    setCreatingDeposit(true);
    const { error } = await supabase.from("user_deposit_requests" as never).insert({
      user_id: user.id,
      asset: "USDT",
      network: activeDepositWallet.network,
      amount_usdt: amount,
      bonus_rate: bonusRate,
      bonus_usdt: bonusUsdt,
      credit_usdt: creditUsdt,
      is_refundable: false,
      payment_address: activeDepositWallet.address,
      status: "pending",
    } as never);
    setCreatingDeposit(false);
    if (isMissingTable(error)) {
      setDbMissing(true);
      return;
    }
    if (error) return toast.error(`충전 요청 실패: ${error.message}`);
    toast.success("예치금 충전 요청이 생성되었습니다. 표시된 금액을 입금해 주세요.");
    setDepositAmount("");
    load();
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-6xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest mb-1">wallet / deposit</div>
          <h1 className="font-display text-xl md:text-2xl font-bold">지갑 / 예치금</h1>
          <p className="mt-1 text-[12px] text-muted-foreground">구매 때마다 결제하지 않도록 USDT 예치금을 미리 충전하고, 만일의 환불 지갑주소를 저장합니다.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> 새로고침
        </Button>
      </div>

      {dbMissing && (
        <div className="border border-destructive/40 bg-destructive/10 rounded-md p-3 text-[12.5px] text-destructive flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>{tableMissingMessage} Supabase 마이그레이션 적용 후 실제 저장/조회가 활성화됩니다.</div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-3">
        <div className="border border-border rounded-md p-4 bg-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground inline-flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> 사용 가능 예치금</span>
            <span className="text-[10.5px] font-mono uppercase text-neon">USDT</span>
          </div>
          <div className="font-mono text-3xl font-bold text-usdt leading-none">{Number(walletAccount.balance_usdt ?? 0).toFixed(4)}</div>
          <div className="text-[10.5px] font-mono text-muted-foreground">잠금 {formatUsdt(walletAccount.locked_usdt)} · 충전 보너스 포함 잔액</div>
        </div>
        <Stat k="진행 중 충전" v={latestPending ? formatUsdt(latestPending.amount_usdt) : "0.0000 USDT"} sub={latestPending ? `${latestPending.network} 입금 대기` : "대기 중 요청 없음"} />
        <Stat k="환불 지갑" v={`${refundWallets.length}개`} sub={refundWallets[0] ? `${refundWallets[0].network} 기본 주소 등록됨` : "환불 전 주소 등록 필요"} />
      </div>

      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-4">
        <section className="border border-border rounded-md bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-background/40">
            <ArrowDownToLine className="h-3.5 w-3.5 text-neon" />
            <span className="text-[12.5px] font-semibold">예치금 충전</span>
          </div>
          <div className="p-4 grid md:grid-cols-[auto_1fr] gap-5">
            <div className="space-y-2">
              <div className="h-36 w-36 rounded-sm bg-white flex items-center justify-center overflow-hidden">
                {qrUrl ? <img src={qrUrl} alt="예치금 입금 QR" className="h-full w-full object-contain" /> : <QrCode className="h-24 w-24 text-background" />}
              </div>
              <div className="flex gap-1">
                {paymentWallets.length ? paymentWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => setSelectedNetwork(wallet.network)}
                    className={cn(
                      "flex-1 h-7 text-[11px] font-mono uppercase border rounded-sm",
                      selectedNetwork === wallet.network ? "bg-neon text-[hsl(240_10%_4%)] border-neon" : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >{wallet.network}</button>
                )) : <div className="text-[11px] text-muted-foreground">관리자 입금 지갑 설정 필요</div>}
              </div>
            </div>
            <div className="space-y-3 min-w-0">
              <Field label="충전 금액 선택 (USDT)">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-2">
                  {depositPresets.map((amount) => {
                    const rate = getDepositBonusRate(amount);
                    return (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setDepositAmount(String(amount))}
                        className={cn(
                          "h-12 border rounded-sm text-left px-2 hover:border-neon/70",
                          Number(depositAmount) === amount ? "border-neon bg-neon/10" : "border-border bg-background/40"
                        )}
                      >
                        <div className="font-mono text-[13px] text-foreground">{amount.toLocaleString()} USDT</div>
                        <div className="font-mono text-[10.5px] text-neon">+{rate}% bonus</div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Input type="number" min="5" step="0.0001" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} placeholder="예: 100" className="h-9 text-[13px] font-mono" />
                  <Button onClick={createDepositRequest} disabled={creatingDeposit || !activeDepositWallet} className="h-9 bg-neon text-[hsl(240_10%_4%)] hover:bg-neon/90">
                    요청 생성
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px]">
                  <div className="border border-border rounded-sm px-2 py-1.5 bg-background/40"><span className="text-muted-foreground">입금</span><br /><span className="font-mono">{formatUsdt(Number.isFinite(parsedDepositAmount) ? parsedDepositAmount : 0)}</span></div>
                  <div className="border border-neon/30 rounded-sm px-2 py-1.5 bg-neon/10"><span className="text-muted-foreground">보너스</span><br /><span className="font-mono text-neon">+{formatUsdt(selectedBonusUsdt)} ({selectedBonusRate}%)</span></div>
                  <div className="border border-usdt/30 rounded-sm px-2 py-1.5 bg-usdt/10"><span className="text-muted-foreground">충전 반영</span><br /><span className="font-mono text-usdt">{formatUsdt(selectedCreditUsdt)}</span></div>
                </div>
              </Field>
              <Field label={`${activeDepositWallet?.network ?? "USDT"} 입금 주소`}>
                <div className="font-mono text-[12.5px] break-all text-foreground border border-border rounded-sm px-2 py-2 bg-background/40">
                  {activeDepositWallet?.address || "관리자 지갑주소 설정 필요"}
                </div>
                {activeDepositWallet?.address && (
                  <button onClick={() => copy(activeDepositWallet.address)} className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-neon hover:underline">
                    <Copy className="h-3 w-3" /> 주소 복사
                  </button>
                )}
              </Field>
              <ul className="text-[11.5px] text-muted-foreground space-y-1 list-disc pl-4">
                <li>충전 요청 후 같은 네트워크/주소로 정확한 금액을 입금해 주세요.</li>
                <li>충전액은 <span className="font-mono text-foreground">50 / 100 / 300 / 500 / 1,000 USDT</span> 빠른 선택 또는 직접 입력이 가능합니다.</li>
                <li>예치금 충전은 <span className="text-neon">5~10% 추가 포인트</span>가 붙으며, 충전 완료 후 환불되지 않습니다.</li>
                <li>TRC20/BEP20은 자동 확인 대상이며, 확인 후 보너스 포함 예치금에 반영됩니다.</li>
                <li>다른 체인으로 보내면 복구가 어려우니 네트워크를 꼭 확인하세요.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="border border-border rounded-md bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-background/40">
            <Wallet className="h-3.5 w-3.5 text-cyan" />
            <span className="text-[12.5px] font-semibold">환불 지갑주소</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label="라벨">
                <Input value={refundLabel} onChange={(event) => setRefundLabel(event.target.value)} placeholder="예: 내 바이낸스 환불 주소" className="h-9 text-[12.5px]" />
              </Field>
              <Field label="네트워크">
                <select value={refundNetwork} onChange={(event) => setRefundNetwork(event.target.value)} className="h-9 px-2 text-[12.5px] bg-background border border-border rounded-sm">
                  {getPaymentAssetNetworks("USDT").map((network) => <option key={network}>{network}</option>)}
                </select>
              </Field>
            </div>
            <Field label="USDT 환불 받을 지갑주소">
              <Input value={refundAddress} onChange={(event) => setRefundAddress(event.target.value)} placeholder="환불 받을 개인 지갑주소" className="h-9 text-[12.5px] font-mono" />
            </Field>
            <Button onClick={saveRefundWallet} disabled={savingWallet} className="w-full h-9 bg-neon text-[hsl(240_10%_4%)] hover:bg-neon/90">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> 환불 지갑 저장
            </Button>
            <div className="border border-border rounded-sm divide-y divide-border">
              {refundWallets.length === 0 ? (
                <div className="p-4 text-center text-[12px] text-muted-foreground">등록된 환불 지갑주소가 없습니다.</div>
              ) : refundWallets.map((wallet) => (
                <div key={wallet.id} className="px-3 py-2.5 flex items-center gap-2 text-[12px] min-w-0">
                  <span className="font-mono text-[10.5px] uppercase px-1.5 py-0.5 border border-border rounded-sm">{wallet.network}</span>
                  <span className="text-foreground shrink-0">{wallet.label}</span>
                  <span className="font-mono text-[11px] text-muted-foreground truncate flex-1">{wallet.address}</span>
                  <button onClick={() => copy(wallet.address)} className="h-7 w-7 inline-flex items-center justify-center border border-border rounded-sm text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteRefundWallet(wallet.id)} className="h-7 w-7 inline-flex items-center justify-center border border-border rounded-sm text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <HistoryPanel title="충전 요청 내역" icon="deposit" empty="충전 요청 내역이 없습니다.">
          {depositRequests.map((request) => (
            <div key={request.id} className="px-3 py-2.5 grid grid-cols-[90px_1fr_auto] items-center gap-3 text-[12.5px]">
              <span className={cn("text-[10.5px] font-mono uppercase px-1.5 py-0.5 border rounded-sm w-fit", request.status === "confirmed" ? "text-neon border-neon/40 bg-neon/10" : request.status === "pending" ? "text-usdt border-usdt/40 bg-usdt/10" : "text-muted-foreground border-border")}>{statusLabel[request.status]}</span>
              <div className="min-w-0">
                <div className="font-mono text-[11.5px] truncate">{request.network} · {request.payment_tx_hash || request.payment_address}</div>
                <div className="font-mono text-[10.5px] text-muted-foreground">{formatDate(request.requested_at)}</div>
              </div>
              <span className="font-mono text-right text-neon">+{formatUsdt(request.credit_usdt ?? request.amount_usdt)}</span>
            </div>
          ))}
        </HistoryPanel>

        <HistoryPanel title="예치금 거래 내역" icon="ledger" empty="거래 내역이 없습니다.">
          {ledger.map((entry) => (
            <div key={entry.id} className="px-3 py-2.5 grid grid-cols-[72px_1fr_auto] items-center gap-3 text-[12.5px]">
              <span className={cn("text-[10.5px] font-mono uppercase px-1.5 py-0.5 border rounded-sm w-fit", entry.amount_usdt > 0 ? "text-neon border-neon/40 bg-neon/10" : "text-muted-foreground border-border")}>{ledgerKindLabel[entry.kind]}</span>
              <div className="min-w-0">
                <div className="text-[11.5px] truncate">{entry.memo || entry.status}</div>
                <div className="font-mono text-[10.5px] text-muted-foreground">{formatDate(entry.created_at)}</div>
              </div>
              <span className={cn("font-mono text-right", entry.amount_usdt > 0 ? "text-neon" : "text-foreground")}>{entry.amount_usdt > 0 ? "+" : ""}{formatUsdt(entry.amount_usdt)}</span>
            </div>
          ))}
        </HistoryPanel>
      </div>
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="border border-border rounded-md p-4 bg-card">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono">{k}</div>
      <div className="font-display text-xl font-semibold mt-0.5">{v}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function HistoryPanel({ title, children, empty, icon }: { title: string; children: React.ReactNode; empty: string; icon: "deposit" | "ledger" }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="border border-border rounded-md bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-background/40">
        {icon === "deposit" ? <ArrowDownToLine className="h-3.5 w-3.5 text-neon" /> : <History className="h-3.5 w-3.5 text-cyan" />}
        <span className="text-[12.5px] font-semibold">{title}</span>
      </div>
      <div className="divide-y divide-border">
        {hasChildren ? children : <div className="p-4 text-center text-[12px] text-muted-foreground">{empty}</div>}
      </div>
    </div>
  );
}
