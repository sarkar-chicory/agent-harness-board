"""Wait-for graph with DFS cycle detection and victim selection."""
from __future__ import annotations

from collections import defaultdict
from typing import Optional


class DeadlockDetector:
    def __init__(self):
        # agent_id -> set of resources it is waiting for / holding
        self._graph: dict[str, set[str]] = defaultdict(set)

    def add_edge(self, agent_id: str, resource: str):
        self._graph[agent_id].add(resource)

    def remove_edge(self, agent_id: str, resource: str):
        self._graph[agent_id].discard(resource)
        if not self._graph[agent_id]:
            del self._graph[agent_id]

    def detect_cycles(self) -> list[list[str]]:
        visited: set[str] = set()
        rec_stack: set[str] = set()
        cycles: list[list[str]] = []

        def dfs(node: str, path: list[str]):
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            for neighbor in self._graph.get(node, []):
                if neighbor not in visited:
                    dfs(neighbor, path)
                elif neighbor in rec_stack:
                    # Found a cycle
                    idx = path.index(neighbor)
                    cycles.append(path[idx:])
            path.pop()
            rec_stack.discard(node)

        for node in list(self._graph):
            if node not in visited:
                dfs(node, [])

        return cycles

    def break_cycle(self, cycle: list[str]) -> Optional[str]:
        """Return the agent to evict (last one in cycle = most recent acquirer)."""
        # Prefer agents — nodes that look like agent IDs (not resource paths)
        agents = [n for n in cycle if not n.startswith("/") and "." not in n]
        return agents[-1] if agents else cycle[-1]

    def to_dict(self) -> dict:
        return {
            "nodes": list(self._graph.keys()),
            "edges": [
                {"from": agent, "to": res}
                for agent, resources in self._graph.items()
                for res in resources
            ],
            "cycles": self.detect_cycles(),
        }
