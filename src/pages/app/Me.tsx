import { useState } from "react";
import { Copy, QrCode, ArrowDownToLine, ArrowUpFromLine, Wallet, History, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Network = "TRC20" | "BEP20" | "ERC20";

const DEPOSIT_ADDR: Record<Network, string> = {
  TRC20: "TXk9bN3QzPmGv4Vc8a1Fx4Pn8Vq2sLm7",
  BEP20: "0x9b2C4f1eA8Bd7c0d34CcA1b8F9aE3D2c6B5e0F11",
  ERC20: "0x1d5E73Bc2A0fF914C6dD2bA8e91FfC3a4B8C9aD2",
};

const HISTORY = [
  { id: 1, kind: "deposit",  net: "TRC20", amount: 100,    at: "2026-06-07 14:21", status: "confirmed", tx: "5ad2…f81c" },
  { id: 2, kind: "purchase", net: "—",     amount: -14.8,  at: "2026-06-06 09:12", status: "complete",  tx: "DS-20294" },
  { id: 3, kind: "withdraw", net: "TRC20", amount: -25,    at: "2026-06-04 22:40", status: "complete",  tx: "9c83…4aa1" },
  { id: 4, kind: "refund",   net: "TRC20", amount: 14.8,   at: "2026-06-02 11:05", status: "complete",  tx: "AS-3022" },
];

export default function UserMe() {
  const [tab, setTab] = useState<"deposit" | "withdraw" | "addresses">("deposit");
  const [net, setNet] = useState<Network>("TRC20");
  const [withdrawAmt, setWithdrawAmt] = useState<string>("");
  const [withdrawAddr, setWithdrawAddr] = useState<string>("");
  const [withdrawNet, setWithdrawNet] = useState<Network>("TRC20");
  const [savedAddrs, setSavedAddrs] = useState<{ id: string; label: string; net: Network; addr: string }[]>([
    { id: "k1", label: "내 바이낸스 출금", net: "TRC20", addr: "TG7n9XmKpQ2vBhCxJyR4dEfZ8WaUoLpN3M" },
  ]);
  const [newLabel, setNewLabel] = useState("");
  const [newAddr, setNewAddr] = useState("");
  const [newNet, setNewNet] = useState<Network>("TRC20");

  const copy = (s: string) => {
    navigator.clipboard?.writeText(s);
    toast.success("주소를 복사했습니다");
  };

  const submitWithdraw = () => {
    if (!withdrawAmt || Number(withdrawAmt) <= 0) return toast.error("출금 금액을 입력하세요");
    if (!withdrawAddr.trim()) return toast.error("출금 주소를 입력하세요");
    toast.success(`${withdrawAmt} USDT (${withdrawNet}) 출금 요청이 접수되었습니다 — 보안 확인 후 약 1분 내 전송`);
    setWithdrawAmt("");
  };

  const addAddr = () => {
    if (!newLabel.trim() || !newAddr.trim()) return toast.error("라벨과 주소를 모두 입력하세요");
    setSavedAddrs((p) => [{ id: Math.random().toString(36).slice(2, 6), label: newLabel.trim(), net: newNet, addr: newAddr.trim() }, ...p]);
    setNewLabel(""); setNewAddr("");
    toast.success("출금 주소가 저장되었습니다");
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl">
      <div>
        <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest mb-1">wallet</div>
        <h1 className="font-display text-xl md:text-2xl font-bold">지갑 / 마이페이지</h1>
      </div>

      {/* 잔액 카드 */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-1 border border-border rounded-md p-4 bg-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted-foreground inline-flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> 예치 잔액</span>
            <span className="text-[10.5px] font-mono uppercase text-neon">USDT</span>
          </div>
          <div className="font-mono text-3xl font-bold text-usdt leading-none">128.42</div>
          <div className="text-[10.5px] font-mono text-muted-foreground">≈ $128.42 USD · ₩175,940</div>
        </div>
        <Stat k="이번 달 누적 구매" v="$184.20" sub="-12.4% vs 공식가" />
        <Stat k="진행 중 주문 / AS" v="2 / 1" sub="평균 처리 18분" />
      </div>

      {/* 탭 */}
      <div className="border border-border rounded-md bg-card">
        <div className="flex border-b border-border">
          {[
            { id: "deposit",   label: "입금", icon: ArrowDownToLine },
            { id: "withdraw",  label: "출금", icon: ArrowUpFromLine },
            { id: "addresses", label: "내 출금 주소", icon: Wallet },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-2 h-10 text-[12.5px] border-b-2 transition-colors",
                tab === t.id ? "border-neon text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "deposit" && (
          <div className="p-4 grid md:grid-cols-[auto_1fr] gap-5">
            <div className="space-y-2">
              <div className="h-32 w-32 bg-foreground rounded-sm flex items-center justify-center">
                <QrCode className="h-24 w-24 text-background" />
              </div>
              <div className="flex gap-1">
                {(["TRC20","BEP20","ERC20"] as Network[]).map((n) => (
                  <button
                    key={n}
                    onClick={() => setNet(n)}
                    className={cn(
                      "flex-1 h-7 text-[11px] font-mono uppercase border rounded-sm",
                      net === n ? "bg-neon text-[hsl(240_10%_4%)] border-neon" : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >{n}</button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground">{net} 입금 주소</div>
                <div className="font-mono text-[12.5px] break-all mt-1 text-foreground border border-border rounded-sm px-2 py-2 bg-background/40">
                  {DEPOSIT_ADDR[net]}
                </div>
                <button onClick={() => copy(DEPOSIT_ADDR[net])} className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-neon hover:underline">
                  <Copy className="h-3 w-3" /> 주소 복사
                </button>
              </div>
              <ul className="text-[11.5px] text-muted-foreground space-y-1 list-disc pl-4">
                <li>최소 입금액: <span className="font-mono text-foreground">5 USDT</span> · 미만 입금분은 자동 반영되지 않습니다</li>
                <li>{net} 네트워크 외 다른 체인 전송 시 복구가 불가합니다</li>
                <li>네트워크 컨펌 1회 후 잔액에 반영됩니다 (TRC20 기준 약 30초)</li>
              </ul>
            </div>
          </div>
        )}

        {tab === "withdraw" && (
          <div className="p-4 grid md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <Field label="출금 네트워크">
                <div className="flex gap-1">
                  {(["TRC20","BEP20","ERC20"] as Network[]).map((n) => (
                    <button
                      key={n}
                      onClick={() => setWithdrawNet(n)}
                      className={cn(
                        "h-9 px-3 text-[11.5px] font-mono uppercase border rounded-sm",
                        withdrawNet === n ? "bg-neon text-[hsl(240_10%_4%)] border-neon" : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >{n}</button>
                  ))}
                </div>
              </Field>
              <Field label="출금 주소">
                <Input value={withdrawAddr} onChange={(e) => setWithdrawAddr(e.target.value)} placeholder="USDT 수신 지갑 주소 (저장된 주소에서 선택 가능)" className="h-9 text-[12.5px] font-mono" />
                {savedAddrs.filter((a) => a.net === withdrawNet).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {savedAddrs.filter((a) => a.net === withdrawNet).map((a) => (
                      <button key={a.id} onClick={() => setWithdrawAddr(a.addr)} className="h-7 px-2 text-[11px] border border-border rounded-sm hover:border-foreground/40">
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </Field>
              <Field label="금액 (USDT)">
                <div className="flex gap-2">
                  <Input type="number" value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)} placeholder="0.00" className="h-9 text-[13px] font-mono" />
                  <button onClick={() => setWithdrawAmt("128.42")} className="h-9 px-3 text-[11px] border border-border rounded-sm hover:bg-muted">MAX</button>
                </div>
                <div className="mt-1.5 text-[11px] text-muted-foreground font-mono flex justify-between">
                  <span>네트워크 수수료 1.0 USDT</span>
                  <span>사용 가능 128.42</span>
                </div>
              </Field>
              <button onClick={submitWithdraw} className="w-full h-10 bg-neon text-[hsl(240_10%_4%)] text-[13px] font-semibold rounded-sm hover:brightness-110">
                출금 요청
              </button>
            </div>

            <div className="border border-border rounded-sm p-3 bg-background/40 space-y-2 text-[12px]">
              <div className="font-semibold">보안 안내</div>
              <ul className="text-muted-foreground space-y-1 list-disc pl-4">
                <li>출금 요청 후 1차 메일 / 텔레그램 2단계 인증을 통과해야 처리됩니다</li>
                <li>처음 등록한 주소로의 첫 출금은 24시간 모니터링 후 처리됩니다</li>
                <li>출금 한도: 24시간 기준 <span className="font-mono text-foreground">5,000 USDT</span></li>
                <li>네트워크 / 주소 오입력에 의한 손실은 복구되지 않습니다</li>
              </ul>
            </div>
          </div>
        )}

        {tab === "addresses" && (
          <div className="p-4 space-y-4">
            <div className="grid md:grid-cols-[1fr_1.6fr_auto_auto] gap-2 items-end">
              <Field label="라벨">
                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="예: 바이낸스 메인" className="h-9 text-[12.5px]" />
              </Field>
              <Field label="주소">
                <Input value={newAddr} onChange={(e) => setNewAddr(e.target.value)} placeholder="USDT 지갑 주소" className="h-9 text-[12.5px] font-mono" />
              </Field>
              <Field label="네트워크">
                <select value={newNet} onChange={(e) => setNewNet(e.target.value as Network)} className="h-9 px-2 text-[12.5px] bg-background border border-border rounded-sm">
                  <option>TRC20</option><option>BEP20</option><option>ERC20</option>
                </select>
              </Field>
              <button onClick={addAddr} className="h-9 px-3 inline-flex items-center gap-1.5 bg-neon text-[hsl(240_10%_4%)] text-[12px] font-semibold rounded-sm">
                <Plus className="h-3.5 w-3.5" /> 저장
              </button>
            </div>

            <div className="border border-border rounded-sm divide-y divide-border">
              {savedAddrs.length === 0 ? (
                <div className="p-4 text-center text-[12px] text-muted-foreground">저장된 출금 주소가 없습니다.</div>
              ) : savedAddrs.map((a) => (
                <div key={a.id} className="px-3 py-2.5 flex items-center gap-3 text-[12.5px]">
                  <span className="font-mono text-[10.5px] uppercase px-1.5 py-0.5 border border-border rounded-sm">{a.net}</span>
                  <span className="text-foreground">{a.label}</span>
                  <span className="font-mono text-[11.5px] text-muted-foreground truncate flex-1">{a.addr}</span>
                  <button onClick={() => copy(a.addr)} className="h-7 w-7 inline-flex items-center justify-center border border-border rounded-sm text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setSavedAddrs((p) => p.filter((x) => x.id !== a.id))} className="h-7 w-7 inline-flex items-center justify-center border border-border rounded-sm text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 거래 내역 */}
      <div className="border border-border rounded-md bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-background/40">
          <History className="h-3.5 w-3.5 text-cyan" />
          <span className="text-[12.5px] font-semibold">최근 거래 내역</span>
        </div>
        <div className="divide-y divide-border text-[12.5px]">
          {HISTORY.map((h) => (
            <div key={h.id} className="px-3 py-2.5 grid grid-cols-[110px_90px_1fr_auto_120px] items-center gap-3">
              <span className={cn(
                "text-[10.5px] font-mono uppercase px-1.5 py-0.5 border rounded-sm w-fit",
                h.kind === "deposit" ? "text-neon border-neon/40 bg-neon/10"
                : h.kind === "refund" ? "text-cyan border-cyan/40 bg-cyan/10"
                : h.kind === "withdraw" ? "text-usdt border-usdt/40 bg-usdt/10"
                : "text-muted-foreground border-border"
              )}>{h.kind}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{h.net}</span>
              <span className="font-mono text-[11px] text-muted-foreground truncate">{h.tx}</span>
              <span className={cn("font-mono text-right", h.amount > 0 ? "text-neon" : "text-foreground")}>
                {h.amount > 0 ? "+" : ""}{h.amount.toFixed(2)} USDT
              </span>
              <span className="font-mono text-[11px] text-muted-foreground text-right">{h.at}</span>
            </div>
          ))}
        </div>
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
