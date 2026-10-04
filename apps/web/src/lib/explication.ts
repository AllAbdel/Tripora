import {
  formatCents,
  monthNameFr,
  type Destination,
  type DestinationScore,
} from '@tripora/core';

/**
 * Les faits envoyés au modèle pour qu'il rédige une explication.
 *
 * C'est la pièce qui rend la règle du projet applicable : *l'IA interprète, elle
 * ne mesure pas*. Tout ce qui part d'ici a été calculé par le moteur — la note,
 * la ventilation du coût, la raison de chaque facteur. Le modèle n'a plus qu'à
 * en faire une phrase. S'il invente un chiffre, il invente contre son propre
 * contexte, ce qui se voit tout de suite.
 *
 * Ce qui ne part pas, et ne partira jamais : les noms des participants, leurs
 * e-mails, l'identifiant du voyage, la ville de départ précise de qui que ce
 * soit. Les offres gratuites s'entraînent sur ce qu'on leur donne.
 */
export function faitsPourExplication(
  destination: Destination,
  score: DestinationScore,
  month: number | undefined,
  participants: number,
): string {
  const lignes: string[] = [
    `Destination : ${destination.name}, ${destination.country}.`,
    `Période : ${month === undefined ? 'non fixée' : monthNameFr(month)}.`,
    `Groupe : ${participants} personnes, sans plus de précision.`,
    `Note globale calculée : ${score.total} sur 100.`,
    `Coût total estimé par personne : ${formatCents(score.cost.totalCents, 'EUR', { hideCentimes: true })}.`,
    'Détail de la note (chaque ligne : facteur, note sur 100, poids, constat) :',
  ];

  for (const facteur of score.factors) {
    lignes.push(
      `- ${facteur.label} : ${Math.round(facteur.score)}/100, poids ${Math.round(facteur.weight * 100)} %, ${facteur.reason}`,
    );
  }

  // Le degré de fiabilité fait partie des faits : une explication assise sur
  // une estimation ne doit pas se lire comme une explication assise sur un
  // prix relevé.
  lignes.push(
    score.cost.transportSource === 'observed'
      ? 'Le prix du transport est un tarif réellement relevé.'
      : 'Le prix du transport est une estimation, pas un tarif relevé.',
  );

  return lignes.join('\n');
}
