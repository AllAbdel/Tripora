import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';

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
          agenda, ni fichiers.
        </Definition>
        <Definition terme="Vos voyages">
          Le titre, la ville de départ, les dates, le budget, les envies de chacun, les votes,
          l’itinéraire, les messages de la discussion, les endroits épinglés, les dépenses et les
          listes de bagage.
        </Definition>
        <Definition terme="Vos réglages">
          Le thème, la couleur choisie et les retours sonores restent dans le navigateur, sur
          votre appareil. Ils ne partent jamais sur le serveur.
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
        <Definition terme="Les services que vous ouvrez vous-même">
          Cliquer sur un lien vers une application recommandée, un site de réservation ou un lien
          de parrainage vous emmène chez eux, avec ce que votre navigateur transmet
          habituellement. Tripora ne leur envoie rien de plus, et ne sait pas si vous avez
          cliqué.
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

      <Bloc titre="Liens de parrainage">
        <p>
          Deux applications recommandées portent un lien de parrainage, signalé comme tel sur leur
          fiche, avec le lien direct affiché juste au-dessus. Tripora peut recevoir une
          contrepartie si vous ouvrez un compte par ce chemin. Le classement des recommandations
          ne dépend jamais de ces liens — c’est vérifié par un test automatique à chaque
          modification du code.{' '}
          <Link to="/soutenir" className="text-brand-600 dark:text-brand-300 underline">
            Le détail est ici.
          </Link>
        </p>
      </Bloc>

      <Bloc titre="Combien de temps">
        <p>
          Vos voyages restent tant que vous les gardez. Un voyage supprimé disparaît de
          l’application immédiatement et de la base sous trente jours. Un compte supprimé emporte
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
            <strong className="text-[color:var(--text-strong)]">Les effacer</strong> — écrivez à
            l’adresse ci-dessous ; la suppression est faite sous trente jours.
          </li>
          <li>
            <strong className="text-[color:var(--text-strong)]">Réclamer</strong> — auprès de la
            CNIL, si la réponse ne vous convient pas.
          </li>
        </ul>
      </Bloc>

      <Bloc titre="Mentions légales">
        <Definition terme="Éditeur">
          Tripora est un projet personnel et non commercial, édité par un particulier. Contact :{' '}
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
        Dernière mise à jour : 8 septembre 2026.
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
