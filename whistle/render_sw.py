#!/usr/bin/env python3
"""Tiny software rasterizer (numpy z-buffer + flat shading) -> clean turntable
GIF and a 4-angle montage, no GPU / external viewer / download needed."""
import os
import numpy as np
import trimesh
from PIL import Image

here = os.path.dirname(__file__)
m = trimesh.load(os.path.join(here, "whistle_hexnut.stl"))

V0 = m.vertices[:, [2, 0, 1]].astype(np.float64)   # long axis -> x
V0 -= (V0.max(0) + V0.min(0)) / 2
F = m.faces

W = H = 560
MARGIN = 0.86
BASE = np.array([0.55, 0.72, 0.90])     # steel blue
BG = np.array([8, 8, 12], np.uint8)
LIGHT = np.array([-0.3, 0.45, 0.85]); LIGHT /= np.linalg.norm(LIGHT)


def rot_x(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_y(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rot_z(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


# fixed 3/4 viewing rotation
VIEW = rot_x(np.radians(-18)) @ rot_y(np.radians(28))


def render(spin):
    V = V0 @ rot_x(spin).T @ VIEW.T          # spin about long axis, then view
    # orthographic fit
    mn, mx = V[:, :2].min(0), V[:, :2].max(0)
    span = (mx - mn).max()
    scale = min(W, H) * MARGIN / span
    cx, cy = (mx + mn) / 2
    sx = (V[:, 0] - cx) * scale + W / 2
    sy = H / 2 - (V[:, 1] - cy) * scale
    depth = V[:, 2]

    img = np.zeros((H, W, 3), np.float64) + BG / 255.0
    zbuf = np.full((H, W), -1e9)

    tri = np.stack([sx[F], sy[F]], -1)        # (nf,3,2)
    d = depth[F]                              # (nf,3)
    # face normals (world/view space) for shading + backface cull
    p = V[F]
    n = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
    n /= (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)
    front = n[:, 2] > 0                       # facing camera (+z)
    lam = np.clip(n @ LIGHT, 0, 1)
    col = np.clip(BASE * (0.28 + 0.72 * lam)[:, None], 0, 1)

    for i in np.nonzero(front)[0]:
        x0, y0 = tri[i, 0]; x1, y1 = tri[i, 1]; x2, y2 = tri[i, 2]
        minx = max(int(np.floor(min(x0, x1, x2))), 0)
        maxx = min(int(np.ceil(max(x0, x1, x2))), W - 1)
        miny = max(int(np.floor(min(y0, y1, y2))), 0)
        maxy = min(int(np.ceil(max(y0, y1, y2))), H - 1)
        if minx > maxx or miny > maxy:
            continue
        area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
        if abs(area) < 1e-9:
            continue
        xs = np.arange(minx, maxx + 1)
        ys = np.arange(miny, maxy + 1)
        gx, gy = np.meshgrid(xs, ys)
        w0 = ((x1 - gx) * (y2 - gy) - (x2 - gx) * (y1 - gy)) / area
        w1 = ((x2 - gx) * (y0 - gy) - (x0 - gx) * (y2 - gy)) / area
        w2 = 1 - w0 - w1
        inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not inside.any():
            continue
        zz = w0 * d[i, 0] + w1 * d[i, 1] + w2 * d[i, 2]
        sub = zbuf[miny:maxy + 1, minx:maxx + 1]
        better = inside & (zz > sub)
        sub[better] = zz[better]
        isub = img[miny:maxy + 1, minx:maxx + 1]
        isub[better] = col[i]
    return (np.clip(img, 0, 1) * 255).astype(np.uint8)


# turntable
frames = []
N = 36
for k in range(N):
    frames.append(Image.fromarray(render(2 * np.pi * k / N)))
    print("frame", k + 1, "/", N, flush=True)
gif = os.path.join(here, "preview_turntable.gif")
frames[0].save(gif, save_all=True, append_images=frames[1:],
               duration=70, loop=0, optimize=True)
print("wrote", gif)

# montage
tiles = [render(np.radians(a)) for a in (0, 90, 180, 270)]
top = np.concatenate([tiles[0], tiles[1]], 1)
bot = np.concatenate([tiles[2], tiles[3]], 1)
Image.fromarray(np.concatenate([top, bot], 0)).save(
    os.path.join(here, "preview_angles.png"))
print("wrote preview_angles.png")
