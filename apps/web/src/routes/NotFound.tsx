import { Link } from 'react-router';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <EmptyState
      title="Page introuvable"
      description="Le lien est peut-être ancien, ou le voyage a été supprimé."
      action={
        <Link to="/voyages">
          <Button variant="secondary">Revenir à mes voyages</Button>
        </Link>
      }
    />
  );
}
