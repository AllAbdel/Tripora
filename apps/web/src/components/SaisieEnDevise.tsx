import { useState } from 'react';
import {
  deviseDeSaisie,
  eurosVersSaisie,
  formatCents,
  parseAmountToCents,
  saisieVersEuros,
  type Cents,
} from '@tripora/core';
import { MoneyInput } from '@/components/ui/MoneyInput';

/**
 * Un budget tapé dans la devise de la personne, gardé en centimes d'euro.
 *
 * Les budgets se comparent en euros — c'est la monnaie des prix relevés et
 * celle du groupe —, mais un Américain pense en dollars : il tape « 2000 »
 * dans un champ marqué « $ », et Tripora garde l'équivalent au taux BCE du
 * jour. Une ligne sous le champ dit ce qui est enregistré : la conversion
 * n'est jamais cachée.
 *
 * Le texte tapé vit ici, et non recalculé depuis les euros à chaque frappe :
 * l'aller-retour par l'euro arrondit (12 345 ¥ redeviendraient 12 346 ¥ sous
 * les doigts). Il n'est réécrit que si la somme change d'ailleurs — un
 * raccourci touché, une valeur rechargée.
 */
export function SaisieEnDevise({
  cents,
  onChange,
  label,
  placeholder,
  entier = false,
}: {
  /** La somme stockée, en centimes d'euro. */
  cents: Cents | null;
  onChange: (cents: Cents | null) => void;
  label: string;
  placeholder?: string;
  entier?: boolean;
}) {
  const devise = deviseDeSaisie();
  const enTexte = (valeur: Cents | null) => {
    if (valeur === null) return '';
    const unites = eurosVersSaisie(valeur) / 100;
    return entier ? String(Math.round(unites)) : String(Math.round(unites * 100) / 100);
  };
  const [texte, setTexte] = useState(() => enTexte(cents));
  const [suivi, setSuivi] = useState(cents);
  // La somme a changé ailleurs (un raccourci, un rechargement) : le champ la suit.
  if (cents !== suivi) {
    setSuivi(cents);
    setTexte(enTexte(cents));
  }

  return (
    <div className="space-y-1.5">
      <MoneyInput
        label={label}
        placeholder={placeholder}
        entier={entier}
        devise={devise}
        value={texte}
        onChange={(valeur) => {
          const enEuros = valeur === '' ? null : saisieVersEuros(parseAmountToCents(valeur));
          setTexte(valeur);
          setSuivi(enEuros);
          onChange(enEuros);
        }}
      />
      {devise !== 'EUR' && cents !== null && cents > 0 && (
        <p className="text-muted chiffres px-1 text-xs">
          Enregistré en euros au taux du jour : {formatCents(cents, 'EUR', { hideCentimes: entier, sansConversion: true })}.
        </p>
      )}
    </div>
  );
}
