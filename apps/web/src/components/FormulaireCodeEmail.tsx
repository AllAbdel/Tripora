import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import {
  chiffresDuCode,
  codeComplet,
  emailPlausible,
  messageDErreurEmail,
  normaliserEmail,
  secondesAAttendre,
} from '@/lib/connexionEmail';

/** Le délai minimal de Supabase entre deux codes pour la même adresse. */
const ATTENTE_ENTRE_DEUX_CODES = 60;

/**
 * L'adresse, puis le code.
 *
 * Deux temps sur le même écran, parce que l'e-mail peut mettre une minute à
 * arriver : on garde l'adresse sous les yeux, et de quoi en redemander un.
 *
 * Le même formulaire sert à se connecter et à transformer un compte invité en
 * vrai compte : seules changent les deux actions et la lecture des erreurs.
 */
export function FormulaireCodeEmail({
  demander,
  valider,
  avecPrenom = false,
  traduireErreur = messageDErreurEmail,
}: {
  /** Envoie le code à cette adresse. */
  demander: (email: string, prenom: string) => Promise<void>;
  /** Ouvre (ou change) la session si le code est le bon. */
  valider: (email: string, code: string) => Promise<void>;
  /** Demander le prénom montré aux covoyageurs : à la création seulement. */
  avecPrenom?: boolean;
  traduireErreur?: (cause: unknown, etape: 'envoi' | 'verification') => string;
}) {
  const [email, setEmail] = useState('');
  const [prenom, setPrenom] = useState('');
  const [envoyeA, setEnvoyeA] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [attente, setAttente] = useState(0);
  const champCode = useRef<HTMLInputElement>(null);

  // Le compte à rebours du « renvoyer » : une seconde à la fois, arrêté à zéro.
  useEffect(() => {
    if (attente <= 0) return;
    const minuteur = window.setTimeout(() => setAttente((reste) => reste - 1), 1000);
    return () => window.clearTimeout(minuteur);
  }, [attente]);

  async function envoyer(adresse: string) {
    setErreur(null);
    setOccupe(true);
    try {
      await demander(adresse, prenom);
      setEnvoyeA(normaliserEmail(adresse));
      setCode('');
      setAttente(ATTENTE_ENTRE_DEUX_CODES);
      // Le champ du code prend la main : le clavier numérique s'ouvre seul.
      window.setTimeout(() => champCode.current?.focus(), 50);
    } catch (cause) {
      setErreur(traduireErreur(cause, 'envoi'));
      const delai = secondesAAttendre(cause instanceof Error ? cause.message : '');
      if (delai) setAttente(delai);
    } finally {
      setOccupe(false);
    }
  }

  async function verifier(chiffres: string) {
    if (!envoyeA || !codeComplet(chiffres)) return;
    setErreur(null);
    setOccupe(true);
    try {
      // La session ouverte, l'application bascule d'elle-même : cet écran
      // disparaît et la suite prévue s'affiche.
      await valider(envoyeA, chiffres);
    } catch (cause) {
      setErreur(traduireErreur(cause, 'verification'));
      setOccupe(false);
    }
  }

  function soumettreAdresse(evenement: FormEvent) {
    evenement.preventDefault();
    if (!emailPlausible(email)) {
      setErreur('Cette adresse e-mail ne semble pas valide.');
      return;
    }
    void envoyer(email);
  }

  if (!envoyeA) {
    return (
      <form onSubmit={soumettreAdresse} className="space-y-4" noValidate>
        {avecPrenom && (
          <Field label="Votre prénom" hint="C’est le nom que verront vos covoyageurs.">
            <TextInput
              value={prenom}
              onChange={(evenement) => setPrenom(evenement.target.value)}
              autoComplete="given-name"
              maxLength={60}
              placeholder="Léa"
            />
          </Field>
        )}
        <Field label="Adresse e-mail">
          <TextInput
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(evenement) => setEmail(evenement.target.value)}
            placeholder="vous@exemple.fr"
            required
          />
        </Field>
        {erreur && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {erreur}
          </p>
        )}
        <Button
          type="submit"
          variant="secondary"
          block
          size="lg"
          icon={<Mail className="size-5" aria-hidden />}
          loading={occupe}
          disabled={attente > 0}
        >
          {attente > 0 ? `Nouveau code dans ${attente} s` : 'Recevoir un code par e-mail'}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(evenement) => {
        evenement.preventDefault();
        void verifier(chiffresDuCode(code));
      }}
      className="space-y-4"
    >
      <p className="text-sm leading-relaxed">
        Code envoyé à <strong className="break-all">{envoyeA}</strong>. Il arrive en moins d’une
        minute — pensez à regarder dans les indésirables.
      </p>
      <Field label="Le code reçu">
        <TextInput
          ref={champCode}
          value={code}
          onChange={(evenement) => {
            const chiffres = chiffresDuCode(evenement.target.value);
            setCode(chiffres);
            // Six chiffres collés ou tapés : on valide sans faire chercher le
            // bouton. Au-delà de six, le projet en demande plus — on attend.
            if (chiffres.length === 6) void verifier(chiffres);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={12}
          placeholder="123456"
          className="chiffres text-center text-2xl tracking-[0.4em]"
          aria-describedby={erreur ? 'erreur-du-code' : undefined}
        />
      </Field>
      {erreur && (
        <p id="erreur-du-code" role="alert" className="text-sm text-red-700 dark:text-red-300">
          {erreur}
        </p>
      )}
      <Button type="submit" block size="lg" loading={occupe} disabled={!codeComplet(code)}>
        Valider
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={() => {
            setEnvoyeA(null);
            setErreur(null);
          }}
          className="text-muted min-h-11 underline-offset-4 hover:underline"
        >
          Changer d’adresse
        </button>
        <button
          type="button"
          disabled={attente > 0 || occupe}
          onClick={() => void envoyer(envoyeA)}
          className="text-brand-700 dark:text-brand-200 min-h-11 font-semibold underline-offset-4 hover:underline disabled:opacity-50 disabled:hover:no-underline"
        >
          {attente > 0 ? `Renvoyer dans ${attente} s` : 'Renvoyer le code'}
        </button>
      </div>
    </form>
  );
}
