"""Plumio : le squelette et les seize poses.

Usage : python3 plumio.py design/mascotte   (écrit design/mascotte/poses/*.svg)
"""
import os, re, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else '.'

C = dict(trait='#2a251f', dos='#3a342b', ventre='#fffdf8', ors='#c08a2e', vis='#1a1713',
         kraft='#e8c37a', lagon='#2f8f88')


def f(cls, color):
    return f'class="p-{cls}" fill="{C[color]}"'


DOS = f('dos', 'dos')
VEN = f('ventre', 'ventre')
OR = f('or', 'ors')
VIS = f('vis', 'vis')
KR = f('kraft', 'kraft')
LAG = f('lagon', 'lagon')
ACC = 'fill="currentColor"'
NS = 'stroke="none"'
FIN = 'stroke-width="2"'
LIGNE = 'class="p-ligne" stroke="#fffdf8" stroke-width="1.6" stroke-opacity=".35"'

# --- pièces debout ---------------------------------------------------------
QUEUE = f'<g class="plumio-queue"><path {DOS} d="M35 71L5 84L23 80L11 94L38 77Z"/></g>'

PATTES = (f'<g class="plumio-pattes" stroke-width="2.4">'
          f'<g class="plumio-patte-arriere"><path d="M49 80V87M45 89.5L49 87L53 89.5M49 87V90"/></g>'
          f'<g class="plumio-patte-avant"><path d="M58 79V87M54 89.5L58 87L62 89.5M58 87V90"/></g></g>')

CORPS_D = 'M47 32C39 41 33 58 32 71L34 76C41 82 52 85 60 80C68 74 72 62 69 50C67 43 64 37 60 33Z'
VENTRE_D = 'M34 76C41 82 52 85 60 80C68 74 72 62 69 50C68 47 67 45 66 44C60 52 54 66 34 76Z'
CORPS = (f'<g class="plumio-corps"><path {DOS} {NS} d="{CORPS_D}"/>'
         f'<path {VEN} {NS} d="{VENTRE_D}"/><path fill="none" d="{CORPS_D}"/></g>')

AILE_REPOS = (f'<path {DOS} d="M47 47C55 52 55 63 47 70C39 76 27 80 13 86C22 76 30 64 36 54C39 49 43 47 47 47Z"/>'
              f'<path {LIGNE} fill="none" d="M31 70L42 65M24 77L37 71"/>')


def aile(d, lignes=''):
    extra = f'<path {LIGNE} fill="none" d="{lignes}"/>' if lignes else ''
    return f'<g class="plumio-aile"><path {DOS} d="{d}"/>{extra}</g>'


def oeil(px=0.0, py=0.0, ferme=None, paupiere=0):
    if ferme == 'deux' or ferme == 'heureux':
        return (f'<g class="plumio-oeil"><path class="p-ventre-s" stroke="#fffdf8" stroke-width="2.4" fill="none" '
                f'd="M57 26.5Q61 30 65 26.5"/></g>')
    if ferme == 'clin':
        return (f'<g class="plumio-oeil"><path class="p-ventre-s" stroke="#fffdf8" stroke-width="2.4" fill="none" '
                f'd="M57 26Q61 29 65 26"/></g>')
    cx, cy = 62.2 + px, 25.6 + py
    return (f'<g class="plumio-oeil"><circle {VEN} {NS} cx="61" cy="25" r="5.2"/>'
            f'<g class="plumio-pupille"><circle {VIS} {NS} cx="{cx:.1f}" cy="{cy:.1f}" r="2.9"/>'
            f'<circle {VEN} {NS} cx="{cx + 1:.1f}" cy="{cy - 1.2:.1f}" r=".9"/></g>'
            f'<g class="plumio-paupiere"><circle {DOS} {NS} transform="translate(0 19.4) scale(1 {paupiere}) translate(0 -19.4)" cx="61" cy="25" r="5.7"/></g></g>')


def tete(rot=0, px=0, py=0, ferme=None, bec_ouvert=0, devant='', paupiere=0):
    tr = f' transform="rotate({rot} 54 42)"' if rot else ''
    bas = f' transform="rotate({bec_ouvert} 71 26.5)"' if bec_ouvert else ''
    return (f'<g class="plumio-tete"><g class="plumio-tete-regard"><g class="plumio-tete-pose"{tr}>'
            f'<ellipse {DOS} cx="57" cy="27" rx="16" ry="15"/>'
            f'{oeil(px, py, ferme, paupiere)}'
            f'<g class="plumio-bec"><path {OR} {FIN} d="M71 22L80.5 25.8L71 26.6Z"/>'
            f'<g class="plumio-bec-bas"><path class="p-or" fill="{C["ors"]}" {FIN}{bas} d="M71 26.6L78.5 26.4L71 30Z"/></g></g>'
            f'{devant}</g></g></g>')


FOULARD = (f'<g class="plumio-foulard"><path {ACC} d="M41 40C50 46 62 46 70 38L71 45C62 53 50 53 40 47Z"/>'
           f'<g class="plumio-pan"><path {ACC} d="M57 48L71 43.5L62 60Z"/></g></g>')


def debout(aile_svg, tete_svg, avant='', arriere='', pattes=PATTES, queue=QUEUE, decal='', aile_devant=False):
    """Ordre : (arrière), queue, corps, aile, tête, foulard, (avant) — l'aile passe devant la tête si elle la croise."""
    milieu = f'{tete_svg}{FOULARD}{aile_svg}' if aile_devant else f'{aile_svg}{tete_svg}{FOULARD}'
    corps = f'<g class="plumio-souffle">{arriere}{queue}{CORPS}{milieu}{avant}</g>'
    inner = f'<g{decal}>{pattes}{corps}</g>' if decal else f'{pattes}{corps}'
    return f'<g class="plumio-pas"><g class="plumio-pose">{inner}</g></g>'


# --- pièces en vol -----------------------------------------------------------
VOL_QUEUE = f'<g class="plumio-queue"><path {DOS} d="M34 54L2 52L20 58L4 70L36 61Z"/></g>'
VOL_CORPS_D = 'M36 52C44 42 60 40 70 44C74 52 66 62 52 64C44 65 38 62 35 58Z'
VOL_VENTRE_D = 'M35 58C38 62 44 65 52 64C66 62 74 52 70 44C64 52 50 58 35 58Z'
VOL_CORPS = (f'<g class="plumio-corps"><path {DOS} {NS} d="{VOL_CORPS_D}"/>'
             f'<path {VEN} {NS} d="{VOL_VENTRE_D}"/><path fill="none" d="{VOL_CORPS_D}"/></g>')
VOL_AILE_ARR = f'<g class="plumio-aile-arriere"><path {DOS} d="M54 46C56 34 62 20 74 6C72 22 66 36 60 48Z"/></g>'
VOL_AILE_HAUT = 'M44 50C40 36 32 22 16 8C34 12 48 26 54 46Z'


def tete_vol(px=0.6, py=0, ferme=None, bec=0, rot=0):
    # tête recentrée pour le vol : on déplace la tête de repos
    t = tete(rot=rot, px=px, py=py, ferme=ferme, bec_ouvert=bec)
    return f'<g transform="translate(6 12)">{t}</g>'


VOL_FOULARD = (f'<g class="plumio-foulard" transform="translate(6 12)"><path {ACC} d="M43 40C51 45 61 45 68 38L69 44C61 51 51 51 42 46Z"/>'
               f'<g class="plumio-pan"><path {ACC} d="M44 44C36 44 30 40 24 44C30 48 37 50 44 48Z"/></g></g>')


def vol(aile_svg=None, tete_svg=None, avant='', pattes='', decal=''):
    aile_svg = aile_svg or aile(VOL_AILE_HAUT, 'M30 22L38 32M24 16L34 24')
    tete_svg = tete_svg or tete_vol()
    corps = f'<g class="plumio-souffle">{VOL_AILE_ARR}{VOL_QUEUE}{pattes}{VOL_CORPS}{tete_svg}{VOL_FOULARD}{aile_svg}{avant}</g>'
    inner = f'<g{decal}>{corps}</g>' if decal else corps
    return f'<g class="plumio-pas"><g class="plumio-pose">{inner}</g></g>'


# --- objets ------------------------------------------------------------------
CARTE = (f'<g class="plumio-objet"><path {VEN} d="M60 52L70 48L80 52L90 48V74L80 78L70 74L60 78Z"/>'
         f'<path {FIN} fill="none" d="M70 48V74M80 52V78"/>'
         f'<path class="p-or-s" stroke="{C["ors"]}" stroke-width="1.8" stroke-dasharray="2 2.6" fill="none" d="M64 72C68 66 72 66 76 62S83 56 86 55"/>'
         f'<circle {LAG} {NS} cx="86" cy="55" r="2.6"/></g>')

CARNET = (f'<g class="plumio-objet"><path {VEN} d="M58 60L72 56L86 60V80L72 76L58 80Z"/>'
          f'<path {FIN} fill="none" d="M72 56V76"/>'
          f'<path class="p-ligne-s" stroke="#a79c8a" stroke-width="1.4" fill="none" d="M62 65L69 63M62 69L69 67M62 73L69 71M75 63L82 65M75 67L82 69"/></g>')

LETTRE = (f'<g class="plumio-objet"><g transform="rotate(-10 82 30)"><rect {VEN} x="72" y="22" width="22" height="15" rx="1.5"/>'
          f'<path {FIN} fill="none" d="M72.5 23L83 31L93.5 23"/><circle {OR} {FIN} cx="83" cy="31" r="2.6"/></g></g>')

VALISE = (f'<g class="plumio-objet"><path {FIN} fill="none" d="M50 64L50 72M58 63L58 71"/>'
          f'<path {FIN} fill="none" d="M49 76V72H59V76"/>'
          f'<rect {KR} x="42" y="75" width="24" height="17" rx="3"/>'
          f'<path {FIN} fill="none" d="M48 75V92M60 75V92"/></g>')


def eclat(x, y, s=1.0):
    p = (f'M{x} {y - 5 * s:.1f}Q{x + 1 * s:.1f} {y - 1 * s:.1f} {x + 5 * s:.1f} {y}'
         f'Q{x + 1 * s:.1f} {y + 1 * s:.1f} {x} {y + 5 * s:.1f}Q{x - 1 * s:.1f} {y + 1 * s:.1f} {x - 5 * s:.1f} {y}'
         f'Q{x - 1 * s:.1f} {y - 1 * s:.1f} {x} {y - 5 * s:.1f}Z')
    return f'<path {OR} {NS} d="{p}"/>'


PLUME = (f'<g class="plumio-plume"><g transform="rotate(38 84 16)"><path {DOS} {FIN} d="M84 6C88 9 89 16 86 22L84 25L82 22C79 16 80 9 84 6Z"/>'
         f'<path {FIN} fill="none" d="M84 9V29"/></g></g>')
PENSEE = (f'<g class="plumio-pensee"><circle class="p-trait" fill="{C["trait"]}" {NS} cx="79" cy="13" r="1.5"/>'
          f'<circle class="p-trait" fill="{C["trait"]}" {NS} cx="84.5" cy="8.5" r="2"/>'
          f'<circle class="p-trait" fill="{C["trait"]}" {NS} cx="90.5" cy="4.5" r="2.5"/></g>')

# --- les poses ---------------------------------------------------------------
P = {}
P['attend'] = debout(f'<g class="plumio-aile">{AILE_REPOS}</g>', tete(px=0.2))

P['accueil'] = debout(aile('M47 50C42 38 36 24 27 9C38 15 48 29 54 46Z', 'M36 22L43 32M32 15L40 24'),
                      tete(rot=-6, px=0.4, py=-0.2, bec_ouvert=16))

P['pointer-droite'] = debout(aile('M46 56C60 61 78 63 94 59C80 53 62 50 48 50Z', 'M66 57L78 58M60 55L70 55.5'),
                             tete(rot=4, px=1.4, py=0.4))

P['pointer-haut'] = debout(aile('M47 52C40 40 34 24 31 3C42 13 50 30 54 47Z', 'M35 15L41 25M33 9L38 17'),
                           tete(rot=-14, px=0.6, py=-1.4), aile_devant=True)

P['pointer-bas'] = debout(aile('M49 56C61 64 73 76 84 92C72 86 58 76 47 64Z', 'M62 70L68 77M58 66L64 72'),
                          tete(rot=12, px=1.0, py=1.4))

P['explique'] = debout(aile('M46 53C53 57 58 60 63 62C58 65 51 65 46 61Z'), tete(rot=6, px=0.9, py=0.9),
                       avant=CARTE)

P['reflechit'] = debout(aile('M46 53C54 50 63 45 70 38C69 47 60 56 50 59Z', 'M56 51L63 46'),
                        tete(rot=-10, px=0.9, py=-1.5), avant=PENSEE, aile_devant=True)

P['celebre'] = debout(aile('M46 50C40 38 32 24 20 12C34 16 46 28 54 46Z', 'M32 22L40 31M27 17L35 24'),
                      tete(rot=-8, ferme='heureux', bec_ouvert=18),
                      arriere=f'<g class="plumio-aile-arriere"><path {DOS} d="M56 46C62 34 70 22 84 10C82 24 74 38 62 50Z"/></g>',
                      avant=f'<g class="plumio-eclats">{eclat(13, 30, 1.25)}{eclat(87, 36, 1)}{eclat(82, 74, 0.85)}</g>',
                      decal=' transform="translate(0 -5)"')

P['hors-ligne'] = debout(aile('M46 54C54 60 58 64 62 67C56 70 49 68 45 63Z'), tete(rot=10, px=0.8, py=1.6),
                         avant=CARNET)

P['oups'] = debout(aile('M47 51C40 42 35 28 39 12C45 21 50 34 55 47Z', 'M41 24L44 33'),
                   tete(rot=7, px=-0.8, py=-0.4, paupiere=0.5),
                   avant=PLUME, aile_devant=True)

P['chut'] = debout(aile('M46 53C56 47 67 37 77 27C75 38 64 51 52 59Z', 'M61 46L67 40'),
                   tete(rot=-3, ferme='clin'), aile_devant=True)

P['notification'] = debout(f'<g class="plumio-aile">{AILE_REPOS}</g>', tete(rot=-4, px=0.2, py=0.2, devant=LETTRE))

P['vol'] = vol()

P['depart'] = vol(pattes='', avant=VALISE)

P['au-revoir'] = vol(aile_svg=aile('M47 50C49 36 52 22 58 6C62 20 60 34 56 48Z', 'M54 18L55 28'),
                     tete_svg=tete_vol(ferme='heureux', bec=16), decal=' transform="rotate(-14 48 48)"')

P['pointer-gauche'] = f'<g transform="matrix(-1 0 0 1 96 0)">{P["pointer-droite"]}</g>'

ORDRE = ['accueil', 'pointer-droite', 'pointer-gauche', 'pointer-haut', 'pointer-bas', 'explique', 'reflechit',
         'celebre', 'attend', 'hors-ligne', 'oups', 'chut', 'notification', 'depart', 'au-revoir', 'vol']

TITRES = {
    'accueil': 'Accueil', 'pointer-droite': 'Pointer à droite', 'pointer-gauche': 'Pointer à gauche',
    'pointer-haut': 'Pointer en haut', 'pointer-bas': 'Pointer en bas', 'explique': 'Explique',
    'reflechit': 'Réfléchit', 'celebre': 'Célèbre', 'attend': 'Attend', 'hors-ligne': 'Hors ligne',
    'oups': 'Oups', 'chut': 'Chut', 'notification': 'Notification', 'depart': 'Départ',
    'au-revoir': 'Au revoir', 'vol': 'Vol',
}


EN_VOL = {'vol', 'depart', 'au-revoir'}


def classes(s):
    """Les attributs de trait restent en repli ; la feuille de style les reprend par classe."""
    def ajoute(tag, cls):
        if 'class="' in tag:
            return tag.replace('class="', f'class="{cls} ', 1)
        return tag.replace(' ', f' class="{cls}" ', 1)
    out = []
    for tag in re.split(r'(<[^>]+>)', s):
        if tag.startswith('<') and not tag.startswith('</'):
            if 'stroke-width="2"' in tag:
                tag = ajoute(tag, 'p-fin')
            if 'stroke-width="2.4"' in tag and 'plumio-pattes' in tag:
                tag = ajoute(tag, 'p-patte')
            if 'stroke-dasharray' in tag:
                tag = ajoute(tag, 'p-pointilles')
            if 'stroke="none"' in tag:
                tag = ajoute(tag, 'p-plein')
            if 'fill="none"' in tag and '<svg' not in tag:
                tag = ajoute(tag, 'p-vide')
        out.append(tag)
    return ''.join(out)


def svg(nom):
    vol_cls = ' plumio--en-vol' if nom in EN_VOL else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" class="plumio plumio--{nom}{vol_cls}" '
            f'fill="none" stroke="{C["trait"]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" '
            f'aria-hidden="true" focusable="false">{classes(P[nom])}</svg>')


def mini(s):
    s = re.sub(r'>\s+<', '><', s)
    s = re.sub(r'(\d)\.0(?=\D)', r'\1', s)
    return s


if __name__ == '__main__':
    os.makedirs(os.path.join(OUT, 'poses'), exist_ok=True)
    for n in ORDRE:
        s = mini(svg(n))
        open(os.path.join(OUT, 'poses', f'{n}.svg'), 'w').write(s + '\n')
        print(f'{n:16s} {len(s.encode()):5d} o')
