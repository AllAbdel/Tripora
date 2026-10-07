import { describe, expect, it } from 'vitest';
import {
  calendrierConnuJusquau,
  cePendant,
  dimancheDePaques,
  feriesConnus,
  feriesConnusJusquau,
  joursFeries,
  joursFeriesDu,
  paysDeDepart,
  pontsEntre,
  VACANCES_SCOLAIRES,
  vacancesAVenir,
  weekendDu,
  zoneProbable,
  nomDeRegion,
  regionProbable,
  regionsScolaires,
  vacancesAVenirDu,
  vacancesConnues,
  vacancesDuMondeReleveesLe,
} from './conges.js';

describe('les jours fériés', () => {
  it('place Pâques et les fêtes qui en dépendent', () => {
    expect(dimancheDePaques(2026)).toBe('2026-04-05');
    expect(dimancheDePaques(2027)).toBe('2027-03-28');
    expect(dimancheDePaques(2028)).toBe('2028-04-16');
    const feries = joursFeries(2026);
    expect(feries).toHaveLength(11);
    expect(feries.find((jour) => jour.nom === 'Ascension')?.date).toBe('2026-05-14');
    expect(feries.find((jour) => jour.nom === 'Lundi de Pentecôte')?.date).toBe('2026-05-25');
  });
});

describe('les ponts', () => {
  const ponts = pontsEntre('2026-01-01', '2026-12-31');
  const du = (date: string) => ponts.find((pont) => pont.debut === date || pont.fin === date);

  it('donne trois jours pour un vendredi férié, sans rien poser', () => {
    // Le 1er mai 2026 est un vendredi.
    expect(du('2026-05-01')).toMatchObject({ debut: '2026-05-01', fin: '2026-05-03', jours: 3, aPoser: 0 });
  });

  it('donne quatre jours pour un mardi ou un jeudi, un jour posé', () => {
    // 14 juillet 2026 : un mardi.
    expect(du('2026-07-14')).toMatchObject({ debut: '2026-07-11', jours: 4, aPoser: 1 });
    // Ascension : toujours un jeudi.
    expect(du('2026-05-14')).toMatchObject({ fin: '2026-05-17', jours: 4, aPoser: 1 });
  });

  it('donne cinq jours pour un mercredi, deux posés', () => {
    // 11 novembre 2026 : un mercredi.
    expect(du('2026-11-11')).toMatchObject({ fin: '2026-11-15', jours: 5, aPoser: 2 });
  });

  it('ne propose rien pour un férié tombé le week-end', () => {
    // 15 août 2026 : un samedi ; 1er novembre 2026 : un dimanche.
    expect(ponts.some((pont) => pont.nom === 'Assomption')).toBe(false);
    expect(ponts.some((pont) => pont.nom === 'Toussaint')).toBe(false);
  });
});

describe('les vacances scolaires', () => {
  it('se suivent dans l’ordre, chaque période bien formée', () => {
    for (const periode of VACANCES_SCOLAIRES) {
      expect(periode.debut <= periode.fin, periode.nom).toBe(true);
      expect(periode.zones.length).toBeGreaterThan(0);
    }
  });

  it('distingue les zones au printemps', () => {
    const c = vacancesAVenir('2027-03-01', 'C', 3);
    expect(c[0]).toMatchObject({ nom: 'Vacances de printemps (zone C)', debut: '2027-04-03', fin: '2027-04-18' });
    const a = vacancesAVenir('2027-03-01', 'A', 3);
    expect(a[0]!.debut).toBe('2027-04-10');
  });

  it('part d’aujourd’hui quand les vacances ont commencé', () => {
    const [ete] = vacancesAVenir('2027-08-10', 'B', 1);
    expect(ete).toMatchObject({ debut: '2027-08-10', fin: '2027-09-01' });
  });

  it('dit ce que des dates recoupent', () => {
    const recoupe = cePendant('2026-10-20', '2026-10-25', 'A');
    expect(recoupe.vacances.map((periode) => periode.nom)).toEqual(['Vacances de la Toussaint']);
    expect(cePendant('2026-04-30', '2026-05-02', null).feries.map((jour) => jour.nom)).toEqual([
      'Fête du Travail',
    ]);
  });

  it('rappelle de compléter le calendrier avant qu’il ne s’épuise', () => {
    // Quand ce test échoue, publier l'année scolaire suivante dans conges.ts
    // (jeu « Calendrier scolaire » de data.education.gouv.fr).
    const aujourdHui = new Date().toISOString().slice(0, 10);
    const dansUnAn = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
    expect(calendrierConnuJusquau() > aujourdHui).toBe(true);
    expect(calendrierConnuJusquau() >= dansUnAn.slice(0, 4) + '-01-01').toBe(true);
  });
});

describe('la zone du départ', () => {
  it('se devine d’après la ville, en France seulement', () => {
    expect(zoneProbable({ lat: 45.764, lng: 4.8357, country: 'France' })).toBe('A');
    expect(zoneProbable({ lat: 48.8566, lng: 2.3522 })).toBe('C');
    expect(zoneProbable({ lat: 43.2965, lng: 5.3698 })).toBe('B');
    // Pau relève de Bordeaux, bien que Toulouse soit plus proche.
    expect(zoneProbable({ lat: 43.2951, lng: -0.3708, country: 'France' })).toBe('A');
    expect(zoneProbable({ lat: 38.7223, lng: -9.1393, country: 'Portugal' })).toBeNull();
  });
});

describe('le calendrier du pays de départ', () => {
  it('reconnaît le pays d’après la ville de départ', () => {
    expect(paysDeDepart({ lat: 51.47, lng: -0.4543, country: 'Royaume-Uni' })).toBe('GB');
    expect(paysDeDepart({ lat: 48.8566, lng: 2.3522 })).toBe('FR');
    expect(paysDeDepart({ lat: 24.7136, lng: 46.6753 })).toBe('SA');
    // Au milieu de l'océan : on ne devine pas.
    expect(paysDeDepart({ lat: -60, lng: 0 })).toBeNull();
    expect(feriesConnus('GB')).toBe(true);
    expect(feriesConnus('XX')).toBe(false);
    expect(feriesConnus(null)).toBe(false);
  });

  it('n’impose pas les fériés français aux autres pays', () => {
    const anglais = joursFeriesDu('GB', 2027).map((jour) => jour.date);
    expect(anglais).toContain('2027-03-29'); // lundi de Pâques (Angleterre)
    expect(anglais).toContain('2027-08-30'); // dernier lundi d'août
    expect(anglais).not.toContain('2027-05-08'); // le 8 mai n'y est pas férié
    expect(anglais).not.toContain('2027-07-14');
    expect(joursFeriesDu('XX', 2027)).toEqual([]);
  });

  it('prend le jour reporté quand le férié tombe le week-end', () => {
    // Noël 2027 : un samedi, et le lendemain un dimanche ; les deux sont reportés au lundi et au mardi.
    const ponts = pontsEntre('2027-12-01', '2027-12-31', 'GB');
    expect(ponts).toEqual([
      expect.objectContaining({ debut: '2027-12-25', fin: '2027-12-28', jours: 4, aPoser: 0, nom: 'Noël et Boxing Day' }),
    ]);
    expect(joursFeriesDu('GB', 2027).find((jour) => jour.date === '2027-12-27')).toMatchObject({ reporte: true });
  });

  it('suit le week-end du pays', () => {
    expect(weekendDu('FR')).toEqual([6, 0]);
    // Arabie saoudite : vendredi et samedi.
    expect([...weekendDu('SA')].sort()).toEqual([5, 6]);
    // Le 22 février 2027, jour de la Fondation, est un lundi : là-bas, on pose le dimanche.
    const [fondation] = pontsEntre('2027-02-15', '2027-02-28', 'SA');
    expect(fondation).toMatchObject({ debut: '2027-02-19', fin: '2027-02-22', jours: 4, aPoser: 1 });
  });

  it('fait une seule occasion d’une fête de plusieurs jours', () => {
    const nouvelAn = pontsEntre('2027-02-01', '2027-02-28', 'CN');
    expect(nouvelAn).toHaveLength(1);
    expect(nouvelAn[0]).toMatchObject({ debut: '2027-02-05', fin: '2027-02-10', aPoser: 0 });
    expect(nouvelAn[0]!.nomEn).toContain('Chinese New Year');
  });

  it('ne parle de vacances scolaires qu’au départ de la France', () => {
    expect(cePendant('2026-10-20', '2026-10-25', null, 'GB').vacances).toEqual([]);
    expect(cePendant('2026-10-20', '2026-10-25', null, 'FR').vacances).not.toEqual([]);
  });

  it('rappelle de régénérer les fériés du monde avant qu’ils ne s’épuisent', () => {
    // Quand ce test échoue : avancer les années dans packages/core/scripts/feries.py et le relancer.
    const dansUnAn = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
    expect(feriesConnusJusquau() >= dansUnAn).toBe(true);
  });
});

describe('les vacances scolaires hors de France', () => {
  it('sont connues pour une quinzaine de pays, pas pour le Royaume-Uni', () => {
    expect(vacancesConnues('FR')).toBe(true);
    expect(vacancesConnues('DE')).toBe(true);
    expect(vacancesConnues('PT')).toBe(true);
    expect(vacancesConnues('GB')).toBe(false);
    expect(vacancesConnues(null)).toBe(false);
  });

  it('se rangent par région là où elles en dépendent, avec leur nom en français', () => {
    const lander = regionsScolaires('DE');
    expect(lander).toHaveLength(16);
    expect(lander.find((region) => region.code === 'DE-BY')).toMatchObject({ nom: 'Bavière', en: 'Bavaria' });
    // Le Portugal part en vacances d'un même pas : pas de région à choisir.
    expect(regionsScolaires('PT')).toEqual([]);
    expect(nomDeRegion('BE', 'BE-FR')).toBe('Communauté française');
  });

  it('devinent la région d’après la ville de départ', () => {
    expect(regionProbable('DE', { lat: 48.137, lng: 11.575 })).toBe('DE-BY'); // Munich
    expect(regionProbable('DE', { lat: 52.52, lng: 13.405 })).toBe('DE-BE'); // Berlin
    expect(regionProbable('DE', { lat: 50.938, lng: 6.96 })).toBe('DE-NW'); // Cologne
    expect(regionProbable('AT', { lat: 48.208, lng: 16.373 })).toBe('AT-WI'); // Vienne
    expect(regionProbable('CH', { lat: 46.204, lng: 6.143 })).toBe('CH-GE'); // Genève
    expect(regionProbable('CH', { lat: 47.377, lng: 8.541 })).toBe('CH-ZH'); // Zurich
    // Les trois régions scolaires des Pays-Bas, d'après la commune la plus proche.
    expect(regionProbable('NL', { lat: 52.373, lng: 4.893 })).toBe('NL-NO'); // Amsterdam
    expect(regionProbable('NL', { lat: 51.924, lng: 4.478 })).toBe('NL-MI'); // Rotterdam
    expect(regionProbable('NL', { lat: 50.851, lng: 5.691 })).toBe('NL-ZU'); // Maastricht
    // Belgique : la communauté d'après la ville ; Bruxelles, où les deux ont leurs écoles, n'en désigne aucune.
    expect(regionProbable('BE', { lat: 50.633, lng: 5.567 })).toBe('BE-FR'); // Liège
    expect(regionProbable('BE', { lat: 51.054, lng: 3.717 })).toBe('BE-NL'); // Gand
    expect(regionProbable('BE', { lat: 50.847, lng: 4.357 })).toBeNull(); // Bruxelles
    expect(regionProbable('PT', { lat: 38.722, lng: -9.139 })).toBeNull();
  });

  it('proposent les vacances à venir de la région, nommées avec elle', () => {
    const releve = vacancesDuMondeReleveesLe();
    const bavaroises = vacancesAVenirDu('DE', releve, 'DE-BY', 4);
    expect(bavaroises.length).toBeGreaterThan(0);
    for (const periode of bavaroises) {
      expect(periode.nature).toBe('vacances');
      expect(periode.nom).toMatch(/\(Bavière\)$/u);
      expect(periode.nomEn).toMatch(/\(Bavaria\)$/u);
      expect(periode.fin >= releve).toBe(true);
      expect(periode.jours).toBeGreaterThanOrEqual(3);
    }
    // Sans région choisie, une période propre à quelques régions le dit.
    const toutes = vacancesAVenirDu('DE', releve, null, 6);
    expect(toutes.every((periode) => /\((\d+ régions|[^)]+)\)$/u.test(periode.nom))).toBe(true);
    // La France garde sa propre source.
    expect(vacancesAVenirDu('FR', '2026-10-01', 'C', 1)[0]?.nom).toBe('Vacances de la Toussaint');
  });

  it('disent ce que des dates recoupent au départ d’un autre pays', () => {
    const [premiere] = vacancesAVenirDu('DE', vacancesDuMondeReleveesLe(), 'DE-BY', 1);
    const { vacances } = cePendant(premiere!.debut, premiere!.fin, 'DE-BY', 'DE');
    expect(vacances.length).toBeGreaterThan(0);
    expect(vacances[0]!.en).toBeTruthy();
    // Au Royaume-Uni, toujours rien.
    expect(cePendant(premiere!.debut, premiere!.fin, null, 'GB').vacances).toEqual([]);
  });

  it('rappelle de relever à nouveau les vacances du monde chaque année', () => {
    // Quand ce test échoue : relancer packages/core/scripts/vacances.py, à la rentrée.
    const ilYaTreizeMois = new Date(Date.now() - 395 * 86_400_000).toISOString().slice(0, 10);
    expect(vacancesDuMondeReleveesLe() >= ilYaTreizeMois).toBe(true);
  });
});
