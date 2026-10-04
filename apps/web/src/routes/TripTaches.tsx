import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Plus, Trash2, UserRound } from 'lucide-react';
import {
  dateDuJour,
  etatDeLEcheance,
  periodeLisible,
  resumerLesTaches,
  suggestionsRestantes,
  trierLesTaches,
  type Tache,
} from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ListeFantome } from '@/components/ui/Squelette';
import { TextInput } from '@/components/ui/Field';
import { TitreDePage } from '@/components/TitreDePage';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { cleTaches, getTaches, requeteDesTaches, type ModificationDeTache, type NouvelleTache } from '@/lib/taches';
import { toFailure } from '@/lib/errors';
import { signaler } from '@/lib/feedback';
import { cn } from '@/lib/cn';

/**
 * Qui fait quoi : la liste commune de ce qu'il reste à faire avant de partir.
 *
 * « Qui réserve la voiture ? », « quelqu'un a pris l'assurance ? » — chacun
 * croyait la chose faite par un autre. Une ligne, un responsable, une
 * échéance ; n'importe qui coche ou se l'attribue : c'est une liste
 * d'entraide, pas un outil de contrôle.
 */
export default function TripTaches() {
  const { id } = useParams<{ id: string }>();
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const [seulementLesMiennes, setSeulementLesMiennes] = useState(false);

  // Sans serveur, « moi » est le seul membre local.
  const moi = supabase ? (identity?.id ?? null) : 'moi';
  const aujourdhui = dateDuJour();

  const voyage = useQuery({
    queryKey: cleVoyage(id),
    queryFn: () => getTripRepository().get(id!),
    enabled: Boolean(id),
  });
  const taches = useQuery(requeteDesTaches(id));

  useEffect(() => {
    if (!id) return;
    return getTaches().ecouter(id, () => {
      void queryClient.invalidateQueries({ queryKey: cleTaches(id) });
    });
  }, [id, queryClient]);

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: cleTaches(id) });

  const membres = useMemo(
    () =>
      (voyage.data?.members ?? []).map((membre) => ({
        id: membre.userId,
        nom: membre.userId === moi ? 'Moi' : (membre.displayName ?? 'Un membre'),
      })),
    [voyage.data?.members, moi],
  );
  const nomDe = (userId: string | null | undefined) =>
    !userId ? null : userId === moi ? 'vous' : (membres.find((membre) => membre.id === userId)?.nom ?? 'un membre');

  const ajouter = useMutation({
    mutationFn: (tache: NouvelleTache) => getTaches().ajouter(id!, tache),
    onSuccess: async () => {
      signaler('tape');
      await rafraichir();
    },
  });

  const modifier = useMutation({
    mutationFn: ({ tache, modification }: { tache: Tache; modification: ModificationDeTache }) =>
      getTaches().modifier(tache.id, modification),
    onSuccess: async (_resultat, { modification }) => {
      if (modification.faite) signaler('reussite');
      await rafraichir();
    },
  });

  const supprimer = useMutation({
    mutationFn: (tache: Tache) => getTaches().supprimer(tache.id),
    onSuccess: rafraichir,
  });

  const liste = trierLesTaches(taches.data ?? []);
  const visibles = seulementLesMiennes ? liste.filter((tache) => tache.responsable === moi) : liste;
  const resume = resumerLesTaches(liste, moi, aujourdhui);
  const suggestions = suggestionsRestantes(liste).slice(0, 5);
  const estOrganisateur = Boolean(voyage.data?.isOwner);
  const erreur = ajouter.error ?? modifier.error ?? supprimer.error ?? taches.error;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-5 pt-6 pb-28">
      <Link
        to={`/voyages/${id ?? ''}`}
        className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour au voyage
      </Link>

      <TitreDePage pastille="taches">Qui fait quoi</TitreDePage>

      {liste.length > 0 && (
        <p className="text-muted text-sm">
          {[
            resume.aFaire === 0 ? 'Tout est fait' : `${resume.aFaire} à faire`,
            resume.pourMoi > 0 && `${resume.pourMoi} pour vous`,
            resume.enRetard > 0 && `${resume.enRetard} en retard`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      {erreur && <Banner tone="warning">{toFailure(erreur).message}</Banner>}

      <FormulaireDeTache
        membres={membres}
        enCours={ajouter.isPending}
        surAjouter={(tache) => ajouter.mutate(tache)}
      />

      {liste.length > 0 && (
        <div className="flex gap-2" role="group" aria-label="Filtrer les tâches">
          <Chip selected={!seulementLesMiennes} onClick={() => setSeulementLesMiennes(false)}>
            Toutes
          </Chip>
          <Chip selected={seulementLesMiennes} onClick={() => setSeulementLesMiennes(true)}>
            Les miennes
          </Chip>
        </div>
      )}

      {taches.isPending && <ListeFantome combien={3} lignes={1} />}

      <ul className="space-y-2">
        {visibles.map((tache) => (
          <li key={tache.id}>
            <LigneDeTache
              tache={tache}
              aujourdhui={aujourdhui}
              responsable={nomDe(tache.responsable)}
              faitePar={nomDe(tache.faitePar)}
              retirable={!supabase || estOrganisateur || tache.creePar === moi}
              surCocher={() => modifier.mutate({ tache, modification: { faite: !tache.faite } })}
              {...(!tache.responsable && moi
                ? { surMAttribuer: () => modifier.mutate({ tache, modification: { responsable: moi } }) }
                : {})}
              surRetirer={() => supprimer.mutate(tache)}
            />
          </li>
        ))}
      </ul>

      {seulementLesMiennes && visibles.length === 0 && liste.length > 0 && (
        <p className="text-muted py-4 text-center text-sm">Rien ne vous est confié pour l’instant.</p>
      )}

      {/* Après la liste : ce qu'on a déjà prévu compte plus que ce qu'on
          pourrait oublier. */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="etiquette text-muted">Souvent oublié</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => ajouter.mutate({ titre: suggestion })}
                className="hover:border-brand-500 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-dashed border-[color:var(--border-subtle)] px-3 text-sm"
              >
                <Plus className="size-3.5" aria-hidden />
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function FormulaireDeTache({
  membres,
  enCours,
  surAjouter,
}: {
  membres: { id: string; nom: string }[];
  enCours: boolean;
  surAjouter: (tache: NouvelleTache) => void;
}) {
  const [titre, setTitre] = useState('');
  const [responsable, setResponsable] = useState('');
  const [echeance, setEcheance] = useState('');

  function envoyer(event: FormEvent) {
    event.preventDefault();
    if (!titre.trim()) return;
    surAjouter({ titre, responsable: responsable || null, echeance: echeance || null });
    setTitre('');
    setEcheance('');
  }

  return (
    <Card>
      <CardBody>
        <form className="space-y-2.5" onSubmit={envoyer}>
          <TextInput
            aria-label="Nouvelle tâche"
            placeholder="Réserver la voiture, prendre l’assurance…"
            value={titre}
            maxLength={200}
            onChange={(event) => setTitre(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Qui s’en charge"
              value={responsable}
              onChange={(event) => setResponsable(event.target.value)}
              className="h-12 w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 text-sm"
            >
              <option value="">Personne encore</option>
              {membres.map((membre) => (
                <option key={membre.id} value={membre.id}>
                  {membre.nom}
                </option>
              ))}
            </select>
            <TextInput
              type="date"
              aria-label="Avant le"
              value={echeance}
              onChange={(event) => setEcheance(event.target.value)}
            />
          </div>
          <Button type="submit" block loading={enCours} disabled={!titre.trim()} icon={<Plus className="size-4" aria-hidden />}>
            Ajouter
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function LigneDeTache({
  tache,
  aujourdhui,
  responsable,
  faitePar,
  retirable,
  surCocher,
  surMAttribuer,
  surRetirer,
}: {
  tache: Tache;
  aujourdhui: string;
  responsable: string | null;
  faitePar: string | null;
  retirable: boolean;
  surCocher: () => void;
  surMAttribuer?: () => void;
  surRetirer: () => void;
}) {
  const etat = tache.faite ? null : etatDeLEcheance(tache.echeance, aujourdhui);
  const echeance = tache.echeance ? periodeLisible(tache.echeance, tache.echeance) : null;

  const details = tache.faite
    ? [faitePar && `Fait par ${faitePar}`]
    : [
        responsable ? (responsable === 'vous' ? 'Pour vous' : `Pour ${responsable}`) : 'Personne encore',
        echeance && (etat === 'en-retard' ? `en retard, prévu ${echeance}` : etat === 'aujourdhui' ? 'aujourd’hui' : `avant ${echeance}`),
      ];

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border bg-[color:var(--surface)] py-1 pr-1 pl-2',
        etat === 'en-retard' ? 'border-red-400/60' : 'border-[color:var(--border-subtle)]',
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={tache.faite}
        aria-label={tache.titre}
        onClick={surCocher}
        className="grid size-11 shrink-0 place-items-center"
      >
        <span
          aria-hidden
          className={cn(
            'grid size-6 place-items-center rounded-md border-2',
            tache.faite ? 'bg-brand-500 border-brand-500 text-white' : 'border-[color:var(--text-muted)]',
          )}
        >
          {tache.faite && <Check className="size-4" />}
        </span>
      </button>
      <div className="min-w-0 flex-1 py-1.5">
        <p className={cn('text-sm font-medium', tache.faite && 'text-muted line-through')}>{tache.titre}</p>
        <p className={cn('text-xs', etat === 'en-retard' ? 'text-red-600 dark:text-red-400' : 'text-muted')}>
          {details.filter(Boolean).join(' · ')}
        </p>
      </div>
      {surMAttribuer && !tache.faite && (
        <button
          type="button"
          onClick={surMAttribuer}
          className="text-brand-600 dark:text-brand-300 inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-xs font-semibold"
        >
          <UserRound className="size-3.5" aria-hidden />
          Je m’en occupe
        </button>
      )}
      {retirable && (
        <button
          type="button"
          aria-label={`Retirer « ${tache.titre} »`}
          onClick={surRetirer}
          className="text-muted grid size-11 shrink-0 place-items-center hover:text-red-600"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
