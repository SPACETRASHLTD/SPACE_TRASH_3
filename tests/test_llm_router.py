"""Provider-agnostic LLMRouter — tested against a fake transport.

No provider SDK and no network are required: a fake ``client`` callable stands in
for any real backend. This proves the wiring (tier->model mapping, spend metering,
cap enforcement) without a key.
"""

import pytest

from kubera.config import CircuitConfig
from kubera.llm_router import LLMRouter, cost_usd, estimate_input_tokens
from kubera.spend import SpendCapExceeded, SpendTracker


def test_llm_router_bills_actual_token_cost():
    config = CircuitConfig()
    spend = SpendTracker(cap_usd=10.0)
    calls = []

    def fake_client(model_id, prompt, **kwargs):
        calls.append((model_id, prompt))
        return f"resp from {model_id}", {"input": 100, "output": 50}

    router = LLMRouter(config, spend, fake_client)
    router.complete("low", "hi")
    router.complete("high", "yo")

    # client received the configured per-tier model ids (no provider hardcoded)
    assert calls[0][0] == config.model_ids["low"]
    assert calls[1][0] == config.model_ids["high"]
    assert spend.calls == 2
    # spend is the ACTUAL token cost, not a flat per-call price
    prices = config.default_token_price  # mock tier ids aren't in the price table
    expected = 2 * cost_usd(100, 50, prices)
    assert spend.spend_usd == pytest.approx(expected)


def test_llm_router_reservation_blocks_before_the_call():
    config = CircuitConfig()
    # Cap smaller than a single call's worst-case reservation => refuse pre-call.
    prices = config.default_token_price
    reserve = cost_usd(estimate_input_tokens("first"), config.default_max_tokens, prices)
    spend = SpendTracker(cap_usd=reserve / 2)
    called = []
    router = LLMRouter(config, spend, lambda m, p, **k: called.append(1) or ("ok", {"input": 1, "output": 1}))
    with pytest.raises(SpendCapExceeded):
        router.complete("low", "first")
    assert called == [], "the client must not be called once the reservation breaches the cap"


def test_llm_router_bills_reservation_when_usage_absent():
    config = CircuitConfig()
    spend = SpendTracker(cap_usd=10.0)
    router = LLMRouter(config, spend, lambda m, p, **k: "no usage reported")
    router.complete("low", "hello there")
    expected = cost_usd(estimate_input_tokens("hello there"), config.default_max_tokens, config.default_token_price)
    assert spend.spend_usd == pytest.approx(expected)


def test_anthropic_client_is_lazy_and_optional():
    # Importing the example wiring must not require the anthropic SDK.
    from kubera.llm_router import anthropic_client

    client = anthropic_client(api_key="not-used-here")
    assert callable(client)  # building the factory does not import/contact anything
