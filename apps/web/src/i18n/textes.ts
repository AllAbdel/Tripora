import type { Langue } from './langues';

/**
 * Les textes de l'application.
 *
 * Le français est la référence : il définit les clés, et les autres langues
 * sont des dictionnaires partiels. Une clé absente affiche le français, ce que
 * `traduire` fait sans bruit.
 *
 * Ce qui est traduit ici est **ce qu'on lit en premier et le plus souvent** :
 * la navigation, les actions, les écrans d'entrée, les états vides, les
 * conditions d'un trip ouvert. Le reste de l'application — les écrans profonds,
 * les phrases d'explication longues — reste en français pour l'instant, et se
 * traduira clé par clé. C'est un choix assumé : mieux vaut cinquante phrases
 * justes dans quatorze langues qu'un millier passées à la machine.
 *
 * Deux règles d'écriture :
 *
 *  - **on dit « trip », pas « voyage ».** C'est le mot demandé, et il a
 *    l'avantage de se comprendre dans la plupart des langues d'ici ;
 *  - **pas de phrase construite par morceaux.** « Il reste %n places » se
 *    traduit ; « Il reste » + n + « places » ne se traduit pas, parce que
 *    l'ordre des mots change d'une langue à l'autre.
 */

export type CleDeTexte =
  // Navigation
  | 'nav.trips' | 'nav.carte' | 'nav.budget' | 'nav.profil'
  // Actions courantes
  | 'action.creer' | 'action.retour' | 'action.annuler' | 'action.enregistrer'
  | 'action.continuer' | 'action.chercher' | 'action.publier' | 'action.rejoindre'
  | 'action.nouveau'
  // Accueil
  | 'trips.titre' | 'trips.vide.titre' | 'trips.vide.texte'
  // Connexion
  | 'connexion.titre' | 'connexion.google' | 'connexion.code' | 'connexion.invite'
  // Le voyage
  | 'trip.participants' | 'trip.itineraire' | 'trip.afaire' | 'trip.discussion'
  | 'trip.carte' | 'trip.depenses' | 'trip.valise' | 'trip.recap' | 'trip.applications'
  | 'trip.ouvert'
  // Trips ouverts
  | 'ouvert.titre' | 'ouvert.mixte' | 'ouvert.femmes' | 'ouvert.hommes'
  | 'ouvert.presenter' | 'ouvert.places' | 'ouvert.personne'
  // Profil
  | 'profil.titre' | 'profil.apparence' | 'profil.langue' | 'profil.langue.systeme'
  | 'profil.deconnexion'
  // États
  | 'etat.chargement' | 'etat.horsreseau' | 'etat.erreur'
  // Mentions
  | 'mention.gratuit' | 'mention.parpersonne' | 'mention.indicatif';

export type Dictionnaire = Partial<Record<CleDeTexte, string>>;

/** La référence. Toutes les clés existent ici, par construction du type. */
export const FR: Record<CleDeTexte, string> = {
  'nav.trips': 'Trips',
  'nav.carte': 'Carte',
  'nav.budget': 'Budget',
  'nav.profil': 'Profil',

  'action.creer': 'Créer un trip',
  'action.retour': 'Retour',
  'action.annuler': 'Annuler',
  'action.enregistrer': 'Enregistrer',
  'action.continuer': 'Continuer',
  'action.chercher': 'Chercher',
  'action.publier': 'Publier',
  'action.rejoindre': 'Rejoindre',
  'action.nouveau': 'Nouveau',

  'trips.titre': 'Mes trips',
  'trips.vide.titre': 'Aucun trip pour l’instant',
  'trips.vide.texte': 'Créez-en un, invitez vos amis, et laissez Tripora trouver où aller.',

  'connexion.titre': 'Partez à plusieurs, décidez ensemble',
  'connexion.google': 'Continuer avec Google',
  'connexion.code': 'J’ai un code d’invitation',
  'connexion.invite': 'Continuer en invité',

  'trip.participants': 'Participants',
  'trip.itineraire': 'Itinéraire',
  'trip.afaire': 'À faire',
  'trip.discussion': 'Discussion',
  'trip.carte': 'Carte',
  'trip.depenses': 'Dépenses',
  'trip.valise': 'Ma valise',
  'trip.recap': 'Récapitulatif',
  'trip.applications': 'Applications',
  'trip.ouvert': 'Trip ouvert',

  'ouvert.titre': 'Partir avec d’autres',
  'ouvert.mixte': 'Groupe mixte',
  'ouvert.femmes': 'Réservé aux femmes',
  'ouvert.hommes': 'Réservé aux hommes',
  'ouvert.presenter': 'Me présenter',
  'ouvert.places': 'Places libres',
  'ouvert.personne': 'Personne pour l’instant',

  'profil.titre': 'Profil',
  'profil.apparence': 'Apparence',
  'profil.langue': 'Langue',
  'profil.langue.systeme': 'Langue du système',
  'profil.deconnexion': 'Se déconnecter',

  'etat.chargement': 'Chargement',
  'etat.horsreseau': 'Hors réseau — vous voyez la dernière version connue.',
  'etat.erreur': 'Un problème est survenu.',

  'mention.gratuit': 'Gratuit',
  'mention.parpersonne': 'par personne',
  'mention.indicatif': 'Prix indicatif',
};

const EN: Dictionnaire = {
  'nav.trips': 'Trips', 'nav.carte': 'Map', 'nav.budget': 'Budget', 'nav.profil': 'Profile',
  'action.creer': 'Create a trip', 'action.retour': 'Back', 'action.annuler': 'Cancel',
  'action.enregistrer': 'Save', 'action.continuer': 'Continue', 'action.chercher': 'Search',
  'action.publier': 'Publish', 'action.rejoindre': 'Join', 'action.nouveau': 'New',
  'trips.titre': 'My trips', 'trips.vide.titre': 'No trips yet',
  'trips.vide.texte': 'Create one, invite your friends, and let Tripora find where to go.',
  'connexion.titre': 'Travel together, decide together',
  'connexion.google': 'Continue with Google', 'connexion.code': 'I have an invite code',
  'connexion.invite': 'Continue as guest',
  'trip.participants': 'People', 'trip.itineraire': 'Itinerary', 'trip.afaire': 'Things to do',
  'trip.discussion': 'Chat', 'trip.carte': 'Map', 'trip.depenses': 'Expenses',
  'trip.valise': 'My packing', 'trip.recap': 'Summary', 'trip.applications': 'Apps',
  'trip.ouvert': 'Open trip',
  'ouvert.titre': 'Travel with others', 'ouvert.mixte': 'Mixed group',
  'ouvert.femmes': 'Women only', 'ouvert.hommes': 'Men only',
  'ouvert.presenter': 'Introduce myself', 'ouvert.places': 'Spots left',
  'ouvert.personne': 'Nobody yet',
  'profil.titre': 'Profile', 'profil.apparence': 'Appearance', 'profil.langue': 'Language',
  'profil.langue.systeme': 'System language', 'profil.deconnexion': 'Sign out',
  'etat.chargement': 'Loading',
  'etat.horsreseau': 'Offline — you are seeing the last known version.',
  'etat.erreur': 'Something went wrong.',
  'mention.gratuit': 'Free', 'mention.parpersonne': 'per person',
  'mention.indicatif': 'Indicative price',
};

const ES: Dictionnaire = {
  'nav.trips': 'Viajes', 'nav.carte': 'Mapa', 'nav.budget': 'Presupuesto', 'nav.profil': 'Perfil',
  'action.creer': 'Crear un trip', 'action.retour': 'Volver', 'action.annuler': 'Cancelar',
  'action.enregistrer': 'Guardar', 'action.continuer': 'Continuar', 'action.chercher': 'Buscar',
  'action.publier': 'Publicar', 'action.rejoindre': 'Unirse', 'action.nouveau': 'Nuevo',
  'trips.titre': 'Mis trips', 'trips.vide.titre': 'Todavía no hay ningún trip',
  'trips.vide.texte': 'Crea uno, invita a tus amigos y deja que Tripora encuentre adónde ir.',
  'connexion.titre': 'Viajad juntos, decidid juntos',
  'connexion.google': 'Continuar con Google', 'connexion.code': 'Tengo un código de invitación',
  'connexion.invite': 'Continuar como invitado',
  'trip.participants': 'Participantes', 'trip.itineraire': 'Itinerario', 'trip.afaire': 'Qué hacer',
  'trip.discussion': 'Chat', 'trip.carte': 'Mapa', 'trip.depenses': 'Gastos',
  'trip.valise': 'Mi equipaje', 'trip.recap': 'Resumen', 'trip.applications': 'Apps',
  'trip.ouvert': 'Trip abierto',
  'ouvert.titre': 'Viajar con otros', 'ouvert.mixte': 'Grupo mixto',
  'ouvert.femmes': 'Solo mujeres', 'ouvert.hommes': 'Solo hombres',
  'ouvert.presenter': 'Presentarme', 'ouvert.places': 'Plazas libres',
  'ouvert.personne': 'Nadie por ahora',
  'profil.titre': 'Perfil', 'profil.apparence': 'Apariencia', 'profil.langue': 'Idioma',
  'profil.langue.systeme': 'Idioma del sistema', 'profil.deconnexion': 'Cerrar sesión',
  'etat.chargement': 'Cargando',
  'etat.horsreseau': 'Sin conexión: ves la última versión conocida.',
  'etat.erreur': 'Ha ocurrido un problema.',
  'mention.gratuit': 'Gratis', 'mention.parpersonne': 'por persona',
  'mention.indicatif': 'Precio orientativo',
};

const IT: Dictionnaire = {
  'nav.trips': 'Viaggi', 'nav.carte': 'Mappa', 'nav.budget': 'Budget', 'nav.profil': 'Profilo',
  'action.creer': 'Crea un trip', 'action.retour': 'Indietro', 'action.annuler': 'Annulla',
  'action.enregistrer': 'Salva', 'action.continuer': 'Continua', 'action.chercher': 'Cerca',
  'action.publier': 'Pubblica', 'action.rejoindre': 'Unisciti', 'action.nouveau': 'Nuovo',
  'trips.titre': 'I miei trip', 'trips.vide.titre': 'Nessun trip per ora',
  'trips.vide.texte': 'Creane uno, invita i tuoi amici e lascia che Tripora trovi dove andare.',
  'connexion.titre': 'Partite insieme, decidete insieme',
  'connexion.google': 'Continua con Google', 'connexion.code': 'Ho un codice di invito',
  'connexion.invite': 'Continua come ospite',
  'trip.participants': 'Partecipanti', 'trip.itineraire': 'Itinerario', 'trip.afaire': 'Cosa fare',
  'trip.discussion': 'Chat', 'trip.carte': 'Mappa', 'trip.depenses': 'Spese',
  'trip.valise': 'La mia valigia', 'trip.recap': 'Riepilogo', 'trip.applications': 'App',
  'trip.ouvert': 'Trip aperto',
  'ouvert.titre': 'Partire con altri', 'ouvert.mixte': 'Gruppo misto',
  'ouvert.femmes': 'Solo donne', 'ouvert.hommes': 'Solo uomini',
  'ouvert.presenter': 'Presentarmi', 'ouvert.places': 'Posti liberi',
  'ouvert.personne': 'Ancora nessuno',
  'profil.titre': 'Profilo', 'profil.apparence': 'Aspetto', 'profil.langue': 'Lingua',
  'profil.langue.systeme': 'Lingua di sistema', 'profil.deconnexion': 'Esci',
  'etat.chargement': 'Caricamento',
  'etat.horsreseau': 'Offline — stai vedendo l’ultima versione nota.',
  'etat.erreur': 'Si è verificato un problema.',
  'mention.gratuit': 'Gratis', 'mention.parpersonne': 'a persona',
  'mention.indicatif': 'Prezzo indicativo',
};

const DE: Dictionnaire = {
  'nav.trips': 'Trips', 'nav.carte': 'Karte', 'nav.budget': 'Budget', 'nav.profil': 'Profil',
  'action.creer': 'Trip erstellen', 'action.retour': 'Zurück', 'action.annuler': 'Abbrechen',
  'action.enregistrer': 'Speichern', 'action.continuer': 'Weiter', 'action.chercher': 'Suchen',
  'action.publier': 'Veröffentlichen', 'action.rejoindre': 'Beitreten', 'action.nouveau': 'Neu',
  'trips.titre': 'Meine Trips', 'trips.vide.titre': 'Noch keine Trips',
  'trips.vide.texte': 'Erstelle einen, lade deine Freunde ein und lass Tripora das Ziel finden.',
  'connexion.titre': 'Gemeinsam reisen, gemeinsam entscheiden',
  'connexion.google': 'Mit Google fortfahren', 'connexion.code': 'Ich habe einen Einladungscode',
  'connexion.invite': 'Als Gast fortfahren',
  'trip.participants': 'Teilnehmer', 'trip.itineraire': 'Route', 'trip.afaire': 'Zu erleben',
  'trip.discussion': 'Chat', 'trip.carte': 'Karte', 'trip.depenses': 'Ausgaben',
  'trip.valise': 'Mein Gepäck', 'trip.recap': 'Übersicht', 'trip.applications': 'Apps',
  'trip.ouvert': 'Offener Trip',
  'ouvert.titre': 'Mit anderen reisen', 'ouvert.mixte': 'Gemischte Gruppe',
  'ouvert.femmes': 'Nur Frauen', 'ouvert.hommes': 'Nur Männer',
  'ouvert.presenter': 'Mich vorstellen', 'ouvert.places': 'Freie Plätze',
  'ouvert.personne': 'Noch niemand',
  'profil.titre': 'Profil', 'profil.apparence': 'Darstellung', 'profil.langue': 'Sprache',
  'profil.langue.systeme': 'Systemsprache', 'profil.deconnexion': 'Abmelden',
  'etat.chargement': 'Wird geladen',
  'etat.horsreseau': 'Offline — du siehst den zuletzt bekannten Stand.',
  'etat.erreur': 'Etwas ist schiefgelaufen.',
  'mention.gratuit': 'Kostenlos', 'mention.parpersonne': 'pro Person',
  'mention.indicatif': 'Richtpreis',
};

const PT: Dictionnaire = {
  'nav.trips': 'Viagens', 'nav.carte': 'Mapa', 'nav.budget': 'Orçamento', 'nav.profil': 'Perfil',
  'action.creer': 'Criar um trip', 'action.retour': 'Voltar', 'action.annuler': 'Cancelar',
  'action.enregistrer': 'Guardar', 'action.continuer': 'Continuar', 'action.chercher': 'Procurar',
  'action.publier': 'Publicar', 'action.rejoindre': 'Juntar-se', 'action.nouveau': 'Novo',
  'trips.titre': 'Os meus trips', 'trips.vide.titre': 'Ainda não há trips',
  'trips.vide.texte': 'Cria um, convida os teus amigos e deixa o Tripora encontrar para onde ir.',
  'connexion.titre': 'Viajem juntos, decidam juntos',
  'connexion.google': 'Continuar com Google', 'connexion.code': 'Tenho um código de convite',
  'connexion.invite': 'Continuar como convidado',
  'trip.participants': 'Participantes', 'trip.itineraire': 'Itinerário', 'trip.afaire': 'O que fazer',
  'trip.discussion': 'Conversa', 'trip.carte': 'Mapa', 'trip.depenses': 'Despesas',
  'trip.valise': 'A minha mala', 'trip.recap': 'Resumo', 'trip.applications': 'Apps',
  'trip.ouvert': 'Trip aberto',
  'ouvert.titre': 'Partir com outros', 'ouvert.mixte': 'Grupo misto',
  'ouvert.femmes': 'Só mulheres', 'ouvert.hommes': 'Só homens',
  'ouvert.presenter': 'Apresentar-me', 'ouvert.places': 'Lugares livres',
  'ouvert.personne': 'Ninguém para já',
  'profil.titre': 'Perfil', 'profil.apparence': 'Aparência', 'profil.langue': 'Idioma',
  'profil.langue.systeme': 'Idioma do sistema', 'profil.deconnexion': 'Terminar sessão',
  'etat.chargement': 'A carregar',
  'etat.horsreseau': 'Sem rede — está a ver a última versão conhecida.',
  'etat.erreur': 'Ocorreu um problema.',
  'mention.gratuit': 'Grátis', 'mention.parpersonne': 'por pessoa',
  'mention.indicatif': 'Preço indicativo',
};

const NL: Dictionnaire = {
  'nav.trips': 'Trips', 'nav.carte': 'Kaart', 'nav.budget': 'Budget', 'nav.profil': 'Profiel',
  'action.creer': 'Trip aanmaken', 'action.retour': 'Terug', 'action.annuler': 'Annuleren',
  'action.enregistrer': 'Opslaan', 'action.continuer': 'Doorgaan', 'action.chercher': 'Zoeken',
  'action.publier': 'Publiceren', 'action.rejoindre': 'Deelnemen', 'action.nouveau': 'Nieuw',
  'trips.titre': 'Mijn trips', 'trips.vide.titre': 'Nog geen trips',
  'trips.vide.texte': 'Maak er een, nodig je vrienden uit en laat Tripora de bestemming vinden.',
  'connexion.titre': 'Samen op reis, samen beslissen',
  'connexion.google': 'Doorgaan met Google', 'connexion.code': 'Ik heb een uitnodigingscode',
  'connexion.invite': 'Doorgaan als gast',
  'trip.participants': 'Deelnemers', 'trip.itineraire': 'Route', 'trip.afaire': 'Te doen',
  'trip.discussion': 'Chat', 'trip.carte': 'Kaart', 'trip.depenses': 'Uitgaven',
  'trip.valise': 'Mijn koffer', 'trip.recap': 'Overzicht', 'trip.applications': 'Apps',
  'trip.ouvert': 'Open trip',
  'ouvert.titre': 'Met anderen op reis', 'ouvert.mixte': 'Gemengde groep',
  'ouvert.femmes': 'Alleen vrouwen', 'ouvert.hommes': 'Alleen mannen',
  'ouvert.presenter': 'Mezelf voorstellen', 'ouvert.places': 'Vrije plaatsen',
  'ouvert.personne': 'Nog niemand',
  'profil.titre': 'Profiel', 'profil.apparence': 'Weergave', 'profil.langue': 'Taal',
  'profil.langue.systeme': 'Systeemtaal', 'profil.deconnexion': 'Uitloggen',
  'etat.chargement': 'Laden',
  'etat.horsreseau': 'Offline — je ziet de laatst bekende versie.',
  'etat.erreur': 'Er is iets misgegaan.',
  'mention.gratuit': 'Gratis', 'mention.parpersonne': 'per persoon',
  'mention.indicatif': 'Richtprijs',
};

const PL: Dictionnaire = {
  'nav.trips': 'Wyjazdy', 'nav.carte': 'Mapa', 'nav.budget': 'Budżet', 'nav.profil': 'Profil',
  'action.creer': 'Utwórz trip', 'action.retour': 'Wstecz', 'action.annuler': 'Anuluj',
  'action.enregistrer': 'Zapisz', 'action.continuer': 'Dalej', 'action.chercher': 'Szukaj',
  'action.publier': 'Opublikuj', 'action.rejoindre': 'Dołącz', 'action.nouveau': 'Nowy',
  'trips.titre': 'Moje tripy', 'trips.vide.titre': 'Na razie brak tripów',
  'trips.vide.texte': 'Utwórz jeden, zaproś znajomych, a Tripora znajdzie cel podróży.',
  'connexion.titre': 'Podróżujcie razem, decydujcie razem',
  'connexion.google': 'Kontynuuj z Google', 'connexion.code': 'Mam kod zaproszenia',
  'connexion.invite': 'Kontynuuj jako gość',
  'trip.participants': 'Uczestnicy', 'trip.itineraire': 'Plan podróży', 'trip.afaire': 'Co robić',
  'trip.discussion': 'Czat', 'trip.carte': 'Mapa', 'trip.depenses': 'Wydatki',
  'trip.valise': 'Moja walizka', 'trip.recap': 'Podsumowanie', 'trip.applications': 'Aplikacje',
  'trip.ouvert': 'Otwarty trip',
  'ouvert.titre': 'Wyjazd z innymi', 'ouvert.mixte': 'Grupa mieszana',
  'ouvert.femmes': 'Tylko kobiety', 'ouvert.hommes': 'Tylko mężczyźni',
  'ouvert.presenter': 'Przedstaw się', 'ouvert.places': 'Wolne miejsca',
  'ouvert.personne': 'Na razie nikogo',
  'profil.titre': 'Profil', 'profil.apparence': 'Wygląd', 'profil.langue': 'Język',
  'profil.langue.systeme': 'Język systemu', 'profil.deconnexion': 'Wyloguj się',
  'etat.chargement': 'Wczytywanie',
  'etat.horsreseau': 'Brak sieci — widzisz ostatnią znaną wersję.',
  'etat.erreur': 'Coś poszło nie tak.',
  'mention.gratuit': 'Za darmo', 'mention.parpersonne': 'od osoby',
  'mention.indicatif': 'Cena orientacyjna',
};

const TR: Dictionnaire = {
  'nav.trips': 'Geziler', 'nav.carte': 'Harita', 'nav.budget': 'Bütçe', 'nav.profil': 'Profil',
  'action.creer': 'Trip oluştur', 'action.retour': 'Geri', 'action.annuler': 'Vazgeç',
  'action.enregistrer': 'Kaydet', 'action.continuer': 'Devam', 'action.chercher': 'Ara',
  'action.publier': 'Yayımla', 'action.rejoindre': 'Katıl', 'action.nouveau': 'Yeni',
  'trips.titre': 'Triplerim', 'trips.vide.titre': 'Henüz trip yok',
  'trips.vide.texte': 'Bir tane oluştur, arkadaşlarını davet et, nereye gideceğinizi Tripora bulsun.',
  'connexion.titre': 'Birlikte gidin, birlikte karar verin',
  'connexion.google': 'Google ile devam et', 'connexion.code': 'Davet kodum var',
  'connexion.invite': 'Misafir olarak devam et',
  'trip.participants': 'Katılımcılar', 'trip.itineraire': 'Güzergâh', 'trip.afaire': 'Yapılacaklar',
  'trip.discussion': 'Sohbet', 'trip.carte': 'Harita', 'trip.depenses': 'Harcamalar',
  'trip.valise': 'Valizim', 'trip.recap': 'Özet', 'trip.applications': 'Uygulamalar',
  'trip.ouvert': 'Açık trip',
  'ouvert.titre': 'Başkalarıyla gitmek', 'ouvert.mixte': 'Karma grup',
  'ouvert.femmes': 'Yalnızca kadınlar', 'ouvert.hommes': 'Yalnızca erkekler',
  'ouvert.presenter': 'Kendimi tanıtayım', 'ouvert.places': 'Boş yerler',
  'ouvert.personne': 'Şimdilik kimse yok',
  'profil.titre': 'Profil', 'profil.apparence': 'Görünüm', 'profil.langue': 'Dil',
  'profil.langue.systeme': 'Sistem dili', 'profil.deconnexion': 'Çıkış yap',
  'etat.chargement': 'Yükleniyor',
  'etat.horsreseau': 'Çevrimdışı — bilinen son sürümü görüyorsunuz.',
  'etat.erreur': 'Bir sorun oluştu.',
  'mention.gratuit': 'Ücretsiz', 'mention.parpersonne': 'kişi başı',
  'mention.indicatif': 'Yaklaşık fiyat',
};

const RU: Dictionnaire = {
  'nav.trips': 'Поездки', 'nav.carte': 'Карта', 'nav.budget': 'Бюджет', 'nav.profil': 'Профиль',
  'action.creer': 'Создать трип', 'action.retour': 'Назад', 'action.annuler': 'Отмена',
  'action.enregistrer': 'Сохранить', 'action.continuer': 'Далее', 'action.chercher': 'Поиск',
  'action.publier': 'Опубликовать', 'action.rejoindre': 'Присоединиться', 'action.nouveau': 'Новый',
  'trips.titre': 'Мои трипы', 'trips.vide.titre': 'Пока нет ни одного трипа',
  'trips.vide.texte': 'Создайте трип, позовите друзей — а Tripora подскажет, куда поехать.',
  'connexion.titre': 'Едем вместе, решаем вместе',
  'connexion.google': 'Продолжить с Google', 'connexion.code': 'У меня есть код приглашения',
  'connexion.invite': 'Продолжить как гость',
  'trip.participants': 'Участники', 'trip.itineraire': 'Маршрут', 'trip.afaire': 'Чем заняться',
  'trip.discussion': 'Чат', 'trip.carte': 'Карта', 'trip.depenses': 'Расходы',
  'trip.valise': 'Мой чемодан', 'trip.recap': 'Сводка', 'trip.applications': 'Приложения',
  'trip.ouvert': 'Открытый трип',
  'ouvert.titre': 'Поехать с другими', 'ouvert.mixte': 'Смешанная группа',
  'ouvert.femmes': 'Только для женщин', 'ouvert.hommes': 'Только для мужчин',
  'ouvert.presenter': 'Представиться', 'ouvert.places': 'Свободных мест',
  'ouvert.personne': 'Пока никого',
  'profil.titre': 'Профиль', 'profil.apparence': 'Оформление', 'profil.langue': 'Язык',
  'profil.langue.systeme': 'Язык системы', 'profil.deconnexion': 'Выйти',
  'etat.chargement': 'Загрузка',
  'etat.horsreseau': 'Нет сети — показана последняя известная версия.',
  'etat.erreur': 'Что-то пошло не так.',
  'mention.gratuit': 'Бесплатно', 'mention.parpersonne': 'с человека',
  'mention.indicatif': 'Ориентировочная цена',
};

const AR: Dictionnaire = {
  'nav.trips': 'الرحلات', 'nav.carte': 'الخريطة', 'nav.budget': 'الميزانية', 'nav.profil': 'الملف',
  'action.creer': 'إنشاء رحلة', 'action.retour': 'رجوع', 'action.annuler': 'إلغاء',
  'action.enregistrer': 'حفظ', 'action.continuer': 'متابعة', 'action.chercher': 'بحث',
  'action.publier': 'نشر', 'action.rejoindre': 'انضمام', 'action.nouveau': 'جديد',
  'trips.titre': 'رحلاتي', 'trips.vide.titre': 'لا توجد رحلات بعد',
  'trips.vide.texte': 'أنشئ رحلة، وادعُ أصدقاءك، ودع تريبورا تجد الوجهة.',
  'connexion.titre': 'سافروا معًا، وقرّروا معًا',
  'connexion.google': 'المتابعة عبر Google', 'connexion.code': 'لديّ رمز دعوة',
  'connexion.invite': 'المتابعة كضيف',
  'trip.participants': 'المشاركون', 'trip.itineraire': 'خط السير', 'trip.afaire': 'ما يمكن فعله',
  'trip.discussion': 'المحادثة', 'trip.carte': 'الخريطة', 'trip.depenses': 'المصاريف',
  'trip.valise': 'حقيبتي', 'trip.recap': 'الملخّص', 'trip.applications': 'التطبيقات',
  'trip.ouvert': 'رحلة مفتوحة',
  'ouvert.titre': 'السفر مع آخرين', 'ouvert.mixte': 'مجموعة مختلطة',
  'ouvert.femmes': 'للنساء فقط', 'ouvert.hommes': 'للرجال فقط',
  'ouvert.presenter': 'التعريف بنفسي', 'ouvert.places': 'الأماكن المتاحة',
  'ouvert.personne': 'لا أحد حتى الآن',
  'profil.titre': 'الملف الشخصي', 'profil.apparence': 'المظهر', 'profil.langue': 'اللغة',
  'profil.langue.systeme': 'لغة النظام', 'profil.deconnexion': 'تسجيل الخروج',
  'etat.chargement': 'جارٍ التحميل',
  'etat.horsreseau': 'دون اتصال — تظهر لك آخر نسخة معروفة.',
  'etat.erreur': 'حدث خطأ ما.',
  'mention.gratuit': 'مجاني', 'mention.parpersonne': 'للشخص',
  'mention.indicatif': 'سعر تقريبي',
};

const ZH: Dictionnaire = {
  'nav.trips': '行程', 'nav.carte': '地图', 'nav.budget': '预算', 'nav.profil': '我的',
  'action.creer': '创建行程', 'action.retour': '返回', 'action.annuler': '取消',
  'action.enregistrer': '保存', 'action.continuer': '继续', 'action.chercher': '搜索',
  'action.publier': '发布', 'action.rejoindre': '加入', 'action.nouveau': '新建',
  'trips.titre': '我的行程', 'trips.vide.titre': '还没有行程',
  'trips.vide.texte': '创建一个行程，邀请朋友，让 Tripora 帮你们找到目的地。',
  'connexion.titre': '一起出发，一起决定',
  'connexion.google': '使用 Google 继续', 'connexion.code': '我有邀请码',
  'connexion.invite': '以访客身份继续',
  'trip.participants': '同行者', 'trip.itineraire': '行程安排', 'trip.afaire': '可以做什么',
  'trip.discussion': '聊天', 'trip.carte': '地图', 'trip.depenses': '花费',
  'trip.valise': '我的行李', 'trip.recap': '总览', 'trip.applications': '应用',
  'trip.ouvert': '公开行程',
  'ouvert.titre': '和别人一起出发', 'ouvert.mixte': '混合团',
  'ouvert.femmes': '仅限女性', 'ouvert.hommes': '仅限男性',
  'ouvert.presenter': '自我介绍', 'ouvert.places': '剩余名额',
  'ouvert.personne': '暂时还没有人',
  'profil.titre': '我的', 'profil.apparence': '外观', 'profil.langue': '语言',
  'profil.langue.systeme': '系统语言', 'profil.deconnexion': '退出登录',
  'etat.chargement': '加载中',
  'etat.horsreseau': '离线 — 显示的是最后一次获取的内容。',
  'etat.erreur': '出了点问题。',
  'mention.gratuit': '免费', 'mention.parpersonne': '每人',
  'mention.indicatif': '参考价格',
};

const JA: Dictionnaire = {
  'nav.trips': 'トリップ', 'nav.carte': '地図', 'nav.budget': '予算', 'nav.profil': 'プロフィール',
  'action.creer': 'トリップを作る', 'action.retour': '戻る', 'action.annuler': 'キャンセル',
  'action.enregistrer': '保存', 'action.continuer': '次へ', 'action.chercher': '検索',
  'action.publier': '公開する', 'action.rejoindre': '参加する', 'action.nouveau': '新規',
  'trips.titre': 'マイトリップ', 'trips.vide.titre': 'まだトリップがありません',
  'trips.vide.texte': 'トリップを作って友だちを誘えば、行き先は Tripora が探します。',
  'connexion.titre': 'みんなで行って、みんなで決める',
  'connexion.google': 'Google で続ける', 'connexion.code': '招待コードがあります',
  'connexion.invite': 'ゲストとして続ける',
  'trip.participants': 'メンバー', 'trip.itineraire': '旅程', 'trip.afaire': 'できること',
  'trip.discussion': 'チャット', 'trip.carte': '地図', 'trip.depenses': '支出',
  'trip.valise': '持ち物', 'trip.recap': 'まとめ', 'trip.applications': 'アプリ',
  'trip.ouvert': '公開トリップ',
  'ouvert.titre': 'ほかの人と行く', 'ouvert.mixte': '男女混合',
  'ouvert.femmes': '女性のみ', 'ouvert.hommes': '男性のみ',
  'ouvert.presenter': '自己紹介する', 'ouvert.places': '残りの枠',
  'ouvert.personne': 'まだ誰もいません',
  'profil.titre': 'プロフィール', 'profil.apparence': '表示', 'profil.langue': '言語',
  'profil.langue.systeme': 'システムの言語', 'profil.deconnexion': 'ログアウト',
  'etat.chargement': '読み込み中',
  'etat.horsreseau': 'オフライン — 最後に取得した内容を表示しています。',
  'etat.erreur': '問題が発生しました。',
  'mention.gratuit': '無料', 'mention.parpersonne': '1人あたり',
  'mention.indicatif': '目安の価格',
};

const KO: Dictionnaire = {
  'nav.trips': '트립', 'nav.carte': '지도', 'nav.budget': '예산', 'nav.profil': '프로필',
  'action.creer': '트립 만들기', 'action.retour': '뒤로', 'action.annuler': '취소',
  'action.enregistrer': '저장', 'action.continuer': '계속', 'action.chercher': '검색',
  'action.publier': '공개하기', 'action.rejoindre': '참여하기', 'action.nouveau': '새로 만들기',
  'trips.titre': '내 트립', 'trips.vide.titre': '아직 트립이 없어요',
  'trips.vide.texte': '하나 만들고 친구를 초대하세요. 어디로 갈지는 Tripora가 찾아 줍니다.',
  'connexion.titre': '같이 떠나고, 같이 정하기',
  'connexion.google': 'Google로 계속하기', 'connexion.code': '초대 코드가 있어요',
  'connexion.invite': '게스트로 계속하기',
  'trip.participants': '참여자', 'trip.itineraire': '일정', 'trip.afaire': '할 거리',
  'trip.discussion': '대화', 'trip.carte': '지도', 'trip.depenses': '지출',
  'trip.valise': '내 짐', 'trip.recap': '요약', 'trip.applications': '앱',
  'trip.ouvert': '공개 트립',
  'ouvert.titre': '다른 사람과 떠나기', 'ouvert.mixte': '혼성 그룹',
  'ouvert.femmes': '여성 전용', 'ouvert.hommes': '남성 전용',
  'ouvert.presenter': '나를 소개하기', 'ouvert.places': '남은 자리',
  'ouvert.personne': '아직 아무도 없어요',
  'profil.titre': '프로필', 'profil.apparence': '화면', 'profil.langue': '언어',
  'profil.langue.systeme': '시스템 언어', 'profil.deconnexion': '로그아웃',
  'etat.chargement': '불러오는 중',
  'etat.horsreseau': '오프라인 — 마지막으로 받아온 내용을 보고 있어요.',
  'etat.erreur': '문제가 발생했어요.',
  'mention.gratuit': '무료', 'mention.parpersonne': '1인당',
  'mention.indicatif': '참고 가격',
};

export const DICTIONNAIRES: Record<Langue, Dictionnaire> = {
  fr: FR, en: EN, es: ES, it: IT, de: DE, pt: PT, nl: NL,
  pl: PL, tr: TR, ru: RU, ar: AR, zh: ZH, ja: JA, ko: KO,
};

/** Le texte d'une clé, avec repli sur le français. */
export function traduire(langue: Langue, cle: CleDeTexte): string {
  return DICTIONNAIRES[langue]?.[cle] ?? FR[cle];
}
