import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { BrandLockup } from "@/components/Brand";
import {
  Radio, Filter, Database, Boxes, Tag, ShoppingBag, LineChart, Bot, MessageSquare, Settings as Cog, Menu, LogOut, ArrowLeft, Globe
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { I18nProvider, useT, LANGS, Lang } from "@/lib/i18n";

const adminItems = [
  { to: "/admin/sources", key: "nav.sources", icon: Radio },
  { to: "/admin/filters", key: "nav.filters", icon: Filter },
  { to: "/admin/raw", key: "nav.raw", icon: Database },
  { to: "/admin/candidates", key: "nav.candidates", icon: Boxes },
  { to: "/admin/pricing", key: "nav.pricing", icon: Tag },
  { to: "/admin/orders", key: "nav.orders", icon: ShoppingBag },
  { to: "/admin/revenue", key: "nav.revenue", icon: LineChart },
  { to: "/admin/automation", key: "nav.automation", icon: Bot },
  { to: "/admin/chat", key: "nav.chat", icon: MessageSquare },
  { to: "/admin/settings", key: "nav.settings", icon: Cog },
];

function LanguageSwitcher() {
  const { lang, setLang } = useT();
  return (
    <div className="flex items-center gap-1.5">
      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="h-7 px-1.5 text-[11.5px] bg-background border border-border rounded-sm font-mono"
      >
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </div>
  );
}

function KpiBar() {
  const { t } = useT();
  const kpis = [
    { label: t("kpi.gmv"), value: "$12,847", trend: "+18%" },
    { label: t("kpi.orders"), value: "284", trend: "+11" },
    { label: t("kpi.sources"), value: "327 / 341", trend: "" },
    { label: t("kpi.filter"), value: "27.4%", trend: "+1.8%" },
    { label: t("kpi.as"), value: "6", trend: "" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border border-b border-border">
      {kpis.map((k) => (
        <div key={k.label} className="bg-background px-4 py-2.5">
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono">{k.label}</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="font-display text-lg font-semibold">{k.value}</span>
            {k.trend && <span className="text-[11px] text-neon font-mono">{k.trend}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Nav({ onNav }: { onNav?: () => void }) {
  const { profile, signOut } = useAuth();
  const { t } = useT();
  return (
    <div className="flex flex-col h-full">
      <div className="h-14 px-3 flex items-center border-b border-sidebar-border">
        <Link to="/" onClick={onNav}><BrandLockup size={16} /></Link>
      </div>
      <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground font-mono border-b border-sidebar-border flex items-center justify-between gap-2">
        <span>{t("admin.console")}</span>
      </div>
      <div className="px-3 py-2 border-b border-sidebar-border">
        <LanguageSwitcher />
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-auto">
        {adminItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            onClick={onNav}
            className={({ isActive }) => cn(
              "flex items-center gap-2 px-2.5 h-9 text-[12.5px] rounded-sm",
              isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <it.icon className="h-4 w-4" /> {t(it.key)}
          </NavLink>
        ))}
        <Link to="/app/board" onClick={onNav} className="flex items-center gap-2 px-2.5 h-9 text-[12px] text-muted-foreground hover:text-foreground mt-3 border-t border-sidebar-border pt-3">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("admin.userArea")}
        </Link>
      </nav>
      <div className="border-t border-sidebar-border p-2 flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-neon/20 border border-neon/40 flex items-center justify-center text-[11px] font-semibold text-neon">
          {(profile?.full_name || "A").charAt(0).toUpperCase()}
        </div>
        <div className="text-[11.5px] truncate flex-1 text-sidebar-foreground">
          {profile?.full_name || "Admin"} <span className="text-neon font-mono ml-1">·admin</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={signOut}><LogOut className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

export function AdminShell() {
  const [open, setOpen] = useState(false);
  return (
    <I18nProvider>
      <div className="flex min-h-screen bg-background">
        <aside className="hidden md:flex flex-col w-60 bg-sidebar border-r border-sidebar-border sticky top-0 h-screen">
          <Nav />
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="md:hidden sticky top-0 z-30 h-12 px-3 border-b border-border bg-background flex items-center justify-between">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><Menu className="h-4 w-4" /></Button></SheetTrigger>
              <SheetContent side="left" className="p-0 w-60 bg-sidebar"><Nav onNav={() => setOpen(false)} /></SheetContent>
            </Sheet>
            <span className="text-[12px] font-mono uppercase tracking-widest text-neon">Admin</span>
            <LanguageSwitcher />
          </header>
          <KpiBar />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </I18nProvider>
  );
}
