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
