import type { EtatDuServeur } from './ai';

/**
 * Ce qu'on dit à quelqu'un selon l'état du serveur.
 *
 * Séparé du composant parce que c'est la seule partie qui peut se tromper, et
 * que le mot juste compte ici plus qu'ailleurs : c'est ce texte qui, le jour
 * où les fonctions serveur retomberont, fera la différence entre « je crois
 * que c'est normal » et « je sais que c'est cassé ».
 *
 * Deux états sur quatre ne sont pas des pannes, et ne doivent pas en avoir
 * l'air. Le mode local est un choix ; un serveur sans clé d'IA fonctionne
 * parfaitement pour tout le reste. Un seul mérite d'alarmer.
 */
export interface PresentationDuService {
  ton: 'ok' | 'neutre' | 'alerte';
  titre: string;
  detail: string;
}

export function presenterLeService(etat: EtatDuServeur): PresentationDuService {
  switch (etat.statut) {
    case 'ok':
      return {
        ton: 'ok',
        titre: 'Le serveur répond',
        detail:
          etat.fournisseurs.length > 0
            ? `Prix, météo et lieux sont à jour. Assistant : ${etat.fournisseurs.join(', ')}.`
            : 'Prix, météo et lieux sont à jour.',
      };
    case 'non-configure':
      return {
        ton: 'neutre',
        titre: 'Le serveur répond, sans assistant',
        detail:
          'Aucune clé d’intelligence artificielle n’est renseignée. Tout le reste fonctionne ; la saisie en langage naturel est simplement masquée.',
      };
    case 'sans-serveur':
      return {
        ton: 'neutre',
        titre: 'Mode local',
        detail:
          'Vos voyages vivent sur cet appareil et n’en sortent pas. Ni partage, ni prix relevés, ni météo — c’est voulu, et rien n’est cassé.',
      };
    case 'injoignable':
      return {
        ton: 'alerte',
        titre: 'Le serveur ne répond pas',
        detail:
          'Les prix affichés sont des estimations, la météo et l’assistant sont muets. Si vous êtes en ligne, c’est une panne de notre côté — et non un réglage manquant.',
      };
  }
}
