import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { ScreenHeader } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';
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
