import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Loader2, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Field, TextInput } from '@/components/ui/Field';
import { Logo } from '@/components/Logo';
import { getCollaboration } from '@/lib/collaboration';
import { useAuth } from '@/lib/auth-context';
import { toFailure } from '@/lib/errors';

/**
 * Rejoindre un voyage par lien ou par code.
 *
 * Le parcours doit tenir en un geste : on ouvre le lien reçu, et on est dedans.
 * Si la personne n'a pas de compte, on lui en ouvre un anonyme sans rien lui
 * demander — elle pourra le rattacher à Google plus tard sans rien perdre.
 */
export default function JoinTrip() {
  const { code: codeUrl } = useParams<{ code: string }>();
  const { identity, continueAsGuest, backendReady } = useAuth();
  const collaboration = getCollaboration();
  const navigate = useNavigate();

  const [code, setCode] = useState(codeUrl?.toUpperCase() ?? '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Repère hors rendu : savoir qu'on a déjà tenté ne change rien à l'affichage,
  // et le garder en état déclencherait un rendu en cascade depuis l'effet.
  const autoTente = useRef(false);

  async function rejoindre(valeur: string) {
    if (!collaboration) return;
    setErreur(null);
    setEnCours(true);
    try {
      if (!identity) await continueAsGuest();
      const { tripId } = await collaboration.joinWithCode(valeur);
      navigate(`/voyages/${tripId}/mes-envies`, { replace: true });
    } catch (cause) {
      setErreur(messageLisible(cause));
    } finally {
      setEnCours(false);
    }
  }

  // Un lien reçu doit fonctionner sans que la personne ait à cliquer.
  useEffect(() => {
    if (autoTente.current || !codeUrl || !collaboration || !identity) return;
    autoTente.current = true;
    void rejoindre(codeUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeUrl, collaboration, identity]);

  if (!backendReady) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-6 py-12">
        <Banner tone="warning" title="Mode local">
          Rejoindre un voyage demande un serveur. Cette application n’est pas encore
          reliée au sien.
        </Banner>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-10">
      <div className="space-y-4 text-center">
        <Logo className="mx-auto size-16" />
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Rejoindre un voyage</h1>
          <p className="text-muted text-sm leading-relaxed">
            Entrez le code reçu. Pas de compte à créer, pas de mot de passe.
          </p>
        </div>
      </div>

      {erreur && (
        <Banner tone="warning" title="Impossible de rejoindre">
          {erreur}
        </Banner>
      )}

      {enCours && !erreur ? (
        <div className="grid place-items-center py-6">
          <Loader2 className="text-brand-500 size-7 animate-spin" aria-label="Connexion" />
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void rejoindre(code);
          }}
        >
          <Field label="Code du voyage" hint="Huit caractères, majuscules et chiffres.">
            <TextInput
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 8))}
              placeholder="ABCD2345"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="text-center font-mono text-xl tracking-[0.3em]"
              aria-label="Code du voyage"
            />
          </Field>

          <Button
            block
            size="lg"
            type="submit"
            disabled={code.length !== 8}
            icon={<Ticket className="size-5" aria-hidden />}
          >
            Rejoindre
          </Button>
        </form>
      )}
    </div>
  );
}

/** Les erreurs de la fonction serveur portent un code : on les traduit. */
function messageLisible(cause: unknown): string {
  const code = (cause as { code?: string } | null)?.code;
  switch (code) {
    case 'P0002':
      return 'Ce code n’existe pas. Vérifiez les caractères saisis.';
    case 'P0003':
      return 'Ce lien d’invitation a expiré. Demandez-en un nouveau.';
    case 'P0004':
      return 'Ce lien a déjà servi au maximum de fois prévu.';
    case '28000':
      return 'Connexion requise. Réessayez dans un instant.';
    default: {
      // Tout le reste passe par la traduction commune des pannes, pour ne
      // jamais afficher un message brut du navigateur du genre « Failed to
      // fetch » à quelqu'un qui essaie simplement de rejoindre ses amis.
      const panne = toFailure(cause);
      return panne.hint ? `${panne.message} ${panne.hint}` : panne.message;
    }
  }
}
