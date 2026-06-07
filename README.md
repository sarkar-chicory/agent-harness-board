# agent-harness-board

**Resource lease registry and command center for AI agents.**

Stop your agents from stepping on each other. agent-harness-board gives every agent a structured way to acquire, hold, and release shared resources — files, APIs, databases, compute — with real-time visibility, policy enforcement, deadlock detection, and a full audit trail.

```
                    ┌─────────────────────────────────────────┐
  Claude Agent ─┐   │              RIVA CORE                  │
  GPT-4o Agent ─┤──▶│  Lease Registry  ·  Policy Engine      │──▶ Dashboard
  Gemini Agent ─┤   │  Deadlock Detect ·  Audit Log          │──▶ Deskmate (remote)
  Custom Agent ─┘   │  Signal Bus      ·  Wait-for Graph     │──▶ CLI / MCP Adapters
                    └─────────────────────────────────────────┘
```

## Quick Start

```bash
# Install
pip install agent-harness-board

# Start the daemon
agent-harness-board start

# Check status
agent-harness-board status

# List active leases
agent-harness-board leases
```

## REST API

| Method | Path           | Description                          |
|--------|----------------|--------------------------------------|
| POST   | /acquire       | Acquire a resource lease             |
| POST   | /release       | Release a lease                      |
| GET    | /leases        | List all active leases               |
| GET    | /wait/{res}    | Long-poll until resource is free     |
| POST   | /policy        | Set a runtime policy override        |
| GET    | /policies      | List all policies                    |
| GET    | /audit         | Query the audit log                  |
| GET    | /graph         | Wait-for graph + cycle list          |
| POST   | /heartbeat     | Extend a lease TTL                   |
| GET    | /health        | Health check                         |

## Adapter Compatibility

| Framework    | Adapter                        | Status  |
|-------------|--------------------------------|---------|
| LangChain   | `adapters/langchain.py`        | ✅ P0   |
| CrewAI      | `adapters/crewai.py`           | ✅ P0   |
| AutoGen     | `adapters/autogen.py`          | ✅ P0   |
| OpenAI fns  | `adapters/openai_tools.json`   | ✅ P0   |
| MCP Server  | `adapters/mcp_server.py`       | ✅ P0   |
| FUSE mount  | `interception/fuse_mount.py`   | 🚧 P1   |
| HTTPS proxy | `interception/https_proxy.py`  | 🚧 P1   |
| MCP proxy   | `interception/mcp_proxy.py`    | 🚧 P2   |

## Dashboard (UI)

```bash
cd ui
npm install
npm run dev   # → http://localhost:5173
```

Matches Riva design language: `#0a0e14` background, `#4da4ff` accent, Inter + JetBrains Mono.

## Roadmap

| Phase | Focus            | Target  |
|-------|-----------------|---------|
| P0    | Core daemon + adapters | Q2 2026 |
| P1    | FUSE + HTTPS interception | Q3 2026 |
| P2    | MCP proxy + eBPF probes | Q3 2026 |
| P3    | Deskmate remote gateway | Q4 2026 |
| P4    | Enterprise (SSO, RBAC, compliance) | Q1 2027 |
| P5    | Riva Command Center integration | 2027+ |

### Riva Integration (Phase 5)

Three integration options (all non-breaking for standalone use):
1. **Iframe embed** — surface the board dashboard as a panel in Riva Command Center
2. **Component library** — shared React components with CSS variable theming
3. **Data source** — Riva polls `/leases`, `/graph`, `/audit` as a read-only data source

## Contributing

```bash
git clone https://github.com/your-org/agent-harness-board
cd agent-harness-board
pip install -e ".[dev]"
pytest tests/
```

MIT License
