import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * QR code du lien d'invitation, rendu en SVG dans la page.
 *
 * Généré localement : aucun service extérieur n'apprend qui invite qui, et le
 * code s'affiche même sans réseau. Le SVG reste net à toutes les tailles, ce
 * qui compte quand on scanne l'écran d'un téléphone avec un autre téléphone.
 *
 * Export par défaut et chargement à la demande : la bibliothèque embarque un
 * encodeur PNG dont on ne se sert pas, et pesait 200 Ko dans le paquet
 * principal pour un carré affiché derrière un bouton.
 */
export default function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      // Correction d'erreur moyenne : le code reste lisible même si l'écran
      // est un peu sale ou photographié de biais.
      errorCorrectionLevel: 'M',
      color: { dark: '#0b1220ff', light: '#ffffffff' },
    })
      .then((result) => {
        if (vivant) setSvg(result);
      })
      .catch(() => {
        if (vivant) setSvg(null);
      });
    return () => {
      vivant = false;
    };
  }, [value]);

  if (!svg) {
    return (
      <div
        className="animate-pulse rounded-2xl bg-[color:var(--border-subtle)]"
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    <div
      role="img"
      aria-label="QR code du lien d’invitation"
      className="overflow-hidden rounded-2xl bg-white p-2"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
