import type { MomentDeLaJournee, Poi, PoiCategory } from '../places.js';
import type { PreferenceAxis } from '../preferences.js';
import { fold } from '../text.js';

/**
 * Ce qu'on va vraiment faire sur place.
 *
 * Tripora savait dire « partez à Bali » et « mardi matin, culture, 18 € ». Il
 * ne savait pas dire **quoi**. Entre les deux manquait la seule chose qui
 * donne envie de partir : le nom de l'endroit.
 *
 * Le manque était censé être comblé par OpenStreetMap, interrogé au vol. Ça
 * n'a jamais marché : la fonction `places` échoue depuis le premier jour pour
 * toutes les destinations sauf Lisbonne, et personne ne l'a vu parce qu'un
 * échec y est silencieux par conception. Un itinéraire de dix jours à Bali
 * affichait donc « Musées et monuments, Temps libre, Découverte culinaire »,
 * dix fois — un squelette honnête, mais qui n'a rien à voir avec Bali.
 *
 * Et même réparé, OpenStreetMap n'aurait pas suffi. OSM décrit des objets, pas
 * des envies : il connaît le mont Batur comme `natural=volcano`, il ignore
 * qu'on s'y lève à deux heures du matin, que ça prend huit heures et que ça
 * coûte une quarantaine d'euros. Ce sont ces trois informations-là qui font la
 * différence entre une carte et un programme.
 *
 * D'où ce fichier, écrit à la main, sur le même principe assumé que le
 * catalogue de destinations :
 *
 * - **rien n'est inventé.** Chaque entrée est un lieu ou une sortie qui
 *   existe, que l'on peut aller vérifier. Le titre d'article Wikipédia sert à
 *   ça autant qu'à trouver la photo : il rend l'affirmation contrôlable.
 * - **les prix sont indicatifs et datés du moment où on les écrit.** Ils
 *   servent à construire un budget réaliste, pas à promettre un tarif. L'écran
 *   le dit.
 * - **les durées sont des durées réelles**, trajet compris quand il compte :
 *   le Batur est à 8 h, pas à 2 h de marche, parce qu'on part de Kuta.
 * - **aucun lien de réservation nominatif.** On renvoie vers une recherche,
 *   jamais vers un produit précis qu'on n'a pas vérifié.
 *
 * Ce fichier se corrige : c'est du texte, pas un modèle. Une correction
 * profite tout de suite à tous les voyages.
 */

export type { MomentDeLaJournee };

export interface Activite {
  id: string;
  destinationId: string;
  nom: string;
  /** L'envie que ça sert, pour rejoindre le créneau qui l'attend. */
  axis: PreferenceAxis;
  category: PoiCategory;
  lat: number;
  lng: number;
  /** Combien de temps ça prend en vrai, trajet compris quand il compte. */
  dureeHeures: number;
  /** Prix indicatif par personne, en centimes d'euro. 0 quand c'est gratuit. */
  prixCents: number;
  moment: MomentDeLaJournee;
  /** Une phrase : ce qu'on y fait, pas ce qu'on en pense. */
  resume: string;
  /** « fr:Titre » ou « en:Titre ». Sert à illustrer et à vérifier. */
  wikipedia?: string;
}

/** Les libellés affichables, par catégorie. Repris de la classification OSM. */
const LIBELLES: Record<PoiCategory, string> = {
  musee: 'Musée',
  monument: 'Monument',
  oeuvre: 'Œuvre',
  spectacle: 'Spectacle',
  parc: 'Parc',
  plage: 'Plage',
  panorama: 'Point de vue',
  nature: 'Nature',
  marche: 'Marché',
  boutique: 'Boutique',
  detente: 'Détente',
  sport: 'Sport',
};

export function libelleActivite(activite: Activite): string {
  return LIBELLES[activite.category];
}

/**
 * Une activité. Les arguments sont positionnels, comme dans le catalogue de
 * destinations : à raison de deux lignes par entrée, une liste de quatre cents
 * se relit, là où quatre cents objets nommés ne se relisent plus.
 *
 * Le prix s'écrit en euros parce que c'est ainsi qu'on le vérifie ; il est
 * rangé en centimes parce que c'est ainsi qu'on le calcule.
 */
function a(
  id: string,
  nom: string,
  axis: PreferenceAxis,
  category: PoiCategory,
  lat: number,
  lng: number,
  dureeHeures: number,
  prixEuros: number,
  moment: MomentDeLaJournee,
  resume: string,
  wikipedia?: string,
): Omit<Activite, 'destinationId'> {
  return {
    id,
    nom,
    axis,
    category,
    lat,
    lng,
    dureeHeures,
    prixCents: Math.round(prixEuros * 100),
    moment,
    resume,
    ...(wikipedia ? { wikipedia } : {}),
  };
}

/** Rattache un bloc d'activités à sa destination, et préfixe les identifiants. */
function ville(
  destinationId: string,
  entrees: readonly Omit<Activite, 'destinationId'>[],
): Activite[] {
  return entrees.map((entree) => ({
    ...entree,
    destinationId,
    id: `${destinationId}/${entree.id}`,
  }));
}

const CATALOGUE: Activite[] = [
  // ------------------------------------------------------------------ Indonésie
  ...ville('bali', [
    a('batur', 'Lever de soleil au sommet du mont Batur', 'adventure', 'panorama', -8.2422, 115.3753,
      8, 45, 'matin', 'Départ vers deux heures du matin, deux heures de montée dans le noir, et le soleil qui se lève sur la caldeira.', 'fr:Mont Batur'),
    a('tanah-lot', 'Le temple de Tanah Lot au coucher du soleil', 'culture', 'monument', -8.6212, 115.0868,
      3, 5, 'soir', 'Un temple posé sur un rocher que la marée isole, et la foule qui attend le même moment que vous.', 'fr:Tanah Lot'),
    a('tegallalang', 'Les rizières en terrasses de Tegallalang', 'nature', 'panorama', -8.4312, 115.2792,
      3, 2, 'matin', 'Des terrasses irriguées selon le subak, le système de partage de l’eau classé par l’Unesco.', 'fr:Tegallalang'),
    a('uluwatu-kecak', 'Le kecak au temple d’Uluwatu', 'culture', 'spectacle', -8.8291, 115.0849,
      3, 12, 'soir', 'Cent hommes assis en cercle qui scandent le Ramayana, sur une falaise, face au soleil couchant.', 'fr:Pura Luhur Uluwatu'),
    a('nusa-penida', 'Nusa Penida à la journée', 'nature', 'plage', -8.7278, 115.5444,
      11, 60, 'journee', 'Traversée en speedboat, puis Kelingking et Broken Beach : les falaises que tout le monde a vues en photo.', 'fr:Nusa Penida'),
    a('ubud-singe', 'La forêt des singes d’Ubud', 'nature', 'parc', -8.5190, 115.2585,
      2, 6, 'matin', 'Trois temples dans une forêt de figuiers, et sept cents macaques qui y vivent vraiment.', 'fr:Forêt sacrée des singes d’Ubud'),
    a('sekumpul', 'Les chutes de Sekumpul', 'adventure', 'nature', -8.1697, 115.1583,
      6, 20, 'journee', 'Une descente raide et une rivière à traverser pieds nus avant d’arriver au pied des sept cascades.', 'id:Sekumpul, Sawan, Buleleng'),
    a('jimbaran', 'Poisson grillé sur la plage de Jimbaran', 'food', 'plage', -8.7906, 115.1650,
      2, 18, 'soir', 'Des tables posées dans le sable, le poisson choisi sur la glace et grillé sur des coques de noix de coco.', 'fr:Jimbaran'),
    a('taman-ayun', 'Le temple de Taman Ayun', 'culture', 'monument', -8.5414, 115.1725,
      2, 3, 'apres-midi', 'Le temple royal de Mengwi, ses toits étagés et ses douves, nettement plus calme que ses voisins.', 'fr:Pura Taman Ayun'),
    a('surf-canggu', 'Première leçon de surf à Canggu', 'adventure', 'sport', -8.6478, 115.1385,
      3, 30, 'matin', 'Sable noir et vagues de mousse : le spot où l’on apprend avant d’aller voir ailleurs.', 'fr:Canggu'),
    a('seminyak-soir', 'Les beach clubs de Seminyak', 'nightlife', 'detente', -8.6900, 115.1600,
      4, 35, 'soir', 'Des transats face à l’ouest, un dj à partir de dix-sept heures, et le soleil qui tombe dans la mer.', 'id:Seminyak'),
    a('spa-ubud', 'Un spa balinais à Ubud', 'relax', 'detente', -8.5069, 115.2625,
      2, 25, 'apres-midi', 'Le massage balinais, les fleurs de frangipanier, et deux heures pour vingt-cinq euros.', 'en:Balinese massage'),
  ]),
  ...ville('yogyakarta', [
    a('borobudur', 'Borobudur au lever du jour', 'culture', 'monument', -7.6079, 110.2038,
      6, 40, 'matin', 'Le plus grand temple bouddhiste du monde, cinq cents bouddhas et la brume dans la plaine en dessous.', 'fr:Borobudur'),
    a('prambanan', 'Le complexe hindou de Prambanan', 'culture', 'monument', -7.7520, 110.4915,
      4, 25, 'apres-midi', 'Des tours de pierre de quarante-sept mètres couvertes de bas-reliefs du Ramayana.', 'fr:Prambanan'),
    a('kraton', 'Le kraton, palais du sultan', 'culture', 'monument', -7.8053, 110.3642,
      2, 3, 'matin', 'La cour du sultanat, toujours habitée, avec ses gardiens en costume et son gamelan du matin.', 'fr:Kraton de Yogyakarta'),
    a('merapi', 'Le mont Merapi en jeep', 'adventure', 'nature', -7.5407, 110.4457,
      4, 30, 'matin', 'Les coulées de 2010, un village enseveli, et le volcan le plus actif d’Indonésie au-dessus.', 'fr:Merapi'),
    a('malioboro', 'La rue Malioboro le soir', 'shopping', 'marche', -7.7925, 110.3658,
      3, 0, 'soir', 'Batik, warungs par terre et musiciens : la rue où la ville se retrouve à la nuit tombée.', 'id:Jalan Malioboro'),
    a('batik', 'Un atelier de batik', 'culture', 'boutique', -7.8014, 110.3644,
      3, 15, 'apres-midi', 'La cire, le tjanting, et un carré de tissu qu’on rapporte en sachant enfin ce que ça demande.', 'fr:Batik'),
  ]),
  ...ville('lombok', [
    a('rinjani', 'Le cratère du Rinjani', 'adventure', 'panorama', -8.4111, 116.4575,
      36, 180, 'journee', 'Deux jours de montée jusqu’au bord du cratère et son lac, avec nuit sous tente.', 'fr:Rinjani'),
    a('gili-trawangan', 'Les Gili en snorkeling', 'nature', 'plage', -8.3500, 116.0400,
      8, 35, 'journee', 'Trois îles sans voitures, et des tortues vertes qu’on croise à quelques mètres du bord.', 'fr:Îles Gili'),
    a('tiu-kelep', 'Les cascades de Sendang Gile et Tiu Kelep', 'nature', 'nature', -8.3106, 116.4058,
      4, 8, 'matin', 'Une marche courte dans la forêt, une rivière à remonter, et deux chutes coup sur coup.', 'id:Air Terjun Sendang Gile'),
    a('kuta-lombok', 'Les plages du sud, de Kuta à Tanjung Aan', 'relax', 'plage', -8.8900, 116.2800,
      6, 5, 'journee', 'Des baies en fer à cheval, du sable en grains de poivre, et presque personne.', 'id:Pantai Kuta, Lombok'),
    a('sasak', 'Le village sasak de Sade', 'culture', 'monument', -8.8567, 116.2828,
      2, 5, 'apres-midi', 'Des maisons de bambou au sol de bouse lissée, et le tissage sur métier de dos.', 'fr:Sasaks'),
  ]),
  // ------------------------------------------------------------------ Thaïlande
  ...ville('bangkok', [
    a('grand-palais', 'Le Grand Palais et le Bouddha d’Émeraude', 'culture', 'monument', 13.7500, 100.4913,
      3, 14, 'matin', 'Le palais royal, ses toits d’or, et la statue de jade de soixante-six centimètres qui fait la queue.', 'fr:Grand Palais (Bangkok)'),
    a('wat-pho', 'Le Bouddha couché du Wat Pho', 'culture', 'monument', 13.7465, 100.4927,
      2, 6, 'matin', 'Quarante-six mètres de long, plaqué or, et l’école de massage thaï la plus ancienne du pays.', 'fr:Wat Pho'),
    a('wat-arun', 'Le Wat Arun au coucher du soleil', 'culture', 'monument', 13.7437, 100.4889,
      2, 3, 'soir', 'Le temple de l’Aube, couvert de porcelaine chinoise cassée, vu depuis l’autre rive.', 'fr:Wat Arun'),
    a('chatuchak', 'Le marché de Chatuchak', 'shopping', 'marche', 13.7999, 100.5502,
      4, 0, 'matin', 'Quinze mille échoppes le week-end : on s’y perd, c’est le principe.', 'fr:Marché de Chatuchak'),
    a('klongs', 'Les klongs de Thonburi en longue-queue', 'offbeat', 'panorama', 13.7563, 100.4870,
      2, 25, 'apres-midi', 'Les canaux derrière la ville, les maisons sur pilotis, et la vie qui se passe au bord de l’eau.', 'fr:Thonburi'),
    a('chinatown', 'Manger dans Yaowarat, le soir', 'food', 'marche', 13.7400, 100.5100,
      3, 12, 'soir', 'La rue la plus dense de la ville : woks sur le trottoir, fruits de mer, et néons rouges.', 'fr:Yaowarat'),
    a('jim-thompson', 'La maison de Jim Thompson', 'culture', 'musee', 13.7492, 100.5281,
      2, 5, 'apres-midi', 'Six maisons en teck remontées par l’Américain qui a relancé la soie thaïe, puis disparu.', 'fr:Jim Thompson'),
    a('ayutthaya', 'Ayutthaya à la journée', 'culture', 'monument', 14.3532, 100.5689,
      9, 45, 'journee', 'L’ancienne capitale en ruines, ses stupas penchés et la tête de bouddha prise dans un figuier.', 'fr:Ayutthaya'),
  ]),
  ...ville('chiang-mai', [
    a('doi-suthep', 'Le Wat Phra That Doi Suthep', 'culture', 'monument', 18.8047, 98.9217,
      3, 5, 'matin', 'Trois cent six marches gardées par des nagas, et la ville tout entière en dessous.', 'fr:Wat Phra That Doi Suthep'),
    a('elephant-nature', 'Une journée au sanctuaire des éléphants', 'nature', 'nature', 19.2167, 98.8500,
      8, 75, 'journee', 'Un refuge sans promenade à dos : on les nourrit, on les observe, on ne monte pas.', 'en:Elephant Nature Park'),
    a('vieille-ville', 'Les temples de la vieille ville à pied', 'culture', 'monument', 18.7883, 98.9853,
      4, 3, 'matin', 'Chedi Luang, Phra Singh, Chiang Man : trois siècles de Lanna dans un carré d’un kilomètre.', 'fr:Chiang Mai'),
    a('cuisine', 'Un cours de cuisine thaïe', 'food', 'detente', 18.7870, 98.9930,
      6, 30, 'matin', 'Le marché d’abord pour les ingrédients, puis six plats qu’on refera vraiment.', 'fr:Cuisine thaïlandaise'),
    a('doi-inthanon', 'Le parc national de Doi Inthanon', 'nature', 'nature', 18.5886, 98.4867,
      9, 50, 'journee', 'Le toit de la Thaïlande, deux chedis royaux, et une forêt de nuages à 2 565 mètres.', 'fr:Doi Inthanon'),
    a('marche-nuit', 'Le marché de nuit du dimanche', 'shopping', 'marche', 18.7880, 98.9930,
      3, 0, 'soir', 'La rue Ratchadamnoen fermée aux voitures, et l’artisanat du nord sur un kilomètre.', 'fr:Chiang Mai'),
  ]),
  ...ville('phuket', [
    a('phang-nga', 'La baie de Phang Nga en longue-queue', 'nature', 'panorama', 8.2700, 98.5000,
      9, 55, 'journee', 'Des pitons calcaires sortis de l’eau, des grottes qu’on traverse en canoë, et James Bond au milieu.', 'fr:Baie de Phang Nga'),
    a('phi-phi', 'Les îles Phi Phi', 'nature', 'plage', 7.7407, 98.7784,
      10, 70, 'journee', 'Maya Bay rouverte et régulée, et la baie de Pileh dont l’eau est vraiment de cette couleur.', 'fr:Îles Phi Phi'),
    a('vieux-phuket', 'Le vieux Phuket sino-portugais', 'culture', 'monument', 7.8833, 98.3875,
      3, 0, 'matin', 'Les boutiques-maisons de Thalang Road, ocre et vert amande, héritées des marchands d’étain.', 'fr:Phuket (ville)'),
    a('big-buddha', 'Le Grand Bouddha de Phuket', 'culture', 'monument', 7.8278, 98.3125,
      2, 0, 'apres-midi', 'Quarante-cinq mètres de marbre blanc sur une colline, et l’île à trois cent soixante degrés.', 'en:Big Buddha, Phuket'),
    a('similan', 'Plongée aux îles Similan', 'adventure', 'sport', 8.6500, 97.6500,
      12, 130, 'journee', 'Neuf îles de granit, une eau à trente mètres de visibilité, ouvertes d’octobre à mai.', 'fr:Îles Similan'),
    a('kata-coucher', 'Le coucher du soleil au cap Promthep', 'relax', 'panorama', 7.7620, 98.3050,
      2, 0, 'soir', 'La pointe sud de l’île, un phare, et la mer d’Andaman qui s’éteint d’un coup.', 'en:Laem Phromthep'),
  ]),
  ...ville('krabi', [
    a('railay', 'La presqu’île de Railay', 'nature', 'plage', 8.0110, 98.8380,
      6, 12, 'journee', 'Accessible seulement en bateau : des falaises verticales qui tombent dans le sable blanc.', 'fr:Railay'),
    a('escalade', 'Escalade sur les falaises de Tonsai', 'adventure', 'sport', 8.0270, 98.8290,
      5, 45, 'matin', 'Du calcaire à trous, sept cents voies équipées, et l’un des meilleurs spots d’initiation au monde.', 'fr:Railay'),
    a('quatre-iles', 'Le tour des quatre îles', 'nature', 'plage', 8.0000, 98.8000,
      8, 35, 'journee', 'Poda, Chicken Island, Tup et Phranang, avec le banc de sable qui les relie à marée basse.', 'fr:Krabi'),
    a('tiger-cave', 'Les 1 237 marches du Tiger Cave Temple', 'adventure', 'panorama', 8.1258, 98.9247,
      3, 0, 'matin', 'Une montée raide et pénible jusqu’à un bouddha doré, et la plaine de Krabi jusqu’à la mer.', 'en:Wat Tham Suea'),
    a('sources-chaudes', 'Les sources chaudes et la piscine d’émeraude', 'relax', 'detente', 8.1197, 99.2683,
      5, 20, 'apres-midi', 'Des vasques naturelles à quarante degrés dans la forêt, puis un bassin turquoise pour redescendre.', 'en:Emerald Pool'),
  ]),
  ...ville('koh-samui', [
    a('ang-thong', 'Le parc marin d’Ang Thong', 'nature', 'panorama', 9.6167, 99.6667,
      10, 60, 'journee', 'Quarante-deux îles calcaires, un lagon dans un cratère, et du kayak entre les pitons.', 'fr:Parc national marin d’Ang Thong'),
    a('big-buddha-samui', 'Le Grand Bouddha de Bang Rak', 'culture', 'monument', 9.5680, 100.0620,
      1, 0, 'matin', 'Douze mètres d’or posés sur un îlot relié par une chaussée, visibles depuis l’avion.', 'en:Wat Phra Yai'),
    a('na-muang', 'Les cascades de Na Muang', 'nature', 'nature', 9.4640, 99.9800,
      3, 0, 'apres-midi', 'Deux chutes à l’intérieur de l’île, dont la seconde se mérite après vingt minutes de montée.', 'en:Na Muang Waterfall'),
    a('fisherman', 'Le village de pêcheurs de Bophut', 'food', 'marche', 9.5590, 100.0670,
      3, 15, 'soir', 'Une rue de maisons chinoises en bois, des tables jusque sur la plage, et un marché le vendredi.', 'en:Bophut'),
  ]),
  // ------------------------------------------------------------------ Viêt Nam
  ...ville('hanoi', [
    a('vieux-quartier', 'Les 36 rues du vieux quartier', 'culture', 'marche', 21.0340, 105.8500,
      3, 0, 'matin', 'Chaque rue portait un métier ; beaucoup le portent encore, et le trafic s’écoule autour de vous.', 'fr:Vieux quartier de Hanoï'),
    a('hoan-kiem', 'Le lac Hoan Kiem et le temple Ngoc Son', 'culture', 'monument', 21.0287, 105.8524,
      2, 2, 'matin', 'Un pont rouge, une tortue légendaire, et la ville qui fait sa gymnastique à six heures.', 'fr:Lac Hoan Kiem'),
    a('temple-litterature', 'Le temple de la Littérature', 'culture', 'monument', 21.0283, 105.8355,
      2, 2, 'matin', 'La première université du pays, fondée en 1070, et les stèles des lauréats posées sur des tortues.', 'fr:Temple de la Littérature de Hanoï'),
    a('train-street', 'La rue du train', 'offbeat', 'panorama', 21.0244, 105.8412,
      1, 3, 'apres-midi', 'Un train qui passe à trente centimètres des tables, deux fois par jour, entre deux rangées de maisons.', 'en:Hanoi Train Street'),
    a('marionnettes', 'Les marionnettes sur l’eau', 'culture', 'spectacle', 21.0300, 105.8543,
      1.5, 8, 'soir', 'Un art de rizière du XIᵉ siècle : les marionnettistes sont dans l’eau, derrière le rideau de bambou.', 'fr:Múa rối nước'),
    a('street-food', 'Le bun cha et le pho, à la source', 'food', 'marche', 21.0310, 105.8500,
      3, 8, 'journee', 'Des tabourets en plastique, un bouillon qui mijote depuis l’aube, et rien d’autre à la carte.', 'fr:Bún chả'),
  ]),
  ...ville('halong', [
    a('croisiere', 'Une nuit à bord dans la baie', 'nature', 'panorama', 20.9101, 107.1839,
      24, 150, 'journee', 'Mille six cents pitons karstiques, une nuit au mouillage, et le silence une fois les moteurs coupés.', 'fr:Baie d’Ha Long'),
    a('sung-sot', 'La grotte de la Surprise', 'nature', 'nature', 20.8536, 107.0975,
      2, 5, 'matin', 'Dix mille mètres carrés de concrétions sur trois salles, découverts par les Français en 1901.', 'en:Sửng Sốt Cave'),
    a('lan-ha', 'La baie de Lan Ha en kayak', 'adventure', 'sport', 20.7500, 107.0500,
      4, 30, 'apres-midi', 'La baie voisine, sans les bateaux de croisière, avec des villages flottants encore habités.', 'en:Lan Ha Bay'),
    a('cat-ba', 'L’île de Cat Ba et son parc national', 'nature', 'nature', 20.7938, 106.9994,
      8, 20, 'journee', 'Une forêt primaire, des langurs à tête dorée — soixante individus au monde — et un point de vue à 177 m.', 'fr:Cát Bà'),
  ]),
  ...ville('hoi-an', [
    a('vieille-ville-hoian', 'La vieille ville aux lanternes', 'culture', 'monument', 15.8801, 108.3380,
      4, 5, 'soir', 'Un port marchand du XVIᵉ intact, classé, et les lanternes de soie allumées à la tombée du jour.', 'fr:Hội An'),
    a('pont-japonais', 'Le pont couvert japonais', 'culture', 'monument', 15.8772, 108.3268,
      1, 3, 'matin', 'Construit vers 1590 par la communauté japonaise, avec son petit temple dans le tablier.', 'fr:Pont couvert japonais de Hội An'),
    a('tailleur', 'Se faire tailler un vêtement sur mesure', 'shopping', 'boutique', 15.8790, 108.3330,
      4, 80, 'apres-midi', 'La spécialité de la ville : mesures le matin, essayage le soir, retouches le lendemain.', 'fr:Hội An'),
    a('my-son', 'Le sanctuaire de Mỹ Sơn', 'culture', 'monument', 15.7639, 108.1244,
      5, 25, 'matin', 'Soixante-dix temples chams en brique du IVᵉ au XIIIᵉ siècle, dans une cuvette de jungle.', 'fr:Mỹ Sơn'),
    a('an-bang', 'La plage d’An Bàng à vélo', 'relax', 'plage', 15.9089, 108.3444,
      4, 5, 'apres-midi', 'Quatre kilomètres de rizières à vélo, puis du sable et des chaises longues en bambou.', 'en:An Bang Beach'),
    a('tra-que', 'Le village maraîcher de Trà Quế', 'food', 'nature', 15.9000, 108.3200,
      3, 20, 'matin', 'On y bêche, on y sème, et on y cuisine ce qu’on vient de ramasser, à la mode de Hội An.', 'en:Trà Quế Vegetable Village'),
  ]),
  ...ville('ho-chi-minh', [
    a('cu-chi', 'Les tunnels de Cu Chi', 'culture', 'monument', 11.1433, 106.4636,
      6, 25, 'matin', 'Deux cent cinquante kilomètres de galeries sur trois niveaux, dont on parcourt quelques mètres à quatre pattes.', 'fr:Tunnels de Củ Chi'),
    a('guerre', 'Le musée des Vestiges de la guerre', 'culture', 'musee', 10.7797, 106.6922,
      2.5, 2, 'matin', 'Un musée frontal, difficile, et le seul endroit du pays où la guerre est racontée sans détour.', 'fr:Musée des vestiges de la guerre'),
    a('ben-thanh', 'Le marché Bến Thành', 'shopping', 'marche', 10.7720, 106.6980,
      2, 0, 'matin', 'Le ventre de Saïgon depuis 1914, et le marché de nuit qui prend le relais sur les rues autour.', 'fr:Marché Bến Thành'),
    a('poste-cathedrale', 'La poste centrale et Notre-Dame', 'culture', 'monument', 10.7797, 106.6990,
      1.5, 0, 'apres-midi', 'Une nef de gare signée de l’atelier d’Eiffel, en face d’une cathédrale en briques de Toulouse.', 'fr:Poste centrale de Saïgon'),
    a('mekong', 'Le delta du Mékong à la journée', 'nature', 'nature', 10.3600, 106.3600,
      10, 45, 'journee', 'Des marchés flottants, des bras de rivière en barque à rames, et des vergers qu’on traverse à pied.', 'fr:Delta du Mékong'),
    a('street-food-saigon', 'Saïgon en scooter, le soir', 'food', 'marche', 10.7769, 106.7009,
      4, 40, 'soir', 'Cinq arrêts, cinq quartiers, et la ville vue depuis l’arrière d’une moto — la seule bonne échelle.', 'fr:Hô Chi Minh-Ville'),
  ]),
  // ------------------------------------------------------------------ Cambodge et Laos
  ...ville('siem-reap', [
    a('angkor-vat', 'Angkor Vat au lever du soleil', 'culture', 'monument', 13.4125, 103.8670,
      5, 35, 'matin', 'Le plus grand monument religieux du monde, et son reflet dans le bassin nord avant six heures.', 'fr:Angkor Vat'),
    a('bayon', 'Les visages du Bayon', 'culture', 'monument', 13.4413, 103.8586,
      3, 0, 'matin', 'Deux cents visages de pierre de quatre mètres, tournés vers les quatre points cardinaux.', 'fr:Bayon'),
    a('ta-prohm', 'Ta Prohm et ses fromagers', 'culture', 'monument', 13.4348, 103.8890,
      2, 0, 'apres-midi', 'Le temple qu’on a laissé à la forêt : des racines de vingt mètres qui descendent sur les murs.', 'fr:Ta Prohm'),
    a('banteay-srei', 'Banteay Srei, la citadelle des femmes', 'culture', 'monument', 13.5989, 103.9633,
      3, 0, 'matin', 'Du grès rose sculpté si finement qu’on l’a longtemps cru l’œuvre de mains de femmes.', 'fr:Banteay Srei'),
    a('tonle-sap', 'Les villages flottants du Tonlé Sap', 'offbeat', 'panorama', 13.1500, 103.8500,
      4, 25, 'apres-midi', 'Un lac qui quadruple de surface à la mousson, et des villages entiers qui suivent le niveau.', 'fr:Tonlé Sap'),
    a('phare', 'Le cirque Phare', 'culture', 'spectacle', 13.3480, 103.8480,
      2, 20, 'soir', 'Une école d’art qui sort des jeunes de la rue, et un spectacle qui raconte le Cambodge d’aujourd’hui.', 'en:Phare, The Cambodian Circus'),
  ]),
  ...ville('luang-prabang', [
    a('aumone', 'Le tak bat, l’aumône des moines', 'culture', 'monument', 19.8890, 102.1350,
      1.5, 0, 'matin', 'À l’aube, deux cents moines en file reçoivent le riz gluant. On regarde de loin, en silence, sans flash.', 'fr:Luang Prabang'),
    a('kuang-si', 'Les chutes de Kuang Si', 'nature', 'nature', 19.7492, 101.9906,
      5, 15, 'matin', 'Des vasques turquoise en escalier dans la forêt, où l’on se baigne vraiment.', 'fr:Chutes de Kuang Si'),
    a('phousi', 'Le mont Phousi au coucher du soleil', 'relax', 'panorama', 19.8908, 102.1358,
      2, 3, 'soir', 'Trois cent vingt-huit marches, et le confluent du Mékong et de la Nam Khan en dessous.', 'en:Mount Phousi'),
    a('pak-ou', 'Les grottes de Pak Ou en bateau', 'culture', 'nature', 20.0533, 102.2158,
      5, 20, 'matin', 'Deux heures de Mékong, puis quatre mille bouddhas déposés depuis des siècles dans deux cavités.', 'fr:Grottes de Pak Ou'),
    a('marche-nuit-lpb', 'Le marché de nuit hmong', 'shopping', 'marche', 19.8895, 102.1355,
      2, 0, 'soir', 'La rue Sisavangvong fermée à dix-sept heures, et du textile hmong à perte de vue.', 'fr:Luang Prabang'),
  ]),
  // ------------------------------------------------------------------ Japon
  ...ville('tokyo', [
    a('senso-ji', 'Le Sensō-ji et Nakamise-dōri', 'culture', 'monument', 35.7148, 139.7967,
      2.5, 0, 'matin', 'Le plus vieux temple de la ville, et deux cent cinquante mètres d’échoppes pour y arriver.', 'fr:Sensō-ji'),
    a('shibuya', 'Le carrefour de Shibuya', 'offbeat', 'panorama', 35.6595, 139.7005,
      1.5, 0, 'soir', 'Trois mille personnes à chaque passage au vert. À voir d’en haut, puis à traverser.', 'fr:Carrefour de Shibuya'),
    a('tsukiji', 'Le marché extérieur de Tsukiji', 'food', 'marche', 35.6654, 139.7707,
      3, 25, 'matin', 'Le marché de gros est parti à Toyosu ; les quatre cents échoppes de rue, elles, sont restées.', 'fr:Marché de Tsukiji'),
    a('meiji', 'Le sanctuaire Meiji et Yoyogi', 'relax', 'parc', 35.6764, 139.6993,
      2.5, 0, 'matin', 'Cent mille arbres plantés à la main en 1920, en plein centre, et un torii de douze mètres.', 'fr:Meiji-jingū'),
    a('teamlab', 'teamLab Planets', 'offbeat', 'musee', 35.6486, 139.7906,
      2, 25, 'apres-midi', 'On y marche pieds nus dans l’eau, au milieu de projections qui réagissent à vos pas.', 'en:teamLab'),
    a('shinjuku-nuit', 'Golden Gai et Omoide Yokochō', 'nightlife', 'marche', 35.6938, 139.7036,
      3, 35, 'soir', 'Deux cents bars de six places dans des ruelles de l’après-guerre, à deux pas des gratte-ciel.', 'fr:Shinjuku Golden Gai'),
    a('skytree', 'La Tokyo Skytree', 'relax', 'panorama', 35.7101, 139.8107,
      2, 20, 'soir', 'Six cent trente-quatre mètres, et par temps clair le Fuji à cent kilomètres.', 'fr:Tokyo Skytree'),
    a('sumo', 'Un entraînement de sumo au petit matin', 'culture', 'spectacle', 35.6970, 139.7930,
      2, 55, 'matin', 'Dans une heya, à six heures : trois heures d’entraînement à un mètre de vous, sans un mot.', 'fr:Sumo'),
  ]),
  ...ville('kyoto', [
    a('fushimi-inari', 'Les torii de Fushimi Inari', 'culture', 'monument', 34.9671, 135.7727,
      3, 0, 'matin', 'Dix mille portiques vermillon sur quatre kilomètres de montée. Avant huit heures, on y est seul.', 'fr:Fushimi Inari-taisha'),
    a('kinkaku-ji', 'Le Pavillon d’or', 'culture', 'monument', 35.0394, 135.7292,
      1.5, 3, 'matin', 'Deux étages à la feuille d’or, reconstruits en 1955 après l’incendie qu’a raconté Mishima.', 'fr:Kinkaku-ji'),
    a('arashiyama', 'La bambouseraie d’Arashiyama', 'nature', 'parc', 35.0170, 135.6716,
      3, 0, 'matin', 'Des tiges de vingt mètres, et un bruit de vent que le Japon classe parmi ses cent paysages sonores.', 'fr:Arashiyama'),
    a('gion', 'Gion à la tombée du nuit', 'culture', 'monument', 35.0037, 135.7788,
      2, 0, 'soir', 'Des maisons de thé en bois le long du canal, et parfois une geiko qui passe. On ne la suit pas.', 'fr:Gion'),
    a('kiyomizu', 'Le Kiyomizu-dera', 'culture', 'monument', 34.9949, 135.7850,
      2, 3, 'apres-midi', 'Une terrasse de bois sur pilotis de treize mètres, sans un clou, au-dessus de la ville.', 'fr:Kiyomizu-dera'),
    a('nishiki', 'Le marché Nishiki', 'food', 'marche', 35.0050, 135.7649,
      2, 20, 'apres-midi', 'Quatre cents ans, cinq cents mètres, cent trente échoppes : « la cuisine de Kyoto ».', 'fr:Marché Nishiki'),
    a('the', 'Une cérémonie du thé', 'culture', 'detente', 35.0116, 135.7681,
      1.5, 35, 'apres-midi', 'Quarante minutes, une dizaine de gestes, et le matcha qu’on boit en trois gorgées et demie.', 'fr:Cérémonie du thé japonaise'),
    a('nara', 'Nara à la journée', 'culture', 'monument', 34.6851, 135.8048,
      7, 30, 'journee', 'Le grand bouddha de quinze mètres du Tōdai-ji, et mille deux cents daims en liberté autour.', 'fr:Nara'),
  ]),
  ...ville('osaka', [
    a('dotonbori', 'Dōtonbori le soir', 'food', 'marche', 34.6687, 135.5013,
      3, 20, 'soir', 'Le canal, les néons, le coureur Glico, et les takoyaki qu’on mange debout.', 'fr:Dōtonbori'),
    a('chateau-osaka', 'Le château d’Osaka', 'culture', 'monument', 34.6873, 135.5262,
      2.5, 6, 'matin', 'Un donjon reconstruit dans un parc de soixante hectares, avec des murs d’origine de vingt mètres.', 'fr:Château d’Osaka'),
    a('kuromon', 'Le marché Kuromon', 'food', 'marche', 34.6650, 135.5060,
      2, 25, 'matin', 'Six cents mètres de poissonniers qui grillent sur place ce qu’ils vendent.', 'en:Kuromon Ichiba Market'),
    a('umeda', 'Le Umeda Sky Building', 'relax', 'panorama', 34.7053, 135.4903,
      2, 12, 'soir', 'Deux tours reliées par un anneau suspendu à cent soixante-treize mètres, et un escalator dans le vide.', 'fr:Umeda Sky Building'),
    a('shinsekai', 'Shinsekai et la tour Tsūtenkaku', 'offbeat', 'monument', 34.6523, 135.5063,
      2.5, 8, 'soir', 'Un quartier figé dans les années trente, des kushikatsu, et l’interdiction formelle de resaucer.', 'fr:Shinsekai'),
  ]),
  // ------------------------------------------------------------------ Corée et Chine
  ...ville('seoul', [
    a('gyeongbokgung', 'Le palais Gyeongbokgung et la relève', 'culture', 'monument', 37.5796, 126.9770,
      3, 2, 'matin', 'Le palais principal des Joseon, et la relève de la garde à dix heures et quatorze heures.', 'fr:Gyeongbokgung'),
    a('bukchon', 'Le village hanok de Bukchon', 'culture', 'monument', 37.5826, 126.9830,
      2, 0, 'matin', 'Six cents maisons traditionnelles encore habitées, entre deux palais. On parle bas, les gens y vivent.', 'fr:Bukchon Hanok'),
    a('gwangjang', 'Le marché Gwangjang', 'food', 'marche', 37.5700, 126.9997,
      2, 12, 'apres-midi', 'Le plus vieux marché couvert du pays, et les bindaetteok frits à la meule de soja.', 'en:Gwangjang Market'),
    a('dmz', 'La zone démilitarisée', 'culture', 'monument', 37.9400, 126.6800,
      8, 60, 'journee', 'Le troisième tunnel d’infiltration, l’observatoire de Dora, et une frontière qui n’a jamais été un traité.', 'fr:Zone coréenne démilitarisée'),
    a('bukhansan', 'Le mont Bukhansan', 'adventure', 'nature', 37.6586, 126.9776,
      6, 0, 'matin', 'Un parc national dans la ville, huit cent trente-six mètres, et du granit à mains nues à la fin.', 'fr:Bukhansan'),
    a('hongdae', 'Hongdae le soir', 'nightlife', 'marche', 37.5563, 126.9236,
      4, 30, 'soir', 'Le quartier des écoles d’art : concerts de rue, bars minuscules, et rien qui ferme avant l’aube.', 'en:Hongdae, Seoul'),
  ]),
  ...ville('pekin', [
    a('cite-interdite', 'La Cité interdite', 'culture', 'monument', 39.9163, 116.3972,
      4, 8, 'matin', 'Neuf cents bâtiments, cinq siècles de dynasties, et une réservation obligatoire à l’avance.', 'fr:Cité interdite'),
    a('muraille-mutianyu', 'La Grande Muraille à Mutianyu', 'adventure', 'monument', 40.4319, 116.5704,
      8, 55, 'journee', 'Vingt-deux tours de guet sur six kilomètres restaurés, et beaucoup moins de monde qu’à Badaling.', 'fr:Grande Muraille'),
    a('temple-ciel', 'Le temple du Ciel', 'culture', 'monument', 39.8822, 116.4066,
      2.5, 4, 'matin', 'Une rotonde de bois bleu sans un clou, et le parc où la ville danse et joue au mahjong dès sept heures.', 'fr:Temple du Ciel'),
    a('hutongs', 'Les hutongs en cyclo-pousse', 'offbeat', 'monument', 39.9400, 116.4000,
      2, 15, 'apres-midi', 'Les ruelles d’avant les tours, autour du lac Houhai, et les cours carrées qu’on aperçoit au passage.', 'fr:Hutong'),
    a('palais-ete', 'Le Palais d’Été', 'relax', 'parc', 39.9998, 116.2755,
      3.5, 7, 'apres-midi', 'Un lac creusé à la main, une galerie peinte de sept cents mètres, et un bateau de marbre.', 'fr:Palais d’Été'),
    a('canard', 'Le canard laqué', 'food', 'detente', 39.9100, 116.4100,
      2, 30, 'soir', 'Découpé devant la table en cent vingt tranches, avec les crêpes, le concombre et la sauce.', 'fr:Canard laqué de Pékin'),
  ]),
  ...ville('shanghai', [
    a('bund', 'Le Bund au crépuscule', 'relax', 'panorama', 31.2397, 121.4900,
      2, 0, 'soir', 'Cinquante-deux façades des années trente d’un côté, Pudong et ses tours de l’autre.', 'fr:Le Bund'),
    a('yuyuan', 'Le jardin Yu', 'culture', 'parc', 31.2270, 121.4920,
      2.5, 5, 'matin', 'Un jardin Ming de deux hectares, ses rocailles et son mur-dragon, au milieu de la vieille ville.', 'fr:Jardin Yu'),
    a('concession', 'L’ancienne concession française', 'offbeat', 'monument', 31.2100, 121.4500,
      3, 0, 'apres-midi', 'Des platanes, des villas Art déco, et des boutiques dans les lilong réhabilités.', 'fr:Concession française de Shanghai'),
    a('musee-shanghai', 'Le musée de Shanghai', 'culture', 'musee', 31.2286, 121.4750,
      3, 0, 'matin', 'Bronzes rituels, céramiques et calligraphie : la meilleure collection d’art chinois du pays, gratuite.', 'fr:Musée de Shanghai'),
    a('zhujiajiao', 'Le bourg d’eau de Zhujiajiao', 'nature', 'monument', 31.1100, 121.0500,
      5, 20, 'journee', 'Trente-six ponts de pierre, des canaux, et une heure de métro depuis le centre.', 'fr:Zhujiajiao'),
  ]),
  ...ville('hong-kong', [
    a('victoria-peak', 'Le Peak par le tramway', 'relax', 'panorama', 22.2759, 114.1455,
      3, 12, 'soir', 'Une crémaillère de 1888 à vingt-sept degrés de pente, et la baie entière à cinq cent cinquante-deux mètres.', 'fr:Victoria Peak'),
    a('star-ferry', 'La traversée en Star Ferry', 'offbeat', 'panorama', 22.2940, 114.1690,
      1, 1, 'soir', 'Dix minutes, moins d’un euro, et la plus belle vue de la ville depuis un bateau de 1888.', 'fr:Star Ferry'),
    a('tian-tan', 'Le grand bouddha de Lantau', 'culture', 'monument', 22.2540, 113.9050,
      5, 25, 'journee', 'Vingt-cinq minutes de téléphérique au-dessus de la mer, puis deux cent soixante-huit marches.', 'fr:Tian Tan Buddha'),
    a('temple-street', 'Le marché de Temple Street', 'shopping', 'marche', 22.3110, 114.1700,
      2.5, 0, 'soir', 'Diseuses de bonne aventure, opéra cantonais de rue, et des tables de dai pai dong jusqu’à minuit.', 'en:Temple Street, Hong Kong'),
    a('dim-sum', 'Le dim sum du matin', 'food', 'detente', 22.2800, 114.1500,
      2, 20, 'matin', 'Des chariots qui passent, on pointe du doigt, et la note se compte aux tampons sur la fiche.', 'fr:Dim sum'),
    a('dragon-back', 'La randonnée du Dragon’s Back', 'adventure', 'nature', 22.2400, 114.2450,
      4, 0, 'matin', 'Une crête de huit kilomètres au-dessus de la mer de Chine, à quarante minutes du centre.', 'en:Dragon’s Back (Hong Kong)'),
  ]),
  // ------------------------------------------------------------------ Singapour et Malaisie
  ...ville('singapour', [
    a('gardens-bay', 'Gardens by the Bay et le Supertree Grove', 'nature', 'parc', 1.2816, 103.8636,
      3.5, 20, 'soir', 'Dix-huit arbres artificiels de cinquante mètres, et le spectacle de lumière à dix-neuf heures quarante-cinq.', 'fr:Gardens by the Bay'),
    a('marina-bay', 'La piscine du Marina Bay Sands', 'relax', 'panorama', 1.2834, 103.8607,
      2, 25, 'soir', 'Un pont-jardin posé sur trois tours à deux cents mètres, et la skyline dans l’axe.', 'fr:Marina Bay Sands'),
    a('hawker', 'Un centre de hawkers', 'food', 'marche', 1.2810, 103.8450,
      2, 8, 'apres-midi', 'Classés par l’Unesco : cent échoppes, deux étoilées Michelin, et le meilleur repas à cinq euros de la ville.', 'en:Hawker centre'),
    a('chinatown-sg', 'Chinatown et le temple de la Relique', 'culture', 'monument', 1.2815, 103.8444,
      2.5, 0, 'matin', 'Des boutiques-maisons peintes, et un temple Tang de cinq étages qui abrite une dent de Bouddha.', 'en:Buddha Tooth Relic Temple and Museum'),
    a('kampong-glam', 'Kampong Glam et Haji Lane', 'offbeat', 'marche', 1.3020, 103.8590,
      2, 0, 'apres-midi', 'La mosquée au dôme d’or, et la ruelle la plus étroite de la ville couverte de fresques.', 'en:Kampong Glam'),
    a('jardin-botanique', 'Le jardin botanique et son orchidarium', 'relax', 'parc', 1.3138, 103.8159,
      3, 10, 'matin', 'Classé au patrimoine mondial, avec mille espèces d’orchidées et une forêt primaire de six hectares.', 'fr:Jardins botaniques de Singapour'),
  ]),
  ...ville('kuala-lumpur', [
    a('petronas', 'Les tours Petronas et le pont', 'relax', 'panorama', 3.1578, 101.7117,
      2.5, 20, 'apres-midi', 'Quatre cent cinquante-deux mètres, et la passerelle du quarante-et-unième étage entre les deux.', 'fr:Tours Petronas'),
    a('batu', 'Les grottes de Batu', 'culture', 'monument', 3.2379, 101.6840,
      3, 0, 'matin', 'Deux cent soixante-douze marches arc-en-ciel, une statue de Murugan de quarante-trois mètres, et des macaques.', 'fr:Grottes de Batu'),
    a('jalan-alor', 'Jalan Alor le soir', 'food', 'marche', 3.1450, 101.7080,
      2.5, 12, 'soir', 'Une rue entière de tables en plastique, de satay et de raie grillée en feuille de bananier.', 'en:Jalan Alor'),
    a('merdeka', 'La place Merdeka et Masjid Jamek', 'culture', 'monument', 3.1478, 101.6935,
      2, 0, 'matin', 'Là où le drapeau britannique est descendu en 1957, entre un club de cricket et une mosquée moghole.', 'en:Merdeka Square, Kuala Lumpur'),
    a('kl-forest', 'La canopée de KL Forest Eco Park', 'nature', 'parc', 3.1530, 101.7030,
      1.5, 8, 'matin', 'Neuf hectares de forêt primaire en plein centre, et une passerelle à vingt-et-un mètres.', 'en:Bukit Nanas'),
  ]),
  ...ville('penang', [
    a('george-town', 'Les fresques de George Town', 'offbeat', 'oeuvre', 5.4141, 100.3288,
      3, 0, 'matin', 'Une cinquantaine de murs peints par Ernest Zacharevic et d’autres, à chercher à pied dans la vieille ville.', 'fr:George Town (Malaisie)'),
    a('kek-lok-si', 'Le temple Kek Lok Si', 'culture', 'monument', 5.3993, 100.2735,
      2.5, 3, 'apres-midi', 'Le plus grand temple bouddhiste de Malaisie, sa pagode aux dix mille bouddhas et sa Guanyin de trente mètres.', 'en:Kek Lok Si'),
    a('penang-hill', 'Penang Hill par le funiculaire', 'relax', 'panorama', 5.4239, 100.2683,
      3, 6, 'matin', 'Huit cent trente-trois mètres, cinq minutes de montée, et l’île entière jusqu’au continent.', 'en:Penang Hill'),
    a('street-food-penang', 'Le char kway teow de Penang', 'food', 'marche', 5.4180, 100.3320,
      2, 6, 'soir', 'Considérée comme la capitale culinaire de l’Asie du Sud-Est, et ça se joue sur un wok au charbon.', 'fr:Char kway teow'),
    a('clan-jetties', 'Les jetées claniques', 'culture', 'monument', 5.4127, 100.3400,
      1.5, 0, 'apres-midi', 'Six pontons sur pilotis, un par clan chinois, habités depuis le XIXᵉ siècle.', 'en:Clan jetties of Penang'),
  ]),
  // ------------------------------------------------------------------ France
  ...ville('paris', [
    a('louvre', 'Le Louvre', 'culture', 'musee', 48.8606, 2.3376,
      4, 22, 'matin', 'Trente-cinq mille œuvres exposées. On n’en voit pas le dixième : mieux vaut choisir deux ailes.', 'fr:Musée du Louvre'),
    a('orsay', 'Le musée d’Orsay', 'culture', 'musee', 48.8600, 2.3266,
      3, 16, 'matin', 'Une gare de 1900 devenue le plus beau rassemblement d’impressionnistes au monde.', 'fr:Musée d’Orsay'),
    a('tour-eiffel', 'La tour Eiffel', 'culture', 'monument', 48.8584, 2.2945,
      2.5, 29, 'soir', 'Trois cents mètres, et le scintillement cinq minutes à chaque heure une fois la nuit tombée.', 'fr:Tour Eiffel'),
    a('montmartre', 'Montmartre à pied', 'offbeat', 'monument', 48.8867, 2.3431,
      3, 0, 'matin', 'Les vignes, le mur des je t’aime, la place du Tertre, et Paris en contrebas depuis le parvis.', 'fr:Montmartre'),
    a('marais', 'Le Marais et la place des Vosges', 'shopping', 'monument', 48.8555, 2.3653,
      3, 0, 'apres-midi', 'Des hôtels particuliers du XVIIᵉ, la plus vieille place de Paris, et des boutiques dans les cours.', 'fr:Le Marais (Paris)'),
    a('sainte-chapelle', 'La Sainte-Chapelle', 'culture', 'monument', 48.8554, 2.3450,
      1.5, 13, 'matin', 'Mille cent treize vitraux du XIIIᵉ siècle sur six cent soixante-dix mètres carrés. À voir par beau temps.', 'fr:Sainte-Chapelle'),
    a('versailles', 'Versailles et ses jardins', 'culture', 'monument', 48.8049, 2.1204,
      7, 32, 'journee', 'La galerie des Glaces, et huit cents hectares de jardins où l’on marche vraiment beaucoup.', 'fr:Château de Versailles'),
    a('canal-saint-martin', 'Le canal Saint-Martin en soirée', 'nightlife', 'marche', 48.8710, 2.3660,
      3, 15, 'soir', 'Des passerelles en fonte, neuf écluses, et les quais où tout le monde s’assoit avec une bouteille.', 'fr:Canal Saint-Martin'),
    a('catacombes', 'Les catacombes', 'offbeat', 'monument', 48.8338, 2.3324,
      2, 29, 'apres-midi', 'Un kilometre et demi de galeries à vingt mètres sous terre, et les ossements de six millions de Parisiens.', 'fr:Catacombes de Paris'),
  ]),
  ...ville('marseille', [
    a('calanques', 'Les calanques en bateau', 'nature', 'panorama', 43.2100, 5.4400,
      5, 35, 'matin', 'Sormiou, Morgiou, En-Vau : du calcaire blanc qui tombe à pic dans une eau impossible.', 'fr:Parc national des Calanques'),
    a('notre-dame-garde', 'Notre-Dame de la Garde', 'culture', 'monument', 43.2840, 5.3712,
      2, 0, 'matin', 'La Bonne Mère à cent soixante-deux mètres, ses ex-voto de marins, et toute la ville en dessous.', 'fr:Basilique Notre-Dame-de-la-Garde'),
    a('panier', 'Le quartier du Panier', 'offbeat', 'monument', 43.2990, 5.3670,
      2.5, 0, 'apres-midi', 'Le plus vieux quartier de France, ses ruelles en escalier et ses façades peintes.', 'fr:Le Panier'),
    a('mucem', 'Le MuCEM et le fort Saint-Jean', 'culture', 'musee', 43.2966, 5.3608,
      3, 11, 'apres-midi', 'Une résille de béton de Rudy Ricciotti reliée au fort par une passerelle au-dessus de l’eau.', 'fr:Musée des Civilisations de l’Europe et de la Méditerranée'),
    a('if', 'Le château d’If', 'culture', 'monument', 43.2797, 5.3253,
      3, 18, 'apres-midi', 'Vingt minutes de bateau, une forteresse-prison de François Iᵉʳ, et la cellule de Monte-Cristo.', 'fr:Château d’If'),
    a('bouillabaisse', 'Une vraie bouillabaisse', 'food', 'detente', 43.2900, 5.3700,
      2.5, 55, 'soir', 'Cinq poissons de roche minimum, servis à part du bouillon, avec la rouille et les croûtons.', 'fr:Bouillabaisse'),
  ]),
  ...ville('nice', [
    a('promenade', 'La promenade des Anglais à vélo', 'relax', 'panorama', 43.6950, 7.2650,
      2, 5, 'matin', 'Sept kilomètres le long de la baie des Anges, et les chaises bleues face à la mer.', 'fr:Promenade des Anglais'),
    a('vieux-nice', 'Le cours Saleya et le vieux Nice', 'food', 'marche', 43.6957, 7.2757,
      2.5, 0, 'matin', 'Le marché aux fleurs, la socca sortie du four à bois, et les ruelles à l’ombre derrière.', 'fr:Vieux-Nice'),
    a('colline-chateau', 'La colline du Château', 'relax', 'panorama', 43.6950, 7.2800,
      1.5, 0, 'soir', 'Quatre-vingt-douze mètres, une cascade artificielle, et la baie entière au coucher du soleil.', 'fr:Colline du Château'),
    a('chagall', 'Le musée Chagall', 'culture', 'musee', 43.7080, 7.2670,
      1.5, 10, 'matin', 'Les dix-sept toiles du Message biblique, réunies dans un bâtiment conçu pour elles.', 'fr:Musée national Marc-Chagall'),
    a('eze', 'Le village d’Èze', 'culture', 'panorama', 43.7280, 7.3610,
      3, 6, 'apres-midi', 'Un nid d’aigle à quatre cent vingt-sept mètres, son jardin exotique et la Méditerranée dessous.', 'fr:Èze'),
  ]),
  ...ville('bordeaux', [
    a('miroir-eau', 'Le miroir d’eau et la place de la Bourse', 'relax', 'monument', 44.8410, -0.5690,
      1.5, 0, 'soir', 'Trois mille cinq cents mètres carrés de granit sous deux centimètres d’eau, et la façade qui s’y retourne.', 'fr:Miroir d’eau'),
    a('cite-vin', 'La Cité du Vin', 'food', 'musee', 44.8625, -0.5510,
      3, 22, 'matin', 'Un bâtiment en forme de carafe, un parcours sensoriel, et une dégustation au belvédère du huitième.', 'fr:Cité du Vin'),
    a('saint-emilion', 'Saint-Émilion et ses châteaux', 'food', 'monument', 44.8938, -0.1556,
      7, 60, 'journee', 'Un village classé, une église monolithe creusée dans le roc, et deux dégustations en chemin.', 'fr:Saint-Émilion'),
    a('dune-pilat', 'La dune du Pilat', 'nature', 'nature', 44.5890, -1.2140,
      5, 8, 'apres-midi', 'Cent deux mètres de sable, la plus haute d’Europe, et le banc d’Arguin de l’autre côté.', 'fr:Dune du Pilat'),
    a('chartrons', 'Le quartier des Chartrons', 'shopping', 'marche', 44.8520, -0.5690,
      2.5, 0, 'apres-midi', 'L’ancien quartier des négociants, ses entrepôts devenus brocantes, et le marché du dimanche.', 'fr:Chartrons'),
  ]),
  ...ville('lyon', [
    a('vieux-lyon', 'Les traboules du Vieux Lyon', 'offbeat', 'monument', 45.7620, 4.8270,
      2.5, 0, 'matin', 'Des passages privés qui traversent les immeubles Renaissance, ouverts par convention avec la ville.', 'fr:Traboule'),
    a('fourviere', 'Fourvière et le théâtre antique', 'culture', 'monument', 45.7622, 4.8222,
      3, 0, 'matin', 'Une basilique du XIXᵉ posée sur la colline, et deux théâtres romains du Iᵉʳ siècle juste à côté.', 'fr:Basilique Notre-Dame de Fourvière'),
    a('bouchon', 'Un bouchon lyonnais', 'food', 'detente', 45.7640, 4.8330,
      2, 30, 'soir', 'Quenelle, tablier de sapeur, cervelle de canut : la cuisine des mères, servie sans façon.', 'fr:Bouchon lyonnais'),
    a('halles', 'Les Halles Paul Bocuse', 'food', 'marche', 45.7620, 4.8520,
      2, 25, 'matin', 'Cinquante commerçants, du saucisson brioché et des huîtres qu’on mange debout au comptoir.', 'fr:Halles de Lyon-Paul Bocuse'),
    a('confluence', 'Le musée des Confluences', 'culture', 'musee', 45.7330, 4.8180,
      3, 9, 'apres-midi', 'Un cristal de verre et d’acier à la pointe de la presqu’île, et un parcours qui mêle sciences et sociétés.', 'fr:Musée des Confluences'),
  ]),
  ...ville('chamonix', [
    a('aiguille-midi', 'L’Aiguille du Midi', 'adventure', 'panorama', 45.8786, 6.8872,
      4, 75, 'matin', 'Trois mille huit cent quarante-deux mètres en vingt minutes, et le pas dans le vide à la sortie.', 'fr:Aiguille du Midi'),
    a('mer-de-glace', 'La Mer de Glace par le Montenvers', 'nature', 'nature', 45.9300, 6.9200,
      4, 40, 'matin', 'Un train à crémaillère de 1908, et une grotte creusée chaque année dans le plus grand glacier de France.', 'fr:Mer de Glace'),
    a('brevent', 'Le Brévent', 'relax', 'panorama', 45.9330, 6.8440,
      3, 38, 'apres-midi', 'Le versant en face : le mont Blanc entier dans l’axe, sans avoir à le gravir.', 'fr:Le Brévent'),
    a('lac-blanc', 'La randonnée du lac Blanc', 'adventure', 'nature', 45.9740, 6.8890,
      6, 20, 'matin', 'Six cents mètres de dénivelé, et un lac à 2 352 m qui renvoie toute la chaîne.', 'fr:Lac Blanc (Haute-Savoie)'),
    a('parapente', 'Un vol en parapente biplace', 'adventure', 'sport', 45.9240, 6.8700,
      2, 120, 'matin', 'Décollage au Plan Praz, vingt minutes au-dessus de la vallée, atterrissage au centre-ville.', 'fr:Parapente'),
  ]),
  ...ville('annecy', [
    a('lac', 'Le tour du lac à vélo', 'adventure', 'sport', 45.8500, 6.1700,
      4, 15, 'matin', 'Quarante kilomètres sur une voie verte, avec des plages pour couper en chemin.', 'fr:Lac d’Annecy'),
    a('vieille-ville-annecy', 'Les canaux de la vieille ville', 'culture', 'monument', 45.8990, 6.1280,
      2, 0, 'matin', 'Le Thiou, les arcades, et le palais de l’Isle planté au milieu du canal depuis le XIIᵉ.', 'fr:Annecy'),
    a('semnoz', 'Le Semnoz au coucher du soleil', 'relax', 'panorama', 45.8330, 6.1000,
      3, 0, 'soir', 'Mille sept cents mètres au-dessus du lac, et le mont Blanc en face quand le ciel est net.', 'fr:Semnoz'),
    a('gorges-fier', 'Les gorges du Fier', 'nature', 'nature', 45.9080, 6.0400,
      2, 6, 'apres-midi', 'Une passerelle accrochée à la paroi, vingt-cinq mètres au-dessus du torrent, sur deux cent cinquante mètres.', 'fr:Gorges du Fier'),
  ]),
  // ------------------------------------------------------------------ Italie
  ...ville('rome', [
    a('colisee', 'Le Colisée et le Forum', 'culture', 'monument', 41.8902, 12.4922,
      4, 18, 'matin', 'Cinquante mille places, quatre-vingts arcades, et le Forum juste derrière avec le même billet.', 'fr:Colisée'),
    a('vatican', 'Les musées du Vatican et la Sixtine', 'culture', 'musee', 41.9065, 12.4536,
      4, 25, 'matin', 'Sept kilomètres de galeries pour arriver au plafond de Michel-Ange. Réservation obligatoire.', 'fr:Musées du Vatican'),
    a('pantheon', 'Le Panthéon', 'culture', 'monument', 41.8986, 12.4769,
      1, 5, 'matin', 'La plus grande coupole de béton non armé jamais construite, intacte depuis 126, et son oculus ouvert.', 'fr:Panthéon (Rome)'),
    a('trastevere', 'Trastevere le soir', 'nightlife', 'marche', 41.8890, 12.4690,
      3, 25, 'soir', 'De l’autre côté du Tibre : des ruelles pavées, du linge aux fenêtres, et des tables partout.', 'fr:Trastevere'),
    a('borghese', 'La galerie Borghèse', 'culture', 'musee', 41.9142, 12.4922,
      2, 15, 'apres-midi', 'Six Bernin et six Caravage dans une villa. Deux heures maximum, par créneau, c’est la règle.', 'fr:Galerie Borghèse'),
    a('appia', 'La via Appia antica à vélo', 'offbeat', 'monument', 41.8560, 12.5170,
      4, 15, 'matin', 'Des pavés d’origine, des tombeaux romains, et les catacombes de Saint-Calixte en chemin.', 'fr:Via Appia'),
    a('trevi', 'La fontaine de Trevi au petit matin', 'culture', 'monument', 41.9009, 12.4833,
      1, 0, 'matin', 'Vingt-six mètres de travertin. Avant sept heures, on l’a presque pour soi.', 'fr:Fontaine de Trevi'),
  ]),
  ...ville('florence', [
    a('uffizi', 'La galerie des Offices', 'culture', 'musee', 43.7678, 11.2553,
      3.5, 25, 'matin', 'Botticelli, Léonard, Caravage, et une file qui double si l’on n’a pas réservé.', 'fr:Galerie des Offices'),
    a('duomo', 'La coupole de Brunelleschi', 'culture', 'monument', 43.7731, 11.2560,
      2, 30, 'matin', 'Quatre cent soixante-trois marches entre les deux coques, et quatre millions de briques sans cintre.', 'fr:Cathédrale Santa Maria del Fiore'),
    a('david', 'Le David à l’Accademia', 'culture', 'musee', 43.7767, 11.2586,
      1.5, 16, 'matin', 'Cinq mètres dix, un seul bloc de Carrare, et vingt-six ans d’âge quand Michel-Ange l’a fini.', 'fr:David (Michel-Ange)'),
    a('michelangelo', 'La place Michel-Ange', 'relax', 'panorama', 43.7629, 11.2650,
      1.5, 0, 'soir', 'La vue de carte postale sur l’Arno et la coupole, et il faut monter à pied pour la mériter.', 'fr:Piazzale Michelangelo'),
    a('oltrarno', 'L’Oltrarno et les ateliers d’artisans', 'shopping', 'boutique', 43.7660, 11.2480,
      2.5, 0, 'apres-midi', 'La rive gauche : doreurs, relieurs, maroquiniers, dans les mêmes boutiques depuis des générations.', 'fr:Oltrarno'),
    a('chianti', 'Le Chianti en dégustation', 'food', 'nature', 43.5300, 11.3100,
      7, 85, 'journee', 'Des collines de cyprès, deux domaines, et le sangiovese expliqué par ceux qui le font.', 'fr:Chianti (vin)'),
  ]),
  ...ville('venise', [
    a('saint-marc', 'La basilique Saint-Marc', 'culture', 'monument', 45.4345, 12.3397,
      2, 6, 'matin', 'Huit mille mètres carrés de mosaïque à fond d’or, et la Pala d’Oro derrière l’autel.', 'fr:Basilique Saint-Marc de Venise'),
    a('doges', 'Le palais des Doges et le pont des Soupirs', 'culture', 'monument', 45.4337, 12.3400,
      2.5, 30, 'matin', 'La salle du Grand Conseil, le plus grand tableau sur toile du monde, et les prisons derrière.', 'fr:Palais des Doges'),
    a('cannaregio', 'Cannaregio et le Ghetto', 'offbeat', 'monument', 45.4450, 12.3270,
      3, 0, 'apres-midi', 'Le premier ghetto d’Europe, en 1516, et le quartier où les Vénitiens habitent encore.', 'fr:Ghetto de Venise'),
    a('murano-burano', 'Murano et Burano', 'culture', 'monument', 45.4850, 12.4170,
      6, 15, 'journee', 'Le verre soufflé d’un côté, les maisons peintes et la dentelle de l’autre, en vaporetto.', 'fr:Burano'),
    a('bacari', 'La tournée des bacari', 'food', 'marche', 45.4380, 12.3300,
      3, 25, 'soir', 'Un ombra de vin et deux cicheti par comptoir, debout, comme les Vénitiens le font depuis toujours.', 'it:Bacaro'),
    a('rialto', 'Le marché du Rialto au petit matin', 'food', 'marche', 45.4400, 12.3350,
      1.5, 0, 'matin', 'Le marché aux poissons depuis 1097, ouvert à sept heures, fermé le dimanche et le lundi.', 'fr:Pont du Rialto'),
  ]),
  ...ville('naples', [
    a('pompei', 'Pompéi', 'culture', 'monument', 40.7497, 14.4869,
      5, 18, 'matin', 'Soixante-six hectares figés en 79, et des maisons dont les fresques sont encore sur les murs.', 'fr:Pompéi'),
    a('vesuve', 'Le cratère du Vésuve', 'adventure', 'nature', 40.8210, 14.4260,
      4, 25, 'matin', 'Trente minutes de montée sur la lave, et le golfe entier depuis le bord du cratère.', 'fr:Vésuve'),
    a('napoli-sotterranea', 'Naples souterraine', 'offbeat', 'monument', 40.8500, 14.2570,
      2, 12, 'apres-midi', 'Quarante mètres sous la ville : citernes grecques, abris de 1943, et des passages à la bougie.', 'it:Napoli sotterranea'),
    a('pizza', 'La pizza napolitaine, à Naples', 'food', 'detente', 40.8510, 14.2600,
      1.5, 10, 'soir', 'Soixante secondes à quatre cent cinquante degrés, deux garnitures autorisées, et rien d’autre.', 'fr:Pizza napolitaine'),
    a('archeo-naples', 'Le musée archéologique', 'culture', 'musee', 40.8533, 14.2503,
      3, 18, 'matin', 'Tout ce qui a été sorti de Pompéi et d’Herculanum, y compris le cabinet secret.', 'fr:Musée archéologique national de Naples'),
    a('spaccanapoli', 'Spaccanapoli à pied', 'offbeat', 'marche', 40.8490, 14.2570,
      2.5, 0, 'apres-midi', 'La rue droite qui coupe la vieille ville en deux depuis les Grecs, et tout ce qui déborde dessus.', 'it:Spaccanapoli'),
  ]),
  ...ville('milan', [
    a('cene', 'La Cène de Léonard', 'culture', 'oeuvre', 45.4660, 9.1710,
      1, 15, 'matin', 'Quinze minutes par créneau, vingt-cinq personnes, et une réservation deux mois à l’avance.', 'fr:La Cène (Léonard de Vinci)'),
    a('duomo-milan', 'Les terrasses du Duomo', 'culture', 'panorama', 45.4642, 9.1900,
      2, 15, 'matin', 'Trois mille quatre cents statues, cent trente-cinq flèches, et une promenade sur le toit.', 'fr:Cathédrale de Milan'),
    a('brera', 'La pinacothèque de Brera', 'culture', 'musee', 45.4720, 9.1880,
      2.5, 15, 'apres-midi', 'Mantegna, Raphaël, Piero della Francesca, dans un palais du XVIIᵉ au-dessus des beaux-arts.', 'fr:Pinacothèque de Brera'),
    a('navigli', 'L’apéritif sur les Navigli', 'nightlife', 'marche', 45.4520, 9.1750,
      3, 20, 'soir', 'Les canaux dessinés par Léonard, et l’aperitivo milanais : un verre, un buffet compris.', 'fr:Navigli'),
  ]),
  ...ville('cinque-terre', [
    a('sentier-azur', 'Le sentier Azzurro', 'adventure', 'nature', 44.1280, 9.7100,
      6, 8, 'matin', 'Douze kilomètres de Monterosso à Riomaggiore, en balcon au-dessus de la mer, par les cinq villages.', 'it:Sentiero azzurro'),
    a('vernazza', 'Le port de Vernazza', 'relax', 'panorama', 44.1350, 9.6840,
      2, 0, 'soir', 'Le seul port naturel des cinq, ses maisons empilées, et la terrasse du château au-dessus.', 'fr:Vernazza'),
    a('manarola', 'Manarola au crépuscule', 'relax', 'panorama', 44.1070, 9.7280,
      2, 0, 'soir', 'Le point de vue de Nessun Dorma, et les façades ocre qui s’allument d’un coup.', 'fr:Manarola'),
    a('bateau', 'Les cinq villages vus de la mer', 'nature', 'panorama', 44.1200, 9.7000,
      3, 30, 'apres-midi', 'La seule manière de comprendre comment ils tiennent sur la falaise.', 'fr:Cinque Terre'),
  ]),
  ...ville('amalfi', [
    a('sentier-dieux', 'Le sentier des Dieux', 'adventure', 'nature', 40.6300, 14.5700,
      5, 0, 'matin', 'Sept kilomètres de Bomerano à Nocelle, cinq cents mètres au-dessus de la mer, en descente.', 'it:Sentiero degli Dei'),
    a('positano', 'Positano', 'relax', 'panorama', 40.6280, 14.4850,
      4, 5, 'apres-midi', 'Un village qui dévale la falaise jusqu’à la plage, et mille marches pour y remonter.', 'fr:Positano'),
    a('ravello', 'Les jardins de Ravello', 'relax', 'parc', 40.6490, 14.6120,
      3, 8, 'matin', 'Villa Rufolo et villa Cimbrone, et la terrasse de l’Infini à trois cent cinquante mètres au-dessus du golfe.', 'fr:Ravello'),
    a('duomo-amalfi', 'La cathédrale d’Amalfi', 'culture', 'monument', 40.6340, 14.6030,
      1.5, 3, 'matin', 'Soixante-deux marches, une façade arabo-normande, et un cloître du Paradis en arcs entrelacés.', 'it:Duomo di Amalfi'),
    a('capri', 'Capri à la journée', 'nature', 'panorama', 40.5500, 14.2400,
      8, 45, 'journee', 'La grotte bleue si la mer le permet, les Faraglioni, et le télésiège du mont Solaro.', 'fr:Capri'),
  ]),
  // ------------------------------------------------------------------ Espagne et Portugal
  ...ville('barcelone', [
    a('sagrada', 'La Sagrada Família', 'culture', 'monument', 41.4036, 2.1744,
      2.5, 26, 'matin', 'Cent quarante ans de chantier, et une forêt de colonnes qui filtre la lumière par couleur selon l’heure.', 'fr:Sagrada Família'),
    a('guell', 'Le parc Güell', 'culture', 'parc', 41.4145, 2.1527,
      2.5, 10, 'matin', 'Le banc ondulant en trencadís, la salle hypostyle, et Barcelone jusqu’à la mer.', 'fr:Parc Güell'),
    a('boqueria', 'Le marché de la Boqueria', 'food', 'marche', 41.3817, 2.1717,
      1.5, 12, 'matin', 'Trois cents étals sous une verrière de 1840, et des comptoirs où l’on mange sur place.', 'fr:Marché de la Boqueria'),
    a('gothique', 'Le quartier gothique', 'culture', 'monument', 41.3830, 2.1770,
      2.5, 0, 'apres-midi', 'La cathédrale, ses treize oies, et des ruelles romaines sous deux mille ans de couches.', 'fr:Quartier gothique de Barcelone'),
    a('pedrera', 'La Pedrera et la Casa Batlló', 'culture', 'monument', 41.3953, 2.1619,
      3, 28, 'apres-midi', 'Deux Gaudí sur le passeig de Gràcia, dont un toit-terrasse de cheminées en guerriers.', 'fr:Casa Milà'),
    a('bunkers', 'Les bunkers du Carmel', 'offbeat', 'panorama', 41.4192, 2.1620,
      2, 0, 'soir', 'Une batterie antiaérienne de 1937 devenue le meilleur point de vue de la ville, et gratuit.', 'ca:Bateria antiaèria del Turó de la Rovira'),
    a('montjuic', 'Montjuïc et la fondation Miró', 'culture', 'musee', 41.3685, 2.1600,
      3.5, 14, 'apres-midi', 'Un funiculaire, un château, et dix mille œuvres dans un bâtiment de Josep Lluís Sert.', 'fr:Fondation Joan Miró'),
  ]),
  ...ville('madrid', [
    a('prado', 'Le musée du Prado', 'culture', 'musee', 40.4138, -3.6921,
      3.5, 15, 'matin', 'Les Ménines, le Jardin des délices, et les peintures noires de Goya au sous-sol.', 'fr:Musée du Prado'),
    a('reina-sofia', 'Guernica au Reina Sofía', 'culture', 'musee', 40.4080, -3.6945,
      2.5, 12, 'apres-midi', 'Trois mètres cinquante sur sept quatre-vingts, et la salle entière qui se tait devant.', 'fr:Musée national centre d’art Reina Sofía'),
    a('retiro', 'Le parc du Retiro', 'relax', 'parc', 40.4153, -3.6844,
      2, 0, 'matin', 'Cent vingt-cinq hectares, un étang où l’on rame, et un palais de cristal au milieu des arbres.', 'fr:Parc du Retiro'),
    a('san-miguel', 'Le marché de San Miguel', 'food', 'marche', 40.4154, -3.7090,
      1.5, 20, 'apres-midi', 'Une halle de fonte de 1916, et trente comptoirs de tapas debout.', 'fr:Marché de San Miguel'),
    a('tablao', 'Un tablao de flamenco', 'culture', 'spectacle', 40.4140, -3.7070,
      2, 35, 'soir', 'Cante, baile, toque : à un mètre, sans micro, et ça change tout.', 'fr:Flamenco'),
    a('tolede', 'Tolède à la journée', 'culture', 'monument', 39.8628, -4.0273,
      8, 35, 'journee', 'Trente minutes d’AVE, et une ville où trois religions ont bâti côte à côte pendant quatre siècles.', 'fr:Tolède'),
  ]),
  ...ville('seville', [
    a('alcazar', 'Le Real Alcázar', 'culture', 'monument', 37.3830, -5.9908,
      2.5, 15, 'matin', 'Un palais mudéjar toujours en usage, ses azulejos et ses jardins de myrte.', 'fr:Alcazar de Séville'),
    a('cathedrale-seville', 'La cathédrale et la Giralda', 'culture', 'monument', 37.3860, -5.9930,
      2, 12, 'matin', 'La plus grande cathédrale gothique du monde, et un minaret almohade devenu clocher, sans une marche.', 'fr:Cathédrale de Séville'),
    a('plaza-espana', 'La plaza de España', 'culture', 'monument', 37.3772, -5.9869,
      1.5, 0, 'soir', 'Cinquante mille mètres carrés en demi-cercle, quarante-huit bancs d’azulejos, un par province.', 'fr:Plaza de España (Séville)'),
    a('triana', 'Triana et ses céramistes', 'offbeat', 'boutique', 37.3840, -6.0020,
      2.5, 0, 'apres-midi', 'De l’autre côté du Guadalquivir : le quartier gitan, ses ateliers de faïence et son marché.', 'fr:Triana (Séville)'),
    a('flamenco-seville', 'Le flamenco à Triana', 'culture', 'spectacle', 37.3830, -6.0010,
      2, 25, 'soir', 'Là où il est né. Pas de spectacle pour cars, des peñas où l’on entre en silence.', 'fr:Flamenco'),
    a('setas', 'Les Setas de la Encarnación', 'offbeat', 'panorama', 37.3930, -5.9920,
      1.5, 5, 'soir', 'La plus grande structure en bois du monde, et une passerelle ondulante sur les toits.', 'es:Setas de Sevilla'),
  ]),
  ...ville('lisbonne', [
    a('belem', 'Le monastère des Hiéronymites', 'culture', 'monument', 38.6979, -9.2065,
      2.5, 12, 'matin', 'Le manuélin à son sommet : un cloître de deux étages taillé comme du cordage.', 'fr:Monastère des Hiéronymites'),
    a('tram-28', 'Le tram 28', 'offbeat', 'panorama', 38.7120, -9.1330,
      1.5, 3, 'matin', 'Une Remodelado de 1930 qui grimpe l’Alfama en grinçant. Tôt le matin, on a une place assise.', 'pt:Elétricos de Lisboa'),
    a('alfama', 'L’Alfama et le château São Jorge', 'culture', 'monument', 38.7139, -9.1335,
      3, 10, 'apres-midi', 'Le seul quartier qu’a épargné le séisme de 1755, et onze tours mauresques au-dessus.', 'fr:Alfama'),
    a('fado', 'Une soirée de fado', 'culture', 'spectacle', 38.7110, -9.1310,
      3, 40, 'soir', 'Une guitare portugaise, une viola, une voix, et la salle qui s’arrête de parler.', 'fr:Fado'),
    a('sintra', 'Sintra et le palais de Pena', 'culture', 'monument', 38.7876, -9.3904,
      7, 30, 'journee', 'Un palais romantique jaune et rouge dans la brume, et le puits initiatique de la Quinta da Regaleira.', 'fr:Palais national de Pena'),
    a('pasteis', 'Les pastéis de Belém', 'food', 'detente', 38.6975, -9.2030,
      1, 6, 'matin', 'La recette du monastère, inchangée depuis 1837, et vingt mille fournées par jour.', 'fr:Pastel de nata'),
    a('lx-factory', 'La LX Factory', 'shopping', 'boutique', 38.7030, -9.1780,
      2.5, 0, 'apres-midi', 'Une filature de 1846 sous le pont, devenue librairies, ateliers et terrasses.', 'pt:LX Factory'),
  ]),
  ...ville('porto', [
    a('caves', 'Les caves de Vila Nova de Gaia', 'food', 'detente', 41.1380, -8.6110,
      2.5, 20, 'apres-midi', 'De l’autre côté du Douro : des chais de porto qu’on visite, et une dégustation de trois verres.', 'fr:Porto (vin)'),
    a('lello', 'La librairie Lello', 'culture', 'boutique', 41.1470, -8.6150,
      1, 8, 'matin', 'Un escalier rouge de 1906 sous une verrière, et le billet déductible d’un livre.', 'fr:Librairie Lello'),
    a('ribeira', 'La Ribeira et le pont Luís Iᵉʳ', 'relax', 'panorama', 41.1410, -8.6130,
      2, 0, 'soir', 'Des façades empilées en front de fleuve, et un tablier de Téophile Seyrig à soixante mètres.', 'fr:Pont Luís Iᵉʳ'),
    a('sao-bento', 'La gare de São Bento', 'culture', 'monument', 41.1455, -8.6105,
      0.5, 0, 'matin', 'Vingt mille azulejos dans le hall, posés par Jorge Colaço entre 1905 et 1916.', 'fr:Gare de Porto-São Bento'),
    a('douro', 'La vallée du Douro', 'nature', 'panorama', 41.1600, -7.7900,
      9, 70, 'journee', 'Des terrasses de schiste à pic sur le fleuve, en train puis en bateau, avec deux quintas.', 'fr:Vallée du Douro'),
    a('francesinha', 'Une francesinha', 'food', 'detente', 41.1500, -8.6100,
      1.5, 14, 'soir', 'Un croque-monsieur au jambon, saucisse et steak, noyé de sauce à la bière. Une seule suffit.', 'fr:Francesinha'),
  ]),
  // ------------------------------------------------------------------ Europe centrale et du Nord
  ...ville('prague', [
    a('pont-charles', 'Le pont Charles au lever du jour', 'culture', 'monument', 50.0865, 14.4114,
      1.5, 0, 'matin', 'Trente statues baroques, cinq cent seize mètres, et à six heures personne dessus.', 'fr:Pont Charles'),
    a('chateau-prague', 'Le château et la cathédrale Saint-Guy', 'culture', 'monument', 50.0910, 14.4010,
      3.5, 18, 'matin', 'Le plus grand ensemble castral du monde, et une rosace de dix mètres signée Mucha à l’intérieur.', 'fr:Château de Prague'),
    a('horloge', 'L’horloge astronomique', 'culture', 'monument', 50.0870, 14.4208,
      1, 0, 'matin', 'Six cent quinze ans, et les apôtres qui défilent à chaque heure devant la place.', 'fr:Horloge astronomique de Prague'),
    a('josefov', 'Le quartier juif et le vieux cimetière', 'culture', 'monument', 50.0900, 14.4180,
      2.5, 20, 'apres-midi', 'Douze mille pierres sur douze couches de tombes, faute de place pendant trois siècles.', 'fr:Josefov'),
    a('vysehrad', 'Vyšehrad', 'offbeat', 'panorama', 50.0640, 14.4180,
      2.5, 0, 'apres-midi', 'La seconde forteresse, celle que les cars ignorent, et la Vltava trente mètres en dessous.', 'fr:Vyšehrad'),
    a('biere', 'Une pivnice tchèque', 'food', 'detente', 50.0810, 14.4270,
      2, 15, 'soir', 'La pils est née à cent kilomètres d’ici. Une tanková sortie du réservoir n’a rien à voir.', 'fr:Bière tchèque'),
  ]),
  ...ville('budapest', [
    a('szechenyi', 'Les bains Széchenyi', 'relax', 'detente', 47.5186, 19.0832,
      3, 25, 'matin', 'Dix-huit bassins alimentés par une source à soixante-quatorze degrés, dont trois dehors, toute l’année.', 'fr:Bains Széchenyi'),
    a('parlement', 'Le Parlement hongrois', 'culture', 'monument', 47.5072, 19.0455,
      1.5, 12, 'matin', 'Deux cent soixante-huit mètres de néogothique sur le Danube, et la couronne de saint Étienne dedans.', 'fr:Parlement hongrois'),
    a('bastion', 'Le bastion des Pêcheurs', 'relax', 'panorama', 47.5025, 19.0347,
      1.5, 0, 'soir', 'Sept tourelles pour les sept tribus magyares, et tout Pest de l’autre côté de l’eau.', 'fr:Bastion des pêcheurs'),
    a('ruin-bar', 'Les ruin bars du VIIᵉ', 'nightlife', 'marche', 47.4970, 19.0630,
      3, 20, 'soir', 'Des immeubles abandonnés du quartier juif remplis de meubles dépareillés. Szimpla Kert a lancé le genre.', 'en:Ruin bar'),
    a('marche-central', 'Le grand marché couvert', 'food', 'marche', 47.4870, 19.0590,
      1.5, 10, 'matin', 'Une halle de 1897, du paprika en guirlandes, et les lángos à l’étage.', 'fr:Grand marché central de Budapest'),
    a('danube-nuit', 'Le Danube en bateau, de nuit', 'relax', 'panorama', 47.4990, 19.0450,
      1.5, 20, 'soir', 'Une heure entre les ponts, avec le Parlement et le château éclairés depuis l’eau.', 'fr:Danube'),
  ]),
  ...ville('vienne', [
    a('schonbrunn', 'Le château de Schönbrunn', 'culture', 'monument', 48.1847, 16.3122,
      4, 26, 'matin', 'Mille quatre cent quarante et une pièces, un parc à la française, et la Gloriette au sommet.', 'fr:Château de Schönbrunn'),
    a('belvedere', 'Le Baiser de Klimt au Belvédère', 'culture', 'musee', 48.1913, 16.3809,
      2.5, 17, 'apres-midi', 'Un mètre quatre-vingts de carré à la feuille d’or, dans un palais baroque avec vue sur la ville.', 'fr:Belvédère (Vienne)'),
    a('opera', 'Une soirée au Staatsoper', 'culture', 'spectacle', 48.2030, 16.3690,
      3.5, 30, 'soir', 'Trois cent cinquante places debout à quinze euros, vendues le jour même, quatre-vingts minutes avant.', 'fr:Opéra d’État de Vienne'),
    a('naschmarkt', 'Le Naschmarkt', 'food', 'marche', 48.1980, 16.3620,
      2, 15, 'matin', 'Un kilometre et demi d’étals depuis le XVIᵉ siècle, et une brocante le samedi au bout.', 'fr:Naschmarkt'),
    a('cafe', 'Un café viennois', 'relax', 'detente', 48.2100, 16.3680,
      1.5, 12, 'apres-midi', 'Classé par l’Unesco : un mélange, un verre d’eau, et le droit de rester trois heures avec un journal.', 'fr:Café viennois'),
    a('hundertwasser', 'La Hundertwasserhaus', 'offbeat', 'monument', 48.2075, 16.3940,
      1, 0, 'apres-midi', 'Pas un angle droit, deux cent cinquante arbres dans les murs, et un sol volontairement irrégulier.', 'fr:Hundertwasserhaus'),
  ]),
  ...ville('berlin', [
    a('mur', 'L’East Side Gallery', 'culture', 'oeuvre', 52.5050, 13.4400,
      1.5, 0, 'matin', 'Mille trois cent seize mètres de Mur restés debout, peints par cent dix-huit artistes en 1990.', 'fr:East Side Gallery'),
    a('memorial-juifs', 'Le Mémorial aux Juifs assassinés d’Europe', 'culture', 'monument', 52.5139, 13.3789,
      1.5, 0, 'matin', 'Deux mille sept cent onze stèles sur un sol qui s’enfonce, et le lieu d’information en dessous.', 'fr:Mémorial aux Juifs assassinés d’Europe'),
    a('ile-musees', 'L’île aux Musées', 'culture', 'musee', 52.5200, 13.3980,
      4, 24, 'matin', 'Cinq musées, dont Néfertiti au Neues et la porte d’Ishtar au Pergamon.', 'fr:Île aux Musées'),
    a('reichstag', 'La coupole du Reichstag', 'culture', 'panorama', 52.5186, 13.3761,
      1.5, 0, 'apres-midi', 'Une rampe en spirale de Norman Foster au-dessus de l’hémicycle. Gratuit, mais à réserver.', 'fr:Reichstag'),
    a('kreuzberg', 'Kreuzberg et la Spree', 'nightlife', 'marche', 52.4990, 13.4180,
      3.5, 20, 'soir', 'Le quartier turc et punk, ses clubs dans d’anciennes usines, et Görlitzer Park au milieu.', 'fr:Kreuzberg'),
    a('tempelhof', 'L’ancien aéroport de Tempelhof', 'offbeat', 'parc', 52.4730, 13.4030,
      2, 0, 'apres-midi', 'Trois cents hectares de pistes devenus parc public, où l’on fait du vélo sur les taxiways.', 'fr:Aéroport de Berlin-Tempelhof'),
  ]),
  ...ville('amsterdam', [
    a('anne-frank', 'La maison d’Anne Frank', 'culture', 'musee', 52.3752, 4.8840,
      1.5, 16, 'matin', 'L’annexe derrière la bibliothèque pivotante, vide de meubles par volonté du père.', 'fr:Maison d’Anne Frank'),
    a('rijksmuseum', 'Le Rijksmuseum', 'culture', 'musee', 52.3600, 4.8852,
      3.5, 23, 'matin', 'La Ronde de nuit, Vermeer, et huit cents ans de Pays-Bas dans un bâtiment traversé par une piste cyclable.', 'fr:Rijksmuseum'),
    a('van-gogh', 'Le musée Van Gogh', 'culture', 'musee', 52.3584, 4.8811,
      2.5, 22, 'apres-midi', 'Deux cents toiles et cinq cents dessins, dans l’ordre où il les a peints. Créneau obligatoire.', 'fr:Musée Van Gogh'),
    a('canaux', 'Les canaux en bateau électrique', 'relax', 'panorama', 52.3700, 4.8900,
      2, 25, 'apres-midi', 'Cent soixante-cinq canaux classés, et la seule échelle à laquelle la ville se comprend.', 'fr:Canaux d’Amsterdam'),
    a('jordaan', 'Le Jordaan et ses hofjes', 'offbeat', 'monument', 52.3740, 4.8790,
      2.5, 0, 'apres-midi', 'Un quartier ouvrier devenu le plus cher, et des cours d’hospices cachées derrière des portes anonymes.', 'fr:Jordaan'),
    a('velo', 'Amsterdam à vélo', 'adventure', 'sport', 52.3700, 4.8950,
      3, 15, 'matin', 'Huit cent mille vélos pour huit cent mille habitants. Rouler à droite, sonner, et ne jamais s’arrêter sur la piste.', 'fr:Amsterdam'),
  ]),
  ...ville('copenhague', [
    a('nyhavn', 'Nyhavn', 'relax', 'panorama', 55.6797, 12.5910,
      1.5, 0, 'apres-midi', 'Le canal du XVIIᵉ, ses maisons colorées, et la maison d’Andersen au numéro 20.', 'fr:Nyhavn'),
    a('tivoli', 'Les jardins de Tivoli', 'relax', 'parc', 55.6736, 12.5681,
      3.5, 20, 'soir', 'Ouvert en 1843, deuxième plus vieux parc d’attractions du monde, et cent mille lampes le soir.', 'fr:Jardins de Tivoli'),
    a('christiania', 'Christiania', 'offbeat', 'monument', 55.6736, 12.5990,
      2, 0, 'apres-midi', 'Une caserne occupée depuis 1971, devenue quartier libre. On n’y photographie pas les gens.', 'fr:Christiania'),
    a('reffen', 'Reffen, la halle de street food', 'food', 'marche', 55.6950, 12.6030,
      2, 18, 'soir', 'Des conteneurs sur un ancien chantier naval, cinquante cuisines, et le port juste devant.', 'da:Refshaleøen'),
    a('velo-copenhague', 'La ville à vélo', 'adventure', 'sport', 55.6760, 12.5680,
      3, 15, 'matin', 'Trois cent quatre-vingt-dix kilomètres de pistes, des ponts réservés, et plus de vélos que de voitures.', 'en:Cycling in Copenhagen'),
  ]),
  ...ville('reykjavik', [
    a('cercle-or', 'Le Cercle d’or', 'nature', 'nature', 64.3130, -20.3020,
      8, 70, 'journee', 'Þingvellir entre deux plaques, le geyser Strokkur toutes les huit minutes, et Gullfoss.', 'fr:Cercle d’or (Islande)'),
    a('blue-lagoon', 'Le Blue Lagoon', 'relax', 'detente', 63.8804, -22.4495,
      3.5, 65, 'apres-midi', 'De l’eau géothermique à trente-huit degrés dans un champ de lave. À réserver, toujours plein.', 'fr:Blue Lagoon'),
    a('aurores', 'Une chasse aux aurores boréales', 'nature', 'panorama', 64.1000, -21.6000,
      4, 60, 'soir', 'De septembre à avril, loin des lumières. Aucun opérateur sérieux ne les garantit.', 'fr:Aurore polaire'),
    a('baleines', 'L’observation des baleines', 'nature', 'nature', 64.1500, -21.9400,
      3.5, 75, 'matin', 'Depuis le vieux port, dans la baie de Faxaflói : petits rorquals, dauphins, et macareux en été.', 'en:Whale watching in Iceland'),
    a('hallgrimskirkja', 'La tour de Hallgrímskirkja', 'culture', 'panorama', 64.1417, -21.9266,
      1, 8, 'matin', 'Soixante-quatorze mètres de béton dessinés d’après les orgues basaltiques, et les toits colorés en bas.', 'fr:Hallgrímskirkja'),
    a('reykjadalur', 'La rivière chaude de Reykjadalur', 'adventure', 'detente', 64.0300, -21.2100,
      5, 0, 'matin', 'Une heure de montée dans la vallée fumante, puis un bain dans une rivière naturellement à trente-huit degrés.', 'en:Reykjadalur'),
  ]),
  ...ville('stockholm', [
    a('vasa', 'Le musée Vasa', 'culture', 'musee', 59.3280, 18.0915,
      2, 19, 'matin', 'Un navire de guerre de 1628 coulé au bout de mille trois cents mètres, remonté intact en 1961.', 'fr:Musée Vasa'),
    a('gamla-stan', 'Gamla Stan', 'culture', 'monument', 59.3251, 18.0710,
      2.5, 0, 'matin', 'La vieille ville sur son île, ses façades ocre, et Mårten Trotzigs gränd large de quatre-vingt-dix centimètres.', 'fr:Gamla stan'),
    a('archipel', 'L’archipel en bateau', 'nature', 'panorama', 59.3200, 18.1500,
      6, 40, 'journee', 'Trente mille îles. Vaxholm et Grinda se font à la journée depuis le centre.', 'fr:Archipel de Stockholm'),
    a('fotografiska', 'Fotografiska', 'culture', 'musee', 59.3180, 18.0850,
      2, 22, 'apres-midi', 'Une douane de 1906 devenue centre de photographie, et un café au dernier étage face à l’eau.', 'fr:Fotografiska'),
    a('fika', 'Une fika', 'food', 'detente', 59.3320, 18.0640,
      1, 8, 'apres-midi', 'Pas une pause-café : une institution, avec un kanelbulle, et l’obligation de s’asseoir.', 'fr:Fika'),
  ]),
  ...ville('cracovie', [
    a('rynek', 'La grand-place et la halle aux draps', 'culture', 'monument', 50.0616, 19.9373,
      2, 0, 'matin', 'La plus grande place médiévale d’Europe, et le trompettiste qui s’interrompt toutes les heures.', 'fr:Rynek Główny'),
    a('wawel', 'Le château du Wawel', 'culture', 'monument', 50.0540, 19.9354,
      3, 15, 'matin', 'La colline des rois de Pologne, sa cathédrale du couronnement, et la grotte du dragon en dessous.', 'fr:Château du Wawel'),
    a('auschwitz', 'Auschwitz-Birkenau', 'culture', 'monument', 50.0270, 19.2030,
      8, 40, 'journee', 'Une heure et demie de route. On y va avec un guide, et on n’en revient pas comme on est parti.', 'fr:Auschwitz'),
    a('kazimierz', 'Kazimierz', 'offbeat', 'marche', 50.0510, 19.9450,
      3, 0, 'apres-midi', 'L’ancien quartier juif, sept synagogues, et les bars les plus vivants de la ville le soir.', 'fr:Kazimierz'),
    a('wieliczka', 'La mine de sel de Wieliczka', 'offbeat', 'monument', 49.9830, 20.0540,
      4, 30, 'apres-midi', 'Trois cents kilomètres de galeries sur neuf niveaux, et une chapelle entière taillée dans le sel.', 'fr:Mine de sel de Wieliczka'),
  ]),
  ...ville('londres', [
    a('british-museum', 'Le British Museum', 'culture', 'musee', 51.5194, -0.1270,
      3.5, 0, 'matin', 'La pierre de Rosette, les marbres du Parthénon, et l’entrée gratuite depuis 1753.', 'fr:British Museum'),
    a('tower', 'La tour de Londres', 'culture', 'monument', 51.5081, -0.0759,
      3, 34, 'matin', 'Neuf cents ans de forteresse, les joyaux de la Couronne, et les corbeaux qu’on ne laisse pas partir.', 'fr:Tour de Londres'),
    a('borough', 'Le Borough Market', 'food', 'marche', 51.5055, -0.0910,
      1.5, 15, 'matin', 'Un marché alimentaire depuis le XIIᵉ siècle, sous les voûtes du chemin de fer.', 'fr:Borough Market'),
    a('tate-modern', 'La Tate Modern', 'culture', 'musee', 51.5076, -0.0994,
      2.5, 0, 'apres-midi', 'Une centrale électrique de Giles Gilbert Scott, la salle des turbines, et la collection gratuite.', 'fr:Tate Modern'),
    a('westminster', 'Westminster et Big Ben', 'culture', 'monument', 51.5007, -0.1246,
      2, 0, 'matin', 'L’abbaye du couronnement, le palais néogothique, et la cloche de treize tonnes qui donne son nom à la tour.', 'fr:Palais de Westminster'),
    a('camden', 'Camden Market', 'shopping', 'marche', 51.5416, -0.1465,
      2.5, 0, 'apres-midi', 'Mille étals le long du canal, dans les anciennes écuries, et de la friperie à perte de vue.', 'fr:Camden Market'),
    a('west-end', 'Une comédie musicale dans le West End', 'culture', 'spectacle', 51.5120, -0.1300,
      3, 45, 'soir', 'Quarante salles, et des billets du jour à moitié prix au kiosque de Leicester Square.', 'fr:West End'),
  ]),
  ...ville('dublin', [
    a('trinity', 'Le livre de Kells et la Long Room', 'culture', 'musee', 53.3440, -6.2570,
      1.5, 20, 'matin', 'Un évangéliaire enluminé de l’an 800, et une bibliothèque de soixante-cinq mètres au-dessus.', 'fr:Livre de Kells'),
    a('guinness', 'Le Guinness Storehouse', 'food', 'musee', 53.3419, -6.2867,
      2.5, 28, 'apres-midi', 'Sept étages en forme de pinte, et un bar panoramique où l’on apprend à la tirer soi-même.', 'fr:Guinness Storehouse'),
    a('kilmainham', 'La prison de Kilmainham', 'culture', 'musee', 53.3420, -6.3100,
      2, 8, 'matin', 'Là où les chefs de 1916 ont été fusillés. Le récit de l’indépendance, cellule par cellule.', 'fr:Prison de Kilmainham'),
    a('temple-bar', 'Temple Bar et la musique live', 'nightlife', 'marche', 53.3450, -6.2640,
      3, 25, 'soir', 'Très touristique, très cher, et pourtant les sessions de trad y sont vraies, tous les soirs.', 'fr:Temple Bar'),
    a('howth', 'La falaise de Howth', 'nature', 'nature', 53.3750, -6.0650,
      4, 6, 'matin', 'Trente minutes de DART, puis une boucle de six kilomètres au-dessus de la mer d’Irlande.', 'fr:Howth'),
  ]),
  ...ville('edimbourg', [
    a('chateau-edimbourg', 'Le château d’Édimbourg', 'culture', 'monument', 55.9486, -3.1999,
      2.5, 22, 'matin', 'Sur un bouchon volcanique, avec les joyaux d’Écosse et le canon de treize heures.', 'fr:Château d’Édimbourg'),
    a('royal-mile', 'Le Royal Mile et les closes', 'culture', 'monument', 55.9500, -3.1870,
      2.5, 0, 'matin', 'Un mille écossais du château à Holyrood, et des ruelles verticales entre les deux.', 'fr:Royal Mile'),
    a('arthur-seat', 'Arthur’s Seat', 'adventure', 'panorama', 55.9444, -3.1618,
      2.5, 0, 'matin', 'Deux cent cinquante et un mètres de volcan éteint en pleine ville, et une heure de montée.', 'fr:Arthur’s Seat'),
    a('whisky', 'Une dégustation de whisky', 'food', 'detente', 55.9490, -3.1940,
      1.5, 30, 'apres-midi', 'Cinq régions, cinq caractères, et de quoi comprendre pourquoi l’Islay ne plaît pas à tout le monde.', 'fr:Scotch whisky'),
    a('dean-village', 'Dean Village et le Water of Leith', 'offbeat', 'monument', 55.9520, -3.2180,
      2, 0, 'apres-midi', 'Un hameau de meuniers du XIIᵉ dans un ravin, à dix minutes de Princes Street.', 'en:Dean Village'),
  ]),
  // ------------------------------------------------------------------ Grèce, Turquie, Balkans
  ...ville('athenes', [
    a('acropole', 'L’Acropole et le Parthénon', 'culture', 'monument', 37.9715, 23.7267,
      3, 20, 'matin', 'À l’ouverture, à huit heures, avant que le marbre ne devienne blanc et brûlant.', 'fr:Acropole d’Athènes'),
    a('musee-acropole', 'Le musée de l’Acropole', 'culture', 'musee', 37.9685, 23.7286,
      2.5, 10, 'apres-midi', 'Une frise reconstituée à l’échelle et dans l’axe, avec les trous là où Londres garde les morceaux.', 'fr:Musée de l’Acropole'),
    a('plaka', 'Plaka et Anafiotika', 'offbeat', 'monument', 37.9720, 23.7300,
      2, 0, 'apres-midi', 'Au pied du rocher, un hameau cycladique bâti par des maçons de Naxos venus en 1840.', 'fr:Anafiotika'),
    a('lycabette', 'La colline du Lycabette', 'relax', 'panorama', 37.9820, 23.7430,
      2, 8, 'soir', 'Deux cent soixante-dix-sept mètres, un funiculaire, et l’Acropole éclairée en dessous.', 'fr:Lycabette'),
    a('marche-central-athenes', 'Le marché de Varvakios', 'food', 'marche', 37.9820, 23.7260,
      1.5, 10, 'matin', 'Les bouchers et les poissonniers de la ville depuis 1886, et des tavernes ouvertes toute la nuit.', 'el:Βαρβάκειος Αγορά'),
    a('sounion', 'Le cap Sounion au coucher du soleil', 'culture', 'panorama', 37.6503, 24.0245,
      5, 30, 'soir', 'Le temple de Poséidon sur une falaise de soixante mètres, et la signature de Byron sur une colonne.', 'fr:Cap Sounion'),
  ]),
  ...ville('santorin', [
    a('oia', 'Le coucher du soleil à Oia', 'relax', 'panorama', 36.4618, 25.3753,
      2, 0, 'soir', 'Le plus regardé de Grèce. Arriver une heure avant, ou le regarder depuis Imerovigli, plus calme.', 'fr:Oia'),
    a('caldeira', 'La caldeira en catamaran', 'nature', 'panorama', 36.4000, 25.4000,
      6, 90, 'apres-midi', 'Les sources chaudes de Palea Kameni, la plage rouge, et l’île vue depuis l’eau.', 'fr:Santorin'),
    a('akrotiri', 'Le site minoen d’Akrotiri', 'culture', 'monument', 36.3514, 25.4036,
      2, 12, 'matin', 'Une ville de l’âge du bronze ensevelie par l’éruption, avec ses rues et ses étages debout.', 'fr:Akrotiri (Santorin)'),
    a('sentier-fira-oia', 'Le sentier de Fira à Oia', 'adventure', 'nature', 36.4200, 25.4300,
      4, 0, 'matin', 'Dix kilomètres sur le bord de la caldeira, trois heures et demie, et aucune ombre.', 'fr:Santorin'),
    a('vin', 'Les vins d’assyrtiko', 'food', 'detente', 36.3800, 25.4400,
      3, 40, 'apres-midi', 'Des vignes taillées en corbeille contre le vent, sur cendre volcanique, et un blanc très sec.', 'fr:Assyrtiko'),
  ]),
  ...ville('istanbul', [
    a('sainte-sophie', 'Sainte-Sophie', 'culture', 'monument', 41.0086, 28.9802,
      2, 25, 'matin', 'Mille cinq cents ans, basilique puis mosquée puis musée puis mosquée, et une coupole de trente et un mètres.', 'fr:Sainte-Sophie (Istanbul)'),
    a('topkapi', 'Le palais de Topkapı', 'culture', 'musee', 41.0115, 28.9834,
      3.5, 30, 'matin', 'Quatre cours, le harem en supplément, et le trésor ottoman au fond.', 'fr:Palais de Topkapı'),
    a('bazar', 'Le Grand Bazar et le bazar aux épices', 'shopping', 'marche', 41.0106, 28.9680,
      3, 0, 'apres-midi', 'Quatre mille boutiques sous soixante rues couvertes, ouvertes depuis 1461.', 'fr:Grand Bazar d’Istanbul'),
    a('bosphore', 'Le Bosphore en bateau', 'relax', 'panorama', 41.0200, 29.0000,
      3, 8, 'apres-midi', 'Le ferry public jusqu’à Anadolu Kavağı : deux continents, des yalı en bois, et le prix d’un ticket.', 'fr:Bosphore'),
    a('hammam', 'Un hammam ottoman', 'relax', 'detente', 41.0090, 28.9790,
      2, 45, 'apres-midi', 'Le göbektaşı chauffé, le gommage au kese, et un bâtiment de Sinan pour certains.', 'fr:Hammam'),
    a('citerne', 'La citerne Basilique', 'offbeat', 'monument', 41.0084, 28.9779,
      1, 25, 'matin', 'Trois cent trente-six colonnes sous la ville, deux têtes de Méduse au fond, et de l’eau jusqu’aux chevilles.', 'fr:Citerne Basilique'),
    a('balat', 'Balat et Fener', 'offbeat', 'marche', 41.0290, 28.9490,
      2.5, 0, 'apres-midi', 'Les anciens quartiers juif et grec, leurs maisons de bois colorées et leurs cafés en pente.', 'tr:Balat, Fatih'),
  ]),
  ...ville('cappadoce', [
    a('montgolfiere', 'Un vol en montgolfière au lever du jour', 'adventure', 'panorama', 38.6431, 34.8289,
      4, 180, 'matin', 'Cent cinquante ballons décollent ensemble à l’aube au-dessus des cheminées de fée. Annulé si le vent se lève.', 'fr:Cappadoce'),
    a('goreme', 'Le musée en plein air de Göreme', 'culture', 'monument', 38.6425, 34.8450,
      2.5, 20, 'matin', 'Une dizaine d’églises rupestres des Xᵉ et XIᵉ siècles, avec leurs fresques byzantines intactes.', 'fr:Göreme'),
    a('derinkuyu', 'La cité souterraine de Derinkuyu', 'offbeat', 'monument', 38.3736, 34.7344,
      2, 15, 'apres-midi', 'Dix-huit niveaux, quatre-vingt-cinq mètres de profondeur, et vingt mille personnes qui s’y cachaient.', 'fr:Derinkuyu'),
    a('vallee-amour', 'La vallée de l’Amour à pied', 'nature', 'nature', 38.6600, 34.8200,
      3, 0, 'apres-midi', 'Six kilomètres entre des colonnes de tuf de quarante mètres, sans balisage et sans monde.', 'fr:Cappadoce'),
    a('ihlara', 'La vallée d’Ihlara', 'adventure', 'nature', 38.2500, 34.3000,
      5, 12, 'journee', 'Quatorze kilomètres de canyon au fond duquel coule une rivière, avec des églises taillées dans la paroi.', 'fr:Vallée d’Ihlara'),
  ]),
  ...ville('dubrovnik', [
    a('remparts', 'Le tour des remparts', 'culture', 'monument', 42.6414, 18.1080,
      2.5, 35, 'matin', 'Mille neuf cent quarante mètres de chemin de ronde, vingt-cinq mètres de haut, et aucune ombre.', 'fr:Remparts de Dubrovnik'),
    a('srd', 'Le mont Srđ par le téléphérique', 'relax', 'panorama', 42.6470, 18.1100,
      2, 27, 'soir', 'Quatre cent douze mètres, la vieille ville en entier, et les îles Élaphites derrière.', 'hr:Srđ'),
    a('lokrum', 'L’île de Lokrum', 'nature', 'nature', 42.6270, 18.1190,
      4, 27, 'apres-midi', 'Dix minutes de bateau : un monastère bénédictin, des paons en liberté et une mer morte salée.', 'fr:Lokrum'),
    a('kayak', 'Kayak au pied des remparts', 'adventure', 'sport', 42.6390, 18.1050,
      3, 45, 'soir', 'Le tour de la vieille ville et de Lokrum par la mer, avec une grotte et un arrêt baignade.', 'fr:Dubrovnik'),
  ]),
  ...ville('split', [
    a('diocletien', 'Le palais de Dioclétien', 'culture', 'monument', 43.5081, 16.4402,
      2.5, 0, 'matin', 'Pas un musée : trois mille personnes vivent dans un palais romain de 305, et il y a des bars dedans.', 'fr:Palais de Dioclétien'),
    a('marjan', 'La colline de Marjan', 'relax', 'panorama', 43.5080, 16.4180,
      2.5, 0, 'matin', 'Trois cent mètres de pinède au-dessus de la ville, avec des ermitages dans la falaise.', 'hr:Marjan'),
    a('krka', 'Les chutes de Krka', 'nature', 'nature', 43.8000, 15.9700,
      7, 45, 'journee', 'Dix-sept cascades en escalier dans un parc national, à une heure de route.', 'fr:Parc national de Krka'),
    a('hvar', 'L’île de Hvar', 'relax', 'plage', 43.1729, 16.4413,
      9, 40, 'journee', 'Une heure de catamaran, une forteresse vénitienne, des champs de lavande et les Pakleni en face.', 'fr:Hvar'),
  ]),
  // ------------------------------------------------------------------ Maghreb, Moyen-Orient
  ...ville('marrakech', [
    a('jemaa', 'La place Jemaa el-Fna à la nuit tombée', 'culture', 'marche', 31.6258, -7.9891,
      3, 10, 'soir', 'Classée par l’Unesco au titre du patrimoine immatériel : conteurs, gnaouas, et cent cuisines qui s’installent à dix-huit heures.', 'fr:Jemaa el-Fna'),
    a('bahia', 'Le palais de la Bahia', 'culture', 'monument', 31.6216, -7.9833,
      1.5, 7, 'matin', 'Cent cinquante pièces, huit hectares, et des plafonds de cèdre peint qui ont pris deux siècles.', 'fr:Palais de la Bahia'),
    a('majorelle', 'Le jardin Majorelle et le musée YSL', 'relax', 'parc', 31.6415, -8.0030,
      2.5, 22, 'matin', 'Un bleu déposé, trois cents espèces de cactus, et le musée d’Yves Saint Laurent à côté.', 'fr:Jardin Majorelle'),
    a('souks', 'Les souks de la médina', 'shopping', 'marche', 31.6300, -7.9870,
      3, 0, 'apres-midi', 'Dix-huit souks par corporation. On y marchande, et on s’y perd — c’est prévu ainsi.', 'fr:Médina de Marrakech'),
    a('atlas', 'La vallée de l’Ourika dans l’Atlas', 'nature', 'nature', 31.2200, -7.7800,
      8, 40, 'journee', 'Une heure de route, des villages berbères accrochés, et sept cascades au bout du sentier.', 'fr:Ourika'),
    a('hammam-marrakech', 'Un hammam traditionnel', 'relax', 'detente', 31.6280, -7.9880,
      2, 30, 'apres-midi', 'Savon noir, gant de crin, et rhassoul. Le hammam de quartier coûte deux euros, et c’est le vrai.', 'fr:Hammam'),
    a('agafay', 'Une nuit dans le désert d’Agafay', 'adventure', 'nature', 31.4100, -8.1500,
      18, 90, 'soir', 'Un désert de pierre à quarante minutes, sans dune mais avec un ciel noir et l’Atlas en fond.', 'fr:Désert d’Agafay'),
  ]),
  ...ville('fes', [
    a('medina-fes', 'La médina de Fès el-Bali', 'culture', 'monument', 34.0650, -4.9730,
      4, 0, 'matin', 'Neuf mille ruelles, la plus grande zone piétonne du monde, et un guide vraiment utile ici.', 'fr:Fès el-Bali'),
    a('tanneries', 'Les tanneries Chouara', 'offbeat', 'monument', 34.0663, -4.9689,
      1.5, 5, 'matin', 'Des cuves de teinture en activité depuis le XIᵉ siècle. On vous tend de la menthe, prenez-la.', 'fr:Tannerie Chouara'),
    a('qarawiyyin', 'La Qarawiyyin et la médersa Bou Inania', 'culture', 'monument', 34.0648, -4.9736,
      2, 5, 'matin', 'La plus ancienne université encore en activité au monde, fondée en 859 par Fatima al-Fihriya.', 'fr:Université Al Quaraouiyine'),
    a('poterie', 'Les ateliers de zellige', 'culture', 'boutique', 34.0500, -4.9600,
      2, 8, 'apres-midi', 'Le carreau taillé à la main au marteau, pièce par pièce, avant d’être assemblé à l’envers.', 'fr:Zellige'),
  ]),
  ...ville('le-caire', [
    a('pyramides', 'Les pyramides de Gizeh et le Sphinx', 'culture', 'monument', 29.9792, 31.1342,
      5, 30, 'matin', 'Quatre mille cinq cents ans, la seule des sept merveilles encore debout, et le plateau ouvert à huit heures.', 'fr:Pyramides de Gizeh'),
    a('musee-egyptien', 'Le Grand Musée égyptien', 'culture', 'musee', 29.9930, 31.1190,
      4, 30, 'matin', 'Cent mille pièces, dont le trésor de Toutânkhamon au complet pour la première fois.', 'fr:Grand Musée égyptien'),
    a('khan-khalili', 'Le souk de Khan el-Khalili', 'shopping', 'marche', 30.0477, 31.2622,
      2.5, 0, 'apres-midi', 'Un bazar de 1382, et le café El Fishawy ouvert sans interruption depuis deux siècles.', 'fr:Khan el-Khalili'),
    a('citadelle', 'La citadelle et la mosquée d’albâtre', 'culture', 'monument', 30.0287, 31.2599,
      2.5, 10, 'apres-midi', 'Saladin l’a bâtie en 1176 ; Méhémet Ali y a posé une mosquée ottomane, et la ville est en dessous.', 'fr:Citadelle du Caire'),
    a('saqqarah', 'Saqqarah et Memphis', 'culture', 'monument', 29.8710, 31.2160,
      5, 35, 'journee', 'La pyramide à degrés de Djéser, première construction en pierre de taille de l’histoire.', 'fr:Saqqarah'),
  ]),
  ...ville('dubai', [
    a('burj-khalifa', 'Le Burj Khalifa', 'relax', 'panorama', 25.1972, 55.2744,
      2, 45, 'soir', 'Huit cent vingt-huit mètres, le 124ᵉ étage en une minute, et le désert d’un côté, le Golfe de l’autre.', 'fr:Burj Khalifa'),
    a('desert-safari', 'Un safari dans le désert', 'adventure', 'nature', 24.8000, 55.6000,
      6, 65, 'apres-midi', 'Dune bashing en 4×4, sandboard, et un dîner sous tente dans la réserve de Dubaï.', 'en:Dubai Desert Conservation Reserve'),
    a('vieux-dubai', 'Le vieux Dubaï et la crique', 'culture', 'monument', 25.2650, 55.2970,
      3, 5, 'matin', 'Al Fahidi et ses tours à vent, la traversée en abra pour vingt centimes, et les souks de l’or et des épices.', 'en:Al Fahidi Historical Neighbourhood'),
    a('mosquee-jumeirah', 'La mosquée de Jumeirah', 'culture', 'monument', 25.2330, 55.2650,
      1.5, 20, 'matin', 'L’une des rares ouvertes aux non-musulmans, avec une visite guidée qui répond à toutes les questions.', 'en:Jumeirah Mosque'),
    a('marina', 'La Marina et JBR', 'relax', 'panorama', 25.0800, 55.1400,
      3, 0, 'soir', 'Un canal artificiel de trois kilomètres, une promenade, et une plage publique au bout.', 'en:Dubai Marina'),
  ]),
  ...ville('petra', [
    a('siq-khazneh', 'Le Siq et le Trésor', 'culture', 'monument', 30.3222, 35.4519,
      5, 65, 'matin', 'Un kilomètre deux cents dans une faille de deux cents mètres de haut, et la façade au bout.', 'fr:Pétra'),
    a('monastere', 'Le Monastère (Ad-Deir)', 'adventure', 'monument', 30.3350, 35.4320,
      4, 0, 'matin', 'Huit cent marches taillées dans le roc, et une façade de cinquante mètres tout en haut.', 'en:Ad Deir'),
    a('petra-nuit', 'Petra by Night', 'offbeat', 'spectacle', 30.3222, 35.4519,
      2, 22, 'soir', 'Mille cinq cents bougies dans le Siq, trois soirs par semaine, et de la musique bédouine devant le Trésor.', 'fr:Pétra'),
    a('wadi-rum-excursion', 'Le Wadi Rum en 4×4', 'adventure', 'nature', 29.5765, 35.4200,
      8, 70, 'journee', 'Le désert de Lawrence : du grès rouge, des arches naturelles, et une nuit sous tente si l’on veut.', 'fr:Wadi Rum'),
  ]),
  // ------------------------------------------------------------------ Afrique subsaharienne et océan Indien
  ...ville('le-cap', [
    a('table-mountain', 'La Montagne de la Table', 'nature', 'panorama', -33.9628, 18.4098,
      3.5, 25, 'matin', 'Un téléphérique à cabine rotative, mille quatre-vingt-six mètres, et la nappe de nuages quand le vent tourne.', 'fr:Montagne de la Table'),
    a('robben', 'L’île de Robben', 'culture', 'musee', -33.8067, 18.3667,
      4, 35, 'matin', 'La cellule de Mandela, et des guides qui y ont été détenus. À réserver longtemps à l’avance.', 'fr:Robben Island'),
    a('cap-bonne-esperance', 'Le cap de Bonne-Espérance', 'nature', 'panorama', -34.3568, 18.4740,
      7, 45, 'journee', 'Chapman’s Peak Drive, les manchots de Boulders Beach, et la pointe du parc national.', 'fr:Cap de Bonne-Espérance'),
    a('bo-kaap', 'Le Bo-Kaap', 'offbeat', 'monument', -33.9200, 18.4150,
      1.5, 0, 'matin', 'Des maisons peintes par les affranchis malais au moment de l’abolition, et le plus vieux minaret du pays.', 'fr:Bo-Kaap'),
    a('winelands', 'Stellenbosch et Franschhoek', 'food', 'nature', -33.9320, 18.8600,
      8, 70, 'journee', 'Des domaines du XVIIᵉ fondés par les huguenots, et un tram-train qui passe de cave en cave.', 'fr:Stellenbosch'),
    a('lion-head', 'Lion’s Head au lever du soleil', 'adventure', 'panorama', -33.9356, 18.3890,
      3, 0, 'matin', 'Une spirale autour du piton, des échelles à la fin, et la ville qui s’allume en dessous.', 'en:Lion’s Head (Cape Town)'),
  ]),
  ...ville('zanzibar', [
    a('stone-town', 'Stone Town', 'culture', 'monument', -6.1622, 39.1892,
      3, 0, 'matin', 'Un labyrinthe swahili classé, ses portes sculptées, et la maison des Merveilles en restauration.', 'fr:Stone Town'),
    a('epices', 'Une plantation d’épices', 'food', 'nature', -6.1200, 39.2500,
      4, 25, 'matin', 'Girofle, cannelle, muscade et ylang-ylang, sur pied, avec tout ce qui a fait la fortune de l’île.', 'fr:Zanzibar'),
    a('nungwi', 'Les plages du nord, Nungwi et Kendwa', 'relax', 'plage', -5.7260, 39.2960,
      6, 5, 'journee', 'Les seules plages de l’île où la marée ne vide pas le lagon deux fois par jour.', 'en:Nungwi'),
    a('mnemba', 'Snorkeling à l’atoll de Mnemba', 'nature', 'plage', -5.8170, 39.3830,
      5, 45, 'matin', 'Une réserve marine, des dauphins de passage et six cents espèces de poissons.', 'en:Mnemba Island'),
    a('jozani', 'La forêt de Jozani', 'nature', 'nature', -6.2500, 39.4167,
      3, 15, 'apres-midi', 'Les colobes roux de Zanzibar, endémiques, deux mille cinq cents au monde, et tous ici.', 'en:Jozani Chwaka Bay National Park'),
  ]),
  ...ville('la-reunion', [
    a('piton-fournaise', 'Le piton de la Fournaise', 'adventure', 'nature', -21.2440, 55.7080,
      8, 0, 'matin', 'Cinq heures aller-retour dans l’Enclos, sur la lave, jusqu’au cratère Dolomieu.', 'fr:Piton de la Fournaise'),
    a('mafate', 'Le cirque de Mafate', 'adventure', 'nature', -21.0500, 55.4200,
      10, 0, 'journee', 'Aucune route n’y mène. On y entre à pied par le Maïdo ou le col des Bœufs, et on y dort en gîte.', 'fr:Cirque de Mafate'),
    a('trou-fer', 'Le Trou de Fer en hélicoptère', 'nature', 'panorama', -21.0530, 55.5300,
      1, 220, 'matin', 'Trois cents mètres de chute dans une forêt primaire, invisible autrement. Quarante-cinq minutes de vol.', 'fr:Trou de Fer'),
    a('salazie', 'Hell-Bourg et le cirque de Salazie', 'culture', 'monument', -21.0640, 55.5200,
      5, 0, 'journee', 'Un des plus beaux villages de France, ses cases créoles et le voile de la Mariée en chemin.', 'fr:Hell-Bourg'),
    a('lagon', 'Le lagon de l’Ermitage', 'relax', 'plage', -21.0800, 55.2200,
      4, 0, 'apres-midi', 'Le seul vrai lagon de l’île, protégé par la barrière, avec des filaos pour l’ombre.', 'fr:L’Hermitage-les-Bains'),
  ]),
  ...ville('maurice', [
    a('morne', 'Le Morne Brabant', 'adventure', 'panorama', -20.4500, 57.3200,
      4, 30, 'matin', 'Cinq cent cinquante-six mètres, un refuge d’esclaves marrons classé, et le lagon des deux côtés.', 'fr:Morne Brabant'),
    a('chamarel', 'La terre des sept couleurs et la cascade', 'nature', 'nature', -20.4400, 57.3800,
      3, 12, 'matin', 'Des dunes de latérite qui ne se mélangent pas, et une chute de quatre-vingt-trois mètres à côté.', 'fr:Terre des sept couleurs'),
    a('ile-aux-cerfs', 'L’île aux Cerfs', 'relax', 'plage', -20.2700, 57.8000,
      6, 40, 'journee', 'Un banc de sable au large de l’est, et la cascade de la Grande Rivière Sud-Est sur le trajet.', 'fr:Île aux Cerfs'),
    a('pamplemousses', 'Le jardin de Pamplemousses', 'nature', 'parc', -20.1050, 57.5800,
      2.5, 10, 'matin', 'Fondé en 1770, quatre-vingt-cinq espèces de palmiers, et les nénuphars géants d’Amazonie.', 'fr:Jardin botanique de Pamplemousses'),
    a('port-louis', 'Le marché central de Port-Louis', 'food', 'marche', -20.1620, 57.5000,
      2, 8, 'matin', 'Le dholl puri, les fruits confits, et le creole de l’île tel qu’on l’entend vraiment.', 'fr:Port-Louis (Maurice)'),
  ]),
  ...ville('nairobi-masai-mara', [
    a('safari-mara', 'Un safari dans le Masai Mara', 'nature', 'nature', -1.4061, 35.0080,
      48, 450, 'journee', 'Les cinq grands, et de juillet à octobre la traversée de la Mara par un million et demi de gnous.', 'fr:Réserve nationale du Masai Mara'),
    a('nairobi-park', 'Le parc national de Nairobi', 'nature', 'nature', -1.3733, 36.8583,
      5, 40, 'matin', 'Des rhinocéros noirs devant la skyline : le seul parc animalier au bord d’une capitale.', 'fr:Parc national de Nairobi'),
    a('elephants', 'Le refuge d’éléphanteaux Sheldrick', 'nature', 'nature', -1.3750, 36.7500,
      2, 15, 'matin', 'Une heure par jour, à onze heures : les orphelins reçoivent leur biberon devant le public.', 'en:Sheldrick Wildlife Trust'),
    a('giraffe-centre', 'Le Giraffe Centre', 'nature', 'nature', -1.3750, 36.7440,
      1.5, 12, 'apres-midi', 'Des girafes de Rothschild à hauteur de plateforme, dans un programme de réintroduction.', 'en:Giraffe Centre'),
  ]),
  // ------------------------------------------------------------------ Amérique du Nord
  ...ville('new-york', [
    a('central-park', 'Central Park', 'relax', 'parc', 40.7829, -73.9654,
      3, 0, 'matin', 'Trois cent quarante et un hectares entièrement dessinés, et le Bethesda Terrace au milieu.', 'fr:Central Park'),
    a('met', 'Le Metropolitan Museum', 'culture', 'musee', 40.7794, -73.9632,
      4, 28, 'matin', 'Deux millions d’œuvres, un temple égyptien entier, et un toit-terrasse sur le parc en été.', 'fr:Metropolitan Museum of Art'),
    a('high-line', 'La High Line', 'offbeat', 'parc', 40.7480, -74.0048,
      1.5, 0, 'apres-midi', 'Deux kilomètres de voie ferrée aérienne devenus jardin, de Gansevoort à Hudson Yards.', 'fr:High Line'),
    a('memorial-911', 'Le mémorial et le musée du 11-Septembre', 'culture', 'musee', 40.7115, -74.0134,
      3, 30, 'matin', 'Deux bassins à l’emplacement exact des tours, et le musée sept étages sous terre.', 'fr:Mémorial du 11-Septembre'),
    a('brooklyn-bridge', 'Le pont de Brooklyn à pied', 'relax', 'panorama', 40.7061, -73.9969,
      2, 0, 'soir', 'Mille huit cent vingt-cinq mètres sur la passerelle en bois, et Manhattan derrière soi au retour.', 'fr:Pont de Brooklyn'),
    a('jazz', 'Un club de jazz au Village', 'nightlife', 'spectacle', 40.7350, -74.0020,
      3, 40, 'soir', 'Le Village Vanguard depuis 1935, quatre-vingt-dix places, et deux sets par soir.', 'en:Village Vanguard'),
    a('moma', 'Le MoMA', 'culture', 'musee', 40.7614, -73.9776,
      3, 28, 'apres-midi', 'La Nuit étoilée, les Demoiselles d’Avignon, et la soupe Campbell, dans le même bâtiment.', 'fr:Museum of Modern Art'),
  ]),
  ...ville('san-francisco', [
    a('golden-gate', 'Le Golden Gate à vélo', 'adventure', 'sport', 37.8199, -122.4783,
      4, 35, 'matin', 'Du Fisherman’s Wharf à Sausalito par le pont, et le ferry pour rentrer.', 'fr:Golden Gate Bridge'),
    a('alcatraz', 'Alcatraz', 'culture', 'musee', 37.8270, -122.4230,
      3.5, 42, 'matin', 'L’audioguide raconté par d’anciens détenus et gardiens. À réserver des semaines à l’avance.', 'fr:Alcatraz'),
    a('cable-car', 'Le cable car de Powell-Hyde', 'offbeat', 'panorama', 37.7950, -122.4200,
      1, 8, 'apres-midi', 'Un funiculaire à câble de 1873, toujours en service, et Lombard Street au passage.', 'fr:Cable car de San Francisco'),
    a('mission', 'Les fresques de Mission District', 'offbeat', 'oeuvre', 37.7540, -122.4180,
      2.5, 0, 'apres-midi', 'Balmy Alley et Clarion Alley : quarante ans de muralisme chicano sur deux ruelles.', 'en:Mission District, San Francisco'),
    a('muir-woods', 'Les séquoias de Muir Woods', 'nature', 'nature', 37.8920, -122.5720,
      5, 40, 'journee', 'Des arbres de soixante-dix-huit mètres et mille ans, à trente minutes du Golden Gate. Réservation obligatoire.', 'fr:Muir Woods National Monument'),
    a('ferry-building', 'Le Ferry Building Marketplace', 'food', 'marche', 37.7955, -122.3937,
      2, 20, 'matin', 'Un marché fermier le samedi sous une halle de 1898, avec la baie derrière.', 'en:San Francisco Ferry Building'),
  ]),
  ...ville('los-angeles', [
    a('getty', 'Le Getty Center', 'culture', 'musee', 34.0780, -118.4741,
      3.5, 0, 'apres-midi', 'Un travertin de Richard Meier sur une colline, un jardin de Robert Irwin, et l’entrée gratuite.', 'fr:Getty Center'),
    a('griffith', 'L’observatoire Griffith', 'relax', 'panorama', 34.1184, -118.3004,
      2.5, 0, 'soir', 'Le panneau Hollywood d’un côté, le bassin de Los Angeles de l’autre, et un télescope ouvert au public.', 'fr:Observatoire Griffith'),
    a('venice', 'Venice Beach et Santa Monica', 'relax', 'plage', 33.9850, -118.4695,
      3.5, 0, 'apres-midi', 'La promenade, Muscle Beach, le skatepark, et la jetée de Santa Monica au bout.', 'fr:Venice (Los Angeles)'),
    a('broad', 'Le Broad', 'culture', 'musee', 34.0546, -118.2500,
      2, 0, 'matin', 'Deux mille œuvres contemporaines, gratuit, dans un « voile » de béton perforé. Réserver le créneau.', 'en:The Broad'),
    a('universal', 'Universal Studios Hollywood', 'relax', 'parc', 34.1381, -118.3534,
      8, 105, 'journee', 'Le studio tour sur le backlot, qui est le vrai intérêt, et le reste est un parc.', 'fr:Universal Studios Hollywood'),
  ]),
  ...ville('montreal', [
    a('vieux-montreal', 'Le Vieux-Montréal', 'culture', 'monument', 45.5070, -73.5540,
      2.5, 0, 'matin', 'Des pavés, la place Jacques-Cartier, et la basilique Notre-Dame et son intérieur bleu nuit.', 'fr:Vieux-Montréal'),
    a('mont-royal', 'Le mont Royal', 'relax', 'panorama', 45.5040, -73.5870,
      2.5, 0, 'apres-midi', 'Un parc d’Olmsted, le belvédère Kondiaronk, et les tam-tams au pied le dimanche.', 'fr:Mont Royal'),
    a('jean-talon', 'Le marché Jean-Talon', 'food', 'marche', 45.5360, -73.6150,
      2, 15, 'matin', 'Le plus grand marché public à ciel ouvert d’Amérique du Nord, et les produits du Québec en saison.', 'fr:Marché Jean-Talon'),
    a('mile-end', 'Le Mile End et ses bagels', 'food', 'marche', 45.5230, -73.6000,
      2.5, 10, 'matin', 'Cuits au four à bois, plus petits et plus sucrés qu’à New York, et c’est un vrai débat.', 'fr:Bagel de Montréal'),
    a('souterraine', 'La ville souterraine', 'offbeat', 'monument', 45.5010, -73.5700,
      2, 0, 'apres-midi', 'Trente-trois kilomètres de galeries reliant dix stations de métro. Indispensable en février.', 'fr:Ville souterraine de Montréal'),
  ]),
  ...ville('mexico', [
    a('teotihuacan', 'Teotihuacán', 'culture', 'monument', 19.6925, -98.8438,
      6, 40, 'matin', 'La pyramide du Soleil, l’allée des Morts, et une cité de cent mille habitants abandonnée avant les Aztèques.', 'fr:Teotihuacan'),
    a('anthropologie', 'Le musée national d’anthropologie', 'culture', 'musee', 19.4260, -99.1863,
      4, 5, 'matin', 'La pierre du Soleil, les Olmèques, les Mayas : le meilleur musée d’Amérique latine, sans discussion.', 'fr:Musée national d’anthropologie de Mexico'),
    a('frida', 'La Casa Azul de Frida Kahlo', 'culture', 'musee', 19.3550, -99.1624,
      2, 15, 'matin', 'Sa maison à Coyoacán, son atelier laissé en l’état, et ses corsets peints. Réservation obligatoire.', 'fr:Musée Frida Kahlo'),
    a('xochimilco', 'Les trajineras de Xochimilco', 'offbeat', 'panorama', 19.2600, -99.1050,
      4, 25, 'apres-midi', 'Ce qui reste des chinampas aztèques : des canaux, des barques peintes, et des mariachis qui montent à bord.', 'fr:Xochimilco'),
    a('zocalo', 'Le Zócalo et le Templo Mayor', 'culture', 'monument', 19.4326, -99.1332,
      3, 8, 'apres-midi', 'La cathédrale qui s’enfonce, et le grand temple aztèque retrouvé sous la rue en 1978.', 'fr:Templo Mayor'),
    a('lucha', 'Une soirée de lucha libre', 'offbeat', 'spectacle', 19.4300, -99.1500,
      3, 20, 'soir', 'À l’Arena México, le vendredi. Des masques, des voltiges, et un public qui fait la moitié du spectacle.', 'fr:Lucha libre'),
  ]),
  // ------------------------------------------------------------------ Amérique du Sud et Caraïbes
  ...ville('rio-de-janeiro', [
    a('corcovado', 'Le Christ Rédempteur', 'culture', 'monument', -22.9519, -43.2105,
      3.5, 30, 'matin', 'Trente-huit mètres au sommet du Corcovado, par le train de la forêt de Tijuca.', 'fr:Christ Rédempteur'),
    a('pain-de-sucre', 'Le Pain de Sucre', 'relax', 'panorama', -22.9486, -43.1566,
      3, 25, 'soir', 'Deux téléphériques, trois cent quatre-vingt-seize mètres, et la baie qui s’allume pendant la descente.', 'fr:Pain de Sucre'),
    a('copacabana', 'Copacabana et Ipanema', 'relax', 'plage', -22.9711, -43.1822,
      4, 0, 'apres-midi', 'Huit kilomètres de sable, le pavement de Burle Marx, et le coucher du soleil applaudi à Arpoador.', 'fr:Copacabana'),
    a('santa-teresa', 'Santa Teresa et l’escalier Selarón', 'offbeat', 'oeuvre', -22.9150, -43.1790,
      3, 0, 'apres-midi', 'Deux cent quinze marches couvertes de deux mille carreaux venus de soixante pays, et un quartier d’ateliers.', 'fr:Escadaria Selarón'),
    a('tijuca', 'La forêt de Tijuca', 'nature', 'nature', -22.9500, -43.2800,
      5, 0, 'matin', 'La plus grande forêt urbaine du monde, replantée à la main à partir de 1861 pour sauver l’eau de la ville.', 'fr:Parc national de Tijuca'),
    a('samba', 'Une roda de samba à Lapa', 'nightlife', 'spectacle', -22.9130, -43.1790,
      4, 20, 'soir', 'Sous les arches de l’aqueduc, le vendredi : des musiciens en cercle et la rue qui danse autour.', 'fr:Lapa (Rio de Janeiro)'),
  ]),
  ...ville('cusco', [
    a('machu-picchu', 'Le Machu Picchu', 'culture', 'monument', -13.1631, -72.5450,
      14, 200, 'journee', 'Train jusqu’à Aguas Calientes, bus jusqu’au site, et un créneau horaire strict à l’entrée.', 'fr:Machu Picchu'),
    a('vallee-sacree', 'La Vallée sacrée', 'culture', 'monument', -13.3200, -72.0800,
      9, 60, 'journee', 'Pisac et son marché, les salines de Maras, les terrasses circulaires de Moray, Ollantaytambo.', 'fr:Vallée sacrée des Incas'),
    a('sacsayhuaman', 'Sacsayhuamán', 'culture', 'monument', -13.5090, -71.9820,
      2.5, 18, 'matin', 'Des blocs de cent tonnes ajustés sans mortier au point qu’une lame n’y passe pas.', 'fr:Sacsayhuamán'),
    a('rainbow', 'La montagne aux sept couleurs', 'adventure', 'panorama', -13.8690, -71.3030,
      10, 45, 'journee', 'Cinq mille deux cents mètres. Ne s’envisage qu’après trois jours d’acclimatation à Cusco.', 'fr:Vinicunca'),
    a('san-pedro', 'Le marché San Pedro', 'food', 'marche', -13.5200, -71.9820,
      1.5, 6, 'matin', 'Des jus au comptoir, cent variétés de pommes de terre, et les herbes des curanderos au fond.', 'es:Mercado Central de San Pedro'),
  ]),
  ...ville('buenos-aires', [
    a('recoleta', 'Le cimetière de la Recoleta', 'culture', 'monument', -34.5875, -58.3936,
      2, 12, 'matin', 'Quatre mille six cent quatre-vingt-onze caveaux comme une ville miniature, dont celui d’Eva Perón.', 'fr:Cimetière de la Recoleta'),
    a('tango', 'Une milonga', 'culture', 'spectacle', -34.6100, -58.3800,
      4, 25, 'soir', 'Pas un dîner-spectacle : un bal où les gens du quartier dansent, et où l’on peut prendre un cours avant.', 'fr:Milonga (danse)'),
    a('caminito', 'La Boca et Caminito', 'offbeat', 'oeuvre', -34.6395, -58.3626,
      2, 0, 'matin', 'Des tôles peintes de couleurs de chantier naval, et le stade de Boca Juniors à deux rues.', 'fr:Caminito'),
    a('san-telmo', 'La feria de San Telmo', 'shopping', 'marche', -34.6210, -58.3720,
      3, 0, 'matin', 'Le dimanche, dix blocs de brocante sur la Defensa, et des orchestres de tango à chaque carrefour.', 'es:Feria de San Telmo'),
    a('parrilla', 'Une parrilla', 'food', 'detente', -34.6000, -58.4000,
      2.5, 30, 'soir', 'Le bife de chorizo, le provoleta, et un malbec. On commande le point de cuisson en espagnol.', 'fr:Asado'),
    a('colon', 'Le théâtre Colón', 'culture', 'monument', -34.6011, -58.3835,
      1.5, 18, 'apres-midi', 'Une des trois meilleures acoustiques du monde, et une visite guidée qui passe par la coupole.', 'fr:Théâtre Colón'),
  ]),
  ...ville('la-havane', [
    a('habana-vieja', 'La Habana Vieja', 'culture', 'monument', 23.1360, -82.3530,
      3.5, 0, 'matin', 'Quatre places coloniales classées, des façades en restauration, et le Malecón au bout.', 'fr:La Havane'),
    a('malecon', 'Le Malecón au coucher du soleil', 'relax', 'panorama', 23.1450, -82.3800,
      2, 0, 'soir', 'Huit kilomètres de digue, et toute la ville assise dessus à partir de dix-huit heures.', 'fr:Malecón (La Havane)'),
    a('vinales', 'La vallée de Viñales', 'nature', 'nature', 22.6170, -83.7100,
      10, 60, 'journee', 'Des mogotes calcaires, des séchoirs à tabac, et une ferme où l’on voit rouler un cigare.', 'fr:Vallée de Viñales'),
    a('almendrones', 'Un tour en almendrón', 'offbeat', 'panorama', 23.1400, -82.3600,
      1.5, 25, 'apres-midi', 'Une américaine des années cinquante, moteur diesel soviétique, décapotable, et c’est un taxi.', 'fr:Automobile à Cuba'),
    a('fabrica', 'La Fábrica de Arte Cubano', 'nightlife', 'spectacle', 23.1400, -82.4100,
      4, 5, 'soir', 'Une huilerie devenue galerie, salle de concert et bar, ouverte du jeudi au dimanche.', 'es:Fábrica de Arte Cubano'),
  ]),
  // ------------------------------------------------------------------ Océanie
  ...ville('sydney', [
    a('opera', 'L’Opéra de Sydney', 'culture', 'monument', -33.8568, 151.2153,
      2, 30, 'matin', 'Un million cinquante-six mille tuiles, une visite en coulisses, et Utzon qui ne l’a jamais revu fini.', 'fr:Opéra de Sydney'),
    a('bondi-coogee', 'La côte de Bondi à Coogee', 'adventure', 'sport', -33.8908, 151.2743,
      3, 0, 'matin', 'Six kilomètres de sentier sur la falaise, cinq plages, et la piscine d’Icebergs au départ.', 'en:Bondi to Coogee walk'),
    a('harbour-bridge', 'L’ascension du Harbour Bridge', 'adventure', 'panorama', -33.8523, 151.2108,
      3.5, 190, 'apres-midi', 'Cent trente-quatre mètres au-dessus de l’eau, sur l’arc, encordé. Le Pylon Lookout coûte vingt fois moins.', 'fr:Harbour Bridge'),
    a('blue-mountains', 'Les Blue Mountains', 'nature', 'nature', -33.7320, 150.3120,
      9, 70, 'journee', 'Les Three Sisters, le train le plus pentu du monde, et une brume d’eucalyptus qui fait le bleu.', 'fr:Montagnes bleues'),
    a('manly-ferry', 'Le ferry de Manly', 'relax', 'panorama', -33.7970, 151.2850,
      3, 8, 'apres-midi', 'Trente minutes de baie au prix d’un ticket de bus, et une plage de surf à l’arrivée.', 'en:Manly Ferry'),
  ]),
  ...ville('auckland', [
    a('sky-tower', 'La Sky Tower', 'relax', 'panorama', -36.8485, 174.7622,
      1.5, 25, 'soir', 'Trois cent vingt-huit mètres, un plancher de verre, et un saut en base jump pour les autres.', 'fr:Sky Tower'),
    a('waiheke', 'L’île de Waiheke', 'food', 'nature', -36.8000, 175.1000,
      8, 60, 'journee', 'Quarante minutes de ferry, une trentaine de domaines viticoles, et des plages entre deux dégustations.', 'fr:Île Waiheke'),
    a('rangitoto', 'Le volcan de Rangitoto', 'adventure', 'nature', -36.7870, 174.8600,
      5, 35, 'matin', 'Sorti de l’eau il y a six cents ans, deux cent soixante mètres, et un champ de lave à traverser.', 'fr:Rangitoto'),
    a('piha', 'La plage de Piha', 'nature', 'plage', -36.9540, 174.4680,
      5, 0, 'apres-midi', 'Du sable noir ferrugineux, le rocher du Lion, et un courant qu’il faut prendre au sérieux.', 'en:Piha'),
  ]),
];

/** Index par destination : construit une fois, lu partout. */
const PAR_DESTINATION = new Map<string, Activite[]>();
for (const activite of CATALOGUE) {
  const liste = PAR_DESTINATION.get(activite.destinationId);
  if (liste) liste.push(activite);
  else PAR_DESTINATION.set(activite.destinationId, [activite]);
}

/** Toutes les activités connues, tous lieux confondus. */
export const ACTIVITES: readonly Activite[] = CATALOGUE;

/** Les destinations pour lesquelles on sait quoi faire. */
export function destinationsAvecActivites(): string[] {
  return [...PAR_DESTINATION.keys()].sort();
}

export function activitesDe(destinationId: string): readonly Activite[] {
  return PAR_DESTINATION.get(destinationId) ?? [];
}

export function trouverActivite(id: string): Activite | undefined {
  return CATALOGUE.find((activite) => activite.id === id);
}

/** Recherche tolérante aux accents et à la casse, dans une destination. */
export function chercherActivites(destinationId: string, requete: string): Activite[] {
  const aiguille = fold(requete);
  const liste = activitesDe(destinationId);
  if (aiguille.length === 0) return [...liste];
  return liste.filter((activite) => fold(`${activite.nom} ${activite.resume}`).includes(aiguille));
}

/**
 * Ce que coûte une journée de visites, d'après ce qu'on propose vraiment.
 *
 * Le moteur d'itinéraire travaillait jusqu'ici sur une enveloppe théorique
 * dérivée de l'indice de cherté du pays. Quand on connaît les activités, on
 * peut faire mieux : la médiane des entrées payantes dit plus honnêtement ce
 * qu'un après-midi va coûter qu'un coefficient appliqué à une moyenne
 * européenne. On renvoie `null` quand on ne sait pas, plutôt qu'un chiffre
 * fabriqué.
 */
export function prixMedianCents(destinationId: string): number | null {
  const payantes = activitesDe(destinationId)
    .map((activite) => activite.prixCents)
    .filter((cents) => cents > 0)
    .sort((x, y) => x - y);
  if (payantes.length === 0) return null;
  const milieu = Math.floor(payantes.length / 2);
  return payantes.length % 2 === 1
    ? payantes[milieu]!
    : Math.round((payantes[milieu - 1]! + payantes[milieu]!) / 2);
}

/**
 * Les activités, vues comme des lieux.
 *
 * Tout l'aval de Tripora — le remplissage de l'itinéraire, les repères sur la
 * carte, la liste de suggestions — parle en `Poi`. Plutôt que d'apprendre un
 * second vocabulaire à chacun de ces écrans, on traduit ici, une fois.
 *
 * Les identifiants sont préfixés `activite:` parce qu'ils voisinent, dans la
 * même liste, avec des identifiants OpenStreetMap : les deux sources
 * cohabitent, et on doit pouvoir dire d'où vient ce qu'on affiche.
 */
export function poisDeLaDestination(destinationId: string): Poi[] {
  return activitesDe(destinationId).map((activite) => ({
    id: `activite:${activite.id}`,
    name: activite.nom,
    lat: activite.lat,
    lng: activite.lng,
    category: activite.category,
    axis: activite.axis,
    label: LIBELLES[activite.category],
    extract: activite.resume,
    moment: activite.moment,
    dureeHeures: activite.dureeHeures,
    prixCents: activite.prixCents,
    ...(activite.wikipedia ? { wikipedia: activite.wikipedia } : {}),
  }));
}

/**
 * Où réserver, quand c'est une sortie qui se réserve.
 *
 * On renvoie **une recherche**, jamais un produit. Pointer vers une référence
 * précise reviendrait à garantir un prestataire, une date et un prix qu'on n'a
 * pas vérifiés — et le lien serait mort dans six mois. Une recherche, elle,
 * reste juste, et laisse le groupe choisir.
 *
 * Rien n'est affilié : aucun identifiant de partenaire n'est ajouté.
 */
export function rechercherLaSortie(activite: Activite, ville: string): string {
  const requete = encodeURIComponent(`${activite.nom} ${ville}`);
  return `https://www.getyourguide.fr/s/?q=${requete}`;
}

/** Vrai quand la sortie se réserve : une place payante, pas une rue à parcourir. */
export function seReserve(activite: Activite): boolean {
  return activite.prixCents > 0;
}
