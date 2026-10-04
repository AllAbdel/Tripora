import { describe, expect, it } from 'vitest';
import { DESTINATIONS, findDestination } from '@tripora/core';
import { activitesDe } from '@tripora/core/activites';
import { NOMS_ET_RESUMES } from '../i18n/carnet-en';
import { NOMS_DES_DESTINATIONS, PHRASES } from '../i18n/phrases-en';
import {
  adresseWikipedia,
  budgetParJour,
  climatDe,
  destinationsPubliees,
  esc,
  genererLesPages,
  jsonLd,
  pageDeDestination,
  pageDuMois,
  periodeLisible,
  robots,
} from './pagesPubliques';

const CONTEXTE = {
  origine: 'https://tripora.exemple',
  aujourdhui: '2026-09-24',
  partenaire: { marker: '774322', projet: '570857' },
};

describe('les pages publiques du carnet', () => {
  const fichiers = genererLesPages(CONTEXTE);
  const parChemin = new Map(fichiers.map((fichier) => [fichier.chemin, fichier.contenu]));

  it('écrit une page par destination du carnet, le sommaire, le plan du site et les robots', () => {
    const publiees = destinationsPubliees();
    expect(publiees.length).toBeGreaterThan(250);
    // Dans chaque langue : les destinations, douze pages de mois et le
    // sommaire ; puis le plan du site, les robots et le fichier pour les
    // assistants.
    expect(fichiers).toHaveLength(2 * (publiees.length + 12 + 1) + 3);
    for (const destination of publiees) {
      expect(parChemin.has(`destinations/${destination.id}.html`), destination.id).toBe(true);
      expect(parChemin.has(`en/destinations/${destination.id}.html`), destination.id).toBe(true);
    }
    expect(parChemin.has('destinations.html')).toBe(true);
    expect(parChemin.has('en/destinations.html')).toBe(true);
  });

  it('dit sur chaque page ce qu’un moteur doit en retenir', () => {
    const bergen = parChemin.get('destinations/bergen.html')!;
    expect(bergen).toContain('<title>Bergen et les fjords : que faire ?');
    expect(bergen).toContain('<link rel="canonical" href="https://tripora.exemple/destinations/bergen">');
    expect(bergen).toMatch(/<meta name="description" content="[^"]{80,}">/u);
    expect(bergen).toContain('<h1>Bergen et les fjords : que faire ?</h1>');
    // Toutes les activités du carnet, chacune avec son titre.
    for (const activite of activitesDe('bergen')) {
      expect(bergen).toContain(`<h3>${esc(activite.nom)}</h3>`);
    }
  });

  it('décrit la destination en données structurées lisibles', () => {
    const page = parChemin.get('destinations/bergen.html')!;
    const bloc = /<script type="application\/ld\+json">(.*?)<\/script>/su.exec(page)![1]!;
    const donnees = JSON.parse(bloc) as { '@graph': { '@type': string; includesAttraction?: unknown[] }[] };
    const lieu = donnees['@graph'].find((noeud) => noeud['@type'] === 'TouristDestination')!;
    expect(lieu.includesAttraction).toHaveLength(activitesDe('bergen').length);
    expect(donnees['@graph'].some((noeud) => noeud['@type'] === 'BreadcrumbList')).toBe(true);
  });

  it('mène vers la création du voyage, destination choisie', () => {
    expect(parChemin.get('destinations/bergen.html')).toContain(
      'href="/voyages/nouveau?destination=bergen"',
    );
  });

  it('relie chaque page à ses voisines, qui existent toutes', () => {
    const page = parChemin.get('destinations/lisbonne.html')!;
    const liens = [...page.matchAll(/href="\/destinations\/([a-z0-9-]+)"/gu)].map((m) => m[1]!);
    expect(liens.length).toBeGreaterThanOrEqual(6);
    for (const id of liens) {
      expect(parChemin.has(`destinations/${id}.html`), id).toBe(true);
    }
  });

  it('liste toutes les pages dans le plan du site, en adresses complètes', () => {
    const plan = parChemin.get('sitemap.xml')!;
    expect(plan).toContain('<loc>https://tripora.exemple/destinations/bergen</loc>');
    // L'accueil, le sommaire, les mois et les destinations, en deux langues.
    expect(plan.match(/<loc>/gu)).toHaveLength(2 * (destinationsPubliees().length + 14));
    expect(plan).toContain('<loc>https://tripora.exemple/ou-partir-en/aout</loc>');
    expect(plan).toContain('<loc>https://tripora.exemple/en/where-to-go-in/august</loc>');
    expect(plan).toContain('<loc>https://tripora.exemple/en/destinations/bergen</loc>');
  });

  it('annonce l’accueil en anglais à sa propre adresse, versions croisées', () => {
    const plan = parChemin.get('sitemap.xml')!;
    expect(plan).toContain('<loc>https://tripora.exemple/?langue=en</loc>');
    // Chaque version de l'accueil nomme les deux, plus celle par défaut.
    expect(plan.match(/hreflang="en" href="https:\/\/tripora\.exemple\/\?langue=en"/gu)).toHaveLength(2);
    // Chaque adresse du plan a sa version par défaut, le français.
    expect(plan.match(/hreflang="x-default"/gu)).toHaveLength(plan.match(/<loc>/gu)!.length);
    expect(robots(CONTEXTE)).toContain('Allow: /?langue=');
  });

  it('ferme aux robots ce qui est derrière une connexion', () => {
    const texte = robots(CONTEXTE);
    expect(texte).toContain('Disallow: /voyages');
    // Un code d'invitation n'a rien à faire dans un index.
    expect(texte).toContain('Disallow: /rejoindre');
    expect(texte).toContain('Allow: /destinations');
    expect(texte).toContain('Sitemap: https://tripora.exemple/sitemap.xml');
  });

  it('donne l’empreinte carbone du trajet depuis Paris', () => {
    const barcelone = parChemin.get('destinations/barcelone.html');
    expect(barcelone, 'la page de Barcelone').toBeDefined();
    expect(barcelone).toContain('Y aller depuis Paris : l’empreinte carbone');
    expect(barcelone).toMatch(/<dt>Train<\/dt><dd>\d+ kg<\/dd>/u);
    expect(barcelone).toMatch(/En train plutôt qu’en avion : \d+ kg de CO₂e de moins par personne/u);
  });

  it('explique Tripora à un assistant, et lui montre la porte sans compte', () => {
    const texte = parChemin.get('llms.txt')!;
    expect(texte.startsWith('# Tripora\n')).toBe(true);
    expect(texte).toContain('[Créer un trip](https://tripora.exemple/voyages/nouveau)');
    expect(texte).toContain('« Plus tard »');
    expect(texte).toContain('https://tripora.exemple/ou-partir-en/juillet');
    // Ce que Tripora ne fait pas, dit aussi clairement que ce qu'il fait.
    expect(texte).toContain('ne réserve rien');
    expect(texte).not.toMatch(/undefined|NaN/u);
    const lu = robots(CONTEXTE);
    expect(lu).toContain('Allow: /llms.txt');
    expect(lu).toContain('Allow: /voyages/nouveau$');
  });

  it('ne laisse passer aucune balise venue du contenu', () => {
    const piege = {
      ...findDestination('bergen')!,
      name: 'Bergen <script>alert(1)</script>',
    };
    const page = pageDeDestination(piege, destinationsPubliees(), CONTEXTE);
    expect(page).not.toContain('<script>alert(1)</script>');
    expect(jsonLd({ texte: '</script><script>' })).not.toContain('</script>');
  });
});

describe('les liens partenaires des pages', () => {
  const page = pageDeDestination(findDestination('lisbonne')!, destinationsPubliees(), CONTEXTE);

  it('passent par Travelpayouts et se déclarent aux moteurs', () => {
    const liens = [...page.matchAll(/<a href="([^"]+)" rel="([^"]+)"/gu)].map((m) => ({
      adresse: m[1]!,
      rel: m[2]!,
    }));
    const affilies = liens.filter(
      ({ adresse }) => adresse.includes('tp.media') || adresse.includes('tpk.lu'),
    );
    expect(affilies.length).toBeGreaterThanOrEqual(10);
    for (const { rel } of affilies) expect(rel).toContain('sponsored');
    expect(page).toContain('Liens partenaires');
  });

  it('restent des liens ordinaires sans identité de partenaire', () => {
    const neutre = pageDeDestination(findDestination('lisbonne')!, destinationsPubliees(), {
      origine: CONTEXTE.origine,
      aujourdhui: CONTEXTE.aujourdhui,
    });
    expect(neutre).not.toContain('tp.media');
    expect(neutre).not.toContain('Liens partenaires');
  });
});

describe('les pages par mois', () => {
  it('retiennent les destinations dont c’est un bon mois, avec leur climat', () => {
    const aout = pageDuMois(8, destinationsPubliees(), CONTEXTE);
    expect(aout).toContain('<h1>Où partir en août ?</h1>');
    const retenues = destinationsPubliees().filter((d) => d.bestMonths.includes(8));
    expect(retenues.length).toBeGreaterThan(20);
    for (const destination of retenues) {
      expect(aout, destination.id).toContain(`href="/destinations/${destination.id}"`);
    }
    expect(aout).toMatch(/\d+ °C · \d+ j de pluie/u);
  });

  it('ont des normales pour chaque destination publiée', () => {
    for (const destination of destinationsPubliees()) {
      expect(climatDe(destination.id), destination.id).toHaveLength(12);
    }
  });

  it('se relient entre elles et depuis chaque destination', () => {
    const bergen = pageDeDestination(findDestination('bergen')!, destinationsPubliees(), CONTEXTE);
    expect(bergen).toContain('href="/ou-partir-en/juin"');
    expect(pageDuMois(1, destinationsPubliees(), CONTEXTE)).toContain('href="/ou-partir-en/fevrier"');
  });
});

describe('les petits calculs des pages', () => {
  it('dit la meilleure période en mots', () => {
    expect(periodeLisible([5, 6, 7, 8, 9])).toBe('de mai à septembre');
    expect(periodeLisible([11, 12, 1, 2, 3])).toBe('de novembre à mars');
    expect(periodeLisible([4, 5, 9, 10])).toBe('en avril, mai, septembre et octobre');
    expect(periodeLisible([7])).toBe('en juillet');
    expect(periodeLisible([])).toBeNull();
    expect(periodeLisible([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('toute l’année');
  });

  it('calcule le budget comme l’application, arrondi à 5 €', () => {
    const europe = budgetParJour({ costIndex: 1 });
    expect(europe).toEqual({ budget: 6000, mid: 11500, comfort: 21000 });
    expect(budgetParJour({ costIndex: 0.5 }).budget).toBe(3000);
  });

  it('écrit l’adresse Wikipédia de l’étiquette du carnet', () => {
    expect(adresseWikipedia('en:Fish Market, Bergen')).toBe(
      'https://en.wikipedia.org/wiki/Fish_Market%2C_Bergen',
    );
    expect(adresseWikipedia('fr:Val d\'Orcia')).toBe("https://fr.wikipedia.org/wiki/Val_d'Orcia");
  });
});

describe('les pages en anglais', () => {
  const fichiers = genererLesPages(CONTEXTE);
  const parChemin = new Map(fichiers.map((fichier) => [fichier.chemin, fichier.contenu]));
  const bergen = parChemin.get('en/destinations/bergen.html')!;

  it('ont leur adresse, leur langue et leurs versions croisées', () => {
    expect(bergen).toContain('<html lang="en">');
    expect(bergen).toContain('<title>Things to do in Bergen and the fjords: ');
    expect(bergen).toContain('<link rel="canonical" href="https://tripora.exemple/en/destinations/bergen">');
    for (const page of [bergen, parChemin.get('destinations/bergen.html')!]) {
      expect(page).toContain('<link rel="alternate" hreflang="fr" href="https://tripora.exemple/destinations/bergen">');
      expect(page).toContain('<link rel="alternate" hreflang="en" href="https://tripora.exemple/en/destinations/bergen">');
      expect(page).toContain('<link rel="alternate" hreflang="x-default" href="https://tripora.exemple/destinations/bergen">');
    }
    expect(parChemin.get('destinations/bergen.html')).toContain('href="/en/destinations/bergen" hreflang="en" lang="en">In English</a>');
    expect(bergen).toContain('href="/destinations/bergen" hreflang="fr" lang="fr">En français</a>');
  });

  it('montrent le carnet traduit, et ouvrent l’application en anglais', () => {
    for (const activite of activitesDe('bergen')) {
      expect(bergen).toContain(`<h3>${esc(NOMS_ET_RESUMES[activite.id]![0])}</h3>`);
    }
    expect(bergen).toContain('href="/voyages/nouveau?destination=bergen&amp;langue=en"');
    expect(bergen).toContain('°F');
  });

  it('se relient entre elles, sans renvoyer vers le français', () => {
    const liens = [...bergen.matchAll(/href="(\/[^"]*)"/gu)].map((m) => m[1]!);
    for (const lien of liens.filter((l) => /^\/(?:destinations|ou-partir-en)\//u.test(l))) {
      // Seul le lien « En français » mène à la version française.
      expect(lien).toBe('/destinations/bergen');
    }
    for (const id of liens.flatMap((l) => /^\/en\/destinations\/([a-z0-9-]+)$/u.exec(l)?.[1] ?? [])) {
      expect(parChemin.has(`en/destinations/${id}.html`), id).toBe(true);
    }
    const aout = parChemin.get('en/where-to-go-in/august.html')!;
    expect(aout).toContain('<h1>Where to go in August?</h1>');
    expect(aout).toContain('href="/en/where-to-go-in/september"');
  });

  it('ne gardent aucun texte français hors des noms propres', () => {
    // Les noms propres viennent du carnet (traduit ou non) : un nom seul dans
    // sa balise est connu ; tout autre texte doit être anglais.
    const connus = new Set<string>([
      ...Object.values(NOMS_ET_RESUMES).flat(),
      ...Object.values(NOMS_DES_DESTINATIONS),
      ...DESTINATIONS.map((destination) => destination.name),
      ...Object.values(PHRASES),
    ]);
    const FRANCAIS =
      /(?:^|[\s'’(«])(?:le|la|les|des|une|est|sont|pour|vous|votre|avec|dans|sur|pas|qui|que|du|au|aux|et|ou|à|ce|cette|leur|sans|très|plus|de|en|jours?|idées|mois|pluie|plutôt|gratuit)(?=$|[\s,.;:!?»)])/iu;
    // Les noms qui se lisent comme du français (« Rio de Janeiro ») sont
    // effacés des phrases qui les citent avant la recherche.
    const nomsTrompeurs = [...connus]
      .filter((nom) => nom.length < 60 && FRANCAIS.test(nom))
      .sort((a, b) => b.length - a.length);
    const restes = new Set<string>();
    for (const [chemin, contenu] of parChemin) {
      if (!chemin.startsWith('en/')) continue;
      const corps = contenu
        .replace(/<script[\s\S]*?<\/script>/gu, '')
        .replace(/<a [^>]*lang="fr"[^>]*>[^<]*<\/a>/gu, '');
      for (const [, brut] of corps.matchAll(/>([^<>]+)</gu)) {
        const texte = brut!.replaceAll('&amp;', '&').replaceAll('&quot;', '"').trim();
        if (!texte || connus.has(texte) || !FRANCAIS.test(texte)) continue;
        const sansLesNoms = nomsTrompeurs.reduce((reste, nom) => reste.replaceAll(nom, ''), texte);
        if (FRANCAIS.test(sansLesNoms)) restes.add(`${chemin} : ${texte}`);
      }
    }
    expect([...restes].slice(0, 20)).toEqual([]);
  });

  it('chiffrent à l’anglaise', () => {
    expect(periodeLisible([5, 6, 7, 8, 9], 'en')).toBe('from May to September');
    expect(periodeLisible([4, 5, 9, 10], 'en')).toBe('in April, May, September and October');
    expect(periodeLisible([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'en')).toBe('all year round');
    const rio = parChemin.get('en/destinations/rio-de-janeiro.html')!;
    expect(rio).toContain('127 or 220 V');
    expect(rio).toContain('193 (fire)');
    expect(rio).toMatch(/<dt>Budget<\/dt><dd>€\d+<\/dd>/u);
  });

  it('disent la langue d’un article de Wikipédia qui n’est pas la leur', () => {
    expect(bergen).toMatch(/hreflang="en" rel="noopener">On Wikipedia<\/a>/u);
    expect(parChemin.get('destinations/bergen.html')).toMatch(/hreflang="en" rel="noopener">Sur Wikipédia \(en anglais\)<\/a>/u);
  });

  it('ne répètent pas le pays quand il porte le nom de la destination', () => {
    expect(parChemin.get('en/destinations/malte.html')).toContain('content="Valletta and Malta (Malta):');
    expect(parChemin.get('en/destinations/maldives.html')).toContain('content="Maldives: ');
    expect(parChemin.get('destinations/maldives.html')).toContain('content="Maldives : ');
  });
});
