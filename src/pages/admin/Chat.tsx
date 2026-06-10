import { useEffect, useMemo, useState } from "react";
import { AlertCircle, MessageCircle, RefreshCw } from "lucide-react";
import { SupportChat } from "@/components/deal/SupportChat";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type SupportMessageRow = {
  id: string;
  user_id: string;
  order_id: string | null;
  as_ticket_id: string | null;
  topic: string;
  sender_role: "customer" | "admin" | "system";
  body: string;
  read_by_staff_at: string | null;
  created_at: string;
};

type CustomerProfile = {
  user_id: string;
  full_name: string;
  role: string;
};

type OrderSummary = {
  id: string;
  order_no: string;
  product: { title: string; service_name: string } | null;
};

type TicketSummary = {
  id: string;
  status: string;
  issue_type: string;
};

type Thread = {
  key: string;
  userId: string;
  orderId: string | null;
  asTicketId: string | null;
  topic: string;
  last: SupportMessageRow;
  unread: number;
  profile: CustomerProfile | null;
  order: OrderSummary | null;
  ticket: TicketSummary | null;
};

type SupportTable = {
  from: (table: "support_messages") => ReturnType<typeof supabase.from>;
};

function supportClient() {
  return supabase as unknown as SupportTable;
}

function formatTime(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간`;
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit" }).format(date);
}

function roomKey(message: SupportMessageRow) {
  return [message.user_id, message.order_id ?? "no-order", message.as_ticket_id ?? message.topic].join("|");
}

export default function AdminChat() {
  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, CustomerProfile>>(new Map());
  const [orders, setOrders] = useState<Map<string, OrderSummary>>(new Map());
  const [tickets, setTickets] = useState<Map<string, TicketSummary>>(new Map());
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThreads = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supportClient()
      .from("support_messages")
      .select("id,user_id,order_id,as_ticket_id,topic,sender_role,body,read_by_staff_at,created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (queryError) {
      const missingTable = queryError.code === "42P01" || queryError.message.toLowerCase().includes("support_messages");
      setError(missingTable ? "상담 메시지 테이블이 아직 배포 DB에 적용되지 않았습니다." : queryError.message);
      setMessages([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as SupportMessageRow[];
    setMessages(rows);

    const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
    const orderIds = Array.from(new Set(rows.map((row) => row.order_id).filter(Boolean))) as string[];
    const ticketIds = Array.from(new Set(rows.map((row) => row.as_ticket_id).filter(Boolean))) as string[];

    const [{ data: profileRows }, { data: orderRows }, { data: ticketRows }] = await Promise.all([
      userIds.length > 0
        ? supabase.from("idfit_profiles").select("user_id, full_name, role").in("user_id", userIds)
        : Promise.resolve({ data: [] }),
      orderIds.length > 0
        ? supabase.from("orders").select("id, order_no, product:products(title, service_name)").in("id", orderIds)
        : Promise.resolve({ data: [] }),
      ticketIds.length > 0
        ? supabase.from("as_tickets").select("id, status, issue_type").in("id", ticketIds)
        : Promise.resolve({ data: [] }),
    ]);

    setProfiles(new Map(((profileRows ?? []) as CustomerProfile[]).map((profile) => [profile.user_id, profile])));
    setOrders(new Map(((orderRows ?? []) as unknown as OrderSummary[]).map((order) => [order.id, order])));
    setTickets(new Map(((ticketRows ?? []) as TicketSummary[]).map((ticket) => [ticket.id, ticket])));
    setLoading(false);
  };

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(loadThreads, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const threads = useMemo(() => {
    const map = new Map<string, Thread>();
    for (const message of messages) {
      const key = roomKey(message);
      const current = map.get(key);
      const unreadAdd = message.sender_role === "customer" && !message.read_by_staff_at ? 1 : 0;
      if (!current) {
        map.set(key, {
          key,
          userId: message.user_id,
          orderId: message.order_id,
          asTicketId: message.as_ticket_id,
          topic: message.topic,
          last: message,
          unread: unreadAdd,
          profile: profiles.get(message.user_id) ?? null,
          order: message.order_id ? orders.get(message.order_id) ?? null : null,
          ticket: message.as_ticket_id ? tickets.get(message.as_ticket_id) ?? null : null,
        });
      } else {
        current.unread += unreadAdd;
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime());
  }, [messages, profiles, orders, tickets]);

  useEffect(() => {
    if (!selectedKey && threads.length > 0) setSelectedKey(threads[0].key);
    if (selectedKey && threads.length > 0 && !threads.some((thread) => thread.key === selectedKey)) setSelectedKey(threads[0].key);
  }, [threads, selectedKey]);

  const selected = threads.find((thread) => thread.key === selectedKey) ?? null;

  return (
    <div className="h-[calc(100vh-100px)] grid grid-cols-1 lg:grid-cols-[320px_1fr] overflow-hidden">
      <aside className="border-r border-border bg-card overflow-y-auto min-h-[260px] lg:min-h-0">
        <div className="px-3 h-10 flex items-center justify-between text-[12.5px] font-semibold border-b border-border">
          <span>실시간 상담 ({threads.length})</span>
          <button onClick={loadThreads} disabled={loading} className="h-7 w-7 inline-flex items-center justify-center border border-border rounded-sm disabled:opacity-60">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>
        {error && <div className="m-3 rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11.5px] text-destructive flex gap-2"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}</div>}
        {threads.length === 0 && !error ? (
          <div className="px-3 py-8 text-center text-[12px] text-muted-foreground">아직 상담 메시지가 없습니다.</div>
        ) : threads.map((thread) => {
          const name = thread.profile?.full_name || `고객 ${thread.userId.slice(0, 8)}`;
          return (
            <button
              key={thread.key}
              onClick={() => setSelectedKey(thread.key)}
              className={cn("w-full text-left px-3 py-2.5 border-b border-border hover:bg-muted/30 flex items-start gap-2", selectedKey === thread.key && "bg-neon/5")}
            >
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-neon/40 to-cyan/30 flex items-center justify-center text-[11px] font-semibold shrink-0">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium truncate">{name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">{formatTime(thread.last.created_at)}</span>
                </div>
                <div className="text-[11.5px] text-muted-foreground truncate">{thread.last.body}</div>
                <div className="text-[10.5px] text-muted-foreground font-mono truncate mt-0.5">
                  {thread.order?.order_no ?? thread.topic}{thread.ticket ? ` · AS ${thread.ticket.status}` : ""}
                </div>
              </div>
              {thread.unread > 0 && <span className="h-4 min-w-4 px-1 rounded-full bg-neon text-[hsl(240_10%_4%)] text-[10px] font-mono font-semibold flex items-center justify-center shrink-0">{thread.unread}</span>}
            </button>
          );
        })}
      </aside>

      <section className="flex flex-col bg-background min-w-0 min-h-[500px]">
        {selected ? (
          <>
            <div className="px-4 min-h-12 flex items-center justify-between border-b border-border gap-3 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-neon/40 to-cyan/30 flex items-center justify-center text-[11px] font-semibold shrink-0">
                  {(selected.profile?.full_name || "고").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate">{selected.profile?.full_name || `고객 ${selected.userId.slice(0, 8)}`}</div>
                  <div className="text-[10.5px] text-muted-foreground font-mono truncate">
                    {selected.order?.order_no ?? selected.topic}{selected.order?.product?.title ? ` · ${selected.order.product.title}` : ""}
                  </div>
                </div>
              </div>
              {selected.asTicketId && <span className="h-7 px-2.5 inline-flex items-center border border-usdt/40 bg-usdt/10 text-usdt rounded-sm text-[11.5px] font-mono shrink-0">AS-{selected.asTicketId.slice(0, 8).toUpperCase()}</span>}
            </div>
            <SupportChat
              key={selected.key}
              mode="admin"
              customerId={selected.userId}
              orderId={selected.orderId}
              asTicketId={selected.asTicketId}
              topic={selected.topic}
              showHeader={false}
              height="h-[calc(100vh-210px)]"
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[12px] text-muted-foreground gap-2">
            <MessageCircle className="h-4 w-4" /> 상담 대화를 선택하세요.
          </div>
        )}
      </section>
    </div>
  );
}
