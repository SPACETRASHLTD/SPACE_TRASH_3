#!/usr/bin/env python3
"""Render verification images: Y=0 acoustic cross-section (Z horizontal, X
vertical) so the windway -> flue -> window -> labium -> chamber path is clear."""
import os
import numpy as np
import trimesh
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

here = os.path.dirname(__file__)
m = trimesh.load(os.path.join(here, "whistle_hexnut.stl"))

fig, axes = plt.subplots(2, 1, figsize=(14, 9))
for ax, yoff in [(axes[0], 0.0), (axes[1], 2.4)]:
    sec = m.section(plane_origin=[0, yoff, 0], plane_normal=[0, 1, 0])
    if sec is not None:
        for ent in sec.entities:
            p = sec.vertices[ent.points]   # 3D points on the plane
            ax.plot(p[:, 2], p[:, 0], 'k-', lw=0.9)   # Z horizontal, X vertical
    ax.set_aspect("equal")
    ax.grid(True, ls=":", alpha=0.5)
    ax.set_xlabel("Z (mm)  -- blow end at 0"); ax.set_ylabel("X (mm)")
    ax.set_title("Y=%.1f cross-section" % yoff)
    # annotate key Z stations
    for z, lab in [(5, "thread0"), (22, "thread1/head"),
                   (24, "flue exit"), (28.5, "labium")]:
        ax.axvline(z, color="r", lw=0.5, ls="--", alpha=0.5)
        ax.text(z, 9, lab, rotation=90, fontsize=7, color="r", va="top")

plt.tight_layout()
out = os.path.join(here, "preview_sections.png")
plt.savefig(out, dpi=120)
print("wrote", out)
