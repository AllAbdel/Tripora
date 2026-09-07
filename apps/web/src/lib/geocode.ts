import { makeDiscovered, rememberDestination, type Destination, type VilleGeocodee } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Chercher une ville, n'importe laquelle.
 *
 * Le catalogue curé sert à comparer des destinations entre elles ; il ne peut
 * pas répondre à « on part à Kyoto ». Le géocodage, lui, ne juge rien : il
 * transforme un nom en coordonnées, et c'est tout ce dont l'itinéraire, la
 * carte et les lieux ont besoin.
 *
 * Retenir une ville l'écrit côté serveur, pour que les autres membres du groupe
 * la résolvent aussi — sans quoi le voyage n'aurait de nom que sur l'appareil
 * qui l'a créé.
 *
 * Tout échec est silencieux, comme pour les prix et les lieux : la recherche
 * dans le catalogue continue de répondre, et une panne de fournisseur ne doit
 * jamais vider un écran.
 */

export async function chercherVilles(q: string): Promise<Destination[]> {
  // Sous trois lettres, la requête ne désigne rien et coûterait un appel par
  // frappe. Le serveur refuse aussi, mais autant ne pas l'appeler.
  if (!supabase || q.trim().length < 3) return [];

  try {
    const { data, error } = await supabase.functions.invoke('geocode', {
      body: { q: q.trim() },
    });
    if (error) return [];
    const villes = (data as { villes?: unknown })?.villes;
    if (!Array.isArray(villes)) return [];

    return villes.filter(estVille).map((ville) => {
      const destination = makeDiscovered(ville);
      // Enregistrée dès l'affichage : l'écran suivant la résout sans attendre
      // que le serveur ait confirmé quoi que ce soit.
      rememberDestination(destination);
      return destination;
    });
  } catch {
    return [];
  }
}

/** Un point précis, tel qu'il sera épinglé sur la carte du voyage. */
export interface AdresseTrouvee {
  label: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * Cherche un endroit à épingler — une rue, un restaurant, une calanque.
 *
 * Ce n'est pas la même recherche que celle des destinations : là on cherchait
 * une ville comparable aux autres, ici on cherche un point à poser sur la
 * carte. Rien n'est deviné : sans résultat, l'épingle se crée quand même, mais
 * sans coordonnées, et elle reste dans la liste plutôt que d'atterrir au
 * hasard sur la carte.
 */
export async function chercherAdresses(q: string): Promise<AdresseTrouvee[]> {
  if (!supabase || q.trim().length < 3) return [];
  try {
    const { data, error } = await supabase.functions.invoke('geocode', {
      body: { q: q.trim(), adresse: true },
    });
    if (error) return [];
    const adresses = (data as { adresses?: unknown })?.adresses;
    if (!Array.isArray(adresses)) return [];
    return adresses.filter(estAdresse);
  } catch {
    return [];
  }
}

function estAdresse(brut: unknown): brut is AdresseTrouvee {
  if (typeof brut !== 'object' || brut === null) return false;
  const a = brut as Record<string, unknown>;
  return (
    typeof a['label'] === 'string' &&
    typeof a['lat'] === 'number' &&
    typeof a['lng'] === 'number'
  );
}

/** Écrit la ville dans le catalogue partagé, pour tout le groupe. */
export async function retenirVille(destination: Destination): Promise<void> {
  if (!supabase || !destination.discovered) return;
  try {
    await supabase.functions.invoke('geocode', {
      body: {
        retain: {
          id: destination.id,
          name: destination.name,
          country: destination.country,
          countryCode: destination.countryCode,
          lat: destination.lat,
          lng: destination.lng,
        },
      },
    });
  } catch {
    // Sans écriture, la ville reste utilisable pour cette session : c'est le
    // partage avec le groupe qui manque, pas le voyage.
  }
}

function estVille(brut: unknown): brut is VilleGeocodee {
  if (typeof brut !== 'object' || brut === null) return false;
  const v = brut as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['name'] === 'string' &&
    typeof v['lat'] === 'number' &&
    typeof v['lng'] === 'number'
  );
}
