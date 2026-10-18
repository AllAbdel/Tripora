import { Check } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { useTheme, type StyleVisuel } from '@/stores/theme';

/**
 * L'habit de l'application : épuré (par défaut) ou carnet.
 *
 * Chaque choix montre un aperçu peint avec ses propres couleurs et sa propre
 * police, quel que soit l'habit en cours : on voit ce qu'on choisit avant de
 * le choisir. Les couleurs de l'aperçu sont celles des jetons de `index.css`
 * (le papier et l'encre du carnet, les gris de l'épuré), recopiées ici parce
 * qu'elles doivent rester visibles sous l'autre habit.
 */

interface Habit {
  valeur: StyleVisuel;
  nom: string;
  detail: string;
  fond: string;
  carte: string;
  trait: string;
  encre: string;
  police: string;
}

const HABITS: Habit[] = [
  {
    valeur: 'epure',
    nom: 'Épuré',
    detail: 'Gris neutres, une seule police. L’information d’abord.',
    fond: '#f5f5f6',
    carte: '#ffffff',
    trait: '#e6e6e9',
    encre: '#111113',
    police: "'Inter Tight', system-ui, sans-serif",
  },
  {
    valeur: 'carnet',
    nom: 'Carnet',
    detail: 'Papier crème, encre brune, titres à empattements.',
    fond: '#f4efe4',
    carte: '#fffdf8',
    trait: '#e6ddcb',
    encre: '#1a1713',
    police: "'Fraunces', Georgia, serif",
  },
];

export function ChoixDuStyle() {
  const { style, setStyle } = useTheme();
  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-sm font-semibold">Style</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Style">
          {HABITS.map((habit) => {
            const actif = style === habit.valeur;
            return (
              <button
                key={habit.valeur}
                type="button"
                role="radio"
                aria-checked={actif}
                onClick={() => setStyle(habit.valeur)}
                className={cn(
                  'relative flex flex-col gap-2 rounded-[var(--radius-card)] border p-2 text-start',
                  'transition-[border-color,transform] active:scale-[0.98]',
                  actif ? 'border-brand-500' : 'border-[color:var(--border-subtle)]',
                )}
              >
                {/* L'aperçu : un fond, une carte, un titre et deux lignes. */}
                <span
                  aria-hidden
                  className="block rounded-[calc(var(--radius-card)-4px)] p-2"
                  style={{ backgroundColor: habit.fond }}
                >
                  <span
                    className="block rounded-md border p-2"
                    style={{ backgroundColor: habit.carte, borderColor: habit.trait }}
                  >
                    <span
                      className="block text-base leading-none font-semibold"
                      style={{ color: habit.encre, fontFamily: habit.police }}
                    >
                      Lisbonne
                    </span>
                    <span className="mt-2 block h-1.5 w-4/5 rounded-full" style={{ backgroundColor: habit.trait }} />
                    <span className="mt-1 block h-1.5 w-3/5 rounded-full" style={{ backgroundColor: habit.trait }} />
                  </span>
                </span>
                <span className="px-1 pb-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {habit.nom}
                    {actif && <Check className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />}
                  </span>
                  <span className="text-muted mt-0.5 block text-xs leading-snug">{habit.detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
