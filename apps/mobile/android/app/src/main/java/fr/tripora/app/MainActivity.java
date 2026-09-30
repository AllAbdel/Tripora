package fr.tripora.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * L'activité de l'application, avec un seul ajout : le partage.
 *
 * Android livre un partage (« Envoyer vers… » depuis TikTok, Instagram,
 * Google Maps, le navigateur) comme une intention SEND portant du texte.
 * Capacitor ne sait ouvrir que des adresses : on traduit donc l'intention en
 * tripora://partager?texte=…&titre=…, avant que le pont ne la lise. L'écran
 * « Partager » de l'application fait le reste, comme pour le partage du site.
 */
public class MainActivity extends BridgeActivity {

    /** Au-delà, ce n'est plus un lien partagé : on tronque plutôt que refuser. */
    private static final int LONGUEUR_MAX = 3000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        traduireUnPartage(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        traduireUnPartage(intent);
        super.onNewIntent(intent);
    }

    private static void traduireUnPartage(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String type = intent.getType();
        if (type == null || !type.startsWith("text/")) return;
        CharSequence texte = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (texte == null || texte.length() == 0) return;

        Uri.Builder adresse = new Uri.Builder()
            .scheme("tripora")
            .authority("partager")
            .appendQueryParameter("texte", tronquer(texte.toString()));
        CharSequence sujet = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT);
        if (sujet != null && sujet.length() > 0) {
            adresse.appendQueryParameter("titre", tronquer(sujet.toString()));
        }

        intent.setAction(Intent.ACTION_VIEW);
        // setData efface le type : l'intention devient une simple adresse.
        intent.setData(adresse.build());
    }

    private static String tronquer(String valeur) {
        return valeur.length() > LONGUEUR_MAX ? valeur.substring(0, LONGUEUR_MAX) : valeur;
    }
}
