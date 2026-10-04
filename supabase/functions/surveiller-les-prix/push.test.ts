/**
 * La signature des notifications, et le seuil qui décide de les envoyer.
 *
 *   deno test supabase/functions/surveiller-les-prix/push.test.ts
 *
 * Aucune dépendance, aucun réseau : WebCrypto suffit.
 */
import { baisseASignaler, creerClesVapid, jetonVapid } from './push.ts';

function vrai(condition: boolean, quoi: string): void {
  if (!condition) throw new Error(quoi);
}

function depuisBase64url(texte: string): Uint8Array<ArrayBuffer> {
  const b64 = texte.replace(/-/gu, '+').replace(/_/gu, '/');
  const binaire = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binaire, (c) => c.charCodeAt(0));
}

Deno.test('le jeton VAPID est un JWT ES256 vérifiable avec la clé publique', async () => {
  const cles = await creerClesVapid();
  vrai(depuisBase64url(cles.publique).length === 65, 'une clé publique brute fait 65 octets');

  const jeton = await jetonVapid(
    'https://fcm.googleapis.com/fcm/send/abc',
    cles.privee,
    'https://tripora-3rg.pages.dev',
    1_800_000_000,
  );
  const [entete, charge, signature] = jeton.split('.');
  const claims = JSON.parse(new TextDecoder().decode(depuisBase64url(charge!)));
  vrai(claims.aud === 'https://fcm.googleapis.com', `aud : ${claims.aud}`);
  vrai(claims.exp === 1_800_000_000 + 12 * 3600, 'exp à douze heures');
  vrai(JSON.parse(new TextDecoder().decode(depuisBase64url(entete!))).alg === 'ES256', 'alg ES256');

  const publique = await crypto.subtle.importKey(
    'raw',
    depuisBase64url(cles.publique),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  const valide = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publique,
    depuisBase64url(signature!),
    new TextEncoder().encode(`${entete}.${charge}`),
  );
  vrai(valide, 'la signature doit se vérifier avec la clé publique');
});

Deno.test('ne prévient que pour une vraie baisse', () => {
  vrai(baisseASignaler(18_000, 15_900), '−21 € sur 180 € : oui');
  vrai(!baisseASignaler(6_000, 5_300), '−7 € sur 60 € : trop peu');
  vrai(!baisseASignaler(90_000, 88_000), '−20 € sur 900 € : moins de 10 %');
  vrai(!baisseASignaler(null, 5_000), 'sans prix de référence : rien');
});
