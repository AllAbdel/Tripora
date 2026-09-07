import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Monitor, Moon, ShieldCheck, Sun } from 'lucide-react';
import { ScreenHeader } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';
import { getApps } from '@/lib/apps';
import { useTheme, type ThemePreference } from '@/stores/theme';
import { cn } from '@/lib/cn';

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'system', label: 'Système', icon: Monitor },
];

export default function Profile() {
  const { identity, signOut, backendReady } = useAuth();
  const { preference, setPreference } = useTheme();
  const apps = getApps();

  // L'entrée de modération n'apparaît que pour qui en a la charge. Ce n'est
  // pas une protection — les politiques de la base en sont une — juste la
  // politesse de ne pas montrer une porte fermée.
  const jeModere = useQuery({
    queryKey: ['suis-je-admin'],
    queryFn: () => apps!.amIAdmin(),
    enabled: Boolean(apps),
    staleTime: 60 * 60 * 1000,
  });

  return (
    <>
      <ScreenHeader title="Profil" />

      <div className="space-y-4 px-5">
        <Card>
          <CardBody className="flex items-center gap-4">
            <div
              aria-hidden
              className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-500 text-xl font-bold text-white"
            >
              {(identity?.displayName ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{identity?.displayName ?? 'Voyageur'}</p>
              <p className="text-muted text-sm">
                {identity?.isAnonymous ? 'Compte invité' : 'Compte Google'}
                {!backendReady && ' · stocké sur cet appareil'}
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm font-semibold">Apparence</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thème">
              {THEMES.map(({ value, label, icon: Icon }) => {
                const active = preference === value;
                return (
                  <button
                    key={value}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPreference(value)}
                    className={cn(
                      'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-medium transition-colors',
                      active
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100'
                        : 'border-[color:var(--border-subtle)] text-muted',
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {jeModere.data && (
          <Card>
            <CardBody className="space-y-2">
              <p className="text-sm font-semibold">Modération</p>
              <p className="text-muted text-sm">
                Les applications proposées par les membres attendent votre relecture avant
                d’apparaître pour tout le monde.
              </p>
              <Link
                to="/applications/moderation"
                className="text-brand-600 dark:text-brand-300 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
              >
                <ShieldCheck className="size-4" aria-hidden />
                Relire les propositions
              </Link>
            </CardBody>
          </Card>
        )}

        <Button
          variant="ghost"
          block
          icon={<LogOut className="size-4" aria-hidden />}
          onClick={() => void signOut()}
        >
          Se déconnecter
        </Button>
      </div>
    </>
  );
}
