"""
Une voix off synthétisée, pour une langue qu'on n'enregistre pas soi-même.

Kokoro (82 M de paramètres, licence Apache 2.0) tourne hors ligne, sur le
processeur, sans compte ni service payant. Chaque réplique du script est dite
une première fois à vitesse normale ; si elle ne tient pas dans sa fenêtre
(avec une marge), elle est redite un peu plus vite, jusqu'à ×1,25. voix.py
s'occupe ensuite du reste : silences, placement, accélération finale si
besoin (≤ 15 %), effacement de la musique sous la voix.

    python3 synthese.py en          → voix/en/01.wav … 19.wav
    python3 voix.py en              → sortie/voix-en.wav, sortie/bande-son-en.wav

Il faut le paquet Python `kokoro-onnx`, le modèle quantifié
(`model_quantized.onnx`, ~90 Mo) et les voix (`voices.bin`) : voir le README,
« La version anglaise ». Leurs chemins : KOKORO_MODELE et KOKORO_VOIX.
"""
import json
import os
import sys

import numpy as np
from scipy.io import wavfile

ICI = os.path.dirname(os.path.abspath(__file__))
VOIX = {'en': ('af_heart', 'en-us')}
MARGE = 0.15          # secondes laissées libres en fin de fenêtre
VITESSE_MAX = 1.25


def duree_utile(audio, sr, seuil_db=-40):
    """La durée entre la première et la dernière syllabe, sans les silences de bord."""
    n = int(0.01 * sr)
    blocs = len(audio) // n
    if not blocs:
        return 0.0
    rms = np.sqrt(np.mean(audio[:blocs * n].reshape(blocs, n) ** 2, axis=1))
    actifs = np.nonzero(20 * np.log10(rms + 1e-9) > seuil_db + 20 * np.log10(rms.max() + 1e-9))[0]
    return 0.0 if not len(actifs) else (actifs[-1] - actifs[0] + 1) * n / sr


def main():
    langue = sys.argv[1] if len(sys.argv) > 1 else 'en'
    if langue not in VOIX:
        raise SystemExit(f'Pas de voix de synthèse prévue pour « {langue} ».')
    from kokoro_onnx import Kokoro

    kokoro = Kokoro(os.environ.get('KOKORO_MODELE', 'model_quantized.onnx'), os.environ.get('KOKORO_VOIX', 'voices.bin'))
    voix, accent = VOIX[langue]
    with open(os.path.join(ICI, 'voix', f'script-{langue}.json'), encoding='utf-8') as f:
        lignes = json.load(f)['lignes']
    dossier = os.path.join(ICI, 'voix', langue)
    os.makedirs(dossier, exist_ok=True)
    for l in lignes:
        fenetre = l['fin'] - l['debut'] - MARGE
        vitesse = 1.0
        audio, sr = kokoro.create(l['texte'], voice=voix, speed=vitesse, lang=accent)
        duree = duree_utile(audio, sr)
        if duree > fenetre:
            vitesse = min(VITESSE_MAX, duree / fenetre * 1.02)
            audio, sr = kokoro.create(l['texte'], voice=voix, speed=vitesse, lang=accent)
            duree = duree_utile(audio, sr)
        wavfile.write(os.path.join(dossier, f"{l['id']}.wav"), sr, (np.clip(audio, -1, 1) * 32767).astype(np.int16))
        print(f"{l['id']}  {duree:4.2f} s / {fenetre + MARGE:4.2f} s  vitesse ×{vitesse:.2f}  {l['texte']}")


if __name__ == '__main__':
    main()
