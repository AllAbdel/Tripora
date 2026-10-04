import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Banner } from '@/components/ui/Banner';
import { useAuth } from '@/lib/auth-context';
import { euros, libelleDuMois, requeteDesAlertes } from '@/lib/alertesDePrix';

/**
 * Sur l'accueil d'un voyage : le vol suivi depuis ce voyage a baissé, et on
 * ne l'a pas encore vu. Disparaît dès que l'écran des alertes a été ouvert.
 *
 * C'est aussi ce qui tient lieu de notification dans l'application mobile,
 * dont la vue web ne reçoit pas celles du navigateur.
 */
export function BaissesDuVoyage({ tripId }: { tripId: string }) {
  const { identity } = useAuth();
  const alertes = useQuery(requeteDesAlertes(identity?.mode === 'supabase'));
  const aVoir = (alertes.data ?? []).filter((alerte) => alerte.tripId === tripId && alerte.vueLe === null);
  const derniere = aVoir[0];
  if (!derniere) return null;

  return (
    <Banner tone="info" title="Le prix d’un vol suivi a baissé">
      {derniere.origine} → {derniere.destinationNom} en {libelleDuMois(derniere.mois)} :{' '}
      <strong className="chiffres">{euros(derniere.nouveauCents)}</strong> au lieu de{' '}
      <span className="chiffres">{euros(derniere.ancienCents)}</span>.
      {aVoir.length > 1 && ` Et ${aVoir.length - 1} autre${aVoir.length > 2 ? 's' : ''} baisse${aVoir.length > 2 ? 's' : ''}.`}{' '}
      <Link to="/alertes" className="font-semibold underline">
        Voir mes alertes
      </Link>
    </Banner>
  );
}
