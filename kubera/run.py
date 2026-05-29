"""Runner / CLI for the Kubera Circuit.

Drives the compiled graph for a bounded number of cycles (``max_japa``),
respecting the spend cap and (optionally) the human gate at each mala boundary.
Prints a readable summary — the Stage 0 acceptance requires the log be legible.

Usage:
    python -m kubera.run --japa 9
    python -m kubera.run --japa 81 --high 8 --mid 16 --low 32
"""

from __future__ import annotations

import argparse
import json
import uuid
from typing import Any

from .config import CircuitConfig
from .graph import build_graph, initial_state


def run(config: CircuitConfig, *, auto_approve: bool = True, verbose: bool = True) -> dict:
    app, circuit = build_graph(config=config)
    state = initial_state(config)
    state["audit_log_ref"] = circuit.audit.path

    thread_id = uuid.uuid4().hex[:8]
    # Each pass crosses ~15 nodes; size the recursion budget generously.
    recursion_limit = 25 + (len(circuit.nodes()) + 2) * (config.max_japa + 2)
    run_config = {"configurable": {"thread_id": thread_id}, "recursion_limit": recursion_limit}

    result = app.invoke(state, run_config)

    # Resume across any human-gate interrupts (when human_gate is enabled).
    from langgraph.types import Command

    while _is_interrupted(app, run_config):
        if not auto_approve:
            break
        result = app.invoke(Command(resume={"approved": True}), run_config)

    final = app.get_state(run_config).values or result
    if verbose:
        _print_summary(final, circuit)
    return final


def _is_interrupted(app, run_config) -> bool:
    snap = app.get_state(run_config)
    return bool(getattr(snap, "next", None)) and bool(getattr(snap, "tasks", None)) and any(
        getattr(t, "interrupts", None) for t in snap.tasks
    )


def _print_summary(state: dict, circuit) -> None:
    m = state.get("metrics", {})
    print("=" * 64)
    print("KUBERA CIRCUIT — run summary")
    print("=" * 64)
    print(f"  goal           : {state.get('goal', '')[:60]}...")
    print(f"  japa / mala    : {state.get('japa')} / {state.get('mala')}")
    print(f"  spend_usd      : {state.get('spend_usd'):.4f} / cap {state.get('spend_cap_usd')}")
    print(f"  halted         : {state.get('halt')}  {state.get('halt_reason','')}")
    print(f"  best_fitness   : {m.get('best_fitness')}")
    print(f"  occupancy      : {m.get('archive_occupancy')} (floor {circuit.config.diversity_floor})")
    print(f"  winners_banked : {m.get('winners_banked')}")
    print(f"  warden_rejects : {m.get('warden_rejections')}")
    print(f"  compass_flags  : {m.get('compass_flags')}")
    print(f"  skills in lib  : {len(circuit.skills)}")
    print(f"  audit records  : {circuit.audit.count()}  ({circuit.audit.path})")
    print(f"  fitness hist   : {m.get('best_fitness_history')}")
    print(f"  occupancy hist : {m.get('archive_occupancy_history')}")
    print("=" * 64)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Run the Kubera Circuit harness (sandbox).")
    p.add_argument("--japa", type=int, default=9, help="max cycles to run (bounded)")
    p.add_argument("--high", type=int, default=1, help="high-tier size")
    p.add_argument("--mid", type=int, default=1, help="mid-tier size")
    p.add_argument("--low", type=int, default=1, help="low-tier size")
    p.add_argument("--cap", type=float, default=5.0, help="hard spend cap (USD)")
    p.add_argument("--seed", type=int, default=1234)
    p.add_argument("--workdir", type=str, default=".kubera")
    p.add_argument("--human-gate", action="store_true", help="enable human approval interrupt each mala")
    args = p.parse_args(argv)

    config = CircuitConfig(
        high_tier_size=args.high,
        mid_tier_size=args.mid,
        low_tier_size=args.low,
        spend_cap_usd=args.cap,
        max_japa=args.japa,
        seed=args.seed,
        workdir=args.workdir,
        human_gate=args.human_gate,
    )
    run(config, auto_approve=True, verbose=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
