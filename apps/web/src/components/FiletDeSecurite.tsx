import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { remonterUneErreur } from '@/lib/remonterLesErreurs';

/**
 * Le filet sous toute l'application : un écran qui plante n'emporte plus la
 * page entière dans un blanc sans explication.
 *
 * L'erreur est remontée (sans donnée personnelle, voir `remonterLesErreurs`),
 * et la personne a deux portes de sortie : recharger, ou revenir à ses
 * voyages. Ses données ne sont pas touchées — elles vivent dans le cache et
 * sur le serveur, pas dans l'écran qui vient de tomber.
 */
export class FiletDeSecurite extends Component<{ children: ReactNode }, { erreur: boolean }> {
  override state = { erreur: false };

  static getDerivedStateFromError(): { erreur: boolean } {
    return { erreur: true };
  }

  override componentDidCatch(erreur: Error, info: ErrorInfo): void {
    // La pile des composants dit lequel est tombé : plus utile que la pile JavaScript seule.
    if (info.componentStack) erreur.stack = `${erreur.stack ?? ''}\n${info.componentStack}`;
    remonterUneErreur(erreur);
  }

  override render(): ReactNode {
    if (!this.state.erreur) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-6 py-10">
        <h1 className="titre text-2xl">Cet écran a rencontré un problème</h1>
        <p className="text-muted text-sm leading-relaxed">
          Vos voyages ne sont pas touchés. Le problème nous a été signalé, sans rien qui vous désigne ; recharger
          l’application suffit le plus souvent.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => window.location.reload()}>
            Recharger
          </Button>
          <Button variant="secondary" onClick={() => window.location.assign('/voyages')}>
            Revenir à mes voyages
          </Button>
        </div>
      </main>
    );
  }
}
