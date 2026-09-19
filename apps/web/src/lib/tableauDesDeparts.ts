import { DESTINATIONS, type Destination } from '@tripora/core';

/**
 * Le tableau des départs de l'écran d'accueil.
 *
 * L'écran de connexion montrait un logo centré, un titre centré, un paragraphe
 * centré. C'est la mise en page que produit n'importe quel gabarit, et elle ne
 * disait rien de ce que fait l'application. Un tableau de départs le dit en
 * une seconde, sans une phrase de plus — et il n'est pas décoratif : ce sont
 * de vraies villes du catalogue, avec leurs vrais codes d'aéroport.
 *
 * Le tirage est **stable dans la journée** et change le lendemain. Un tirage
 * au hasard à chaque rendu ferait vibrer la page à chaque retour en arrière ;
 * un tableau figé pour toujours cesserait d'être regardé au bout d'un jour.
 *
 * Aucune donnée personnelle n'entre ici, et aucun appel réseau : le catalogue
 * est embarqué, donc l'écran s'affiche à l'identique hors ligne.
 */

export interface LigneDeDepart {
  /** Code IATA, la colonne de gauche d'un vrai tableau. */
  code: string;
  ville: string;
  /**
   * Vide quand la ville *est* le pays. « SIN · Singapour · SINGAPOUR » répète
   * le même mot deux fois sur la même ligne, ce qu'aucun tableau d'aéroport
   * ne fait — et ce qui donne l'air d'un gabarit mal rempli.
   */
  pays: string;
}

/** Le jour courant, en numéro de jour depuis l'époque : le grain du tirage. */
function jour(maintenant: Date): number {
  return Math.floor(maintenant.getTime() / 86_400_000);
}

/**
 * Un mélange déterministe, à partir d'une graine.
 *
 * Pas de `Math.random` : deux rendus du même jour doivent donner le même
 * tableau, sur le même appareil comme sur celui d'à côté.
 */
function suite(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat * 1_664_525 + 1_013_904_223) >>> 0;
    return etat / 0x1_0000_0000;
  };
}

export function tableauDesDeparts(combien = 5, maintenant = new Date()): LigneDeDepart[] {
  // Seules les villes qui ont un aéroport peuvent figurer sur un tableau de
  // départs. Les autres — une vallée, un archipel qu'on rejoint en bateau —
  // ont toute leur place dans le catalogue, mais pas dans cette colonne.
  const eligibles = DESTINATIONS.filter(
    (ville): ville is Destination & { iata: readonly [string, ...string[]] } =>
      ville.iata.length > 0 && /^[A-Z]{3}$/.test(ville.iata[0] ?? ''),
  );

  const tirer = suite(jour(maintenant));
  const restantes = [...eligibles];
  const lignes: LigneDeDepart[] = [];

  while (lignes.length < combien && restantes.length > 0) {
    const [choisie] = restantes.splice(Math.floor(tirer() * restantes.length), 1);
    if (!choisie) break;
    // Un tableau où deux lignes annoncent le même pays perd de sa promesse :
    // on veut donner l'impression d'un monde, pas d'une région.
    if (lignes.some((ligne) => ligne.pays === choisie.country)) continue;
    const ville = nomCourt(choisie.name);
    lignes.push({
      code: choisie.iata[0],
      ville,
      pays: ville.toLocaleLowerCase('fr') === choisie.country.toLocaleLowerCase('fr')
        ? ''
        : choisie.country,
    });
  }

  return lignes;
}

/**
 * Le nom tel qu'il tiendrait sur une ligne d'affichage.
 *
 * Le catalogue intitule volontiers ses entrées — « Caen et les plages du
 * Débarquement », « Sumatra — Medan et le lac Toba ». Un tableau de départs
 * annonce une ville, pas un programme.
 */
export function nomCourt(nom: string): string {
  const coupe = nom.split(/\s+[—–-]\s+| et |,/u)[0]?.trim() ?? nom;
  return coupe.length >= 3 ? coupe : nom;
}
