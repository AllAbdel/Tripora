import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import {
  getTripsOuverts,
  lireLErreur,
  MOTIFS_DE_SIGNALEMENT,
  type MotifDeSignalement,
} from '@/lib/tripsOuverts';
import { signaler as retour } from '@/lib/feedback';
import { cn } from '@/lib/cn';

/**
 * Se protéger de quelqu'un.
 *
 * Deux gestes, et ils ne se valent pas.
 *
 * **Bloquer** est immédiat et ne dépend de personne : la personne disparaît
 * des trips ouverts, dans les deux sens, et rien ne le lui dit. C'est le geste
 * qu'on doit pouvoir faire en une seconde, sur le trottoir, sans rédiger quoi
 * que ce soit.
 *
 * **Signaler** remonte à l'administration, qui peut retirer quelqu'un des trips
 * ouverts. On ne peut signaler que quelqu'un avec qui on a eu affaire — sinon
 * le signalement deviendrait une arme contre des inconnus. Il bloque par
 * défaut : quelqu'un qui prend la peine de signaler veut, presque toujours,
 * aussi ne plus voir la personne.
 *
 * Le composant est discret à dessein. Un bouton rouge sur chaque fiche
 * dirait « méfiez-vous de tout le monde » ; un lien sobre dit « c'est là si
 * vous en avez besoin ».
 */
export function SignalerOuBloquer({
  userId,
  nom,
  tripId,
}: {
  userId: string;
  nom: string;
  tripId?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState<MotifDeSignalement | null>(null);
  const [detail, setDetail] = useState('');
  const [bloquerAussi, setBloquerAussi] = useState(true);
  const [fait, setFait] = useState<'signale' | 'bloque' | null>(null);
  const queryClient = useQueryClient();
  const ouverts = getTripsOuverts();

  const apres = () => {
    void queryClient.invalidateQueries({ queryKey: ['candidatures'] });
    void queryClient.invalidateQueries({ queryKey: ['mes-blocages'] });
    void queryClient.invalidateQueries({ queryKey: ['trips-ouverts'] });
  };

  const envoyer = useMutation({
    mutationFn: () => ouverts.signaler(userId, motif!, detail, tripId, bloquerAussi),
    onSuccess: () => {
      retour('decision');
      setFait('signale');
      setOuvert(false);
      apres();
    },
    onError: () => retour('echec'),
  });

  const bloquer = useMutation({
    mutationFn: () => ouverts.bloquer(userId),
    onSuccess: () => {
      retour('tape');
      setFait('bloque');
      apres();
    },
  });

  if (fait) {
    return (
      <p role="status" className="text-muted text-xs">
        {fait === 'signale' ?
          `Signalement envoyé${bloquerAussi ? `, et ${nom} est bloqué·e` : ''}. Merci : c’est comme ça que les trips ouverts restent sûrs.`
        : `${nom} est bloqué·e. Vous ne vous croiserez plus dans les trips ouverts.`}
      </p>
    );
  }

  if (!ouvert) {
    return (
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="text-muted inline-flex items-center gap-1.5 text-xs underline-offset-2 hover:underline"
        >
          <Flag className="size-3.5" aria-hidden />
          Signaler
        </button>
        <button
          type="button"
          disabled={bloquer.isPending}
          onClick={() => {
            if (window.confirm(`Bloquer ${nom} ? Vous ne vous verrez plus dans les trips ouverts.`)) {
              bloquer.mutate();
            }
          }}
          className="text-muted inline-flex items-center gap-1.5 text-xs underline-offset-2 hover:underline"
        >
          <ShieldOff className="size-3.5" aria-hidden />
          Bloquer
        </button>
      </div>
    );
  }

  return (
    <div className="filet space-y-3 border-t pt-3">
      <p className="text-sm font-semibold">Signaler {nom}</p>

      <fieldset className="space-y-1.5">
        <legend className="sr-only">Ce qui s’est passé</legend>
        {MOTIFS_DE_SIGNALEMENT.map((option) => (
          <label
            key={option.valeur}
            className={cn(
              'flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-card)] border px-3 py-2 text-sm',
              motif === option.valeur ? 'border-brand-500 bg-brand-500/8' : 'filet',
            )}
          >
            <input
              type="radio"
              name={`motif-${userId}`}
              value={option.valeur}
              checked={motif === option.valeur}
              onChange={() => setMotif(option.valeur)}
              className="accent-brand-500"
            />
            {option.libelle}
          </label>
        ))}
      </fieldset>

      <textarea
        aria-label="Ce qui s’est passé, en quelques mots"
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Ce qui s’est passé, en quelques mots. Facultatif, mais ça aide à trancher."
        className="surface-raised w-full rounded-[var(--radius-card)] border filet p-3 text-[16px]
                   outline-none focus:border-brand-500"
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={bloquerAussi}
          onChange={(event) => setBloquerAussi(event.target.checked)}
          className="accent-brand-500"
        />
        Bloquer aussi {nom}
      </label>

      <p className="text-muted text-xs leading-relaxed">
        {nom} ne saura pas que vous l’avez signalé·e. Le signalement est lu par l’administration
        de Tripora, qui peut retirer la personne des trips ouverts.
      </p>

      {envoyer.error && <Banner tone="warning">{lireLErreur(envoyer.error)}</Banner>}

      <div className="flex gap-2">
        <Button size="sm" disabled={!motif} loading={envoyer.isPending} onClick={() => envoyer.mutate()}>
          Envoyer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOuvert(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
