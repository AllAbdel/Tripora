import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';
import { getTripsOuverts } from '@/lib/tripsOuverts';

/**
 * Les personnes que j'ai bloquées, et le moyen de revenir en arrière.
 *
 * Un blocage qu'on ne peut pas retrouver est un blocage qu'on ne peut pas
 * lever — et on bloque parfois sous le coup d'un malentendu. La liste dit
 * aussi depuis quand, parce qu'on ne se souvient pas toujours pourquoi.
 *
 * Rien ne s'affiche tant qu'il n'y a personne : un encart vide « aucune
 * personne bloquée » ferait penser qu'on devrait en avoir.
 */
export function PersonnesBloquees() {
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const ouverts = getTripsOuverts();

  const liste = useQuery({
    queryKey: ['mes-blocages'],
    queryFn: () => ouverts.mesBlocages(),
    enabled: Boolean(identity) && !identity?.isAnonymous,
  });

  const debloquer = useMutation({
    mutationFn: (userId: string) => ouverts.debloquer(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mes-blocages'] }),
  });

  if (!liste.data || liste.data.length === 0) return null;

  return (
    <Card>
      <CardBody className="space-y-2">
        <p className="text-sm font-semibold">Personnes bloquées</p>
        <ul>
          {liste.data.map((personne) => (
            <li
              key={personne.userId}
              className="filet flex items-center justify-between gap-3 border-b py-2.5 last:border-b-0"
            >
              <span className="min-w-0">
                <span className="block truncate">{personne.nom}</span>
                <span className="text-muted block text-xs">
                  depuis le{' '}
                  {new Date(personne.depuis).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                  })}
                </span>
              </span>
              <button
                type="button"
                disabled={debloquer.isPending}
                onClick={() => debloquer.mutate(personne.userId)}
                className="text-brand-600 dark:text-brand-300 shrink-0 text-sm font-medium
                           underline-offset-2 hover:underline"
              >
                Débloquer
              </button>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
