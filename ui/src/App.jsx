import { useState, useEffect, useCallback } from "react";
import LeaseTable from "./LeaseTable";
import AgentFeed from "./AgentFeed";
import ConflictLog from "./ConflictLog";
import AdaptersPanel from "./AdaptersPanel";
import InterceptionPanel from "./InterceptionPanel";
import PolicyPanel from "./PolicyPanel";
import GraphPanel from "./GraphPanel";

const BOARD = import.meta.env.VITE_BOARD_URL || "http://localhost:8765";
const POLL_MS = 2000;

const css = `
  :root {
    --bg:       #0a0e14;
    --surface:  #111827;
    --border:   #1e2d42;
    --accent:   #4da4ff;
    --text:     #e2e8f0;
    --muted:    #8899aa;
    --green:    #34d399;
    --yellow:   #fbbf24;
    --red:      #f87171;
    --purple:   #c084fc;
    --font:     'Inter', system-ui, sans-serif;
    --mono:     'JetBrains Mono', 'Fira Code', monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: var(--font); }
  a { color: var(--accent); text-decoration: none; }
  input:focus { border-color: var(--accent) !important; }
`;

const NAV = [
  { key: "dashboard",    label: "Dashboard",       phase: null },
  { key: "leases",       label: "Leases",          phase: null },
  { key: "audit",        label: "Audit Log",       phase: null },
  { key: "graph",        label: "Conflict Graph",  phase: null },
  { key: "adapters",     label: "Adapters",        phase: "P0" },
  { key: "interception", label: "Interception",    phase: "P1" },
  { key: "policies",     label: "Policies",        phase: null },
];

const PHASE_COLORS = { P0: "#34d399", P1: "#4da4ff", P2: "#8899aa" };

export default function App() {
  const [leases,   setLeases]   = useState([]);
  const [audit,    setAudit]    = useState([]);
  const [graph,    setGraph]    = useState({ nodes: [], edges: [], cycles: [] });
  const [health,   setHealth]   = useState(null);
  const [policies, setPolicies] = useState({});
  const [nav,      setNav]      = useState("dashboard");

  const fetchPolicies = useCallback(async () => {
    try {
      const p = await fetch(`${BOARD}/policies`).then(r => r.json());
      setPolicies(p.policies || {});
    } catch (_) {}
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const [l, a, g, h] = await Promise.all([
          fetch(`${BOARD}/leases`).then(r => r.json()),
          fetch(`${BOARD}/audit?limit=100`).then(r => r.json()),
          fetch(`${BOARD}/graph`).then(r => r.json()),
          fetch(`${BOARD}/health`).then(r => r.json()),
        ]);
        setLeases(l.leases || []);
        setAudit(a.events || []);
        setGraph(g);
        setHealth(h);
      } catch (_) { setHealth(null); }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const conflicts    = audit.filter(e => e.event === "QUEUED" || e.event === "DEADLOCK_BREAK");
  const fuseLeases   = leases.filter(l => l.agent_id === "fuse_agent" || l.agent_id?.startsWith("fuse_"));
  const proxyLeases  = leases.filter(l => l.agent_id === "https_proxy" || l.agent_id?.startsWith("https_proxy"));
  const intercepted  = fuseLeases.length + proxyLeases.length;
  const statusDot    = health ? "var(--green)" : "var(--red)";

  return (
    <>
      <style>{css}</style>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

        {/* Sidebar */}
        <nav style={{
          width: 220, background: "var(--surface)", borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column", padding: "20px 0",
        }}>
          <div style={{ padding: "0 20px 24px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)", letterSpacing: 2 }}>RIVA</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>agent-harness-board</div>
          </div>

          <div style={{ flex: 1, paddingTop: 8 }}>
            {NAV.map(item => (
              <button key={item.key} onClick={() => setNav(item.key)} style={{
                background: nav === item.key ? "var(--border)" : "transparent",
                border: "none", color: nav === item.key ? "var(--accent)" : "var(--muted)",
                padding: "10px 20px", textAlign: "left", cursor: "pointer",
                fontSize: 13, fontWeight: nav === item.key ? 600 : 400,
                borderLeft: nav === item.key ? "3px solid var(--accent)" : "3px solid transparent",
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span>{item.label}</span>
                {item.phase && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                    background: PHASE_COLORS[item.phase] + "22",
                    color: PHASE_COLORS[item.phase],
                  }}>{item.phase}</span>
                )}
              </button>
            ))}
          </div>

          {/* Phase status legend */}
          <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)" }}>
            {[
              { phase: "P0", label: "Adapters", color: "#34d399", done: true },
              { phase: "P1", label: "Interception", color: "#4da4ff", done: true },
              { phase: "P2", label: "MCP Proxy", color: "#8899aa", done: false },
            ].map(({ phase, label, color, done }) => (
              <div key={phase} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: done ? color : "var(--border)", flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: done ? color : "var(--muted)" }}>{phase} {label}</span>
                {done && <span style={{ fontSize: 9, color: color, marginLeft: "auto" }}>✓</span>}
              </div>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Topbar */}
          <header style={{
            height: 52, background: "var(--surface)", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", padding: "0 24px", gap: 12,
          }}>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
              {NAV.find(n => n.key === nav)?.label || nav}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot }} />
              {health ? `Board v${health.version}` : "Disconnected"}
            </div>
          </header>

          {/* Body */}
          <main style={{ flex: 1, overflow: "auto", padding: 24 }}>

            {nav === "dashboard" && (
              <div style={{ display: "grid", gap: 16 }}>
                {/* Stat cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
                  {[
                    { label: "Active Leases",   value: leases.length,                                    color: "var(--accent)" },
                    { label: "Agents Online",   value: new Set(leases.map(l => l.agent_id)).size,        color: "var(--green)" },
                    { label: "Intercepted",     value: intercepted,                                      color: "var(--purple)" },
                    { label: "Conflicts",       value: conflicts.length,                                 color: "var(--yellow)" },
                    { label: "Deadlocks",       value: graph.cycles?.length || 0,                        color: "var(--red)" },
                  ].map(card => (
                    <div key={card.label} style={{
                      background: "var(--surface)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: 20,
                    }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: card.color, fontFamily: "var(--mono)" }}>
                        {card.value}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{card.label}</div>
                    </div>
                  ))}
                </div>

                {/* Main grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Active Leases</div>
                    <LeaseTable leases={leases} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Live Feed</div>
                      <AgentFeed events={audit.slice(0, 20)} />
                    </div>
                    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Conflicts</div>
                      <ConflictLog conflicts={conflicts.slice(0, 10)} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {nav === "leases" && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                <LeaseTable leases={leases} />
              </div>
            )}

            {nav === "audit" && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                <AgentFeed events={audit} />
              </div>
            )}

            {nav === "graph" && <GraphPanel graph={graph} />}

            {nav === "adapters" && <AdaptersPanel leases={leases} events={audit} />}

            {nav === "interception" && <InterceptionPanel leases={leases} events={audit} />}

            {nav === "policies" && (
              <PolicyPanel policies={policies} onPolicyAdded={fetchPolicies} />
            )}

          </main>
        </div>
      </div>
    </>
  );
}
