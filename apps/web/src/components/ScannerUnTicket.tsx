import { useRef, useState } from 'react';
import { Camera, ImageUp, ScanText } from 'lucide-react';
import { formatCents, type LectureDuTicket } from '@tripora/core';
import { lireUnePhotoDeTicket, type EtapeDeLecture } from '@/lib/lectureDuTicket';

type Etat =
  | { phase: 'repos' }
  | { phase: 'lecture'; etape: EtapeDeLecture; progression: number }
  | { phase: 'lu'; lecture: LectureDuTicket }
  | { phase: 'echec'; message: string };

/**
 * « Scanner un ticket » : une photo, et le formulaire de la dépense se
 * remplit — montant, date, commerce, catégorie, devise quand le ticket la dit.
 *
 * Deux gestes, parce qu'ils ne se remplacent pas : prendre la photo tout de
 * suite (l'appareil photo s'ouvre directement), ou retrouver celle prise au
 * restaurant. La lecture se fait sur l'appareil ; rien n'est envoyé.
 */
export function ScannerUnTicket({ onLu }: { onLu: (lecture: LectureDuTicket) => void }) {
  const [etat, setEtat] = useState<Etat>({ phase: 'repos' });
  const photo = useRef<HTMLInputElement>(null);
  const galerie = useRef<HTMLInputElement>(null);

  async function lire(fichier: File | undefined) {
    if (!fichier) return;
    setEtat({ phase: 'lecture', etape: 'preparation', progression: 0 });
    try {
      const lecture = await lireUnePhotoDeTicket(fichier, (etape, progression) =>
        setEtat({ phase: 'lecture', etape, progression }),
      );
      onLu(lecture);
      setEtat({ phase: 'lu', lecture });
    } catch {
      setEtat({
        phase: 'echec',
        message:
          typeof navigator !== 'undefined' && navigator.onLine === false
            ? 'La lecture des tickets se télécharge au premier usage : réessayez une fois connecté, elle marchera ensuite hors ligne.'
            : 'Cette photo n’a pas pu être lue. Réessayez, ou saisissez la dépense à la main.',
      });
    } finally {
      if (photo.current) photo.current.value = '';
      if (galerie.current) galerie.current.value = '';
    }
  }

  const enCours = etat.phase === 'lecture';
  const bouton =
    'text-brand-600 dark:text-brand-300 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold disabled:opacity-60';

  return (
    <div className="filet space-y-2 rounded-[var(--radius-card)] border border-dashed p-3">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ScanText className="size-4 shrink-0" aria-hidden />
        Scanner un ticket
      </p>
      <div className="flex flex-wrap gap-x-5">
        <button type="button" className={bouton} disabled={enCours} onClick={() => photo.current?.click()}>
          <Camera className="size-4" aria-hidden />
          Prendre en photo
        </button>
        <button type="button" className={bouton} disabled={enCours} onClick={() => galerie.current?.click()}>
          <ImageUp className="size-4" aria-hidden />
          Choisir une photo
        </button>
      </div>
      <input
        ref={photo}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label="Photo du ticket"
        onChange={(evenement) => void lire(evenement.target.files?.[0])}
      />
      <input
        ref={galerie}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Image du ticket"
        onChange={(evenement) => void lire(evenement.target.files?.[0])}
      />

      <div aria-live="polite" className="text-sm">
        {etat.phase === 'repos' && (
          <p className="text-muted text-xs leading-relaxed">
            Le montant, la date et le commerce se remplissent seuls. La photo est lue sur cet
            appareil et n’est envoyée nulle part.
          </p>
        )}
        {etat.phase === 'lecture' && (
          <p className="text-muted apparition-tardive">
            {etat.etape === 'preparation'
              ? 'Préparation de la lecture…'
              : `Lecture du ticket… ${Math.round(etat.progression * 100)} %`}
          </p>
        )}
        {etat.phase === 'lu' &&
          (etat.lecture.montantCents !== null ? (
            <p>
              Total lu :{' '}
              <strong className="chiffres">
                {formatCents(etat.lecture.montantCents, etat.lecture.devise ?? 'EUR')}
              </strong>
              {etat.lecture.commerce ? ` chez ${etat.lecture.commerce}` : ''}. Vérifiez-le avant
              d’enregistrer.
            </p>
          ) : (
            <p className="text-gold-700 dark:text-gold-300">
              Aucun total lisible sur cette photo. Posez le ticket à plat, bien éclairé, et
              photographiez-le de plus près — ou saisissez le montant.
            </p>
          ))}
        {etat.phase === 'echec' && (
          <p role="alert" className="text-red-700 dark:text-red-300">
            {etat.message}
          </p>
        )}
      </div>
    </div>
  );
}
