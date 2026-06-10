import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "ko" | "en" | "ja" | "zh";

type Dict = Record<string, Partial<Record<Lang, string>>>;

// Admin-scoped dictionary. Korean is the canonical key.
const DICT: Dict = {
  "admin.console": { ko: "관리자 콘솔", en: "Admin Console", ja: "管理コンソール", zh: "管理控制台" },
  "admin.userArea": { ko: "사용자 영역", en: "User Area", ja: "ユーザー画面", zh: "用户区" },
  "nav.sources": { ko: "수집소스", en: "Collection Sources", ja: "収集ソース", zh: "采集来源" },
  "nav.filters": { ko: "노출필터", en: "Exposure Filter", ja: "露出フィルター", zh: "曝光筛选" },
  "nav.raw": { ko: "원본 피드", en: "Raw Feed", ja: "ローフィード", zh: "原始数据" },
  "nav.candidates": { ko: "수집 데이터", en: "Collected Data", ja: "収集データ", zh: "采集数据" },
  "nav.pricing": { ko: "가격 정책", en: "Pricing", ja: "価格", zh: "定价" },
  "nav.orders": { ko: "주문관리", en: "Order Management", ja: "注文管理", zh: "订单管理" },
  "nav.revenue": { ko: "매출관리/AS", en: "Revenue Management / AS", ja: "売上管理 / AS", zh: "营收管理/售后" },
  "nav.automation": { ko: "자동 구매", en: "Automation", ja: "自動購入", zh: "自动购买" },
  "nav.chat": { ko: "채팅 상담", en: "Chat", ja: "チャット相談", zh: "客服" },
  "nav.settings": { ko: "설정", en: "Settings", ja: "設定", zh: "设置" },

  "kpi.gmv": { ko: "오늘 GMV", en: "Today GMV", ja: "本日GMV", zh: "今日GMV" },
  "kpi.orders": { ko: "처리 주문", en: "Orders", ja: "処理注文", zh: "处理订单" },
  "kpi.sources": { ko: "Live 수집소스", en: "Live Sources", ja: "Live収集ソース", zh: "实时采集来源" },
  "kpi.filter": { ko: "노출필터 통과율", en: "Exposure Pass", ja: "露出通過率", zh: "曝光通过率" },
  "kpi.as": { ko: "AS 대기", en: "AS Queue", ja: "AS待ち", zh: "售后待处理" },

  // Automation page
  "auto.title": { ko: "자동 구매 봇", en: "Auto-Purchase Bot", ja: "自動購入ボット", zh: "自动购买机器人" },
  "auto.desc": {
    ko: "고객 결제 확인 → 원본 텔레그램 봇/판매자에서 자동 발주 → 재고/결제정보 수집 → 재고 없을 시 유사 가격 딜 자동 탐색.",
    en: "Customer payment → auto-order at source telegram bot → collect stock/payment info → fallback to similar-priced deal if out of stock.",
    ja: "顧客決済 → ソースで自動発注 → 在庫/決済情報収集 → 在庫切れ時は類似価格Dealを探索。",
    zh: "客户付款 → 在来源自动下单 → 收集库存/付款信息 → 缺货时自动寻找相近价格的Deal。",
  },
  "auto.rules": { ko: "자동구매 규칙", en: "Auto-Purchase Rules", ja: "自動購入ルール", zh: "自动购买规则" },
  "auto.queue": { ko: "결제 완료 · 자동 발주 큐", en: "Paid · Auto-Order Queue", ja: "決済済み · 自動発注キュー", zh: "已付款·自动下单队列" },
  "auto.col.source": { ko: "소스", en: "Source", ja: "ソース", zh: "来源" },
  "auto.col.svc": { ko: "대상 서비스", en: "Service", ja: "サービス", zh: "服务" },
  "auto.col.auto": { ko: "자동구매", en: "Auto", ja: "自動", zh: "自动" },
  "auto.col.success": { ko: "성공", en: "Success", ja: "成功", zh: "成功" },
  "auto.col.fail": { ko: "실패", en: "Fail", ja: "失敗", zh: "失败" },
  "auto.col.edit": { ko: "규칙 편집", en: "Edit", ja: "編集", zh: "编辑规则" },
  "auto.col.order": { ko: "주문", en: "Order", ja: "注文", zh: "订单" },
  "auto.col.stock": { ko: "재고 확인", en: "Stock", ja: "在庫", zh: "库存" },
  "auto.col.pay": { ko: "결제 정보", en: "Payment", ja: "決済情報", zh: "付款信息" },
  "auto.col.status": { ko: "상태", en: "Status", ja: "状態", zh: "状态" },
  "auto.col.action": { ko: "액션", en: "Action", ja: "アクション", zh: "操作" },
  "auto.status.checking": { ko: "재고 확인 중", en: "Checking stock", ja: "在庫確認中", zh: "正在确认库存" },
  "auto.status.in_stock": { ko: "재고 OK", en: "In stock", ja: "在庫あり", zh: "有货" },
  "auto.status.oos": { ko: "재고 없음", en: "Out of stock", ja: "在庫切れ", zh: "缺货" },
  "auto.status.paying": { ko: "USDT 결제 정보 수집", en: "Collecting USDT info", ja: "USDT情報収集", zh: "收集USDT付款信息" },
  "auto.status.ready": { ko: "결제 정보 준비됨", en: "Payment info ready", ja: "決済情報準備完了", zh: "付款信息已就绪" },
  "auto.status.delivered": { ko: "계정 전달 완료", en: "Delivered", ja: "アカウント引渡完了", zh: "已交付账号" },
  "auto.act.copy": { ko: "결제정보 복사", en: "Copy payment", ja: "決済情報コピー", zh: "复制付款" },
  "auto.act.alt": { ko: "유사 Deal 찾기", en: "Find alternative", ja: "代替Deal", zh: "查找替代" },
  "auto.act.deliver": { ko: "수동 발주", en: "Manual deliver", ja: "手動発注", zh: "手动下单" },
  "auto.alt.title": { ko: "유사 가격 대안 딜", en: "Similar Alternative Deals", ja: "類似価格の代替Deal", zh: "相似价格替代Deal" },
  "auto.alt.subtitle": {
    ko: "원본 소스 재고가 없을 때, ±15% 가격 범위에서 신뢰도 높은 대체 판매자를 자동 추천합니다.",
    en: "When source is out of stock, recommend alternative trusted sellers within ±15% price range.",
    ja: "ソースが在庫切れの場合、±15%価格帯で信頼できる代替セラーを推薦。",
    zh: "原始来源缺货时，在±15%价格区间内推荐可信替代卖家。",
  },
  "auto.alt.use": { ko: "이 대안으로 자동발주", en: "Use this alternative", ja: "この代替で発注", zh: "用此替代下单" },
  "auto.alt.trust": { ko: "신뢰도", en: "Trust", ja: "信頼度", zh: "信誉" },
  "auto.alt.price": { ko: "가격", en: "Price", ja: "価格", zh: "价格" },
  "auto.logs": { ko: "최근 자동구매 로그", en: "Recent Logs", ja: "最近のログ", zh: "最近日志" },
  "auto.lang": { ko: "언어", en: "Language", ja: "言語", zh: "语言" },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "ko";
    return (localStorage.getItem("admin.lang") as Lang) || "ko";
  });
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("admin.lang", l); } catch {}
  }, []);
  const t = useCallback((key: string) => DICT[key]?.[lang] ?? DICT[key]?.ko ?? key, [lang]);
  useEffect(() => { /* noop */ }, [lang]);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useT() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useT must be inside I18nProvider");
  return ctx;
}

export const LANGS: { code: Lang; label: string }[] = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "zh", label: "中文" },
];
