"""
La bande-son de la pub : musique et bruitages, synthétisés de zéro.

Aucun échantillon, aucune banque de sons : tout est calculé ici (numpy, scipy),
donc libre de droits par construction. Tempo 120 (une mesure = 2 s), ré majeur,
grille IV–V–iii–vi. Les bruitages tombent aux instants exportés par l'animation
(sortie/cues.json, `node rendu.mjs --cues`).

    python3 musique.py   → sortie/bande-son.wav (+ sortie/musique-seule.wav, sortie/bruitages.wav)
    LANGUE=en python3 musique.py → la même chose pour la pub en anglais (sortie/cues-en.json) :
                           bande-son-sans-voix-en.wav, musique-seule-en.wav, bruitages-en.wav
"""
import json
import math
import os

import numpy as np
from scipy import signal
from scipy.io import wavfile

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, 'sortie')
LANGUE = os.environ.get('LANGUE', 'fr')
# La version française garde ses noms ; une autre langue a ses propres bruitages (la frappe suit sa phrase).
SUFFIXE = '' if LANGUE == 'fr' else f'-{LANGUE}'


def lire_l_echelle():
    """Le rythme de la vidéo (scenes.js, ECHELLE) : la pub est jouée ×1,2 plus lentement que ses plans."""
    try:
        with open(os.path.join(SORTIE, f'cues{SUFFIXE}.json'), encoding='utf-8') as f:
            return float(json.load(f).get('echelle', 1.0))
    except (OSError, ValueError):
        return 1.0


# Le morceau est écrit en « temps de scène » (tempo 120, une mesure = 2 s) ;
# S() le passe en temps de vidéo, et le tempo ralentit d'autant (120 → 100) :
# les coupes tombent toujours sur les temps, et rien n'est étiré après coup.
ECHELLE = lire_l_echelle()


def S(secondes):
    return secondes * ECHELLE


SR = 44100
DUREE = S(95.0)
N = int(DUREE * SR)
BPM = 120 / ECHELLE
TEMPS = 60 / BPM          # 0,5 s de scène
MESURE = 4 * TEMPS        # 2 s de scène
DOUBLE = TEMPS / 4        # double croche
rng = np.random.default_rng(2026)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def piste():
    return np.zeros((2, N), dtype=np.float64)


def poser(buf, t0, son, gain=1.0, pan=0.0):
    """Ajoute un son mono (ou stéréo) à l'instant t0, avec un panoramique à puissance constante."""
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if son.ndim == 1:
        g = (math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4))
        son = np.vstack([son * g[0], son * g[1]])
    debut = max(0, i0)
    fin = min(N, i0 + son.shape[1])
    if fin <= debut:
        return
    buf[:, debut:fin] += gain * son[:, debut - i0:fin - i0]


def temps(n):
    return np.arange(n) / SR


def enveloppe(n, a=0.005, d=0.1, s=0.7, r=0.2, tenue=None):
    """ADSR échantillon par échantillon ; `tenue` = durée avant le relâchement."""
    t = temps(n)
    tenue = (n / SR - r) if tenue is None else tenue
    e = np.where(t < a, t / max(a, 1e-6), 1.0)
    e = np.where((t >= a) & (t < a + d), 1 - (1 - s) * (t - a) / max(d, 1e-6), e)
    e = np.where((t >= a + d) & (t < tenue), s, e)
    niveau_rel = np.interp(tenue, [0, a, a + d], [0, 1, s]) if tenue < a + d else s
    e = np.where(t >= tenue, niveau_rel * np.clip(1 - (t - tenue) / max(r, 1e-6), 0, 1), e)
    return e


def passe_bas(x, f, ordre=2):
    sos = signal.butter(ordre, min(f, SR / 2 - 100), 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def passe_haut(x, f, ordre=2):
    sos = signal.butter(ordre, f, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def passe_bande(x, f1, f2, ordre=2):
    sos = signal.butter(ordre, [f1, min(f2, SR / 2 - 100)], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def scie(f, n, harmoniques=24, desaccord=0.0):
    t = temps(n)
    k_max = max(1, min(harmoniques, int(18000 / f)))
    x = np.zeros(n)
    phase = rng.uniform(0, 2 * np.pi)
    for k in range(1, k_max + 1):
        x += np.sin(2 * np.pi * k * f * (1 + desaccord) * t + phase * k) / k
    return x * 0.6


def bruit(n):
    return rng.standard_normal(n)


# ---------------------------------------------------------------- instruments

def piano_electrique(midi, duree, vel=0.8):
    """FM à deux opérateurs, rapport 1:1, l'indice retombe : le « tine » d'un Rhodes."""
    n = int((duree + 1.2) * SR)
    t = temps(n)
    f = hz(midi)
    indice = 1.6 * np.exp(-t * 3.2) + 0.25
    mod = np.sin(2 * np.pi * f * t) * indice
    corps = np.sin(2 * np.pi * f * t + mod)
    tine = np.sin(2 * np.pi * f * 14.0 * t) * np.exp(-t * 18) * 0.12
    env = enveloppe(n, a=0.004, d=0.6, s=0.35, r=0.45, tenue=duree) * np.exp(-t * 0.9)
    return (corps + tine) * env * vel * 0.35


def pincement(midi, duree=0.7, vel=0.8, brillance=1.0):
    """Corde pincée : chaque harmonique s'éteint d'autant plus vite qu'elle est aiguë."""
    n = int(duree * SR)
    t = temps(n)
    f = hz(midi)
    x = np.zeros(n)
    for k in range(1, 14):
        if k * f > 16000:
            break
        x += np.sin(2 * np.pi * k * f * t) * (1 / k ** 1.1) * np.exp(-t * (2.5 + 2.2 * k / brillance))
    attaque = np.minimum(1, t / 0.002)
    fin = np.clip((duree - t) / 0.05, 0, 1)
    return x * attaque * fin * vel * 0.32


def nappe(midis, duree, coupure=1800):
    n = int((duree + 1.5) * SR)
    gauche, droite = np.zeros(n), np.zeros(n)
    for m in midis:
        gauche += scie(hz(m), n, 16, -0.004)
        droite += scie(hz(m), n, 16, 0.004)
    env = enveloppe(n, a=0.6, d=0.5, s=0.85, r=1.2, tenue=duree)
    st = np.vstack([gauche, droite]) * env / max(1, len(midis))
    return passe_bas(st, coupure) * 0.55


def basse(midi, duree, vel=0.9):
    n = int((duree + 0.08) * SR)
    t = temps(n)
    f = hz(midi)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    env = enveloppe(n, a=0.006, d=0.12, s=0.75, r=0.06, tenue=duree)
    return np.tanh(1.6 * x * env) * vel * 0.55


def sifflet(notes, t_depart):
    """Mélodie sifflée : sinus avec vibrato qui arrive après l'attaque, glissés entre notes, un souffle."""
    if not notes:
        return np.zeros(1), t_depart
    fin = max(d + l for d, l, m in notes) * TEMPS + 0.5
    n = int(fin * SR)
    t = temps(n)
    freq = np.full(n, np.nan)
    amp = np.zeros(n)
    for debut, longueur, m in notes:
        a, b = int(debut * TEMPS * SR), int((debut + longueur) * TEMPS * SR)
        if m <= 0:
            continue
        freq[a:b] = hz(m)
        seg = np.arange(b - a) / SR
        l = (b - a) / SR
        amp[a:b] = np.minimum(1, seg / 0.03) * np.clip((l - seg) / 0.06, 0, 1) * (0.85 + 0.15 * np.exp(-seg * 4))
    # Glissé : on remplit les silences par la note suivante, puis on lisse la fréquence.
    idx = np.where(~np.isnan(freq))[0]
    freq = np.interp(np.arange(n), idx, freq[idx])
    noyau = np.ones(int(0.035 * SR)) / int(0.035 * SR)
    freq = np.convolve(freq, noyau, mode='same')
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.6 * t) * np.clip((t % 1.0) / 0.25, 0, 1)
    phase = 2 * np.pi * np.cumsum(freq * vib) / SR
    son = np.sin(phase) + 0.05 * np.sin(2 * phase)
    souffle = passe_bande(bruit(n), 1800, 5200) * 0.04
    amp = np.convolve(amp, np.ones(200) / 200, mode='same')
    return (son + souffle) * amp * 0.24, t_depart


# ---------------------------------------------------------------- batterie

def grosse_caisse(vel=1.0):
    n = int(0.5 * SR)
    t = temps(n)
    f = 45 + 95 * np.exp(-t * 28)
    corps = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    clic = passe_haut(bruit(n), 2500) * np.exp(-t * 300) * 0.25
    return np.tanh((corps + clic) * 1.4) * vel * 0.9


def claquement(vel=1.0):
    n = int(0.35 * SR)
    t = temps(n)
    b = passe_bande(bruit(n), 900, 3200)
    env = np.zeros(n)
    for d in (0, 0.011, 0.022):
        env += np.where(t >= d, np.exp(-(t - d) * 90), 0) * 0.6
    env += np.where(t >= 0.03, np.exp(-(t - 0.03) * 16), 0)
    return b * env * vel * 0.45


def charleston(vel=1.0, ouvert=False):
    n = int((0.3 if ouvert else 0.07) * SR)
    t = temps(n)
    return passe_haut(bruit(n), 7000) * np.exp(-t * (12 if ouvert else 70)) * vel * 0.22


def cymbale(duree=2.4, vel=1.0):
    n = int(duree * SR)
    t = temps(n)
    return passe_haut(bruit(n), 4500) * np.exp(-t * 2.2) * vel * 0.25


def montee(duree, vel=1.0):
    """Bruit dont le filtre s'ouvre, plus une scie qui grimpe : la tension avant une coupe."""
    n = int(duree * SR)
    t = temps(n)
    x = bruit(n)
    sortie = np.zeros(n)
    blocs = 64
    taille = n // blocs + 1
    for i in range(blocs):
        a, b = i * taille, min(n, (i + 1) * taille)
        fc = 300 + 7000 * (i / blocs) ** 2
        sortie[a:b] = passe_bande(x[max(0, a - 2000):b], fc * 0.7, fc * 1.3)[-(b - a):]
    f = 110 * 2 ** (2.5 * t / duree)
    ton = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.15
    return (sortie * 0.9 + ton) * (t / duree) ** 2 * vel * 0.5


def impact(vel=1.0):
    n = int(2.2 * SR)
    t = temps(n)
    f = 30 + 40 * np.exp(-t * 6)
    grave = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    souffle = passe_bas(bruit(n), 2500) * np.exp(-t * 9) * 0.5
    return np.tanh((grave + souffle) * 1.3) * vel * 0.8


# ---------------------------------------------------------------- bruitages

def cloche(midi, duree=0.8, vel=0.5):
    n = int(duree * SR)
    t = temps(n)
    f = hz(midi)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 5) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 9) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 14)
    return x * np.minimum(1, t / 0.002) * vel * 0.3


def blip(f0, f1, duree=0.09, vel=0.5):
    n = int(duree * SR)
    t = temps(n)
    f = f1 + (f0 - f1) * np.exp(-t * 60)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * (6 / duree)) * np.minimum(1, t / 0.002) * vel * 0.35


def souffle(duree=0.7, vel=0.5, haut=False):
    n = int(duree * SR)
    t = temps(n)
    x = bruit(n)
    sortie = np.zeros(n)
    blocs = 32
    taille = n // blocs + 1
    for i in range(blocs):
        a, b = i * taille, min(n, (i + 1) * taille)
        p = i / blocs
        fc = (900 if haut else 500) + (3500 if haut else 2600) * math.sin(math.pi * p)
        sortie[a:b] = passe_bande(x[max(0, a - 2000):b], fc * 0.6, fc * 1.5)[-(b - a):]
    env = np.sin(np.pi * np.clip(t / duree, 0, 1)) ** 1.6
    return sortie * env * vel * 0.5


def clic(vel=0.4, couleur=4000):
    n = int(0.03 * SR)
    t = temps(n)
    return passe_bande(bruit(n), couleur * 0.5, couleur * 1.6) * np.exp(-t * 400) * vel


def papier(duree=0.3, vel=0.4):
    n = int(duree * SR)
    t = temps(n)
    grain = np.abs(passe_bas(bruit(n), 40)) * 4
    return passe_bande(bruit(n), 1800, 7000) * grain * np.sin(np.pi * t / duree) * vel * 0.4


def tampon_son(vel=1.0, leger=False):
    n = int(0.35 * SR)
    t = temps(n)
    f = 50 + 60 * np.exp(-t * 40)
    sourd = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 18) * (0.5 if leger else 1)
    claque = passe_bas(bruit(n), 3500) * np.exp(-t * 70) * 0.6
    return np.tanh((sourd + claque) * 1.5) * vel * 0.7


def gribouillis(duree=0.65, vel=0.35):
    n = int(duree * SR)
    t = temps(n)
    mod = (np.sin(2 * np.pi * 13 * t + 2 * np.sin(2 * np.pi * 3 * t)) > 0.1) * 1.0
    mod = np.convolve(mod, np.ones(150) / 150, mode='same')
    return passe_bande(bruit(n), 2500, 8000) * mod * np.sin(np.pi * t / duree) * vel * 0.5


def pluie(duree=1.2, vel=0.3):
    n = int(duree * SR)
    t = temps(n)
    x = passe_bande(bruit(n), 1500, 9000) * 0.25
    for _ in range(40):
        i = rng.integers(0, n - 3000)
        goutte = blip(rng.uniform(2500, 4500), 1500, 0.045, 0.25)
        x[i:i + goutte.size] += goutte
    return x * np.sin(np.pi * t / duree) * vel


def pieces(vel=0.35):
    n = int(0.6 * SR)
    sortie = np.zeros(n)
    for k in range(5):
        a = int(k * 0.06 * SR)
        t = temps(n - a)
        f = rng.uniform(3000, 5200)
        sortie[a:] += (np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * 1.47 * t)) * np.exp(-t * 22) * 0.4
    return sortie * vel


GAMME = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86]  # ré majeur pentatonique


def bruitages(cues):
    buf = piste()
    for c in cues:
        t, ty = c['t'], c['type']
        h = int(c.get('hauteur', 0))
        pan = float(rng.uniform(-0.45, 0.45))
        if ty == 'bulle':
            m = GAMME[(h * 2) % 8 + 2]
            son = np.zeros(int(0.14 * SR))
            premier, second = blip(hz(m + 12), hz(m + 12) * 0.98, 0.07, 0.38), blip(hz(m + 19), hz(m + 19), 0.07, 0.3)
            son[:premier.size] += premier
            son[int(0.05 * SR):int(0.05 * SR) + second.size] += second
            poser(buf, t, son, 0.9, pan)
        elif ty == 'touche':
            poser(buf, t, clic(0.16, 3200 + 800 * (h % 3)), 1, 0.1)
        elif ty == 'pop':
            m = GAMME[h % len(GAMME)] + 12
            poser(buf, t, blip(hz(m) * 1.8, hz(m), 0.08, 0.32 if c.get('doux') else 0.45), 1, pan * 0.6)
        elif ty in ('souffle', 'glisse'):
            haut = ty == 'glisse'
            d = 0.45 if c.get('doux') else (0.55 if haut else 0.75)
            poser(buf, t - 0.05, souffle(d, 0.32 if c.get('doux') else 0.5, haut), 1, pan * 0.4)
        elif ty == 'epingle':
            poser(buf, t + 0.12, cloche(GAMME[5 + h % 4] + 12, 0.5, 0.45), 1, pan)
            poser(buf, t + 0.1, tampon_son(0.25, True), 1, pan)
        elif ty == 'vote':
            poser(buf, t, blip(hz(GAMME[4 + h % 5] + 12) * 1.6, hz(GAMME[4 + h % 5] + 12), 0.1, 0.4), 1, pan)
        elif ty == 'photo':
            poser(buf, t + 0.4, clic(0.5, 3500), 1, pan)
            poser(buf, t + 0.47, clic(0.4, 2500), 1, pan)
            poser(buf, t + 0.5, papier(0.18, 0.4), 1, pan)
        elif ty == 'tap':
            poser(buf, t, clic(0.3, 1800), 1, 0)
        elif ty == 'papier':
            poser(buf, t + 0.3, papier(0.35, 0.5), 1, pan)
        elif ty == 'tampon':
            poser(buf, t, tampon_son(0.9, c.get('leger', False)), 1, 0)
        elif ty == 'swipe':
            poser(buf, t, souffle(0.4, 0.45, True), 1, 0.5 * c.get('sens', 1))
        elif ty == 'scintille':
            for k, m in enumerate((86, 90, 93)):
                poser(buf, t + k * 0.07, cloche(m, 1.2, 0.3), 1, -0.3 + 0.3 * k)
        elif ty == 'gribouillis':
            poser(buf, t, gribouillis(0.7, 0.4), 1, 0.1)
        elif ty == 'montee':
            poser(buf, t, montee(c['fin'] - t, 0.9), 1, 0)
        elif ty == 'notification':
            poser(buf, t, cloche(81, 0.9, 0.55), 1, 0.2)
            poser(buf, t + 0.14, cloche(86, 1.1, 0.5), 1, 0.2)
        elif ty == 'pluie':
            poser(buf, t, pluie(1.3, 0.35), 1, 0.3)
        elif ty == 'declic':
            poser(buf, t, clic(0.4, 2200), 1, 0)
            poser(buf, t + 0.05, blip(1800, 1800, 0.05, 0.2), 1, 0)
        elif ty == 'balayage':
            n = int(1.0 * SR)
            tt = temps(n)
            f = 500 + 900 * tt
            poser(buf, t, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt) * 0.06 + souffle(1.0, 0.18, True), 1, 0)
        elif ty == 'bip':
            poser(buf, t, blip(hz(86), hz(86), 0.09, 0.4), 1, 0)
            poser(buf, t + 0.11, blip(hz(93), hz(93), 0.12, 0.4), 1, 0)
        elif ty == 'pieces':
            poser(buf, t, pieces(0.4), 1, 0.2)
        elif ty == 'net':
            for k, m in enumerate((74, 78, 81)):
                poser(buf, t + k * 0.05, cloche(m + 12, 0.9, 0.3), 1, 0)
        elif ty == 'ding':
            poser(buf, t, cloche(86, 1.4, 0.55), 1, 0.2)
            poser(buf, t + 0.08, cloche(93, 1.4, 0.4), 1, 0.2)
        elif ty == 'niveau':
            for k, m in enumerate((74, 78, 81, 86)):
                poser(buf, t + k * 0.08, cloche(m + 12, 0.9, 0.35), 1, -0.2 + 0.13 * k)
        elif ty == 'impact':
            poser(buf, t, impact(0.6 if c.get('leger') else 1.0), 1, 0)
            poser(buf, t, cymbale(2.2, 0.5 if c.get('leger') else 0.9), 1, 0)
        elif ty == 'final':
            poser(buf, t, impact(1.0), 1, 0)
            poser(buf, t, cymbale(3.0, 0.8), 1, 0)
    return buf


# ---------------------------------------------------------------- composition

ACCORDS = {
    'G': (43, [55, 59, 62, 66]),   # sol maj7
    'A': (45, [57, 61, 64, 71]),   # la (9)
    'F#m': (42, [54, 57, 61, 64]),  # fa# m7
    'Bm': (47, [59, 62, 66, 69]),  # si m7
    'Em': (40, [52, 55, 59, 62, 66]),  # mi m9
    'Asus': (45, [57, 62, 64, 69]),
    'D': (38, [50, 57, 61, 64, 66]),  # ré maj9
}
GRILLE = ['G', 'A', 'F#m', 'Bm']


def accord_a(t):
    """L'accord de la mesure qui commence à t (secondes)."""
    if t < 8:
        return 'Em'
    if t < 10:
        return 'Asus'
    if 84 <= t < 86:
        return 'G'
    if 86 <= t < 88:
        return 'A'
    if t >= 88:
        return 'D'
    # t est en temps de scène : une mesure y dure 2 s.
    return GRILLE[int((t - 10) // 2) % 4]


THEME_1 = [(0, 1, 69), (1, .5, 71), (1.5, 1.5, 74), (3, 1, 76), (4, 1.5, 76), (5.5, .5, 74), (6, 1, 73), (7, 1, 69),
           (8, 1, 73), (9, .5, 74), (9.5, 1.5, 76), (11, 1, 78), (12, 2, 78), (14, 1, 76), (15, 1, 74)]
THEME_2 = [(0, 1, 69), (1, .5, 71), (1.5, 1.5, 74), (3, 1, 76), (4, 1.5, 79), (5.5, .5, 78), (6, 1, 76), (7, 1, 73),
           (8, 1, 74), (9, .5, 76), (9.5, 1.5, 78), (11, 1, 76), (12, 3, 74)]
SIGNATURE = [(0, .5, 74), (.5, .5, 76), (1, .5, 78), (1.5, 2.5, 81)]


def composer():
    musique = piste()
    keys = piste()
    nappes = piste()
    pinc = piste()
    basses = piste()
    batterie = piste()
    lead = piste()
    sidechain = np.ones(N)

    def marquer_kick(t):
        i = int(t * SR)
        n = int(0.32 * SR)
        courbe = 1 - 0.55 * np.exp(-np.arange(n) / SR * 9) * (np.arange(n) / SR < 0.32)
        fin = min(N, i + n)
        sidechain[i:fin] = np.minimum(sidechain[i:fin], courbe[:fin - i])

    # -- 0 → 5,6 s : la conversation qui déborde. Une pulsation qui s'impatiente.
    for k in range(int(S(5.6) / (TEMPS / 2))):
        t = k * TEMPS / 2
        progression = t / S(5.6)
        b = basse(38, TEMPS / 2 * 0.8, 0.35 + 0.4 * progression)
        poser(basses, t, passe_bas(b, 220 + 1600 * progression ** 2), 1, 0)
        poser(batterie, t, charleston(0.25 + 0.5 * progression), 1, 0.25 if k % 2 else -0.25)
        if k % 4 == 2:
            poser(batterie, t, clic(0.12, 1200), 1, 0)

    # -- 6 → 10 s : le constat. Piano seul, dans l'espace.
    for t0, nom in ((S(6.0), 'Em'), (S(8.0), 'Asus')):
        _, notes = ACCORDS[nom]
        for k, m in enumerate(notes):
            poser(keys, t0 + k * 0.03, piano_electrique(m, S(1.8), 0.55), 1.8, -0.3 + 0.15 * k)
        poser(keys, t0 + S(1.5), piano_electrique(notes[-1] + 12, 0.4, 0.3), 1, 0.3)
    poser(nappes, S(6.0), nappe(ACCORDS['Em'][1], S(2.0), 1200), 0.6)
    poser(nappes, S(8.0), nappe(ACCORDS['Asus'][1], S(1.8), 1400), 0.6)
    poser(batterie, S(8.6), montee(S(1.4), 0.7), 1, 0)
    rev = cymbale(S(1.4), 0.7)[::-1]
    poser(batterie, S(10.0) - rev.size / SR, rev, 1, 0)

    # -- 10 → 88 s : le corps du morceau.
    for mesure in range(39):
        t0 = S(10) + mesure * MESURE
        ts = round(t0 / ECHELLE, 6)   # la même mesure, en temps de scène
        nom = accord_a(ts)
        racine, notes = ACCORDS[nom]
        breakdown = 80 <= ts < 84
        vivre = 62 <= ts < 75
        promesses = 84 <= ts < 88
        plein = not breakdown and not promesses

        # Nappe, toujours.
        poser(nappes, t0, nappe(notes, MESURE * 0.95, 900 if breakdown else 1700), 0.75 if breakdown else 0.55)

        # Piano électrique : accord posé, puis deux relances syncopées.
        if not breakdown:
            for k, m in enumerate(notes):
                poser(keys, t0 + k * 0.012, piano_electrique(m, 0.7, 0.5), 1, -0.25 + 0.17 * k)
            for decal, duree, v in ((1.5, 0.35, 0.36), (3.0, 0.6, 0.4)):
                for k, m in enumerate(notes):
                    poser(keys, t0 + decal * TEMPS + k * 0.01, piano_electrique(m, duree, v), 1, -0.25 + 0.17 * k)

        # Arpège pincé, en croches.
        haut = [m + 12 for m in notes[:4]]
        motif = [0, 1, 2, 3, 2, 1, 2, 3]
        if ts >= 14 or breakdown:
            for k, i in enumerate(motif):
                v = 0.55 if k % 2 == 0 else 0.4
                p = pincement(haut[i], 0.6, v, 0.7 if breakdown else 1.0)
                poser(pinc, t0 + k * TEMPS / 2, p, 1, 0.35 if k % 2 else -0.35)

        # Basse.
        if plein or promesses:
            for pas, longueur, oct_ in ((0, 3, 0), (3, 2, 0), (6, 2, 12), (8, 3, 0), (11, 2, 0), (14, 2, 7)):
                m = racine - 12 + oct_ if racine >= 47 else racine + oct_
                poser(basses, t0 + pas * DOUBLE, basse(m, longueur * DOUBLE * 0.92, 0.75), 1, 0)

        # Batterie.
        if plein:
            kicks = (0, 4, 8, 12) if vivre else (0, 6, 8, 11)
            for pas in kicks:
                poser(batterie, t0 + pas * DOUBLE, grosse_caisse(0.95), 1, 0)
                marquer_kick(t0 + pas * DOUBLE)
            for pas in (4, 12):
                poser(batterie, t0 + pas * DOUBLE, claquement(0.9), 1, 0.05)
            for pas in range(16):
                accent = (0.35, 0.18, 0.7, 0.2)[pas % 4]
                poser(batterie, t0 + pas * DOUBLE + rng.normal(0, 0.003), charleston(accent), 1, 0.3)
            if vivre:
                for pas in (2, 6, 10, 14):
                    poser(batterie, t0 + pas * DOUBLE, charleston(0.5, True), 1, -0.3)
            # Roulement avant les grands changements.
            if round(ts + 2) in (44, 62, 76, 80):
                for pas in range(8, 16):
                    poser(batterie, t0 + pas * DOUBLE, claquement(0.25 + 0.07 * (pas - 8)), 1, 0)
            if round(ts) in (14, 44, 62, 76):
                poser(batterie, t0, cymbale(S(2.0), 0.6), 1, 0)
        elif promesses:
            for pas in (0, 8):
                poser(batterie, t0 + pas * DOUBLE, grosse_caisse(0.7), 1, 0)
                marquer_kick(t0 + pas * DOUBLE)
            for pas in (4, 12):
                poser(batterie, t0 + pas * DOUBLE, claquement(0.55), 1, 0.05)
            for pas in range(0, 16, 2):
                poser(batterie, t0 + pas * DOUBLE, charleston(0.3), 1, 0.3)

    poser(batterie, S(82.6), montee(S(2.4), 0.6), 1, 0)

    # -- La mélodie sifflée : le thème, sa réponse, puis la signature finale.
    for debut, theme in ((S(22.0), THEME_1), (S(30.0), THEME_2), (S(46.0), THEME_1), (S(54.0), THEME_2), (S(66.0), THEME_1), (S(74.0), [(n[0], n[1], n[2]) for n in THEME_2])):
        son, t0 = sifflet(theme, debut)
        poser(lead, t0, son, 1, 0.08)
    son, t0 = sifflet([(n[0], n[1], n[2] + 12) for n in THEME_1[:8]], S(66.0))
    poser(lead, t0, son, 0.35, -0.2)

    # -- 88 s : la résolution sur ré, et la signature.
    _, notes = ACCORDS['D']
    for k, m in enumerate(notes):
        poser(keys, S(88.0) + k * 0.03, piano_electrique(m, S(3.5), 0.6), 1, -0.3 + 0.15 * k)
        poser(keys, S(88.0) + k * 0.03, piano_electrique(m + 12, S(3.0), 0.3), 1, 0.3 - 0.15 * k)
    poser(nappes, S(88.0), nappe(notes, S(4.0), 2200), 0.8)
    poser(basses, S(88.0), basse(38, S(3.0), 0.8), 1, 0)
    son, t0 = sifflet(SIGNATURE, S(88.6))
    poser(lead, t0, son, 1, 0)
    for k, m in enumerate((86, 90, 93, 98)):
        poser(pinc, S(88.6) + k * 0.12, pincement(m, 1.6, 0.4), 1, -0.3 + 0.2 * k)

    # -- Mixage.
    plan_reverb = keys * 0.5 + nappes * 0.6 + lead * 0.7 + pinc * 0.35 + batterie * 0.08
    musique = keys * 0.9 * sidechain + nappes * sidechain + pinc * 0.8 + basses * (0.6 + 0.4 * sidechain) + batterie + lead
    return musique, plan_reverb


def reverb(x, duree=2.4):
    n = int(duree * SR)
    t = temps(n)
    ir = np.vstack([bruit(n), bruit(n)]) * np.exp(-t * 6.9 / duree)
    ir = passe_bas(passe_haut(ir, 300), 7000)
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    return np.vstack([signal.fftconvolve(x[c], ir[c])[:N] for c in range(2)]) * 0.5


def normaliser_rms(x, cible_db):
    rms = np.sqrt(np.mean(x ** 2) + 1e-12)
    return x * (10 ** (cible_db / 20) / rms)


def limiter(x, plafond=0.89):
    return np.tanh(x / plafond) * plafond


def ecrire(chemin, x):
    wavfile.write(chemin, SR, (np.clip(x, -1, 1).T * 32767).astype(np.int16))


def main():
    with open(os.path.join(SORTIE, f'cues{SUFFIXE}.json'), encoding='utf-8') as f:
        pub = json.load(f)
    musique, envoi = composer()
    musique = musique + reverb(envoi, 2.6) * 0.55
    sfx = bruitages(pub['cues'])
    sfx = sfx + reverb(sfx * 0.35, 1.2) * 0.4
    # La musique se tait net à la saturation du groupe (5,6 s), puis s'éteint à la fin.
    t = temps(N)
    musique *= np.where((t > S(5.62)) & (t < S(6.0)), 0.0, 1.0)
    fin = pub['duree']
    musique *= np.clip((fin + 0.6 - t) / 1.8, 0, 1)
    sfx *= np.clip((fin + 0.6 - t) / 1.2, 0, 1)
    musique = normaliser_rms(musique, -19.5)
    sfx = normaliser_rms(sfx, -25.0)
    total = limiter(musique + sfx)
    longueur = int((fin + 0.2) * SR)
    nom = 'bande-son.wav' if LANGUE == 'fr' else f'bande-son-sans-voix{SUFFIXE}.wav'
    ecrire(os.path.join(SORTIE, nom), total[:, :longueur])
    ecrire(os.path.join(SORTIE, f'musique-seule{SUFFIXE}.wav'), limiter(musique)[:, :longueur])
    ecrire(os.path.join(SORTIE, f'bruitages{SUFFIXE}.wav'), limiter(sfx)[:, :longueur])
    crete = np.max(np.abs(total))
    print(f'{nom} : {longueur / SR:.1f} s, crête {20 * math.log10(crete):.1f} dBFS, RMS {20 * math.log10(np.sqrt(np.mean(total ** 2))):.1f} dBFS')


if __name__ == '__main__':
    main()
