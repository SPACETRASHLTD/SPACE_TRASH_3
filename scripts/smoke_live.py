"""Low-cap live smoke run: a REAL model as the actor, in the deterministic sandbox.

This is the live confirmation of the load-bearing model path. Only the model is
real — the world stays the deterministic ``SandboxWorld`` and the spend cap is
tiny. It isolates the one variable: does the guardian layer hold when a genuinely
unpredictable model produces the actions?

Requirements (neither is hardcoded):
  - ANTHROPIC_API_KEY in the environment.
  - Network egress to api.anthropic.com (subject to the environment's policy).

Run:
    ANTHROPIC_API_KEY=... python scripts/smoke_live.py --japa 1 --low 2

Note: the spend meter is NOTIONAL (per-call fake prices), used here only to bound
the number of calls. Real token cost for this smoke is a fraction of a cent.
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from kubera.circuit import Circuit
from kubera.config import CircuitConfig
from kubera.graph import build_graph, initial_state
from kubera.llm_router import LLMRouter, http_anthropic_client
from kubera.policy import ModelPolicy
from kubera.spend import SpendTracker


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Live smoke run (real model, sandbox world).")
    p.add_argument("--japa", type=int, default=1)
    p.add_argument("--high", type=int, default=1)
    p.add_argument("--mid", type=int, default=1)
    p.add_argument("--low", type=int, default=2)
    p.add_argument("--cap", type=float, default=0.10, help="notional spend cap (bounds # of calls)")
    p.add_argument("--actor-model", default="claude-sonnet-4-6", help="model the actor (low tier) uses")
    p.add_argument("--aux-model", default="claude-haiku-4-5-20251001", help="model for the decorative tiers")
    p.add_argument("--workdir", default=".kubera-live")
    args = p.parse_args(argv)

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY is not set. Refusing to run a live smoke without a key.")
        return 2

    config = CircuitConfig(
        high_tier_size=args.high, mid_tier_size=args.mid, low_tier_size=args.low,
        spend_cap_usd=args.cap, max_japa=args.japa, workdir=args.workdir,
        model_ids={
            "high": args.aux_model,
            "mid": args.aux_model,
            "low": args.actor_model,     # the load-bearing actor is a real, capable model
            "guardian": args.aux_model,
        },
    )
    spend = SpendTracker(config.spend_cap_usd)
    router = LLMRouter(config, spend, http_anthropic_client())
    circuit = Circuit(config=config, router=router, spend=spend, policy=ModelPolicy())

    app, circuit = build_graph(circuit=circuit)
    state = initial_state(config)
    rl = 25 + (len(circuit.nodes()) + 2) * (config.max_japa + 2)

    try:
        app.invoke(state, {"configurable": {"thread_id": "live"}, "recursion_limit": rl})
    except Exception as exc:  # network policy / auth / transport problems
        print(f"LIVE CALL FAILED: {type(exc).__name__}: {exc}")
        print("(If this is a network error, the environment's policy may block api.anthropic.com.)")
        return 1

    final = app.get_state({"configurable": {"thread_id": "live"}}).values
    m = final.get("metrics", {})
    print("=" * 60)
    print("LIVE SMOKE — real model actor, deterministic sandbox world")
    print("=" * 60)
    print(f"  actor model     : {args.actor_model}")
    print(f"  japa completed  : {final.get('japa')}   halted={final.get('halt')} {final.get('halt_reason','')}")
    print(f"  notional spend  : {final.get('spend_usd'):.4f} / cap {args.cap}")
    print(f"  warden rejects  : {m.get('warden_rejections')}")
    print(f"  malformed skips : {circuit.audit.count('malformed_skip')}")
    print(f"  preexec blocks  : {circuit.audit.count('preexec_block')}")
    print(f"  best_fitness    : {m.get('best_fitness')}")
    print(f"  skills banked   : {len(circuit.skills)}")
    print("  --- a few real trajectories (action -> verified) ---")
    for t in (final.get("trajectories") or [])[:5]:
        v = t.get("verified_outcome") or {}
        print(f"    {t['action']['params']} cat={t['action']['target_category']:9s} "
              f"-> mass={v.get('mass')} fuel={v.get('fuel')} allowed={t.get('allowed')} survives={t.get('survives')}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
