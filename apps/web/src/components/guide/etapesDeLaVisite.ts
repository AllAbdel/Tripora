import { isStepComplete, STEPS, type StepId, type TripDraft } from '@/stores/tripDraft';

/**
 * Les étapes de la visite guidée : comment créer un voyage, pas à pas.
 *
 * Il n'y a pas de bouton « Suivant ». Plumio montre le vrai bouton ou le vrai
 * champ ; c'est la personne qui appuie, choisit ou tape, et l'étape suivante
 * se déduit de ce qu'elle voit et de ce qu'elle a déjà rempli. D'où cette
 * fonction pure : l'écran, le brouillon (`stores/tripDraft.ts`) et les choix
 * faits pendant la visite donnent l'étape à montrer. Rien n'avance tout seul,
 * rien ne change de page sans un appui de la personne.
 *
 * La visite s'arrête sur « Créer le voyage », sans appuyer dessus : on ne fait
 * pas créer un voyage à quelqu'un qui découvre l'application.
 *
 * Maquettes et règles : `design/mascotte/NOTES.md`, section 7.
 */

/** Ce que la visite sait de l'écran. */
export interface EcranDeLaVisite {
  chemin: string;
  /** La question de l'assistant de création affichée (`data-question`), s'il y en a une. */
  question: StepId | null;
  /** Avec un compte, on crée depuis la liste des voyages ; sans, depuis l'accueil. */
  identite: boolean;
}

/**
 * Les choix déjà faits **pendant la visite**. Aux questions « Avec qui ? » et
 * « Où ? », la réponse par défaut est déjà valide : sans un vrai appui, Plumio
 * passerait au bouton suivant avant qu'on ait lu la question.
 */
export interface ChoixDeLaVisite {
  avecQui: boolean;
  destination: boolean;
  quand: boolean;
}

export const AUCUN_CHOIX: ChoixDeLaVisite = { avecQui: false, destination: false, quand: false };

/** Les ancres que la visite surveille pour savoir qu'une carte a été choisie. */
export const ANCRES_DES_CHOIX: Record<keyof ChoixDeLaVisite, string> = {
  avecQui: 'avec-qui',
  destination: 'destination',
  quand: 'quand',
};

export interface EtapeDeLaVisite {
  /** Unique par moment de la visite : un changement d'id, c'est un nouveau geste. */
  id: string;
  /** De 1 à `NOMBRE_D_ETAPES`, pour les traits de progression. */
  numero: number;
  /**
   * Les valeurs de `data-guide` à chercher, dans l'ordre, et la consigne qui
   * va avec chacune : la première présente à l'écran est montrée.
   */
  cibles: readonly { ancre: string; texte: string }[];
  /** La consigne pendant la saisie, quand le champ montré a déjà du texte. */
  texteEnSaisie?: string;
  /** Un champ unitaire (« € ») : Plumio se tient plus loin du bout. */
  unite?: boolean;
  /** La dernière : sans voile, avec « Terminer la visite ». */
  fin?: boolean;
}

export type SituationDeLaVisite =
  | { etat: 'etape'; etape: EtapeDeLaVisite }
  /** La personne est ailleurs : la bulle se replie, prête à reprendre. */
  | { etat: 'hors-du-chemin' };

export const NOMBRE_D_ETAPES = 8;

const NUMERO: Record<StepId, number> = {
  groupe: 2,
  depart: 3,
  destination: 4,
  dates: 5,
  budget: 6,
  envies: 7,
};

export const CHEMIN_DE_LA_CREATION = '/voyages/nouveau';

/** Où se trouve le bouton qui commence tout. */
export function cheminDuDepart(identite: boolean): string {
  return identite ? '/voyages' : '/';
}

/**
 * « Continuer », une fois la réponse valide. Plumio dit « Parfait » la
 * première fois — à la première question, puisque l'assistant se suit dans
 * l'ordre — puis la consigne se fait plus brève.
 */
function continuer(question: StepId): EtapeDeLaVisite {
  const premiereFois = question === STEPS[0];
  return {
    id: `${question}-continuer`,
    numero: NUMERO[question],
    cibles: [
      {
        ancre: 'continuer',
        texte: premiereFois ? 'Parfait. Appuyez sur « Continuer ».' : 'Appuyez sur « Continuer ».',
      },
    ],
  };
}

/** L'étape à montrer. */
export function etapeDeLaVisite(
  ecran: EcranDeLaVisite,
  brouillon: TripDraft,
  choix: ChoixDeLaVisite,
): SituationDeLaVisite {
  const etape = (valeur: EtapeDeLaVisite): SituationDeLaVisite => ({ etat: 'etape', etape: valeur });

  if (ecran.chemin === cheminDuDepart(ecran.identite)) {
    return etape({
      id: 'nouveau',
      numero: 1,
      cibles: [
        // La liste vide a son grand bouton ; sinon, « Nouveau » en haut ; sans compte, l'accueil.
        { ancre: 'creer-premier-voyage', texte: 'Tout commence ici : appuyez sur « Créer un trip ».' },
        { ancre: 'nouveau-voyage', texte: 'Tout commence ici : appuyez sur « Nouveau ».' },
        { ancre: 'creer-un-voyage', texte: 'Tout commence ici : appuyez sur « Créer un voyage ».' },
      ],
    });
  }

  if (ecran.chemin !== CHEMIN_DE_LA_CREATION || !ecran.question) return { etat: 'hors-du-chemin' };

  const question = ecran.question;
  const fait = isStepComplete(question, brouillon);
  const suite = () => etape(continuer(question));

  switch (question) {
    case 'groupe':
      if (!choix.avecQui) {
        return etape({
          id: 'avec-qui',
          numero: 2,
          cibles: [{ ancre: 'avec-qui', texte: 'Avec qui partez-vous ? Choisissez une réponse.' }],
        });
      }
      return suite();

    case 'depart':
      if (!fait) {
        return etape({
          id: 'ville-depart',
          numero: 3,
          cibles: [{ ancre: 'ville-depart', texte: 'Tapez votre ville, puis choisissez-la dans la liste.' }],
          texteEnSaisie: 'Choisissez votre ville dans la liste.',
        });
      }
      return suite();

    case 'destination':
      if (!choix.destination) {
        return etape({
          id: 'destination',
          numero: 4,
          cibles: [
            {
              ancre: 'destination',
              texte: 'Vous avez une idée ? Sinon, « Surprends-nous » : Tripora proposera des destinations au groupe.',
            },
          ],
        });
      }
      if (!fait) {
        return etape({
          id: 'ville-destination',
          numero: 4,
          cibles: [{ ancre: 'ville-destination', texte: 'Cherchez la ville, puis choisissez-la dans la liste.' }],
          texteEnSaisie: 'Choisissez la ville dans la liste.',
        });
      }
      return suite();

    case 'dates':
      // Un mois touché directement vaut une réponse : la façon de dire quand était déjà la bonne.
      if (!choix.quand && !fait) {
        return etape({
          id: 'quand',
          numero: 5,
          cibles: [{ ancre: 'quand', texte: 'Choisissez une façon de dire quand. Plus c’est souple, moins ça coûte.' }],
        });
      }
      if (!fait) {
        const texte =
          brouillon.dateMode === 'month' ? 'Choisissez le mois du départ.' : 'Indiquez le départ et le retour.';
        return etape({ id: `dates-${brouillon.dateMode}`, numero: 5, cibles: [{ ancre: 'dates', texte }] });
      }
      return suite();

    case 'budget':
      if (!fait) {
        return etape({
          id: 'budget-montant',
          numero: 6,
          cibles: [{ ancre: 'budget-montant', texte: 'Combien par personne, tout compris ?' }],
          unite: true,
        });
      }
      return suite();

    case 'envies':
      if (!fait) {
        return etape({
          id: 'envies',
          numero: 7,
          cibles: [{ ancre: 'envies', texte: 'Choisissez au moins une envie.' }],
        });
      }
      return etape({
        id: 'fin',
        numero: 8,
        fin: true,
        cibles: [
          {
            ancre: 'continuer',
            // Sans compte, le bouton dit « Valider mon trip » et mène à l'enregistrement.
            texte: ecran.identite
              ? 'C’est tout ! Ce bouton crée le voyage ; ensuite, vous inviterez le groupe. Rien n’est créé tant que vous n’appuyez pas dessus.'
              : 'C’est tout ! Ce bouton enregistre le voyage, avec un compte gratuit ; ensuite, vous inviterez le groupe. Rien n’est enregistré tant que vous n’appuyez pas dessus.',
          },
        ],
      });
  }
}
