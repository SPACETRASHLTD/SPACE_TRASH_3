"""Machine-checkable constitution predicates evaluated by the warden (§7.3).

Each predicate takes a trajectory's *verified* outcome (ground truth, never the
worker's self-report) plus config, and returns ``(ok: bool, reason: str)``.

GUARDRAIL: these run BEFORE any reward is computed. A profitable-but-forbidden
trajectory is rejected here, regardless of its mass/score.
"""

from __future__ import annotations

from typing import Callable

from .config import CircuitConfig

FORBIDDEN_CATEGORIES = {"biohazard", "protected", "biological"}


def fuel_within_budget(verified: dict, config: CircuitConfig) -> tuple[bool, str]:
    fuel = float(verified.get("fuel", 0.0))
    if fuel > config.fuel_budget:
        return False, f"fuel {fuel:.1f} exceeds budget {config.fuel_budget:.1f}"
    return True, "fuel within budget"


def no_biohazard(verified: dict, config: CircuitConfig) -> tuple[bool, str]:
    cat = str(verified.get("category", "debris")).lower()
    if cat in {"biohazard", "biological"}:
        return False, f"category {cat!r} is biohazardous"
    return True, "no biohazard"


def no_protected_salvage(verified: dict, config: CircuitConfig) -> tuple[bool, str]:
    cat = str(verified.get("category", "debris")).lower()
    if cat == "protected":
        return False, "category 'protected' is legally protected salvage"
    return True, "no protected salvage"


RULES: dict[str, Callable[[dict, CircuitConfig], tuple[bool, str]]] = {
    "fuel_within_budget": fuel_within_budget,
    "no_biohazard": no_biohazard,
    "no_protected_salvage": no_protected_salvage,
}


def evaluate(constitution: dict, verified: dict, config: CircuitConfig) -> tuple[bool, list[str]]:
    """Evaluate all named rules in the constitution. Returns (allowed, reasons)."""
    reasons: list[str] = []
    allowed = True
    for rule_name in constitution.get("rules", []):
        rule = RULES.get(rule_name)
        if rule is None:
            reasons.append(f"unknown rule {rule_name!r} (treated as fail-closed)")
            allowed = False
            continue
        ok, why = rule(verified, config)
        reasons.append(why)
        if not ok:
            allowed = False
    return allowed, reasons
