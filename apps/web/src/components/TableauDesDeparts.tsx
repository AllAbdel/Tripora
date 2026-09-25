import { tableauDesDeparts } from '@/lib/tableauDesDeparts';

/**
 * Cinq villes du catalogue, présentées comme un affichage d'aéroport.
 *
 * Ce n'est pas un ornement : ce sont de vraies destinations, avec leurs vrais
 * codes, tirées du catalogue embarqué — donc identiques hors ligne. Le tirage
 * change chaque jour, ce qui donne une raison de le regarder deux fois sans
 * le faire vibrer à chaque rendu.
 *
 * Il est masqué aux lecteurs d'écran : une liste de villes sans rapport avec
 * l'action à mener n'apporte rien à qui ne la voit pas, et ferait cinq
 * annonces avant d'atteindre le bouton.
 */
export function TableauDesDeparts({ combien = 5 }: { combien?: number }) {
  const lignes = tableauDesDeparts(combien);
  if (lignes.length === 0) return null;

  return (
    <div aria-hidden className="select-none">
      <p className="etiquette-filet mb-2">
        <span className="etiquette">Au départ, aujourd’hui</span>
      </p>
      <ul className="space-y-0">
        {lignes.map((ligne, rang) => (
          <li
            key={ligne.code}
            className="flex items-baseline gap-3 border-b py-1.5 filet last:border-b-0"
            style={{
              // Les dernières lignes s'effacent : le tableau continue
              // au-delà du bord, il ne s'arrête pas net.
              opacity: 1 - rang * (0.8 / combien),
            }}
          >
            <span className="chiffres w-9 shrink-0 text-xs font-semibold tracking-[0.08em]">
              {ligne.code}
            </span>
            <span className="titre truncate text-[0.95rem]">{ligne.ville}</span>
            <span className="etiquette ms-auto shrink-0 truncate">{ligne.pays}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
