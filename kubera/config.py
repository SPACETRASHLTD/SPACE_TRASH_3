"""Open parameters (§10). Everything tunable lives here — nothing is hardcoded
in node logic. Supplied at init; sensible sandbox-safe defaults throughout.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


def default_goal() -> str:
    # BINDU — the immutable objective. Themed to the repo (Space Trash Ltd).
    return (
        "Maximize the mass of inert orbital debris salvaged per mission while "
        "staying within the fuel budget and never collecting protected or "
        "biohazardous waste."
    )


def default_constitution() -> dict:
    # VALUES FENCE. Amend only via the §7 dual-key path.
    return {
        "is": [
            "salvage inert orbital debris",
            "operate strictly within the fuel budget",
            "prefer small reversible bets before large ones",
        ],
        "isnt": [
            "collect biohazardous or biological waste",
            "collect legally protected / flagged salvage",
            "exceed the fuel budget",
        ],
        # Machine-checkable rules evaluated by the warden. Each is a predicate
        # name resolved in kubera.warden_rules.
        "rules": [
            "fuel_within_budget",
            "no_biohazard",
            "no_protected_salvage",
        ],
    }


@dataclass
class CircuitConfig:
    """All tunables. See §10."""

    # --- objective + fence (supplied at init) ---
    goal: str = field(default_factory=default_goal)
    constitution: dict = field(default_factory=default_constitution)

    # --- tier sizes (start 1/1/1, scale to 8/16/32) ---
    high_tier_size: int = 1
    mid_tier_size: int = 1
    low_tier_size: int = 1

    # --- spend (HARD cap, §7.2) ---
    spend_cap_usd: float = 5.0
    model_price_usd: dict = field(
        default_factory=lambda: {
            "high": 0.010,   # strong
            "mid": 0.004,    # mid
            "low": 0.001,    # cheap
            "guardian": 0.003,
        }
    )
    tool_price_usd: float = 0.0005

    # --- cadence (§6) ---
    japa_per_mala: int = 9
    mala_per_maha: int = 108
    max_japa: int = 9          # bounded run; route ENDs when reached
    human_gate: bool = False   # §7.4: interrupt at reconstitution when True

    # --- evolution / scout (§5, Stage 2) ---
    behavior_grid: int = 5     # MAP-Elites grid resolution per axis (5x5 = 25 cells)
    diversity_floor: float = 0.60  # archive occupancy floor (Stage 2 acceptance)
    protected_budget: int = 2  # young explorers shielded per cycle
    protected_budget_max: int = 8
    elite_fraction: float = 0.5  # survivors kept by fitness

    # --- world ---
    fuel_budget: float = 100.0

    # --- model id labels per tier (purely cosmetic for the mock; real routers
    #     map these to provider model names). §7.8: never hardcode a provider. ---
    model_ids: dict = field(
        default_factory=lambda: {
            "high": "tier-strong",
            "mid": "tier-mid",
            "low": "tier-cheap",
            "guardian": "tier-guardian",
        }
    )

    # --- persistence ---
    workdir: str = ".kubera"
    seed: int = 1234

    # --- naming choices left cosmetic (§10) ---
    vayu_name: str = "conductor"   # conductor | connector
    ishana_name: str = "compass"   # compass | steward

    def to_metrics(self) -> dict:
        return {
            "best_fitness": None,
            "best_fitness_history": [],
            "archive_occupancy": 0.0,
            "archive_occupancy_history": [],
            "winners_banked": 0,
            "warden_rejections": 0,
            "compass_flags": 0,
        }
