import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, ExternalLink, Heart, List, RotateCcw, Trophy, X } from 'lucide-react';
import {
  AXIS_ICON,
  AXIS_LABELS_FR,
  classementDuGroupe,
  findDestination,
  formatCents,
  groupWeights,
  paquetADecouvrir,
  phraseDesEnvies,
  type ComptesDAvis,
  type PreferenceAxis,
} from '@tripora/core';
import { activitesDe, rechercherLaSortie, seReserve, type Activite } from '@tripora/core/activites';
import { CarteQuiGlisse, type CarteQuiGlisseRef, type Decision } from '@/components/decouvrir/CarteQuiGlisse';
import { Icone } from '@/components/Icone';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { chargerIllustrations, estAffichable, type Illustration } from '@/lib/illustrations';
import { comptesDesEnvies, requeteDesEnvies, usePoserUneEnvie } from '@/lib/envies';
import { useAuth } from '@/lib/auth-context';
import { direLaDuree } from '@/lib/duree';
import { cn } from '@/lib/cn';

/**
 * Découvrir : les idées une par une, plein écran, qu'on garde d'un glissement.
 *
 * Une liste de quarante activités se parcourt en diagonale ; une carte à la
 * fois se regarde. À droite, j'y vais ; à gauche, pas pour moi ; vers le bas,
 * on revient à la précédente. La photo bouge doucement, comme une vidéo
 * courte, et le texte dit ce qu'on y vit.
 *
 * Chaque geste est une envie du groupe, la même que dans « À faire » : elle
 * compte pour le classement et pour remplir l'itinéraire. Le classement dit
 * combien de gens ont gardé chaque idée, jamais qui.
 */

type Vue = 'decouvrir' | 'classement';

const MOMENTS: Record<Activite['moment'], string> = {
  matin: 'Le matin',
  'apres-midi': 'L’après-midi',
  soir: 'Le soir',
  journee: 'À la journée',
};

/** Le fond d'une carte sans photo : une couleur par envie, pour ne pas être un trou. */
const FONDS: Record<PreferenceAxis, string> = {
  culture: 'from-amber-700 to-rose-900',
  nature: 'from-emerald-600 to-teal-900',
  food: 'from-orange-600 to-red-900',
  nightlife: 'from-fuchsia-700 to-indigo-950',
  relax: 'from-sky-500 to-cyan-900',
  adventure: 'from-lime-600 to-emerald-950',
  shopping: 'from-pink-600 to-purple-900',
  offbeat: 'from-violet-600 to-slate-900',
};

export default function Decouvrir() {
  const { id } = useParams<{ id: string }>();
  const { identity } = useAuth();
  const moi = identity?.id ?? 'moi';
  const [vue, setVue] = useState<Vue>('decouvrir');
  const [filtre, setFiltre] = useState<PreferenceAxis | null>(null);
  const [revoirLesRefus, setRevoirLesRefus] = useState(false);
  // Ce qu'on a jugé pendant cette session, dans l'ordre, et la position quand
  // on remonte le fil (null : on est à la pointe du paquet).
  const [pile, setPile] = useState<string[]>([]);
  const [enRevue, setEnRevue] = useState<number | null>(null);
  const carte = useRef<CarteQuiGlisseRef | null>(null);

  const voyage = useQuery({
    queryKey: cleVoyage(id),
    queryFn: () => getTripRepository().get(id!),
    enabled: Boolean(id),
  });
  const destinationId = voyage.data?.lockedDestinationId ?? null;
  const ville = destinationId ? findDestination(destinationId) : undefined;
  const toutes = useMemo(() => (destinationId ? activitesDe(destinationId) : []), [destinationId]);
  const parId = useMemo(() => new Map(toutes.map((activite) => [activite.id, activite])), [toutes]);

  // La même requête qu'« À faire » : les photos sont déjà là si on en vient.
  const images = useQuery({
    queryKey: ['illustrations', destinationId],
    queryFn: () => chargerIllustrations(toutes),
    enabled: toutes.length > 0,
    staleTime: 30 * 24 * 60 * 60 * 1000,
    gcTime: 30 * 24 * 60 * 60 * 1000,
  });

  const avis = useQuery(requeteDesEnvies(id, moi));
  const comptes = useMemo(() => comptesDesEnvies(avis.data), [avis.data]);
  const poser = usePoserUneEnvie(id, moi);

  const envies = useMemo(() => groupWeights(voyage.data?.members ?? []), [voyage.data?.members]);
  const paquet = useMemo(
    () => paquetADecouvrir(toutes, { avis: comptes, envies, filtre, revoirLesRefus }),
    // Le paquet ne se recalcule pas à chaque avis des autres : seul le mien
    // le change, et c'est précisément ce qui fait avancer.
    [toutes, comptes, envies, filtre, revoirLesRefus],
  );

  const courante: Activite | undefined =
    enRevue !== null ? parId.get(pile[enRevue]!) : (paquet[0] ?? undefined);
  const suivante: Activite | undefined = enRevue !== null ? undefined : paquet[1];
  const jugees = Object.values(comptes).filter((compte) => compte.moi !== null).length;
  const refusees = Object.values(comptes).filter((compte) => compte.moi === 'sans-moi').length;

  function decider(decision: Decision) {
    if (!courante) return;
    poser.mutate({ activiteId: courante.id, valeur: decision });
    if (enRevue !== null) {
      setEnRevue(enRevue + 1 < pile.length ? enRevue + 1 : null);
    } else {
      setPile((actuelle) => [...actuelle, courante.id]);
    }
  }

  function revenir() {
    if (pile.length === 0) return;
    if (enRevue === null) setEnRevue(pile.length - 1);
    else if (enRevue > 0) setEnRevue(enRevue - 1);
  }
  const peutRevenir = pile.length > 0 && (enRevue === null || enRevue > 0);

  function changerDeFiltre(suivant: PreferenceAxis | null) {
    setFiltre(suivant);
    setRevoirLesRefus(false);
    setPile([]);
    setEnRevue(null);
  }

  // Le clavier, sur ordinateur : les flèches font les mêmes gestes.
  useEffect(() => {
    if (vue !== 'decouvrir') return;
    function surTouche(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowRight') carte.current?.lancer('envie');
      else if (event.key === 'ArrowLeft') carte.current?.lancer('sans-moi');
      else if (event.key === 'ArrowDown' || event.key === 'Backspace') revenir();
      else return;
      event.preventDefault();
    }
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  });

  // Les deux photos suivantes se chargent pendant qu'on regarde celle-ci.
  useEffect(() => {
    for (const prochaine of paquet.slice(1, 3)) {
      const image = images.data?.[prochaine.id];
      if (image && estAffichable(image)) new Image().src = image.url;
    }
  }, [paquet, images.data]);

  const axesPresents = useMemo(() => [...new Set(toutes.map((activite) => activite.axis))], [toutes]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#0b0f17] text-white lg:left-64">
      <header
        className="flex items-center gap-2 px-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      >
        <Link
          to={`/voyages/${id ?? ''}/a-faire`}
          aria-label="Retour à la liste"
          className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="sr-only">Découvrir{ville ? ` à ${ville.name}` : ''}</h1>
        <div role="tablist" aria-label="Affichage" className="mx-auto flex rounded-full bg-white/10 p-1">
          <Onglet actif={vue === 'decouvrir'} onClick={() => setVue('decouvrir')}>
            Découvrir
          </Onglet>
          <Onglet actif={vue === 'classement'} onClick={() => setVue('classement')}>
            <Trophy className="size-3.5" aria-hidden />
            Classement
          </Onglet>
        </div>
        <Link
          to={`/voyages/${id ?? ''}/a-faire`}
          aria-label="Voir la liste complète"
          className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          <List className="size-5" aria-hidden />
        </Link>
      </header>

      {vue === 'decouvrir' && (
        <div className="flex gap-2 overflow-x-auto px-3 py-2.5" role="group" aria-label="Ce qui vous tente">
          <Filtre actif={filtre === null} onClick={() => changerDeFiltre(null)}>
            Tout
          </Filtre>
          {axesPresents.map((axe) => (
            <Filtre key={axe} actif={filtre === axe} onClick={() => changerDeFiltre(axe)}>
              {AXIS_LABELS_FR[axe]}
            </Filtre>
          ))}
        </div>
      )}

      {vue === 'decouvrir' ? (
        <>
          <div className="relative mx-auto w-full max-w-md flex-1 px-3">
            {!destinationId && voyage.isSuccess && (
              <Message titre="Pas encore de destination">
                Arrêtez d’abord la destination : c’est elle qui décide de ce qu’il y a à découvrir.
              </Message>
            )}
            {destinationId && toutes.length === 0 && (
              <Message titre="Rien à découvrir ici pour l’instant">
                {ville?.name} n’est pas encore dans le carnet d’activités.
              </Message>
            )}

            {/* La carte suivante, déjà là derrière : on sent qu'il y en a d'autres. */}
            {suivante && (
              <div aria-hidden className="absolute inset-x-3 inset-y-0 scale-[0.95] opacity-60">
                <FaceDeLIdee activite={suivante} illustration={images.data?.[suivante.id]} ville="" compte={undefined} statique />
              </div>
            )}

            {courante && (
              <div className="absolute inset-x-3 inset-y-0">
                <CarteQuiGlisse
                  key={`${courante.id}-${enRevue ?? 'pointe'}`}
                  ref={carte}
                  etiquette={courante.nom}
                  peutRevenir={peutRevenir}
                  surDecision={decider}
                  surRetour={revenir}
                >
                  <FaceDeLIdee
                    activite={courante}
                    illustration={images.data?.[courante.id]}
                    ville={ville?.name ?? ''}
                    compte={comptes[courante.id]}
                  />
                </CarteQuiGlisse>
              </div>
            )}

            {destinationId && toutes.length > 0 && !courante && (
              <FinDuPaquet
                refusees={refusees}
                revoirLesRefus={revoirLesRefus}
                filtre={filtre}
                surClassement={() => setVue('classement')}
                surRevoir={() => {
                  setRevoirLesRefus(true);
                  setPile([]);
                  setEnRevue(null);
                }}
                surToutVoir={() => changerDeFiltre(null)}
              />
            )}
          </div>

          <footer className="pb-safe mx-auto flex w-full max-w-md items-center justify-center gap-5 px-3 pt-3">
            <BoutonRond
              libelle="Revenir à la précédente"
              onClick={revenir}
              disabled={!peutRevenir}
              className="size-12 border-white/30 text-white/80"
            >
              <RotateCcw className="size-5" aria-hidden />
            </BoutonRond>
            <BoutonRond
              libelle="Pas pour moi"
              onClick={() => carte.current?.lancer('sans-moi')}
              disabled={!courante}
              className="size-16 border-rose-400 text-rose-300"
            >
              <X className="size-8" aria-hidden />
            </BoutonRond>
            <BoutonRond
              libelle="J’y vais"
              onClick={() => carte.current?.lancer('envie')}
              disabled={!courante}
              className="size-16 border-emerald-400 bg-emerald-400/10 text-emerald-300"
            >
              <Heart className="size-8 fill-current" aria-hidden />
            </BoutonRond>
            <span className="text-xs tabular-nums text-white/60" aria-live="polite">
              {jugees}/{toutes.length}
            </span>
          </footer>
        </>
      ) : (
        <Classement
          toutes={toutes}
          comptes={comptes}
          votants={avis.data?.votants ?? 0}
          images={images.data}
          surDecouvrir={() => setVue('decouvrir')}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- La carte -- */

function FaceDeLIdee({
  activite,
  illustration,
  ville,
  compte,
  statique = false,
}: {
  activite: Activite;
  illustration: Illustration | undefined;
  ville: string;
  compte: ComptesDAvis | undefined;
  statique?: boolean;
}) {
  const montrable = estAffichable(illustration);
  // Le sens du mouvement de caméra change d'une carte à l'autre, sans hasard :
  // la même carte bouge toujours de la même façon.
  const graine = [...activite.id].reduce((somme, lettre) => somme + lettre.charCodeAt(0), 0);
  const camera = {
    '--camera-x': `${graine % 2 === 0 ? -3 : 3}%`,
    '--camera-y': `${graine % 3 === 0 ? 2 : -2}%`,
  } as React.CSSProperties;
  const autres = compte ? compte.pour - (compte.moi === 'envie' ? 1 : 0) : 0;

  return (
    <article className="relative h-full w-full overflow-hidden rounded-3xl bg-neutral-900 shadow-2xl">
      {montrable && illustration ? (
        <img
          src={illustration.url}
          alt=""
          draggable={false}
          className={cn('absolute inset-0 h-full w-full object-cover', !statique && 'plan-de-camera')}
          style={camera}
        />
      ) : (
        <div className={cn('absolute inset-0 grid place-items-center bg-gradient-to-br', FONDS[activite.axis])}>
          <Icone nom={AXIS_ICON[activite.axis]} className="size-24 text-white/30" />
        </div>
      )}

      {/* Le haut : l'envie que ça sert, et si d'autres l'ont déjà gardée. */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/50 to-transparent p-4 pb-10">
        <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold backdrop-blur">
          {AXIS_LABELS_FR[activite.axis]}
        </span>
        {autres > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Heart className="size-3.5 fill-current text-rose-300" aria-hidden />
            {autres} dans le groupe
          </span>
        )}
      </div>

      {/* Le bas : le nom, ce qu'on y vit, ce que ça prend. */}
      <div className="absolute inset-x-0 bottom-0 space-y-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-5 pt-24">
        <h2 className="titre text-3xl leading-tight">{activite.nom}</h2>
        <p className="text-base leading-snug text-white/90">{activite.resume}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Puce>
            <Clock className="size-3.5" aria-hidden />
            {direLaDuree(activite.dureeHeures)}
          </Puce>
          <Puce>{activite.prixCents === 0 ? 'Gratuit' : formatCents(activite.prixCents, 'EUR', { hideCentimes: true })}</Puce>
          <Puce>{MOMENTS[activite.moment]}</Puce>
          {!statique && seReserve(activite) && (
            <a
              href={rechercherLaSortie(activite, ville)}
              target="_blank"
              rel="noreferrer"
              className="ms-auto inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              Voir les offres
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
        {montrable && illustration && (
          <p className="truncate text-[0.625rem] text-white/60">
            Photo : {illustration.auteur ?? 'Wikimedia Commons'} · {illustration.licence}
          </p>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------- Classement -- */

function Classement({
  toutes,
  comptes,
  votants,
  images,
  surDecouvrir,
}: {
  toutes: readonly Activite[];
  comptes: Record<string, ComptesDAvis>;
  votants: number;
  images: Record<string, Illustration> | undefined;
  surDecouvrir: () => void;
}) {
  const lignes = classementDuGroupe(toutes, comptes);
  const meilleur = lignes[0]?.pour ?? 0;

  return (
    <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pt-3 pb-8">
      <h2 className="titre text-2xl">Ce que le groupe garde</h2>
      <p className="mt-1 text-sm text-white/70">
        {votants === 0
          ? 'Personne n’a encore rien gardé.'
          : `${votants} personne${votants > 1 ? 's ont' : ' a'} donné son avis. On voit combien ont gardé chaque idée, jamais qui.`}
      </p>

      {lignes.length === 0 ? (
        <button
          type="button"
          onClick={surDecouvrir}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 font-semibold text-neutral-900"
        >
          Commencer à découvrir
        </button>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {lignes.map((ligne, rang) => {
            const image = images?.[ligne.idee.id];
            return (
              <li key={ligne.idee.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5">
                <span className="w-6 shrink-0 text-center text-sm font-bold text-white/60 tabular-nums">{rang + 1}</span>
                <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white/10">
                  {estAffichable(image) && image && <img src={image.url} alt="" className="h-full w-full object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{ligne.idee.nom}</span>
                  <span className="block text-xs text-white/70">{phraseDesEnvies(ligne.pour, ligne.moi === 'envie')}</span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/10">
                    <span
                      className="block h-full rounded-full bg-emerald-400"
                      style={{ width: `${Math.round((ligne.pour / Math.max(1, votants, meilleur)) * 100)}%` }}
                    />
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 font-semibold tabular-nums">
                  <Heart className="size-4 fill-current text-rose-300" aria-hidden />
                  {ligne.pour}
                  {votants > 0 && <span className="text-xs font-normal text-white/60">/{votants}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Pièces -- */

function FinDuPaquet({
  refusees,
  revoirLesRefus,
  filtre,
  surClassement,
  surRevoir,
  surToutVoir,
}: {
  refusees: number;
  revoirLesRefus: boolean;
  filtre: PreferenceAxis | null;
  surClassement: () => void;
  surRevoir: () => void;
  surToutVoir: () => void;
}) {
  return (
    <div className="grid h-full place-items-center text-center">
      <div className="space-y-4 px-4">
        <Trophy className="mx-auto size-12 text-amber-300" aria-hidden />
        <p className="titre text-2xl">{filtre ? 'Tout vu de ce côté-là' : 'Vous avez tout vu'}</p>
        <p className="text-sm text-white/70">Le classement dit ce que le groupe garde, idée par idée.</p>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={surClassement}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 font-semibold text-neutral-900"
          >
            <Trophy className="size-4" aria-hidden />
            Voir le classement
          </button>
          {filtre && (
            <button type="button" onClick={surToutVoir} className="min-h-11 px-4 text-sm font-semibold underline">
              Découvrir toutes les envies
            </button>
          )}
          {!revoirLesRefus && refusees > 0 && (
            <button type="button" onClick={surRevoir} className="min-h-11 px-4 text-sm font-semibold underline">
              Revoir ce que j’ai passé ({refusees})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Message({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="grid h-full place-items-center text-center">
      <div className="max-w-xs space-y-2">
        <p className="titre text-xl">{titre}</p>
        <p className="text-sm text-white/70">{children}</p>
      </div>
    </div>
  );
}

function Onglet({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={actif}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors',
        actif ? 'bg-white text-neutral-900' : 'text-white/80',
      )}
    >
      {children}
    </button>
  );
}

function Filtre({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
        actif ? 'border-white bg-white text-neutral-900 font-semibold' : 'border-white/25 text-white/85',
      )}
    >
      {children}
    </button>
  );
}

function Puce({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">{children}</span>
  );
}

function BoutonRond({
  libelle,
  onClick,
  disabled,
  className,
  children,
}: {
  libelle: string;
  onClick: () => void;
  disabled?: boolean;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={libelle}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'pressable grid shrink-0 place-items-center rounded-full border-2 transition-opacity disabled:opacity-30',
        className,
      )}
    >
      {children}
    </button>
  );
}
