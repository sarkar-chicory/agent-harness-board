"""AutoGen adapter — decorator factory for harness-wrapped functions."""
from __future__ import annotations

import functools
from typing import Any, Callable

import httpx

BOARD_URL = "http://localhost:8765"


def _acquire(agent_id: str, resource: str, mode: str, url: str):
    httpx.post(f"{url}/acquire",
               json={"agent_id": agent_id, "resource": resource, "mode": mode}
               ).raise_for_status()


def _release(agent_id: str, resource: str, url: str):
    httpx.post(f"{url}/release",
               json={"agent_id": agent_id, "resource": resource})


def harness_tool(agent_id: str, resource: str,
                 mode: str = "call",
                 board_url: str = BOARD_URL) -> Callable:
    """
    Decorator factory that wraps a function with harness acquire/release.

    Usage:
        @harness_tool(agent_id="planner", resource="api.openai.com", mode="call")
        def call_llm(prompt: str) -> str:
            ...
    """
    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            _acquire(agent_id, resource, mode, board_url)
            try:
                return fn(*args, **kwargs)
            finally:
                _release(agent_id, resource, board_url)
        return wrapper
    return decorator
