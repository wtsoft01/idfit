import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { BrandLockup } from "@/components/Brand";
import { Activity, Database, Radio, Wallet, ReceiptText, Menu, LogOut, Shield, LifeBuoy, Megaphone, Search, ShoppingCart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isStaffRole } from "@/components/ProtectedRoute";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type SidebarStats = {
  markets: number;
  collectedToday: number;
  ordersToday: number;
  lastReceivedAt: string | null;
  collectBuckets: number[];
  orderBuckets: number[];
};

function SidebarLiveStats() {
  const [stats, setStats] = useState<SidebarStats>({ markets: 0, collectedToday: 0, ordersToday: 0, lastReceivedAt: null, collectBuckets: Array(12).fill(0), orderBuckets: Array(12).fill(0) });

  const loadStats = async () => {
    if (!isSupabaseConfigured) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const since = new Date(Date.now() - 120 * 60 * 1000).toISOString();
    const [{ data: marketRows }, { count: markets, error: marketsError }, { count: collectedToday, error: collectedError }, { count: ordersToday }, { data: latest }, { data: recentRaw }, { data: recentOrders }] = await Promise.all([
      supabase.from("visible_products").select("source_label").or("stock_count.is.null,stock_count.gt.0").limit(1000),
      supabase.from("telegram_sources").select("id", { count: "exact", head: true }),
      supabase.from("raw_messages").select("id", { count: "exact", head: true }).gte("received_at", today.toISOString()),
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
      supabase.from("visible_products").select("last_synced_at").order("last_synced_at", { ascending: false, nullsFirst: false }).limit(1),
      supabase.from("raw_messages").select("received_at").gte("received_at", since).order("received_at", { ascending: false }).limit(300),
      supabase.from("orders").select("created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(120),
    ]);
    const fallbackMarketCount = new Set((marketRows ?? []).map((row) => row.source_label).filter(Boolean)).size;
    setStats({
      markets: marketsError ? fallbackMarketCount : markets ?? fallbackMarketCount,
      collectedToday: collectedError ? 0 : collectedToday ?? 0,
      ordersToday: ordersToday ?? 0,
      lastReceivedAt: latest?.[0]?.last_synced_at ?? null,
      collectBuckets: bucketTimes((recentRaw ?? []).map((row) => row.received_at)),
      orderBuckets: bucketTimes((recentOrders ?? []).map((row) => row.created_at)),
    });
  };

  useEffect(() => {
    loadStats();
    const timer = window.setInterval(loadStats, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const lastLabel = stats.lastReceivedAt
    ? `${Math.max(0, Math.round((Date.now() - new Date(stats.lastReceivedAt).getTime()) / 60000))}분 전`
    : "대기";

  return (
    <div className="mx-2 mb-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-2 text-[10.5px] text-sidebar-foreground/80 space-y-2">
      <div className="flex items-center gap-1.5 text-neon font-semibold">
        <Activity className="h-3 w-3 animate-pulse" /> 수집 현황
      </div>
      <LiveOrderBook collectBuckets={stats.collectBuckets} orderBuckets={stats.orderBuckets} />
      <div className="grid grid-cols-3 gap-1 text-center font-mono">
        <div className="rounded-sm bg-background/35 p-1"><div className="text-neon">{stats.collectedToday}</div><div className="text-[9px] text-muted-foreground">오늘수집</div></div>
        <div className="rounded-sm bg-background/35 p-1"><div className="text-usdt">{stats.ordersToday}</div><div className="text-[9px] text-muted-foreground">오늘주문</div></div>
        <div className="rounded-sm bg-background/35 p-1"><div>{stats.markets}</div><div className="text-[9px] text-muted-foreground">마켓</div></div>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Database className="h-3 w-3" /> 마지막 수집 {lastLabel}</div>
    </div>
  );
}

function bucketTimes(times: string[]) {
  const buckets = Array(12).fill(0) as number[];
  const now = Date.now();
  for (const time of times) {
    const ageMinutes = Math.floor((now - new Date(time).getTime()) / 60000);
    if (ageMinutes < 0 || ageMinutes >= 120) continue;
    const index = 11 - Math.floor(ageMinutes / 10);
    buckets[index] += 1;
  }
  return buckets;
}

function LiveOrderBook({ collectBuckets, orderBuckets }: { collectBuckets: number[]; orderBuckets: number[] }) {
  const max = Math.max(1, ...collectBuckets, ...orderBuckets);
  const rows = collectBuckets.map((collect, index) => ({ collect, order: orderBuckets[index] ?? 0, label: index === collectBuckets.length - 1 ? "NOW" : `-${(collectBuckets.length - index - 1) * 10}m` })).slice(-8);
  return (
    <div className="rounded-sm border border-sidebar-border bg-background/25 p-1.5 space-y-1 font-mono">
      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
        <span>COLLECT</span><span>LIVE FLOW</span><span>SALE</span>
      </div>
      <div className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[1fr_34px_1fr] items-center gap-1 text-[9px]">
            <div className="flex justify-end"><span className="h-2 rounded-[1px] bg-neon/80 shadow-[0_0_8px_rgba(73,255,176,0.45)]" style={{ width: `${Math.max(8, (row.collect / max) * 100)}%` }} /></div>
            <div className="text-center text-muted-foreground">{row.label}</div>
            <div className="flex justify-start"><span className="h-2 rounded-[1px] bg-usdt/80 shadow-[0_0_8px_rgba(34,211,238,0.35)]" style={{ width: `${Math.max(8, (row.order / max) * 100)}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground"><span>수집 체결감</span><span className="inline-flex items-center gap-1 text-usdt"><ShoppingCart className="h-2.5 w-2.5" />주문</span></div>
    </div>
  );
}

const items = [
  { to: "/app/board", label: "Live Board", icon: Radio },
  { to: "/app/search-reservations", label: "상품찾기예약", icon: Search },
  { to: "/app/orders", label: "내 주문", icon: ReceiptText },
  { to: "/app/as", label: "AS 신청", icon: LifeBuoy },
  { to: "/app/me", label: "지갑 / 예치금", icon: Wallet },
  { to: "/app/support", label: "공지 / FAQ", icon: Megaphone },
];

function Nav({ onNav, isAdmin }: { onNav?: () => void; isAdmin?: boolean }) {
  const { profile, signOut } = useAuth();
  return (
    <div className="flex flex-col h-full">
      <div className="h-14 px-3 flex items-center border-b border-sidebar-border">
        <Link to="/" onClick={onNav}><BrandLockup size={16} /></Link>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            onClick={onNav}
            className={({ isActive }) => cn(
              "flex items-center gap-2 px-2.5 h-9 text-[12.5px] rounded-sm",
              isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <it.icon className="h-4 w-4" /> {it.label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            onClick={onNav}
            className="flex items-center gap-2 px-2.5 h-9 text-[12.5px] rounded-sm text-neon hover:bg-sidebar-accent mt-2 border-t border-sidebar-border pt-3"
          >
            <Shield className="h-4 w-4" /> 관리자 콘솔
          </NavLink>
        )}
      </nav>
      <SidebarLiveStats />
      <div className="border-t border-sidebar-border p-2 flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-neon/40 to-cyan/30 flex items-center justify-center text-[11px] font-semibold">
          {(profile?.full_name || "U").charAt(0).toUpperCase()}
        </div>
        <div className="text-[11.5px] truncate flex-1 text-sidebar-foreground">{profile?.full_name || "User"}</div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={signOut}><LogOut className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();
  const isAdmin = isStaffRole(profile?.role);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex flex-col w-56 bg-sidebar border-r border-sidebar-border sticky top-0 h-screen">
        <Nav isAdmin={isAdmin} />
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-30 h-12 px-3 border-b border-border bg-background flex items-center justify-between">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Menu className="h-4 w-4" /></Button></SheetTrigger>
            <SheetContent side="left" className="p-0 w-56 bg-sidebar"><Nav onNav={() => setOpen(false)} isAdmin={isAdmin} /></SheetContent>
          </Sheet>
          <BrandLockup size={14} />
          <div className="w-8" />
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
