import { formatDate } from '@tripora/core';
import type { ReponseDeVisa } from '@/lib/visas';
import { phraseDeVisa } from '@/lib/visas';

/** La ligne « Visa » des infos pratiques, avec sa source et sa date. */
export function FormaliteDEntree({ reponse }: { reponse: ReponseDeVisa }) {
  const { exigence, releve } = reponse;
  const contraignant = exigence.formalite !== 'sans-visa' && exigence.formalite !== 'visa-a-l-arrivee';
  return (
    <>
      {contraignant ? <strong>{phraseDeVisa(exigence)}</strong> : phraseDeVisa(exigence)}
      <span className="text-muted block text-xs">
        <span>Pour un passeport du pays de départ, d’après Passport Index.</span>{' '}
        {/* Un seul texte, que la traduction reconnaît : « · relevé le … ». */}
        <span>· relevé le {formatDate(releve, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </span>
    </>
  );
}
