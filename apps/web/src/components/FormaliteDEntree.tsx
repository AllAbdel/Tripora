import { Link } from 'react-router';
import { TriangleAlert } from 'lucide-react';
import { formatDate, localeActive } from '@tripora/core';
import type { ReponseDeVisa } from '@/lib/visas';
import { estContraignante, phraseDeVisa } from '@/lib/visas';
import { nomDuPays } from '@/stores/passeports';

/**
 * La ligne « Visa » des infos pratiques, avec sa source et sa date.
 *
 * Une démarche à faire avant le départ se voit d'un coup d'œil (« Attention »,
 * en or) ; le reste se lit comme une simple information. La ligne dit pour
 * quel passeport elle répond, et invite à déclarer le sien tant qu'elle ne
 * répond que pour le pays de départ.
 */
export function FormaliteDEntree({ reponse }: { reponse: ReponseDeVisa }) {
  const { exigence, releve, passeport } = reponse;
  const contraignant = estContraignante(exigence);
  return (
    <>
      {contraignant ? (
        <strong className="text-gold-700 dark:text-gold-300 flex items-start gap-1.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span>Attention :</span> <span>{phraseDeVisa(exigence)}</span>
          </span>
        </strong>
      ) : (
        <span className="font-medium">{phraseDeVisa(exigence)}</span>
      )}
      <span className="text-muted block text-xs">
        {passeport ? (
          <span>{`Avec votre passeport (${nomDuPays(passeport, localeActive())}), d’après Passport Index.`}</span>
        ) : (
          <span>Pour un passeport du pays de départ, d’après Passport Index.</span>
        )}{' '}
        {/* Un seul texte, que la traduction reconnaît : « · relevé le … ». */}
        <span>· relevé le {formatDate(releve, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </span>
      {!passeport && (
        <Link
          to="/profil#passeports"
          className="text-brand-600 dark:text-brand-300 mt-1 inline-flex min-h-11 items-center text-xs font-semibold underline"
        >
          Indiquer mon passeport
        </Link>
      )}
    </>
  );
}
