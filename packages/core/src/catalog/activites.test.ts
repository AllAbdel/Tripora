import { describe, expect, it } from 'vitest';
import {
  ACTIVITES,
  activitesDe,
  chercherActivites,
  destinationsAvecActivites,
  poisDeLaDestination,
  prixMedianCents,
  rechercherLaSortie,
  seReserve,
  trouverActivite,
} from './activites.js';
import { findDestination } from './destinations.js';
import { haversineKm } from '../geo.js';
import { PREFERENCE_AXES } from '../preferences.js';

describe('catalogue d’activités', () => {
  it('ne rattache aucune activité à une destination inconnue', () => {
    for (const activite of ACTIVITES) {
      expect(findDestination(activite.destinationId), activite.id).toBeDefined();
    }
  });

  it('n’a pas deux fois le même identifiant', () => {
    const vus = new Set<string>();
    for (const activite of ACTIVITES) {
      expect(vus.has(activite.id), activite.id).toBe(false);
      vus.add(activite.id);
    }
  });

  /**
   * Les excursions qui s'éloignent vraiment, et pourquoi.
   *
   * Chacune est une journée assumée au départ de la ville, pas une erreur de
   * saisie. Les nommer une par une permet de garder le seuil ordinaire très
   * bas : c'est lui qui attrape la faute de frappe.
   */
  const EXCURSIONS: Record<string, string> = {
    'nairobi-masai-mara/safari-mara': 'la réserve est à cinq heures de route de Nairobi, et le catalogue nomme les deux',
    'la-havane/vinales': 'Viñales est une excursion classique à la journée depuis La Havane',
    'phuket/similan': 'les Similan se rejoignent en bateau rapide depuis Khao Lak',
    'petra/wadi-rum-excursion': 'le Wadi Rum se fait à la journée depuis Wadi Musa',
    'sydney/blue-mountains': 'deux heures de train depuis Central',
    'reykjavik/cercle-or': 'le Cercle d’or est la boucle d’une journée au départ de Reykjavík',
    'cusco/rainbow': 'Vinicunca demande trois heures de route et un départ avant l’aube',
    'munich/neuschwanstein': 'le château de Louis II se visite à la journée, à deux heures de train de Munich',
    'delhi/taj-mahal': 'Agra est à trois heures de train rapide, et le Taj Mahal se fait dans la journée',
    'sri-lanka/kandy': 'Kandy est l’excursion classique depuis Colombo, trois heures de train dans les collines',
    'sri-lanka/galle': 'le fort de Galle se rejoint en deux heures par l’autoroute du sud',
    'chengdu/leshan': 'le Bouddha de Leshan est à une heure de train rapide de Chengdu',
    'santiago/valparaiso': 'Valparaíso est à une heure et demie de bus, l’aller-retour classique depuis Santiago',
    'cancun/chichen-itza': 'Chichén Itzá se fait à la journée depuis Cancún, trois heures de route',
    'cancun/tulum': 'Tulum est à deux heures de route au sud, sur la Riviera Maya',
    'costa-rica/arenal': 'l’Arenal est à trois heures de route de San José, et se fait d’une traite',
    'las-vegas/grand-canyon': 'la rive ouest du Grand Canyon est l’excursion à la journée depuis Las Vegas',
    'melbourne/douze-apotres': 'la Great Ocean Road se fait en une longue journée au départ de Melbourne',
    'palawan/el-nido': 'Palawan est une île de quatre cents kilomètres : El Nido se rejoint en cinq heures de route depuis Puerto Princesa',
    'belfast/chaussee-des-geants': 'la Chaussée des Géants est l’excursion classique à la journée depuis Belfast, par la route côtière d’Antrim',
    'bergen/naeroyfjord': 'le Nærøyfjord se fait à la journée depuis Bergen, par le train de Flåm et le bateau',
  };

  it('place chaque activité près de sa destination', () => {
    // Le garde-fou contre la faute de frappe sur une coordonnée : une erreur
    // d'un degré sur la longitude déplace un musée de quatre-vingts kilomètres,
    // et l'itinéraire se met à traverser la mer entre deux créneaux.
    //
    // Le seuil ordinaire reste bas. Les quelques excursions qui le dépassent
    // sont nommées au-dessus, avec leur raison : une liste fermée se relit,
    // là où un seuil large laisserait passer la vraie erreur.
    for (const activite of ACTIVITES) {
      const destination = findDestination(activite.destinationId)!;
      const km = haversineKm(destination, activite);
      const limite = activite.id in EXCURSIONS ? 210 : 80;
      expect(km, `${activite.id} est à ${Math.round(km)} km de sa destination`).toBeLessThan(limite);
    }
  });

  it('n’autorise pas une excursion qui n’en est plus une', () => {
    // Si une entrée disparaît du catalogue, sa dérogation doit disparaître
    // avec elle : sinon la liste devient un tapis sous lequel on balaie.
    for (const id of Object.keys(EXCURSIONS)) {
      expect(trouverActivite(id), id).toBeDefined();
    }
  });

  it('n’annonce que des envies que le moteur connaît', () => {
    for (const activite of ACTIVITES) {
      expect(PREFERENCE_AXES, activite.id).toContain(activite.axis);
    }
  });

  it('donne des durées et des prix vraisemblables', () => {
    for (const activite of ACTIVITES) {
      // Une demi-heure au minimum : en dessous ce n'est pas un créneau.
      expect(activite.dureeHeures, activite.id).toBeGreaterThanOrEqual(0.5);
      // Deux nuits : au-delà ce n'est plus une activité, c'est un séjour.
      expect(activite.dureeHeures, activite.id).toBeLessThanOrEqual(48);
      expect(activite.prixCents, activite.id).toBeGreaterThanOrEqual(0);
      expect(activite.prixCents, activite.id).toBeLessThanOrEqual(50_000);
      // Un prix en centimes est un entier : un demi-centime ne se paie pas.
      expect(Number.isInteger(activite.prixCents), activite.id).toBe(true);
    }
  });

  it('écrit ses étiquettes Wikipédia au bon format', () => {
    for (const activite of ACTIVITES) {
      if (!activite.wikipedia) continue;
      expect(activite.wikipedia, activite.id).toMatch(/^[a-z]{2,3}:.{2,}$/u);
    }
  });

  it('écrit ses titres Wikipédia avec l’apostrophe de Wikipédia', () => {
    // Wikipédia titre ses articles avec l'apostrophe droite. Vérifiés un par
    // un le 23 septembre 2026, treize titres introuvables du carnet portaient
    // une apostrophe typographique, et six l'étaient pour cette seule raison
    // — « Lac d’Annecy » au lieu de « Lac d'Annecy ». Leurs activités
    // restaient sans photo. Le reste de l'application veut l'apostrophe
    // typographique ; les titres, non.
    for (const activite of ACTIVITES) {
      if (!activite.wikipedia) continue;
      expect(activite.wikipedia.includes('’'), activite.id).toBe(false);
    }
  });

  it('résume chaque activité sans la vendre', () => {
    for (const activite of ACTIVITES) {
      expect(activite.resume.length, activite.id).toBeGreaterThan(20);
      expect(activite.resume.length, activite.id).toBeLessThan(200);
      // Les apostrophes typographiques partout : le reste de l'application les
      // utilise, et un mélange se voit à l'écran.
      expect(activite.resume.includes("'"), activite.id).toBe(false);
      expect(activite.nom.includes("'"), activite.id).toBe(false);
    }
  });

  it('sait dire quelles destinations il couvre', () => {
    const couvertes = destinationsAvecActivites();
    expect(couvertes.length).toBeGreaterThan(50);
    expect(couvertes).toContain('bali');
    // Le tri rend la liste stable d'un affichage à l'autre.
    expect([...couvertes].sort()).toEqual(couvertes);
  });

  it('propose de quoi remplir dix jours à Bali', () => {
    // Le cas qui a révélé la panne : un séjour de dix jours n'affichait que
    // des intitulés neutres, parce qu'aucun lieu réel n'arrivait jamais.
    const bali = activitesDe('bali');
    expect(bali.length).toBeGreaterThanOrEqual(8);
    // Et pas dix fois la même envie : une journée entière de temples lasse.
    expect(new Set(bali.map((activite) => activite.axis)).size).toBeGreaterThanOrEqual(5);
  });

  it('traduit les activités en lieux utilisables par l’itinéraire', () => {
    const lieux = poisDeLaDestination('bali');
    expect(lieux.length).toBe(activitesDe('bali').length);
    for (const lieu of lieux) {
      expect(lieu.id.startsWith('activite:')).toBe(true);
      expect(lieu.name.length).toBeGreaterThan(2);
      expect(lieu.label.length).toBeGreaterThan(2);
    }
  });

  it('ne renvoie rien pour une destination qu’il ne connaît pas', () => {
    expect(activitesDe('achgabat')).toEqual([]);
    expect(poisDeLaDestination('achgabat')).toEqual([]);
    expect(prixMedianCents('achgabat')).toBeNull();
  });

  it('retrouve une activité par son identifiant', () => {
    const batur = trouverActivite('bali/batur');
    expect(batur?.nom).toContain('Batur');
    expect(trouverActivite('bali/inexistant')).toBeUndefined();
  });

  it('cherche sans se soucier des accents ni de la casse', () => {
    expect(chercherActivites('paris', 'EIFFEL').map((a) => a.id)).toContain('paris/tour-eiffel');
    expect(chercherActivites('kyoto', 'bambou').length).toBeGreaterThan(0);
    expect(chercherActivites('paris', '').length).toBe(activitesDe('paris').length);
  });

  it('calcule un prix médian à partir des seules entrées payantes', () => {
    // Les activités gratuites ne doivent pas tirer la médiane vers zéro : une
    // journée où l'on marche dans un quartier ne coûte rien, et ça ne dit rien
    // de ce que coûte un musée.
    const median = prixMedianCents('paris');
    expect(median).not.toBeNull();
    expect(median!).toBeGreaterThan(0);
  });

  it('renvoie vers une recherche, jamais vers un produit ni un affilié', () => {
    const batur = trouverActivite('bali/batur')!;
    const lien = rechercherLaSortie(batur, 'Bali');
    const url = new URL(lien);
    expect(url.protocol).toBe('https:');
    expect(url.searchParams.get('q')).toContain('Batur');
    // Aucun identifiant de partenaire : le lien ne nous rapporte rien, et il
    // ne doit pas avoir l'air de le faire.
    for (const suspect of ['partner_id', 'aid', 'ref', 'utm_source', 'cmp']) {
      expect(url.searchParams.has(suspect), suspect).toBe(false);
    }
  });

  it('distingue ce qui se réserve de ce qui se traverse', () => {
    expect(seReserve(trouverActivite('bali/batur')!)).toBe(true);
    expect(seReserve(trouverActivite('paris/montmartre')!)).toBe(false);
  });
});
