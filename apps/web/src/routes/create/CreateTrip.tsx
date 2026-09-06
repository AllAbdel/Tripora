import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { findDestination } from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Progress } from '@/components/ui/Progress';
import { getTripRepository } from '@/lib/trips';
import { toFailure } from '@/lib/errors';
import { isStepComplete, STEPS, suggestTitle, useTripDraft, type StepId } from '@/stores/tripDraft';
import { StepGroup } from './steps/StepGroup';
import { StepOrigin } from './steps/StepOrigin';
import { StepDestination } from './steps/StepDestination';
import { StepDates } from './steps/StepDates';
import { StepBudget } from './steps/StepBudget';
import { StepPreferences } from './steps/StepPreferences';

const TITLES: Record<StepId, { question: string; help: string }> = {
  groupe: { question: 'Avec qui partez-vous ?', help: 'On pourra inviter les autres juste après.' },
  depart: { question: 'D’où partez-vous ?', help: 'Le point de départ change beaucoup le prix.' },
  destination: { question: 'Où allez-vous ?', help: 'Ne pas savoir est un très bon point de départ.' },
  dates: { question: 'Quand ?', help: 'Plus les dates sont souples, moins ça coûte.' },
  budget: { question: 'Quel budget ?', help: 'Par personne, tout compris.' },
  envies: { question: 'De quoi avez-vous envie ?', help: 'Ce sont vos envies à vous.' },
};

const CONTENT: Record<StepId, () => React.ReactElement> = {
  groupe: StepGroup,
  depart: StepOrigin,
  destination: StepDestination,
  dates: StepDates,
  budget: StepBudget,
  envies: StepPreferences,
};

export default function CreateTrip() {
  const draft = useTripDraft();
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const step = STEPS[index]!;
  const Content = CONTENT[step];
  const complete = isStepComplete(step, draft);
  const last = index === STEPS.length - 1;

  function back() {
    if (index === 0) navigate('/voyages');
    else setIndex((value) => value - 1);
  }

  async function next() {
    if (!last) {
      setIndex((value) => value + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const firstDestination = draft.destinationIds[0];
      const title = suggestTitle(
        draft,
        firstDestination ? findDestination(firstDestination)?.name : undefined,
      );
      const id = await getTripRepository().create(draft, title);
      // Sans cette invalidation, la liste et l'écran du voyage afficheraient
      // encore le cache d'avant la création : le voyage semblerait introuvable.
      await queryClient.invalidateQueries({ queryKey: ['trips'] });
      draft.reset();
      navigate(`/voyages/${id}`);
    } catch (cause) {
      const failure = toFailure(cause);
      setError(
        cause instanceof Error && cause.message ? cause.message : failure.message,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="space-y-4 px-5 pt-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={back}
            aria-label="Étape précédente"
            className="text-muted hover:text-brand-500 -ml-2 grid size-11 place-items-center rounded-full transition-colors"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <span className="text-muted text-sm font-medium tabular-nums">
            Étape {index + 1} sur {STEPS.length}
          </span>
        </div>

        <Progress current={index} total={STEPS.length} />

        <div className="space-y-1 pt-1">
          <h1 className="text-2xl font-bold tracking-tight">{TITLES[step].question}</h1>
          <p className="text-muted text-sm">{TITLES[step].help}</p>
        </div>
      </header>

      <main key={step} className="animate-rise flex-1 px-5 pt-5 pb-40">
        <Content />
      </main>

      <div className="pb-safe fixed inset-x-0 bottom-0 mx-auto w-full max-w-2xl border-t border-[color:var(--border-subtle)] bg-[color:var(--surface)]/90 px-5 pt-3 backdrop-blur-xl">
        {error && (
          <Banner tone="warning" className="mb-3" title="Création impossible">
            {error}
          </Banner>
        )}
        {!complete && (
          <p className="text-muted mb-2 text-center text-xs">{hintFor(step)}</p>
        )}
        <Button
          block
          size="lg"
          disabled={!complete}
          loading={saving}
          onClick={() => void next()}
          icon={last ? <Check className="size-5" aria-hidden /> : undefined}
        >
          {last ? 'Créer le voyage' : 'Continuer'}
          {!last && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

function hintFor(step: StepId): string {
  switch (step) {
    case 'depart':
      return 'Choisissez une ville de départ pour continuer.';
    case 'destination':
      return 'Choisissez au moins une ville, ou laissez Tripora proposer.';
    case 'dates':
      return 'Indiquez quand vous aimeriez partir.';
    case 'budget':
      return 'Donnez un budget par personne, ou choisissez « le moins cher possible ».';
    case 'envies':
      return 'Choisissez au moins une envie : sans ça, il n’y a rien à optimiser.';
    default:
      return '';
  }
}
