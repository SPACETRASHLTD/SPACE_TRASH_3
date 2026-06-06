#!/usr/bin/env python3
"""
Parametric "hex-nut whistle" generator.

Produces a fipple (recorder-style) whistle whose shank carries external
5/8"-11 UNC threads so it screws into a 5/8"-11 Heavy Hex Nut.  The nut is
captured on the shank between the mouthpiece flange and the whistle head.

  blow end (Z=0)
    |== flange ==|========= 5/8-11 threaded shank =========|== head ==|
                       (nut rides here, ~15.5 mm thick)        (fipple)

Acoustics: air blown into the mouthpiece is squeezed by a tapering windway
into a thin flat jet (the "flue").  The jet crosses an open "window" cut in
the head wall and strikes the sharp "labium" edge, alternately feeding the
outside air and a closed resonant chamber -> the whistle sounds.

All dimensions are in millimetres.  Tunable acoustic params are grouped at
the top so the sound can be adjusted after a test print.

Requires: numpy, trimesh, manifold3d
"""

import numpy as np
import trimesh

INCH = 25.4

# ---------------------------------------------------------------------------
# 5/8"-11 UNC external thread (ASME / Unified National Coarse)
# ---------------------------------------------------------------------------
THREAD_MAJOR_D = 0.625 * INCH          # 15.875 mm nominal major diameter
TPI            = 11
PITCH          = INCH / TPI            # 2.3091 mm
THREAD_LEN     = 17.0                  # > nut thickness (15.48 mm) for full grip
PRINT_CLEAR    = 0.25                  # radial undersize so it threads into steel

# 60-deg V-thread, truncated crest/root -> standard UN depth ~0.6134*pitch
THREAD_DEPTH   = 0.6134 * PITCH        # ~1.416 mm
MAJOR_R = THREAD_MAJOR_D / 2.0 - PRINT_CLEAR
MINOR_R = MAJOR_R - THREAD_DEPTH

# ---------------------------------------------------------------------------
# Overall body layout along +Z (blow end at Z=0)
# ---------------------------------------------------------------------------
FLANGE_D   = 20.0
FLANGE_LEN = 5.0
Z_THREAD0  = FLANGE_LEN                 # 5
Z_THREAD1  = Z_THREAD0 + THREAD_LEN     # 22

# Head must pass THROUGH the nut bore during assembly -> keep <= ~13.2 mm.
HEAD_D     = 13.2
HEAD_R     = HEAD_D / 2.0               # 6.6
Z_HEAD0    = Z_THREAD1                  # 22
HEAD_LEN   = 13.0
Z_HEAD1    = Z_HEAD0 + HEAD_LEN         # 35

# ---------------------------------------------------------------------------
# Fipple / acoustic parameters  (TUNE THESE after a test print)
# ---------------------------------------------------------------------------
TOP_INNER_X = 5.0      # radius (X) of the inner "roof" wall the jet hugs
FLUE_H      = 0.9      # flue (jet) thickness, radial  -> thin flat jet
FLUE_W      = 5.0      # flue width (Y)
WINDOW_LEN  = 4.5      # jet length: flue exit -> labium  (the "mouth" length)
CUTUP       = 0.9      # labium height below windway roof: puts blade tip at
                       # the jet's lower edge (X~4.1) so the jet splits on it
Z_FLUE_EXIT = Z_HEAD0 + 2.0            # 24: where the jet becomes free
Z_LABIUM    = Z_FLUE_EXIT + WINDOW_LEN # 28.5: sharp splitting edge

CHAMBER_HALF_Y = 4.0   # resonant chamber half-width (Y)
CHAMBER_TOP_X  = 3.5   # chamber roof under the windway (leaves a flue floor)
CHAMBER_BOT_X  = -5.0  # chamber floor (toward -X)
Z_CHAM0    = Z_HEAD0 + 0.6             # closed near wall of resonator
Z_CHAM1    = Z_HEAD1 - 1.6             # closed far wall of resonator

# Mouthpiece bore (the rectangular hole you blow into at Z=0)
MOUTH_W    = 6.0
MOUTH_H    = 3.0       # taller at entry, tapers to FLUE_H at the flue exit

# ---------------------------------------------------------------------------
# Swing-cord channel  (the "whirl"/howler cord)
# ---------------------------------------------------------------------------
# A round bore on the -X edge (OPPOSITE the fipple window, which is on +X) runs
# the full length of the threaded shank and exits the back face of the flange.
# A short angled bore turns it out to the surface at the front (thread/head
# shoulder, opposite the tip).  Thread a cord through it, knot the front, and
# swing the nut+whistle on the cord -> it howls.  Kept clear of BOTH the
# windway (+X) and the resonant chamber (Z > 22.6).
CORD_D       = 4.0        # bore diameter (fits 550 paracord; "small hole")
CORD_X       = -3.3       # offset toward the -X edge
CORD_BACK_Z  = -0.5       # passes through the flange back face (Z=0)
CORD_AXIAL_Z = 20.0       # front end of the straight axial run
CORD_TURN_Z  = 18.0       # where the angled exit branches off
CORD_EXIT    = (-8.6, 0.0, 22.6)   # exit point on the -X shoulder surface

SEG = 256              # angular tessellation for round parts

ENGINE = "manifold"


def box(xlo, xhi, ylo, yhi, zlo, zhi):
    """Axis-aligned solid box from two opposite corners."""
    b = trimesh.creation.box(
        extents=(xhi - xlo, yhi - ylo, zhi - zlo))
    b.apply_translation(((xlo + xhi) / 2, (ylo + yhi) / 2, (zlo + zhi) / 2))
    return b


def hexahedron(pts):
    """Watertight solid from 8 corner points via convex hull."""
    return trimesh.Trimesh(vertices=np.asarray(pts, float)).convex_hull


# ---------------------------------------------------------------------------
# UN thread profile: radius as a function of fractional position in one pitch
# ---------------------------------------------------------------------------
def thread_profile(t):
    """t in [0,1) -> radius. Root flat 1/4 pitch, crest flat 1/8 pitch,
    60-deg flanks between."""
    t = t % 1.0
    if t < 1.0 / 8 or t >= 7.0 / 8:        # root flat
        return MINOR_R
    if 7.0 / 16 <= t < 9.0 / 16:           # crest flat
        return MAJOR_R
    if t < 7.0 / 16:                       # rising flank
        return MINOR_R + (MAJOR_R - MINOR_R) * (t - 1.0/8) / (7.0/16 - 1.0/8)
    return MAJOR_R - (MAJOR_R - MINOR_R) * (t - 9.0/16) / (7.0/8 - 9.0/16)


def build_thread_solid(z0, z1):
    """Right-hand single-start thread as a closed solid (radius -> axis).
    Surface is a structured (theta,z) grid + two end caps."""
    steps_per_pitch = 24
    nz = max(2, int(round((z1 - z0) / PITCH * steps_per_pitch)))
    nt = SEG
    zs = np.linspace(z0, z1, nz + 1)
    ths = np.linspace(0, 2*np.pi, nt, endpoint=False)

    verts = []
    for z in zs:
        for th in ths:
            phase = z / PITCH - th / (2*np.pi)   # RH helix
            r = thread_profile(phase)
            verts.append((r*np.cos(th), r*np.sin(th), z))
    verts = np.array(verts)
    # add two axis center points for caps
    c0 = len(verts); verts = np.vstack([verts, [0, 0, zs[0]]])
    c1 = len(verts); verts = np.vstack([verts, [0, 0, zs[-1]]])

    def idx(jz, it):
        return jz * nt + (it % nt)

    faces = []
    for jz in range(nz):
        for it in range(nt):
            a = idx(jz, it); b = idx(jz, it+1)
            c = idx(jz+1, it+1); d = idx(jz+1, it)
            faces.append((a, b, c)); faces.append((a, c, d))
    # bottom cap (z0) facing -Z
    for it in range(nt):
        faces.append((c0, idx(0, it+1), idx(0, it)))
    # top cap (z1) facing +Z
    for it in range(nt):
        faces.append((c1, idx(nz, it), idx(nz, it+1)))

    m = trimesh.Trimesh(vertices=verts, faces=np.array(faces), process=True)
    m.fix_normals()
    return m


def build():
    parts = []

    # --- mouthpiece flange (chamfered top edge) ---
    flange = trimesh.creation.cylinder(radius=FLANGE_D/2, height=FLANGE_LEN,
                                       sections=SEG)
    flange.apply_translation((0, 0, FLANGE_LEN/2))
    parts.append(flange)

    # --- threaded shank ---
    parts.append(build_thread_solid(Z_THREAD0, Z_THREAD1))
    # solid core for the shank up to the minor radius (guarantees a filled core)
    core = trimesh.creation.cylinder(radius=MINOR_R + 0.01, height=THREAD_LEN,
                                     sections=SEG)
    core.apply_translation((0, 0, (Z_THREAD0 + Z_THREAD1)/2))
    parts.append(core)

    # --- whistle head ---
    head = trimesh.creation.cylinder(radius=HEAD_R, height=HEAD_LEN, sections=SEG)
    head.apply_translation((0, 0, (Z_HEAD0 + Z_HEAD1)/2))
    parts.append(head)
    # round the very tip of the head (flattened dome, ~2.6 mm tall)
    tip = trimesh.creation.icosphere(subdivisions=3, radius=HEAD_R)
    tip.apply_scale((1, 1, 0.4))
    tip.apply_translation((0, 0, Z_HEAD1))
    parts.append(tip)

    body = trimesh.boolean.union(parts, engine=ENGINE)

    # ----------------------------------------------------------------
    # Internal voids
    # ----------------------------------------------------------------
    voids = []

    # Windway: tapering duct, mouth (Z=0) -> flue exit. Convex-hull hexahedron.
    eps = 0.5
    roof = TOP_INNER_X
    mouth = [  # rectangular entry at the blow face
        (roof,            -MOUTH_W/2, -eps), (roof,            MOUTH_W/2, -eps),
        (roof - MOUTH_H,  -MOUTH_W/2, -eps), (roof - MOUTH_H,  MOUTH_W/2, -eps),
    ]
    flue = [   # thin flat flue exit
        (roof,            -FLUE_W/2, Z_FLUE_EXIT), (roof,           FLUE_W/2, Z_FLUE_EXIT),
        (roof - FLUE_H,   -FLUE_W/2, Z_FLUE_EXIT), (roof - FLUE_H,  FLUE_W/2, Z_FLUE_EXIT),
    ]
    voids.append(hexahedron(mouth + flue))

    # Resonant chamber (closed cavity, opens only to the window/jet on top)
    voids.append(box(CHAMBER_BOT_X, CHAMBER_TOP_X,
                     -CHAMBER_HALF_Y, CHAMBER_HALF_Y, Z_CHAM0, Z_CHAM1))

    # Window: opening through the head wall, from chamber top out past surface,
    # spanning the jet length. Connects chamber <-> jet <-> outside.
    # Small overlaps (-0.5 in X, -0.1 in Z) guarantee a continuous air path
    # across the otherwise-coplanar chamber/flue boundaries.
    voids.append(box(CHAMBER_TOP_X - 0.5, HEAD_R + 1.0,
                     -(FLUE_W/2 + 0.2), (FLUE_W/2 + 0.2),
                     Z_FLUE_EXIT - 0.1, Z_LABIUM))

    # Labium bevel: slice the outer-top far corner so the splitting edge is
    # sharp and sits CUTUP below the windway roof. Wedge = convex hull.
    blade_tip_x = roof - CUTUP
    wedge = [
        (HEAD_R + 1.0, -FLUE_W,  Z_LABIUM - 0.01),
        (HEAD_R + 1.0,  FLUE_W,  Z_LABIUM - 0.01),
        (blade_tip_x,  -FLUE_W,  Z_LABIUM),
        (blade_tip_x,   FLUE_W,  Z_LABIUM),
        (HEAD_R + 1.0, -FLUE_W,  Z_LABIUM + 2.2),
        (HEAD_R + 1.0,  FLUE_W,  Z_LABIUM + 2.2),
    ]
    voids.append(hexahedron(wedge))

    # Swing-cord channel: axial run on the -X edge + angled exit at the front.
    axial = trimesh.creation.cylinder(
        radius=CORD_D/2, sections=48,
        segment=[(CORD_X, 0, CORD_BACK_Z), (CORD_X, 0, CORD_AXIAL_Z)])
    voids.append(axial)
    exitb = trimesh.creation.cylinder(
        radius=CORD_D/2, sections=48,
        segment=[(CORD_X, 0, CORD_TURN_Z), CORD_EXIT])
    voids.append(exitb)

    void = trimesh.boolean.union(voids, engine=ENGINE)
    whistle = trimesh.boolean.difference([body, void], engine=ENGINE)
    return whistle, void


if __name__ == "__main__":
    import os
    m, void = build()
    out = os.path.join(os.path.dirname(__file__), "whistle_hexnut.stl")
    m.export(out)
    print("watertight :", m.is_watertight)
    print("volume(mm3):", round(m.volume, 1))
    lo, hi = m.bounds
    print("bbox  (mm) : X %.2f  Y %.2f  Z %.2f" % tuple(hi - lo))
    print("triangles  :", len(m.faces))

    # --- air-path connectivity check ---------------------------------------
    bodies = void.split(only_watertight=False)
    print("\nvoid sub-bodies:", len(bodies))
    air = max(bodies, key=lambda b: b.volume)   # largest = the air path
    alo, ahi = air.bounds
    reaches_mouth = alo[2] <= 0.05              # opens at the blow face
    reaches_out   = ahi[0] >= HEAD_R - 0.1      # opens through the head wall
    print("  air path Z: %.2f -> %.2f  (mouth open: %s)" %
          (alo[2], ahi[2], reaches_mouth))
    print("  air path X max: %.2f  (window open to outside: %s)" %
          (ahi[0], reaches_out))
    print("  AIR PATH CONTINUOUS:", reaches_mouth and reaches_out)

    # --- cord channel must stay SEPARATE from the air path -----------------
    # (2 disjoint voids = air path + cord channel; if they merged into 1 the
    #  cord bore broke into the chamber/windway and the whistle would leak.)
    print("\ncord channel separate from air path:", len(bodies) == 2)
    cord = min(bodies, key=lambda b: b.volume)
    clo, chi = cord.bounds
    print("  cord Z: %.2f -> %.2f   exits back face: %s" %
          (clo[2], chi[2], clo[2] <= 0.05))
    print("  cord X: %.2f -> %.2f   exits -X surface: %s" %
          (clo[0], chi[0], clo[0] <= -HEAD_R))
    print("\nwrote      :", out)
