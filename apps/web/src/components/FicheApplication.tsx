import { Apple, Globe, Play, TriangleAlert } from 'lucide-react';
import type { ApplicationClassee, ApplicationUtile } from '@tripora/core';
import { cn } from '@/lib/cn';

/**
 * Une application recommandée, telle qu'on la lit.
 *
 * Trois choses dans cet ordre : ce que c'est, pourquoi ça vaut le coup, et ce
 * qu'il faut savoir avant de s'y fier. La réserve n'est pas cachée derrière un
 * repli — c'est souvent l'information la plus chère à ne pas avoir eue, et une
 * recommandation sans nuance ne se distingue pas d'une publicité.
 *
 * Les liens de magasin sont des **recherches par nom**, pas des fiches. Un
 * identifiant App Store inventé mènerait à une application homonyme ; une
 * recherche tombe sur la bonne et reste valable quand l'éditeur change d'URL.
 */
export function FicheApplication({
  app,
  portee,
}: {
  app: ApplicationUtile;
  /** Affiché seulement quand ça ajoute quelque chose : « ici » vaut mieux que « partout ». */
  portee?: ApplicationClassee['portee'];
}) {
  return (
    <article className="space-y-2 rounded-2xl border border-[color:var(--border-subtle)] p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h4 className="text-sm font-semibold">{app.name}</h4>
        {portee && portee !== 'monde' && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase',
              portee === 'ville'
                ? 'bg-gold-500/20 text-gold-700 dark:text-gold-300'
                : 'bg-brand-500/15 text-brand-700 dark:text-brand-200',
            )}
          >
            {portee === 'ville' ? 'sur place' : 'dans ce pays'}
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed">{app.tagline}</p>
      <p className="text-muted text-sm leading-relaxed">{app.why}</p>

      {app.caveat && (
        <p className="text-muted flex gap-2 text-xs leading-relaxed">
          <TriangleAlert className="text-gold-600 dark:text-gold-400 mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{app.caveat}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {app.iosUrl && (
          <LienMagasin href={app.iosUrl} icone={<Apple className="size-3.5" aria-hidden />}>
            iPhone
          </LienMagasin>
        )}
        {app.androidUrl && (
          <LienMagasin href={app.androidUrl} icone={<Play className="size-3.5" aria-hidden />}>
            Android
          </LienMagasin>
        )}
        {app.webUrl && (
          <LienMagasin href={app.webUrl} icone={<Globe className="size-3.5" aria-hidden />}>
            Site
          </LienMagasin>
        )}
      </div>
    </article>
  );
}

function LienMagasin({
  href,
  icone,
  children,
}: {
  href: string;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      // `noopener` d'abord : sans lui, la page ouverte peut réécrire celle-ci.
      rel="noopener noreferrer"
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium',
        'border-[color:var(--border-subtle)] hover:bg-brand-50 dark:hover:bg-ink-700/40',
      )}
    >
      {icone}
      {children}
    </a>
  );
}
