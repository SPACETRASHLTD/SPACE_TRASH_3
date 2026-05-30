"""Dual-key constitution amendment (§7.7).

The system **cannot edit its own fence**. A constitution change requires BOTH:
  1. an explicit human approval token, AND
  2. a ``compass`` drift sign-off object.

This function is deliberately *not* reachable from any graph node — there is no
code path by which the circuit can call it on itself. It exists for an operator
to invoke out-of-band, and every amendment is written to the append-only ledger.
"""

from __future__ import annotations

import copy
from typing import Any

from .audit import AuditLog

HUMAN_APPROVAL_TOKEN = "HUMAN-APPROVED-CONSTITUTION-AMENDMENT"


class AmendmentRejected(Exception):
    pass


def amend_constitution(
    constitution: dict,
    proposed_changes: dict,
    *,
    human_token: str,
    compass_signoff: dict,
    audit: AuditLog | None = None,
) -> dict:
    """Return a NEW amended constitution, or raise ``AmendmentRejected``.

    ``compass_signoff`` must be ``{"approved": True, "drift_ok": True, "by": ...}``
    — i.e. the alignment gate has independently confirmed the change does not
    constitute value drift. Both keys are mandatory (dual-key).
    """
    # KEY 1 — human approval.
    if human_token != HUMAN_APPROVAL_TOKEN:
        if audit:
            audit.append("amend_reject", {"reason": "missing/invalid human token"})
        raise AmendmentRejected("human approval token required (§7.7)")

    # KEY 2 — compass drift sign-off.
    if not (isinstance(compass_signoff, dict) and compass_signoff.get("approved") and compass_signoff.get("drift_ok")):
        if audit:
            audit.append("amend_reject", {"reason": "missing compass drift sign-off"})
        raise AmendmentRejected("compass drift sign-off required (§7.7)")

    amended = copy.deepcopy(constitution)
    for key in ("is", "isnt", "rules"):
        if key in proposed_changes:
            amended[key] = list(proposed_changes[key])

    if audit:
        audit.append(
            "amend_accept",
            {"by": compass_signoff.get("by"), "changes": proposed_changes, "result": amended},
        )
    return amended
