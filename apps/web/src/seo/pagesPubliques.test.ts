import { describe, expect, it } from 'vitest';
import { findDestination } from '@tripora/core';
import { activitesDe } from '@tripora/core/activites';
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
    // Les destinations, douze pages de mois, le sommaire, le plan du site, les robots.
    expect(fichiers).toHaveLength(publiees.length + 12 + 3);
    for (const destination of publiees) {
      expect(parChemin.has(`destinations/${destination.id}.html`), destination.id).toBe(true);
    }
    expect(parChemin.has('destinations.html')).toBe(true);
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
    expect(plan.match(/<loc>/gu)).toHaveLength(destinationsPubliees().length + 12 + 2);
    expect(plan).toContain('<loc>https://tripora.exemple/ou-partir-en/aout</loc>');
  });

  it('ferme aux robots ce qui est derrière une connexion', () => {
    const texte = robots(CONTEXTE);
    expect(texte).toContain('Disallow: /voyages');
    // Un code d'invitation n'a rien à faire dans un index.
    expect(texte).toContain('Disallow: /rejoindre');
    expect(texte).toContain('Allow: /destinations');
    expect(texte).toContain('Sitemap: https://tripora.exemple/sitemap.xml');
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
