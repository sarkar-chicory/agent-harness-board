"""LangChain adapter — wraps any BaseTool with harness lease management."""
from __future__ import annotations

from typing import Any

import httpx

BOARD_URL = "http://localhost:8765"


class BoardClient:
    def __init__(self, url: str = BOARD_URL):
        self.url = url

    def acquire(self, agent_id: str, resource: str, mode: str = "call") -> dict:
        r = httpx.post(f"{self.url}/acquire",
                       json={"agent_id": agent_id, "resource": resource, "mode": mode})
        r.raise_for_status()
        return r.json()

    def release(self, agent_id: str, resource: str):
        httpx.post(f"{self.url}/release",
                   json={"agent_id": agent_id, "resource": resource})


def _infer_resource(tool_name: str, tool_input: Any) -> str:
    """Heuristic: derive a resource name from the tool invocation."""
    if isinstance(tool_input, dict):
        for key in ("url", "path", "file", "endpoint"):
            if key in tool_input:
                return str(tool_input[key])
    return f"tool:{tool_name}"


class HarnessWrappedTool:
    """Wraps a LangChain BaseTool, acquiring/releasing a lease on each call."""

    def __init__(self, tool, agent_id: str, client: BoardClient | None = None):
        self._tool = tool
        self.agent_id = agent_id
        self.client = client or BoardClient()
        # Proxy attributes
        self.name        = tool.name
        self.description = tool.description

    def _run(self, *args, **kwargs) -> Any:
        resource = _infer_resource(self._tool.name, args[0] if args else kwargs)
        self.client.acquire(self.agent_id, resource, mode="call")
        try:
            return self._tool._run(*args, **kwargs)
        finally:
            self.client.release(self.agent_id, resource)

    async def _arun(self, *args, **kwargs) -> Any:
        # Fall back to sync for now
        return self._run(*args, **kwargs)


def harness_toolkit(tools: list, agent_id: str,
                    board_url: str = BOARD_URL) -> list:
    """Wrap a list of LangChain tools with harness lease management."""
    client = BoardClient(board_url)
    return [HarnessWrappedTool(t, agent_id, client) for t in tools]
