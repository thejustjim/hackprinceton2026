"""
dcs.py
------
Dedalus Cloud Services (DCS) Machines integration. Wraps the `dedalus-sdk`
package so the agent can execute commands inside a persistent Linux VM.

The `dedalus-labs` SDK (used by `DedalusRunner`) is stateless — it only does
chat + hosted MCP. Containers / Linux VMs live in a SEPARATE SDK
(`dedalus-sdk`, pip name `dedalus-sdk`, import name `dedalus_sdk`). Docs:
https://docs.dedaluslabs.ai/sdk/dcs/python.md

Design:
  * ONE machine per backend process, lazily created on first use, cached by
    `machine_id` in a tiny meta table inside the existing SQLite audit DB.
  * Machine sleeps between calls ($0 compute while sleeping, state preserved).
  * We always issue a `wake()` before an execution; if it's already running,
    the API is a no-op.
  * Execution polling has a hard ceiling (`DCS_EXEC_TIMEOUT_S`) so a misbehaving
    command can't hang a /search request.

All calls here are SYNCHRONOUS — the DCS REST API isn't in the hot per-token
path, and keeping this sync matches the rest of `tools.py`. If the agent loop
needs async, wrap these in `asyncio.to_thread`.
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

from .db import connect


load_dotenv(Path(__file__).parent / ".env")


# ---------------------------------------------------------------------------
#  Config
# ---------------------------------------------------------------------------

DCS_MACHINE_VCPU = int(os.environ.get("DCS_MACHINE_VCPU", "1"))
DCS_MACHINE_MEMORY_MIB = int(os.environ.get("DCS_MACHINE_MEMORY_MIB", "1024"))
DCS_MACHINE_STORAGE_GIB = int(os.environ.get("DCS_MACHINE_STORAGE_GIB", "10"))

DCS_WAKE_TIMEOUT_S = int(os.environ.get("DCS_WAKE_TIMEOUT_S", "60"))
DCS_EXEC_TIMEOUT_S = int(os.environ.get("DCS_EXEC_TIMEOUT_S", "120"))
DCS_POLL_INTERVAL_S = float(os.environ.get("DCS_POLL_INTERVAL_S", "0.5"))

_RUNNING_PHASES = {"running"}
_TERMINAL_EXEC_STATES = {"succeeded", "failed", "cancelled", "canceled"}


# ---------------------------------------------------------------------------
#  SDK loader (lazy, so the backend still imports without dedalus-sdk installed)
# ---------------------------------------------------------------------------

def _load_dcs_sdk():
    """Return the sync `Dedalus` client class from the DCS SDK."""
    from dedalus_sdk import Dedalus  # type: ignore

    return Dedalus


_client = None


def _get_client():
    global _client
    if _client is None:
        Dedalus = _load_dcs_sdk()
        # SDK reads DEDALUS_API_KEY from env automatically.
        _client = Dedalus()
    return _client


# ---------------------------------------------------------------------------
#  Machine ID persistence — we want the SAME VM across backend restarts so
#  installed packages, cached files, and /home state carry over.
# ---------------------------------------------------------------------------

_META_TABLE_DDL = """
CREATE TABLE IF NOT EXISTS dcs_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
)
"""


def _ensure_meta_table() -> None:
    with connect() as conn:
        conn.execute(_META_TABLE_DDL)


def _read_cached_machine_id() -> Optional[str]:
    _ensure_meta_table()
    with connect() as conn:
        row = conn.execute(
            "SELECT value FROM dcs_meta WHERE key = 'machine_id'"
        ).fetchone()
    return row["value"] if row else None


def _write_cached_machine_id(machine_id: str) -> None:
    _ensure_meta_table()
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO dcs_meta (key, value) VALUES ('machine_id', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (machine_id,),
        )


def _env_machine_id() -> Optional[str]:
    value = os.environ.get("DEDALUS_MACHINE_ID", "").strip()
    return value or None


# ---------------------------------------------------------------------------
#  Machine lifecycle
# ---------------------------------------------------------------------------

def get_or_create_machine_id() -> str:
    """
    Return a Dedalus Machine ID for this backend to use.

    Resolution order:
      1. `DEDALUS_MACHINE_ID` env var (explicit pin — useful for shared VMs).
      2. SQLite `dcs_meta.machine_id` (cached from a previous auto-create).
      3. Create a new machine via `client.machines.create(...)` and cache the
         returned ID in SQLite.

    Never raises — failures bubble up from the SDK with an `APIStatusError`.
    """
    env = _env_machine_id()
    if env:
        return env

    cached = _read_cached_machine_id()
    if cached:
        return cached

    client = _get_client()
    machine = client.machines.create(
        vcpu=DCS_MACHINE_VCPU,
        memory_mib=DCS_MACHINE_MEMORY_MIB,
        storage_gib=DCS_MACHINE_STORAGE_GIB,
    )
    _write_cached_machine_id(machine.machine_id)
    return machine.machine_id


def ensure_machine_running(machine_id: Optional[str] = None) -> str:
    """
    Wake the machine (or leave it running) and block until `status.phase` is
    `running`. Returns the machine ID that's now live.

    Raises `TimeoutError` if the wake doesn't land within `DCS_WAKE_TIMEOUT_S`.
    """
    mid = machine_id or get_or_create_machine_id()
    client = _get_client()

    dm = client.machines.retrieve(machine_id=mid)
    phase = getattr(getattr(dm, "status", None), "phase", None)
    if phase not in _RUNNING_PHASES:
        client.machines.wake(machine_id=mid)

    deadline = time.monotonic() + DCS_WAKE_TIMEOUT_S
    while time.monotonic() < deadline:
        dm = client.machines.retrieve(machine_id=mid)
        phase = getattr(getattr(dm, "status", None), "phase", None)
        if phase in _RUNNING_PHASES:
            return mid
        time.sleep(DCS_POLL_INTERVAL_S)

    raise TimeoutError(
        f"machine {mid} did not reach 'running' within {DCS_WAKE_TIMEOUT_S}s"
    )


def sleep_machine(machine_id: Optional[str] = None) -> None:
    """Put the machine to sleep. Safe to call on an already-sleeping machine."""
    mid = machine_id or _env_machine_id() or _read_cached_machine_id()
    if not mid:
        return
    client = _get_client()
    client.machines.sleep(machine_id=mid)


# ---------------------------------------------------------------------------
#  Command execution
# ---------------------------------------------------------------------------

def run_command(
    command: list[str] | str,
    *,
    machine_id: Optional[str] = None,
    timeout_s: Optional[int] = None,
) -> dict:
    """
    Run a shell command inside the persistent Dedalus Machine and return its
    output. Always wakes the machine first.

    Args:
        command:    argv list, e.g. ["/bin/bash", "-c", "ls /home"], or a raw
                    shell string (auto-wrapped in `/bin/bash -c`).
        machine_id: override the default machine. If omitted, resolves via
                    `get_or_create_machine_id()`.
        timeout_s:  hard ceiling on the end-to-end execution, including polling.
                    Defaults to `DCS_EXEC_TIMEOUT_S`.

    Returns:
        dict { status, exit_code, stdout, stderr, duration_s, execution_id,
               machine_id, truncated }.
    """
    if isinstance(command, str):
        cmd: list[str] = ["/bin/bash", "-c", command]
    else:
        cmd = list(command)

    hard_timeout = timeout_s if timeout_s is not None else DCS_EXEC_TIMEOUT_S
    mid = ensure_machine_running(machine_id)
    client = _get_client()

    started = time.monotonic()
    exc = client.machines.executions.create(machine_id=mid, command=cmd)

    deadline = started + hard_timeout
    while getattr(exc, "status", None) not in _TERMINAL_EXEC_STATES:
        if time.monotonic() >= deadline:
            return {
                "status":       "timeout",
                "exit_code":    None,
                "stdout":       "",
                "stderr":       f"exceeded timeout of {hard_timeout}s",
                "duration_s":   round(time.monotonic() - started, 3),
                "execution_id": getattr(exc, "execution_id", None),
                "machine_id":   mid,
                "truncated":    False,
            }
        time.sleep(DCS_POLL_INTERVAL_S)
        exc = client.machines.executions.retrieve(
            machine_id=mid,
            execution_id=exc.execution_id,
        )

    output = client.machines.executions.output(
        machine_id=mid,
        execution_id=exc.execution_id,
    )
    stdout = getattr(output, "stdout", "") or ""
    stderr = getattr(output, "stderr", "") or ""
    exit_code = getattr(exc, "exit_code", None)

    return {
        "status":       getattr(exc, "status", "unknown"),
        "exit_code":    exit_code,
        "stdout":       stdout,
        "stderr":       stderr,
        "duration_s":   round(time.monotonic() - started, 3),
        "execution_id": exc.execution_id,
        "machine_id":   mid,
        "truncated":    False,
    }
