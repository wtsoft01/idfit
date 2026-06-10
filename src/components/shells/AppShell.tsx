import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { BrandLockup } from "@/components/Brand";
import { Radio, Wallet, ReceiptText, Menu, LogOut, Shield, LifeBuoy, Headset } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isStaffRole } from "@/components/ProtectedRoute";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const items = [
  { to: "/app/board", label: "Live Board", icon: Radio },
  { to: "/app/orders", label: "내 주문", icon: ReceiptText },
  { to: "/app/as", label: "AS 신청", icon: LifeBuoy },
  { to: "/app/me", label: "지갑 / 예치금", icon: Wallet },
  { to: "/app/support", label: "상담 / FAQ", icon: Headset },
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
