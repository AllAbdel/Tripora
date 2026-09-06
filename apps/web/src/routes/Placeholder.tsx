import { ScreenHeader } from '@/components/AppShell';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Écran d'attente pour les onglets dont la fonctionnalité arrive plus tard.
 * Il annonce ce qui viendra plutôt que d'afficher une page morte.
 */
export function Placeholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <>
      <ScreenHeader title={title} />
      <EmptyState title={phase} description={description} />
    </>
  );
}
