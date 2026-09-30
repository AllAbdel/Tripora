import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { findDestination } from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Progress } from '@/components/ui/Progress';
import { Pastille } from '@/components/Pastille';
import { getTripRepository } from '@/lib/trips';
import { toFailure } from '@/lib/errors';
import { isStepComplete, STEPS, suggestTitle, useTripDraft, type StepId } from '@/stores/tripDraft';
import { StepGroup } from './steps/StepGroup';
import { StepOrigin } from './steps/StepOrigin';
import { StepDestination } from './steps/StepDestination';
import { StepDates } from './steps/StepDates';
import { StepBudget } from './steps/StepBudget';
import { StepPreferences } from './steps/StepPreferences';
import { signaler } from '@/lib/feedback';
import { useAuth } from '@/lib/auth-context';
import { resumeDuBrouillon } from '@/lib/resumeDuBrouillon';
import { EnregistrerLeTrip } from '@/components/EnregistrerLeTrip';

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
  const { identity } = useAuth();
  const [parametres] = useSearchParams();
  const toutEstPret = STEPS.every((etape) => isStepComplete(etape, draft));
  // De retour de Google avec un trip composé sans compte : on reprend sur la
  // dernière étape, qui s'enregistre dès que la session est là.
  const reprise = parametres.get('enregistrer') === '1' && toutEstPret;
  const [index, setIndex] = useState(() => (reprise ? STEPS.length - 1 : 0));
  /** L'étape « Enregistrer », après la dernière question, quand on n'a pas de compte. */
  const [aEnregistrer, setAEnregistrer] = useState(reprise);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Repère hors rendu : un effet peut être rejoué, la création ne doit
  // partir qu'une fois.
  const creationLancee = useRef(false);

  const step = STEPS[index]!;
  const Content = CONTENT[step];
  const complete = isStepComplete(step, draft);
  const last = index === STEPS.length - 1;

  function back() {
    if (aEnregistrer) {
      setAEnregistrer(false);
      return;
    }
    // Sans compte, la liste des voyages mène à la connexion : on revient à
    // l'accueil, d'où l'on est parti.
    if (index === 0) navigate(identity ? '/voyages' : '/');
    else setIndex((value) => value - 1);
  }

  async function creer() {
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
      signaler('reussite');
      draft.reset();
      navigate(`/voyages/${id}`, { replace: aEnregistrer });
    } catch (cause) {
      creationLancee.current = false;
      signaler('echec');
      const failure = toFailure(cause);
      // Un message métier explicite vaut mieux que la traduction générique ;
      // à défaut, la piste d'action compte autant que le constat.
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : [failure.message, failure.hint].filter(Boolean).join(' '),
      );
    } finally {
      setSaving(false);
    }
  }

  // La session vient de s'ouvrir sur l'étape « Enregistrer » — code e-mail
  // validé, compte invité ouvert, retour de Google : le trip part tout seul.
  useEffect(() => {
    if (!identity || !aEnregistrer || !toutEstPret || creationLancee.current) return;
    creationLancee.current = true;
    void creer();
    // `creer` lit le brouillon du rendu courant : on ne relance que sur
    // l'arrivée de la session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, aEnregistrer, toutEstPret]);

  async function next() {
    if (!last) {
      setIndex((value) => value + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!identity) {
      // Tout est composé : c'est maintenant, et seulement maintenant, qu'on
      // propose un compte — pour garder ce qu'on vient de faire.
      setAEnregistrer(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    creationLancee.current = true;
    await creer();
  }

  if (aEnregistrer) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
        <header className="space-y-4 px-5 pt-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={back}
              aria-label="Revenir aux envies"
              disabled={saving}
              className="text-muted hover:text-brand-500 -ml-2 grid size-11 place-items-center rounded-full transition-colors disabled:opacity-40"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </button>
            <Pastille nom="creer" taille="sm" />
            <span className="text-muted text-sm font-medium">Nouveau trip · Dernière étape</span>
          </div>
          <Progress current={STEPS.length} total={STEPS.length} />
          <div className="space-y-1 pt-1">
            <h1 className="text-2xl font-bold tracking-tight">Votre trip est prêt</h1>
            <p className="text-muted text-sm">
              Enregistrez-le pour le retrouver sur tous vos appareils et y inviter vos amis.
              Gratuit, sans mot de passe.
            </p>
          </div>
        </header>

        <main className="animate-rise flex-1 px-5 pt-5 pb-16">
          {error && (
            <Banner tone="warning" className="mb-4" title="Enregistrement impossible">
              {error}
              {identity && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    creationLancee.current = true;
                    void creer();
                  }}
                >
                  Réessayer
                </Button>
              )}
            </Banner>
          )}
          {identity ? (
            <div role="status" className="grid place-items-center gap-3 py-16 text-center">
              {saving && <Check className="text-lagoon-500 size-8" aria-hidden />}
              <p className="text-muted text-sm">
                {saving ? 'Enregistrement de votre trip…' : 'Votre compte est prêt.'}
              </p>
            </div>
          ) : (
            <EnregistrerLeTrip resume={resumeDuBrouillon(draft)} />
          )}
        </main>
      </div>
    );
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
          {/* La pastille « créer » de la planche : le titre de l'écran est la
              question de l'étape en cours, jamais le nom de l'assistant, donc
              sans elle rien ne rappelle où l'on se trouve. */}
          <Pastille nom="creer" taille="sm" />
          <span className="text-muted text-sm font-medium">
            Nouveau trip ·{' '}
            <span className="tabular-nums">
              Étape {index + 1} sur {STEPS.length}
            </span>
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
          {last ? (identity ? 'Créer le voyage' : 'Valider mon trip') : 'Continuer'}
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
