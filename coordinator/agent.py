"""
Meta-agent coordinator — polls the board and uses Claude to resolve conflicts.
"""
from __future__ import annotations

import asyncio
import os

import httpx

BOARD_URL = os.getenv("BOARD_URL", "http://localhost:8765")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-6"


class HarnessBoardCoordinator:
    def __init__(self, board_url: str = BOARD_URL, poll_interval: int = 10):
        self.board_url = board_url
        self.poll_interval = poll_interval
        self._client = httpx.AsyncClient(base_url=board_url, timeout=10)

    async def run(self):
        print(f"[coordinator] Starting — polling every {self.poll_interval}s")
        while True:
            try:
                await self._tick()
            except Exception as e:
                print(f"[coordinator] Error: {e}")
            await asyncio.sleep(self.poll_interval)

    async def _tick(self):
        leases_r = await self._client.get("/leases")
        graph_r  = await self._client.get("/graph")
        audit_r  = await self._client.get("/audit?limit=20")

        leases = leases_r.json().get("leases", [])
        graph  = graph_r.json()
        audit  = audit_r.json().get("events", [])

        cycles = graph.get("cycles", [])
        if cycles:
            await self._handle_deadlock(cycles, leases)
            return

        # Only consult Claude if there's something interesting
        if leases:
            rec = await self._ask_claude(leases, graph, audit)
            if rec:
                print(f"[coordinator] Claude recommendation: {rec}")

    async def _handle_deadlock(self, cycles: list, leases: list):
        print(f"[coordinator] Deadlock detected: {cycles}")
        for cycle in cycles:
            # Pick victim: last agent in cycle
            victim = cycle[-1]
            # Find what the victim holds
            victim_leases = [l for l in leases if l["agent_id"] == victim]
            for lease in victim_leases:
                print(f"[coordinator] Evicting {victim} from {lease['resource']}")
                await self._client.post("/release",
                                        json={"agent_id": victim, "resource": lease["resource"]})

    async def _ask_claude(self, leases: list, graph: dict, audit: list) -> str | None:
        if not ANTHROPIC_API_KEY:
            return None
        summary = (
            f"Current leases: {len(leases)}\n"
            f"Graph nodes: {graph.get('nodes', [])}\n"
            f"Recent events: {[e['event'] for e in audit[:5]]}"
        )
        prompt = (
            "You are the coordinator for agent-harness-board, a multi-agent resource "
            "lease registry. Review the system state below and provide a one-sentence "
            "recommendation if any action is needed. If the system looks healthy, say 'OK'.\n\n"
            f"State:\n{summary}"
        )
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": MODEL,
                    "max_tokens": 100,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=30,
            )
        if r.status_code == 200:
            return r.json()["content"][0]["text"].strip()
        return None
