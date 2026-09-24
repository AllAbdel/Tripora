import { calendrierDuVoyage, formatCents, fold, type EvenementDuProgramme } from '@tripora/core';
import type { ItineraryDayView } from './itinerary';
import { partagerUnFichier } from './natif';

/**
 * Du programme affiché au fichier téléchargé.
 *
 * Le format lui-même vit dans le moteur, où il est testé ; ici on ne fait que
 * traduire les journées de l'écran en événements, et déclencher le
 * téléchargement. Sur téléphone, ouvrir le fichier propose directement
 * d'ajouter les événements au calendrier. Dans l'application mobile, où un
 * lien de téléchargement ne fait rien, il passe par la feuille de partage :
 * on choisit son agenda, ou on l'envoie au groupe.
 */

/** Les journées sans date ne peuvent pas aller dans un calendrier. */
export function programmeDate(journees: readonly ItineraryDayView[]): boolean {
  return journees.length > 0 && journees.every((jour) => Boolean(jour.date));
}

export function evenementsDuProgramme(
  journees: readonly ItineraryDayView[],
  devise = 'EUR',
): EvenementDuProgramme[] {
  return journees.flatMap((jour) =>
    jour.date
      ? jour.items.map((item) => {
          const details = [
            item.notes ?? item.reason,
            item.costCents > 0
              ? `Budget indicatif : ${formatCents(item.costCents, devise, { hideCentimes: true })}`
              : null,
          ].filter(Boolean);
          return {
            id: item.id,
            titre: item.title,
            date: jour.date!,
            debut: item.startTime,
            fin: item.endTime,
            ...(details.length > 0 ? { description: details.join('\n') } : {}),
          };
        })
      : [],
  );
}

/** « Bali entre potes » devient « bali-entre-potes.ics ». */
export function nomDuFichier(titre: string): string {
  const base = fold(titre)
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 60);
  return `${base || 'voyage'}.ics`;
}

export async function telechargerLeProgramme({
  titre,
  fuseau,
  journees,
}: {
  titre: string;
  fuseau: string | undefined;
  journees: readonly ItineraryDayView[];
}): Promise<void> {
  const contenu = calendrierDuVoyage({
    titre,
    fuseau,
    evenements: evenementsDuProgramme(journees),
    maintenant: new Date(),
  });
  if (await partagerUnFichier({ nom: nomDuFichier(titre), contenu, titre })) return;

  const url = URL.createObjectURL(new Blob([contenu], { type: 'text/calendar;charset=utf-8' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomDuFichier(titre);
  document.body.append(lien);
  lien.click();
  lien.remove();
  // Laisser au navigateur le temps de lire le fichier avant de le libérer.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
