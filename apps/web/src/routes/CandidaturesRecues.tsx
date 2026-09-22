import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Inbox, Settings2, UserX, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/EmptyState';
import { TitreDePage } from '@/components/TitreDePage';
import { ListeFantome } from '@/components/ui/Squelette';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import {
  getTripsOuverts,
  lireLErreur,
  type Candidature,
  type Genre,
} from '@/lib/tripsOuverts';
import { signaler } from '@/lib/feedback';
import { cn } from '@/lib/cn';

/**
 * Les candidatures reçues, du côté de l'organisateur.
 *
 * On accepte quelqu'un, pas un identifiant : le nom, la photo et la
 * présentation sont donc au premier plan, et l'âge et le genre en mention
 * discrète — ils servent à vérifier une règle, pas à trier des gens.
 *
 * Refuser et exclure sont deux gestes différents, et l'écran les sépare.
 * Refuser ferme une candidature. Exclure ferme la porte : la personne sort du
 * voyage et ne peut plus revenir. Le second demande une confirmation.
 */

const GENRES: Record<Genre, string> = { femme: 'Femme', homme: 'Homme', autre: 'Autre' };

export default function CandidaturesRecues() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ouverts = getTripsOuverts();

  const voyage = useQuery({
    queryKey: cleVoyage(id),
    queryFn: () => getTripRepository().get(id!),
    enabled: Boolean(id),
  });

  const publication = useQuery({
    queryKey: ['publication', id],
    queryFn: () => ouverts.reglagesDe(id!),
    enabled: Boolean(id),
  });

  const liste = useQuery({
    queryKey: ['candidatures', id],
    queryFn: () => ouverts.candidatures(id!),
    enabled: Boolean(id),
    refetchInterval: 60 * 1000,
  });

  const trancher = useMutation({
    mutationFn: ({ userId, accepter }: { userId: string; accepter: boolean }) =>
      ouverts.trancher(id!, userId, accepter),
    onSuccess: (_, { accepter }) => {
      signaler(accepter ? 'decision' : 'tape');
      void queryClient.invalidateQueries({ queryKey: ['candidatures', id] });
      void queryClient.invalidateQueries({ queryKey: cleVoyage(id) });
    },
    onError: () => signaler('echec'),
  });

  const exclure = useMutation({
    mutationFn: (userId: string) => ouverts.exclure(id!, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['candidatures', id] });
      void queryClient.invalidateQueries({ queryKey: cleVoyage(id) });
    },
  });

  const enAttente = (liste.data ?? []).filter((c) => c.suite === 'en-attente');
  const tranchees = (liste.data ?? []).filter((c) => c.suite !== 'en-attente');

  if (voyage.data && !voyage.data.isOwner) {
    return (
      <div className="px-5 pt-10">
        <Banner tone="warning">Seul l’organisateur voit les candidatures de son voyage.</Banner>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <div className="px-5 pt-6">
        <button
          onClick={() => navigate(`/voyages/${id}`)}
          className="text-muted hover:text-brand-600 -ms-1 mb-2 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour au voyage
        </button>
        <div className="flex items-start justify-between gap-3">
          <TitreDePage pastille="participants">Candidatures</TitreDePage>
          <Button
            size="sm"
            variant="secondary"
            icon={<Settings2 className="size-4" />}
            onClick={() => navigate(`/voyages/${id}/publier`)}
          >
            Réglages
          </Button>
        </div>
      </div>

      <div className="space-y-6 px-5 pt-6">
        {!publication.isLoading && !publication.data && (
          <Banner tone="info">
            Ce voyage n’est pas ouvert. Publiez-le pour que des inconnus puissent demander à vous
            rejoindre.
          </Banner>
        )}

        {trancher.error && <Banner tone="warning">{lireLErreur(trancher.error)}</Banner>}

        {liste.isLoading && <ListeFantome lignes={2} />}

        {liste.data?.length === 0 && publication.data && (
          <EmptyState
            illustration={<Inbox className="size-6" aria-hidden />}
            title="Aucune candidature"
            description="Personne n’a encore demandé à vous rejoindre. Les gens vous trouvent s’ils partent du même endroit vers la même destination."
          />
        )}

        {enAttente.length > 0 && (
          <section className="space-y-3">
            <h2 className="etiquette etiquette-filet">
              À traiter — {enAttente.length}
            </h2>
            {enAttente.map((c) => (
              <Fiche
                key={c.userId}
                candidature={c}
                onAccepter={() => trancher.mutate({ userId: c.userId, accepter: true })}
                onRefuser={() => trancher.mutate({ userId: c.userId, accepter: false })}
                occupe={trancher.isPending}
              />
            ))}
          </section>
        )}

        {tranchees.length > 0 && (
          <section className="space-y-3">
            <h2 className="etiquette etiquette-filet">Déjà traitées</h2>
            {tranchees.map((c) => (
              <Fiche
                key={c.userId}
                candidature={c}
                onExclure={
                  c.suite === 'acceptee' ?
                    () => {
                      if (
                        window.confirm(
                          `Exclure ${c.nom} ? La personne sort du voyage et ne pourra plus y revenir.`,
                        )
                      ) {
                        exclure.mutate(c.userId);
                      }
                    }
                  : undefined
                }
                occupe={exclure.isPending}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

const SUITES: Record<string, { texte: string; ton: string }> = {
  acceptee: { texte: 'Acceptée', ton: 'text-brand-600 dark:text-brand-300' },
  refusee: { texte: 'Refusée', ton: 'text-[color:var(--text-muted)]' },
  retiree: { texte: 'Retirée', ton: 'text-[color:var(--text-muted)]' },
};

function Fiche({
  candidature,
  onAccepter,
  onRefuser,
  onExclure,
  occupe,
}: {
  candidature: Candidature;
  onAccepter?: () => void;
  onRefuser?: () => void;
  onExclure?: () => void;
  occupe?: boolean;
}) {
  const suite = SUITES[candidature.suite];
  // Le genre et l'âge ne sont pas des critères de tri : ils disent seulement
  // ce que la règle a vérifié. D'où la mention discrète, après le nom.
  const mention = [
    candidature.genre ? GENRES[candidature.genre] : null,
    candidature.age !== null ? `${candidature.age} ans` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="surface-raised rounded-[var(--radius-card)] border filet p-4">
      <header className="flex items-center gap-3">
        {candidature.avatarUrl ?
          <img
            src={candidature.avatarUrl}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover"
          />
        : <span
            aria-hidden
            className="bg-brand-500/12 text-brand-700 dark:text-brand-200 grid size-10 shrink-0
                       place-items-center rounded-full font-semibold"
          >
            {candidature.nom.slice(0, 1).toUpperCase()}
          </span>
        }
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{candidature.nom}</p>
          {mention && <p className="text-muted text-xs">{mention}</p>}
        </div>
        {suite && <span className={cn('etiquette shrink-0', suite.ton)}>{suite.texte}</span>}
      </header>

      <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">
        {candidature.presentation}
      </p>

      {(onAccepter || onRefuser) && (
        <div className="mt-4 flex gap-2">
          <Button block size="sm" icon={<Check className="size-4" />} disabled={occupe} onClick={onAccepter}>
            Accepter
          </Button>
          <Button
            block
            size="sm"
            variant="secondary"
            icon={<X className="size-4" />}
            disabled={occupe}
            onClick={onRefuser}
          >
            Refuser
          </Button>
        </div>
      )}

      {onExclure && (
        <button
          type="button"
          onClick={onExclure}
          disabled={occupe}
          className="text-muted mt-3 inline-flex items-center gap-1.5 text-sm
                     underline-offset-2 hover:text-red-600 hover:underline"
        >
          <UserX className="size-4" aria-hidden />
          Exclure du voyage
        </button>
      )}
    </article>
  );
}
