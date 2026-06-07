"""Basic integration tests for the board daemon."""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from daemon import main
from daemon.main import app


@pytest_asyncio.fixture
async def client(tmp_path, monkeypatch):
    # Isolate state per test: a fresh DB file and an empty deadlock graph.
    db = str(tmp_path / "board.db")
    monkeypatch.setattr(main.store, "db_path", db)
    monkeypatch.setattr(main.audit, "db_path", db)
    main.dlock._graph.clear()
    main.policy._overrides.clear()
    # Run the app's lifespan so tables are created (ASGITransport skips it).
    async with main.app.router.lifespan_context(app):
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
    assert any(lease["agent_id"] == "test_agent" for lease in leases)

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


@pytest.mark.asyncio
async def test_policy_override(client):
    # Set a runtime override that only permits reads on secret.* resources.
    r = await client.post("/policy", json={
        "resource_pattern": "secret.*", "allow_modes": ["read"],
    })
    assert r.json()["status"] == "ok"

    # Acquiring a write lease must now be denied by policy (regression: the
    # override loop used to crash by unpacking dict keys instead of items).
    r2 = await client.post("/acquire", json={
        "agent_id": "pol_agent", "resource": "secret.txt", "mode": "write", "ttl": 30
    })
    assert r2.status_code == 403

    # A read on the same resource is still allowed.
    r3 = await client.post("/acquire", json={
        "agent_id": "pol_agent", "resource": "secret.txt", "mode": "read", "ttl": 30
    })
    assert r3.status_code == 200
