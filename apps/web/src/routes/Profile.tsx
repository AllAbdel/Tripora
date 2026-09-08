import { useRef } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  BellOff,
  Check,
  HandCoins,
  LogOut,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  Vibrate,
  Volume2,
} from 'lucide-react';
import { ACCENTS_PROPOSES, paletteDepuis } from '@tripora/core';
import { ScreenHeader } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';
import { getApps } from '@/lib/apps';
import { apercuDesRetours, vibrationDisponible } from '@/lib/feedback';
import {
  ACCENT_PAR_DEFAUT,
  useTheme,
  type Retours,
  type ThemePreference,
} from '@/stores/theme';
import { cn } from '@/lib/cn';

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'system', label: 'Système', icon: Monitor },
];

const RETOURS: { value: Retours; label: string; detail: string; icon: typeof Sun }[] = [
  { value: 'silencieux', label: 'Rien', detail: 'Aucun retour', icon: BellOff },
  { value: 'vibrations', label: 'Vibrations', detail: 'Discret', icon: Vibrate },
  { value: 'complet', label: 'Son', detail: 'Et vibrations', icon: Volume2 },
];

/**
 * Le profil, et tout ce qui se règle.
 *
 * Trois blocs seulement, dans l'ordre où on les cherche : qui je suis, à quoi
 * ça ressemble, ce que ça me renvoie. Les réglages qui n'existent pas pour
 * tout le monde — la modération — n'apparaissent que pour qui en a la charge :
 * une porte fermée sur un écran de réglages donne l'impression d'être passé à
 * côté de quelque chose.
 */
export default function Profile() {
  const { identity, signOut, backendReady } = useAuth();
  const apps = getApps();

  const jeModere = useQuery({
    queryKey: ['suis-je-admin'],
    queryFn: () => apps!.amIAdmin(),
    enabled: Boolean(apps),
    staleTime: 60 * 60 * 1000,
  });

  return (
    <>
      <ScreenHeader title="Profil" />

      <div className="space-y-6 px-5 pb-4">
        <Card className="animate-rise">
          <CardBody className="flex items-center gap-4">
            <div
              aria-hidden
              className="bg-brand-500 grid size-14 shrink-0 place-items-center rounded-full text-xl font-bold text-[color:var(--accent-contrast)]"
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

        <Section titre="Apparence">
          <ChoixDeTheme />
          <ChoixDeCouleur />
        </Section>

        <Section titre="Retours">
          <ChoixDesRetours />
        </Section>

        <Section titre="Tripora">
          <Card>
            <CardBody className="space-y-2">
              <p className="text-muted text-sm leading-relaxed">
                Gratuit, sans compte payant, sans publicité et sans revente de données. Ce qui le
                finance tient en deux liens de parrainage, et c’est écrit en entier.
              </p>
              <Link
                to="/soutenir"
                className="text-brand-600 dark:text-brand-300 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
              >
                <HandCoins className="size-4" aria-hidden />
                Comment Tripora est financé
              </Link>
            </CardBody>
          </Card>
        </Section>

        {jeModere.data && (
          <Section titre="Modération">
            <Card>
              <CardBody className="space-y-2">
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
          </Section>
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

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-muted px-1 text-xs font-semibold tracking-wide uppercase">{titre}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ChoixDeTheme() {
  const { preference, setPreference } = useTheme();
  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-sm font-semibold">Clair ou sombre</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thème">
          {THEMES.map(({ value, label, icon: Icon }) => {
            const actif = preference === value;
            return (
              <button
                key={value}
                role="radio"
                aria-checked={actif}
                onClick={() => setPreference(value)}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border',
                  'text-xs font-medium transition-[background-color,border-color,transform]',
                  'active:scale-[0.97]',
                  actif
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100'
                    : 'text-muted border-[color:var(--border-subtle)]',
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
  );
}

/**
 * La couleur de l'application.
 *
 * Huit propositions et un sélecteur libre. Les huit existent parce que la
 * plupart des gens veulent choisir en trois secondes, pas régler une teinte ;
 * le sélecteur existe parce que ceux qui ont une couleur en tête n'accepteront
 * pas l'à-peu-près le plus proche.
 *
 * La couleur affichée sur la pastille est celle que l'application prendra,
 * pas celle du sélecteur : la palette assombrit la teinte jusqu'au point où du
 * texte blanc reste lisible dessus. Montrer autre chose serait promettre une
 * couleur qu'on ne donne pas. Le détail est dans `palette.ts`.
 */
function ChoixDeCouleur() {
  const { accent, setAccent } = useTheme();
  const champ = useRef<HTMLInputElement>(null);

  const surMesure = !ACCENTS_PROPOSES.some(
    (propose) => propose.couleur.toLowerCase() === accent.toLowerCase(),
  );

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Votre couleur</p>
          {accent.toLowerCase() !== ACCENT_PAR_DEFAUT && (
            <button
              type="button"
              onClick={() => setAccent(ACCENT_PAR_DEFAUT)}
              className="text-muted min-h-9 text-xs font-medium underline"
            >
              Revenir au bleu d’origine
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Couleur principale">
          {ACCENTS_PROPOSES.map(({ nom, couleur }) => (
            <Pastille
              key={couleur}
              couleur={couleur}
              nom={nom}
              actif={couleur.toLowerCase() === accent.toLowerCase()}
              onClick={() => setAccent(couleur)}
            />
          ))}

          {/* Le sélecteur natif : celui du système, que chacun sait déjà utiliser. */}
          <button
            type="button"
            role="radio"
            aria-checked={surMesure}
            aria-label="Une autre couleur"
            onClick={() => champ.current?.click()}
            className="relative grid size-11 place-items-center rounded-full transition-transform active:scale-90"
            style={
              surMesure
                ? {
                    backgroundColor: paletteDepuis(accent)?.[500] ?? accent,
                    outline: `2px solid ${paletteDepuis(accent)?.[500] ?? accent}`,
                    outlineOffset: '2px',
                  }
                : {
                    background:
                      'conic-gradient(#d1463c,#b46100,#8a8a00,#258747,#058391,#0073ec,#6e65e5,#c64492,#d1463c)',
                    outline: '1px solid var(--border-subtle)',
                  }
            }
          >
            {surMesure ? (
              <Check className="size-5 text-white" aria-hidden />
            ) : (
              <Palette className="size-4 text-white drop-shadow" aria-hidden />
            )}
          </button>
          <input
            ref={champ}
            type="color"
            value={accent}
            onChange={(evenement) => setAccent(evenement.target.value)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
        </div>

        <p className="text-muted text-xs leading-relaxed">
          Toute l’application suit, jusqu’à la barre du téléphone. La couleur est assombrie
          juste ce qu’il faut pour que le texte des boutons reste lisible — un jaune fluo
          deviendra un ambre profond, pas un bouton illisible.
        </p>
      </CardBody>
    </Card>
  );
}

function Pastille({
  couleur,
  nom,
  actif,
  onClick,
}: {
  couleur: string;
  nom: string;
  actif: boolean;
  onClick: () => void;
}) {
  const palette = paletteDepuis(couleur);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={actif}
      aria-label={nom}
      title={nom}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-full transition-transform active:scale-90"
      style={{
        backgroundColor: palette?.[500] ?? couleur,
        // Un contour plutôt que l'anneau de Tailwind : sa couleur se pilote
        // depuis un style en ligne, ce que `ring` ne permet pas proprement.
        outline: actif
          ? `2px solid ${palette?.[500] ?? couleur}`
          : '1px solid color-mix(in oklab, currentColor 15%, transparent)',
        outlineOffset: actif ? '2px' : '0',
      }}
    >
      {actif && <Check className="size-5 text-white drop-shadow" aria-hidden />}
    </button>
  );
}

/**
 * Ce que l'application renvoie sous le doigt.
 *
 * Choisir déclenche immédiatement le retour choisi : c'est le seul réglage
 * qu'on ne peut pas juger sur son intitulé. Et sur un iPhone, la vibration
 * n'existe pas — autant le dire plutôt que de laisser croire à une panne.
 */
function ChoixDesRetours() {
  const { retours, setRetours } = useTheme();
  const sansVibration = !vibrationDisponible();

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="text-sm font-semibold">Sous le doigt</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Retours">
          {RETOURS.map(({ value, label, detail, icon: Icon }) => {
            const actif = retours === value;
            return (
              <button
                key={value}
                role="radio"
                aria-checked={actif}
                onClick={() => {
                  setRetours(value);
                  apercuDesRetours(value);
                }}
                className={cn(
                  'flex min-h-18 flex-col items-center justify-center gap-1 rounded-2xl border px-1',
                  'text-xs font-medium transition-[background-color,border-color,transform]',
                  'active:scale-[0.97]',
                  actif
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100'
                    : 'text-muted border-[color:var(--border-subtle)]',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
                <span className="text-muted text-[0.65rem] leading-none">{detail}</span>
              </button>
            );
          })}
        </div>
        <p className="text-muted text-xs leading-relaxed">
          {sansVibration
            ? 'Cet appareil ne sait pas vibrer depuis une page web — c’est le cas de tous les iPhone. Le son, lui, fonctionne.'
            : 'Des retours très courts, à peine perceptibles. Le son reste à demander : une application qui se met à faire du bruit dans un train se fait couper une fois pour toutes.'}
        </p>
      </CardBody>
    </Card>
  );
}
