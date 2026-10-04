/**
 * Ce que le serveur accepte d'ouvrir, et ce qu'il croit de ce qu'il lit.
 *
 *   deno test supabase/functions/lire-un-lien/lecture.test.ts
 *
 * Aucune dépendance : ce fichier tourne hors ligne.
 */
import {
  adressePublique,
  carteDerriereLeConsentement,
  corpusDuLien,
  ipPublique,
  lieuxCites,
  metaDeLaPage,
  oEmbedDe,
  premierLienDuTexte,
  sourceDe,
} from './lecture.ts';

function egal(obtenu: unknown, attendu: unknown, quoi: string): void {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a !== b) throw new Error(`${quoi} : obtenu ${a}, attendu ${b}`);
}

Deno.test('refuse les adresses qui ne sont pas du web public', () => {
  for (const interdite of [
    'http://localhost:54321/rest/v1/',
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://0x7f000001/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://user:motdepasse@exemple.fr/',
    'https://exemple.fr:8080/',
    'http://serveur.internal/',
    'http://intranet/',
  ]) {
    egal(adressePublique(interdite), null, interdite);
  }
  egal(adressePublique('https://www.tiktok.com/@a/video/1')?.hostname, 'www.tiktok.com', 'tiktok');
});

Deno.test('juge où mène un nom : une adresse interne est refusée, même déguisée', () => {
  for (const interne of [
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fe80::1',
    'fd00::1234',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:a9fe:a9fe',
    '::10.0.0.1',
    '64:ff9b::a00:1',
    '2001:db8::1',
    'pas-une-adresse',
    '1:2:3',
  ]) {
    egal(ipPublique(interne), false, interne);
  }
  for (const publique of ['8.8.8.8', '151.101.1.140', '172.32.0.1', '2a00:1450:4007:80e::200e', '::ffff:8.8.8.8', '64:ff9b::808:808']) {
    egal(ipPublique(publique), true, publique);
  }
});

Deno.test('trouve le lien dans un texte partagé, sans la ponctuation', () => {
  egal(
    premierLienDuTexte('Regarde ça ! https://vm.tiktok.com/ZNabc123/.'),
    'https://vm.tiktok.com/ZNabc123/',
    'lien partagé',
  );
  egal(premierLienDuTexte('Pas de lien ici'), null, 'sans lien');
});

Deno.test('reconnaît la source et prépare l’oEmbed des vidéos', () => {
  egal(sourceDe(new URL('https://maps.app.goo.gl/abc')), 'carte', 'raccourci Maps');
  egal(sourceDe(new URL('https://www.google.fr/maps/place/X')), 'carte', 'Maps .fr');
  egal(sourceDe(new URL('https://www.instagram.com/reel/abc/')), 'instagram', 'Instagram');
  egal(
    oEmbedDe(new URL('https://www.tiktok.com/@a/video/1'))?.toString(),
    'https://www.tiktok.com/oembed?url=https%3A%2F%2Fwww.tiktok.com%2F%40a%2Fvideo%2F1',
    'oEmbed TikTok',
  );
  egal(oEmbedDe(new URL('https://exemple.fr/')), null, 'pas de vidéo');
});

Deno.test('passe la page de consentement de Google pour garder la carte', () => {
  const consentement = new URL(
    'https://consent.google.com/m?continue=https://www.google.com/maps/place/Time%2BOut%2BMarket/@38.7,-9.1,17z&gl=FR',
  );
  egal(carteDerriereLeConsentement(consentement)?.pathname.startsWith('/maps/place/'), true, 'carte');
  egal(
    carteDerriereLeConsentement(new URL('https://consent.google.com/m?continue=https://evil.example/')),
    null,
    'suite qui n’est pas une carte',
  );
});

Deno.test('lit le titre, la description et un lieu en JSON-LD', () => {
  const html = `<html><head>
    <title>Ignoré</title>
    <meta content="Cervejaria Ramiro &amp; ses fruits de mer" property="og:title">
    <meta name="description" content="La meilleure adresse de Lisbonne">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Restaurant",
      "name":"Cervejaria Ramiro","geo":{"latitude":38.7208,"longitude":-9.1357},
      "address":{"streetAddress":"Av. Almirante Reis 1","addressLocality":"Lisboa"}}</script>
  </head></html>`;
  const meta = metaDeLaPage(html);
  egal(meta.titre, 'Cervejaria Ramiro & ses fruits de mer', 'titre');
  egal(meta.description, 'La meilleure adresse de Lisbonne', 'description');
  egal(meta.lieu, { nom: 'Cervejaria Ramiro', lat: 38.7208, lng: -9.1357, adresse: 'Av. Almirante Reis 1, Lisboa' }, 'lieu');
});

Deno.test('retire liens et @mentions du texte donné au modèle', () => {
  egal(
    corpusDuLien(['Top 3 à #Lisbonne avec @marie.voyage', 'https://x.fr/a Pastéis de Belém']),
    'Top 3 à Lisbonne avec\nPastéis de Belém',
    'corpus',
  );
  egal(corpusDuLien(['Réservation : contact@ramiro.pt']), 'Réservation :', 'sans e-mail');
});

Deno.test('ne garde que les lieux vraiment cités, jamais ceux que le modèle ajoute', () => {
  const corpus = 'Nos 3 pépites : Time Out Market, la Pastelaria de Belém et le Miradouro da Graça. #lisbonne';
  const reponse = {
    lieux: [
      { nom: 'Time Out Market', ville: 'Lisbonne' },
      { nom: 'Pastelaria de Belem' }, // sans accent : reconnu quand même
      { nom: 'Tour de Belém' }, // pas dans le texte : écarté
      { nom: 'time out market' }, // doublon
      'Miradouro da Graça',
      { nom: '' },
    ],
  };
  egal(
    lieuxCites(reponse, corpus),
    [
      { nom: 'Time Out Market', ville: 'Lisbonne' },
      { nom: 'Pastelaria de Belem', ville: null },
      { nom: 'Miradouro da Graça', ville: null },
    ],
    'lieux cités',
  );
  egal(lieuxCites({ autre: [] }, corpus), null, 'réponse mal formée');
});
