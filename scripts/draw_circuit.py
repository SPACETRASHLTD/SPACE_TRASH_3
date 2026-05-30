"""Render the Kubera Circuit topology to docs/circuit.png.

Self-contained (matplotlib only; no graphviz / no network). The node order and
edges mirror the real compiled StateGraph in kubera/graph.py (§4).

    python scripts/draw_circuit.py
"""

from __future__ import annotations

import os
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# (key, alias, role, group)
NODES = [
    ("emit", "Bindu", "frame goal through fence + identity", "frame"),
    ("high_tier", "8 · Buddhi", "research + strategy  (router: strong)", "tiers"),
    ("mid_tier", "16", "strategy → jobs + permission reqs  (mid)", "tiers"),
    ("low_tier", "32", "execute in SANDBOX world  (cheap)", "tiers"),
    ("truth_check", "Yama-truth", "ground-truth verification (deterministic)", "basin"),
    ("prune", "Nirrti", "drop malformed/duplicate; decay memory", "basin"),
    ("warden", "Varuna", "reject constitution violations — BEFORE reward", "basin"),
    ("conductor", "Vayu", "dedupe · reconcile · attribute", "basin"),
    ("scout", "Indra", "novelty + protect young + MAP-Elites archive", "basin"),
    ("judge", "Yama-judge", "fitness within the fence; select survivors", "basin"),
    ("treasurer", "Kubera", "bank winners → skills · memory · identity", "basin"),
    ("congeal", "Agni", "map-reduce survivors → ONE microcosm", "basin"),
    ("compass", "Ishana", "alignment gate (2-model); may halt", "gate"),
    ("integrate", "—", "commit identity; seed next cycle", "gate"),
    ("route", "—", "halt → END · japa%9 → reconstitute · else → emit", "control"),
]

GROUPS = {
    "frame":   ("#efe7ff", "#7c5cff"),
    "tiers":   ("#e3f0ff", "#2b7fff"),
    "basin":   ("#e4f8ec", "#1fae5a"),
    "gate":    ("#fff1e0", "#ff8a00"),
    "control": ("#eceff3", "#5a6472"),
}
GROUP_BANDS = [
    ("frame", "FRAME", 0, 0),
    ("tiers", "3-TIER HIERARCHY", 1, 3),
    ("basin", "8-STAGE INTEGRITY PIPELINE  (the basin)", 4, 11),
    ("gate", "OVERSIGHT + COMMIT", 12, 13),
    ("control", "CONTROL", 14, 14),
]

PITCH = 1.0
BOX_W = 5.4
BOX_H = 0.66
CX = 5.0


def y_of(i: int) -> float:
    return (len(NODES) - i) * PITCH


def draw():
    fig, ax = plt.subplots(figsize=(12.5, 17.5))
    top = y_of(0) + 1.4
    bottom = y_of(len(NODES) - 1) - 2.6

    # group background bands + side labels
    for gkey, label, i0, i1 in GROUP_BANDS:
        fill, edge = GROUPS[gkey]
        y_hi = y_of(i0) + BOX_H / 2 + 0.18
        y_lo = y_of(i1) - BOX_H / 2 - 0.18
        band = FancyBboxPatch(
            (CX - BOX_W / 2 - 0.35, y_lo), BOX_W + 0.7, y_hi - y_lo,
            boxstyle="round,pad=0.02,rounding_size=0.12",
            linewidth=1.2, edgecolor=edge, facecolor=fill, alpha=0.45, zorder=0,
        )
        ax.add_patch(band)
        ax.text(CX - BOX_W / 2 - 0.55, (y_hi + y_lo) / 2, label, rotation=90,
                va="center", ha="center", fontsize=8.5, color=edge, fontweight="bold")

    # terminals
    ax.text(CX, top, "START", ha="center", va="center", fontsize=11, fontweight="bold",
            color="#333", bbox=dict(boxstyle="round,pad=0.4", fc="#dfe3ea", ec="#333"))
    end_y = y_of(len(NODES) - 1) - 1.3
    end_x = CX + BOX_W / 2 + 1.5
    ax.text(end_x, end_y, "END", ha="center", va="center", fontsize=11, fontweight="bold",
            color="#7a1f1f", bbox=dict(boxstyle="round,pad=0.4", fc="#ffd9d9", ec="#7a1f1f"))

    # reconstitute (side box, fed by route)
    rec_x = CX + BOX_W / 2 + 1.9
    rec_y = y_of(len(NODES) - 1)
    rec = FancyBboxPatch((rec_x - 1.55, rec_y - BOX_H / 2), 3.1, BOX_H,
                         boxstyle="round,pad=0.03,rounding_size=0.1",
                         linewidth=1.6, edgecolor="#c2185b", facecolor="#ffe3ef", zorder=3)
    ax.add_patch(rec)
    ax.text(rec_x, rec_y + 0.07, "reconstitute", ha="center", va="center", fontsize=10, fontweight="bold")
    ax.text(rec_x, rec_y - 0.17, "consolidate · re-derive · HUMAN GATE", ha="center", va="center", fontsize=7)

    # node boxes
    pos = {}
    for i, (key, alias, role, g) in enumerate(NODES):
        y = y_of(i)
        pos[key] = y
        fill, edge = GROUPS[g]
        box = FancyBboxPatch((CX - BOX_W / 2, y - BOX_H / 2), BOX_W, BOX_H,
                             boxstyle="round,pad=0.03,rounding_size=0.1",
                             linewidth=1.8, edgecolor=edge, facecolor="white", zorder=3)
        ax.add_patch(box)
        ax.text(CX - BOX_W / 2 + 0.25, y + 0.10, key, ha="left", va="center",
                fontsize=11, fontweight="bold", color="#1a1a1a")
        if alias != "—":
            ax.text(CX + BOX_W / 2 - 0.25, y + 0.10, alias, ha="right", va="center",
                    fontsize=9, style="italic", color=edge, fontweight="bold")
        ax.text(CX - BOX_W / 2 + 0.25, y - 0.16, role, ha="left", va="center",
                fontsize=7.6, color="#444")

    def arrow(x1, y1, x2, y2, color="#333", style="-", rad=0.0, lw=1.6, z=2):
        ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=14,
                     lw=lw, color=color, linestyle=style,
                     connectionstyle=f"arc3,rad={rad}", zorder=z))

    # START -> emit
    arrow(CX, top - 0.32, CX, y_of(0) + BOX_H / 2)
    # linear backbone
    for i in range(len(NODES) - 1):
        y1 = y_of(i) - BOX_H / 2
        y2 = y_of(i + 1) + BOX_H / 2
        arrow(CX, y1, CX, y2)

    route_y = pos["route"]
    # route -> END  (dashed)
    arrow(CX + BOX_W / 2, route_y, end_x - 0.5, end_y + 0.1, color="#7a1f1f", style="--", rad=-0.2)
    ax.text(CX + BOX_W / 2 + 0.55, route_y + 0.45, "halt / max_japa", fontsize=7.5, color="#7a1f1f")
    # route -> reconstitute (dashed)
    arrow(CX + BOX_W / 2, route_y - 0.1, rec_x - 1.55, rec_y + 0.05, color="#c2185b", style="--", rad=-0.25)
    ax.text(CX + BOX_W / 2 + 0.4, route_y - 0.55, "japa % 9 == 0", fontsize=7.5, color="#c2185b")

    # loop-backs on the LEFT, curving up to emit
    lx = CX - BOX_W / 2
    emit_y = y_of(0)
    # route -> emit (else: next japa)
    ax.add_patch(FancyArrowPatch((lx, route_y), (lx, emit_y - 0.12), arrowstyle="-|>",
                 mutation_scale=15, lw=1.8, color="#5a6472", linestyle="--",
                 connectionstyle="arc3,rad=0.32", zorder=1))
    ax.text(lx - 2.7, (route_y + emit_y) / 2 + 1.5, "else → emit\n(next japa)",
            fontsize=8, color="#5a6472", ha="center", fontweight="bold")
    # reconstitute -> emit (new mala)
    ax.add_patch(FancyArrowPatch((rec_x, rec_y - BOX_H / 2), (CX + 0.2, emit_y - BOX_H / 2),
                 arrowstyle="-|>", mutation_scale=14, lw=1.6, color="#c2185b", linestyle="--",
                 connectionstyle="arc3,rad=-0.45", zorder=1))
    ax.text(end_x + 0.7, (emit_y + rec_y) / 2, "new mala\n(every 9 japa)", rotation=90,
            ha="center", va="center", fontsize=8, color="#c2185b", fontweight="bold")

    # title + caption
    ax.text(CX, top + 1.0, "The Kubera Circuit", ha="center", fontsize=20, fontweight="bold")
    ax.text(CX, top + 0.55,
            "fixed goal → 3 tiers → 8-stage integrity pipeline → one microcosm → loop  (a LangGraph StateGraph)",
            ha="center", fontsize=9.5, color="#555")
    ax.text(CX, bottom + 0.2,
            "japa = 1 pass   ·   mala = 9 japa   ·   spend-capped, sandbox-only, guardrails before reward",
            ha="center", fontsize=9, color="#777", style="italic")

    ax.set_xlim(-0.5, end_x + 2.2)
    ax.set_ylim(bottom, top + 1.6)
    ax.axis("off")
    fig.tight_layout()
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs", "circuit.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    fig.savefig(out, dpi=140, bbox_inches="tight")
    print("wrote", out)


if __name__ == "__main__":
    draw()
