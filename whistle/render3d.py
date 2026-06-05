#!/usr/bin/env python3
"""3D isometric preview + fipple close-up of the whistle."""
import os
import numpy as np
import trimesh
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

here = os.path.dirname(__file__)
m = trimesh.load(os.path.join(here, "whistle_hexnut.stl"))

# light decimation for fast plotting if available
try:
    m2 = m.simplify_quadric_decimation(face_count=18000)
except Exception:
    m2 = m

fig = plt.figure(figsize=(15, 7))

ax = fig.add_subplot(1, 2, 1, projection="3d")
# reorder coords to (Z, X, Y) so the long axis lies along plot-x
V = m2.vertices[:, [2, 0, 1]]
tris = V[m2.faces]
pc = Poly3DCollection(tris, alpha=1.0, facecolor="#b8c6d8",
                      edgecolor="none", linewidths=0)
ax.add_collection3d(pc)
b0, b1 = V.min(0), V.max(0)
ax.set_xlim(b0[0], b1[0]); ax.set_ylim(b0[1], b1[1]); ax.set_zlim(b0[2], b1[2])
ax.set_box_aspect((b1[0]-b0[0], b1[1]-b0[1], b1[2]-b0[2]))
ax.view_init(elev=24, azim=-70)
ax.set_title("whistle (Z=blow end at left)")
ax.set_axis_off()

# fipple close-up (Y=0 section, zoom on head)
ax2 = fig.add_subplot(1, 2, 2)
sec = m.section(plane_origin=[0, 0, 0], plane_normal=[0, 1, 0])
for ent in sec.entities:
    p = sec.vertices[ent.points]
    ax2.plot(p[:, 2], p[:, 0], 'k-', lw=1.3)
ax2.set_xlim(21, 35); ax2.set_ylim(-7, 8)
ax2.set_aspect("equal"); ax2.grid(True, ls=":", alpha=0.5)
ax2.set_xlabel("Z (mm)"); ax2.set_ylabel("X (mm)")
ax2.set_title("fipple close-up: flue -> window -> labium -> chamber")
ax2.annotate("flue", (24, 4.6), (20.5, 7), fontsize=8,
             arrowprops=dict(arrowstyle="->"))
ax2.annotate("labium", (28.5, 3.7), (30, 6.5), fontsize=8,
             arrowprops=dict(arrowstyle="->"))
ax2.annotate("chamber", (29, -1), (31, -5), fontsize=8,
             arrowprops=dict(arrowstyle="->"))

plt.tight_layout()
out = os.path.join(here, "preview_3d.png")
plt.savefig(out, dpi=120)
print("wrote", out)
