import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import type { TripDraft as AiDraft } from '@tripora/core';
import { comprendrePhrase, iaDisponible, messageIA } from '@/lib/ai';
import { appliquerBrouillon, resumer } from '@/lib/brouillon';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { useTripDraft } from '@/stores/tripDraft';

const EXEMPLE = 'On part à 5 depuis Lyon, une semaine en octobre, 400 € max, plutôt fête et bonne bouffe';

/**
 * « Dites-le en une phrase ».
 *
 * Raccourci, jamais passage obligé : les six écrans restent la voie normale, et
 * cette boîte se contente de les pré-remplir. Rien n'est appliqué sans que la
 * personne ait vu, en clair, ce qui a été compris — un modèle qui se trompe
 * doit coûter un clic sur « Ignorer », pas un voyage mal paramétré.
 *
 * Le bloc disparaît complètement si aucun fournisseur n'est branché : mieux
 * vaut ne rien montrer qu'un bouton qui ne marche pas.
 */
export function PhraseLibre() {
  const draft = useTripDraft();
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [phrase, setPhrase] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [compris, setCompris] = useState<AiDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  async function envoyer() {
    if (phrase.trim().length < 3 || enCours) return;
    setEnCours(true);
    setMessage(null);
    setCompris(null);
    const etat = await comprendrePhrase(phrase);
    if (!vivant.current) return;
    setEnCours(false);
    if (etat.statut === 'ok' && 'brouillon' in etat) setCompris(etat.brouillon);
    else setMessage(messageIA(etat));
  }

  function appliquer() {
    if (!compris) return;
    appliquerBrouillon(compris, draft);
    setCompris(null);
    setPhrase('');
    setMessage('C’est repris ci-dessous. Vérifiez, puis continuez.');
  }

  return (
    <Card className="border-brand-200 dark:border-brand-800 border-dashed">
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-brand-500 size-4 shrink-0" aria-hidden />
          <h2 className="text-sm font-bold">Ou dites-le en une phrase</h2>
        </div>

        <label className="sr-only" htmlFor="phrase-libre">
          Décrivez votre voyage en une phrase
        </label>
        <textarea
          id="phrase-libre"
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void envoyer();
          }}
          rows={2}
          maxLength={600}
          placeholder={EXEMPLE}
          className="focus:border-brand-500 w-full resize-none rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 py-2.5 text-sm outline-none"
        />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => void envoyer()}
            disabled={phrase.trim().length < 3 || enCours}
            variant="secondary"
            className="flex-1"
          >
            {enCours ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Lecture…
              </>
            ) : (
              'Remplir à partir de ma phrase'
            )}
          </Button>
        </div>

        {message && <p className="text-muted text-xs">{message}</p>}

        {compris && (
          <div className="animate-rise space-y-2.5 rounded-xl bg-[color:var(--surface-muted)] p-3">
            <p className="text-xs font-semibold">Voici ce que j’ai compris :</p>
            <ul className="flex flex-wrap gap-1.5">
              {resumer(compris).map((ligne) => (
                <li
                  key={ligne}
                  className="rounded-full bg-[color:var(--surface)] px-2.5 py-1 text-xs font-medium"
                >
                  {ligne}
                </li>
              ))}
            </ul>
            <p className="text-muted text-xs">
              Le reste garde ses valeurs par défaut. Tout reste modifiable ensuite.
            </p>
            <div className="flex gap-2">
              <Button type="button" onClick={appliquer} className="flex-1">
                <Check className="size-4" aria-hidden /> Reprendre
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCompris(null);
                  setMessage(null);
                }}
              >
                <X className="size-4" aria-hidden /> Ignorer
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
