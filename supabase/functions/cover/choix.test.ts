/**
 * Les quatre couvertures fausses qu'on a livrées, et qui ne doivent plus
 * revenir.
 *
 *   deno test supabase/functions/cover/choix.test.ts
 *
 * Aucune dépendance : ce fichier tourne hors ligne, contrairement au reste de
 * la fonction, qui importe le client Supabase.
 */
import { estUnEmbleme, nomCourt, texteBrut, titreCorrespond } from './choix.ts';

function egal(obtenu: unknown, attendu: unknown, quoi: string): void {
  if (obtenu !== attendu) {
    throw new Error(`${quoi} : attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`);
  }
}

Deno.test('nomCourt garde le lieu qui porte l’article', () => {
  egal(nomCourt('Séville'), 'Séville', 'un nom simple ne bouge pas');
  egal(nomCourt('Caen et les plages du Débarquement'), 'Caen', 'coupe avant « et »');
  egal(nomCourt('Abidjan et Assinie'), 'Abidjan', 'coupe même devant une majuscule');
  egal(nomCourt('Atauro et Dili'), 'Atauro', 'idem pour Timor');
  egal(nomCourt('Sumatra — Medan et le lac Toba'), 'Sumatra', 'coupe sur le tiret');
  egal(nomCourt('Sri Lanka — Colombo et Kandy'), 'Sri Lanka', 'le tiret passe avant « et »');
  egal(nomCourt('Les Sundarbans'), 'Sundarbans', 'l’article de tête tombe');
  egal(nomCourt('La Valette et Malte'), 'Valette', 'coupe puis article — reste cherchable');
  egal(nomCourt('Rio de Janeiro'), 'Rio de Janeiro', 'pas de coupe abusive');
});

Deno.test('titreCorrespond refuse l’article voisin', () => {
  egal(titreCorrespond('Cambridge', 'Cambridge'), true, 'titre exact');
  egal(titreCorrespond('Cambridge (Massachusetts)', 'Cambridge'), true, 'désambiguïsation');
  egal(titreCorrespond('Royaume-Uni', 'Cambridge'), false, 'le pays n’est pas la ville');
  egal(titreCorrespond('Université de Cambridge', 'Cambridge'), false, 'ni l’université');
  egal(titreCorrespond('Seville', 'Séville'), true, 'accents ignorés');
  egal(titreCorrespond(undefined, 'Séville'), false, 'sans titre, non');
});

Deno.test('estUnEmbleme écarte tout ce qui n’est pas une photo du lieu', () => {
  // Les vraies photos, qui doivent passer.
  egal(estUnEmbleme('Arch of Triumph, Chisinau (51160304626 cropped).jpg'), false, 'Chișinău');
  egal(estUnEmbleme('The_city_of_Ouidah.jpg'), false, 'Ouidah');
  egal(estUnEmbleme('Castara village Beach1.jpg'), false, 'Tobago');

  // Les emblèmes : le premier bug, Lisbonne illustrée par son drapeau.
  egal(estUnEmbleme('Flag of Lisbon.svg'), true, 'un drapeau');
  egal(estUnEmbleme('Escudo de Sevilla.svg'), true, 'des armoiries');
  egal(estUnEmbleme('Logo Ville de Nantes.png'), true, 'un logo');

  // Les cartes : le deuxième bug, Sumatra illustrée par un atlas de 1900.
  egal(estUnEmbleme('Atlas van der Hagen Sumatra 1900.jpg'), true, 'un atlas');
  egal(estUnEmbleme('Topographic map of Lesotho.png'), true, 'une carte topographique');
  egal(estUnEmbleme('LocationEswatini.svg'), true, 'une carte de localisation');

  // Les vues orbitales : le troisième bug, et elles passaient tous les filtres.
  egal(estUnEmbleme('Strait of Gibraltar 5.53940W 35.97279N.jpg'), true, 'une prise de vue NASA');
  egal(estUnEmbleme('Mayotte, vue par Sentinel 2 (cropped).jpg'), true, 'Sentinel');
  egal(estUnEmbleme('Saint-PierreEtMiquelonFromTheISS.jpg'), true, 'la Station spatiale');

  // La photo d'agence : le quatrième bug, un exercice militaire pour Ouidah.
  egal(
    estUnEmbleme(
      'Africa Endeavor is empowering African Partner nations to enhance their C4 ' +
        '(command, control, communications and computer systems) and cyber defense ' +
        'capabilities in Cotonou, Benin in July 2025 - 94.jpg',
    ),
    true,
    'une légende de dépêche',
  );
  egal(
    estUnEmbleme(
      'NYC Downtown Manhattan Skyline seen from Paulus Hook 2019-12-20 IMG 7347 FRD (cropped).jpg',
    ),
    false,
    'un nom long mais raisonnable reste une photo',
  );

  // Le format tranche le reste.
  egal(estUnEmbleme('Vue de Lyon.tiff'), true, 'un TIFF n’est pas une couverture');
  egal(estUnEmbleme(undefined), true, 'pas de fichier, pas de photo');
});

Deno.test('texteBrut ne laisse jamais passer de balisage', () => {
  egal(texteBrut('<a href="/wiki/X">Jean Dupont</a>'), 'Jean Dupont', 'les balises tombent');
  egal(texteBrut('Marie &amp; Paul'), 'Marie & Paul', 'les entités se lisent');
  egal(texteBrut('<script>alert(1)</script>'), 'alert(1)', 'le script devient du texte');
  egal(texteBrut('   '), null, 'un crédit vide vaut absent');
  egal(texteBrut('a'.repeat(200))?.length, 118, 'un crédit trop long est coupé');
});
