const ADAPTERS = [
  {
    key: "langchain",
    label: "LangChain",
    file: "adapters/langchain.py",
    snippet: `from adapters.langchain import harness_toolkit
tools = harness_toolkit(tools, agent_id="my_agent")`,
    description: "Wraps any BaseTool — lease acquired on _run, released in finally.",
  },
  {
    key: "crewai",
    label: "CrewAI",
    file: "adapters/crewai.py",
    snippet: `from adapters.crewai import HarnessCrewAITool

class MyTool(HarnessCrewAITool):
    name = "my_tool"
    resource = "api.example.com"
    mode = "call"
    agent_id = "crew_agent"`,
    description: "Subclass HarnessCrewAITool — acquire/release wraps __call__.",
  },
  {
    key: "autogen",
    label: "AutoGen",
    file: "adapters/autogen.py",
    snippet: `from adapters.autogen import harness_tool

@harness_tool(agent_id="planner", resource="api.openai.com")
def call_llm(prompt: str) -> str:
    ...`,
    description: "Decorator factory — wraps any function with lease management.",
  },
  {
    key: "openai",
    label: "OpenAI Functions",
    file: "adapters/openai_tools.json",
    snippet: `import json
tools = json.load(open("adapters/openai_tools.json"))
# Pass to client.chat.completions.create(tools=tools, ...)`,
    description: "Four function definitions: harness_acquire, harness_release, harness_list_leases, harness_wait.",
  },
  {
    key: "mcp",
    label: "MCP Server",
    file: "adapters/mcp_server.py",
    snippet: `python -m adapters.mcp_server
# Or add to your MCP config:
# { "command": "python", "args": ["-m", "adapters.mcp_server"] }`,
    description: "stdio MCP server — harness_acquire / harness_release / harness_list_leases as MCP tools.",
  },
];

const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

function AgentActivity({ leases, events }) {
  // Build agent → { leases, events } map
  const agents = {};
  for (const l of leases) {
    agents[l.agent_id] = agents[l.agent_id] || { leases: 0, events: 0 };
    agents[l.agent_id].leases++;
  }
  for (const e of events) {
    if (!agents[e.agent_id]) continue;
    agents[e.agent_id].events++;
  }

  const rows = Object.entries(agents);
  if (!rows.length) return (
    <div style={{ color: "var(--muted)", fontSize: 12 }}>No active agents.</div>
  );

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {["Agent ID", "Active Leases", "Recent Events"].map(h => (
            <th key={h} style={{
              fontSize: 11, color: "var(--muted)", padding: "4px 8px", textAlign: "left",
              textTransform: "uppercase", letterSpacing: 1,
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([id, stat]) => (
          <tr key={id}>
            <td style={{ fontSize: 12, padding: "6px 8px", fontFamily: "var(--mono)", color: "var(--accent)", borderTop: "1px solid var(--border)" }}>{id}</td>
            <td style={{ fontSize: 12, padding: "6px 8px", fontFamily: "var(--mono)", color: "var(--green)", borderTop: "1px solid var(--border)" }}>{stat.leases}</td>
            <td style={{ fontSize: 12, padding: "6px 8px", fontFamily: "var(--mono)", color: "var(--muted)", borderTop: "1px solid var(--border)" }}>{stat.events}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdaptersPanel({ leases, events }) {
  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* Active agents */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Active Agents</div>
        <AgentActivity leases={leases} events={events} />
      </div>

      {/* Adapter cards grid */}
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
        P0 Adapters — all shipped
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 16 }}>
        {ADAPTERS.map(a => (
          <div key={a.key} style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{a.label}</div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                background: "#34d39922", color: "var(--green)",
              }}>P0 ✓</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>{a.description}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{a.file}</div>
            <pre style={{
              background: "#0a0e14", border: "1px solid var(--border)", borderRadius: 6,
              padding: "10px 12px", fontSize: 11, fontFamily: "var(--mono)",
              color: "var(--text)", overflowX: "auto", margin: 0, lineHeight: 1.6,
            }}>{a.snippet}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
