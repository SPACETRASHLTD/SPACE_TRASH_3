"""Stage 3 / §7 — Non-negotiable guardrail tests.

These encode the guardrails that must never be stripped.
"""

import json

import pytest

from kubera.amend import HUMAN_APPROVAL_TOKEN, AmendmentRejected, amend_constitution
from kubera.circuit import Circuit
from kubera.config import CircuitConfig
from kubera.graph import build_graph, initial_state
from kubera.spend import SpendCapExceeded, SpendTracker
from kubera.world import RealWorldStub, SandboxWorld


# §7.1 — Sandbox only --------------------------------------------------------
def test_circuit_refuses_non_sandbox_world(workdir):
    config = CircuitConfig(workdir=workdir)
    with pytest.raises(PermissionError):
        Circuit(config=config, world=RealWorldStub(config))


def test_real_world_refuses_until_graduated(workdir):
    config = CircuitConfig(workdir=workdir)
    w = RealWorldStub(config)  # not graduated
    with pytest.raises(PermissionError):
        w.execute({"params": {}})
    # Even graduated, it has no live implementation (sandbox-only software).
    w2 = RealWorldStub(config, graduated=True, token="HUMAN-GRADUATED-REAL-WORLD")
    with pytest.raises(NotImplementedError):
        w2.execute({"params": {}})


def test_default_world_is_sandbox(workdir):
    c = Circuit(config=CircuitConfig(workdir=workdir))
    assert isinstance(c.world, SandboxWorld)
    assert c.world.sandbox is True


# §7.2 — Spend cap -----------------------------------------------------------
def test_spend_cap_halts_cleanly(workdir):
    # Tiny cap forces a breach mid-run; the circuit must halt cleanly, not crash.
    config = CircuitConfig(max_japa=50, spend_cap_usd=0.05, workdir=workdir,
                           high_tier_size=4, mid_tier_size=4, low_tier_size=4)
    from kubera.run import run
    final = run(config, verbose=False)
    assert final["halt"] is True
    assert "spend cap" in final["halt_reason"].lower()
    assert final["spend_usd"] <= config.spend_cap_usd


def test_spend_tracker_does_not_cross_line():
    t = SpendTracker(cap_usd=1.0)
    t.charge(0.9)
    with pytest.raises(SpendCapExceeded):
        t.charge(0.2)
    assert t.spend_usd == pytest.approx(0.9)  # breaching charge not applied


# §7.5 — Ground-truth-first verification -------------------------------------
def test_truth_check_corrects_inflated_claims(workdir):
    c = Circuit(config=CircuitConfig(workdir=workdir))
    config = c.config
    state = initial_state(config)
    from kubera.state import new_trajectory
    action = {"params": {"thrust": 0.7, "aggression": 0.6}, "target_category": "debris"}
    raw = c.world.execute(action)
    state["trajectories"] = [new_trajectory("s", action, raw)]
    state.update(c.truth_check(state))
    v = state["trajectories"][0]["verified_outcome"]
    # worker over-reported by 15%; ground truth is lower than the claim
    assert raw["claimed_mass"] > v["mass"]


# §7.6 — Append-only audit ---------------------------------------------------
def test_audit_is_append_only_and_sequenced(workdir):
    from kubera.run import run
    config = CircuitConfig(max_japa=9, workdir=workdir)
    final = run(config, verbose=False)
    with open(final["audit_log_ref"]) as fh:
        records = [json.loads(l) for l in fh if l.strip()]
    seqs = [r["seq"] for r in records]
    assert seqs == list(range(1, len(records) + 1))  # strictly monotonic, no gaps


# §7.7 — Dual-key constitution edits -----------------------------------------
def test_constitution_amend_requires_both_keys():
    base = CircuitConfig().constitution
    changes = {"rules": ["fuel_within_budget"]}
    # missing human token
    with pytest.raises(AmendmentRejected):
        amend_constitution(base, changes, human_token="wrong",
                           compass_signoff={"approved": True, "drift_ok": True})
    # missing compass sign-off
    with pytest.raises(AmendmentRejected):
        amend_constitution(base, changes, human_token=HUMAN_APPROVAL_TOKEN,
                           compass_signoff={"approved": False})
    # both keys present -> accepted
    out = amend_constitution(base, changes, human_token=HUMAN_APPROVAL_TOKEN,
                             compass_signoff={"approved": True, "drift_ok": True, "by": "operator"})
    assert out["rules"] == ["fuel_within_budget"]


def test_no_node_can_edit_constitution(workdir):
    """The system cannot edit its own fence: no node writes `constitution`."""
    config = CircuitConfig(max_japa=18, workdir=workdir, low_tier_size=4, mid_tier_size=4)
    from kubera.run import run
    final = run(config, verbose=False)
    assert final["constitution"] == config.constitution


# §7.3 — Constitution before reward (pre-execution check) --------------------
def test_low_tier_pre_execution_blocks_forbidden(workdir):
    c = Circuit(config=CircuitConfig(workdir=workdir, low_tier_size=4))
    state = initial_state(c.config)
    # Force jobs that target a forbidden category.
    state["jobs"] = [{
        "job_id": "x", "strategy_id": "s", "mode": "explore",
        "center": [0.5, 0.5], "sigma": 0.1, "target_category": "biohazard",
    }]
    out = c.low_tier(state)
    # Pre-execution guard refuses to even execute forbidden actions.
    assert out["trajectories"] == []


# §7.4 — Human gate interrupt ------------------------------------------------
def test_human_gate_interrupts_at_mala_boundary(workdir):
    config = CircuitConfig(max_japa=18, human_gate=True, workdir=workdir)
    app, circuit = build_graph(config=config)
    state = initial_state(config)
    rl = 25 + (len(circuit.nodes()) + 2) * (config.max_japa + 2)
    run_config = {"configurable": {"thread_id": "g"}, "recursion_limit": rl}
    app.invoke(state, run_config)
    snap = app.get_state(run_config)
    # The graph paused at the human gate (an interrupt is pending).
    assert snap.next  # there is a next step waiting on resume
    interrupts = [i for t in snap.tasks for i in (t.interrupts or [])]
    assert interrupts, "human gate should raise an interrupt at the mala boundary"

    # Resume with approval and confirm it proceeds.
    from langgraph.types import Command
    app.invoke(Command(resume={"approved": True}), run_config)
    snap2 = app.get_state(run_config)
    assert snap2.values["japa"] >= 9
