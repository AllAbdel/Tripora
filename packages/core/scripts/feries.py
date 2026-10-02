"""
Les jours fériés et le week-end de chaque pays de départ, pour conges.ts.

La France garde son calendrier écrit à la main (conges.ts : fériés de la
métropole, vacances scolaires officielles). Pour les autres pays du
catalogue, ce script tire les fériés nationaux de la bibliothèque Python
`holidays` (licence MIT, https://github.com/vacanza/holidays) et les écrit
dans src/feries-du-monde.ts, embarqué : rien n'est demandé à un serveur au
moment de choisir ses dates.

    pip install holidays
    python3 packages/core/scripts/feries.py      → packages/core/src/feries-du-monde.ts

À relancer chaque année (le test de conges rappelle quand la dernière année
connue approche), en avançant PREMIERE et DERNIERE.

Ce que les données disent, et ne disent pas :
- les fériés **nationaux** seulement, ceux de tout le pays : un férié propre à
  un État, un Land ou un canton n'y est pas. Exception : le Royaume-Uni, où
  l'on retient l'Angleterre (lundi de Pâques, lundi d'août), où vivent
  84 % des Britanniques ;
- les jours reportés quand un férié tombe le week-end (Royaume-Uni,
  États-Unis…) y sont, marqués comme tels ;
- les fêtes musulmanes suivent l'observation de la lune : leur date est une
  estimation, marquée comme telle ;
- le week-end n'est pas partout le samedi et le dimanche (vendredi et samedi
  en Arabie saoudite, par exemple).
"""
import os
import re
import sys

import holidays

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, '..', 'src', 'feries-du-monde.ts')
DESTINATIONS = os.path.join(ICI, '..', 'src', 'catalog', 'destinations.ts')
PREMIERE, DERNIERE = 2026, 2029
SUBDIVISIONS = {'GB': 'ENG'}

# Les noms les plus courants, en français. Un nom absent garde son nom anglais.
FRANCAIS = {
    "New Year's Day": 'Jour de l’an', 'Christmas Day': 'Noël', 'Good Friday': 'Vendredi saint',
    'Easter Monday': 'Lundi de Pâques', 'Labor Day': 'Fête du Travail', 'Labour Day': 'Fête du Travail',
    'Independence Day': 'Fête de l’indépendance', 'Eid al-Fitr': 'Aïd el-Fitr', 'Eid al-Adha': 'Aïd el-Kébir',
    'Boxing Day': 'Boxing Day', 'National Day': 'Fête nationale', 'Ascension Day': 'Ascension',
    "All Saints' Day": 'Toussaint', 'Assumption Day': 'Assomption', 'Pentecost Monday': 'Lundi de Pentecôte',
    'Easter Sunday': 'Pâques', 'Constitution Day': 'Fête de la Constitution', "Prophet's Birthday": 'Mouloud',
    'Victory Day': 'Jour de la Victoire', 'Second Day of Christmas': 'Lendemain de Noël', 'Pentecost': 'Pentecôte',
    'Epiphany': 'Épiphanie', 'Emancipation Day': 'Fête de l’émancipation', 'Republic Day': 'Fête de la République',
    'Eid al-Fitr Holiday': 'Aïd el-Fitr (congé)', 'Eid al-Adha Holiday': 'Aïd el-Kébir (congé)',
    'Maundy Thursday': 'Jeudi saint', 'Islamic New Year': 'Nouvel An musulman',
    'Immaculate Conception': 'Immaculée Conception', 'Corpus Christi': 'Fête-Dieu', 'Armistice Day': 'Armistice',
    "Mother's Day": 'Fête des mères', 'Holy Saturday': 'Samedi saint',
    "International Women's Day": 'Journée internationale des femmes', 'Liberation Day': 'Fête de la Libération',
    'Spring Festival': 'Fête du Printemps', 'International Labor Day': 'Fête du Travail', 'Christmas Eve': 'Veille de Noël',
    'Chinese New Year': 'Nouvel An chinois', 'National Heroes Day': 'Fête des héros nationaux', 'May Day': 'Premier mai',
    "King's Birthday": 'Anniversaire du roi', "Isra' and Mi'raj": 'Isra et Miraj', 'Statehood Day': 'Fête de l’État',
    "Saint Stephen's Day": 'Saint-Étienne', 'Day of Arafah': 'Jour d’Arafat', "Women's Day": 'Journée des femmes',
    'Ashura': 'Achoura', 'Youth Day': 'Fête de la jeunesse', 'Diwali': 'Diwali', 'Easter': 'Pâques',
    "Children's Day": 'Fête des enfants', "Workers' Day": 'Fête des travailleurs', "All Souls' Day": 'Jour des morts',
    "International Workers' Day": 'Fête du Travail', "Martyrs' Day": 'Jour des martyrs', 'Family Day': 'Jour de la famille',
    "New Year's Eve": 'Saint-Sylvestre', 'National Independence Day': 'Fête de l’indépendance',
    'Whit Monday': 'Lundi de Pentecôte', 'Carnival Monday': 'Lundi gras', 'Carnival Tuesday': 'Mardi gras',
    'Abolition of Slavery': 'Abolition de l’esclavage', 'Lunar New Year': 'Nouvel An lunaire', 'May Holidays': 'Congés de mai',
    'Armed Forces Day': 'Journée des forces armées', "Worker's Day": 'Fête des travailleurs',
    "Day after New Year's Day": 'Lendemain du jour de l’an', 'Thanksgiving Day': 'Thanksgiving', 'Carnival': 'Carnaval',
    'Revolution Day': 'Fête de la Révolution', 'New Year Holidays': 'Congés du Nouvel An', 'Memorial Day': 'Memorial Day',
    'Tomb-Sweeping Day': 'Fête des morts (Qingming)', 'ANZAC Day': 'Anzac Day', 'Anzac Day': 'Anzac Day',
    "National Heroes' Day": 'Fête des héros nationaux', 'Remembrance Day': 'Jour du Souvenir',
    'Dragon Boat Festival': 'Fête des bateaux-dragons', 'Dormition of the Mother of God': 'Dormition',
    'Midsummer Day': 'Saint-Jean', 'Midsummer Eve': 'Veille de la Saint-Jean', 'Spring Bank Holiday': 'Lundi de printemps',
    'Late Summer Bank Holiday': 'Lundi de fin d’été', 'Summer Bank Holiday': 'Lundi d’août', 'Vesak Day': 'Vesak',
    "Father's Day": 'Fête des pères', 'Nowruz': 'Norouz', 'International Nowruz Day': 'Norouz', 'Nowruz Holiday': 'Norouz (congé)',
    'Chinese New Year (Spring Festival)': 'Nouvel An chinois', "Chinese New Year's Eve": 'Veille du Nouvel An chinois',
    'Europe Day': 'Journée de l’Europe', 'Songkran Festival': 'Songkran', 'Orthodox Christmas Day': 'Noël orthodoxe',
    'First Day of Ramadan': 'Début du ramadan', 'Unity Day': 'Fête de l’unité', "King's Day": 'Fête du roi',
    "Saint Peter and Saint Paul's Day": 'Saint-Pierre-et-Saint-Paul', 'Columbus Day': 'Columbus Day',
    'Ash Wednesday': 'Mercredi des Cendres', 'Easter Saturday': 'Samedi de Pâques', 'United Nations Day': 'Journée des Nations unies',
    'National Unity Day': 'Fête de l’unité nationale', 'Holi': 'Holi', 'Freedom Day': 'Fête de la liberté',
    'Veterans Day': 'Veterans Day', 'Mid-Autumn Festival': 'Fête de la mi-automne', 'Day After Christmas': 'Lendemain de Noël',
    "The Buddha's Birthday": 'Anniversaire du Bouddha', 'Juneteenth National Independence Day': 'Juneteenth',
    "Prophet Muhammad's Birthday": 'Mouloud', 'Prophet Mohammed\'s Birthday': 'Mouloud', 'Orthodox Easter Sunday': 'Pâques orthodoxe',
    'Orthodox Easter': 'Pâques orthodoxe', 'Catholic Easter': 'Pâques', 'Catholic Easter Sunday': 'Pâques',
    'Catholic Christmas Day': 'Noël', 'Reformation Day': 'Fête de la Réformation', "Saint Joseph's Day": 'Saint-Joseph',
    "Saint Andrew's Day": 'Saint-André', 'Martin Luther King Jr. Day': 'Martin Luther King Day', "President's Day": 'Presidents’ Day',
    "Washington's Birthday": 'Presidents’ Day', 'Independence Day Holiday': 'Fête de l’indépendance (congé)',
    'New Year Holiday': 'Congé du Nouvel An', "New Year's Holiday": 'Congé du Nouvel An', "New Year's Day Holiday": 'Congé du jour de l’an',
    'National Holiday': 'Fête nationale', 'National Day Holiday': 'Fête nationale (congé)', 'Constitution Day Holiday': 'Fête de la Constitution (congé)',
    'Substitute Holiday': 'Jour reporté', 'Day off': 'Jour de pont', 'Laylat al-Qadr': 'Nuit du destin', 'Green Monday': 'Lundi pur',
    'Great Prayer Day': 'Grand jour de prière', 'Whit Sunday': 'Pentecôte', "Saint Patrick's Day": 'Saint-Patrick',
    'Early May Bank Holiday': 'Lundi de mai', 'Sunday': 'Dimanche',
}

ENTETE = '''/**
 * Les jours fériés nationaux et le week-end des pays de départ, hors France.
 *
 * Généré par `packages/core/scripts/feries.py` depuis la bibliothèque Python
 * `holidays` {version} (licence MIT) : ne pas modifier à la main. Années
 * {premiere} à {derniere}.
 *
 * Format compact, pour peser peu : `n` liste les noms ([français, anglais],
 * l'anglais omis quand il est identique) ; `d` liste les jours par année,
 * « 2027:0101 0,0326 1,… » sans les espaces — « MMJJ » suivi de l'indice du
 * nom et d'une marque éventuelle : `r` jour reporté (le férié tombe un
 * week-end), `e` date estimée (fêtes réglées sur la lune) ; `;` sépare les années.
 * `w` : les jours du week-end, numérotés comme `Date.getUTCDay()` (0 = dimanche).
 */
export interface FeriesDUnPays {{
  w: readonly number[];
  n: readonly (readonly [string] | readonly [string, string])[];
  d: string;
}}

export const FERIES_CONNUS = {{ premiere: {premiere}, derniere: {derniere} }} as const;

export const FERIES_DU_MONDE: Readonly<Record<string, FeriesDUnPays>> = {{
'''


def codes_du_catalogue():
    texte = open(DESTINATIONS, encoding='utf-8').read()
    return sorted(set(re.findall(r"make\(\s*'[^']*',\s*'(?:[^'\\]|\\.)*',\s*'(?:[^'\\]|\\.)*',\s*'([A-Z]{2})'", texte)) - {'FR'})


def morceaux(nom):
    """« Christmas Day (observed) » → ('Christmas Day', 'r') ; un jour peut porter plusieurs noms."""
    for partie in nom.split('; '):
        marque = ''
        if re.search(r'\((observed|substitute|in lieu|observée?|reportée?)', partie, re.I):
            marque = 'r'
        elif re.search(r'\((estimated|estimée?)\)', partie, re.I):
            marque = 'e'
        base = re.sub(r'\s*\((observed|estimated|substitute|in lieu|observée?|estimée?|reportée?)[^)]*\)', '', partie, flags=re.I).strip()
        base = re.sub(r'^(Day off|Bridge holiday|Additional public holiday)\b.*', 'Day off', base)
        yield base, marque


def js(texte):
    # L'apostrophe typographique, comme partout dans Tripora.
    return "'" + texte.replace('\\', '\\\\').replace("'", '’') + "'"


def pays(code, localisees):
    langues = localisees.get(code, [])
    kw = {'years': range(PREMIERE, DERNIERE + 1)}
    if code in SUBDIVISIONS:
        kw['subdiv'] = SUBDIVISIONS[code]
    en = holidays.country_holidays(code, **kw, **({'language': 'en_US'} if 'en_US' in langues else {}))
    fr = holidays.country_holidays(code, **kw, language='fr') if 'fr' in langues else None
    noms, indices, jours = [], {}, []
    for date in sorted(en):
        noms_fr = list(morceaux(fr.get(date))) if fr is not None and fr.get(date) else None
        for k, (base, marque) in enumerate(morceaux(en.get(date))):
            # Certains pays comptent chaque dimanche comme férié : sans intérêt ici.
            if base == 'Sunday':
                continue
            alignes = noms_fr is not None and len(noms_fr) == len(list(morceaux(en.get(date))))
            francais = noms_fr[k][0] if alignes else FRANCAIS.get(base, base)
            cle = (francais, base)
            if cle not in indices:
                indices[cle] = len(noms)
                noms.append(cle)
            jours.append((date.year, f'{date:%m%d}{indices[cle]}{marque}'))
    # Python : lundi = 0 ; Date.getUTCDay() : dimanche = 0.
    weekend = sorted((j + 1) % 7 for j in en.weekend)
    n = ', '.join('[' + js(f) + (', ' + js(e) if e != f else '') + ']' for f, e in noms)
    annees = sorted({annee for annee, _ in jours})
    d = ';'.join(f"{annee}:" + ','.join(j for a, j in jours if a == annee) for annee in annees)
    return f"  {code}: {{ w: {weekend}, n: [{n}], d: '{d}' }},\n"


def main():
    localisees = holidays.list_localized_countries()
    codes = codes_du_catalogue()
    corps = ''.join(pays(code, localisees) for code in codes)
    with open(SORTIE, 'w', encoding='utf-8') as f:
        f.write(ENTETE.format(version=holidays.__version__, premiere=PREMIERE, derniere=DERNIERE) + corps + '};\n')
    print(f'{len(codes)} pays, {os.path.getsize(SORTIE) // 1024} Ko → {os.path.relpath(SORTIE)}', file=sys.stderr)


if __name__ == '__main__':
    main()
