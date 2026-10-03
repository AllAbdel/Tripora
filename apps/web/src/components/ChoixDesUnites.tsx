import { CURRENCIES, formatCents, formatDistance, formatTemperature, localeActive } from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useLangueActive } from '@/stores/langue';
import { resoudreLaRegion, useRegion, type Choix } from '@/stores/region';

/** Le nom d'une devise dans la langue de l'interface : le navigateur le connaît déjà. */
function nomDeDevise(code: string): string {
  try {
    const nom = new Intl.DisplayNames([localeActive()], { type: 'currency' }).of(code);
    return nom ? `${nom.charAt(0).toUpperCase()}${nom.slice(1)} (${code})` : code;
  } catch {
    return code;
  }
}

/**
 * Devise, degrés et distances.
 *
 * Par défaut, tout suit le pays du navigateur. Un exemple sous chaque réglage
 * montre ce que ça change, avec les vrais chiffres de l'application : on voit
 * « 75 °F » avant d'avoir à se demander ce que veut dire « Fahrenheit ».
 *
 * Les prix sont relevés en euros : dans une autre devise, ils sont convertis
 * au taux BCE du jour et précédés de « ≈ ». Les budgets se tapent dans la
 * devise choisie et se gardent en euros (`SaisieEnDevise`) ; les dépenses et
 * les remboursements restent dans leur devise d'origine.
 */
export function ChoixDesUnites() {
  const langue = useLangueActive();
  const devise = useRegion((etat) => etat.devise);
  const temperature = useRegion((etat) => etat.temperature);
  const distance = useRegion((etat) => etat.distance);
  const setDevise = useRegion((etat) => etat.setDevise);
  const setTemperature = useRegion((etat) => etat.setTemperature);
  const setDistance = useRegion((etat) => etat.setDistance);
  const auto = resoudreLaRegion({ devise: 'auto', temperature: 'auto', distance: 'auto' }, langue);

  const TEMPERATURES: readonly { valeur: Choix<'C' | 'F' | 'K'>; libelle: string }[] = [
    { valeur: 'auto', libelle: `Automatique (${{ C: '°C', F: '°F', K: 'K' }[auto.temperature]})` },
    { valeur: 'C', libelle: 'Celsius (°C)' },
    { valeur: 'F', libelle: 'Fahrenheit (°F)' },
    { valeur: 'K', libelle: 'Kelvin (K)' },
  ];
  const DISTANCES: readonly { valeur: Choix<'km' | 'mi'>; libelle: string }[] = [
    { valeur: 'auto', libelle: `Automatique (${auto.distance})` },
    { valeur: 'km', libelle: 'Kilomètres' },
    { valeur: 'mi', libelle: 'Miles' },
  ];

  return (
    <Card>
      <CardBody className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="choix-devise" className="block text-sm font-semibold">
            Devise
          </label>
          <select
            id="choix-devise"
            value={devise}
            onChange={(evenement) => setDevise(evenement.target.value)}
            className="surface-raised focus:border-brand-500 h-12 w-full rounded-2xl border border-[color:var(--border-subtle)] px-4 text-[16px] outline-none"
          >
            <option value="auto">{`Automatique : ${nomDeDevise(auto.devise)}`}</option>
            {CURRENCIES.map((monnaie) => (
              <option key={monnaie.code} value={monnaie.code}>
                {nomDeDevise(monnaie.code)}
              </option>
            ))}
          </select>
          <p className="text-muted text-xs leading-relaxed">
            Les prix sont relevés en euros ; dans une autre devise, ils sont convertis au taux du jour et
            précédés de « ≈ ». Les budgets se tapent dans cette devise et se gardent en euros. Les
            dépenses et les remboursements gardent leur devise.
          </p>
          <p className="text-muted text-xs">
            Exemple : <span className="chiffres font-medium">{formatCents(145000, 'EUR', { hideCentimes: true })}</span>
          </p>
        </div>

        <div className="space-y-2" role="group" aria-labelledby="titre-temperatures">
          <p id="titre-temperatures" className="text-sm font-semibold">
            Températures
          </p>
          <div className="flex flex-wrap gap-2">
            {TEMPERATURES.map((option) => (
              <Chip key={option.valeur} selected={temperature === option.valeur} onClick={() => setTemperature(option.valeur)}>
                {option.libelle}
              </Chip>
            ))}
          </div>
          <p className="text-muted text-xs">
            Exemple : <span className="chiffres font-medium">{formatTemperature(24)}</span>
          </p>
        </div>

        <div className="space-y-2" role="group" aria-labelledby="titre-distances">
          <p id="titre-distances" className="text-sm font-semibold">
            Distances
          </p>
          <div className="flex flex-wrap gap-2">
            {DISTANCES.map((option) => (
              <Chip key={option.valeur} selected={distance === option.valeur} onClick={() => setDistance(option.valeur)}>
                {option.libelle}
              </Chip>
            ))}
          </div>
          <p className="text-muted text-xs">
            Exemple : <span className="chiffres font-medium">{formatDistance(1000)}</span>
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
