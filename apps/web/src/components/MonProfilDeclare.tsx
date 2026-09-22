import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';
import {
  anneesProposees,
  ecrireMonProfil,
  lireMonProfil,
  PROFIL_VIDE,
  type MonProfil,
} from '@/lib/monProfil';
import type { Genre } from '@/lib/tripsOuverts';
import { cn } from '@/lib/cn';

/**
 * Le genre et l'année de naissance, déclarés.
 *
 * Cet encart demande deux informations personnelles, et il doit donc dire
 * trois choses avant de les demander : à quoi elles servent, ce qui se passe
 * si on ne les donne pas, et qui les voit. Les trois sont écrites ici, pas
 * renvoyées vers une page de confidentialité que personne n'ouvre.
 *
 * Il n'apparaît pas pour un compte invité : rejoindre des inconnus demande un
 * compte, donc la question n'a pas lieu d'être posée.
 */

const GENRES: { valeur: Genre | null; libelle: string }[] = [
  { valeur: 'femme', libelle: 'Femme' },
  { valeur: 'homme', libelle: 'Homme' },
  { valeur: 'autre', libelle: 'Autre' },
  { valeur: null, libelle: 'Je préfère ne pas le dire' },
];

export function MonProfilDeclare() {
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const userId = identity?.id;

  const enregistre = useQuery({
    queryKey: ['mon-profil', userId],
    queryFn: () => lireMonProfil(userId!),
    enabled: Boolean(userId) && !identity?.isAnonymous,
  });

  const [profil, setProfil] = useState<MonProfil>(PROFIL_VIDE);
  // Ce qui a été chargé la dernière fois, pour ne reprendre la main qu'une
  // fois. Un effet ferait un rendu de plus et écraserait la saisie en cours
  // à chaque revalidation ; ajuster pendant le rendu est le motif que React
  // recommande ici.
  const [charge, setCharge] = useState<MonProfil | null>(null);
  if (enregistre.data && enregistre.data !== charge) {
    setCharge(enregistre.data);
    setProfil(enregistre.data);
  }

  const sauver = useMutation({
    mutationFn: (valeur: MonProfil) => ecrireMonProfil(userId!, valeur),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mon-profil', userId] }),
  });

  if (!userId || identity?.isAnonymous) {
    return (
      <Card>
        <CardBody>
          <p className="text-muted text-sm leading-relaxed">
            Vous êtes connecté en invité. Rejoindre le voyage d’un ami par un lien fonctionne ;
            rejoindre des inconnus demande un compte.
          </p>
        </CardBody>
      </Card>
    );
  }

  const modifie = (champ: Partial<MonProfil>) => {
    const suivant = { ...profil, ...champ };
    setProfil(suivant);
    sauver.mutate(suivant);
  };

  return (
    <Card>
      <CardBody className="space-y-5">
        <p className="text-muted text-sm leading-relaxed">
          Ces deux informations ne servent qu’à appliquer les conditions d’un trip ouvert —
          « entre femmes », « 25-35 ans ». Elles ne servent à rien d’autre, et elles sont
          facultatives : sans elles, vous pouvez rejoindre les groupes mixtes sans condition
          d’âge. Les autres participants ne voient que votre nom et votre présentation ;
          l’organisateur voit en plus ce que vous déclarez ici.
        </p>

        <fieldset className="space-y-2">
          <legend className="etiquette mb-2">Je suis</legend>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(({ valeur, libelle }) => {
              const actif = profil.genre === valeur;
              return (
                <button
                  key={libelle}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => modifie({ genre: valeur })}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                    actif ?
                      'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-200 font-semibold'
                    : 'filet surface-raised text-muted',
                  )}
                >
                  {actif && <Check className="size-3.5" aria-hidden />}
                  {libelle}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block space-y-1.5">
          <span className="etiquette">Année de naissance</span>
          <select
            value={profil.anneeNaissance ?? ''}
            onChange={(event) =>
              modifie({
                anneeNaissance: event.target.value ? Number(event.target.value) : null,
              })
            }
            className="surface-raised h-12 w-full rounded-[var(--radius-card)] border filet px-3
                       text-[16px] outline-none focus:border-brand-500"
          >
            <option value="">Je préfère ne pas la dire</option>
            {anneesProposees().map((annee) => (
              <option key={annee} value={annee}>
                {annee}
              </option>
            ))}
          </select>
        </label>

        {sauver.isError && (
          <p className="text-sm text-red-600">
            Ces informations n’ont pas pu être enregistrées. Réessayez.
          </p>
        )}
        {sauver.isSuccess && !sauver.isPending && (
          <p className="text-muted flex items-center gap-1.5 text-xs">
            <Check className="size-3.5" aria-hidden />
            Enregistré
          </p>
        )}
      </CardBody>
    </Card>
  );
}
