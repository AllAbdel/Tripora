import { describe, expect, it } from 'vitest';
import { assessFreshness, describeSource, freshnessLabel, weakestSource } from './freshness.js';

const NOW = new Date('2026-09-06T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe('fraîcheur des prix', () => {
  it('garde un prix relevé récent', () => {
    const value = { cents: 9500, source: 'observed' as const, fetchedAt: hoursAgo(5) };
    expect(assessFreshness(value, NOW).source).toBe('observed');
    expect(freshnessLabel(value, NOW)).toBe('Prix vu aujourd’hui');
  });

  it('dit depuis quand en clair, pas en date à décoder', () => {
    expect(freshnessLabel({ cents: 100, source: 'observed', fetchedAt: hoursAgo(30) }, NOW))
      .toBe('Prix vu hier');
    expect(freshnessLabel({ cents: 100, source: 'observed', fetchedAt: hoursAgo(24 * 4) }, NOW))
      .toBe('Prix vu il y a 4 jours');
    // Au-delà d'une semaine, le décompte cesse d'être parlant.
    expect(freshnessLabel({ cents: 100, source: 'observed', fetchedAt: hoursAgo(24 * 10) }, NOW))
      .toMatch(/^Prix vu le /);
  });

  it('garde le statut « relevé » sur toute la fenêtre utile du cache', () => {
    // Le cache Aviasales remonte des relevés de plusieurs jours : les classer
    // « indicatifs » les confondrait avec nos propres estimations.
    const value = { cents: 9500, source: 'observed' as const, fetchedAt: hoursAgo(24 * 5) };
    expect(assessFreshness(value, NOW).source).toBe('observed');
  });

  it('déclasse un prix relevé trop vieux en simple estimation', () => {
    const value = { cents: 9500, source: 'observed' as const, fetchedAt: hoursAgo(24 * 20) };
    expect(assessFreshness(value, NOW).source).toBe('estimated');
    expect(freshnessLabel(value, NOW)).toBe('Prix indicatif');
  });

  it('déclasse un prix relevé sans date', () => {
    expect(assessFreshness({ cents: 100, source: 'observed' }, NOW).source).toBe('estimated');
  });

  it('affiche « non disponible » quand il n’y a pas de montant', () => {
    expect(freshnessLabel({ cents: null, source: 'observed' }, NOW)).toBe('Prix non disponible');
  });

  it('cite la source quand elle est connue', () => {
    const label = freshnessLabel(
      { cents: 9500, source: 'observed', fetchedAt: hoursAgo(2), provider: 'Aviasales' },
      NOW,
    );
    expect(label).toBe('Prix vu aujourd’hui (Aviasales)');
  });

  it('un total vaut son poste le moins fiable', () => {
    expect(weakestSource(['observed', 'estimated'])).toBe('estimated');
    expect(weakestSource(['observed', 'observed'])).toBe('observed');
    expect(weakestSource(['estimated', 'unavailable'])).toBe('unavailable');
  });
});

/**
 * La phrase qui dit d'où vient un prix, éprouvée sur de vraies réponses.
 *
 * Ces quatre relevés sont ceux que Travelpayouts a réellement renvoyés pour
 * un Paris → quatre destinations en novembre, le 19 septembre 2026. Ils sont
 * repris tels quels, virgules et majuscules comprises, parce que la forme
 * exacte d'une réponse de fournisseur est précisément ce qu'on ne devine pas.
 *
 * Deux détails de cette réponse n'auraient pas été inventés :
 *
 *  - `found_at` arrive **sans fuseau horaire** (« 2026-09-14T12:17:09 »).
 *    Lu comme une heure locale, un relevé de ce matin peut donc paraître
 *    légèrement dans le futur sur un appareil à l'ouest de Greenwich. Le
 *    décompte doit rester lisible dans ce cas, et ne jamais annoncer un prix
 *    « vu demain » ;
 *  - le revendeur est parfois une compagnie (« EasyJet »), parfois une agence
 *    (« Trip.com », « Mytrip.com »), et la phrase doit le nommer — « prix vu
 *    sur Aviasales » laisse croire qu'on achète chez l'agrégateur.
 *
 * Ces charges utiles ont mis deux semaines à atteindre un navigateur : une
 * règle de partage d'origine incomplète bloquait tous les appels. Le code qui
 * les met en mots n'avait donc jamais rencontré la moindre donnée réelle.
 */
describe('provenance, sur de vraies réponses Travelpayouts', () => {
  /** Le 19 septembre 2026, jour du relevé. */
  const RELEVE = new Date('2026-09-19T12:00:00Z');

  const BUDAPEST = {
    cents: 10100,
    source: 'observed' as const,
    provider: 'Aviasales',
    fetchedAt: '2026-09-14T10:33:15',
    departAt: '2026-11-09',
    returnAt: '2026-11-13',
    stops: 0,
    reseller: 'Trip.com',
  };

  const BALI = {
    cents: 66800,
    source: 'observed' as const,
    provider: 'Aviasales',
    fetchedAt: '2026-09-17T10:00:57',
    departAt: '2026-11-06',
    returnAt: '2026-11-18',
    stops: 1,
    reseller: 'Mytrip.com',
  };

  it('nomme le vendeur, la date de relevé et les dates du vol', () => {
    const { court, long, releve } = describeSource(BUDAPEST, RELEVE);
    expect(releve).toBe(true);
    expect(court).toBe('Relevé il y a 5 jours sur Aviasales');
    expect(long).toBe(
      'Prix relevé il y a 5 jours sur Aviasales, vendu par Trip.com, ' +
        'pour un aller le 9 nov. et un retour le 13 nov.',
    );
  });

  it('ne double pas le point après un mois abrégé', () => {
    // « le 13 nov.. » — huit mois sur douze s'abrègent avec un point, donc le
    // défaut se voyait deux fois sur trois, sous chaque prix relevé.
    for (const mois of ['01', '02', '04', '07', '09', '10', '11', '12']) {
      const { long } = describeSource(
        { ...BUDAPEST, departAt: `2026-${mois}-09`, returnAt: `2026-${mois}-13` },
        RELEVE,
      );
      expect(long, mois).not.toMatch(/\.\.$/);
      expect(long, mois).toMatch(/\.$/);
    }
  });

  it('reste un relevé cinq jours plus tard, pas une estimation', () => {
    // Le seuil est à quatorze jours, et c'est délibéré : le cache Aviasales
    // remonte des relevés de plusieurs jours. Les ramener à « indicatif » les
    // mettrait dans la même case que nos propres calculs, ce qui est faux.
    expect(assessFreshness(BUDAPEST, RELEVE).source).toBe('observed');
    expect(assessFreshness(BALI, RELEVE).source).toBe('observed');
  });

  it('redevient une estimation au-delà de deux semaines', () => {
    const troisSemaines = new Date('2026-10-06T12:00:00Z');
    const { court, releve } = describeSource(BUDAPEST, troisSemaines);
    expect(releve).toBe(false);
    expect(court).toBe('Estimation Tripora');
  });

  it('ne promet jamais un prix vu dans le futur', () => {
    // Sans fuseau dans `found_at`, un appareil à l'ouest de Greenwich lit
    // l'heure comme la sienne et place le relevé en avance sur l'horloge.
    // Le décompte devient négatif ; la phrase doit rester vraie.
    const juste = new Date('2026-09-17T09:00:00Z');
    const { court } = describeSource(BALI, juste);
    expect(court).toBe('Relevé aujourd’hui sur Aviasales');
    expect(court).not.toMatch(/demain|futur|-/);
  });
});
