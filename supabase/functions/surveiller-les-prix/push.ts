/**
 * Notifications Web Push, sans dépendance.
 *
 * Une notification « vide » : on ne chiffre aucun contenu, on réveille
 * seulement le navigateur, dont le service worker affiche un message fixe
 * (« un prix que vous suivez a baissé ») et ouvre Tripora au toucher. Rien de
 * personnel ne transite par le service de notification du navigateur — ni
 * destination, ni prix — et il n'y a pas de chiffrement de contenu à
 * maintenir (RFC 8291). Seule la signature VAPID (RFC 8292) est nécessaire :
 * elle prouve au service que c'est bien Tripora qui envoie.
 *
 * La paire de clés est créée ici, côté serveur, au premier passage : la clé
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

/**
 * Faut-il prévenir ? Une baisse d'au moins 10 % et d'au moins 15 € par
 * rapport au dernier prix signalé (ou au premier relevé).
 *
 * Les deux seuils se complètent : 10 % d'un vol à 60 € ne valent pas une
 * notification, et 15 € sur un long-courrier à 900 € non plus.
 */
export function baisseASignaler(reference: number | null, nouveau: number): boolean {
  if (reference === null || nouveau <= 0) return false;
  return nouveau <= reference * 0.9 && reference - nouveau >= 1500;
}
