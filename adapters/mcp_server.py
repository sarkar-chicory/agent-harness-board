"""
MCP stdio server — exposes harness_acquire / harness_release / harness_list_leases
as MCP tools for any MCP-compatible agent.
"""
from __future__ import annotations

import asyncio
import json
import sys

import httpx

BOARD_URL = "http://localhost:8765"

TOOLS = [
    {
        "name": "harness_acquire",
        "description": "Acquire a resource lease before accessing a shared resource.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_id": {"type": "string"},
                "resource": {"type": "string"},
                "mode":     {"type": "string", "enum": ["read","write","exec","call"]},
                "ttl":      {"type": "integer", "default": 60},
            },
            "required": ["agent_id", "resource"],
        },
    },
    {
        "name": "harness_release",
        "description": "Release a previously acquired resource lease.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "agent_id": {"type": "string"},
                "resource": {"type": "string"},
            },
            "required": ["agent_id", "resource"],
        },
    },
    {
        "name": "harness_list_leases",
        "description": "List all currently held resource leases.",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


async def handle(request: dict) -> dict:
    method = request.get("method", "")
    req_id = request.get("id")

    if method == "initialize":
        return {"jsonrpc": "2.0", "id": req_id,
                "result": {"protocolVersion": "2024-11-05",
                           "capabilities": {"tools": {}},
                           "serverInfo": {"name": "agent-harness-board", "version": "0.1.0"}}}

    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}

    if method == "tools/call":
        tool_name = request["params"]["name"]
        args      = request["params"].get("arguments", {})
        async with httpx.AsyncClient() as client:
            if tool_name == "harness_acquire":
                r = await client.post(f"{BOARD_URL}/acquire", json=args)
            elif tool_name == "harness_release":
                r = await client.post(f"{BOARD_URL}/release", json=args)
            elif tool_name == "harness_list_leases":
                r = await client.get(f"{BOARD_URL}/leases")
            else:
                return {"jsonrpc": "2.0", "id": req_id,
                        "error": {"code": -32601, "message": "Unknown tool"}}
        return {"jsonrpc": "2.0", "id": req_id,
                "result": {"content": [{"type": "text", "text": r.text}]}}

    return {"jsonrpc": "2.0", "id": req_id,
            "error": {"code": -32601, "message": f"Unknown method: {method}"}}


async def main():
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)
    await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)
    writer_transport, writer_protocol = await asyncio.get_event_loop().connect_write_pipe(
        asyncio.BaseProtocol, sys.stdout
    )

    while True:
        line = await reader.readline()
        if not line:
            break
        try:
            request = json.loads(line)
            response = await handle(request)
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": None,
                                          "error": {"code": -32700, "message": str(e)}}) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    asyncio.run(main())
