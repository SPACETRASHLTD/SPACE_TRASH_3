"""Append-only audit ledger (§7.6 — Ananta).

Every guardian verdict — truth results, warden rejections, judge selections,
compass flags, constitution amendments — is appended immutably as JSON lines.
The file is opened in append mode only; there is no update/delete path.
"""

from __future__ import annotations

import json
import os
import threading
import time
from typing import Any


class AuditLog:
    """JSONL append-only ledger. Thread-safe for in-process use."""

    def __init__(self, path: str):
        self.path = path
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self._lock = threading.Lock()
        self._seq = 0
        # If resuming an existing ledger, continue the sequence.
        if os.path.exists(path):
            with open(path, "r") as fh:
                self._seq = sum(1 for _ in fh)

    def append(self, kind: str, payload: dict[str, Any]) -> dict:
        """Append one immutable record and return it."""
        with self._lock:
            self._seq += 1
            record = {
                "seq": self._seq,
                "ts": time.time(),
                "kind": kind,
                "payload": payload,
            }
            with open(self.path, "a") as fh:
                fh.write(json.dumps(record, default=str) + "\n")
            return record

    def read_all(self) -> list[dict]:
        if not os.path.exists(self.path):
            return []
        with open(self.path, "r") as fh:
            return [json.loads(line) for line in fh if line.strip()]

    def count(self, kind: str | None = None) -> int:
        records = self.read_all()
        if kind is None:
            return len(records)
        return sum(1 for r in records if r["kind"] == kind)
