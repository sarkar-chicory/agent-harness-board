"""
FUSE filesystem proxy — intercepts file open/close and acquires leases.
Phase 1 target. Requires macFUSE (macOS) or libfuse (Linux).

Install:
    macOS:  brew install --cask macfuse && pip install fusepy
    Linux:  apt install fuse libfuse-dev && pip install fusepy
"""
from __future__ import annotations

import os

import httpx

BOARD_URL = os.getenv("BOARD_URL", "http://localhost:8765")
AGENT_ID  = os.getenv("BOARD_AGENT_ID", "fuse_agent")

try:
    from fuse import FUSE, FuseOSError, Operations
    import errno
    FUSE_AVAILABLE = True
except ImportError:
    FUSE_AVAILABLE = False
    Operations = object


def _board_acquire(resource: str, mode: str):
    try:
        httpx.post(f"{BOARD_URL}/acquire",
                   json={"agent_id": AGENT_ID, "resource": resource, "mode": mode},
                   timeout=5)
    except Exception:
        pass  # Non-blocking on board unavailability


def _board_release(resource: str):
    try:
        httpx.post(f"{BOARD_URL}/release",
                   json={"agent_id": AGENT_ID, "resource": resource},
                   timeout=5)
    except Exception:
        pass


class HarnessBoardFS(Operations):
    """FUSE passthrough filesystem that registers leases with the board."""

    def __init__(self, root: str):
        self.root = os.path.realpath(root)
        self._open_files: dict[int, str] = {}  # fd → resource path

    def _full(self, path: str) -> str:
        return os.path.join(self.root, path.lstrip("/"))

    # -- File system metadata --

    def getattr(self, path, fh=None):
        full = self._full(path)
        try:
            st = os.lstat(full)
        except FileNotFoundError:
            raise FuseOSError(errno.ENOENT)
        return {k: getattr(st, k) for k in (
            "st_atime","st_ctime","st_gid","st_mode","st_mtime","st_nlink","st_size","st_uid"
        )}

    def readdir(self, path, fh):
        full = self._full(path)
        yield "."
        yield ".."
        for name in os.listdir(full):
            yield name

    # -- File I/O --

    def open(self, path, flags):
        full = self._full(path)
        mode = "write" if (flags & os.O_WRONLY or flags & os.O_RDWR) else "read"
        _board_acquire(path, mode)
        fd = os.open(full, flags)
        self._open_files[fd] = path
        return fd

    def release(self, path, fh):
        resource = self._open_files.pop(fh, path)
        _board_release(resource)
        return os.close(fh)

    def read(self, path, size, offset, fh):
        os.lseek(fh, offset, os.SEEK_SET)
        return os.read(fh, size)

    def write(self, path, data, offset, fh):
        os.lseek(fh, offset, os.SEEK_SET)
        return os.write(fh, data)

    def create(self, path, mode, fi=None):
        full = self._full(path)
        _board_acquire(path, "write")
        fd = os.open(full, os.O_WRONLY | os.O_CREAT, mode)
        self._open_files[fd] = path
        return fd


def mount(root: str, mountpoint: str):
    if not FUSE_AVAILABLE:
        raise RuntimeError("fusepy not installed. Run: pip install fusepy")
    print(f"[fuse] Mounting {root} at {mountpoint} (board: {BOARD_URL})")
    FUSE(HarnessBoardFS(root), mountpoint, nothreads=True, foreground=True)


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("Usage: python fuse_mount.py <root_dir> <mountpoint>")
        sys.exit(1)
    mount(sys.argv[1], sys.argv[2])
