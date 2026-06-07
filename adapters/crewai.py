"""CrewAI adapter — subclass of BaseTool with harness lease management."""
from __future__ import annotations

from typing import Any

import httpx

BOARD_URL = "http://localhost:8765"


class HarnessCrewAITool:
    """
    Drop-in CrewAI BaseTool subclass.
    Usage:
        class MyTool(HarnessCrewAITool):
            name = "my_tool"
            description = "Does something"
            resource = "api.example.com"
            mode = "call"

            def run(self, input: str) -> str:
                ...  # actual implementation
    """
    name: str = "harness_tool"
    description: str = ""
    resource: str = "default"
    mode: str = "call"
    agent_id: str = "crew_agent"
    board_url: str = BOARD_URL

    def _acquire(self):
        httpx.post(f"{self.board_url}/acquire", json={
            "agent_id": self.agent_id,
            "resource": self.resource,
            "mode": self.mode,
        }).raise_for_status()

    def _release(self):
        httpx.post(f"{self.board_url}/release", json={
            "agent_id": self.agent_id,
            "resource": self.resource,
        })

    def run(self, input: Any) -> Any:
        raise NotImplementedError("Subclass must implement run()")

    def __call__(self, input: Any) -> Any:
        self._acquire()
        try:
            return self.run(input)
        finally:
            self._release()
