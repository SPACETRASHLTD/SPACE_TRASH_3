"""MAP-Elites archive (Indra / scout, §5, Stage 2).

Quality-Diversity: the behavioral space (here the 2-D (thrust, aggression) grid)
is discretized into cells; each cell keeps the single best-fitness "elite" seen
with that behavior. Novelty of a new behavior is its distance to the nearest
occupied cell. Occupancy (fraction of filled cells) is the diversity metric the
Stage 2 acceptance test floors at 60%.
"""

from __future__ import annotations

import json
import math
import os
from typing import Any


class MapElitesArchive:
    def __init__(self, path: str, grid: int = 5):
        self.path = path
        self.grid = grid
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self.cells: dict[str, dict] = {}
        if os.path.exists(path):
            try:
                with open(path) as fh:
                    self.cells = json.load(fh)
            except (json.JSONDecodeError, OSError):
                self.cells = {}

    def _flush(self) -> None:
        with open(self.path, "w") as fh:
            json.dump(self.cells, fh, indent=2, default=str)

    def _cell_key(self, behavior: list) -> str:
        idx = []
        for b in behavior:
            i = min(self.grid - 1, max(0, int(b * self.grid)))
            idx.append(i)
        return ",".join(str(i) for i in idx)

    def total_cells(self) -> int:
        return self.grid ** 2

    def occupancy(self) -> float:
        return len(self.cells) / self.total_cells()

    def novelty(self, behavior: list) -> float:
        """Distance from this behavior to the nearest occupied cell center,
        normalized to [0, 1]. Empty archive => maximal novelty."""
        if not self.cells:
            return 1.0
        key = self._cell_key(behavior)
        if key in self.cells:
            # Already-explored region: novelty scales with how much better this is.
            return 0.0
        target = [int(i) for i in key.split(",")]
        best = math.inf
        for occ_key in self.cells:
            occ = [int(i) for i in occ_key.split(",")]
            d = math.dist(target, occ)
            best = min(best, d)
        max_d = math.dist([0, 0], [self.grid - 1, self.grid - 1]) or 1.0
        return min(1.0, best / max_d)

    def add(self, behavior: list, fitness: float, payload: dict) -> bool:
        """Insert if this behavior's cell is empty or improved. Returns True if
        the archive changed (i.e. this is a new elite)."""
        key = self._cell_key(behavior)
        current = self.cells.get(key)
        if current is None or fitness > current.get("fitness", float("-inf")):
            self.cells[key] = {"behavior": behavior, "fitness": fitness, "payload": payload}
            self._flush()
            return True
        return False

    def elites(self) -> list[dict]:
        return list(self.cells.values())
