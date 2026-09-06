import { Plus, Sparkles } from 'lucide-react';
import { ScreenHeader } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/lib/auth';

export default function Trips() {
  const { identity, backendReady } = useAuth();

  return (
    <>
      <ScreenHeader
        title="Mes voyages"
        subtitle={identity ? `Bonjour ${identity.displayName}` : undefined}
      />

      <div className="space-y-4 px-5">
        {!backendReady && (
          <Banner tone="warning" title="Mode local">
            Les voyages créés ici ne sont pas encore partagés avec vos amis.
            Reliez un projet Supabase pour activer la collaboration.
          </Banner>
        )}

        <EmptyState
          illustration={<Logo className="size-16 opacity-90" />}
          title="Aucun voyage pour l’instant"
          description="Créez un voyage, invitez vos amis, et laissez chacun dire son budget et ses envies. Tripora s’occupe de proposer des destinations et d’en expliquer le prix."
          action={
            <Button size="lg" icon={<Plus className="size-5" aria-hidden />} disabled>
              Créer un voyage
            </Button>
          }
        />

        <Banner tone="info" title="Prochaine étape du développement">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5" aria-hidden />
            L’assistant de création de voyage arrive à l’étape suivante.
          </span>
        </Banner>
      </div>
    </>
  );
}
