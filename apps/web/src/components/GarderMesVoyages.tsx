import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { FormulaireCodeEmail } from '@/components/FormulaireCodeEmail';
import { useAuth } from '@/lib/auth-context';
import { messageDErreurEmail } from '@/lib/connexionEmail';
import { RETOUR_OAUTH } from '@/lib/oauthReturn';
import { messageDeRattachement } from '@/lib/rattachement';

/**
 * Transformer son compte invité en vrai compte, sans rien perdre.
 *
 * On devient invité en rejoignant un voyage par un code : pas de compte à
 * créer, c'est tout l'intérêt. Mais ce compte ne vit que sur l'appareil —
 * un téléphone changé, un navigateur vidé, et les voyages sont perdus. Et se
 * déconnecter pour « se connecter avec Google » ouvrait un autre compte, vide.
 *
 * Ici, on rattache Google ou une adresse e-mail **au même compte** : même
 * identifiant, mêmes voyages, mêmes votes, mêmes dépenses. Le groupe ne voit
 * aucune différence.
 */
export function GarderMesVoyages() {
  const { rattacherGoogle, rattacherEmail, confirmerRattachementEmail, rattachementGooglePossible } =
    useAuth();
  const [occupe, setOccupe] = useState(false);
  const carte = useRef<HTMLDivElement>(null);
  const { hash, state } = useLocation();
  // Un refus peut revenir de Google par l'adresse (site) ou par le pont natif
  // (application), après un aller-retour : on le reprend ici.
  const retour = (state as { erreurDeConnexion?: string } | null)?.erreurDeConnexion;
  const [erreur, setErreur] = useState<string | null>(() => {
    const venu = retour ?? RETOUR_OAUTH.description ?? null;
    return venu ? (messageDeRattachement(venu) ?? venu.replace(/\+/gu, ' ')) : null;
  });

  // Arrivé par « Les garder avec Google ou votre e-mail » : la carte vient
  // sous les yeux. Le routeur ne suit pas les ancres de lui-même.
  useEffect(() => {
    if (hash === '#garder-mes-voyages') carte.current?.scrollIntoView({ block: 'start' });
  }, [hash]);

  async function google() {
    setErreur(null);
    setOccupe(true);
    try {
      await rattacherGoogle();
    } catch (cause) {
      setErreur(messageDeRattachement(cause) ?? 'Google n’a pas pu être rattaché. Réessayez dans un instant.');
      setOccupe(false);
    }
  }

  return (
    <Card ref={carte} id="garder-mes-voyages" className="border-brand-500/40 scroll-mt-20">
      <CardBody className="space-y-4">
        <div className="space-y-1.5">
          <h2 className="titre text-xl">Gardez vos voyages</h2>
          <p className="text-muted text-sm leading-relaxed">
            Vous êtes entré avec un code d’invitation : ce compte d’invité ne vit que sur cet
            appareil. Rattachez-le à Google ou à votre adresse e-mail pour retrouver vos voyages
            partout. Rien ne change pour le groupe.
          </p>
        </div>

        {erreur && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {erreur}
          </p>
        )}

        {rattachementGooglePossible && (
          <Button
            block
            icon={<LogIn className="size-5" aria-hidden />}
            loading={occupe}
            onClick={() => void google()}
          >
            Rattacher mon compte Google
          </Button>
        )}

        <FormulaireCodeEmail
          demander={(email) => rattacherEmail(email)}
          valider={confirmerRattachementEmail}
          traduireErreur={(cause, etape) =>
            messageDeRattachement(cause) ?? messageDErreurEmail(cause, etape)
          }
        />
      </CardBody>
    </Card>
  );
}
