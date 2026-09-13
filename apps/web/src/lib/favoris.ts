import { supabase } from './supabase';

/**
 * Les voyages épinglés, qui remontent en tête de la liste.
 *
 * Un favori n'engage que celui qui le pose : ce n'est pas une décision du
 * groupe, personne d'autre ne le voit, et deux membres du même voyage peuvent
 * en épingler des différents. D'où une table par couple (voyage, personne) en
 * base, et une clé par appareil en mode local.
 *
 * Rien ici ne casse l'écran en cas d'échec : ne pas réussir à épingler est
 * ennuyeux, perdre la liste des voyages ne l'est pas du tout.
 *
 * La liste sort d'ici sous forme de tableau, et jamais d'ensemble. Le cache
 * des requêtes est conservé d'une visite à l'autre en JSON : un `Set` y part
 * en `{}` et en revient sans ses méthodes. L'écran des voyages appelait alors
 * `.has()` sur un objet vide, et toute l'application s'arrêtait sur une page
 * blanche à la deuxième ouverture. Un tableau traverse le JSON intact ; c'est
 * à l'écran d'en faire un ensemble s'il en veut un.
 */

const CLE_LOCALE = 'tripora.favoris';

function lireLocal(): string[] {
  try {
    const brut = localStorage.getItem(CLE_LOCALE);
    const lu: unknown = brut ? JSON.parse(brut) : [];
    return Array.isArray(lu) ? lu.filter((entree): entree is string => typeof entree === 'string') : [];
  } catch {
    return [];
  }
}

function ecrireLocal(identifiants: readonly string[]): void {
  try {
    localStorage.setItem(CLE_LOCALE, JSON.stringify([...identifiants]));
  } catch {
    /* stockage plein ou refusé : l'épingle se perdra, le voyage non. */
  }
}

/**
 * Les identifiants des voyages épinglés par la personne connectée.
 *
 * Tableau et non ensemble : cette valeur est mise en cache puis relue depuis
 * le stockage du navigateur. Voir la note en tête de fichier.
 */
export async function listerFavoris(): Promise<readonly string[]> {
  const client = supabase;
  if (!client) return [...new Set(lireLocal())];

  const { data, error } = await client.from('trip_favorites').select('trip_id');
  if (error || !data) return [...new Set(lireLocal())];
  return [...new Set(data.map((ligne) => ligne.trip_id as string))];
}

/**
 * Épingle ou décroche, et rend l'état obtenu.
 *
 * On renvoie l'état plutôt que rien : l'écran affiche déjà la bascule de façon
 * optimiste, et il lui faut de quoi se corriger si la base a refusé.
 */
export async function basculerFavori(tripId: string, epingle: boolean): Promise<boolean> {
  const client = supabase;

  if (!client) {
    const actuels = new Set(lireLocal());
    if (epingle) actuels.add(tripId);
    else actuels.delete(tripId);
    ecrireLocal([...actuels]);
    return epingle;
  }

  const { data: session } = await client.auth.getUser();
  const userId = session.user?.id;
  if (!userId) throw new Error('Connexion requise pour épingler un voyage');

  if (epingle) {
    const { error } = await client
      .from('trip_favorites')
      .upsert({ trip_id: tripId, user_id: userId }, { onConflict: 'trip_id,user_id' });
    if (error) throw error;
    return true;
  }

  const { error } = await client
    .from('trip_favorites')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
  return false;
}

/**
 * Les épinglés d'abord, le reste dans son ordre d'origine.
 *
 * Tri stable : deux voyages épinglés gardent entre eux l'ordre de la liste,
 * qui est déjà celui du plus récent au plus ancien. Un tri qui réordonnerait
 * les favoris entre eux à chaque épingle donnerait l'impression d'une liste
 * qui bouge toute seule.
 */
export function favorisEnTete<T extends { id: string }>(
  voyages: readonly T[],
  favoris: ReadonlySet<string>,
): T[] {
  return [...voyages].sort((a, b) => {
    const ecart = Number(favoris.has(b.id)) - Number(favoris.has(a.id));
    return ecart;
  });
}
