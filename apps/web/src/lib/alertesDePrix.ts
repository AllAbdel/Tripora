import { queryOptions } from '@tanstack/react-query';
import { MONTHS_FR, formatCents, type Destination, type LieuNomme, type TripConstraints } from '@tripora/core';
import { toFailure } from './errors';
import { moisCible } from './flightPrices';
import { estNatif } from './natif';
import { supabase } from './supabase';

/**
 * Les alertes de prix : suivre un vol, être prévenu quand il baisse.
 *
 * On suit un trajet — l'aéroport de départ du voyage, une destination, un
 * mois. Chaque matin, la fonction `surveiller-les-prix` relève le prix dans le
 * même cache Aviasales que les propositions ; s'il a baissé d'au moins 10 % et
 * d'au moins 15 €, elle écrit une alerte et réveille les navigateurs abonnés.
 *
 * Le client ne fait que trois choses : dire quoi suivre, lire ce que le
 * serveur a relevé, et abonner ce navigateur aux notifications. Il n'écrit
 * jamais un prix (la base le refuse, voir la migration des alertes de prix).
 *
 * Sans serveur, rien : un relevé quotidien suppose quelqu'un pour le faire.
 */

export const alertesPossibles: boolean = supabase !== null;

export interface SuiviDePrix {
  id: string;
  tripId: string | null;
  origine: string;
  destinationId: string;
  destinationNom: string;
  /** AAAA-MM. */
  mois: string;
  premierCents: number | null;
  dernierCents: number | null;
  plusBasCents: number | null;
  releveLe: string | null;
}

export interface AlerteDePrix {
  id: string;
  ancienCents: number;
  nouveauCents: number;
  creeLe: string;
  vueLe: string | null;
  destinationNom: string;
  mois: string;
  origine: string;
  tripId: string | null;
}

/** Ce qu'il faut pour suivre un vol : un aéroport de chaque côté, un mois. */
export interface TrajetASuivre {
  tripId: string | null;
  origine: string;
  destinationId: string;
  destinationNom: string;
  destinationIata: string[];
  mois: string;
}

const IATA = /^[A-Z]{3}$/u;

/**
 * Le trajet qu'on suivrait depuis ce voyage, ou `null` s'il n'y a rien de
 * suivable : pas d'aéroport au départ ou à l'arrivée, ou un voyage sans mois
 * (« n'importe quand » n'a pas de prix stable à surveiller).
 *
 * Même aéroport de départ et même mois que les propositions : le relevé du
 * matin retombe ainsi sur le cache déjà rempli par l'écran du voyage.
 */
export function trajetDuVoyage(
  tripId: string | null,
  constraints: TripConstraints,
  destination: Pick<Destination, 'id' | 'name' | 'iata'>,
  maintenant = new Date(),
): TrajetASuivre | null {
  const origine = premierCode(constraints.origin);
  const destinationIata = destination.iata.filter((code) => IATA.test(code)).slice(0, 6);
  const mois = moisCible(constraints, maintenant);
  if (!origine || destinationIata.length === 0 || !mois) return null;
  // Un mois passé ne s'achète plus : le serveur ne le relèverait jamais.
  if (mois < maintenant.toISOString().slice(0, 7)) return null;
  return {
    tripId,
    origine,
    destinationId: destination.id,
    destinationNom: destination.name.slice(0, 80),
    destinationIata,
    mois,
  };
}

function premierCode(lieu: LieuNomme): string | null {
  return lieu.iata?.find((code) => IATA.test(code)) ?? null;
}

/** « novembre 2026 ». */
export function libelleDuMois(mois: string): string {
  const [annee, numero] = mois.split('-').map(Number);
  const nom = numero ? MONTHS_FR[numero - 1] : undefined;
  return nom && annee ? `${nom} ${annee}` : mois;
}

export function memeTrajet(suivi: SuiviDePrix, trajet: TrajetASuivre): boolean {
  return (
    suivi.origine === trajet.origine &&
    suivi.destinationId === trajet.destinationId &&
    suivi.mois === trajet.mois
  );
}

/**
 * Où en est le prix, en une phrase.
 *
 * Rien n'est dit tant qu'il n'y a pas eu de relevé : le premier prix sert de
 * référence, et une comparaison avec lui-même n'apprendrait rien.
 */
export function ouEnEstLePrix(suivi: SuiviDePrix): string {
  if (suivi.dernierCents === null) return 'Premier relevé en cours : le prix s’affichera ici.';
  const dernier = euros(suivi.dernierCents);
  const premier = suivi.premierCents;
  if (premier === null || premier === suivi.dernierCents) {
    return `${dernier} aller-retour au dernier relevé.`;
  }
  const ecart = premier - suivi.dernierCents;
  return ecart > 0
    ? `${dernier} aller-retour, ${euros(ecart)} de moins qu’au début du suivi.`
    : `${dernier} aller-retour, ${euros(-ecart)} de plus qu’au début du suivi.`;
}

export function euros(cents: number): string {
  return formatCents(cents, 'EUR', { hideCentimes: true });
}

/* ------------------------------------------------------ Lecture des lignes -- */

interface LigneDeSuivi {
  id: string;
  trip_id: string | null;
  origin_iata: string;
  destination_id: string;
  destination_name: string;
  month: string;
  first_cents: number | null;
  last_cents: number | null;
  lowest_cents: number | null;
  checked_at: string | null;
}

export function suiviDepuisLaBase(ligne: LigneDeSuivi): SuiviDePrix {
  return {
    id: ligne.id,
    tripId: ligne.trip_id,
    origine: ligne.origin_iata,
    destinationId: ligne.destination_id,
    destinationNom: ligne.destination_name,
    mois: ligne.month,
    premierCents: ligne.first_cents,
    dernierCents: ligne.last_cents,
    plusBasCents: ligne.lowest_cents,
    releveLe: ligne.checked_at,
  };
}

interface LigneDAlerte {
  id: string;
  old_cents: number;
  new_cents: number;
  created_at: string;
  seen_at: string | null;
  price_watches: Pick<LigneDeSuivi, 'destination_name' | 'month' | 'origin_iata' | 'trip_id'> | null;
}

export function alerteDepuisLaBase(ligne: LigneDAlerte): AlerteDePrix | null {
  // Le suivi a été arrêté entre-temps : l'alerte part avec lui (cascade),
  // mais une lecture peut tomber entre les deux.
  if (!ligne.price_watches) return null;
  return {
    id: ligne.id,
    ancienCents: ligne.old_cents,
    nouveauCents: ligne.new_cents,
    creeLe: ligne.created_at,
    vueLe: ligne.seen_at,
    destinationNom: ligne.price_watches.destination_name,
    mois: ligne.price_watches.month,
    origine: ligne.price_watches.origin_iata,
    tripId: ligne.price_watches.trip_id,
  };
}

/* ----------------------------------------------------------------- Serveur -- */

export class TropDeSuivis extends Error {
  constructor() {
    super('Vingt prix suivis au plus. Arrêtez-en un pour en suivre un autre.');
    this.name = 'TropDeSuivis';
  }
}

/** Ce qu'on affiche après un échec : nos refus disent eux-mêmes quoi faire. */
export function messageDesAlertes(erreur: unknown): string {
  if (erreur instanceof TropDeSuivis || erreur instanceof ServeurPasPret) return erreur.message;
  return toFailure(erreur).message;
}

export class ServeurPasPret extends Error {
  constructor() {
    super('Les notifications ne sont pas encore prêtes côté serveur. Réessayez demain.');
    this.name = 'ServeurPasPret';
  }
}

function client() {
  if (!supabase) throw new Error('Les alertes de prix demandent un serveur.');
  return supabase;
}

export async function listerMesSuivis(): Promise<SuiviDePrix[]> {
  const { data, error } = await client()
    .from('price_watches')
    .select('id, trip_id, origin_iata, destination_id, destination_name, month, first_cents, last_cents, lowest_cents, checked_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as LigneDeSuivi[]).map(suiviDepuisLaBase);
}

export async function suivreLePrix(trajet: TrajetASuivre, moi: string): Promise<void> {
  const { error } = await client().from('price_watches').insert({
    user_id: moi,
    trip_id: trajet.tripId,
    origin_iata: trajet.origine,
    destination_id: trajet.destinationId,
    destination_name: trajet.destinationNom,
    destination_iata: trajet.destinationIata,
    month: trajet.mois,
  });
  if (error) {
    if (error.code === 'P0020') throw new TropDeSuivis();
    // Déjà suivi (depuis un autre voyage, un autre appareil) : c'est fait.
    if (error.code === '23505') return;
    throw error;
  }
  // Le premier prix tout de suite plutôt que demain matin. La fonction ne
  // relève que ce qui ne l'a pas été depuis vingt heures : l'appeler ici ne
  // refait rien pour personne d'autre. Un échec n'empêche rien, le relevé du
  // matin s'en chargera.
  await client()
    .functions.invoke('surveiller-les-prix', { body: {} })
    .catch(() => undefined);
}

export async function arreterDeSuivre(id: string): Promise<void> {
  const { error } = await client().from('price_watches').delete().eq('id', id);
  if (error) throw error;
}

export async function listerMesAlertes(): Promise<AlerteDePrix[]> {
  const { data, error } = await client()
    .from('price_alerts')
    .select('id, old_cents, new_cents, created_at, seen_at, price_watches(destination_name, month, origin_iata, trip_id)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as unknown as LigneDAlerte[])
    .map(alerteDepuisLaBase)
    .filter((alerte): alerte is AlerteDePrix => alerte !== null);
}

export async function marquerCommeVues(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client()
    .from('price_alerts')
    .update({ seen_at: new Date().toISOString() })
    .in('id', [...ids])
    .is('seen_at', null);
  if (error) throw error;
}

export const CLE_DES_SUIVIS = ['suivis-de-prix'] as const;
export const CLE_DES_ALERTES = ['alertes-de-prix'] as const;

export function requeteDesSuivis(actif = true) {
  return queryOptions({
    queryKey: CLE_DES_SUIVIS,
    queryFn: listerMesSuivis,
    enabled: alertesPossibles && actif,
    staleTime: 5 * 60 * 1000,
  });
}

export function requeteDesAlertes(actif = true) {
  return queryOptions({
    queryKey: CLE_DES_ALERTES,
    queryFn: listerMesAlertes,
    enabled: alertesPossibles && actif,
    staleTime: 5 * 60 * 1000,
  });
}

/* ------------------------------------------------------------ Notifications -- */

/**
 * Où en sont les notifications sur cet appareil.
 *
 * - `impossibles` : l'application mobile (sa vue web ne reçoit pas les
 *   notifications du web), ou un navigateur qui ne les connaît pas — Safari
 *   sur iPhone ne les accepte que depuis Tripora installé sur l'écran
 *   d'accueil.
 * - `refusees` : la personne, ou le navigateur, a dit non. Seuls les réglages
 *   du site peuvent revenir dessus.
 */
export type EtatDesNotifications = 'impossibles' | 'refusees' | 'actives' | 'a-demander';

export function notificationsPossibles(): boolean {
  return (
    alertesPossibles &&
    !estNatif &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function etatDesNotifications(): Promise<EtatDesNotifications> {
  if (!notificationsPossibles()) return 'impossibles';
  if (Notification.permission === 'denied') return 'refusees';
  if (Notification.permission !== 'granted') return 'a-demander';
  const inscription = await navigator.serviceWorker.getRegistration();
  const abonnement = await inscription?.pushManager.getSubscription();
  return abonnement ? 'actives' : 'a-demander';
}

/** La clé publique VAPID, du texte base64url vers les octets qu'attend le navigateur. */
export function depuisBase64url(texte: string): Uint8Array<ArrayBuffer> {
  const b64 = texte.replace(/-/gu, '+').replace(/_/gu, '/');
  const binaire = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binaire, (caractere) => caractere.charCodeAt(0));
}

/**
 * Abonne ce navigateur. Vrai si c'est fait.
 *
 * La permission n'est demandée qu'ici, au geste de la personne : un
 * navigateur refuse (et retient le refus) quand on la demande sans raison à
 * l'ouverture d'une page.
 */
export async function activerLesNotifications(): Promise<EtatDesNotifications> {
  if (!notificationsPossibles()) return 'impossibles';
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'refusees';
  if (permission !== 'granted') return 'a-demander';

  const { data: cle, error } = await client().rpc('cle_publique_push');
  if (error || typeof cle !== 'string' || cle.length === 0) throw new ServeurPasPret();

  const inscription = await navigator.serviceWorker.ready;
  const existant = await inscription.pushManager.getSubscription();
  const abonnement =
    existant ??
    (await inscription.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: depuisBase64url(cle),
    }));

  const { endpoint, keys } = abonnement.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('Abonnement incomplet.');
  const { error: ecriture } = await client().rpc('enregistrer_abonnement_push', {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
  });
  if (ecriture) throw ecriture;
  return 'actives';
}

export async function couperLesNotifications(): Promise<void> {
  if (!notificationsPossibles()) return;
  const inscription = await navigator.serviceWorker.getRegistration();
  const abonnement = await inscription?.pushManager.getSubscription();
  if (!abonnement) return;
  // D'abord la base : un abonnement oublié côté navigateur mais gardé côté
  // serveur finirait supprimé au premier envoi (410), pas l'inverse.
  await client().from('push_subscriptions').delete().eq('endpoint', abonnement.endpoint);
  await abonnement.unsubscribe();
}
