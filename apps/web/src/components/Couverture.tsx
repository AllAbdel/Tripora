import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import type { Destination } from '@tripora/core';
import { chargerCouverture } from '@/lib/cover';
import { cn } from '@/lib/cn';

/**
 * La photo de la ville, en haut du voyage.
 *
 * Une photo fait plus pour l'envie de partir que n'importe quel classement, et
 * elle ne coûte rien : Wikipédia en expose une pour presque toutes les villes
 * du monde. Un test sur quarante destinations tirées au hasard du catalogue en
 * a trouvé quarante.
 *
 * Trois décisions valent d'être expliquées.
 *
 * **Une bande, pas un fond.** Le titre pourrait être posé sur la photo ; ce
 * serait plus spectaculaire et parfois illisible, parce qu'on ne sait pas à
 * l'avance si l'image est claire ou sombre. La bande garde le texte sur le
 * fond de l'application, où son contraste est garanti.
 *
 * **Le crédit est affiché, pas caché.** Les images de Commons sont libres,
 * presque jamais sans condition : la plupart demandent l'auteur et la licence.
 * Les afficher n'est pas une politesse, c'est ce qui rend l'usage légal.
 *
 * **Rien ne casse quand il n'y a rien.** Sans photo — hors ligne, quota
 * atteint, ville sans article — la bande ne devient ni un cadre vide ni une
 * icône d'image brisée : le nom de la ville s'y compose en très grand, dans
 * la romane, sur du papier. C'était un dégradé bleu-turquoise ; il tenait la
 * place, mais un aplat saturé au milieu d'une page crème saute aux yeux comme
 * un rectangle de remplissage — exactement ce qu'il était. Une absence qu'on
 * compose vaut mieux qu'une absence qu'on maquille.
 */
export function Couverture({ destination }: { destination: Destination }) {
  const [chargee, setChargee] = useState(false);
  const [echouee, setEchouee] = useState(false);

  const couverture = useQuery({
    queryKey: ['couverture', destination.id],
    queryFn: () => chargerCouverture(destination),
    // Une ville ne change pas de visage : inutile de redemander.
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  const photo = echouee ? null : couverture.data;

  return (
    <div
      className={cn(
        'relative isolate mb-1 h-40 overflow-hidden rounded-[var(--radius-card)]',
        'border filet bg-[color:var(--color-paper-100)] dark:bg-[color:var(--color-ink-700)]',
      )}
    >
      {/* Le nom, en fond de plaque : visible avant que la photo n'arrive,
          et seul décor s'il n'y en a jamais. */}
      <span
        aria-hidden
        className="titre-lieu absolute inset-0 grid place-items-center overflow-hidden
                   text-[3.75rem] whitespace-nowrap text-[color:var(--color-paper-300)]
                   dark:text-[color:var(--color-ink-500)]"
      >
        {destination.name}
      </span>

      {photo && (
        <img
          src={photo.url}
          alt={`${destination.name}, ${destination.country}`}
          loading="lazy"
          decoding="async"
          onLoad={() => setChargee(true)}
          onError={() => setEchouee(true)}
          className={cn(
            'relative size-full object-cover transition-opacity duration-700',
            chargee ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}

      {photo && (
        <a
          href={photo.pageDuFichier}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'absolute right-2 bottom-2 flex max-w-[85%] items-center gap-1 rounded-[4px]',
            'bg-black/45 px-2 py-1 text-[0.65rem] leading-tight text-white/90',
            'backdrop-blur-sm transition-colors hover:bg-black/65',
          )}
        >
          <span className="truncate">{credit(photo.auteur, photo.licence)}</span>
          <ExternalLink className="size-2.5 shrink-0" aria-hidden />
        </a>
      )}
    </div>
  );
}

/**
 * La mention à afficher sous la photo.
 *
 * On nomme l'auteur quand Commons le déclare, la licence quand elle est
 * connue, et on renvoie toujours vers la page du fichier — qui porte la
 * mention complète, y compris quand nous n'en avons qu'une partie.
 */
function credit(auteur: string | null, licence: string | null): string {
  const morceaux = [auteur, licence].filter((morceau): morceau is string => Boolean(morceau));
  return morceaux.length > 0 ? `Photo : ${morceaux.join(' · ')}` : 'Photo : Wikimedia Commons';
}
