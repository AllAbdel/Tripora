import { Link } from 'react-router';
import { Bloc, Definition, LienDeContact, PageLegale } from '@/components/PageLegale';

/**
 * Les mentions légales : qui édite Tripora, qui l'héberge, d'où viennent les
 * données qu'il affiche.
 *
 * Tripora est pour l'instant édité par un particulier, non professionnel : la
 * loi pour la confiance dans l'économie numérique (art. 6, III, 2) l'autorise
 * alors à ne pas publier son adresse, pourvu que son hébergeur la connaisse.
 * Le jour où une activité est déclarée (micro-entreprise, pour les
 * commissions), cette page doit donner nom, adresse et numéro SIRET — voir
 * `docs/LANCEMENT.md`.
 */
export default function MentionsLegales() {
  return (
    <PageLegale titre="Mentions légales" miseAJour="25 septembre 2026">
      <Bloc titre="Éditeur">
        <p className="text-muted">
          Tripora est un projet personnel, édité par un particulier. Les liens partenaires
          signalés comme tels peuvent lui rapporter des commissions. Conformément à la loi pour la
          confiance dans l’économie numérique, un éditeur non professionnel peut ne pas publier
          son adresse postale dès lors que celle-ci est connue de son hébergeur.
        </p>
      </Bloc>

      <Bloc titre="Nous écrire" id="contact">
        <p className="text-muted">
          Une question, un problème, une demande sur vos données : <LienDeContact />. Réponse sous
          quelques jours ; pour une demande d’effacement, sous trente jours au plus.
        </p>
      </Bloc>

      <Bloc titre="Hébergement">
        <Definition terme="Application et pages du site">
          Cloudflare, Inc. — 101 Townsend St, San Francisco, CA 94107, États-Unis. Vercel, Inc. —
          440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. Ils distribuent les fichiers de
          l’application et ne voient pas le contenu de vos voyages.
        </Definition>
        <Definition terme="Données et comptes">
          Supabase, Inc. — 970 Toa Payoh North, Singapour. Les données de Tripora sont hébergées
          dans son centre de Paris (eu-west-3).
        </Definition>
      </Bloc>

      <Bloc titre="D’où viennent les données affichées">
        <Definition terme="Descriptions et photos">
          Wikipédia et Wikimedia Commons, sous licence Creative Commons CC BY-SA ; l’auteur et la
          licence de chaque photo sont indiqués avec elle.
        </Definition>
        <Definition terme="Cartes et lieux">
          © les contributeurs d’OpenStreetMap, sous licence ODbL ; fonds de carte OpenFreeMap.
        </Definition>
        <Definition terme="Climat et météo">Open-Meteo, sous licence CC BY 4.0.</Definition>
        <Definition terme="Taux de change">
          Banque centrale européenne, par l’intermédiaire de Frankfurter.
        </Definition>
        <Definition terme="Prix des vols">
          Travelpayouts (Aviasales) : des prix relevés à une date indiquée, pas des offres.
        </Definition>
        <Definition terme="Le reste">
          Les activités du carnet, leurs durées et leurs prix indicatifs ont été rédigés et
          vérifiés pour Tripora. Drapeaux : flag-icons (licence MIT). Polices : Fraunces et Inter
          Tight (licence SIL Open Font).
        </Definition>
      </Bloc>

      <Bloc titre="Ce que Tripora ne garantit pas">
        <p className="text-muted">
          Les prix affichés sont des estimations ou des tarifs relevés à une date indiquée, jamais
          des offres. Les recommandations d’applications et les informations de voyage sont
          données de bonne foi et peuvent vieillir. Vérifiez toujours les formalités d’entrée
          auprès des sources officielles du pays concerné. Les conditions complètes sont dans les{' '}
          <Link to="/conditions" className="text-brand-600 dark:text-brand-300 underline">
            conditions d’utilisation
          </Link>
          .
        </p>
      </Bloc>
    </PageLegale>
  );
}
