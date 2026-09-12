import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  computeBalances, currencyForCountry, currencyName, describeRate, DESTINATIONS,
  findDestination, formatCents, isConvertible, parseAmountToCents, referenceRate,
  simplifyDebts, toReferenceCents, totalSpent, type FxRates,
} from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Field, TextInput } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { getTripRepository } from '@/lib/trips';
import { getCollaboration } from '@/lib/collaboration';
import { getExpenses, CATEGORIES, type ExpenseCategory } from '@/lib/expenses';
import { chargerTaux, CLE_TAUX, devisesProposees } from '@/lib/fx';
import { useAuth } from '@/lib/auth-context';
import { toFailure } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { Icone } from '@/components/Icone';
import { PrevuEtReel } from '@/components/PrevuEtReel';
import { useProposals } from '@/lib/useProposals';

export default function TripBudget() {
  const { id } = useParams<{ id: string }>();
  const repository = getTripRepository();
  const collaboration = getCollaboration();
  const depenses = getExpenses();
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const [enSaisie, setEnSaisie] = useState(false);

  const voyage = useQuery({
    queryKey: ['trip', repository.kind, id],
    queryFn: () => repository.get(id!),
    enabled: Boolean(id),
  });

  const membres = useQuery({
    queryKey: ['membres', id],
    queryFn: () => collaboration!.listMembers(id!),
    enabled: Boolean(id && collaboration),
  });

  const liste = useQuery({
    queryKey: ['depenses', id],
    queryFn: () => depenses.list(id!),
    enabled: Boolean(id),
  });

  // Les taux sont les mêmes pour tout le monde et changent une fois par jour
  // ouvré : une seule requête, partagée entre les écrans et gardée par le
  // cache persistant, donc encore là au retour d'une zone sans réseau.
  const taux = useQuery({
    queryKey: CLE_TAUX,
    queryFn: chargerTaux,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
  });

  /** Noms affichables, avec repli sur le mode local où il n'y a qu'une personne. */
  const noms = useMemo(() => {
    const table = new Map<string, string>();
    for (const membre of membres.data ?? []) table.set(membre.userId, membre.displayName);
    if (table.size === 0) table.set(identity?.id ?? 'moi', identity?.displayName ?? 'Vous');
    return table;
  }, [membres.data, identity]);

  // Les prix relevés viennent du même endroit que sur l'écran du voyage : la
  // requête est partagée par le cache, et ne coûte donc rien de plus ici.
  const { prix } = useProposals(voyage.data);

  const participants = useMemo(() => [...noms.keys()], [noms]);

  /**
   * Combien de personnes partagent la note.
   *
   * Le nombre de membres inscrits, ou à défaut celui annoncé à la création :
   * tant que le groupe n'a pas rejoint, c'est le seul chiffre honnête pour
   * rapporter une dépense à un budget prévu.
   */
  const combien = Math.max(participants.length, voyage.data?.constraints.participants ?? 1);

  const villeRetenue = voyage.data?.lockedDestinationId
    ? findDestination(voyage.data.lockedDestinationId)
    : undefined;

  const prixDuVol = prix?.parDestination[voyage.data?.lockedDestinationId ?? ''];

  /** La devise du pays où l'on va : c'est celle qu'on proposera par défaut. */
  const deviseLocale = useMemo(() => {
    const destination = DESTINATIONS.find(
      (lieu) => lieu.id === voyage.data?.lockedDestinationId,
    );
    return destination ? currencyForCountry(destination.countryCode) : undefined;
  }, [voyage.data?.lockedDestinationId]);

  const comptes = useMemo(() => {
    const entrees = liste.data ?? [];
    if (entrees.length === 0) return null;
    const soldes = computeBalances(entrees, participants);
    try {
      return { soldes, virements: simplifyDebts(soldes), total: totalSpent(entrees) };
    } catch {
      // Soldes déséquilibrés : une part fait référence à quelqu'un qui n'est
      // plus dans le voyage. On montre les totaux sans inventer de virement.
      return { soldes, virements: null, total: totalSpent(entrees) };
    }
  }, [liste.data, participants]);

  const ajouter = useMutation({
    mutationFn: (entree: Parameters<typeof depenses.add>[1]) => depenses.add(id!, entree),
    onSuccess: () => {
      setEnSaisie(false);
      return queryClient.invalidateQueries({ queryKey: ['depenses', id] });
    },
  });

  const supprimer = useMutation({
    mutationFn: (expenseId: string) => depenses.remove(expenseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['depenses', id] }),
  });

  if (voyage.isLoading || liste.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="text-brand-500 size-6 animate-spin" aria-label="Chargement" />
      </div>
    );
  }

  if (!voyage.data) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <Retour id={id} />
        <Banner tone="warning">Ce voyage n’existe plus, ou vous n’y avez pas accès.</Banner>
      </div>
    );
  }

  const entrees = liste.data ?? [];

  return (
    <div className="space-y-4 px-5 pt-6">
      <Retour id={id} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Budget</h1>
        <p className="text-muted text-sm">
          {voyage.data.summary.title}
          {villeRetenue ? ` · ${villeRetenue.name}` : ''} · {voyage.data.constraints.durationDays}{' '}
          jour{voyage.data.constraints.durationDays > 1 ? 's' : ''} à {combien} personne
          {combien > 1 ? 's' : ''}
        </p>
      </div>

      <PrevuEtReel
        constraints={voyage.data.constraints}
        destination={villeRetenue}
        prixDuVol={prixDuVol}
        depenseCents={comptes?.total ?? 0}
        participants={combien}
      />

      {(ajouter.error || liste.error) && (
        <Banner tone="warning" title="Un problème est survenu">
          {toFailure(ajouter.error ?? liste.error).message}
        </Banner>
      )}

      {/* Seul, il n'y a personne à qui devoir quoi que ce soit : la carte
          n'aurait qu'une ligne, et elle dirait « à jour ». */}
      {comptes && participants.length > 1 && (
        <Card>
          <CardBody className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Où en est chacun</p>
              <ul className="space-y-1 text-sm">
                {comptes.soldes.map((solde) => (
                  <li key={solde.userId} className="flex justify-between gap-4">
                    <span className="truncate">{noms.get(solde.userId) ?? 'Ancien membre'}</span>
                    <span
                      className={cn(
                        'shrink-0 tabular-nums',
                        solde.cents > 0 && 'text-lagoon-700 dark:text-lagoon-300',
                        solde.cents < 0 && 'text-gold-700 dark:text-gold-300',
                        solde.cents === 0 && 'text-muted',
                      )}
                    >
                      {solde.cents === 0
                        ? 'à jour'
                        : solde.cents > 0
                          ? `+${formatCents(solde.cents)}`
                          : formatCents(solde.cents)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardBody>
        </Card>
      )}

      {comptes?.virements && comptes.virements.length > 0 && (
        <Card className="border-lagoon-500">
          <CardBody className="space-y-3">
            <div>
              <p className="font-semibold">Pour tout remettre à zéro</p>
              <p className="text-muted text-sm">
                {comptes.virements.length} virement{comptes.virements.length > 1 ? 's' : ''}{' '}
                suffi{comptes.virements.length > 1 ? 'sent' : 't'}, au lieu que chacun rembourse
                chacun.
              </p>
            </div>
            <ul className="space-y-2">
              {comptes.virements.map((virement, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 rounded-xl bg-[color:var(--surface-muted)] p-3 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {noms.get(virement.from) ?? 'Quelqu’un'}
                  </span>
                  <ArrowRight className="text-muted size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {noms.get(virement.to) ?? 'Quelqu’un'}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">
                    {formatCents(virement.cents)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {comptes && !comptes.virements && (
        <Banner tone="warning" title="Comptes impossibles à solder">
          Une dépense fait référence à quelqu’un qui n’est plus dans le voyage. Les totaux
          restent justes, mais les remboursements ne peuvent pas être calculés.
        </Banner>
      )}

      {enSaisie ? (
        <Formulaire
          participants={participants}
          noms={noms}
          moi={identity?.id ?? participants[0] ?? 'moi'}
          taux={taux.data?.statut === 'ok' ? taux.data.taux : null}
          deviseLocale={deviseLocale}
          enCours={ajouter.isPending}
          onAnnuler={() => setEnSaisie(false)}
          onValider={(valeurs) => ajouter.mutate(valeurs)}
        />
      ) : (
        <Button
          block
          size="lg"
          icon={<Plus className="size-5" aria-hidden />}
          onClick={() => setEnSaisie(true)}
        >
          Ajouter une dépense
        </Button>
      )}

      {entrees.length === 0 && !enSaisie && (
        <p className="text-muted px-2 py-6 text-center text-sm leading-relaxed">
          Rien de noté pour l’instant. Ajoutez ce que chacun avance pendant le voyage :
          Tripora calcule qui doit combien à qui, et réduit les remboursements au minimum.
        </p>
      )}

      {entrees.length > 0 && (
        <ul className="space-y-2">
          {entrees.map((entree) => {
            const categorie = CATEGORIES.find((c) => c.value === entree.category);
            return (
              <li key={entree.id}>
                <Card>
                  <CardBody className="flex items-center gap-3 p-3.5">
                    <span
                      aria-hidden
                      className="bg-brand-50 text-brand-600 dark:bg-brand-900/50 dark:text-brand-300 grid size-9 shrink-0 place-items-center rounded-xl"
                    >
                      <Icone nom={categorie?.icone ?? 'divers'} className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{entree.label}</p>
                      <p className="text-muted text-sm">
                        {noms.get(entree.paidBy) ?? 'Quelqu’un'} ·{' '}
                        {new Date(`${entree.spentOn}T00:00:00`).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                        })}
                        {entree.shares.length > 1 && ` · partagé à ${entree.shares.length}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-right font-bold tabular-nums">
                      {formatCents(entree.amountCents)}
                      {/* Payé dans une autre monnaie : on montre la somme
                          reconnaissable, celle qui est sur le ticket. */}
                      {entree.currency !== 'EUR' && (
                        <span className="text-muted block text-xs font-medium">
                          {formatCents(entree.originalCents, entree.currency)}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      aria-label={`Supprimer ${entree.label}`}
                      onClick={() => supprimer.mutate(entree.id)}
                      className="text-muted hover:text-brand-500 grid size-9 shrink-0 place-items-center rounded-lg"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Formulaire({
  participants,
  noms,
  moi,
  taux,
  deviseLocale,
  enCours,
  onAnnuler,
  onValider,
}: {
  participants: string[];
  noms: Map<string, string>;
  moi: string;
  taux: FxRates | null;
  deviseLocale: string | undefined;
  enCours: boolean;
  onAnnuler: () => void;
  onValider: (valeurs: {
    label: string;
    originalCents: number;
    amountCents: number;
    currency: string;
    fxRate: number;
    paidBy: string;
    category: ExpenseCategory;
    spentOn: string;
    sharedWith: string[];
  }) => void;
}) {
  const [label, setLabel] = useState('');
  const [montant, setMontant] = useState('');
  const [paidBy, setPaidBy] = useState(moi);
  const [categorie, setCategorie] = useState<ExpenseCategory>('food');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [partage, setPartage] = useState<string[]>(participants);

  // Sur place, on paie en monnaie locale : c'est elle qu'on présente d'abord,
  // à condition que la BCE la publie et qu'on ait les taux du jour.
  const devisesOffertes = useMemo(() => devisesProposees(taux, deviseLocale), [taux, deviseLocale]);

  // Tant que personne n'a choisi, on suit la liste : si les taux arrivent
  // après l'ouverture du formulaire, la monnaie locale prend la tête toute
  // seule. Dès qu'on choisit, le choix tient.
  const [choix, setChoix] = useState<string | null>(null);
  const devise = choix ?? devisesOffertes[0]?.code ?? 'EUR';

  const parEuro = devise === 'EUR' ? 1 : (taux?.rates[devise] ?? null);
  const saisi = parseAmountToCents(montant || '0');
  const enEuros = parEuro === null ? null : toReferenceCents(saisi, parEuro);

  const valide =
    label.trim().length > 0 && saisi > 0 && partage.length > 0 && enEuros !== null && enEuros > 0;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Nouvelle dépense</p>
          <button
            type="button"
            aria-label="Annuler"
            onClick={onAnnuler}
            className="text-muted hover:text-brand-500 grid size-9 place-items-center rounded-lg"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <Field label="Quoi ?">
          <TextInput
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Dîner au marché"
            aria-label="Intitulé de la dépense"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Combien ?">
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <MoneyInput
                  label="Montant"
                  placeholder="48,50"
                  value={montant}
                  onChange={setMontant}
                />
              </div>
              {devisesOffertes.length > 1 && (
                <select
                  value={devise}
                  onChange={(event) => setChoix(event.target.value)}
                  aria-label="Devise"
                  className="focus:border-brand-500 min-h-11 shrink-0 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-2 text-sm font-semibold outline-none"
                >
                  {devisesOffertes.map((entree) => (
                    <option key={entree.code} value={entree.code}>
                      {entree.code}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Field>
          <Field label="Quand ?">
            <TextInput
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              aria-label="Date de la dépense"
            />
          </Field>
        </div>

        <Conversion
          devise={devise}
          parEuro={parEuro}
          enEuros={saisi > 0 ? enEuros : null}
          date={taux?.date}
          deviseLocale={deviseLocale}
        />

        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Catégorie</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((entree) => (
              <Chip
                key={entree.value}
                selected={categorie === entree.value}
                onClick={() => setCategorie(entree.value)}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icone nom={entree.icone} className="size-3.5" />
                  {entree.label}
                </span>
              </Chip>
            ))}
          </div>
        </div>

        {participants.length > 1 && (
          <>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Qui a payé ?</p>
              <div className="flex flex-wrap gap-2">
                {participants.map((userId) => (
                  <Chip key={userId} selected={paidBy === userId} onClick={() => setPaidBy(userId)}>
                    {noms.get(userId)}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Partagé entre</p>
              <div className="flex flex-wrap gap-2">
                {participants.map((userId) => (
                  <Chip
                    key={userId}
                    selected={partage.includes(userId)}
                    onClick={() =>
                      setPartage((actuel) =>
                        actuel.includes(userId)
                          ? actuel.filter((entree) => entree !== userId)
                          : [...actuel, userId],
                      )
                    }
                  >
                    {noms.get(userId)}
                  </Chip>
                ))}
              </div>
              {partage.length === 0 && (
                <p className="text-muted text-xs">
                  Une dépense partagée entre personne n’a nulle part où aller.
                </p>
              )}
            </div>
          </>
        )}

        <Button
          block
          disabled={!valide}
          loading={enCours}
          onClick={() =>
            onValider({
              label: label.trim(),
              originalCents: saisi,
              amountCents: enEuros ?? saisi,
              currency: devise,
              fxRate: parEuro === null ? 1 : referenceRate(parEuro),
              paidBy,
              category: categorie,
              spentOn: date,
              sharedWith: partage,
            })
          }
        >
          Enregistrer
        </Button>
      </CardBody>
    </Card>
  );
}

/**
 * Ce que la conversion donne, et d'où vient le taux.
 *
 * La date affichée est celle de la publication, pas celle du jour : la BCE ne
 * publie ni le week-end ni les jours fériés, et un taux daté est un taux
 * qu'on peut aller vérifier.
 */
function Conversion({
  devise,
  parEuro,
  enEuros,
  date,
  deviseLocale,
}: {
  devise: string;
  parEuro: number | null;
  enEuros: number | null;
  date: string | undefined;
  deviseLocale: string | undefined;
}) {
  // Une devise que la BCE ne publie pas — dirham, dinar serbe, lek. On le dit
  // plutôt que de laisser croire que l'euro était la seule option possible.
  if (deviseLocale && deviseLocale !== 'EUR' && !isConvertible(deviseLocale)) {
    return (
      <p className="text-muted text-xs leading-relaxed">
        La Banque centrale européenne ne publie pas de taux pour le{' '}
        {currencyName(deviseLocale)} : notez vos dépenses converties en euros. Tripora ne
        peut pas le faire à votre place sans inventer un taux.
      </p>
    );
  }

  if (devise === 'EUR' || parEuro === null || !date) return null;

  return (
    <p className="text-muted text-xs leading-relaxed">
      {enEuros !== null && (
        <span className="text-ink-800 dark:text-ink-100 font-semibold">
          ≈ {formatCents(enEuros)}
        </span>
      )}
      {enEuros !== null && ' · '}
      {describeRate(devise, parEuro)} · taux BCE du{' '}
      {new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
      })}
    </p>
  );
}

function Retour({ id }: { id: string | undefined }) {
  return (
    <Link
      to={`/voyages/${id ?? ''}`}
      className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Retour au voyage
    </Link>
  );
}
