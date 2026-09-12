import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Lock, LockOpen, MapPin, Pencil, Users, Wallet } from 'lucide-react';
import {
  estimateTransportOptions,
  findDestination,
  formatCents,
  hasAnswered,
  MONTHS_FR,
  targetMonth,
  tripReadiness,
} from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProposalCard } from '@/components/ProposalCard';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { getCollaboration } from '@/lib/collaboration';
import { getVoting, groupChoice, type VoteValue } from '@/lib/votes';
import { useProposals } from '@/lib/useProposals';
import { useGroupRealtime } from '@/lib/useGroupRealtime';
import { useAuth } from '@/lib/auth-context';
import { VoteBar } from '@/components/VoteBar';
import { Reserver } from '@/components/Reserver';
import { ApplicationsUtiles } from '@/components/ApplicationsUtiles';
import { MeteoPrevue } from '@/components/MeteoPrevue';
import { OuEnEstLeGroupe } from '@/components/OuEnEstLeGroupe';
import { Assistant } from '@/components/Assistant';
import { toFailure } from '@/lib/errors';
import { OutilsDuVoyage } from '@/components/OutilsDuVoyage';
import { signaler } from '@/lib/feedback';
import { ProchainGeste } from '@/components/ProchainGeste';
import { getItinerary } from '@/lib/itinerary';
import { EnTeteDesPropositions } from '@/components/EnTeteDesPropositions';
import { Ligne, ListeFantome } from '@/components/ui/Squelette';
import { Couverture } from '@/components/Couverture';

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const repository = getTripRepository();
  const voting = getVoting();
  const { identity } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: cleVoyage(id),
    queryFn: () => repository.get(id!),
    enabled: Boolean(id),
  });

  // Les propositions se recalculent toutes seules dès qu'un participant
  // rejoint ou renseigne ses envies, et les votes des autres apparaissent
  // sans rechargement.
  useGroupRealtime(id);

  const votes = useQuery({
    queryKey: ['votes', id],
    queryFn: () => voting.listTallies(id!, identity!.id),
    enabled: Boolean(id && identity),
  });

  const voter = useMutation({
    mutationFn: ({ destinationId, value }: { destinationId: string; value: VoteValue | null }) => {
      signaler('tape');
      return voting.cast(id!, destinationId, value);
    },
    // Le vote est un geste réflexe : on n'attend pas le serveur pour montrer
    // le résultat, et on se resynchronise juste après.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['votes', id] }),
  });

  const verrouiller = useMutation({
    mutationFn: (destinationId: string | null) =>
      destinationId ? voting.lockDestination(id!, destinationId) : voting.unlockDestination(id!),
    // Trancher la destination est le geste le plus engageant du parcours : il
    // mérite un retour qui se distingue d'un simple appui.
    onSuccess: () => {
      signaler('decision');
      return queryClient.invalidateQueries({ queryKey: ['trip'] });
    },
    onError: () => signaler('echec'),
  });

  const { proposals, prix, prixEnCours, normales } = useProposals(data);

  // Ce que « le prochain geste » a besoin de savoir, et que l'écran connaît
  // déjà : ce que j'ai fait, moi, par opposition à ce que le groupe a fait.
  const monProfil = data?.members.find((membre) => membre.userId === identity?.id);
  const jAiRepondu = monProfil ? hasAnswered(monProfil.weights) : false;
  const jAiVote = Object.values(votes.data?.tallies ?? {}).some((tally) => tally.mine !== null);

  const etatDuGroupe = data
    ? tripReadiness({
        constraints: data.constraints,
        members: data.members,
        votes: votes.data?.voters ?? 0,
        locked: Boolean(data.lockedDestinationId),
      })
    : null;

  // L'itinéraire n'est chargé que si la destination est arrêtée : avant, il
  // n'existe pas, et l'appel serait un aller-retour pour un tableau vide.
  const itineraire = useQuery({
    queryKey: ['itineraire', id],
    queryFn: () => getItinerary().load(id!),
    enabled: Boolean(id && data?.lockedDestinationId),
    staleTime: 5 * 60 * 1000,
  });
  const itineraireVide = (itineraire.data ?? []).every((jour) => jour.items.length === 0);

  const villeRetenue = data?.lockedDestinationId
    ? findDestination(data.lockedDestinationId)
    : undefined;

  /**
   * Les étapes choisies à la création, quand il y en a plusieurs.
   *
   * L'écran de création accepte d'enchaîner les villes ; jusqu'ici seule la
   * première survivait à l'enregistrement, et les suivantes disparaissaient
   * sans un mot. On les affiche maintenant toutes.
   */
  const etapes = useMemo(
    () =>
      (data?.shortlist ?? [])
        .map((identifiant) => findDestination(identifiant))
        .filter((entree): entree is NonNullable<typeof entree> => entree !== undefined),
    [data?.shortlist],
  );

  // Ce que les votes désignent, qui n'est pas forcément ce que le calcul
  // classe en tête — et c'est très bien : le calcul propose, le groupe dispose.
  const choix = useMemo(() => {
    if (!proposals || !votes.data) return null;
    return groupChoice(
      votes.data.tallies,
      proposals.scores.map((score) => score.destinationId),
    );
  }, [proposals, votes.data]);

  if (isLoading) {
    // Le voyage arrive dans cet ordre-là : un en-tête, un geste, la grille des
    // écrans, les propositions. Mettre l'écran en place tout de suite évite le
    // saut du vide au plein, et rend l'attente plus courte qu'elle ne l'est.
    return (
      <div className="mx-auto w-full max-w-2xl space-y-5 px-5 pt-4 pb-28">
        <div className="space-y-2.5">
          <Ligne className="h-6 w-3/5" />
          <Ligne className="h-2.5 w-2/5" />
        </div>
        <ListeFantome combien={3} lignes={2} />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5 pt-6">
      <Link
        to="/voyages"
        className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mes voyages
      </Link>

      {error && <Banner tone="warning">{toFailure(error).message}</Banner>}

      {!error && !data && (
        <Banner tone="warning" title="Voyage introuvable">
          Ce voyage n’existe plus, ou vous n’y avez pas accès.
        </Banner>
      )}

      {data && (
        <>
          {villeRetenue && <Couverture destination={villeRetenue} />}

          <header className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{data.summary.title}</h1>
            <p className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden />
                Départ de {data.constraints.origin.name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden />
                {data.members.length} / {data.constraints.participants}
              </span>
              <Link
                to={`/voyages/${data.summary.id}/modifier`}
                className="text-brand-600 dark:text-brand-300 inline-flex min-h-9 items-center gap-1.5 font-medium underline"
              >
                <Pencil className="size-3.5" aria-hidden />
                Modifier
              </Link>
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="size-3.5" aria-hidden />
                {data.constraints.budgetPerPersonCents
                  ? `${formatCents(data.constraints.budgetPerPersonCents, 'EUR', { hideCentimes: true })} max`
                  : 'le moins cher possible'}
              </span>
            </p>
            {describePeriod(data.constraints) !== data.summary.title && (
              <p className="text-muted text-sm">{describePeriod(data.constraints)}</p>
            )}
          </header>

          <ProchainGeste
            tripId={data.summary.id}
            readiness={etatDuGroupe!}
            jAiRepondu={jAiRepondu}
            jAiVote={jAiVote}
            jeSuisOrganisateur={data.isOwner}
            destinationArretee={Boolean(data.lockedDestinationId)}
            itineraireVide={itineraireVide}
            collaborationPossible={Boolean(getCollaboration())}
            propositions={proposals?.scores.length ?? 0}
          />

          <OuEnEstLeGroupe
            constraints={data.constraints}
            members={data.members}
            votes={votes.data?.voters ?? 0}
            locked={Boolean(data.lockedDestinationId)}
          />

          {proposals && proposals.scores.length === 0 && (
            <Banner tone="warning" title="Aucune destination ne colle">
              Essayez d’élargir le budget, la période ou la durée. Avec très peu de temps
              et très peu de budget, il ne reste parfois rien d’honnête à proposer.
            </Banner>
          )}

          <OutilsDuVoyage
            tripId={data.summary.id}
            destinationVerrouillee={Boolean(data.lockedDestinationId)}
            collaborationActive={Boolean(getCollaboration())}
            attente={decrireAttente(data.members.length, data.constraints.participants)}
            destinationConnue={Boolean(villeRetenue)}
          />

          {data.lockedDestinationId && (
            <Banner tone="info" title="Destination retenue">
              {etapes.length > 1 ? (
                <>
                  Le voyage passe par{' '}
                  <strong>{etapes.map((etape) => etape.name).join(', ')}</strong>. L’itinéraire
                  et la carte se construiront autour de ces étapes.
                </>
              ) : (
                <>
                  Le groupe part à{' '}
                  <strong>
                    {findDestination(data.lockedDestinationId)?.name ?? data.lockedDestinationId}
                  </strong>
                  . L’itinéraire et la carte se construiront autour d’elle.
                </>
              )}
              {/* Rouvrir n'a de sens que là où il y a eu un vote : un voyage
                  dont la destination a été choisie à la création n'en a jamais
                  eu, et le bouton proposerait d'annuler ce choix sans rien
                  offrir à la place. */}
              {data.isOwner && data.destinationMode === 'suggest' && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => verrouiller.mutate(null)}
                    className="underline"
                  >
                    Rouvrir le vote
                  </button>
                </>
              )}
            </Banner>
          )}

          {villeRetenue && (
            <MeteoPrevue constraints={data.constraints} destination={villeRetenue} />
          )}

          {villeRetenue && (
            <Reserver constraints={data.constraints} destination={villeRetenue} />
          )}

          {villeRetenue && id && <ApplicationsUtiles tripId={id} destination={villeRetenue} />}

          {proposals && proposals.scores.length > 0 && (
            <Assistant
              constraints={data.constraints}
              members={data.members}
              scores={proposals.scores}
              {...(villeRetenue ? { lockedName: villeRetenue.name } : {})}
            />
          )}

          {proposals && proposals.scores.length > 0 && (
            <>
              <EnTeteDesPropositions
                combien={proposals.scores.length}
                membresPresents={data.members.length}
                membresAttendus={data.constraints.participants}
                prixEstimes={!prixEnCours && proposals.allEstimated}
                sourceConfiguree={Boolean(prix?.configured)}
              />

              {prixEnCours && (
                <Banner tone="info" title="Prix en cours de relevé">
                  Le classement s’affiche avec les estimations, et se corrigera dès que les
                  prix réels seront arrivés.
                </Banner>
              )}

              {prix?.quotaExceeded && (
                <Banner tone="warning" title="Limite gratuite atteinte pour aujourd’hui">
                  Les prix relevés reviendront demain. Tout le reste de Tripora fonctionne,
                  et les montants affichés restent des estimations honnêtes.
                </Banner>
              )}

              <ul className="animate-cascade space-y-3">
                {proposals.scores.map((score, index) => {
                  const destination = findDestination(score.destinationId);
                  if (!destination) return null;
                  return (
                    <li key={score.destinationId}>
                      <ProposalCard
                        rank={index + 1}
                        destination={destination}
                        score={score}
                        normalesAnnee={normales[score.destinationId]}
                        verrouillee={data.lockedDestinationId === score.destinationId}
                        choixDuGroupe={choix?.destinationId === score.destinationId}
                        transport={estimateTransportOptions(
                          data.constraints.origin,
                          destination,
                          data.constraints.participants,
                        )}
                        month={targetMonth(data.constraints)}
                        participants={data.constraints.participants}
                        membres={data.members}
                        depart={data.constraints.origin}
                        prixReleve={prix?.parDestination[score.destinationId]}
                        vote={
                          !data.lockedDestinationId ? (
                            <VoteBar
                              tally={votes.data?.tallies[score.destinationId]}
                              participants={Math.max(
                                data.members.length,
                                data.constraints.participants,
                              )}
                              disabled={voter.isPending}
                              onVote={(value) =>
                                voter.mutate({ destinationId: score.destinationId, value })
                              }
                            />
                          ) : undefined
                        }
                      />
                    </li>
                  );
                })}
              </ul>

              {!data.lockedDestinationId && (
                <Card id="trancher" className="scroll-mt-4">
                  <CardBody className="space-y-3">
                    <p className="font-semibold">Trancher</p>
                    {choix ? (
                      <p className="text-muted text-sm leading-relaxed">
                        Les votes désignent{' '}
                        <strong>{findDestination(choix.destinationId)?.name}</strong>, avec{' '}
                        {choix.supporters} personne{choix.supporters > 1 ? 's' : ''} pour.
                        {choix.destinationId !== proposals.scores[0]?.destinationId && (
                          <>
                            {' '}Le calcul, lui, plaçait{' '}
                            {findDestination(proposals.scores[0]!.destinationId)?.name} en tête :
                            c’est le groupe qui décide.
                          </>
                        )}
                      </p>
                    ) : (
                      <p className="text-muted text-sm leading-relaxed">
                        Personne n’a encore voté. Chacun peut aimer, mettre en préféré ou
                        écarter une destination — recliquer sur son choix le retire.
                      </p>
                    )}

                    {data.isOwner ? (
                      <Button
                        block
                        disabled={!choix}
                        loading={verrouiller.isPending}
                        icon={<Lock className="size-4" aria-hidden />}
                        onClick={() => choix && verrouiller.mutate(choix.destinationId)}
                      >
                        {choix
                          ? `Partir à ${findDestination(choix.destinationId)?.name}`
                          : 'En attente des votes'}
                      </Button>
                    ) : (
                      <p className="text-muted flex items-center gap-1.5 text-xs">
                        <LockOpen className="size-3.5" aria-hidden />
                        Seul l’organisateur peut arrêter la destination.
                      </p>
                    )}
                  </CardBody>
                </Card>
              )}

              <Card>
                <CardBody className="space-y-2">
                  <p className="font-semibold">Et ensuite ?</p>
                  <p className="text-muted text-sm leading-relaxed">
                    Les prochaines étapes : l’itinéraire jour par jour de la destination
                    retenue, la carte, puis les dépenses pendant le voyage.
                  </p>
                  <Link to="/voyages">
                    <Button variant="secondary" block>
                      Revenir à mes voyages
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}

function describePeriod(constraints: {
  dateMode: string;
  month?: number;
  startDate?: string;
  windowStart?: string;
  windowEnd?: string;
  durationDays: number;
}): string {
  const duree = `${constraints.durationDays} jour${constraints.durationDays > 1 ? 's' : ''}`;
  if (constraints.dateMode === 'month' && constraints.month) {
    return `${duree} en ${MONTHS_FR[constraints.month - 1]}`;
  }
  if (constraints.dateMode === 'exact' && constraints.startDate) {
    return `${duree} à partir du ${new Date(constraints.startDate).toLocaleDateString('fr-FR')}`;
  }
  if (constraints.dateMode === 'window' && constraints.windowStart && constraints.windowEnd) {
    const from = new Date(constraints.windowStart).toLocaleDateString('fr-FR');
    const to = new Date(constraints.windowEnd).toLocaleDateString('fr-FR');
    return `${duree} entre le ${from} et le ${to}`;
  }
  return `${duree}, dates souples`;
}

/** Phrase d'état du groupe, affichée sous le raccourci vers les participants. */
function decrireAttente(presents: number, attendus: number): string {
  if (presents >= attendus) {
    return `${presents} participant${presents > 1 ? 's' : ''} · tout le monde est là`;
  }
  const manquants = attendus - presents;
  return `${presents} sur ${attendus} · il manque ${manquants} personne${manquants > 1 ? 's' : ''}`;
}
