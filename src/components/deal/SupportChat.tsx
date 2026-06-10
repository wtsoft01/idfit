import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Bell, Headset, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type SenderRole = "customer" | "admin" | "system";

type SupportMessage = {
  id: string;
  user_id: string;
  order_id: string | null;
  as_ticket_id: string | null;
  topic: string;
  sender_role: SenderRole;
  sender_id: string | null;
  body: string;
  read_by_customer_at: string | null;
  read_by_staff_at: string | null;
  created_at: string;
};

type MessageTable = {
  from: (table: "support_messages") => ReturnType<typeof supabase.from>;
};

function messageClient() {
  return supabase as unknown as MessageTable;
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function SupportChat({
  topic = "일반 문의",
  height = "h-[460px]",
  showHeader = true,
  orderId = null,
  asTicketId = null,
  customerId = null,
  mode = "customer",
}: {
  topic?: string;
  height?: string;
  showHeader?: boolean;
  orderId?: string | null;
  asTicketId?: string | null;
  customerId?: string | null;
  mode?: "customer" | "admin";
}) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<SupportMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const targetUserId = mode === "admin" ? customerId : user?.id;
  const canSend = Boolean(isSupabaseConfigured && user && targetUserId);

  const roomLabel = useMemo(() => {
    if (asTicketId) return `AS-${asTicketId.slice(0, 8).toUpperCase()}`;
    if (orderId) return `주문-${orderId.slice(0, 8)}`;
    return topic;
  }, [asTicketId, orderId, topic]);

  const loadMessages = async () => {
    if (!targetUserId || !isSupabaseConfigured) return;
    setLoading(true);
    setError(null);

    let query = messageClient()
      .from("support_messages")
      .select("id,user_id,order_id,as_ticket_id,topic,sender_role,sender_id,body,read_by_customer_at,read_by_staff_at,created_at")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (asTicketId) query = query.eq("as_ticket_id", asTicketId);
    else if (orderId) query = query.eq("order_id", orderId);
    else query = query.eq("topic", topic);

    const { data, error: queryError } = await query;
    if (queryError) {
      const missingTable = queryError.code === "42P01" || queryError.message.toLowerCase().includes("support_messages");
      setError(missingTable ? "상담 메시지 테이블이 아직 배포 DB에 적용되지 않았습니다." : queryError.message);
      setMsgs([]);
    } else {
      const rows = (data ?? []) as SupportMessage[];
      setMsgs(rows);
      const unreadIds = rows
        .filter((msg) => mode === "customer" ? msg.sender_role === "admin" && !msg.read_by_customer_at : msg.sender_role === "customer" && !msg.read_by_staff_at)
        .map((msg) => msg.id);
      if (unreadIds.length > 0) {
        await messageClient()
          .from("support_messages")
          .update(mode === "customer" ? { read_by_customer_at: new Date().toISOString() } : { read_by_staff_at: new Date().toISOString() })
          .in("id", unreadIds);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMessages();
  }, [targetUserId, orderId, asTicketId, topic, mode]);

  useEffect(() => {
    if (!targetUserId || !isSupabaseConfigured) return;
    const timer = window.setInterval(loadMessages, 5000);
    return () => window.clearInterval(timer);
  }, [targetUserId, orderId, asTicketId, topic, mode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    const value = text.trim();
    if (!value || !user || !targetUserId) return;
    setSending(true);
    setError(null);

    const { error: insertError } = await messageClient()
      .from("support_messages")
      .insert({
        user_id: targetUserId,
        order_id: orderId,
        as_ticket_id: asTicketId,
        topic,
        sender_role: mode === "admin" ? "admin" : "customer",
        sender_id: user.id,
        body: value,
        read_by_customer_at: mode === "customer" ? new Date().toISOString() : null,
        read_by_staff_at: mode === "admin" ? new Date().toISOString() : null,
      });

    setSending(false);
    if (insertError) {
      toast.error(insertError.message);
      setError(insertError.message);
      return;
    }
    setText("");
    await loadMessages();
    toast.success(mode === "admin" ? "고객에게 답변을 보냈습니다." : "관리자에게 메시지를 보냈습니다.");
  };

  return (
    <div className="rounded-md border border-border bg-card flex flex-col overflow-hidden min-w-0">
      {showHeader && (
        <div className="flex items-center gap-2 px-3 min-h-10 border-b border-border bg-background/40 min-w-0">
          <Headset className="h-3.5 w-3.5 text-neon shrink-0" />
          <div className="text-[12.5px] font-semibold truncate">관리자 상담 · {roomLabel}</div>
          <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-mono uppercase text-neon shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-neon pulse-dot" /> live
          </span>
        </div>
      )}
      <div className={cn("flex-1 overflow-y-auto p-3 space-y-2.5", height)}>
        <div className="rounded-sm border border-usdt/30 bg-usdt/10 px-3 py-2 text-[11.5px] text-usdt flex items-start gap-2">
          <Bell className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>메시지를 보내면 상대 화면에 5초 이내 반영됩니다. 주문번호와 AS 증상을 함께 남겨주세요.</span>
        </div>
        {error && (
          <div className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11.5px] text-destructive flex gap-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> <span className="break-words">{error}</span>
          </div>
        )}
        {loading && msgs.length === 0 ? (
          <div className="text-[12px] text-muted-foreground text-center py-8">상담 내역을 불러오는 중입니다.</div>
        ) : msgs.length === 0 ? (
          <div className="text-[12px] text-muted-foreground text-center py-8">아직 상담 메시지가 없습니다.</div>
        ) : msgs.map((msg) => {
          const mine = mode === "admin" ? msg.sender_role === "admin" : msg.sender_role === "customer";
          return (
            <div key={msg.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[82%] px-3 py-2 text-[12.5px] rounded-md border min-w-0",
                mine ? "bg-neon text-[hsl(240_10%_4%)] border-neon" : "bg-muted text-foreground border-border"
              )}>
                <div className="whitespace-pre-wrap break-words">{msg.body}</div>
                <div className={cn("mt-1 text-[10px] font-mono", mine ? "text-[hsl(240_10%_4%)]/70" : "text-muted-foreground")}>
                  {msg.sender_role === "admin" ? "관리자" : "고객"} · {timeLabel(msg.created_at)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="min-h-12 border-t border-border px-2 py-2 flex items-center gap-2 bg-background/40">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && send()}
          placeholder={mode === "admin" ? "고객에게 답변 입력…" : "관리자에게 문의 내용 입력…"}
          className="h-8 text-[12.5px] min-w-0"
          disabled={!canSend || sending}
        />
        <button onClick={send} disabled={!canSend || sending || !text.trim()} className="h-8 w-8 inline-flex items-center justify-center bg-neon text-[hsl(240_10%_4%)] rounded-sm disabled:opacity-50 shrink-0">
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
