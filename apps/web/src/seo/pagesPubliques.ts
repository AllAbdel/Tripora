import {
  AXIS_LABELS_FR,
  DAILY_BASELINE_CENTS,
  DESTINATIONS,
  NOMS_DES_CONTINENTS,
  TITRES_DES_RUBRIQUES,
  activityLinks,
  affilierLiens,
  climateFromSeries,
  climateYear,
  continentDe,
  haversineKm,
  infosPratiques,
  liensDeRubrique,
  type BookingLink,
  type Continent,
  type Destination,
  type IdentiteDePartenaire,
  type MonthlyClimate,
  type RubriqueDePartenaire,
} from '@tripora/core';
import { activitesDe, libelleActivite, type Activite } from '@tripora/core/activites';
import { NORMALES_RELEVEES } from './normales.donnees';

/**
 * Les pages publiques du carnet : une par destination, plus leur sommaire.
 *
 * Tripora est une application à page unique, et tout ce qu'elle montre est
 * derrière une connexion : pour un moteur de recherche, chaque adresse du site
 * affichait le même écran de connexion. Ces pages-ci sont du HTML statique,
 * écrit au moment du build à partir du carnet — lisibles sans JavaScript, sans
 * compte et sans réseau, rapides à afficher, et chacune répond à une vraie
 * question : « que faire à Bergen, quand y aller, combien ça coûte ».
 *
 * Tout ce qui y figure vient du code, jamais d'une IA ni d'une invention : les
 * activités et leurs prix indicatifs du carnet, les normales climatiques
 * mesurées, le budget calculé comme dans l'application, les infos pratiques du
 * pays. Un chiffre qu'on n'a pas n'apparaît pas.
 */

export interface Contexte {
  /** L'adresse du site, sans barre finale : https://tripora-3rg.pages.dev */
  origine: string;
  /** La date de génération, AAAA-MM-JJ, pour le plan du site. */
  aujourdhui: string;
  /** L'identité Travelpayouts : sans elle, les liens partenaires restent ordinaires. */
  partenaire?: IdentiteDePartenaire;
}

export interface Fichier {
  chemin: string;
  contenu: string;
}

/** Les destinations qui ont assez de matière pour mériter une page. */
export function destinationsPubliees(): Destination[] {
  return DESTINATIONS.filter((destination) => activitesDe(destination.id).length >= 3).sort(
    (a, b) => a.name.localeCompare(b.name, 'fr'),
  );
}

export function cheminDeLaDestination(id: string): string {
  return `/destinations/${id}`;
}

/** Toutes les pages, le plan du site et les consignes aux robots. */
export function genererLesPages(contexte: Contexte): Fichier[] {
  const publiees = destinationsPubliees();
  return [
    ...publiees.map((destination) => ({
      chemin: `destinations/${destination.id}.html`,
      contenu: pageDeDestination(destination, publiees, contexte),
    })),
    ...MOIS.map((_, index) => ({
      chemin: `ou-partir-en/${SLUGS_DES_MOIS[index]}.html`,
      contenu: pageDuMois(index + 1, publiees, contexte),
    })),
    { chemin: 'destinations.html', contenu: sommaire(publiees, contexte) },
    { chemin: 'sitemap.xml', contenu: planDuSite(publiees, contexte) },
    { chemin: 'robots.txt', contenu: robots(contexte) },
  ];
}

// ---------------------------------------------------------------------------
// Une destination
// ---------------------------------------------------------------------------

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const MOMENTS: Record<Activite['moment'], string> = {
  matin: 'le matin',
  'apres-midi': 'l’après-midi',
  soir: 'le soir',
  journee: 'à la journée',
};

export function pageDeDestination(
  destination: Destination,
  publiees: readonly Destination[],
  { origine, partenaire }: Contexte,
): string {
  const activites = activitesDe(destination.id);
  const adresse = `${origine}${cheminDeLaDestination(destination.id)}`;
  const saison = periodeLisible(destination.bestMonths);
  const budget = budgetParJour(destination);
  const climat = climatDe(destination.id);
  const pratique = infosPratiques(destination.countryCode);

  const titre = `${destination.name} : que faire ? ${activites.length} idées d’activités | Tripora`;
  const exemples = activites
    .slice(0, 3)
    .map((activite) => articleEnMinuscule(activite.nom))
    .join(', ');
  const description = tronquer(
    `${destination.name} (${destination.country}) : ${activites.length} idées d’activités — ${exemples}… — avec durée, prix et meilleur moment.${saison ? ` À privilégier : ${saison}.` : ''} Budget sur place dès ${euros(budget.budget)} par jour.`,
    300,
  );

  const proches = publiees
    .filter((autre) => autre.id !== destination.id)
    .map((autre) => ({ autre, km: haversineKm(destination, autre) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 6);
  const memePays = publiees.filter(
    (autre) => autre.id !== destination.id && autre.countryCode === destination.countryCode,
  );

  const donnees = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TouristDestination',
        name: destination.name,
        url: adresse,
        description,
        geo: { '@type': 'GeoCoordinates', latitude: destination.lat, longitude: destination.lng },
        containedInPlace: { '@type': 'Country', name: destination.country },
        includesAttraction: activites.map((activite) => ({
          '@type': 'TouristAttraction',
          name: activite.nom,
          description: activite.resume,
          geo: { '@type': 'GeoCoordinates', latitude: activite.lat, longitude: activite.lng },
          ...(activite.wikipedia ? { sameAs: adresseWikipedia(activite.wikipedia) } : {}),
        })),
      },
      filDAriane([
        ['Destinations', `${origine}/destinations`],
        [destination.name, adresse],
      ]),
    ],
  };

  const corps = `
    <nav class="ariane" aria-label="Fil d’Ariane">
      <a href="/destinations">Destinations</a> <span aria-hidden="true">›</span>
      <span>${esc(destination.country)}</span> <span aria-hidden="true">›</span>
      <span aria-current="page">${esc(destination.name)}</span>
    </nav>

    <header class="entete">
      <p class="surtitre">${esc(destination.country)}</p>
      <h1>${esc(destination.name)} : que faire ?</h1>
      <p class="chapo">${activites.length} idées d’activités, avec leur durée, leur prix indicatif et le meilleur moment de la journée${saison ? `. Meilleure période : <strong>${esc(saison)}</strong>` : ''}.</p>
    </header>

    ${appelAOrganiser(destination)}

    <section aria-labelledby="titre-activites">
      <h2 id="titre-activites">Les activités</h2>
      <ol class="activites">
        ${activites.map(carteDActivite).join('\n')}
      </ol>
    </section>

    ${sectionQuandPartir(destination, saison, climat)}

    <section aria-labelledby="titre-budget">
      <h2 id="titre-budget">Quel budget sur place ?</h2>
      <p>Par personne et par jour, hébergement, repas, transports locaux et visites compris — hors trajet aller-retour. Une estimation calculée comme dans l’application, à partir du coût de la vie sur place.</p>
      <dl class="budget">
        <div><dt>Petit budget</dt><dd>${euros(budget.budget)}</dd></div>
        <div><dt>Confort moyen</dt><dd>${euros(budget.mid)}</dd></div>
        <div><dt>Grand confort</dt><dd>${euros(budget.comfort)}</dd></div>
      </dl>
    </section>

    ${sectionReserver(destination, partenaire)}

    ${pratique ? sectionPratique(destination, pratique) : ''}

    <section aria-labelledby="titre-proches">
      <h2 id="titre-proches">Pas loin de ${esc(destination.name)}</h2>
      <ul class="liens">
        ${proches
          .map(
            ({ autre, km }) =>
              `<li><a href="${cheminDeLaDestination(autre.id)}">${esc(autre.name)}</a> <span class="discret">${esc(autre.country)}, ${arrondirKm(km)} km</span></li>`,
          )
          .join('\n')}
      </ul>
      ${
        memePays.length > 0
          ? `<h3>Ailleurs : ${esc(destination.country)}</h3>
      <ul class="liens">
        ${memePays.map((autre) => `<li><a href="${cheminDeLaDestination(autre.id)}">${esc(autre.name)}</a></li>`).join('\n')}
      </ul>`
          : ''
      }
    </section>

    ${appelAOrganiser(destination)}
  `;

  return gabarit({
    titre,
    description,
    adresse,
    corps,
    donnees,
    image: destination.imageUrl,
  });
}

function carteDActivite(activite: Activite): string {
  const prix = activite.prixCents === 0 ? 'Gratuit' : `≈ ${euros(activite.prixCents)}`;
  const faits = [
    AXIS_LABELS_FR[activite.axis],
    libelleActivite(activite),
    dureeLisible(activite.dureeHeures),
    prix,
    `plutôt ${MOMENTS[activite.moment]}`,
  ];
  const source = activite.wikipedia
    ? ` <a class="source" href="${esc(adresseWikipedia(activite.wikipedia))}" rel="noopener">Sur Wikipédia</a>`
    : '';
  return `<li class="activite">
          <h3>${esc(activite.nom)}</h3>
          <p>${esc(activite.resume)}${source}</p>
          <p class="faits">${faits.map((fait) => `<span>${esc(fait)}</span>`).join('')}</p>
        </li>`;
}

function sectionQuandPartir(
  destination: Destination,
  saison: string | null,
  climat: readonly MonthlyClimate[],
): string {
  if (!saison && climat.length !== 12) return '';
  const phrase = saison
    ? `<p>Les mois les plus agréables pour ${esc(destination.name)} : <strong>${esc(saison)}</strong>, en tenant compte de la météo et de l’affluence.</p>
      <p class="discret">Autres idées pour ces mois-là : ${[...destination.bestMonths]
        .sort((a, b) => a - b)
        .map((mois) => `<a href="${cheminDuMois(mois)}">où partir en ${MOIS[mois - 1]}</a>`)
        .join(', ')}.</p>`
    : '';
  if (climat.length !== 12) {
    return `
    <section aria-labelledby="titre-climat">
      <h2 id="titre-climat">Quand partir ?</h2>
      ${phrase}
    </section>`;
  }
  const lignes = climat
    .map((mois, index) => {
      const bon = destination.bestMonths.includes(index + 1);
      return `<tr${bon ? ' class="bon"' : ''}><th scope="row">${MOIS[index]}${bon ? ' <span class="pastille">idéal</span>' : ''}</th><td>${Math.round(mois.avgHighC)} °C</td><td>${Math.round(mois.avgLowC)} °C</td><td>${mois.rainyDays}</td></tr>`;
    })
    .join('\n');
  return `
    <section aria-labelledby="titre-climat">
      <h2 id="titre-climat">Quand partir ?</h2>
      ${phrase}
      <p>Les normales mesurées ces dernières années : températures moyennes et nombre de jours de pluie, mois par mois.</p>
      <div class="defile">
        <table class="climat">
          <caption>Le climat de ${esc(destination.name)}, mois par mois</caption>
          <thead><tr><th scope="col">Mois</th><th scope="col">Max.</th><th scope="col">Min.</th><th scope="col">Jours de pluie</th></tr></thead>
          <tbody>
            ${lignes}
          </tbody>
        </table>
      </div>
    </section>`;
}

/** Les normales : celles, vérifiées, du catalogue, sinon le relevé de la base. */
export function climatDe(id: string): MonthlyClimate[] {
  const embarquees = climateYear(id);
  if (embarquees.length === 12) return embarquees;
  const serie = NORMALES_RELEVEES[id];
  if (!serie) return [];
  const mois = Array.from({ length: 12 }, (_, index) => climateFromSeries(serie, index + 1));
  return mois.every((m): m is MonthlyClimate => m !== undefined) ? mois : [];
}

const RUBRIQUES_PUBLIQUES: readonly RubriqueDePartenaire[] = ['internet', 'transfert', 'voiture'];

/**
 * Les liens pour réserver : les visites (Klook cherche la ville), puis
 * internet, l'aéroport, la voiture. Liens partenaires, dits comme tels, et
 * marqués `sponsored` pour les moteurs — la même transparence que dans
 * l'application.
 */
function sectionReserver(destination: Destination, partenaire: IdentiteDePartenaire | undefined): string {
  const groupes: [string, BookingLink[]][] = [
    [TITRES_DES_RUBRIQUES.activites, affilierLiens(activityLinks(destination), partenaire)],
    ...RUBRIQUES_PUBLIQUES.map(
      (rubrique): [string, BookingLink[]] => [
        TITRES_DES_RUBRIQUES[rubrique],
        affilierLiens(liensDeRubrique(rubrique, destination), partenaire),
      ],
    ),
  ];
  const affilies = groupes.some(([, liens]) => liens.some((lien) => lien.affilie));
  return `
    <section aria-labelledby="titre-reserver">
      <h2 id="titre-reserver">Réserver sur place</h2>
      ${groupes
        .map(
          ([titre, liens]) => `
      <h3>${esc(titre)}</h3>
      <ul class="partenaires">
        ${liens
          .map(
            (lien) =>
              `<li><a href="${esc(lien.url)}" rel="${lien.affilie ? 'sponsored nofollow noopener' : 'noopener'}" target="_blank">${esc(lien.label)}</a>${lien.note ? ` <span class="discret">${esc(lien.note)}</span>` : ''}</li>`,
          )
          .join('\n')}
      </ul>`,
        )
        .join('\n')}
      ${affilies ? '<p class="discret">Liens partenaires : si vous réservez par eux, Tripora peut toucher une commission, sans rien changer à votre prix ni à l’ordre de ces listes, qui est alphabétique.</p>' : ''}
    </section>`;
}

// ---------------------------------------------------------------------------
// Où partir en … ?
// ---------------------------------------------------------------------------

const SLUGS_DES_MOIS = [
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre',
];

export function cheminDuMois(mois: number): string {
  return `/ou-partir-en/${SLUGS_DES_MOIS[mois - 1]}`;
}

/** « en avril », mais « en août » : la préposition ne change pas, le nom oui. */
function nomDuMois(mois: number): string {
  return MOIS[mois - 1]!;
}

export function pageDuMois(mois: number, publiees: readonly Destination[], { origine }: Contexte): string {
  const nom = nomDuMois(mois);
  const adresse = `${origine}${cheminDuMois(mois)}`;
  const retenues = publiees.filter((destination) => destination.bestMonths.includes(mois));
  const avecClimat = retenues.map((destination) => ({ destination, climat: climatDe(destination.id)[mois - 1] }));

  const auChaud = avecClimat
    .filter(
      (ligne): ligne is { destination: Destination; climat: MonthlyClimate } =>
        ligne.climat !== undefined && ligne.climat.avgHighC >= 24 && ligne.climat.rainyDays <= 8,
    )
    .sort((a, b) => b.climat.avgHighC - a.climat.avgHighC)
    .slice(0, 12);

  const titre = `Où partir en ${nom} ? ${retenues.length} destinations au bon moment | Tripora`;
  const description = tronquer(
    `${retenues.length} destinations où ${nom} est l’un des meilleurs mois, météo et affluence comprises${auChaud.length > 0 ? ` — dont ${auChaud.slice(0, 3).map((l) => l.destination.name).join(', ')} au soleil` : ''}. Températures, jours de pluie et budget sur place pour chacune.`,
    300,
  );

  const ligne = ({ destination, climat }: { destination: Destination; climat: MonthlyClimate | undefined }) => {
    const faits = [
      climat ? `${Math.round(climat.avgHighC)} °C` : null,
      climat ? `${climat.rainyDays} j de pluie` : null,
      `dès ${euros(budgetParJour(destination).budget)} par jour`,
    ].filter(Boolean);
    return `<li><a href="${cheminDeLaDestination(destination.id)}">${esc(destination.name)}</a> <span class="discret">${esc(destination.country)} · ${esc(faits.join(' · '))}</span></li>`;
  };

  const parContinent = ORDRE_DES_CONTINENTS.map((continent) => ({
    continent,
    lignes: avecClimat.filter(({ destination }) => continentDe(destination.countryCode) === continent),
  })).filter((groupe) => groupe.lignes.length > 0);

  const corps = `
    <nav class="ariane" aria-label="Fil d’Ariane">
      <a href="/destinations">Destinations</a> <span aria-hidden="true">›</span>
      <span aria-current="page">Où partir en ${esc(nom)}</span>
    </nav>

    <header class="entete">
      <h1>Où partir en ${esc(nom)} ?</h1>
      <p class="chapo">${retenues.length} destinations où ${esc(nom)} compte parmi les meilleurs mois — la météo, mais aussi l’affluence et les prix. Pour chacune : la température et les jours de pluie de ce mois-là, et le budget sur place.</p>
    </header>

    ${navigationDesMois(mois)}

    ${
      auChaud.length > 0
        ? `<section aria-labelledby="titre-soleil">
      <h2 id="titre-soleil">Pour le soleil</h2>
      <p>Les plus chaudes en ${esc(nom)}, avec huit jours de pluie au plus.</p>
      <ul class="liste">
        ${auChaud.map(ligne).join('\n')}
      </ul>
    </section>`
        : ''
    }

    ${parContinent
      .map(
        ({ continent, lignes }) => `
    <section aria-labelledby="mois-${continent}">
      <h2 id="mois-${continent}">${esc(NOMS_DES_CONTINENTS[continent])}</h2>
      <ul class="liste">
        ${[...lignes]
          .sort((a, b) => a.destination.name.localeCompare(b.destination.name, 'fr'))
          .map(ligne)
          .join('\n')}
      </ul>
    </section>`,
      )
      .join('\n')}

    <aside class="appel">
      <p><strong>Vous partez à plusieurs en ${esc(nom)} ?</strong> Dites à Tripora qui part, d’où et avec quel budget : il propose les destinations qui conviennent au groupe entier, prix des vols compris.</p>
      <a class="bouton" href="/voyages/nouveau">Trouver notre destination</a>
    </aside>
  `;

  return gabarit({
    titre,
    description,
    adresse,
    corps,
    donnees: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'CollectionPage', name: `Où partir en ${nom} ?`, url: adresse, description },
        filDAriane([
          ['Destinations', `${origine}/destinations`],
          [`Où partir en ${nom}`, adresse],
        ]),
      ],
    },
  });
}

function navigationDesMois(courant?: number): string {
  return `<nav class="mois" aria-label="Où partir, mois par mois">
      ${MOIS.map((nom, index) =>
        index + 1 === courant
          ? `<span aria-current="page">${nom}</span>`
          : `<a href="${cheminDuMois(index + 1)}">${nom}</a>`,
      ).join('\n')}
    </nav>`;
}

function sectionPratique(
  destination: Destination,
  pratique: NonNullable<ReturnType<typeof infosPratiques>>,
): string {
  const urgences = pratique.urgences
    .map((numero) => (numero.service ? `${numero.numero} (${numero.service})` : numero.numero))
    .join(', ');
  return `
    <section aria-labelledby="titre-pratique">
      <h2 id="titre-pratique">Bon à savoir : ${esc(destination.country)}</h2>
      <dl class="pratique">
        <div><dt>Prises</dt><dd>Type ${esc(pratique.prises.join(', '))}, ${esc(pratique.tension)} V</dd></div>
        ${urgences ? `<div><dt>Urgences</dt><dd>${esc(urgences)}</dd></div>` : ''}
        <div><dt>Conduite</dt><dd>À ${pratique.conduite}</dd></div>
      </dl>
    </section>`;
}

function appelAOrganiser(destination: Destination): string {
  return `
    <aside class="appel">
      <p><strong>Vous partez à plusieurs ?</strong> Tripora réunit les envies et le budget de chacun, fait voter le groupe, compose le programme jour par jour et partage les dépenses. Gratuit.</p>
      <a class="bouton" href="/voyages/nouveau?destination=${encodeURIComponent(destination.id)}">Organiser ce voyage</a>
    </aside>`;
}

// ---------------------------------------------------------------------------
// Le sommaire
// ---------------------------------------------------------------------------

const ORDRE_DES_CONTINENTS: readonly Continent[] = [
  'europe',
  'afrique',
  'asie',
  'amerique-du-nord',
  'amerique-du-sud',
  'oceanie',
];

export function sommaire(publiees: readonly Destination[], { origine }: Contexte): string {
  const adresse = `${origine}/destinations`;
  const nombreDActivites = publiees.reduce(
    (total, destination) => total + activitesDe(destination.id).length,
    0,
  );
  const titre = `Où partir ? ${publiees.length} destinations et leurs activités | Tripora`;
  const description = `${publiees.length} destinations et ${nombreDActivites.toLocaleString('fr-FR')} idées d’activités, avec leur prix, leur durée, la meilleure saison et le budget sur place. De quoi choisir où partir, seul ou à plusieurs.`;

  const parContinent = ORDRE_DES_CONTINENTS.map((continent) => ({
    continent,
    destinations: publiees.filter((destination) => continentDe(destination.countryCode) === continent),
  })).filter((groupe) => groupe.destinations.length > 0);

  const corps = `
    <header class="entete">
      <h1>Où partir ?</h1>
      <p class="chapo">${publiees.length} destinations, ${nombreDActivites.toLocaleString('fr-FR')} idées d’activités. Pour chacune : quoi faire, combien de temps, à quel prix, quand y aller et quel budget prévoir sur place.</p>
    </header>
    <section aria-labelledby="titre-par-mois">
      <h2 id="titre-par-mois">Par mois</h2>
      ${navigationDesMois()}
    </section>
    ${parContinent
      .map(
        ({ continent, destinations }) => `
    <section aria-labelledby="continent-${continent}">
      <h2 id="continent-${continent}">${esc(NOMS_DES_CONTINENTS[continent])}</h2>
      ${grouperParPays(destinations)
        .map(
          ([pays, liste]) => `
      <h3>${esc(pays)}</h3>
      <ul class="liens">
        ${liste.map((destination) => `<li><a href="${cheminDeLaDestination(destination.id)}">${esc(destination.name)}</a> <span class="discret">${activitesDe(destination.id).length} activités</span></li>`).join('\n')}
      </ul>`,
        )
        .join('\n')}
    </section>`,
      )
      .join('\n')}
    <aside class="appel">
      <p><strong>Vous ne savez pas encore où aller ?</strong> Dites à Tripora qui part, d’où, quand et avec quel budget : il propose les destinations qui conviennent au groupe entier, prix des vols compris.</p>
      <a class="bouton" href="/voyages/nouveau">Trouver une destination</a>
    </aside>
  `;

  return gabarit({
    titre,
    description,
    adresse,
    corps,
    donnees: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          name: 'Où partir ?',
          url: adresse,
          description,
        },
        filDAriane([['Destinations', adresse]]),
      ],
    },
  });
}

function grouperParPays(destinations: readonly Destination[]): [string, Destination[]][] {
  const groupes = new Map<string, Destination[]>();
  for (const destination of destinations) {
    groupes.set(destination.country, [...(groupes.get(destination.country) ?? []), destination]);
  }
  return [...groupes.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'));
}

// ---------------------------------------------------------------------------
// Plan du site et robots
// ---------------------------------------------------------------------------

export function planDuSite(publiees: readonly Destination[], { origine, aujourdhui }: Contexte): string {
  const adresses = [
    '/destinations',
    ...MOIS.map((_, index) => cheminDuMois(index + 1)),
    ...publiees.map((destination) => cheminDeLaDestination(destination.id)),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${esc(origine)}/</loc><lastmod>${aujourdhui}</lastmod></url>
${adresses.map((chemin) => `  <url><loc>${esc(origine + chemin)}</loc><lastmod>${aujourdhui}</lastmod></url>`).join('\n')}
</urlset>
`;
}

/**
 * Ce qu'un robot peut lire. Tout ce qui est derrière une connexion est fermé :
 * il n'y verrait que l'écran de connexion, répété sur des milliers d'adresses,
 * et les liens d'invitation (`/rejoindre/…`) n'ont rien à faire dans un index.
 */
export function robots({ origine }: Contexte): string {
  return `User-agent: *
Allow: /$
Allow: /destinations
Allow: /ou-partir-en/
Allow: /confidentialite
Disallow: /voyages
Disallow: /rejoindre
Disallow: /profil
Disallow: /passeport
Disallow: /budget
Disallow: /carte
Disallow: /explorer
Disallow: /soutenir
Disallow: /applications
Disallow: /retour-app
Disallow: /go/

Sitemap: ${origine}/sitemap.xml
`;
}

// ---------------------------------------------------------------------------
// Le gabarit commun
// ---------------------------------------------------------------------------

function gabarit({
  titre,
  description,
  adresse,
  corps,
  donnees,
  image,
}: {
  titre: string;
  description: string;
  adresse: string;
  corps: string;
  donnees: unknown;
  image?: string | undefined;
}): string {
  const origine = new URL(adresse).origin;
  const visuel = image ?? `${origine}/icons/og-image.png`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(adresse)}">
<meta name="theme-color" content="#1a5fb4">
<link rel="icon" type="image/svg+xml" href="/icons/favicon.svg">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="preload" href="/polices/fraunces-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/pages.css">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tripora">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(adresse)}">
<meta property="og:image" content="${esc(visuel)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd(donnees)}</script>
</head>
<body>
<header class="barre">
  <a class="marque" href="/"><img src="/icons/favicon.svg" alt="" width="28" height="28"> Tripora</a>
  <a class="bouton bouton-discret" href="/">Ouvrir l’application</a>
</header>
<main>
${corps}
</main>
<footer class="pied">
  <p><a href="/destinations">Toutes les destinations</a> · <a href="/">L’application</a> · <a href="/confidentialite">Confidentialité</a></p>
  <p class="discret">Activités et prix indicatifs du carnet Tripora, vérifiés à la main. Climat : normales Open-Meteo. Descriptions détaillées : Wikipédia, sous licence CC BY-SA.</p>
</footer>
</body>
</html>
`;
}

function filDAriane(etapes: [nom: string, adresse: string][]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: etapes.map(([name, item], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item,
    })),
  };
}

// ---------------------------------------------------------------------------
// Petits outils, exportés pour les tests
// ---------------------------------------------------------------------------

/** Échappe ce qui entre dans du HTML, texte comme attribut. */
export function esc(texte: string): string {
  return texte
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Du JSON sûr dans une balise `<script>` : un « </script> » dans un résumé
 * fermerait la balise et ouvrirait la page à l'injection.
 */
export function jsonLd(donnees: unknown): string {
  return JSON.stringify(donnees).replaceAll('<', '\\u003c');
}

/** [5, 6, 7, 8, 9] → « de mai à septembre » ; [11, 12, 1, 2] passe l'hiver. */
export function periodeLisible(mois: readonly number[]): string | null {
  const tries = [...new Set(mois)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (tries.length === 0) return null;
  if (tries.length === 12) return 'toute l’année';
  if (tries.length === 1) return `en ${MOIS[tries[0]! - 1]}`;
  // Une suite continue, éventuellement à cheval sur la nouvelle année : on
  // cherche le mois après lequel commence le seul « trou ».
  const trous = tries.filter((m, i) => {
    const suivant = tries[(i + 1) % tries.length]!;
    return (suivant - m + 12) % 12 !== 1;
  });
  if (trous.length === 1) {
    const fin = trous[0]!;
    const debut = tries[(tries.indexOf(fin) + 1) % tries.length]!;
    return `de ${MOIS[debut - 1]} à ${MOIS[fin - 1]}`;
  }
  const noms = tries.map((m) => MOIS[m - 1]!);
  return `en ${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}`;
}

/** Le budget journalier par personne, comme l'application le calcule, arrondi à 5 €. */
export function budgetParJour(destination: Pick<Destination, 'costIndex'>): {
  budget: number;
  mid: number;
  comfort: number;
} {
  const niveau = (cle: keyof typeof DAILY_BASELINE_CENTS) => {
    const base = DAILY_BASELINE_CENTS[cle];
    const total =
      (base.accommodation + base.food + base.localTransport + base.activities) *
      destination.costIndex;
    return Math.round(total / 500) * 500;
  };
  return { budget: niveau('budget'), mid: niveau('mid'), comfort: niveau('comfort') };
}

export function adresseWikipedia(etiquette: string): string {
  const [langue, ...reste] = etiquette.split(':');
  const titre = reste.join(':').replaceAll(' ', '_');
  return `https://${langue}.wikipedia.org/wiki/${encodeURIComponent(titre).replaceAll('%2F', '/')}`;
}

function euros(centimes: number): string {
  // Espace insécable : « 25 » et « € » ne se séparent pas en fin de ligne.
  return `${Math.round(centimes / 100).toLocaleString('fr-FR')}\u00a0€`;
}

function dureeLisible(heures: number): string {
  if (heures >= 24) return `${Math.round(heures / 24)} jour${heures >= 48 ? 's' : ''}`;
  if (heures < 1) return `${Math.round(heures * 60)} min`;
  const entieres = Math.floor(heures);
  const minutes = Math.round((heures - entieres) * 60);
  return minutes ? `${entieres} h ${minutes}` : `${entieres} h`;
}

function arrondirKm(km: number): string {
  return (km < 100 ? Math.round(km) : Math.round(km / 10) * 10).toLocaleString('fr-FR');
}

/** « Le mont Ulriken » → « le mont Ulriken », au milieu d'une phrase. */
function articleEnMinuscule(nom: string): string {
  return nom.replace(/^(?:(?:Les|Le|La|Une|Un|Des)(?=\s)|L’)/u, (article) => article.toLowerCase());
}

function tronquer(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  return `${texte.slice(0, max - 1).replace(/\s+\S*$/u, '')}…`;
}
