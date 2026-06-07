"""
agent-harness-board CLI — Typer-based.
Commands: start, stop, status, leases, run
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
from pathlib import Path
from typing import Optional

import httpx
import typer

app = typer.Typer(help="agent-harness-board — resource lease registry for AI agents")

BOARD_URL = os.getenv("BOARD_URL", "http://localhost:8765")
PID_FILE  = Path(os.getenv("BOARD_PID_FILE", "/tmp/board.pid"))


@app.command()
def start(
    host: str = typer.Option("127.0.0.1", "--host"),
    port: int = typer.Option(8765, "--port"),
    db:   str = typer.Option("board.db", "--db"),
    policy: str = typer.Option("board_policy.yaml", "--policy"),
    reload: bool = typer.Option(False, "--reload"),
):
    """Start the board daemon."""
    env = os.environ.copy()
    env["BOARD_DB"]     = db
    env["BOARD_POLICY"] = policy
    cmd = [
        sys.executable, "-m", "uvicorn",
        "daemon.main:app",
        f"--host={host}", f"--port={port}",
    ]
    if reload:
        cmd.append("--reload")
    proc = subprocess.Popen(cmd, env=env)
    PID_FILE.write_text(str(proc.pid))
    typer.echo(f"Board started (PID {proc.pid}) at http://{host}:{port}")
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()


@app.command()
def stop():
    """Stop the running board daemon."""
    if not PID_FILE.exists():
        typer.echo("No PID file found — is the board running?", err=True)
        raise typer.Exit(1)
    pid = int(PID_FILE.read_text())
    os.kill(pid, signal.SIGTERM)
    PID_FILE.unlink(missing_ok=True)
    typer.echo(f"Sent SIGTERM to PID {pid}")


@app.command()
def status():
    """Show board health and current lease count."""
    try:
        r = httpx.get(f"{BOARD_URL}/health", timeout=3)
        h = r.json()
        leases_r = httpx.get(f"{BOARD_URL}/leases", timeout=3)
        count = len(leases_r.json().get("leases", []))
        typer.echo(f"Board: {h['status'].upper()}  v{h['version']}  |  Active leases: {count}")
    except Exception as e:
        typer.echo(f"Board unreachable: {e}", err=True)
        raise typer.Exit(1)


@app.command()
def leases(
    agent: Optional[str] = typer.Option(None, "--agent", "-a"),
    resource: Optional[str] = typer.Option(None, "--resource", "-r"),
):
    """List active resource leases."""
    params = {}
    if agent:
        params["agent_id"] = agent
    if resource:
        params["resource"] = resource
    r = httpx.get(f"{BOARD_URL}/leases", params=params, timeout=5)
    r.raise_for_status()
    data = r.json().get("leases", [])
    if not data:
        typer.echo("No active leases.")
        return
    typer.echo(f"{'AGENT':<24} {'RESOURCE':<32} {'MODE':<8} {'EXPIRES IN':>10}")
    typer.echo("-" * 78)
    import time
    now = time.time()
    for lease in data:
        ttl = max(0, lease["expires_at"] - now)
        typer.echo(f"{lease['agent_id']:<24} {lease['resource']:<32} {lease['mode']:<8} {ttl:>9.0f}s")


@app.command()
def run(
    cmd: list[str] = typer.Argument(...),
    agent_id: str = typer.Option("cli_agent", "--agent-id"),
):
    """Run a subprocess with BOARD_URL and BOARD_AGENT_ID in its environment."""
    env = os.environ.copy()
    env["BOARD_URL"]      = BOARD_URL
    env["BOARD_AGENT_ID"] = agent_id
    result = subprocess.run(cmd, env=env)
    raise typer.Exit(result.returncode)


if __name__ == "__main__":
    app()
