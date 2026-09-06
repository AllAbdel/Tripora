import { Map as MapIcon } from 'lucide-react';
import { TripPickerTab } from './TripPickerTab';

export default function MapTab() {
  return (
    <TripPickerTab
      title="Carte"
      sousChemin="carte"
      icone={<MapIcon className="text-brand-500 size-5" aria-hidden />}
      descriptionVide="La carte montre d’où vous partez et où vous pourriez aller. Créez un voyage pour la voir se remplir."
    />
  );
}
