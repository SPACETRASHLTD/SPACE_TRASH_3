"""Provider-agnostic real ModelRouter (§2, §7.8 — the "one real variable").

``LLMRouter`` is the router you point at a real model. It hardcodes **no
provider**: you inject a ``client`` — any callable ``(model_id, prompt, **kwargs)
-> str``. Tier→model mapping comes from ``CircuitConfig.model_ids``; every call is
metered against the same spend cap as the mock.

This module imports no provider SDK at import time. ``anthropic_client`` is an
*example* factory that lazily imports ``anthropic`` only when you call it, so the
rest of the harness keeps running with zero extra dependencies.

A live run is gated on two things this sandbox does not provide:
  1. an API key, and
  2. a network policy that allows the provider endpoint.
Until both exist, build and prove the path offline (see AdversarialModel + tests);
the day they exist, swap ``ModelRouterImpl`` for ``LLMRouter`` — one line — and the
guardians meet a genuinely unpredictable actor. The world stays the deterministic
sandbox; only the model becomes real.
"""

from __future__ import annotations

from typing import Any, Callable

from .config import CircuitConfig
from .interfaces import Tier
from .spend import SpendTracker

Client = Callable[..., str]  # (model_id: str, prompt: str, **kwargs) -> str


class LLMRouter:
    def __init__(self, config: CircuitConfig, spend: SpendTracker, client: Client):
        self.config = config
        self.spend = spend
        self._client = client

    def model_for(self, tier: Tier) -> str:
        return self.config.model_ids[tier]

    def complete(self, tier: Tier, prompt: str, **kwargs: Any) -> str:
        # §7.2: charge BEFORE the call; the breach stops us crossing the cap.
        price = self.config.model_price_usd.get(tier, 0.001)
        self.spend.charge(price, kind=f"model:{tier}")
        model_id = self.model_for(tier)
        return self._client(model_id, prompt, **kwargs)


_DEFAULT_SYSTEM = "You are a worker agent in a sandbox. Follow the constraints exactly."


def http_anthropic_client(
    api_key: str | None = None,
    max_tokens: int = 256,
    system: str | None = None,
    timeout: float = 30.0,
) -> Client:
    """Dependency-free Anthropic client using only the stdlib (``urllib``).

    Mirrors the raw Messages API call (the same one ``curl`` makes), so no SDK
    install is required. The key is read from the ``api_key`` argument or the
    ``ANTHROPIC_API_KEY`` environment variable — never hardcoded.
    """

    def _client(model_id: str, prompt: str, **kwargs: Any) -> str:
        import json
        import os
        import urllib.request

        key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY not set (live run requires a key)")
        body = json.dumps({
            "model": model_id,
            "max_tokens": kwargs.get("max_tokens", max_tokens),
            "system": system or _DEFAULT_SYSTEM,
            "messages": [{"role": "user", "content": prompt}],
        }).encode()
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=body,
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read())
        return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")

    return _client


def anthropic_client(api_key: str | None = None, max_tokens: int = 256, system: str | None = None) -> Client:
    """Example provider wiring. Lazily imports the ``anthropic`` SDK.

    Usage (when a key + egress exist):

        from kubera.llm_router import LLMRouter, anthropic_client
        router = LLMRouter(config, spend, anthropic_client())
        circuit = Circuit(config=config, router=router, policy=ModelPolicy())

    Set ``CircuitConfig.model_ids`` to real model names, e.g.
    ``{"high": "claude-opus-4-8", "mid": "claude-sonnet-4-6", "low": "claude-haiku-4-5", ...}``.
    """

    def _client(model_id: str, prompt: str, **kwargs: Any) -> str:
        import os

        import anthropic  # imported lazily; not a hard dependency of the harness

        client = anthropic.Anthropic(api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"))
        msg = client.messages.create(
            model=model_id,
            max_tokens=kwargs.get("max_tokens", max_tokens),
            system=system or "You are a worker agent. Follow the constraints exactly.",
            messages=[{"role": "user", "content": prompt}],
        )
        # Concatenate text blocks from the response.
        return "".join(getattr(b, "text", "") for b in msg.content)

    return _client
