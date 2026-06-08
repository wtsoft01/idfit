import { Lock, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export function LockedOverlay() {
  return (
    <div className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/0 backdrop-blur-[2px]" />
      <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col items-center text-center gap-3 pointer-events-auto">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          <Lock className="h-3 w-3" /> 무료 미리보기는 10분 지연 데이터로 제공
        </div>
        <div className="font-display text-lg md:text-2xl font-semibold max-w-md">
          로그인하면 <span className="text-neon glow-text">실시간</span> Deal Board가 열립니다
        </div>
        <Link
          to="/auth"
          className="inline-flex items-center gap-1.5 h-10 px-5 rounded-sm bg-neon text-[hsl(240_10%_4%)] text-[13px] font-semibold hover:brightness-110 transition shadow-neon"
        >
          <Zap className="h-4 w-4" /> 무료 등록하고 실시간 열기
        </Link>
      </div>
    </div>
  );
}
