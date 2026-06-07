import { useState } from "react";

const MODE_COLORS = { read: "#34d399", write: "#f87171", exec: "#fbbf24", call: "#c084fc" };

export default function LeaseTable({ leases }) {
  const [sortKey, setSortKey] = useState("expires_at");
  const [sortDir, setSortDir] = useState(1);

  const sorted = [...leases].sort((a, b) =>
    sortDir * (a[sortKey] > b[sortKey] ? 1 : -1)
  );

  const toggle = key => {
    if (key === sortKey) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(1); }
  };

  const ttl = expires_at => {
    const s = Math.max(0, expires_at - Date.now() / 1000);
    return s < 60 ? `${s.toFixed(0)}s` : `${(s/60).toFixed(1)}m`;
  };

  if (!leases.length) return (
    <div style={{ color: "var(--muted)", fontSize: 13, padding: "12px 0" }}>No active leases.</div>
  );

  const th = { fontSize: 11, color: "var(--muted)", padding: "6px 8px", cursor: "pointer",
               textTransform: "uppercase", letterSpacing: 1, textAlign: "left" };
  const td = { fontSize: 12, padding: "8px 8px", borderTop: "1px solid var(--border)",
               fontFamily: "var(--mono)" };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {[["agent_id","Agent"],["resource","Resource"],["mode","Mode"],["expires_at","TTL"]].map(([k,l]) => (
            <th key={k} style={th} onClick={() => toggle(k)}>{l}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((l, i) => (
          <tr key={i}>
            <td style={td}>{l.agent_id}</td>
            <td style={{ ...td, color: "var(--text)" }}>{l.resource}</td>
            <td style={td}>
              <span style={{
                background: MODE_COLORS[l.mode] + "22",
                color: MODE_COLORS[l.mode],
                padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
              }}>{l.mode}</span>
            </td>
            <td style={{ ...td, color: "var(--yellow)" }}>{ttl(l.expires_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
