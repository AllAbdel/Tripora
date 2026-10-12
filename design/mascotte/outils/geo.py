"""Géométrie de Plumio v3 (bibliothèque standard seulement).

- courbe()  : courbes de Hobby (celles de MetaPost) : on donne les points de passage,
              l'algorithme choisit des tangentes sûres — pas de coude, pas de vague.
              Coins ('v'), directions imposées (nombre, 'i30', 'o30'), tension ('t1.4').
- effile()  : trait effilé autour d'une médiane (largeur variable), forme pleine.
- reserve() : taille de linogravure en retrait du bord, côté intérieur : jamais hors silhouette.
- ajuste()  : réécriture avec le moins de cubiques possible (écart < tol).
- chemin()  : écriture compacte (commandes relatives, une décimale).
"""
import math

# Courbes de Hobby. Un nœud est (x, y, *drapeaux) : 'v' = coin ; un nombre = tangente
# imposée (degrés, 0 = droite, 90 = bas) ; 'i30' / 'o30' = direction d'arrivée /
# de départ d'un coin ; 't1.4' = tension du segment qui part du nœud.


def _wrap(a):
    while a > math.pi:
        a -= 2 * math.pi
    while a <= -math.pi:
        a += 2 * math.pi
    return a


def _rho(t, p):
    """Vitesse de Hobby : longueur de poignée rapportée à la corde (tension 1)."""
    st, sp, ct, cp = math.sin(t), math.sin(p), math.cos(t), math.cos(p)
    num = 2 + math.sqrt(2) * (st - sp / 16) * (sp - st / 16) * (ct - cp)
    den = 3 * (1 + 0.5 * (math.sqrt(5) - 1) * ct + 0.5 * (3 - math.sqrt(5)) * cp)
    return min(4.0, max(0.05, num / den))


def _resout(M, b):
    """Gauss avec pivot partiel (systèmes de moins de vingt inconnues)."""
    n = len(b)
    A = [row[:] + [b[i]] for i, row in enumerate(M)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(A[r][c]))
        A[c], A[p] = A[p], A[c]
        for r in range(c + 1, n):
            f = A[r][c] / A[c][c]
            if f:
                for k in range(c, n + 1):
                    A[r][k] -= f * A[c][k]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (A[r][n] - sum(A[r][k] * x[k] for k in range(r + 1, n))) / A[r][r]
    return x


def _equation(M, b, k, km, kp, d, psi, tens):
    """Continuité de la « courbure approchée » de Hobby au nœud k."""
    t0, t1 = tens[k - 1], tens[k]
    A_, B_ = 1 / (t0 * d[k - 1]), (3 - t0) / (t0 * t0 * d[k - 1])
    C_, D_ = (3 - t1) / (t1 * t1 * d[k]), 1 / (t1 * d[k])
    M[k][km] += A_
    M[k][k] += B_ + C_
    M[k][kp] += D_
    b[k] = -B_ * psi[k] - D_ * psi[kp]


def _segments(pts, th, psi, d, a, tens):
    n, out = len(th), []
    for k in range(len(d)):
        k1 = (k + 1) % n
        theta, phi = th[k], -psi[k1] - th[k1]
        ca = d[k] * _rho(theta, phi) / tens[k]
        cb = d[k] * _rho(phi, theta) / tens[k]
        p0, p3 = pts[k], pts[(k + 1) % len(pts)]
        out.append((p0, (p0[0] + ca * math.cos(a[k] + theta), p0[1] + ca * math.sin(a[k] + theta)),
                    (p3[0] - cb * math.cos(a[k] - phi), p3[1] - cb * math.sin(a[k] - phi)), p3))
    return out


def _ouvert(pts, d_in, d_out, dirs, tens):
    """Chemin ouvert ; aux bouts, direction imposée ou « curl » 1 (arcs presque circulaires)."""
    N = len(pts) - 1
    d = [math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]) for k in range(N)]
    a = [math.atan2(pts[k + 1][1] - pts[k][1], pts[k + 1][0] - pts[k][0]) for k in range(N)]
    psi = [0.0] + [_wrap(a[k] - a[k - 1]) for k in range(1, N)] + [0.0]
    n = N + 1
    M = [[0.0] * n for _ in range(n)]
    b = [0.0] * n
    if d_in is not None:
        M[0][0], b[0] = 1, _wrap(d_in - a[0])
    else:                                      # curl 1 : les deux coefficients valent 3
        M[0][0], M[0][1], b[0] = 3, 3, -3 * psi[1]
    for k in range(1, N):
        if k in dirs:
            M[k][k], b[k] = 1, _wrap(dirs[k] - a[k])
        else:
            _equation(M, b, k, k - 1, k + 1, d, psi, tens)
    if d_out is not None:
        M[N][N], b[N] = 1, _wrap(d_out - a[N - 1])
    else:
        M[N][N - 1], M[N][N] = 3, 3
    if N == 1 and d_in is None and d_out is None:
        th = [0.0, 0.0]                        # deux points libres : un segment droit
    else:
        th = _resout(M, b)
    return _segments(pts, th, psi, d, a, tens)


def _cycle(pts, dirs, tens):
    n = len(pts)
    d = [math.hypot(pts[(k + 1) % n][0] - pts[k][0], pts[(k + 1) % n][1] - pts[k][1]) for k in range(n)]
    a = [math.atan2(pts[(k + 1) % n][1] - pts[k][1], pts[(k + 1) % n][0] - pts[k][0]) for k in range(n)]
    psi = [_wrap(a[k] - a[k - 1]) for k in range(n)]
    M = [[0.0] * n for _ in range(n)]
    b = [0.0] * n
    for k in range(n):
        if k in dirs:
            M[k][k], b[k] = 1, _wrap(dirs[k] - a[k])
        else:
            _equation(M, b, k, (k - 1) % n, (k + 1) % n, d, psi, tens)
    return _segments(pts, _resout(M, b), psi, d, a, tens)


def _noeud(n, t):
    r = dict(x=n[0], y=n[1], v=False, d=None, i=None, o=None, t=t)
    for f in n[2:]:
        if f == 'v':
            r['v'] = True
        elif isinstance(f, (int, float)):
            r['d'] = math.radians(f)
        elif f[0] == 't':
            r['t'] = float(f[1:])
        else:
            r[f[0]] = math.radians(float(f[1:]))
    if r['d'] is not None:
        r['i'] = r['d'] if r['i'] is None else r['i']
        r['o'] = r['d'] if r['o'] is None else r['o']
    return r


def _course(ns):
    pts = [(n['x'], n['y']) for n in ns]
    dirs = {k: ns[k]['d'] for k in range(1, len(ns) - 1) if ns[k]['d'] is not None}
    return _ouvert(pts, ns[0]['o'], ns[-1]['i'], dirs, [n['t'] for n in ns[:-1]])


def courbe(noeuds, fermee=True, t=1.0):
    """Courbe de Hobby par les nœuds ; rend des segments cubiques (p0, c1, c2, p3)."""
    ns = [_noeud(n, t) for n in noeuds]
    if not fermee:
        out, cur = [], [ns[0]]
        for n in ns[1:]:
            cur.append(n)
            if n['v'] and n is not ns[-1]:
                out += _course(cur)
                cur = [n]
        return out + _course(cur)
    coins = [k for k, n in enumerate(ns) if n['v']]
    if not coins:
        return _cycle([(n['x'], n['y']) for n in ns], {k: n['d'] for k, n in enumerate(ns) if n['d'] is not None},
                      [n['t'] for n in ns])
    k0 = coins[0]
    ns = ns[k0:] + ns[:k0]
    out, cur = [], [ns[0]]
    for n in ns[1:] + [ns[0]]:
        cur.append(n)
        if n['v']:
            out += _course(cur)
            cur = [n]
    k = len(out) - k0                          # le segment 0 part toujours du nœud 0
    return out[k:] + out[:k]


# ── Évaluer, couper, transformer ──────────────────────────────────────────────


def bez(s, u):
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = s
    v = 1 - u
    return (v ** 3 * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u ** 3 * x3,
            v ** 3 * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u ** 3 * y3)


def _bez_d(s, u):
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = s
    v = 1 - u
    return (3 * v * v * (x1 - x0) + 6 * v * u * (x2 - x1) + 3 * u * u * (x3 - x2),
            3 * v * v * (y1 - y0) + 6 * v * u * (y2 - y1) + 3 * u * u * (y3 - y2))


def _lerp(p, q, u):
    return (p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u)


def _coupe(s, u):
    p0, p1, p2, p3 = s
    a, b, c = _lerp(p0, p1, u), _lerp(p1, p2, u), _lerp(p2, p3, u)
    d, e = _lerp(a, b, u), _lerp(b, c, u)
    f = _lerp(d, e, u)
    return (p0, a, d, f), (f, e, c, p3)


def troncon(segs, u0, u1):
    """Portion d'une chaîne entre u0 et u1 (u = indice de segment + fraction)."""
    out = []
    for k, s in enumerate(segs):
        a, b = max(u0, k), min(u1, k + 1)
        if b <= a:
            continue
        if b < k + 1:
            s = _coupe(s, b - k)[0]
            ta = (a - k) / (b - k)
        else:
            ta = a - k
        if ta > 0:
            s = _coupe(s, ta)[1]
        out.append(s)
    return out


def inverse(segs):
    return [(s[3], s[2], s[1], s[0]) for s in reversed(segs)]


def mat_rot(deg, cx=0.0, cy=0.0):
    r = math.radians(deg)
    c, s = math.cos(r), math.sin(r)
    return (c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy)


def mat_mul(m, n):
    """m ∘ n (n s'applique d'abord)."""
    a, b, c, d, e, f = m
    A, B, C, D, E, F = n
    return (a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f)


def mat_tr(dx, dy):
    return (1, 0, 0, 1, dx, dy)


def mat_ech(sx, sy, cx=0.0, cy=0.0):
    return (sx, 0, 0, sy, cx - sx * cx, cy - sy * cy)


def mat_inv(m):
    a, b, c, d, e, f = m
    det = a * d - b * c
    ia, ib, ic, id_ = d / det, -b / det, -c / det, a / det
    return (ia, ib, ic, id_, -(ia * e + ic * f), -(ib * e + id_ * f))


def app(m, p):
    return (m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5])


def xf(segs, m):
    return [tuple(app(m, p) for p in s) for s in segs]


MIROIR = (-1, 0, 0, 1, 96, 0)


# ── Formes dérivées : traits effilés, réserves, fuseaux ──────────────────────


def _normale(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1
    return (-dy / L, dx / L)


def decale(segs, w, signe=1):
    """Pousse une chaîne de w(u) (u ∈ [0, n]) sur sa gauche (signe 1) : on décale le
    polygone de contrôle (Tiller-Hanson simplifié), exact pour nos courbes douces."""
    out = []
    for k, (p0, c1, c2, p3) in enumerate(segs):
        n0 = _normale(p0, c1 if c1 != p0 else c2)
        n3 = _normale(c2 if c2 != p3 else c1, p3)
        ws = [signe * w(k + q / 3) for q in range(4)]
        out.append(((p0[0] + n0[0] * ws[0], p0[1] + n0[1] * ws[0]), (c1[0] + n0[0] * ws[1], c1[1] + n0[1] * ws[1]),
                    (c2[0] + n3[0] * ws[2], c2[1] + n3[1] * ws[2]), (p3[0] + n3[0] * ws[3], p3[1] + n3[1] * ws[3])))
    return out


def profil(*cles):
    """Largeur douce (lissage en S) entre des clés (u, largeur), u ∈ [0, 1]."""
    def f(u):
        if u <= cles[0][0]:
            return cles[0][1]
        for (u0, w0), (u1, w1) in zip(cles, cles[1:]):
            if u <= u1:
                x = (u - u0) / ((u1 - u0) or 1)
                return w0 + (w1 - w0) * x * x * (3 - 2 * x)
        return cles[-1][1]
    return f


def _ligne(p, q):
    return (p, p, q, q)


def effile(segs, larg, encoche=0.0):
    """Trait effilé autour d'une médiane, larg(u) avec u ∈ [0, 1] : une forme pleine,
    jamais un contour. encoche > 0 : bout fendu en queue d'hirondelle."""
    n = len(segs)
    g = decale(segs, lambda u: larg(u / n) / 2, 1)
    d = decale(segs, lambda u: larg(u / n) / 2, -1)
    if encoche:
        p3, c2 = segs[-1][3], segs[-1][2]
        L = math.hypot(p3[0] - c2[0], p3[1] - c2[1]) or 1
        f = (p3[0] - (p3[0] - c2[0]) / L * encoche, p3[1] - (p3[1] - c2[1]) / L * encoche)
        bout = [_ligne(g[-1][3], f), _ligne(f, d[-1][3])]
    else:
        bout = [_ligne(g[-1][3], d[-1][3])]
    out = g + bout + inverse(d)
    if math.hypot(d[0][0][0] - g[0][0][0], d[0][0][1] - g[0][0][1]) > 1e-3:
        out.append(_ligne(d[0][0], g[0][0]))
    return out


def bande(bord, larg, signe=1):
    """Bande collée à un bord, d'épaisseur larg(u), u ∈ [0, 1], du côté signe."""
    n = len(bord)
    dec = decale(bord, lambda u: larg(u / n), signe)
    return bord + [_ligne(bord[-1][3], dec[-1][3])] + inverse(dec)


def reserve(bord, larg, signe=1, retrait=0.12):
    """Réserve : taille fine en retrait du bord, côté intérieur de la pièce de devant.
    Elle appartient à la pièce qui passe devant et bouge avec elle ; l'ajustement qui
    suit reste plus fin que le retrait, elle ne déborde donc jamais de la silhouette."""
    return bande(decale(bord, lambda u: retrait, signe), larg, signe)


def fuseau(a, b, fleche, ep):
    """Fuseau (coup de gouge) de a à b, courbé de « fleche », épais de ep au milieu."""
    (ax, ay), (bx, by) = a, b
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy)
    nx, ny = -dy / L, dx / L
    h, f = 2 / 3 * ep, fleche * 4 / 3

    def c(t, o):
        return (ax + dx * t + nx * o, ay + dy * t + ny * o)
    return [(a, c(.3, f + h), c(.7, f + h), b), (b, c(.7, f - h), c(.3, f - h), a)]


def aire(segs):
    """Aire signée (positive : sens horaire à l'écran)."""
    a = 0.0
    for s in segs:
        pts = [bez(s, k / 8) for k in range(9)]
        for p, q in zip(pts, pts[1:]):
            a += p[0] * q[1] - q[0] * p[1]
    return a / 2


def horaire(segs):
    """Toutes les formes dans le même sens : on peut fusionner des tracés sans faire de trou."""
    return segs if aire(segs) >= 0 else inverse(segs)


# ── Réécriture avec moins de cubiques (moindres carrés de Schneider) ─────────


def _unit(v):
    L = math.hypot(v[0], v[1]) or 1
    return (v[0] / L, v[1] / L)


def _tan0(s):
    return _unit((s[1][0] - s[0][0], s[1][1] - s[0][1]) if s[1] != s[0] else (s[2][0] - s[0][0], s[2][1] - s[0][1]))


def _tan1(s):
    return _unit((s[2][0] - s[3][0], s[2][1] - s[3][1]) if s[2] != s[3] else (s[1][0] - s[3][0], s[1][1] - s[3][1]))


def _ajuste1(pts, t0, t1):
    """Une cubique par pts : bouts et tangentes fixes, poignées optimales, reparamétrage de Newton."""
    d = [0.0]
    for p, q in zip(pts, pts[1:]):
        d.append(d[-1] + math.hypot(q[0] - p[0], q[1] - p[1]))
    us = [x / d[-1] for x in d]
    p0, p3 = pts[0], pts[-1]
    L = math.hypot(p3[0] - p0[0], p3[1] - p0[1])
    for _ in range(4):
        C00 = C01 = C11 = X0 = X1 = 0.0
        for p, u in zip(pts, us):
            v = 1 - u
            b0, b1, b2, b3 = v ** 3, 3 * u * v * v, 3 * u * u * v, u ** 3
            A1, A2 = (t0[0] * b1, t0[1] * b1), (t1[0] * b2, t1[1] * b2)
            r = (p[0] - p0[0] * (b0 + b1) - p3[0] * (b2 + b3), p[1] - p0[1] * (b0 + b1) - p3[1] * (b2 + b3))
            C00 += A1[0] * A1[0] + A1[1] * A1[1]
            C01 += A1[0] * A2[0] + A1[1] * A2[1]
            C11 += A2[0] * A2[0] + A2[1] * A2[1]
            X0 += A1[0] * r[0] + A1[1] * r[1]
            X1 += A2[0] * r[0] + A2[1] * r[1]
        det = C00 * C11 - C01 * C01
        a1 = a2 = L / 3
        if abs(det) > 1e-12:
            a1, a2 = (X0 * C11 - X1 * C01) / det, (C00 * X1 - C01 * X0) / det
            if a1 < L * 1e-3 or a2 < L * 1e-3:
                a1 = a2 = L / 3
        s = (p0, (p0[0] + t0[0] * a1, p0[1] + t0[1] * a1), (p3[0] + t1[0] * a2, p3[1] + t1[1] * a2), p3)
        nu = []
        for p, u in zip(pts, us):
            q, d1 = bez(s, u), _bez_d(s, u)
            v = 1 - u
            d2 = (6 * v * (s[2][0] - 2 * s[1][0] + s[0][0]) + 6 * u * (s[3][0] - 2 * s[2][0] + s[1][0]),
                  6 * v * (s[2][1] - 2 * s[1][1] + s[0][1]) + 6 * u * (s[3][1] - 2 * s[2][1] + s[1][1]))
            num = (q[0] - p[0]) * d1[0] + (q[1] - p[1]) * d1[1]
            den = d1[0] ** 2 + d1[1] ** 2 + (q[0] - p[0]) * d2[0] + (q[1] - p[1]) * d2[1]
            nu.append(min(1, max(0, u - num / den)) if den else u)
        us = nu
    return s, max(math.hypot(bez(s, u)[0] - p[0], bez(s, u)[1] - p[1]) for p, u in zip(pts, us))


def _ajuste_chaine(m, tol):
    if len(m) == 1:
        return m
    pts = [bez(s, k / 24) for s in m for k in range(24)] + [m[-1][3]]
    s, err = _ajuste1(pts, _tan0(m[0]), _tan1(m[-1]))
    if err <= tol:
        return [s]
    k = len(m) // 2
    return _ajuste_chaine(m[:k], tol) + _ajuste_chaine(m[k:], tol)


def ajuste(segs, tol):
    """Moins de cubiques, même dessin (écart < tol) ; les coins restent des coins."""
    if len(segs) <= 1:
        return list(segs)
    morceaux, cur = [], [segs[0]]
    for s in segs[1:]:
        a, b = _tan1(cur[-1]), _tan0(s)
        if -(a[0] * b[0] + a[1] * b[1]) < 0.995:
            morceaux.append(cur)
            cur = [s]
        else:
            cur.append(s)
    morceaux.append(cur)
    return [s for m in morceaux for s in _ajuste_chaine(m, tol)]


# ── Écriture : commandes relatives, une décimale, aucun séparateur inutile ───


def _dix(v):
    return int(round(v * 10))


def num(n):
    """Entier en dixièmes → texte le plus court (« .5 », « -1.2 », « 3 »)."""
    s, n = ('-' if n < 0 else ''), abs(n)
    e, d = divmod(n, 10)
    return s + str(e) if d == 0 else s + ('' if e == 0 else str(e)) + '.' + str(d)


def fmt(v):
    return num(_dix(v))


def _nums(vals):
    out, last = '', ''
    for n in vals:
        t = num(n)
        if out and not t.startswith('-') and not (t.startswith('.') and '.' in last):
            out += ' '
        out += t
        last = t
    return out


def _droit(p0, pts, tol=0.6):
    """Cubique dont les poignées sont sur la corde (en dixièmes) : on l'écrit « l »."""
    (x1, y1), (x2, y2), (x3, y3) = pts
    x0, y0 = p0
    L = math.hypot(x3 - x0, y3 - y0)
    if L < 1e-9:
        return True

    def ok(x, y):
        t = ((x - x0) * (x3 - x0) + (y - y0) * (y3 - y0)) / (L * L)
        return abs((x3 - x0) * (y0 - y) - (x0 - x) * (y3 - y0)) / L <= tol and -0.02 <= t <= 1.02
    return ok(x1, y1) and ok(x2, y2)


LISSE = 2.5   # « s » permis si le point de contrôle réfléchi tombe à moins de 0,25 u du vrai


def chemin(*sous):
    """Chaînes fermées → attribut d (relatif, une décimale). Une cubique dont la première poignée
    est (à LISSE dixièmes près) le reflet de la précédente s'écrit « s » : deux nombres de moins,
    écart au dessin < 0,12 u."""
    out, start = '', None
    for segs in sous:
        if not segs:
            continue
        P0 = (_dix(segs[0][0][0]), _dix(segs[0][0][1]))
        if start is None:
            out += 'M' + _nums(P0)
        else:
            a, r = 'M' + _nums(P0), 'm' + _nums((P0[0] - start[0], P0[1] - start[1]))
            out += r if len(r) < len(a) else a
        start = cur = P0
        prev, c2 = 'M', None
        for k, s in enumerate(segs):
            pts = [(_dix(q[0]), _dix(q[1])) for q in s[1:]]
            if pts[0] == cur and pts[1] == cur and pts[2] == cur:
                continue
            if _droit(cur, pts):
                if k == len(segs) - 1 and pts[2] == start:
                    break                       # le « z » ferme
                cmd, vals, c2n = 'l', [pts[2][0] - cur[0], pts[2][1] - cur[1]], None
            else:
                refl = (2 * cur[0] - c2[0], 2 * cur[1] - c2[1]) if c2 else None
                if refl and math.hypot(refl[0] - pts[0][0], refl[1] - pts[0][1]) <= LISSE:
                    cmd, vals = 's', [v for q in pts[1:] for v in (q[0] - cur[0], q[1] - cur[1])]
                else:
                    cmd, vals = 'c', [v for q in pts for v in (q[0] - cur[0], q[1] - cur[1])]
                c2n = pts[1]
            txt = _nums(vals)
            out += (txt if txt.startswith('-') else ' ' + txt) if cmd == prev else cmd + txt
            prev, cur, c2 = cmd, pts[-1], c2n
        out += 'z'
    return out




def point(segs, u):
    k = min(int(u), len(segs) - 1)
    return bez(segs[k], u - k)


def tangente(segs, u):
    k = min(int(u), len(segs) - 1)
    return _unit(_bez_d(segs[k], u - k))


def cercle(cx, cy, r, rx=None):
    """Cercle (ou ellipse rx × r) en quatre cubiques, sens horaire à l'écran."""
    a, b, k = (rx or r), r, 0.5523
    return [((cx + a, cy), (cx + a, cy + k * b), (cx + k * a, cy + b), (cx, cy + b)),
            ((cx, cy + b), (cx - k * a, cy + b), (cx - a, cy + k * b), (cx - a, cy)),
            ((cx - a, cy), (cx - a, cy - k * b), (cx - k * a, cy - b), (cx, cy - b)),
            ((cx, cy - b), (cx + k * a, cy - b), (cx + a, cy - k * b), (cx + a, cy))]


def longueur(segs):
    L = 0.0
    for s in segs:
        pts = [bez(s, k / 16) for k in range(17)]
        L += sum(math.hypot(q[0] - p[0], q[1] - p[1]) for p, q in zip(pts, pts[1:]))
    return L


# ── Continuité C1 : mêmes longueurs de poignée de part et d'autre d'un nœud lisse ──
# (le tracé s'écrit alors presque entièrement en « s », deux nombres de moins par nœud)


def _runs(segs, ferme):
    """Découpe une chaîne aux coins : listes d'indices de segments raccordés en G1."""
    n = len(segs)
    lisse = []
    for k in range(n):
        if k == n - 1 and not ferme:
            lisse.append(False)
            continue
        a, b = _tan1(segs[k]), _tan0(segs[(k + 1) % n])
        lisse.append(-(a[0] * b[0] + a[1] * b[1]) >= 0.995)
    if ferme and all(lisse):
        return [list(range(n))], True
    k0 = 0
    if ferme:
        k0 = next(k for k in range(n) if not lisse[k]) + 1
    runs, cur = [], []
    for i in range(n):
        k = (k0 + i) % n
        cur.append(k)
        if not lisse[k]:
            runs.append(cur)
            cur = []
    if cur:
        runs.append(cur)
    return runs, False


def _resout_sym(M, b):
    return _resout(M, b)


def lisse_c1(segs, tol=0.12, ferme=True):
    """Réajuste les longueurs de poignée (moindres carrés, directions gardées) pour que chaque
    nœud lisse soit C1. Garde l'ancien tracé d'une course si l'écart dépasse tol."""
    segs = list(segs)
    runs, cycle = _runs(segs, ferme)
    out = list(segs)
    for run in runs:
        m = len(run)
        if m < 2 and not cycle:
            continue
        # nœuds : début de chaque segment (+ fin du dernier si course ouverte)
        P = [segs[k][0] for k in run] + ([] if cycle else [segs[run[-1]][3]])
        T = []
        for i, k in enumerate(run):
            T.append(_unit((segs[k][1][0] - segs[k][0][0], segs[k][1][1] - segs[k][0][1]))
                     if segs[k][1] != segs[k][0] else _tan0(segs[k]))
        if not cycle:
            k = run[-1]
            t = _tan1(segs[k])
            T.append((-t[0], -t[1]))
        nk = len(P)
        # inconnues : longueur sortante au nœud i (= longueur entrante, C1) ; aux bouts d'une
        # course ouverte, les longueurs propres restent libres (une inconnue chacune aussi).
        nv = nk
        M = [[0.0] * nv for _ in range(nv)]
        rhs = [0.0] * nv
        cibles = []
        for j, k in enumerate(run):
            i0, i1 = j, (j + 1) % nk if cycle else j + 1
            s = segs[k]
            pts = [bez(s, q / 10) for q in range(1, 10)]
            for q, p in zip(range(1, 10), pts):
                u = q / 10
                v = 1 - u
                b0, b1, b2, b3 = v ** 3, 3 * u * v * v, 3 * u * u * v, u ** 3
                base = (P[i0][0] * (b0 + b1) + P[i1][0] * (b2 + b3), P[i0][1] * (b0 + b1) + P[i1][1] * (b2 + b3))
                # B = base + L0 * T0 * b1 - L1 * T1 * b2
                g0 = (T[i0][0] * b1, T[i0][1] * b1)
                g1 = (-T[i1][0] * b2, -T[i1][1] * b2)
                r = (p[0] - base[0], p[1] - base[1])
                for (ia, ga) in ((i0, g0), (i1, g1)):
                    rhs[ia] += ga[0] * r[0] + ga[1] * r[1]
                    for (ib, gb) in ((i0, g0), (i1, g1)):
                        M[ia][ib] += ga[0] * gb[0] + ga[1] * gb[1]
            cibles.append(pts)
        for i in range(nv):
            M[i][i] += 1e-9
        try:
            L = _resout(M, rhs)
        except ZeroDivisionError:
            continue
        neufs = []
        ok = True
        for j, k in enumerate(run):
            i0, i1 = j, (j + 1) % nk if cycle else j + 1
            if L[i0] <= 0 or L[i1] <= 0:
                ok = False
                break
            s = (P[i0], (P[i0][0] + T[i0][0] * L[i0], P[i0][1] + T[i0][1] * L[i0]),
                 (P[i1][0] - T[i1][0] * L[i1], P[i1][1] - T[i1][1] * L[i1]), P[i1])
            ech = [bez(s, q / 40) for q in range(41)]
            for p in cibles[j]:
                if min(math.hypot(p[0] - e[0], p[1] - e[1]) for e in ech) > tol:
                    ok = False
                    break
            if not ok:
                break
            neufs.append(s)
        if ok:
            for j, k in enumerate(run):
                out[k] = neufs[j]
    return out


def _coins(segs, ferme):
    """Indices des nœuds anguleux (début de segment) d'une chaîne."""
    n = len(segs)
    c = []
    for k in range(n):
        if k == 0 and not ferme:
            c.append(0)
            continue
        a, b = _tan1(segs[k - 1]), _tan0(segs[k])
        if -(a[0] * b[0] + a[1] * b[1]) < 0.995:
            c.append(k)
    return c


def _fit_c1(P, T, cibles, cycle, iters=3):
    """Longueurs de poignée L (une par nœud, C1) par moindres carrés.
    P, T : nœuds et tangentes ; cibles[j] : points visés sur le segment j avec leur u initial."""
    nk = len(P)
    nseg = len(cibles)
    us = [[u for u, _ in c] for c in cibles]
    L = None
    for _ in range(iters):
        M = [[0.0] * nk for _ in range(nk)]
        rhs = [0.0] * nk
        for j in range(nseg):
            i0, i1 = j, (j + 1) % nk
            for u, (_, p) in zip(us[j], cibles[j]):
                v = 1 - u
                b0, b1, b2, b3 = v ** 3, 3 * u * v * v, 3 * u * u * v, u ** 3
                base = (P[i0][0] * (b0 + b1) + P[i1][0] * (b2 + b3), P[i0][1] * (b0 + b1) + P[i1][1] * (b2 + b3))
                g = ((i0, (T[i0][0] * b1, T[i0][1] * b1)), (i1, (-T[i1][0] * b2, -T[i1][1] * b2)))
                r = (p[0] - base[0], p[1] - base[1])
                for ia, ga in g:
                    rhs[ia] += ga[0] * r[0] + ga[1] * r[1]
                    for ib, gb in g:
                        M[ia][ib] += ga[0] * gb[0] + ga[1] * gb[1]
        for i in range(nk):
            M[i][i] += 1e-6
        L = _resout(M, rhs)
        segs = []
        for j in range(nseg):
            i0, i1 = j, (j + 1) % nk
            segs.append((P[i0], (P[i0][0] + T[i0][0] * L[i0], P[i0][1] + T[i0][1] * L[i0]),
                         (P[i1][0] - T[i1][0] * L[i1], P[i1][1] - T[i1][1] * L[i1]), P[i1]))
        # reparamétrage de Newton
        for j in range(nseg):
            s = segs[j]
            nu = []
            for u, (_, p) in zip(us[j], cibles[j]):
                q, d1 = bez(s, u), _bez_d(s, u)
                den = d1[0] ** 2 + d1[1] ** 2
                nu.append(min(1, max(0, u - ((q[0] - p[0]) * d1[0] + (q[1] - p[1]) * d1[1]) / den)) if den else u)
            us[j] = nu
    err = 0.0
    for j in range(nseg):
        s = segs[j]
        for u, (_, p) in zip(us[j], cibles[j]):
            q = bez(s, u)
            err = max(err, math.hypot(q[0] - p[0], q[1] - p[1]))
    return segs, err, L


def ajuste_c1(segs, tol=0.12, ferme=True, ech=10):
    """Réécrit une chaîne de Hobby en cubiques C1 aux nœuds lisses (poignées égales), avec le
    moins de nœuds possible (écart < tol). Les coins restent des coins."""
    n = len(segs)
    if n == 0:
        return []
    coins = _coins(segs, ferme)
    cycle = ferme and not coins
    # courses entre coins
    if cycle:
        courses = [list(range(n))]
    else:
        if not ferme:
            bornes = coins + [n]
            courses = [list(range(a, b)) for a, b in zip(bornes, bornes[1:])]
        else:
            cs = sorted(coins)
            courses = []
            for i, c0 in enumerate(cs):
                c1 = cs[(i + 1) % len(cs)]
                courses.append([(c0 + q) % n for q in range(((c1 - c0 - 1) % n) + 1)])
    out_par_course = []
    for run in courses:
        m = len(run)
        # échantillons par segment d'origine
        pts_seg = [[bez(segs[k], q / ech) for q in range(1, ech)] for k in run]
        noeuds = [segs[k][0] for k in run] + ([] if cycle else [segs[run[-1]][3]])
        tang = [_tan0(segs[k]) for k in run] + ([] if cycle else [(-_tan1(segs[run[-1]])[0], -_tan1(segs[run[-1]])[1])])
        nn = len(noeuds)
        garde = list(range(nn))                    # nœuds gardés (indices dans noeuds)

        def essai(g):
            P = [noeuds[i] for i in g]
            T = [tang[i] for i in g]
            nseg = len(g) if cycle else len(g) - 1
            cibles = []
            for j in range(nseg):
                a = g[j]
                b = g[(j + 1) % len(g)] if cycle else g[j + 1]
                idx = []
                k = a
                while True:
                    idx.append(k)
                    k = (k + 1) % m if cycle else k + 1
                    if k == b or (not cycle and k >= m):
                        break
                pts = []
                for t, k in enumerate(idx):
                    if t:
                        pts.append(noeuds[k])
                    pts += pts_seg[k]
                # paramètres initiaux à la longueur de corde
                fin = noeuds[b] if cycle or b < nn else noeuds[-1]
                ch = [P[j]] + pts + [fin]
                dist = [0.0]
                for p, q in zip(ch, ch[1:]):
                    dist.append(dist[-1] + math.hypot(q[0] - p[0], q[1] - p[1]))
                tot = dist[-1] or 1
                cibles.append([(d / tot, p) for d, p in zip(dist[1:-1], pts)])
            return _fit_c1(P, T, cibles, cycle)

        res, err, L = essai(garde)
        if err > tol or min(L) <= 0:
            out_par_course.append([segs[k] for k in run])  # repli : Hobby d'origine
            continue
        while True:
            meilleur = None
            cand = garde if cycle else garde[1:-1]
            for i in cand:
                if cycle and len(garde) <= 3:
                    break
                g = [x for x in garde if x != i]
                r2, e2, L2 = essai(g)
                if e2 <= tol and min(L2) > 0 and (meilleur is None or e2 < meilleur[1]):
                    meilleur = (g, e2, r2)
            if not meilleur:
                break
            garde, err, res = meilleur[0], meilleur[1], meilleur[2]
        out_par_course.append(res)
    return [s for c in out_par_course for s in c]
