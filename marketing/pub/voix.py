"""
La voix off, calée sur l'image.

Deux façons d'enregistrer (voir voix/ENREGISTRER.md) :
  - une réplique par fichier : voix/fr/01.m4a, 02.m4a… (le plus sûr) ;
  - une seule prise, en lisant sur la vidéo-prompteur : voix/fr/prise.m4a,
    découpée ici sur les silences.

Chaque réplique est nettoyée (passe-haut, réduction de bruit, compression,
niveau constant), débarrassée de ses silences, puis posée au début de sa
fenêtre. Si elle déborde, elle est accélérée sans changer la hauteur
(rubberband) — jusqu'à 15 % ; au-delà, l'outil refuse et dit laquelle
réenregistrer : une voix qui court derrière l'image ne se rattrape pas.

    python3 voix.py fr            → sortie/voix-fr.wav, sortie/bande-son-fr.wav (musique effacée sous la voix),
                                     sortie/sous-titres-fr.ass / .srt, sortie/voix-fr.json
    python3 voix.py fr --prompteur → sortie/prompteur-fr.mp4 (la vidéo pour enregistrer en une prise)
    python3 voix.py en            → la version anglaise, sur sa propre musique (LANGUE=en python3 musique.py) ;
                                     ses répliques viennent de synthese.py ou d'un enregistrement
"""
import glob
import json
import os
import subprocess
import sys

import numpy as np
from scipy.io import wavfile

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, 'sortie')
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
SR = 44100
ACCELERATION_MAX = 1.15
EXTENSIONS = ('wav', 'm4a', 'mp3', 'ogg', 'opus', 'webm', 'aac', 'flac', 'mp4', 'mov', '3gp', 'amr')


def ffmpeg(*args):
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', *args], check=True)


def lire(chemin, filtres):
    """Décode n'importe quel format en mono 44,1 kHz, filtres de nettoyage appliqués."""
    tmp = os.path.join(SORTIE, '_tmp.wav')
    ffmpeg('-i', chemin, '-ac', '1', '-ar', str(SR), '-af', filtres, '-c:a', 'pcm_f32le', tmp)
    _, x = wavfile.read(tmp)
    os.remove(tmp)
    return x.astype(np.float64)


NETTOYAGE = ','.join([
    'highpass=f=85',                       # le grondement, le souffle du téléphone
    'afftdn=nf=-28:tn=1',                  # le bruit de fond de la pièce
    'acompressor=threshold=-22dB:ratio=3:attack=8:release=120:makeup=2',
    'loudnorm=I=-17:TP=-2:LRA=7',          # même niveau d'une réplique à l'autre
])
# Une voix de synthèse n'a ni souffle ni pièce : pas de réduction de bruit, qui la colorerait.
NETTOYAGE_SYNTHESE = ','.join([
    'highpass=f=60',
    'acompressor=threshold=-20dB:ratio=2:attack=10:release=150:makeup=1',
    'loudnorm=I=-17:TP=-2:LRA=7',
])


def niveau_db(x, fenetre=0.03):
    n = int(fenetre * SR)
    k = len(x) // n
    if k == 0:
        return np.array([-120.0])
    blocs = x[: k * n].reshape(k, n)
    return 20 * np.log10(np.sqrt(np.mean(blocs ** 2, axis=1)) + 1e-9)


def rogner(x, seuil=-42, garde=0.04):
    """Retire les silences du début et de la fin, en gardant un souffle d'attaque."""
    db = niveau_db(x)
    voix = np.where(db > seuil)[0]
    if voix.size == 0:
        return x[:0]
    n = int(0.03 * SR)
    a = max(0, voix[0] * n - int(garde * SR))
    b = min(len(x), (voix[-1] + 1) * n + int(garde * 2 * SR))
    return x[a:b]


def decouper_prise(x, attendues, seuil=-40, silence_min=0.55):
    """Une prise complète → répliques, coupées sur les silences de plus de 0,55 s."""
    db = niveau_db(x)
    actif = db > seuil
    n = int(0.03 * SR)
    segments, debut, calme = [], None, 0
    for i, a in enumerate(actif):
        if a:
            if debut is None:
                debut = i
            calme = 0
        elif debut is not None:
            calme += 1
            if calme * 0.03 >= silence_min:
                segments.append((debut, i - calme + 1))
                debut, calme = None, 0
    if debut is not None:
        segments.append((debut, len(actif)))
    # Les bruits brefs (un clic, une respiration) ne sont pas des répliques.
    segments = [(a, b) for a, b in segments if (b - a) * 0.03 > 0.35]
    if len(segments) != attendues:
        raise SystemExit(
            f'La prise contient {len(segments)} passages parlés, il en faut {attendues}. '
            'Laissez au moins une seconde de silence entre deux répliques, ou enregistrez-les une par une.'
        )
    return [x[a * n:b * n] for a, b in segments]


def accelerer(x, facteur):
    tmp_in, tmp_out = os.path.join(SORTIE, '_a.wav'), os.path.join(SORTIE, '_b.wav')
    wavfile.write(tmp_in, SR, x.astype(np.float32))
    ffmpeg('-i', tmp_in, '-af', f'rubberband=tempo={facteur:.4f}:pitchq=quality', '-c:a', 'pcm_f32le', tmp_out)
    _, y = wavfile.read(tmp_out)
    os.remove(tmp_in)
    os.remove(tmp_out)
    return y.astype(np.float64)


def couper_en_lignes(texte, largeur=34):
    """Deux lignes au plus pour un sous-titre, coupées de préférence après une ponctuation."""
    if len(texte) <= largeur:
        return texte
    mots = texte.split(' ')
    meilleur, ecart = None, 10 ** 9
    for i in range(1, len(mots)):
        a, b = ' '.join(mots[:i]), ' '.join(mots[i:])
        penalite = abs(len(a) - len(b)) - (12 if a[-1] in ',.:?…' else 0)
        if penalite < ecart:
            meilleur, ecart = (a, b), penalite
    return '\\N'.join(meilleur)


def horodatage(t):
    h, reste = divmod(max(0.0, t), 3600)
    m, s = divmod(reste, 60)
    return f'{int(h)}:{int(m):02d}:{s:05.2f}'


def ecrire_ass(lignes, chemin, largeur_video=1920, hauteur_video=1080, taille=64, marge_bas=70, style_vertical=False):
    entete = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {largeur_video}
PlayResY: {hauteur_video}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
"""
    if style_vertical:
        # Sur fond papier : encre brune, sans contour.
        entete += f'Style: Voix,Inter Tight SemiBold,{taille},&H0013171A,&H0013171A,&H00E4EFF4,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,80,80,{marge_bas},1\n'
    else:
        # Sur l'image : texte clair dans un bandeau sombre translucide.
        entete += f'Style: Voix,Inter Tight SemiBold,{taille},&H00FFFFFF,&H00FFFFFF,&H4013171A,&H00000000,0,0,0,0,100,100,0,0,3,14,0,2,120,120,{marge_bas},1\n'
    entete += '\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
    corps = ''.join(
        f"Dialogue: 0,{horodatage(l['debut'])},{horodatage(l['fin_sous_titre'])},Voix,,0,0,0,,{couper_en_lignes(l['texte'], 30 if style_vertical else 46)}\n"
        for l in lignes
    )
    with open(chemin, 'w', encoding='utf-8') as f:
        f.write(entete + corps)


def suffixe(langue):
    """Les fichiers de la musique : sans suffixe pour le français, -en pour l'anglais (sa frappe suit sa phrase)."""
    return '' if langue == 'fr' else f'-{langue}'


def echelle(langue):
    """Le rythme de la vidéo (scenes.js, ECHELLE), lu dans les bruitages exportés : 1 à défaut."""
    try:
        with open(os.path.join(SORTIE, f'cues{suffixe(langue)}.json'), encoding='utf-8') as f:
            return float(json.load(f).get('echelle', 1.0))
    except (OSError, ValueError):
        return 1.0


def charger_script(langue, entier=False):
    """Le script, fenêtres passées en temps de vidéo : elles sont écrites en temps de scène."""
    with open(os.path.join(ICI, 'voix', f'script-{langue}.json'), encoding='utf-8') as f:
        script = json.load(f)
    e = echelle(langue)
    for l in script['lignes']:
        for cle in ('debut', 'fin', 'cible'):
            if cle in l:
                l[cle] = round(l[cle] * e, 3)
    return script if entier else script['lignes']


def fichier_de(dossier, nom):
    for ext in EXTENSIONS:
        trouve = glob.glob(os.path.join(dossier, f'{nom}.{ext}'))
        if trouve:
            return trouve[0]
    return None


def preparer(langue):
    script = charger_script(langue, entier=True)
    lignes = script['lignes']
    nettoyage = NETTOYAGE_SYNTHESE if script.get('synthese') else NETTOYAGE
    dossier = os.path.join(ICI, 'voix', langue)
    prise = fichier_de(dossier, 'prise')
    if prise:
        repliques = decouper_prise(lire(prise, nettoyage), len(lignes))
    else:
        repliques = []
        manquantes = [l['id'] for l in lignes if not fichier_de(dossier, l['id'])]
        if manquantes:
            raise SystemExit(f'Il manque les répliques {", ".join(manquantes)} dans {dossier}.')
        for l in lignes:
            repliques.append(lire(fichier_de(dossier, l['id']), nettoyage))

    piste = np.zeros(int(96 * echelle(langue) * SR))
    rapport, trop_longues = [], []
    for l, x in zip(lignes, repliques):
        x = rogner(x)
        fenetre = l['fin'] - l['debut']
        duree = len(x) / SR
        facteur = 1.0
        if duree > fenetre:
            facteur = duree / fenetre
            if facteur > ACCELERATION_MAX:
                trop_longues.append(f"{l['id']} ({duree:.1f} s pour {fenetre:.1f} s)")
                continue
            x = accelerer(x, facteur)
            duree = len(x) / SR
        # Fondu de 15 ms aux deux bouts : pas de clic à la coupe.
        f = min(len(x) // 2, int(0.015 * SR))
        if f:
            x[:f] *= np.linspace(0, 1, f)
            x[-f:] *= np.linspace(1, 0, f)
        i = int(l['debut'] * SR)
        piste[i:i + len(x)] += x
        l['fin_voix'] = round(l['debut'] + duree, 3)
        l['fin_sous_titre'] = round(min(l['fin'] + 0.25, l['debut'] + duree + 0.5), 3)
        rapport.append(f"{l['id']}  {duree:4.2f} s / {fenetre:4.2f} s  {'accélérée ×%.2f' % facteur if facteur > 1 else ''}")
    if trop_longues:
        raise SystemExit('À réenregistrer, un peu plus vite ou plus court : ' + ', '.join(trop_longues))
    # Un sous-titre s'efface avant que le suivant n'arrive.
    for l, suivante in zip(lignes, lignes[1:]):
        l['fin_sous_titre'] = round(min(l['fin_sous_titre'], suivante['debut'] - 0.05), 3)

    crete = np.max(np.abs(piste))
    if crete > 0.95:
        piste *= 0.95 / crete
    wavfile.write(os.path.join(SORTIE, f'voix-{langue}.wav'), SR, (piste * 32767).astype(np.int16))
    ecrire_ass(lignes, os.path.join(SORTIE, f'sous-titres-{langue}.ass'))
    ecrire_srt(lignes, os.path.join(SORTIE, f'sous-titres-{langue}.srt'))
    with open(os.path.join(SORTIE, f'voix-{langue}.json'), 'w', encoding='utf-8') as f:
        json.dump(lignes, f, ensure_ascii=False, indent=1)
    print('\n'.join(rapport))
    print(f'→ sortie/voix-{langue}.wav, sortie/sous-titres-{langue}.ass')


def ecrire_srt(lignes, chemin):
    def ts(t):
        h, r = divmod(max(0.0, t), 3600)
        m, sec = divmod(r, 60)
        return f'{int(h):02d}:{int(m):02d}:{int(sec):02d},{int(round((sec % 1) * 1000)):03d}'
    with open(chemin, 'w', encoding='utf-8') as f:
        for i, l in enumerate(lignes, 1):
            f.write(f"{i}\n{ts(l['debut'])} --> {ts(l['fin_sous_titre'])}\n{couper_en_lignes(l['texte'], 42).replace(chr(92) + 'N', chr(10))}\n\n")


def lire_stereo(nom):
    sr, x = wavfile.read(os.path.join(SORTIE, nom))
    x = x.astype(np.float64) / (32768.0 if x.dtype == np.int16 else 1.0)
    return x if x.ndim == 2 else np.stack([x, x], axis=1)


def mixer(langue):
    """Musique et bruitages s'effacent sous la voix (−9 dB et −5 dB), avec une attaque et un relâchement naturels."""
    musique, sfx = lire_stereo(f'musique-seule{suffixe(langue)}.wav'), lire_stereo(f'bruitages{suffixe(langue)}.wav')
    _, v = wavfile.read(os.path.join(SORTIE, f'voix-{langue}.wav'))
    v = v.astype(np.float64) / 32768.0
    n = min(len(musique), len(sfx))
    v = np.pad(v, (0, max(0, n - len(v))))[:n]
    pas = int(0.01 * SR)
    blocs = len(v) // pas
    db = 20 * np.log10(np.sqrt(np.mean(v[:blocs * pas].reshape(blocs, pas) ** 2, axis=1)) + 1e-9)
    actif = (db > -42).astype(float)
    # Attaque 60 ms, relâchement 400 ms, appliqués bloc par bloc.
    enveloppe = np.zeros(blocs)
    niveau = 0.0
    for i, a in enumerate(actif):
        coef = 1 - np.exp(-0.01 / (0.06 if a > niveau else 0.4))
        niveau += (a - niveau) * coef
        enveloppe[i] = niveau
    enveloppe = np.interp(np.arange(n) / pas, np.arange(blocs), enveloppe)
    gain_musique = 10 ** (-9 * enveloppe / 20)
    gain_sfx = 10 ** (-5 * enveloppe / 20)
    voix = np.stack([v, v], axis=1) * 1.05
    total = musique[:n] * gain_musique[:, None] + sfx[:n] * gain_sfx[:, None] + voix
    total = np.tanh(total / 0.92) * 0.92
    wavfile.write(os.path.join(SORTIE, f'bande-son-{langue}.wav'), SR, (total * 32767).astype(np.int16))
    print(f'→ sortie/bande-son-{langue}.wav (musique −9 dB sous la voix)')


def prompteur(langue):
    """La pub avec, en bas, la réplique à lire : en gris une seconde avant, en clair quand c'est à vous."""
    lignes = charger_script(langue)
    chemin = os.path.join(SORTIE, f'prompteur-{langue}.ass')
    entete = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Bientot,Inter Tight SemiBold,40,&H00C8C8C8,&H00C8C8C8,&H50000000,&H00000000,0,0,0,0,100,100,0,0,3,12,0,8,160,160,40,1
Style: Maintenant,Inter Tight SemiBold,60,&H00FFFFFF,&H00FFFFFF,&H10B45F1A,&H00000000,0,0,0,0,100,100,0,0,3,18,0,2,100,100,60,1
Style: Repere,Inter Tight SemiBold,34,&H00FFFFFF,&H00FFFFFF,&H10B45F1A,&H00000000,0,0,0,0,100,100,0,0,3,10,0,9,60,60,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    corps = ''
    fin_precedente = 0.0
    for l in lignes:
        texte = couper_en_lignes(l['texte'], 46)
        annonce = max(fin_precedente, l['debut'] - 1.6)
        if l['debut'] - annonce > 0.3:
            corps += f"Dialogue: 0,{horodatage(annonce)},{horodatage(l['debut'])},Bientot,,0,0,0,,Ensuite : {l['texte']}\n"
        corps += f"Dialogue: 0,{horodatage(l['debut'])},{horodatage(l['fin'])},Maintenant,,0,0,0,,{texte}\n"
        corps += f"Dialogue: 1,{horodatage(l['debut'])},{horodatage(l['fin'])},Repere,,0,0,0,,Réplique {l['id']}  ·  {l['fin'] - l['debut']:.1f} s\n"
        fin_precedente = l['fin']
    with open(chemin, 'w', encoding='utf-8') as f:
        f.write(entete + corps)
    polices = os.path.join(SORTIE, 'polices')
    ffmpeg('-i', os.path.join(SORTIE, 'image.mp4'), '-i', os.path.join(SORTIE, 'bande-son.wav'),
           '-filter_complex', f"[0:v]ass={chemin}:fontsdir={polices}[v];[1:a]volume=0.35[a]",
           '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '26', '-c:a', 'aac', '-b:a', '128k',
           '-shortest', '-movflags', '+faststart', os.path.join(SORTIE, f'prompteur-{langue}.mp4'))
    print(f'→ sortie/prompteur-{langue}.mp4')


if __name__ == '__main__':
    langue = sys.argv[1] if len(sys.argv) > 1 else 'fr'
    if '--prompteur' in sys.argv:
        prompteur(langue)
    else:
        preparer(langue)
        mixer(langue)
