import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import {
  formatCents,
  parseAmountToCents,
  type PreferenceAxis,
  type PreferenceWeights,
} from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { PreferenceEditor } from '@/components/PreferenceEditor';
import { getCollaboration } from '@/lib/collaboration';
import { toFailure } from '@/lib/errors';

const RACCOURCIS = [20_000, 40_000, 60_000, 100_000];

/**
 * Les envies d'une personne pour un voyage donné.
 *
 * C'est l'écran qui fait la différence entre « le voyage du créateur » et
 * « le voyage du groupe » : chacun répond pour soi, et le moteur cherche
 * ensuite le compromis en tenant compte de la personne la moins servie.
 */
export default function MyPreferences() {
  const { id } = useParams<{ id: string }>();
  const collaboration = getCollaboration();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const existantes = useQuery({
    queryKey: ['mes-envies', id],
    queryFn: () => collaboration!.myPreferences(id!),
    enabled: Boolean(id && collaboration),
  });

  /**
   * Tant que la personne n'a rien touché, on affiche directement ses réponses
   * précédentes. Le brouillon local ne prend le relais qu'au premier geste.
   * Recopier la réponse du serveur dans un état local au chargement
   * provoquerait un rendu en cascade, et une saisie en cours pourrait être
   * écrasée par un rafraîchissement de la requête.
   */
  const [brouillon, setBrouillon] = useState<{
    weights: Partial<PreferenceWeights>;
    budget: number | null;
  } | null>(null);

  const valeurs = brouillon ?? {
    weights: (existantes.data?.weights ?? {}) as Partial<PreferenceWeights>,
    budget: existantes.data?.budgetMaxCents ?? null,
  };
  const { weights, budget } = valeurs;
  const modifier = (patch: Partial<typeof valeurs>) =>
    setBrouillon({ ...valeurs, ...patch });

  const enregistrer = useMutation({
    mutationFn: () =>
      collaboration!.savePreferences(id!, { weights, budgetMaxCents: budget, avoid: [] }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['membres', id] });
      await queryClient.invalidateQueries({ queryKey: ['trip'] });
      navigate(`/voyages/${id}/participants`);
    },
  });

  if (!collaboration) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <Banner tone="warning" title="Pas disponible en mode local">
          Sans serveur, un voyage n’a qu’un participant : vos envies sont celles saisies
          à la création.
        </Banner>
      </div>
    );
  }

  const auMoinsUneEnvie = Object.values(weights).some((valeur) => (valeur ?? 0) > 0);

  return (
    <div className="space-y-5 px-5 pt-6 pb-8">
      <Link
        to={`/voyages/${id}/participants`}
        className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
      >
        ← Participants
      </Link>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Vos envies</h1>
        <p className="text-muted text-sm leading-relaxed">
          Répondez pour vous, pas pour le groupe. Personne ne verra vos réponses en
          détail : seul le compromis est affiché.
        </p>
      </div>

      {existantes.isLoading && (
        <div className="grid place-items-center py-10">
          <Loader2 className="text-brand-500 size-6 animate-spin" aria-label="Chargement" />
        </div>
      )}

      {enregistrer.error && (
        <Banner tone="warning" title="Enregistrement impossible">
          {toFailure(enregistrer.error).message}
        </Banner>
      )}

      {!existantes.isLoading && (
        <>
          <Field
            label="Votre budget maximum, tout compris"
            hint="Tripora retient toujours le budget le plus serré du groupe. Personne ne doit se retrouver embarqué dans un voyage qu’il ne peut pas payer."
          >
            <MoneyInput
              label="Budget maximum"
              placeholder="400"
              entier
              value={budget === null ? '' : String(budget / 100)}
              onChange={(valeur) =>
                modifier({ budget: valeur === '' ? null : parseAmountToCents(valeur) })
              }
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            {RACCOURCIS.map((cents) => (
              <Chip key={cents} selected={budget === cents} onClick={() => modifier({ budget: cents })}>
                {formatCents(cents, 'EUR', { hideCentimes: true })}
              </Chip>
            ))}
          </div>

          <PreferenceEditor
            weights={weights}
            onChange={(axis: PreferenceAxis, valeur: number) =>
              modifier({ weights: { ...weights, [axis]: valeur } })
            }
          />

          <div className="space-y-2">
            {!auMoinsUneEnvie && (
              <p className="text-muted text-center text-xs">
                Choisissez au moins une envie : sans ça, il n’y a rien à optimiser pour vous.
              </p>
            )}
            <Button
              block
              size="lg"
              disabled={!auMoinsUneEnvie}
              loading={enregistrer.isPending}
              icon={<Check className="size-5" aria-hidden />}
              onClick={() => enregistrer.mutate()}
            >
              Enregistrer mes envies
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
