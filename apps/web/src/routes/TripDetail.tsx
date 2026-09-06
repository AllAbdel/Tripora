import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, MapPin, UserPlus, Users, Wallet } from 'lucide-react';
import {
  buildProposals,
  estimateTransportOptions,
  findDestination,
  formatCents,
  MONTHS_FR,
} from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProposalCard } from '@/components/ProposalCard';
import { getTripRepository } from '@/lib/trips';
import { getCollaboration } from '@/lib/collaboration';
import { useGroupRealtime } from '@/lib/useGroupRealtime';
import { toFailure } from '@/lib/errors';

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const repository = getTripRepository();

  const { data, isLoading, error } = useQuery({
    queryKey: ['trip', repository.kind, id],
    queryFn: () => repository.get(id!),
    enabled: Boolean(id),
  });

  // Les propositions se recalculent toutes seules dès qu'un participant
  // rejoint ou renseigne ses envies.
  useGroupRealtime(id);

  /**
   * Les propositions sont recalculées depuis les contraintes enregistrées.
   * Le calcul est déterministe et tient en quelques millisecondes : rien à
   * mettre en cache, rien à synchroniser, et surtout aucun quota consommé.
   */
  const proposals = useMemo(() => {
    if (!data) return null;
    return buildProposals(data.constraints, data.members, { keep: 6 });
  }, [data]);

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

              {proposals.allEstimated && (
                <Banner tone="info" title="Prix indicatifs">
                  Aucune source de tarifs n’est reliée pour l’instant : les montants sont des
                  estimations, jamais des prix constatés. Les vrais prix apparaîtront avec
                  leur date dès qu’un jeton Travelpayouts sera renseigné.
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
                        transport={estimateTransportOptions(
                          data.constraints.origin,
                          destination,
                          data.constraints.participants,
                        )}
                      />
                    </li>
                  );
                })}
              </ul>

              <Card>
                <CardBody className="space-y-2">
                  <p className="font-semibold">Et ensuite ?</p>
                  <p className="text-muted text-sm leading-relaxed">
                    Les prochaines étapes : voter sur ces destinations pour trancher, puis
                    obtenir l’itinéraire et la carte de celle qui l’emporte.
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
