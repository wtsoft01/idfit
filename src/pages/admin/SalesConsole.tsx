import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatUsdt4 } from "@/lib/payment-amount";
import { cn } from "@/lib/utils";

type SalesMember = {
  user_id: string;
  full_name: string;
  email: string | null;
  created_at: string;
  orders_count: number;
  gross_sales_usdt: number;
  net_profit_usdt: number;
  commission_usdt: number;
};

type SalesCode = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  status: string;
  commission_percent: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

export default function SalesConsole() {
  const { user, profile } = useAuth();
  const [salesCode, setSalesCode] = useState<SalesCode | null>(null);
  const [members, setMembers] = useState<SalesMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: codeRows, error: codeError }, { data: memberRows, error: memberError }] = await Promise.all([
      supabase.from("sales_team_codes").select("id, code, name, email, status, commission_percent").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("idfit_my_sales_members"),
    ]);
    if (codeError && codeError.code !== "PGRST116") toast.error(`영업코드 조회 실패: ${codeError.message}`);
    if (memberError) toast.error(`추천회원 조회 실패: ${memberError.message}`);
    setSalesCode((codeRows ?? null) as SalesCode | null);
    setMembers((memberRows ?? []) as SalesMember[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const filteredMembers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return members;
    return members.filter((member) => [member.full_name, member.email, member.user_id].some((value) => value?.toLowerCase().includes(keyword)));
  }, [members, query]);

  const totals = useMemo(() => members.reduce((acc, member) => ({
    orders: acc.orders + Number(member.orders_count ?? 0),
    gmv: acc.gmv + Number(member.gross_sales_usdt ?? 0),
    profit: acc.profit + Number(member.net_profit_usdt ?? 0),
    commission: acc.commission + Number(member.commission_usdt ?? 0),
  }), { orders: 0, gmv: 0, profit: 0, commission: 0 }), [members]);

  const copyCode = async () => {
    if (!salesCode?.code) return;
    await navigator.clipboard.writeText(salesCode.code);
    toast.success("추천코드를 복사했습니다.");
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold">영업자 콘솔</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1">내 추천코드로 가입한 회원과 구매금액, 순수익 기준 커미션을 확인합니다.</p>
        </div>
        <button onClick={loadData} disabled={loading} className="h-9 px-3 border border-border rounded-sm text-[12.5px] inline-flex items-center gap-1.5 disabled:opacity-60"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />새로고침</button>
      </div>

      <section className="border border-border rounded-md bg-card p-4 grid gap-4 lg:grid-cols-[1fr_auto] items-center">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">MY REFERRAL CODE</div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <button onClick={copyCode} disabled={!salesCode?.code} className="font-display text-3xl font-bold text-neon font-mono inline-flex items-center gap-2 disabled:opacity-50">{salesCode?.code ?? profile?.referral_code ?? "미연결"}<Copy className="h-4 w-4" /></button>
            <span className="text-[12px] text-muted-foreground">커미션 {salesCode?.commission_percent ?? 0}% · {salesCode?.status ?? "대기"}</span>
          </div>
          <p className="text-[11.5px] text-muted-foreground mt-2">회원가입 시 이 5자리 코드를 입력한 회원의 결제완료 주문만 커미션 계산에 반영됩니다.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 min-w-[260px]">
          <MiniStat label="추천회원" value={`${members.length}명`} />
          <MiniStat label="구매건수" value={`${totals.orders}건`} />
          <MiniStat label="구매금액" value={`${formatUsdt4(totals.gmv)} USDT`} />
          <MiniStat label="커미션" value={`${formatUsdt4(totals.commission)} USDT`} accent />
        </div>
      </section>

      <section className="border border-border rounded-md bg-card overflow-hidden">
        <div className="px-4 min-h-10 py-2 flex items-center justify-between gap-3 border-b border-border flex-wrap">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold"><Users className="h-4 w-4 text-neon" />추천회원 리스트</div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="회원명, 이메일 검색" className="h-8 w-full sm:w-72 bg-background border border-border rounded-sm px-3 text-[12px] outline-none focus:border-neon" />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[1.2fr_1.4fr_0.8fr_0.8fr_0.9fr_0.9fr_0.9fr] px-4 h-9 items-center text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
              <span>회원</span><span>이메일/ID</span><span>가입일</span><span>구매</span><span>구매금액</span><span>순수익</span><span>커미션</span>
            </div>
            {loading ? <Empty text="영업 데이터를 불러오는 중입니다..." /> : filteredMembers.length === 0 ? <Empty text="추천코드로 가입한 회원이 아직 없습니다." /> : filteredMembers.map((member) => (
              <div key={member.user_id} className="grid grid-cols-[1.2fr_1.4fr_0.8fr_0.8fr_0.9fr_0.9fr_0.9fr] px-4 min-h-11 py-2 items-center text-[12.5px] border-b border-border last:border-0 gap-2">
                <span className="truncate font-medium">{member.full_name || "이름 미등록"}</span>
                <div className="min-w-0"><div className="truncate font-mono">{member.email ?? "이메일 미등록"}</div><div className="truncate text-[10.5px] text-muted-foreground font-mono">{member.user_id.slice(0, 8)}</div></div>
                <span className="font-mono text-muted-foreground">{formatDate(member.created_at)}</span>
                <span className="font-mono">{member.orders_count}</span>
                <span className="font-mono text-usdt">{formatUsdt4(member.gross_sales_usdt)}</span>
                <span className="font-mono text-neon">{formatUsdt4(member.net_profit_usdt)}</span>
                <span className="font-mono text-neon">{formatUsdt4(member.commission_usdt)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="border border-border rounded-sm p-3 bg-background"><div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono">{label}</div><div className={cn("font-display text-lg font-semibold mt-1", accent && "text-neon")}>{value}</div></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">{text}</div>;
}
