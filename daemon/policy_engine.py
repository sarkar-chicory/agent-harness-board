"""Hot-reloading YAML policy engine with fnmatch pattern matching."""
from __future__ import annotations

import fnmatch
import os
from typing import Any

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

DEFAULT_POLICY: dict[str, Any] = {
    "max_readers": 10,
    "max_writers": 1,
    "allow_modes": ["read", "write", "exec", "call"],
    "ttl_limit": 300,
    "allowed": True,
}


class PolicyEngine:
    def __init__(self, policy_path: str):
        self.policy_path = policy_path
        self._policies: dict[str, dict] = {}
        self._mtime: float = 0
        self._overrides: dict[str, dict] = {}
        self._load()

    def _load(self):
        if yaml is None or not os.path.exists(self.policy_path):
            return
        mtime = os.path.getmtime(self.policy_path)
        if mtime <= self._mtime:
            return
        with open(self.policy_path) as f:
            data = yaml.safe_load(f) or {}
        self._policies = data.get("policies", {})
        self._mtime = mtime

    def evaluate(self, resource: str, mode: str) -> dict[str, Any]:
        self._load()  # hot-reload check
        result = dict(DEFAULT_POLICY)

        # Match patterns from file (most specific wins — longer pattern first)
        sorted_patterns = sorted(self._policies, key=len, reverse=True)
        for pattern in sorted_patterns:
            if fnmatch.fnmatch(resource, pattern):
                result.update(self._policies[pattern])
                break

        # Runtime overrides (from POST /policy)
        for pattern, override in sorted(
            self._overrides.items(), key=lambda kv: len(kv[0]), reverse=True
        ):
            if fnmatch.fnmatch(resource, pattern):
                result.update(override)
                break

        # Check mode allowed
        if mode not in result.get("allow_modes", ["read", "write", "exec", "call"]):
            result["allowed"] = False
            result["reason"] = f"Mode '{mode}' not permitted for resource '{resource}'"

        return result

    def set_policy(self, pattern: str, policy: dict):
        self._overrides[pattern] = policy

    def all_policies(self) -> dict:
        self._load()
        merged = dict(self._policies)
        merged.update(self._overrides)
        return merged
