import { describe, expect, it } from 'vitest';
import {
  decoderLesMotsEncodes,
  lireUnNombre,
  lireUneConfirmation,
} from './confirmation.js';

/**
 * Des e-mails comme on en reçoit : inventés, mais écrits comme les vrais —
 * mêmes libellés, même désordre, mêmes dates en toutes lettres.
 */

describe('les données structurées d’un e-mail', () => {
  const html = `<html><head>
<script type="application/ld+json">
{
  "@context": "http://schema.org",
  "@type": "LodgingReservation",
  "reservationNumber": "4521.873.219",
  "reservationStatus": "http://schema.org/Confirmed",
  "underName": { "@type": "Person", "name": "Abdel Test" },
  "reservationFor": {
    "@type": "LodgingBusiness",
    "name": "Ubud Tropical Villas",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Jalan Raya Sanggingan 12",
      "addressLocality": "Ubud",
      "postalCode": "80571",
      "addressCountry": "ID"
    },
    "geo": { "@type": "GeoCoordinates", "latitude": -8.4912, "longitude": 115.2489 }
  },
  "checkinTime": "2026-07-10T14:00:00+08:00",
  "checkoutTime": "2026-07-16T12:00:00+08:00",
  "totalPrice": "612.40",
  "priceCurrency": "EUR",
  "modifyReservationUrl": "https://secure.booking.com/myreservations.html?bn=4521873219",
  "provider": { "@type": "Organization", "name": "Booking.com" }
}
</script></head><body><p>Votre réservation est confirmée.</p></body></html>`;

  const lecture = lireUneConfirmation(html);

  it('les lit en priorité, et exactement', () => {
    expect(lecture.origine).toBe('donnees-structurees');
    expect(lecture.brouillon).toMatchObject({
      type: 'hebergement',
      fournisseur: 'booking',
      titre: 'Ubud Tropical Villas',
      debutLe: '2026-07-10',
      debutA: '14:00',
      finLe: '2026-07-16',
      finA: '12:00',
      reference: '4521.873.219',
      prixCents: 61240,
      devise: 'EUR',
      lien: 'https://secure.booking.com/myreservations.html?bn=4521873219',
      lat: -8.4912,
      lng: 115.2489,
    });
    expect(lecture.brouillon.adresse).toBe('Jalan Raya Sanggingan 12, 80571 Ubud, ID');
  });

  it('ne garde pas le nom de la personne', () => {
    expect(JSON.stringify(lecture.brouillon)).not.toContain('Abdel');
  });

  it('lit une visite, et un vol', () => {
    const visite = lireUneConfirmation(`<script type="application/ld+json">[{"@type":"EventReservation",
      "reservationNumber":"GYG7XK2P9QM","reservationFor":{"@type":"Event","name":"Lever de soleil au mont Batur",
      "startDate":"2026-07-12T02:00:00+08:00","location":{"@type":"Place","name":"Kintamani"}},
      "provider":{"name":"GetYourGuide"}}]</script>`);
    expect(visite.brouillon).toMatchObject({
      type: 'activite',
      fournisseur: 'getyourguide',
      titre: 'Lever de soleil au mont Batur',
      debutLe: '2026-07-12',
      debutA: '02:00',
      adresse: 'Kintamani',
      reference: 'GYG7XK2P9QM',
    });

    const vol = lireUneConfirmation(`<script type="application/ld+json">{"@type":"FlightReservation",
      "reservationNumber":"XK7PQ2","reservationFor":{"@type":"Flight","flightNumber":"372",
      "airline":{"@type":"Airline","iataCode":"QR"},"departureAirport":{"@type":"Airport","iataCode":"CDG","name":"Paris-Charles-de-Gaulle"},
      "arrivalAirport":{"@type":"Airport","iataCode":"DPS"},"departureTime":"2026-07-09T15:40:00+02:00","arrivalTime":"2026-07-10T16:45:00+08:00"}}</script>`);
    expect(vol.brouillon).toMatchObject({
      type: 'transport',
      titre: 'Vol QR372 CDG → DPS',
      debutLe: '2026-07-09',
      debutA: '15:40',
      finLe: '2026-07-10',
      finA: '16:45',
      reference: 'XK7PQ2',
    });
  });
});

describe('le texte d’un e-mail copié depuis la messagerie', () => {
  it('lit une confirmation Booking en français', () => {
    const texte = `Booking.com
Merci, votre réservation à Ubud Tropical Villas est confirmée.

Numéro de confirmation : 4521.873.219
Code PIN : 8841

Arrivée
jeu. 10 juil. 2026
à partir de 14:00

Départ
jeu. 16 juil. 2026
jusqu'à 12:00

Adresse : Jalan Raya Sanggingan 12, Ubud, 80571, Indonésie
Annulation gratuite jusqu'au 8 juillet 2026

Montant total
€ 612,40

Gérer votre réservation : https://secure.booking.com/myreservations.html?bn=4521873219
Se désinscrire : https://www.booking.com/unsubscribe.html`;
    const lecture = lireUneConfirmation(texte);
    expect(lecture.origine).toBe('texte');
    expect(lecture.brouillon).toMatchObject({
      type: 'hebergement',
      fournisseur: 'booking',
      titre: 'Ubud Tropical Villas',
      debutLe: '2026-07-10',
      debutA: '14:00',
      finLe: '2026-07-16',
      finA: '12:00',
      reference: '4521.873.219',
      prixCents: 61240,
      devise: 'EUR',
      adresse: 'Jalan Raya Sanggingan 12, Ubud, 80571, Indonésie',
      lien: 'https://secure.booking.com/myreservations.html?bn=4521873219',
    });
  });

  it('lit une confirmation Airbnb, dates sur une seule ligne', () => {
    const texte = `Réservation confirmée - Villa Sawah avec piscine
Vous partez à Ubud !
Du 10 juillet 2026 au 16 juillet 2026
Arrivée : 15:00
Départ : 11:00
Code de confirmation HMXQ4PZ8KT
Total (EUR) 1 284,00 €
Consulter l'itinéraire : https://www.airbnb.fr/trips/v1/HMXQ4PZ8KT
Airbnb, Inc.`;
    const lecture = lireUneConfirmation(texte);
    expect(lecture.brouillon).toMatchObject({
      type: 'hebergement',
      fournisseur: 'airbnb',
      titre: 'Villa Sawah avec piscine',
      debutLe: '2026-07-10',
      debutA: '15:00',
      finLe: '2026-07-16',
      finA: '11:00',
      reference: 'HMXQ4PZ8KT',
      prixCents: 128400,
      lien: 'https://www.airbnb.fr/trips/v1/HMXQ4PZ8KT',
    });
  });

  it('lit une activité GetYourGuide en anglais, heure à l’américaine', () => {
    const texte = `Your booking is confirmed: Mount Batur Sunrise Trekking with Breakfast
Booking reference: GYGW9Q7ZK2MX
Date: Sunday, July 12, 2026 at 2:00 AM
Meeting point: Pick-up from your hotel in Ubud
Participants: 4 Adults
Total price: EUR 180.00
Show your voucher: https://www.getyourguide.com/customer/booking/GYGW9Q7ZK2MX/voucher
Booked on March 3, 2026`;
    const lecture = lireUneConfirmation(texte);
    expect(lecture.brouillon).toMatchObject({
      type: 'activite',
      fournisseur: 'getyourguide',
      titre: 'Mount Batur Sunrise Trekking with Breakfast',
      debutLe: '2026-07-12',
      debutA: '02:00',
      reference: 'GYGW9Q7ZK2MX',
      prixCents: 18000,
      devise: 'EUR',
      adresse: 'Pick-up from your hotel in Ubud',
    });
    // La date de réservation n'est pas celle du voyage.
    expect(lecture.brouillon.finLe).toBeUndefined();
  });

  it('laisse vide ce qu’il ne trouve pas, plutôt que de le deviner', () => {
    const lecture = lireUneConfirmation('Salut, on se voit demain pour en parler ?');
    expect(lecture.origine).toBeNull();
    expect(lecture.trouves).toEqual([]);
  });

  it('ne retient jamais un lien qui n’est pas en https', () => {
    const lecture = lireUneConfirmation(
      'Booking reference: ABC12345\nhttp://example.test/booking/ABC12345\njavascript:alert(1)',
    );
    expect(lecture.brouillon.lien).toBeUndefined();
  });
});

describe('un fichier .eml tel qu’on le télécharge', () => {
  const html = `<html><script type=3D"application/ld+json">{"@type":"LodgingReservation","reservationNumber":"72819=
345612","reservationFor":{"@type":"Hotel","name":"H=C3=B4tel Lisboa Chiado"},"checkinDate":"2026-10-02","checkoutDate":"2026-10-05"}</script>
<body><p>R=C3=A9servation confirm=C3=A9e</p></body></html>`;
  const eml = [
    'From: Expedia <expedia@eg.expedia.fr>',
    'Subject: =?UTF-8?Q?Votre_r=C3=A9servation_=C3=A0_l=27H=C3=B4tel_Lisboa_Chiado?=',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="SEP"',
    '',
    '--SEP',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    'TnVtw6lybyBkJ2l0aW7DqXJhaXJlIDogNzI4MTkzNDU2MTI=',
    '--SEP',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    html,
    '--SEP--',
  ].join('\r\n');

  it('déplie l’encodage et lit les données cachées', () => {
    const lecture = lireUneConfirmation(eml);
    expect(lecture.origine).toBe('donnees-structurees');
    expect(lecture.brouillon).toMatchObject({
      type: 'hebergement',
      fournisseur: 'expedia',
      titre: 'Hôtel Lisboa Chiado',
      debutLe: '2026-10-02',
      finLe: '2026-10-05',
      reference: '72819345612',
    });
  });

  it('décode un sujet encodé', () => {
    expect(decoderLesMotsEncodes('=?UTF-8?Q?Votre_r=C3=A9servation?= =?UTF-8?B?w6AgVWJ1ZA==?=')).toBe(
      'Votre réservationà Ubud',
    );
  });
});

describe('un fichier de calendrier', () => {
  it('lit la date, l’heure et le lieu', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Cours de cuisine balinaise',
      'DTSTART;TZID=Asia/Makassar:20260713T090000',
      'DTEND;TZID=Asia/Makassar:20260713T130000',
      'LOCATION:Paon Bali Cooking Class\\, Laplapan\\, Ubud',
      'DESCRIPTION:Booking reference: KLK99381724',
      'URL:https://www.klook.com/fr/order/99381724',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const lecture = lireUneConfirmation(ics);
    expect(lecture.origine).toBe('calendrier');
    expect(lecture.brouillon).toMatchObject({
      titre: 'Cours de cuisine balinaise',
      debutLe: '2026-07-13',
      debutA: '09:00',
      finLe: '2026-07-13',
      finA: '13:00',
      adresse: 'Paon Bali Cooking Class, Laplapan, Ubud',
      reference: 'KLK99381724',
      fournisseur: 'klook',
    });
  });
});

describe('les montants', () => {
  it('devinent le séparateur décimal', () => {
    expect(lireUnNombre('1 234,56')).toBe(1234.56);
    expect(lireUnNombre('1,234.56')).toBe(1234.56);
    expect(lireUnNombre('1.500.000')).toBe(1_500_000);
    expect(lireUnNombre('612,40')).toBe(612.4);
    expect(lireUnNombre('180')).toBe(180);
  });
});
