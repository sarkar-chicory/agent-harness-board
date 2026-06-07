"""SQLite-backed resource lease store with async aiosqlite."""
from __future__ import annotations

import json
import time
from typing import Any, Optional

import aiosqlite


class LeaseStore:
    def __init__(self, db_path: str):
        self.db_path = db_path

    async def init(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS leases (
                    agent_id    TEXT NOT NULL,
                    resource    TEXT NOT NULL,
                    mode        TEXT NOT NULL,
                    acquired_at REAL NOT NULL,
                    expires_at  REAL NOT NULL,
                    metadata    TEXT DEFAULT '{}',
                    PRIMARY KEY (agent_id, resource)
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS queue (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id    TEXT NOT NULL,
                    resource    TEXT NOT NULL,
                    mode        TEXT NOT NULL,
                    queued_at   REAL NOT NULL
                )
            """)
            await db.commit()

    # ------------------------------------------------------------------

    async def create_lease(self, agent_id: str, resource: str, mode: str,
                           ttl: int, metadata: dict) -> dict:
        now = time.time()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT OR REPLACE INTO leases VALUES (?,?,?,?,?,?)",
                (agent_id, resource, mode, now, now + ttl, json.dumps(metadata))
            )
            await db.commit()
        return {"agent_id": agent_id, "resource": resource, "mode": mode,
                "acquired_at": now, "expires_at": now + ttl}

    async def get_lease(self, agent_id: str, resource: str) -> Optional[dict]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "SELECT * FROM leases WHERE agent_id=? AND resource=?",
                (agent_id, resource)
            )
            row = await cur.fetchone()
        return dict(row) if row else None

    async def release_lease(self, agent_id: str, resource: str) -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute(
                "DELETE FROM leases WHERE agent_id=? AND resource=?",
                (agent_id, resource)
            )
            await db.commit()
            return cur.rowcount > 0

    async def list_leases(self, agent_id: Optional[str] = None,
                          resource: Optional[str] = None) -> list[dict]:
        clauses: list[str] = []
        params: list[Any] = []
        if agent_id:
            clauses.append("agent_id=?")
            params.append(agent_id)
        if resource:
            clauses.append("resource=?")
            params.append(resource)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(f"SELECT * FROM leases {where}", params)
            rows = await cur.fetchall()
        return [dict(r) for r in rows]

    async def check_conflict(self, resource: str, mode: str) -> list[dict]:
        """Returns existing holders that conflict with the requested mode."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            now = time.time()
            cur = await db.execute(
                "SELECT * FROM leases WHERE resource=? AND expires_at > ?",
                (resource, now)
            )
            holders = [dict(r) for r in await cur.fetchall()]

        if mode == "read":
            # read conflicts only with write
            return [h for h in holders if h["mode"] in ("write", "exec")]
        else:
            # write/exec/call conflicts with everything
            return holders

    async def get_holders(self, resource: str) -> list[str]:
        leases = await self.list_leases(resource=resource)
        return [lease["agent_id"] for lease in leases]

    async def enqueue(self, agent_id: str, resource: str, mode: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO queue(agent_id,resource,mode,queued_at) VALUES(?,?,?,?)",
                (agent_id, resource, mode, time.time())
            )
            await db.commit()

    async def queue_length(self, resource: str) -> int:
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute(
                "SELECT COUNT(*) FROM queue WHERE resource=?", (resource,)
            )
            row = await cur.fetchone()
            return row[0] if row else 0

    async def heartbeat(self, agent_id: str, resource: str,
                        extend_by: int = 60) -> bool:
        async with aiosqlite.connect(self.db_path) as db:
            cur = await db.execute(
                "UPDATE leases SET expires_at=expires_at+? WHERE agent_id=? AND resource=?",
                (extend_by, agent_id, resource)
            )
            await db.commit()
            return cur.rowcount > 0

    async def expire_stale(self) -> list[dict]:
        now = time.time()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "SELECT * FROM leases WHERE expires_at <= ?", (now,)
            )
            expired = [dict(r) for r in await cur.fetchall()]
            await db.execute("DELETE FROM leases WHERE expires_at <= ?", (now,))
            await db.commit()
        return expired
