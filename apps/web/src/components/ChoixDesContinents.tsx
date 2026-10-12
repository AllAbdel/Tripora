import { CONTINENTS_DE_VOYAGE, NOMS_DES_CONTINENTS, type Continent } from '@tripora/core';
import { Chip } from '@/components/ui/Chip';

/**
 * Où chercher, en mode « Surprends-nous » : partout, ou un ou plusieurs
 * continents.
 *
 * « Partout » est une puce comme les autres, et la seule allumée quand rien
 * n'est choisi : un filtre vide ne doit pas avoir l'air d'un oubli. Le même
 * choix sert à la création et sur l'écran du voyage, où l'organisateur peut
 * le changer après coup.
 */
export function ChoixDesContinents({
  valeur,
  onChange,
}: {
  valeur: readonly Continent[];
  onChange: (continents: Continent[]) => void;
}) {
  function basculer(continent: Continent) {
    const suivants = valeur.includes(continent)
      ? valeur.filter((entree) => entree !== continent)
      : [...valeur, continent];
    // Toujours dans l'ordre de la liste : un même choix s'écrit pareil.
    onChange(CONTINENTS_DE_VOYAGE.filter((entree) => suivants.includes(entree)));
  }

  return (
    <div role="group" aria-label="Où chercher" className="flex flex-wrap gap-2">
      <Chip selected={valeur.length === 0} onClick={() => onChange([])}>
        Partout
      </Chip>
      {CONTINENTS_DE_VOYAGE.map((continent) => (
        <Chip
          key={continent}
          selected={valeur.includes(continent)}
          onClick={() => basculer(continent)}
        >
          {NOMS_DES_CONTINENTS[continent]}
        </Chip>
      ))}
    </div>
  );
}
