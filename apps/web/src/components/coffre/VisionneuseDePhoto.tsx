import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Une photo du coffre en plein écran, dans l'application : la carte
 * d'embarquement qu'on tend au comptoir, le QR code d'un billet qu'on fait
 * scanner. Fond noir, luminosité de la photo intacte, un bouton pour fermer.
 *
 * Plutôt qu'un nouvel onglet : dans l'application Android, un onglet s'ouvre
 * dans le navigateur, hors de Tripora, et ne sait pas lire une copie gardée
 * sur le téléphone.
 */
export function VisionneuseDePhoto({ adresse, nom, surFermer }: { adresse: string; nom: string; surFermer: () => void }) {
  const fermer = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fermer.current?.focus();
    const surTouche = (event: KeyboardEvent) => {
      if (event.key === 'Escape') surFermer();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [surFermer]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={nom}
      className="fixed inset-0 z-50 flex flex-col bg-black"
      style={{ paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-3 px-3 py-2 text-white">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{nom}</p>
        <button
          ref={fermer}
          type="button"
          onClick={surFermer}
          aria-label="Fermer"
          className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-white/10"
        >
          <X className="size-6" aria-hidden />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-2" onClick={surFermer}>
        <img
          src={adresse}
          alt={nom}
          className="max-h-full max-w-full object-contain"
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </div>
  );
}
