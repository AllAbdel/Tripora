import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Clock, ExternalLink, Heart, Layers, Search, X } from 'lucide-react';
import {
  AXIS_LABELS_FR,
  findDestination,
  formatCents,
  groupWeights,
  phraseDesEnvies,
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
import { useAuth } from '@/lib/auth-context';
import {
  cleEnvies,
  getEnvies,
  requeteDesEnvies,
  usePoserUneEnvie,
  type Avis,
  type AvisSurUneActivite,
} from '@/lib/envies';

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

/** Le filtre « ce que le groupe a choisi », à côté des envies par axe. */
const NOS_ENVIES = 'nos-envies';

export default function AFaire() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { identity } = useAuth();
  const moi = identity?.id ?? 'moi';
  const [recherche, setRecherche] = useState('');
  const [envie, setEnvie] = useState<PreferenceAxis | typeof NOS_ENVIES | null>(null);

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

  // Qui a envie de quoi. La même clé que l'itinéraire, qui s'en sert pour
  // remplir les journées.
  const avis = useQuery(requeteDesEnvies(id, moi));

  // Les avis des autres arrivent en direct : on voit le cœur de Karim
  // s'allumer pendant qu'il fait défiler la même liste à l'autre bout de la table.
  useEffect(() => {
    if (!id) return;
    return getEnvies().ecouter(id, () => {
      void queryClient.invalidateQueries({ queryKey: cleEnvies(id) });
    });
  }, [id, queryClient]);

  const poser = usePoserUneEnvie(id);

  const visibles = useMemo(() => {
    const filtrees = destinationId ? chercherActivites(destinationId, recherche) : [];
    const parEnvie =
      envie === NOS_ENVIES
        ? filtrees.filter((a) => (avis.data?.parActivite[a.id]?.pour ?? 0) > 0)
        : envie
          ? filtrees.filter((a) => a.axis === envie)
          : filtrees;
    const soldeDe = (activiteId: string): number => {
      const detail = avis.data?.parActivite[activiteId];
      return detail ? detail.pour - detail.contre : 0;
    };
    // Ce que le groupe a réclamé d'abord ; puis les envies générales du
    // groupe ; puis le prix croissant — à envie égale, ce qui est gratuit
    // passe devant, parce qu'on peut toujours le faire.
    return [...parEnvie].sort(
      (a, b) =>
        soldeDe(b.id) - soldeDe(a.id) ||
        (envies[b.axis] ?? 0) - (envies[a.axis] ?? 0) ||
        a.prixCents - b.prixCents ||
        a.nom.localeCompare(b.nom, 'fr'),
    );
  }, [destinationId, recherche, envie, envies, avis.data]);

  const nombreDEnvies = useMemo(
    () =>
      Object.values(avis.data?.parActivite ?? {}).filter((detail) => detail.pour > 0)
        .length,
    [avis.data],
  );

  /** Ce que je n'ai pas encore jugé : ce que « Découvrir » me fera passer. */
  const aJuger = toutes.filter((activite) => !avis.data?.parActivite[activite.id]?.moi).length;

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
            {/* Une idée à la fois, plein écran, qu'on garde d'un glissement :
                plus rapide que cette liste, et c'est ce qui fait le classement. */}
            <Link
              to={`/voyages/${id}/decouvrir`}
              className="pressable flex items-center gap-3 rounded-[var(--radius-card)] bg-gradient-to-br from-[#ff8a65] to-[#e8457a] p-4 text-white shadow-[var(--shadow-float)]"
            >
              <Layers className="size-7 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Découvrir en glissant</span>
                <span className="block text-sm text-white/90">
                  {aJuger > 0
                    ? `${aJuger} idée${aJuger > 1 ? 's' : ''} à juger d’un geste, et le classement du groupe`
                    : 'Tout est jugé : voir le classement du groupe'}
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0" aria-hidden />
            </Link>

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
              {nombreDEnvies > 0 && (
                <Filtre actif={envie === NOS_ENVIES} onClick={() => setEnvie(NOS_ENVIES)}>
                  Nos envies · {nombreDEnvies}
                </Filtre>
              )}
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
                    avis={avis.data?.parActivite[activite.id]}
                    surAvis={(valeur) => poser.mutate({ activiteId: activite.id, valeur })}
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

function BoutonDAvis({
  actif,
  libelle,
  onClick,
  children,
}: {
  actif: boolean;
  libelle: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      aria-label={libelle}
      className={cn(
        'pressable inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
        actif
          ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-200 font-semibold'
          : 'filet text-muted',
      )}
    >
      {children}
    </button>
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
  avis,
  surAvis,
}: {
  activite: Activite;
  ville: string;
  illustration: Illustration | undefined;
  avis: AvisSurUneActivite | undefined;
  surAvis: (valeur: Avis | null) => void;
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

        <div className="flex flex-wrap items-center gap-2">
          <BoutonDAvis
            actif={avis?.moi === 'envie'}
            libelle={`J’ai envie : ${activite.nom}`}
            onClick={() => surAvis(avis?.moi === 'envie' ? null : 'envie')}
          >
            <Heart className={cn('size-4', avis?.moi === 'envie' && 'fill-current')} aria-hidden />
            J’ai envie
          </BoutonDAvis>
          <BoutonDAvis
            actif={avis?.moi === 'sans-moi'}
            libelle={`Sans moi : ${activite.nom}`}
            onClick={() => surAvis(avis?.moi === 'sans-moi' ? null : 'sans-moi')}
          >
            <X className="size-4" aria-hidden />
            Sans moi
          </BoutonDAvis>
        </div>
        {/* Combien, jamais qui : chacun garde ce qui lui plaît sans avoir à
            s'en justifier devant le groupe. */}
        {avis && (avis.pour > 0 || avis.contre > 0) && (
          <p className="text-muted text-xs leading-snug">
            {avis.pour > 0 && <span>{phraseDesEnvies(avis.pour, avis.moi === 'envie')}</span>}
            {avis.pour > 0 && avis.contre > 0 && <span> · </span>}
            {avis.contre > 0 && (
              <span>
                {avis.contre} s’en passerai{avis.contre > 1 ? 'ent' : 't'}
              </span>
            )}
          </p>
        )}

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
