import { Link } from 'react-router';
import { Logo } from '@/components/Logo';
import { estNatif } from '@/lib/natif';
import { useGuide } from '@/stores/guide';
import { cheminDuMois } from '@/seo/mois';
import { insecables } from '@/lib/typographie';

/**
 * Le pied de page du site.
 *
 * Ce qu'on vient y chercher, et rien d'autre : qui édite Tripora, ce qu'il
 * garde, les règles, et comment le joindre. Ces pages sont exigées par la
 * loi, mais surtout elles sont la première chose qu'on ouvre avant de confier
 * ses dépenses de vacances à une application qu'on ne connaît pas.
 *
 * Deux tailles. Le pied **complet** clôt l'accueil et les pages publiques ;
 * le pied **discret**, une seule ligne, suit l'application sur le site — assez
 * pour trouver les mentions légales, pas assez pour distraire.
 *
 * Dans l'application mobile, pas de pied de page : ce n'est pas l'usage d'une
 * app, et la barre d'onglets occupe déjà le bas. Les mêmes liens sont dans le
 * profil, rubrique « À propos ».
 */
export function PiedDePage({ variante = 'complet' }: { variante?: 'complet' | 'discret' }) {
  const ouvrirLeGuide = useGuide((etat) => etat.ouvrir);
  if (estNatif) return null;

  if (variante === 'discret') {
    return (
      <footer className="text-muted mx-auto w-full max-w-2xl px-5 pt-10 pb-4 text-xs print:hidden">
        <nav aria-label="Informations légales">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            <li>
              <Link to="/mentions-legales" className="hover:underline">
                Mentions légales
              </Link>
            </li>
            <li>
              <Link to="/confidentialite" className="hover:underline">
                Confidentialité
              </Link>
            </li>
            <li>
              <Link to="/conditions" className="hover:underline">
                Conditions d’utilisation
              </Link>
            </li>
            <li>
              <button type="button" onClick={ouvrirLeGuide} className="hover:underline">
                Comment ça marche
              </button>
            </li>
            <li>© {new Date().getFullYear()} Tripora</li>
          </ul>
        </nav>
      </footer>
    );
  }

  const mois = new Date().getMonth() + 1;
  return (
    <footer className="filet border-t print:hidden">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <Logo className="size-8" />
            <span className="titre-lieu text-2xl leading-none">Tripora</span>
          </Link>
          <p className="text-muted max-w-[30ch] text-sm leading-relaxed">
            {insecables(
              'Le voyage entre amis, du « on part où ? » au « qui doit combien ? ». Gratuit, sans publicité.',
            )}
          </p>
        </div>

        <Colonne titre="Voyager">
          <Lien to="/voyages/nouveau">Créer un voyage</Lien>
          <Lien to="/rejoindre">Rejoindre avec un code</Lien>
          <LienDuSite href="/destinations">Toutes les destinations</LienDuSite>
          <LienDuSite href={cheminDuMois(mois)}>Où partir ce mois-ci</LienDuSite>
        </Colonne>

        <Colonne titre="Tripora">
          <li>
            <button type="button" onClick={ouvrirLeGuide} className={CLASSE_LIEN}>
              Comment ça marche
            </button>
          </li>
          <Lien to="/soutenir">Comment Tripora est financé</Lien>
          <Lien to="/connexion">Se connecter</Lien>
        </Colonne>

        <Colonne titre="Informations">
          <Lien to="/mentions-legales">Mentions légales</Lien>
          <Lien to="/confidentialite">Confidentialité</Lien>
          <Lien to="/conditions">Conditions d’utilisation</Lien>
          <Lien to="/mentions-legales#contact">Nous écrire</Lien>
        </Colonne>
      </div>
      <p className="text-muted filet mx-auto w-full max-w-5xl border-t px-5 py-5 text-xs">
        © {new Date().getFullYear()} Tripora · Données de voyage hébergées à Paris · Aucun cookie
        publicitaire
      </p>
    </footer>
  );
}

const CLASSE_LIEN = 'text-muted hover:text-brand-600 dark:hover:text-brand-300 text-sm transition-colors';

function Colonne({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <nav aria-label={titre} className="space-y-3">
      <h2 className="etiquette">{titre}</h2>
      <ul className="space-y-2">{children}</ul>
    </nav>
  );
}

function Lien({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className={CLASSE_LIEN}>
        {children}
      </Link>
    </li>
  );
}

/**
 * Les pages du carnet sont de vrais fichiers du site, pas des écrans de
 * l'application : un lien ordinaire, que le navigateur charge en entier.
 */
function LienDuSite({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a href={href} className={CLASSE_LIEN}>
        {children}
      </a>
    </li>
  );
}
