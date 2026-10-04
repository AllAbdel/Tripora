-- ============================================================================
-- Quarante-deux applications de plus : les catégories maigres, et les pays
-- que les deux premières vagues avaient laissés sans rien.
--
-- Le catalogue en comptait quatre-vingt-trois, mais très mal répartis :
-- quarante-cinq pour les transports, deux pour la langue, deux pour la
-- sécurité, trois pour la connectivité. Un voyageur qui part à Séoul trouvait
-- douze façons de prendre un taxi et aucune de lire un menu. Il en compte
-- maintenant cent vingt-cinq, et cent dix-sept des cent soixante-cinq pays
-- du catalogue ont au moins une recommandation locale, contre
-- quatre-vingt-dix-neuf avant cette vague.
--
-- Chaque fiche ci-dessous a été vérifiée sur l'App Store avant d'être écrite :
-- l'application existe, l'éditeur est celui qu'on croit, et la description dit
-- bien ce qu'on prétend. Les candidates qui n'ont pas passé ce test ont été
-- retirées plutôt que décrites de mémoire — une recommandation fausse coûte
-- plus cher qu'une case vide.
--
-- Deux absences volontaires. Les applications de paiement locales (UPI, PayPay,
-- M-Pesa, Mercado Pago) demandent presque toutes un numéro et un compte
-- bancaire du pays : les conseiller à quelqu'un qui arrive pour cinq jours,
-- c'est l'envoyer dans un mur. Et les dizaines de petites îles où la vraie
-- réponse reste « rien de particulier » n'ont toujours pas de fiche, parce
-- qu'un catalogue meublé ne vaut pas mieux qu'un catalogue honnête.
-- ============================================================================

insert into public.travel_apps
  (id, name, category, tagline, why, caveat,
   ios_url, android_url, web_url, country_codes, destination_ids, status, priority)
values

  -- ---------------------------------------------------------------- langue --
  ('papago', 'Papago', 'langue',
   'Le traducteur qui comprend vraiment le coréen et le japonais.',
   'Sur les langues d''Asie de l''Est, Papago fait nettement mieux que les traducteurs généralistes : il tient le registre poli, comprend l''argot des menus et traduit une photo de carte de restaurant en une seconde. Le mode conversation coupe la phrase en deux et affiche chaque moitié dans le bon sens.',
   null,
   'https://apps.apple.com/search?term=Papago', 'https://play.google.com/store/search?q=Papago&c=apps', 'https://papago.naver.com',
   array['KR','JP','CN','TW','VN','TH','ID']::text[], '{}', 'published', 75),

  ('pleco', 'Pleco', 'langue',
   'Le dictionnaire chinois qui lit les caractères à travers l''appareil photo.',
   'Le vrai problème en Chine n''est pas de parler, c''est de lire : un panneau, un menu, un billet. Pleco reconnaît un caractère tracé au doigt ou visé à la caméra, donne le pinyin et le sens, et fonctionne entièrement hors ligne — utile là où le réseau étranger est capricieux.',
   null,
   'https://apps.apple.com/search?term=Pleco', 'https://play.google.com/store/search?q=Pleco&c=apps', 'https://www.pleco.com',
   array['CN','TW','HK','MO','SG']::text[], '{}', 'published', 70),

  -- -------------------------------------------------------------- sécurité --
  ('safety-tips', 'Safety tips', 'securite',
   'Les alertes séisme, tsunami et typhon du Japon, en français.',
   'L''alerte sismique japonaise arrive quelques secondes avant la secousse, et ces secondes suffisent à s''écarter d''une fenêtre. L''application officielle du tourisme les relaie en plusieurs langues, avec la conduite à tenir — ce que les alertes en japonais du téléphone ne font pas.',
   null,
   'https://apps.apple.com/search?term=Safety%20tips', 'https://play.google.com/store/search?q=Safety%20tips&c=apps', 'https://www.jnto.go.jp',
   array['JP']::text[], '{}', 'published', 70),

  ('nina', 'NINA', 'securite',
   'Les alertes officielles allemandes : intempéries, crues, incidents.',
   'Application de l''office fédéral de protection civile. Elle prévient d''une crue, d''une tempête ou d''une évacuation là où on se trouve, y compris pour un séjour de trois jours — la géolocalisation suffit, aucun compte à créer.',
   null,
   'https://apps.apple.com/search?term=NINA%20Warn-App', 'https://play.google.com/store/search?q=NINA%20Warn-App&c=apps', 'https://www.bbk.bund.de',
   array['DE']::text[], '{}', 'published', 50),

  ('alertswiss', 'Alertswiss', 'securite',
   'Les alertes officielles suisses, montagne comprise.',
   'Publiée par l''Office fédéral de la protection de la population. En Suisse, l''alerte qui compte pour un voyageur est souvent météo ou avalanche, et elle arrive ici avant d''arriver ailleurs.',
   null,
   'https://apps.apple.com/search?term=Alertswiss', 'https://play.google.com/store/search?q=Alertswiss&c=apps', 'https://www.alert.swiss',
   array['CH']::text[], '{}', 'published', 50),

  -- ---------------------------------------------------------- connectivité --
  ('nomad-esim', 'Nomad', 'connectivite',
   'Une eSIM de données, souvent moins chère qu''Airalo.',
   'Même principe qu''Airalo — un forfait data acheté avant le départ, activé en scannant un code — mais les tarifs diffèrent d''un pays à l''autre et l''écart va parfois du simple au double. Comparer les deux prend deux minutes et se fait depuis chez soi.',
   'Une eSIM demande un téléphone compatible et déverrouillé. Elle fournit des données, pas de numéro de téléphone local.',
   'https://apps.apple.com/search?term=Nomad%20eSIM', 'https://play.google.com/store/search?q=Nomad%20eSIM&c=apps', 'https://www.getnomad.app',
   '{}', '{}', 'published', 45),

  ('wifi-map', 'WiFi Map', 'connectivite',
   'Les points Wi-Fi ouverts, et leurs mots de passe, hors ligne.',
   'La carte se télécharge avant le départ et sert justement quand on n''a plus de données : cafés, gares, aéroports, avec les codes partagés par d''autres voyageurs. Dépanne le temps de trouver une carte SIM.',
   'Les mots de passe viennent des utilisateurs : certains sont périmés. Sur un Wi-Fi public, évitez les paiements et gardez le VPN allumé.',
   'https://apps.apple.com/search?term=WiFi%20Map', 'https://play.google.com/store/search?q=WiFi%20Map&c=apps', 'https://www.wifimap.io',
   '{}', '{}', 'published', 35),

  -- ------------------------------------------------------------ orientation --
  ('waze', 'Waze', 'orientation',
   'La navigation en voiture, avec les radars et les bouchons signalés.',
   'Pour conduire, Waze bat souvent les cartes généralistes : les incidents sont signalés par les conducteurs en temps réel, et l''itinéraire est recalculé avant qu''on soit dans le bouchon. Particulièrement utile en Italie, en Israël et en Amérique latine, où la communauté est très active.',
   null,
   'https://apps.apple.com/search?term=Waze', 'https://play.google.com/store/search?q=Waze&c=apps', 'https://www.waze.com',
   '{}', '{}', 'published', 40),

  ('what3words', 'what3words', 'orientation',
   'Trois mots pour désigner un endroit qui n''a pas d''adresse.',
   'Le monde est découpé en carrés de trois mètres, chacun nommé par trois mots. C''est la façon la plus simple de dire à un chauffeur, à un hôte ou aux secours où l''on se trouve exactement quand la rue n''a pas de nom — cas fréquent en Mongolie, en Afrique de l''Ouest et dans les campagnes.',
   null,
   'https://apps.apple.com/search?term=what3words', 'https://play.google.com/store/search?q=what3words&c=apps', 'https://what3words.com',
   '{}', '{}', 'published', 35),

  ('kakaomap', 'KakaoMap', 'orientation',
   'La carte qui marche vraiment en Corée du Sud.',
   'La Corée interdit l''export de ses données cartographiques : les cartes étrangères y sont inutilisables pour l''itinéraire à pied comme en transport. KakaoMap donne les correspondances de métro, les sorties numérotées et les horaires de bus, avec une interface en anglais.',
   null,
   'https://apps.apple.com/search?term=KakaoMap', 'https://play.google.com/store/search?q=KakaoMap&c=apps', 'https://map.kakao.com',
   array['KR']::text[], '{}', 'published', 75),

  ('yandex-maps', 'Yandex Maps', 'orientation',
   'La carte la plus détaillée du Caucase et de l''Asie centrale.',
   'Sur Tbilissi, Bakou, Tachkent ou Almaty, elle connaît des commerces, des horaires et des lignes de marchroutkas que les cartes occidentales ignorent. Les avis et les photos y sont abondants là où ailleurs il n''y a rien.',
   null,
   'https://apps.apple.com/search?term=Yandex%20Maps', 'https://play.google.com/store/search?q=Yandex%20Maps&c=apps', 'https://yandex.com/maps',
   array['GE','AM','AZ','KZ','UZ','KG','TR']::text[], '{}', 'published', 55),

  -- -------------------------------------------------------- transport local --
  ('gozem', 'Gozem', 'transport_local',
   'Les motos-taxis et les voitures, au prix affiché d''avance.',
   'Le zémidjan se négocie d''habitude à l''oreille, et un étranger paie deux à trois fois le tarif local. Gozem affiche le prix avant la course et garde une trace du trajet.',
   'La couverture change d''une ville à l''autre : vérifiez qu''elle est active à votre étape avant de compter dessus.',
   'https://apps.apple.com/search?term=Gozem', 'https://play.google.com/store/search?q=Gozem&c=apps', 'https://gozem.co',
   array['BJ','GA','CM','CI']::text[], '{}', 'published', 70),

  ('safeboda', 'SafeBoda', 'transport_local',
   'Les motos-taxis de Kampala, avec un casque et un compteur.',
   'Le boda-boda est le seul moyen de traverser Kampala à une heure raisonnable. SafeBoda impose un casque passager, forme ses conducteurs et fixe le prix à l''avance — trois choses que la rue ne garantit pas.',
   null,
   'https://apps.apple.com/search?term=SafeBoda', 'https://play.google.com/store/search?q=SafeBoda&c=apps', 'https://safeboda.com',
   array['UG']::text[], '{}', 'published', 70),

  ('yego-rwanda', 'YEGO', 'transport_local',
   'Les motos et les voitures de Kigali, au compteur.',
   'Le Rwanda a rendu le compteur obligatoire sur les motos-taxis, et YEGO est l''application qui le lit. Fini la négociation au feu rouge : le prix est celui du compteur, payable par téléphone.',
   null,
   'https://apps.apple.com/search?term=YEGO%20Rwanda', 'https://play.google.com/store/search?q=YEGO%20Rwanda&c=apps', 'https://yegoglobal.com',
   array['RW']::text[], '{}', 'published', 70),

  ('dart-brunei', 'Dart', 'transport_local',
   'Le seul moyen simple de circuler à Brunei sans voiture.',
   'Brunei n''a presque pas de transports en commun et aucun service de VTC international. Dart réunit les taxis locaux et des chauffeurs partenaires dans une application, avec un prix convenu à la réservation.',
   null,
   'https://apps.apple.com/search?term=Dart%20Rider', 'https://play.google.com/store/search?q=Dart%20Rider&c=apps', null,
   array['BN']::text[], '{}', 'published', 80),

  ('ubcab', 'UBCab', 'transport_local',
   'Les taxis d''Oulan-Bator, sans marchander.',
   'À Oulan-Bator, héler une voiture au bord de la route reste courant, et le prix se discute. UBCab est l''application locale de commande de taxi : trajet enregistré, tarif annoncé, adresse saisie plutôt qu''expliquée.',
   null,
   'https://apps.apple.com/search?term=UBCab', 'https://play.google.com/store/search?q=UBCab&c=apps', null,
   array['MN']::text[], '{}', 'published', 70),

  ('maxim-taxi', 'maxim', 'transport_local',
   'Le VTC le moins cher d''Asie centrale.',
   'Là où Uber n''existe pas et où inDrive n''est pas partout, maxim couvre Douchanbé, Och, Boukhara et quantité de villes moyennes. Les prix sont fixes et très bas, la commande se fait sans parler la langue.',
   null,
   'https://apps.apple.com/search?term=maxim%20taxi', 'https://play.google.com/store/search?q=maxim%20taxi&c=apps', 'https://taximaxim.com',
   array['TJ','KG','UZ','KZ','AZ','ID','PH']::text[], '{}', 'published', 60),

  ('pickme', 'PickMe', 'transport_local',
   'Les tuk-tuks sri-lankais au compteur, et les voitures.',
   'Le tarif tuk-tuk annoncé à un touriste à Colombo est régulièrement le triple du prix local. PickMe applique un tarif kilométrique affiché avant le départ, tuk-tuk compris.',
   null,
   'https://apps.apple.com/search?term=PickMe', 'https://play.google.com/store/search?q=PickMe&c=apps', 'https://pickme.lk',
   array['LK']::text[], '{}', 'published', 75),

  ('rapido', 'Rapido', 'transport_local',
   'Les motos-taxis indiennes, pour traverser les embouteillages.',
   'Sur un trajet de cinq kilomètres à Bangalore ou à Delhi, la moto met trois fois moins de temps que la voiture et coûte le quart. Rapido propose aussi les rickshaws au compteur, ce qui évite la négociation à chaque course.',
   'Le casque passager est fourni mais la circulation indienne reste rude : à réserver aux trajets courts et aux voyageurs à l''aise.',
   'https://apps.apple.com/search?term=Rapido', 'https://play.google.com/store/search?q=Rapido&c=apps', 'https://rapido.bike',
   array['IN']::text[], '{}', 'published', 60),

  ('go-japan', 'GO', 'transport_local',
   'Le taxi japonais commandé sans parler japonais.',
   'GO couvre les quarante-sept préfectures et accepte la carte étrangère dans l''application, ce qui règle les deux difficultés du taxi au Japon : expliquer l''adresse et payer. Indispensable après le dernier train, qui tombe vers minuit.',
   null,
   'https://apps.apple.com/search?term=GO%20taxi%20Japan', 'https://play.google.com/store/search?q=GO%20taxi%20Japan&c=apps', 'https://go.mo-t.com',
   array['JP']::text[], '{}', 'published', 70),

  ('trafi', 'Trafi', 'transport_local',
   'Tous les transports baltes dans un seul horaire.',
   'Bus, trolleys, trottinettes et vélos de Vilnius, Riga et Tallinn au même endroit, avec l''achat du ticket dans l''application — ce qui évite d''avoir à trouver un kiosque avant de monter.',
   null,
   'https://apps.apple.com/search?term=Trafi', 'https://play.google.com/store/search?q=Trafi&c=apps', 'https://www.trafi.com',
   array['LT','LV','EE']::text[], '{}', 'published', 60),

  ('libertybus', 'LibertyBus', 'transport_local',
   'Le réseau de bus de Jersey, horaires et billets.',
   'Jersey se traverse très bien en bus, et le pass à la journée revient bien moins cher qu''une location de voiture sur une île de quinze kilomètres. L''application donne les horaires réels et vend les billets.',
   null,
   'https://apps.apple.com/search?term=LibertyBus', 'https://play.google.com/store/search?q=LibertyBus&c=apps', 'https://www.libertybus.je',
   array['JE']::text[], '{}', 'published', 55),

  -- ------------------------------------------------------ transport longue --
  ('ferryhopper', 'Ferryhopper', 'transport_longue',
   'Tous les ferries de Méditerranée, comparés au même endroit.',
   'Les compagnies grecques, italiennes et turques vendent chacune de leur côté, souvent sur des sites illisibles. Ferryhopper les met sur une seule carte, montre les correspondances entre îles et prévient quand une liaison ne circule pas hors saison.',
   'En haute saison, les traversées populaires se remplissent des semaines à l''avance — surtout avec un véhicule.',
   'https://apps.apple.com/search?term=Ferryhopper', 'https://play.google.com/store/search?q=Ferryhopper&c=apps', 'https://www.ferryhopper.com',
   array['GR','IT','ES','TR','HR','MA','AL','ME','CY','MT']::text[], '{}', 'published', 75),

  ('eurostar', 'Eurostar', 'transport_longue',
   'Londres, Bruxelles et Amsterdam sans aéroport.',
   'De centre-ville à centre-ville, le train bat l''avion sur ces trajets dès qu''on compte l''accès aux aéroports et l''enregistrement. Les billets les moins chers ouvrent six mois à l''avance et disparaissent vite.',
   'Pour Londres, l''embarquement se fait au moins quarante-cinq minutes avant, contrôles frontaliers obligent.',
   'https://apps.apple.com/search?term=Eurostar', 'https://play.google.com/store/search?q=Eurostar&c=apps', 'https://www.eurostar.com',
   array['FR','GB','BE','NL','DE']::text[], '{}', 'published', 70),

  ('italo', 'Italo', 'transport_longue',
   'Le concurrent privé des trains rapides italiens.',
   'Italo dessert les mêmes grandes lignes que Trenitalia, souvent moins cher au même horaire. Comparer les deux avant d''acheter est le réflexe le plus rentable du voyage en Italie.',
   null,
   'https://apps.apple.com/search?term=Italo%20treno', 'https://play.google.com/store/search?q=Italo%20treno&c=apps', 'https://www.italotreno.com',
   array['IT']::text[], '{}', 'published', 65),

  ('amtrak', 'Amtrak', 'transport_longue',
   'Les trains américains, y compris les lignes panoramiques.',
   'Le train n''est pas le moyen le plus rapide de traverser les États-Unis, mais sur le corridor Boston–Washington il bat la voiture et l''avion. Les grandes lignes de l''Ouest sont un voyage en soi, et se réservent des mois à l''avance.',
   null,
   'https://apps.apple.com/search?term=Amtrak', 'https://play.google.com/store/search?q=Amtrak&c=apps', 'https://www.amtrak.com',
   array['US']::text[], '{}', 'published', 55),

  ('busbud', 'Busbud', 'transport_longue',
   'Les bus longue distance des Amériques, réservables de l''étranger.',
   'Les compagnies de bus latino-américaines et nord-américaines vendent rarement à une carte étrangère. Busbud les agrège et accepte le paiement européen, ce qui évite d''avoir à se présenter au terminal la veille.',
   null,
   'https://apps.apple.com/search?term=Busbud', 'https://play.google.com/store/search?q=Busbud&c=apps', 'https://www.busbud.com',
   array['US','CA','MX','BR','AR','CO','PE','CL','EC','UY','BO','GT','CR','PA','NI','HN','SV','PY']::text[], '{}', 'published', 60),

  ('knutsford-express', 'Knutsford Express', 'transport_longue',
   'Le car climatisé qui relie les villes jamaïcaines.',
   'Louer une voiture en Jamaïque coûte cher et se conduit à gauche. Knutsford relie Kingston, Montego Bay, Ocho Rios et Negril à heure fixe, avec réservation en ligne et bagages en soute.',
   null,
   'https://apps.apple.com/search?term=Knutsford%20Express', 'https://play.google.com/store/search?q=Knutsford%20Express&c=apps', 'https://www.knutsfordexpress.com',
   array['JM']::text[], '{}', 'published', 70),

  ('rtl-maldives', 'RTL Travel', 'transport_longue',
   'Les ferries publics maldiviens, à deux euros la traversée.',
   'L''hydravion vers un atoll coûte quelques centaines d''euros ; le ferry public de l''État, quelques euros. RTL en donne les horaires et les billets, ce qu''aucun site de réservation d''hôtel ne montre.',
   'Les ferries publics ne circulent pas tous les jours et jamais le vendredi matin : à vérifier avant de caler ses dates.',
   'https://apps.apple.com/search?term=RTL%20Travel', 'https://play.google.com/store/search?q=RTL%20Travel&c=apps', 'https://rtl.mv',
   array['MV']::text[], '{}', 'published', 80),

  -- ------------------------------------------------------------ activités --
  ('komoot', 'komoot', 'activites',
   'Les itinéraires de randonnée et de vélo, hors ligne.',
   'La cartographie européenne est la plus fine du genre : sentiers, revêtement, dénivelé réel, et le tracé se télécharge pour marcher sans réseau. La navigation vocale suit un chemin de terre aussi bien qu''une route.',
   null,
   'https://apps.apple.com/search?term=komoot', 'https://play.google.com/store/search?q=komoot&c=apps', 'https://www.komoot.com',
   array['FR','DE','AT','CH','IT','ES','PT','BE','NL','GB','IE','NO','SE','FI','DK','PL','CZ','SI','HR','GR','IS']::text[], '{}', 'published', 60),

  ('wikiloc', 'Wikiloc', 'activites',
   'Les traces GPS partagées par ceux qui sont déjà passés.',
   'Là où les sentiers ne sont pas balisés, la trace de quelqu''un d''autre vaut mieux qu''une carte. Wikiloc est particulièrement fourni en Espagne, au Portugal et en Amérique latine, y compris sur des chemins qu''aucun guide ne mentionne.',
   'Une trace partagée n''est pas un itinéraire vérifié : lisez les commentaires et la date avant de la suivre.',
   'https://apps.apple.com/search?term=Wikiloc', 'https://play.google.com/store/search?q=Wikiloc&c=apps', 'https://www.wikiloc.com',
   array['ES','PT','AR','CL','PE','CO','MX','EC','BO','CR','IT','GR']::text[], '{}', 'published', 45),

  ('tiqets', 'Tiqets', 'activites',
   'Les billets de musées, sans la file d''attente.',
   'Sur les monuments européens à créneau obligatoire — Sagrada Família, Colisée, Rijksmuseum — le billet coupe-file s''achète ici la veille et s''ouvre sur le téléphone. Souvent moins cher que les revendeurs postés devant l''entrée.',
   null,
   'https://apps.apple.com/search?term=Tiqets', 'https://play.google.com/store/search?q=Tiqets&c=apps', 'https://www.tiqets.com',
   array['ES','IT','FR','NL','PT','DE','AT','GB','BE','CZ','HU','GR','TR','AE','US']::text[], '{}', 'published', 50),

  ('peakvisor', 'PeakVisor', 'activites',
   'Le nom des montagnes, en visant l''horizon.',
   'On lève l''appareil photo et chaque sommet s''affiche avec son nom et son altitude. Accessoire, mais c''est exactement ce qu''on cherche depuis un col — et la carte des refuges et des sentiers fonctionne hors ligne.',
   null,
   'https://apps.apple.com/search?term=PeakVisor', 'https://play.google.com/store/search?q=PeakVisor&c=apps', 'https://peakvisor.com',
   array['FR','CH','IT','AT','DE','ES','SI','NO','NP','JP','CA','US','AR','CL','NZ','GE','KG','TJ','LS']::text[], '{}', 'published', 25),

  -- ---------------------------------------------------------- nourriture --
  ('deliveroo', 'Deliveroo', 'nourriture',
   'La livraison de repas là où Uber Eats n''est pas.',
   'Bien implantée au Royaume-Uni, en Belgique, en Irlande, à Hong Kong, à Singapour et dans le Golfe. Utile le soir d''arrivée, quand ressortir n''est plus une option.',
   null,
   'https://apps.apple.com/search?term=Deliveroo', 'https://play.google.com/store/search?q=Deliveroo&c=apps', 'https://deliveroo.com',
   array['GB','IE','BE','FR','IT','HK','SG','AE','KW','QA']::text[], '{}', 'published', 40),

  ('foodpanda', 'foodpanda', 'nourriture',
   'La livraison dominante en Asie du Sud et du Sud-Est.',
   'À Bangkok, Kuala Lumpur, Taipei ou Dacca, c''est souvent la seule application qui livre en dehors des quartiers touristiques. Les cartes étrangères passent, ce qui n''est pas le cas de toutes les concurrentes locales.',
   null,
   'https://apps.apple.com/search?term=foodpanda', 'https://play.google.com/store/search?q=foodpanda&c=apps', 'https://www.foodpanda.com',
   array['TH','MY','SG','PH','TW','HK','PK','BD','KH','LA']::text[], '{}', 'published', 50),

  ('pedidosya', 'PedidosYa', 'nourriture',
   'La livraison de repas en Amérique latine hispanophone.',
   'De Buenos Aires à Asunción en passant par Montevideo et La Paz, c''est l''application que les restaurants utilisent réellement. Elle livre aussi les courses, pratique quand on loue un appartement.',
   null,
   'https://apps.apple.com/search?term=PedidosYa', 'https://play.google.com/store/search?q=PedidosYa&c=apps', 'https://www.pedidosya.com',
   array['AR','UY','PY','BO','CL','PE','EC','DO','PA','CR','GT','HN','NI','SV']::text[], '{}', 'published', 50),

  ('zomato', 'Zomato', 'nourriture',
   'Les restaurants indiens, notés par ceux qui y mangent.',
   'Les avis y sont bien plus nombreux et plus récents que sur les cartes généralistes, et l''application distingue le végétarien du « pure veg », distinction qui compte beaucoup en Inde. Livraison comprise.',
   null,
   'https://apps.apple.com/search?term=Zomato', 'https://play.google.com/store/search?q=Zomato&c=apps', 'https://www.zomato.com',
   array['IN','AE']::text[], '{}', 'published', 50),

  ('tabelog', 'Tabelog', 'nourriture',
   'Le guide où les Japonais choisissent vraiment leur restaurant.',
   'La notation y est sévère : au-dessus de 3,5 sur 5, l''adresse est excellente. Comme les avis viennent des habitants et non des visiteurs, on sort des rues touristiques — et les fiches indiquent la fourchette de prix du midi et du soir.',
   null,
   'https://apps.apple.com/search?term=Tabelog', 'https://play.google.com/store/search?q=Tabelog&c=apps', 'https://tabelog.com',
   array['JP']::text[], '{}', 'published', 60),

  ('thefork', 'TheFork', 'nourriture',
   'Les réservations de restaurant, souvent avec une remise.',
   'Réserver depuis l''étranger sans téléphoner, et voir les tables qui restent ce soir. Les remises de vingt à cinquante pour cent portent sur des créneaux creux, ce qui vaut surtout pour le déjeuner.',
   null,
   'https://apps.apple.com/search?term=TheFork', 'https://play.google.com/store/search?q=TheFork&c=apps', 'https://www.thefork.fr',
   array['FR','ES','IT','PT','BE','CH','NL','SE','DK','DE']::text[], '{}', 'published', 45),

  -- -------------------------------------------------------- hébergement --
  ('ioverlander', 'iOverlander', 'hebergement',
   'Où dormir en van sur les routes des Amériques.',
   'Base communautaire de bivouacs, campings, points d''eau et douches, alimentée par ceux qui viennent d''y passer. C''est l''équivalent de park4night pour l''Amérique latine et l''Afrique, où celui-ci n''a presque rien.',
   'Les fiches datent parfois de plusieurs années : la note la plus récente compte davantage que la note la mieux placée.',
   'https://apps.apple.com/search?term=iOverlander', 'https://play.google.com/store/search?q=iOverlander&c=apps', 'https://www.ioverlander.com',
   array['MX','GT','CR','PA','CO','EC','PE','BO','CL','AR','UY','BR','NA','ZA','BW','MA']::text[], '{}', 'published', 40),

  ('campercontact', 'Campercontact', 'hebergement',
   'Les aires de camping-car européennes, avec les services.',
   'Plus complète que park4night sur les aires officielles du nord de l''Europe : vidange, électricité, tarif et hauteur maximale sont renseignés, ce qui évite de découvrir une barrière à deux mètres dix en arrivant.',
   null,
   'https://apps.apple.com/search?term=Campercontact', 'https://play.google.com/store/search?q=Campercontact&c=apps', 'https://www.campercontact.com',
   array['NL','BE','DE','FR','IT','ES','PT','AT','CH','DK','SE','NO','PL','HR','SI','GB','IE']::text[], '{}', 'published', 35),

  ('homeexchange', 'HomeExchange', 'hebergement',
   'Échanger sa maison plutôt que payer un hôtel.',
   'On loge gratuitement chez quelqu''un qui logera chez nous, tout de suite ou plus tard grâce à un système de points. Sur un voyage à plusieurs et à plusieurs semaines, c''est le poste hébergement qui disparaît — contre un abonnement annuel de l''ordre d''une nuit d''hôtel.',
   'Il faut avoir un logement à proposer, et s''y prendre plusieurs mois à l''avance pour les destinations recherchées.',
   'https://apps.apple.com/search?term=HomeExchange', 'https://play.google.com/store/search?q=HomeExchange&c=apps', 'https://www.homeexchange.fr',
   '{}', '{}', 'published', 30)

on conflict (id) do update set
  name            = excluded.name,
  category        = excluded.category,
  tagline         = excluded.tagline,
  why             = excluded.why,
  caveat          = excluded.caveat,
  ios_url         = excluded.ios_url,
  android_url     = excluded.android_url,
  web_url         = excluded.web_url,
  country_codes   = excluded.country_codes,
  destination_ids = excluded.destination_ids,
  status          = excluded.status,
  priority        = excluded.priority,
  updated_at      = now();
