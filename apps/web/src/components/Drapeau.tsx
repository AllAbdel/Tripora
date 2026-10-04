import { useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Le drapeau d'un pays, en petit.
 *
 * « Porto, Portugal » se lit ; un drapeau se reconnaît sans lire, et c'est
 * précisément ce qu'on demande à une liste de vingt destinations qu'on
 * parcourt du pouce. Il accompagne le nom du pays, il ne le remplace jamais :
 * beaucoup de drapeaux se ressemblent, et personne ne les connaît tous.
 *
 * Jamais d'émoji drapeau : Windows n'en affiche aucun, plusieurs systèmes en
 * rendent une paire de lettres, et la taille varie d'une plateforme à l'autre.
 * Ce sont des fichiers SVG, servis un par un et gardés en cache — le drapeau
 * français pèse 231 octets.
 *
 * Quand le fichier manque (pays absent du jeu, ou première visite hors ligne),
 * on affiche le code du pays dans une pastille sobre plutôt qu'un carré vide.
 */
export function Drapeau({
  code,
  pays,
  className,
}: {
  /** Code ISO 3166-1 alpha-2, dans n'importe quelle casse. */
  code: string | null | undefined;
  /** Nom du pays, pour les lecteurs d'écran. */
  pays?: string;
  className?: string;
}) {
  const [absent, setAbsent] = useState(false);
  const normalise = (code ?? '').trim().toLowerCase();
  const valide = /^[a-z]{2}$/u.test(normalise);

  const cadre = cn(
    'inline-block shrink-0 overflow-hidden rounded-[3px] align-[-0.1em]',
    // Un liseré très léger : sans lui, un drapeau à bande blanche flotte sur
    // un fond clair et perd sa forme.
    'ring-1 ring-black/10 dark:ring-white/15',
    'h-3.5 w-[1.17rem]',
    className,
  );

  if (!valide || absent) {
    return (
      <span
        className={cn(cadre, 'text-muted grid place-items-center bg-black/5 dark:bg-white/10')}
        aria-hidden={!pays}
        {...(pays ? { role: 'img', 'aria-label': pays } : {})}
      >
        <span className="text-[0.5rem] leading-none font-bold tracking-tight uppercase">
          {valide ? normalise : '·'}
        </span>
      </span>
    );
  }

  return (
    <img
      src={`/flags/${normalise}.svg`}
      // Le nom du pays est presque toujours écrit juste à côté : répéter
      // « Drapeau du Portugal » alourdirait la lecture à l'oreille pour rien.
      alt={pays ? `Drapeau : ${pays}` : ''}
      aria-hidden={pays ? undefined : true}
      width={21}
      height={14}
      loading="lazy"
      decoding="async"
      onError={() => setAbsent(true)}
      className={cn(cadre, 'object-cover')}
    />
  );
}
