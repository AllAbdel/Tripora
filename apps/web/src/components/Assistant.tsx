import { useEffect, useRef, useState } from 'react';
import { Loader2, MessageCircleQuestion, Send } from 'lucide-react';
import {
  buildBriefing,
  briefingLeaksNames,
  CONSIGNE_ASSISTANT,
  tripReadiness,
  type DestinationScore,
  type MemberPreference,
  type TripConstraints,
} from '@tripora/core';
import { demander, iaDisponible, messageIA } from '@/lib/ai';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

/** De vraies questions de groupe, pas des démonstrations de technologie. */
const EXEMPLES = [
  'Pourquoi la première est devant la deuxième ?',
  'Qu’est-ce qui nous empêche de trancher ?',
  'Laquelle respecte le budget de tout le monde ?',
];

/**
 * L'assistant du voyage : il lit, il explique, il ne décide pas.
 *
 * Il ne dispose d'aucun outil et ne peut rien modifier. Tout ce qu'il sait
 * tient dans un dossier de faits que le moteur a calculés — notes, coûts,
 * budget contraignant, ce qui manque au groupe — et la consigne lui interdit
 * d'en sortir. C'est la seule façon de laisser un modèle parler librement sans
 * qu'il se mette à inventer des prix.
 *
 * Les prénoms ne partent jamais : le dossier anonymise, et `briefingLeaksNames`
 * vérifie avant l'envoi plutôt que de faire confiance. Si un nom a glissé,
 * l'envoi est annulé — mieux vaut une fonctionnalité muette qu'une promesse
 * trahie.
 *
 * Le bloc disparaît si aucun fournisseur n'est branché : rien n'en dépend.
 */
export function Assistant({
  constraints,
  members,
  scores,
  lockedName,
}: {
  constraints: TripConstraints;
  members: readonly MemberPreference[];
  scores: readonly DestinationScore[];
  lockedName?: string | undefined;
}) {
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [question, setQuestion] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [reponse, setReponse] = useState<string | null>(null);
  const [posee, setPosee] = useState<string | null>(null);
  const vivant = useRef(true);

  useEffect(() => {
    vivant.current = true;
    void iaDisponible().then((oui) => {
      if (vivant.current) setDisponible(oui);
    });
    return () => {
      vivant.current = false;
    };
  }, []);

  if (disponible !== true) return null;

  async function poser(texte: string) {
    const propre = texte.trim();
    if (propre.length < 3 || enCours) return;

    const dossier = buildBriefing({
      constraints,
      members,
      scores,
      ...(lockedName ? { lockedName } : {}),
      blockers: tripReadiness({
        constraints,
        members,
        locked: Boolean(lockedName),
      }).blockers,
    });

    // On vérifie avant d'envoyer, plutôt que de croire l'anonymisation sur
    // parole. Un nom qui passerait irait s'entraîner chez un fournisseur.
    if (briefingLeaksNames(dossier, members).length > 0) {
      setPosee(propre);
      setReponse(
        'Je préfère ne pas envoyer cette demande : le dossier contenait un nom de participant. Signalez-le, c’est un bug.',
      );
      return;
    }

    setEnCours(true);
    setPosee(propre);
    setReponse(null);
    const etat = await demander(propre, dossier, CONSIGNE_ASSISTANT);
    if (!vivant.current) return;
    setEnCours(false);
    setReponse(etat.statut === 'ok' && 'texte' in etat ? etat.texte : messageIA(etat));
    setQuestion('');
  }

  return (
    <Card className="border-brand-200 dark:border-brand-800 border-dashed">
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="text-brand-500 size-4 shrink-0" aria-hidden />
          <h2 className="text-sm font-bold">Une question sur ce voyage ?</h2>
        </div>

        {posee && (
          <div className="space-y-2 rounded-xl bg-[color:var(--surface-muted)] p-3">
            <p className="text-xs font-semibold">{posee}</p>
            {enCours ? (
              <p className="text-muted flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Lecture du dossier…
              </p>
            ) : (
              <p className="text-sm leading-relaxed">{reponse}</p>
            )}
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void poser(question);
          }}
        >
          <label className="sr-only" htmlFor="question-assistant">
            Votre question
          </label>
          <input
            id="question-assistant"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={400}
            placeholder="Pourquoi Naples est en tête ?"
            className="focus:border-brand-500 min-h-11 flex-1 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 text-sm outline-none"
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={question.trim().length < 3 || enCours}
            aria-label="Poser la question"
          >
            <Send className="size-4" aria-hidden />
          </Button>
        </form>

        {!posee && (
          <ul className="flex flex-wrap gap-1.5">
            {EXEMPLES.map((exemple) => (
              <li key={exemple}>
                <button
                  type="button"
                  onClick={() => void poser(exemple)}
                  className="hover:bg-brand-50 dark:hover:bg-ink-700/40 rounded-full border border-[color:var(--border-subtle)] px-2.5 py-1 text-xs font-medium"
                >
                  {exemple}
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-muted text-xs">
          Il ne connaît que les chiffres de cet écran, et ne peut rien modifier. Aucun
          prénom ne lui est transmis.
        </p>
      </CardBody>
    </Card>
  );
}
