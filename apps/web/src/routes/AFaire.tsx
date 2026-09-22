import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, ExternalLink, Search } from 'lucide-react';
import {
  AXIS_LABELS_FR,
  findDestination,
  formatCents,
  groupWeights,
  type PreferenceAxis,
} from '@tripora/core';
import {
  activitesDe,
  chercherActivites,
  libelleActivite,
  rechercherLaSortie,
  seReserve,
  type Activite,
  type MomentDeLaJournee,
} from '@tripora/core/activites';
import { TitreDePage } from '@/components/TitreDePage';
import { Banner } from '@/components/ui/Banner';
import { TextInput } from '@/components/ui/Field';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { chargerIllustrations, estAffichable, type Illustration } from '@/lib/illustrations';
import { direLaDuree } from '@/lib/duree';
import { cn } from '@/lib/cn';

/**
 * Ce qu'il y a à faire sur place.
 *
 * L'écran qui manquait. Tripora savait dire « partez à Bali » et « mardi
 * matin, culture, 18 € » ; il ne savait pas dire **quoi**, et un séjour de dix
 * jours s'affichait en dix fois « Musées et monuments ».
 *
 * Les activités viennent du catalogue écrit à la main : elles existent, on
 * peut aller les vérifier, et elles portent leur durée réelle et leur prix
 * indicatif. Les photos viennent de Wikimedia, avec leur crédit.
 *
 * L'ordre suit les envies du groupe — cocher « nature » fait remonter le
 * volcan — parce que c'est la seule chose qui distingue cette liste d'un
 * guide papier.
 */

const MOMENTS: Record<MomentDeLaJournee, string> = {
  matin: 'Le matin',
  'apres-midi': 'L’après-midi',
  soir: 'Le soir',
  journee: 'À la journée',
};

export default function AFaire() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recherche, setRecherche] = useState('');
  const [envie, setEnvie] = useState<PreferenceAxis | null>(null);

  const voyage = useQuery({
    queryKey: cleVoyage(id),
    queryFn: () => getTripRepository().get(id!),
    enabled: Boolean(id),
  });

  const destinationId = voyage.data?.lockedDestinationId ?? null;
  const ville = destinationId ? findDestination(destinationId) : undefined;
  const toutes = useMemo(() => (destinationId ? activitesDe(destinationId) : []), [destinationId]);

  // Une requête par destination, gardée un mois : les images d'un lieu ne
  // changent pas d'un jour à l'autre, et l'API de Wikimedia est un commun.
  const images = useQuery({
    queryKey: ['illustrations', destinationId],
    queryFn: () => chargerIllustrations(toutes),
    enabled: toutes.length > 0,
    staleTime: 30 * 24 * 60 * 60 * 1000,
    gcTime: 30 * 24 * 60 * 60 * 1000,
  });

  const envies = useMemo(() => groupWeights(voyage.data?.members ?? []), [voyage.data?.members]);

  const visibles = useMemo(() => {
    const filtrees = destinationId ? chercherActivites(destinationId, recherche) : [];
    const parEnvie = envie ? filtrees.filter((a) => a.axis === envie) : filtrees;
    // Les envies du groupe d'abord, puis le prix croissant : à envie égale,
    // ce qui est gratuit passe devant, parce qu'on peut toujours le faire.
    return [...parEnvie].sort(
      (a, b) =>
        (envies[b.axis] ?? 0) - (envies[a.axis] ?? 0) ||
        a.prixCents - b.prixCents ||
        a.nom.localeCompare(b.nom, 'fr'),
    );
  }, [destinationId, recherche, envie, envies]);

  /** Les envies réellement représentées ici : un filtre vide ne sert à rien. */
  const enviesPresentes = useMemo(
    () => [...new Set(toutes.map((activite) => activite.axis))],
    [toutes],
  );

  return (
    <div className="pb-14">
      <div className="px-5 pt-6">
        <button
          onClick={() => navigate(`/voyages/${id}`)}
          className="text-muted hover:text-brand-600 -ms-1 mb-2 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour au voyage
        </button>
        <TitreDePage pastille="itineraire">À faire</TitreDePage>
        {ville && (
          <p className="text-muted mt-1 text-sm">
            {toutes.length} idée{toutes.length > 1 ? 's' : ''} à {ville.name}, classées selon les
            envies du groupe
          </p>
        )}
      </div>

      <div className="space-y-4 px-5 pt-5">
        {!destinationId && (
          <Banner tone="info">
            Arrêtez d’abord la destination : c’est elle qui décide de ce qu’il y a à faire.
          </Banner>
        )}

        {destinationId && toutes.length === 0 && (
          <Banner tone="info">
            {ville?.name} n’est pas encore dans le carnet d’activités. La carte et la recherche de
            lieux restent disponibles, et le catalogue s’étoffe à chaque version.
          </Banner>
        )}

        {toutes.length > 0 && (
          <>
            <label className="relative block">
              <Search
                className="text-muted pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2"
                aria-hidden
              />
              <TextInput
                value={recherche}
                onChange={(event) => setRecherche(event.target.value)}
                placeholder="Chercher une activité"
                aria-label="Chercher une activité"
                className="ps-10"
              />
            </label>

            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              <Filtre actif={envie === null} onClick={() => setEnvie(null)}>
                Tout
              </Filtre>
              {enviesPresentes.map((axe) => (
                <Filtre key={axe} actif={envie === axe} onClick={() => setEnvie(axe)}>
                  {AXIS_LABELS_FR[axe]}
                </Filtre>
              ))}
            </div>

            {visibles.length === 0 && (
              <p className="text-muted py-8 text-center text-sm">
                Rien de ce côté-là. Essayez un autre mot, ou retirez le filtre.
              </p>
            )}

            <ul className="animate-cascade space-y-4">
              {visibles.map((activite) => (
                <li key={activite.id}>
                  <FicheDActivite
                    activite={activite}
                    ville={ville?.name ?? ''}
                    illustration={images.data?.[activite.id]}
                  />
                </li>
              ))}
            </ul>

            <p className="text-muted pt-2 text-center text-xs leading-relaxed">
              Durées et prix indicatifs, relevés à la main. Les photos viennent de Wikimedia
              Commons. Le bouton de réservation ouvre une recherche, jamais un produit précis :
              on ne garantit pas un prestataire qu’on n’a pas vérifié.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Filtre({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        'shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
        actif ?
          'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-200 font-semibold'
        : 'filet surface-raised text-muted',
      )}
    >
      {children}
    </button>
  );
}

function FicheDActivite({
  activite,
  ville,
  illustration,
}: {
  activite: Activite;
  ville: string;
  illustration: Illustration | undefined;
}) {
  const montrable = estAffichable(illustration);

  return (
    <article className="surface-raised overflow-hidden rounded-[var(--radius-card)] border filet">
      {montrable && illustration && (
        <figure className="relative m-0">
          <img
            src={illustration.url}
            alt=""
            loading="lazy"
            className="h-44 w-full object-cover"
          />
          {/* Le crédit posé sur l'image plutôt qu'en dessous : il doit rester
              attaché à la photo, y compris quand la fiche est partagée en
              capture d'écran. */}
          <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-6 pb-1.5">
            <a
              href={illustration.page}
              target="_blank"
              rel="noreferrer"
              className="text-[0.625rem] text-white/85 underline-offset-2 hover:underline"
            >
              {illustration.auteur ?? 'Wikimedia Commons'} · {illustration.licence}
            </a>
          </figcaption>
        </figure>
      )}

      <div className="space-y-2.5 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="etiquette">{libelleActivite(activite)}</span>
          <span className="etiquette">{MOMENTS[activite.moment]}</span>
        </div>

        <h2 className="titre text-lg leading-tight">{activite.nom}</h2>
        <p className="text-sm leading-relaxed">{activite.resume}</p>

        <div className="filet flex items-center gap-4 border-t pt-3 text-sm">
          <span className="text-muted inline-flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden />
            <span className="chiffres">{direLaDuree(activite.dureeHeures)}</span>
          </span>
          <span className="chiffres font-semibold">
            {activite.prixCents === 0 ? 'Gratuit' : formatCents(activite.prixCents, 'EUR', { hideCentimes: true })}
          </span>
          {seReserve(activite) && (
            <a
              href={rechercherLaSortie(activite, ville)}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 dark:text-brand-300 ms-auto inline-flex items-center gap-1.5
                         font-medium underline-offset-2 hover:underline"
            >
              Réserver
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
