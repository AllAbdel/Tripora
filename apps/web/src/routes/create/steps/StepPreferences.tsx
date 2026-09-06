import { PreferenceEditor } from '@/components/PreferenceEditor';
import { useTripDraft } from '@/stores/tripDraft';

export function StepPreferences() {
  const { weights, setWeight } = useTripDraft();

  return (
    <div className="space-y-3">
      <p className="text-muted text-sm leading-relaxed">
        Répondez pour vous, pas pour le groupe. Chaque participant remplira les siennes,
        et Tripora cherchera le meilleur compromis.
      </p>
      <PreferenceEditor weights={weights} onChange={setWeight} />
    </div>
  );
}
