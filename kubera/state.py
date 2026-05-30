"""Shared graph state for the Kubera Circuit (§3 of the build brief).

These are plain ``TypedDict`` schemas used as the LangGraph ``StateGraph`` state.
Nodes return partial dicts; LangGraph merges them by key. Because the circuit is
a single sequential pass per cycle (no parallel fan-out), last-write-wins merge
semantics are exactly what we want.

All mythic aliases are documented inline; the engineering meaning leads.
"""

from __future__ import annotations

from typing import Any, TypedDict


class Trajectory(TypedDict, total=False):
    """One worker attempt as it flows through the integrity pipeline.

    Fields are populated progressively by successive pipeline stages, so this is
    a ``total=False`` TypedDict: early stages set the first fields, later guardian
    stages annotate the rest.
    """

    id: str
    strategy_id: str          # which strategy/directive produced it
    action: dict              # what the worker did (params sent to the world)
    raw_outcome: dict         # what the worker *reported*
    verified_outcome: dict | None  # ground-truth checked (Yama-truth)
    verified: bool
    allowed: bool             # passed the constitution? (Varuna / warden)
    novelty: float            # behavioral-descriptor score (Indra / scout)
    behavior: list            # behavioral descriptor coordinates (for MAP-Elites)
    protected: bool           # young-explorer shield (Indra / scout)
    score: float | None       # fitness (Yama-judge)
    survives: bool
    notes: list               # human-readable trail for the audit log


class CircuitState(TypedDict, total=False):
    """The full circuit state. See §3 of the brief for the canonical field map."""

    # --- FIXED CORE (low / zero mutability) ---
    goal: str                 # BINDU — immutable objective. Never written by the system.
    constitution: dict        # VALUES FENCE — {"is":[...], "isnt":[...], "rules":[...]}.
    identity: dict            # AHAMKARA — evolving self-model {summary, strategy_lib_ref, version}.

    # --- CYCLE BOOKKEEPING ---
    japa: int                 # cycle counter (one full graph pass)
    mala: int                 # mala counter (increments every 9 japa)
    spend_usd: float
    spend_cap_usd: float      # HARD limit
    halt: bool                # set by compass (drift) or spend guard
    halt_reason: str

    # --- WORKING SET (current cycle) ---
    directives: list          # HIGH tier output (strategy)
    jobs: list                # MID tier output (assignments + tool/permission requests)
    trajectories: list        # LOW tier output -> flows through the pipeline
    microcosm: dict           # AGNI — congealed signal that rises to integrate
    pending_permissions: list # tool/capability/capital requests raised by mid_tier

    # --- TIER MEMORIES (each holds its own + everything above it) ---
    mem_high: list
    mem_mid: list
    mem_low: list

    # --- PERSISTENCE / OBSERVABILITY ---
    audit_log_ref: str        # append-only ledger (Ananta)
    metrics: dict             # rolling metrics for observability + acceptance tests


def new_trajectory(strategy_id: str, action: dict, raw_outcome: dict) -> Trajectory:
    """Construct a fresh trajectory with sane defaults for the pipeline."""

    import uuid

    return Trajectory(
        id=uuid.uuid4().hex[:12],
        strategy_id=strategy_id,
        action=action,
        raw_outcome=raw_outcome,
        verified_outcome=None,
        verified=False,
        allowed=True,
        novelty=0.0,
        behavior=[],
        protected=False,
        score=None,
        survives=False,
        notes=[],
    )
