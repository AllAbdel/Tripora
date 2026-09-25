import { Link } from 'react-router';
import { Bloc, Definition, LienDeContact, PageLegale } from '@/components/PageLegale';

/**
 * Les conditions d'utilisation.
 *
 * Elles disent ce que chacun peut attendre de l'autre, dans les mots de
 * l'application : ce que Tripora fait et ne fait pas (il ne vend rien, ne
 * réserve rien, ne tient l'argent de personne), et les quelques règles qui
 * rendent possible un outil partagé — surtout les trips ouverts, où l'on
 * voyage avec des inconnus.
 */
export default function Conditions() {
  return (
    <PageLegale titre="Conditions d’utilisation" miseAJour="25 septembre 2026">
      <Bloc titre="En bref">
        <p>
          Tripora est gratuit. Il aide un groupe à choisir une destination, à s’organiser et à
          faire ses comptes ; il ne vend aucun voyage, ne réserve rien et ne manipule pas votre
          argent. En l’utilisant, vous acceptez les règles ci-dessous — elles tiennent en une
          page.
        </p>
      </Bloc>

      <Bloc titre="Votre compte">
        <Definition terme="Trois façons d’entrer">
          Avec Google, avec une adresse e-mail (un code à usage unique, sans mot de passe), ou en
          invité pour rejoindre un voyage par un code. Un compte invité vit sur l’appareil où il a
          été ouvert : pour retrouver vos voyages ailleurs, créez un compte.
        </Definition>
        <Definition terme="Qui peut l’utiliser">
          Tripora s’adresse aux personnes majeures. Les trips ouverts, qui mettent en relation
          des inconnus, leur sont strictement réservés.
        </Definition>
        <Definition terme="Un compte, une personne">
          N’utilisez pas le nom ou l’adresse de quelqu’un d’autre. Vous êtes responsable de ce qui
          est fait depuis votre compte ; se déconnecter d’un appareil prêté suffit à le
          protéger.
        </Definition>
      </Bloc>

      <Bloc titre="Ce que vous publiez">
        <p className="text-muted">
          Vos messages, vos votes, les documents du coffre, les fiches de trips ouverts et les
          présentations de candidature restent les vôtres. Vous autorisez seulement Tripora à les
          conserver et à les montrer aux personnes concernées — les membres du voyage, ou
          l’organisateur à qui vous vous présentez —, le temps nécessaire au service.
        </p>
        <p className="text-muted">
          Sont interdits : les contenus illégaux, haineux, violents ou à caractère sexuel, le
          harcèlement, la publicité non sollicitée, et la publication de données personnelles
          d’autrui sans son accord. Ne déposez dans le coffre que des documents que vous avez le
          droit de partager avec le groupe.
        </p>
      </Bloc>

      <Bloc titre="Les trips ouverts">
        <p className="text-muted">
          Tripora ne vérifie pas l’identité des personnes et ne se porte garant de personne.
          Échangez dans la discussion avant de vous engager, retrouvez-vous d’abord dans un lieu
          public, et ne versez jamais d’argent à quelqu’un que vous ne connaissez pas pour
          « réserver votre place ». L’organisateur fixe ses conditions et choisit librement qui il
          accepte. Chacun peut signaler ou bloquer une personne ; un trip ou un compte qui
          enfreint ces règles peut être retiré.
        </p>
      </Bloc>

      <Bloc titre="Prix, réservations et liens partenaires">
        <p className="text-muted">
          Les prix affichés — vols, budget sur place, activités — sont des estimations ou des
          tarifs relevés à une date indiquée, jamais des offres. Une réservation se fait chez le
          site qui la vend, à ses conditions, et c’est lui qui en répond. Certains liens sont des
          liens partenaires, marqués comme tels : ils peuvent rapporter une commission à Tripora
          sans changer votre prix, ni l’ordre des listes.{' '}
          <Link to="/confidentialite#liens-partenaires" className="text-brand-600 dark:text-brand-300 underline">
            Le détail
          </Link>
          .
        </p>
      </Bloc>

      <Bloc titre="Les comptes du groupe">
        <p className="text-muted">
          « Qui doit quoi » est un calcul fait à partir de ce que le groupe a saisi, dans les
          devises indiquées et au taux du jour : une aide, pas un relevé bancaire. Tripora ne
          reçoit et ne transfère aucun argent ; les remboursements passent par les services que
          vous choisissez (PayPal, Revolut, Wise, virement), à leurs conditions.
        </p>
      </Bloc>

      <Bloc titre="L’assistant">
        <p className="text-muted">
          Ses réponses sont produites automatiquement et peuvent être fausses ou incomplètes.
          Vérifiez ce qui compte — horaires, formalités, sécurité — auprès des sources
          officielles. Les formalités d’entrée d’un pays, en particulier, ne relèvent jamais de
          Tripora.
        </p>
      </Bloc>

      <Bloc titre="Le service">
        <Definition terme="Disponibilité">
          Tripora est fourni gratuitement, tel qu’il est, sans garantie de disponibilité
          permanente. Il s’appuie sur des services extérieurs (météo, cartes, prix) qui peuvent
          être momentanément indisponibles.
        </Definition>
        <Definition terme="Évolutions">
          L’application change souvent. Si ces conditions changent sur un point important, vous
          en serez averti dans l’application ; continuer à l’utiliser vaut acceptation. Si
          Tripora devait fermer, vous seriez prévenu assez tôt pour garder le récapitulatif de
          vos voyages.
        </Definition>
        <Definition terme="Responsabilité">
          Dans les limites permises par la loi, Tripora ne répond pas des décisions prises à
          partir de ses estimations, ni des services tiers vers lesquels il renvoie.
        </Definition>
      </Bloc>

      <Bloc titre="Partir">
        <p className="text-muted">
          Vous pouvez supprimer votre compte à tout moment : Profil, puis « Supprimer mon compte ».
          Tripora peut suspendre un compte qui enfreint ces règles, après vous en avoir informé
          quand c’est possible.
        </p>
      </Bloc>

      <Bloc titre="Droit applicable et contact">
        <p className="text-muted">
          Ces conditions relèvent du droit français. En cas de désaccord, écrivez d’abord à{' '}
          <LienDeContact /> : on cherche une solution à l’amiable avant toute autre démarche.
        </p>
      </Bloc>
    </PageLegale>
  );
}
