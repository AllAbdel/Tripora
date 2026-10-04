/**
 * Ce que Tripora laisse derrière lui dans le navigateur, et comment l'effacer.
 *
 * Se déconnecter n'effaçait que l'identité. Restaient en clair dans le
 * stockage : le cache des requêtes — c'est-à-dire les voyages, les noms des
 * participants, les dépenses, les votes — les brouillons, les favoris. Sur un
 * téléphone prêté ou un ordinateur partagé, la personne suivante n'avait qu'à
 * ouvrir les outils du navigateur. Cela contredisait la promesse affichée sur
 * l'écran de connexion, et ce n'était pas voulu : simplement personne n'avait
 * fait la liste.
 *
 * Elle est ici, en un seul endroit, pour qu'une clé ajoutée demain n'y échappe
 * pas — le balayage par préfixe rattrape ce qu'on oublierait de déclarer.
 */

/** Le préfixe de tout ce que l'application écrit. */
const PREFIXE = 'tripora.';

/**
 * Ce qui survit à une déconnexion.
 *
 * Le thème et la couleur choisie ne disent rien de personne : les effacer
 * rendrait l'application blanche et étrangère à quelqu'un qui se reconnecte
 * dans la minute, sans rien protéger. Le guide de démarrage non plus : se
 * reconnecter ne doit pas rejouer un guide qu'on vient de fermer.
 */
const A_GARDER: ReadonlySet<string> = new Set(['tripora.theme', 'tripora.guide-vu']);

/**
 * Ce qui n'existe qu'ici, et qu'une déconnexion ne doit donc pas emporter.
 *
 * En mode local — sans serveur configuré — ces clés ne sont pas un cache :
 * elles sont les seules copies des voyages, des dépenses, des votes, des
 * tâches, du coffre… Quelqu'un qui découvre Tripora hors ligne et appuie sur
 * « Se déconnecter » ne s'attend pas à perdre son travail.
 *
 * Une règle plutôt qu'une liste : toute clé `tripora.local-…` en fait partie,
 * sauf l'identité (c'est elle qu'on quitte). La liste tenue à la main avait
 * oublié les sept fonctions arrivées après elle.
 */
const PREFIXE_LOCAL = 'tripora.local-';
const IDENTITE_LOCALE = 'tripora.local-identity';
const AUTRES_DONNEES_LOCALES: ReadonlySet<string> = new Set(['tripora.trip-draft', 'tripora.favoris']);

function estUneDonneeLocale(cle: string): boolean {
  return (cle.startsWith(PREFIXE_LOCAL) && cle !== IDENTITE_LOCALE) || AUTRES_DONNEES_LOCALES.has(cle);
}

function cles(): string[] {
  const trouvees: string[] = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const cle = localStorage.key(index);
      if (cle?.startsWith(PREFIXE)) trouvees.push(cle);
    }
  } catch {
    // Stockage refusé : il n'y a rien à effacer.
  }
  return trouvees;
}

function effacer(nom: string): void {
  try {
    localStorage.removeItem(nom);
  } catch {
    /* rien à faire de plus : la clé restera, on ne peut pas mieux */
  }
}

/**
 * Efface ce que la déconnexion doit emporter.
 *
 * `gardeLesDonneesLocales` distingue les deux situations. Avec un serveur, tout
 * ce qui est ici est une copie de ce qui vit là-bas : on peut tout jeter, rien
 * n'est perdu. Sans serveur, les voyages n'existent qu'ici, et les effacer
 * serait détruire le travail de quelqu'un sans le lui demander.
 */
export function oublierApresDeconnexion({
  gardeLesDonneesLocales,
}: {
  gardeLesDonneesLocales: boolean;
}): void {
  for (const cle of cles()) {
    if (A_GARDER.has(cle)) continue;
    if (gardeLesDonneesLocales && estUneDonneeLocale(cle)) continue;
    effacer(cle);
  }

  // Le jeton de session de Supabase ne porte pas notre préfixe. `signOut` le
  // retire déjà, mais une déconnexion hors ligne échoue silencieusement et le
  // laisserait derrière elle : on repasse derrière.
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const cle = localStorage.key(index);
    if (cle?.startsWith('sb-') && cle.includes('-auth-token')) effacer(cle);
  }

  try {
    sessionStorage.removeItem('tripora.oauth-relance');
  } catch {
    /* même remarque */
  }
}
