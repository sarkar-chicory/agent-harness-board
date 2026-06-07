import { useMemo } from "react";

const W = 600;
const H = 360;
const NODE_R = 22;

function forceLayout(nodes, edges, iterations = 120) {
  // Simple force-directed: repulsion + spring + centering
  const pos = nodes.map((_, i) => ({
    x: W / 2 + Math.cos((i / nodes.length) * 2 * Math.PI) * 120,
    y: H / 2 + Math.sin((i / nodes.length) * 2 * Math.PI) * 120,
  }));
  const idx = Object.fromEntries(nodes.map((n, i) => [n, i]));

  for (let iter = 0; iter < iterations; iter++) {
    const force = pos.map(() => ({ x: 0, y: 0 }));

    // Repulsion
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = 4000 / (d * d);
        force[i].x += (dx / d) * f;
        force[i].y += (dy / d) * f;
        force[j].x -= (dx / d) * f;
        force[j].y -= (dy / d) * f;
      }
    }

    // Spring (edges)
    for (const [a, b] of edges) {
      if (!(a in idx) || !(b in idx)) continue;
      const i = idx[a], j = idx[b];
      const dx = pos[j].x - pos[i].x;
      const dy = pos[j].y - pos[i].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 100) * 0.05;
      force[i].x += (dx / d) * f;
      force[i].y += (dy / d) * f;
      force[j].x -= (dx / d) * f;
      force[j].y -= (dy / d) * f;
    }

    // Centering
    for (let i = 0; i < pos.length; i++) {
      force[i].x += (W / 2 - pos[i].x) * 0.01;
      force[i].y += (H / 2 - pos[i].y) * 0.01;
    }

    // Integrate
    for (let i = 0; i < pos.length; i++) {
      pos[i].x = Math.max(NODE_R + 4, Math.min(W - NODE_R - 4, pos[i].x + force[i].x * 0.3));
      pos[i].y = Math.max(NODE_R + 4, Math.min(H - NODE_R - 4, pos[i].y + force[i].y * 0.3));
    }
  }
  return pos;
}

function arrow(x1, y1, x2, y2, r) {
  // Shorten to node edge
  const dx = x2 - x1, dy = y2 - y1;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const sx = x1 + (dx / d) * r;
  const sy = y1 + (dy / d) * r;
  const ex = x2 - (dx / d) * r;
  const ey = y2 - (dy / d) * r;
  return { sx, sy, ex, ey };
}

export default function GraphPanel({ graph }) {
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const cycles = graph.cycles || [];

  // Build cycle node set
  const cycleNodes = new Set(cycles.flat());
  const cycleEdges = new Set();
  for (const cycle of cycles) {
    for (let i = 0; i < cycle.length; i++) {
      cycleEdges.add(`${cycle[i]}|${cycle[(i + 1) % cycle.length]}`);
    }
  }

  const pos = useMemo(() => forceLayout(nodes, edges), [nodes.join(","), edges.map(e => e.join()).join(",")]);
  const nodeIdx = Object.fromEntries(nodes.map((n, i) => [n, i]));

  if (!nodes.length) return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
      padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13,
    }}>
      No wait-for relationships. All agents are making progress.
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {cycles.length > 0 && (
        <div style={{
          background: "#f8717111", border: "1px solid #f8717144", borderRadius: 8,
          padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <span style={{ color: "var(--red)", fontWeight: 700, fontSize: 13 }}>DEADLOCK</span>
          <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.7 }}>
            {cycles.map((c, i) => (
              <div key={i}>{c.join(" → ")} → {c[0]}</div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
        padding: 16, overflow: "hidden",
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          Wait-for Graph
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400, marginLeft: 8 }}>
            {nodes.length} node{nodes.length !== 1 ? "s" : ""} · {edges.length} edge{edges.length !== 1 ? "s" : ""}
            {cycles.length > 0 && <span style={{ color: "var(--red)", marginLeft: 6 }}>· {cycles.length} cycle{cycles.length !== 1 ? "s" : ""}</span>}
          </span>
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
          <defs>
            <marker id="arrow-normal" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#4da4ff88" />
            </marker>
            <marker id="arrow-cycle" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#f87171" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map(([a, b], i) => {
            if (!(a in nodeIdx) || !(b in nodeIdx)) return null;
            const { sx, sy, ex, ey } = arrow(pos[nodeIdx[a]].x, pos[nodeIdx[a]].y, pos[nodeIdx[b]].x, pos[nodeIdx[b]].y, NODE_R);
            const isCycle = cycleEdges.has(`${a}|${b}`);
            return (
              <line key={i}
                x1={sx} y1={sy} x2={ex} y2={ey}
                stroke={isCycle ? "#f87171" : "#4da4ff55"}
                strokeWidth={isCycle ? 2 : 1.5}
                markerEnd={`url(#arrow-${isCycle ? "cycle" : "normal"})`}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((n, i) => {
            const { x, y } = pos[i];
            const inCycle = cycleNodes.has(n);
            return (
              <g key={n}>
                <circle
                  cx={x} cy={y} r={NODE_R}
                  fill={inCycle ? "#f8717122" : "#4da4ff11"}
                  stroke={inCycle ? "#f87171" : "#4da4ff"}
                  strokeWidth={inCycle ? 2 : 1.5}
                />
                <text
                  x={x} y={y}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={9} fill={inCycle ? "#f87171" : "#4da4ff"}
                  fontFamily="'JetBrains Mono', monospace"
                  style={{ userSelect: "none" }}
                >
                  {n.length > 10 ? n.slice(0, 9) + "…" : n}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Edge list */}
      {edges.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Wait-for Edges</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {edges.map(([a, b], i) => {
              const isCycle = cycleEdges.has(`${a}|${b}`);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  {isCycle && <span style={{ color: "var(--red)", fontWeight: 700, fontSize: 10, padding: "1px 5px", background: "#f8717122", borderRadius: 3 }}>CYCLE</span>}
                  <span style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>{a}</span>
                  <span style={{ color: "var(--muted)" }}>→ waiting on →</span>
                  <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{b}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
