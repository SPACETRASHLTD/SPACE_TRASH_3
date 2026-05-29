"""Provider-agnostic LLMRouter — tested against a fake transport.

No provider SDK and no network are required: a fake ``client`` callable stands in
for any real backend. This proves the wiring (tier->model mapping, spend metering,
cap enforcement) without a key.
"""

import pytest

from kubera.config import CircuitConfig
from kubera.llm_router import LLMRouter
from kubera.spend import SpendCapExceeded, SpendTracker


def test_llm_router_maps_tiers_and_meters_spend():
    config = CircuitConfig()
    spend = SpendTracker(cap_usd=10.0)
    calls = []

    def fake_client(model_id, prompt, **kwargs):
        calls.append((model_id, prompt))
        return f"resp from {model_id}"

    router = LLMRouter(config, spend, fake_client)

    assert router.complete("low", "hi").endswith(config.model_ids["low"])
    assert router.complete("high", "yo").endswith(config.model_ids["high"])
    # client received the configured per-tier model ids (no provider hardcoded)
    assert calls[0][0] == config.model_ids["low"]
    assert calls[1][0] == config.model_ids["high"]
    # spend was metered for each call
    assert spend.calls == 2
    assert spend.spend_usd == pytest.approx(
        config.model_price_usd["low"] + config.model_price_usd["high"]
    )


def test_llm_router_enforces_spend_cap():
    config = CircuitConfig()
    spend = SpendTracker(cap_usd=config.model_price_usd["low"] * 1.5)  # room for one low call
    router = LLMRouter(config, spend, lambda m, p, **k: "ok")
    router.complete("low", "first")
    with pytest.raises(SpendCapExceeded):
        router.complete("low", "second")  # second would breach the cap


def test_anthropic_client_is_lazy_and_optional():
    # Importing the example wiring must not require the anthropic SDK.
    from kubera.llm_router import anthropic_client

    client = anthropic_client(api_key="not-used-here")
    assert callable(client)  # building the factory does not import/contact anything
