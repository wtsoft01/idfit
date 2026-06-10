import { LiveBoard } from "@/components/deal/LiveBoard";
import { AIScanLog } from "@/components/deal/AIScanLog";
import { AvailableProducts } from "@/components/deal/AvailableProducts";
import { PriceAlertDialogButton } from "@/components/deal/PriceAlertDialog";
import { Activity, Globe, ShieldCheck, Sparkles } from "lucide-react";

export default function UserBoard() {
  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="relative overflow-hidden rounded-md border border-border bg-card/70 backdrop-blur px-4 py-4 lg:px-5 lg:py-5">
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/80 to-transparent pulse-dot" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.28em]">
              <span className="inline-flex items-center gap-1 rounded-full border border-neon/40 bg-neon/10 px-2.5 py-1 text-neon">
                <Activity className="h-3.5 w-3.5 pulse-dot" /> 실시간 감시 중
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-1 text-muted-foreground">
                <Globe className="h-3.5 w-3.5" /> 글로벌 마켓 수집
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-1 text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-usdt" /> 허위상품 필터링
              </span>
            </div>

            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold leading-tight">Global ID Market Scanner</h1>
              <p className="text-[12.5px] text-muted-foreground mt-1 max-w-2xl">
                전세계 공급처 데이터를 실시간 대량 수집하고, 허위상품·판매자 검증을 거쳐 즉시 구매 가능한 ID만 빠르게 노출합니다.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <StatusCard
                title="1. 대량 수집"
                description="전세계 텔레그램·웹 공급처를 지속적으로 감시합니다."
                icon={<Globe className="h-4 w-4 text-neon" />}
              />
              <StatusCard
                title="2. 자체 검증"
                description="허위상품, 중복, 위험 판매자를 필터링합니다."
                icon={<ShieldCheck className="h-4 w-4 text-usdt" />}
              />
              <StatusCard
                title="3. 즉시 노출"
                description="검증 통과 상품만 사용자 화면에 실시간 제공됩니다."
                icon={<Sparkles className="h-4 w-4 text-cyan-400" />}
              />
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 lg:items-end lg:min-w-[220px]">
            <PriceAlertDialogButton />
            <div className="rounded-md border border-border bg-background/70 px-3 py-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5 text-foreground font-medium mb-1">
                <Activity className="h-3.5 w-3.5 text-neon pulse-dot" />
                실시간 필터링 상태
              </div>
              <div className="flex items-center justify-between gap-3 font-mono">
                <span>수집 → 검증 → 노출</span>
                <span className="text-neon">ON</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-9">
          <LiveBoard height="520px" />
        </div>
        <div className="lg:col-span-3">
          <AIScanLog className="h-[520px]" />
        </div>
      </div>

      <AvailableProducts className="h-[560px]" />
    </div>
  );
}

function StatusCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-background/60 px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-2 text-[12px] font-semibold">
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
