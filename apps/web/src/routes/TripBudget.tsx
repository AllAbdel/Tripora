import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
  computeBalances, formatCents, parseAmountToCents, simplifyDebts, totalSpent,
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
import { useAuth } from '@/lib/auth-context';
import { toFailure } from '@/lib/errors';
import { cn } from '@/lib/cn';

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

  /** Noms affichables, avec repli sur le mode local où il n'y a qu'une personne. */
  const noms = useMemo(() => {
    const table = new Map<string, string>();
    for (const membre of membres.data ?? []) table.set(membre.userId, membre.displayName);
    if (table.size === 0) table.set(identity?.id ?? 'moi', identity?.displayName ?? 'Vous');
    return table;
  }, [membres.data, identity]);

  const participants = useMemo(() => [...noms.keys()], [noms]);

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
      <h1 className="text-2xl font-bold tracking-tight">Dépenses</h1>

      {(ajouter.error || liste.error) && (
        <Banner tone="warning" title="Un problème est survenu">
          {toFailure(ajouter.error ?? liste.error).message}
        </Banner>
      )}

      {comptes && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted text-sm font-medium">Total dépensé</span>
              {/* Une estimation s'arrondit, de l'argent réellement dépensé
                  non : 71,50 € affiché « 72 € » ferait douter des comptes. */}
              <span className="text-2xl font-bold tabular-nums">
                {formatCents(comptes.total)}
              </span>
            </div>

            {participants.length > 1 && (
              <div className="space-y-1.5 border-t border-[color:var(--border-subtle)] pt-3">
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
            )}
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
                    <span aria-hidden className="text-lg">{categorie?.emoji ?? '💫'}</span>
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
                    <span className="shrink-0 font-bold tabular-nums">
                      {formatCents(entree.amountCents)}
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
  enCours,
  onAnnuler,
  onValider,
}: {
  participants: string[];
  noms: Map<string, string>;
  moi: string;
  enCours: boolean;
  onAnnuler: () => void;
  onValider: (valeurs: {
    label: string;
    amountCents: number;
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

  const valide = label.trim().length > 0 && parseAmountToCents(montant || '0') > 0 && partage.length > 0;

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
            <MoneyInput label="Montant" placeholder="48,50" value={montant} onChange={setMontant} />
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

        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Catégorie</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((entree) => (
              <Chip
                key={entree.value}
                selected={categorie === entree.value}
                onClick={() => setCategorie(entree.value)}
              >
                {entree.emoji} {entree.label}
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
              amountCents: parseAmountToCents(montant),
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
