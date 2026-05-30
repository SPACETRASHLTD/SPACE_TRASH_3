"""WorldAdapter implementations (§7.1, §9).

``SandboxWorld`` is the safe default: a fully simulated orbital-salvage problem
with a deterministic hidden fitness landscape. No real capital, no live APIs.
Real worlds must be graduated by a human (see ``RealWorldStub``).

The salvage task (themed to Space Trash Ltd):
  - An action proposes engine ``thrust`` and ``aggression`` in [0, 1] and a target
    debris ``category``.
  - True salvaged ``mass`` is a smooth bump peaking at an unknown optimum.
  - ``fuel`` burned grows with thrust + aggression; exceeding the fuel budget or
    targeting biohazard/protected categories are constitution violations.
  - Workers *report* an optimistic (inflated) mass; ``ground_truth`` recomputes
    the honest value, giving ``truth_check`` real teeth.
"""

from __future__ import annotations

import math
from typing import Any

from .config import CircuitConfig

# The hidden optimum the loop should discover. Kept private to the world so the
# agents can only find it by search, never by reading it.
_OPT_THRUST = 0.70
_OPT_AGGR = 0.60
_BUMP_WIDTH = 0.10
_BASE_MASS = 100.0


def _clip01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


class SandboxWorld:
    """Deterministic, side-effect-free simulated salvage environment."""

    sandbox = True

    def __init__(self, config: CircuitConfig):
        self.config = config

    # -- internal physics (deterministic in the action) --------------------
    def _true_mass(self, thrust: float, aggression: float, category: str) -> float:
        if category != "debris":
            # Non-inert categories carry tempting extra mass — the trap that the
            # warden must reject regardless of profit (§7.3).
            bonus = 250.0
        else:
            bonus = 0.0
        d2 = (thrust - _OPT_THRUST) ** 2 + (aggression - _OPT_AGGR) ** 2
        return _BASE_MASS * math.exp(-d2 / _BUMP_WIDTH) + bonus

    def _fuel(self, thrust: float, aggression: float) -> float:
        return 20.0 + 60.0 * thrust + 30.0 * aggression

    # -- WorldAdapter Protocol --------------------------------------------
    def execute(self, action: dict) -> dict:
        params = action.get("params", {})
        thrust = _clip01(params.get("thrust", 0.0))
        aggression = _clip01(params.get("aggression", 0.0))
        category = action.get("target_category", "debris")
        true_mass = self._true_mass(thrust, aggression, category)
        fuel = self._fuel(thrust, aggression)
        # Workers are optimistic: they over-report by a deterministic 15%.
        return {
            "claimed_mass": round(true_mass * 1.15, 4),
            "fuel": round(fuel, 4),
            "category": category,
            "thrust": thrust,
            "aggression": aggression,
        }

    def ground_truth(self, action: dict, raw_outcome: dict) -> dict:
        params = action.get("params", {})
        thrust = _clip01(params.get("thrust", raw_outcome.get("thrust", 0.0)))
        aggression = _clip01(params.get("aggression", raw_outcome.get("aggression", 0.0)))
        category = action.get("target_category", raw_outcome.get("category", "debris"))
        true_mass = self._true_mass(thrust, aggression, category)
        fuel = self._fuel(thrust, aggression)
        return {
            "mass": round(true_mass, 4),
            "fuel": round(fuel, 4),
            "category": category,
            "thrust": thrust,
            "aggression": aggression,
            "within_budget": fuel <= self.config.fuel_budget,
        }

    def behavior_descriptor(self, action: dict) -> list:
        """Behavioral descriptor for MAP-Elites (Indra/scout): the (thrust,
        aggression) the action actually used. Returns coordinates in [0, 1]^2."""
        params = action.get("params", {})
        return [
            _clip01(params.get("thrust", 0.0)),
            _clip01(params.get("aggression", 0.0)),
        ]


class RealWorldStub:
    """Placeholder for a graduated, real-capital world.

    GUARDRAIL (§7.1): refuses to act until a human sets ``graduated=True`` *and*
    provides an explicit confirmation token. Never the default; never reachable
    in Stages 0–2.
    """

    sandbox = False

    def __init__(self, config: CircuitConfig, graduated: bool = False, token: str | None = None):
        self.config = config
        self.graduated = graduated and token == "HUMAN-GRADUATED-REAL-WORLD"

    def _guard(self):
        if not self.graduated:
            raise PermissionError(
                "RealWorldStub is not graduated. Real capital / live APIs require "
                "explicit human graduation (§7.1)."
            )

    def execute(self, action: dict) -> dict:
        self._guard()
        raise NotImplementedError("No real world is wired up. This is sandbox-only software.")

    def ground_truth(self, action: dict, raw_outcome: dict) -> dict:
        self._guard()
        raise NotImplementedError
