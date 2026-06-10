import { useEffect, useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isStaffRole } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { BrandLockup } from "@/components/Brand";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const { user, profile, loading, signIn, signUp, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || isStaffRole(profile?.role)) return;

    setNotice("관리자 권한이 없는 이전 로그인 세션을 정리했습니다. 관리자 계정으로 다시 로그인하세요.");
    signOut().catch(() => undefined);
  }, [loading, user, profile?.role, signOut]);

  if (user && isStaffRole(profile?.role)) return <Navigate to="/app/board" replace />;

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    setIsSubmitting(true);
    try {
      await signIn(loginEmail.trim(), loginPassword);
      await refreshProfile();
      toast({ title: "로그인 완료" });
      navigate("/app/board", { replace: true });
    } catch (error: any) {
      const message = error?.message ?? "로그인에 실패했습니다.";
      setNotice(message);
      toast({ title: "로그인 실패", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (signupPassword.length < 6) {
      const message = "비밀번호는 최소 6자 이상이어야 합니다.";
      setNotice(message);
      toast({ title: "비밀번호가 짧습니다", description: message, variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await signUp(signupEmail.trim(), signupPassword, signupName.trim());
      const message = result.session
        ? "가입 및 로그인 완료. 관리자 페이지로 이동할 수 있습니다."
        : "가입 요청 완료. 이메일 확인 설정이 켜져 있으면 메일 인증 후 로그인하세요.";
      setNotice(message);
      toast({ title: "가입 처리 완료", description: message });
    } catch (error: any) {
      const message = error?.message ?? "가입 처리에 실패했습니다.";
      setNotice(message);
      toast({ title: "가입 실패", description: message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative">
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="relative w-full max-w-[420px] border border-border rounded-md p-8 space-y-6 bg-card">
        <div className="flex flex-col items-start gap-3">
          <Link to="/" className="hover:opacity-80 transition-opacity"><BrandLockup size={18} /></Link>
          <p className="text-[13px] text-muted-foreground">
            IDFIT 관리자 계정을 만들고 수집 소스, 원본 피드, 상품 후보를 관리하세요. 첫 가입자는 자동 owner 권한으로 생성됩니다.
          </p>
        </div>

        {notice && (
          <div className="border border-border bg-muted/40 rounded-md px-3 py-2 text-[12.5px] text-muted-foreground whitespace-pre-wrap">
            {notice}
          </div>
        )}

        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2 h-9 p-0.5">
            <TabsTrigger value="login" className="text-[12px]">로그인</TabsTrigger>
            <TabsTrigger value="signup" className="text-[12px]">회원가입</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[12px]">이메일</Label>
                <Input type="email" placeholder="admin@example.com" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required className="h-8 text-[13px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px]">비밀번호</Label>
                <Input type="password" placeholder="••••••••" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required className="h-8 text-[13px]" />
              </div>
              <Button type="submit" className="w-full h-8 text-[13px]" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                로그인
              </Button>
            </form>
            {loading && (
              <p className="mt-2 text-[11px] text-muted-foreground">세션을 확인하는 중입니다. 바로 로그인 입력은 가능합니다.</p>
            )}
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <form onSubmit={handleSignup} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[12px]">이름</Label>
                <Input type="text" placeholder="관리자" value={signupName} onChange={(event) => setSignupName(event.target.value)} required className="h-8 text-[13px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px]">이메일</Label>
                <Input type="email" placeholder="admin@example.com" value={signupEmail} onChange={(event) => setSignupEmail(event.target.value)} required className="h-8 text-[13px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px]">비밀번호</Label>
                <Input type="password" placeholder="최소 6자" value={signupPassword} onChange={(event) => setSignupPassword(event.target.value)} required minLength={6} className="h-8 text-[13px]" />
              </div>
              <Button type="submit" className="w-full h-8 text-[13px]" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                관리자 계정 만들기
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-left text-[11px] text-muted-foreground pt-2">
          © {new Date().getFullYear()} IDFIT · AI account operations
        </p>
      </div>
    </div>
  );
}
