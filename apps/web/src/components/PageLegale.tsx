import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';
import { useTitreDuDocument } from '@/lib/useTitreDuDocument';

/**
 * Le gabarit des pages légales : confidentialité, mentions, conditions.
 *
 * Écrites pour être lues, pas pour couvrir : des blocs courts, dans l'ordre
 * des questions qu'on se pose, et un lien vers les deux autres pages en bas —
 * on cherche rarement la bonne du premier coup.
 */
export function PageLegale({
  titre,
  miseAJour,
  children,
}: {
  titre: string;
  /** « 25 septembre 2026 » : la date de la dernière modification du texte. */
  miseAJour: string;
  children: ReactNode;
}) {
  const { identity } = useAuth();
  useTitreDuDocument(`${titre} — Tripora`);

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
        <h1 className="text-lg font-semibold">{titre}</h1>
      </div>

      {children}

      <nav aria-label="Autres informations" className="text-muted space-y-1 px-1 text-xs">
        <p>Dernière mise à jour : {miseAJour}.</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/mentions-legales" className="underline underline-offset-2">
            Mentions légales
          </Link>
          <Link to="/confidentialite" className="underline underline-offset-2">
            Confidentialité
          </Link>
          <Link to="/conditions" className="underline underline-offset-2">
            Conditions d’utilisation
          </Link>
        </p>
      </nav>
    </div>
  );
}

export function Bloc({ titre, id, children }: { titre: string; id?: string; children: ReactNode }) {
  return (
    <Card>
      <CardBody className="space-y-2.5">
        <h2 id={id} className="scroll-mt-20 font-semibold">
          {titre}
        </h2>
        <div className="space-y-2.5 text-sm leading-relaxed">{children}</div>
      </CardBody>
    </Card>
  );
}

/** Un terme et ce qu'il recouvre : plus lisible qu'un paragraphe de plus. */
export function Definition({ terme, children }: { terme: string; children: ReactNode }) {
  return (
    <p className="text-muted">
      <strong className="text-[color:var(--text-strong)]">{terme}.</strong> {children}
    </p>
  );
}

/** L'adresse de contact, la même partout. */
export const ADRESSE_DE_CONTACT = 'abdelslam.allaouat.pro@gmail.com';

export function LienDeContact() {
  return (
    <a
      href={`mailto:${ADRESSE_DE_CONTACT}`}
      className="text-brand-600 dark:text-brand-300 break-all underline"
    >
      {ADRESSE_DE_CONTACT}
    </a>
  );
}
