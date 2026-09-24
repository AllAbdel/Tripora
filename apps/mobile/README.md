# Tripora sur Android et iOS

L'application mobile est **le site lui-même**, embarqué par
[Capacitor](https://capacitorjs.com) dans une vraie application. Un seul code
pour les trois : le site, Android et iOS. Surtout, **un seul serveur** : l'app
parle au même projet Supabase que le site, avec la même clé publique et les
mêmes règles d'accès. Un voyage créé sur le téléphone apparaît sur
l'ordinateur, un vote posé sur le site s'affiche dans l'app, en direct.

Pourquoi Capacitor plutôt que deux applications natives (Kotlin et Swift), ou
qu'une réécriture en React Native ou Flutter : ces trois voies demandaient de
réécrire les trente écrans de Tripora, puis de maintenir deux ou trois copies de
chaque correction. Avec Capacitor, une correction du site part dans l'app à la
construction suivante, et ce qui distingue le téléphone tient dans un seul
fichier, `apps/web/src/lib/natif.ts`.

## Installer l'application Android

GitHub construit l'APK à chaque modification du site ou de l'app, et le publie
toujours à la même adresse :

**https://github.com/AllAbdel/Tripora/releases/download/android/tripora.apk**

Ouvrez ce lien sur le téléphone, puis autorisez l'installation depuis le
navigateur quand Android le demande (« Sources inconnues »). La page
[des versions](https://github.com/AllAbdel/Tripora/releases/tag/android) dit
de quel commit vient l'APK.

### Mettre à jour sans désinstaller

Android n'installe une mise à jour que si elle est signée par la même clé que
la version en place. Tant que le dépôt n'a pas de clé à lui, chaque APK est
signé par une clé de test différente : il faut désinstaller avant d'installer
le suivant (les voyages ne sont pas perdus, ils sont sur le serveur ; il faut
seulement se reconnecter).

Pour une clé stable, créez une fois un trousseau, et rangez-le dans
**Settings → Secrets and variables → Actions** du dépôt :

| Secret | Contenu |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | le fichier `.jks` encodé en base64 |
| `ANDROID_KEYSTORE_PASSWORD` | son mot de passe (le même pour le trousseau et la clé, alias `tripora`) |

```sh
keytool -genkeypair -v -keystore tripora.jks -alias tripora -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 tripora.jks   # à coller dans ANDROID_KEYSTORE_BASE64
```

Gardez `tripora.jks` en lieu sûr et **jamais dans le dépôt** : qui a cette clé
peut publier une « mise à jour » de Tripora.

## Et l'iPhone ?

Le projet iOS est prêt (`ios/`) et GitHub le compile à chaque changement pour
vérifier qu'il se construit. Mais **installer une app sur un iPhone passe par
Apple**, et il n'y a que deux chemins :

1. **Un Mac avec Xcode 26** (gratuit) : ouvrez `ios/App/App.xcodeproj`,
   branchez l'iPhone, choisissez votre identifiant Apple comme équipe, et
   lancez. Sans compte payant, l'app expire au bout de sept jours et se
   réinstalle de la même façon.
2. **Le programme développeur Apple** (99 $ par an) : TestFlight, pour
   installer chez les amis sans câble, puis l'App Store.

En attendant, le site s'installe sur iPhone comme une app : dans Safari,
**Partager → Sur l'écran d'accueil**. Même serveur, mêmes voyages.

## Une étape à faire côté Supabase

La connexion Google revient dans l'application par l'adresse
`tripora://connexion`. Supabase ne renvoie que vers les adresses qu'il connaît :
ajoutez-la dans **Authentication → URL Configuration → Redirect URLs**.
Sans elle, la connexion Google se termine sur le site au lieu de l'app. Le
compte invité, lui, marche sans rien configurer.

## Construire soi-même

```sh
pnpm install
pnpm --filter @tripora/mobile android   # site en mode mobile + projet Android
cd apps/mobile/android && ./gradlew assembleDebug
```

Il faut Java 21 et le SDK Android 36 (Android Studio les installe). Pour iOS,
`pnpm --filter @tripora/mobile ios`, puis Xcode sur un Mac.

Les icônes et l'écran de lancement se régénèrent depuis l'icône du site avec
`pnpm --filter @tripora/mobile ressources`.
