import { useState } from "react";
import { SupportChat } from "@/components/deal/SupportChat";
import { Megaphone, HelpCircle, ChevronDown, Languages } from "lucide-react";
import { cn } from "@/lib/utils";

type Lang = "ko" | "en" | "zh" | "ja";

const LANGS: { key: Lang; label: string }[] = [
  { key: "ko", label: "한국어" },
  { key: "en", label: "English" },
  { key: "zh", label: "中文" },
  { key: "ja", label: "日本語" },
];

const CONTENT: Record<Lang, {
  eyebrow: string;
  title: string;
  description: string;
  noticesTitle: string;
  faqTitle: string;
  chatTitle: string;
  chatDescription: string;
  notices: { date: string; tag: string; title: string; body: string }[];
  faq: { q: string; a: string }[];
}> = {
  ko: {
    eyebrow: "notice / faq",
    title: "공지 / FAQ",
    description: "IDFIT 이용 전 꼭 확인해야 할 공지사항과 자주 묻는 질문입니다.",
    noticesTitle: "공지사항",
    faqTitle: "자주 묻는 질문",
    chatTitle: "1:1 문의",
    chatDescription: "주문, 입금, AS처럼 개인 정보가 필요한 문의는 채팅으로 남겨 주세요.",
    notices: [
      { date: "2026-06-10", tag: "예치금", title: "예치금 선충전 및 5~10% 보너스 적립 안내", body: "50·100·300·500·1,000 USDT 또는 직접 입력으로 예치금을 충전할 수 있습니다. 충전 완료 후 보너스가 포함된 예치금으로 반영되며, 예치금 충전은 환불되지 않습니다." },
      { date: "2026-06-10", tag: "AS", title: "보장상품 AS 신청 전 확인 사항", body: "AS 신청 전 주문 내역, 보장 조건, 전달받은 계정/코드 상태를 먼저 확인해 주세요. 사유와 증빙이 명확할수록 처리 속도가 빨라집니다." },
      { date: "2026-06-09", tag: "결제", title: "USDT TRC20/BEP20 자동 입금 확인 안내", body: "지원 네트워크의 정확한 입금은 자동 확인 대상입니다. 다른 네트워크로 보내거나 금액이 다르면 확인이 지연될 수 있습니다." },
      { date: "2026-06-08", tag: "상품", title: "품절·소진 상품 자동 제외 기준 안내", body: "IDFIT은 판매 가능성이 있는 상품만 노출하기 위해 재고 없음, 판매 종료, 오류 가능성이 높은 상품을 목록에서 빠르게 제외합니다." },
      { date: "2026-06-07", tag: "안전", title: "공유계정 이용 시 보안 수칙", body: "계정 정보는 외부에 재공유하지 말고, 판매자가 안내한 사용 조건을 지켜 주세요. 비정상 사용으로 제한된 경우 보장 대상에서 제외될 수 있습니다." },
    ],
    faq: [
      { q: "IDFIT은 어떤 서비스인가요?", a: "IDFIT은 전 세계 AI 서비스 브랜드의 이벤트, 프로모션 계정, 공유계정, 정규계정 판매 정보를 빠르게 수집해 저렴한 가격의 구매 후보를 보여주는 서비스입니다." },
      { q: "왜 가격이 일반 구독보다 저렴한가요?", a: "국가별 프로모션, 기간 한정 이벤트, 묶음 판매, 공유형 이용권처럼 정상 판매 경로에서 발생하는 할인 기회를 빠르게 찾아 반영하기 때문입니다." },
      { q: "정품 계정인가요?", a: "IDFIT은 정규 서비스에서 사용 가능한 계정/코드/공유권을 우선 취급합니다. 다만 상품마다 이용 조건과 보장 범위가 다르므로 구매 전 상세 설명과 보장 내용을 꼭 확인해야 합니다." },
      { q: "공유계정은 어떻게 사용하나요?", a: "공유계정은 여러 사용자가 같은 플랜 또는 워크스페이스를 나눠 쓰는 방식일 수 있습니다. 개인 정보 저장, 비밀번호 변경, 외부 재판매는 금지될 수 있습니다." },
      { q: "구매 전 무엇을 확인해야 하나요?", a: "서비스명, 이용 기간, 국가/지역 제한, 동시 접속 제한, 보장 기간, AS 조건, 전달 방식, 품절 가능성을 확인해 주세요." },
      { q: "예치금은 왜 필요한가요?", a: "매번 입금 확인을 기다리지 않고 빠르게 구매하기 위해 예치금을 미리 충전합니다. 충전 시 5~10% 보너스가 붙지만, 충전 완료된 예치금은 환불되지 않습니다." },
      { q: "환불 지갑주소는 왜 등록하나요?", a: "예외적으로 환불이 필요한 상황이 생길 때 USDT를 받을 지갑주소를 미리 저장하기 위한 용도입니다. 예치금 충전 자체가 환불 가능하다는 뜻은 아닙니다." },
      { q: "AS는 언제 가능한가요?", a: "보장 기간 안에 상품 설명과 다른 문제가 발생했거나 전달 정보가 정상 작동하지 않는 경우 신청할 수 있습니다. 사용 조건 위반, 임의 변경, 외부 공유는 제한될 수 있습니다." },
      { q: "상품이 갑자기 사라지는 이유는 무엇인가요?", a: "판매처에서 재고가 소진되었거나, 가격이 변동되었거나, 신뢰도가 낮다고 판단되면 목록에서 빠르게 제외됩니다." },
      { q: "지원 언어는 무엇인가요?", a: "현재 공지와 FAQ는 한국어, 영어, 중국어, 일본어로 제공합니다. 주문과 AS 문의는 가능한 한 명확한 내용과 증빙을 함께 남겨 주세요." },
    ],
  },
  en: {
    eyebrow: "notice / faq",
    title: "Notice / FAQ",
    description: "Key notices and answers to check before using IDFIT.",
    noticesTitle: "Notices",
    faqTitle: "Frequently Asked Questions",
    chatTitle: "1:1 Support",
    chatDescription: "For order, payment, or after-sales issues, leave a message in chat.",
    notices: [
      { date: "2026-06-10", tag: "Deposit", title: "Prepaid deposit and 5–10% bonus credit", body: "You can top up 50, 100, 300, 500, 1,000 USDT or enter a custom amount. Once confirmed, bonus credit is added to your deposit balance. Completed deposits are non-refundable." },
      { date: "2026-06-10", tag: "AS", title: "Check warranty details before requesting support", body: "Before submitting an AS request, review your order, warranty terms, and delivered account/code status. Clear reasons and evidence help us respond faster." },
      { date: "2026-06-09", tag: "Payment", title: "USDT TRC20/BEP20 auto-confirmation", body: "Correct payments on supported networks may be auto-confirmed. Wrong networks or mismatched amounts can delay confirmation." },
      { date: "2026-06-08", tag: "Stock", title: "Sold-out and depleted products are filtered quickly", body: "IDFIT removes unavailable, ended, or high-risk items quickly so users see products that are more likely to be purchasable." },
      { date: "2026-06-07", tag: "Safety", title: "Shared account usage rules", body: "Do not reshare account details externally and follow the seller's usage conditions. Abuse or abnormal use may void support coverage." },
    ],
    faq: [
      { q: "What is IDFIT?", a: "IDFIT finds low-cost purchase opportunities for AI service accounts, including global promotions, event accounts, shared accounts, and regular accounts." },
      { q: "Why are prices lower than normal subscriptions?", a: "Prices can be lower because IDFIT tracks country-specific promotions, limited events, bundle sales, and shared-plan opportunities." },
      { q: "Are these legitimate accounts?", a: "IDFIT prioritizes accounts, codes, and shared access that work on official services. Terms and coverage differ by item, so check details before buying." },
      { q: "How do shared accounts work?", a: "Shared accounts may involve multiple users using one plan or workspace. Saving private data, changing passwords, or reselling access may be prohibited." },
      { q: "What should I check before buying?", a: "Check service name, usage period, region limits, simultaneous-use rules, warranty period, AS terms, delivery method, and stock risk." },
      { q: "Why use a prepaid deposit?", a: "A prepaid deposit helps you buy quickly without waiting for payment confirmation every time. Deposits receive 5–10% bonus credit but are non-refundable after confirmation." },
      { q: "Why register a refund wallet?", a: "It stores the USDT wallet address used only when an exceptional refund is approved. It does not mean prepaid deposits are refundable." },
      { q: "When can I request AS support?", a: "You can request support within the warranty terms if the delivered account/code does not work as described. Misuse or unauthorized sharing may be excluded." },
      { q: "Why do products disappear?", a: "Items can disappear when stock runs out, price changes, the supplier ends the sale, or IDFIT detects higher risk." },
      { q: "Which languages are supported?", a: "Notice and FAQ content is available in Korean, English, Chinese, and Japanese. For orders and AS, include clear details and evidence." },
    ],
  },
  zh: {
    eyebrow: "notice / faq",
    title: "公告 / FAQ",
    description: "使用 IDFIT 前建议先确认的公告和常见问题。",
    noticesTitle: "公告事项",
    faqTitle: "常见问题",
    chatTitle: "一对一咨询",
    chatDescription: "订单、入金、售后等需要个人信息的问题，请通过聊天留言。",
    notices: [
      { date: "2026-06-10", tag: "预存", title: "预存余额与 5–10% 奖励额度说明", body: "可选择 50、100、300、500、1,000 USDT 或输入自定义金额。确认后会按入金金额加上奖励额度计入余额。已完成的预存不支持退款。" },
      { date: "2026-06-10", tag: "售后", title: "申请售后前请确认保障内容", body: "提交售后前，请先确认订单、保障条件以及收到的账号/代码状态。原因和凭证越清楚，处理越快。" },
      { date: "2026-06-09", tag: "支付", title: "USDT TRC20/BEP20 自动确认说明", body: "支持网络上的准确入金可自动确认。网络错误或金额不一致可能导致确认延迟。" },
      { date: "2026-06-08", tag: "商品", title: "售罄和库存不足商品会快速移除", body: "IDFIT 会尽快移除无库存、销售结束或风险较高的商品，让用户看到更可能可购买的商品。" },
      { date: "2026-06-07", tag: "安全", title: "共享账号使用规则", body: "请勿向外部再次分享账号信息，并遵守卖家的使用条件。异常使用可能不在保障范围内。" },
    ],
    faq: [
      { q: "IDFIT 是什么服务？", a: "IDFIT 会收集全球 AI 服务品牌的活动、促销账号、共享账号和正规账号销售信息，并提供低价购买机会。" },
      { q: "为什么价格比官方订阅便宜？", a: "因为 IDFIT 会追踪不同国家的促销、限时活动、组合销售和共享方案等折扣机会。" },
      { q: "这些是正规账号吗？", a: "IDFIT 优先提供可在官方服务中使用的账号、代码或共享权限。但每个商品的使用条件和保障范围不同，购买前必须确认详情。" },
      { q: "共享账号如何使用？", a: "共享账号可能是多人共同使用同一套餐或工作区。保存私人资料、修改密码、再次转售等行为可能被禁止。" },
      { q: "购买前需要确认什么？", a: "请确认服务名称、使用期限、地区限制、同时使用限制、保障期、售后条件、交付方式和库存风险。" },
      { q: "为什么需要预存余额？", a: "预存余额可以避免每次购买都等待入金确认。确认后会获得 5–10% 奖励额度，但预存完成后不退款。" },
      { q: "为什么要登记退款钱包？", a: "退款钱包用于特殊情况下通过审核的 USDT 退款。它并不代表预存余额可以退款。" },
      { q: "什么时候可以申请售后？", a: "如果在保障期内收到的账号/代码无法按说明使用，可以申请售后。违反使用条件或外部共享可能不在保障范围内。" },
      { q: "为什么商品会突然消失？", a: "可能是库存售罄、价格变化、供应商停止销售，或 IDFIT 判断风险升高。" },
      { q: "支持哪些语言？", a: "公告和 FAQ 支持韩语、英语、中文和日语。订单和售后咨询请尽量提供清楚内容和凭证。" },
    ],
  },
  ja: {
    eyebrow: "notice / faq",
    title: "お知らせ / FAQ",
    description: "IDFIT を利用する前に確認しておきたいお知らせとよくある質問です。",
    noticesTitle: "お知らせ",
    faqTitle: "よくある質問",
    chatTitle: "1:1 お問い合わせ",
    chatDescription: "注文、入金、AS など個別確認が必要な内容はチャットで送信してください。",
    notices: [
      { date: "2026-06-10", tag: "入金", title: "プリペイド残高と 5–10% ボーナス付与について", body: "50、100、300、500、1,000 USDT または任意金額でチャージできます。確認後はボーナス込みで残高に反映され、完了したチャージは返金不可です。" },
      { date: "2026-06-10", tag: "AS", title: "AS 申請前の保証内容確認について", body: "AS 申請前に注文内容、保証条件、受け取ったアカウント/コードの状態を確認してください。理由と証拠が明確なほど対応が早くなります。" },
      { date: "2026-06-09", tag: "決済", title: "USDT TRC20/BEP20 自動入金確認について", body: "対応ネットワークで正しい金額が入金された場合、自動確認の対象になります。ネットワーク違いや金額不一致は確認遅延の原因になります。" },
      { date: "2026-06-08", tag: "商品", title: "売り切れ・在庫不足商品の自動除外について", body: "IDFIT は在庫切れ、販売終了、リスクが高い商品を素早く除外し、購入可能性が高い商品を表示します。" },
      { date: "2026-06-07", tag: "安全", title: "共有アカウント利用ルール", body: "アカウント情報を外部へ再共有せず、販売者の利用条件を守ってください。不正利用や異常利用は保証対象外になる場合があります。" },
    ],
    faq: [
      { q: "IDFIT はどんなサービスですか？", a: "IDFIT は世界中の AI サービスブランドのイベント、プロモーションアカウント、共有アカウント、正規アカウント販売情報を収集し、低価格の購入候補を提供するサービスです。" },
      { q: "なぜ通常のサブスクより安いのですか？", a: "国別プロモーション、期間限定イベント、セット販売、共有プランなどの割引機会を素早く反映するためです。" },
      { q: "正規アカウントですか？", a: "IDFIT は公式サービスで利用可能なアカウント、コード、共有アクセスを優先して扱います。ただし商品ごとに条件と保証範囲が異なるため、購入前に詳細を確認してください。" },
      { q: "共有アカウントはどう使いますか？", a: "共有アカウントは複数ユーザーが同じプランやワークスペースを利用する形式の場合があります。個人情報保存、パスワード変更、再販売は禁止されることがあります。" },
      { q: "購入前に何を確認すべきですか？", a: "サービス名、利用期間、地域制限、同時利用制限、保証期間、AS 条件、納品方法、在庫リスクを確認してください。" },
      { q: "なぜプリペイド残高が必要ですか？", a: "毎回入金確認を待たずに素早く購入するためです。チャージ時に 5–10% のボーナスが付きますが、完了後の返金はできません。" },
      { q: "返金ウォレットはなぜ登録しますか？", a: "例外的に返金が承認された場合に USDT を受け取るウォレットを保存するためです。プリペイド残高が返金可能という意味ではありません。" },
      { q: "AS はいつ申請できますか？", a: "保証条件内で、受け取ったアカウント/コードが説明通りに使えない場合に申請できます。利用条件違反や外部共有は対象外になる場合があります。" },
      { q: "商品が急に消えるのはなぜですか？", a: "在庫切れ、価格変更、販売終了、または IDFIT がリスク上昇を検知した場合、商品一覧から除外されます。" },
      { q: "対応言語は何ですか？", a: "お知らせと FAQ は韓国語、英語、中国語、日本語で提供します。注文や AS では明確な内容と証拠を添えてください。" },
    ],
  },
};

export default function Support() {
  const [lang, setLang] = useState<Lang>("ko");
  const copy = CONTENT[lang];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest mb-1">{copy.eyebrow}</div>
          <h1 className="font-display text-xl md:text-2xl font-bold">{copy.title}</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1">{copy.description}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-card p-1 overflow-x-auto">
          <Languages className="h-3.5 w-3.5 text-muted-foreground ml-1 shrink-0" />
          {LANGS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setLang(item.key)}
              className={cn(
                "h-7 px-2 rounded-sm text-[11.5px] whitespace-nowrap",
                lang === item.key ? "bg-neon text-[hsl(240_10%_4%)]" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-md border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-background/40">
              <Megaphone className="h-3.5 w-3.5 text-usdt" />
              <span className="text-[12.5px] font-semibold">{copy.noticesTitle}</span>
            </div>
            <div className="divide-y divide-border">
              {copy.notices.map((notice, index) => (
                <NoticeRow key={`${lang}-${index}`} notice={notice} defaultOpen={index === 0} />
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-background/40">
              <HelpCircle className="h-3.5 w-3.5 text-cyan" />
              <span className="text-[12.5px] font-semibold">{copy.faqTitle}</span>
            </div>
            <div className="divide-y divide-border">
              {copy.faq.map((faq, index) => <FaqRow key={`${lang}-${index}`} q={faq.q} a={faq.a} defaultOpen={index === 0} />)}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-2">
          <div className="rounded-md border border-border bg-card px-3 py-2">
            <div className="text-[12.5px] font-semibold">{copy.chatTitle}</div>
            <p className="text-[11.5px] text-muted-foreground mt-1">{copy.chatDescription}</p>
          </div>
          <SupportChat topic="일반 문의" height="h-[590px]" />
        </div>
      </section>
    </div>
  );
}

function NoticeRow({ notice, defaultOpen }: { notice: { date: string; tag: string; title: string; body: string }; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen((value) => !value)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30">
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
        <span className="font-mono text-[10.5px] text-muted-foreground w-20 shrink-0">{notice.date}</span>
        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 border rounded-sm shrink-0 text-neon border-neon/40 bg-neon/10">{notice.tag}</span>
        <span className="min-w-0 truncate text-[12.5px] text-foreground">{notice.title}</span>
      </button>
      {open && <div className="px-3 pb-3 pl-[8.1rem] text-[12.5px] text-muted-foreground leading-relaxed">{notice.body}</div>}
    </div>
  );
}

function FaqRow({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen((value) => !value)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30">
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
        <span className="text-[13px] text-foreground">{q}</span>
      </button>
      {open && <div className="px-3 pb-3 pl-9 text-[12.5px] text-muted-foreground leading-relaxed">{a}</div>}
    </div>
  );
}
