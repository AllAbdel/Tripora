import { describe, expect, it } from 'vitest';
import { findDestination } from '@tripora/core';
import { activitesDe } from '@tripora/core/activites';
import {
  adresseWikipedia,
  budgetParJour,
  destinationsPubliees,
  esc,
  genererLesPages,
  jsonLd,
  pageDeDestination,
  periodeLisible,
  robots,
} from './pagesPubliques';

const CONTEXTE = { origine: 'https://tripora.exemple', aujourdhui: '2026-09-24' };

describe('les pages publiques du carnet', () => {
  const fichiers = genererLesPages(CONTEXTE);
  const parChemin = new Map(fichiers.map((fichier) => [fichier.chemin, fichier.contenu]));

  it('écrit une page par destination du carnet, le sommaire, le plan du site et les robots', () => {
    const publiees = destinationsPubliees();
    expect(publiees.length).toBeGreaterThan(250);
    expect(fichiers).toHaveLength(publiees.length + 3);
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
    expect(plan.match(/<loc>/gu)).toHaveLength(destinationsPubliees().length + 2);
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
