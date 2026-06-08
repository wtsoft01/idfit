import { useState } from "react";
import { Bell, BellRing, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Alert {
  id: string;
  keyword: string;
  min: number;
  max: number;
  channel: "telegram" | "email" | "push";
  enabled: boolean;
}

const SEED: Alert[] = [
  { id: "a1", keyword: "ChatGPT Plus", min: 0, max: 15, channel: "telegram", enabled: true },
  { id: "a2", keyword: "Cursor Pro 90일", min: 0, max: 35, channel: "push", enabled: true },
];

export function PriceAlertForm() {
  const [alerts, setAlerts] = useState<Alert[]>(SEED);
  const [keyword, setKeyword] = useState("");
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(20);
  const [channel, setChannel] = useState<Alert["channel"]>("telegram");

  const add = () => {
    if (!keyword.trim()) return toast.error("키워드를 입력하세요");
    if (max <= 0 || max < min) return toast.error("가격 범위를 확인하세요");
    setAlerts((p) => [
      { id: Math.random().toString(36).slice(2, 8), keyword: keyword.trim(), min, max, channel, enabled: true },
      ...p,
    ]);
    setKeyword("");
    toast.success("가격 알림이 등록되었습니다");
  };

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-background/40">
        <BellRing className="h-3.5 w-3.5 text-usdt" />
        <span className="text-[12.5px] font-semibold">가격 알림 · 조건 매칭 시 자동 알림</span>
      </div>

      <div className="p-3 grid md:grid-cols-[1.4fr_auto_auto_auto_auto] gap-2 items-end border-b border-border">
        <div>
          <div className="text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1">키워드</div>
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="예: ChatGPT Plus 30일" className="h-9 text-[12.5px]" />
        </div>
        <div>
          <div className="text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1">최소</div>
          <Input type="number" min={0} value={min} onChange={(e) => setMin(Number(e.target.value))} className="h-9 text-[12.5px] w-20 font-mono" />
        </div>
        <div>
          <div className="text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1">최대 USDT</div>
          <Input type="number" min={0} value={max} onChange={(e) => setMax(Number(e.target.value))} className="h-9 text-[12.5px] w-24 font-mono" />
        </div>
        <div>
          <div className="text-[10.5px] uppercase font-mono tracking-wider text-muted-foreground mb-1">알림</div>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as Alert["channel"])}
            className="h-9 px-2 text-[12.5px] bg-background border border-border rounded-sm"
          >
            <option value="telegram">Telegram</option>
            <option value="email">Email</option>
            <option value="push">Browser Push</option>
          </select>
        </div>
        <button onClick={add} className="h-9 px-3 inline-flex items-center gap-1.5 bg-neon text-[hsl(240_10%_4%)] text-[12px] font-semibold rounded-sm hover:brightness-110">
          <Plus className="h-3.5 w-3.5" /> 알림 추가
        </button>
      </div>

      <div className="divide-y divide-border max-h-56 overflow-auto">
        {alerts.length === 0 && <div className="p-4 text-[12px] text-muted-foreground text-center">등록된 알림이 없습니다.</div>}
        {alerts.map((a) => (
          <div key={a.id} className="px-3 py-2 flex items-center gap-3 text-[12.5px]">
            <Bell className={a.enabled ? "h-3.5 w-3.5 text-neon" : "h-3.5 w-3.5 text-muted-foreground"} />
            <div className="min-w-0 flex-1">
              <div className="text-foreground truncate">{a.keyword}</div>
              <div className="text-[11px] text-muted-foreground font-mono">
                USDT {a.min.toFixed(2)} – {a.max.toFixed(2)} · {a.channel}
              </div>
            </div>
            <button
              onClick={() => setAlerts((p) => p.map((x) => (x.id === a.id ? { ...x, enabled: !x.enabled } : x)))}
              className={"h-7 px-2 text-[11px] border rounded-sm " + (a.enabled ? "border-neon text-neon" : "border-border text-muted-foreground")}
            >
              {a.enabled ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => setAlerts((p) => p.filter((x) => x.id !== a.id))}
              className="h-7 w-7 inline-flex items-center justify-center border border-border rounded-sm text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
