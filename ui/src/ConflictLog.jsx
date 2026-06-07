export default function ConflictLog({ conflicts }) {
  if (!conflicts.length) return (
    <div style={{ color: "var(--muted)", fontSize: 13 }}>No conflicts.</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {conflicts.map((c, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{
            background: "#fbbf2422", color: "#fbbf24",
            padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, flexShrink: 0,
          }}>
            {c.event === "DEADLOCK_BREAK" ? "DEADLOCK" : "CONFLICT"}
          </span>
          <span style={{ color: "var(--accent)", fontFamily: "var(--mono)", overflow: "hidden",
                         textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.agent_id}
          </span>
          <span style={{ color: "var(--muted)" }}>→</span>
          <span style={{ color: "var(--text)", fontFamily: "var(--mono)", overflow: "hidden",
                         textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {c.resource}
          </span>
        </div>
      ))}
    </div>
  );
}
