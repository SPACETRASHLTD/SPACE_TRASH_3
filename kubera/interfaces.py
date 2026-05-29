"""Pluggable interfaces (§9 of the brief).

These are intentionally abstract ``Protocol`` definitions. Stage 0 ships trivial
in-process implementations (``SandboxWorld``, ``MockModel`` router, JSON memory),
and richer backends (Mem0/Zep, real MCP servers, graduated worlds) can be swapped
in later *without touching the graph*.
"""

from __future__ import annotations

from typing import Any, Literal, Protocol, runtime_checkable

Tier = Literal["high", "mid", "low", "guardian"]


@runtime_checkable
class WorldAdapter(Protocol):
    """The environment workers act in.

    GUARDRAIL (§7.1): the default implementation must be a simulated / paper
    world. Real worlds (live trading, financial APIs, anything with real capital)
    require explicit human graduation and are never the default.
    """

    sandbox: bool

    def execute(self, action: dict) -> dict:
        """Run an action; return the *reported* raw outcome."""

    def ground_truth(self, action: dict, raw_outcome: dict) -> dict:
        """Return the objective, verified outcome for an action.

        This is the deterministic source of truth used by ``truth_check`` — it
        must not trust ``raw_outcome``.
        """


@runtime_checkable
class ModelRouter(Protocol):
    """Provider-agnostic model access (§7.8 / §2).

    No provider is ever hardcoded in node code; every model call goes through
    ``complete`` which also enforces the spend cap.
    """

    def model_for(self, tier: Tier) -> str:
        """Return the model id assigned to a tier."""

    def complete(self, tier: Tier, prompt: str, **kwargs: Any) -> str:
        """Run a completion for ``tier``; charges spend and may raise SpendCapExceeded."""


@runtime_checkable
class ToolRegistry(Protocol):
    """Permission-gated tool access (MCP servers, Firecrawl, ...)."""

    def available(self, permissions: set[str]) -> list:
        """Return tool descriptors visible under the given permission set."""

    def call(self, name: str, args: dict, permissions: set[str]) -> dict:
        """Invoke a tool, enforcing permissions and spend."""


@runtime_checkable
class MemoryStore(Protocol):
    """Namespaced memory with a decay hook (Nirrti)."""

    def write(self, ns: str, item: dict) -> None: ...
    def query(self, ns: str, q: str, k: int) -> list: ...
    def decay(self, ns: str) -> None: ...
    def all(self, ns: str) -> list: ...
