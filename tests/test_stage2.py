"""Stage 2 — Tiers + evolution acceptance (§8).

Accept: across >=9 malas, fitness rises AND archive diversity stays above a floor
(>=60% cells occupied). Rising fitness + collapsing diversity => widen scout's
protected budget.
"""

from kubera.config import CircuitConfig
from kubera.run import run


def test_fitness_rises_and_diversity_stays_above_floor(workdir):
    # 9 malas = 81 japa, scaled tiers 8/16/32.
    config = CircuitConfig(
        max_japa=81,
        high_tier_size=8,
        mid_tier_size=16,
        low_tier_size=32,
        spend_cap_usd=100.0,
        workdir=workdir,
    )
    final = run(config, verbose=False)
    m = final["metrics"]

    hist = m["best_fitness_history"]
    assert len(hist) >= 9
    # Fitness rises across the run.
    assert hist[-1] > hist[0]
    # Monotonic non-decreasing (skill library keeps the max).
    assert all(b <= a for a, b in zip(hist[1:], hist)) or all(hist[i] <= hist[i + 1] for i in range(len(hist) - 1))

    # Archive diversity stays above the 60% floor.
    assert m["archive_occupancy"] >= config.diversity_floor
    occ_hist = m["archive_occupancy_history"]
    # Occupancy is non-decreasing (cells, once filled, persist).
    assert all(occ_hist[i] <= occ_hist[i + 1] for i in range(len(occ_hist) - 1))


def test_diversity_collapse_widens_protected_budget(workdir):
    """If fitness rises while diversity sits below the floor, scout's protected
    budget must widen (the § Stage 2 rule)."""
    config = CircuitConfig(
        max_japa=18,
        high_tier_size=2,
        mid_tier_size=2,
        low_tier_size=2,  # starved exploration => low occupancy while fitness climbs
        diversity_floor=0.95,
        protected_budget=2,
        workdir=workdir,
    )
    start_budget = config.protected_budget
    from kubera.graph import build_graph, initial_state

    app, circuit = build_graph(config=config)
    state = initial_state(config)
    rl = 25 + (len(circuit.nodes()) + 2) * (config.max_japa + 2)
    app.invoke(state, {"configurable": {"thread_id": "t"}, "recursion_limit": rl})

    # compass should have widened the protected budget at least once.
    assert circuit.config.protected_budget > start_budget
