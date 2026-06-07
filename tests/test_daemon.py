"""Basic integration tests for the board daemon."""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from daemon.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_acquire_release(client):
    # Acquire
    r = await client.post("/acquire", json={
        "agent_id": "test_agent", "resource": "test.csv", "mode": "read", "ttl": 30
    })
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "acquired"

    # List
    r2 = await client.get("/leases")
    leases = r2.json()["leases"]
    assert any(l["agent_id"] == "test_agent" for l in leases)

    # Release
    r3 = await client.post("/release", json={"agent_id": "test_agent", "resource": "test.csv"})
    assert r3.json()["status"] == "released"


@pytest.mark.asyncio
async def test_conflict_on_write(client):
    # Agent A holds write
    await client.post("/acquire", json={
        "agent_id": "agent_a", "resource": "model.pt", "mode": "write", "ttl": 60
    })
    # Agent B tries read → conflict
    r = await client.post("/acquire", json={
        "agent_id": "agent_b", "resource": "model.pt", "mode": "read", "ttl": 60
    })
    assert r.status_code == 409
    # Cleanup
    await client.post("/release", json={"agent_id": "agent_a", "resource": "model.pt"})


@pytest.mark.asyncio
async def test_audit_log(client):
    await client.post("/acquire", json={"agent_id": "audit_test", "resource": "data.db", "mode": "read"})
    await client.post("/release", json={"agent_id": "audit_test", "resource": "data.db"})
    r = await client.get("/audit?agent_id=audit_test")
    events = r.json()["events"]
    event_types = [e["event"] for e in events]
    assert "ACQUIRED" in event_types
    assert "RELEASED" in event_types
