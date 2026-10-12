import { useId } from 'react';
import { Bird } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { ecouterPlumio } from '@/components/mascotte/bruitages';
import { cn } from '@/lib/cn';
import { useTheme } from '@/stores/theme';

function mouvementReduit(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Les bruitages de Plumio : un interrupteur, et on l'entend en l'allumant.
 *
 * À part des retours sous le doigt : ceux-là répondent à chaque geste et
 * restent muets par défaut ; Plumio, lui, n'apparaît que de temps en temps.
 * L'écran dit aussi quand il se taira quoi qu'on choisisse — retours sur
 * « Rien », ou moins d'animations demandé à l'appareil.
 */
export function BruitagesDePlumio() {
  const { bruitagesPlumio, setBruitagesPlumio, retours } = useTheme();
  const idNom = useId();
  const idDetail = useId();
  const raison =
    retours === 'silencieux'
      ? 'Muets tant que les retours sont sur « Rien ».'
      : mouvementReduit()
        ? 'Cet appareil demande moins d’animations : Plumio ne bouge plus, et ne fait donc plus de bruit.'
        : 'Ailes, pépiements et coups de bec quand il bouge, tout doucement.';

  return (
    <Card>
      <CardBody>
        <button
          type="button"
          role="switch"
          aria-checked={bruitagesPlumio}
          aria-labelledby={idNom}
          aria-describedby={idDetail}
          onClick={() => {
            const actifs = !bruitagesPlumio;
            setBruitagesPlumio(actifs);
            if (actifs) ecouterPlumio();
          }}
          className="flex min-h-11 w-full items-center gap-3 text-start"
        >
          <Bird className="text-muted size-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span id={idNom} className="block text-sm font-semibold">
              Les bruitages de Plumio
            </span>
            <span id={idDetail} className="text-muted block text-xs leading-relaxed">
              {raison}
            </span>
          </span>
          <span
            aria-hidden
            className={cn(
              'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
              bruitagesPlumio
                ? 'border-brand-500 bg-brand-500'
                : 'border-[color:var(--border-fort)] bg-[color:var(--surface-muted)]',
            )}
          >
            <span
              className={cn(
                'absolute start-0.5 size-6 rounded-full bg-white shadow-sm transition-transform duration-200',
                bruitagesPlumio && 'translate-x-5 rtl:-translate-x-5',
              )}
            />
          </span>
        </button>
      </CardBody>
    </Card>
  );
}
