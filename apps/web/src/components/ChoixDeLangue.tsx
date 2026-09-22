import { Check, Languages } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { LANGUES, langueDuSysteme } from '@/i18n/langues';
import { useLangue, type PreferenceDeLangue } from '@/stores/langue';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';

/**
 * Le choix de la langue.
 *
 * Par défaut, celle du système : on ne pose pas la question au démarrage,
 * parce que le navigateur y a déjà répondu. Le réglage existe pour les cas où
 * il se trompe — un téléphone en anglais entre les mains de quelqu'un qui
 * préfère lire le français, ce qui est très courant.
 *
 * Chaque langue est écrite dans sa propre langue. Chercher « Arabe » dans une
 * liste quand on lit l'arabe n'a aucun sens : on cherche « العربية ».
 */
export function ChoixDeLangue() {
  const preference = useLangue((etat) => etat.preference);
  const setPreference = useLangue((etat) => etat.setPreference);
  const t = useT();

  const auto = langueDuSysteme(
    typeof navigator === 'undefined' ? [] : [...(navigator.languages ?? [])],
  );
  const nomAuto = LANGUES.find((fiche) => fiche.code === auto)?.nom ?? auto;

  const choisir = (valeur: PreferenceDeLangue) => setPreference(valeur);

  return (
    <Card>
      <CardBody className="space-y-3">
        <button
          type="button"
          onClick={() => choisir('systeme')}
          aria-pressed={preference === 'systeme'}
          className={cn(
            'flex w-full items-center gap-3 rounded-[var(--radius-card)] border p-3 text-start transition-colors',
            preference === 'systeme' ?
              'border-brand-500 bg-brand-500/8'
            : 'filet hover:bg-[color:var(--surface-muted)]',
          )}
        >
          <Languages className="text-muted size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t('profil.langue.systeme')}</span>
            <span className="text-muted block text-sm">Actuellement : {nomAuto}</span>
          </span>
          {preference === 'systeme' && (
            <Check className="text-brand-600 dark:text-brand-300 size-4 shrink-0" aria-hidden />
          )}
        </button>

        <div className="flex flex-wrap gap-2">
          {LANGUES.map((fiche) => {
            const actif = preference === fiche.code;
            return (
              <button
                key={fiche.code}
                type="button"
                onClick={() => choisir(fiche.code)}
                aria-pressed={actif}
                // La puce porte la langue qu'elle nomme : un lecteur d'écran
                // francophone doit prononcer « 日本語 » en japonais, pas en
                // essayant de le lire en français.
                lang={fiche.code}
                dir={fiche.sens}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                  actif ?
                    'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-200 font-semibold'
                  : 'filet surface-raised text-muted',
                )}
              >
                {actif && <Check className="size-3.5" aria-hidden />}
                {fiche.nom}
              </button>
            );
          })}
        </div>

        <p className="text-muted text-xs leading-relaxed">
          La traduction couvre la navigation, les actions et les écrans d’entrée. Le reste
          s’affiche en français en attendant d’être traduit — un texte français vaut mieux qu’un
          texte passé à la machine.
        </p>
      </CardBody>
    </Card>
  );
}
