const FUSE_AGENT = "fuse_agent";
const PROXY_AGENT = "https_proxy";

function SectionHeader({ label, badge, badgeColor }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      {badge && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
          background: badgeColor + "22", color: badgeColor,
        }}>{badge}</span>
      )}
    </div>
  );
}

function InterceptedLeases({ leases, agentPrefix }) {
  const filtered = leases.filter(l => l.agent_id === agentPrefix || l.agent_id?.startsWith(agentPrefix));
  if (!filtered.length) return (
    <div style={{ color: "var(--muted)", fontSize: 12 }}>No intercepted resources.</div>
  );
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {["Resource", "Mode", "Agent", "TTL"].map(h => (
            <th key={h} style={{
              fontSize: 11, color: "var(--muted)", padding: "4px 8px", textAlign: "left",
              textTransform: "uppercase", letterSpacing: 1,
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filtered.map((l, i) => {
          const ttl = Math.max(0, l.expires_at - Date.now() / 1000);
          const ttlStr = ttl < 60 ? `${ttl.toFixed(0)}s` : `${(ttl / 60).toFixed(1)}m`;
          const modeColors = { read: "#34d399", write: "#f87171", exec: "#fbbf24", call: "#c084fc" };
          return (
            <tr key={i}>
              <td style={{ fontSize: 12, padding: "6px 8px", fontFamily: "var(--mono)", color: "var(--text)", borderTop: "1px solid var(--border)" }}>{l.resource}</td>
              <td style={{ fontSize: 12, padding: "6px 8px", borderTop: "1px solid var(--border)" }}>
                <span style={{
                  background: (modeColors[l.mode] || "#8899aa") + "22",
                  color: modeColors[l.mode] || "#8899aa",
                  padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: "var(--mono)",
                }}>{l.mode}</span>
              </td>
              <td style={{ fontSize: 12, padding: "6px 8px", fontFamily: "var(--mono)", color: "var(--accent)", borderTop: "1px solid var(--border)" }}>{l.agent_id}</td>
              <td style={{ fontSize: 12, padding: "6px 8px", fontFamily: "var(--mono)", color: "var(--yellow)", borderTop: "1px solid var(--border)" }}>{ttlStr}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function InterceptedEvents({ events, agentPrefix }) {
  const filtered = events.filter(e => e.agent_id === agentPrefix || e.agent_id?.startsWith(agentPrefix));
  const eventColors = {
    ACQUIRED: "#34d399", RELEASED: "#8899aa", QUEUED: "#fbbf24",
    EXPIRED: "#f87171", DEADLOCK_BREAK: "#c084fc",
  };
  if (!filtered.length) return (
    <div style={{ color: "var(--muted)", fontSize: 12 }}>No recent intercept events.</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {filtered.slice(0, 15).map((e, i) => {
        const s = Math.floor(Date.now() / 1000 - e.ts);
        const rel = s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: eventColors[e.event] || "#8899aa", flexShrink: 0 }} />
            <span style={{ color: eventColors[e.event] || "var(--muted)", fontWeight: 600, minWidth: 90 }}>{e.event}</span>
            <span style={{ color: "var(--text)", fontFamily: "var(--mono)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.resource}</span>
            <span style={{ color: "var(--muted)", fontSize: 11, flexShrink: 0 }}>{rel}</span>
          </div>
        );
      })}
    </div>
  );
}

const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 20,
};

export default function InterceptionPanel({ leases, events }) {
  const fuseLeases = leases.filter(l => l.agent_id === FUSE_AGENT || l.agent_id?.startsWith(FUSE_AGENT));
  const proxyLeases = leases.filter(l => l.agent_id === PROXY_AGENT || l.agent_id?.startsWith(PROXY_AGENT));
  const fuseActive = fuseLeases.length > 0;
  const proxyActive = proxyLeases.length > 0;

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* FUSE Mount */}
      <div style={card}>
        <SectionHeader
          label="FUSE Filesystem Proxy"
          badge={fuseActive ? "Active" : "Idle"}
          badgeColor={fuseActive ? "#34d399" : "#8899aa"}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Install</div>
            <pre style={{
              background: "#0a0e14", border: "1px solid var(--border)", borderRadius: 6,
              padding: "10px 12px", fontSize: 11, fontFamily: "var(--mono)",
              color: "var(--text)", margin: 0, lineHeight: 1.6,
            }}>{`# macOS
brew install --cask macfuse
pip install fusepy

# Linux
apt install fuse libfuse-dev
pip install fusepy`}</pre>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Mount</div>
            <pre style={{
              background: "#0a0e14", border: "1px solid var(--border)", borderRadius: 6,
              padding: "10px 12px", fontSize: 11, fontFamily: "var(--mono)",
              color: "var(--text)", margin: 0, lineHeight: 1.6,
            }}>{`BOARD_URL=http://localhost:8765 \\
BOARD_AGENT_ID=fuse_agent \\
python -m interception.fuse_mount \\
  /data/shared /mnt/harness`}</pre>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Intercepted Leases</div>
            <InterceptedLeases leases={leases} agentPrefix={FUSE_AGENT} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Recent Events</div>
            <InterceptedEvents events={events} agentPrefix={FUSE_AGENT} />
          </div>
        </div>
      </div>

      {/* HTTPS Proxy */}
      <div style={{ ...card, opacity: proxyActive ? 1 : 0.75 }}>
        <SectionHeader
          label="HTTPS Proxy"
          badge={proxyActive ? "Active" : "P1 — In Development"}
          badgeColor={proxyActive ? "#34d399" : "#fbbf24"}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>How it works</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
              Transparent HTTPS proxy that intercepts outbound API calls from agents.
              Any request to a registered host (e.g. <code style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>api.openai.com</code>) automatically
              acquires a lease before forwarding and releases it on response.
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Planned Usage</div>
            <pre style={{
              background: "#0a0e14", border: "1px solid var(--border)", borderRadius: 6,
              padding: "10px 12px", fontSize: 11, fontFamily: "var(--mono)",
              color: proxyActive ? "var(--text)" : "var(--muted)", margin: 0, lineHeight: 1.6,
            }}>{`BOARD_URL=http://localhost:8765 \\
BOARD_AGENT_ID=https_proxy \\
python -m interception.https_proxy \\
  --port 8888 --upstream-ca ca.crt`}</pre>
          </div>
        </div>

        {proxyActive ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Intercepted Leases</div>
              <InterceptedLeases leases={leases} agentPrefix={PROXY_AGENT} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Recent Events</div>
              <InterceptedEvents events={events} agentPrefix={PROXY_AGENT} />
            </div>
          </div>
        ) : (
          <div style={{
            border: "1px dashed var(--border)", borderRadius: 6, padding: "14px 16px",
            fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ color: "var(--yellow)", fontWeight: 700 }}>●</span>
            <span><code style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>interception/https_proxy.py</code> is a P1 deliverable — not yet shipped. This panel will light up when the proxy connects to the board.</span>
          </div>
        )}
      </div>

      {/* MCP Proxy - P2 */}
      <div style={{ ...card, opacity: 0.5 }}>
        <SectionHeader
          label="MCP Proxy"
          badge="P2 — Roadmap"
          badgeColor="#8899aa"
        />
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
          Intercept MCP tool calls at the protocol level — no adapter code required. Any MCP-compatible agent routes through the proxy automatically. Planned for Q3 2026.
        </div>
      </div>

    </div>
  );
}
