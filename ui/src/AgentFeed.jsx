const EVENT_COLORS = {
  ACQUIRED:       "#34d399",
  RELEASED:       "#8899aa",
  QUEUED:         "#fbbf24",
  EXPIRED:        "#f87171",
  DEADLOCK_BREAK: "#c084fc",
};

function reltime(ts) {
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

export default function AgentFeed({ events }) {
  if (!events.length) return (
    <div style={{ color: "var(--muted)", fontSize: 13 }}>No events yet.</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {events.map((e, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", marginTop: 4, flexShrink: 0,
            background: EVENT_COLORS[e.event] || "#8899aa",
          }} />
          <div style={{ flex: 1 }}>
            <span style={{ color: EVENT_COLORS[e.event] || "var(--muted)", fontWeight: 600 }}>
              {e.event}
            </span>
            {" "}
            <span style={{ color: "var(--accent)", fontFamily: "var(--mono)" }}>{e.agent_id}</span>
            {" → "}
            <span style={{ color: "var(--text)", fontFamily: "var(--mono)" }}>{e.resource}</span>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 11, flexShrink: 0, marginTop: 1 }}>
            {reltime(e.ts)}
          </div>
        </div>
      ))}
    </div>
  );
}
