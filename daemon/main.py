"""
agent-harness-board daemon
FastAPI server — resource lease registry, policy engine, deadlock detection, audit log.
"""
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .lease_store import LeaseStore
from .policy_engine import PolicyEngine
from .deadlock import DeadlockDetector
from .audit import AuditLog

# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

store   = LeaseStore(os.getenv("BOARD_DB", "board.db"))
policy  = PolicyEngine(os.getenv("BOARD_POLICY", "board_policy.yaml"))
dlock   = DeadlockDetector()
audit   = AuditLog(os.getenv("BOARD_DB", "board.db"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    await store.init()
    await audit.init()
    # Background: expire stale leases every 30 s
    task = asyncio.create_task(_expiry_loop())
    yield
    task.cancel()

async def _expiry_loop():
    while True:
        await asyncio.sleep(30)
        expired = await store.expire_stale()
        for e in expired:
            dlock.remove_edge(e["agent_id"], e["resource"])
            await audit.log("EXPIRED", e["agent_id"], e["resource"], e["mode"])

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="agent-harness-board", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AcquireRequest(BaseModel):
    agent_id: str
    resource: str
    mode: str = "read"       # read | write | exec | call
    ttl: int  = 60           # seconds
    metadata: dict = {}

class ReleaseRequest(BaseModel):
    agent_id: str
    resource: str

class PolicyRequest(BaseModel):
    resource_pattern: str
    max_readers: int = 10
    max_writers: int = 1
    allow_modes: list[str] = ["read", "write", "exec", "call"]
    ttl_limit: int = 300

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/acquire", status_code=200)
async def acquire(req: AcquireRequest):
    # Policy check
    pol = policy.evaluate(req.resource, req.mode)
    if not pol.get("allowed", True):
        raise HTTPException(403, detail=f"Policy denied: {pol.get('reason')}")
    effective_ttl = min(req.ttl, pol.get("ttl_limit", 300))

    # Conflict check
    conflict = await store.check_conflict(req.resource, req.mode)
    if conflict:
        await store.enqueue(req.agent_id, req.resource, req.mode)
        await audit.log("QUEUED", req.agent_id, req.resource, req.mode)
        raise HTTPException(409, detail={"status": "queued", "holders": conflict})

    lease = await store.create_lease(req.agent_id, req.resource, req.mode, effective_ttl, req.metadata)
    dlock.add_edge(req.agent_id, req.resource)
    await audit.log("ACQUIRED", req.agent_id, req.resource, req.mode)

    # Deadlock check
    cycles = dlock.detect_cycles()
    if cycles:
        victim = dlock.break_cycle(cycles[0])
        if victim:
            await audit.log("DEADLOCK_BREAK", victim, req.resource, req.mode)
            await store.release_lease(victim, req.resource)
            dlock.remove_edge(victim, req.resource)

    return {"status": "acquired", "lease": lease}


@app.post("/release")
async def release(req: ReleaseRequest):
    ok = await store.release_lease(req.agent_id, req.resource)
    if not ok:
        raise HTTPException(404, detail="Lease not found")
    dlock.remove_edge(req.agent_id, req.resource)
    await audit.log("RELEASED", req.agent_id, req.resource, "")
    return {"status": "released"}


@app.get("/leases")
async def list_leases(agent_id: Optional[str] = None, resource: Optional[str] = None):
    return {"leases": await store.list_leases(agent_id=agent_id, resource=resource)}


@app.get("/wait/{resource}")
async def wait_for_resource(resource: str, timeout: int = 30):
    """Long-poll: blocks until resource is free or timeout."""
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        conflict = await store.check_conflict(resource, "write")
        if not conflict:
            return {"status": "free", "resource": resource}
        await asyncio.sleep(1)
    raise HTTPException(408, detail="Timeout waiting for resource")


@app.post("/policy")
async def set_policy(req: PolicyRequest):
    policy.set_policy(req.resource_pattern, req.model_dump(exclude={"resource_pattern"}))
    return {"status": "ok"}


@app.get("/policies")
async def get_policies():
    return {"policies": policy.all_policies()}


@app.get("/audit")
async def get_audit(agent_id: Optional[str] = None, resource: Optional[str] = None, limit: int = 100):
    return {"events": await audit.query(agent_id=agent_id, resource=resource, limit=limit)}


@app.get("/graph")
async def get_graph():
    return dlock.to_dict()


@app.post("/heartbeat")
async def heartbeat(req: ReleaseRequest):
    ok = await store.heartbeat(req.agent_id, req.resource)
    return {"status": "ok" if ok else "not_found"}


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
