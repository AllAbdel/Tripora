"""
Les vacances scolaires des pays de départ, hors France, pour conges.ts.

La France garde son calendrier écrit à la main (conges.ts, source : ministère
de l'Éducation nationale). Pour les autres pays, ce script relève les vacances
scolaires d'OpenHolidays API (https://www.openholidaysapi.org, base de données
sous licence ODbL 1.0) et les écrit dans src/vacances-du-monde.ts, embarqué :
rien n'est demandé à un serveur au moment de choisir ses dates.

    python3 packages/core/scripts/vacances.py     → packages/core/src/vacances-du-monde.ts

À relancer au moins une fois par an, à la rentrée : les calendriers s'allongent
à mesure que les pays les publient (le test de conges rappelle quand le
dernier jour connu approche).

Ce que le script garde, et ce qu'il laisse :
- les pays dont le calendrier va au moins trois mois au-delà d'aujourd'hui :
  ailleurs, OpenHolidays s'arrête avant, et un calendrier fini ne propose rien ;
- les **périodes** de vacances (trois jours ou plus) : pas les jours isolés
  (fête d'un saint patron, jour de pont), ni les repères (« rentrée scolaire »,
  « fin des cours ») ;
- les écoles obligatoires : là où les dates changent selon le type d'école
  (Suisse, Mecklembourg), les écoles professionnelles et les lycées sont
  laissés de côté ;
- les régions telles que les donne OpenHolidays : Länder, cantons, districts
  tchèques, voïvodies, et pour la Belgique et les Pays-Bas, les communautés et
  les trois régions scolaires.

Pour deviner la région d'un point de départ, chaque région a des points de
repère, cherchés une fois dans OpenStreetMap (Nominatim, ODbL) et gardés dans
`vacances-reperes.json` : son centre, ou pour les Pays-Bas chaque commune, et
pour la Belgique les grandes villes de chaque communauté (Bruxelles, où les
deux grandes communautés ont leurs écoles, n'en désigne aucune).

Le fichier produit est lui-même une base dérivée d'OpenHolidays et
d'OpenStreetMap : il est sous la même licence (ODbL 1.0), et ce script est la
façon de le refaire.
"""
import datetime
import json
import os
import sys
import time
import urllib.parse
import urllib.request

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, '..', 'src', 'vacances-du-monde.ts')
REPERES = os.path.join(ICI, 'vacances-reperes.json')
API = 'https://openholidaysapi.org'
NOMINATIM = 'https://nominatim.openstreetmap.org/search'
AGENT = 'Tripora-generateur/1.0 (+https://tripora-3rg.pages.dev)'
AUJOURDHUI = datetime.date.today()
# OpenHolidays refuse une fenêtre de plus de trois ans.
FIN_DU_RELEVE = AUJOURDHUI.replace(year=AUJOURDHUI.year + 3) - datetime.timedelta(days=1)
UTILE_JUSQUAU = AUJOURDHUI + datetime.timedelta(days=90)
JOURS_MIN = 3

# Ce qui marque un jour, pas une période de vacances.
REPERES_DU_CALENDRIER = ('end of lessons', 'start of', 'first day of school', 'school year')

# Les régions désignées par des groupes plutôt que par des subdivisions.
PAR_GROUPES = {'BE', 'NL'}
# Les groupes qui désignent un type d'école : on garde l'école obligatoire.
ECOLES_OBLIGATOIRES = ('-VS', '-EO', '-ABS')
# Le niveau de région le plus fin retenu (segments du code) : les districts
# tchèques et suisses, ailleurs la première division du pays.
NIVEAU = {'CZ': 3, 'CH': 3}

# Les noms des périodes, en français, d'après l'anglais d'OpenHolidays.
FRANCAIS = {
    'all saints holidays': 'Vacances de la Toussaint',
    'all saints day holidays': 'Vacances de la Toussaint',
    'autumn': 'Vacances d’automne',
    'autumn holidays': 'Vacances d’automne',
    'autumn break': 'Vacances d’automne',
    'carnival holidays': 'Vacances de carnaval',
    'christmas': 'Vacances de Noël',
    'christmas holidays': 'Vacances de Noël',
    'christmas and new year holidays': 'Vacances de Noël',
    'easter': 'Vacances de Pâques',
    'easter holidays': 'Vacances de Pâques',
    'pentecost holiday': 'Vacances de Pentecôte',
    'pentecost holidays': 'Vacances de Pentecôte',
    'semester holidays': 'Vacances de semestre',
    'summer holidays': 'Vacances d’été',
    'summer break': 'Vacances d’été',
    'spring holidays': 'Vacances de printemps',
    'spring break': 'Vacances de printemps',
    'winter holidays': 'Vacances d’hiver',
    'winter break': 'Vacances d’hiver',
    'may holidays': 'Vacances de mai',
    'mid-year break': 'Vacances de mi-année',
    'mid-year holidays': 'Vacances de mi-année',
    'february holidays': 'Vacances de février',
    'february week': 'Semaine de février',
    'sports holidays': 'Vacances de sport',
    'ascension bridge': 'Pont de l’Ascension',
    'ascension day holidays': 'Vacances de l’Ascension',
    'ascension': 'Pont de l’Ascension',
}

# Les Länder, en français.
REGIONS_EN_FRANCAIS = {
    'DE-BB': 'Brandebourg', 'DE-BE': 'Berlin', 'DE-BW': 'Bade-Wurtemberg', 'DE-BY': 'Bavière',
    'DE-HB': 'Brême', 'DE-HE': 'Hesse', 'DE-HH': 'Hambourg', 'DE-MV': 'Mecklembourg-Poméranie-Occidentale',
    'DE-NI': 'Basse-Saxe', 'DE-NW': 'Rhénanie-du-Nord-Westphalie', 'DE-RP': 'Rhénanie-Palatinat',
    'DE-SH': 'Schleswig-Holstein', 'DE-SL': 'Sarre', 'DE-SN': 'Saxe', 'DE-ST': 'Saxe-Anhalt', 'DE-TH': 'Thuringe',
    'AT-BL': 'Burgenland', 'AT-KÄ': 'Carinthie', 'AT-NÖ': 'Basse-Autriche', 'AT-OÖ': 'Haute-Autriche',
    'AT-SB': 'Salzbourg', 'AT-SM': 'Styrie', 'AT-TI': 'Tyrol', 'AT-VA': 'Vorarlberg', 'AT-WI': 'Vienne',
    'NL-NO': 'Pays-Bas du Nord', 'NL-MI': 'Pays-Bas du Centre', 'NL-ZU': 'Pays-Bas du Sud',
    'BE-NL': 'Communauté flamande', 'BE-FR': 'Communauté française', 'BE-DE': 'Communauté germanophone',
    # Des noms manquants ou écorchés chez OpenHolidays.
    'CH-GR-BN': 'Bernina', 'CZ-KR-HK': 'Hradec Králové', 'CZ-JM-ZN': 'Znojmo',
}
REGIONS_EN_ANGLAIS = {
    'NL-NO': 'Northern Netherlands', 'NL-MI': 'Central Netherlands', 'NL-ZU': 'Southern Netherlands',
    'BE-NL': 'Flemish Community', 'BE-FR': 'French Community', 'BE-DE': 'German-speaking Community',
    'CH-GR-BN': 'Bernina', 'CZ-KR-HK': 'Hradec Králové', 'CZ-JM-ZN': 'Znojmo',
}

# Les villes qui désignent une communauté belge.
VILLES_DE_BELGIQUE = {
    'BE-NL': ['Antwerpen', 'Gent', 'Brugge', 'Leuven', 'Hasselt', 'Mechelen', 'Kortrijk', 'Oostende', 'Aalst',
              'Sint-Niklaas', 'Genk', 'Turnhout', 'Roeselare', 'Ieper'],
    'BE-FR': ['Liège', 'Namur', 'Charleroi', 'Mons', 'Tournai', 'Arlon', 'Wavre', 'La Louvière', 'Verviers',
              'Bastogne', 'Dinant', 'Mouscron', 'Nivelles'],
    'BE-DE': ['Eupen', 'Sankt Vith', 'Kelmis'],
    None: ['Bruxelles'],
}


def lire(url):
    requete = urllib.request.Request(url, headers={'User-Agent': AGENT, 'Accept': 'application/json'})
    with urllib.request.urlopen(requete, timeout=60) as reponse:
        return json.load(reponse)


def texte(noms, langue):
    for nom in noms or []:
        if nom['language'] == langue:
            return nom['text']
    return None


class Reperes:
    """Les coordonnées cherchées dans OpenStreetMap, gardées d'une fois sur l'autre."""

    def __init__(self):
        self.connus = json.load(open(REPERES, encoding='utf-8')) if os.path.exists(REPERES) else {}
        self.utilises = set()
        self.dernier = 0.0

    def chercher(self, requete, pays):
        cle = f'{pays}|{requete}'
        self.utilises.add(cle)
        if cle in self.connus:
            return self.connus[cle]
        # Une requête par seconde au plus : la règle de Nominatim.
        attente = 1.1 - (time.time() - self.dernier)
        if attente > 0:
            time.sleep(attente)
        parametres = urllib.parse.urlencode({'q': requete, 'countrycodes': pays.lower(), 'format': 'jsonv2', 'limit': 1})
        resultats = lire(f'{NOMINATIM}?{parametres}')
        self.dernier = time.time()
        point = [round(float(resultats[0]['lat']), 2), round(float(resultats[0]['lon']), 2)] if resultats else None
        self.connus[cle] = point
        if point is None:
            print(f'  introuvable dans OpenStreetMap : {requete} ({pays})', file=sys.stderr)
        return point

    def garder(self, a_la_fin=False):
        # À la fin, seulement ce qui a servi : une région renommée laisse sa vieille recherche derrière elle.
        gardes = {cle: point for cle, point in self.connus.items() if not a_la_fin or cle in self.utilises}
        lignes = [f'  {json.dumps(cle, ensure_ascii=False)}: {json.dumps(point)}' for cle, point in sorted(gardes.items())]
        with open(REPERES, 'w', encoding='utf-8') as fichier:
            fichier.write('{\n' + ',\n'.join(lignes) + '\n}\n')


def nom_francais(noms):
    anglais = (texte(noms, 'EN') or '').strip()
    francais = texte(noms, 'FR')
    # Un nom français complet (« Congé de détente (Carnaval) ») fait foi ; un
    # mot seul (« Automne ») dit moins que la traduction de l'anglais.
    if francais and ' ' in francais.strip():
        return francais.strip().replace("'", '’')
    traduit = FRANCAIS.get(anglais.lower())
    if traduit:
        return traduit
    raise SystemExit(f'Nom de période sans français : « {anglais} ». Ajoutez-le à FRANCAIS.')


def nom_anglais(noms):
    anglais = (texte(noms, 'EN') or '').strip().replace("'", '’')
    # « Autumn Holidays » et « Autumn holidays » : un seul nom.
    for mot in ('Holidays', 'Holiday', 'Break'):
        anglais = anglais.replace(f' {mot}', f' {mot.lower()}')
    return anglais


def releve(pays):
    """Les périodes d'un pays, filtrées, et les codes de régions qu'elles citent."""
    parametres = urllib.parse.urlencode({
        'countryIsoCode': pays, 'validFrom': AUJOURDHUI.isoformat(), 'validTo': FIN_DU_RELEVE.isoformat(),
    })
    periodes = []
    for periode in lire(f'{API}/SchoolHolidays?{parametres}'):
        debut = datetime.date.fromisoformat(periode['startDate'])
        fin = datetime.date.fromisoformat(periode['endDate'])
        anglais = (texte(periode['name'], 'EN') or '').lower()
        if (fin - debut).days + 1 < JOURS_MIN or any(marque in anglais for marque in REPERES_DU_CALENDRIER):
            continue
        groupes = [groupe['code'] for groupe in periode.get('groups') or []]
        if pays in PAR_GROUPES:
            regions = groupes
        else:
            # Un type d'école autre que l'école obligatoire : laissé de côté.
            if groupes and not any(groupe.endswith(ECOLES_OBLIGATOIRES) for groupe in groupes):
                continue
            regions = sorted({
                '-'.join(subdivision['code'].split('-')[: NIVEAU.get(pays, 2)])
                for subdivision in periode.get('subdivisions') or []
            })
        periodes.append({
            'debut': debut, 'fin': fin, 'noms': periode['name'],
            'national': bool(periode.get('nationwide')) or not regions,
            'regions': regions,
            'communes': [s['code'] for s in periode.get('subdivisions') or []] if pays == 'NL' else [],
        })
    return periodes


def subdivisions(pays):
    """Toutes les subdivisions d'un pays, à plat : code → noms."""
    a_plat = {}

    def parcourir(liste):
        for element in liste or []:
            a_plat[element['code']] = element
            parcourir(element.get('children'))

    parcourir(lire(f'{API}/Subdivisions?countryIsoCode={pays}'))
    return a_plat


def nom_de_region(code, element, langue_locale):
    noms = element['name'] if element else []
    francais = REGIONS_EN_FRANCAIS.get(code) or texte(noms, 'FR') or texte(noms, langue_locale) or texte(noms, 'EN') or code
    anglais = REGIONS_EN_ANGLAIS.get(code) or texte(noms, 'EN') or texte(noms, langue_locale) or francais
    return francais, anglais


def main():
    reperes = Reperes()
    pays_connus = lire(f'{API}/Countries')
    langues = {pays['isoCode']: (pays.get('officialLanguages') or ['EN'])[0] for pays in pays_connus}
    sortie = {}
    for pays in sorted(p['isoCode'] for p in pays_connus):
        if pays == 'FR':
            continue
        periodes = releve(pays)
        if not periodes or max(p['fin'] for p in periodes) < UTILE_JUSQUAU:
            continue
        print(f'{pays} : {len(periodes)} périodes', file=sys.stderr)

        # Les régions : celles que les périodes citent, au niveau le plus fin
        # cité. Une période d'un canton vaut pour ses districts.
        cites = sorted({code for p in periodes for code in p['regions']})
        elements = subdivisions(pays) if pays not in PAR_GROUPES else {
            groupe['code']: groupe for groupe in lire(f'{API}/Groups?countryIsoCode={pays}')
        }
        feuilles = []
        for code in cites:
            plus_fins = [autre for autre in cites if autre.startswith(code + '-')]
            enfants = [enfant['code'] for enfant in (elements.get(code) or {}).get('children') or []]
            # Un canton dont seuls quelques districts ont leurs propres dates
            # reste une région : les autres districts suivent le canton.
            couverts = enfants and all(
                any(fin == enfant or fin.startswith(enfant + '-') for fin in plus_fins) for enfant in enfants
            )
            if not plus_fins or not couverts:
                feuilles.append(code)
        regions = []
        for code in feuilles:
            francais, anglais = nom_de_region(code, elements.get(code), langues[pays])
            regions.append((code, francais, anglais))
        regions.sort(key=lambda region: region[1])
        rang = {code: index for index, (code, _, _) in enumerate(regions)}

        # Les points de repère de chaque région.
        points = []
        if pays == 'NL':
            communes = subdivisions('NL')
            region_de_la_commune = {}
            for p in periodes:
                if len(p['regions']) == 1:
                    for commune in p['communes']:
                        if commune.count('-') == 2:
                            region_de_la_commune[commune] = p['regions'][0]
            for commune, region in sorted(region_de_la_commune.items()):
                province = communes.get(commune[:5])
                requete = f"{texte(communes[commune]['name'], 'NL')}, {texte(province['name'], 'NL') if province else ''}"
                point = reperes.chercher(requete, 'NL')
                if point:
                    points.append((rang[region], point))
        elif pays == 'BE':
            for region, villes in VILLES_DE_BELGIQUE.items():
                for ville in villes:
                    point = reperes.chercher(ville, 'BE')
                    if point:
                        # Une communauté sans calendrier publié ne désigne rien.
                        points.append((rang.get(region, -1) if region else -1, point))
        else:
            for code, _, _ in regions:
                element = elements.get(code)
                noms = element['name'] if element else []
                # Un nom corrigé à la main sert aussi à le situer.
                local = (
                    (REGIONS_EN_FRANCAIS.get(code) if code.startswith(('CZ-', 'CH-')) else None)
                    or texte(noms, langues[pays]) or texte(noms, 'EN') or code
                )
                parent = elements.get(code.rsplit('-', 1)[0]) if code.count('-') == 2 else None
                requete = f"{local}, {texte(parent['name'], langues[pays]) or texte(parent['name'], 'EN')}" if parent else local
                point = reperes.chercher(requete, pays)
                if point:
                    points.append((rang[code], point))
        reperes.garder()
        if regions and not points:
            raise SystemExit(f'{pays} : aucune région située.')

        # Les noms, puis les périodes : les mêmes dates d'une même période ne
        # font qu'une ligne, avec toutes leurs régions.
        noms, index_des_noms, portees = [], {}, {}
        for p in periodes:
            couple = (nom_francais(p['noms']), nom_anglais(p['noms']))
            if couple not in index_des_noms:
                index_des_noms[couple] = len(noms)
                noms.append(couple)
            cle = (p['debut'].strftime('%Y%m%d'), p['fin'].strftime('%Y%m%d'), index_des_noms[couple])
            if p['national'] or not regions:
                portees[cle] = '*'
            elif portees.get(cle) != '*':
                portees.setdefault(cle, set()).update(
                    rang[feuille] for code in p['regions'] for feuille in feuilles
                    if feuille == code or feuille.startswith(code + '-')
                )
        lignes = []
        for cle, portee in sorted(portees.items()):
            if portee != '*' and (not portee or len(portee) == len(regions)):
                portee = '*' if portee else None
            if portee is None:
                continue
            lignes.append((*cle, portee if portee == '*' else '.'.join(str(i) for i in sorted(portee))))
        # Jusqu'où chaque région est connue : toutes ne publient pas au même
        # rythme (la Communauté française de Belgique a un an de moins).
        horizons = {}
        for debut, fin, _, portee in lignes:
            for index in (range(len(regions)) if portee == '*' else map(int, portee.split('.'))):
                horizons[index] = max(horizons.get(index, ''), fin)
        regions = [
            (code, francais, anglais, f'{horizons[i][:4]}-{horizons[i][4:6]}-{horizons[i][6:]}' if i in horizons else '')
            for i, (code, francais, anglais) in enumerate(regions)
        ]
        sortie[pays] = {
            'jusquau': max(p['fin'] for p in periodes).isoformat(),
            'regions': regions,
            'points': points,
            'noms': noms,
            'lignes': lignes,
        }

    reperes.garder(a_la_fin=True)
    ecrire(sortie)


def chaine(valeur):
    return "'" + valeur.replace('\\', '\\\\').replace("'", "\\'") + "'"


def ecrire(sortie):
    lignes = [
        '/**',
        ' * Les vacances scolaires des pays de départ, hors France.',
        ' *',
        ' * Généré par `packages/core/scripts/vacances.py` depuis OpenHolidays API',
        ' * (https://www.openholidaysapi.org) : ne pas modifier à la main. Les points de',
        ' * repère des régions viennent d’OpenStreetMap (Nominatim).',
        ' *',
        ' * Licence : ce fichier est une base de données dérivée d’OpenHolidays et',
        ' * d’OpenStreetMap, sous la licence de leurs données, l’Open Database License',
        ' * (ODbL 1.0, https://opendatacommons.org/licenses/odbl/1-0/). Le script est la',
        ' * façon de le refaire. Les mentions légales de l’application citent les deux.',
        ' *',
        ' * Format compact : `regions` liste [code, nom français, nom anglais, dernier',
        ' * jour connu] (vide : le calendrier est national) ; `reperes`, « région,lat,lng » séparés par « ; »',
        ' * (région -1 : un lieu qui ne désigne aucune région) ; `noms`, [français,',
        ' * anglais] ; `periodes`, « AAAAMMJJ-AAAAMMJJ:nom:régions » séparées par « ; »,',
        ' * régions « 0.3.5 » (indices dans `regions`) ou « * » pour tout le pays.',
        ' */',
        'export interface VacancesDUnPays {',
        '  /** Le dernier jour connu du calendrier : au-delà, on ne sait rien. */',
        '  jusquau: string;',
        '  /** [code, nom français, nom anglais, dernier jour connu pour cette région]. */',
        '  regions: readonly (readonly [string, string, string, string])[];',
        '  reperes: string;',
        '  noms: readonly (readonly [string, string])[];',
        '  periodes: string;',
        '}',
        '',
        f"export const VACANCES_RELEVEES_LE = '{AUJOURDHUI.isoformat()}';",
        '',
        'export const VACANCES_DU_MONDE: Readonly<Record<string, VacancesDUnPays>> = {',
    ]
    for pays, donnees in sortie.items():
        regions = ', '.join(f'[{chaine(c)}, {chaine(f)}, {chaine(a)}, {chaine(j)}]' for c, f, a, j in donnees['regions'])
        reperes = ';'.join(f'{r},{p[0]:g},{p[1]:g}' for r, p in donnees['points'])
        noms = ', '.join(f'[{chaine(f)}, {chaine(a)}]' for f, a in donnees['noms'])
        periodes = ';'.join(f'{d}-{f}:{n}:{r}' for d, f, n, r in donnees['lignes'])
        lignes.append(f'  {pays}: {{')
        lignes.append(f"    jusquau: '{donnees['jusquau']}',")
        lignes.append(f'    regions: [{regions}],')
        lignes.append(f"    reperes: '{reperes}',")
        lignes.append(f'    noms: [{noms}],')
        lignes.append(f"    periodes: '{periodes}',")
        lignes.append('  },')
    lignes.append('};')
    with open(SORTIE, 'w', encoding='utf-8') as fichier:
        fichier.write('\n'.join(lignes) + '\n')
    print(f'{len(sortie)} pays écrits dans {os.path.relpath(SORTIE)}', file=sys.stderr)


if __name__ == '__main__':
    main()
