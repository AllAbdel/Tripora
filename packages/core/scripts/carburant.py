"""
Le prix du carburant pays par pays, pour carburant.ts.

Jusqu'ici, une voiture coûtait 14 centimes du kilomètre partout : un forfait
français, faux dès qu'on roule en Espagne ou en Suisse. Ce script relève les
prix réels publiés par OpenVan (https://openvan.camp, licence CC BY 4.0,
mention « Data: OpenVan.camp » obligatoire) et les écrit, convertis en
centimes d'euro par litre, dans src/carburant-du-monde.ts, embarqué : rien
n'est demandé à un serveur au moment d'estimer un trajet, et ça marche hors
ligne.

    python3 packages/core/scripts/carburant.py   → packages/core/src/carburant-du-monde.ts

OpenVan met ses prix à jour chaque semaine ; à relancer tous les mois ou deux.
L'écran affiche la date du relevé à côté de l'estimation : un prix vieilli se
voit.

Ce que le script garde, et ce qu'il laisse :
- l'essence (sans-plomb ordinaire) et le gazole, les deux carburants d'une
  voiture de location ou de particulier ;
- les pays qu'OpenVan ne marque pas « exclus » (ceux dont il juge lui-même
  les sources trop fragiles) ;
- le prix converti d'après les taux qu'OpenVan publie à côté
  (`/api/currency/rates`, base euro), pour que prix et taux datent du même
  jour ; les gallons (américains, impériaux) sont ramenés au litre.

Aucune adresse électronique dans le User-Agent : seulement le nom de
l'application et son dépôt.
"""
import datetime
import json
import pathlib
import urllib.request

AGENT = 'Tripora/1.0 (+https://github.com/AllAbdel/Tripora)'
LITRES = {'liter': 1.0, 'gallon': 3.785411784, 'imperial_gallon': 4.54609}
SORTIE = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'carburant-du-monde.ts'


def lire(url):
    requete = urllib.request.Request(url, headers={'User-Agent': AGENT, 'Accept': 'application/json'})
    with urllib.request.urlopen(requete, timeout=30) as reponse:
        return json.load(reponse)


def centimes_par_litre(entree, carburant, taux):
    prix = entree['prices'].get(carburant)
    if not isinstance(prix, (int, float)) or prix <= 0:
        return None
    unite = entree.get('units', {}).get(carburant, entree.get('unit', 'liter'))
    devise = entree.get('currencies', {}).get(carburant, entree['currency'])
    if unite not in LITRES or devise not in taux:
        return None
    euros = prix / LITRES[unite] / taux[devise]
    # Plus de 5 € ou moins de 2 centimes le litre : une erreur de source,
    # pas un prix. Mieux vaut le forfait qu'un trajet à 300 €.
    if not 0.02 <= euros <= 5:
        return None
    return round(euros * 100)


def main():
    prix = lire('https://openvan.camp/api/fuel/prices')
    taux = lire('https://openvan.camp/api/currency/rates')['rates']
    lignes = []
    for code, entree in sorted(prix['data'].items()):
        if entree.get('is_excluded'):
            continue
        essence = centimes_par_litre(entree, 'gasoline', taux)
        gazole = centimes_par_litre(entree, 'diesel', taux)
        if essence is None and gazole is None:
            continue
        valeur = lambda v: 'null' if v is None else str(v)
        lignes.append(f"  {code}: [{valeur(essence)}, {valeur(gazole)}],")

    releve = prix['meta']['updated_at'][:10]
    datetime.date.fromisoformat(releve)
    SORTIE.write_text(
        '// Généré par scripts/carburant.py — ne pas modifier à la main.\n'
        '// Source : OpenVan.camp (https://openvan.camp), licence CC BY 4.0.\n'
        '\n'
        '/** Le jour du relevé, tel que le donne OpenVan. */\n'
        f"export const RELEVE_DU_CARBURANT = '{releve}';\n"
        '\n'
        '/** Centimes d’euro par litre, par pays : [essence, gazole]. */\n'
        'export const CARBURANT_DU_MONDE: Readonly<Record<string, readonly [number | null, number | null]>> = {\n'
        + '\n'.join(lignes)
        + '\n};\n',
        encoding='utf-8',
    )
    print(f'{len(lignes)} pays, relevé du {releve} → {SORTIE}')


if __name__ == '__main__':
    main()
