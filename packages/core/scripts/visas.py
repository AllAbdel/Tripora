"""
Les formalités d'entrée (visa ou pas), passeport par passeport, pour visas.ts.

Source : le jeu de données « Passport Index Data »
(https://github.com/imorte/passport-index-data, licence MIT, d'après
passportindex.org), qui prend la suite de celui d'Ilya Ilyankou. L'API
« Can I enter » a été écartée : cinq requêtes par jour et par adresse, rien
qu'un serveur partagé puisse tenir.

    python3 packages/core/scripts/visas.py   → packages/core/src/visas-du-monde.ts

Le fichier produit garde, pour chaque passeport, une ligne compacte : une
lettre par destination (dans l'ordre de `PAYS_DES_VISAS`), suivie du nombre de
jours autorisés quand la source le donne.

    L  sans visa                  A  visa à l'arrivée
    E  autorisation électronique (ESTA, eTA, ETA britannique…)
    V  visa électronique          R  visa à demander avant le départ
    N  entrée refusée             -  même pays, ou rien de connu

La licence MIT demande de garder la mention de copyright : elle est recopiée
en tête du fichier produit. Les règles changent : l'écran renvoie toujours
aux sources officielles, et affiche la date du relevé.
"""
import json
import pathlib
import re
import urllib.request

AGENT = 'Tripora/1.0 (+https://github.com/AllAbdel/Tripora)'
DEPOT = 'https://raw.githubusercontent.com/imorte/passport-index-data/main/'
SORTIE = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'visas-du-monde.ts'
LETTRES = {
    'visa free': 'L',
    'visa on arrival': 'A',
    'eta': 'E',
    'e-visa': 'V',
    'visa required': 'R',
    'no admission': 'N',
}


def lire(chemin):
    requete = urllib.request.Request(DEPOT + chemin, headers={'User-Agent': AGENT})
    with urllib.request.urlopen(requete, timeout=60) as reponse:
        return reponse.read().decode('utf-8')


def main():
    donnees = json.loads(lire('passport-index.json'))
    licence = lire('LICENSE').strip()
    lisezmoi = lire('README.md')
    trouve = re.search(r'Last updated: \*\*(\d{1,2}) (\w+) (\d{4})\*\*', lisezmoi)
    mois = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
            'October', 'November', 'December']
    releve = f'{trouve.group(3)}-{mois.index(trouve.group(2)) + 1:02d}-{int(trouve.group(1)):02d}'

    pays = sorted(donnees)
    lignes = []
    for passeport in pays:
        jetons = []
        for destination in pays:
            entree = donnees[passeport].get(destination)
            if not isinstance(entree, dict) or entree.get('status') not in LETTRES:
                jetons.append('-')
                continue
            jours = entree.get('days')
            jetons.append(LETTRES[entree['status']] + (str(jours) if isinstance(jours, int) and jours > 0 else ''))
        lignes.append(f"  {passeport}: '{''.join(jetons)}',")

    commentaire = '\n'.join('// ' + ligne if ligne else '//' for ligne in licence.splitlines())
    SORTIE.write_text(
        '// Généré par scripts/visas.py — ne pas modifier à la main.\n'
        '// Source : Passport Index Data, https://github.com/imorte/passport-index-data\n'
        '// (d’après passportindex.org), sous licence MIT :\n'
        '//\n'
        f'{commentaire}\n'
        '\n'
        '/** La date de mise à jour annoncée par la source. */\n'
        f"export const RELEVE_DES_VISAS = '{releve}';\n"
        '\n'
        '/** Les pays, dans l’ordre des lettres de chaque ligne. */\n'
        f"export const PAYS_DES_VISAS = '{' '.join(pays)}';\n"
        '\n'
        '/** Par passeport : une lettre par destination, suivie des jours autorisés s’ils sont connus. */\n'
        'export const VISAS_DU_MONDE: Readonly<Record<string, string>> = {\n'
        + '\n'.join(lignes)
        + '\n};\n',
        encoding='utf-8',
    )
    print(f'{len(pays)} passeports, relevé du {releve} → {SORTIE} ({SORTIE.stat().st_size} octets)')


if __name__ == '__main__':
    main()
