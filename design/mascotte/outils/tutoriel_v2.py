"""Assemble design/mascotte/tutoriel-v2/index.html : la visite du premier lancement,
version 2. L'accueil de face, puis la création d'un voyage, faite par la personne.
Téléphone et ordinateur ; clair, sombre et arabe (miroir). Autonome, sans JavaScript.

Usage : python3 tutoriel_v2.py design/mascotte
"""
import os, re, sys

R = sys.argv[1]
OUT = os.path.join(R, 'tutoriel-v2')
POSE = {n[:-4]: open(os.path.join(R, 'poses', n)).read().strip() for n in os.listdir(os.path.join(R, 'poses'))}
ANIM = open(os.path.join(R, 'animations.css')).read()
NB = 8  # étapes de la visite après l'accueil


def plumio(nom, taille, extra='plumio--calme'):
    s = POSE[nom].replace(' xmlns="http://www.w3.org/2000/svg"', '')
    return s.replace('<svg ', f'<svg width="{taille}" height="{taille}" ', 1).replace('class="plumio ', f'class="plumio {extra} ', 1)


ICONES = {
    'trips': '<path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 12h18"/>',
    'carte': '<path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10Z"/><circle cx="12" cy="11" r="2.2"/>',
    'budget': '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
    'profil': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'retour': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    'suite': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'loupe': '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    'position': '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>',
    'epingle': '<path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10Z"/><circle cx="12" cy="11" r="2.2"/>',
    'seul': '<circle cx="12" cy="8" r="4"/><path d="M5 21c1.3-3.6 4-5.5 7-5.5s5.7 1.9 7 5.5"/>',
    'couple': '<path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10Z"/>',
    'amis': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.3 3.5-5 6.5-5s5.5 1.7 6.5 5"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14.6c2.6.2 4.4 1.8 5.3 4.4"/>',
    'famille': '<circle cx="8" cy="7" r="3"/><circle cx="16.5" cy="9" r="2.4"/><path d="M2.5 20c.8-3.4 3-5.2 5.5-5.2s4.7 1.8 5.5 5.2M14 20c.5-2.4 1.6-3.8 3.4-3.8s3 1.4 3.6 3.8"/>',
    'surprise': '<path d="M12 3l2.2 5.4L20 9l-4.4 3.8L17 18.5 12 15.5 7 18.5l1.4-5.7L4 9l5.8-.6Z"/>',
    'cible': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
    'mois': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    'fenetre': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M7 14h4M13 17h4"/>',
    'precis': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 15h2M14 15h2"/>',
    'soleil': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
    'tirelire': '<path d="M4 11a7 6 0 0 1 13-3h2v4l-1.5 1.5V17h-3v-2h-5v2H6.5v-3A6 6 0 0 1 4 11Z"/><circle cx="14" cy="10.5" r=".6"/>',
    'pieces': '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
    'eclat': '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/>',
    'valider': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'billet': '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v8a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2Z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
}


def ico(nom, taille=20, cls='ico'):
    return (f'<svg class="{cls}" width="{taille}" height="{taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONES[nom]}</svg>')


# ── Briques de l'application ────────────────────────────────────────────────

def onglets(actif='trips'):
    items = [('trips', 'Trips'), ('carte', 'Carte'), ('budget', 'Budget'), ('profil', 'Profil')]
    return '<nav class="onglets">' + ''.join(
        f'<span class="onglet{" actif" if k == actif else ""}">{ico(k, 22)}<span>{t}</span></span>' for k, t in items) + '</nav>'


def laterale(actif='trips'):
    items = [('trips', 'Trips'), ('carte', 'Carte'), ('budget', 'Budget'), ('profil', 'Profil')]
    nav = ''.join(f'<span class="lien{" actif" if k == actif else ""}">{ico(k, 18)}{t}</span>' for k, t in items)
    return f'<aside class="laterale"><span class="marque">Tripora</span><div class="nav">{nav}</div></aside>'


def assistant(n, question, aide, contenu, pied, ordi=False):
    """Une étape de « Nouveau trip » : en-tête, question, contenu, bouton fixé en bas."""
    prog = ''.join(f'<i class="{"fait" if i < n else ""}"></i>' for i in range(1, 7))
    return (f'<div class="assistant{" large" if ordi else ""}">'
            f'<header class="a-tete"><div class="a-ligne"><span class="rond-retour">{ico("retour", 20)}</span>'
            f'<span class="pastille-creer">{ico("plus", 16)}</span><span class="muet petit">Nouveau trip · Étape {n} sur 6</span></div>'
            f'<div class="a-progression" aria-hidden="true">{prog}</div>'
            f'<h1 class="a-question">{question}</h1><p class="muet petit">{aide}</p></header>'
            f'<main class="a-contenu">{contenu}</main>{pied}</div>')


def pied(libelle='Continuer', actif=True, indice='', fleche=True, cls='', dedans=''):
    ind = f'<p class="indice">{indice}</p>' if indice and not actif else ''
    f = ico('suite', 16) if fleche else ''
    return (f'<div class="a-pied">{ind}<div class="ancre"><button type="button" class="btn primaire plein{"" if actif else " eteint"}{" " + cls if cls else ""}">'
            f'{libelle}{f}</button>{dedans}</div></div>')


def option(titre, desc, icone, choisi=False, compact=False, cls=''):
    coche = f'<span class="coche">{ico("valider", 14)}</span>' if choisi else '<span class="coche vide"></span>'
    return (f'<div class="option{" choisie" if choisi else ""}{" compacte" if compact else ""}{" " + cls if cls else ""}">'
            f'<span class="o-ico">{ico(icone, 18)}</span><span class="o-texte"><strong>{titre}</strong>'
            f'<span class="muet">{desc}</span></span>{coche}</div>')


def champ(placeholder, valeur='', icone='loupe', focus=False, cls='', dedans=''):
    texte = f'<span class="saisie">{valeur}<i class="curseur"></i></span>' if valeur else (
        f'<span class="indication">{placeholder}</span>' + ('<i class="curseur"></i>' if focus else ''))
    return (f'<div class="ancre champ-ancre"><div class="champ{" focus" if focus else ""}{" " + cls if cls else ""}">'
            f'{ico(icone, 18, "ico c-ico") if icone else ""}{texte}</div>{dedans}</div>')


# ── La visite : bulle, perchoir, clavier, bulle repliée ─────────────────────

def progression(n):
    return '<span class="v-prog" aria-hidden="true">' + ''.join(
        f'<i class="{"fait" if i <= n else ""}"></i>' for i in range(1, NB + 1)) + '</span>'


def bulle(n, texte, place='sous fin', queue=40, oiseau=None, ecart=None, terminer=False, largeur=None):
    """`oiseau` : (pose, taille, côté, décalage) — Plumio posé sur le bord haut de la bulle."""
    style = f'--queue:{queue}px'
    if ecart is not None:
        style += f';--ecart:{ecart}px'
    if largeur:
        style += f';width:{largeur}px'
    pied_b = ('<div class="b-pied"><button type="button" class="btn primaire">Terminer la visite</button></div>'
              if terminer else '')
    o = ''
    if oiseau:
        pose, taille, cote, dec = oiseau
        o = f'<div class="oiseau {cote}" style="--oiseau:{dec}px">{plumio(pose, taille)}</div>'
    return (f'<div class="coach {place}" style="{style}"><div class="bulle" role="group" aria-label="Visite guidée">'
            f'<div class="b-haut"><span class="etiquette">Visite guidée</span>{progression(n)}'
            f'<button type="button" class="lien-passer">Passer la visite</button></div>'
            f'<p class="b-texte">{texte}</p>{pied_b}</div>{o}</div>')


def perche(pose, taille, cote='fin', dec=20):
    """Plumio debout sur le bord haut d'un champ."""
    return f'<div class="perche {cote}" style="--oiseau:{dec}px">{plumio(pose, taille)}</div>'


def clavier():
    rangees = ['azertyuiop', 'qsdfghjklm', 'wxcvbn']
    lignes = ''.join('<div class="k-rangee">' + ''.join(f'<span>{c}</span>' for c in r) + '</div>' for r in rangees)
    return (f'<div class="clavier" aria-hidden="true">{lignes}'
            f'<div class="k-rangee"><span class="k-large">123</span><span class="k-espace">espace</span><span class="k-large">OK</span></div></div>')


def bulle_courte(texte):
    return (f'<div class="bulle-courte" role="group" aria-label="Visite guidée">{plumio("regarde-droite", 30, "plumio--calme plumio--petit")}'
            f'<p>{texte}</p><button type="button" class="lien-passer">Passer</button></div>')


def repliee(ordi=False):
    return (f'<div class="repliee{" large" if ordi else ""}"><button type="button" class="r-bouton" aria-label="Reprendre la visite">'
            f'{plumio("attend", 34, "plumio--calme plumio--petit")}</button><span class="r-libelle">Reprendre la visite</span></div>')


# ── Contenus des étapes ─────────────────────────────────────────────────────

GROUPES = [('Seul', 'Un voyage rien qu’à moi', 'seul'), ('En couple', 'À deux', 'couple'),
           ('Entre amis', 'Le groupe décidera ensemble', 'amis'), ('En famille', 'Avec des envies très différentes', 'famille')]


def groupes(choix='Entre amis', projecteur=True):
    cartes = ''.join(option(t, d, i, choisi=(t == choix)) for t, d, i in GROUPES)
    return f'<div class="options{" projecteur" if projecteur else ""}">{cartes}</div>'


def stepper():
    return ('<div class="stepper"><span>Nombre de participants</span><span class="s-boutons">'
            '<span class="s-rond">−</span><strong>4</strong><span class="s-rond">+</span></span></div>')


VILLES = [('Lyon', 'France · aéroport Saint-Exupéry'), ('Lyon-Part-Dieu', 'France · gare'),
          ('Lyons-la-Forêt', 'France · Normandie')]


def suggestions():
    return '<div class="options suggestions">' + ''.join(option(v, d, 'epingle', compact=True) for v, d in VILLES) + '</div>'


MODES_DATES = [('Un mois, sans plus de précision', 'Le plus souple, et souvent le moins cher.', 'mois'),
               ('Entre deux dates', 'Tripora cherchera la période la moins chère.', 'fenetre'),
               ('Des dates précises', 'Vous savez déjà quand vous partez.', 'precis'),
               ('Un week-end', 'Du vendredi soir au dimanche.', 'soleil')]


def modes_dates(choix=None, projecteur=True):
    return (f'<div class="options{" projecteur" if projecteur else ""}">' +
            ''.join(option(t, d, i, choisi=(t == choix), compact=True) for t, d, i in MODES_DATES) + '</div>')


ENVIES = ['Culture et histoire', 'Nature et paysages', 'Gastronomie']
NIVEAUX = ['Non merci', 'Un peu', 'Beaucoup', 'Essentiel']


def envies(choix=None, projecteur_premier=False):
    lignes = []
    for i, axe in enumerate(ENVIES):
        niv = ''.join(f'<span class="niveau{" choisi" if (choix and i == 0 and n == choix) else ""}">{n}</span>' for n in NIVEAUX)
        lignes.append(f'<div class="axe{" projecteur" if (projecteur_premier and i == 0) else ""}"><strong>{axe}</strong><div class="niveaux">{niv}</div></div>')
    return lignes


# ── Les écrans ──────────────────────────────────────────────────────────────

ECRANS = []


def ecran(id, titre, page, montre, geste, avance, tel, pc, note=''):
    ECRANS.append(dict(id=id, titre=titre, page=page, montre=montre, geste=geste, avance=avance, tel=tel, pc=pc, note=note))


# 0. Accueil plein écran
def accueil(ordi):
    taille = 200 if ordi else 168
    return (f'<div class="accueil{" large" if ordi else ""}" role="dialog" aria-modal="true" aria-labelledby="acc-titre">'
            f'<div class="a-oiseau">{plumio("face", taille)}</div>'
            f'<h1 class="titre-accueil">Bonjour, moi c’est Plumio !</h1>'
            f'<p class="texte-accueil">Bienvenue sur Tripora. Je vais vous montrer comment préparer un voyage entre amis. Une minute, promis.</p>'
            f'<div class="a-boutons"><button type="button" class="btn primaire grand focus-visible">C’est parti</button>'
            f'<button type="button" class="btn fantome">Passer</button></div></div>')


ecran('accueil', 'L’accueil, en grand', 'Au premier lancement de l’application, ou après une connexion sur le site',
      'Plumio de face, 160 à 200 px, sur le papier', 'Il arrive en volant, se pose, fait coucou, puis parle pendant qu’on lit',
      '« C’est parti » : il se tourne de profil et s’envole vers « Nouveau ». « Passer » : il salue et s’en va.',
      accueil(False), accueil(True),
      note='Fenêtre modale ; le focus est sur « C’est parti ». Échap = « Passer ».')


# 0b. Le site public : une carte discrète, jamais d'écran plein à l'arrivée
def carte_publique():
    return (f'<button type="button" class="carte-plumio">{plumio("attend", 44, "plumio--calme")}'
            f'<span class="cp-texte"><strong>Découvrir Tripora avec Plumio</strong><span class="muet">Une minute, sans compte</span></span>'
            f'{ico("suite", 18)}</button>')


def site_public(ordi):
    actions = ('<div class="h-actions"><span class="btn primaire grand">Créer un voyage' + ico('suite', 18) + '</span>'
               '<span class="btn secondaire grand">' + ico('billet', 18) + 'J’ai un code d’invitation</span></div>')
    tableau = ('<div class="tableau" aria-hidden="true"><p class="etiquette">Départs de Lyon</p>' +
               ''.join(f'<div class="t-ligne"><span class="titre-lieu">{v}</span><span class="muet">{m}</span></div>'
                       for v, m in [('Lisbonne', 'mai'), ('Porto', 'juin'), ('Séville', 'avril'), ('Naples', 'sept.')]) + '</div>')
    tete = ('<div class="p-entete"><span class="marque">Tripora</span><span class="p-liens"><span>Comment ça marche</span>'
            '<span class="btn secondaire petit">Se connecter</span></span></div>')
    hero = (f'<section class="hero"><div class="h-texte"><p class="etiquette">Voyager à plusieurs</p>'
            f'<h1 class="h-titre">Le voyage entre amis, sans les quinze conversations.</h1>'
            f'<p class="muet">Chacun dit ses envies et son budget. Tripora propose les destinations qui conviennent à tout le groupe.</p>'
            f'{actions}{carte_publique()}</div>{tableau if ordi else ""}</section>')
    return f'<div class="public{" large" if ordi else ""}">{tete}{hero}</div>'


ecran('public', 'Sur le site public : une carte discrète', '/ (site public, sans compte)',
      'Une carte sous les deux boutons de l’en-tête : Plumio en petit, « Découvrir Tripora avec Plumio »',
      'Aucun : il respire et cligne', 'Un appui sur la carte ouvre l’accueil en grand.',
      site_public(False), site_public(True),
      note='Pas de fenêtre plein écran à l’arrivée : Google pénalise les interstitiels. Après une connexion, l’accueil s’ouvre seul.')


# 1. Mes trips
def mes_trips_vide(ordi):
    b = bulle(1, 'Tout commence ici : appuyez sur « Créer un trip ».', 'sous centre',
              oiseau=('pointer-haut', 64, 'fin', 116), ecart=58)
    vide = (f'<div class="vide"><div class="v-logo" aria-hidden="true"></div><h2 class="titre-lieu">Aucun trip pour l’instant</h2>'
            f'<p class="muet">Créez-en un, ou rejoignez celui d’un ami avec son code.</p>'
            f'<div class="ancre"><button type="button" class="btn primaire grand projecteur">{ico("plus", 18)}Créer un trip</button>{b}</div></div>')
    return (f'<header class="tete-page"><div><h1 class="titre">Mes trips</h1></div>'
            f'<span class="btn primaire petit">{ico("plus", 16)}Nouveau</span></header>'
            f'<div class="contenu">{vide}</div>{onglets()}')


def mes_trips_liste():
    b = bulle(1, 'Tout commence ici : appuyez sur « Nouveau ».', 'sous fin', queue=34,
              oiseau=('pointer-haut', 80, 'fin', 40), ecart=86)
    carte = ('<div class="carte voyage"><p class="etiquette">Invité par Inès</p><h2 class="titre-lieu">Week-end de mai</h2>'
             '<p class="muet petit">4 participants · destination à choisir</p></div>')
    return (f'{laterale()}<main class="principal"><header class="tete-page"><div><h1 class="titre">Mes trips</h1></div>'
            f'<div class="ancre"><button type="button" class="btn primaire petit projecteur">{ico("plus", 16)}Nouveau</button>{b}</div></header>'
            f'<div class="contenu">{carte}</div></main>')


ecran('etape-1', 'Étape 1 · « Nouveau »', '/voyages',
      '« Nouveau » ; « Créer un trip » si la liste est vide (téléphone ici, liste vide ; ordinateur, liste non vide)',
      'L’aile (pointer-haut), tapote deux fois à l’apparition de la bulle',
      'L’appui sur le bouton. Plumio s’envole avec la page vers l’étape 2.',
      mes_trips_vide(False), mes_trips_liste())


# 2. Avec qui
def etape2(ordi, cote=False):
    if ordi:
        b = bulle(2, 'Avec qui partez-vous ? Choisissez une réponse.', 'cote', queue=28,
                  oiseau=('pointer-gauche', 72, 'debut', 8), largeur=264)
    else:
        b = bulle(2, 'Avec qui partez-vous ? Choisissez une réponse.', 'sous fin', queue=48,
                  oiseau=('pointer-haut', 56, 'fin', 60), ecart=50)
    contenu = f'<div class="ancre">{groupes()}{b}</div>{stepper()}'
    return assistant(1, 'Avec qui partez-vous ?', 'On pourra inviter les autres juste après.', contenu, pied(), ordi)


ecran('etape-2', 'Étape 2 · Avec qui', '/voyages/nouveau, question 1',
      'Les quatre cartes : « Seul », « En couple », « Entre amis », « En famille »',
      'L’aile, vers les cartes', 'Un appui sur une carte, même sur « Entre amis », déjà cochée par défaut.',
      etape2(False), etape2(True))


# 2 bis. Valide : Plumio sautille jusqu'à « Continuer »
def continuer(ordi, n, question, aide, contenu):
    if ordi:
        b = bulle(n, 'Parfait. Appuyez sur « Continuer ».', 'cote haut', queue=24,
                  oiseau=('pointer-gauche', 72, 'debut', 8), largeur=264)
    else:
        b = bulle(n, 'Parfait. Appuyez sur « Continuer ».', 'sur fin', queue=40,
                  oiseau=('pointer-bas', 56, 'fin', -14), ecart=18)
    return assistant(n - 1, question, aide, contenu,
                     pied(cls='projecteur', dedans=b), ordi)


def contenu_groupes_fait():
    return f'{groupes(choix="Entre amis", projecteur=False)}{stepper()}'


ecran('continuer', 'Entre deux actions : « Continuer »', 'Toutes les questions, dès que la réponse est valide',
      '« Continuer », en bas de l’écran', 'Content (hochement, pépie), puis il sautille jusqu’au bouton et le montre de l’aile',
      'L’appui sur « Continuer ».',
      continuer(False, 2, 'Avec qui partez-vous ?', 'On pourra inviter les autres juste après.', contenu_groupes_fait()),
      continuer(True, 2, 'Avec qui partez-vous ?', 'On pourra inviter les autres juste après.', contenu_groupes_fait()),
      note='La bulle ne change que la première fois ; ensuite, il sautille jusqu’au bouton et le tapote, sans nouveau texte.')


# 3. D'où partez-vous : le bec sur le champ
def etape3(ordi):
    if ordi:
        b = bulle(3, 'Tapez votre ville, puis choisissez-la dans la liste.', 'cote', queue=22, largeur=264)
    else:
        b = bulle(3, 'Tapez votre ville, puis choisissez-la dans la liste.', 'sous fin', queue=48, ecart=14)
    f = champ('Chercher une ville de départ', cls='projecteur', dedans=perche('picore-gauche', 56 if not ordi else 64, 'fin', 18) + b)
    contenu = f'{f}<span class="btn secondaire plein">{ico("position", 16)}Utiliser ma position</span>'
    return assistant(2, 'D’où partez-vous ?', 'Le point de départ change beaucoup le prix.', contenu,
                     pied(actif=False, indice='Choisissez une ville de départ pour continuer.'), ordi)


ecran('etape-3', 'Étape 3 · D’où partez-vous', '/voyages/nouveau, question 2',
      'Le champ « Chercher une ville de départ »',
      'Le bec : debout sur le bord du champ, il le picore trois fois (900 ms), une marque d’encre à l’impact ; il recommence au bout de 6 s, trois fois au plus',
      'Une ville choisie dans la liste.', etape3(False), etape3(True))


# 3 bis. La personne tape : la liste s'ouvre, la bulle passe au-dessus
def etape3_liste(ordi):
    if ordi:
        b = bulle(3, 'Choisissez votre ville dans la liste.', 'cote', queue=22, largeur=264)
    else:
        b = bulle(3, 'Choisissez votre ville dans la liste.', 'sur fin', queue=48, ecart=62)
    f = champ('Chercher une ville de départ', valeur='Lyo', focus=True, cls='projecteur',
              dedans=perche('regarde-gauche', 56 if not ordi else 64, 'fin', 18) + b)
    contenu = f'{f}{suggestions()}'
    return assistant(2, 'D’où partez-vous ?', 'Le point de départ change beaucoup le prix.', contenu,
                     pied(actif=False, indice='Choisissez une ville de départ pour continuer.'), ordi)


ecran('etape-3-liste', 'Étape 3 · la liste s’ouvre', '/voyages/nouveau, question 2, pendant la saisie',
      'Le champ et la liste des villes', 'Il cesse de picorer, se redresse et regarde ce qu’on écrit (regarde-gauche, yeux sur le texte)',
      'Une ville choisie dans la liste : content, puis « Continuer ».', etape3_liste(False), etape3_liste(True),
      note='La bulle passe au-dessus du champ : rien ne cache la saisie ni la liste. Sur ordinateur, elle reste à côté.')


# 3 ter. Téléphone, clavier ouvert : bulle d'une ligne collée au clavier
def etape3_clavier():
    f = champ('Chercher une ville de départ', valeur='Lyo', focus=True, cls='projecteur')
    contenu = f'{f}{suggestions()}'
    corps = assistant(2, 'D’où partez-vous ?', 'Le point de départ change beaucoup le prix.', contenu, '', False)
    return f'<div class="avec-clavier">{corps}<div class="sur-clavier">{bulle_courte("Choisissez votre ville dans la liste.")}{clavier()}</div></div>'


def sans_objet(texte):
    return f'<div class="sans-objet"><p class="muet">{texte}</p></div>'


ecran('etape-3-clavier', 'Téléphone, clavier ouvert', '/voyages/nouveau, question 2, clavier affiché',
      'Le champ et la liste, dans la moitié d’écran qui reste', 'Plumio en petit (30 px) dans la bulle, qui regarde le champ',
      'Une ville choisie.', etape3_clavier(), sans_objet('Sur ordinateur, pas de clavier à l’écran : voir l’état précédent.'),
      note='Une ligne, collée au-dessus du clavier, jamais sur la liste. Elle reprend sa forme quand le clavier se ferme.')


# 4. Où allez-vous
def etape4(ordi):
    texte = 'Vous avez une idée ? Sinon, « Surprends-nous » : Tripora proposera des destinations au groupe.'
    if ordi:
        b = bulle(4, texte, 'cote', queue=28, oiseau=('pointer-gauche', 72, 'debut', 8), largeur=264)
    else:
        b = bulle(4, texte, 'sous fin', queue=48, oiseau=('pointer-haut', 56, 'fin', 60), ecart=50)
    cartes = (option('Surprends-nous', 'Tripora compare les destinations selon vos budgets et vos envies, puis vous votez.', 'surprise', choisi=True) +
              option('On sait déjà où aller', 'Cherchez n’importe quelle ville du monde.', 'cible'))
    contenu = f'<div class="ancre"><div class="options projecteur">{cartes}</div>{b}</div>'
    return assistant(3, 'Où allez-vous ?', 'Ne pas savoir est un très bon point de départ.', contenu, pied(), ordi)


ecran('etape-4', 'Étape 4 · Où allez-vous', '/voyages/nouveau, question 3',
      '« Surprends-nous » et « On sait déjà où aller »',
      'L’aile ; puis le bec sur « Chercher n’importe quelle ville » si la personne choisit « On sait déjà où aller »',
      'Un appui sur « Surprends-nous » ; ou une ville ajoutée après « On sait déjà où aller ».', etape4(False), etape4(True))


# 5. Quand
def etape5(ordi):
    texte = 'Choisissez une façon de dire quand. Plus c’est souple, moins ça coûte.'
    if ordi:
        b = bulle(5, texte, 'cote', queue=28, oiseau=('pointer-gauche', 72, 'debut', 8), largeur=264)
    else:
        b = bulle(5, texte, 'sous fin', queue=48, oiseau=('pointer-haut', 56, 'fin', 60), ecart=50)
    contenu = f'<div class="ancre">{modes_dates()}{b}</div>'
    return assistant(4, 'Quand ?', 'Plus les dates sont souples, moins ça coûte.', contenu,
                     pied(actif=False, indice='Indiquez quand vous aimeriez partir.'), ordi)


def etape5_dates(ordi):
    texte = 'Indiquez le départ et le retour.'
    b = bulle(5, texte, 'sous debut', queue=48, ecart=14)
    dates = (f'<div class="deux-champs"><label class="f-libelle">Départ'
             f'{champ("jj/mm/aaaa", icone="mois", cls="projecteur", dedans=perche("picore-gauche", 56 if not ordi else 64, "fin", 10) + b)}</label>'
             f'<label class="f-libelle">Retour{champ("jj/mm/aaaa", icone="mois")}</label></div>')
    contenu = f'{modes_dates(choix="Des dates précises", projecteur=False)}{dates}'
    return assistant(4, 'Quand ?', 'Plus les dates sont souples, moins ça coûte.', contenu,
                     pied(actif=False, indice='Indiquez quand vous aimeriez partir.'), ordi)


ecran('etape-5', 'Étape 5 · Quand', '/voyages/nouveau, question 4', 'Les quatre façons : un mois, entre deux dates, des dates précises, un week-end',
      'L’aile', 'Un mode choisi ; puis des dates valides (ou un mois, pour « Un mois »).', etape5(False), etape5(True))
ecran('etape-5-dates', 'Étape 5 · les dates', '/voyages/nouveau, question 4, « Des dates précises »',
      'Le champ « Départ », puis « Retour »', 'Le bec sur le champ ; il passe au second quand le premier est rempli',
      'Des dates valides.', etape5_dates(False), etape5_dates(True),
      note='Le champ de date ouvre le calendrier du système, pas le clavier : la bulle reste à sa place.')


# 6. Budget
def etape6(ordi):
    texte = 'Combien par personne, tout compris ?'
    if ordi:
        b = bulle(6, texte, 'cote', queue=22, largeur=264)
    else:
        b = bulle(6, texte, 'sous debut', queue=48, ecart=14)
    modes = ''.join(option(t, d, i, choisi=(t == 'Un maximum par personne'), compact=True) for t, d, i in
                    [('Le moins cher possible', 'Classées par coût total croissant.', 'tirelire'),
                     ('Un maximum par personne', 'Rien au-dessus ne sera proposé au groupe.', 'pieces'),
                     ('On veut être à l’aise', 'Le confort compte autant que le prix.', 'eclat')])
    montant = (f'<label class="f-libelle">Budget par personne, tout compris'
               f'{champ("400", icone=None, cls="projecteur montant", dedans=perche("picore-gauche", 56 if not ordi else 64, "fin", 52) + b)}</label>'
               f'<div class="chips"><span class="chip">300 €</span><span class="chip">600 €</span><span class="chip">1 000 €</span></div>')
    contenu = f'<div class="options">{modes}</div>{montant}'
    return assistant(5, 'Quel budget ?', 'Par personne, tout compris.', contenu,
                     pied(actif=False, indice='Donnez un budget par personne, ou choisissez « le moins cher possible ».'), ordi)


ecran('etape-6', 'Étape 6 · Budget', '/voyages/nouveau, question 5', 'Le champ « Budget par personne »',
      'Le bec', 'Un montant, ou « Le moins cher possible ».', etape6(False), etape6(True))


# 7. Envies, et 8. la fin
def etape7(ordi):
    texte = 'Choisissez au moins une envie.'
    if ordi:
        b = bulle(7, texte, 'cote', queue=28, oiseau=('pointer-gauche', 72, 'debut', 8), largeur=264)
    else:
        b = bulle(7, texte, 'sous fin', queue=48, oiseau=('pointer-haut', 56, 'fin', 60), ecart=50)
    l = envies(projecteur_premier=True)
    contenu = (f'<p class="muet petit">Répondez pour vous, pas pour le groupe.</p><div class="ancre">{l[0]}{b}</div>'
               f'{l[1]}{l[2]}')
    return assistant(6, 'De quoi avez-vous envie ?', 'Ce sont vos envies à vous.', contenu,
                     pied('Créer le voyage', actif=False, indice='Choisissez au moins une envie : sans ça, il n’y a rien à optimiser.', fleche=False), ordi)


def etape8(ordi):
    texte = ('C’est tout ! Ce bouton crée le voyage ; ensuite, vous inviterez le groupe. '
             'Rien n’est créé tant que vous n’appuyez pas dessus.')
    if ordi:
        b = bulle(8, texte, 'cote haut', queue=24, oiseau=('pointer-gauche', 72, 'debut', 8), terminer=True, largeur=264)
    else:
        b = bulle(8, texte, 'sur fin', queue=40, oiseau=('pointer-bas', 56, 'fin', -14), ecart=18, terminer=True)
    l = envies(choix='Beaucoup')
    contenu = f'<p class="muet petit">Répondez pour vous, pas pour le groupe.</p>{l[0]}{l[1]}{l[2]}'
    return assistant(6, 'De quoi avez-vous envie ?', 'Ce sont vos envies à vous.', contenu,
                     pied('Créer le voyage', fleche=False, cls='sans-voile', dedans=b), ordi)


ecran('etape-7', 'Étape 7 · Envies', '/voyages/nouveau, question 6', 'Les envies, en commençant par la première',
      'L’aile', 'Une envie choisie (« Un peu », « Beaucoup » ou « Essentiel »).', etape7(False), etape7(True))
ecran('etape-8', 'Étape 8 · La fin, sans rien créer', '/voyages/nouveau, question 6, une envie choisie',
      '« Créer le voyage », sans insister : ni voile, ni tapotement', 'L’aile, une fois ; puis au revoir',
      '« Terminer la visite » : il s’envole (au-revoir, puis plumio--sort). Ce qui est saisi reste.',
      etape8(False), etape8(True),
      note='La seule bulle avec un bouton. Le voyage n’est jamais créé par la visite.')


# 9. Hors du chemin : la bulle se replie
def repli(ordi):
    if ordi:
        corps = mes_trips_liste().replace(' projecteur', '')
        corps = corps[:corps.index('<div class="coach')] + corps[corps.index('</div></div></div></header>') + len('</div></div></div>'):]
        return corps + repliee(True)
    profil = ('<header class="tete-page"><div><h1 class="titre">Profil</h1></div></header>'
              '<div class="contenu"><div class="carte bloc"><p class="etiquette">Compte</p><p>Invité sur cet appareil</p></div>'
              '<div class="carte bloc"><p class="etiquette">Apparence</p><p>Couleur d’accent, thème</p></div></div>' + onglets('profil'))
    return profil + repliee(False)


ecran('repliee', 'Hors du chemin : la bulle se replie', 'N’importe quelle page, pendant la visite',
      'Rien : Plumio attend dans un coin, à côté de « Reprendre la visite »',
      'Il respire et cligne ; aucun geste', 'Un appui sur Plumio reprend la visite là où elle en était.',
      repli(False), repli(True),
      note='Le voile et le projecteur disparaissent. Échap, ou « Passer la visite » dans la bulle reprise, termine la visite.')


# ── Feuille et page ─────────────────────────────────────────────────────────

CSS = """
@font-face { font-family: 'Fraunces'; src: url('../../../apps/web/public/polices/fraunces-latin.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }
@font-face { font-family: 'Inter Tight'; src: url('../../../apps/web/public/polices/inter-tight-latin.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }
* { box-sizing: border-box; }
body { margin: 0; background: #ebe4d6; color: #1a1713; font: 400 16px/1.5 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.cache { position: absolute; opacity: 0; pointer-events: none; }
h1, h2, h3, p { margin: 0; }
button { font: inherit; }
.doc { max-width: 1340px; margin: 0 auto; padding: 48px 24px 96px; display: flex; flex-direction: column; gap: 56px; }
.doc > header h1 { font: 600 48px/1.05 'Fraunces', Georgia, serif; letter-spacing: -0.01em; }
.doc h2.e-titre { font: 600 28px/1.15 'Fraunces', Georgia, serif; }
.doc .etiq { font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6355; }
.doc .muet-doc { color: #6b6355; }
.choix { position: sticky; top: 0; z-index: 20; display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; background: #fffdf8; border: 1px solid #e6ddcb; border-radius: 12px; align-self: flex-start; }
.choix label { min-height: 40px; display: inline-flex; align-items: center; padding: 0 14px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; color: #3a342b; }
#v-clair:checked ~ .doc label[for=v-clair], #v-sombre:checked ~ .doc label[for=v-sombre],
#v-ar:checked ~ .doc label[for=v-ar], #v-ar-sombre:checked ~ .doc label[for=v-ar-sombre] { background: #3a342b; color: #fffdf8; }
#v-clair:focus-visible ~ .doc label[for=v-clair], #v-sombre:focus-visible ~ .doc label[for=v-sombre],
#v-ar:focus-visible ~ .doc label[for=v-ar], #v-ar-sombre:focus-visible ~ .doc label[for=v-ar-sombre] { outline: 2px solid #1a5fb4; outline-offset: 2px; }
.regles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.regle { background: #fffdf8; border: 1px solid #e6ddcb; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.regle h3 { font-size: 16px; font-weight: 600; }
.regle ul { margin: 0; padding-inline-start: 18px; display: flex; flex-direction: column; gap: 4px; }
.etape { display: flex; flex-direction: column; gap: 20px; }
.etape-tete { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 8px 32px; align-items: end; }
.fiche { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; font-size: 14px; margin: 0; }
.fiche dt { color: #6b6355; } .fiche dd { margin: 0; }
.cadres { display: flex; gap: 24px; align-items: flex-start; padding-bottom: 28px; }
.cadres figure { margin: 0; position: relative; flex-shrink: 0; }
.cadres figure > .maq { position: absolute; top: 0; left: 0; zoom: 0.75; }
.cadres figcaption { position: absolute; top: calc(100% + 8px); font-size: 12px; color: #6b6355; }
.cadre-tel { width: 292.5px; height: 633px; }
.cadre-pc { width: 960px; height: 600px; }
@media (max-width: 1340px) { .cadres { flex-wrap: wrap; overflow-x: auto; overscroll-behavior-x: contain; } }
@media (max-width: 900px) { .doc { padding: 32px 16px 64px; } .regles, .etape-tete { grid-template-columns: minmax(0, 1fr); } }

/* ── la maquette : jetons de l'application ── */
.maq { --surface: #fffdf8; --surface-muted: #f4efe4; --surface-raised: #fffdf8; --border-subtle: #e6ddcb; --border-fort: #d4c7ae;
  --text-strong: #1a1713; --text-muted: #6b6355; --accent: #1a5fb4; --accent-contrast: #fffdf8; --accent-doux: #d9e6f8;
  --voile: rgb(26 23 19 / 0.52); --chip: #f2ece0; --clavier: #d9d2c4; --touche: #fffdf8;
  --ombre-bulle: 0 1px 2px rgb(58 52 43 / 0.06), 0 12px 28px -18px rgb(58 52 43 / 0.5);
  position: relative; overflow: hidden; background: var(--surface-muted); color: var(--text-strong);
  font: 400 15px/1.45 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border: 1px solid #d4c7ae; }
#v-sombre:checked ~ .doc .maq, #v-ar-sombre:checked ~ .doc .maq {
  --surface: #1c1915; --surface-muted: #131110; --surface-raised: #242019; --border-subtle: #352f26; --border-fort: #4a4234;
  --text-strong: #f4efe4; --text-muted: #a79c8a; --accent: #7ba7e2; --accent-contrast: #131110; --accent-doux: #0e3a72;
  --voile: rgb(0 0 0 / 0.5); --chip: #2a251f; --clavier: #2a251f; --touche: #3a342b;
  --ombre-bulle: 0 12px 28px -14px rgb(0 0 0 / 0.8); border-color: #4a4234; }
#v-sombre:checked ~ .doc .maq .plumio, #v-ar-sombre:checked ~ .doc .maq .plumio {
  --plumio-trait: #e6ddcb; --plumio-dos: #524b3f; --plumio-ventre: #f2ece0; --plumio-or: #d4a656; }
#v-ar:checked ~ .doc .maq, #v-ar-sombre:checked ~ .doc .maq { direction: rtl; }
#v-ar:checked ~ .doc .maq .oiseau, #v-ar-sombre:checked ~ .doc .maq .oiseau,
#v-ar:checked ~ .doc .maq .perche, #v-ar-sombre:checked ~ .doc .maq .perche,
#v-ar:checked ~ .doc .maq .bulle-courte .plumio, #v-ar-sombre:checked ~ .doc .maq .bulle-courte .plumio,
#v-ar:checked ~ .doc .maq .rond-retour .ico, #v-ar-sombre:checked ~ .doc .maq .rond-retour .ico,
#v-ar:checked ~ .doc .maq .ico-suite, #v-ar-sombre:checked ~ .doc .maq .ico-suite { transform: scaleX(-1); }
#v-ar:checked ~ .doc .maq .coach.cote .bulle::before, #v-ar-sombre:checked ~ .doc .maq .coach.cote .bulle::before { transform: rotate(135deg); }
.maq .plumio { color: var(--accent); }
.tel { width: 390px; height: 844px; border-radius: 36px; display: flex; flex-direction: column; }
.pc { width: 1280px; height: 800px; border-radius: 12px; display: flex; }
.maq .titre { font: 600 28px/1.1 'Fraunces', 'Iowan Old Style', Georgia, serif; letter-spacing: -0.01em; }
.maq .titre-lieu { font: 600 20px/1.2 'Fraunces', 'Iowan Old Style', Georgia, serif; }
.maq .etiquette { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); }
.maq .muet { color: var(--text-muted); }
.maq .petit { font-size: 13px; }
.marque { font: 600 24px/1 'Fraunces', Georgia, serif; }
.tete-page { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 28px 16px 12px; }
.contenu { flex: 1; padding: 4px 16px 16px; display: flex; flex-direction: column; gap: 12px; }
.carte { background: var(--surface-raised); border: 1px solid var(--border-subtle); border-radius: 12px; }
.bloc { padding: 16px; display: flex; flex-direction: column; gap: 6px; }
.voyage { padding: 16px; display: flex; flex-direction: column; gap: 4px; max-width: 420px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 44px; padding: 0 16px; border-radius: 12px; border: 0;
  font: 600 15px/1 'Inter Tight', -apple-system, 'Segoe UI', sans-serif; white-space: nowrap; }
.btn.petit { height: 40px; padding: 0 14px; font-size: 14px; }
.btn.grand { height: 52px; padding: 0 20px; font-size: 16px; }
.btn.plein { width: 100%; height: 52px; font-size: 16px; }
.btn.primaire { background: var(--accent); color: var(--accent-contrast); }
.btn.secondaire { background: var(--surface-raised); color: var(--text-strong); border: 1px solid var(--border-fort); }
.btn.fantome { background: transparent; color: var(--text-muted); }
.btn.eteint { opacity: 0.45; }
.focus-visible { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent); }
.onglets { display: grid; grid-template-columns: repeat(4, 1fr); padding: 8px 8px 24px; background: var(--surface); border-top: 1px solid var(--border-subtle); position: relative; z-index: 1; margin-top: auto; }
.onglet { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; color: var(--text-muted); padding: 6px 0; }
.onglet.actif { color: var(--accent); font-weight: 600; }
.laterale { width: 248px; flex-shrink: 0; padding: 24px 16px; display: flex; flex-direction: column; gap: 24px; background: var(--surface); border-inline-end: 1px solid var(--border-subtle); }
.laterale .marque { padding: 0 12px; }
.nav { display: flex; flex-direction: column; gap: 2px; }
.lien { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 12px; border-radius: 8px; font-size: 14px; color: var(--text-muted); }
.lien.actif { background: var(--chip); color: var(--text-strong); font-weight: 600; }
.principal { flex: 1; min-width: 0; display: flex; flex-direction: column; max-width: 960px; margin: 0 auto; padding: 0 24px; }
.principal .tete-page { padding: 40px 0 16px; }
.principal .contenu { padding: 0; }
.vide { margin-top: 32px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 0 12px; }
.v-logo { width: 64px; height: 64px; border-radius: 16px; background: var(--accent-doux); margin-bottom: 8px; }

/* l'assistant « Nouveau trip » */
.assistant { position: relative; flex: 1; display: flex; flex-direction: column; width: 100%; }
.assistant.large { max-width: 672px; margin: 0 auto; }
.a-tete { padding: 20px 20px 0; display: flex; flex-direction: column; gap: 6px; }
.a-ligne { display: flex; align-items: center; gap: 8px; margin-inline-start: -8px; }
.rond-retour { width: 44px; height: 44px; display: inline-grid; place-items: center; border-radius: 50%; color: var(--text-muted); }
.pastille-creer { width: 26px; height: 26px; border-radius: 8px; display: inline-grid; place-items: center; background: var(--accent); color: var(--accent-contrast); }
.a-progression { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin: 8px 0 10px; }
.a-progression i { height: 5px; border-radius: 3px; background: var(--border-subtle); }
.a-progression i.fait { background: var(--accent); }
.a-question { font: 600 26px/1.15 'Fraunces', 'Iowan Old Style', Georgia, serif; letter-spacing: -0.01em; }
.a-contenu { flex: 1; padding: 20px 20px 160px; display: flex; flex-direction: column; gap: 14px; }
.a-pied { position: absolute; inset-inline: 0; bottom: 0; padding: 12px 20px 28px; background: var(--surface); border-top: 1px solid var(--border-subtle); z-index: 1; }
.assistant.large .a-pied { padding-bottom: 20px; }
.indice { margin: 0 0 8px; text-align: center; font-size: 12px; color: var(--text-muted); }
.options { display: flex; flex-direction: column; gap: 10px; border-radius: 14px; }
.option { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 14px; background: var(--surface-raised); border: 1px solid var(--border-subtle); }
.option.compacte { padding: 10px 14px; }
.option.choisie { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.o-ico { width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: inline-grid; place-items: center; background: var(--chip); }
.option.compacte .o-ico { width: 32px; height: 32px; }
.o-texte { flex: 1; display: flex; flex-direction: column; font-size: 14px; line-height: 1.35; }
.o-texte strong { font-size: 15px; }
.coche { width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; display: inline-grid; place-items: center; background: var(--accent); color: var(--accent-contrast); }
.coche.vide { background: transparent; border: 1.5px solid var(--border-fort); }
.stepper { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 14px; background: var(--surface-raised); border: 1px solid var(--border-subtle); font-size: 14px; }
.s-boutons { display: flex; align-items: center; gap: 14px; }
.s-rond { width: 36px; height: 36px; border-radius: 50%; display: inline-grid; place-items: center; border: 1px solid var(--border-fort); font-size: 18px; }
.ancre.champ-ancre { position: relative; z-index: auto; }
.ancre.champ-ancre:has(.projecteur, .coach, .perche) { z-index: 3; }
.champ { display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 16px; border-radius: 12px; background: var(--surface-raised); border: 1.5px solid var(--border-fort); font-size: 16px; }
.champ.focus { border-color: var(--accent); }
.champ.montant::after { content: '€'; margin-inline-start: auto; color: var(--text-muted); }
.c-ico { color: var(--text-muted); flex-shrink: 0; }
.indication { color: var(--text-muted); }
.saisie { display: inline-flex; align-items: center; }
.curseur { display: inline-block; width: 1.5px; height: 20px; background: var(--accent); margin-inline-start: 1px; }
.deux-champs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.f-libelle { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 8px; background: var(--chip); font-size: 13px; }
.axe { padding: 12px; border-radius: 16px; background: var(--surface-raised); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.niveaux { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.niveau { height: 36px; display: inline-grid; place-items: center; border-radius: 10px; background: var(--chip); font-size: 12px; font-weight: 500; }
.niveau.choisi { background: var(--accent); color: var(--accent-contrast); }

/* ── la visite ── */
.ancre { position: relative; z-index: 3; }
.projecteur { position: relative; box-shadow: 0 0 0 3px var(--surface-muted), 0 0 0 5px var(--accent), 0 0 0 1600px var(--voile); }
.a-pied .projecteur { box-shadow: 0 0 0 3px var(--surface), 0 0 0 5px var(--accent), 0 0 0 1600px var(--voile); }
.a-pied:has(.projecteur) { z-index: 3; }
.a-pied:has(.coach) { z-index: 3; }
.coach { --ecart: 16px; position: absolute; z-index: 4; width: 288px; font-weight: 400; }
.pc .coach { width: 300px; }
.coach.sous { top: calc(100% + var(--ecart)); }
.coach.sur { bottom: calc(100% + var(--ecart)); }
.coach.fin { inset-inline-end: 0; }
.coach.debut { inset-inline-start: 0; }
.coach.centre { left: 50%; transform: translateX(-50%); }
.coach.cote { inset-inline-start: calc(100% + 28px); top: -6px; }
.coach.cote.haut { top: auto; bottom: 0; }
.bulle { position: relative; background: var(--surface-raised); color: var(--text-strong); border: 1px solid var(--border-fort); border-radius: 12px;
  box-shadow: var(--ombre-bulle); padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 8px; }
.bulle::before { content: ''; position: absolute; width: 14px; height: 14px; background: var(--surface-raised); border: solid var(--border-fort); border-width: 1px 0 0 1px; }
.coach.sous.fin .bulle::before { top: -8px; inset-inline-end: var(--queue); transform: rotate(45deg); }
.coach.sous.debut .bulle::before { top: -8px; inset-inline-start: var(--queue); transform: rotate(45deg); }
.coach.sous.centre .bulle::before { top: -8px; left: calc(50% - 7px); transform: rotate(45deg); }
.coach.sur .bulle::before { bottom: -8px; inset-inline-end: var(--queue); transform: rotate(225deg); }
.coach.cote .bulle::before { inset-inline-start: -8px; top: var(--queue); transform: rotate(-45deg); }
.coach.cote.haut .bulle::before { top: auto; bottom: var(--queue); }
.b-haut { display: flex; align-items: center; gap: 10px; }
.v-prog { display: flex; gap: 3px; margin-inline-end: auto; }
.v-prog i { width: 10px; height: 4px; border-radius: 2px; background: var(--border-subtle); }
.v-prog i.fait { background: var(--accent); }
.lien-passer { background: none; border: 0; padding: 0 2px; min-height: 32px; font-size: 13px; font-weight: 500; color: var(--text-muted); text-decoration: underline; text-underline-offset: 2px; }
.b-texte { font-size: 15px; line-height: 1.45; }
.pc .b-texte { font-size: 16px; }
.b-pied { display: flex; justify-content: flex-end; padding-top: 4px; }
.oiseau { position: absolute; line-height: 0; bottom: calc(100% - 4px); }
.oiseau.fin { inset-inline-end: var(--oiseau); }
.oiseau.debut { inset-inline-start: var(--oiseau); }
.oiseau svg, .perche svg { display: block; }
.perche { position: absolute; line-height: 0; bottom: calc(100% - 3px); z-index: 5; }
.perche.fin { inset-inline-end: var(--oiseau); }
.perche.debut { inset-inline-start: var(--oiseau); }

/* clavier ouvert */
.avec-clavier { position: relative; flex: 1; display: flex; flex-direction: column; }
.sur-clavier { position: absolute; inset-inline: 0; bottom: 0; z-index: 6; }
.clavier { direction: ltr; background: var(--clavier); padding: 8px 4px 28px; display: flex; flex-direction: column; gap: 8px; }
.k-rangee { display: flex; justify-content: center; gap: 5px; }
.k-rangee span { width: 33px; height: 42px; border-radius: 6px; background: var(--touche); display: inline-grid; place-items: center; font-size: 16px; box-shadow: 0 1px 0 rgb(0 0 0 / 0.15); }
.k-rangee .k-large { width: 64px; font-size: 13px; }
.k-rangee .k-espace { width: 180px; font-size: 13px; color: var(--text-muted); }
.bulle-courte { margin: 0 8px 8px; display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 6px 10px; border-radius: 12px;
  background: var(--surface-raised); border: 1px solid var(--border-fort); box-shadow: var(--ombre-bulle); }
.bulle-courte p { flex: 1; font-size: 14px; line-height: 1.3; }
.bulle-courte .plumio { flex-shrink: 0; }

/* bulle repliée */
.repliee { position: absolute; inset-inline-end: 16px; bottom: 96px; z-index: 6; display: flex; align-items: center; gap: 8px; flex-direction: row-reverse; }
.repliee.large { bottom: 24px; inset-inline-end: 24px; }
.r-bouton { width: 56px; height: 56px; border-radius: 50%; display: inline-grid; place-items: center; background: var(--surface-raised);
  border: 1px solid var(--border-fort); box-shadow: 0 0 0 2px var(--surface-muted), 0 0 0 4px var(--accent), var(--ombre-bulle); padding: 0; }
.r-libelle { font-size: 13px; font-weight: 600; padding: 6px 10px; border-radius: 8px; background: var(--surface-raised); border: 1px solid var(--border-subtle); }

/* l'accueil */
.accueil { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 14px;
  padding: 32px 28px 40px; background: var(--surface); }
.accueil.large { gap: 16px; }
.a-oiseau { margin-bottom: 8px; line-height: 0; }
.titre-accueil { font: 600 30px/1.1 'Fraunces', 'Iowan Old Style', Georgia, serif; letter-spacing: -0.01em; }
.accueil.large .titre-accueil { font-size: 40px; }
.texte-accueil { max-width: 34ch; color: var(--text-muted); font-size: 16px; }
.accueil.large .texte-accueil { font-size: 18px; max-width: 40ch; }
.a-boutons { display: flex; flex-direction: column; align-items: stretch; gap: 8px; width: 100%; max-width: 320px; margin-top: 12px; }
.accueil.large .a-boutons { flex-direction: row; justify-content: center; max-width: none; width: auto; }

/* le site public */
.public { flex: 1; display: flex; flex-direction: column; background: var(--surface-muted); overflow: hidden; }
.p-entete { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; }
.p-liens { display: flex; align-items: center; gap: 16px; font-size: 14px; color: var(--text-muted); }
.public:not(.large) .p-liens > span:first-child { display: none; }
.hero { display: grid; gap: 32px; padding: 16px 20px 40px; }
.public.large .hero { grid-template-columns: 1.2fr 0.8fr; align-items: center; padding: 56px 96px; gap: 64px; }
.h-texte { display: flex; flex-direction: column; gap: 18px; }
.h-titre { font: 600 38px/1.04 'Fraunces', Georgia, serif; letter-spacing: -0.01em; }
.public.large .h-titre { font-size: 56px; }
.h-actions { display: flex; flex-direction: column; gap: 10px; }
.public.large .h-actions { flex-direction: row; }
.carte-plumio { display: flex; align-items: center; gap: 12px; padding: 8px 14px 8px 8px; border-radius: 14px; background: var(--surface-raised);
  border: 1px solid var(--border-subtle); color: var(--text-strong); text-align: start; align-self: flex-start; min-height: 60px; }
.cp-texte { display: flex; flex-direction: column; font-size: 14px; line-height: 1.3; }
.tableau { padding: 20px; border-radius: 12px; background: var(--surface-raised); border: 1px solid var(--border-subtle); transform: rotate(0.6deg); display: flex; flex-direction: column; gap: 10px; }
.t-ligne { display: flex; justify-content: space-between; padding-top: 10px; border-top: 1px solid var(--border-subtle); }
.sans-objet { width: 1280px; height: 800px; display: grid; place-items: center; background: var(--surface-muted); font-size: 22px; }
"""

VARIANTES = [('v-clair', 'Clair'), ('v-sombre', 'Sombre'), ('v-ar', 'Arabe (miroir)'), ('v-ar-sombre', 'Arabe, sombre')]

REGLES = [
    ('L’accueil', [
        'Écran plein, centré, sur le papier ; fenêtre modale, focus sur « C’est parti ».',
        'Plumio de face, 168 px (téléphone) à 200 px (ordinateur) : arrive, salue, puis parle tant qu’on lit.',
        '« C’est parti » : il se tourne (520 ms) et s’envole vers la première cible.',
        'Sur le site public sans compte : jamais à l’arrivée, seulement depuis la carte « Découvrir Tripora avec Plumio ».']),
    ('Bouton ou option : l’aile', [
        'Plumio se pose sur le bord haut de sa bulle, côté cible, et la montre de l’aile.',
        'Il tapote l’air deux fois quand la bulle apparaît, puis encore au bout de 6 s sans action.',
        'Entre la cible et la bulle : la hauteur de Plumio (50 à 86 px), pour ne jamais la cacher.',
        'Sur ordinateur, la bulle se met à côté de la colonne de l’assistant.']),
    ('Champ : le bec', [
        'Plumio se tient sur le bord haut du champ, côté fin de ligne, et regarde vers le début.',
        'Il picore trois fois (900 ms), une marque d’encre à l’impact ; il recommence à 6 s, trois fois au plus.',
        'Dès qu’on tape, il s’arrête, se redresse (regarde-*) et suit le texte des yeux.',
        'La bulle passe au-dessus du champ dès que la liste s’ouvre.']),
    ('Clavier ouvert (téléphone)', [
        'Il ne reste qu’environ la moitié de l’écran : la bulle devient une ligne collée au clavier.',
        'Plumio y tient en petit (30 px), tourné vers le champ ; « Passer » reste au bout.',
        'Jamais sur la liste de suggestions ni sur le texte saisi.',
        'Le champ reste visible : l’application le fait défiler au-dessus de la liste si besoin.']),
    ('Pas de « Suivant »', [
        'C’est l’action qui fait avancer : un appui, un choix, une saisie valide.',
        'Valide : « content » (640 ms), puis il sautille jusqu’à « Continuer » et le tapote.',
        'Il ne change jamais de page sans que la personne ait appuyé elle-même.',
        '« Passer la visite » est dans chaque bulle ; Échap fait pareil.']),
    ('Hors du chemin, accessibilité', [
        'Un appui ailleurs, ou une autre page : la bulle se replie en un petit Plumio dans un coin.',
        'Le toucher reprend la visite ; le voile ne revient qu’avec elle.',
        'La bulle n’est pas modale : Tab mène au vrai bouton ou au vrai champ.',
        'Plumio est aria-hidden ; tout ce qu’il dit est dans la bulle, annoncé à chaque étape.']),
]

html = [f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plumio · tutoriel, version 2</title>
<style>
{ANIM}
</style>
<style>
{CSS}
</style>
</head>
<body>
"""]
html.append(''.join(f'<input class="cache" type="radio" name="variante" id="{k}"{" checked" if i == 0 else ""}>' for i, (k, _) in enumerate(VARIANTES)))
html.append("""
<main class="doc">
  <header style="display:flex;flex-direction:column;gap:12px;max-width:780px">
    <p class="etiq">Tripora · mascotte</p>
    <h1>Le premier lancement, version 2</h1>
    <p class="muet-doc">Plumio accueille en grand, puis montre comment créer un voyage, sans le créer. Pas de « Suivant » : c’est la personne qui appuie, choisit et tape ; Plumio montre le vrai bouton de l’aile et le vrai champ du bec. Choisissez la variante : clair, sombre, ou arabe en miroir.</p>
  </header>
  <div class="choix" role="group" aria-label="Variante">
""")
html.append(''.join(f'<label for="{k}">{nom}</label>' for k, nom in VARIANTES))
html.append('\n  </div>\n  <section class="regles" aria-label="Règles">\n')
for titre, items in REGLES:
    html.append(f'    <div class="regle"><h3>{titre}</h3><ul>' + ''.join(f'<li>{i}</li>' for i in items) + '</ul></div>\n')
html.append('  </section>\n')
for e in ECRANS:
    note = f'<dt>Note</dt><dd>{e["note"]}</dd>' if e['note'] else ''
    pc_cadre = (f'<figure class="cadre-pc"><div class="maq pc">{e["pc"]}</div><figcaption>Ordinateur · 1280 × 800</figcaption></figure>')
    html.append(f"""
  <section class="etape" id="{e['id']}" aria-labelledby="t-{e['id']}">
    <div class="etape-tete">
      <div style="display:flex;flex-direction:column;gap:6px"><p class="etiq">{e['page']}</p><h2 class="e-titre" id="t-{e['id']}">{e['titre']}</h2></div>
      <dl class="fiche"><dt>Montre</dt><dd>{e['montre']}</dd><dt>Geste</dt><dd>{e['geste']}</dd><dt>Avance</dt><dd>{e['avance']}</dd>{note}</dl>
    </div>
    <div class="cadres">
      <figure class="cadre-tel"><div class="maq tel">{e['tel']}</div><figcaption>Téléphone · 390 × 844</figcaption></figure>
      {pc_cadre}
    </div>
  </section>
""")
html.append('</main>\n</body>\n</html>\n')


def insecables(m):
    """Typographie française : espace insécable devant « ; : ! ? » et après « (hors CSS)."""
    t = m.group(1)
    if '{' in t:
        return m.group(0)
    t = t.replace('« ', '«\u00a0').replace(' »', '\u00a0»')
    t = re.sub(r' ([;:!?])', '\u00a0\\1', t)
    if re.search(r'[A-Za-zÀ-ÿ]', t):
        # Marques gauche-à-droite invisibles : en miroir arabe, la ponctuation du
        # texte français reste à sa place (« ? D’où partez-vous » sinon).
        t = f'\u200e{t}\u200e'
    return f'>{t}<'


sortie = ''.join(html)
sortie = ''.join(morceau if morceau.startswith('<style') else re.sub(r'>([^<]+)<', insecables, morceau)
                 for morceau in re.split(r'(<style>.*?</style>)', sortie, flags=re.S))
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'index.html'), 'w').write(sortie)
print(len(sortie.encode()) // 1024, 'Ko')
