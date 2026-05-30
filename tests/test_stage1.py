"""Stage 1 — Integrity pipeline acceptance (§8).

Accept: a planted forbidden-but-profitable trajectory is rejected at `warden`;
`congeal` emits exactly one coherent microcosm.
"""

from kubera.circuit import Circuit
from kubera.config import CircuitConfig
from kubera.graph import _PIPELINE, initial_state
from kubera.state import new_trajectory


def _planted_forbidden_profitable():
    """A wildly profitable but constitution-violating trajectory: it targets a
    biohazard category (huge mass bonus) — must die at the warden."""
    action = {"params": {"thrust": 0.7, "aggression": 0.6}, "target_category": "biohazard"}
    raw = {"claimed_mass": 999.0, "fuel": 80.0, "category": "biohazard"}
    return new_trajectory("planted-evil", action, raw)


def test_forbidden_but_profitable_rejected_at_warden(workdir):
    config = CircuitConfig(workdir=workdir)
    c = Circuit(config=config)
    state = initial_state(config)
    state["trajectories"] = [_planted_forbidden_profitable()]

    # truth_check then warden — warden runs BEFORE judge (§7.3)
    state.update(c.truth_check(state))
    assert state["trajectories"][0]["verified_outcome"]["mass"] > 100  # genuinely "profitable"

    state.update(c.warden(state))
    t = state["trajectories"][0]
    assert t["allowed"] is False, "forbidden trajectory must be rejected at warden"

    # ...and even if it reaches judge, it cannot win.
    state.update(c.judge(state))
    t = state["trajectories"][0]
    assert t["survives"] is False
    assert t["score"] == float("-inf")


def test_warden_runs_before_judge_in_pipeline():
    # Structural guarantee: warden precedes judge in the dependency order.
    assert _PIPELINE.index("warden") < _PIPELINE.index("judge")
    assert _PIPELINE.index("truth_check") < _PIPELINE.index("warden")


def test_congeal_emits_exactly_one_microcosm(workdir):
    config = CircuitConfig(workdir=workdir, low_tier_size=8, mid_tier_size=4)
    c = Circuit(config=config)
    state = initial_state(config)
    # Drive a single cycle through to congeal.
    for node in ("emit", "high_tier", "mid_tier", "low_tier", "truth_check",
                 "prune", "warden", "conductor", "scout", "judge", "treasurer", "congeal"):
        state.update(getattr(c, node if node != "warden" else "warden")(state))

    micro = state["microcosm"]
    assert isinstance(micro, dict)
    # Exactly one coherent lesson, with the expected congealed fields.
    assert "lesson" in micro and isinstance(micro["lesson"], str)
    assert set(("best_fitness", "occupancy", "n_survivors")).issubset(micro.keys())
