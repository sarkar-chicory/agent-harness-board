"""Append-only SQLite audit log."""
from __future__ import annotations

import time
from typing import Any, Optional

import aiosqlite


class AuditLog:
    def __init__(self, db_path: str):
        self.db_path = db_path

    async def init(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS audit_events (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    event      TEXT NOT NULL,
                    agent_id   TEXT NOT NULL,
                    resource   TEXT NOT NULL,
                    mode       TEXT NOT NULL,
                    ts         REAL NOT NULL
                )
            """)
            await db.commit()

    async def log(self, event: str, agent_id: str, resource: str, mode: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT INTO audit_events(event,agent_id,resource,mode,ts) VALUES(?,?,?,?,?)",
                (event, agent_id, resource, mode, time.time())
            )
            await db.commit()

    async def query(self, agent_id: Optional[str] = None,
                    resource: Optional[str] = None,
                    limit: int = 100) -> list[dict]:
        clauses: list[str] = []
        params: list[Any] = []
        if agent_id:
            clauses.append("agent_id=?")
            params.append(agent_id)
        if resource:
            clauses.append("resource=?")
            params.append(resource)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        params.append(limit)
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                f"SELECT * FROM audit_events {where} ORDER BY ts DESC LIMIT ?",
                params
            )
            rows = await cur.fetchall()
        return [dict(r) for r in rows]
