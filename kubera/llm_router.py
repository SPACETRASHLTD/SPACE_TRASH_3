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

# A client returns either plain text, or (text, {"input": int, "output": int}).
# The usage form lets the router bill ACTUAL token cost; the plain form falls
# back to the (conservative) reservation estimate.
Client = Callable[..., Any]

# Conservative byte/char -> token ratio for the pre-call upper-bound estimate.
# ~3 chars/token over-estimates real tokenization for ASCII prompts, so the
# reserved cost is an upper bound on the actual cost (the cap is never crossed).
_CHARS_PER_TOKEN = 3
_SYSTEM_OVERHEAD_TOKENS = 24


def estimate_input_tokens(prompt: str, system: str = "") -> int:
    return max(1, (len(prompt) + len(system or "")) // _CHARS_PER_TOKEN + _SYSTEM_OVERHEAD_TOKENS)


def cost_usd(input_tokens: int, output_tokens: int, prices: dict) -> float:
    return input_tokens / 1_000_000 * prices["input"] + output_tokens / 1_000_000 * prices["output"]


class LLMRouter:
    def __init__(self, config: CircuitConfig, spend: SpendTracker, client: Client):
        self.config = config
        self.spend = spend
        self._client = client

    def model_for(self, tier: Tier) -> str:
        return self.config.model_ids[tier]

    def _prices(self, model_id: str) -> dict:
        return self.config.model_token_prices.get(model_id, self.config.default_token_price)

    def complete(self, tier: Tier, prompt: str, **kwargs: Any) -> str:
        model_id = self.model_for(tier)
        prices = self._prices(model_id)
        max_out = int(kwargs.get("max_tokens", self.config.default_max_tokens))

        # §7.2 RESERVE: bound the worst-case cost (upper-bound input estimate +
        # full max_tokens output) and refuse BEFORE the call if it would breach.
        reserved = cost_usd(estimate_input_tokens(prompt), max_out, prices)
        self.spend.check(reserved, kind=f"model:{tier}")

        result = self._client(model_id, prompt, **kwargs)

        # SETTLE: bill the actual token cost when the client reports usage;
        # otherwise bill the (conservative) reservation so we never under-charge.
        if isinstance(result, tuple) and len(result) == 2:
            text, usage = result
            actual = cost_usd(int(usage.get("input", 0)), int(usage.get("output", 0)), prices)
        else:
            text, actual = result, reserved
        self.spend.commit(actual, kind=f"model:{tier}")
        return text


_DEFAULT_SYSTEM = "You are a worker agent in a sandbox. Follow the constraints exactly."


def http_anthropic_client(
    api_key: str | None = None,
    max_tokens: int = 256,
    system: str | None = None,
    timeout: float = 30.0,
    retries: int = 3,
) -> Client:
    """Dependency-free Anthropic client using only the stdlib (``urllib``).

    Mirrors the raw Messages API call (the same one ``curl`` makes), so no SDK
    install is required. The key is read from the ``api_key`` argument or the
    ``ANTHROPIC_API_KEY`` environment variable — never hardcoded. Retries
    transient failures (429 / 5xx / network) with exponential backoff so a
    sustained multi-call run survives a momentary rate limit.
    """

    def _client(model_id: str, prompt: str, **kwargs: Any) -> str:
        import json
        import os
        import time
        import urllib.error
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
        last_exc = None
        for attempt in range(retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    data = json.loads(resp.read())
                break
            except urllib.error.HTTPError as exc:
                last_exc = exc
                if exc.code not in (408, 429, 500, 502, 503, 529) or attempt == retries:
                    raise
            except (urllib.error.URLError, TimeoutError) as exc:
                last_exc = exc
                if attempt == retries:
                    raise
            time.sleep(2 ** attempt)  # 1s, 2s, 4s backoff
        else:  # pragma: no cover - loop always breaks or raises
            raise last_exc
        text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
        usage = data.get("usage", {}) or {}
        return text, {"input": usage.get("input_tokens", 0), "output": usage.get("output_tokens", 0)}

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
        text = "".join(getattr(b, "text", "") for b in msg.content)
        usage = getattr(msg, "usage", None)
        return text, {
            "input": getattr(usage, "input_tokens", 0) if usage else 0,
            "output": getattr(usage, "output_tokens", 0) if usage else 0,
        }

    return _client
