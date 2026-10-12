#!/usr/bin/env python3
"""Plumio v3 : l'hirondelle au foulard — squelette, pièces et poses.

Usage : python3 plumio.py <dossier>      (écrit <dossier>/poses/<nom>.svg)

Le dessin suit la bible de la v3 : l'anatomie et le gréement de la direction C,
la langue de la direction A (linogravure). Pas de contour autour des pièces ; les
masses sombres se fondent où elles se touchent ; là où une pièce sombre passe
devant une autre, UNE réserve effilée (taille couleur papier, classe p-reserve)
les sépare, toujours à l'intérieur de la silhouette. Le ventre de papier est
cerné d'un seul liseré d'encre effilé, dessiné comme une forme pleine.

Toutes les courbes sont des courbes de Hobby (geo.py) : on donne les points de
passage, l'algorithme choisit des tangentes sûres — pas de coude, pas de vague.
Bibliothèque standard seulement.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geo import (courbe, troncon, inverse, mat_rot, mat_mul, mat_tr, mat_ech, mat_inv, app, xf, MIROIR,  # noqa: E402
                 decale, profil, effile, reserve, fuseau, horaire, ajuste, chemin, fmt, point, tangente,
                 cercle, _ligne, lisse_c1)

# ══ 1. Un petit arbre SVG ══════════════════════════════════════════════════════
# Les pièces rendent des nœuds plutôt que du texte : le même dessin sort soit avec
# tout le squelette (les poses), soit à plat (la vue de profil cachée de « face »).

C1_TOL = 0.14  # écart permis à la mise en C1
TOL = 0.18  # écart permis par la réécriture (unités du viewBox)


def _liste(enfants):
    out = []
    for e in enfants:
        if isinstance(e, (list, tuple)):
            out += _liste(e)
        elif e is not None:
            out.append(e)
    return out


class Trace:
    def __init__(self, attrs, d, cache=False):
        self.attrs, self.d, self.cache = attrs, d, cache

    def svg(self):
        return '<path %sd="%s"/>' % (self.attrs + ' ' if self.attrs else '', self.d)


class Brut:
    """Élément écrit tel quel (cercle, ellipse)."""
    def __init__(self, s):
        self.s, self.cache = s, False

    def svg(self):
        return self.s


class Groupe:
    def __init__(self, cls, enfants, attrs=''):
        self.cls, self.enfants, self.attrs = cls, _liste(enfants), attrs

    def svg(self):
        a = (' class="%s"' % self.cls if self.cls else '') + (' ' + self.attrs if self.attrs else '')
        return '<g%s>%s</g>' % (a, ''.join(e.svg() for e in self.enfants))


SIMPLE = {'actif': False, 'tol': .7}   # vue cachée de « face » : sans réserves, tracé plus grossier


def P(attrs, *chaines, tol=None):
    if SIMPLE['actif']:
        if attrs == RES:
            return None
        tol = SIMPLE['tol']
    return Trace(attrs, chemin(*[ajuste(horaire(c), tol or TOL) for c in chaines]))


def _attr(attrs):
    return attrs + ' ' if attrs else ''


def C(attrs, cx, cy, r):
    return Brut('<circle %scx="%s" cy="%s" r="%s"/>' % (_attr(attrs), fmt(cx), fmt(cy), fmt(r)))


def E(attrs, cx, cy, rx, ry, a=0):
    t = ' transform="rotate(%s %s %s)"' % (fmt(a), fmt(cx), fmt(cy)) if a else ''
    return Brut('<ellipse %scx="%s" cy="%s" rx="%s" ry="%s"%s/>' % (_attr(attrs), fmt(cx), fmt(cy), fmt(rx), fmt(ry), t))


def G(cls, *enfants, attrs=''):
    """Groupe ; une classe de couleur passée dans attrs rejoint la classe du groupe."""
    if attrs.startswith('class="'):
        k = attrs.index('"', 7)
        cls = (cls + ' ' if cls else '') + attrs[7:k]
        attrs = attrs[k + 1:].strip()
    return Groupe(cls, list(enfants), attrs)


def chaine(*noms_et_contenu, attrs=''):
    """g.a > g.b > g.c > contenu : une articulation en chaîne (geste > vie > regard)."""
    *noms, contenu = noms_et_contenu
    for k, n in enumerate(reversed(noms)):
        contenu = G(n, contenu, attrs=attrs if k == len(noms) - 1 else '')
    return contenu


def place(enfants, tr):
    """Placement statique : un <g transform> sans classe, jamais un groupe animé."""
    enfants = enfants if isinstance(enfants, list) else [enfants]
    return Groupe('', enfants, 'transform="%s"' % tr) if tr else enfants


def rot(a, c):
    return 'rotate(%s %s %s)' % (fmt(a), fmt(c[0]), fmt(c[1]))


def matrice(m):
    return 'matrix(%s)' % ' '.join(('%.4f' % v).rstrip('0').rstrip('.') or '0' for v in m)


def a_plat(n, garde=()):
    """Dessin à plat : on retire le caché, on défait les groupes du squelette, on garde
    ceux qui portent une couleur ou un transform, on fusionne les tracés voisins de même couleur."""
    if not isinstance(n, Groupe):
        return [] if n.cache else [n]
    if 'opacity="0"' in n.attrs:
        return []
    fus = []
    for e in [x for k in n.enfants for x in a_plat(k, garde)]:
        if fus and isinstance(e, Trace) and isinstance(fus[-1], Trace) and e.attrs == fus[-1].attrs:
            fus[-1] = Trace(e.attrs, fus[-1].d + e.d)
        else:
            fus.append(e)
    couleur = ' '.join(c for c in n.cls.split() if c.startswith('p-') or c in garde)
    attrs = (('class="%s" ' % couleur if couleur else '') + n.attrs).strip()
    return [Groupe('', fus, attrs)] if attrs else fus


# ══ 2. Couleurs : attributs de repli (la feuille de style les reprend par classe) ═

DOS = 'class="p-dos" fill="#3a342b"'
AILE = 'class="p-aile" fill="#2f2a23"'
TRAIT = 'class="p-trait" fill="#2a251f"'
VENTRE = 'class="p-ventre" fill="#fffdf8"'
OR = 'class="p-or" fill="#c08a2e"'
VIS = 'class="p-vis" fill="#1a1713"'
RES = 'class="p-reserve" fill="#fffdf8"'
KRAFT = 'class="p-kraft" fill="#e8c37a"'
LAGON = 'class="p-lagon" fill="#2f8f88"'
LIGNE = 'class="p-ligne" fill="#a79c8a"'
ACCENT = 'fill="currentColor"'


# ══ 3. Pivots du profil (unités du viewBox, transform-box: view-box) ══════════

PIEDS = (60, 90)          # plumio-pas, plumio-pose : saut, écrasement
HANCHE = (57, 80)         # plumio-buste, plumio-souffle : penché, coup de bec, souffle
HANCHE_AR = (58.6, 72)    # plumio-patte-arriere
HANCHE_AV = (63.4, 72)    # plumio-patte-avant
COU = (64, 45.5)          # plumio-tete*, plumio-foulard* : caché sous la bande du foulard
EPAULE = (60, 43.4)       # plumio-aile* : les quatre dessins d'aile, sous la bande
QUEUE = (46, 75.5)        # plumio-queue* : racine de l'éventail
FILET_HAUT = (46.2, 74)   # plumio-filet-haut : base du filet lointain
FILET_BAS = (47.4, 77.6)  # plumio-filet-bas : base du filet proche
OEIL = (74.2, 31.9)       # plumio-oeil
R_OEIL = 4.3
GOSIER = (80.6, 34.9)     # plumio-bec-bas : la commissure (sous la tête)
BEC = (80.6, 32.6)        # plumio-bec : sa base (agrandi en petit)
SOURCIL = (73.6, 26.4)
NOEUD = (75.6, 47.4)      # plumio-pan* : le nœud


# ══ 4. Pièces du profil ═══════════════════════════════════════════════════════

# ── Tête : calotte plate qui file vers le bec ; sous la bande, elle descend dans le corps
# (cachée au repos) pour couvrir le cou quand elle tourne de ±40°.
TETE = courbe([(55.0, 41.6), (54.7, 35.0), (57.6, 27.8), (64.2, 23.2), (71.6, 22.1), (77.6, 23.5), (81.3, 26.9),
               (82.7, 30.6), (82.3, 34.4), (80.5, 38.9), (77.9, 43.8), (76.9, 50.6), (71.0, 54.6), (62.5, 53.4),
               (57.0, 48.4)])
FRONT_TETE = troncon(TETE, 8.15, 11)        # gorge : du bec au corps (le liseré d'encre)


def gorge(joue=0.0, L=0.0):
    """Gorge de papier : remonte en coupe sous l'œil, file en croissant vers la nuque (elle
    s'effile avant le bord : la calotte reste d'un tenant avec le dos), descend sous le
    foulard. Son liseré d'encre, c'est la tête qui dépasse devant (fin au bec, 0,45 au cou).
    joue > 0 : la joue remonte sous l'œil fermé (le plissé heureux)."""
    haut = courbe([(81.3, 35.2, 'v'), (77.0, 38.1 - joue), (70.6, 38.0 - joue * .6), (63.6, 39.7),
                   (58.9, 41.7, 'v'), (62.6, 46.4 + L * .6), (68.0, 52.8 + L), (76.4, 52.0 + L, 'v')], fermee=False)
    front = FRONT_TETE if not L else troncon(tete_cou(L), 8.15, 11.4)
    lis = decale(front, lambda u: .1 + .38 * min(1, u / 2), 1)
    return haut + [_ligne(haut[-1][3], lis[-1][3])] + inverse(lis) + [_ligne(lis[0][0], haut[0][0])]


def oeil(regard=(0, 0), petit_reflet=True):
    """L'âme : blanc r 4,3, pupille d'encre, un reflet principal et un tout petit. Le groupe
    porte le papier (blanc, reflets, cil hérité). Paupière : disque sombre + le même arc
    heureux que l'œil fermé ; repliée au repos par opacity="0", la feuille la fait battre."""
    ex, ey = OEIL
    px, py = ex + .7 + regard[0], ey + .3 + regard[1]
    pupille = G('plumio-pupille', C(VIS, px, py, 3.2), C('', px + 1.05, py - 1.35, 1.05),
                C('', px - 1.15, py + 1.45, .4) if petit_reflet else None)
    paup = G('plumio-paupiere', C(DOS, ex, ey, R_OEIL + .45), P('', arc_heureux()), attrs='opacity="0"')
    return G('plumio-oeil', C('', ex, ey, R_OEIL), pupille, paup, attrs=VENTRE)


def arc_heureux(c=OEIL, l=8.4, fl=-2.5, ep=1.25):
    """Œil fermé heureux : UN arc effilé (∩), pointes fines, centré sur l'œil."""
    ex, ey = c
    return fuseau((ex - l / 2, ey + 1.6), (ex + l / 2, ey + 1.4), fl, ep)


def bec(ouvert=0):
    """Petit bec d'or en deux mandibules, glissé SOUS la tête (sa base est dans la masse :
    aucun bord de base visible). L'inférieure tourne à la commissure ; la bouche sombre
    ne se voit que bec ouvert."""
    haut = courbe([(79.8, 29.2, 'v'), (84.8, 31.0), (88.9, 34.3, 'v'), (85.0, 34.75), (80.2, 35.1, 'v')])
    bas = courbe([(80.2, 35.0, 'v'), (84.8, 34.95), (87.7, 34.85, 'v'), (84.6, 36.4), (80.4, 37.0, 'v')])
    out = []
    if ouvert:
        out.append(P(VIS, courbe([(79.6, 34.5, 'v'), (85.2, 34.9, 'v'), (80.2, 36.8, 'v')])))
    out += [G('plumio-bec-bas', place(P('', bas), rot(ouvert, GOSIER) if ouvert else '')), P('', haut)]
    return G('plumio-bec', out, attrs=OR)


def sourcil():
    ex, ey = OEIL
    return G('plumio-sourcil', P('', fuseau((ex - 4.0, ey - 4.7), (ex + 2.8, ey - 6.0), -1.0, .5)), attrs=VENTRE)


def tete(regard=(0, 0), ferme=False, ouvert=0, forme=TETE, L=0, petit_reflet=True, sourcil_=True):
    """Bec (dessous), calotte, gorge, sourcil, œil. Fermé : l'œil ouvert reste là, caché
    (opacity 0 sur plumio-oeil), et l'œil heureux vit dans son propre groupe : aucun
    battement de paupière ne peut le rouvrir."""
    out = [bec(ouvert), P('', forme), P(VENTRE, gorge(1.0 if ferme else 0, L))]
    if ferme:
        o = oeil(regard)
        o.attrs = 'fill="#fffdf8" opacity="0"'
        out += [o, G('plumio-oeil-content', P('', arc_heureux()), attrs=VENTRE)]
    else:
        out += [sourcil() if sourcil_ else None, oeil(regard, petit_reflet)]
    return out


# ── Corps : dos sombre, ventre de papier, un seul liseré effilé ──────────────
# Le haut du corps suit la médiane de la bande du foulard (caché dessous) ; à la nuque, une
# petite calotte sombre monte derrière la bande (invisible au repos : sombre sur sombre) et
# bouche l'angle quand la tête plonge.
CORPS = courbe([(43.4, 73.6, 'v'), (47.6, 78.2), (53.6, 80.6), (60.8, 81.2), (68.2, 78.8), (74.4, 72.4), (78.0, 63.6),
                (78.6, 54.6), (78.0, 49.6), (77.0, 46.4), (71.6, 47.0), (66.0, 45.9), (60.0, 43.6), (57.2, 40.3),
                (55.4, 40.4), (55.2, 44.6), (54.0, 50.4), (51.6, 56.8), (47.2, 66.2)])
U_VENTRE = (0.6, 9, 12.2)      # le ventre : du croupion (u0) au coin de la gorge (u1), puis le haut jusqu'à u2
FLANC = [(58.6, 50.6), (56.4, 61.0)]


def corps(contour=CORPS, us=U_VENTRE, flanc_pts=FLANC, w=None):
    """Le ventre de papier va du croupion (u0) au coin de la gorge (u1) le long du devant,
    revient par le haut du corps jusqu'à u2, redescend par le flanc. Son liseré, épais au
    milieu du ventre et fin aux deux bouts, n'est que le corps sombre qui dépasse."""
    u0, u1, u2 = us
    front = troncon(contour, u0, u1)
    w = w or profil((0, .05), (.12, .3), (.45, 1.7), (.72, 1.2), (.92, .5), (1, .42))
    bord = decale(front, lambda u: w(u / len(front)), -1)
    haut = decale(troncon(contour, u1, u2), lambda u: .2, 1)
    h0 = haut[-1][3]
    flanc = courbe([h0 + ('v',)] + flanc_pts + [bord[0][0]], fermee=False)
    return [P('', contour), P(VENTRE, bord + [_ligne(bord[-1][3], haut[0][0])] + haut + flanc)]


# ── Pattes d'encre : un tarse effilé qui remonte derrière le ventre, la culotte de plumes
# (un petit coin sombre) là où il entre dans le ventre, trois doigts ─────────
def patte(x, pied=89.6, ventre=80.8):
    return P('', courbe([(x - .9, 71, 'v'), (x - 1.25, ventre - .4), (x - .55, ventre + 2.6), (x - .5, pied - .5, 'v'),
                         (x - 3.3, pied + .4, 'v'), (x - .2, pied + .1, 'v'), (x + 2.9, pied + .9, 'v'),
                         (x + 1.4, pied - .1, 'v'), (x + 4.6, pied + .5, 'v'), (x + .6, pied - .7, 'v'),
                         (x + .65, ventre + 2.4), (x + 1.3, ventre - .6), (x + .9, 71, 'v')]))


def patte_repliee(x):
    """Patte repliée du saut : tarse court incliné, doigts serrés."""
    return P('', courbe([(x - .9, 71, 'v'), (x - 1.6, 82.4, 'v'), (x - 3.6, 84.6, 'v'), (x - 1.2, 83.8, 'v'),
                         (x + 1.4, 85.8, 'v'), (x - .2, 83.2, 'v'), (x + .9, 71, 'v')]))


def pattes(fn=patte):
    av = fn(HANCHE_AV[0], ventre=80) if fn is patte else fn(HANCHE_AV[0])
    return G('plumio-pattes', G('plumio-patte-arriere', fn(HANCHE_AR[0])), G('plumio-patte-avant', av), attrs=TRAIT)


# ── Queue : deux filets fins en faux, une vraie fourche ; en petit, une fourche épaisse ─
# Les racines plongent loin dans le corps : à ±15° de queue, rien ne sort sous le ventre.
FILET_H = courbe([(52.6, 72.2), (47.4, 73.4), (31, 76.2), (16, 76.9), (2.6, 75.2)], fermee=False)
FILET_B = courbe([(53.4, 74.2), (48.4, 75.9), (33.6, 82.8), (18.6, 86.8), (4, 87.7)], fermee=False)
LARG_H = profil((0, 3.6), (.25, 5.6), (.46, 2.7), (.79, .95), (1, 0))
LARG_B = profil((0, 3.0), (.25, 4.2), (.46, 2.9), (.79, 1), (1, 0))
# En petit (< 40 px) : une fourche franche, deux lames de 2,4 u écartées de 16°, sans fil.
PETITE_FOURCHE = 'M48 72.4l-36 2.4-2.6 1.5 2.8 1.2 36.4-1.6zm.4 4.2-35 9.4-2.2 2 3 .3 35-7.2z'


def queue(rq=0, rh=0, rb=0, filets=(FILET_H, FILET_B), fourche=PETITE_FOURCHE):
    haut = P('', effile(filets[0], LARG_H))
    bas = P('', effile(filets[1], LARG_B))
    petit = G('plumio-petit-filets', Trace('', fourche), attrs='opacity="0"')
    contenu = [G('plumio-filet-haut', place(haut, rot(rh, FILET_HAUT) if rh else '')),
               G('plumio-filet-bas', place(bas, rot(rb, FILET_BAS) if rb else '')), petit]
    return chaine('plumio-queue', 'plumio-queue-vie', place(contenu, rot(rq, QUEUE) if rq else ''))


# ── Ailes : quatre dessins de remplacement sur la même épaule (sous la bande) ──
# Les racines de levée, ouverte et pointe restent SOUS la bande : l'aile sort du foulard
# comme une main d'une manche ; aucun lobe sur le papier. Bords d'attaque d'un seul trait.
AILES = {
    # repliée : faux longue, la pointe croise la base de la queue
    'pliee': courbe([(60.5, 44), (52.8, 56.8), (41.4, 69.6), (18, 80.2, 'v'), (36.4, 77), (54.4, 69), (64.6, 58.4),
                     (67.6, 49.6)]),
    # levée : dressée vers l'arrière (coucou)
    'levee': courbe([(57.0, 42.2, 'v'), (62.8, 44.6, 'v'), (62.2, 38.6), (57.6, 30.4), (48.4, 21.2), (30.6, 12.4, 'v'),
                     (41.4, 21.6), (49.6, 29.8), (54.6, 37.0)]),
    # ouverte : grande ouverte, vers le haut
    'ouverte': courbe([(57.0, 42.2, 'v'), (62.8, 44.6, 'v'), (63.8, 36.2), (61.0, 25.2), (54.2, 14.2), (40.4, 3.6, 'v'),
                       (47.6, 14.6), (52.0, 24.6), (55.0, 34.4)]),
    # pointe : file sous la bande, sort du foulard au cou, puis UNE longue rémige
    'pointe': courbe([(66.4, 45.4, 'v'), (71.6, 46.0), (75.4, 45.8), (79.4, 45.0), (84.2, 43.5), (89.2, 41.6),
                      (94.4, 39.4, 'v'), (89.6, 42.4), (84.8, 44.9), (80.6, 47.0), (76.8, 48.2), (71.6, 47.8),
                      (66.4, 46.7, 'v')]),
}
ETATS = ('pliee', 'levee', 'ouverte', 'pointe')
# Une réserve par recouvrement : (début, fin sur le contour, profil d'épaisseur, côté intérieur).
RESERVES = {
    'pliee': [(0, 2.75, profil((0, 0), (.12, .55), (.6, .75), (1, 0)), -1)],    # sur le dos, puis la queue
    'levee': [(1.15, 3.2, profil((0, 0), (.25, .55), (1, 0)), -1)],            # sur la nuque
    'ouverte': [(1.1, 3.1, profil((0, 0), (.25, .55), (1, 0)), -1)],
    'pointe': [],                                                              # devant la gorge : rien à séparer
}
POIGNET = {'pliee': fuseau((57.6, 61.4), (49.6, 68.4), .5, .45)}             # la seule taille en plus


def aile(etat, formes=AILES, reserves=RESERVES, poignets=POIGNET):
    forme = formes[etat]
    out = [P('', forme)]
    for u0, u1, w, sg in reserves.get(etat, []):
        out.append(P(RES, reserve(troncon(forme, u0, u1), w, sg), tol=.1))
    if etat in poignets:
        out.append(P(RES, poignets[etat]))
    return out


def ailes(visible, formes=AILES, reserves=RESERVES, rot_aile=0, poignets=POIGNET, etats=ETATS):
    groupes = [G('plumio-aile-' + e, aile(e, formes, reserves, poignets), attrs='' if e == visible else 'opacity="0"')
               for e in etats]
    return G('plumio-aile', G('plumio-aile-vie', place(groupes, rot(rot_aile, EPAULE) if rot_aile else '')), attrs=AILE)


# ── Foulard : une bande d'étoffe (2,8 à la gorge, 1,6 où elle passe derrière la nuque, bouts
# taillés sur le contour du cou), un nœud en petit coussin pincé, deux pans fendus. ──
MEDIANE = [(55.3, 41.3), (60.0, 43.9), (66.0, 45.9), (71.6, 46.9), (75.6, 46.6)]
LARGEUR = profil((0, 1.9), (.3, 2.8), (.6, 3.3), (.8, 3.3), (1, 2.8))


BOMBE = (.6, .35)


def bande_etoffe(med=MEDIANE, larg=LARGEUR, bombe=None):
    """La bande : deux bords décalés de la médiane, deux bouts bombés qui épousent le cou."""
    bombe = bombe or BOMBE
    m = courbe(med, fermee=False)
    n = len(m)
    bas = decale(m, lambda u: larg(u / n) / 2, 1)
    haut = decale(m, lambda u: larg(u / n) / 2, -1)
    t0, t1 = tangente(m, 0), tangente(m, n)
    p0, p1 = m[0][0], m[-1][3]
    b0 = (p0[0] - t0[0] * bombe[0], p0[1] - t0[1] * bombe[0])
    b1 = (p1[0] + t1[0] * bombe[1], p1[1] + t1[1] * bombe[1])
    bout1 = courbe([haut[-1][3] + ('v',), b1, bas[-1][3] + ('v',)], fermee=False)
    bout0 = courbe([bas[0][0] + ('v',), b0, haut[0][0] + ('v',)], fermee=False)
    return haut + bout1 + inverse(bas) + bout0


COUSSIN = (3.0, 3.8)
COUSSIN_A = -10
RES_NOEUD = (.9, 1.82)
PINCE = (.25, .45)


def coussin(c=None, l=None, h=None, a=None, pince=None):
    """Le nœud : un petit coussin aux coins arrondis, pincé à la taille (deux lobes inégaux).
    l : largeur le long de la bande, h : hauteur en travers. Nœuds dans le sens horaire à
    l'écran, en partant du coin bas-gauche (le côté gauche, qui reçoit la bande, va de u = 0 à 2)."""
    c, a = c or NOEUD, COUSSIN_A if a is None else a
    l, h = l or COUSSIN[0], h or COUSSIN[1]
    pl, pc = pince or PINCE
    x, y = l / 2, h / 2
    pts = [(-x + .45, y - .1), (-x + pl, .1), (-x + .5, -y + .1), (-.05, -y + pc), (x - .45, -y),
           (x - pl * .7, -.1), (x - .5, y - .05), (.05, y - pc)]
    m = mat_mul(mat_tr(*c), mat_rot(a))
    return courbe([app(m, p) for p in pts])


PAN_LONG = [(74.6, 49.0), (72.2, 51.0), (70.2, 53.6), (69.0, 56.6)]
PAN_COURT = [(75.6, 49.2), (75.6, 52.0), (74.8, 54.9)]


def pans_foulard(long_=PAN_LONG, court=PAN_COURT):
    """Deux pans asymétriques en queue d'hirondelle : le long file en arrière, le court pend.
    Le court passe devant le long ; UNE réserve les sépare, près du nœud."""
    a = courbe(long_, fermee=False)
    b = courbe(court, fermee=False)
    pa = effile(a, profil((0, 2.2), (.5, 2.6), (1, 2.9)), encoche=1.4)
    pb = effile(b, profil((0, 2.1), (.5, 2.4), (1, 2.7)), encoche=1.3)
    nb = len(b)
    bord = troncon(decale(b, lambda u: (2.1 + .3 * u / nb) / 2, 1), 0, nb * .34)
    res = reserve(bord, profil((0, .5), (.5, .4), (1, 0)), -1, .1)
    return [P('', pa, pb), P(RES, res, tol=.08)]


def foulard(rf=0, pans=0, tr='', med=None, larg=None, noeud=None, pan_long=None, pan_court=None, coussin_a=None):
    """Bande + nœud en un seul tracé (même couleur), pans dessous ; une réserve détache le nœud
    de la bande (côté nuque)."""
    med, larg, noeud = med or MEDIANE, larg or LARGEUR, noeud or NOEUD
    pan_long, pan_court, coussin_a = pan_long or PAN_LONG, pan_court or PAN_COURT, coussin_a or COUSSIN_A
    k = coussin(noeud, a=coussin_a)
    res_noeud = reserve(troncon(k, RES_NOEUD[0], RES_NOEUD[1]), profil((0, 0), (.4, .45), (1, 0)), 1, .12)
    pan = chaine('plumio-pan', 'plumio-pan-vie', place(pans_foulard(pan_long, pan_court), rot(pans, noeud) if pans else ''))
    contenu = [pan, P('', bande_etoffe(med, larg), k), P(RES, res_noeud, tol=.08)]
    return G('plumio-foulard', G('plumio-foulard-vie', place(contenu, tr or (rot(rf, COU) if rf else ''))), attrs=ACCENT)


# ══ 5. Le squelette ═══════════════════════════════════════════════════════════
#   svg.plumio.plumio--<pose>
#    g.plumio-pas > g.plumio-pose > [g.plumio-pattes > (patte-arriere, patte-avant),
#      g.plumio-buste > g.plumio-souffle > [queue > queue-vie > (filet-haut, filet-bas, petit-filets),
#        tete > tete-vie > tete-regard > (bec > bec-bas, calotte, gorge, sourcil, oeil > (pupille, paupiere)),
#        dos, ventre, aile > aile-vie > (4 états), foulard > foulard-vie > (pan > pan-vie, bande + nœud)]]
#   La tête est dessinée SOUS le corps : le cou du corps et la bande du foulard couvrent
#   la jointure, la tête tourne de -40° à +40° sans couture.

COMMENTAIRE = (
    '<!-- Plumio v3. Pivots (viewBox, transform-box:view-box) : pas,pose %s ; buste,souffle %s ; patte-arriere %s ; '
    'patte-avant %s ; tete*,foulard* %s ; pan* %s ; aile* %s ; queue* %s ; filet-haut %s ; filet-bas %s ; oeil %s ; '
    'bec-bas %s. Couplages : foulard = 40 %% de la tete ; pans +60-90 ms ; filets en retard sur la queue ; '
    'etats d\'aile echanges par opacity ; un groupe anime ne porte jamais de transform. -->'
)


def _commentaire():
    return COMMENTAIRE % tuple('%s %s' % (fmt(p[0]), fmt(p[1])) for p in
                               (PIEDS, HANCHE, HANCHE_AR, HANCHE_AV, COU, NOEUD, EPAULE, QUEUE, FILET_HAUT, FILET_BAS,
                                OEIL, GOSIER))


def svg(nom, contenu, racine=None, commentaire=False, classes=''):
    if racine:
        contenu = Groupe('', [contenu], 'transform="%s"' % racine)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" class="plumio plumio--%s%s" color="#1a5fb4" '
            'aria-hidden="true">%s%s</svg>' % (nom, classes, _commentaire() if commentaire else '',
                                                                 contenu.svg()))


def oiseau(etat='pliee', tete_rot=0, regard=(0, 0), ferme=False, bec_ouvert=0, queue_rot=0, filets=(0, 0),
           foulard_rot=0, pans=0, aile_rot=0, buste_rot=0, decal='', pattes_=None, corps_=None, formes=AILES,
           reserves=RESERVES, poignets=POIGNET, arriere=None, pose_tr='', extra=None, avant=None, tete_forme=TETE,
           cou_tr='', foulard_kw=None, queue_=None, buste_pivot=HANCHE, gorge_long=0, etats=ETATS,
           petit_reflet=True, sourcil_=True, objet=None):
    """L'arbre complet d'une pose. Les angles de la pose vont sur des <g> intérieurs :
    l'animation CSS des groupes nommés s'y ajoute sans rien écraser. cou_tr : placement
    statique du cou (picore), posé AUTOUR de plumio-tete et de plumio-foulard pour que
    leur pivot voyage avec le cou."""
    q = queue_ or queue(queue_rot, *filets)
    t = chaine('plumio-tete', 'plumio-tete-vie', 'plumio-tete-regard',
               place(tete(regard, ferme, bec_ouvert, tete_forme, gorge_long, petit_reflet, sourcil_),
                     rot(tete_rot, COU) if tete_rot else ''))
    cs = corps_ or corps()
    f = foulard(foulard_rot, pans, **(foulard_kw or {}))
    milieu = [q, place(t, cou_tr)] + cs
    interieur = [arriere] + milieu + [ailes(etat, formes, reserves, aile_rot, poignets, etats), place(f, cou_tr), avant,
                                      objet]
    buste = G('plumio-buste', G('plumio-souffle', place(interieur, rot(buste_rot, buste_pivot) if buste_rot else ''), attrs=DOS))
    return G('plumio-pas', G('plumio-pose', place([place([pattes_ or pattes(), buste], pose_tr), extra], decal)))


# ══ 7. Picore : dessin dédié, tête basse ══════════════════════════════════════
# Le buste penche depuis la hanche (rotation statique sous plumio-souffle) ; le cou s'étire :
# tête et foulard sont posés par une translation statique AUTOUR de plumio-tete et de
# plumio-foulard (leur pivot 64 45,5 voyage avec le cou) ; seule la rotation de la tête autour
# de ce pivot reste à l'intérieur. Tout l'oiseau est décalé à gauche par un <g> racine.
PIC = dict(tangage=40, pivot=(60, 73), decal=-14, T=78, pointe=(88, 91.8), cou=None, psi=24, pans=-60, queue=16,
           filets=(8, -6), regard=(.7, .9), cou_long=9)
# Le corps de picore : le haut est un dôme d'épaule (pas de calotte de nuque, pas de coupe sous
# la bande) ; le cou sort de derrière lui.
CORPS_PICORE = courbe([(43.4, 73.6, 'v'), (47.6, 78.2), (53.6, 80.6), (60.8, 81.2), (68.2, 78.8), (74.4, 72.4),
                       (78.0, 63.6), (78.6, 54.6), (77.4, 48.6), (72.6, 44.2), (65.0, 41.6), (58.4, 41.6),
                       (55.4, 44.6), (54.0, 50.4), (51.6, 56.8), (47.2, 66.2)])


PIC_VENTRE = (0.6, 7.8, 9.1)
PIC_FLANC = [(70.8, 54.6), (63.6, 65.6)]


def tete_cou(L):
    """La tête de picore : la même, prolongée d'un cou (son bas descend de L, caché dans le corps)."""
    return courbe([(55.0, 41.6), (54.7, 35.0), (57.6, 27.8), (64.2, 23.2), (71.6, 22.1), (77.6, 23.5), (81.3, 26.9),
                   (82.7, 30.6), (82.3, 34.4), (80.5, 38.9), (77.9, 43.8), (77.2, 50.6 + L * .7), (75.4, 53.6 + L),
                   (66.0, 55.6 + L), (57.4, 52.6 + L), (55.6, 47.6 + L * .5)])


def picore_tr(p=None):
    """Matrices de pose : B (corps, repère du buste), N (translation du cou dans ce repère).
    Si p['pointe'] est donné (pointe du bec à l'écran), le cou s'en déduit."""
    p = p or PIC
    S = mat_tr(p['decal'], 0)
    Rp = mat_rot(p['tangage'], *p['pivot'])
    B = mat_mul(S, Rp)
    cou = p['cou']
    if p.get('pointe'):
        v = app(mat_rot(p['T']), (88.9 - COU[0], 34.3 - COU[1]))
        cou = (p['pointe'][0] - v[0], p['pointe'][1] - v[1])
    cible = app(mat_inv(B), cou)
    return B, (cible[0] - COU[0], cible[1] - COU[1])


def encre(x, y):
    """Petite marque d'encre à l'impact (cachée ; le geste la fait apparaître), centrée sur la pointe."""
    return G('plumio-encre', P('', courbe([(x - 2.6, y + .2), (x - .4, y - .7), (x + 2.4, y - .1), (x + .8, y + .9),
                                           (x - 1.8, y + .9)])), C('', x - 4.2, y - 1.0, .55), C('', x + 4.0, y - 1.2, .45),
             attrs=TRAIT + ' opacity="0"')


def picore(p=None):
    p = p or PIC
    B, n = picore_tr(p)
    phi = p['T'] - p['tangage']
    psi = phi if p['psi'] is None else p['psi']
    tr = 'translate(%s %s)' % (fmt(n[0]), fmt(n[1]))
    pointe = app(mat_mul(B, mat_mul(mat_tr(*n), mat_rot(phi, *COU))), (88.9, 34.3))
    return oiseau(tete_rot=phi, regard=p['regard'], foulard_rot=psi, pans=p['pans'], queue_rot=p['queue'],
                  filets=p['filets'], buste_rot=p['tangage'], cou_tr=tr, extra=encre(pointe[0] - p['decal'], 92.2),
                  buste_pivot=p['pivot'], tete_forme=tete_cou(p['cou_long']), gorge_long=p['cou_long'],
                  corps_=corps(CORPS_PICORE, PIC_VENTRE, PIC_FLANC))


# ══ 8. Vol : corps de vol dédié ═══════════════════════════════════════════════
# Dessiné en coordonnées d'écran, ramené dans le repère debout par l'inverse de VOL : un
# seul <g transform> sous plumio-pose pose l'oiseau en vol, et les pivots du tableau
# (cou, épaule, queue, nœud) restent justes. Corps fin, ventre de papier effilé aux deux
# bouts, pattes rentrées DANS le corps (cachées), racines d'aile sous la bande. Cycle de
# battement : ouverte (haut) → levee (mi-course) → battue (bas, filé) → pliee (plané).
VOL = mat_mul(mat_tr(-15, -12), mat_mul(mat_ech(.9, .9, 57, 80), mat_rot(38, 57, 80)))
VOLI = mat_inv(VOL)
EPAULE_LOIN = tuple(round(v, 1) for v in app(VOLI, (67.4, 45.2)))


def ecran(noeuds, fermee=True):
    return xf(courbe(noeuds, fermee), VOLI)


CORPS_VOL = ecran([(36.0, 56.6, 'v'), (42.0, 61.6), (52.0, 62.6), (62.0, 60.2), (70.0, 56.2), (74.8, 51.8),
                   (74.6, 48.6), (69.6, 47.4), (64.0, 45.6), (59.4, 43.4), (56.2, 44.0), (51.4, 46.0), (45.0, 49.0),
                   (39.6, 52.8)])
VENTRE_VOL = (0.5, 6.0, 7.6)
FLANC_VOL = [(64.0, 54.0), (52.0, 58.4)]
AILES_VOL = {
    'ouverte': ecran([(59.8, 43.4, 'v'), (66.0, 45.8, 'v'), (64.8, 38.4), (61.0, 27.8), (54.6, 16.8), (44.0, 4.6, 'v'),
                      (49.4, 15.6), (53.2, 26.6), (56.4, 35.6)]),
    'levee': ecran([(59.8, 43.4, 'v'), (66.0, 45.8, 'v'), (59.4, 40.0), (47.6, 34.0), (33.6, 29.8), (20.6, 30.4, 'v'),
                    (33.0, 35.0), (45.0, 39.6), (53.6, 42.0)]),
    'battue': ecran([(61.0, 44.0, 'v'), (66.4, 46.0, 'v'), (64.8, 53.6), (59.6, 63.6), (51.2, 73.6, 'v'), (54.6, 63.4),
                     (57.6, 53.6)]),
    'pliee': ecran([(59.6, 43.2, 'v'), (66.2, 46.0, 'v'), (58.8, 50.4), (47.6, 54.8), (31.4, 60.6, 'v'), (44.6, 53.0),
                    (53.6, 47.6)]),
    'pointe': ecran([(68.0, 47.0, 'v'), (75.6, 49.6), (82.6, 48.2), (93.6, 43.4, 'v'), (83.4, 50.8), (75.8, 52.4),
                     (69.2, 49.8, 'v')]),
}
ETATS_VOL = ('pliee', 'levee', 'ouverte', 'pointe', 'battue')
RESERVES_VOL = {
    'ouverte': [(2.05, 3.55, profil((0, 0), (.3, .55), (1, 0)), -1)],     # devant la tête
    'levee': [(5.0, 7.0, profil((0, 0), (.5, .5), (1, 0)), -1)],         # sur le dos
    'pliee': [(1.2, 3.0, profil((0, 0), (.3, .5), (1, 0)), -1)],
    'battue': [], 'pointe': [],
}
FILE_VOL = {'battue': fuseau((61.4, 55.0), (55.4, 66.4), -.4, .45)}      # le filé du battement
AILE_LOIN_VOL = ecran([(66.6, 44.6), (69.2, 37.4), (67.4, 26.8), (62.6, 15.2), (55.2, 2.8, 'v'), (59.4, 14.6),
                       (62.2, 25.8), (63.4, 36.6), (63.6, 44.2)])


def corps_vol():
    u0, u1, u2 = VENTRE_VOL
    front = troncon(CORPS_VOL, u0, u1)
    w = profil((0, 0), (.18, .6), (.55, 1.3), (.85, .55), (1, .3))
    bord = decale(front, lambda u: w(u / len(front)), -1)
    haut = decale(troncon(CORPS_VOL, u1, u2), lambda u: .15, -1)
    flanc = courbe([haut[-1][3] + ('v',)] + [app(VOLI, q) for q in FLANC_VOL] + [bord[0][0]], fermee=False)
    return [P('', CORPS_VOL), P(VENTRE, bord + [_ligne(bord[-1][3], haut[0][0])] + haut + flanc)]


def vol(etat='ouverte', tete_rot=-32, regard=(.5, -.1), bec=0, extra=None, ferme=False, pans=34):
    arriere = G('plumio-aile-arriere', P('', AILE_LOIN_VOL), attrs=AILE)
    rentrees = P('', ecran([(47.4, 57.4, 'v'), (51.6, 59.6, 'v'), (48.4, 59.8, 'v'), (51.0, 61.0, 'v'),
                            (46.6, 59.6, 'v')]))
    pat = G('plumio-pattes', G('plumio-patte-arriere', rentrees), G('plumio-patte-avant'), attrs=TRAIT)
    return oiseau(etat, tete_rot=tete_rot, regard=regard, foulard_rot=tete_rot, pans=pans, queue_rot=-30,
                  filets=(18, -16), corps_=corps_vol(), formes=AILES_VOL, reserves=RESERVES_VOL, poignets=FILE_VOL,
                  arriere=arriere, pattes_=pat, pose_tr=matrice(VOL), etats=ETATS_VOL, bec_ouvert=bec, extra=extra,
                  ferme=ferme)


# ══ 9. Face : l'accueil, de trois-quarts ══════════════════════════════════════
# Construction 3/4 : tête-sphère tournée de ~28° vers la droite (le bec vers l'avant-droite),
# œil proche presque au centre, œil lointain raccourci 1,7 u dans le contour, bec entre les
# deux, côté lointain, dont la pointe perce la joue lointaine. Corps penché de ~12°, ventre
# rond vers nous, aile proche repliée dont la pointe croise une queue fourchue (V net), aile
# lointaine en masse d'épaule le long du flanc droit. Foulard : bande en U sous la tête, nœud
# un peu côté proche, pans qui tombent sur l'épaule lointaine.
F_DX = -12                    # la vue de profil (et les pattes communes) : pieds sous la vue de face
F_PIEDS = (49, 90)
F_HANCHE = (51, 81)
F_COU = (52, 46)
F_EPAULE = (43.6, 50)
F_EPAULE_LOIN = (61.4, 49)
F_QUEUE = (40, 77)
F_OEIL1 = (46.8, 30.8)        # œil proche
F_OEIL2 = (59.6, 29.6)        # œil lointain, raccourci
F_GOSIER = (57.6, 37.2)
F_NOEUD = (48.4, 48.4)

TETE_F = courbe([(37.6, 34.0), (38.4, 27.4), (41.8, 22.4), (47.6, 19.9), (54.2, 19.4), (60.4, 20.6), (64.8, 24.2),
                 (66.6, 29.4), (65.6, 33.8), (63.2, 37.6), (59.4, 41.8), (53.6, 45.6), (46.8, 46.8), (41.4, 45.2),
                 (38.4, 40.6)])
F_OEIL1 = (47.6, 30.6)        # œil proche
F_OEIL2 = (60.6, 29.6)        # œil lointain, raccourci (2,2 × 4)


def gorge_f(joue=0):
    """Le papier du bas du visage : une coupe qui monte en pointe sous l'œil proche, plonge à
    la gorge sous le bec, remonte se glisser sous l'œil lointain ; côté nuque, un croissant."""
    return courbe([(39.8, 42.8, 'v'), (43.4, 39.0), (47.8, 35.8 - joue, 'v'), (51.6, 37.6), (55.2, 38.8),
                   (58.6, 40.6), (61.2, 39.4), (62.8, 36.6 - joue, 'v'), (62.0, 39.8), (58.0, 43.8), (52.4, 46.6),
                   (46.0, 47.4), (41.4, 45.8)])


def oeil_f(c, rx, ry, dx, dy, rr):
    ex, ey = c
    k = rx / ry
    px, py = ex + dx, ey + dy
    blanc = C('', ex, ey, rx) if rx == ry else E('', ex, ey, rx, ry)
    pup = C(VIS, px, py, 2.9) if k > .97 else E(VIS, px, py, 2.9 * k, 2.9)
    lid = C(DOS, ex, ey, rx + .45) if rx == ry else E(DOS, ex, ey, rx + .45, ry + .45)
    paup = G('plumio-paupiere', lid, P('', fuseau((ex - rx * .95, ey + 1.4), (ex + rx * .95, ey + 1.3), -2.3 * k ** .5,
                                                   1.1 * k ** .3)), attrs='opacity="0"')
    return G('plumio-oeil', blanc, G('plumio-pupille', pup, C('', px + .95 * k, py - 1.2, rr)), paup, attrs=VENTRE)


def bec_f():
    """Bec en cône de 3/4 (petit triangle arrondi, pointe vers nous et un peu en bas, qui perce
    la joue lointaine). Facette du dessus marquée par une taille le long de l'arête ; commissure
    proche en coin sombre ; mandibule inférieure plus petite. Les plumes du front (un croissant
    de calotte posé dessus) couvrent sa base : aucun bord de base visible."""
    haut = courbe([(52.8, 34.6, 'v'), (55.0, 33.2), (57.6, 32.9), (59.0, 33.8, 'v'), (59.5, 36.2), (58.6, 39.4, 'v'),
                   (56.6, 37.9), (54.4, 36.3)])
    bas = courbe([(54.2, 36.9, 'v'), (56.5, 38.3), (58.3, 39.9, 'v'), (56.1, 40.3), (54.7, 38.9)])
    bouche = fuseau((53.0, 35.1), (58.2, 39.5), -.5, .5)
    arete = fuseau((57.6, 33.7), (58.8, 38.2), .25, .34)
    plumes = courbe([(51.8, 35.0, 'v'), (53.4, 32.8), (56.4, 31.8), (59.2, 32.4), (60.2, 34.2, 'v'), (57.8, 33.2),
                     (55.0, 33.4)])
    return [G('plumio-bec', P(VIS, bouche), G('plumio-bec-bas', P('', bas)), P('', haut), P(RES, arete), attrs=OR),
            P('', plumes)]


def tete_f(ferme=False):
    sourcils = P('', fuseau((43.6, 25.4), (50.6, 24.6), -1.0, .5), fuseau((58.8, 24.0), (62.4, 24.6), -.6, .36))
    return [P('', TETE_F), P(VENTRE, gorge_f(1 if ferme else 0)), G('plumio-sourcil', sourcils, attrs=VENTRE),
            oeil_f(F_OEIL1, 3.95, 3.95, -.4, .45, 1.0), oeil_f(F_OEIL2, 2.2, 4.0, -.4, .45, .75), bec_f()]


# Le corps est celui du profil, tourné de ~35° vers nous (raccourci en x), cou sous la tête de
# face : la silhouette reste celle d'une hirondelle (corps en diagonale, queue fourchue qui file
# à gauche) ; la tête, elle, se tourne davantage vers nous.
CORPS_M = mat_mul(mat_tr(51.4, 1.6), mat_mul(mat_ech(.8, 1), mat_tr(-66, 0)))      # x' = 51,4 + 0,8 (x - 66)
QUEUE_M = mat_mul(mat_tr(51.4, 1.6), mat_mul(mat_ech(.66, 1), mat_tr(-66, 0)))     # la queue fuit : plus raccourcie
# Le corps du profil sans la calotte de nuque (la tête de face ne plonge pas).
CORPS_FACE = courbe([(43.4, 73.6, 'v'), (47.6, 78.2), (53.6, 80.6), (60.8, 81.2), (68.2, 78.8), (74.4, 72.4), (78.0, 63.6),
                     (78.6, 54.6), (78.0, 49.6), (77.0, 46.4), (71.6, 47.0), (66.0, 45.9), (60.0, 43.6), (55.6, 42.4),
                     (54.6, 48.4), (51.6, 56.8), (47.2, 66.2)])
AILE_F_LOIN = courbe([(57.4, 48.0, 'v'), (60.4, 50.6), (61.6, 55.0), (61.0, 59.8, 'v'), (59.8, 55.2), (58.2, 51.0)])
# aile proche, repliée le long du flanc gauche (son bord d'attaque EST le contour) : le ventre reste entier
AILE_F_PLIEE = courbe([(44.6, 46.4, 'v'), (40.8, 51.0), (38.9, 57.6), (36.9, 64.6), (32.8, 71.0), (24.2, 77.4),
                       (12.4, 82.4, 'v'), (23.8, 79.2), (33.8, 74.4), (39.6, 68.4), (42.8, 61.6), (45.0, 54.6),
                       (46.6, 48.8)])
AILE_F_LEVEE = courbe([(41.0, 45.0, 'v'), (47.0, 47.8, 'v'), (43.6, 42.0), (36.8, 34.6), (26.6, 27.8), (16.6, 23.8, 'v'),
                       (25.0, 31.2), (33.0, 39.0), (38.2, 44.8)])
FOURCHE_F = 'M40.6 74l-28 2-2.4 1.5 2.7 1.1 28-.6zm.8 3.2-23.2 9.6-1.6 2.2 3-.3 22.4-8.6z'


def foulard_f():
    med = [(39.8, 43.8), (44.6, 47.0), (50.6, 48.8), (57.0, 48.4), (62.6, 45.4)]
    larg = profil((0, 1.5), (.3, 2.5), (.55, 2.85), (.8, 2.5), (1, 1.6))
    k = coussin(F_NOEUD, 3.0, 3.6, 4)
    res_k = reserve(troncon(k, .9, 1.85), profil((0, 0), (.4, .45), (1, 0)), 1, .12)
    a = courbe([(49.6, 50.2), (53.2, 52.0), (57.2, 53.4), (61.2, 56.0)], fermee=False)
    b = courbe([(49.0, 50.6), (51.6, 53.6), (53.8, 57.0)], fermee=False)
    pa = effile(a, profil((0, 1.9), (.5, 2.1), (1, 2.35)), encoche=1.2)
    pb = effile(b, profil((0, 1.8), (.5, 2.0), (1, 2.2)), encoche=1.1)
    nb = len(b)
    bord = troncon(decale(b, lambda u: (1.8 + .2 * u / nb) / 2, -1), 0, nb * .4)
    res_p = reserve(bord, profil((0, .5), (.5, .4), (1, 0)), 1, .1)
    pan = chaine('plumio-pan', 'plumio-pan-vie', [P('', pa, pb), P(RES, res_p, tol=.08)])
    return G('plumio-foulard', G('plumio-foulard-vie', pan, P('', bande_etoffe(med, larg, (.3, .3)), k),
                                 P(RES, res_k, tol=.08)), attrs=ACCENT)


def vue_face():
    fh = xf(FILET_H, QUEUE_M)
    fb = xf(FILET_B, QUEUE_M)
    filets = [G('plumio-filet-haut', P('', effile(fh, LARG_H))), G('plumio-filet-bas', P('', effile(fb, LARG_B))),
              G('plumio-petit-filets', Trace('', FOURCHE_F), attrs='opacity="0"')]
    contour = xf(CORPS_FACE, CORPS_M)
    u0, u1, u2 = U_VENTRE
    front = troncon(contour, u0, u1)
    w = profil((0, .05), (.12, .3), (.45, 1.5), (.72, 1.1), (.92, .5), (1, .42))
    bord = decale(front, lambda u: w(u / len(front)), -1)
    haut = decale(troncon(contour, u1, u2), lambda u: .2, 1)
    flanc = courbe([haut[-1][3] + ('v',)] + [app(CORPS_M, q) for q in FLANC] + [bord[0][0]], fermee=False)
    dos = [P('', contour), P(VENTRE, bord + [_ligne(bord[-1][3], haut[0][0])] + haut + flanc)]
    t = chaine('plumio-tete', 'plumio-tete-vie', 'plumio-tete-regard', tete_f())
    aile = AILE_F_PLIEE
    res = P(RES, reserve(troncon(aile, 1.2, 5.6), profil((0, 0), (.15, .5), (.7, .6), (1, 0)), 1), tol=.12)
    a = G('plumio-aile-gauche', G('plumio-aile', G('plumio-aile-vie', G('plumio-aile-pliee', P('', aile), res),
                                                    G('plumio-aile-levee', P('', AILE_F_LEVEE), attrs='opacity="0"')),
                                  attrs=AILE))
    loin = G('plumio-aile-droite', G('plumio-aile-arriere', P('', AILE_F_LOIN), attrs=AILE))
    buste = G('plumio-buste', G('plumio-souffle', loin, chaine('plumio-queue', 'plumio-queue-vie', filets), dos, t, a,
                                foulard_f(), attrs=DOS))
    return G('plumio-vue-face', buste)


def patte_f(x, pied, s):
    return P('', courbe([(x - .9, 74, 'v'), (x - .6, pied - .5, 'v'), (x - 3.2 * s, pied + .3, 'v'), (x - .2, pied + .1, 'v'),
                         (x + 1.8 * s, pied + 1.2, 'v'), (x + .9, pied - .1, 'v'), (x + 3.8 * s, pied + .5, 'v'),
                         (x + .7, pied - .7, 'v'), (x + .9, 74, 'v')]))


def vue_profil():
    """La vue de profil d'« attend », à plat (sans squelette, une seule aile, sans reflet
    secondaire ni sourcil), posée pieds sur les pieds de la vue de face."""
    SIMPLE['actif'] = True
    try:
        o = oiseau(petit_reflet=False, sourcil_=False, pattes_=G('sans'))
    finally:
        SIMPLE['actif'] = False
    # Le décalage va sur un groupe intérieur : plumio-vue-profil est animé (demi-tour).
    return Groupe('plumio-vue-profil', [Groupe('', a_plat(o.enfants[0]), 'transform="translate(%s 0)"' % fmt(F_DX))],
                  'opacity="0"')


def face():
    """Les pattes sont communes aux deux vues (posées sur place pendant le demi-tour) : ce sont
    celles du profil, décalées comme la vue de profil (les pivots du tableau restent vrais)."""
    return G('plumio-pas', G('plumio-pose', place(pattes(), 'translate(%s 0)' % fmt(F_DX)), vue_face(), vue_profil()))


# ══ 9b. Gestes : ailes dédiées et objets ══════════════════════════════════════
# Chaque pose à geste remplace l'état « pointe » par son aile de geste : les quatre états
# restent là (pliee, levee, ouverte, pointe), l'échange par opacity marche partout.
# Toutes ces ailes sortent de SOUS la bande (au dos, ou sous le nœud) : jamais de lobe
# sur le papier ; bord d'attaque d'un trait, une seule rémige au bout.
GESTES = {
    # montre en haut : sort derrière la nuque, monte, une longue rémige vers le haut
    'haut': courbe([(57.0, 42.2, 'v'), (62.8, 44.6, 'v'), (62.4, 36.6), (63.0, 25.4), (64.8, 14.6), (67.0, 3.4, 'v'),
                    (62.6, 13.8), (59.8, 24.4), (57.8, 34.0)]),
    # montre en bas : sort sous le nœud, descend en avant
    'bas': courbe([(70.6, 45.8, 'v'), (75.8, 46.0), (81.6, 49.6), (86.6, 55.4), (91.4, 63.6, 'v'), (85.0, 57.2),
                   (79.6, 52.4), (74.4, 49.4), (70.2, 48.2, 'v')]),
    # tient un objet devant la poitrine (carte, carnet) : sort sous le nœud, descend vers l'avant
    'tenir': courbe([(70.6, 45.8, 'v'), (76.0, 46.0), (80.6, 48.6), (84.6, 52.6, 'v'), (80.6, 53.0), (76.4, 50.6),
                     (70.2, 48.2, 'v')]),
    # tient l'enveloppe en avant et en haut
    'lettre': courbe([(70.6, 45.8, 'v'), (76.2, 45.4), (81.2, 42.4), (85.4, 37.6, 'v'), (83.0, 43.0), (78.0, 48.0),
                      (70.2, 48.2, 'v')]),
    # bout d'aile au menton (réfléchit)
    'menton': courbe([(63.8, 45.0, 'v'), (68.8, 41.0), (74.2, 38.4), (80.4, 37.4, 'v'), (77.0, 41.6), (72.6, 46.4),
                      (68.0, 50.0, 'v')]),
    # bout d'aile sur le bec (chut)
    'chut': courbe([(63.6, 44.6, 'v'), (68.8, 39.6), (74.6, 35.6), (80.4, 32.8), (86.0, 31.4, 'v'), (81.4, 36.4),
                    (76.4, 41.6), (71.8, 46.4), (67.6, 50.0, 'v')]),
    # se gratte derrière la tête (oups) : sort derrière la nuque et s'enroule sur l'arrière du crâne
    'gratte': courbe([(57.0, 42.2, 'v'), (62.8, 44.6, 'v'), (59.6, 39.6), (57.8, 33.6), (59.8, 27.8), (64.4, 24.6, 'v'),
                      (58.4, 25.0), (54.0, 30.4), (53.6, 37.0)]),
}
RES_GESTES = {
    'chut': [(.9, 3.7, profil((0, 0), (.3, .55), (.8, .5), (1, 0)), -1)],
    'menton': [(.9, 2.8, profil((0, 0), (.35, .55), (1, 0)), -1)],
    'haut': [(1.1, 3.4, profil((0, 0), (.3, .5), (1, 0)), -1)],
    'gratte': [(1.15, 4.3, profil((0, 0), (.3, .5), (.8, .45), (1, 0)), -1)],
}


def ailes_geste(geste):
    """Les quatre états, « pointe » remplacé par l'aile du geste."""
    formes = dict(AILES, pointe=GESTES[geste])
    reserves = dict(RESERVES, pointe=RES_GESTES.get(geste, []))
    return formes, reserves


def etoile(x, y, r, rot_=0):
    """Éclat d'or à quatre branches (pointes effilées, creux doux)."""
    pts = []
    for k in range(8):
        a = math.radians(rot_ + k * 45)
        rr = r if k % 2 == 0 else r * .34
        pts.append((x + rr * math.cos(a), y + rr * math.sin(a)) + (('v',) if k % 2 == 0 else ()))
    return courbe(pts)


def carte():
    """La carte dépliée (trois volets en accordéon), la route en pointillés, l'épingle lagon."""
    v = [[(78.6, 51.4), (84.2, 53.2), (84.2, 66.2), (78.6, 64.0)],
         [(84.2, 53.2), (89.4, 51.6), (89.4, 64.4), (84.2, 66.2)],
         [(89.4, 51.6), (94.8, 53.4), (94.8, 66.0), (89.4, 64.4)]]
    volets = P(KRAFT, *[courbe([q + ('v',) for q in pl]) for pl in v])
    plis = P(LIGNE, fuseau((84.2, 53.6), (84.2, 65.8), 0, .45), fuseau((89.4, 52.0), (89.4, 64.0), 0, .45))
    route = P(TRAIT, *[fuseau(a, b, 0, .7) for a, b in (((80.0, 61.8), (81.6, 60.2)), ((83.0, 59.0), (84.8, 58.0)),
                                                         ((86.4, 58.6), (88.0, 59.6)), ((89.8, 59.8), (91.2, 58.4)))])
    epingle = [C(LAGON, 92.6, 56.6, 1.4), C(VENTRE, 92.2, 56.2, .45)]
    return G('plumio-objet', volets, plis, route, epingle)


def carnet():
    """Le carnet ouvert : deux pages de papier, des lignes, la couverture kraft qui dépasse."""
    couv = P(KRAFT, courbe([(77.4, 55.6, 'v'), (85.4, 57.8, 'v'), (93.6, 55.0, 'v'), (93.8, 64.6, 'v'), (85.4, 67.2, 'v'),
                            (77.2, 65.0, 'v')]))
    pages = P(VENTRE, courbe([(78.4, 55.6, 'v'), (85.4, 57.4, 'v'), (85.4, 66.0, 'v'), (78.2, 64.2, 'v')]),
              courbe([(85.4, 57.4, 'v'), (92.8, 55.0, 'v'), (92.8, 63.8, 'v'), (85.4, 66.0, 'v')]))
    lignes = P(LIGNE, *[fuseau((79.6, 58.4 + 2 * k), (84.2, 59.6 + 2 * k), 0, .4) for k in range(3)],
               *[fuseau((86.6, 59.6 + 2 * k), (91.4, 58.2 + 2 * k), 0, .4) for k in range(3)])
    return G('plumio-objet', couv, pages, lignes)


def enveloppe():
    """La petite enveloppe : papier, rabat en V, cachet couleur du foulard."""
    corps_ = P(VENTRE, courbe([(79.0, 49.6, 'v'), (90.6, 47.8, 'v'), (91.8, 56.4, 'v'), (80.4, 58.2, 'v')]))
    bord = P(LIGNE, courbe([(79.0, 49.6, 'v'), (90.6, 47.8, 'v'), (91.8, 56.4, 'v'), (80.4, 58.2, 'v'), (80.9, 57.5, 'v'),
                            (91.0, 55.9, 'v'), (90.0, 48.6, 'v'), (79.7, 50.2, 'v')]))
    rabat = P(LIGNE, courbe([(79.8, 50.2, 'v'), (85.4, 54.0, 'v'), (90.4, 48.4, 'v'), (85.2, 53.0, 'v')]))
    cachet = C(ACCENT, 85.4, 54.0, 1.3)
    return G('plumio-objet', corps_, bord, rabat, cachet)


def pensee():
    """Trois points de pensée qui montent (exactement trois enfants)."""
    return G('plumio-pensee', C('', 82.6, 15.8, 1.1), C('', 87.0, 10.6, 1.5), C('', 92.0, 4.6, 2.0), attrs=TRAIT)


def eclats():
    """Trois éclats d'or (exactement trois enfants)."""
    return G('plumio-eclats', P('', etoile(20.0, 18.0, 4.2)), P('', etoile(90.6, 12.4, 3.2, 10)),
             P('', etoile(88.0, 58.0, 2.4, -8)), attrs=OR)


def plume():
    """Une plume qui tombe (oups)."""
    tige = courbe([(80.2, 8.6), (84.6, 11.6), (88.0, 16.2)], fermee=False)
    return G('plumio-plume', P('', effile(tige, profil((0, 0), (.25, 2.4), (.7, 2.0), (1, 0)))), attrs=DOS)


AILE_LOIN_CELEBRE = courbe([(62.4, 44.8), (66.4, 36.0), (66.0, 24.6), (61.6, 13.2), (54.6, 3.0, 'v'), (58.4, 14.2),
                            (60.4, 25.4), (59.4, 36.4), (57.2, 42.6)])


def valise(x=48.6, y=66.4):
    """La petite valise kraft sous l'oiseau en vol, tenue par les doigts : poignée, sangle lagon."""
    corps_ = P(KRAFT, courbe([(x - 6.0, y - 2.4, 'v'), (x + 6.0, y - 2.4, 'v'), (x + 6.4, y + 6.0, 'v'), (x - 6.4, y + 6.0, 'v')]))
    poignee = P(TRAIT, courbe([(x - 2.4, y - 2.4, 'v'), (x - 2.0, y - 5.2), (x + 2.0, y - 5.2), (x + 2.4, y - 2.4, 'v'),
                               (x + 1.4, y - 2.4, 'v'), (x + 1.2, y - 4.2), (x - 1.2, y - 4.2), (x - 1.4, y - 2.4, 'v')]))
    sangle = P(LAGON, courbe([(x - 1.0, y - 2.4, 'v'), (x + 1.0, y - 2.4, 'v'), (x + 1.1, y + 6.0, 'v'), (x - 1.1, y + 6.0, 'v')]))
    return G('plumio-objet', corps_, poignee, sangle)


# ══ 10. Les poses ═════════════════════════════════════════════════════════════
POSES = {
    'attend': lambda: oiseau(),
    'accueil': lambda: oiseau('levee', tete_rot=-8, regard=(.3, -.3), bec_ouvert=16, foulard_rot=-3, pans=-8),
    'pointer-droite': lambda: oiseau('pointe', tete_rot=3, regard=(.6, .1), foulard_rot=1),
    'pointer-gauche': lambda: oiseau('pointe', tete_rot=3, regard=(.6, .1), foulard_rot=1),
    'regarde-droite': lambda: oiseau(tete_rot=26, regard=(.9, 1.1), foulard_rot=10, pans=-6, buste_rot=4),
    'regarde-gauche': lambda: oiseau(tete_rot=26, regard=(.9, 1.1), foulard_rot=10, pans=-6, buste_rot=4),
    'sautille': lambda: oiseau('levee', aile_rot=-16, tete_rot=-6, regard=(.3, -.2), queue_rot=-6, pans=-14,
                               decal='translate(0 -6)', pattes_=pattes(patte_repliee)),
    'content': lambda: oiseau(tete_rot=-9, ferme=True, bec_ouvert=18, foulard_rot=-3, pans=-6),
}
POSES['picore-droite'] = POSES['picore-gauche'] = lambda: picore()
POSES['vol'] = vol
POSES['face'] = face


def geste(g, **kw):
    formes, reserves = ailes_geste(g)
    return oiseau('pointe', formes=formes, reserves=reserves, **kw)


def celebre():
    loin = G('plumio-aile-arriere', P('', AILE_LOIN_CELEBRE), attrs=AILE)
    return oiseau('ouverte', tete_rot=-10, ferme=True, bec_ouvert=22, foulard_rot=-4, pans=-12, queue_rot=6,
                  filets=(6, -8), decal='translate(0 -5)', pattes_=pattes(patte_repliee), arriere=loin, extra=eclats())


VOL_SALUT = ecran([(59.8, 43.4, 'v'), (66.0, 45.8, 'v'), (68.6, 38.0), (69.4, 28.4), (68.0, 17.8), (64.4, 6.0, 'v'),
                   (64.2, 17.4), (62.4, 27.6), (58.8, 36.6)])


def au_revoir():
    global AILES_VOL
    sauve = AILES_VOL
    AILES_VOL = dict(sauve, pointe=VOL_SALUT)
    RESERVES_VOL['pointe'] = [(2.05, 3.5, profil((0, 0), (.3, .5), (1, 0)), 1)]
    try:
        return vol('pointe', tete_rot=-40, regard=(.4, -.3), bec=16, ferme=True, pans=40)
    finally:
        AILES_VOL = sauve
        RESERVES_VOL['pointe'] = []


def depart():
    pieds = P(TRAIT, ecran([(47.6, 60.6, 'v'), (49.2, 63.4, 'v'), (47.2, 63.8, 'v'), (46.6, 62.2, 'v')]),
              ecran([(51.4, 60.4, 'v'), (52.6, 63.4, 'v'), (50.6, 63.8, 'v'), (50.2, 62.0, 'v')]))
    return vol('ouverte', extra=[valise(49.6, 67.4), pieds])


POSES.update({
    'pointer-haut': lambda: geste('haut', tete_rot=-10, regard=(.5, -1.0), foulard_rot=-4, pans=-6),
    'pointer-bas': lambda: geste('bas', tete_rot=12, regard=(.9, 1.1), foulard_rot=5, pans=-4),
    'explique': lambda: geste('tenir', tete_rot=-4, regard=(-.7, -.2), bec_ouvert=12, foulard_rot=-2, objet=carte()),
    'reflechit': lambda: geste('menton', tete_rot=-12, regard=(.3, -1.1), foulard_rot=-5, pans=-4, extra=pensee()),
    'celebre': celebre,
    'hors-ligne': lambda: geste('tenir', tete_rot=14, regard=(.7, 1.1), foulard_rot=5, pans=-3, objet=carnet()),
    'oups': lambda: geste('gratte', tete_rot=8, regard=(-.6, .6), bec_ouvert=6, foulard_rot=3, extra=plume()),
    'chut': lambda: geste('chut', tete_rot=4, ferme=True, foulard_rot=2),
    'notification': lambda: geste('tenir', tete_rot=-4, regard=(-.6, .1), bec_ouvert=14, objet=enveloppe()),
    'depart': depart,
    'au-revoir': au_revoir,
})
# Placement de tout l'oiseau, AU-DESSUS de plumio-pas : les pivots du tableau restent vrais.
RACINES = {
    'pointer-gauche': MIROIR, 'regarde-droite': mat_tr(-4, 0), 'regarde-gauche': mat_mul(MIROIR, mat_tr(-4, 0)),
}
RACINES['picore-droite'] = mat_tr(PIC['decal'], 0)
RACINES['picore-gauche'] = mat_mul(MIROIR, mat_tr(PIC['decal'], 0))
CLASSES = {'vol': ' plumio--en-vol', 'depart': ' plumio--en-vol', 'au-revoir': ' plumio--en-vol'}


def ecrit(dossier, noms=None):
    os.makedirs(os.path.join(dossier, 'poses'), exist_ok=True)
    tailles = {}
    for nom, f in POSES.items():
        if noms and nom not in noms:
            continue
        r = RACINES.get(nom)
        s = svg(nom, f(), racine=matrice(r) if r else None, commentaire=(nom == 'attend'), classes=CLASSES.get(nom, ''))
        with open(os.path.join(dossier, 'poses', nom + '.svg'), 'w') as fh:
            fh.write(s)
        tailles[nom] = len(s.encode())
    return tailles


if __name__ == '__main__':
    for nom, n in ecrit(sys.argv[1] if len(sys.argv) > 1 else '.').items():
        print('%-16s %5d o' % (nom, n))
