# The Kubera Circuit

A **self-improving, value-bounded multi-agent control loop** — a *harness*.

A fixed objective drives a 3-tier agent hierarchy whose outputs pass through an
8-stage, dependency-ordered **integrity pipeline**, producing one distilled
state-update that seeds the next iteration. It runs in cycles and improves across
cycles. Implemented as a [LangGraph](https://github.com/langchain-ai/langgraph)
`StateGraph` with a loop-back edge.

> All the mythic names (Bindu, Yama, Kubera, …) are **aliases for engineering
> functions**. The engineering meaning leads everywhere; the alias is a label.

The default world is themed to this repo — **Space Trash Ltd**: maximize the mass
of inert orbital debris salvaged per mission, within a fuel budget, never
collecting protected or biohazardous waste.

---

## Quick start

```bash
pip install -r requirements.txt          # langgraph; no model-provider SDK needed
python -m kubera.run --japa 9            # Stage 0: one mala, unattended, sandbox
python -m kubera.run --japa 81 --high 8 --mid 16 --low 32 --cap 100   # Stage 2 scale
pytest -q                                 # acceptance + guardrail suite
```

The default `ModelRouter` is a **deterministic mock**, so the entire circuit runs
**offline, unattended, under a spend cap** with no API keys. Swap in a real
provider behind the `ModelRouter` Protocol without touching any node.

---

## Architecture

```
START
  → emit          Bindu       frame the fixed goal through fence + identity
  → high_tier     8/Buddhi    research + set strategy            (router: strong)
  → mid_tier      16          strategy → concrete jobs           (router: mid)
  → low_tier      32          execute in the SANDBOX world       (router: cheap)
  ── integrity pipeline (dependency-ordered) ───────────────────────────────
  → truth_check   Yama-truth  ground-truth verification (deterministic)
  → prune         Nirrti      drop malformed/duplicate; decay memory
  → warden        Varuna      reject constitution violations (BEFORE reward)
  → conductor     Vayu        dedupe, reconcile, attribute
  → scout         Indra       novelty + protect young + MAP-Elites archive
  → judge         Yama-judge  fitness within the fence; select survivors
  → treasurer     Kubera      bank winners → skill lib + memory + identity
  → congeal       Agni        map-reduce survivors → ONE microcosm
  → compass       Ishana      alignment gate (2-model); may halt
  → integrate     —           commit identity; seed next cycle
  → route         —           halt→END | japa%9==0→reconstitute | else→emit
        reconstitute  —       consolidate + re-derive + HUMAN GATE (interrupt)
```

**Iteration units (§6):** `japa` = 1 graph pass · `mala` = 9 japa · `maha mala` =
108 mala. Between malas, `reconstitute` consolidates memory and (optionally) opens
a human-approval interrupt.

### Module map

| File | Role |
|------|------|
| `kubera/state.py` | `CircuitState` / `Trajectory` graph state (§3) |
| `kubera/config.py` | `CircuitConfig` — every open parameter (§10) |
| `kubera/interfaces.py` | `WorldAdapter`, `ModelRouter`, `ToolRegistry`, `MemoryStore` Protocols (§9) |
| `kubera/circuit.py` | all node bodies, bound to shared dependencies (§5) |
| `kubera/graph.py` | LangGraph `StateGraph` assembly + loop-back edge (§4) |
| `kubera/world.py` | `SandboxWorld` (default) + `RealWorldStub` (refuses until graduated) |
| `kubera/models.py` | `ModelRouterImpl` + deterministic `MockModel` |
| `kubera/spend.py` | hard spend cap meter |
| `kubera/warden_rules.py` | machine-checkable constitution predicates |
| `kubera/archive.py` | MAP-Elites quality-diversity archive |
| `kubera/skills.py` | compounding skill library |
| `kubera/memory.py` | JSON memory store with decay (Nirrti hook) |
| `kubera/audit.py` | append-only JSONL ledger (Ananta) |
| `kubera/amend.py` | dual-key constitution amendment (§7.7) |
| `kubera/run.py` | runner / CLI |

---

## Guardrails (§7 — implemented first, never stripped)

1. **Sandbox only.** `SandboxWorld` is the default; `Circuit` *refuses to start*
   with a non-sandbox world. Real worlds require explicit human graduation.
2. **Spend cap.** Every model/tool call is metered; a breach sets `halt=True` and
   the graph exits cleanly via `route`.
3. **Constitution-before-reward.** `warden` runs before `judge`; a
   profitable-but-forbidden trajectory is rejected at `warden`. `low_tier` also
   pre-checks before acting.
4. **Human gate.** Capability requests surface at `reconstitute`, which raises a
   LangGraph `interrupt` (enable with `--human-gate`).
5. **Ground-truth-first.** `truth_check` recomputes outcomes deterministically and
   ignores the worker's self-report; `compass` uses two model calls, never one.
6. **Append-only audit.** Every verdict is an immutable JSONL record.
7. **Dual-key constitution edits.** `amend_constitution` needs *both* a human token
   *and* a compass drift sign-off; no graph node can edit the fence.
8. **Model-agnostic.** All model calls go through `ModelRouter`; no provider is
   hardcoded.

---

## Build milestones (§8) — all gated by tests

| Stage | What | Acceptance test |
|-------|------|-----------------|
| 0 Skeleton | loop runs in sandbox under spend cap | `tests/test_stage0.py` |
| 1 Integrity pipeline | all 8 guardians, forbidden-but-profitable rejected | `tests/test_stage1.py` |
| 2 Tiers + evolution | 8/16/32, MAP-Elites, evolutionary selection, compounding | `tests/test_stage2.py` |
| 3 Harden | compass oversight, dual-key, audit, human gate | `tests/test_guardrails.py` |

```
$ pytest -q
19 passed
```

A representative `--japa 81 --high 8 --mid 16 --low 32` run drives best fitness to
~100 (the hidden optimum) while archive occupancy reaches 100% — fitness rises
*and* diversity stays well above the 60% floor.

---

## Making the model load-bearing (isolating the one real variable)

The default `ModelRouter` is decorative: action proposals come from a
deterministic in-code search (`SearchPolicy`), so the guardians judge a
well-behaved actor. To actually test whether the guardian layer holds when the
thing it judges is **genuinely unpredictable**, swap in `ModelPolicy` — then the
*model produces the actions* (params, target category, self-reported outcome),
while the world stays the deterministic sandbox. Only the actor becomes real.

```bash
python -m kubera.run --japa 27 --low 16 --policy model              # well-behaved JSON model, offline
python -m kubera.run --japa 9  --low 8  --policy model --adversarial # stress the guardians
```

The risky surface is the **parser**, not the model. `kubera/policy.py :: parse_action`
is the fail-safe boundary: garbage → dropped, out-of-bounds → clipped, missing
fields → dropped, lies → recorded then overridden by `truth_check`. An adversarial
model (`kubera/models.py :: AdversarialModel`) cycles through every way a real
model breaks the contract; `tests/test_model_policy.py` proves, deterministically
and offline, that:

- malformed output is dropped, never crashes the loop;
- out-of-bounds params never reach the world unclipped;
- a lying self-report is overridden by ground truth and scored on the truth;
- a fuel-over-budget bet is rejected at `warden` (before any reward);
- a forbidden category is blocked pre-execution;
- a full mala under the adversarial model completes with **no forbidden/lying/
  malformed bet ever banked**.

> Observation the isolation test surfaces: under `ModelPolicy`, archive diversity
> depends entirely on the actor (the grid-sweep that guaranteed coverage lives in
> `SearchPolicy`). That is correct behavior — exploration is now the model's job,
> shaped by `scout`'s protected budget — not a leak.

### Going live (a real provider)

`kubera/llm_router.py :: LLMRouter` is provider-agnostic: inject any
`client(model_id, prompt, **kwargs) -> str`. No provider SDK is imported at module
load; `anthropic_client` is an example factory that imports `anthropic` lazily.

```python
from kubera.llm_router import LLMRouter, anthropic_client
from kubera.policy import ModelPolicy
router = LLMRouter(config, spend, anthropic_client())   # needs ANTHROPIC_API_KEY + egress
circuit = Circuit(config=config, router=router, spend=spend, policy=ModelPolicy())
```

A live run is gated on (1) an API key and (2) a network policy that allows the
endpoint. Build and prove the path offline first (the adversarial suite); the live
swap is one line. The next graduation after that — MCP tools and a real world — is
exactly what the human gate and the sandbox-graduation rule (§7.1, §7.4) exist for.

---

## Swapping in real backends

Everything behind `kubera/interfaces.py` is pluggable:

- **Models:** pass a `model_factory` to `ModelRouterImpl` that builds a real
  client exposing `.complete(prompt, **kwargs)`. Tier→model mapping lives in
  `CircuitConfig.model_ids`.
- **World:** implement `WorldAdapter`. Non-sandbox worlds must set `sandbox=False`
  and be explicitly graduated by a human — `Circuit` will otherwise refuse.
- **Memory / Tools:** implement `MemoryStore` / `ToolRegistry` (e.g. Mem0/Zep,
  MCP servers, Firecrawl). Tool permissions gate capability access.

> This is sandbox-only software. No real capital, no live trading or financial
> APIs are wired up, by design.
