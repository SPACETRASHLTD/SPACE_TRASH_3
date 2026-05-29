"""Spend guard (§7.2). Every model/tool call is metered here against a HARD cap.

On breach the tracker raises ``SpendCapExceeded``; nodes catch it, set
``halt=True`` with a reason, and the graph exits cleanly via ``route``.
"""

from __future__ import annotations


class SpendCapExceeded(Exception):
    """Raised when a call would push spend past the hard cap."""

    def __init__(self, spend: float, cap: float, kind: str):
        self.spend = spend
        self.cap = cap
        self.kind = kind
        super().__init__(f"spend cap exceeded ({kind}): {spend:.4f} >= {cap:.4f}")


class SpendTracker:
    """Mutable, shared meter. Lives outside graph state so every call path —
    model or tool — funnels through one accountant.
    """

    def __init__(self, cap_usd: float):
        self.cap_usd = cap_usd
        self.spend_usd = 0.0
        self.calls = 0

    def charge(self, amount: float, kind: str = "model") -> float:
        """Charge ``amount``; raise if it would breach the cap. The breaching
        charge itself is *not* applied — we stop before crossing the line."""
        if self.spend_usd + amount > self.cap_usd:
            raise SpendCapExceeded(self.spend_usd + amount, self.cap_usd, kind)
        self.spend_usd += amount
        self.calls += 1
        return self.spend_usd

    def can_afford(self, amount: float) -> bool:
        return self.spend_usd + amount <= self.cap_usd

    def snapshot(self) -> dict:
        return {"spend_usd": round(self.spend_usd, 6), "cap_usd": self.cap_usd, "calls": self.calls}
