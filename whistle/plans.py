#!/usr/bin/env python3
"""Engineering 'plans' for the swing-cord whistle: annotated longitudinal
section, two end/cross sections, and a 3D -X view showing the cord channel."""
import os
import numpy as np
import trimesh
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

here = os.path.dirname(__file__)
m = trimesh.load(os.path.join(here, "whistle_hexnut.stl"))


def section(origin, normal):
    s = m.section(plane_origin=origin, plane_normal=normal)
    segs = []
    if s is not None:
        for ent in s.entities:
            segs.append(s.vertices[ent.points])
    return segs


# ---- compact software rasterizer for a 3D view ----
V0 = m.vertices[:, [2, 0, 1]].astype(float)
V0 -= (V0.max(0) + V0.min(0)) / 2
F = m.faces
LIGHT = np.array([-0.4, 0.5, 0.75]); LIGHT /= np.linalg.norm(LIGHT)


def rot(ax, a):
    c, s = np.cos(a), np.sin(a)
    if ax == 'x':
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if ax == 'y':
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def render3d(R, W=620, H=460, base=(0.55, 0.72, 0.90)):
    V = V0 @ R.T
    mn, mx = V[:, :2].min(0), V[:, :2].max(0)
    sc = min(W, H) * 0.84 / (mx - mn).max()
    cx, cy = (mx + mn) / 2
    sx = (V[:, 0] - cx) * sc + W / 2
    sy = H / 2 - (V[:, 1] - cy) * sc
    d = V[:, 2]
    img = np.zeros((H, W, 3)) + np.array([0.03, 0.03, 0.05])
    zb = np.full((H, W), -1e9)
    tri = np.stack([sx[F], sy[F]], -1); dd = d[F]
    p = V[F]; n = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
    n /= (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)
    lam = np.clip(n @ LIGHT, 0, 1); col = np.clip(np.array(base) * (0.28 + 0.72 * lam)[:, None], 0, 1)
    for i in np.nonzero(n[:, 2] > 0)[0]:
        x0, y0 = tri[i, 0]; x1, y1 = tri[i, 1]; x2, y2 = tri[i, 2]
        ax0 = max(int(min(x0, x1, x2)), 0); ax1 = min(int(max(x0, x1, x2)) + 1, W - 1)
        ay0 = max(int(min(y0, y1, y2)), 0); ay1 = min(int(max(y0, y1, y2)) + 1, H - 1)
        if ax0 > ax1 or ay0 > ay1:
            continue
        ar = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
        if abs(ar) < 1e-9:
            continue
        gx, gy = np.meshgrid(np.arange(ax0, ax1 + 1), np.arange(ay0, ay1 + 1))
        w0 = ((x1 - gx) * (y2 - gy) - (x2 - gx) * (y1 - gy)) / ar
        w1 = ((x2 - gx) * (y0 - gy) - (x0 - gx) * (y2 - gy)) / ar
        w2 = 1 - w0 - w1
        ins = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not ins.any():
            continue
        zz = w0 * dd[i, 0] + w1 * dd[i, 1] + w2 * dd[i, 2]
        sub = zb[ay0:ay1 + 1, ax0:ax1 + 1]; bt = ins & (zz > sub)
        sub[bt] = zz[bt]; img[ay0:ay1 + 1, ax0:ax1 + 1][bt] = col[i]
    return np.clip(img, 0, 1)


fig = plt.figure(figsize=(15, 9), facecolor="white")

# (A) longitudinal Y=0 section -------------------------------------------
from matplotlib.patches import Rectangle, Polygon
axA = fig.add_subplot(2, 2, 1)
for p in section([0, 0, 0], [0, 1, 0]):
    axA.plot(p[:, 2], p[:, 0], '-', color="0.45", lw=0.8)
axA.axvspan(5, 20.48, color="orange", alpha=0.10)
axA.text(12.7, -9.3, "nut seats here (15.48 mm)", ha="center", fontsize=7, color="#b25000")
# cord channel schematic overlay (blue): axial run + angled front exit
axA.add_patch(Rectangle((-0.5, -5.3), 20.5, 4.0, color="royalblue", alpha=0.45, zorder=5))
axA.add_patch(Polygon([(18, -1.3), (18, -5.3), (22.6, -10.6), (22.6, -6.6)],
                      closed=True, color="royalblue", alpha=0.45, zorder=5))
axA.annotate("blow here", (0, 4), (-2, 9), fontsize=8, arrowprops=dict(arrowstyle="->"))
axA.annotate("fipple\n(flue+labium)", (28, 4), (31, 8.5), fontsize=8, color="green", arrowprops=dict(arrowstyle="->", color="green"))
axA.annotate("resonant chamber", (29, -2), (17, -8.5), fontsize=8, arrowprops=dict(arrowstyle="->"))
axA.annotate("CORD channel  (-X edge)", (9, -3.3), (-1.5, -7.5), fontsize=8, color="b", arrowprops=dict(arrowstyle="->", color="b"))
axA.annotate("out the back", (-0.5, -3.3), (-2.5, 1.5), fontsize=8, color="b", arrowprops=dict(arrowstyle="->", color="b"))
axA.annotate("out the front\n(opposite tip)", (-8.5, 21), (23, -6), fontsize=8, color="b", arrowprops=dict(arrowstyle="->", color="b"))
axA.set_xlim(-12, 38); axA.set_ylim(-11, 11)
axA.set_aspect("equal"); axA.grid(True, ls=":", alpha=0.4)
axA.set_xlabel("Z (mm)"); axA.set_ylabel("X (mm)")
axA.set_title("A.  Longitudinal section (Y=0): air path (+X) vs cord channel (-X, blue)")

# (B) back-face end view (looking down +Z) at Z=2 -------------------------
axB = fig.add_subplot(2, 2, 2)
for p in section([0, 0, 2.0], [0, 0, 1]):
    axB.plot(p[:, 0], p[:, 1], 'k-', lw=1.0)
axB.annotate("mouth (+X)", (5, 0), (7.5, 4), fontsize=8, arrowprops=dict(arrowstyle="->"))
axB.annotate("cord bore (-X)", (-3.3, 0), (-9, -6), fontsize=8, color="b", arrowprops=dict(arrowstyle="->", color="b"))
axB.set_aspect("equal"); axB.grid(True, ls=":", alpha=0.4)
axB.set_xlabel("X (mm)"); axB.set_ylabel("Y (mm)")
axB.set_title("B.  Back-face end view (Z=2): mouth opposite cord")

# (C) thread cross-section at Z=12 ---------------------------------------
axC = fig.add_subplot(2, 2, 3)
for p in section([0, 0, 12.0], [0, 0, 1]):
    axC.plot(p[:, 0], p[:, 1], 'k-', lw=1.0)
axC.annotate("windway (+X)", (3.5, 0), (5.5, 4), fontsize=8, arrowprops=dict(arrowstyle="->"))
axC.annotate("cord bore (-X)", (-3.3, 0), (-9, -5.5), fontsize=8, color="b", arrowprops=dict(arrowstyle="->", color="b"))
axC.set_aspect("equal"); axC.grid(True, ls=":", alpha=0.4)
axC.set_xlabel("X (mm)"); axC.set_ylabel("Y (mm)")
axC.set_title("C.  Cross-section through threads (Z=12)")

# (D) 3D view from the -X / cord side ------------------------------------
axD = fig.add_subplot(2, 2, 4)
R = rot('x', np.radians(-18)) @ rot('y', np.radians(28)) @ rot('x', np.radians(180))
axD.imshow(render3d(R)); axD.set_axis_off()
axD.set_title("D.  3D view, cord side (both cord openings visible)")

plt.tight_layout()
out = os.path.join(here, "preview_plans.png")
plt.savefig(out, dpi=120, facecolor="white")
print("wrote", out)
