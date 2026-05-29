"""ToolRegistry (§2, §7.4). Permission-gated tool access.

Stage 0 registers only sandbox-safe tools. Any tool tagged ``requires_human`` is
withheld until a human approves it at the reconstitution gate — mid_tier raises a
permission request, it surfaces at ``reconstitute``, and only an approved
permission set unlocks it. No tool ever costs real-world side effects here.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from .spend import SpendTracker


@dataclass
class Tool:
    name: str
    permission: str            # permission string required to use it
    fn: Callable[[dict], dict]
    requires_human: bool = False
    description: str = ""


class ToolRegistryImpl:
    def __init__(self, spend: SpendTracker, price_usd: float = 0.0005):
        self.spend = spend
        self.price_usd = price_usd
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def available(self, permissions: set[str]) -> list:
        return [
            {"name": t.name, "permission": t.permission, "description": t.description}
            for t in self._tools.values()
            if t.permission in permissions and not t.requires_human
        ]

    def needs_permission(self) -> list:
        """Tools that exist but require a human-granted permission/capability."""
        return [
            {"name": t.name, "permission": t.permission, "requires_human": t.requires_human}
            for t in self._tools.values()
            if t.requires_human
        ]

    def call(self, name: str, args: dict, permissions: set[str]) -> dict:
        tool = self._tools.get(name)
        if tool is None:
            raise KeyError(f"unknown tool: {name}")
        if tool.permission not in permissions:
            raise PermissionError(f"tool {name} needs permission {tool.permission!r}")
        if tool.requires_human:
            raise PermissionError(f"tool {name} requires human approval (§7.4)")
        self.spend.charge(self.price_usd, kind=f"tool:{name}")
        return tool.fn(args)


def default_registry(spend: SpendTracker) -> ToolRegistryImpl:
    """A minimal sandbox registry. ``web_research`` (Firecrawl-style) is present
    but gated behind human approval to demonstrate the §7.4 capability gate."""
    reg = ToolRegistryImpl(spend)
    reg.register(
        Tool(
            name="sandbox_probe",
            permission="sandbox",
            fn=lambda args: {"ok": True, "echo": args},
            description="Inspect sandbox world state (safe).",
        )
    )
    reg.register(
        Tool(
            name="web_research",
            permission="network",
            fn=lambda args: {"note": "would call Firecrawl"},
            requires_human=True,
            description="Live web research via Firecrawl (requires human grant).",
        )
    )
    return reg
