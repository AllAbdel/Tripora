"""Assemble design/mascotte/tutoriel/index.html : six étapes, téléphone et ordinateur,
clair, sombre et arabe (miroir). Autonome, sans JavaScript, sans rien d'externe.

Usage : python3 tutoriel.py design/mascotte
"""
import os, sys

R = sys.argv[1]
OUT = os.path.join(R, 'tutoriel')
POSE = {n[:-4]: open(os.path.join(R, 'poses', n)).read().strip() for n in os.listdir(os.path.join(R, 'poses'))}
ANIM = open(os.path.join(R, 'animations.css')).read()


def plumio(nom, taille, extra='plumio--calme'):
    s = POSE[nom]
    return s.replace('<svg ', f'<svg width="{taille}" height="{taille}" ', 1).replace('class="plumio ', f'class="plumio {extra} ', 1)


def t(fr, ar):
    """Un texte dans les deux langues ; la feuille montre celle de la variante."""
    return f'<span lang="fr">{fr}</span><span lang="ar">{ar}</span>'


ICONES = {
    'trips': '<path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 12h18"/>',
    'carte': '<path d="M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10Z"/><circle cx="12" cy="11" r="2.2"/>',
    'budget': '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
    'profil': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'x': '<path d="M6 6l12 12M18 6L6 18"/>',
    'retour': '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/>',
    'ok': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'cle': '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
    'wifi': '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19.5" r=".8"/>',
    'billet': '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v8a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2Z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
    'maison': '<path d="M4 11l8-7 8 7v9H4Z"/><path d="M10 20v-6h4v6"/>',
}


def ico(nom, taille=20):
    return (f'<svg class="ico" width="{taille}" height="{taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONES[nom]}</svg>')


def onglets(actif):
    items = [('trips', 'Trips', 'الرحلات'), ('carte', 'Carte', 'الخريطة'), ('budget', 'Budget', 'الميزانية'), ('profil', 'Profil', 'الملف')]
    return '<nav class="onglets">' + ''.join(
        f'<span class="onglet{" actif" if k == actif else ""}">{ico(k, 22)}<span>{t(fr, ar)}</span></span>' for k, fr, ar in items) + '</nav>'


def laterale(actif, section=None):
    items = [('trips', 'Trips', 'الرحلات'), ('carte', 'Carte', 'الخريطة'), ('budget', 'Budget', 'الميزانية'), ('profil', 'Profil', 'الملف')]
    nav = ''.join(f'<span class="lien{" actif" if k == actif and not section else ""}">{ico(k, 18)}{t(fr, ar)}</span>' for k, fr, ar in items)
    sec = ''
    if section:
        sections = [('apercu', 'Aperçu', 'نظرة عامة'), ('decouvrir', 'Découvrir', 'اكتشف'), ('itineraire', 'Itinéraire', 'البرنامج'),
                    ('coffre', 'Coffre', 'الخزنة'), ('budget', 'Budget', 'الميزانية')]
        sec = (f'<p class="etiquette">{t("Écrans du voyage", "شاشات الرحلة")}</p>' +
               ''.join(f'<span class="lien{" actif" if k == section else ""}"><i class="puce"></i>{t(fr, ar)}</span>' for k, fr, ar in sections))
    return (f'<aside class="laterale"><span class="marque" translate="no">Tripora</span><div class="nav">{nav}</div>'
            f'<div class="nav">{sec}</div></aside>')


def bulle(n, fr, ar, pose, taille, place, queue, cote_oiseau, derniere=False):
    """place : dessous-fin, dessous-debut, dessus-fin, cote ; cote_oiseau : position de Plumio sur le bord."""
    prog = ''.join(f'<i class="{"fait" if i <= n else ""}"></i>' for i in range(1, 7))
    suivant = t('Terminer', 'إنهاء') if derniere else t('Suivant', 'التالي')
    return (f'<div class="coach coach--{place}" style="--queue:{queue}px;--oiseau:{cote_oiseau}px">'
            f'<div class="bulle" role="dialog" aria-label="Tutoriel">'
            f'<div class="bulle-haut"><span class="etiquette">{t(f"Étape {n} sur 6", f"الخطوة {n} من 6")}</span>'
            f'<span class="progression" aria-hidden="true">{prog}</span></div>'
            f'<p class="bulle-texte">{t(fr, ar)}</p>'
            f'<div class="bulle-bas"><button type="button" class="btn fantome">{t("Passer", "تخطَّ")}</button>'
            f'<button type="button" class="btn primaire">{suivant}</button></div></div>'
            f'<div class="oiseau">{plumio(pose, taille)}</div></div>')


# ── Contenus des pages ───────────────────────────────────────────────────────

def bouton_nouveau(ancre):
    b = f'<button type="button" class="btn primaire petit{" projecteur" if ancre else ""}">{ico("plus", 16)}{t("Nouveau", "جديد")}</button>'
    return b


def vide_trips():
    return (f'<div class="carte vide"><h2 class="titre-lieu">{t("Partir avec d’autres", "السفر مع الآخرين")}</h2>'
            f'<p class="muet">{t("Créez un voyage, invitez le groupe : Tripora trouve la destination qui plaît à tous.", "أنشئ رحلة وادعُ المجموعة: يجد Tripora الوجهة التي ترضي الجميع.")}</p>'
            f'<button type="button" class="btn primaire grand">{ico("plus", 18)}{t("Créer un voyage", "إنشاء رحلة")}</button></div>')


def carte_envies(projecteur=True):
    chips = ''.join(f'<span class="chip">{t(fr, ar)}</span>' for fr, ar in [('Culture', 'ثقافة'), ('Nature', 'طبيعة'), ('Fête', 'سهر'), ('Détente', 'راحة')])
    return (f'<div class="carte bloc{" projecteur" if projecteur else ""}"><p class="etiquette">{t("Mes envies", "رغباتي")}</p>'
            f'<p>{t("Culture, nature, fête, détente… et votre budget.", "ثقافة، طبيعة، سهر، راحة… وميزانيتك.")}</p>'
            f'<div class="chips">{chips}</div>'
            f'<button type="button" class="btn secondaire">{t("Remplir mes envies", "املأ رغباتي")}</button></div>')


def carte_propositions():
    lignes = ''.join(
        f'<div class="ligne"><span class="titre-lieu">{t(fr, ar)}</span><span class="votes">'
        f'<span class="chip">{t("J’aime", "أعجبني")}</span><span class="chip">{t("Bof", "لا")}</span>'
        f'<span class="chip">{t("Coup de cœur", "المفضلة")}</span></span></div>'
        for fr, ar in [('Lisbonne', 'لشبونة'), ('Porto', 'بورتو'), ('Séville', 'إشبيلية')])
    return f'<div class="carte bloc"><p class="etiquette">{t("Propositions", "المقترحات")}</p>{lignes}</div>'


def carte_activite():
    return (f'<div class="activite"><div class="illus" aria-hidden="true">'
            f'<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice"><circle cx="248" cy="58" r="26" class="soleil"/>'
            f'<path d="M0 150 C60 110 110 120 160 140 S260 120 320 135 V200 H0Z" class="colline"/>'
            f'<path d="M0 172 C70 150 140 168 200 160 S290 150 320 158 V200 H0Z" class="colline2"/></svg></div>'
            f'<div class="activite-texte"><p class="etiquette">{t("3 sur 24", "3 من 24")}</p>'
            f'<h2 class="titre-lieu">{t("Balade dans l’Alfama", "نزهة في ألفاما")}</h2>'
            f'<p class="muet">{t("Le matin · Gratuit · 2 h", "الصباح · مجاني · ساعتان")}</p></div></div>')


def boutons_gestes():
    return (f'<div class="gestes-boutons">'
            f'<span class="rond" aria-label="Pas pour moi">{ico("x", 24)}</span>'
            f'<span class="rond petit-rond" aria-label="Revenir">{ico("retour", 20)}</span>'
            f'<span class="rond oui" aria-label="J’y vais">{ico("ok", 26)}</span></div>'
            f'<div class="gestes-legende"><span>{t("Pas pour moi", "ليس لي")}</span><span>{t("Revenir", "رجوع")}</span><span>{t("J’y vais", "سأذهب")}</span></div>')


def plan():
    return (f'<div class="plan" aria-hidden="true"><svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice">'
            f'<path d="M-10 160 C80 140 120 180 220 150 S330 120 410 140" class="eau"/>'
            f'<path d="M40 40 L120 70 L180 50 L260 90 L340 60" class="rue"/><path d="M90 0 L110 220 M250 0 L230 220" class="rue"/>'
            f'<path d="M70 120 C120 90 170 110 210 80 S290 70 320 100" class="trajet"/>'
            f'<circle cx="70" cy="120" r="7" class="epingle"/><circle cx="210" cy="80" r="7" class="epingle"/><circle cx="320" cy="100" r="7" class="epingle"/></svg></div>')


def journee(n, fr_jour, ar_jour, items, projecteur=False):
    lignes = ''.join(f'<div class="creneau"><span class="moment">{t(m1, m2)}</span><span>{t(a1, a2)}</span></div>' for m1, m2, a1, a2 in items)
    return (f'<div class="carte bloc jour{" projecteur" if projecteur else ""}"><p class="etiquette">{t(f"Jour {n}", f"اليوم {n}")} · {t(fr_jour, ar_jour)}</p>{lignes}</div>')


J1 = [('Le matin', 'الصباح', 'Balade dans l’Alfama', 'نزهة في ألفاما'),
      ('L’après-midi', 'بعد الظهر', 'Musée des azulejos', 'متحف الأزوليجو'),
      ('Le soir', 'المساء', 'Dîner au Bairro Alto', 'عشاء في بايرو ألتو')]
J2 = [('Le matin', 'الصباح', 'Tour de Belém', 'برج بيليم'),
      ('L’après-midi', 'بعد الظهر', 'Plage de Carcavelos', 'شاطئ كاركافيلوس')]


def coffre_item(icone, fr, ar, fr2, ar2, projecteur=False):
    return (f'<div class="carte item{" projecteur" if projecteur else ""}"><span class="ico-rond">{ico(icone, 20)}</span>'
            f'<span class="item-texte"><strong>{t(fr, ar)}</strong><span class="muet">{t(fr2, ar2)}</span></span></div>')


def coffre_liste(ancre_premier, coach=''):
    premier = coffre_item('wifi', 'Wifi de l’appartement', 'واي فاي الشقة', 'Casa-Alfama · mot de passe masqué', 'Casa-Alfama · كلمة المرور مخفية', ancre_premier)
    if coach:
        premier = f'<div class="ancre">{premier}{coach}</div>'
    autres = (coffre_item('cle', 'Code de la porte', 'رمز الباب', 'Bâtiment B, 2e étage', 'المبنى B، الطابق 2') +
              coffre_item('billet', 'Billets d’avion', 'تذاكر الطيران', '4 billets · aller et retour', '4 تذاكر · ذهاب وعودة') +
              coffre_item('maison', 'Adresse du logement', 'عنوان السكن', 'Rua dos Remédios', 'Rua dos Remédios'))
    return premier, autres


def soldes():
    lignes = [('Inès', '+ 42,00 €', 'reçoit', 'تستحق', 'pos'), ('Malik', '− 18,00 €', 'doit', 'عليه', 'neg'),
              ('Jade', '− 6,00 €', 'doit', 'عليها', 'neg'), ('Vous', '− 18,00 €', 'devez', 'عليك', 'neg')]
    rows = ''.join(f'<div class="solde"><span translate="no">{n if n != "Vous" else t("Vous", "أنت")}</span>'
                   f'<span class="muet">{t(a, b)}</span><span class="montant {c}">{m}</span></div>' for n, m, a, b, c in lignes)
    return (f'<div class="carte bloc"><p class="etiquette">{t("Où en est chacun", "أين وصل كل واحد")}</p>{rows}</div>'
            f'<div class="carte bloc"><p class="etiquette">{t("Remboursements", "التسويات")}</p>'
            f'<div class="solde"><span>Malik → Inès</span><span></span><span class="montant">18,00 €</span></div>'
            f'<div class="solde"><span>{t("Vous", "أنت")} → Inès</span><span></span><span class="montant">18,00 €</span></div></div>')


def tete_page(fr, ar, action='', sous=''):
    s = f'<p class="muet petit">{sous}</p>' if sous else ''
    return f'<header class="tete-page"><div><h1 class="titre">{t(fr, ar)}</h1>{s}</div>{action}</header>'


# ── Les étapes ───────────────────────────────────────────────────────────────

ETAPES = []

# 1. Créer le voyage
b1 = ('Appuyez sur « Nouveau » pour créer votre voyage. Ensuite, envoyez le lien ou le code au groupe.',
      'اضغط على « جديد » لإنشاء رحلتك، ثم أرسل الرابط أو الرمز إلى المجموعة.')
ETAPES.append(dict(
    titre='Créer le voyage, inviter le groupe', page='/voyages, puis /voyages/nouveau', element='Le bouton « Nouveau », puis l’invitation (lien, code)',
    projecteur='Oui : le bouton seul.', pose='pointer-haut, sur la bulle, côté bouton',
    tel=(tete_page('Trips', 'الرحلات', f'<div class="ancre">{bouton_nouveau(True)}{bulle(1, *b1, "pointer-haut", 64, "dessous-fin", 34, 40)}</div>')
         + f'<div class="contenu">{vide_trips()}</div>' + onglets('trips')),
    pc=(laterale('trips') + '<main class="principal">' +
        tete_page('Trips', 'الرحلات', f'<div class="ancre">{bouton_nouveau(True)}{bulle(1, *b1, "pointer-haut", 80, "dessous-fin", 34, 40)}</div>')
        + f'<div class="contenu">{vide_trips()}</div></main>'),
))

# 2. Envies et vote
b2 = ('Remplissez « Mes envies » : Tripora propose les destinations qui plaisent à tout le groupe. Ensuite, votez.',
      'املأ « رغباتي »: يقترح Tripora الوجهات التي تناسب المجموعة كلها. ثم صوّت.')
ETAPES.append(dict(
    titre='Chacun dit ses envies, le groupe vote', page='/voyages/<id>', element='« Mes envies », puis les propositions et leurs boutons de vote',
    projecteur='Oui : la carte « Mes envies ».', pose='pointer-haut (téléphone), pointer-gauche (ordinateur)',
    tel=(tete_page('Week-end de mai', 'عطلة مايو', sous=t('4 participants · destination à choisir', '4 مشاركين · الوجهة لم تُحدَّد'))
         + f'<div class="contenu"><div class="ancre">{carte_envies()}{bulle(2, *b2, "pointer-haut", 64, "dessous-fin", 48, 54)}</div>{carte_propositions()}</div>'
         + onglets('trips')),
    pc=(laterale('trips', 'apercu') + '<main class="principal">' +
        tete_page('Week-end de mai', 'عطلة مايو', sous=t('4 participants · destination à choisir', '4 مشاركين · الوجهة لم تُحدَّد'))
        + f'<div class="contenu deux"><div class="ancre">{carte_envies()}{bulle(2, *b2, "pointer-gauche", 80, "cote", 28, 12)}</div>{carte_propositions()}</div></main>'),
))

# 3. Découvrir
b3 = ('Glissez à droite : j’y vais. À gauche : pas pour moi. Les boutons font pareil.',
      'اسحب البطاقة نحو « سأذهب » أو نحو « ليس لي »، أو استعمل الأزرار.')
ETAPES.append(dict(
    titre='Les activités, d’un glissement', page='/voyages/<id>/decouvrir', element='La carte d’activité et les trois boutons de geste',
    projecteur='Non : l’écran entier est le sujet, rien n’est assombri.', pose='pointer-bas, au coin de la bulle, vers « J’y vais »',
    tel=(f'<div class="decouvrir"><div class="ancre activite-ancre">{carte_activite()}'
         f'{bulle(3, *b3, "pointer-bas", 64, "dedans", 132, -18)}</div><div class="gestes">{boutons_gestes()}</div></div>'),
    pc=(laterale('trips', 'decouvrir') + '<main class="principal centre">'
        f'<div class="ancre decouvrir-pc">{carte_activite()}{boutons_gestes()}{bulle(3, *b3, "pointer-gauche", 80, "cote", 28, 12)}</div></main>'),
))

# 4. Itinéraire
b4 = ('Les activités qui ont plu sont rangées jour par jour. Touchez une journée pour la voir sur la carte.',
      'رُتِّبت الأنشطة التي أعجبتكم يومًا بيوم. المس يومًا لتراه على الخريطة.')
ETAPES.append(dict(
    titre='Le programme se compose tout seul', page='/voyages/<id>/itineraire', element='Une journée, puis la carte',
    projecteur='Oui : la première journée.', pose='pointer-haut (téléphone), pointer-gauche (ordinateur)',
    tel=(tete_page('Itinéraire', 'البرنامج', sous=t('Lisbonne · 16 au 18 mai', 'لشبونة · 16 إلى 18 مايو'))
         + f'<div class="contenu">{plan()}<div class="ancre">{journee(1, "samedi", "السبت", J1, True)}'
         f'{bulle(4, *b4, "pointer-haut", 64, "dessous-fin", 48, 54)}</div>{journee(2, "dimanche", "الأحد", J2)}</div>'
         + onglets('trips')),
    pc=(laterale('trips', 'itineraire') + '<main class="principal">' +
        tete_page('Itinéraire', 'البرنامج', sous=t('Lisbonne · 16 au 18 mai', 'لشبونة · 16 إلى 18 مايو'))
        + f'<div class="contenu deux"><div class="colonne"><div class="ancre">{journee(1, "samedi", "السبت", J1, True)}'
        f'{bulle(4, *b4, "pointer-gauche", 80, "cote", 28, 12)}</div>{journee(2, "dimanche", "الأحد", J2)}</div>{plan()}</div></main>'),
))

# 5. Coffre
b5 = ('Codes, wifi, billets : tout est rangé dans le coffre, et reste lisible sans réseau.',
      'الرموز والواي فاي والتذاكر: كل شيء محفوظ في الخزنة، ويبقى مقروءًا دون اتصال.')
segments = (f'<div class="segments"><span class="seg actif">{t("Coffre", "الخزنة")}</span><span class="seg">{t("Valise", "الحقيبة")}</span>'
            f'<span class="seg">{t("Qui fait quoi", "من يفعل ماذا")}</span></div>')
p_tel, a_tel = coffre_liste(True, bulle(5, *b5, 'pointer-haut', 64, 'dessous-fin', 48, 76))
p_pc, a_pc = coffre_liste(True, bulle(5, *b5, 'pointer-gauche', 80, 'cote', 28, 12))
ETAPES.append(dict(
    titre='Tout sous la main, même sans réseau', page='/voyages/<id>/coffre', element='Le coffre, puis la valise et « Qui fait quoi »',
    projecteur='Oui : la première fiche du coffre.', pose='pointer-haut (téléphone), pointer-gauche (ordinateur)',
    tel=(tete_page('Coffre', 'الخزنة') + f'<div class="contenu">{segments}{p_tel}{a_tel}</div>' + onglets('trips')),
    pc=(laterale('trips', 'coffre') + '<main class="principal">' + tete_page('Coffre', 'الخزنة')
        + f'<div class="contenu">{segments}<div class="grille-items">{p_pc}{a_pc}</div></div></main>'),
))

# 6. Budget
b6 = ('Ajoutez une dépense : qui a payé, combien, pour qui. Tripora calcule qui doit quoi.',
      'أضف مصروفًا: من دفع، وكم، ولمن. يحسب Tripora من يدين لمن.')
nouvelle = f'<button type="button" class="btn primaire grand projecteur">{ico("plus", 18)}{t("Nouvelle dépense", "مصروف جديد")}</button>'
ETAPES.append(dict(
    titre='Qui doit quoi, sans calculatrice', page='/voyages/<id>/budget', element='« Nouvelle dépense », puis les remboursements',
    projecteur='Oui : le bouton « Nouvelle dépense ».', pose='pointer-bas (téléphone), pointer-haut (ordinateur) ; « Terminer » lance « au revoir »',
    tel=(tete_page('Budget', 'الميزانية', sous=t('Week-end de mai', 'عطلة مايو'))
         + f'<div class="contenu">{soldes()}<div class="ancre bas-de-page">{nouvelle}'
         f'{bulle(6, *b6, "pointer-bas", 64, "dessus-fin", 40, -18, derniere=True)}</div></div>' + onglets('budget')),
    pc=(laterale('budget', 'budget') + '<main class="principal">' +
        tete_page('Budget', 'الميزانية', f'<div class="ancre">{nouvelle.replace("grand ", "")}{bulle(6, *b6, "pointer-haut", 80, "dessous-fin", 34, 72, derniere=True)}</div>',
                  sous=t('Week-end de mai', 'عطلة مايو'))
        + f'<div class="contenu deux">{soldes()}</div></main>'),
))

# ── Feuille et page ──────────────────────────────────────────────────────────

CSS = """
@font-face { font-family: 'Fraunces'; src: url('../../../apps/web/public/polices/fraunces-latin.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }
@font-face { font-family: 'Inter Tight'; src: url('../../../apps/web/public/polices/inter-tight-latin.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }
* { box-sizing: border-box; }
body { margin: 0; background: #ebe4d6; color: #1a1713; font: 400 16px/1.5 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.cache { position: absolute; opacity: 0; pointer-events: none; }
h1, h2, h3, p { margin: 0; }
.doc { max-width: 1320px; margin: 0 auto; padding: 48px 24px 96px; display: flex; flex-direction: column; gap: 56px; }
.doc h1 { font: 600 48px/1.05 'Fraunces', Georgia, serif; letter-spacing: -0.01em; }
.doc h2 { font: 600 28px/1.15 'Fraunces', Georgia, serif; }
.doc .etiq { font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6355; }
.doc .muet { color: #6b6355; }
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
.etape-tete { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px 32px; align-items: end; }
.fiche { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; font-size: 14px; }
.fiche dt { color: #6b6355; } .fiche dd { margin: 0; }
.cadres { display: flex; gap: 24px; align-items: flex-start; }
.cadre-tel { width: 292.5px; height: 633px; flex-shrink: 0; }
.cadre-pc { width: 960px; height: 600px; flex-shrink: 0; }
.cadre-tel > .maq { transform: scale(0.75); transform-origin: 0 0; }
.cadre-pc > .maq { transform: scale(0.75); transform-origin: 0 0; }
.cadres { padding-bottom: 28px; }
.cadres figure { margin: 0; position: relative; }
.cadres figure > .maq { position: absolute; top: 0; left: 0; }
.cadres figcaption { position: absolute; top: calc(100% + 8px); font-size: 12px; color: #6b6355; }
@media (max-width: 1320px) { .cadres { flex-wrap: wrap; } }

/* ── la maquette : jetons de l'application ── */
.maq { --surface: #fffdf8; --surface-muted: #f4efe4; --surface-raised: #fffdf8; --border-subtle: #e6ddcb; --border-fort: #d4c7ae;
  --text-strong: #1a1713; --text-muted: #6b6355; --accent: #1a5fb4; --accent-contrast: #fffdf8; --accent-doux: #d9e6f8;
  --voile: rgb(26 23 19 / 0.52); --chip: #f2ece0; --gold: #97691d; --lagoon: #2f8f88; --neg: #8a5f18;
  --ombre-bulle: 0 1px 2px rgb(58 52 43 / 0.06), 0 12px 28px -18px rgb(58 52 43 / 0.5);
  position: relative; overflow: hidden; background: var(--surface-muted); color: var(--text-strong);
  font: 400 15px/1.45 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border: 1px solid #d4c7ae; }
#v-sombre:checked ~ .doc .maq, #v-ar-sombre:checked ~ .doc .maq {
  --surface: #1c1915; --surface-muted: #131110; --surface-raised: #242019; --border-subtle: #352f26; --border-fort: #4a4234;
  --text-strong: #f4efe4; --text-muted: #a79c8a; --accent: #7ba7e2; --accent-contrast: #131110; --accent-doux: #0e3a72;
  --voile: rgb(0 0 0 / 0.5); --chip: #2a251f; --gold: #d4a656; --lagoon: #7ec6c2; --neg: #d4a656;
  --ombre-bulle: 0 12px 28px -14px rgb(0 0 0 / 0.8); border-color: #4a4234; }
#v-sombre:checked ~ .doc .maq .plumio, #v-ar-sombre:checked ~ .doc .maq .plumio {
  --plumio-trait: #e6ddcb; --plumio-dos: #524b3f; --plumio-ventre: #f2ece0; --plumio-or: #d4a656; }
.maq [lang=ar] { display: none; }
#v-ar:checked ~ .doc .maq [lang=ar], #v-ar-sombre:checked ~ .doc .maq [lang=ar] { display: inline; }
#v-ar:checked ~ .doc .maq [lang=fr], #v-ar-sombre:checked ~ .doc .maq [lang=fr] { display: none; }
#v-ar:checked ~ .doc .maq, #v-ar-sombre:checked ~ .doc .maq { direction: rtl; font-family: 'Inter Tight', 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif; }
#v-ar:checked ~ .doc .maq .oiseau, #v-ar-sombre:checked ~ .doc .maq .oiseau { transform: scaleX(-1); }
.maq .plumio { color: var(--accent); }
.tel { width: 390px; height: 844px; border-radius: 36px; display: flex; flex-direction: column; }
.pc { width: 1280px; height: 800px; border-radius: 12px; display: flex; }
.maq .titre { font: 600 28px/1.1 'Fraunces', 'Iowan Old Style', Georgia, serif; letter-spacing: -0.01em; }
.maq .titre-lieu { font: 600 20px/1.2 'Fraunces', 'Iowan Old Style', Georgia, serif; }
.maq .etiquette { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted); }
.maq .muet { color: var(--text-muted); }
.maq .petit { font-size: 13px; }
.tete-page { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 28px 16px 12px; }
.tete-page > div { display: flex; flex-direction: column; gap: 4px; }
.contenu { flex: 1; padding: 4px 16px 16px; display: flex; flex-direction: column; gap: 12px; }
.contenu.deux { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
.colonne { display: flex; flex-direction: column; gap: 12px; }
.carte { background: var(--surface-raised); border: 1px solid var(--border-subtle); border-radius: 12px; }
.bloc { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.vide { padding: 32px 20px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; margin-top: 24px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 44px; padding: 0 16px; border-radius: 12px; border: 0;
  font: 600 15px/1 'Inter Tight', -apple-system, 'Segoe UI', sans-serif; white-space: nowrap; }
.btn.petit { height: 40px; padding: 0 14px; font-size: 14px; }
.btn.grand { height: 52px; padding: 0 20px; font-size: 16px; }
.btn.primaire { background: var(--accent); color: var(--accent-contrast); }
.btn.secondaire { background: transparent; color: var(--text-strong); border: 1px solid var(--border-fort); align-self: flex-start; }
.btn.fantome { background: transparent; color: var(--text-muted); padding: 0 10px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; height: 30px; padding: 0 10px; border-radius: 8px; background: var(--chip); font-size: 13px; }
.ligne { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 0; border-top: 1px solid var(--border-subtle); }
.ligne .titre-lieu { font-size: 17px; }
.votes { display: flex; gap: 4px; }
.votes .chip { height: 28px; font-size: 12px; padding: 0 8px; }
.onglets { display: grid; grid-template-columns: repeat(4, 1fr); padding: 8px 8px 24px; background: var(--surface); border-top: 1px solid var(--border-subtle); position: relative; z-index: 1; }
.onglet { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 11px; color: var(--text-muted); padding: 6px 0; }
.onglet.actif { color: var(--accent); font-weight: 600; }
.laterale { width: 248px; flex-shrink: 0; padding: 24px 16px; display: flex; flex-direction: column; gap: 24px; background: var(--surface); border-inline-end: 1px solid var(--border-subtle); }
.marque { font: 600 24px/1 'Fraunces', Georgia, serif; padding: 0 12px; }
.nav { display: flex; flex-direction: column; gap: 2px; }
.nav .etiquette { padding: 0 12px 6px; }
.lien { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 12px; border-radius: 8px; font-size: 14px; color: var(--text-muted); }
.lien.actif { background: var(--chip); color: var(--text-strong); font-weight: 600; }
.puce { width: 8px; height: 8px; border-radius: 3px; background: var(--border-fort); }
.lien.actif .puce { background: var(--accent); }
.principal { flex: 1; min-width: 0; display: flex; flex-direction: column; max-width: 960px; margin: 0 auto; padding: 0 24px; }
.principal .tete-page { padding: 40px 0 16px; }
.principal .contenu { padding: 0; }
.principal.centre { align-items: flex-start; justify-content: center; padding-inline-start: 96px; }
.ancre { position: relative; z-index: 3; }
.projecteur { position: relative; box-shadow: 0 0 0 3px var(--surface-muted), 0 0 0 5px var(--accent), 0 0 0 200vmax var(--voile); }
.coach { position: absolute; z-index: 4; width: 288px; }
.pc .coach { width: 320px; }
.coach--dessous-fin { top: calc(100% + 58px); inset-inline-end: 0; }
.pc .coach--dessous-fin { top: calc(100% + 86px); }
.tel .coach--dessus-fin { inset-inline-end: 28px; }
.coach--dedans { top: 84px; inset-inline-end: 16px; }
.coach--dessus-fin { bottom: calc(100% + 22px); inset-inline-end: 0; }
.coach--cote { inset-inline-start: calc(100% + 26px); top: 0; }
.bulle { position: relative; background: var(--surface-raised); color: var(--text-strong); border: 1px solid var(--border-fort); border-radius: 12px;
  box-shadow: var(--ombre-bulle); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.bulle::before { content: ''; position: absolute; width: 14px; height: 14px; background: var(--surface-raised); border: solid var(--border-fort); border-width: 1px 0 0 1px; }
.coach--dessous-fin .bulle::before { top: -8px; inset-inline-end: var(--queue); transform: rotate(45deg); }
.coach--dessus-fin .bulle::before, .coach--dedans .bulle::before { bottom: -8px; inset-inline-end: var(--queue); transform: rotate(225deg); }
.coach--cote .bulle::before { inset-inline-start: -8px; top: var(--queue); transform: rotate(-45deg); }
#v-ar:checked ~ .doc .coach--cote .bulle::before, #v-ar-sombre:checked ~ .doc .coach--cote .bulle::before { transform: rotate(135deg); }
.bulle-haut { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.progression { display: flex; gap: 4px; }
.progression i { width: 14px; height: 4px; border-radius: 2px; background: var(--border-subtle); }
.progression i.fait { background: var(--accent); }
.bulle-texte { font-size: 15px; line-height: 1.45; }
.pc .bulle-texte { font-size: 16px; }
.bulle-bas { display: flex; justify-content: space-between; align-items: center; }
.oiseau { position: absolute; line-height: 0; }
.oiseau svg { display: block; }
.coach--dessous-fin .oiseau, .coach--dessus-fin .oiseau, .coach--dedans .oiseau { bottom: calc(100% - 4px); inset-inline-end: var(--oiseau); }
.coach--cote .oiseau { bottom: calc(100% - 4px); inset-inline-start: var(--oiseau); }
.decouvrir { flex: 1; display: flex; flex-direction: column; padding: 16px; gap: 16px; }
.activite-ancre { flex: 1; display: flex; flex-direction: column; }
.activite { flex: 1; display: flex; flex-direction: column; background: var(--surface-raised); border: 1px solid var(--border-subtle); border-radius: 24px; overflow: hidden; }
.illus { flex: 1; min-height: 200px; background: #b4dcd7; }
.illus svg { width: 100%; height: 100%; display: block; }
.illus .soleil { fill: #e8c37a; } .illus .colline { fill: #7ec6c2; } .illus .colline2 { fill: #2f8f88; }
#v-sombre:checked ~ .doc .illus, #v-ar-sombre:checked ~ .doc .illus { background: #1c3532; }
#v-sombre:checked ~ .doc .illus .colline, #v-ar-sombre:checked ~ .doc .illus .colline { fill: #1b5c58; }
#v-sombre:checked ~ .doc .illus .colline2, #v-ar-sombre:checked ~ .doc .illus .colline2 { fill: #257570; }
.activite-texte { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 4px; }
.activite-texte .titre-lieu { font-size: 24px; }
.gestes { display: flex; flex-direction: column; gap: 6px; padding-bottom: 20px; }
.gestes-boutons { display: flex; justify-content: center; align-items: center; gap: 24px; }
.gestes-legende { display: flex; justify-content: center; gap: 24px; font-size: 12px; color: var(--text-muted); }
.gestes-legende span { width: 64px; text-align: center; }
.rond { width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: var(--surface-raised); border: 1px solid var(--border-fort); color: var(--text-strong); }
.rond.petit-rond { width: 48px; height: 48px; }
.rond.oui { background: var(--lagoon); border-color: var(--lagoon); color: #fffdf8; }
.decouvrir-pc { width: 420px; height: 640px; display: flex; flex-direction: column; gap: 16px; }
.plan { height: 168px; border-radius: 12px; overflow: hidden; background: #e6ddcb; border: 1px solid var(--border-subtle); }
.pc .plan { height: 520px; }
.plan svg { width: 100%; height: 100%; display: block; }
.plan .eau { fill: none; stroke: #b4dcd7; stroke-width: 26; }
.plan .rue { fill: none; stroke: #fffdf8; stroke-width: 6; }
.plan .trajet { fill: none; stroke: var(--accent); stroke-width: 3; stroke-dasharray: 6 6; }
.plan .epingle { fill: var(--gold); stroke: #fffdf8; stroke-width: 3; }
#v-sombre:checked ~ .doc .plan, #v-ar-sombre:checked ~ .doc .plan { background: #2a251f; }
#v-sombre:checked ~ .doc .plan .rue, #v-ar-sombre:checked ~ .doc .plan .rue { stroke: #3a342b; }
#v-sombre:checked ~ .doc .plan .eau, #v-ar-sombre:checked ~ .doc .plan .eau { stroke: #1c3532; }
.jour .creneau { display: grid; grid-template-columns: 96px 1fr; gap: 8px; padding: 6px 0; border-top: 1px solid var(--border-subtle); font-size: 14px; }
.jour .moment { color: var(--text-muted); }
.segments { display: flex; gap: 4px; padding: 4px; background: var(--chip); border-radius: 10px; align-self: flex-start; }
.seg { height: 34px; display: inline-flex; align-items: center; padding: 0 12px; border-radius: 8px; font-size: 13px; color: var(--text-muted); }
.seg.actif { background: var(--surface-raised); color: var(--text-strong); font-weight: 600; }
.item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
.ico-rond { width: 40px; height: 40px; border-radius: 10px; background: var(--chip); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.item-texte { display: flex; flex-direction: column; font-size: 14px; }
.grille-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; }
.solde { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center; padding: 8px 0; border-top: 1px solid var(--border-subtle); font-size: 14px; }
.montant { font-variant-numeric: tabular-nums; font-weight: 600; direction: ltr; }
.montant.pos { color: var(--lagoon); }
.montant.neg { color: var(--neg); }
.bas-de-page { margin-top: auto; display: flex; flex-direction: column; }
.bas-de-page > .btn { width: 100%; }
"""

VARIANTES = [('v-clair', 'Clair'), ('v-sombre', 'Sombre'), ('v-ar', 'العربية · clair'), ('v-ar-sombre', 'العربية · sombre')]

html = [f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plumio · tutoriel</title>
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
  <header style="display:flex;flex-direction:column;gap:12px;max-width:760px">
    <p class="etiq">Tripora · mascotte</p>
    <h1>Le tutoriel, sur les vraies pages</h1>
    <p class="muet">Six étapes. À chacune, Plumio se pose sur sa bulle, à côté de l’élément, et le montre de l’aile. Choisissez la variante : clair, sombre, ou arabe en miroir.</p>
  </header>
  <div class="choix" role="group" aria-label="Variante">
""")
html.append(''.join(f'<label for="{k}"{" lang=ar" if k.startswith("v-ar") else ""}>{nom}</label>' for k, nom in VARIANTES))
html.append("""
  </div>
  <section class="regles" aria-label="Règles">
    <div class="regle"><h3>Placement</h3><ul>
      <li>Plumio se pose sur le bord haut de sa bulle, du côté de l’élément, et le montre de l’aile.</li>
      <li>Téléphone : la bulle sous l’élément, ou au-dessus s’il est dans le tiers bas de l’écran.</li>
      <li>Ordinateur : la bulle à côté de l’élément (côté fin de ligne), sinon dessous.</li>
      <li>Entre l’élément et la bulle : la hauteur de Plumio (58 px sur téléphone, 86 px sur ordinateur), pour qu’il ne cache jamais l’élément ; 16 px au moins avec le bord de l’écran.</li></ul></div>
    <div class="regle"><h3>Bulle</h3><ul>
      <li>Papier (<code>--surface-raised</code>), filet <code>--border-fort</code>, rayon 12 px, ombre <code>--shadow-lift</code>.</li>
      <li>Largeur fixe : 288 px sur téléphone, 320 px sur ordinateur. Marge intérieure 16 px.</li>
      <li>Une pointe de 14 px, tournée vers l’élément, à 34–48 px du coin.</li>
      <li>En haut : « Étape n sur 6 » et six traits de progression. En bas : « Passer » (discret) et « Suivant » (accent).</li></ul></div>
    <div class="regle"><h3>Projecteur</h3><ul>
      <li>Voile encre à 52 % (noir à 50 % en sombre) sur toute la page, sauf l’élément.</li>
      <li>Autour de l’élément : 3 px de papier puis 2 px d’accent, au rayon de l’élément.</li>
      <li>Pas de voile à « Découvrir » : l’écran entier est le sujet.</li>
      <li>L’élément reste cliquable : l’utiliser fait avancer le tutoriel.</li></ul></div>
    <div class="regle"><h3>Mouvement</h3><ul>
      <li>Changement de page : pose « vol » d’une ancre à l’autre (360–600 ms), puis la pose d’arrivée joue son geste.</li>
      <li>La bulle apparaît 120 ms après : opacité et 8 px de montée, 220 ms, courbe <code>--ease-pose</code>. Plumio pépie une fois.</li>
      <li>Pendant la lecture : <code>plumio--calme</code> seulement (souffle, clignements).</li>
      <li>Mouvement réduit : tout est posé d’emblée, rien ne bouge.</li></ul></div>
    <div class="regle"><h3>Arabe</h3><ul>
      <li>Toute la mise en page passe en miroir (propriétés logiques).</li>
      <li>Plumio est retourné (<code>scaleX(-1)</code>) : « pointer à droite » devient « à gauche ».</li>
      <li>La consigne de « Découvrir » ne parle pas de droite ni de gauche : elle nomme les boutons.</li>
      <li>Les montants restent de gauche à droite.</li></ul></div>
    <div class="regle"><h3>Accessibilité</h3><ul>
      <li>La bulle est un dialogue non modal, annoncé à chaque étape ; le focus va sur « Suivant ».</li>
      <li>Échap = « Passer ». Flèches gauche et droite : étape précédente ou suivante.</li>
      <li>Plumio est décoratif (<code>aria-hidden</code>) : tout ce qu’il « dit » est dans la bulle.</li>
      <li>Cibles de 44 px au moins sur téléphone.</li></ul></div>
  </section>
""")
for i, e in enumerate(ETAPES, 1):
    html.append(f"""
  <section class="etape" aria-labelledby="e{i}">
    <div class="etape-tete">
      <div style="display:flex;flex-direction:column;gap:6px"><p class="etiq">Étape {i} sur 6</p><h2 id="e{i}">{e['titre']}</h2></div>
      <dl class="fiche"><dt>Page</dt><dd><code>{e['page'].replace('<', '&lt;').replace('>', '&gt;')}</code></dd><dt>Élément</dt><dd>{e['element']}</dd>
      <dt>Projecteur</dt><dd>{e['projecteur']}</dd><dt>Plumio</dt><dd>{e['pose']}</dd></dl>
    </div>
    <div class="cadres">
      <figure class="cadre-tel"><div class="maq tel">{e['tel']}</div><figcaption>Téléphone · 390 × 844</figcaption></figure>
      <figure class="cadre-pc"><div class="maq pc">{e['pc']}</div><figcaption>Ordinateur · 1280 × 800</figcaption></figure>
    </div>
  </section>
""")
html.append('</main>\n</body>\n</html>\n')
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'index.html'), 'w').write(''.join(html))
print(len(''.join(html).encode()) // 1024, 'Ko')
