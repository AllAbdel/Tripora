import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AvisDuGroupe, ComptesDAvis } from '@tripora/core';
import { signaler } from './feedback';
import { supabase } from './supabase';

/**
 * Qui a envie de quoi, activité par activité.
 *
 * Le carnet proposait une liste classée par les envies générales du groupe —
 * « nature 0,8, culture 0,4 » — sans que personne puisse dire « moi, le
 * Batur, j'y tiens » ou « le lever à deux heures du matin, sans moi ». C'est
 * pourtant ainsi qu'un groupe s'organise vraiment : on se passe le téléphone
 * et chacun pointe ce qui lui plaît.
 *
 * Deux gestes, et rien de plus : « j'ai envie » et « sans moi ». Pas de note
 * sur cinq, pas de classement à faire : on veut savoir ce qui rassemble et ce
 * qui divise, pas mesurer l'enthousiasme au dixième.
 *
 * Les avis vivent dans la table `votes`, avec le sujet `place` que le schéma
 * prévoyait depuis le premier jour. Les règles de sécurité y sont déjà les
 * bonnes : chacun lit les avis de son groupe, et n'écrit que les siens.
 */

export type Avis = 'envie' | 'sans-moi';

export interface AvisSurUneActivite {
  /** Les identifiants des membres qui en ont envie. */
  pour: string[];
  /** Ceux qui s'en passeraient. */
  contre: string[];
  /** Ce que la personne connectée a dit, s'il y a lieu. */
  moi: Avis | null;
}

export interface EnviesDuGroupe {
  /**
   * Par identifiant d'activité du carnet (« bali/batur »). Un objet simple,
   * pas une `Map` : le cache de requêtes est persisté en JSON.
   */
  parActivite: Record<string, AvisSurUneActivite>;
  /** Combien de personnes distinctes se sont exprimées. */
  votants: number;
}

export interface EnviesApi {
  lister(tripId: string, userId: string): Promise<EnviesDuGroupe>;
  poser(tripId: string, activiteId: string, avis: Avis | null): Promise<void>;
  ecouter(tripId: string, surChangement: () => void): () => void;
}

const VERS_VOTE: Record<Avis, 'like' | 'dislike'> = { envie: 'like', 'sans-moi': 'dislike' };

/** Une ligne de `votes`, lue sans lui faire confiance. */
interface LigneDeVote {
  subject_id?: unknown;
  user_id?: unknown;
  value?: unknown;
}

/**
 * Le dépouillement.
 *
 * Exporté pour être testé : c'est la frontière entre ce que la base renvoie et
 * ce que l'écran affiche. Un « favori » laissé par une version future compte
 * comme une envie ; toute autre valeur est ignorée plutôt que devinée.
 */
export function depouiller(lignes: readonly LigneDeVote[], moi: string): EnviesDuGroupe {
  const parActivite: Record<string, AvisSurUneActivite> = {};
  const votants = new Set<string>();

  for (const ligne of lignes) {
    if (typeof ligne.subject_id !== 'string' || typeof ligne.user_id !== 'string') continue;
    const avis: Avis | null =
      ligne.value === 'like' || ligne.value === 'favorite'
        ? 'envie'
        : ligne.value === 'dislike'
          ? 'sans-moi'
          : null;
    if (!avis) continue;

    const actuel = parActivite[ligne.subject_id] ?? { pour: [], contre: [], moi: null };
    if (avis === 'envie') actuel.pour.push(ligne.user_id);
    else actuel.contre.push(ligne.user_id);
    if (ligne.user_id === moi) actuel.moi = avis;
    parActivite[ligne.subject_id] = actuel;
    votants.add(ligne.user_id);
  }

  return { parActivite, votants: votants.size };
}

/**
 * Les avis sous la forme que le moteur de remplissage attend : par
 * identifiant de lieu (« activite:bali/batur »), en simples comptes.
 */
export function avisPourLeRemplissage(
  envies: EnviesDuGroupe | undefined,
): Record<string, AvisDuGroupe> {
  const avis: Record<string, AvisDuGroupe> = {};
  for (const [activiteId, detail] of Object.entries(envies?.parActivite ?? {})) {
    avis[`activite:${activiteId}`] = { pour: detail.pour.length, contre: detail.contre.length };
  }
  return avis;
}

/**
 * « Inès et Karim », « Inès, Karim et 2 autres ».
 *
 * Les prénoms plutôt qu'un chiffre : dans un groupe d'amis, savoir *qui* veut
 * aller au spectacle décide souvent plus que savoir *combien*.
 */
export function nommer(ids: readonly string[], noms: ReadonlyMap<string, string>, moi: string): string {
  const prenoms = ids.map((id) => (id === moi ? 'vous' : (noms.get(id) ?? 'quelqu’un')));
  // « vous » d'abord : c'est la première chose qu'on cherche des yeux.
  prenoms.sort((a, b) => (a === 'vous' ? -1 : b === 'vous' ? 1 : 0));
  if (prenoms.length <= 2) return prenoms.join(' et ');
  const reste = prenoms.length - 2;
  return `${prenoms[0]}, ${prenoms[1]} et ${reste} autre${reste > 1 ? 's' : ''}`;
}

/**
 * L'avis de `moi` remplacé par `valeur`, sans toucher à celui des autres.
 *
 * Exporté pour être testé : c'est la mise à jour optimiste, celle qui fait
 * répondre le cœur avant le réseau. Une erreur ici, et un avis s'afficherait
 * en double jusqu'au rechargement.
 */
export function basculer(
  envies: EnviesDuGroupe | undefined,
  activiteId: string,
  moi: string,
  valeur: Avis | null,
): EnviesDuGroupe {
  const parActivite = { ...(envies?.parActivite ?? {}) };
  const actuel = parActivite[activiteId] ?? { pour: [], contre: [], moi: null };
  const sansMoi = {
    pour: actuel.pour.filter((qui) => qui !== moi),
    contre: actuel.contre.filter((qui) => qui !== moi),
  };
  parActivite[activiteId] = {
    pour: valeur === 'envie' ? [...sansMoi.pour, moi] : sansMoi.pour,
    contre: valeur === 'sans-moi' ? [...sansMoi.contre, moi] : sansMoi.contre,
    moi: valeur,
  };
  const votants = new Set(Object.values(parActivite).flatMap((d) => [...d.pour, ...d.contre]));
  return { parActivite, votants: votants.size };
}

/* ------------------------------------------------------------ Mode local -- */

const CLE_LOCALE = 'tripora.local-envies';

function lireLocal(): Record<string, Record<string, Avis>> {
  try {
    const brut = localStorage.getItem(CLE_LOCALE);
    return brut ? (JSON.parse(brut) as Record<string, Record<string, Avis>>) : {};
  } catch {
    return {};
  }
}

const enviesLocales: EnviesApi = {
  // Une seule personne sur cet appareil : ses avis sont relus sous son propre
  // identifiant, pour que l'écran dise « vous » et non « quelqu'un ».
  async lister(tripId, userId) {
    const lignes = Object.entries(lireLocal()[tripId] ?? {}).map(([activiteId, avis]) => ({
      subject_id: activiteId,
      user_id: userId,
      value: VERS_VOTE[avis],
    }));
    return depouiller(lignes, userId);
  },

  async poser(tripId, activiteId, avis) {
    const stock = lireLocal();
    const pourCeVoyage = { ...(stock[tripId] ?? {}) };
    if (avis === null) delete pourCeVoyage[activiteId];
    else pourCeVoyage[activiteId] = avis;
    try {
      localStorage.setItem(CLE_LOCALE, JSON.stringify({ ...stock, [tripId]: pourCeVoyage }));
    } catch {
      // Stockage plein ou refusé : l'avis ne survivra pas au rechargement,
      // mais l'écran reste utilisable.
    }
  },

  ecouter() {
    return () => {};
  },
};

/* ---------------------------------------------------------- Mode serveur -- */

export function getEnvies(): EnviesApi {
  const client = supabase;
  if (!client) return enviesLocales;

  return {
    async lister(tripId, userId) {
      const { data, error } = await client
        .from('votes')
        .select('subject_id, user_id, value')
        .eq('trip_id', tripId)
        .eq('subject_type', 'place');
      if (error) throw error;
      return depouiller(data ?? [], userId);
    },

    async poser(tripId, activiteId, avis) {
      const { data: session } = await client.auth.getUser();
      const userId = session.user?.id;
      if (!userId) throw new Error('Connexion requise pour donner son avis');

      const cible = {
        trip_id: tripId,
        subject_type: 'place',
        subject_id: activiteId,
        user_id: userId,
      };
      if (avis === null) {
        const { error } = await client.from('votes').delete().match(cible);
        if (error) throw error;
        return;
      }
      const { error } = await client
        .from('votes')
        .upsert(
          { ...cible, value: VERS_VOTE[avis] },
          { onConflict: 'trip_id,subject_type,subject_id,user_id' },
        );
      if (error) throw error;
    },

    ecouter(tripId, surChangement) {
      const canal = client
        .channel(`envies:${tripId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'votes', filter: `trip_id=eq.${tripId}` },
          surChangement,
        )
        .subscribe();
      return () => {
        void client.removeChannel(canal);
      };
    },
  };
}

/** La clé de cache, partagée par « À faire » et l'itinéraire. */
export const cleEnvies = (tripId: string | undefined) => ['envies', tripId] as const;

/**
 * La requête des envies, la même pour « À faire » et pour l'itinéraire.
 *
 * Relue à chaque ouverture d'écran, contrairement au reste du cache, tenu pour
 * frais une minute. Les envies des autres arrivent en direct tant que l'écran
 * est ouvert ; mais celles posées pendant qu'on était ailleurs n'arrivent par
 * aucun canal, et l'itinéraire se remplirait sans elles. Une lecture de plus
 * à l'ouverture, légère, contre un programme qui ignore l'avis du groupe.
 */
export function requeteDesEnvies(tripId: string | undefined, userId: string) {
  return queryOptions({
    queryKey: cleEnvies(tripId),
    queryFn: () => getEnvies().lister(tripId!, userId),
    enabled: Boolean(tripId),
    staleTime: 0,
  });
}

/**
 * Les avis en simples comptes, sans les identifiants : ce que « Découvrir »
 * et son classement affichent — combien, jamais qui.
 */
export function comptesDesEnvies(envies: EnviesDuGroupe | undefined): Record<string, ComptesDAvis> {
  const comptes: Record<string, ComptesDAvis> = {};
  for (const [activiteId, detail] of Object.entries(envies?.parActivite ?? {})) {
    comptes[activiteId] = { pour: detail.pour.length, contre: detail.contre.length, moi: detail.moi };
  }
  return comptes;
}

/**
 * Poser son avis sur une activité, le même geste partout.
 *
 * Le cœur répond au doigt, pas au réseau : l'avis est posé dans le cache
 * aussitôt, et retiré si le serveur le refuse.
 */
export function usePoserUneEnvie(tripId: string | undefined, moi: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activiteId, valeur }: { activiteId: string; valeur: Avis | null }) =>
      getEnvies().poser(tripId!, activiteId, valeur),
    onMutate: async ({ activiteId, valeur }) => {
      await queryClient.cancelQueries({ queryKey: cleEnvies(tripId) });
      const avant = queryClient.getQueryData<EnviesDuGroupe>(cleEnvies(tripId));
      queryClient.setQueryData(cleEnvies(tripId), basculer(avant, activiteId, moi, valeur));
      signaler(valeur === 'envie' ? 'reussite' : 'tape');
      return { avant };
    },
    onError: (_erreur, _variables, contexte) => {
      queryClient.setQueryData(cleEnvies(tripId), contexte?.avant);
      signaler('echec');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: cleEnvies(tripId) });
    },
  });
}
