import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { LogIn, Ticket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth-context";
import { diagnosticConnexion, RETOUR_OAUTH } from "@/lib/oauthReturn";
import { env } from "@/lib/env";

export default function SignIn() {
  const { signInWithGoogle, continueAsGuest, backendReady } = useAuth();
  const [busy, setBusy] = useState<"google" | "guest" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Revenir de Google sans session est la seule panne totalement muette de
  // Tripora : l'écran de connexion réapparaît, identique. On dit ce qui s'est
  // passé, et surtout quoi faire — sans ça, personne ne peut le deviner.
  const diagnostic = useMemo(
    () =>
      diagnosticConnexion(
        RETOUR_OAUTH,
        window.location.origin,
        env.supabaseUrl,
      ),
    [],
  );

  async function run(kind: "google" | "guest") {
    setError(null);
    setBusy(kind);
    try {
      if (kind === "google") {
        await signInWithGoogle();
      } else if (backendReady) {
        // Avec un serveur, « j'ai un code » mène à l'écran qui sait quoi en
        // faire ; c'est lui qui ouvrira la session invité une fois le code
        // saisi, pour ne pas créer de compte vide si la personne abandonne.
        navigate("/rejoindre");
      } else {
        await continueAsGuest();
        navigate("/voyages");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Connexion impossible pour le moment.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-6 py-10">
      <div className="animate-rise flex flex-1 flex-col justify-center gap-8">
        <div className="space-y-5 text-center">
          <Logo className="mx-auto size-20" />
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Tripora</h1>
            <p className="text-muted text-[0.95rem] leading-relaxed">
              Dites avec qui vous partez, d’où, quand et pour combien. Tripora
              aide le groupe à choisir, puis à s’organiser.
            </p>
          </div>
        </div>

        {!backendReady && (
          <Banner tone="warning" title="Mode local">
            Aucun serveur n’est encore configuré. Vous pouvez découvrir
            l’interface, mais les voyages resteront sur cet appareil.
          </Banner>
        )}

        {!error && diagnostic && (
          <Banner tone="warning" title={diagnostic.titre}>
            {diagnostic.message}
            {diagnostic.aFaire && (
              <span className="mt-2 block break-all font-mono text-xs">
                {diagnostic.aFaire}
              </span>
            )}
          </Banner>
        )}

        {error && (
          <Banner tone="warning" title="Connexion impossible">
            {error}
          </Banner>
        )}

        <div className="space-y-3">
          {backendReady && (
            <Button
              block
              size="lg"
              icon={<LogIn className="size-5" aria-hidden />}
              loading={busy === "google"}
              onClick={() => void run("google")}
            >
              Continuer avec Google
            </Button>
          )}
          <Button
            block
            size="lg"
            variant={backendReady ? "secondary" : "primary"}
            icon={<Ticket className="size-5" aria-hidden />}
            loading={busy === "guest"}
            onClick={() => void run("guest")}
          >
            {backendReady
              ? "J’ai un code d’invitation"
              : "Découvrir en mode local"}
          </Button>
        </div>
      </div>

      <p className="text-muted text-center text-xs leading-relaxed">
        Pas de mot de passe, pas de publicité, pas de revente de données. Vos
        noms et vos dépenses ne sont jamais transmis à un service d’intelligence
        artificielle.
      </p>
    </div>
  );
}
