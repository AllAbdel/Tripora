/**
 * Notifications Web Push, sans dépendance : la signature VAPID (RFC 8292) et
 * le chiffrement du contenu (RFC 8291).
 *
 * Deux sortes d'envoi :
 *
 * - `reveiller` : une notification vide, qui réveille seulement le
 *   navigateur ; son service worker affiche un message fixe. C'est ce que
 *   font les alertes de prix — ni destination ni prix ne transitent.
 * - `envoyer` : une notification qui porte un contenu (qui a écrit, quoi,
 *   dans quel voyage), chiffré pour cet appareil seul. Le service de
 *   notification du navigateur (Google, Mozilla, Apple) transporte des
 *   octets qu'il ne peut pas lire.
 *
 * La paire de clés VAPID est créée côté serveur, au premier passage : la clé
 * privée n'existe nulle part ailleurs.
 */

export interface ClesVapid {
  /** La clé publique brute (65 octets), en base64url : c'est elle que reçoit le navigateur. */
  publique: string;
  /** La clé privée, au format JWK. */
  privee: JsonWebKey;
}

export function base64url(octets: Uint8Array): string {
  let binaire = '';
  for (const octet of octets) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

function texteEnBase64url(texte: string): string {
  return base64url(new TextEncoder().encode(texte));
}

/** Une paire ECDSA P-256, comme l'exige VAPID. */
export async function creerClesVapid(): Promise<ClesVapid> {
  const paire = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const brute = new Uint8Array(await crypto.subtle.exportKey('raw', paire.publicKey));
  const privee = await crypto.subtle.exportKey('jwk', paire.privateKey);
  return { publique: base64url(brute), privee };
}

/**
 * Le jeton VAPID pour un service de notification donné.
 *
 * `aud` est l'origine du service (https://fcm.googleapis.com…), `exp` au plus
 * vingt-quatre heures plus tard, `sub` un moyen de joindre l'expéditeur.
 * WebCrypto signe en ES256 au format r‖s, qui est exactement celui du JWT.
 */
export async function jetonVapid(
  endpoint: string,
  privee: JsonWebKey,
  contact: string,
  maintenant = Math.floor(Date.now() / 1000),
): Promise<string> {
  const entete = texteEnBase64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const charge = texteEnBase64url(
    JSON.stringify({ aud: new URL(endpoint).origin, exp: maintenant + 12 * 60 * 60, sub: contact }),
  );
  const cle = await crypto.subtle.importKey('jwk', privee, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ]);
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, new TextEncoder().encode(`${entete}.${charge}`)),
  );
  return `${entete}.${charge}.${base64url(signature)}`;
}

export type ResultatDEnvoi = 'envoye' | 'perime' | 'echec';

/**
 * Réveille un navigateur abonné. `perime` : l'abonnement n'existe plus
 * (404 ou 410), il faut l'oublier.
 */
export async function reveiller(
  endpoint: string,
  cles: ClesVapid,
  contact: string,
): Promise<ResultatDEnvoi> {
  const jeton = await jetonVapid(endpoint, cles.privee, contact);
  const reponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      TTL: String(24 * 60 * 60),
      Urgency: 'normal',
      Authorization: `vapid t=${jeton}, k=${cles.publique}`,
      'Content-Length': '0',
    },
    signal: AbortSignal.timeout(10_000),
  });
  await reponse.body?.cancel();
  if (reponse.status === 404 || reponse.status === 410) return 'perime';
  return reponse.ok ? 'envoye' : 'echec';
}

/* ------------------------------------------------------------ Chiffrement -- */

/** L'abonnement d'un navigateur, tel que `PushSubscription.toJSON()` le donne. */
export interface AbonnementPush {
  endpoint: string;
  /** La clé publique ECDH P-256 du navigateur, 65 octets en base64url. */
  p256dh: string;
  /** Le secret partagé avec le navigateur, 16 octets en base64url. */
  auth: string;
}

export function depuisBase64url(texte: string): Uint8Array<ArrayBuffer> {
  const b64 = texte.replace(/-/gu, '+').replace(/_/gu, '/');
  const binaire = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binaire, (caractere) => caractere.charCodeAt(0));
}

function assembler(...morceaux: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const tout = new Uint8Array(morceaux.reduce((total, morceau) => total + morceau.length, 0));
  let position = 0;
  for (const morceau of morceaux) {
    tout.set(morceau, position);
    position += morceau.length;
  }
  return tout;
}

async function hkdf(sel: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, octets: number) {
  const cle = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sel, info }, cle, octets * 8));
}

/** Pour les tests : la paire éphémère et le sel, sinon tirés au hasard. */
export interface Hasard {
  paire?: CryptoKeyPair;
  sel?: Uint8Array<ArrayBuffer>;
}

/**
 * Chiffre un contenu pour un navigateur (RFC 8291, codage « aes128gcm »).
 *
 * Une paire ECDH éphémère par message ; le secret partagé avec la clé du
 * navigateur, mêlé à son secret d'authentification, donne la clé AES et le
 * nonce. Un seul enregistrement, terminé par l'octet 0x02. L'en-tête porte
 * le sel, la taille d'enregistrement et la clé publique éphémère.
 */
export async function chiffrer(contenu: Uint8Array<ArrayBuffer>, p256dh: string, auth: string, hasard: Hasard = {}) {
  const clePubliqueDuNavigateur = depuisBase64url(p256dh);
  const secret = depuisBase64url(auth);
  const paire =
    hasard.paire ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair);
  const clePubliqueEphemere = new Uint8Array(await crypto.subtle.exportKey('raw', paire.publicKey));

  const cleDuNavigateur = await crypto.subtle.importKey(
    'raw',
    clePubliqueDuNavigateur,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const partage = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: cleDuNavigateur }, paire.privateKey, 256),
  );

  const texte = new TextEncoder();
  const ikm = await hkdf(
    secret,
    partage,
    assembler(texte.encode('WebPush: info\0'), clePubliqueDuNavigateur, clePubliqueEphemere),
    32,
  );
  const sel = hasard.sel ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sel, ikm, texte.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sel, ikm, texte.encode('Content-Encoding: nonce\0'), 12);

  const cleAes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const chiffre = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cleAes, assembler(contenu, new Uint8Array([2]))),
  );

  const entete = new Uint8Array(16 + 4 + 1 + clePubliqueEphemere.length);
  entete.set(sel, 0);
  new DataView(entete.buffer).setUint32(16, 4096);
  entete[20] = clePubliqueEphemere.length;
  entete.set(clePubliqueEphemere, 21);
  return assembler(entete, chiffre);
}

/**
 * Envoie une notification qui porte un contenu (en JSON), chiffré pour cet
 * appareil. `perime` : l'abonnement n'existe plus, il faut l'oublier.
 */
export async function envoyer(
  abonnement: AbonnementPush,
  contenu: unknown,
  cles: ClesVapid,
  contact: string,
  { ttl = 24 * 60 * 60, urgence = 'normal' }: { ttl?: number; urgence?: 'low' | 'normal' | 'high' } = {},
): Promise<ResultatDEnvoi> {
  const corps = await chiffrer(new TextEncoder().encode(JSON.stringify(contenu)), abonnement.p256dh, abonnement.auth);
  const jeton = await jetonVapid(abonnement.endpoint, cles.privee, contact);
  const reponse = await fetch(abonnement.endpoint, {
    method: 'POST',
    headers: {
      TTL: String(ttl),
      Urgency: urgence,
      Authorization: `vapid t=${jeton}, k=${cles.publique}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
    },
    body: corps,
    signal: AbortSignal.timeout(10_000),
  });
  await reponse.body?.cancel();
  if (reponse.status === 404 || reponse.status === 410) return 'perime';
  return reponse.ok ? 'envoye' : 'echec';
}
