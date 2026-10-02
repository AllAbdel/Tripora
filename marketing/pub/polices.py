"""
Les polices de l'application, en TTF statiques, pour les sous-titres (libass
ne lit ni le woff2 ni les axes variables).

    python3 polices.py   → sortie/polices/*.ttf
"""
import os

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ICI = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(ICI, '../../apps/web/public/polices')
DESTINATION = os.path.join(ICI, 'sortie', 'polices')

INSTANCES = [
    ('inter-tight-latin.woff2', 600, 'Inter Tight SemiBold'),
    ('inter-tight-latin.woff2', 500, 'Inter Tight Medium'),
    ('fraunces-latin.woff2', 600, 'Fraunces SemiBold'),
]


def main():
    os.makedirs(DESTINATION, exist_ok=True)
    for fichier, graisse, nom in INSTANCES:
        police = TTFont(os.path.join(SOURCE, fichier))
        if 'fvar' in police:
            axes = {a.axisTag: (graisse if a.axisTag == 'wght' else a.defaultValue) for a in police['fvar'].axes}
            police = instancer.instantiateVariableFont(police, axes)
        police.flavor = None
        for enr in police['name'].names:
            if enr.nameID in (1, 4, 16):
                enr.string = nom
            elif enr.nameID == 6:
                enr.string = nom.replace(' ', '')
            elif enr.nameID in (2, 17):
                enr.string = 'Regular'
        chemin = os.path.join(DESTINATION, nom.replace(' ', '') + '.ttf')
        police.save(chemin)
        print(chemin)


if __name__ == '__main__':
    main()
