import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';

/**
 * La politique de confidentialité et les mentions légales.
 *
 * Écrite pour être lue, pas pour couvrir : chaque paragraphe dit ce que
 * l'application fait réellement, vérifiable dans le code. Une page qui promet
 * moins que ce qu'on fait n'a aucune valeur juridique, et une qui promet plus
 * est un mensonge — les deux se corrigent en décrivant exactement le
 * comportement.
 *
 * Les rubriques suivent l'ordre des questions qu'on se pose : qu'est-ce que
 * vous savez de moi, où est-ce que ça va, combien de temps, et comment je m'en
 * débarrasse.
 */
export default function Confidentialite() {
  const { identity } = useAuth();
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pt-4 pb-28">
      <div className="flex items-center gap-2">
        <Link
          to={identity ? '/profil' : '/'}
          aria-label={identity ? 'Retour au profil' : 'Retour à l’accueil'}
          className="hover:bg-brand-50 dark:hover:bg-ink-700/40 -ml-2 grid size-11 place-items-center rounded-full"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-lg font-semibold">Confidentialité et mentions légales</h1>
      </div>

      <Bloc titre="En une phrase">
        <p>
          Tripora conserve le minimum nécessaire pour qu’un voyage fonctionne à plusieurs,
          l’héberge en France, ne le vend à personne, ne vous piste nulle part, et supprime tout
          si vous le demandez.
        </p>
      </Bloc>

      <Bloc titre="Ce que Tripora conserve">
        <Definition terme="Votre identité">
          Selon la façon dont vous vous connectez : soit un compte invité, qui ne contient qu’un
          identifiant aléatoire et un nom d’affichage, soit un compte Google, dont Tripora reçoit
          l’adresse e-mail, le prénom et la photo de profil. Rien d’autre — ni contacts, ni
          agenda, ni fichiers. Facultatifs : votre genre et votre année de naissance, si vous les
          indiquez pour rejoindre un trip ouvert réservé (mixité, tranche d’âge). Ils ne sont
          montrés à personne et ne servent qu’à vérifier ces conditions.
        </Definition>
        <Definition terme="Vos voyages">
          Le titre, la ville de départ, les dates, le budget, les envies de chacun, les votes,
          l’itinéraire, les messages de la discussion, les endroits épinglés, les dépenses, les
          listes de bagage, les sondages, les tâches et les réservations notées. Vos envies sur
          les activités : les autres membres n’en voient que le total, jamais qui a dit quoi.
        </Definition>
        <Definition terme="Le coffre du voyage">
          Ce que le groupe y range : adresses, codes, wifi, contacts, et les documents déposés
          (billets, confirmations — PDF ou photos, 10 Mo au plus chacun). Visibles des membres
          du voyage seulement ; un document marqué « privé » n’est visible que de la personne
          qui l’a déposé.
        </Definition>
        <Definition terme="Vos moyens de remboursement">
          Si vous les renseignez : votre identifiant PayPal.me, Revolut ou Wise, votre IBAN et le
          nom du titulaire. Seules les personnes avec qui vous partagez un voyage les voient,
          pour pouvoir vous rembourser.
        </Definition>
        <Definition terme="Les trips ouverts">
          Si vous publiez un voyage en trip ouvert, sa fiche (destination, dates, budget, places,
          mixité, tranche d’âge, rythme) est visible des personnes connectées qui cherchent un
          voyage — ni les membres, ni l’itinéraire, ni la discussion. Une candidature transmet
          votre présentation à l’organisateur.
        </Definition>
        <Definition terme="Sur votre appareil seulement">
          Le thème, la couleur choisie et les retours sonores restent dans le navigateur. Les
          rappels de l’application Android sont programmés sur le téléphone lui-même, et les
          copies de documents gardées pour une consultation hors ligne restent dans l’appareil —
          effacées à la déconnexion. Rien de tout cela ne part sur le serveur.
        </Definition>
        <Definition terme="Ce que Tripora ne conserve pas">
          Aucune position GPS, aucun historique de navigation, aucun identifiant publicitaire,
          aucun mot de passe — il n’y en a pas.
        </Definition>
      </Bloc>

      <Bloc titre="Où c’est hébergé">
        <p>
          La base de données et l’authentification sont chez <strong>Supabase</strong>, sur des
          serveurs situés à <strong>Paris (eu-west-3)</strong>. L’application elle-même est servie
          par <strong>Cloudflare Pages</strong> et <strong>Vercel</strong>, qui distribuent des
          fichiers et ne voient pas le contenu de vos voyages.
        </p>
      </Bloc>

      <Bloc titre="Qui d’autre reçoit quelque chose">
        <p className="text-muted">
          Tripora appelle des services extérieurs pour des faits — la météo, une carte, une photo,
          un prix. Voici exactement ce que chacun reçoit.
        </p>
        <Definition terme="OpenFreeMap, Open-Meteo, Wikipédia, Overpass">
          Le nom ou les coordonnées d’une ville, jamais les vôtres. Ces appels partent depuis nos
          serveurs quand c’est possible, et le résultat est mis en cache pour tout le groupe :
          cinq personnes qui ouvrent la même destination ne déclenchent qu’une requête.
        </Definition>
        <Definition terme="Les fournisseurs d’intelligence artificielle">
          Uniquement si vous utilisez l’assistant. Ce qui part est <strong>pseudonymisé</strong> :
          les participants deviennent « Participant A, B, C », et ni les noms, ni les adresses
          e-mail, ni les identifiants ne sont transmis. Une fonction dédiée le vérifie avant
          chaque envoi. Attention tout de même : les offres gratuites de ces fournisseurs
          autorisent souvent la réutilisation des textes envoyés pour améliorer leurs modèles.
          C’est pour ça que tout le reste de Tripora fonctionne sans eux.
        </Definition>
        <Definition terme="Travelpayouts (prix des vols)">
          Le code de l’aéroport de départ et le mois visé, depuis nos serveurs, pour relever les
          prix des vols. Rien sur vous ni sur votre groupe.
        </Definition>
        <Definition terme="Les services que vous ouvrez vous-même">
          Cliquer sur un lien vers une application recommandée ou un site de réservation vous
          emmène chez eux, avec ce que votre navigateur transmet habituellement. Les liens marqués
          « lien partenaire » passent d’abord par Travelpayouts, qui compte le clic avant de vous
          emmener sur le site. Tripora ne leur envoie rien sur vous — ni nom, ni voyage — et ne
          sait pas qui a cliqué ; ces sites appliquent ensuite leur propre politique, cookies
          compris.
        </Definition>
      </Bloc>

      <Bloc titre="Cookies et traceurs">
        <p>
          Tripora ne dépose <strong>aucun cookie publicitaire</strong> et n’utilise aucun outil de
          mesure d’audience. Le navigateur stocke localement votre session et vos réglages
          d’affichage : c’est ce qui vous évite de vous reconnecter à chaque ouverture, et ça ne
          quitte pas votre appareil. Aucune bannière de consentement n’est donc nécessaire, parce
          qu’il n’y a rien à consentir.
        </p>
      </Bloc>

      <Bloc titre="Liens partenaires et parrainage">
        <p>
          Certains liens de réservation — vols, visites et billets, transferts depuis l’aéroport,
          location de voiture, eSIM, consigne à bagages, indemnisation d’un vol retardé — sont
          des liens partenaires, marqués comme tels : si vous réservez par eux, Tripora peut
          toucher une commission, sans rien changer à votre prix. Ils ne changent ni la liste
          ni son ordre, et c’est vérifié par un test automatique.
        </p>
        <p>
          Certaines applications recommandées portent aussi un lien de parrainage, signalé comme
          tel sur leur fiche, avec le lien direct affiché juste au-dessus. Le classement des
          recommandations ne dépend jamais de ces liens — là aussi, un test automatique le
          vérifie à chaque modification du code.{' '}
          <Link to="/soutenir" className="text-brand-600 dark:text-brand-300 underline">
            Le détail est ici.
          </Link>
        </p>
      </Bloc>

      <Bloc titre="Combien de temps">
        <p>
          Vos voyages restent tant que vous les gardez. Un voyage supprimé disparaît de
          l’application immédiatement, puis il est effacé pour de bon trente jours plus tard,
          documents du coffre compris — le temps de revenir sur une fausse manœuvre. Un compte
          supprimé emporte
          avec lui vos préférences, vos votes, vos messages et vos dépenses ; les voyages dont
          vous étiez l’organisateur sont supprimés entièrement.
        </p>
      </Bloc>

      <Bloc titre="Vos droits">
        <p>
          Le règlement européen vous donne le droit d’accéder à vos données, de les corriger, de
          les récupérer et de les faire effacer. En pratique :
        </p>
        <ul className="text-muted list-disc space-y-1 pl-5">
          <li>
            <strong className="text-[color:var(--text-strong)]">Les consulter</strong> — tout ce
            que Tripora sait d’un voyage est affiché dans l’application, et le récapitulatif
            imprimable en donne une copie complète.
          </li>
          <li>
            <strong id="supprimer-mon-compte" className="text-[color:var(--text-strong)]">
              Les effacer
            </strong>{' '}
            — dans l’application : Profil, puis « Supprimer mon compte ». L’effacement est
            immédiat, et les fichiers déposés quittent le stockage dans la nuit. Sans accès à
            l’application, écrivez à l’adresse ci-dessous : la suppression est faite sous trente
            jours.
          </li>
          <li>
            <strong className="text-[color:var(--text-strong)]">Réclamer</strong> — auprès de la
            CNIL, si la réponse ne vous convient pas.
          </li>
        </ul>
      </Bloc>

      <Bloc titre="Mentions légales">
        <Definition terme="Éditeur">
          Tripora est un projet personnel, édité par un particulier ; les liens partenaires
          peuvent lui rapporter des commissions. Contact :{' '}
          <a
            href="mailto:abdelslam.allaouat.pro@gmail.com"
            className="text-brand-600 dark:text-brand-300 underline"
          >
            abdelslam.allaouat.pro@gmail.com
          </a>
          . Conformément à la loi pour la confiance dans l’économie numérique, un éditeur non
          professionnel peut ne pas publier son adresse postale dès lors que celle-ci est connue
          de son hébergeur.
        </Definition>
        <Definition terme="Hébergeurs">
          Cloudflare, Inc. — 101 Townsend St, San Francisco, CA 94107, États-Unis. Vercel, Inc. —
          440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. Supabase, Inc. — 970 Toa Payoh
          North, Singapour, avec les données de Tripora hébergées à Paris.
        </Definition>
        <Definition terme="Ce que Tripora ne garantit pas">
          Les prix affichés sont des estimations ou des tarifs relevés à une date indiquée, jamais
          des offres. Les recommandations d’applications et les informations de voyage sont
          données de bonne foi et peuvent vieillir. Vérifiez toujours les formalités d’entrée
          auprès des sources officielles du pays concerné.
        </Definition>
      </Bloc>

      <p className="text-muted px-1 text-xs">
        Dernière mise à jour : 24 septembre 2026.
      </p>
    </div>
  );
}

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="space-y-2.5">
        <h2 className="font-semibold">{titre}</h2>
        <div className="space-y-2.5 text-sm leading-relaxed">{children}</div>
      </CardBody>
    </Card>
  );
}

/** Un terme et ce qu'il recouvre : plus lisible qu'un paragraphe de plus. */
function Definition({ terme, children }: { terme: string; children: React.ReactNode }) {
  return (
    <p className="text-muted">
      <strong className="text-[color:var(--text-strong)]">{terme}.</strong> {children}
    </p>
  );
}
