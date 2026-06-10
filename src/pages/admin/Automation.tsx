import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, ExternalLink, PackageCheck, RefreshCw, Save, Search, Send, ShieldAlert, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatUsdt4 } from "@/lib/payment-amount";
import { purchaseTargetForProduct } from "@/lib/purchase-target";

type PurchaseJobStatus = "queued" | "checking_stock" | "purchasing" | "waiting_payment" | "waiting_delivery" | "delivered" | "manual_review" | "failed";
type OrderStatus = "payment_pending" | "payment_confirmed" | "purchasing" | "delivered" | "as_open" | "failed" | "refunded_review";
type DeliveryType = "code" | "login" | "invite_link" | "manual";
type QueueFilter = "active" | "manual" | "failed" | "delivered" | "all";

type AutomationJob = {
  id: string;
  order_id: string;
  source_id: string | null;
  seller_id: string | null;
  status: PurchaseJobStatus;
  expected_cost_usdt: number | null;
  actual_cost_usdt: number | null;
  max_allowed_cost_usdt: number | null;
  conversation_log: unknown;
  failure_reason: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  order: {
    id: string;
    order_no: string;
    user_id: string;
    status: OrderStatus;
    sale_price_usdt: number;
    supplier_cost_usdt: number;
    margin_usdt: number;
    created_at: string;
    product: {
      title: string;
      service_name: string;
      source_id: string | null;
      seller_id: string | null;
      metadata: Record<string, unknown> | null;
      source: { name: string; source_type: string; telegram_identifier: string; status: string; auto_purchase_enabled: boolean; trust_override: number | null; metadata: Record<string, unknown> | null } | null;
      seller: { display_name: string; trust_score: number; success_count: number; failure_count: number; as_count: number } | null;
      candidate: { metadata: Record<string, unknown> | null; raw_message: { original_url: string | null; telegram_message_id: string | null; metadata: Record<string, unknown> | null } | null } | null;
    } | null;
    delivery_items: { id: string; delivery_type: DeliveryType; encrypted_payload: string; visible_to_customer: boolean; delivered_at: string | null }[];
  } | null;
};

type SourceRow = {
  id: string;
  name: string;
  source_type: string;
  telegram_identifier: string;
  status: string;
  auto_collect_enabled: boolean;
  auto_purchase_enabled: boolean;
  trust_override: number | null;
};

const activeStatuses: PurchaseJobStatus[] = ["queued", "checking_stock", "purchasing", "waiting_payment", "waiting_delivery"];
const manualStatuses: PurchaseJobStatus[] = ["manual_review", "failed"];

const statusLabel: Record<PurchaseJobStatus, string> = {
  queued: "대기",
  checking_stock: "재고확인",
  purchasing: "구매진행",
  waiting_payment: "결제대기",
  waiting_delivery: "결과수신대기",
  delivered: "전달완료",
  manual_review: "수동검토",
  failed: "실패",
};

const statusClass: Record<PurchaseJobStatus, string> = {
  queued: "border-muted-foreground/40 text-muted-foreground",
  checking_stock: "border-usdt/60 text-usdt",
  purchasing: "border-usdt/60 text-usdt",
  waiting_payment: "border-usdt/60 text-usdt",
  waiting_delivery: "border-neon/60 text-neon",
  delivered: "border-neon/60 text-neon",
  manual_review: "border-orange-400/60 text-orange-300",
  failed: "border-destructive/60 text-destructive",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function safeLogs(value: unknown) {
  return Array.isArray(value) ? value.slice(-6) : [];
}

function readiness(job: AutomationJob) {
  const source = job.order?.product?.source;
  const seller = job.order?.product?.seller;
  const target = purchaseTargetForProduct(job.order?.product);
  const trust = Number(source?.trust_override ?? seller?.trust_score ?? 0);
  const success = Number(seller?.success_count ?? 0);
  const fail = Number(seller?.failure_count ?? 0) + Number(seller?.as_count ?? 0);
  const enoughHistory = success + fail >= 10;
  const autoSource = Boolean(source?.auto_purchase_enabled);
  const safeTrust = trust >= 80;
  const hasTarget = Boolean(target);

  if (autoSource && enoughHistory && safeTrust && hasTarget) return { mode: "자동가능", level: "good", reason: "소스 자동구매 ON · 신뢰도/성공이력 충족" };
  if (hasTarget) return { mode: "반자동", level: "warn", reason: "원 수집소스 이동 후 관리자 확인 필요" };
  return { mode: "수동필요", level: "bad", reason: "주문창/수집소스 연결정보 부족" };
}

export default function AdminAutomation() {
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QueueFilter>("active");
  const [deliveryJob, setDeliveryJob] = useState<AutomationJob | null>(null);
  const [deliveryPayload, setDeliveryPayload] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("manual");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const { data: jobRows, error: jobsError } = await supabase
      .from("supplier_purchase_jobs")
      .select(`
        id,
        order_id,
        source_id,
        seller_id,
        status,
        expected_cost_usdt,
        actual_cost_usdt,
        max_allowed_cost_usdt,
        conversation_log,
        failure_reason,
        started_at,
        finished_at,
        created_at,
        updated_at,
        order:orders(
          id,
          order_no,
          user_id,
          status,
          sale_price_usdt,
          supplier_cost_usdt,
          margin_usdt,
          created_at,
          product:products(
            title,
            service_name,
            source_id,
            seller_id,
            metadata,
            source:telegram_sources(name, source_type, telegram_identifier, status, auto_purchase_enabled, trust_override, metadata),
            seller:sellers(display_name, trust_score, success_count, failure_count, as_count),
            candidate:product_candidates(metadata, raw_message:raw_messages(original_url, telegram_message_id, metadata))
          ),
          delivery_items(id, delivery_type, encrypted_payload, visible_to_customer, delivered_at)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    const { data: sourceRows } = await supabase
      .from("telegram_sources")
      .select("id, name, source_type, telegram_identifier, status, auto_collect_enabled, auto_purchase_enabled, trust_override")
      .order("auto_purchase_enabled", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(100);

    if (jobsError) toast.error(jobsError.message);
    setJobs((jobRows ?? []) as unknown as AutomationJob[]);
    setSources((sourceRows ?? []) as SourceRow[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const active = jobs.filter((job) => activeStatuses.includes(job.status)).length;
    const manual = jobs.filter((job) => manualStatuses.includes(job.status)).length;
    const delivered = jobs.filter((job) => job.status === "delivered" || job.order?.delivery_items?.some((item) => item.visible_to_customer)).length;
    const autoReadySources = sources.filter((source) => source.auto_purchase_enabled && source.status === "live").length;
    return { active, manual, delivered, autoReadySources };
  }, [jobs, sources]);

  const visibleJobs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (filter === "active" && !activeStatuses.includes(job.status)) return false;
      if (filter === "manual" && job.status !== "manual_review") return false;
      if (filter === "failed" && job.status !== "failed") return false;
      if (filter === "delivered" && job.status !== "delivered") return false;
      if (!keyword) return true;
      return [
        job.order?.order_no,
        job.order?.user_id,
        job.order?.product?.title,
        job.order?.product?.service_name,
        job.order?.product?.source?.name,
        job.order?.product?.source?.telegram_identifier,
        job.failure_reason,
        statusLabel[job.status],
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [filter, jobs, query]);

  const openSource = async (job: AutomationJob) => {
    const target = purchaseTargetForProduct(job.order?.product);
    if (!target) {
      toast.error("원 판매봇/사이트 연결정보가 없습니다.");
      return;
    }
    await supabase.from("supplier_purchase_jobs").update({
      status: job.status === "queued" ? "manual_review" : job.status,
      conversation_log: [...safeLogs(job.conversation_log), { type: "manual_source_opened", url: target.url, at: new Date().toISOString() }],
    }).eq("id", job.id);
    window.open(target.url, "_blank", "noopener,noreferrer");
    await loadData();
  };

  const openDelivery = (job: AutomationJob) => {
    setDeliveryJob(job);
    setDeliveryPayload(job.order?.delivery_items?.find((item) => item.visible_to_customer)?.encrypted_payload ?? "");
    setDeliveryType(job.order?.delivery_items?.find((item) => item.visible_to_customer)?.delivery_type ?? "manual");
  };

  const markManual = async (job: AutomationJob) => {
    const { error } = await supabase.from("supplier_purchase_jobs").update({ status: "manual_review", failure_reason: job.failure_reason ?? "자동구매 변수 확인 필요" }).eq("id", job.id);
    if (error) toast.error(error.message);
    else toast.success("수동검토로 전환했습니다.");
    await loadData();
  };

  const saveDelivery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deliveryJob?.order) return;
    if (!deliveryPayload.trim()) {
      toast.error("구매 결과로 받은 코드/계정/링크를 입력하세요.");
      return;
    }
    setSaving(true);
    const { error: deliveryError } = await supabase.from("delivery_items").insert({
      order_id: deliveryJob.order.id,
      delivery_type: deliveryType,
      encrypted_payload: deliveryPayload.trim(),
      visible_to_customer: true,
      delivered_at: new Date().toISOString(),
    });
    const { error: jobError } = await supabase.from("supplier_purchase_jobs").update({
      status: "delivered",
      actual_cost_usdt: deliveryJob.actual_cost_usdt ?? deliveryJob.expected_cost_usdt,
      finished_at: new Date().toISOString(),
      conversation_log: [...safeLogs(deliveryJob.conversation_log), { type: "delivery_saved", delivery_type: deliveryType, at: new Date().toISOString() }],
    }).eq("id", deliveryJob.id);
    const { error: orderError } = await supabase.from("orders").update({ status: "delivered", admin_note: "자동구매/반자동 구매 결과 전달 완료" }).eq("id", deliveryJob.order.id);
    setSaving(false);
    if (deliveryError || jobError || orderError) {
      toast.error(deliveryError?.message ?? jobError?.message ?? orderError?.message ?? "전달 저장 실패");
      return;
    }
    toast.success("구매 결과를 구매자에게 전달했습니다.");
    setDeliveryJob(null);
    setDeliveryPayload("");
    await loadData();
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-bold">자동구매 운영센터</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1 max-w-4xl">
            수집상품을 마진 포함 판매상품으로 운영하고, 고객 결제 후 원 판매봇/사이트에서 구매해 받은 코드·계정·링크를 구매자에게 전달하는 전체 흐름을 관리합니다. 충분한 데이터가 쌓이기 전까지는 반자동/수동검토를 기본으로 둡니다.
          </p>
        </div>
        <button onClick={loadData} disabled={loading} className="h-9 px-3 border border-border rounded-sm text-[12.5px] inline-flex items-center gap-1.5 disabled:opacity-60">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> 새로고침
        </button>
      </div>

      <div className="grid lg:grid-cols-4 gap-3">
        <Stat icon={Bot} label="진행중 구매작업" value={`${stats.active}건`} />
        <Stat icon={ShieldAlert} label="수동검토 필요" value={`${stats.manual}건`} warn={stats.manual > 0} />
        <Stat icon={Send} label="구매자 전달완료" value={`${stats.delivered}건`} accent />
        <Stat icon={CheckCircle2} label="자동구매 허용 소스" value={`${stats.autoReadySources}개`} />
      </div>

      <section className="grid xl:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="border border-border rounded-md bg-card p-4">
          <div className="flex items-center gap-2 font-semibold text-[13px] mb-3"><Wrench className="h-4 w-4 text-neon" /> 자동구매 단계</div>
          <div className="grid md:grid-cols-4 gap-2 text-[12px]">
            <Step title="1. 판매등록" desc="수집 원가에 마진을 붙여 판매상품 노출" />
            <Step title="2. 고객결제" desc="입금확인 주문이 구매작업으로 전환" />
            <Step title="3. 원소스 구매" desc="봇/사이트/단톡방에서 자동 또는 반자동 발주" />
            <Step title="4. 결과전송" desc="받은 코드·계정·링크를 고객 주문에 저장/전달" />
          </div>
        </div>
        <div className="border border-usdt/30 rounded-md bg-usdt/5 p-4 text-[12.5px]">
          <div className="font-semibold text-usdt mb-2">운영 원칙</div>
          <ul className="space-y-1 text-muted-foreground">
            <li>· 자동구매 ON이어도 신뢰도/성공이력 부족 시 반자동 처리</li>
            <li>· 품절, 가격변동, 결제주소 변경, 2FA/대화형 버튼은 수동검토</li>
            <li>· 고객 전달 전에는 코드/계정 정보가 반드시 저장되어야 완료 처리</li>
          </ul>
        </div>
      </section>

      <section className="border border-border rounded-md bg-card p-3 grid gap-2 lg:grid-cols-[1fr_170px_auto] items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="주문번호, 상품, 소스, 실패사유 검색" className="w-full h-9 pl-9 pr-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon" />
        </div>
        <select value={filter} onChange={(event) => setFilter(event.target.value as QueueFilter)} className="h-9 px-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon">
          <option value="active">진행중</option>
          <option value="manual">수동검토</option>
          <option value="failed">실패</option>
          <option value="delivered">전달완료</option>
          <option value="all">전체</option>
        </select>
        <div className="text-[12px] text-muted-foreground whitespace-nowrap">표시 {visibleJobs.length}개 / 전체 {jobs.length}개</div>
      </section>

      <div className="border border-border rounded-md overflow-hidden bg-background">
        <div className="hidden xl:grid grid-cols-[1fr_1.6fr_1.3fr_0.9fr_0.9fr_1.2fr_1fr_auto] px-3 h-9 items-center bg-card text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span>주문</span><span>상품/소스</span><span>자동화 준비도</span><span>판매가</span><span>원가/마진</span><span>구매작업</span><span>최근기록</span><span>액션</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">자동구매 작업을 불러오는 중입니다...</div>
        ) : visibleJobs.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-muted-foreground">조건에 맞는 자동구매 작업이 없습니다. 주문관리의 상품구매연결 또는 결제완료 주문 전환 후 표시됩니다.</div>
        ) : visibleJobs.map((job) => {
          const order = job.order;
          const product = order?.product;
          const ready = readiness(job);
          const target = purchaseTargetForProduct(product);
          const delivered = order?.delivery_items?.some((item) => item.visible_to_customer);
          return (
            <div key={job.id} className={cn("grid xl:grid-cols-[1fr_1.6fr_1.3fr_0.9fr_0.9fr_1.2fr_1fr_auto] gap-2 px-3 py-3 xl:items-center text-[12px] border-b border-border last:border-0", manualStatuses.includes(job.status) && "bg-orange-400/5")}>
              <div className="min-w-0"><div className="font-mono text-neon truncate">{order?.order_no ?? job.order_id.slice(0, 8)}</div><div className="text-[10.5px] text-muted-foreground">{formatDate(job.created_at)}</div></div>
              <div className="min-w-0"><div className="font-medium truncate">{product?.title ?? "상품 정보 없음"}</div><div className="font-mono text-[10.5px] text-muted-foreground truncate">{product?.source?.name ?? "소스 미연결"} · {product?.source?.telegram_identifier ?? "-"}</div></div>
              <div className="min-w-0"><span className={cn("inline-flex px-2 py-1 rounded-sm border text-[11px]", ready.level === "good" && "border-neon/50 text-neon", ready.level === "warn" && "border-usdt/50 text-usdt", ready.level === "bad" && "border-destructive/50 text-destructive")}>{ready.mode}</span><div className="mt-1 text-[10.5px] text-muted-foreground truncate">{ready.reason}</div></div>
              <div className="font-mono">{formatUsdt4(order?.sale_price_usdt ?? 0)} USDT</div>
              <div className="font-mono"><span className="text-muted-foreground">{formatUsdt4(job.actual_cost_usdt ?? job.expected_cost_usdt ?? order?.supplier_cost_usdt ?? 0)}</span><div className="text-neon text-[10.5px]">+{formatUsdt4(order?.margin_usdt ?? 0)}</div></div>
              <div><span className={cn("inline-flex px-2 py-1 rounded-sm border text-[11px]", statusClass[job.status])}>{statusLabel[job.status]}</span>{job.failure_reason && <div className="text-[10.5px] text-destructive mt-1 truncate">{job.failure_reason}</div>}</div>
              <div className="min-w-0 text-[10.5px] text-muted-foreground truncate">{safeLogs(job.conversation_log).length ? JSON.stringify(safeLogs(job.conversation_log).at(-1)) : delivered ? "고객 전달 데이터 있음" : "기록 없음"}</div>
              <div className="flex justify-end gap-1.5 flex-wrap">
                <button onClick={() => openSource(job)} disabled={!target} className="h-7 px-2 text-[11px] border border-border rounded-sm hover:bg-muted inline-flex items-center gap-1 disabled:opacity-40"><ExternalLink className="h-3 w-3" /> 원소스</button>
                <button onClick={() => openDelivery(job)} className="h-7 px-2 text-[11px] bg-neon text-[hsl(240_10%_4%)] rounded-sm font-semibold inline-flex items-center gap-1"><PackageCheck className="h-3 w-3" /> 결과전송</button>
                {!manualStatuses.includes(job.status) && <button onClick={() => markManual(job)} className="h-7 px-2 text-[11px] border border-usdt/50 text-usdt rounded-sm hover:bg-usdt/10">수동</button>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <div className="px-3 h-10 flex items-center border-b border-border text-[12.5px] font-semibold gap-2"><Bot className="h-3.5 w-3.5 text-neon" /> 자동구매 소스 준비도</div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-px bg-border">
          {sources.slice(0, 9).map((source) => (
            <div key={source.id} className="bg-background p-3 text-[12px]">
              <div className="flex items-center justify-between gap-2"><span className="font-medium truncate">{source.name}</span><span className={source.auto_purchase_enabled ? "text-neon" : "text-muted-foreground"}>{source.auto_purchase_enabled ? "자동ON" : "자동OFF"}</span></div>
              <div className="font-mono text-[10.5px] text-muted-foreground truncate mt-1">{source.source_type} · {source.telegram_identifier}</div>
              <div className="mt-2 flex gap-2 text-[10.5px]"><span className="px-1.5 py-0.5 border border-border rounded-sm">{source.status}</span><span className="px-1.5 py-0.5 border border-border rounded-sm">신뢰도 {source.trust_override ?? "미정"}</span><span className="px-1.5 py-0.5 border border-border rounded-sm">수집 {source.auto_collect_enabled ? "ON" : "OFF"}</span></div>
            </div>
          ))}
        </div>
      </div>

      {deliveryJob && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl border border-border bg-background rounded-md shadow-xl">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
              <div><div className="font-semibold">구매결과 전송</div><div className="text-[11.5px] text-muted-foreground">{deliveryJob.order?.order_no} · {deliveryJob.order?.product?.title}</div></div>
              <button onClick={() => setDeliveryJob(null)} className="text-[12px] text-muted-foreground hover:text-foreground">닫기</button>
            </div>
            <form onSubmit={saveDelivery} className="p-4 space-y-4">
              <div className="grid md:grid-cols-3 gap-2 text-[12px]">
                <Info label="판매가" value={`${formatUsdt4(deliveryJob.order?.sale_price_usdt ?? 0)} USDT`} />
                <Info label="원가" value={`${formatUsdt4(deliveryJob.actual_cost_usdt ?? deliveryJob.expected_cost_usdt ?? 0)} USDT`} />
                <Info label="마진" value={`${formatUsdt4(deliveryJob.order?.margin_usdt ?? 0)} USDT`} />
              </div>
              <select value={deliveryType} onChange={(event) => setDeliveryType(event.target.value as DeliveryType)} className="h-9 px-3 bg-background border border-border rounded-sm text-[12.5px] outline-none focus:border-neon">
                <option value="manual">수동 안내/복합정보</option>
                <option value="code">코드</option>
                <option value="login">계정 로그인 정보</option>
                <option value="invite_link">초대 링크</option>
              </select>
              <textarea value={deliveryPayload} onChange={(event) => setDeliveryPayload(event.target.value)} rows={7} placeholder="원 판매자로부터 받은 코드, 계정, 비밀번호, 2FA 안내, 링크, 주의사항 등을 입력하세요. 저장 즉시 구매자 주문 화면에 노출됩니다." className="w-full bg-background border border-border rounded-sm p-3 text-[12.5px] outline-none focus:border-neon" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDeliveryJob(null)} className="h-9 px-3 border border-border rounded-sm text-[12px]">취소</button>
                <button type="submit" disabled={saving} className="h-9 px-3 bg-neon text-[hsl(240_10%_4%)] rounded-sm text-[12px] font-semibold inline-flex items-center gap-1 disabled:opacity-50"><Save className="h-3.5 w-3.5" /> {saving ? "저장 중" : "구매자에게 전송"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent, warn }: { icon: typeof Bot; label: string; value: string; accent?: boolean; warn?: boolean }) {
  return <div className="border border-border rounded-md p-4 bg-card"><div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono"><Icon className={cn("h-3.5 w-3.5", accent && "text-neon", warn && "text-usdt")} />{label}</div><div className={cn("font-display text-2xl font-semibold mt-1", accent && "text-neon", warn && "text-usdt")}>{value}</div></div>;
}

function Step({ title, desc }: { title: string; desc: string }) {
  return <div className="border border-border rounded-sm bg-background p-3"><div className="font-semibold text-[12.5px]">{title}</div><div className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">{desc}</div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="border border-border rounded-sm p-3 bg-card"><div className="text-[11px] text-muted-foreground mb-1">{label}</div><div className="text-[12.5px] font-medium break-words">{value}</div></div>;
}
