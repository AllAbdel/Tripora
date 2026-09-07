import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { LIBELLES_CATEGORIE } from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { TextInput } from '@/components/ui/Field';
import { FicheApplication } from '@/components/FicheApplication';
import { getApps } from '@/lib/apps';
import { toFailure } from '@/lib/errors';

/**
 * La file d'attente de modération.
 *
 * Une proposition arrive telle qu'elle sera lue : on relit exactement ce que
 * les autres verront, pas un formulaire. Publier la rend visible de tous ;
 * l'écarter demande une raison, qui remonte à son auteur — être refusé sans
 * savoir pourquoi décourage de proposer une deuxième fois.
 *
 * L'écran n'est pas secret, seulement inutile pour les autres : les politiques
 * de la base ne renvoient rien à qui n'est pas administrateur, et une mise à
 * jour tentée depuis ici échouerait côté serveur. La vérification côté client
 * ne sert qu'à ne pas afficher une page vide sans explication.
 */
export default function ModerationApps() {
  const api = getApps();
  const queryClient = useQueryClient();

  const jeModere = useQuery({
    queryKey: ['suis-je-admin'],
    queryFn: () => api!.amIAdmin(),
    enabled: Boolean(api),
    staleTime: 60 * 60 * 1000,
  });

  const attente = useQuery({
    queryKey: ['applications-en-attente'],
    queryFn: () => api!.listPending(),
    enabled: Boolean(api) && jeModere.data === true,
  });

  const rafraichir = async () => {
    await queryClient.invalidateQueries({ queryKey: ['applications-en-attente'] });
    await queryClient.invalidateQueries({ queryKey: ['applications-publiees'] });
  };

  const publier = useMutation({
    mutationFn: (id: string) => api!.publish(id),
    onSuccess: rafraichir,
  });

  const ecarter = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api!.reject(id, note),
    onSuccess: rafraichir,
  });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pt-4 pb-28">
      <div className="flex items-center gap-2">
        <Link
          to="/profil"
          aria-label="Retour au profil"
          className="hover:bg-brand-50 dark:hover:bg-ink-700/40 -ml-2 grid size-11 place-items-center rounded-full"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-lg font-semibold">Propositions d’applications</h1>
      </div>

      {jeModere.isPending && (
        <div className="flex justify-center py-10">
          <Loader2 className="text-brand-500 size-6 animate-spin" aria-label="Chargement" />
        </div>
      )}

      {jeModere.data === false && (
        <Banner tone="info" title="Réservé à la modération">
          Cet écran sert à relire les applications proposées par les membres. Votre compte n’en a
          pas la charge.
        </Banner>
      )}

      {jeModere.data === true && attente.data?.length === 0 && (
        <EmptyState
          illustration={<ShieldCheck className="text-brand-500 size-10" aria-hidden />}
          title="Rien à relire"
          description="Toutes les propositions ont été traitées. Les nouvelles arriveront ici."
        />
      )}

      {(publier.isError || ecarter.isError) && (
        <Banner tone="warning" title="Action refusée">
          {toFailure(publier.error ?? ecarter.error).message}
        </Banner>
      )}

      {(attente.data ?? []).map((app) => (
        <LigneAModerer
          key={app.id}
          nom={app.name}
          rubrique={LIBELLES_CATEGORIE[app.category]}
          portee={decrirePortee(app.countryCodes, app.destinationIds)}
          fiche={<FicheApplication app={app} />}
          occupe={publier.isPending || ecarter.isPending}
          onPublier={() => publier.mutate(app.id)}
          onEcarter={(note) => ecarter.mutate({ id: app.id, note })}
        />
      ))}
    </div>
  );
}

function decrirePortee(pays: readonly string[], villes: readonly string[]): string {
  if (villes.length > 0) return `Ville : ${villes.join(', ')}`;
  if (pays.length > 0) return `Pays : ${pays.join(', ')}`;
  return 'Partout';
}

function LigneAModerer({
  nom,
  rubrique,
  portee,
  fiche,
  occupe,
  onPublier,
  onEcarter,
}: {
  nom: string;
  rubrique: string;
  portee: string;
  fiche: React.ReactNode;
  occupe: boolean;
  onPublier: () => void;
  onEcarter: (note: string) => void;
}) {
  const [raison, setRaison] = useState('');
  const [refus, setRefus] = useState(false);

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-muted text-xs font-medium">
          {rubrique} · {portee}
        </p>
        {fiche}

        {refus ? (
          <div className="space-y-2">
            <TextInput
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              placeholder="Pourquoi ? L’auteur le lira."
              maxLength={600}
            />
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                loading={occupe}
                onClick={() => onEcarter(raison)}
              >
                Écarter {nom}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRefus(false)}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={occupe}
              icon={<Check className="size-4" aria-hidden />}
              onClick={onPublier}
            >
              Publier
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<X className="size-4" aria-hidden />}
              onClick={() => setRefus(true)}
            >
              Écarter
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
