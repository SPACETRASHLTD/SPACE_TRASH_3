"""MemoryStore implementations (§9). Stage 0 ships a JSON-file store with a
decay hook (Nirrti). Swap for Mem0/Zep later behind the same Protocol.
"""

from __future__ import annotations

import json
import os
import threading
import time
from typing import Any


class JSONMemoryStore:
    """Namespaced, persisted memory. Each namespace is a list of items with a
    monotonically decaying ``weight`` used by ``decay`` to age out stale entries.
    """

    def __init__(self, path: str, decay_factor: float = 0.9, floor: float = 0.05):
        self.path = path
        self.decay_factor = decay_factor
        self.floor = floor
        self._lock = threading.Lock()
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self._data: dict[str, list] = {}
        if os.path.exists(path):
            try:
                with open(path) as fh:
                    self._data = json.load(fh)
            except (json.JSONDecodeError, OSError):
                self._data = {}

    def _flush(self) -> None:
        with open(self.path, "w") as fh:
            json.dump(self._data, fh, indent=2, default=str)

    def write(self, ns: str, item: dict) -> None:
        with self._lock:
            entry = dict(item)
            entry.setdefault("_ts", time.time())
            entry.setdefault("_weight", 1.0)
            self._data.setdefault(ns, []).append(entry)
            self._flush()

    def query(self, ns: str, q: str, k: int) -> list:
        """Naive relevance: substring match on a serialized item, newest first.
        Good enough for Stage 0; a real store does embeddings."""
        items = list(self._data.get(ns, []))
        q = (q or "").lower()
        if q:
            scored = [it for it in items if q in json.dumps(it, default=str).lower()]
        else:
            scored = items
        scored = sorted(scored, key=lambda it: it.get("_ts", 0), reverse=True)
        return scored[:k]

    def all(self, ns: str) -> list:
        return list(self._data.get(ns, []))

    def decay(self, ns: str) -> None:
        """Nirrti hook: age every item; drop those below the floor."""
        with self._lock:
            kept = []
            for it in self._data.get(ns, []):
                it["_weight"] = it.get("_weight", 1.0) * self.decay_factor
                if it["_weight"] >= self.floor:
                    kept.append(it)
            self._data[ns] = kept
            self._flush()
