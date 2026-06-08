import { useState } from "react";
import { SupportChat } from "@/components/deal/SupportChat";
import { Megaphone, HelpCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const NOTICES = [
  { date: "2026-06-07", tag: "공지", title: "IDFIT 관리자 테스트 환경을 준비 중입니다." },
  { date: "2026-06-05", tag: "결제", title: "MVP 결제 방식은 관리자 확인 기반 USDT 입금 확인으로 시작합니다." },
  { date: "2026-06-02", tag: "업데이트", title: "수집 소스, 원본 피드, 상품 후보 관리 화면을 순차 연결합니다." },
];

const FAQ = [
  { q: "IDFIT은 어떤 서비스인가요?", a: "텔레그램 기반 AI 계정 판매 정보를 수집하고, 판매자 신뢰도·재고·가격·주문·AS를 관리하는 운영 시스템입니다." },
  { q: "결제는 어떤 방식으로 시작하나요?", a: "초기 MVP는 USDT 수동 입금 확인 방식으로 시작합니다. 관리자 확인 후 상품 전달 상태를 관리합니다." },
  { q: "자동구매는 바로 실행되나요?", a: "아닙니다. 상품, 가격, 재고, 판매자 신뢰도를 먼저 확인한 뒤 안전 조건이 충족될 때만 자동화 단계로 확장합니다." },
  { q: "idfit.org 도메인을 연결할 수 있나요?", a: "네. 새 Vercel 계정으로 재배포한 뒤 DNS 설정에서 idfit.org 도메인을 연결할 계획입니다." },
];

export default function Support() {
  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl">
      <div>
        <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest mb-1">support</div>
        <h1 className="font-display text-xl md:text-2xl font-bold">고객 지원</h1>
        <p className="text-[12.5px] text-muted-foreground mt-1">공지사항 · FAQ · 관리자 1:1 상담</p>
      </div>

      <section className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-md border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-background/40">
              <Megaphone className="h-3.5 w-3.5 text-usdt" />
              <span className="text-[12.5px] font-semibold">공지사항</span>
            </div>
            <ul className="divide-y divide-border">
              {NOTICES.map((notice, index) => (
                <li key={index} className="px-3 py-2.5 flex items-center gap-3 hover:bg-muted/30 text-[12.5px]">
                  <span className="font-mono text-[10.5px] text-muted-foreground w-20 shrink-0">{notice.date}</span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 border rounded-sm shrink-0 text-neon border-neon/40 bg-neon/10">{notice.tag}</span>
                  <span className="truncate text-foreground">{notice.title}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-background/40">
              <HelpCircle className="h-3.5 w-3.5 text-cyan" />
              <span className="text-[12.5px] font-semibold">자주 묻는 질문</span>
            </div>
            <div className="divide-y divide-border">
              {FAQ.map((faq, index) => <FaqRow key={index} q={faq.q} a={faq.a} defaultOpen={index === 0} />)}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <SupportChat topic="일반 문의" height="h-[640px]" />
        </div>
      </section>
    </div>
  );
}

function FaqRow({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen((value) => !value)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30">
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        <span className="text-[13px] text-foreground">{q}</span>
      </button>
      {open && <div className="px-3 pb-3 pl-9 text-[12.5px] text-muted-foreground leading-relaxed">{a}</div>}
    </div>
  );
}
