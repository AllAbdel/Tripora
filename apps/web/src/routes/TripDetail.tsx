import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Loader2, Lock, LockOpen, Map as MapIcon, MapPin, UserPlus, Users, Wallet } from 'lucide-react';
import {
  estimateTransportOptions,
  findDestination,
  formatCents,
  MONTHS_FR,
  targetMonth,
} from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProposalCard } from '@/components/ProposalCard';
import { getTripRepository } from '@/lib/trips';
import { getCollaboration } from '@/lib/collaboration';
import { getVoting, groupChoice, type VoteValue } from '@/lib/votes';
import { useProposals } from '@/lib/useProposals';
import { useGroupRealtime } from '@/lib/useGroupRealtime';
import { useAuth } from '@/lib/auth-context';
import { VoteBar } from '@/components/VoteBar';
import { Reserver } from '@/components/Reserver';
import { MeteoPrevue } from '@/components/MeteoPrevue';
import { OuEnEstLeGroupe } from '@/components/OuEnEstLeGroupe';
import { Assistant } from '@/components/Assistant';
import { toFailure } from '@/lib/errors';

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const repository = getTripRepository();
  const voting = getVoting();
  const { identity } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['trip', repository.kind, id],
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
    mutationFn: ({ destinationId, value }: { destinationId: string; value: VoteValue | null }) =>
      voting.cast(id!, destinationId, value),
    // Le vote est un geste réflexe : on n'attend pas le serveur pour montrer
    // le résultat, et on se resynchronise juste après.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['votes', id] }),
  });

  const verrouiller = useMutation({
    mutationFn: (destinationId: string | null) =>
      destinationId ? voting.lockDestination(id!, destinationId) : voting.unlockDestination(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip'] }),
  });

  const { proposals, prix, prixEnCours } = useProposals(data);

  const villeRetenue = data?.lockedDestinationId
    ? findDestination(data.lockedDestinationId)
    : undefined;

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
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="text-brand-500 size-6 animate-spin" aria-label="Chargement" />
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

          <OuEnEstLeGroupe
            constraints={data.constraints}
            members={data.members}
            votes={votes.data?.voters ?? 0}
            locked={Boolean(data.lockedDestinationId)}
          />

          {getCollaboration() && (
            <Link to={`/voyages/${data.summary.id}/participants`} className="block">
              <Card className="transition-transform active:scale-[0.99]">
                <CardBody className="flex items-center gap-3 p-4">
                  <UserPlus className="text-brand-500 size-5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {data.members.length < data.constraints.participants
                        ? 'Inviter le reste du groupe'
                        : 'Participants et envies'}
                    </span>
                    <span className="text-muted block text-sm">
                      {decrireAttente(data.members.length, data.constraints.participants)}
                    </span>
                  </span>
                  <span className="text-muted shrink-0" aria-hidden>›</span>
                </CardBody>
              </Card>
            </Link>
          )}

          {proposals && proposals.scores.length === 0 && (
            <Banner tone="warning" title="Aucune destination ne colle">
              Essayez d’élargir le budget, la période ou la durée. Avec très peu de temps
              et très peu de budget, il ne reste parfois rien d’honnête à proposer.
            </Banner>
          )}

          {data.lockedDestinationId && (
            <Link to={`/voyages/${data.summary.id}/itineraire`} className="block">
              <Card className="border-lagoon-500 transition-transform active:scale-[0.99]">
                <CardBody className="flex items-center gap-3 p-4">
                  <CalendarDays className="text-lagoon-500 size-5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">L’itinéraire jour par jour</span>
                    <span className="text-muted block text-sm">
                      La structure du séjour, à remplir de vraies adresses
                    </span>
                  </span>
                  <span className="text-muted shrink-0" aria-hidden>›</span>
                </CardBody>
              </Card>
            </Link>
          )}

          <Link to={`/voyages/${data.summary.id}/budget`} className="block">
            <Card className="transition-transform active:scale-[0.99]">
              <CardBody className="flex items-center gap-3 p-4">
                <Wallet className="text-brand-500 size-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Dépenses</span>
                  <span className="text-muted block text-sm">
                    Qui a avancé quoi, et qui doit combien à qui
                  </span>
                </span>
                <span className="text-muted shrink-0" aria-hidden>›</span>
              </CardBody>
            </Card>
          </Link>

          <Link to={`/voyages/${data.summary.id}/carte`} className="block">
            <Card className="transition-transform active:scale-[0.99]">
              <CardBody className="flex items-center gap-3 p-4">
                <MapIcon className="text-brand-500 size-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">Voir sur la carte</span>
                  <span className="text-muted block text-sm">
                    {data.lockedDestinationId
                      ? 'Le trajet depuis ' + data.constraints.origin.name
                      : 'Où sont les destinations en lice'}
                  </span>
                </span>
                <span className="text-muted shrink-0" aria-hidden>›</span>
              </CardBody>
            </Card>
          </Link>

          {data.lockedDestinationId && (
            <Banner tone="info" title="Destination retenue">
              Le groupe part à{' '}
              <strong>
                {findDestination(data.lockedDestinationId)?.name ?? data.lockedDestinationId}
              </strong>
              . L’itinéraire et la carte se construiront autour d’elle.
              {data.isOwner && (
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
              <Card>
                <CardBody className="space-y-1.5">
                  <p className="font-semibold">
                    {proposals.scores.length} destinations pour votre groupe
                  </p>
                  <p className="text-muted text-sm leading-relaxed">
                    Classées sur le coût <strong>total</strong> du voyage et sur les envies
                    de chacun, pas seulement sur le prix du billet. Chaque note est détaillée :
                    aucune n’est décidée par une intelligence artificielle.
                  </p>
                  {data.members.length < data.constraints.participants && (
                    <p className="text-muted text-sm leading-relaxed">
                      Pour l’instant, seules les envies de {data.members.length} personne
                      {data.members.length > 1 ? 's' : ''} sur {data.constraints.participants}{' '}
                      sont prises en compte. Le classement changera quand les autres auront
                      répondu.
                    </p>
                  )}
                </CardBody>
              </Card>

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

              {!prixEnCours && proposals.allEstimated && (
                <Banner tone="info" title="Prix indicatifs">
                  {prix?.configured
                    ? 'Aucun tarif relevé pour ce départ et cette période : les montants sont des estimations, jamais des prix constatés.'
                    : 'Aucune source de tarifs n’est reliée : les montants sont des estimations. Les vrais prix apparaîtront avec leur date dès qu’un jeton Travelpayouts sera renseigné côté serveur.'}
                </Banner>
              )}

              <ul className="space-y-3">
                {proposals.scores.map((score, index) => {
                  const destination = findDestination(score.destinationId);
                  if (!destination) return null;
                  return (
                    <li key={score.destinationId}>
                      <ProposalCard
                        rank={index + 1}
                        destination={destination}
                        score={score}
                        verrouillee={data.lockedDestinationId === score.destinationId}
                        choixDuGroupe={choix?.destinationId === score.destinationId}
                        transport={estimateTransportOptions(
                          data.constraints.origin,
                          destination,
                          data.constraints.participants,
                        )}
                        month={targetMonth(data.constraints)}
                        participants={data.constraints.participants}
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
                <Card>
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
