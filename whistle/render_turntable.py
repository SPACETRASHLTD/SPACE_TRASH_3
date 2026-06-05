#!/usr/bin/env python3
"""Render a shaded turntable GIF + a 4-angle montage of the whistle, so it can
be viewed without downloading the STL or using an external viewer."""
import os
import numpy as np
import trimesh
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from matplotlib.animation import FuncAnimation, PillowWriter

here = os.path.dirname(__file__)
m = trimesh.load(os.path.join(here, "whistle_hexnut.stl"))
try:
    m = m.simplify_quadric_decimation(face_count=22000)
except Exception as e:
    print("no decimation:", e)

# coords as (long=Z, a=X, b=Y); spin about the long axis
P = m.vertices[:, [2, 0, 1]].astype(float)
P -= P.mean(0)
F = m.faces
LIGHT = np.array([0.35, 0.45, 0.82]); LIGHT /= np.linalg.norm(LIGHT)
BASE = np.array([0.62, 0.74, 0.86])      # steel blue

span = (P.max(0) - P.min(0))


def rot_long(P, ang):
    c, s = np.cos(ang), np.sin(ang)
    R = np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    return P @ R.T


def shade(verts, faces):
    tri = verts[faces]
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    ln = np.linalg.norm(n, axis=1, keepdims=True); ln[ln == 0] = 1
    n /= ln
    lam = np.clip(n @ LIGHT, 0, 1)
    inten = 0.30 + 0.70 * lam
    return tri, np.clip(BASE * inten[:, None], 0, 1)


def setup(ax):
    ax.set_box_aspect(span)
    r = span.max() / 2 * 1.05
    c = P.mean(0)
    ax.set_xlim(c[0]-r, c[0]+r); ax.set_ylim(c[1]-r, c[1]+r); ax.set_zlim(c[2]-r, c[2]+r)
    ax.view_init(elev=20, azim=-72)
    ax.set_axis_off()


# ---- turntable GIF ----
fig = plt.figure(figsize=(7, 4), facecolor="black")
ax = fig.add_subplot(111, projection="3d", facecolor="black")
N = 36


def frame(i):
    ax.clear(); setup(ax)
    V = rot_long(P, 2*np.pi*i/N)
    tri, cols = shade(V, F)
    ax.add_collection3d(Poly3DCollection(tri, facecolors=cols, edgecolors="none"))
    return []


anim = FuncAnimation(fig, frame, frames=N, blit=False)
gif = os.path.join(here, "preview_turntable.gif")
anim.save(gif, writer=PillowWriter(fps=14), dpi=110,
          savefig_kwargs={"facecolor": "black"})
print("wrote", gif)

# ---- 4-angle montage ----
fig2 = plt.figure(figsize=(11, 9), facecolor="black")
for k, ang in enumerate([0, 90, 180, 270]):
    ax = fig2.add_subplot(2, 2, k+1, projection="3d", facecolor="black")
    setup(ax)
    V = rot_long(P, np.radians(ang))
    tri, cols = shade(V, F)
    ax.add_collection3d(Poly3DCollection(tri, facecolors=cols, edgecolors="none"))
    ax.set_title("%d deg" % ang, color="#00FF00")
plt.tight_layout()
png = os.path.join(here, "preview_angles.png")
plt.savefig(png, dpi=120, facecolor="black")
print("wrote", png)
