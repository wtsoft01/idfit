import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bot, Globe2, Pencil, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type TelegramSource = Tables<"telegram_sources">;
type SourceLead = Tables<"source_leads">;
type SourceType = TelegramSource["source_type"];
type SourceStatus = TelegramSource["status"];
type SourceLeadStatus = SourceLead["status"];

const statusCls: Record<SourceStatus, string> = {
  live: "text-neon border-neon/40 bg-neon/10",
  throttled: "text-usdt border-usdt/40 bg-usdt/10",
  paused: "text-muted-foreground border-border bg-muted",
  blocked: "text-destructive border-destructive/40 bg-destructive/10",
};

const statusLabels: Record<SourceStatus, string> = {
  live: "live",
  paused: "paused",
  throttled: "throttled",
  blocked: "blocked",
};

const sourceTypeLabels: Record<SourceType, string> = {
  channel: "Channel",
  group: "Group",
  bot: "Bot",
  manual: "Manual",
  website: "Website",
};

const leadStatusCls: Record<SourceLeadStatus, string> = {
  new: "text-neon border-neon/40 bg-neon/10",
  reviewing: "text-usdt border-usdt/40 bg-usdt/10",
  approved: "text-muted-foreground border-border bg-muted",
  rejected: "text-destructive border-destructive/40 bg-destructive/10",
  duplicate: "text-orange-300 border-orange-300/40 bg-orange-300/10",
};

const emptyForm = {
  name: "",
  telegram_identifier: "",
  source_type: "channel" as SourceType,
  status: "live" as SourceStatus,
  trust_override: "",
  auto_collect_enabled: true,
};

type SourceForm = typeof emptyForm;
type InputMode = "telegram" | "website";

function isSupabaseConfigured() {
  const url = import.meta.env.VITE_SUPABASE_URL ?? "";
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  return Boolean(url && key && !key.includes("…"));
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function metadataObject(value: SourceLead["metadata"]) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function leadCollectionLabel(lead: SourceLead) {
  const metadata = metadataObject(lead.metadata);
  if (typeof metadata.collection_type_label === "string") return metadata.collection_type_label;
  if (lead.source_type === "bot") return "텔레그램봇";
  if (lead.source_type === "website") return "사이트 URL";
  return "텔레그램 단체방";
}

function inferInputMode(sourceType: SourceType): InputMode {
  return sourceType === "website" ? "website" : "telegram";
}

function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).href.replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

function normalizeTelegramIdentifier(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^-?\d+$/.test(trimmed)) return trimmed;
  const fromUrl = trimmed.match(/^https?:\/\/(?:t\.me|telegram\.me)\/([^/?#]+)/i)?.[1];
  const identifier = fromUrl ?? trimmed.replace(/^@/, "");
  return identifier ? `@${identifier}` : "";
}

export default function AdminSources() {
  const [sources, setSources] = useState<TelegramSource[]>([]);
  const [sourceLeads, setSourceLeads] = useState<SourceLead[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("telegram");

  const configured = useMemo(isSupabaseConfigured, []);

  const loadSources = async () => {
    if (!configured) {
      setError("Supabase publishable key가 아직 실제 전체 값이 아니라서 DB 조회를 대기 중입니다.");
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("telegram_sources")
      .select("*")
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
    } else {
      setSources(data ?? []);
    }

    setLoading(false);
  };

  const loadSourceLeads = async () => {
    if (!configured) return;
    const { data, error: queryError } = await supabase
      .from("source_leads")
      .select("*")
      .in("status", ["new", "reviewing"])
      .order("created_at", { ascending: false })
      .limit(80);

    if (queryError) {
      if (queryError.message.includes("source_leads")) {
        setSourceLeads([]);
        return;
      }
      setError(queryError.message);
    } else {
      setSourceLeads(data ?? []);
    }
  };

  useEffect(() => {
    loadSources();
    loadSourceLeads();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setInputMode("telegram");
    setShowForm(false);
  };

  const sourceToForm = (source: TelegramSource): SourceForm => ({
    name: source.name,
    telegram_identifier: source.telegram_identifier,
    source_type: source.source_type as SourceType,
    status: source.status,
    trust_override: source.trust_override?.toString() ?? "",
    auto_collect_enabled: source.auto_collect_enabled,
  });

  const startAdd = (mode: InputMode) => {
    setEditingId(null);
    setInputMode(mode);
    setForm({ ...emptyForm, source_type: mode === "website" ? "website" : "channel" });
    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured) {
      setError("먼저 전체 Supabase publishable key를 .env에 넣어야 소스를 저장할 수 있습니다.");
      return;
    }

    const identifier = form.telegram_identifier.trim();
    if (!form.name.trim() || !identifier) {
      setError(inputMode === "website" ? "소스 이름과 사이트 URL은 필수입니다." : "소스 이름과 텔레그램 식별자는 필수입니다.");
      return;
    }

    setSaving(true);
    setError(null);

    const normalizedIdentifier = form.source_type === "website"
      ? normalizeWebsiteUrl(identifier)
      : normalizeTelegramIdentifier(identifier);

    const payload = {
      name: form.name.trim(),
      telegram_identifier: normalizedIdentifier,
      source_type: form.source_type as TelegramSource["source_type"],
      status: form.status,
      auto_collect_enabled: form.auto_collect_enabled,
      trust_override: form.trust_override ? Number(form.trust_override) : null,
      metadata: {
        manual_entry: true,
        input_mode: form.source_type === "website" ? "website_url" : "telegram_identifier",
        discovery_enabled: true,
        profile_refresh_enabled: true,
      },
    };

    const { error: saveError } = editingId
      ? await supabase.from("telegram_sources").update(payload).eq("id", editingId)
      : await supabase.from("telegram_sources").insert(payload);

    if (saveError) {
      setError(saveError.message);
    } else {
      resetForm();
      await loadSources();
    }

    setSaving(false);
  };

  const updateStatus = async (source: TelegramSource, nextStatus: SourceStatus) => {
    if (!configured) return;

    const { error: updateError } = await supabase
      .from("telegram_sources")
      .update({ status: nextStatus, auto_collect_enabled: nextStatus === "live" })
      .eq("id", source.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSources((current) =>
      current.map((item) =>
        item.id === source.id ? { ...item, status: nextStatus, auto_collect_enabled: nextStatus === "live" } : item
      )
    );
  };

  const approveLead = async (lead: SourceLead) => {
    if (!configured) return;

    const { data: source, error: sourceError } = await supabase
      .from("telegram_sources")
      .upsert({
        name: `${sourceTypeLabels[lead.source_type]} ${lead.identifier}`,
        source_type: lead.source_type,
        telegram_identifier: lead.identifier,
        status: "paused",
        auto_collect_enabled: false,
        metadata: {
          created_from_source_lead_id: lead.id,
          evidence: lead.evidence,
          evidence_kind: lead.evidence_kind,
          discovery_enabled: true,
          profile_refresh_enabled: true,
          review_note: "관리자가 live로 전환하면 지속 수집 대상에 포함됩니다.",
        },
      }, { onConflict: "source_type,telegram_identifier" })
      .select("*")
      .single();

    if (sourceError) {
      setError(sourceError.message);
      return;
    }

    const { error: leadError } = await supabase
      .from("source_leads")
      .update({ status: "approved", approved_source_id: source.id, reviewed_at: new Date().toISOString() })
      .eq("id", lead.id);

    if (leadError) {
      setError(leadError.message);
      return;
    }

    await Promise.all([loadSources(), loadSourceLeads()]);
  };

  const rejectLead = async (lead: SourceLead, status: Extract<SourceLeadStatus, "rejected" | "duplicate"> = "rejected") => {
    if (!configured) return;
    const { error: updateError } = await supabase
      .from("source_leads")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", lead.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSourceLeads((current) => current.filter((item) => item.id !== lead.id));
  };

  const removeSource = async (source: TelegramSource) => {
    if (!configured) return;
    if (!window.confirm(`${source.name} 소스를 삭제할까요? 연결된 원본 메시지도 함께 삭제될 수 있습니다.`)) return;

    const { error: deleteError } = await supabase.from("telegram_sources").delete().eq("id", source.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSources((current) => current.filter((item) => item.id !== source.id));
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">수집소스</h1>
          <p className="text-[12.5px] text-muted-foreground">텔레그램 단체방·봇·사이트를 등록하고, 자동 발견 후보를 검수합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadSources();
              loadSourceLeads();
            }}
            disabled={loading}
            className="h-9 px-3 border border-border text-[12.5px] rounded-sm inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} /> 새로고침
          </button>
          <button onClick={() => startAdd("telegram")} className="h-9 px-3 border border-cyan/40 text-cyan text-[12.5px] font-semibold rounded-sm inline-flex items-center gap-1.5">
            <Send className="h-4 w-4" /> 텔레그램 추가
          </button>
          <button onClick={() => startAdd("website")} className="h-9 px-3 bg-neon text-[hsl(240_10%_4%)] text-[12.5px] font-semibold rounded-sm inline-flex items-center gap-1.5">
            <Globe2 className="h-4 w-4" /> 사이트 추가
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="border border-border bg-card rounded-md p-3">
          <div className="text-[13px] font-semibold flex items-center gap-2"><Send className="h-4 w-4 text-cyan" /> 텔레그램 수집</div>
          <p className="mt-1 text-[12px] text-muted-foreground">@아이디, t.me 링크, 채팅 ID를 채널·단체방·봇으로 분리 등록합니다.</p>
        </div>
        <div className="border border-border bg-card rounded-md p-3">
          <div className="text-[13px] font-semibold flex items-center gap-2"><Globe2 className="h-4 w-4 text-neon" /> 사이트 수집</div>
          <p className="mt-1 text-[12px] text-muted-foreground">상품 판매 페이지·프로필 URL은 별도 URL 입력 형식으로 저장합니다.</p>
        </div>
        <div className="border border-border bg-card rounded-md p-3">
          <div className="text-[13px] font-semibold flex items-center gap-2"><Bot className="h-4 w-4 text-usdt" /> 자동 발견</div>
          <p className="mt-1 text-[12px] text-muted-foreground">원본 메시지, 봇 버튼, 사이트 본문, 프로필 설명의 새 링크는 후보로 쌓입니다.</p>
        </div>
      </div>

      {error && (
        <div className="border border-usdt/40 bg-usdt/10 text-usdt rounded-md px-3 py-2 text-[12.5px]">
          {error}
        </div>
      )}

      <div className="border border-border bg-card rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-3 h-10 border-b border-border">
          <div>
            <div className="text-[13px] font-semibold">자동 발견 후보</div>
            <div className="text-[11px] text-muted-foreground">입력된 수집소스의 페이지·프로필·메시지·버튼에서 찾은 추가 수집경로입니다. 승인하면 일시정지 상태로 등록되어 검수 후 live 전환할 수 있습니다.</div>
          </div>
          <span className="font-mono text-[12px] text-muted-foreground">{sourceLeads.length}</span>
        </div>
        {sourceLeads.map((lead) => (
          <div key={lead.id} className="grid lg:grid-cols-[0.75fr_0.8fr_1fr_0.8fr_1.4fr_190px] gap-2 px-3 py-2 border-b border-border last:border-b-0 text-[12.5px] items-center">
            <span className="text-[10.5px] px-1.5 py-0.5 border border-cyan/40 bg-cyan/10 text-cyan rounded-sm w-fit">{leadCollectionLabel(lead)}</span>
            <span className="text-muted-foreground">{sourceTypeLabels[lead.source_type]}</span>
            <span className="font-mono truncate">{lead.identifier}</span>
            <span className={"text-[10.5px] px-1.5 py-0.5 border rounded-sm w-fit " + leadStatusCls[lead.status]}>{lead.status}</span>
            <span className="text-muted-foreground truncate" title={lead.evidence}>{lead.evidence || "증거 없음"}</span>
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => approveLead(lead)} className="h-7 px-2 border border-neon/40 rounded-sm text-[11px] text-neon hover:bg-neon/10">승인등록</button>
              <button onClick={() => rejectLead(lead, "duplicate")} className="h-7 px-2 border border-orange-300/30 rounded-sm text-[11px] text-orange-300">중복</button>
              <button onClick={() => rejectLead(lead)} className="h-7 px-2 border border-destructive/30 rounded-sm text-[11px] text-destructive">거절</button>
            </div>
          </div>
        ))}
        {!loading && sourceLeads.length === 0 && (
          <div className="p-4 text-center text-[12.5px] text-muted-foreground">검토할 발견 후보가 없습니다. 수집기가 새 주소를 찾으면 여기에 쌓입니다.</div>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-border bg-card rounded-md p-3 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[13px] font-semibold">{editingId ? "수집소스 수정" : inputMode === "website" ? "사이트 주소 추가" : "텔레그램 수집소스 추가"}</div>
              <div className="text-[11.5px] text-muted-foreground">{inputMode === "website" ? "웹사이트는 URL 형식으로 입력하고, 저장 후 웹 수집기에서 본문·링크를 분석합니다." : "텔레그램은 @아이디/t.me/채팅 ID를 입력하고 채널·단체방·봇 종류를 선택합니다."}</div>
            </div>
            {!editingId && (
              <div className="inline-flex border border-border rounded-sm overflow-hidden text-[12px]">
                <button type="button" onClick={() => startAdd("telegram")} className={(inputMode === "telegram" ? "bg-cyan/15 text-cyan" : "text-muted-foreground") + " h-8 px-3 border-r border-border"}>텔레그램</button>
                <button type="button" onClick={() => startAdd("website")} className={(inputMode === "website" ? "bg-neon/15 text-neon" : "text-muted-foreground") + " h-8 px-3"}>사이트 URL</button>
              </div>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1.35fr_150px_140px_140px_auto] md:items-end">
          <label className="space-y-1 text-[12px] text-muted-foreground">
            <span>소스 이름</span>
            <input
              value={form.name}
              onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
              placeholder="GPT Market Korea"
              className="w-full h-9 px-3 bg-background border border-border rounded-sm text-foreground outline-none focus:border-neon"
            />
          </label>
          <label className="space-y-1 text-[12px] text-muted-foreground">
            <span>{inputMode === "website" ? "사이트 주소" : "텔레그램 식별자"}</span>
            <input
              value={form.telegram_identifier}
              onChange={(event) => setForm((value) => ({ ...value, telegram_identifier: event.target.value }))}
              placeholder={inputMode === "website" ? "https://example.com/products" : "@gpt_market_kr 또는 https://t.me/..."}
              className="w-full h-9 px-3 bg-background border border-border rounded-sm font-mono text-foreground outline-none focus:border-neon"
            />
          </label>
          <label className="space-y-1 text-[12px] text-muted-foreground">
            <span>종류</span>
            <select
              value={form.source_type}
              onChange={(event) => {
                const sourceType = event.target.value as SourceType;
                setInputMode(inferInputMode(sourceType));
                setForm((value) => ({ ...value, source_type: sourceType }));
              }}
              className="w-full h-9 px-3 bg-background border border-border rounded-sm text-foreground outline-none focus:border-neon"
            >
              {inputMode === "website" ? (
                <option value="website">Website</option>
              ) : (
                <>
                  <option value="channel">Channel</option>
                  <option value="group">Group</option>
                  <option value="bot">Bot</option>
                  <option value="manual">Manual</option>
                </>
              )}
            </select>
          </label>
          <label className="space-y-1 text-[12px] text-muted-foreground">
            <span>신뢰도 보정</span>
            <input
              value={form.trust_override}
              onChange={(event) => setForm((value) => ({ ...value, trust_override: event.target.value }))}
              placeholder="4.5"
              type="number"
              min="0"
              max="5"
              step="0.1"
              className="w-full h-9 px-3 bg-background border border-border rounded-sm font-mono text-foreground outline-none focus:border-neon"
            />
          </label>
          <label className="space-y-1 text-[12px] text-muted-foreground">
            <span>상태</span>
            <select
              value={form.status}
              onChange={(event) => {
                const status = event.target.value as SourceStatus;
                setForm((value) => ({ ...value, status, auto_collect_enabled: status === "live" ? true : value.auto_collect_enabled }));
              }}
              className="w-full h-9 px-3 bg-background border border-border rounded-sm text-foreground outline-none focus:border-neon"
            >
              <option value="live">live</option>
              <option value="paused">paused</option>
              <option value="throttled">throttled</option>
              <option value="blocked">blocked</option>
            </select>
          </label>
          <button
            disabled={saving}
            className="h-9 px-3 bg-neon text-[hsl(240_10%_4%)] text-[12.5px] font-semibold rounded-sm disabled:opacity-60"
          >
            {saving ? "저장 중" : editingId ? "수정" : "저장"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="h-9 px-3 border border-border text-[12.5px] rounded-sm">
              취소
            </button>
          )}
          </div>
        </form>
      )}

      <div className="hidden lg:block border border-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1.4fr_0.7fr_0.8fr_0.8fr_0.8fr_0.7fr_190px] px-3 h-9 items-center bg-card text-[11px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border">
          <span>이름</span><span>종류</span><span>상태</span><span>최근 수신</span><span>자동수집</span><span>신뢰도</span><span></span>
        </div>
        {sources.map((source) => (
          <div key={source.id} className="grid grid-cols-[1.4fr_0.7fr_0.8fr_0.8fr_0.8fr_0.7fr_190px] px-3 h-11 items-center text-[12.5px] border-b border-border last:border-b-0 hover:bg-muted/30">
            <span className="font-mono text-foreground truncate">{source.telegram_identifier}</span>
            <span className="text-muted-foreground">{sourceTypeLabels[source.source_type]}</span>
            <span className={"text-[10.5px] px-1.5 py-0.5 border rounded-sm w-fit " + statusCls[source.status]}>{statusLabels[source.status]}</span>
            <span className="text-muted-foreground font-mono">{formatDate(source.updated_at)}</span>
            <span className="text-foreground font-mono">{source.auto_collect_enabled ? "ON" : "OFF"}</span>
            <span className="text-usdt font-mono">{source.trust_override ?? "auto"}</span>
            <div className="flex items-center gap-1 justify-end">
              <button onClick={() => updateStatus(source, source.status === "live" ? "paused" : "live")} className="h-7 px-2 border border-border rounded-sm text-[11px] text-muted-foreground hover:text-foreground">
                {source.status === "live" ? "pause" : "live"}
              </button>
              <button onClick={() => updateStatus(source, "blocked")} className="h-7 px-2 border border-destructive/30 rounded-sm text-[11px] text-destructive/80 hover:text-destructive">
                block
              </button>
              <button
                onClick={() => {
                  setEditingId(source.id);
                  setForm(sourceToForm(source));
                  setInputMode(inferInputMode(source.source_type));
                  setShowForm(true);
                }}
                className="h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="수정"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => removeSource(source)} className="h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-destructive" title="삭제">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {!loading && sources.length === 0 && (
          <div className="p-5 text-center text-[12.5px] text-muted-foreground">등록된 소스가 없습니다. 먼저 텔레그램 소스를 추가하세요.</div>
        )}
      </div>

      <div className="lg:hidden space-y-3">
        {sources.map((source) => (
          <div key={source.id} className="border border-border rounded-md bg-card p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[13px] truncate">{source.telegram_identifier}</div>
                <div className="text-[11.5px] text-muted-foreground truncate">{source.name}</div>
              </div>
              <span className={"text-[10.5px] px-1.5 py-0.5 border rounded-sm shrink-0 " + statusCls[source.status]}>{statusLabels[source.status]}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11.5px] text-muted-foreground">
              <span>종류: {sourceTypeLabels[source.source_type]}</span>
              <span>자동수집: {source.auto_collect_enabled ? "ON" : "OFF"}</span>
              <span>신뢰도: {source.trust_override ?? "auto"}</span>
              <span>수정: {formatDate(source.updated_at)}</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => updateStatus(source, source.status === "live" ? "paused" : "live")} className="h-8 border border-border rounded-sm text-[12px] col-span-2">
                {source.status === "live" ? "일시정지" : "live 전환"}
              </button>
              <button
                onClick={() => {
                  setEditingId(source.id);
                  setForm(sourceToForm(source));
                  setInputMode(inferInputMode(source.source_type));
                  setShowForm(true);
                }}
                className="h-8 border border-border rounded-sm text-[12px]"
              >
                수정
              </button>
              <button onClick={() => updateStatus(source, "blocked")} className="h-8 border border-destructive/30 rounded-sm text-[12px] text-destructive">
                차단
              </button>
            </div>
            <button onClick={() => removeSource(source)} className="w-full h-8 border border-border rounded-sm text-[12px] text-muted-foreground">
              삭제
            </button>
          </div>
        ))}
        {!loading && sources.length === 0 && (
          <div className="border border-border rounded-md p-5 text-center text-[12.5px] text-muted-foreground">등록된 소스가 없습니다.</div>
        )}
      </div>
    </div>
  );
}
