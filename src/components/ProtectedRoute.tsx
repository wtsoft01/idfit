import { Navigate } from "react-router-dom";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { Loader2, ShieldAlert } from "lucide-react";

const STAFF_ROLES: AppRole[] = ["owner", "admin", "operator", "support"];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <RouteLoader />;
  if (!user) return <Navigate to="/auth" replace />;

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <RouteLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!profile || !STAFF_ROLES.includes(profile.role)) return <AccessDenied />;

  return <>{children}</>;
}

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-sm w-full border border-border bg-card rounded-md p-6 text-center space-y-3">
        <div className="mx-auto h-10 w-10 rounded-full border border-destructive/30 bg-destructive/10 flex items-center justify-center text-destructive">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <h1 className="font-display text-lg font-bold">관리자 권한이 필요합니다</h1>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          현재 계정은 고객 권한입니다. 관리자 페이지는 owner, admin, operator, support 권한만 접근할 수 있습니다.
        </p>
        <a href="/app/board" className="inline-flex h-9 px-4 items-center justify-center rounded-sm bg-neon text-[hsl(240_10%_4%)] text-[12.5px] font-semibold">
          사용자 화면으로 이동
        </a>
      </div>
    </div>
  );
}

export function isStaffRole(role?: AppRole | null) {
  return !!role && STAFF_ROLES.includes(role);
}
