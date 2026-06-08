const threads = [
  { name: "alex***@p", last: "Midjourney 로그아웃됐어요", unread: 2, time: "방금" },
  { name: "vn***@gx", last: "2FA 코드 메일 안와요", unread: 1, time: "12분" },
  { name: "kim***@na", last: "환불 처리 부탁드립니다", unread: 0, time: "1시간" },
  { name: "jun***@gm", last: "결제 완료 했는데 언제 받나요", unread: 0, time: "2시간" },
];

const messages = [
  { from: "user", text: "Midjourney 30일 구매했는데 어제부터 로그아웃 됩니다.", time: "12:01" },
  { from: "admin", text: "안녕하세요. 주문번호 DS-20292 맞으실까요? 즉시 재발급 도와드리겠습니다.", time: "12:02" },
  { from: "user", text: "네 맞아요!", time: "12:03" },
  { from: "admin", text: "신규 자격증명 전송 완료했습니다. 텔레그램 알림 확인 부탁드릴게요 🙏", time: "12:04" },
];

export default function AdminChat() {
  return (
    <div className="h-[calc(100vh-100px)] grid grid-cols-[280px_1fr]">
      <aside className="border-r border-border bg-card overflow-y-auto">
        <div className="px-3 h-10 flex items-center text-[12.5px] font-semibold border-b border-border">대화 ({threads.length})</div>
        {threads.map((t) => (
          <button key={t.name} className="w-full text-left px-3 py-2.5 border-b border-border hover:bg-muted/30 flex items-start gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-neon/40 to-cyan/30 flex items-center justify-center text-[11px] font-semibold shrink-0">
              {t.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium truncate">{t.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{t.time}</span>
              </div>
              <div className="text-[11.5px] text-muted-foreground truncate">{t.last}</div>
            </div>
            {t.unread > 0 && <span className="h-4 min-w-4 px-1 rounded-full bg-neon text-[hsl(240_10%_4%)] text-[10px] font-mono font-semibold flex items-center justify-center">{t.unread}</span>}
          </button>
        ))}
      </aside>

      <section className="flex flex-col bg-background">
        <div className="px-4 h-12 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-neon/40 to-cyan/30 flex items-center justify-center text-[11px] font-semibold">A</div>
            <div>
              <div className="text-[13px] font-medium">alex***@p</div>
              <div className="text-[10.5px] text-muted-foreground font-mono">order DS-20292 · Midjourney 30d</div>
            </div>
          </div>
          <button className="h-7 px-2.5 text-[11.5px] border border-border rounded-sm">티켓으로 전환</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={"flex " + (m.from === "admin" ? "justify-end" : "justify-start")}>
              <div className={
                "max-w-[70%] rounded-md px-3 py-2 text-[12.5px] " +
                (m.from === "admin" ? "bg-neon text-[hsl(240_10%_4%)]" : "bg-card border border-border text-foreground")
              }>
                <div>{m.text}</div>
                <div className={"text-[10px] mt-1 font-mono " + (m.from === "admin" ? "text-[hsl(240_10%_4%)]/60" : "text-muted-foreground")}>{m.time}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border p-3 flex gap-2">
          <input className="flex-1 h-9 px-3 bg-background border border-border rounded-sm text-[13px] focus:outline-none focus:border-neon" placeholder="메시지 입력…" />
          <button className="h-9 px-4 bg-neon text-[hsl(240_10%_4%)] text-[12.5px] font-semibold rounded-sm">전송</button>
        </div>
      </section>
    </div>
  );
}
