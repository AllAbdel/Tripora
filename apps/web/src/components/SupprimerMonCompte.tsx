import { useState } from 'react';
import { UserX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { BoiteDeConfirmation } from '@/components/ConfirmerSuppression';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { signaler } from '@/lib/feedback';

/**
 * Supprimer son compte, depuis l'application.
 *
 * Partir ne devrait pas demander d'écrire à quelqu'un — et Google Play l'exige
 * d'une application qui crée des comptes. Tout se passe côté base, dans
 * `supprimer_mon_compte()` : le compte, les voyages qu'on organise, ses
 * votes, ses messages, ses dépenses, ses documents. Puis la déconnexion
 * habituelle nettoie l'appareil.
 *
 * Absent en mode local : sans serveur, il n'y a pas de compte, seulement des
 * données dans ce navigateur, que la déconnexion garde exprès.
 */
export function SupprimerMonCompte() {
  const { signOut } = useAuth();
  const [ouverte, setOuverte] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!supabase) return null;
  const client = supabase;

  async function supprimer() {
    setEnCours(true);
    setErreur(null);
    const { error } = await client.rpc('supprimer_mon_compte');
    if (error) {
      setEnCours(false);
      signaler('echec');
      setErreur('La suppression n’a pas abouti. Vérifiez la connexion et réessayez.');
      return;
    }
    signaler('reussite');
    setOuverte(false);
    // Le compte n'existe plus : la déconnexion efface ce qui reste sur
    // l'appareil (session, rappels, copies de documents, cache).
    await signOut();
  }

  return (
    <Card>
      <CardBody className="space-y-2">
        <p className="text-muted text-sm leading-relaxed">
          Efface votre compte et tout ce qui vous concerne. Les voyages que vous organisez
          disparaissent pour tout le groupe.
        </p>
        {erreur && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
            {erreur}
          </p>
        )}
        <Button
          variant="ghost"
          icon={<UserX className="size-4" aria-hidden />}
          onClick={() => setOuverte(true)}
        >
          Supprimer mon compte
        </Button>
      </CardBody>
      <BoiteDeConfirmation
        ouverte={ouverte}
        titre="Supprimer votre compte ?"
        message="Votre compte, les voyages que vous organisez (pour tout le groupe), vos votes, vos messages, vos dépenses et vos documents seront effacés. Cette action ne s’annule pas."
        action="Supprimer mon compte"
        enCours={enCours}
        surAnnuler={() => setOuverte(false)}
        surConfirmer={() => void supprimer()}
      />
    </Card>
  );
}
