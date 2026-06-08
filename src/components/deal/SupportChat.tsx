import { useEffect, useRef, useState } from "react";
import { Send, Headset, Paperclip } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  from: "user" | "admin" | "system";
  text: string;
  at: number;
}

const seedFor = (topic: string): Msg[] => [
  { id: "s1", from: "system", at: Date.now() - 1000 * 60 * 8, text: `상담 주제: ${topic} · 평균 응답 2분` },
  { id: "a1", from: "admin", at: Date.now() - 1000 * 60 * 7, text: "안녕하세요. IDFIT 상담팀입니다. 어떤 도움이 필요하신가요?" },
];

export function SupportChat({
  topic = "일반 문의",
  height = "h-[460px]",
  showHeader = true,
}: {
  topic?: string;
  height?: string;
  showHeader?: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>(() => seedFor(topic));
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    setMsgs((prev) => [...prev, { id: Math.random().toString(36).slice(2, 8), from: "user", text: value, at: Date.now() }]);
    setText("");
    setTimeout(() => {
      setMsgs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2, 8),
          from: "admin",
          text: "확인했습니다. 주문번호 또는 결제 TX 해시를 알려주시면 빠르게 확인하겠습니다.",
          at: Date.now(),
        },
      ]);
    }, 1400);
  };

  return (
    <div className="rounded-md border border-border bg-card flex flex-col overflow-hidden">
      {showHeader && (
        <div className="flex items-center gap-2 px-3 h-10 border-b border-border bg-background/40">
          <Headset className="h-3.5 w-3.5 text-neon" />
          <div className="text-[12.5px] font-semibold">관리자 상담 · {topic}</div>
          <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-mono uppercase text-neon">
            <span className="h-1.5 w-1.5 rounded-full bg-neon pulse-dot" /> online
          </span>
        </div>
      )}
      <div className={cn("flex-1 overflow-y-auto p-3 space-y-2.5", height)}>
        {msgs.map((msg) => (
          <div key={msg.id} className={cn("flex", msg.from === "user" ? "justify-end" : "justify-start")}>
            {msg.from === "system" ? (
              <div className="text-[10.5px] text-muted-foreground font-mono text-center w-full">— {msg.text} —</div>
            ) : (
              <div className={cn(
                "max-w-[78%] px-3 py-2 text-[12.5px] rounded-md border",
                msg.from === "user"
                  ? "bg-neon text-[hsl(240_10%_4%)] border-neon"
                  : "bg-muted text-foreground border-border"
              )}>
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div className={cn("mt-1 text-[10px] font-mono", msg.from === "user" ? "text-[hsl(240_10%_4%)]/70" : "text-muted-foreground")}>
                  {new Date(msg.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="h-12 border-t border-border px-2 flex items-center gap-2 bg-background/40">
        <button className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"><Paperclip className="h-4 w-4" /></button>
        <Input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && send()} placeholder="메시지를 입력하세요" className="h-8 text-[12.5px]" />
        <button onClick={send} className="h-8 w-8 inline-flex items-center justify-center bg-neon text-[hsl(240_10%_4%)] rounded-sm"><Send className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
