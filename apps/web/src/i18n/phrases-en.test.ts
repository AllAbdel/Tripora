import { describe, expect, it } from 'vitest';
import { normaliser, traduireCle } from './moteur';
import { MOTIFS, PHRASES } from './phrases-en';

/**
 * L'anglais, phrase par phrase : ce que les motifs composent, et surtout ce
 * qu'ils ne doivent pas toucher.
 *
 * Un motif trop large ne se voit pas dans le code : il traduit trois mots
 * d'une phrase qu'il n'a jamais vue et laisse le reste en français
 * (« « Qui owes quoi » est un calcul… »). Les phrases de la seconde liste sont
 * de vraies phrases de Tripora qui ont déjà pris ce chemin, ou qui le
 * prendraient au premier relâchement d'une expression régulière.
 */
const dictionnaire = { phrases: PHRASES, motifs: MOTIFS };
const anglais = (francais: string) => traduireCle(dictionnaire, normaliser(francais));

describe('l’anglais composé par les motifs', () => {
  it.each([
    ['Étape 2 sur 6', 'Step 2 of 6'],
    ['Départ de Paris', 'Leaving from Paris'],
    ['Départ de Ubud Villas, 11:00 AM', 'Check-out from Ubud Villas, 11:00 AM'],
    ['3 virements suffisent, au lieu que chacun rembourse chacun.', '3 transfers are enough, instead of everyone paying everyone back.'],
    ['Léa doit €45.20 à Tom', 'Léa owes €45.20 to Tom'],
    ['Léa · Oct 3 · partagé à 3', 'Léa · Oct 3 · split 3 ways'],
    ['Lancé par Léa · un seul choix · 3 votants', 'Started by Léa · single choice · 3 voters'],
    ['Lancé par vous · un seul choix · vote secret · aucun vote', 'Started by you · single choice · secret vote · no votes'],
    [
      'Les résultats s’affichent pour tout le groupe, sans les noms. 4 personnes ont voté. Un vote secret clos ne peut plus être rouvert.',
      'The results will show for the whole group, without names. 4 people have voted. A closed secret vote can’t be reopened.',
    ],
    ['Femme · 28 ans', 'Woman · 28 years old'],
    ['Bali, Indonésie · 5 jours · octobre · départ de Paris', 'Bali, Indonesia · 5 days · October · leaving from Paris'],
    ['Booking.com · arrivée 2:00 PM → départ Fri, Oct 16 11:00 AM · 3 nuits', 'Booking.com · check-in 2:00 PM → check-out Fri, Oct 16 11:00 AM · 3 nights'],
    ['112 (pompiers) · 15 (ambulance)', '112 (fire) · 15 (ambulance)'],
    ['7 jours, avec une lessive sur place. Prévoyez-en une paire de plus si vous marchez beaucoup.', '7 days, with laundry on site. Pack an extra pair if you walk a lot.'],
    ['Prix vu il y a 3 jours (Aviasales)', 'Price seen 3 days ago (Aviasales)'],
    [
      'Cracovie obtient 86/100 : tient dans le budget (72 % de l\'enveloppe), 21 °C en journée, 12 °C la nuit, 3 jours de pluie dans le mois. En revanche : environ 3.5 h de trajet porte à porte.',
      'Kraków scores 86/100: within budget (72% of it), 21 °C by day, 12 °C at night, 3 rainy days in the month. On the other hand: about 3.5 h door to door.',
    ],
    [
      'Les rizières en terrasses de Tegallalang du carnet d’activités, compter 3 h, à 2.5 km de Ubud. Quelqu’un du groupe en a envie.',
      'The Tegallalang rice terraces, from the activity guide, allow 3 hr, 2.5 km from Ubud. Someone in the group wants to go.',
    ],
    ['Encore 3 pays pour devenir', '3 more countries to become'],
    ['Où partir en octobre ?', 'Where to go in October?'],
  ])('%s', (francais, attendu) => {
    expect(anglais(francais)).toBe(attendu);
  });
});

describe('ce que les motifs laissent en français', () => {
  it.each([
    // Un motif « X doit Y à Z » sans montant.
    '« Qui doit quoi » est un calcul fait à partir de ce que le groupe a saisi, dans les devises indiquées et au taux du jour : une aide, pas un relevé bancaire.',
    // « Du … au … » sans date.
    'Du calcaire à trous, sept cents voies équipées, et l’un des meilleurs spots d’initiation au monde.',
    // Un verbe d'action suivi d'une phrase, pas d'un nom.
    'Descendre le Rhin à la nage',
    'Modifier la dépense',
    // « départ » sans heure ni date : pas une réservation.
    'Un départ de bonne heure, et la ville pour soi',
    // « jusqu’à » dans une phrase.
    'Ouvert jusqu’à minuit pour tout le monde',
  ])('%s', (francais) => {
    expect(anglais(francais)).toBeNull();
  });
});
