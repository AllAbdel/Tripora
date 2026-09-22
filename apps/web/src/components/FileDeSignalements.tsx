import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import {
  getTripsOuverts,
  lireLErreur,
  MOTIFS_DE_SIGNALEMENT,
} from '@/lib/tripsOuverts';
import { signaler as retour } from '@/lib/feedback';

/**
 * Les signalements, côté administration.
 *
 * Deux décisions possibles, et seulement deux : classer, ou retirer la
 * personne des trips ouverts. La suspension ne touche pas aux voyages entre
 * amis — on protège les inconnus, on ne punit pas un groupe d'amis.
 *
 * Le nombre de personnes différentes qui ont déjà signalé la même personne est
 * affiché à côté, parce que c'est l'information qui départage le plus souvent.
 * Il n'agit pas tout seul : une suspension automatique au nombre permettrait à
 * quatre personnes coordonnées d'exclure n'importe qui.
 */
export function FileDeSignalements() {
  const ouverts = getTripsOuverts();
  const queryClient = useQueryClient();

  const file = useQuery({
    queryKey: ['signalements-a-traiter'],
    queryFn: () => ouverts.signalementsATraiter(),
    refetchInterval: 2 * 60 * 1000,
  });

  const trancher = useMutation({
    mutationFn: ({ id, suspendre }: { id: string; suspendre: boolean }) =>
      ouverts.trancherLeSignalement(id, suspendre),
    onSuccess: () => {
      retour('decision');
      return queryClient.invalidateQueries({ queryKey: ['signalements-a-traiter'] });
    },
  });

  const libelle = (valeur: string) =>
    MOTIFS_DE_SIGNALEMENT.find((motif) => motif.valeur === valeur)?.libelle ?? valeur;

  return (
    <section className="space-y-3">
      <h2 className="etiquette etiquette-filet">
        Signalements{file.data?.length ? ` — ${file.data.length}` : ''}
      </h2>

      {file.data?.length === 0 && (
        <p className="text-muted text-sm">Aucun signalement en attente.</p>
      )}

      {trancher.error && <Banner tone="warning">{lireLErreur(trancher.error)}</Banner>}

      {file.data?.map((dossier) => (
        <article key={dossier.id} className="surface-raised rounded-[var(--radius-card)] border filet p-4">
          <header className="flex items-baseline justify-between gap-3">
            <p className="font-semibold">
              <Flag className="text-muted me-1.5 inline size-3.5" aria-hidden />
              {dossier.viseNom}
            </p>
            <span className="etiquette">{libelle(dossier.motif)}</span>
          </header>
          <p className="text-muted mt-1 text-xs">
            Signalé par {dossier.auteurNom} le{' '}
            {new Date(dossier.creeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            {dossier.dejaSignale > 1 && (
              <strong className="text-gold-700 dark:text-gold-300">
                {' '}
                · signalé·e par {dossier.dejaSignale} personnes différentes
              </strong>
            )}
          </p>
          {dossier.detail && (
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">{dossier.detail}</p>
          )}
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={trancher.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Retirer ${dossier.viseNom} des trips ouverts ? Ses trips publiés se referment, ses candidatures tombent. Ses voyages entre amis ne sont pas touchés.`,
                  )
                ) {
                  trancher.mutate({ id: dossier.id, suspendre: true });
                }
              }}
            >
              Retirer des trips ouverts
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={trancher.isPending}
              onClick={() => trancher.mutate({ id: dossier.id, suspendre: false })}
            >
              Classer
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
