"""Stage 0 — Skeleton acceptance (§8).

Accept: one mala runs unattended; spend cap respected; >=1 verified winner
banked and reused next japa; log readable.
"""

from kubera.config import CircuitConfig
from kubera.run import run


def test_one_mala_runs_unattended_under_spend_cap(workdir):
    config = CircuitConfig(max_japa=9, workdir=workdir, spend_cap_usd=5.0)
    final = run(config, verbose=False)

    # one full mala (9 japa) completed, not halted
    assert final["japa"] == 9
    assert final["halt"] is False
    # HARD spend cap respected (§7.2)
    assert final["spend_usd"] < config.spend_cap_usd


def test_verified_winner_banked_and_reused(workdir):
    config = CircuitConfig(max_japa=9, workdir=workdir)
    final = run(config, verbose=False)

    m = final["metrics"]
    # at least one verified winner banked
    assert m["winners_banked"] >= 1
    # reused next japa => fitness improves over the run (skill library compounds)
    hist = m["best_fitness_history"]
    assert len(hist) >= 2
    assert hist[-1] > hist[0]


def test_audit_log_is_readable(workdir):
    config = CircuitConfig(max_japa=9, workdir=workdir)
    final = run(config, verbose=False)

    import json
    path = final["audit_log_ref"]
    with open(path) as fh:
        records = [json.loads(line) for line in fh if line.strip()]
    assert records, "audit log should not be empty"
    # records are well-formed and monotonically sequenced (append-only)
    seqs = [r["seq"] for r in records]
    assert seqs == sorted(seqs)
    kinds = {r["kind"] for r in records}
    assert {"truth", "treasurer"}.issubset(kinds)
