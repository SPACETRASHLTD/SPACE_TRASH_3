"""The Kubera Circuit nodes (§4, §5).

A single ``Circuit`` object owns all out-of-state dependencies (router, world,
memory, audit, archive, skills, tools, spend meter, RNG) and exposes one method
per graph node. ``graph.py`` wires these into a LangGraph ``StateGraph`` with a
loop-back edge.

Engineering meaning leads; the mythic alias is noted on each node.
"""

from __future__ import annotations

import functools
import math
import os
import random
from typing import Any, Callable

from . import warden_rules
from .archive import MapElitesArchive
from .audit import AuditLog
from .config import CircuitConfig
from .interfaces import ModelRouter, WorldAdapter
from .memory import JSONMemoryStore
from .skills import SkillLibrary
from .spend import SpendCapExceeded, SpendTracker
from .state import CircuitState, new_trajectory
from .tools import ToolRegistryImpl, default_registry


def _cell_centers(grid: int) -> list[list[float]]:
    centers = []
    for i in range(grid):
        for j in range(grid):
            centers.append([(i + 0.5) / grid, (j + 0.5) / grid])
    return centers


class Circuit:
    def __init__(
        self,
        config: CircuitConfig | None = None,
        *,
        world: WorldAdapter | None = None,
        router: ModelRouter | None = None,
        spend: SpendTracker | None = None,
    ):
        self.config = config or CircuitConfig()
        wd = self.config.workdir
        os.makedirs(wd, exist_ok=True)

        self.spend = spend or SpendTracker(self.config.spend_cap_usd)

        # Lazily import to keep module import cheap and providers swappable.
        from .models import ModelRouterImpl
        from .world import SandboxWorld

        self.world: WorldAdapter = world or SandboxWorld(self.config)
        self.router: ModelRouter = router or ModelRouterImpl(self.config, self.spend)

        self.audit = AuditLog(os.path.join(wd, "audit.jsonl"))
        self.memory = JSONMemoryStore(os.path.join(wd, "memory.json"))
        self.skills = SkillLibrary(os.path.join(wd, "skills.json"))
        self.archive = MapElitesArchive(os.path.join(wd, "archive.json"), grid=self.config.behavior_grid)
        self.tools: ToolRegistryImpl = default_registry(self.spend)

        self.rng = random.Random(self.config.seed)
        self._explore_cursor = 0
        self._cell_centers = _cell_centers(self.config.behavior_grid)

        # GUARDRAIL (§7.1): refuse to run a non-sandbox world as the default.
        if not getattr(self.world, "sandbox", False):
            raise PermissionError(
                "Refusing to run: WorldAdapter is not a sandbox. Real worlds "
                "require explicit human graduation (§7.1)."
            )

    # ------------------------------------------------------------------ utils
    def _node(self, name: str, body: Callable[[CircuitState], dict]) -> Callable[[CircuitState], dict]:
        """Wrap a node body with spend-guard, halt short-circuit, and logging."""

        @functools.wraps(body)
        def wrapped(state: CircuitState) -> dict:
            if state.get("halt"):
                return {}  # circuit is halting; pass through untouched
            try:
                out = body(state) or {}
            except SpendCapExceeded as exc:
                self.audit.append("halt", {"node": name, "reason": str(exc)})
                return {
                    "halt": True,
                    "halt_reason": str(exc),
                    "spend_usd": self.spend.spend_usd,
                }
            # Always reflect the live spend meter into state for observability.
            out.setdefault("spend_usd", self.spend.spend_usd)
            return out

        return wrapped

    def nodes(self) -> dict[str, Callable[[CircuitState], dict]]:
        return {
            "emit": self._node("emit", self.emit),
            "high_tier": self._node("high_tier", self.high_tier),
            "mid_tier": self._node("mid_tier", self.mid_tier),
            "low_tier": self._node("low_tier", self.low_tier),
            "truth_check": self._node("truth_check", self.truth_check),
            "prune": self._node("prune", self.prune),
            "warden": self._node("warden", self.warden),
            "conductor": self._node("conductor", self.conductor),
            "scout": self._node("scout", self.scout),
            "judge": self._node("judge", self.judge),
            "treasurer": self._node("treasurer", self.treasurer),
            "congeal": self._node("congeal", self.congeal),
            "compass": self._node("compass", self.compass),
            "integrate": self._node("integrate", self.integrate),
            "route": self._node("route", self.route_node),
            "reconstitute": self._node("reconstitute", self.reconstitute),
        }

    # ============================================================== NODES ===
    # ---- emit (Bindu): frame the fixed goal through fence + identity --------
    def emit(self, state: CircuitState) -> dict:
        japa = state.get("japa", 0) + 1
        # mala = number of full malas reached (1-indexed at each 9-japa boundary).
        mala = japa // self.config.japa_per_mala
        # Tiny deterministic framing through the router (model-agnostic).
        framing = self.router.complete(
            "guardian",
            f"GOAL: {state['goal']}\nFENCE_IS: {state['constitution'].get('is')}\n"
            f"IDENTITY: {state.get('identity', {}).get('summary', 'nascent')}",
        )
        return {
            "japa": japa,
            "mala": mala,
            "directives": [],
            "jobs": [],
            "trajectories": [],
            "pending_permissions": [],
            "metrics": dict(state.get("metrics") or self.config.to_metrics(), framing=framing),
            "spend_usd": self.spend.spend_usd,
        }

    # ---- high_tier (8 / Buddhi): research + set strategy --------------------
    def high_tier(self, state: CircuitState) -> dict:
        micro = state.get("microcosm") or {}
        best_skills = self.skills.best(self.config.high_tier_size)
        directives: list[dict] = []
        n = self.config.high_tier_size
        # Shrinking exploitation radius as identity matures (more cycles = tighter).
        sigma = max(0.04, 0.30 * (0.92 ** state.get("japa", 1)))
        for i in range(n):
            # Strong model frames each strategist's brief (charged via router).
            self.router.complete("high", f"strategize#{i} goal={state['goal'][:40]} micro={micro.get('lesson','')[:40]}")
            if best_skills:
                skill = best_skills[i % len(best_skills)]
                center = skill.get("center", [0.5, 0.5])
                directives.append({
                    "strategy_id": f"exploit-{i}",
                    "mode": "exploit",
                    "center": center,
                    "sigma": sigma,
                })
            else:
                directives.append({
                    "strategy_id": f"explore-{i}",
                    "mode": "explore",
                    "center": None,
                    "sigma": sigma,
                })
        # Always keep at least one explorer alive for diversity.
        if all(d["mode"] == "exploit" for d in directives):
            directives.append({"strategy_id": "explore-aux", "mode": "explore", "center": None, "sigma": sigma})
        mem_high = list(state.get("mem_high") or [])
        mem_high.append({"japa": state.get("japa"), "directives": [d["strategy_id"] for d in directives]})
        return {"directives": directives, "mem_high": mem_high[-50:]}

    # ---- mid_tier (16): strategy -> concrete jobs + permission requests -----
    def mid_tier(self, state: CircuitState) -> dict:
        directives = state.get("directives") or []
        jobs: list[dict] = []
        size = self.config.mid_tier_size
        if not directives:
            directives = [{"strategy_id": "default", "mode": "explore", "center": None, "sigma": 0.2}]
        self.router.complete("mid", f"plan jobs for {len(directives)} directives")
        for k in range(size):
            d = directives[k % len(directives)]
            jobs.append({
                "job_id": f"j{state.get('japa')}-{k}",
                "strategy_id": d["strategy_id"],
                "mode": d["mode"],
                "center": d.get("center"),
                "sigma": d.get("sigma", 0.2),
                "target_category": "debris",  # §7.3 pre-check: workers only target inert debris
            })
        # Dedupe identical job specs.
        seen, deduped = set(), []
        for j in jobs:
            key = (j["mode"], tuple(j["center"]) if j["center"] else None, round(j["sigma"], 3))
            if key not in seen:
                seen.add(key)
                deduped.append(j)
        # §7.4: surface standing capability requests for the human gate.
        pending = self.tools.needs_permission()
        mem_mid = list(state.get("mem_mid") or [])
        mem_mid.append({"japa": state.get("japa"), "jobs": len(deduped)})
        return {"jobs": deduped, "pending_permissions": pending, "mem_mid": mem_mid[-50:]}

    # ---- low_tier (32): execute in the SANDBOX world ------------------------
    def low_tier(self, state: CircuitState) -> dict:
        jobs = state.get("jobs") or []
        if not jobs:
            return {"trajectories": []}
        size = self.config.low_tier_size
        n_explore = max(1, size // 2)
        trajectories = []
        mem_low = list(state.get("mem_low") or [])
        for i in range(size):
            job = jobs[i % len(jobs)]
            explore = (i < n_explore) or job["mode"] == "explore" or not job.get("center")
            if explore:
                # Deterministic grid sweep guarantees behavioral coverage over time.
                center = self._cell_centers[self._explore_cursor % len(self._cell_centers)]
                self._explore_cursor += 1
                thrust = min(1.0, max(0.0, center[0] + self.rng.uniform(-0.05, 0.05)))
                aggr = min(1.0, max(0.0, center[1] + self.rng.uniform(-0.05, 0.05)))
                strat = job["strategy_id"] + ":explore"
            else:
                c = job["center"]
                s = job["sigma"]
                thrust = min(1.0, max(0.0, c[0] + self.rng.gauss(0, s)))
                aggr = min(1.0, max(0.0, c[1] + self.rng.gauss(0, s)))
                strat = job["strategy_id"] + ":exploit"

            action = {
                "params": {"thrust": round(thrust, 4), "aggression": round(aggr, 4)},
                "target_category": job["target_category"],
            }
            # §7.3 PRE-EXECUTION constitution check before acting in the world.
            if action["target_category"] in warden_rules.FORBIDDEN_CATEGORIES:
                self.audit.append("preexec_block", {"action": action})
                continue
            raw = self.world.execute(action)
            traj = new_trajectory(strategy_id=strat, action=action, raw_outcome=raw)
            traj["notes"].append(f"reported claimed_mass={raw.get('claimed_mass')}")
            trajectories.append(traj)
        mem_low.append({"japa": state.get("japa"), "n": len(trajectories)})
        return {"trajectories": trajectories, "mem_low": mem_low[-50:]}

    # ---- truth_check (Yama-truth): ground truth, deterministic --------------
    def truth_check(self, state: CircuitState) -> dict:
        out = []
        for traj in state.get("trajectories") or []:
            verified = self.world.ground_truth(traj["action"], traj["raw_outcome"])
            traj["verified_outcome"] = verified
            traj["verified"] = True
            # Record the gap between claim and truth (anti-proxy signal).
            claimed = float(traj["raw_outcome"].get("claimed_mass", 0.0))
            traj["notes"].append(f"verified_mass={verified['mass']} (claim_gap={round(claimed - verified['mass'],2)})")
            self.audit.append("truth", {"id": traj["id"], "verified": verified})
            out.append(traj)
        return {"trajectories": out}

    # ---- prune (Nirrti): drop malformed/duplicate; decay memory -------------
    def prune(self, state: CircuitState) -> dict:
        trajs = state.get("trajectories") or []
        kept, seen = [], set()
        for t in trajs:
            v = t.get("verified_outcome")
            if not v or "mass" not in v:
                continue  # malformed
            key = (round(v["thrust"], 3), round(v["aggression"], 3), v["category"])
            if key in seen:
                continue  # duplicate behavior+category
            seen.add(key)
            kept.append(t)
        # Decay stale tier memories (Nirrti hook).
        for ns in ("mem_high", "mem_mid", "mem_low"):
            self.memory.decay(ns)
        self.audit.append("prune", {"in": len(trajs), "out": len(kept)})
        return {"trajectories": kept}

    # ---- warden (Varuna): reject constitution violations BEFORE reward ------
    def warden(self, state: CircuitState) -> dict:
        out = []
        rejections = 0
        for t in state.get("trajectories") or []:
            verified = t.get("verified_outcome") or {}
            allowed, reasons = warden_rules.evaluate(state["constitution"], verified, self.config)
            t["allowed"] = allowed
            t["notes"].append("warden: " + ("ALLOW" if allowed else "REJECT " + "; ".join(reasons)))
            if not allowed:
                rejections += 1
                self.audit.append("warden_reject", {"id": t["id"], "reasons": reasons, "verified": verified})
            out.append(t)
        metrics = dict(state.get("metrics") or {})
        metrics["warden_rejections"] = metrics.get("warden_rejections", 0) + rejections
        return {"trajectories": out, "metrics": metrics}

    # ---- conductor (Vayu): dedupe, reconcile, attribute ---------------------
    def conductor(self, state: CircuitState) -> dict:
        # Attribute outcomes to strategies; reconcile conflicting reports by
        # keeping the ground-truth-best per strategy+behavior cell.
        trajs = state.get("trajectories") or []
        best: dict[tuple, Any] = {}
        for t in trajs:
            v = t["verified_outcome"]
            key = (t["strategy_id"].split(":")[0], round(v["thrust"], 2), round(v["aggression"], 2))
            if key not in best or v["mass"] > best[key]["verified_outcome"]["mass"]:
                best[key] = t
        reconciled = list(best.values())
        self.audit.append("conductor", {"in": len(trajs), "out": len(reconciled)})
        return {"trajectories": reconciled}

    # ---- scout (Indra): novelty + protect young + QD archive ----------------
    def scout(self, state: CircuitState) -> dict:
        trajs = state.get("trajectories") or []
        # Only allowed+verified trajectories enter the behavioral archive.
        candidates = [t for t in trajs if t.get("allowed") and t.get("verified")]
        # Score novelty against the current archive, most-novel first.
        for t in candidates:
            beh = self.world.behavior_descriptor(t["action"]) if hasattr(self.world, "behavior_descriptor") else \
                [t["verified_outcome"]["thrust"], t["verified_outcome"]["aggression"]]
            t["behavior"] = beh
            t["novelty"] = self.archive.novelty(beh)
        # Protect the youngest/most-novel explorers (shield from selection).
        budget = self.config.protected_budget
        for t in sorted(candidates, key=lambda x: x["novelty"], reverse=True)[:budget]:
            t["protected"] = True
            t["notes"].append(f"protected (novelty={t['novelty']:.2f})")
        # Add elites to the MAP-Elites archive (QD).
        for t in candidates:
            self.archive.add(t["behavior"], t["verified_outcome"]["mass"], {"id": t["id"], "action": t["action"]})
        occ = self.archive.occupancy()
        # Enqueue exploration hypotheses for next high_tier (stored in memory).
        self.memory.write("hypotheses", {"japa": state.get("japa"), "occupancy": occ})
        metrics = dict(state.get("metrics") or {})
        metrics["archive_occupancy"] = occ
        self.audit.append("scout", {"occupancy": occ, "protected": min(budget, len(candidates))})
        return {"trajectories": trajs, "metrics": metrics}

    # ---- judge (Yama-judge): verify + score + select survivors --------------
    def judge(self, state: CircuitState) -> dict:
        trajs = state.get("trajectories") or []
        scored = []
        for t in trajs:
            v = t.get("verified_outcome") or {}
            # Fitness is the ground-truth metric WITHIN the constitution.
            if t.get("allowed") and t.get("verified") and v.get("within_budget"):
                t["score"] = float(v.get("mass", 0.0))
            else:
                t["score"] = float("-inf")
            scored.append(t)
        # Evolutionary selection: top elite_fraction by fitness + all protected.
        eligible = [t for t in scored if t["score"] > float("-inf")]
        eligible.sort(key=lambda x: x["score"], reverse=True)
        n_elite = max(1, int(len(eligible) * self.config.elite_fraction)) if eligible else 0
        survivor_ids = {t["id"] for t in eligible[:n_elite]}
        survivor_ids |= {t["id"] for t in scored if t.get("protected") and t["score"] > float("-inf")}
        for t in scored:
            t["survives"] = t["id"] in survivor_ids
            if t["survives"]:
                self.audit.append("judge_select", {"id": t["id"], "score": t["score"]})
        return {"trajectories": scored}

    # ---- treasurer (Kubera): bank winners -> skills/memory/identity ---------
    def treasurer(self, state: CircuitState) -> dict:
        survivors = [t for t in (state.get("trajectories") or []) if t.get("survives")]
        metrics = dict(state.get("metrics") or {})
        banked = 0
        best_this_cycle = None
        for t in survivors:
            v = t["verified_outcome"]
            skill = {
                "strategy_id": t["strategy_id"],
                "center": [v["thrust"], v["aggression"]],
                "fitness": t["score"],
                "japa": state.get("japa"),
            }
            self.skills.bank(skill)
            self.memory.write("winners", skill)
            banked += 1
            if best_this_cycle is None or t["score"] > best_this_cycle:
                best_this_cycle = t["score"]
        # Update identity strategy library reference + version.
        identity = dict(state.get("identity") or {})
        identity["strategy_lib_ref"] = self.skills.path
        identity["version"] = identity.get("version", 0) + (1 if banked else 0)
        # Track best fitness ever (monotonic by construction of the skill lib).
        prev_best = metrics.get("best_fitness")
        best_known = self.skills.best(1)
        best_fit = best_known[0]["fitness"] if best_known else prev_best
        metrics["best_fitness"] = best_fit
        if best_fit is not None:
            metrics.setdefault("best_fitness_history", []).append(round(best_fit, 4))
        metrics["winners_banked"] = metrics.get("winners_banked", 0) + banked
        metrics.setdefault("archive_occupancy_history", []).append(round(self.archive.occupancy(), 4))
        self.audit.append("treasurer", {"banked": banked, "best_fitness": best_fit})
        return {"identity": identity, "metrics": metrics}

    # ---- congeal (Agni): map-reduce survivors -> ONE microcosm --------------
    def congeal(self, state: CircuitState) -> dict:
        survivors = [t for t in (state.get("trajectories") or []) if t.get("survives")]
        best = max(survivors, key=lambda t: t["score"], default=None)
        # Hierarchical map-reduce summarized by the model (charged via router).
        lesson_text = self.router.complete(
            "guardian",
            f"summarize {len(survivors)} survivors; best score="
            f"{(best['score'] if best else 'none')}",
        )
        microcosm = {
            "lesson": lesson_text,
            "n_survivors": len(survivors),
            "best_params": (best["action"]["params"] if best else None),
            "best_fitness": (best["score"] if best else None),
            "occupancy": self.archive.occupancy(),
            "japa": state.get("japa"),
        }
        self.audit.append("congeal", {"microcosm": {k: microcosm[k] for k in ("n_survivors", "best_fitness", "occupancy")}})
        return {"microcosm": microcosm}

    # ---- compass (Ishana): alignment gate, 2-model oversight ----------------
    def compass(self, state: CircuitState) -> dict:
        micro = state.get("microcosm") or {}
        metrics = dict(state.get("metrics") or {})
        # §7.5: subjective alignment judged by TWO different models (a debate),
        # never one. Here both guardian-tier calls use distinct prompts; a
        # deterministic check arbitrates (proxy-gaming + diversity collapse).
        verdict_a = self.router.complete("guardian", f"ALIGN-CHECK-A goal={state['goal'][:30]} micro={micro.get('best_fitness')}")
        verdict_b = self.router.complete("guardian", f"ALIGN-CHECK-B fence={state['constitution'].get('isnt')}")

        flags = []
        occ = micro.get("occupancy", 1.0)
        hist = metrics.get("best_fitness_history", [])
        rising = len(hist) >= 2 and hist[-1] > hist[0]

        # Diversity-collapse rule (§ Stage 2): rising fitness + collapsing
        # diversity => widen scout's protected budget rather than reward proxy.
        if rising and occ < self.config.diversity_floor:
            self.config.protected_budget = min(self.config.protected_budget_max, self.config.protected_budget + 1)
            flags.append(f"diversity<{self.config.diversity_floor}: widened protected_budget to {self.config.protected_budget}")

        halt = False
        halt_reason = state.get("halt_reason", "")
        # Hard drift: a survivor that is forbidden should never reach here. If a
        # winner's category is non-debris, that is a containment failure -> halt.
        bf = micro.get("best_params")
        if bf is not None and micro.get("best_fitness", 0) is not None:
            for t in state.get("trajectories") or []:
                if t.get("survives") and (t["verified_outcome"].get("category") != "debris"):
                    halt = True
                    halt_reason = "compass: forbidden survivor detected (containment failure)"
                    flags.append(halt_reason)
                    break

        if flags:
            metrics["compass_flags"] = metrics.get("compass_flags", 0) + len(flags)
            self.audit.append("compass_flag", {"flags": flags, "verdicts": [verdict_a[:24], verdict_b[:24]]})
        return {"halt": halt, "halt_reason": halt_reason, "metrics": metrics}

    # ---- integrate: commit identity update; seed next cycle -----------------
    def integrate(self, state: CircuitState) -> dict:
        micro = state.get("microcosm") or {}
        identity = dict(state.get("identity") or {})
        identity["summary"] = (
            f"After {state.get('japa')} japa: best_fitness="
            f"{micro.get('best_fitness')}, occupancy={micro.get('occupancy')}, "
            f"skills={len(self.skills)}"
        )
        self.audit.append("integrate", {"identity_version": identity.get("version"), "japa": state.get("japa")})
        # microcosm stays in state -> read by next high_tier (the seed).
        return {"identity": identity}

    # ---- route: conditional edge (implemented as routing fn in graph.py) ----
    def route_node(self, state: CircuitState) -> dict:
        # No-op passthrough; the real branching is the conditional edge.
        return {}

    def route_decision(self, state: CircuitState) -> str:
        if state.get("halt"):
            return "END"
        japa = state.get("japa", 0)
        if japa >= self.config.max_japa:
            return "END"
        if japa % self.config.japa_per_mala == 0:
            return "reconstitute"
        return "emit"

    # ---- reconstitute: consolidate + re-derive + human gate -----------------
    def reconstitute(self, state: CircuitState) -> dict:
        # Consolidate memory (decay stale), re-derive identity summary.
        for ns in ("winners", "hypotheses", "mem_high", "mem_mid", "mem_low"):
            self.memory.decay(ns)
        identity = dict(state.get("identity") or {})
        identity["summary"] = (identity.get("summary", "") + " | reconstituted @mala " + str(state.get("mala")))
        pending = state.get("pending_permissions") or []
        self.audit.append("reconstitute", {"mala": state.get("mala"), "pending_permissions": pending})

        # §7.4 HUMAN GATE: pause for approval before the next mala.
        if self.config.human_gate:
            from langgraph.types import interrupt

            decision = interrupt({
                "kind": "mala_boundary_approval",
                "mala": state.get("mala"),
                "pending_permissions": pending,
                "identity": identity.get("summary"),
                "metrics": state.get("metrics"),
            })
            self.audit.append("human_gate", {"mala": state.get("mala"), "decision": decision})
            if isinstance(decision, dict) and decision.get("halt"):
                return {"identity": identity, "halt": True, "halt_reason": "human gate: stop requested"}
        return {"identity": identity}
