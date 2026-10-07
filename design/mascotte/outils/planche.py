"""Assemble planche.html : autonome, sans JavaScript, sans rien d'externe.

Usage : python3 planche.py design/mascotte
"""
import re, sys, os

R = sys.argv[1]
css = open(os.path.join(R, 'animations.css')).read()
POSE = {n[:-4]: open(os.path.join(R, 'poses', n)).read().strip() for n in os.listdir(os.path.join(R, 'poses'))}


def svg(nom, taille, extra=''):
    s = POSE[nom]
    return s.replace('<svg ', f'<svg width="{taille}" height="{taille}" ', 1).replace('class="plumio ', f'class="plumio {extra} ' if extra else 'class="plumio ', 1)


# Les règles « joue » et « geste », rejouées au survol dans la planche.
def survol(css):
    out = []
    sec7 = css.split('/* ── 7.')[1].split('/* ── 8.')[0]
    for regle in re.findall(r'[^{}]+\{[^{}]*\}', sec7):
        sel, corps = regle.split('{', 1)
        if '.plumio--joue' not in sel:
            continue
        sel = sel.strip()
        sel = sel.replace('.plumio--joue', '.pose:is(:hover, :focus-within) .plumio')
        out.append(f'{sel} {{{corps}')
    sec6 = css.split('/* ── 6.')[1].split('/* ── 7.')[0]
    for regle in re.findall(r'[^{}]+\{[^{}]*\}', sec6):
        sel, corps = regle.split('{', 1)
        m = re.match(r'\s*\.plumio--geste-([a-z]+)\s+(.*)', sel.strip())
        if not m or '@' in sel:
            continue
        out.append(f'.geste-{m.group(1)}:is(:hover, :focus-within) .plumio {m.group(2)} {{{corps}')
    return '\n'.join(out)


ACCENTS = [('bleu', 'Bleu', '#1a5fb4', '#7ba7e2'), ('lagon', 'Lagon', '#2f8f88', '#7ec6c2'),
           ('ocre', 'Ocre', '#97691d', '#d4a656'), ('mure', 'Mûre', '#9b3b5a', '#d891a8')]

POSES = [
    ('accueil', 'Accueil', 'Il salue de l’aile.', 'Premier lancement, retour après une longue absence.'),
    ('pointer-droite', 'Pointer à droite', 'L’aile tendue vers l’élément.', 'Tutoriel : l’élément est à droite de lui.'),
    ('pointer-gauche', 'Pointer à gauche', 'La même pose, retournée.', 'Tutoriel : l’élément est à gauche. En arabe, remplace « à droite ».'),
    ('pointer-haut', 'Pointer en haut', 'L’aile levée, la tête vers le haut.', 'Tutoriel : la bulle est sous l’élément.'),
    ('pointer-bas', 'Pointer en bas', 'L’aile vers le bas, la tête penchée.', 'Tutoriel : la bulle est au-dessus de l’élément.'),
    ('explique', 'Explique', 'Il déplie une carte.', 'Une aide qui détaille, un écran qui se présente.'),
    ('reflechit', 'Réfléchit', 'L’aile au menton, trois points.', 'Un calcul en cours : propositions, programme.'),
    ('celebre', 'Célèbre', 'Un saut, les deux ailes levées.', 'Destination arrêtée, voyage terminé.'),
    ('attend', 'Attend', 'Debout, il respire. Seule pose qui boucle.', 'Écran vide, attente longue.'),
    ('hors-ligne', 'Hors ligne', 'Il lit son carnet, serein.', 'Pas de réseau : le papier marche toujours.'),
    ('oups', 'Oups', 'Il se gratte la tête, une plume tombe.', 'Une erreur. Embarrassé, pas triste.'),
    ('chut', 'Chut', 'L’aile sur le bec, un clin d’œil.', 'Vote secret : personne ne saura qui a voté quoi.'),
    ('notification', 'Notification', 'Il arrive, une lettre au bec.', 'Demande d’activer les notifications.'),
    ('depart', 'Départ', 'En vol, la valise aux pattes.', 'Jour du départ, voyage qui commence.'),
    ('au-revoir', 'Au revoir', 'Il s’envole en saluant.', 'Fin du tutoriel (« Terminer »).'),
    ('vol', 'Vol', 'Les ailes battent.', 'Entre deux étapes du tutoriel, pendant le trajet.'),
]

GESTES = [
    ('cligne', 'Clignement', 'Un battement de paupière.'),
    ('lissage', 'Lissage', 'Un coup de bec dans les plumes de la poitrine.'),
    ('ebroue', 'Ébrouement', 'Il gonfle ses plumes et se secoue.'),
    ('pas', 'Pas de côté', 'Deux petits pas, puis il revient.'),
    ('regarde', 'Regard alentour', 'En l’air, puis en bas.'),
    ('penche', 'Tête penchée', 'Curieux, il penche la tête.'),
    ('queue', 'Coup de queue', 'Un battement de la queue.'),
    ('pepie', 'Pépiement', 'Le bec s’ouvre deux fois quand la bulle apparaît.'),
]

grille = []
for r in range(5):
    for c in range(5):
        x, y = (c - 2) / 2, (r - 2) / 2
        grille.append(f'.scene:has(.z{r}{c}:hover) .plumio {{ --plumio-regard-x: {x:g}; --plumio-regard-y: {y:g}; }}')
zones = ''.join(f'<span class="z z{r}{c}" style="grid-area:{r + 1}/{c + 1}"></span>' for r in range(5) for c in range(5))

acc_css = '\n'.join(
    f'#acc-{k}:checked ~ .page {{ --accent: {cl}; --accent-sombre: {so}; }}' for k, _, cl, so in ACCENTS)
# radios placées avant .page pour le sélecteur ~ ; les libellés pointent dessus
acc_inputs = ''.join(f'<input class="cache" type="radio" name="acc" id="acc-{k}"{" checked" if i == 0 else ""}>'
                     for i, (k, _, _, _) in enumerate(ACCENTS))
acc_labels = ''.join(f'<label for="acc-{k}" class="choix-acc" style="--c:{cl}"><span aria-hidden="true"></span>{nom}</label>'
                     for k, nom, cl, _ in ACCENTS)

page_css = f"""
@font-face {{ font-family: 'Fraunces'; src: url('../../apps/web/public/polices/fraunces-latin.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }}
@font-face {{ font-family: 'Inter Tight'; src: url('../../apps/web/public/polices/inter-tight-latin.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }}
:root {{ color-scheme: light; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: #f4efe4; color: #1a1713; font: 400 16px/1.5 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }}
.cache {{ position: absolute; opacity: 0; pointer-events: none; }}
.page {{ --accent: #1a5fb4; --accent-sombre: #7ba7e2; max-width: 1240px; margin: 0 auto; padding: 48px 24px 96px; display: flex; flex-direction: column; gap: 64px; }}
{acc_css}
h1, h2 {{ font-family: 'Fraunces', 'Iowan Old Style', Georgia, serif; font-weight: 600; letter-spacing: -0.01em; margin: 0; }}
h1 {{ font-size: 56px; line-height: 1; }}
h2 {{ font-size: 28px; line-height: 1.15; }}
h3 {{ font-size: 16px; font-weight: 600; margin: 0; }}
p {{ margin: 0; }}
.etiquette {{ font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6355; }}
.muet {{ color: #6b6355; }}
.petit {{ font-size: 14px; }}
.entete {{ display: flex; flex-direction: column; gap: 16px; }}
.reglages {{ position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 24px; padding: 12px 16px; background: #fffdf8; border: 1px solid #e6ddcb; border-radius: 12px; }}
.reglages label {{ display: inline-flex; align-items: center; gap: 8px; min-height: 40px; font-size: 14px; cursor: pointer; }}
.choix-acc span {{ width: 20px; height: 20px; border-radius: 6px; background: var(--c); }}
{''.join(f'#acc-{k}:checked ~ .page label[for=acc-{k}] {{ font-weight: 600; }} #acc-{k}:checked ~ .page label[for=acc-{k}] span {{ box-shadow: 0 0 0 2px #fffdf8, 0 0 0 4px var(--c); }}' for k, _, _, _ in ACCENTS)}
#immobile:focus-visible ~ .page .lbl-immobile, {''.join(f'#acc-{k}:focus-visible ~ .page label[for=acc-{k}],' for k, _, _, _ in ACCENTS)} .pose:focus-visible, .geste:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 2px; }}
.case {{ width: 18px; height: 18px; border: 1.5px solid #6b6355; border-radius: 4px; display: inline-block; position: relative; }}
#immobile:checked ~ .page .case {{ background: #3a342b; border-color: #3a342b; }}
#immobile:checked ~ .page .case::after {{ content: ''; position: absolute; inset: 3px 5px 5px 5px; border: solid #fffdf8; border-width: 0 2px 2px 0; transform: rotate(45deg); }}
#immobile:checked ~ .page .plumio, #immobile:checked ~ .page .plumio * {{ animation: none !important; transition: none !important; }}
#immobile:checked ~ .page .plumio-pupille, #immobile:checked ~ .page .plumio-tete-regard {{ transform: none !important; }}
.sep {{ width: 1px; height: 24px; background: #e6ddcb; }}
.section {{ display: flex; flex-direction: column; gap: 24px; }}
.section > header {{ display: flex; flex-direction: column; gap: 8px; max-width: 720px; }}
.carte {{ background: #fffdf8; border: 1px solid #e6ddcb; border-radius: 12px; }}
.sombre {{ background: #1c1915; border-color: #352f26; color: #f4efe4; }}
.sombre .muet, .sombre .etiquette {{ color: #a79c8a; }}
.page .plumio {{ color: var(--accent); }}
.page .sombre .plumio {{ color: var(--accent-sombre); }}
.scenes {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }}
.scene {{ position: relative; height: 320px; display: flex; align-items: center; justify-content: center; overflow: hidden; }}
.scene .zones {{ position: absolute; inset: 0; display: grid; grid-template: repeat(5, 1fr) / repeat(5, 1fr); z-index: 2; }}
.scene:hover .plumio .plumio-pupille {{ animation: none; }}
.scene .legende {{ position: absolute; inset-inline-start: 16px; bottom: 12px; font-size: 12px; }}
{chr(10).join(grille)}
.gestes {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }}
.geste {{ padding: 16px; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; cursor: default; }}
.geste .boite {{ align-self: stretch; height: 136px; display: flex; align-items: center; justify-content: center; background: #faf6ed; border-radius: 8px; }}
.poses {{ display: flex; flex-direction: column; gap: 16px; }}
.pose {{ display: grid; grid-template-columns: 240px minmax(0, 1fr) minmax(0, 1fr); gap: 16px; padding: 16px; align-items: stretch; }}
.pose .texte {{ display: flex; flex-direction: column; gap: 6px; padding: 8px 4px; }}
.pose .nom {{ font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 12px; color: #6b6355; }}
.tailles {{ display: flex; align-items: flex-end; justify-content: space-around; gap: 12px; padding: 16px; border-radius: 8px; }}
.tailles.clair {{ background: #faf6ed; }}
.tailles.sombre {{ background: #131110; border: 1px solid #352f26; }}
.tailles figure {{ margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 11px; color: #6b6355; }}
.tailles.sombre figure {{ color: #a79c8a; }}
.trajet {{ position: relative; height: 240px; overflow: hidden; background: #faf6ed; border-radius: 12px; border: 1px solid #e6ddcb; }}
.cible {{ position: absolute; top: 40px; height: 40px; padding: 0 16px; display: flex; align-items: center; border-radius: 12px; font-size: 15px; font-weight: 600; background: var(--accent); color: #fffdf8; }}
.cible.a {{ inset-inline-start: 48px; }}
.cible.b {{ inset-inline-end: 48px; }}
.voyageur {{ position: absolute; top: 96px; inset-inline-start: 56px; width: 112px; height: 112px; animation: trajet 5s var(--plumio-courbe) infinite; }}
.voyageur > svg {{ position: absolute; inset: 0; }}
.voyageur .p1 {{ animation: vis-a 5s steps(1) infinite; }}
.voyageur .p2 {{ animation: vis-vol 5s steps(1) infinite; }}
.voyageur .p3 {{ animation: vis-b 5s steps(1) infinite; }}
@keyframes trajet {{ 0%, 30% {{ transform: translate(0, 0); }} 34% {{ transform: translate(0, -30px); animation-timing-function: cubic-bezier(.45,0,.55,1); }} 46% {{ transform: translate(calc(100cqw - 290px), -30px); animation-timing-function: var(--plumio-courbe); }} 50%, 80% {{ transform: translate(calc(100cqw - 290px), 0); }} 84% {{ transform: translate(calc(100cqw - 290px), -30px); animation-timing-function: cubic-bezier(.45,0,.55,1); }} 96% {{ transform: translate(0, -30px); animation-timing-function: var(--plumio-courbe); }} 100% {{ transform: translate(0, 0); }} }}
@keyframes vis-a {{ 0% {{ opacity: 1; }} 31% {{ opacity: 0; }} 97% {{ opacity: 1; }} }}
@keyframes vis-vol {{ 0% {{ opacity: 0; }} 31% {{ opacity: 1; }} 49% {{ opacity: 0; }} }}
@keyframes vis-retour {{ 0% {{ opacity: 0; }} 81% {{ opacity: 1; }} 97% {{ opacity: 0; }} }}
.voyageur .p4 {{ animation: vis-retour 5s steps(1) infinite; transform: scaleX(-1); }}
@keyframes vis-b {{ 0% {{ opacity: 0; }} 49% {{ opacity: 1; }} 81% {{ opacity: 0; }} }}
.trajet {{ container-type: inline-size; }}
#immobile:checked ~ .page .voyageur, #immobile:checked ~ .page .voyageur > svg {{ animation: none !important; }}
#immobile:checked ~ .page .voyageur .p2, #immobile:checked ~ .page .voyageur .p3, #immobile:checked ~ .page .voyageur .p4 {{ opacity: 0; }}
@media (prefers-reduced-motion: reduce) {{ .voyageur, .voyageur > svg {{ animation: none !important; }} .voyageur .p2, .voyageur .p3, .voyageur .p4 {{ opacity: 0; }} }}
.mono {{ display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }}
.pastille {{ display: inline-flex; align-items: center; justify-content: center; border-radius: 12px; }}
.regles {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }}
.regles ul {{ margin: 0; padding-inline-start: 20px; display: flex; flex-direction: column; gap: 6px; }}
.regles .carte {{ padding: 20px; display: flex; flex-direction: column; gap: 12px; }}
@media (max-width: 900px) {{
  .pose {{ grid-template-columns: 1fr; }}
  .gestes {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
  .scenes, .regles {{ grid-template-columns: 1fr; }}
  h1 {{ font-size: 40px; }}
}}
"""

parts = []
parts.append(f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plumio · planche</title>
<style>
{css}
</style>
<style>
{page_css}
{survol(css)}
</style>
</head>
<body>
<input class="cache" type="checkbox" id="immobile">
{acc_inputs}
<main class="page">
  <header class="entete">
    <p class="etiquette">Tripora · mascotte</p>
    <h1>Plumio</h1>
    <p class="muet" style="max-width: 640px">Une hirondelle dessinée à l’encre, foulard à la couleur d’accent. Elle accompagne le premier lancement et revient, rarement, dans les écrans vides, hors ligne, les erreurs et les succès.</p>
  </header>

  <div class="reglages">
    <label for="immobile" class="lbl-immobile"><span class="case" aria-hidden="true"></span>Mouvement réduit</label>
    <span class="sep" aria-hidden="true"></span>
    <span class="etiquette">Accent</span>
    {acc_labels}
  </div>

  <section class="section" aria-labelledby="t-repos">
    <header>
      <p class="etiquette">Au repos</p>
      <h2 id="t-repos">Il vit, sans faire le spectacle</h2>
      <p class="muet">Il respire, cligne des yeux, fait deux pas de côté, se lisse les plumes, s’ébroue, regarde en l’air. Survolez une scène : il suit le pointeur des yeux.</p>
    </header>
    <div class="scenes">
      <div class="carte scene">{svg('attend', 200, 'plumio--vie')}<div class="zones" aria-hidden="true">{zones}</div><p class="legende muet">Clair</p></div>
      <div class="carte sombre scene">{svg('attend', 200, 'plumio--vie plumio--sombre')}<div class="zones" aria-hidden="true">{zones}</div><p class="legende muet">Sombre</p></div>
    </div>
  </section>

  <section class="section" aria-labelledby="t-gestes">
    <header>
      <p class="etiquette">Gestes</p>
      <h2 id="t-gestes">Les gestes au repos</h2>
      <p class="muet">Chacun dure moins de 1,2 s et se joue une fois. L’application en tire un au hasard toutes les 8 à 20 secondes. Survolez une carte, ou donnez-lui le focus, pour le jouer.</p>
    </header>
    <div class="gestes">
""")
for k, nom, desc in GESTES:
    parts.append(f'      <div class="carte geste geste-{k}" tabindex="0"><div class="boite">{svg("attend", 112)}</div>'
                 f'<h3>{nom}</h3><p class="petit muet">{desc}</p><p class="nom petit muet" style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px">.plumio--geste-{k}</p></div>\n')
parts.append("""    </div>
  </section>

  <section class="section" aria-labelledby="t-poses">
    <header>
      <p class="etiquette">Poses</p>
      <h2 id="t-poses">Seize poses, de 24 à 160 px</h2>
      <p class="muet">Survolez une pose, ou donnez-lui le focus, pour jouer son geste. En dessous de 40 px, la classe <code>plumio--petit</code> retire les détails.</p>
    </header>
    <div class="poses">
""")
for nom, titre, desc, quand in POSES:
    def bande(theme, extra):
        figs = ''.join(
            f'<figure>{svg(nom, t, (extra + (" plumio--petit" if t < 40 else "")).strip())}<figcaption>{t}</figcaption></figure>'
            for t in (160, 96, 48, 24))
        return f'<div class="tailles {theme}">{figs}</div>'
    parts.append(f'      <article class="carte pose" tabindex="0" aria-labelledby="p-{nom}">'
                 f'<div class="texte"><h3 id="p-{nom}">{titre}</h3><p class="petit">{desc}</p>'
                 f'<p class="petit muet">{quand}</p><p class="nom">poses/{nom}.svg</p></div>'
                 f'{bande("clair", "")}{bande("sombre", "plumio--sombre")}</article>\n')
parts.append(f"""    </div>
  </section>

  <section class="section" aria-labelledby="t-trajet">
    <header>
      <p class="etiquette">Tutoriel</p>
      <h2 id="t-trajet">D’une page à l’autre, il vole</h2>
      <p class="muet">Entre deux étapes, la pose « vol » relie l’ancienne ancre à la nouvelle, puis la pose d’arrivée joue son geste. Le trajet dure de 360 à 600 ms selon la distance.</p>
    </header>
    <div class="trajet" aria-hidden="true">
      <span class="cible a">Nouveau</span>
      <span class="cible b">Mes envies</span>
      <div class="voyageur">{svg('pointer-haut', 112, 'p1')}{svg('vol', 112, 'p2')}{svg('pointer-haut', 112, 'p3')}{svg('vol', 112, 'p4')}</div>
    </div>
  </section>

  <section class="section" aria-labelledby="t-mono">
    <header>
      <p class="etiquette">Une couleur</p>
      <h2 id="t-mono">Dans une pastille, à côté d’un texte</h2>
      <p class="muet">Avec <code>plumio--mono</code>, tout prend la couleur du texte ; le ventre et le blanc de l’œil prennent <code>--plumio-fond</code>.</p>
    </header>
    <div class="mono">
      <span class="pastille" style="width:40px;height:40px;background:#f2ece0;color:#3a342b;--plumio-fond:#f2ece0">{svg('attend', 24, 'plumio--mono plumio--petit')}</span>
      <span class="pastille" style="width:56px;height:56px;background:#f2ece0;color:#3a342b;--plumio-fond:#f2ece0">{svg('attend', 40, 'plumio--mono')}</span>
      <span class="pastille" style="width:72px;height:72px;background:#1b5c58;color:#f0f6f1;--plumio-fond:#1b5c58">{svg('celebre', 56, 'plumio--mono')}</span>
      <span class="pastille" style="width:72px;height:72px;background:#8a5f18;color:#fcf6e9;--plumio-fond:#8a5f18">{svg('chut', 56, 'plumio--mono')}</span>
      <p class="petit muet" style="display:flex;align-items:center;gap:8px">{svg('pointer-droite', 24, 'plumio--petit')}Plumio à 24 px, à côté d’une ligne de texte.</p>
    </div>
  </section>
</main>
</body>
</html>
""")
open(os.path.join(R, 'planche.html'), 'w').write(''.join(parts))
print(len(''.join(parts).encode()) // 1024, 'Ko')
