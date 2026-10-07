import { useState } from 'react';
import { Link } from 'react-router';
import { Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LogoGoogle } from '@/components/ui/LogoGoogle';
import { Card, CardBody } from '@/components/ui/Card';
import { FormulaireCodeEmail } from '@/components/FormulaireCodeEmail';
import { useAuth } from '@/lib/auth-context';
import { oublierLaSuite, REPRISE_DE_LA_CREATION, retenirLaSuite } from '@/lib/suiteApresConnexion';
import type { LigneDuResume } from '@/lib/resumeDuBrouillon';

/**
 * La dernière étape d'un trip composé sans compte : l'enregistrer.
 *
 * Le compte n'est plus demandé à l'entrée. Quelqu'un qui découvre Tripora
 * compose d'abord son trip — qui, d'où, où, quand, combien, quelles envies —
 * et c'est seulement au moment de le valider qu'on lui propose de le garder.
 * Il a six réponses sous les yeux : créer un compte n'est plus une barrière à
 * l'entrée, c'est la façon de ne pas les perdre.
 *
 * Trois portes, dans cet ordre :
 *  - Google, un bouton ;
 *  - l'e-mail, un code à six chiffres, sans mot de passe (et un compte
 *    existant se reconnecte par le même formulaire) ;
 *  - « plus tard » : un compte invité, sur cet appareil. Il se rattache à
 *    Google ou à une adresse depuis le profil, sans rien perdre. C'est aussi
 *    ce qui laisse un assistant ou un robot de démonstration aller jusqu'au
 *    bout du parcours : il n'a ni boîte mail ni compte Google.
 *
 * Quand la session s'ouvre, l'écran de création enregistre le trip de
 * lui-même : personne n'a à recliquer « Créer ».
 */
export function EnregistrerLeTrip({ resume }: { resume: LigneDuResume[] }) {
  const { signInWithGoogle, envoyerUnCode, verifierLeCode, continueAsGuest, backendReady } = useAuth();
  const [occupe, setOccupe] = useState<'google' | 'invite' | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function google() {
    setErreur(null);
    setOccupe('google');
    // Google quitte la page et revient sur la liste des voyages : de là, on
    // est renvoyé ici, et le brouillon — gardé sur l'appareil — s'enregistre.
    retenirLaSuite(REPRISE_DE_LA_CREATION);
    try {
      await signInWithGoogle();
    } catch (cause) {
      oublierLaSuite();
      setErreur(
        cause instanceof Error && cause.message
          ? `Google n’a pas répondu (${cause.message}). Réessayez, ou utilisez votre e-mail.`
          : 'Google n’a pas répondu. Réessayez, ou utilisez votre e-mail.',
      );
      setOccupe(null);
    }
  }

  async function plusTard() {
    setErreur(null);
    setOccupe('invite');
    try {
      await continueAsGuest();
    } catch {
      setErreur('Impossible d’enregistrer le trip sur cet appareil pour le moment. Réessayez dans un instant.');
      setOccupe(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-3">
          <p className="etiquette">Votre trip</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {resume.map((ligne) => (
              <div key={ligne.terme} className="contents">
                <dt className="text-muted">{ligne.terme}</dt>
                <dd className="min-w-0 font-medium break-words">{ligne.valeur}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      {erreur && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {erreur}
        </p>
      )}

      {backendReady ? (
        <div className="space-y-5">
          <Button
            block
            size="lg"
            variant="google"
            icon={<LogoGoogle />}
            loading={occupe === 'google'}
            disabled={occupe === 'invite'}
            onClick={() => void google()}
          >
            Enregistrer avec Google
          </Button>

          <p className="etiquette-filet">
            <span className="etiquette">ou avec votre e-mail</span>
          </p>

          <FormulaireCodeEmail
            avecPrenom
            demander={(email, prenom) => envoyerUnCode({ email, creer: true, prenom })}
            valider={verifierLeCode}
          />

          <div className="filet space-y-1 border-t pt-4">
            <Button
              variant="ghost"
              block
              icon={<Smartphone className="size-5" aria-hidden />}
              loading={occupe === 'invite'}
              disabled={occupe === 'google'}
              onClick={() => void plusTard()}
            >
              Plus tard : garder ce trip sur cet appareil
            </Button>
            <p className="text-muted text-center text-xs leading-relaxed">
              Vous pourrez créer votre compte depuis le profil, sans rien perdre.
            </p>
          </div>
        </div>
      ) : (
        <Button
          block
          size="lg"
          icon={<Smartphone className="size-5" aria-hidden />}
          loading={occupe === 'invite'}
          onClick={() => void plusTard()}
        >
          Garder ce trip sur cet appareil
        </Button>
      )}

      <p className="text-muted text-xs leading-relaxed">
        En continuant, vous acceptez les{' '}
        <Link to="/conditions" className="underline underline-offset-2">
          conditions d’utilisation
        </Link>
        . Gratuit, sans publicité, et vos noms ne sont jamais transmis à une intelligence
        artificielle.
      </p>
    </div>
  );
}
