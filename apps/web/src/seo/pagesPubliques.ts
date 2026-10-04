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
  empreinteDuTrajet,
  estimateTransportOptions,
  kgLisibles,
  phraseDeComparaison,
  TRANSPORT_LABELS_FR,
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
import { NOMS_ET_RESUMES } from '../i18n/carnet-en';
import { normaliser, traduireCle } from '../i18n/moteur';
import { MOTIFS as MOTIFS_EN, NOMS_DES_DESTINATIONS, PHRASES as PHRASES_EN } from '../i18n/phrases-en';
import { NORMALES_RELEVEES } from './normales.donnees';
import {
  cheminDuMois,
  cheminDuSommaire,
  SLUGS_DES_MOIS,
  SLUGS_DES_MOIS_EN,
  type LangueDesPages,
} from './mois';

export { cheminDuMois, type LangueDesPages };

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
 *
 * Chaque page existe aussi en anglais, sous `/en/` : les mêmes faits, les
 * textes du carnet traduits (`carnet-en.ts`), les libellés du cœur passés par
 * le dictionnaire de l'application, et des liens `hreflang` croisés qui
 * disent aux moteurs quelle version montrer à qui.
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

export function cheminDeLaDestination(id: string, langue: LangueDesPages = 'fr'): string {
  return `${langue === 'en' ? '/en' : ''}/destinations/${id}`;
}

/** Toutes les pages, dans les deux langues, le plan du site et les consignes aux robots. */
export function genererLesPages(contexte: Contexte): Fichier[] {
  const publiees = destinationsPubliees();
  const pages = (langue: LangueDesPages): Fichier[] => {
    const prefixe = langue === 'en' ? 'en/' : '';
    const slugs = langue === 'en' ? SLUGS_DES_MOIS_EN : SLUGS_DES_MOIS;
    const dossierDesMois = langue === 'en' ? 'where-to-go-in' : 'ou-partir-en';
    return [
      ...publiees.map((destination) => ({
        chemin: `${prefixe}destinations/${destination.id}.html`,
        contenu: pageDeDestination(destination, publiees, contexte, langue),
      })),
      ...MOIS.map((_, index) => ({
        chemin: `${prefixe}${dossierDesMois}/${slugs[index]}.html`,
        contenu: pageDuMois(index + 1, publiees, contexte, langue),
      })),
      { chemin: `${prefixe}destinations.html`, contenu: sommaire(publiees, contexte, langue) },
    ];
  };
  return [
    ...pages('fr'),
    ...pages('en'),
    { chemin: 'sitemap.xml', contenu: planDuSite(publiees, contexte) },
    { chemin: 'robots.txt', contenu: robots(contexte) },
    { chemin: 'llms.txt', contenu: pourLesAssistants(publiees, contexte) },
  ];
}

// ---------------------------------------------------------------------------
// Les deux langues
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

const MOIS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MOMENTS: Record<Activite['moment'], string> = {
  matin: 'le matin',
  'apres-midi': 'l’après-midi',
  soir: 'le soir',
  journee: 'à la journée',
};

const MOMENTS_EN: Record<Activite['moment'], string> = {
  matin: 'best in the morning',
  'apres-midi': 'best in the afternoon',
  soir: 'best in the evening',
  journee: 'takes the whole day',
};

const DICTIONNAIRE_EN = { phrases: PHRASES_EN, motifs: MOTIFS_EN };

/** Les services d'urgence des infos pratiques, en anglais. */
const SERVICES_EN: Readonly<Record<string, string>> = {
  pompiers: 'fire',
  'police touristique': 'tourist police',
};

/**
 * Un texte du cœur (libellé d'envie, de catégorie, de transport, nom d'un
 * service d'urgence, d'une rubrique de liens) dans la langue de la page : le
 * même dictionnaire que l'application. Sans traduction connue, le français
 * reste — un test vérifie qu'aucune page anglaise n'en garde.
 */
function dire(langue: LangueDesPages, francais: string): string {
  if (langue === 'fr') return francais;
  return traduireCle(DICTIONNAIRE_EN, normaliser(francais)) ?? francais;
}

function nomDe(destination: Destination, langue: LangueDesPages): string {
  return langue === 'en' ? (NOMS_DES_DESTINATIONS[destination.id] ?? destination.name) : destination.name;
}

/** Le pays tel que le carnet le nomme (« France » pour Saint-Barthélemy), traduit comme dans l'application. */
function paysDe(destination: Destination, langue: LangueDesPages): string {
  return dire(langue, destination.country);
}

function texteDe(activite: Activite, langue: LangueDesPages): { nom: string; resume: string } {
  const anglais = langue === 'en' ? NOMS_ET_RESUMES[activite.id] : undefined;
  return anglais ? { nom: anglais[0], resume: anglais[1] } : { nom: activite.nom, resume: activite.resume };
}

function nomDuMois(mois: number, langue: LangueDesPages = 'fr'): string {
  return (langue === 'en' ? MOIS_EN : MOIS)[mois - 1]!;
}

/** Les adresses d'une même page dans les deux langues, pour les liens `hreflang`. */
interface Versions {
  fr: string;
  en: string;
}

// ---------------------------------------------------------------------------
// Une destination
// ---------------------------------------------------------------------------

export function pageDeDestination(
  destination: Destination,
  publiees: readonly Destination[],
  { origine, partenaire }: Contexte,
  langue: LangueDesPages = 'fr',
): string {
  const en = langue === 'en';
  const activites = activitesDe(destination.id);
  const versions: Versions = {
    fr: `${origine}${cheminDeLaDestination(destination.id, 'fr')}`,
    en: `${origine}${cheminDeLaDestination(destination.id, 'en')}`,
  };
  const adresse = versions[langue];
  const nom = nomDe(destination, langue);
  const pays = paysDe(destination, langue);
  const saison = periodeLisible(destination.bestMonths, langue);
  const budget = budgetParJour(destination);
  const climat = climatDe(destination.id);
  const pratique = infosPratiques(destination.countryCode);

  // « Malte (Malte) » n'apprend rien : le pays ne se répète pas.
  const situee = nom === pays ? nom : `${nom} (${pays})`;
  const titre = en
    ? `Things to do in ${nom}: ${activites.length} activity ideas | Tripora`
    : `${nom} : que faire ? ${activites.length} idées d’activités | Tripora`;
  const exemples = activites
    .slice(0, 3)
    .map((activite) => articleEnMinuscule(texteDe(activite, langue).nom, langue))
    .join(', ');
  const description = tronquer(
    en
      ? `${situee}: ${activites.length} activity ideas — ${exemples}… — with how long they take, their price and the best time to go.${saison ? ` Best time to visit: ${saison}.` : ''} Daily budget on the ground from ${euros(budget.budget, langue)}.`
      : `${situee} : ${activites.length} idées d’activités — ${exemples}… — avec durée, prix et meilleur moment.${saison ? ` À privilégier : ${saison}.` : ''} Budget sur place dès ${euros(budget.budget)} par jour.`,
    300,
  );

  const proches = publiees
    .filter((autre) => autre.id !== destination.id)
    .map((autre) => ({ autre, km: haversineKm(destination, autre) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 6);
  const memePays = publiees
    .filter((autre) => autre.id !== destination.id && autre.countryCode === destination.countryCode)
    .sort((a, b) => nomDe(a, langue).localeCompare(nomDe(b, langue), langue));

  const donnees = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TouristDestination',
        name: nom,
        url: adresse,
        description,
        geo: { '@type': 'GeoCoordinates', latitude: destination.lat, longitude: destination.lng },
        containedInPlace: { '@type': 'Country', name: pays },
        includesAttraction: activites.map((activite) => ({
          '@type': 'TouristAttraction',
          name: texteDe(activite, langue).nom,
          description: texteDe(activite, langue).resume,
          geo: { '@type': 'GeoCoordinates', latitude: activite.lat, longitude: activite.lng },
          ...(activite.wikipedia ? { sameAs: adresseWikipedia(activite.wikipedia) } : {}),
        })),
      },
      filDAriane([
        ['Destinations', `${origine}${cheminDuSommaire(langue)}`],
        [nom, adresse],
      ]),
    ],
  };

  const corps = `
    <nav class="ariane" aria-label="${en ? 'Breadcrumb' : 'Fil d’Ariane'}">
      <a href="${cheminDuSommaire(langue)}">Destinations</a> <span aria-hidden="true">›</span>
      <span>${esc(pays)}</span> <span aria-hidden="true">›</span>
      <span aria-current="page">${esc(nom)}</span>
    </nav>

    <header class="entete">
      <p class="surtitre">${esc(pays)}</p>
      <h1>${en ? `Things to do in ${esc(nom)}` : `${esc(nom)} : que faire ?`}</h1>
      <p class="chapo">${
        en
          ? `${activites.length} activity ideas, with how long they take, an indicative price and the best time of day${saison ? `. Best time to visit: <strong>${esc(saison)}</strong>` : ''}.`
          : `${activites.length} idées d’activités, avec leur durée, leur prix indicatif et le meilleur moment de la journée${saison ? `. Meilleure période : <strong>${esc(saison)}</strong>` : ''}.`
      }</p>
    </header>

    ${appelAOrganiser(destination, langue)}

    <section aria-labelledby="titre-activites">
      <h2 id="titre-activites">${en ? 'Things to do' : 'Les activités'}</h2>
      <ol class="activites">
        ${activites.map((activite) => carteDActivite(activite, langue)).join('\n')}
      </ol>
    </section>

    ${sectionQuandPartir(destination, saison, climat, langue)}

    <section aria-labelledby="titre-budget">
      <h2 id="titre-budget">${en ? 'What budget on the ground?' : 'Quel budget sur place ?'}</h2>
      <p>${
        en
          ? 'Per person and per day, including accommodation, meals, local transport and visits — excluding the round trip. An estimate calculated the same way as in the app, from the local cost of living.'
          : 'Par personne et par jour, hébergement, repas, transports locaux et visites compris — hors trajet aller-retour. Une estimation calculée comme dans l’application, à partir du coût de la vie sur place.'
      }</p>
      <dl class="budget">
        <div><dt>${en ? 'Budget' : 'Petit budget'}</dt><dd>${euros(budget.budget, langue)}</dd></div>
        <div><dt>${en ? 'Mid-range' : 'Confort moyen'}</dt><dd>${euros(budget.mid, langue)}</dd></div>
        <div><dt>${en ? 'Comfort' : 'Grand confort'}</dt><dd>${euros(budget.comfort, langue)}</dd></div>
      </dl>
    </section>

    ${sectionEmpreinte(destination, langue)}

    ${sectionReserver(destination, partenaire, langue)}

    ${pratique ? sectionPratique(destination, pratique, langue) : ''}

    <section aria-labelledby="titre-proches">
      <h2 id="titre-proches">${en ? `Near ${esc(nom)}` : `Pas loin de ${esc(nom)}`}</h2>
      <ul class="liens">
        ${proches
          .map(
            ({ autre, km }) =>
              `<li><a href="${cheminDeLaDestination(autre.id, langue)}">${esc(nomDe(autre, langue))}</a> <span class="discret">${esc(paysDe(autre, langue))}, ${arrondirKm(km, langue)} km</span></li>`,
          )
          .join('\n')}
      </ul>
      ${
        memePays.length > 0
          ? `<h3>${en ? `Elsewhere in ${esc(pays)}` : `Ailleurs : ${esc(pays)}`}</h3>
      <ul class="liens">
        ${memePays.map((autre) => `<li><a href="${cheminDeLaDestination(autre.id, langue)}">${esc(nomDe(autre, langue))}</a></li>`).join('\n')}
      </ul>`
          : ''
      }
    </section>

    ${appelAOrganiser(destination, langue)}
  `;

  return gabarit({
    titre,
    description,
    langue,
    versions,
    corps,
    donnees,
    image: destination.imageUrl,
  });
}

function carteDActivite(activite: Activite, langue: LangueDesPages = 'fr'): string {
  const en = langue === 'en';
  const { nom, resume } = texteDe(activite, langue);
  const prix = activite.prixCents === 0 ? (en ? 'Free' : 'Gratuit') : `≈ ${euros(activite.prixCents, langue)}`;
  const faits = [
    dire(langue, AXIS_LABELS_FR[activite.axis]),
    dire(langue, libelleActivite(activite)),
    dureeLisible(activite.dureeHeures, langue),
    prix,
    en ? MOMENTS_EN[activite.moment] : `plutôt ${MOMENTS[activite.moment]}`,
  ];
  const source = activite.wikipedia ? ` ${lienWikipedia(activite.wikipedia, langue)}` : '';
  return `<li class="activite">
          <h3>${esc(nom)}</h3>
          <p>${esc(resume)}${source}</p>
          <p class="faits">${faits.map((fait) => `<span>${esc(fait)}</span>`).join('')}</p>
        </li>`;
}

function sectionQuandPartir(
  destination: Destination,
  saison: string | null,
  climat: readonly MonthlyClimate[],
  langue: LangueDesPages = 'fr',
): string {
  const en = langue === 'en';
  if (!saison && climat.length !== 12) return '';
  const nom = nomDe(destination, langue);
  const autresMois = [...destination.bestMonths]
    .sort((a, b) => a - b)
    .map((mois) =>
      en
        ? `<a href="${cheminDuMois(mois, 'en')}">where to go in ${nomDuMois(mois, 'en')}</a>`
        : `<a href="${cheminDuMois(mois)}">où partir en ${MOIS[mois - 1]}</a>`,
    )
    .join(', ');
  const phrase = saison
    ? en
      ? `<p>The most pleasant months in ${esc(nom)}: <strong>${esc(saison)}</strong>, taking weather and crowds into account.</p>
      <p class="discret">More ideas for those months: ${autresMois}.</p>`
      : `<p>Les mois les plus agréables pour ${esc(nom)} : <strong>${esc(saison)}</strong>, en tenant compte de la météo et de l’affluence.</p>
      <p class="discret">Autres idées pour ces mois-là : ${autresMois}.</p>`
    : '';
  const titre = en ? 'When to go' : 'Quand partir ?';
  if (climat.length !== 12) {
    return `
    <section aria-labelledby="titre-climat">
      <h2 id="titre-climat">${titre}</h2>
      ${phrase}
    </section>`;
  }
  const lignes = climat
    .map((mois, index) => {
      const bon = destination.bestMonths.includes(index + 1);
      return `<tr${bon ? ' class="bon"' : ''}><th scope="row">${nomDuMois(index + 1, langue)}${bon ? ` <span class="pastille">${en ? 'ideal' : 'idéal'}</span>` : ''}</th><td>${degres(mois.avgHighC, langue)}</td><td>${degres(mois.avgLowC, langue)}</td><td>${mois.rainyDays}</td></tr>`;
    })
    .join('\n');
  return `
    <section aria-labelledby="titre-climat">
      <h2 id="titre-climat">${titre}</h2>
      ${phrase}
      <p>${
        en
          ? 'Averages measured over recent years: mean temperatures and number of rainy days, month by month.'
          : 'Les normales mesurées ces dernières années : températures moyennes et nombre de jours de pluie, mois par mois.'
      }</p>
      <div class="defile">
        <table class="climat">
          <caption>${en ? `The climate in ${esc(nom)}, month by month` : `Le climat de ${esc(nom)}, mois par mois`}</caption>
          <thead><tr>${
            en
              ? '<th scope="col">Month</th><th scope="col">High</th><th scope="col">Low</th><th scope="col">Rainy days</th>'
              : '<th scope="col">Mois</th><th scope="col">Max.</th><th scope="col">Min.</th><th scope="col">Jours de pluie</th>'
          }</tr></thead>
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
function sectionReserver(
  destination: Destination,
  partenaire: IdentiteDePartenaire | undefined,
  langue: LangueDesPages = 'fr',
): string {
  const en = langue === 'en';
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
      <h2 id="titre-reserver">${en ? 'Book on the ground' : 'Réserver sur place'}</h2>
      ${groupes
        .map(
          ([titre, liens]) => `
      <h3>${esc(dire(langue, titre))}</h3>
      <ul class="partenaires">
        ${liens
          .map(
            (lien) =>
              `<li><a href="${esc(lien.url)}" rel="${lien.affilie ? 'sponsored nofollow noopener' : 'noopener'}" target="_blank">${esc(dire(langue, lien.label))}</a>${lien.note ? ` <span class="discret">${esc(dire(langue, lien.note))}</span>` : ''}</li>`,
          )
          .join('\n')}
      </ul>`,
        )
        .join('\n')}
      ${
        affilies
          ? en
            ? '<p class="discret">Partner links: if you book through them, Tripora may earn a commission, at no extra cost to you and without changing the order of these lists, which is alphabetical.</p>'
            : '<p class="discret">Liens partenaires : si vous réservez par eux, Tripora peut toucher une commission, sans rien changer à votre prix ni à l’ordre de ces listes, qui est alphabétique.</p>'
          : ''
      }
    </section>`;
}

// ---------------------------------------------------------------------------
// Où partir en … ?
// ---------------------------------------------------------------------------

export function pageDuMois(
  mois: number,
  publiees: readonly Destination[],
  { origine }: Contexte,
  langue: LangueDesPages = 'fr',
): string {
  const en = langue === 'en';
  const nom = nomDuMois(mois, langue);
  const versions: Versions = {
    fr: `${origine}${cheminDuMois(mois, 'fr')}`,
    en: `${origine}${cheminDuMois(mois, 'en')}`,
  };
  const adresse = versions[langue];
  const retenues = publiees.filter((destination) => destination.bestMonths.includes(mois));
  const avecClimat = retenues.map((destination) => ({ destination, climat: climatDe(destination.id)[mois - 1] }));

  const auChaud = avecClimat
    .filter(
      (ligne): ligne is { destination: Destination; climat: MonthlyClimate } =>
        ligne.climat !== undefined && ligne.climat.avgHighC >= 24 && ligne.climat.rainyDays <= 8,
    )
    .sort((a, b) => b.climat.avgHighC - a.climat.avgHighC)
    .slice(0, 12);

  const auSoleil = auChaud
    .slice(0, 3)
    .map((l) => nomDe(l.destination, langue))
    .join(', ');
  const titre = en
    ? `Where to go in ${nom}? ${retenues.length} destinations at the right time | Tripora`
    : `Où partir en ${nom} ? ${retenues.length} destinations au bon moment | Tripora`;
  const description = tronquer(
    en
      ? `${retenues.length} destinations where ${nom} is one of the best months, weather and crowds included${auChaud.length > 0 ? ` — including ${auSoleil} for the sun` : ''}. Temperatures, rainy days and daily budget for each.`
      : `${retenues.length} destinations où ${nom} est l’un des meilleurs mois, météo et affluence comprises${auChaud.length > 0 ? ` — dont ${auSoleil} au soleil` : ''}. Températures, jours de pluie et budget sur place pour chacune.`,
    300,
  );

  const ligne = ({ destination, climat }: { destination: Destination; climat: MonthlyClimate | undefined }) => {
    const faits = [
      climat ? degres(climat.avgHighC, langue) : null,
      climat ? (en ? `${climat.rainyDays} rainy days` : `${climat.rainyDays} j de pluie`) : null,
      en
        ? `from ${euros(budgetParJour(destination).budget, langue)} a day`
        : `dès ${euros(budgetParJour(destination).budget)} par jour`,
    ].filter(Boolean);
    return `<li><a href="${cheminDeLaDestination(destination.id, langue)}">${esc(nomDe(destination, langue))}</a> <span class="discret">${esc(paysDe(destination, langue))} · ${esc(faits.join(' · '))}</span></li>`;
  };

  const parContinent = ORDRE_DES_CONTINENTS.map((continent) => ({
    continent,
    lignes: avecClimat.filter(({ destination }) => continentDe(destination.countryCode) === continent),
  })).filter((groupe) => groupe.lignes.length > 0);

  const corps = `
    <nav class="ariane" aria-label="${en ? 'Breadcrumb' : 'Fil d’Ariane'}">
      <a href="${cheminDuSommaire(langue)}">Destinations</a> <span aria-hidden="true">›</span>
      <span aria-current="page">${en ? `Where to go in ${esc(nom)}` : `Où partir en ${esc(nom)}`}</span>
    </nav>

    <header class="entete">
      <h1>${en ? `Where to go in ${esc(nom)}?` : `Où partir en ${esc(nom)} ?`}</h1>
      <p class="chapo">${
        en
          ? `${retenues.length} destinations where ${esc(nom)} is among the best months — for the weather, but also for crowds and prices. For each: that month’s temperature and rainy days, and the daily budget on the ground.`
          : `${retenues.length} destinations où ${esc(nom)} compte parmi les meilleurs mois — la météo, mais aussi l’affluence et les prix. Pour chacune : la température et les jours de pluie de ce mois-là, et le budget sur place.`
      }</p>
    </header>

    ${navigationDesMois(mois, langue)}

    ${
      auChaud.length > 0
        ? `<section aria-labelledby="titre-soleil">
      <h2 id="titre-soleil">${en ? 'For the sun' : 'Pour le soleil'}</h2>
      <p>${en ? `The warmest in ${esc(nom)}, with eight rainy days at most.` : `Les plus chaudes en ${esc(nom)}, avec huit jours de pluie au plus.`}</p>
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
      <h2 id="mois-${continent}">${esc(dire(langue, NOMS_DES_CONTINENTS[continent]))}</h2>
      <ul class="liste">
        ${[...lignes]
          .sort((a, b) => nomDe(a.destination, langue).localeCompare(nomDe(b.destination, langue), langue))
          .map(ligne)
          .join('\n')}
      </ul>
    </section>`,
      )
      .join('\n')}

    <aside class="appel">
      ${
        en
          ? `<p><strong>Traveling as a group in ${esc(nom)}?</strong> Tell Tripora who’s going, from where and on what budget: it suggests the destinations that suit the whole group, flight prices included.</p>
      <a class="bouton" href="/voyages/nouveau?langue=en">Find our destination</a>`
          : `<p><strong>Vous partez à plusieurs en ${esc(nom)} ?</strong> Dites à Tripora qui part, d’où et avec quel budget : il propose les destinations qui conviennent au groupe entier, prix des vols compris.</p>
      <a class="bouton" href="/voyages/nouveau">Trouver notre destination</a>`
      }
    </aside>
  `;

  const nomDeLaPage = en ? `Where to go in ${nom}?` : `Où partir en ${nom} ?`;
  return gabarit({
    titre,
    description,
    langue,
    versions,
    corps,
    donnees: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'CollectionPage', name: nomDeLaPage, url: adresse, description },
        filDAriane([
          ['Destinations', `${origine}${cheminDuSommaire(langue)}`],
          [en ? `Where to go in ${nom}` : `Où partir en ${nom}`, adresse],
        ]),
      ],
    },
  });
}

function navigationDesMois(courant?: number, langue: LangueDesPages = 'fr'): string {
  return `<nav class="mois" aria-label="${langue === 'en' ? 'Where to go, month by month' : 'Où partir, mois par mois'}">
      ${MOIS.map((_, index) => {
        const nom = nomDuMois(index + 1, langue);
        return index + 1 === courant
          ? `<span aria-current="page">${nom}</span>`
          : `<a href="${cheminDuMois(index + 1, langue)}">${nom}</a>`;
      }).join('\n')}
    </nav>`;
}

function sectionPratique(
  destination: Destination,
  pratique: NonNullable<ReturnType<typeof infosPratiques>>,
  langue: LangueDesPages = 'fr',
): string {
  const en = langue === 'en';
  const urgences = pratique.urgences
    .map((numero) => {
      if (!numero.service) return numero.numero;
      return `${numero.numero} (${en ? (SERVICES_EN[numero.service] ?? numero.service) : numero.service})`;
    })
    .join(', ');
  const tension = en ? pratique.tension.replace(' ou ', ' or ') : pratique.tension;
  const conduite = en ? `On the ${pratique.conduite === 'droite' ? 'right' : 'left'}` : `À ${pratique.conduite}`;
  return `
    <section aria-labelledby="titre-pratique">
      <h2 id="titre-pratique">${en ? 'Good to know:' : 'Bon à savoir :'} ${esc(paysDe(destination, langue))}</h2>
      <dl class="pratique">
        <div><dt>${en ? 'Plugs' : 'Prises'}</dt><dd>Type ${esc(pratique.prises.join(', '))}, ${esc(tension)} V</dd></div>
        ${urgences ? `<div><dt>${en ? 'Emergencies' : 'Urgences'}</dt><dd>${esc(urgences)}</dd></div>` : ''}
        <div><dt>${en ? 'Driving' : 'Conduite'}</dt><dd>${conduite}</dd></div>
      </dl>
    </section>`;
}

function appelAOrganiser(destination: Destination, langue: LangueDesPages = 'fr'): string {
  if (langue === 'en') {
    return `
    <aside class="appel">
      <p><strong>Traveling as a group?</strong> Tripora gathers everyone’s wishes and budget, lets the group vote, builds the day-by-day plan and splits the expenses. Free.</p>
      <a class="bouton" href="/voyages/nouveau?destination=${encodeURIComponent(destination.id)}&amp;langue=en">Plan this trip</a>
    </aside>`;
  }
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

export function sommaire(
  publiees: readonly Destination[],
  { origine }: Contexte,
  langue: LangueDesPages = 'fr',
): string {
  const en = langue === 'en';
  const versions: Versions = {
    fr: `${origine}${cheminDuSommaire('fr')}`,
    en: `${origine}${cheminDuSommaire('en')}`,
  };
  const adresse = versions[langue];
  const nombreDActivites = publiees.reduce(
    (total, destination) => total + activitesDe(destination.id).length,
    0,
  );
  const nombre = nombreDActivites.toLocaleString(en ? 'en-US' : 'fr-FR');
  const titre = en
    ? `Where to go? ${publiees.length} destinations and things to do | Tripora`
    : `Où partir ? ${publiees.length} destinations et leurs activités | Tripora`;
  const description = en
    ? `${publiees.length} destinations and ${nombre} activity ideas, with their price, duration, best season and daily budget on the ground. Everything you need to choose where to go, alone or as a group.`
    : `${publiees.length} destinations et ${nombre} idées d’activités, avec leur prix, leur durée, la meilleure saison et le budget sur place. De quoi choisir où partir, seul ou à plusieurs.`;

  const parContinent = ORDRE_DES_CONTINENTS.map((continent) => ({
    continent,
    destinations: publiees.filter((destination) => continentDe(destination.countryCode) === continent),
  })).filter((groupe) => groupe.destinations.length > 0);

  const corps = `
    <header class="entete">
      <h1>${en ? 'Where to go?' : 'Où partir ?'}</h1>
      <p class="chapo">${
        en
          ? `${publiees.length} destinations, ${nombre} activity ideas. For each: what to do, how long it takes, what it costs, when to go and what budget to plan on the ground.`
          : `${publiees.length} destinations, ${nombre} idées d’activités. Pour chacune : quoi faire, combien de temps, à quel prix, quand y aller et quel budget prévoir sur place.`
      }</p>
    </header>
    <section aria-labelledby="titre-par-mois">
      <h2 id="titre-par-mois">${en ? 'By month' : 'Par mois'}</h2>
      ${navigationDesMois(undefined, langue)}
    </section>
    ${parContinent
      .map(
        ({ continent, destinations }) => `
    <section aria-labelledby="continent-${continent}">
      <h2 id="continent-${continent}">${esc(dire(langue, NOMS_DES_CONTINENTS[continent]))}</h2>
      ${grouperParPays(destinations, langue)
        .map(
          ([pays, liste]) => `
      <h3>${esc(pays)}</h3>
      <ul class="liens">
        ${liste.map((destination) => `<li><a href="${cheminDeLaDestination(destination.id, langue)}">${esc(nomDe(destination, langue))}</a> <span class="discret">${activitesDe(destination.id).length} ${en ? 'activities' : 'activités'}</span></li>`).join('\n')}
      </ul>`,
        )
        .join('\n')}
    </section>`,
      )
      .join('\n')}
    <aside class="appel">
      ${
        en
          ? `<p><strong>Not sure where to go yet?</strong> Tell Tripora who’s going, from where, when and on what budget: it suggests the destinations that suit the whole group, flight prices included.</p>
      <a class="bouton" href="/voyages/nouveau?langue=en">Find a destination</a>`
          : `<p><strong>Vous ne savez pas encore où aller ?</strong> Dites à Tripora qui part, d’où, quand et avec quel budget : il propose les destinations qui conviennent au groupe entier, prix des vols compris.</p>
      <a class="bouton" href="/voyages/nouveau">Trouver une destination</a>`
      }
    </aside>
  `;

  return gabarit({
    titre,
    description,
    langue,
    versions,
    corps,
    donnees: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          name: en ? 'Where to go?' : 'Où partir ?',
          url: adresse,
          description,
        },
        filDAriane([['Destinations', adresse]]),
      ],
    },
  });
}

function grouperParPays(destinations: readonly Destination[], langue: LangueDesPages = 'fr'): [string, Destination[]][] {
  const groupes = new Map<string, Destination[]>();
  for (const destination of destinations) {
    const pays = paysDe(destination, langue);
    groupes.set(pays, [...(groupes.get(pays) ?? []), destination]);
  }
  for (const liste of groupes.values()) {
    if (langue === 'en') liste.sort((a, b) => nomDe(a, langue).localeCompare(nomDe(b, langue), langue));
  }
  return [...groupes.entries()].sort(([a], [b]) => a.localeCompare(b, langue));
}

/** Le départ de référence des pages publiques : le plus fréquent chez les visiteurs. */
const PARIS = { name: 'Paris', lat: 48.8566, lng: 2.3522 };

/**
 * L'empreinte carbone du trajet depuis Paris, mode par mode.
 *
 * Le chiffre que presque aucun site de voyage ne donne, et qui change
 * souvent une décision : Barcelone en train plutôt qu'en avion, c'est le même
 * week-end pour une fraction des émissions. Mêmes facteurs que l'application
 * (ADEME, rail européen moyen hors de France).
 */
export function sectionEmpreinte(destination: Destination, langue: LangueDesPages = 'fr'): string {
  if (haversineKm(PARIS, destination) < 80) return '';
  const en = langue === 'en';
  const enFrance = destination.countryCode === 'FR';
  const empreintes = estimateTransportOptions(PARIS, destination, 1)
    .map((option) => empreinteDuTrajet(option.mode, PARIS, destination, { enFrance }))
    .filter((empreinte) => empreinte !== null && empreinte.mode !== 'car')
    .sort((a, b) => a!.kg - b!.kg) as NonNullable<ReturnType<typeof empreinteDuTrajet>>[];
  if (empreintes.length === 0) return '';
  const comparaison = en ? comparaisonEnAnglais(empreintes) : phraseDeComparaison(empreintes);
  return `
    <section aria-labelledby="titre-empreinte">
      <h2 id="titre-empreinte">${en ? 'Getting there from Paris: the carbon footprint' : 'Y aller depuis Paris : l’empreinte carbone'}</h2>
      <p>${
        en
          ? 'Per person, round trip, in kilograms of CO₂ equivalent — manufacturing, energy and, for flights, contrails included.'
          : 'Par personne, aller et retour, en kilogrammes d’équivalent CO₂ — fabrication, énergie et, pour l’avion, traînées de condensation comprises.'
      }</p>
      <dl class="budget">
        ${empreintes.map((empreinte) => `<div><dt>${esc(dire(langue, TRANSPORT_LABELS_FR[empreinte.mode]))}</dt><dd>${esc(en ? kgEnAnglais(empreinte.kg) : kgLisibles(empreinte.kg))}</dd></div>`).join('\n        ')}
      </dl>
      ${comparaison ? `<p><strong>${esc(comparaison)}</strong></p>` : ''}
      <p class="discret">${
        en
          ? 'Factors from ADEME (Impact CO₂); outside France, rail uses the European average published by the European Environment Agency.'
          : 'Facteurs de l’ADEME (Impact CO₂) ; hors de France, le train prend la moyenne du rail européen publiée par l’Agence européenne pour l’environnement.'
      }</p>
    </section>`;
}

/** `kgLisibles`, à l'anglaise : « 1.2 t », « 380 kg ». */
function kgEnAnglais(kg: number): string {
  const format = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return kg >= 1000 ? `${format(kg / 1000)} t` : `${format(kg)} kg`;
}

/** La phrase de `phraseDeComparaison`, en anglais, sur les mêmes règles. */
function comparaisonEnAnglais(empreintes: readonly NonNullable<ReturnType<typeof empreinteDuTrajet>>[]): string | null {
  const avion = empreintes.find((empreinte) => empreinte.mode === 'plane');
  if (!avion) return null;
  const sol = empreintes
    .filter((empreinte) => empreinte.mode === 'train' || empreinte.mode === 'bus')
    .sort((a, b) => a.kg - b.kg)[0];
  if (!sol) return null;
  const ecart = avion.kg - sol.kg;
  if (ecart < 20) return null;
  const rapport = sol.kg > 0 ? Math.round(avion.kg / sol.kg) : null;
  const fois = rapport !== null && rapport >= 3 ? ` (${rapport} times less)` : '';
  const arrondi = ecart >= 1000 ? Math.round(ecart / 100) * 100 : Math.round(ecart / 10) * 10;
  return `By ${sol.mode === 'train' ? 'train' : 'coach'} rather than by plane: ${kgEnAnglais(arrondi)} less CO₂e per person${fois}.`;
}

// ---------------------------------------------------------------------------
// Plan du site et robots
// ---------------------------------------------------------------------------

export function planDuSite(publiees: readonly Destination[], { origine, aujourdhui }: Contexte): string {
  const paires: Versions[] = [
    { fr: '/', en: '/?langue=en' },
    { fr: cheminDuSommaire('fr'), en: cheminDuSommaire('en') },
    ...MOIS.map((_, index) => ({ fr: cheminDuMois(index + 1, 'fr'), en: cheminDuMois(index + 1, 'en') })),
    ...publiees.map((destination) => ({
      fr: cheminDeLaDestination(destination.id, 'fr'),
      en: cheminDeLaDestination(destination.id, 'en'),
    })),
  ];
  // Chaque version nomme toutes les autres, elle comprise, comme Google le
  // demande ; le français reste la version par défaut.
  const entree = (chemin: string, paire: Versions) => `  <url><loc>${esc(origine + chemin)}</loc><lastmod>${aujourdhui}</lastmod>
    <xhtml:link rel="alternate" hreflang="fr" href="${esc(origine + paire.fr)}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${esc(origine + paire.en)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(origine + paire.fr)}"/>
  </url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${paires.flatMap((paire) => [entree(paire.fr, paire), entree(paire.en, paire)]).join('\n')}
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
Allow: /?langue=
Allow: /destinations
Allow: /ou-partir-en/
Allow: /en/
Allow: /confidentialite
Allow: /mentions-legales
Allow: /conditions
Allow: /llms.txt
Allow: /voyages/nouveau$
Disallow: /connexion
Disallow: /voyages
Disallow: /rejoindre
Disallow: /partager
Disallow: /alertes
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

/**
 * Tripora expliqué à un assistant (`/llms.txt`).
 *
 * Une intelligence artificielle qu'on envoie découvrir Tripora — pour le
 * résumer, le comparer, en tirer une publicité — lit d'abord ce fichier s'il
 * existe : ce que fait l'application, ce qu'elle ne fait pas, par où
 * l'essayer sans compte, et les pages qui se lisent sans connexion. Le format
 * est une proposition, pas une norme : il ne change rien au référencement,
 * il évite seulement qu'un assistant s'arrête à l'écran de connexion ou
 * invente une fonction. Les chiffres sont calculés à partir du carnet, pour
 * ne jamais vieillir.
 */
export function pourLesAssistants(publiees: readonly Destination[], { origine }: Contexte): string {
  const activites = DESTINATIONS.reduce((total, destination) => total + activitesDe(destination.id).length, 0);
  const destinations = DESTINATIONS.length;
  const arrondi = (n: number) => (n >= 1000 ? `${Math.floor(n / 100) * 100}` : `${Math.floor(n / 10) * 10}`);
  return `# Tripora

> Tripora aide un groupe d'amis à choisir une destination, à s'organiser et à faire ses comptes, dans une seule application gratuite, sans publicité, sur le web, Android et iOS. Plus de ${arrondi(destinations)} destinations et ${arrondi(activites)} activités décrites.

## Essayer sans compte

- [Créer un trip](${origine}/voyages/nouveau) : six questions — avec qui, d'où, où (ou « Tripora propose »), quand, quel budget, quelles envies. Le compte n'est demandé qu'à la toute fin, pour enregistrer le trip ; « Plus tard » le garde sur l'appareil, sans compte ni e-mail.
- [Rejoindre un voyage](${origine}/rejoindre) avec le code reçu d'un ami : aucun compte à créer.
- [L'accueil](${origine}/) présente l'application en une page.

## Ce que fait Tripora

- Propositions de destinations chiffrées pour tout le groupe : vol relevé depuis la ville de départ (avec sa date de relevé), budget sur place, climat du mois, et correspondance avec les envies de chacun.
- Chacun donne ses envies et son budget ; le groupe vote et tranche. Personne ne subit une destination qu'il déteste.
- Les ponts et les vacances scolaires (zones A, B, C) proposés au moment de choisir les dates.
- L'empreinte carbone de chaque trajet (avion, train, car, voiture partagée), par personne et aller-retour, d'après les facteurs de l'ADEME.
- « Découvrir » : les activités défilent comme des cartes ; le groupe voit ce qui plaît, sans savoir qui a dit non.
- Le programme jour par jour, composé à partir des activités qui ont plu, et exportable dans l'agenda.
- La carte du voyage : lieux du programme, adresses et épingles du groupe ; la carte de la destination se télécharge pour servir sans réseau.
- Alertes de prix : suivre le vol d'une proposition ; Tripora relève le prix chaque matin et prévient (notification du navigateur) quand il baisse d'au moins 10 %.
- Réservations : l'e-mail de confirmation (collé, importé, ou partagé depuis la messagerie) remplit la fiche — hôtel, visite ou trajet rangé à la bonne date pour tout le groupe, lu sur l'appareil.
- « Partager vers Tripora » : une vidéo TikTok, un Reel, une fiche Google Maps ou un article partagé à l'application devient des épingles sur la carte du groupe (les lieux cités y sont trouvés et situés).
- Sondages, tâches partagées (« qui fait quoi »), valise à cocher, coffre (codes, wifi, billets, lisibles hors ligne).
- Journal photo partagé : les photos de chacun, rangées par jour du voyage, position GPS effacée avant l'envoi.
- « Qui doit quoi » : dépenses en toutes devises, remboursements calculés au plus simple, liens de paiement ; un ticket de caisse photographié remplit la dépense (lu sur l'appareil).
- Trips ouverts : rejoindre un groupe qui part au même endroit, aux conditions de son organisateur (réservé aux majeurs).
- Passeport du voyageur et bilan du voyage à partager.
- Quatorze langues.

## Ce que Tripora ne fait pas

- Il ne vend aucun voyage, ne réserve rien et ne manipule pas l'argent du groupe. Les réservations se font chez les sites marchands.
- Certains liens sont des liens partenaires, marqués comme tels : ils peuvent rapporter une commission sans changer le prix ni l'ordre des listes.
- Les prix affichés sont des relevés datés ou des estimations, jamais des offres.
- Les noms des personnes ne sont jamais transmis à une intelligence artificielle.

## Pages lisibles sans compte

- [Le carnet des destinations](${origine}/destinations) : ${publiees.length} destinations, chacune avec ses activités, son climat mois par mois et son budget sur place.
${MOIS.map((nom, index) => `- [Où partir en ${nom} ?](${origine}${cheminDuMois(index + 1)})`).join('\n')}

## Informations

- [Conditions d'utilisation](${origine}/conditions)
- [Confidentialité](${origine}/confidentialite)
- [Mentions légales et contact](${origine}/mentions-legales)

## In English

Tripora is a free, ad-free group trip planner (web, Android, iOS), available in English and thirteen other languages. A group picks a destination together from priced proposals (dated flight fares, on-site budget, monthly climate), votes, builds a day-by-day plan from activities they liked, and splits expenses in any currency. Anyone can [start planning a trip without an account](${origine}/voyages/nouveau?langue=en); an account is only offered at the very end, to save it, and "Later" keeps it on the device instead.

- [The destination guide in English](${origine}${cheminDuSommaire('en')}): ${publiees.length} destinations, each with things to do, month-by-month climate and a daily budget.
${MOIS_EN.map((nom, index) => `- [Where to go in ${nom}?](${origine}${cheminDuMois(index + 1, 'en')})`).join('\n')}
`;
}

// ---------------------------------------------------------------------------
// Le gabarit commun
// ---------------------------------------------------------------------------

function gabarit({
  titre,
  description,
  langue,
  versions,
  corps,
  donnees,
  image,
}: {
  titre: string;
  description: string;
  langue: LangueDesPages;
  versions: Versions;
  corps: string;
  donnees: unknown;
  image?: string | undefined;
}): string {
  const en = langue === 'en';
  const adresse = versions[langue];
  const origine = new URL(adresse).origin;
  const visuel = image ?? `${origine}/icons/og-image.png`;
  // Les pages de l'application lisent la langue dans l'adresse (`?langue=en`).
  const versLApp = (chemin: string) => (en ? `${chemin}?langue=en` : chemin);
  return `<!doctype html>
<html lang="${langue}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(adresse)}">
<link rel="alternate" hreflang="fr" href="${esc(versions.fr)}">
<link rel="alternate" hreflang="en" href="${esc(versions.en)}">
<link rel="alternate" hreflang="x-default" href="${esc(versions.fr)}">
<meta name="theme-color" content="#1a5fb4">
<link rel="icon" type="image/svg+xml" href="/icons/favicon.svg">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="preload" href="/polices/fraunces-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/pages.css">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tripora">
<meta property="og:locale" content="${en ? 'en_US' : 'fr_FR'}">
<meta property="og:locale:alternate" content="${en ? 'fr_FR' : 'en_US'}">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(adresse)}">
<meta property="og:image" content="${esc(visuel)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd(donnees)}</script>
</head>
<body>
<header class="barre">
  <a class="marque" href="${versLApp('/')}"><img src="/icons/favicon.svg" alt="" width="28" height="28"> Tripora</a>
  <a class="bouton bouton-discret" href="${versLApp('/')}">${en ? 'Open the app' : 'Ouvrir l’application'}</a>
</header>
<main>
${corps}
</main>
<footer class="pied">
  ${
    en
      ? `<p><a href="${cheminDuSommaire('en')}">All destinations</a> · <a href="${versLApp('/')}">The app</a> · <a href="${esc(versions.fr.replace(origine, ''))}" hreflang="fr" lang="fr">En français</a></p>
  <p><a href="${versLApp('/mentions-legales')}">Legal notice</a> · <a href="${versLApp('/confidentialite')}">Privacy</a> · <a href="${versLApp('/conditions')}">Terms of use</a></p>
  <p class="discret">Activities and indicative prices from the Tripora guide, checked by hand. Climate: Open-Meteo averages. Detailed descriptions: Wikipedia, under the CC BY-SA license.</p>`
      : `<p><a href="/destinations">Toutes les destinations</a> · <a href="/">L’application</a> · <a href="${esc(versions.en.replace(origine, ''))}" hreflang="en" lang="en">In English</a></p>
  <p><a href="/mentions-legales">Mentions légales</a> · <a href="/confidentialite">Confidentialité</a> · <a href="/conditions">Conditions d’utilisation</a></p>
  <p class="discret">Activités et prix indicatifs du carnet Tripora, vérifiés à la main. Climat : normales Open-Meteo. Descriptions détaillées : Wikipédia, sous licence CC BY-SA.</p>`
  }
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
export function periodeLisible(mois: readonly number[], langue: LangueDesPages = 'fr'): string | null {
  const en = langue === 'en';
  const nom = (m: number) => nomDuMois(m, langue);
  const tries = [...new Set(mois)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (tries.length === 0) return null;
  if (tries.length === 12) return en ? 'all year round' : 'toute l’année';
  if (tries.length === 1) return `${en ? 'in' : 'en'} ${nom(tries[0]!)}`;
  // Une suite continue, éventuellement à cheval sur la nouvelle année : on
  // cherche le mois après lequel commence le seul « trou ».
  const trous = tries.filter((m, i) => {
    const suivant = tries[(i + 1) % tries.length]!;
    return (suivant - m + 12) % 12 !== 1;
  });
  if (trous.length === 1) {
    const fin = trous[0]!;
    const debut = tries[(tries.indexOf(fin) + 1) % tries.length]!;
    return en ? `from ${nom(debut)} to ${nom(fin)}` : `de ${nom(debut)} à ${nom(fin)}`;
  }
  const noms = tries.map(nom);
  return `${en ? 'in' : 'en'} ${noms.slice(0, -1).join(', ')} ${en ? 'and' : 'et'} ${noms.at(-1)}`;
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

const LANGUES_DES_ARTICLES = {
  fr: new Intl.DisplayNames(['fr'], { type: 'language' }),
  en: new Intl.DisplayNames(['en'], { type: 'language' }),
};

/** Le lien vers l'article, qui dit sa langue quand ce n'est pas celle de la page. */
function lienWikipedia(etiquette: string, langue: LangueDesPages): string {
  const langueDeLArticle = etiquette.split(':')[0]!;
  const nomDeLaLangue = langueDeLArticle === langue ? null : LANGUES_DES_ARTICLES[langue].of(langueDeLArticle);
  const libelle =
    langue === 'en'
      ? `On Wikipedia${nomDeLaLangue ? ` (in ${nomDeLaLangue})` : ''}`
      : `Sur Wikipédia${nomDeLaLangue ? ` (en ${nomDeLaLangue})` : ''}`;
  return `<a class="source" href="${esc(adresseWikipedia(etiquette))}" hreflang="${esc(langueDeLArticle)}" rel="noopener">${libelle}</a>`;
}

export function adresseWikipedia(etiquette: string): string {
  const [langue, ...reste] = etiquette.split(':');
  const titre = reste.join(':').replaceAll(' ', '_');
  return `https://${langue}.wikipedia.org/wiki/${encodeURIComponent(titre).replaceAll('%2F', '/')}`;
}

function euros(centimes: number, langue: LangueDesPages = 'fr'): string {
  const montant = Math.round(centimes / 100);
  if (langue === 'en') return `€${montant.toLocaleString('en-US')}`;
  // Espace insécable : « 25 » et « € » ne se séparent pas en fin de ligne.
  return `${montant.toLocaleString('fr-FR')}\u00a0€`;
}

/** Une température : en Celsius pour le français, Celsius et Fahrenheit pour l'anglais. */
function degres(celsius: number, langue: LangueDesPages): string {
  const c = Math.round(celsius);
  return langue === 'en' ? `${c} °C / ${Math.round((celsius * 9) / 5 + 32)} °F` : `${c} °C`;
}

function dureeLisible(heures: number, langue: LangueDesPages = 'fr'): string {
  const en = langue === 'en';
  if (heures >= 24) {
    const jours = Math.round(heures / 24);
    return en ? `${jours} day${heures >= 48 ? 's' : ''}` : `${jours} jour${heures >= 48 ? 's' : ''}`;
  }
  if (heures < 1) return `${Math.round(heures * 60)} min`;
  const entieres = Math.floor(heures);
  const minutes = Math.round((heures - entieres) * 60);
  if (en) return minutes ? `${entieres} hr ${minutes} min` : `${entieres} hr`;
  return minutes ? `${entieres} h ${minutes}` : `${entieres} h`;
}

function arrondirKm(km: number, langue: LangueDesPages = 'fr'): string {
  return (km < 100 ? Math.round(km) : Math.round(km / 10) * 10).toLocaleString(langue === 'en' ? 'en-US' : 'fr-FR');
}

/** « Le mont Ulriken » → « le mont Ulriken », au milieu d'une phrase ; « The Louvre » → « the Louvre ». */
function articleEnMinuscule(nom: string, langue: LangueDesPages = 'fr'): string {
  if (langue === 'en') return nom.replace(/^(?:The|An|A)(?=\s)/u, (article) => article.toLowerCase());
  return nom.replace(/^(?:(?:Les|Le|La|Une|Un|Des)(?=\s)|L’)/u, (article) => article.toLowerCase());
}

function tronquer(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  return `${texte.slice(0, max - 1).replace(/\s+\S*$/u, '')}…`;
}
