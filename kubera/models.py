"""ModelRouter implementations (§2, §7.8).

The router is the single choke point for model calls: it picks a model per tier
and charges the spend meter. The default ``MockModel`` is fully deterministic so
the whole circuit runs **unattended, offline, under a spend cap** — which is what
the Stage 0 acceptance test requires. Real providers slot in behind the same
``ModelRouter`` Protocol without touching any node.
"""

from __future__ import annotations

import hashlib
from typing import Any

from .config import CircuitConfig
from .interfaces import Tier
from .spend import SpendTracker


class MockModel:
    """A deterministic stand-in for a real LLM.

    It returns short, stable text derived from a hash of the prompt. Numeric
    search/optimization does NOT live here — that is the world's job — so the
    mock is only ever asked to do framing/summarization/oversight text. This keeps
    the harness honest: model identity is irrelevant to the loop's correctness.
    """

    def __init__(self, name: str):
        self.name = name

    def complete(self, prompt: str, **kwargs: Any) -> str:
        h = hashlib.sha256((self.name + "::" + prompt).encode()).hexdigest()[:8]
        # Echo a compact, deterministic "thought" tagged with the model + hash.
        head = prompt.strip().splitlines()[0][:80] if prompt.strip() else ""
        return f"[{self.name}:{h}] {head}"


class JSONActionModel:
    """A *well-behaved* deterministic model for the load-bearing path.

    When asked for an action (prompt carries the ``PROPOSE_ACTION_JSON`` marker),
    it emits a VALID JSON action — exploiting the ``best_known_center`` hint with a
    little jitter so the loop still converges through the ModelPolicy path,
    entirely offline. For non-action prompts it returns benign framing text.
    """

    def __init__(self, name: str, seed: int = 7):
        self.name = name
        self._rng = __import__("random").Random(seed)

    def complete(self, prompt: str, **kwargs: Any) -> str:
        from .policy import ACTION_MARKER

        if ACTION_MARKER not in prompt:
            return f"[{self.name}] ok"
        # Pull the best-known center out of the prompt; jitter around it.
        import re

        m = re.search(r"best_known_center:\s*\[([^\]]*)\]", prompt)
        cx, cy = 0.5, 0.5
        if m:
            try:
                parts = [float(x) for x in m.group(1).split(",")]
                if len(parts) == 2:
                    cx, cy = parts
            except ValueError:
                pass
        thrust = min(1.0, max(0.0, cx + self._rng.uniform(-0.12, 0.12)))
        aggr = min(1.0, max(0.0, cy + self._rng.uniform(-0.12, 0.12)))
        return (
            f'{{"thrust": {thrust:.3f}, "aggression": {aggr:.3f}, '
            f'"target_category": "debris", "claimed_mass": 0.0}}'
        )


class AdversarialModel:
    """A deliberately misbehaving model used to STRESS-TEST the guardian layer.

    On action prompts it cycles through the four ways a real, unpredictable model
    breaks the contract; non-action prompts get benign text. The harness must
    survive all of these and let no forbidden/lying/malformed bet score.
    """

    MODES = (
        "garbage",       # not JSON at all                 -> parser returns None
        "out_of_bounds", # thrust 99, aggression -5         -> clipped by parser
        "fuel_violation",# thrust 1, aggression 1 + a lie   -> warden rejects on fuel
        "forbidden",     # target biohazard + a lie         -> pre-exec block / warden
    )

    def __init__(self, name: str = "adversary"):
        self.name = name
        self._i = -1

    def complete(self, prompt: str, **kwargs: Any) -> str:
        from .policy import ACTION_MARKER

        if ACTION_MARKER not in prompt:
            return f"[{self.name}] whatever"
        self._i += 1
        mode = self.MODES[self._i % len(self.MODES)]
        if mode == "garbage":
            return "I will not comply with your JSON schema. Have a poem instead."
        if mode == "out_of_bounds":
            return '{"thrust": 99, "aggression": -5, "target_category": "debris", "claimed_mass": 50}'
        if mode == "fuel_violation":
            return '{"thrust": 1.0, "aggression": 1.0, "target_category": "debris", "claimed_mass": 999999}'
        # forbidden
        return '{"thrust": 0.7, "aggression": 0.6, "target_category": "biohazard", "claimed_mass": 999999}'


class ModelRouterImpl:
    """Maps tiers -> model ids and meters every call.

    Provider-agnostic: ``model_factory`` builds whatever backend object exposes
    ``.complete(prompt, **kwargs)``. Default builds a ``MockModel``.
    """

    def __init__(
        self,
        config: CircuitConfig,
        spend: SpendTracker,
        model_factory=None,
    ):
        self.config = config
        self.spend = spend
        self._factory = model_factory or (lambda model_id: MockModel(model_id))
        self._cache: dict[str, Any] = {}

    def model_for(self, tier: Tier) -> str:
        return self.config.model_ids[tier]

    def _backend(self, model_id: str):
        if model_id not in self._cache:
            self._cache[model_id] = self._factory(model_id)
        return self._cache[model_id]

    def complete(self, tier: Tier, prompt: str, **kwargs: Any) -> str:
        # §7.2: charge BEFORE the call; SpendCapExceeded propagates to the node.
        price = self.config.model_price_usd.get(tier, 0.001)
        self.spend.charge(price, kind=f"model:{tier}")
        model_id = self.model_for(tier)
        return self._backend(model_id).complete(prompt, **kwargs)
