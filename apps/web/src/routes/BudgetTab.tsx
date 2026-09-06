import { Wallet } from 'lucide-react';
import { TripPickerTab } from './TripPickerTab';

export default function BudgetTab() {
  return (
    <TripPickerTab
      title="Budget"
      sousChemin="budget"
      icone={<Wallet className="text-brand-500 size-5" aria-hidden />}
      descriptionVide="Notez ce que chacun avance pendant le voyage : Tripora calcule qui doit combien à qui, et réduit les remboursements au minimum."
    />
  );
}
