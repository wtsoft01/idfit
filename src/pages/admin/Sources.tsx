import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type TelegramSource = Tables<"telegram_sources">;
type SourceType = TelegramSource["source_type"];
type SourceStatus = TelegramSource["status"];

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

export default function AdminSources() {
  const [sources, setSources] = useState<TelegramSource[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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

  useEffect(() => {
    loadSources();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const sourceToForm = (source: TelegramSource): SourceForm => ({
    name: source.name,
    telegram_identifier: source.telegram_identifier,
    source_type: source.source_type,
    status: source.status,
    trust_override: source.trust_override?.toString() ?? "",
    auto_collect_enabled: source.auto_collect_enabled,
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!configured) {
      setError("먼저 전체 Supabase publishable key를 .env에 넣어야 소스를 저장할 수 있습니다.");
      return;
    }

    const identifier = form.telegram_identifier.trim();
    if (!form.name.trim() || !identifier) {
      setError("소스 이름과 텔레그램 식별자는 필수입니다.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      telegram_identifier: identifier.startsWith("@") ? identifier : `@${identifier}`,
      source_type: form.source_type,
      status: form.status,
      auto_collect_enabled: form.auto_collect_enabled,
      trust_override: form.trust_override ? Number(form.trust_override) : null,
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
          <h1 className="font-display text-xl font-bold">수집 소스</h1>
          <p className="text-[12.5px] text-muted-foreground">텔레그램 채널·그룹·봇 등록 및 모니터링</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSources}
            disabled={loading}
            className="h-9 px-3 border border-border text-[12.5px] rounded-sm inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} /> 새로고침
          </button>
          <button
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setShowForm((value) => !value);
            }}
            className="h-9 px-3 bg-neon text-[hsl(240_10%_4%)] text-[12.5px] font-semibold rounded-sm inline-flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> 소스 추가
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-usdt/40 bg-usdt/10 text-usdt rounded-md px-3 py-2 text-[12.5px]">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-border bg-card rounded-md p-3 grid gap-3 md:grid-cols-[1fr_1fr_150px_140px_140px_auto] md:items-end">
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
            <span>텔레그램 식별자</span>
            <input
              value={form.telegram_identifier}
              onChange={(event) => setForm((value) => ({ ...value, telegram_identifier: event.target.value }))}
              placeholder="@gpt_market_kr"
              className="w-full h-9 px-3 bg-background border border-border rounded-sm font-mono text-foreground outline-none focus:border-neon"
            />
          </label>
          <label className="space-y-1 text-[12px] text-muted-foreground">
            <span>종류</span>
            <select
              value={form.source_type}
              onChange={(event) => setForm((value) => ({ ...value, source_type: event.target.value as SourceType }))}
              className="w-full h-9 px-3 bg-background border border-border rounded-sm text-foreground outline-none focus:border-neon"
            >
              <option value="channel">Channel</option>
              <option value="group">Group</option>
              <option value="bot">Bot</option>
              <option value="manual">Manual</option>
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
