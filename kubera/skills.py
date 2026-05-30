"""Skill library (Kubera / treasurer, §5, Stage 2).

Banked winners become reusable skills: named parameter sets with a recorded
fitness. high_tier and mid_tier read the library to *exploit* known-good regions,
which is the mechanism by which fitness compounds across cycles. Persisted to
disk so improvement carries across runs (Stage 0 acceptance: reused next japa).
"""

from __future__ import annotations

import json
import os
import threading
from typing import Any


class SkillLibrary:
    def __init__(self, path: str, capacity: int = 64):
        self.path = path
        self.capacity = capacity
        self._lock = threading.Lock()
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self._skills: list[dict] = []
        if os.path.exists(path):
            try:
                with open(path) as fh:
                    self._skills = json.load(fh)
            except (json.JSONDecodeError, OSError):
                self._skills = []

    def _flush(self) -> None:
        with open(self.path, "w") as fh:
            json.dump(self._skills, fh, indent=2, default=str)

    def bank(self, skill: dict) -> None:
        """Add or upgrade a skill, keeping the highest-fitness variants."""
        with self._lock:
            self._skills.append(dict(skill))
            # Keep the best by fitness, capped at capacity.
            self._skills.sort(key=lambda s: s.get("fitness", float("-inf")), reverse=True)
            self._skills = self._skills[: self.capacity]
            self._flush()

    def best(self, k: int = 1) -> list[dict]:
        return self._skills[:k]

    def all(self) -> list[dict]:
        return list(self._skills)

    def __len__(self) -> int:
        return len(self._skills)
