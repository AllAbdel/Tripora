import { useState } from 'react';
import { Link } from 'react-router';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { ibanLisible, liensDePaiement, type MoyensDePaiement } from '@tripora/core';
import { cn } from '@/lib/cn';

const BOUTON =
  'inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--border-subtle)] px-3 text-xs font-semibold hover:border-brand-500';

/**
 * Sous un virement que je dois faire : les moyens de le faire tout de suite.
 *
 * PayPal s'ouvre avec le montant ; Revolut et Wise sur la page de la personne ;
 * l'IBAN se copie. Rien ne s'affiche si la personne n'a rien indiqué — on dit
 * seulement où elle peut le faire.
 */
export function PayerCeVirement({
  moyens,
  montantCents,
  devise = 'EUR',
  nom,
}: {
  moyens: MoyensDePaiement | undefined;
  montantCents: number;
  devise?: string;
  nom: string;
}) {
  const [copie, setCopie] = useState(false);
  const liens = moyens ? liensDePaiement(moyens, montantCents, devise) : [];

  if (!moyens || (liens.length === 0 && !moyens.iban)) {
    return (
      <p className="text-muted text-xs">
        {nom} n’a pas indiqué comment être remboursé.
      </p>
    );
  }

  async function copierIban() {
    if (!moyens?.iban) return;
    try {
      await navigator.clipboard.writeText(moyens.iban);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2500);
    } catch {
      // Presse-papiers refusé : l'IBAN reste affiché, sélectionnable.
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {liens.map((lien) => (
          <a
            key={lien.id}
            href={lien.url}
            target="_blank"
            rel="noopener noreferrer"
            className={BOUTON}
            aria-label={`Payer ${nom} avec ${lien.libelle}${lien.montantInclus ? ', montant rempli' : ''}`}
          >
            {lien.libelle}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ))}
        {moyens.iban && (
          <button type="button" onClick={() => void copierIban()} className={cn(BOUTON, copie && 'border-brand-500')}>
            {copie ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            {copie ? 'IBAN copié' : 'Copier l’IBAN'}
          </button>
        )}
      </div>
      {moyens.iban && (
        <p className="text-muted text-xs select-all">
          {ibanLisible(moyens.iban)}
          {moyens.titulaire ? ` · ${moyens.titulaire}` : ''}
        </p>
      )}
    </div>
  );
}

/** Pour qui attend un remboursement sans avoir dit comment le recevoir. */
export function IndiquerMesMoyens() {
  return (
    <p className="text-muted text-xs">
      On vous doit de l’argent :{' '}
      <Link to="/profil#paiement" className="text-brand-600 dark:text-brand-300 font-semibold underline">
        indiquez comment être remboursé
      </Link>
      , le groupe paiera d’un geste.
    </p>
  );
}
