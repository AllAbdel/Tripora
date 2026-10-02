"""
La version verticale (9:16) pour TikTok, Reels et Shorts — par recadrage,
sans rien reconstruire : la vidéo 16:9 est posée au milieu d'un écran
1080×1920 aux couleurs du carnet, avec le logo en haut, le chapitre en cours,
et en bas de grands sous-titres (la plupart des vidéos verticales se
regardent sans le son).

    python3 vertical.py fr   → sortie/tripora-pub-9x16-fr.mp4
                               (avec la voix si sortie/bande-son-fr.wav existe, sinon la bande-son seule)
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from voix import couper_en_lignes, horodatage

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, 'sortie')
POLICES = os.path.join(SORTIE, 'polices')
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
L, H = 1080, 1920
VIDEO_Y, VIDEO_H = 560, 608
PAPIER = (244, 239, 228)
ENCRE = (26, 23, 19)
MUET = (107, 99, 85)

CHAPITRES = [(14.2, 43.0, '01 — Choisir'), (43.0, 62.0, '02 — Organiser'), (62.0, 75.0, '03 — Vivre'), (75.0, 81.0, '04 — Se souvenir'), (81.0, 85.0, 'Bientôt')]


def fond():
    img = Image.new('RGB', (L, H), PAPIER)
    rng = np.random.default_rng(7)
    grain = (rng.normal(0, 7, (H, L))).clip(-20, 20)
    arr = np.asarray(img).astype(np.float64) + grain[:, :, None]
    yy, xx = np.mgrid[0:H, 0:L]
    vignette = 1 - 0.08 * (((xx - L / 2) / (L * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.7)) ** 2)
    img = Image.fromarray((arr * vignette[:, :, None]).clip(0, 255).astype(np.uint8))
    # Ombre douce sous la vidéo.
    ombre = Image.new('L', (L, H), 0)
    ImageDraw.Draw(ombre).rounded_rectangle((40, VIDEO_Y + 30, L - 40, VIDEO_Y + VIDEO_H + 30), 30, fill=90)
    ombre = ombre.filter(ImageFilter.GaussianBlur(34))
    img = Image.composite(Image.new('RGB', (L, H), (60, 48, 36)), img, ombre)
    d = ImageDraw.Draw(img)
    logo = Image.open(os.path.join(ICI, '../../apps/web/public/icons/icon-512.png')).convert('RGBA').resize((132, 132), Image.LANCZOS)
    img.paste(logo, ((L - 132) // 2, 150), logo)
    fraunces = ImageFont.truetype(os.path.join(POLICES, 'FrauncesSemiBold.ttf'), 104)
    d.text((L / 2, 368), 'Tripora', font=fraunces, fill=ENCRE, anchor='mm')
    img.save(os.path.join(SORTIE, 'vertical-fond.png'))
    masque = Image.new('L', (L, VIDEO_H), 0)
    ImageDraw.Draw(masque).rounded_rectangle((0, 0, L - 1, VIDEO_H - 1), 30, fill=255)
    masque.save(os.path.join(SORTIE, 'vertical-masque.png'))


def sous_titres(langue):
    chemin_voix = os.path.join(SORTIE, f'voix-{langue}.json')
    if os.path.exists(chemin_voix):
        with open(chemin_voix, encoding='utf-8') as f:
            lignes = json.load(f)
    else:
        with open(os.path.join(ICI, 'voix', f'script-{langue}.json'), encoding='utf-8') as f:
            lignes = json.load(f)['lignes']
        for l, suivante in zip(lignes, lignes[1:] + [None]):
            l['fin_sous_titre'] = min(l['fin'] + 0.25, suivante['debut'] - 0.05) if suivante else l['fin'] + 0.3
    entete = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {L}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Voix,Inter Tight SemiBold,72,&H0013171A,&H0013171A,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,8,64,64,1300,1
Style: Chapitre,Inter Tight SemiBold,30,&H00B45F1A,&H00B45F1A,&H00000000,&H00000000,0,0,0,0,100,100,6,0,1,0,0,8,70,70,486,1
Style: Adresse,Inter Tight SemiBold,52,&H00B45F1A,&H00B45F1A,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,0,0,8,70,70,1640,1
Style: Appel,Inter Tight Medium,36,&H00556B6B,&H00556B6B,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,8,70,70,1720,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    corps = ''
    for l in lignes:
        corps += f"Dialogue: 0,{horodatage(l['debut'])},{horodatage(l['fin_sous_titre'])},Voix,,0,0,0,,{{\\fad(120,120)}}{couper_en_lignes(l['texte'], 24)}\n"
    for a, b, nom in CHAPITRES:
        corps += f"Dialogue: 0,{horodatage(a)},{horodatage(b)},Chapitre,,0,0,0,,{{\\fad(250,250)}}{nom.upper()}\n"
    corps += f"Dialogue: 0,{horodatage(88.9)},{horodatage(93.4)},Adresse,,0,0,0,,{{\\fad(300,0)}}tripora-3rg.pages.dev\n"
    corps += f"Dialogue: 0,{horodatage(89.3)},{horodatage(93.4)},Appel,,0,0,0,,{{\\fad(300,0)}}Créez votre premier voyage, sans compte\n"
    chemin = os.path.join(SORTIE, f'vertical-{langue}.ass')
    with open(chemin, 'w', encoding='utf-8') as f:
        f.write(entete + corps)
    return chemin


def main():
    langue = sys.argv[1] if len(sys.argv) > 1 else 'fr'
    fond()
    ass = sous_titres(langue)
    son = os.path.join(SORTIE, f'bande-son-{langue}.wav')
    if not os.path.exists(son):
        son = os.path.join(SORTIE, 'bande-son.wav')
        print('Pas encore de voix : bande-son sans voix, sous-titres du script.')
    sortie = os.path.join(SORTIE, f'tripora-pub-9x16-{langue}.mp4')
    filtre = (
        f'[1:v]scale={L}:{VIDEO_H}:flags=lanczos,format=rgba[v];'
        '[2:v]format=gray[m];[v][m]alphamerge[vr];'
        f'[0:v][vr]overlay=0:{VIDEO_Y}:shortest=1,'
        f'ass={ass}:fontsdir={POLICES},format=yuv420p[out]'
    )
    subprocess.run([
        FFMPEG, '-y', '-loglevel', 'error',
        '-loop', '1', '-framerate', '30', '-i', os.path.join(SORTIE, 'vertical-fond.png'),
        '-i', os.path.join(SORTIE, 'image.mp4'),
        '-loop', '1', '-framerate', '30', '-i', os.path.join(SORTIE, 'vertical-masque.png'),
        '-i', son,
        '-filter_complex', filtre, '-map', '[out]', '-map', '3:a',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-tune', 'animation', '-profile:v', 'high', '-r', '30',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart', sortie,
    ], check=True)
    print(f'→ {sortie}')


if __name__ == '__main__':
    main()
