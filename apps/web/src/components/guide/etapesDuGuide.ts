import type { NomDePastille } from '@/components/Pastille';

/**
 * Les écrans du guide de démarrage.
 *
 * Une fonction par écran, dans l'ordre où on la rencontre en organisant un
 * voyage. Chaque écran dit **quoi faire**, avec les mots des boutons de
 * l'application (« Nouveau », « Surprends-nous »), pas une promesse générale :
 * un guide qu'on a lu doit servir la première fois qu'on cherche le bouton.
 *
 * Six écrans, pas plus : au-delà, on appuie sur « Passer ».
 */
export interface EtapeDuGuide {
  pastille: NomDePastille;
  etiquette: string;
  titre: string;
  texte: string;
  gestes: readonly string[];
}

export const ETAPES_DU_GUIDE: readonly EtapeDuGuide[] = [
  {
    pastille: 'creer',
    etiquette: 'Pour commencer',
    titre: 'Créez le voyage, invitez le groupe',
    texte:
      'Avec qui, d’où, quand, pour combien : quelques écrans, et le voyage existe. Pas encore de destination ? C’est justement ce que Tripora sait trouver.',
    gestes: [
      'Appuyez sur « Nouveau » depuis vos trips.',
      'Pas d’idée ? Choisissez « Surprends-nous ».',
      'Envoyez le lien ou le code dans la conversation du groupe : on rejoint sans créer de compte.',
    ],
  },
  {
    pastille: 'votes',
    etiquette: 'Choisir',
    titre: 'Chacun dit ses envies, le groupe vote',
    texte:
      'Culture, nature, fête, détente… et le budget de chacun. Tripora propose les destinations qui conviennent au groupe entier, pas seulement à celui qui organise.',
    gestes: [
      'Remplissez « Mes envies » : quatre niveaux, de « Non merci » à « Essentiel ».',
      'Chaque proposition affiche le vol relevé depuis votre ville, le budget sur place et le climat du mois.',
      'Votez ; l’organisateur arrête la destination quand le groupe a tranché.',
    ],
  },
  {
    pastille: 'decouvrir',
    etiquette: 'Découvrir',
    titre: 'Les activités, d’un glissement',
    texte:
      'Une activité à la fois, en plein écran. Chaque geste compte pour le programme du groupe.',
    gestes: [
      'À droite : j’y vais. À gauche : pas pour moi.',
      'Vers le bas : revenir à la précédente.',
      'Le classement dit combien ont gardé chaque idée, jamais qui.',
    ],
  },
  {
    pastille: 'itineraire',
    etiquette: 'Organiser',
    titre: 'Le programme se compose tout seul',
    texte:
      'Tripora range les activités qui ont plu jour par jour, au bon moment de la journée, et garde à chacun au moins un moment qui lui ressemble.',
    gestes: [
      'Déplacez, remplacez ou ajoutez une étape : le groupe voit la même version.',
      'Chaque journée s’affiche sur la carte.',
      'Exportez le programme dans votre agenda.',
    ],
  },
  {
    pastille: 'coffre',
    etiquette: 'Sur place',
    titre: 'Tout sous la main, même sans réseau',
    texte:
      'Ce qu’on cherche toujours au mauvais moment est rangé au même endroit, et reste lisible hors connexion.',
    gestes: [
      'Le coffre : codes, wifi, adresses, billets et confirmations.',
      'La valise : une liste à cocher à plusieurs.',
      'Qui fait quoi : les tâches, avec un responsable et une échéance.',
    ],
  },
  {
    pastille: 'depenses',
    etiquette: 'Les comptes',
    titre: 'Qui doit quoi, sans calculatrice',
    texte:
      'Chacun note ce qu’il paie, en toutes devises. À la fin, Tripora calcule les remboursements au plus simple.',
    gestes: [
      'Ajoutez une dépense en quelques secondes : qui a payé, combien, pour qui.',
      'Les devises sont converties au taux du jour.',
      'Remboursez d’un geste : PayPal, Revolut, Wise ou virement.',
    ],
  },
];
