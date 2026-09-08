import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react';
import { MONTHS_FR, formatCents, parseAmountToCents } from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Field, TextInput } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { ListeFantome } from '@/components/ui/Squelette';
import { cleVoyage, getTripRepository, type ModificationVoyage, type TripDetails } from '@/lib/trips';
import { signaler } from '@/lib/feedback';
import { toFailure } from '@/lib/errors';

/**
 * Corriger un voyage après sa création.
 *
 * C'était le manque le plus gênant à l'usage : tout se décidait à l'assistant
 * de création et rien ne se reprenait ensuite. Or un voyage entre amis se
 * décide justement en plusieurs fois — on cale un mois, puis quelqu'un ne peut
 * plus, puis on rallonge d'un jour.
 *
 * Deux choses ne se modifient pas ici, et c'est délibéré. La **destination**
 * est la décision du groupe : elle se rouvre depuis l'écran du voyage, avec un
 * vote. Et le **nombre de participants** ne descend pas en dessous du nombre
 * de personnes déjà présentes — le réduire ferait mentir tous les calculs
 * d'équité et de budget sans que personne ne s'en aperçoive.
 */
interface Formulaire {
  titre: string;
  jours: number;
  participants: number;
  /** En euros, tel que saisi. Vide = pas de plafond. */
  budget: string;
  mois: number | null;
}

/** Les valeurs telles qu'elles sont enregistrées aujourd'hui. */
function depuisLeVoyage(data: NonNullable<TripDetails>): Formulaire {
  return {
    titre: data.summary.title,
    jours: data.constraints.durationDays,
    participants: data.constraints.participants,
    budget: data.constraints.budgetPerPersonCents
      ? String(Math.round(data.constraints.budgetPerPersonCents / 100))
      : '',
    mois: data.constraints.month ?? null,
  };
}

export default function TripEdit() {
  const { id } = useParams<{ id: string }>();
  const repo = getTripRepository();
  const queryClient = useQueryClient();
  const naviguer = useNavigate();

  const voyage = useQuery({
    queryKey: cleVoyage(id),
    queryFn: () => repo.get(id!),
    enabled: Boolean(id),
  });

  /**
   * Le formulaire tant qu'on n'y a pas touché : `null`.
   *
   * Les valeurs affichées se dérivent alors du voyage chargé, et la saisie ne
   * prend le relais qu'à la première modification. Pas d'effet, donc pas de
   * risque qu'une réponse du serveur arrivée entre-temps efface ce qu'on est
   * en train d'écrire — c'est exactement le piège qu'un `useEffect`
   * d'initialisation tend.
   */
  const [saisie, setSaisie] = useState<Formulaire | null>(null);
  const valeurs = saisie ?? (voyage.data ? depuisLeVoyage(voyage.data) : null);
  const modifier = (champ: Partial<Formulaire>) => {
    if (valeurs) setSaisie({ ...valeurs, ...champ });
  };

  const enregistrer = useMutation({
    mutationFn: (valeurs: ModificationVoyage) => repo.update(id!, valeurs),
    onSuccess: async () => {
      signaler('reussite');
      await queryClient.invalidateQueries({ queryKey: cleVoyage(id) });
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
      naviguer(`/voyages/${id}`);
    },
    onError: () => signaler('echec'),
  });

  const data = voyage.data;
  const presents = data?.members.length ?? 1;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pt-4 pb-28">
      <div className="flex items-center gap-2">
        <Link
          to={`/voyages/${id}`}
          aria-label="Retour au voyage"
          className="hover:bg-brand-50 dark:hover:bg-ink-700/40 -ml-2 grid size-11 place-items-center rounded-full"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-lg font-semibold">Modifier le voyage</h1>
      </div>

      {voyage.isPending && <ListeFantome combien={2} />}

      {data && (
        <>
          <Card>
            <CardBody className="space-y-4">
              <Field label="Titre">
                <TextInput
                  value={valeurs?.titre ?? ''}
                  onChange={(evenement) => modifier({ titre: evenement.target.value })}
                  maxLength={80}
                />
              </Field>

              <NumberStepper
                value={valeurs?.jours ?? 4}
                onChange={(jours) => modifier({ jours })}
                min={1}
                max={90}
                label="Durée du séjour"
                suffix={(valeurs?.jours ?? 0) > 1 ? 'jours' : 'jour'}
              />

              <NumberStepper
                value={valeurs?.participants ?? 1}
                onChange={(participants) => modifier({ participants })}
                min={presents}
                max={30}
                label="Participants"
              />
              {presents > 1 && (
                <p className="text-muted -mt-2 px-1 text-xs leading-relaxed">
                  {presents} personne{presents > 1 ? 's ont' : ' a'} déjà rejoint : le nombre ne
                  peut pas descendre en dessous, sinon les budgets et l’équité du classement se
                  calculeraient sur un groupe qui n’existe pas.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <p className="text-sm font-semibold">Quand ?</p>
              <div className="flex flex-wrap gap-2">
                {MONTHS_FR.map((nom, index) => (
                  <Chip
                    key={nom}
                    selected={valeurs?.mois === index + 1}
                    onClick={() => modifier({ mois: valeurs?.mois === index + 1 ? null : index + 1 })}
                  >
                    {nom}
                  </Chip>
                ))}
              </div>
              <p className="text-muted text-xs leading-relaxed">
                Changer de mois recalcule le climat, les prix et le classement. Les dates précises
                se règlent depuis l’assistant de création ; ici on ajuste la période visée.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <MoneyInput
                label="Budget maximum par personne"
                value={valeurs?.budget ?? ''}
                onChange={(budget) => modifier({ budget })}
                placeholder="500"
                entier
              />
              <p className="text-muted text-xs leading-relaxed">
                {data.constraints.budgetPerPersonCents
                  ? `Actuellement ${formatCents(data.constraints.budgetPerPersonCents, 'EUR', { hideCentimes: true })}.`
                  : 'Aucun plafond pour l’instant : Tripora cherche le moins cher.'}{' '}
                Laissez vide pour ne pas en fixer.
              </p>
            </CardBody>
          </Card>

          {enregistrer.isError && (
            <Banner tone="warning" title="Modification non enregistrée">
              {toFailure(enregistrer.error).message}
            </Banner>
          )}

          <Button
            block
            loading={enregistrer.isPending}
            disabled={(valeurs?.titre ?? '').trim().length < 2}
            icon={<Check className="size-4" aria-hidden />}
            onClick={() =>
              valeurs &&
              enregistrer.mutate({
                title: valeurs.titre.trim(),
                durationDays: valeurs.jours,
                participants: valeurs.participants,
                budgetPerPersonCents: valeurs.budget.trim()
                  ? parseAmountToCents(valeurs.budget)
                  : null,
                ...(valeurs.mois === null
                  ? {}
                  : { dateMode: 'month' as const, month: valeurs.mois }),
              })
            }
          >
            Enregistrer
          </Button>
        </>
      )}
    </div>
  );
}
