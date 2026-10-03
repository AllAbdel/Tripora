import { DESTINATIONS } from '@tripora/core';
import type { Motif } from './moteur';

/** Les pays du catalogue, en espagnol : le navigateur connaît leur nom (Intl), il suffit du code. */
const PAYS_ES: Readonly<Record<string, string>> = (() => {
  const noms = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['es'], { type: 'region' }) : null;
  const sortie: Record<string, string> = {};
  if (!noms) return sortie;
  for (const destination of DESTINATIONS) {
    const code = destination.countryCode?.toUpperCase();
    if (!code || sortie[destination.country]) continue;
    try {
      const nom = noms.of(code);
      if (nom && nom !== code) sortie[destination.country] = nom;
    } catch {
      // Un code inconnu de cette version du navigateur : le nom français reste.
    }
  }
  return sortie;
})();

const PHRASES_FIXES: Readonly<Record<string, string>> = {
  'Brouillon': 'Borrador',
  'Tripora — organisez un voyage entre amis': 'Tripora — organizad un viaje entre amigos',
  'Navigation principale': 'Navegación principal',
  'Bonjour Inès': 'Hola Inès',
  'Chargement': 'Cargando',
  'Informations légales': 'Información legal',
  'Mentions légales': 'Aviso legal',
  'Confidentialité': 'Privacidad',
  'Conditions d’utilisation': 'Condiciones de uso',
  'Comment ça marche': 'Cómo funciona',
  'Destination choisie': 'Destino elegido',
  'Chercher une ville de départ': 'Buscar una ciudad de salida',
  'Étape précédente': 'Paso anterior',
  'Nouveau trip ·': 'Nuevo trip ·',
  'Étape': 'Paso',
  'sur': 'de',
  'Seul': 'Solo',
  'Un voyage rien qu’à moi': 'Un viaje solo para mí',
  'En couple': 'En pareja',
  'À deux': 'A dos',
  'Entre amis': 'Entre amigos',
  'Le groupe décidera ensemble': 'El grupo decidirá en conjunto',
  'En famille': 'En familia',
  'Avec des envies très différentes': 'Con ganas muy distintas',
  'Nombre de participants': 'Número de participantes',
  'Moins': 'Menos',
  'Plus': 'Más',
  'Continuer': 'Continuar',
  'D’où partez-vous ?': '¿Desde dónde salís?',
  'Le point de départ change beaucoup le prix.': 'El punto de salida cambia mucho el precio.',
  'Utiliser ma position': 'Usar mi ubicación',
  'Ville de départ': 'Ciudad de salida',
  'Choisissez une ville de départ pour continuer.': 'Elegid una ciudad de salida para continuar.',
  '(s’ouvre dans un nouvel onglet)': '(se abre en una pestaña nueva)',
  '(lien partenaire)': '(enlace de socio)',
  'lien partenaire': 'enlace de socio',
  'Mes trips': 'Mis trips',
  'Départ de': 'Salida desde',
  'Modifier': 'Modificar',
  'Construisez le séjour': 'Construid la estancia',
  'Ouvrir l’itinéraire': 'Abrir el itinerario',
  'Où on en est': 'Dónde estamos',
  'Avancement du groupe': 'Avance del grupo',
  'Itinéraire': 'Itinerario',
  'Jour par jour': 'Día a día',
  'Réservations': 'Reservas',
  'Hôtels, visites, trajets': 'Hoteles, visitas, trayectos',
  'Coffre': 'Cofre',
  'Codes, wifi, adresses': 'Códigos, wifi, direcciones',
  'Qui fait quoi': 'Quién hace qué',
  'Qui réserve quoi': 'Quién reserva qué',
  'Sondages': 'Encuestas',
  'Dates, logement, resto': 'Fechas, alojamiento, restaurante',
  'Journal photo': 'Diario de fotos',
  'Les photos du groupe': 'Las fotos del grupo',
  'Discussion': 'Conversación',
  'Liens et épingles': 'Enlaces y fijados',
  'Carte': 'Mapa',
  'Le trajet et les lieux': 'El trayecto y los lugares',
  'Dépenses': 'Gastos',
  'Qui doit quoi': 'Quién debe qué',
  'Ma valise': 'Mi maleta',
  'Selon le climat': 'Según el clima',
  'Récapitulatif': 'Resumen',
  'PDF et partage': 'PDF y compartir',
  'Trip ouvert': 'Trip abierto',
  'Ouvrir à des inconnus': 'Abrir a desconocidos',
  'Destination retenue': 'Destino retenido',
  'Le groupe part à': 'El grupo viaja a',
  '. L’itinéraire et la carte se construiront autour d’elle.': '. El itinerario y el mapa se construirán alrededor de ella.',
  'L’empreinte du trajet': 'La huella del trayecto',
  'Par personne, aller et retour, depuis': 'Por persona, ida y vuelta, desde',
  'Avion': 'Avión',
  'Électricité': 'Electricidad',
  'Pas besoin d’adaptateur.': 'No hace falta adaptador.',
  'Urgences': 'Urgencias',
  'Sur la route': 'En carretera',
  'On roule à gauche.': 'Se conduce por la izquierda.',
  'On roule à droite': 'Se conduce por la derecha',
  'Monnaie': 'Moneda',
  'Heure': 'Hora',
  'Réserver': 'Reservar',
  'Où dormir': 'Dónde dormir',
  'Comment y aller': 'Cómo llegar',
  'Train et bus': 'Tren y bus',
  'Que faire sur place': 'Qué hacer allí',
  'Sur place': 'En el lugar',
  'Internet sur place (eSIM)': 'Internet en destino (eSIM)',
  'Depuis l’aéroport': 'Desde el aeropuerto',
  'Louer une voiture': 'Alquilar un coche',
  'Louer un scooter ou un vélo': 'Alquilar una scooter o una bici',
  'Laisser ses bagages': 'Dejar el equipaje',
  'Liens partenaires.': 'Enlaces de socios.',
  'Carte hors ligne': 'Mapa sin conexión',
  'Télécharger la carte': 'Descargar el mapa',
  'Supprimer la carte': 'Eliminar el mapa',
  'Mettre à jour': 'Actualizar',
  'Découvrir': 'Descubrir',
  'À faire': 'Qué hacer',
  'par personne': 'por persona',
  'J’aime': 'Me gusta',
  'Mon préféré': 'Mi favorito',
  'Pas pour moi': 'No es para mí',
  'Voter': 'Votar',
  'Personne n’a encore voté': 'Nadie ha votado todavía',
  'Les villes en lice': 'Las ciudades candidatas',
  'Applications': 'Aplicaciones',
  'Prix en cours de relevé': 'Precios en curso de actualización',
  'Trancher': 'Decidir',
  'En attente des votes': 'A la espera de votos',
  'Et ensuite ?': '¿Y después?',
  'Revenir à mes voyages': 'Volver a mis viajes',
  'Montants estimés.': 'Importes estimados.',
  'Jour': 'Día',
  'Retour au voyage': 'Volver al viaje',
  'Construire l’itinéraire': 'Construir el itinerario',
  'Aucun lieu n’est inventé': 'Ningún lugar es inventado',
  'Générer l’itinéraire': 'Generar el itinerario',
};

export const PHRASES: Readonly<Record<string, string>> = { ...PAYS_ES, ...PHRASES_FIXES };

const MOIS: Readonly<Record<string, string>> = {
  janvier: 'enero', février: 'febrero', mars: 'marzo', avril: 'abril', mai: 'mayo', juin: 'junio',
  juillet: 'julio', août: 'agosto', septembre: 'septiembre', octobre: 'octubre', novembre: 'noviembre', décembre: 'diciembre',
};

const MOIS_COURTS: Readonly<Record<string, string>> = {
  janv: 'ene', févr: 'feb', mars: 'mar', avr: 'abr', mai: 'may', juin: 'jun',
  juil: 'jul', août: 'ago', sept: 'sept', oct: 'oct', nov: 'nov', déc: 'dic',
};

const nombre = (n: string, un: string, plusieurs: string) => (n === '1' ? un : plusieurs);

export const MOTIFS: readonly Motif[] = [
  [/^Étape (\d+) sur (\d+)$/u, 'Paso $1 de $2'],
  [/^Automatique \((.+)\)$/u, 'Automático ($1)'],
  [/^Actuellement : (.+)$/u, 'Actualmente: $1'],
  [/^Départ de (.+)$/u, 'Salida desde $1'],
  [/^Par personne, aller et retour, depuis (.+)\.$/u, 'Por persona, ida y vuelta, desde $1.'],
  [/^(\d+) jours? · au départ de (.+)$/u, (_, n, ville) => `${n} ${nombre(n!, 'día', 'días')} · salida desde ${ville}`],
  [/^(.+) · (\d+) jours?$/u, (_, ville, n) => `${ville} · ${n} ${nombre(n!, 'día', 'días')}`],
  [/^Préparé avec Tripora · (.+)$/u, 'Preparado con Tripora · $1'],
  [/^Pour (\p{Lu}[\p{L}’'-]*(?: \p{Lu}[\p{L}’'-]*)*)$/u, 'Para $1'],
  [/^Mon voyage à (.+)$/u, 'Mi viaje a $1'],
  [/^Départ demain pour (.+)$/u, 'Salida mañana hacia $1'],
  [/^Arrivée aujourd’hui : (.+)$/u, 'Llegada hoy: $1'],
  [/^Dans (\d+) h : (.+)$/u, 'En $1 h: $2'],
  [/^À (\d{1,2}[:h]\d{2})$/u, 'A las $1'],
  [/^Épingler (.+)$/u, 'Fijar $1'],
  [/^Supprimer (.+)$/u, 'Eliminar $1'],
  [/^(\d+) jours? en (\p{L}+)$/u, (_, n, m) => (MOIS[m!] ? `${n} ${nombre(n!, 'día', 'días')} en ${MOIS[m!]}` : null)],
  [/^(\d+) personnes? n’(?:a|ont) pas encore rejoint$/u, (_, n) => `${n} ${nombre(n!, 'persona no se ha unido', 'personas no se han unido')} todavía`],
  [/^Prises de type (.+) · (.+)$/u, 'Enchufes tipo $1 · $2'],
  [/^(\d+) idées? à glisser$/u, (_, n) => `${n} ${nombre(n!, 'idea', 'ideas')} para deslizar`],
  [/^(\d+) lieux? à voir$/u, (_, n) => `${n} ${nombre(n!, 'lugar', 'lugares')} para ver`],
  [/^Envies de (\d+) sur (\d+)\.$/u, 'Ganas de $1 de $2.'],
  [/^(.+ (?:km|mi)) aller-retour$/u, '$1 ida y vuelta'],
  [/^(km|mi) parcourus$/u, '$1 recorridos'],
  [/^(.+) à vol d’oiseau$/u, '$1 en línea recta'],
  [/^(\d{1,2}) (\p{L}+) (\d{4})$/u, (_, j, m, a) => (MOIS[m!] ? `${j} de ${MOIS[m!]} de ${a}` : null)],
  [/^(\d{1,2}) (\p{L}+)$/u, (_, j, m) => (MOIS[m!] ? `${j} de ${MOIS[m!]}` : null)],
  [/^(lun|mar|mer|jeu|ven|sam|dim)\. (\d{1,2}) (\p{L}+)\.?(?: (\d{4}))?$/u, (_, j, n, m, a) => {
    const jour = { lun: 'lun', mar: 'mar', mer: 'mié', jeu: 'jue', ven: 'vie', sam: 'sáb', dim: 'dom' }[j!];
    const mois = MOIS_COURTS[m!.replace(/\.$/u, '')];
    return jour && mois ? `${jour}, ${n} ${mois}${a ? ` ${a}` : ''}` : null;
  }],
  [/^Environ (.+) par jour, transport inclus\.$/u, 'Aproximadamente $1 por día, transporte incluido.'],
];
