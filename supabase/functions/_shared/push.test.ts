/**
 * Le chiffrement des notifications (RFC 8291), vérifié sur l'exemple de la
 * RFC elle-même, puis dans les deux sens comme le ferait un navigateur.
 *
 *   deno test supabase/functions/_shared/push.test.ts
 *
 * Aucune dépendance, aucun réseau : WebCrypto suffit.
 */
import { base64url, chiffrer, depuisBase64url } from './push.ts';

function vrai(condition: boolean, quoi: string): void {
  if (!condition) throw new Error(quoi);
}

/** Une paire ECDH importée depuis ses octets bruts, comme dans l'annexe A. */
async function paireDepuis(privee: string, publique: string): Promise<CryptoKeyPair> {
  const brute = depuisBase64url(publique);
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: privee,
    x: base64url(brute.slice(1, 33)),
    y: base64url(brute.slice(33, 65)),
    ext: true,
  };
  const privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const publicKey = await crypto.subtle.importKey('raw', brute, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  return { privateKey, publicKey };
}

async function hkdf(sel: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, octets: number) {
  const cle = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sel, info }, cle, octets * 8));
}

/** Ce que fait le navigateur à la réception : relire l'en-tête, refaire les clés, déchiffrer. */
async function dechiffrer(corps: Uint8Array<ArrayBuffer>, navigateur: CryptoKeyPair, auth: string): Promise<string> {
  const sel = corps.slice(0, 16);
  const longueur = corps[20]!;
  const clePubliqueEphemere = corps.slice(21, 21 + longueur);
  const chiffre = corps.slice(21 + longueur);
  const clePubliqueDuNavigateur = new Uint8Array(await crypto.subtle.exportKey('raw', navigateur.publicKey));
  const ephemere = await crypto.subtle.importKey('raw', clePubliqueEphemere, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const partage = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ephemere }, navigateur.privateKey, 256));
  const texte = new TextEncoder();
  const info = new Uint8Array([...texte.encode('WebPush: info\0'), ...clePubliqueDuNavigateur, ...clePubliqueEphemere]);
  const ikm = await hkdf(depuisBase64url(auth), partage, info, 32);
  const cek = await hkdf(sel, ikm, texte.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sel, ikm, texte.encode('Content-Encoding: nonce\0'), 12);
  const cle = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const clair = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, cle, chiffre));
  vrai(clair.at(-1) === 2, 'le dernier enregistrement se termine par 0x02');
  return new TextDecoder().decode(clair.slice(0, -1));
}

Deno.test('reproduit octet pour octet l’exemple de la RFC 8291 (annexe A)', async () => {
  const serveur = await paireDepuis(
    'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  );
  const corps = await chiffrer(
    new TextEncoder().encode('When I grow up, I want to be a watermelon'),
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    'BTBZMqHH6r4Tts7J_aSIgg',
    { paire: serveur, sel: depuisBase64url('DGv6ra1nlYgDCS1FRnbzlw') },
  );
  const attendu =
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';
  vrai(base64url(corps) === attendu, `corps chiffré différent de la RFC : ${base64url(corps)}`);
});

Deno.test('un navigateur relit ce qu’on lui envoie, et lui seul', async () => {
  const navigateur = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const p256dh = base64url(new Uint8Array(await crypto.subtle.exportKey('raw', navigateur.publicKey)));
  const auth = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const message = JSON.stringify({ genre: 'message', qui: 'Léa', extrait: 'On part à 7 h ?' });

  const corps = await chiffrer(new TextEncoder().encode(message), p256dh, auth);
  vrai((await dechiffrer(corps, navigateur, auth)) === message, 'le navigateur doit retrouver le message');

  // Deux envois du même message ne se ressemblent pas : sel et clé éphémère neufs.
  const second = await chiffrer(new TextEncoder().encode(message), p256dh, auth);
  vrai(base64url(second) !== base64url(corps), 'deux envois identiques ne doivent pas donner les mêmes octets');

  // Un autre secret d'authentification ne déchiffre rien.
  const intrus = base64url(crypto.getRandomValues(new Uint8Array(16)));
  let refuse = false;
  try {
    await dechiffrer(corps, navigateur, intrus);
  } catch {
    refuse = true;
  }
  vrai(refuse, 'un autre secret ne doit pas déchiffrer la notification');
});
