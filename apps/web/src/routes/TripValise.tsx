import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Plus, Settings2, Undo2, Users, X } from 'lucide-react';
import {
  BESOINS,
  LIBELLES_BESOIN,
  LIBELLES_RUBRIQUE,
  PROFIL_PAR_DEFAUT,
  RUBRIQUES_VALISE,
  findDestination,
  preparerLaValise,
  type ArticleValise,
  type Besoin,
  type ProfilValise,
  type RubriqueValise,
} from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { TextInput } from '@/components/ui/Field';
import { Icone } from '@/components/Icone';
import { ListeFantome } from '@/components/ui/Squelette';
import { getValise, identifiantPersonnel, type EtatArticle } from '@/lib/packing';
import { getTripRepository } from '@/lib/trips';
import { useAuth } from '@/lib/auth-context';
import { signaler } from '@/lib/feedback';
import { toFailure } from '@/lib/errors';
import { cn } from '@/lib/cn';

/**
 * « Aide-moi à préparer ma valise ».
 *
 * La liste n'est pas stockée : elle se recalcule à chaque ouverture depuis la
 * ville, le mois, la durée et les envies du groupe. Ce qui se stocke, ce sont
 * les décisions — coché, écarté, quantité corrigée, article ajouté.
 *
 * Chaque ligne porte son pourquoi, et c'est le cœur de la fonctionnalité :
 * « 4 t-shirts » ne se discute pas, « 4 t-shirts — 6 jours avec une lessive à
 * mi-séjour » se discute. La liste est un point de départ, pas un ordre, et on
 * peut écarter n'importe quoi d'un geste.
 *
 * Les articles marqués « à se partager » sont l'autre moitié de l'idée : à
 * quatre, emporter quatre trousses à pharmacie et quatre adaptateurs est une
 * erreur que personne ne remarque avant d'avoir porté les sacs.
 */
export default function TripValise() {
  const { id } = useParams<{ id: string }>();
  const { identity } = useAuth();
  const api = getValise();
  const repo = getTripRepository();
  const queryClient = useQueryClient();
  const [reglagesOuverts, setReglagesOuverts] = useState(false);

  const voyage = useQuery({
    queryKey: ['trip', id],
    queryFn: () => repo.get(id!),
    enabled: Boolean(id),
  });

  const etats = useQuery({
    queryKey: ['valise', id],
    queryFn: () => api!.list(id!),
    enabled: Boolean(id && api),
  });

  const profilEnregistre = useQuery({
    queryKey: ['valise-profil', id],
    queryFn: () => api!.loadProfile(id!),
    enabled: Boolean(id && api),
  });

  // Sans serveur, la valise reste utilisable : elle se calcule, elle ne se
  // coche simplement pas d'un appareil à l'autre.
  const [profilLocal, setProfilLocal] = useState<ProfilValise>(PROFIL_PAR_DEFAUT);
  const profil = profilEnregistre.data ?? profilLocal;

  useEffect(() => {
    if (!id || !api) return;
    return api.watch(id, () => {
      void queryClient.invalidateQueries({ queryKey: ['valise', id] });
    });
  }, [id, api, queryClient]);

  const enregistrerProfil = useMutation({
    mutationFn: (valeur: ProfilValise) => api!.saveProfile(id!, valeur),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['valise-profil', id] }),
  });

  const changerProfil = (valeur: ProfilValise) => {
    setProfilLocal(valeur);
    if (api) enregistrerProfil.mutate(valeur);
  };

  const modifier = useMutation({
    mutationFn: ({ itemId, valeurs }: { itemId: string; valeurs: Partial<EtatArticle> }) =>
      api!.set(id!, itemId, valeurs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['valise', id] }),
    onError: () => signaler('echec'),
  });

  const oublier = useMutation({
    mutationFn: (itemId: string) => api!.reset(id!, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['valise', id] }),
  });

  const destination = voyage.data?.lockedDestinationId
    ? findDestination(voyage.data.lockedDestinationId)
    : undefined;

  const mesEtats = useMemo(() => {
    const table = new Map<string, EtatArticle>();
    for (const etat of etats.data ?? []) {
      if (etat.userId === identity?.id) table.set(etat.itemId, etat);
    }
    return table;
  }, [etats.data, identity?.id]);

  /** Les prises en charge des autres : « quelqu'un s'en occupe déjà ». */
  const parLeGroupe = useMemo(() => {
    const table = new Map<string, string>();
    for (const etat of etats.data ?? []) {
      if (etat.forGroup && etat.userId !== identity?.id) {
        const membre = voyage.data?.members.find((m) => m.userId === etat.userId);
        table.set(etat.itemId, membre?.displayName ?? 'Quelqu’un');
      }
    }
    return table;
  }, [etats.data, identity?.id, voyage.data?.members]);

  const rubriques = useMemo(() => {
    if (!voyage.data || !destination) return [];
    const mesEnvies = voyage.data.members.find((m) => m.userId === identity?.id)?.weights;
    const calculees = preparerLaValise({
      destination,
      constraints: voyage.data.constraints,
      ...(mesEnvies ? { envies: mesEnvies } : {}),
      profil,
    });

    // Les ajouts personnels rejoignent leur rubrique, à la fin.
    const ajouts: ArticleValise[] = [];
    for (const etat of mesEtats.values()) {
      if (!etat.itemId.startsWith('perso:') || !etat.label) continue;
      ajouts.push({
        id: etat.itemId,
        label: etat.label,
        rubrique: (etat.category ?? 'divers') as RubriqueValise,
        quantite: etat.quantity,
        pourquoi: 'Ajouté par vous.',
        essentiel: false,
        partageable: false,
      });
    }

    const parRubrique = new Map(calculees.map((groupe) => [groupe.rubrique, [...groupe.articles]]));
    for (const ajout of ajouts) {
      const liste = parRubrique.get(ajout.rubrique);
      if (liste) liste.push(ajout);
      else parRubrique.set(ajout.rubrique, [ajout]);
    }

    return RUBRIQUES_VALISE.map((rubrique) => ({
      rubrique,
      libelle: LIBELLES_RUBRIQUE[rubrique],
      articles: (parRubrique.get(rubrique) ?? []).filter(
        (entree) => !mesEtats.get(entree.id)?.removed,
      ),
    })).filter((groupe) => groupe.articles.length > 0);
  }, [voyage.data, destination, identity?.id, profil, mesEtats]);

  const total = rubriques.reduce((somme, groupe) => somme + groupe.articles.length, 0);
  const coches = rubriques.reduce(
    (somme, groupe) =>
      somme + groupe.articles.filter((entree) => mesEtats.get(entree.id)?.checked).length,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pt-4 pb-28">
      <div className="flex items-center gap-2">
        <Link
          to={`/voyages/${id}`}
          aria-label="Retour au voyage"
          className="hover:bg-brand-50 dark:hover:bg-ink-700/40 -ml-2 grid size-11 place-items-center rounded-full"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">Ma valise</h1>
          {destination && (
            <p className="text-muted truncate text-sm">
              {destination.name} · {voyage.data?.constraints.durationDays} jours
            </p>
          )}
        </div>
        {total > 0 && (
          <span className="text-muted shrink-0 text-sm font-medium tabular-nums">
            {coches} / {total}
          </span>
        )}
      </div>

      {voyage.isPending && <ListeFantome combien={3} />}

      {voyage.data && !destination && (
        <Banner tone="info" title="Destination pas encore arrêtée">
          La liste dépend du climat et de la durée sur place. Dès que le groupe aura verrouillé une
          ville, elle se remplira toute seule — inutile de deviner d’ici là.
        </Banner>
      )}

      {!api && destination && (
        <Banner tone="offline" title="Mode local">
          La liste se calcule normalement, mais les cases cochées ne suivront pas d’un appareil à
          l’autre et le groupe ne verra pas ce que vous emportez pour tout le monde.
        </Banner>
      )}

      {destination && (
        <>
          <Card>
            <CardBody className="space-y-3">
              <button
                type="button"
                onClick={() => setReglagesOuverts((ouvert) => !ouvert)}
                className="flex min-h-9 w-full items-center gap-2 text-left"
              >
                <Settings2 className="text-brand-500 size-4 shrink-0" aria-hidden />
                <span className="flex-1 text-sm font-semibold">Ce que je ne peux pas deviner</span>
                <span className="text-muted text-xs">{reglagesOuverts ? 'Fermer' : 'Ouvrir'}</span>
              </button>

              {reglagesOuverts ? (
                <Reglages profil={profil} onChange={changerProfil} />
              ) : (
                <p className="text-muted text-sm leading-relaxed">
                  Lentilles, traitement, protections périodiques, lessive sur place, bagage
                  cabine… Cochez ce qui vous concerne et la liste s’ajuste.
                </p>
              )}
            </CardBody>
          </Card>

          {rubriques.map((groupe) => (
            <Card key={groupe.rubrique}>
              <CardBody className="space-y-1">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Icone
                    nom={
                      RUBRIQUES_VALISE.includes(groupe.rubrique)
                        ? ICONES[groupe.rubrique]
                        : 'divers'
                    }
                    className="text-brand-500 size-4"
                  />
                  {groupe.libelle}
                </h2>
                <ul className="divide-y divide-[color:var(--border-subtle)]">
                  {groupe.articles.map((entree) => (
                    <li key={entree.id}>
                      <Ligne
                        article={entree}
                        etat={mesEtats.get(entree.id)}
                        prisParQui={parLeGroupe.get(entree.id)}
                        onCocher={(checked) =>
                          modifier.mutate({ itemId: entree.id, valeurs: { checked } })
                        }
                        onEcarter={() =>
                          modifier.mutate({ itemId: entree.id, valeurs: { removed: true } })
                        }
                        onPourLeGroupe={(forGroup) =>
                          modifier.mutate({ itemId: entree.id, valeurs: { forGroup } })
                        }
                        desactive={!api}
                      />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}

          {[...mesEtats.values()].some((etat) => etat.removed) && (
            <button
              type="button"
              onClick={() => {
                for (const etat of mesEtats.values()) {
                  if (etat.removed) oublier.mutate(etat.itemId);
                }
              }}
              className="text-muted inline-flex min-h-11 items-center gap-2 text-sm underline"
            >
              <Undo2 className="size-4" aria-hidden />
              Remettre ce que j’ai écarté
            </button>
          )}

          <Ajout
            desactive={!api}
            onAjouter={(label, rubrique) =>
              modifier.mutate({
                itemId: identifiantPersonnel(label),
                valeurs: { label, category: rubrique, checked: false, removed: false },
              })
            }
          />

          {modifier.isError && (
            <Banner tone="warning" title="Modification non enregistrée">
              {toFailure(modifier.error).message}
            </Banner>
          )}
        </>
      )}
    </div>
  );
}

const ICONES: Record<RubriqueValise, Parameters<typeof Icone>[0]['nom']> = {
  papiers: 'papiers',
  vetements: 'vetements',
  chaussures: 'chaussures',
  toilette: 'toilette',
  sante: 'sante',
  electronique: 'electronique',
  activites: 'aventure',
  divers: 'divers',
};

/**
 * Une ligne de la liste.
 *
 * La case à cocher occupe toute la ligne : c'est le geste qu'on répète trente
 * fois, il doit être atteignable sans viser. L'explication est toujours
 * visible — la cacher derrière un repli reviendrait à donner un ordre.
 */
function Ligne({
  article,
  etat,
  prisParQui,
  onCocher,
  onEcarter,
  onPourLeGroupe,
  desactive,
}: {
  article: ArticleValise;
  etat: EtatArticle | undefined;
  /** Nom de la personne qui l'emporte déjà pour tout le monde, s'il y en a une. */
  prisParQui: string | undefined;
  onCocher: (checked: boolean) => void;
  onEcarter: () => void;
  onPourLeGroupe: (forGroup: boolean) => void;
  desactive: boolean;
}) {
  const coche = etat?.checked ?? false;
  const quantite = etat?.quantity ?? article.quantite;

  return (
    <div className="flex items-start gap-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={coche}
        disabled={desactive}
        onClick={() => {
          signaler('tape');
          onCocher(!coche);
        }}
        className={cn(
          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors',
          coche
            ? 'border-brand-500 bg-brand-500 text-[color:var(--accent-contrast)]'
            : 'border-[color:var(--border-subtle)]',
          desactive && 'opacity-50',
        )}
      >
        {coche && <Check className="size-4" aria-hidden />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', coche && 'text-muted line-through')}>
          {quantite !== null && <span className="tabular-nums">{quantite} </span>}
          {article.label}
          {article.essentiel && !coche && (
            <span className="text-gold-700 dark:text-gold-400 ml-1.5 text-[0.65rem] font-bold tracking-wide uppercase">
              essentiel
            </span>
          )}
        </p>
        <p className="text-muted mt-0.5 text-xs leading-snug">{article.pourquoi}</p>

        {prisParQui && (
          <p className="text-lagoon-700 dark:text-lagoon-300 mt-1 flex items-center gap-1.5 text-xs font-medium">
            <Users className="size-3.5 shrink-0" aria-hidden />
            {prisParQui} l’emporte pour le groupe
          </p>
        )}

        {article.partageable && !prisParQui && !desactive && (
          <button
            type="button"
            onClick={() => onPourLeGroupe(!etat?.forGroup)}
            className={cn(
              'mt-1 inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
              etat?.forGroup
                ? 'border-lagoon-500 text-lagoon-700 dark:text-lagoon-300'
                : 'text-muted border-[color:var(--border-subtle)]',
            )}
          >
            <Users className="size-3.5" aria-hidden />
            {etat?.forGroup ? 'Je l’emporte pour le groupe' : 'Un seul suffit pour tout le monde'}
          </button>
        )}
      </div>

      {!desactive && (
        <button
          type="button"
          onClick={onEcarter}
          aria-label={`Écarter ${article.label}`}
          className="text-muted hover:text-[color:var(--text-strong)] -mr-1 grid size-8 shrink-0 place-items-center rounded-full"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Les besoins que le calcul ne peut pas deviner, à cocher soi-même. */
function Reglages({
  profil,
  onChange,
}: {
  profil: ProfilValise;
  onChange: (valeur: ProfilValise) => void;
}) {
  const basculer = (besoin: Besoin) => {
    const dedans = profil.besoins.includes(besoin);
    onChange({
      ...profil,
      besoins: dedans
        ? profil.besoins.filter((entree) => entree !== besoin)
        : [...profil.besoins, besoin],
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {BESOINS.map((besoin) => (
          <Chip
            key={besoin}
            selected={profil.besoins.includes(besoin)}
            onClick={() => basculer(besoin)}
          >
            {LIBELLES_BESOIN[besoin]}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip
          selected={profil.lessivePossible}
          onClick={() => onChange({ ...profil, lessivePossible: !profil.lessivePossible })}
        >
          Lessive sur place
        </Chip>
        <Chip
          selected={profil.cabineSeulement}
          onClick={() => onChange({ ...profil, cabineSeulement: !profil.cabineSeulement })}
        >
          Bagage cabine seul
        </Chip>
      </div>

      <p className="text-muted text-xs leading-relaxed">
        Tripora ne demande le genre de personne : ces cases sont des besoins, pas des catégories.
        Une liste fondée sur le genre se tromperait pour beaucoup de gens, et raterait de toute
        façon les lentilles ou un traitement quotidien. Ce que vous cochez ici n’est visible que
        de vous.
      </p>
    </div>
  );
}

/** L'ajout à la main : aucun calcul ne connaît la robe du mariage. */
function Ajout({
  onAjouter,
  desactive,
}: {
  onAjouter: (label: string, rubrique: RubriqueValise) => void;
  desactive: boolean;
}) {
  const [label, setLabel] = useState('');
  const [rubrique, setRubrique] = useState<RubriqueValise>('divers');

  if (desactive) return null;

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-sm font-semibold">Ajouter quelque chose</p>
        <TextInput
          value={label}
          onChange={(evenement) => setLabel(evenement.target.value)}
          placeholder="Le cadeau pour Léa, la robe du mariage…"
          maxLength={80}
        />
        <div className="flex flex-wrap gap-2">
          {RUBRIQUES_VALISE.map((entree) => (
            <Chip key={entree} selected={rubrique === entree} onClick={() => setRubrique(entree)}>
              {LIBELLES_RUBRIQUE[entree]}
            </Chip>
          ))}
        </div>
        <Button
          icon={<Plus className="size-4" aria-hidden />}
          disabled={label.trim().length < 2}
          onClick={() => {
            signaler('reussite');
            onAjouter(label.trim(), rubrique);
            setLabel('');
          }}
        >
          Ajouter
        </Button>
      </CardBody>
    </Card>
  );
}
