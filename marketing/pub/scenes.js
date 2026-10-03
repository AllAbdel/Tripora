/* La pub de Tripora : 19 plans, une seule ligne de temps GSAP en pause.
   Le rendu avance image par image avec window.allerA(t) : tout ce qui bouge
   dépend du temps, rien du hasard ni de l'horloge. Tempo 120 : une mesure
   dure 2 s, les coupes tombent sur les temps. */
(function () {
  gsap.registerPlugin(MotionPathPlugin);
  const racine = document.getElementById('scene');
  const tl = gsap.timeline({ paused: true });
  const CUES = [];
  const PAR_IMAGE = [];
  const PLANS = [];
  const sfx = (type, t, o = {}) => CUES.push({ type, t: Math.round(t * 1000) / 1000, ...o });
  const parImage = (fn) => PAR_IMAGE.push(fn);
  const hasard = ILLU.graine(2026);
  const borne = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  // ?langue=en : la même pub en anglais, sur les captures de l'application en anglais.
  const EN = window.LANGUE === 'en';
  const L = (fr, en) => (EN ? en : fr);
  const CAPTURES = window.CAPTURES ?? 'captures';
  const R = window.REPERES;
  const ease = {
    pose: 'expo.out', // vive au départ, arrêt net, sans rebond
    entre: 'power3.inOut',
    sort: 'power3.in',
  };

  /* ---------- Outils DOM ---------- */
  function h(html, parent) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    const e = t.content.firstElementChild;
    if (parent) parent.appendChild(e);
    return e;
  }
  const ico = (nom, taille = 24, epaisseur = 2) =>
    `<svg viewBox="0 0 24 24" width="${taille}" height="${taille}" fill="none" stroke="currentColor" stroke-width="${epaisseur}" stroke-linecap="round" stroke-linejoin="round">${ICONES[nom]
      .map(([t, a]) => `<${t} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
      .join('')}</svg>`;
  const glyphe = (nom) => `<svg viewBox="${GLYPHES[nom].viewBox}" fill="currentColor">${GLYPHES[nom].corps}</svg>`;

  function plan(nom, classe = '') {
    const p = h(`<section class="plan ${classe}" data-plan="${nom}"><div class="cadre" style="position:absolute;inset:0"></div></section>`, racine);
    return { el: p, cadre: p.firstElementChild, nom };
  }
  function montrer(p, debut, fin) {
    tl.set(p.el, { visibility: 'visible' }, debut);
    tl.set(p.el, { visibility: 'hidden' }, fin);
    PLANS.push({ nom: p.nom, debut, fin });
    // Le plan respire : une poussée de caméra lente, à peine perceptible.
    tl.fromTo(p.cadre, { scale: 1 }, { scale: 1.035, duration: fin - debut, ease: 'none' }, debut);
  }
  /** Une feuille monte par-dessus la précédente, comme une page de carnet. */
  function feuille(entrant, sortant, t, duree = 0.9) {
    tl.fromTo(entrant.el, { yPercent: 100, boxShadow: '0 -40px 80px rgba(26,23,19,0.25)' },
      { yPercent: 0, boxShadow: '0 0 0 rgba(26,23,19,0)', duration: duree, ease: 'expo.inOut' }, t - duree / 2);
    if (sortant) tl.to(sortant.el, { yPercent: -18, duration: duree, ease: 'expo.inOut' }, t - duree / 2);
    sfx('souffle', t - duree / 2);
  }
  /** Glissement latéral, pour enchaîner deux idées d'un même chapitre. */
  function glisse(entrant, sortant, t, duree = 0.8) {
    tl.fromTo(entrant.el, { xPercent: 100 }, { xPercent: 0, duration: duree, ease: 'expo.inOut' }, t - duree / 2);
    if (sortant) tl.to(sortant.el, { xPercent: -30, duration: duree, ease: 'expo.inOut' }, t - duree / 2);
    sfx('glisse', t - duree / 2);
  }
  function iris(entrant, t, duree = 0.6, x = '50%', y = '50%') {
    tl.fromTo(entrant.el, { clipPath: `circle(0% at ${x} ${y})` }, { clipPath: `circle(80% at ${x} ${y})`, duration: duree, ease: 'power3.in' }, t - duree);
    tl.set(entrant.el, { clipPath: 'none' }, t + 0.01);
  }

  /** Coupe un texte en mots masqués, en gardant <em> et <br>. */
  function decouper(noeud) {
    const mis = [];
    const traiter = (n) => {
      for (const enfant of [...n.childNodes]) {
        if (enfant.nodeType === 3) {
          const frag = document.createDocumentFragment();
          enfant.textContent.split(/(\s+)/).forEach((mot) => {
            if (!mot) return;
            if (/^\s+$/.test(mot)) { frag.appendChild(document.createTextNode(' ')); return; }
            const m = document.createElement('span'); m.className = 'm';
            const mi = document.createElement('span'); mi.className = 'mi'; mi.textContent = mot;
            m.appendChild(mi); frag.appendChild(m); mis.push(mi);
          });
          n.replaceChild(frag, enfant);
        } else if (enfant.nodeType === 1 && enfant.tagName !== 'BR') traiter(enfant);
      }
    };
    traiter(noeud);
    return mis;
  }
  function titre(parent, html, { x, y, classe = 'titre m', largeur = 1500, centre = false, style = '' }) {
    const e = h(`<div class="${classe}" style="position:absolute;left:${x}px;top:${y}px;width:${largeur}px;${centre ? 'text-align:center;' : ''}${style}">${html}</div>`, parent);
    return { el: e, mis: decouper(e) };
  }
  function apparaitre(cible, t, { stagger = 0.05, duree = 1, de = 110 } = {}) {
    const mis = cible.mis ?? cible;
    tl.fromTo(mis, { yPercent: de }, { yPercent: 0, duration: duree, ease: ease.pose, stagger }, t);
  }
  function effacer(cible, t, { stagger = 0.015 } = {}) {
    const mis = cible.mis ?? cible;
    tl.to(mis, { yPercent: -110, duration: 0.45, ease: ease.sort, stagger }, t);
  }
  function surgir(e, t, { duree = 0.7, y = 40, echelle = 0.94, son = 'pop', hauteur = 0 } = {}) {
    tl.fromTo(e, { autoAlpha: 0, y, scale: echelle }, { autoAlpha: 1, y: 0, scale: 1, duration: duree, ease: ease.pose }, t);
    if (son) sfx(son, t, { hauteur });
  }
  function partir(e, t, { duree = 0.4, y = -30 } = {}) {
    tl.to(e, { autoAlpha: 0, y, duration: duree, ease: ease.sort }, t);
  }
  /** Trait dessiné à la main (soulignement, cercle). */
  function trait(e, t, duree = 0.6) {
    const longueur = e.getTotalLength();
    tl.fromTo(e, { strokeDasharray: longueur, strokeDashoffset: longueur }, { strokeDashoffset: 0, duration: duree, ease: 'power2.inOut' }, t);
  }

  /* ---------- Téléphone ---------- */
  const BARRE = `<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>
    <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0Z M3.2 6.7a6.8 6.8 0 0 1 9.6 0l-1.4 1.4a4.8 4.8 0 0 0-6.8 0Z M0.8 4.3a10.2 10.2 0 0 1 14.4 0l-1.4 1.4a8.2 8.2 0 0 0-11.6 0Z" fill="currentColor"/></svg>
    <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="currentColor" opacity="0.4" fill="none"/><rect x="2" y="2" width="18" height="9" rx="2" fill="currentColor"/><rect x="24.5" y="4.5" width="2" height="4" rx="1" fill="currentColor" opacity="0.4"/></svg>`;
  function telephone(parent, { image, x, y, sombre = false, onglets = true, actif = 0, echelle = 1 }) {
    const onglet = (g, t, i) => `<div class="${i === actif ? 'actif' : ''}">${glyphe(g)}<span>${t}</span></div>`;
    const e = h(`<div class="tel" style="left:${x}px;top:${y}px;transform:scale(${echelle})">
      <div class="tel-ecran" style="${sombre ? 'background:#14110e' : ''}">
        <div class="tel-contenu">${image ? `<img class="page" src="${CAPTURES}/${image}">` : ''}</div>
        <div class="tel-statut ${sombre ? 'sombre' : ''}"><span>9:41</span><span class="icones">${BARRE}</span></div>
        <div class="tel-ilot"></div>
        ${onglets ? `<div class="tel-onglets">${onglet('Voyages', 'TRIPS', 0)}${onglet('Carte', L('CARTE', 'MAP'), 1)}${onglet('Depenses', 'BUDGET', 2)}${onglet('Profil', L('PROFIL', 'PROFILE'), 3)}</div>` : ''}
      </div><div class="tel-reflet"></div></div>`, parent);
    return { el: e, ecran: e.querySelector('.tel-ecran'), contenu: e.querySelector('.tel-contenu'), page: e.querySelector('img.page') };
  }
  function entreeTel(tel, t, { de = 'droite', rotY = -12 } = {}) {
    const dx = de === 'droite' ? 520 : -520;
    tl.fromTo(tel.el, { x: dx, rotationY: rotY * 2.4, rotationX: 6, autoAlpha: 0 },
      { x: 0, rotationY: rotY, rotationX: 3, autoAlpha: 1, duration: 1.1, ease: ease.pose, transformPerspective: 1800 }, t);
    sfx('souffle', t, { doux: true });
  }
  function defiler(tel, t, versY, duree = 1) {
    tl.to(tel.page, { y: -versY, duration: duree, ease: 'power2.inOut' }, t);
  }
  /** Le doigt qui touche l'écran : un disque qui s'élargit et s'efface. */
  function toucher(parent, x, y, t) {
    const d = h(`<div style="position:absolute;left:${x - 40}px;top:${y - 40}px;width:80px;height:80px;border-radius:50%;background:rgba(26,95,180,0.25);border:3px solid rgba(26,95,180,0.6);z-index:20"></div>`, parent);
    tl.fromTo(d, { scale: 0.3, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.18, ease: 'power2.out' }, t);
    tl.to(d, { scale: 1.6, autoAlpha: 0, duration: 0.45, ease: 'power2.out' }, t + 0.18);
    sfx('tap', t);
    return d;
  }

  const AMIS = {
    ines: { nom: 'Inès', c: '#1a5fb4' }, hugo: { nom: 'Hugo', c: '#e2574c' }, sarah: { nom: 'Sarah', c: '#2f8f88' },
    malik: { nom: 'Malik', c: '#c08a2e' }, lea: { nom: 'Léa', c: '#8b6cf0' }, tom: { nom: 'Tom', c: '#e05a8a' },
  };
  const avatar = (qui, taille = 64) => `<div class="avatar" style="width:${taille}px;height:${taille}px;background:${AMIS[qui].c};font-size:${taille * 0.42}px">${AMIS[qui].nom[0]}</div>`;
  const puce = (icone, texte, couleur = 'var(--marque)') => `<div class="puce"><span style="color:${couleur}">${ico(icone, 30, 2.2)}</span>${texte}</div>`;

  /* ---------- Calques fixes ---------- */
  const grain = h('<div id="grain"></div>', racine);
  h('<div id="vignette"></div>', racine);
  const chapitres = h(`<div id="chapitres">${L(['Choisir', 'Organiser', 'Vivre', 'Se souvenir'], ['Choose', 'Plan', 'Live', 'Remember']).map((c, i) => `<span><b>0${i + 1}</b>${c}<i></i></span>`).join('')}</div>`, racine);
  const marque = h('<div id="marque"><img src="/apps/web/public/icons/icon.svg" alt="">Tripora</div>', racine);
  const voile = h('<div id="voile"></div>', racine);

  parImage((t) => {
    const pas = Math.floor(t * 12);
    const r = ILLU.graine(pas + 11);
    grain.style.transform = `translate(${Math.round(r() * 40 - 20)}px, ${Math.round(r() * 40 - 20)}px)`;
  });
  const CHAPITRES = [[14, 43], [43, 62], [62, 75], [75, 81]];
  const visibleBandeau = (t) => t >= 14.2 && t < 80.8;
  parImage((t) => {
    const v = visibleBandeau(t);
    const apparition = borne((t - 14.2) / 0.5) * borne((80.8 - t) / 0.4);
    chapitres.style.opacity = v ? apparition : 0;
    marque.style.opacity = v ? apparition : 0;
    chapitres.querySelectorAll('span').forEach((s, i) => {
      const [a, b] = CHAPITRES[i];
      const actif = t >= a && t < b;
      s.style.opacity = actif ? 1 : t >= b ? 0.55 : 0.3;
      s.querySelector('i').style.transform = `scaleX(${borne((t - a) / (b - a))})`;
    });
  });

  /* =====================================================================
     P1 — Le groupe de discussion qui déborde (0 → 6 s)
     ===================================================================== */
  const p1 = plan('chaos');
  montrer(p1, 0, 6.5);
  const entete = h(`<div style="position:absolute;left:50%;top:70px;display:flex;align-items:center;gap:16px;padding:14px 26px;border-radius:999px;background:var(--feuille);border:1px solid var(--filet);box-shadow:0 16px 30px -20px rgba(26,23,19,.4);font-weight:650;font-size:26px">
      <span style="display:flex">${['hugo', 'sarah', 'malik', 'lea'].map((q, i) => `<span style="margin-left:${i ? -14 : 0}px">${avatar(q, 44)}</span>`).join('')}</span>
      ${L('Vacances 2026', 'Summer 2026')} <span style="color:var(--muet);font-weight:500">${L('· 6 membres', '· 6 members')}</span>
      <span class="badge-non-lus chiffre" style="background:var(--corail);color:#fff;border-radius:999px;padding:4px 14px;font-size:22px;font-weight:700">0</span></div>`, p1.cadre);
  // Centré par xPercent : un translateX(-50%) écrit dans le style serait mesuré
  // en pixels par GSAP dès la construction, avant le chargement des polices, et
  // l'élément finirait décalé.
  gsap.set(entete, { xPercent: -50 });
  surgir(entete, 0.15, { son: null });
  const badge = entete.querySelector('.badge-non-lus');
  const MESSAGES = L([
    ['hugo', 'On part où cet été ?'], ['sarah', 'Moi c’est fin juillet ou rien'], ['malik', 'Bali !!!'], ['ines', 'Trop cher pour moi…'],
    ['lea', 'Quelqu’un a regardé les vols ?'], ['tom', 'J’ai trouvé un logement trop beau'], ['hugo', 'C’est où le lien ??'], ['sarah', 'On vote quand ?'],
    ['malik', 'Je peux pas avant le 14'], ['lea', 'Qui réserve la voiture ?'], ['tom', 'Je te dois combien déjà ?'], ['hugo', 'Le tableur est où ?'],
    ['ines', 'Lisbonne sinon ?'], ['sarah', 'Vous avez vu mon message ?'], ['malik', 'Ok mais on décide quand ?'], ['lea', 'Allô ???'],
    ['tom', 'Le vol de 6 h c’est non'], ['hugo', 'On fait un sondage ?'], ['sarah', 'Il pleut là-bas en juillet ?'], ['malik', 'Qui avance l’argent ?'],
    ['lea', 'Envoyez vos dispos !'], ['tom', 'J’ai plus de batterie'], ['hugo', 'Ça fait trois semaines qu’on en parle'], ['sarah', '???'],
  ], [
    ['hugo', 'Where are we going this summer?'], ['sarah', 'Late July or nothing for me'], ['malik', 'Bali!!!'], ['ines', 'Too expensive for me…'],
    ['lea', 'Has anyone checked flights?'], ['tom', 'I found the most amazing place'], ['hugo', 'Where’s the link??'], ['sarah', 'When do we vote?'],
    ['malik', 'Can’t go before the 14th'], ['lea', 'Who’s booking the car?'], ['tom', 'How much do I owe you again?'], ['hugo', 'Where’s the spreadsheet?'],
    ['ines', 'Lisbon instead?'], ['sarah', 'Did you see my message?'], ['malik', 'Ok but when do we decide?'], ['lea', 'Hello???'],
    ['tom', 'The 6 am flight is a no'], ['hugo', 'Should we do a poll?'], ['sarah', 'Does it rain there in July?'], ['malik', 'Who’s fronting the money?'],
    ['lea', 'Send your dates!'], ['tom', 'My battery’s dying'], ['hugo', 'We’ve been at this for three weeks'], ['sarah', '???'],
  ]);
  const POSITIONS = [
    [640, 290], [700, 410], [680, 530], [900, 650],
    [120, 170], [1230, 150], [180, 420], [1330, 360], [90, 660], [1180, 600], [500, 800], [1320, 820], [140, 900], [880, 900], [620, 180], [980, 720],
    [420, 560], [1480, 500], [40, 300], [1080, 260], [700, 960], [1400, 950], [330, 250], [1560, 240], [1100, 440], [240, 760],
  ];
  const bulles = [];
  let tB = 0.45, pasB = 0.5;
  MESSAGES.forEach(([qui, texte], i) => {
    const moi = qui === 'ines';
    const [x, y] = POSITIONS[i];
    const b = h(`<div class="bulle ${moi ? 'moi' : ''}" style="left:${x}px;top:${y}px">${avatar(qui, 58)}<div class="corps">${moi ? '' : `<span class="nom" style="color:${AMIS[qui].c}">${AMIS[qui].nom}</span>`}${texte}</div></div>`, p1.cadre);
    const rot = i < 4 ? 0 : (hasard() * 12 - 6);
    tl.fromTo(b, { autoAlpha: 0, scale: 0.6, y: 30, rotation: rot * 0.3 }, { autoAlpha: 1, scale: 1, y: 0, rotation: rot, duration: 0.5, ease: 'back.out(1.6)' }, tB);
    sfx('bulle', tB, { hauteur: i });
    bulles.push({ b, t: tB });
    if (i >= 3) pasB *= 0.82;
    tB += Math.max(0.08, pasB);
  });
  parImage((t) => {
    const n = Math.floor(borne((t - 0.45) / 4.4) ** 1.7 * 248);
    badge.textContent = n > 99 ? '99+' : String(n);
  });
  // Le tremblement de la saturation, puis tout tombe.
  tl.to(p1.cadre, { x: '+=6', duration: 0.05, repeat: 9, yoyo: true, ease: 'none' }, 4.9);
  sfx('montee', 2.2, { fin: 5.75 });
  bulles.forEach(({ b }, i) => {
    tl.to(b, { y: 1300 + hasard() * 300, rotation: hasard() * 60 - 30, duration: 0.85, ease: 'power3.in' }, 5.55 + hasard() * 0.25);
  });
  tl.to(entete, { y: -200, duration: 0.6, ease: ease.sort }, 5.6);

  /* =====================================================================
     P2 — Le constat (6 → 10 s)
     ===================================================================== */
  const p2 = plan('constat');
  montrer(p2, 5.55, 10.05);
  feuille(p2, null, 6.0, 0.9);
  const ligne1 = titre(p2.cadre, L('Partir entre amis,<br><em>c’est le rêve.</em>', 'Traveling with friends?<br><em>The dream.</em>'), { x: 160, y: 330, classe: 'titre xl' });
  apparaitre(ligne1, 6.3, { stagger: 0.07 });
  effacer(ligne1, 7.8);
  const ligne2 = titre(p2.cadre, L('Tout organiser à six,<br><em class="or">beaucoup moins.</em>', 'Planning it for six?<br><em class="or">Not so much.</em>'), { x: 160, y: 330, classe: 'titre xl' });
  apparaitre(ligne2, 8.0, { stagger: 0.07 });
  // « Not so much. » est plus court que « beaucoup moins. » : le gribouillis s'étire à sa mesure.
  const gribouillis = h(`<svg style="position:absolute;left:110px;top:440px;overflow:visible" width="${L(1060, 820)}" height="260" viewBox="0 0 1060 260" preserveAspectRatio="none">
    <path d="M90,36 C330,-4 720,-2 940,34 C1030,52 1052,132 982,186 C880,250 400,252 150,220 C30,202 -12,146 26,100 C56,62 150,44 270,34" fill="none" stroke="#c08a2e" stroke-width="7" stroke-linecap="round"/></svg>`, p2.cadre);
  trait(gribouillis.querySelector('path'), 8.75, 0.7);
  sfx('gribouillis', 8.75);
  // Un petit avion de papier traverse la page, son pointillé derrière lui.
  const vol = h(`<svg style="position:absolute;left:0;top:0;overflow:visible" width="1920" height="1080">
    <defs><mask id="masque-avion" maskUnits="userSpaceOnUse" x="-200" y="0" width="2400" height="1200"><path class="revele" d="M-80,860 C380,980 700,700 1060,780 S1600,880 2000,640" fill="none" stroke="#fff" stroke-width="24"/></mask></defs>
    <path id="trajet-avion" d="M-80,860 C380,980 700,700 1060,780 S1600,880 2000,640" fill="none" stroke="#a79c8a" stroke-width="3" stroke-dasharray="2 14" stroke-linecap="round" mask="url(#masque-avion)"/></svg>`, p2.cadre);
  const avion = h(`<div style="position:absolute;left:0;top:0;color:var(--marque);width:54px;height:54px;margin:-27px 0 0 -27px">${ico('plane', 54, 1.8)}</div>`, p2.cadre);
  trait(vol.querySelector('.revele'), 6.2, 3.4);
  tl.fromTo(avion, { motionPath: { path: '#trajet-avion', align: '#trajet-avion', alignOrigin: [0.5, 0.5], autoRotate: 45, start: 0, end: 0 } },
    { motionPath: { path: '#trajet-avion', align: '#trajet-avion', alignOrigin: [0.5, 0.5], autoRotate: 45, start: 0, end: 1 }, duration: 3.4, ease: 'power1.inOut' }, 6.2);
  tl.to([ligne2.el, gribouillis], { scale: 0.92, autoAlpha: 0, duration: 0.45, ease: ease.sort, transformOrigin: '50% 50%' }, 9.5);

  /* =====================================================================
     P3 — La marque (10 → 14 s)
     ===================================================================== */
  const p3 = plan('marque', 'nuit');
  montrer(p3, 9.4, 14.6);
  iris(p3, 10.0, 0.55);
  sfx('impact', 10.0);
  const halo = h('<div style="position:absolute;left:760px;top:190px;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(123,167,226,.45),rgba(123,167,226,0) 70%)"></div>', p3.cadre);
  const logo = h('<img src="/apps/web/public/icons/icon.svg" style="position:absolute;left:840px;top:270px;width:240px;height:240px;border-radius:54px;box-shadow:0 40px 80px -30px rgba(0,0,0,.6)">', p3.cadre);
  tl.fromTo(logo, { scale: 0.3, rotation: -14, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 1.2, ease: 'expo.out' }, 10.0);
  tl.fromTo(halo, { scale: 0.4, autoAlpha: 0 }, { scale: 1.3, autoAlpha: 1, duration: 1.6, ease: 'expo.out' }, 10.05);
  const mot = titre(p3.cadre, 'Tripora', { x: 0, y: 560, classe: 'titre', largeur: 1920, centre: true, style: 'font-size:168px;letter-spacing:-0.04em' });
  mot.mis.length = 0;
  mot.el.innerHTML = [...'Tripora'].map((c) => `<span class="m"><span class="mi">${c}</span></span>`).join('');
  apparaitre([...mot.el.querySelectorAll('.mi')], 10.35, { stagger: 0.045, duree: 1.1 });
  const devise = titre(p3.cadre, L('Le voyage de groupe, de l’idée au souvenir.', 'Group travel, from first idea to lasting memory.'), { x: 0, y: 790, classe: 'texte', largeur: 1920, centre: true, style: 'font-size:42px;color:rgba(244,239,228,.85)' });
  apparaitre(devise, 11.0, { stagger: 0.04 });
  // Poussières d'étoiles qui montent lentement.
  for (let i = 0; i < 40; i++) {
    const s = h(`<div style="position:absolute;left:${hasard() * 1920}px;top:${hasard() * 1080}px;width:${2 + hasard() * 3}px;height:${2 + hasard() * 3}px;border-radius:50%;background:#f4efe4;opacity:${0.15 + hasard() * 0.4}"></div>`, p3.cadre);
    tl.fromTo(s, { y: 0 }, { y: -80 - hasard() * 120, duration: 5, ease: 'none' }, 9.6);
  }
  tl.to([logo, halo, mot.el, devise.el], { y: -60, autoAlpha: 0, duration: 0.6, ease: ease.sort, stagger: 0.04 }, 13.45);

  /* =====================================================================
     P4 — Créer en une phrase (14 → 19 s) · 01 Choisir
     ===================================================================== */
  const p4 = plan('creer');
  montrer(p4, 13.5, 19.5);
  feuille(p4, p3, 14.0, 0.9);
  const st4 = h(`<div class="sur-titre" style="position:absolute;left:140px;top:250px">${L('01 — Choisir', '01 — Choose')}</div>`, p4.cadre);
  surgir(st4, 14.3, { son: null, y: 20 });
  const t4 = titre(p4.cadre, L('Créez votre voyage<br><em>en une phrase.</em>', 'Create your trip<br><em>in one sentence.</em>'), { x: 140, y: 300, classe: 'titre l' });
  apparaitre(t4, 14.4);
  const champ = h(`<div style="position:absolute;left:140px;top:580px;width:900px;height:100px;border-radius:50px;background:var(--feuille);border:2px solid var(--marque);box-shadow:0 24px 50px -28px rgba(26,95,180,.55);display:flex;align-items:center;gap:20px;padding:0 34px;font-size:33px;font-weight:500">
      <span style="color:var(--marque);display:flex">${ico('sparkles', 34, 2)}</span><span class="frappe"></span><span class="curseur" style="width:3px;height:40px;background:var(--marque);margin-left:-14px"></span></div>`, p4.cadre);
  surgir(champ, 14.9, { son: null });
  const PHRASE = L('5 jours au soleil en octobre, 600 € max chacun', '5 sunny days in October, €600 max each');
  const frappe = champ.querySelector('.frappe'), curseur = champ.querySelector('.curseur');
  const [f0, f1] = [15.35, 17.0];
  [...PHRASE].forEach((c, i) => { if (c !== ' ') sfx('touche', f0 + ((f1 - f0) * i) / PHRASE.length, { hauteur: i }); });
  parImage((t) => {
    const n = Math.round(borne((t - f0) / (f1 - f0)) * PHRASE.length);
    frappe.textContent = PHRASE.slice(0, n);
    curseur.style.opacity = t > f1 + 0.3 ? 0 : Math.floor(t * 2.6) % 2 === 0 || (t > f0 && t < f1) ? 1 : 0;
  });
  // En anglais, les puces n'ont pas la même largeur : une rangée souple plutôt que des positions mesurées sur le français.
  const rangee4 = EN ? h('<div style="position:absolute;left:140px;top:720px;display:flex;gap:20px"></div>', p4.cadre) : null;
  const puces4 = L([['sun', 'Soleil', 'var(--or)'], ['calendar-days', 'Octobre', 'var(--corail)'], ['clock', '5 jours', 'var(--lagon)'], ['wallet', '600 € / pers.', 'var(--marque)']],
    [['sun', 'Sunshine', 'var(--or)'], ['calendar-days', 'October', 'var(--corail)'], ['clock', '5 days', 'var(--lagon)'], ['wallet', '€600 / person', 'var(--marque)']])
    .map(([i, t, c], k) => {
      const e = EN ? h(`<div>${puce(i, t, c)}</div>`, rangee4) : h(`<div style="position:absolute;left:${140 + [0, 206, 438, 640][k]}px;top:720px">${puce(i, t, c)}</div>`, p4.cadre);
      surgir(e, 17.15 + k * 0.13, { y: -40, hauteur: k });
      return e;
    });
  const pied4 = h(`<div class="texte s" style="position:absolute;left:140px;top:860px;display:flex;gap:30px;align-items:center">
    <span style="display:flex;align-items:center;gap:10px"><span style="color:var(--lagon)">${ico('check', 30, 3)}</span>${L('Sans compte', 'No account')}</span>
    <span style="display:flex;align-items:center;gap:10px"><span style="color:var(--lagon)">${ico('check', 30, 3)}</span>${L('Sans mot de passe', 'No password')}</span>
    <span style="display:flex;align-items:center;gap:10px"><span style="color:var(--lagon)">${ico('check', 30, 3)}</span>${L('Gratuit', 'Free')}</span></div>`, p4.cadre);
  surgir(pied4, 17.9, { son: null, y: 20 });
  const tel4 = telephone(p4.cadre, { image: 'creer.jpg', x: 1290, y: 84, onglets: false });
  entreeTel(tel4, 14.35);
  toucher(tel4.ecran, 195, 44 + 233, 16.2);
  tl.to(tel4.el, { y: -14, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 15.4);

  /* =====================================================================
     P5 — Inviter la bande (19 → 24 s)
     ===================================================================== */
  const p5 = plan('inviter');
  montrer(p5, 18.6, 24.5);
  glisse(p5, p4, 19.0);
  const t5 = titre(p5.cadre, L('Invitez la bande.', 'Invite the crew.'), { x: 140, y: 130, classe: 'titre m' });
  apparaitre(t5, 19.2);
  const s5 = titre(p5.cadre, L('Chacun donne ses envies et son budget.', 'Everyone adds their wishes and budget.'), { x: 140, y: 236, classe: 'texte' });
  apparaitre(s5, 19.5, { stagger: 0.03 });
  const carteQr = h(`<div class="carte" style="left:140px;top:360px;width:380px;height:500px;padding:36px;display:flex;flex-direction:column;align-items:center;gap:22px">
      <div class="etiquette">${L('Lien d’invitation', 'Invite link')}</div>
      <div style="width:250px;height:250px">${ILLU.qr(25, 9)}</div>
      <div class="chiffre" style="font-size:38px;font-weight:700;letter-spacing:0.14em">K7P2-QX9M</div>
      <div class="texte s" style="font-size:22px;text-align:center">${L('Un lien, un QR code :<br>ils rejoignent sans rien installer.', 'One link, one QR code:<br>nothing to install.')}</div></div>`, p5.cadre);
  surgir(carteQr, 19.45, { son: null });
  const MEMBRES = [
    ['ines', [[L('Plage', 'Beach'), '#2f8f88'], [L('Gastronomie', 'Food'), '#c08a2e']], 600],
    ['hugo', [[L('Fête', 'Nightlife'), '#8b6cf0'], ['Culture', '#1a5fb4']], 800],
    ['sarah', [['Nature', '#4f8a3c'], [L('Plage', 'Beach'), '#2f8f88']], 450],
    ['malik', [[L('Gastronomie', 'Food'), '#c08a2e'], [L('Aventure', 'Adventure'), '#e2574c']], 650],
  ];
  const cartesMembres = MEMBRES.map(([qui, envies, budget], i) => {
    const x = 600 + i * 300;
    const c = h(`<div class="carte" style="left:${x}px;top:360px;width:270px;height:430px;padding:30px 24px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center">
        ${avatar(qui, 104)}
        <div class="titre" style="font-size:40px">${AMIS[qui].nom}</div>
        <div style="display:flex;flex-direction:column;gap:10px;align-items:center">${envies.map(([e, c]) => `<span style="padding:8px 18px;border-radius:999px;background:${c}1f;color:${c};font-weight:650;font-size:22px">${e}</span>`).join('')}</div>
        <div class="budget" style="margin-top:auto;font-size:22px;color:var(--muet);font-weight:600">${L('Budget max', 'Max budget')}<br><span class="montant" style="position:relative;display:inline-block"><b class="chiffre" style="font-size:36px;color:var(--encre)">${L(`${budget} €`, `€${budget}`)}</b></span></div></div>`, p5.cadre);
    tl.fromTo(c, { x: 330 - x, y: 120, scale: 0.4, rotation: -10, autoAlpha: 0 }, { x: 0, y: 0, scale: 1, rotation: 0, autoAlpha: 1, duration: 0.9, ease: ease.pose }, 20.0 + i * 0.22);
    sfx('souffle', 20.0 + i * 0.22, { doux: true, hauteur: i });
    return c;
  });
  // Le budget le plus serré, entouré : le cadre vit dans le montant lui-même,
  // il en prend donc la taille et la place, quelle que soit la police.
  const anneau = h('<span style="position:absolute;inset:-5px -16px;border:4px solid var(--or);border-radius:14px;pointer-events:none"></span>', cartesMembres[2].querySelector('.montant'));
  tl.fromTo(anneau, { scale: 1.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: ease.pose }, 22.1);
  const groupe5 = h(`<div class="carte" style="left:600px;top:840px;width:1170px;height:96px;display:flex;align-items:center;gap:22px;padding:0 34px;font-size:30px;font-weight:600">
      <span style="color:var(--or)">${ico('users', 36, 2.2)}</span>${L('Budget du groupe :', 'Group budget:')} <b class="chiffre" style="color:var(--marque)">${L('450 € par personne', '€450 per person')}</b>
      <span style="margin-left:auto;color:var(--muet);font-size:24px">${L('le plus serré fait foi', 'the tightest budget sets the bar')}</span></div>`, p5.cadre);
  surgir(groupe5, 22.3, { hauteur: 5 });

  /* =====================================================================
     P6 — Les propositions (24 → 31 s)
     ===================================================================== */
  const p6 = plan('propositions');
  montrer(p6, 23.5, 31.5);
  feuille(p6, p5, 24.0, 0.9);
  const t6 = titre(p6.cadre, L('Des destinations<br>notées, <em>chiffrées</em>,<br>expliquées.', 'Destinations<br>rated, <em>priced</em>,<br>explained.'), { x: 120, y: 170, classe: 'titre m', largeur: 700 });
  apparaitre(t6, 24.35);
  const s6 = titre(p6.cadre, L('Chaque proposition dit ce qui la distingue des autres — pas l’avis d’un algorithme opaque.', 'Every suggestion says what sets it apart — not the verdict of a black-box algorithm.'), { x: 120, y: 470, classe: 'texte', largeur: 620 });
  apparaitre(s6, 25.3, { stagger: 0.025 });
  const score = h(`<div style="position:absolute;left:120px;top:690px;display:flex;align-items:baseline;gap:18px">
      <span class="titre chiffre" style="font-size:150px;color:var(--marque)">87</span><span class="titre" style="font-size:44px;color:var(--muet)">/100</span>
      <span class="texte s" style="max-width:300px;line-height:1.25;margin-left:10px">${L('Budapest répond à 92 % des envies du groupe.', 'Budapest matches 92% of the group’s wishes.')}</span></div>`, p6.cadre);
  surgir(score, 26.4, { hauteur: 3 });
  const tel6 = telephone(p6.cadre, { image: 'propositions-long.jpg', x: 830, y: 84 });
  entreeTel(tel6, 24.2, { rotY: -6 });
  tl.set(tel6.page, { y: -(R.propositions.entete - 70) }, 23.5);
  defiler(tel6, 25.6, R.propositions.budapest - 40, 0.9);
  defiler(tel6, 27.6, R.propositions.cracovie - 40, 0.9);
  defiler(tel6, 29.3, R.propositions.prague - 40, 0.9);
  const NOTES6 = L([
    ['plane', 'var(--marque)', 'Prix des vols relevés', 'avec la date du relevé'],
    ['sun', 'var(--or)', 'Climat du mois, mesuré', 'normales sur trois ans'],
    ['wallet', 'var(--lagon)', 'Coût total par personne', 'vol, logement, repas, activités'],
    ['route', '#4f8a3c', 'Empreinte carbone du trajet', 'avion, train, car ou voiture'],
    ['calendar-days', 'var(--corail)', 'Ponts et vacances scolaires', 'zones A, B et C'],
  ], [
    ['plane', 'var(--marque)', 'Real flight prices', 'with the date they were seen'],
    ['sun', 'var(--or)', 'Measured monthly climate', 'three-year averages'],
    ['wallet', 'var(--lagon)', 'Total cost per person', 'flights, lodging, meals, activities'],
    ['route', '#4f8a3c', 'Carbon footprint of the trip', 'plane, train, coach or car'],
    ['calendar-days', 'var(--corail)', 'Holidays and long weekends', 'France’s school zones A, B and C'],
  ]);
  const liens6 = h('<svg style="position:absolute;left:0;top:0;overflow:visible" width="1920" height="1080"></svg>', p6.cadre);
  NOTES6.forEach(([i, c, titreNote, detail], k) => {
    const y = 150 + k * 160;
    const n = h(`<div class="note" style="left:1380px;top:${y}px;width:440px"><span class="ico" style="background:${c}">${ico(i, 26, 2.2)}</span>${titreNote}<small>${detail}</small></div>`, p6.cadre);
    const t = 25.7 + k * 0.62;
    surgir(n, t, { hauteur: k, son: 'pop' });
    tl.fromTo(n, { x: 60 }, { x: 0, duration: 0.7, ease: ease.pose }, t);
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    l.setAttribute('d', `M1376,${y + 46} C1320,${y + 46} 1310,${300 + k * 90} 1250,${300 + k * 90}`);
    l.setAttribute('fill', 'none'); l.setAttribute('stroke', '#a79c8a'); l.setAttribute('stroke-width', '2'); l.setAttribute('stroke-dasharray', '3 7');
    liens6.appendChild(l);
    tl.fromTo(l, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, t + 0.15);
  });

  /* =====================================================================
     P7 — Le vote (31 → 36 s)
     ===================================================================== */
  const p7 = plan('vote');
  montrer(p7, 30.6, 36.5);
  glisse(p7, p6, 31.0);
  const t7 = titre(p7.cadre, L('Le groupe vote.', 'The group votes.'), { x: 140, y: 110, classe: 'titre m' });
  apparaitre(t7, 31.2);
  const s7 = titre(p7.cadre, L('La destination se décide ensemble, pas au plus bavard.', 'You choose together — not whoever talks the loudest.'), { x: 140, y: 214, classe: 'texte' });
  apparaitre(s7, 31.5, { stagger: 0.03 });
  const POSTALES = [
    ['lisbonne', L('Lisbonne', 'Lisbon'), 'Portugal', 230, 380, -6, 2],
    ['bali', 'Bali', L('Indonésie', 'Indonesia'), 700, 350, 2, 4],
    ['budapest', 'Budapest', L('Hongrie', 'Hungary'), 1170, 385, 5, 1],
  ];
  const postales = POSTALES.map(([illu, nom, pays, x, y, rot, votes], i) => {
    const c = h(`<div class="carte" style="left:${x}px;top:${y}px;width:500px;height:420px;padding:14px;border-radius:10px;transform:rotate(${rot}deg)">
        <div style="width:472px;height:310px;overflow:hidden;border-radius:4px">${ILLU[illu](472, 310)}</div>
        <div style="display:flex;align-items:baseline;justify-content:space-between;padding:16px 10px 0">
          <span class="titre" style="font-size:44px">${nom}</span><span class="etiquette">${pays}</span></div>
        <div class="compteur chiffre" style="position:absolute;right:-18px;top:-22px;display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:999px;background:var(--corail);color:#fff;font-weight:700;font-size:28px;box-shadow:0 12px 24px -12px rgba(0,0,0,.4)">${ico('heart', 26, 2.6)}<span>0</span></div></div>`, p7.cadre);
    tl.fromTo(c, { y: -900, rotation: rot - 14, autoAlpha: 1 }, { y: 0, rotation: rot, duration: 0.95, ease: ease.pose }, 31.25 + i * 0.14);
    sfx('papier', 31.25 + i * 0.14, { hauteur: i });
    return { c, votes, compte: c.querySelector('.compteur span'), arrivees: [] };
  });
  const votants = ['ines', 'hugo', 'sarah', 'malik'];
  const rangee = h(`<div style="position:absolute;left:742px;top:880px;display:flex;gap:28px">${votants.map((q) => avatar(q, 88)).join('')}</div>`, p7.cadre);
  surgir(rangee, 31.9, { son: null });
  // Qui vote quoi : tout le monde pour Bali, Inès et Hugo aussi pour Lisbonne, Malik pour Budapest.
  const VOTES = [[0, 1], [1, 1], [2, 1], [3, 1], [0, 0], [1, 0], [3, 2]];
  VOTES.forEach(([v, p], k) => {
    const t = 32.3 + k * 0.19;
    const jeton = h(`<div style="position:absolute;left:${742 + v * 116 + 21}px;top:900px;width:46px;height:46px;border-radius:50%;background:var(--feuille);color:var(--corail);display:grid;place-items:center;box-shadow:0 8px 16px -8px rgba(0,0,0,.4);z-index:5">${ico('heart', 26, 2.6)}</div>`, p7.cadre);
    const cible = POSTALES[p];
    const dx = cible[3] + 470 - (742 + v * 116 + 21), dy = cible[4] - 10 - 900;
    tl.fromTo(jeton, { x: 0, y: 0, scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.12 }, t);
    tl.to(jeton, { x: dx, y: dy, duration: 0.55, ease: 'power2.inOut' }, t + 0.12);
    tl.to(jeton, { scale: 0.2, autoAlpha: 0, duration: 0.1 }, t + 0.67);
    postales[p].arrivees.push(t + 0.67);
    sfx('vote', t + 0.67, { hauteur: k });
  });
  parImage((t) => postales.forEach((p) => { p.compte.textContent = String(p.arrivees.filter((a) => t >= a).length); }));
  tl.to([postales[0].c, postales[2].c], { y: 60, autoAlpha: 0.35, filter: 'saturate(0.2)', duration: 0.6, ease: ease.pose }, 34.0);
  tl.set(postales[1].c, { zIndex: 5 }, 33.95);
  tl.to(postales[1].c, { scale: 1.1, y: -10, rotation: 0, duration: 0.6, ease: ease.pose }, 34.0);
  const tamponChoisi = h(`<div style="position:absolute;left:880px;top:470px;width:300px;z-index:6">${ILLU.tampon({ centre: L('CHOISI', 'CHOSEN'), couleur: '#d2473b', rond: false, rotation: -12 })}</div>`, p7.cadre);
  tl.fromTo(tamponChoisi, { scale: 2.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 0.92, duration: 0.2, ease: 'power4.in' }, 34.45);
  tl.to(postales[1].c, { x: '+=7', duration: 0.04, repeat: 5, yoyo: true, ease: 'none' }, 34.65);
  sfx('tampon', 34.65);

  /* =====================================================================
     P8 — Découvrir en glissant (36 → 40 s)
     ===================================================================== */
  const p8 = plan('decouvrir');
  montrer(p8, 35.5, 40.5);
  feuille(p8, p7, 36.0, 0.9);
  const tel8 = telephone(p8.cadre, { image: 'decouvrir.jpg', x: 240, y: 84, sombre: true, onglets: false });
  entreeTel(tel8, 36.1, { de: 'gauche', rotY: 8 });
  const pile = h('<div style="position:absolute;left:12px;top:154px;width:366px;height:636px;z-index:2"></div>', tel8.ecran);
  const carteSwipe = (titreC, detail, etiquette, degrade) => h(`<div style="position:absolute;inset:0;border-radius:22px;overflow:hidden;background:${degrade};color:#fff;padding:22px">
      <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(0,0,0,.35);font-size:13px;font-weight:650">${etiquette}</span>
      <div style="position:absolute;left:0;right:0;top:180px;display:grid;place-items:center;opacity:.25">${ico('map-pin', 96, 1.4)}</div>
      <div style="position:absolute;left:22px;right:22px;bottom:30px"><div class="titre" style="font-size:36px;color:#fff;line-height:1.08">${titreC}</div><div style="font-size:17px;margin-top:12px;opacity:.9;line-height:1.4">${detail}</div>
      <div style="display:flex;gap:8px;margin-top:16px">${['2 h', '€', L('Le matin', 'Morning')].map((x) => `<span style="padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.14);font-size:14px;font-weight:600">${x}</span>`).join('')}</div></div></div>`, pile);
  carteSwipe(L('Nusa Penida à la journée', 'Nusa Penida day trip'), L('Traversée en bateau rapide, puis les falaises de Kelingking que tout le monde a vues en photo.', 'A fast boat across, then the Kelingking cliffs everyone has seen in photos.'), L('Plage', 'Beach'), 'linear-gradient(170deg,#c27a45,#4a2414)');
  const c3 = carteSwipe(L('Plongée à Amed', 'Diving in Amed'), L('Épave du Liberty et jardins de corail, à quelques brasses du rivage.', 'The Liberty wreck and coral gardens, a few strokes from the shore.'), L('Mer et plongée', 'Sea and diving'), 'linear-gradient(170deg,#2e5e8a,#10243d)');
  const c2 = carteSwipe(L('La forêt des singes d’Ubud', 'The Ubud Monkey Forest'), L('Trois temples dans une forêt de figuiers, et sept cents macaques qui y vivent vraiment.', 'Three temples in a forest of fig trees, and seven hundred macaques that really live there.'), L('Parc', 'Park'), 'linear-gradient(170deg,#2c6b5d,#0e2a24)');
  const c1 = h(`<img src="${CAPTURES}/carte-rizieres.jpg" style="position:absolute;inset:0;width:100%;height:100%;border-radius:22px">`, pile);
  const sceau = (texte, couleur, cote) => `<div style="position:absolute;top:34px;${cote}:24px;padding:8px 16px;border:4px solid ${couleur};color:${couleur};border-radius:10px;font-weight:800;font-size:26px;letter-spacing:.08em;transform:rotate(${cote === 'left' ? -14 : 14}deg);background:rgba(255,255,255,.12)">${texte}</div>`;
  const s1 = h(sceau(L('J’AI ENVIE', 'I’M IN'), '#5fd39b', 'left'), pile), s2 = h(sceau(L('J’AI ENVIE', 'I’M IN'), '#5fd39b', 'left'), pile), s3 = h(sceau(L('SANS MOI', 'NOT FOR ME'), '#ff7a6e', 'right'), pile);
  gsap.set([s1, s2, s3], { autoAlpha: 0 });
  const swipe = (carte, s, t, sens) => {
    tl.to(s, { autoAlpha: 1, duration: 0.15 }, t);
    tl.to(carte, { x: sens * 520, y: 60, rotation: sens * 24, duration: 0.6, ease: 'power2.in' }, t + 0.05);
    tl.to(s, { x: sens * 520, y: 60, rotation: `+=${sens * 24}`, autoAlpha: 0, duration: 0.6, ease: 'power2.in' }, t + 0.05);
    sfx('swipe', t + 0.05, { sens });
  };
  swipe(c1, s1, 36.75, 1); swipe(c2, s2, 37.65, 1); swipe(c3, s3, 38.55, -1);
  const t8 = titre(p8.cadre, L('Swipez les activités.', 'Swipe through activities.'), { x: 820, y: 170, classe: 'titre m' });
  apparaitre(t8, 36.3);
  const s8 = titre(p8.cadre, L('Le classement du groupe se fait tout seul.', 'The group ranking builds itself.'), { x: 820, y: 278, classe: 'texte' });
  apparaitre(s8, 36.6, { stagger: 0.03 });
  const classement = h(`<div class="carte" style="left:820px;top:400px;width:940px;padding:34px 40px">
      <div class="etiquette" style="margin-bottom:18px">${L('Classement du groupe', 'Group ranking')}</div></div>`, p8.cadre);
  surgir(classement, 36.8, { son: null });
  L([['Rizières en terrasses de Tegallalang', 4], ['Forêt des singes d’Ubud', 3], ['Nusa Penida à la journée', 3]], [['Tegallalang rice terraces', 4], ['Ubud Monkey Forest', 3], ['Nusa Penida day trip', 3]]).forEach(([nom, coeurs], i) => {
    const r = h(`<div style="display:flex;align-items:center;gap:24px;padding:20px 0;border-top:1px solid var(--filet)">
        <span class="titre chiffre" style="font-size:46px;color:${['var(--or)', 'var(--muet)', '#b07a4a'][i]};width:40px">${i + 1}</span>
        <span style="font-size:32px;font-weight:600;flex:1">${nom}</span>
        <span style="display:flex">${votants.slice(0, coeurs).map((q, k) => `<span style="margin-left:${k ? -16 : 0}px">${avatar(q, 46)}</span>`).join('')}</span>
        <span class="chiffre" style="display:flex;align-items:center;gap:8px;color:var(--corail);font-weight:700;font-size:30px">${ico('heart', 28, 2.6)}${coeurs}</span></div>`, classement);
    surgir(r, 37.0 + i * 0.9, { y: 24, hauteur: i });
  });

  /* =====================================================================
     P9 — Alerte de prix (40 → 43 s)
     ===================================================================== */
  const p9 = plan('alerte');
  montrer(p9, 39.6, 43.5);
  glisse(p9, p8, 40.0);
  const t9 = titre(p9.cadre, L('Le prix baisse ?<br><em class="lagon">Vous êtes prévenus.</em>', 'Price drop?<br><em class="lagon">You’ll know.</em>'), { x: 140, y: 250, classe: 'titre l', largeur: 1000 });
  apparaitre(t9, 40.25);
  const tel9 = telephone(p9.cadre, { x: 1230, y: 84, sombre: true, onglets: false });
  tel9.ecran.insertAdjacentHTML('afterbegin', `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#1d2f57 0%,#5a3d6b 38%,#d9706a 70%,#f6b58a 100%)"></div>
    <div style="position:absolute;left:95px;top:600px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,#ffe2b0 0%,rgba(255,226,176,.6) 45%,rgba(255,226,176,0) 70%)"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:150px;background:linear-gradient(180deg,#2f4f6b,#17283c)"></div>
    <div style="position:absolute;top:110px;width:100%;text-align:center;color:#fff"><div style="font-size:20px;font-weight:600;opacity:.9">${L('lundi 18 mai', 'Monday, May 18')}</div><div class="chiffre" style="font-size:104px;font-weight:600;letter-spacing:-.03em;line-height:1">08:41</div></div>`);
  tel9.ecran.querySelector('.tel-statut').style.background = 'transparent';
  entreeTel(tel9, 39.9, { rotY: -10 });
  const notif = h(`<div style="position:absolute;left:14px;right:14px;top:330px;border-radius:26px;padding:16px 18px;background:rgba(250,248,244,.86);backdrop-filter:blur(16px);display:flex;gap:14px;z-index:5;box-shadow:0 20px 40px -20px rgba(0,0,0,.5)">
      <img src="/apps/web/public/icons/icon.svg" style="width:44px;height:44px;border-radius:11px">
      <div style="flex:1;font-size:16px;line-height:1.3"><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:650;color:#6b6355;letter-spacing:.04em"><span>TRIPORA</span><span>${L('maintenant', 'now')}</span></div>
      <b style="font-size:17px">${L('Un prix que vous suivez a baissé', 'A price you’re watching just dropped')}</b><br>${L('Ouvrez Tripora pour voir de combien.', 'Open Tripora to see by how much.')}</div></div>`, tel9.ecran);
  tl.fromTo(notif, { y: -260, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: ease.pose }, 40.7);
  sfx('notification', 40.75);
  const prix9 = h(`<div class="carte" style="left:140px;top:600px;width:720px;padding:30px 36px;display:flex;align-items:center;gap:28px">
      <div class="pastille" style="width:84px;height:84px;background:var(--lagon)">${ico('trending-down', 44, 2.4)}</div>
      <div style="flex:1"><div class="etiquette">${L('Paris → Denpasar · juillet', 'Paris → Denpasar · July')}</div>
      <div style="display:flex;align-items:baseline;gap:18px;margin-top:6px"><s class="chiffre" style="font-size:34px;color:var(--muet)">${L('612 €', '€612')}</s><span class="titre chiffre" style="font-size:64px;color:var(--lagon)">${L('548 €', '€548')}</span></div></div>
      <span style="font-weight:700;font-size:26px;color:var(--lagon);background:#2f8f881c;padding:10px 16px;border-radius:12px">${L('−64 €', '−€64')}</span></div>`, p9.cadre);
  surgir(prix9, 41.5, { hauteur: 4 });
  const pied9 = h(`<div class="texte s" style="position:absolute;left:140px;top:790px">${L('Tripora surveille les vols chaque matin, pour vous.', 'Tripora checks flights every morning, for you.')}</div>`, p9.cadre);
  surgir(pied9, 41.9, { son: null, y: 20 });

  /* =====================================================================
     P10 — L'itinéraire et la carte (43 → 50 s) · 02 Organiser
     ===================================================================== */
  const p10 = plan('itineraire');
  montrer(p10, 42.5, 50.5);
  feuille(p10, p9, 43.0, 0.9);
  const tel10 = telephone(p10.cadre, { image: 'itineraire-long.jpg', x: 110, y: 84 });
  entreeTel(tel10, 43.2, { de: 'gauche', rotY: 7 });
  defiler(tel10, 44.4, R.itineraire.jour1 - 255, 1.0);
  // Jusqu'en bas de la page, pas plus loin : l'écran fait 844 px de haut.
  defiler(tel10, 46.6, R.itineraire.hauteur - 844, 2.0);
  const st10 = h(`<div class="sur-titre" style="position:absolute;left:660px;top:70px">${L('02 — Organiser', '02 — Plan')}</div>`, p10.cadre);
  surgir(st10, 43.3, { son: null, y: 20 });
  const t10 = titre(p10.cadre, L('Un itinéraire jour par jour,<br><em>avec de vrais lieux.</em>', 'A day-by-day itinerary,<br><em>with real places.</em>'), { x: 660, y: 112, classe: 'titre s', largeur: 1180 });
  apparaitre(t10, 43.4);
  const boiteCarte = h(`<div style="position:absolute;left:640px;top:300px;width:780px;height:499px;border-radius:24px;box-shadow:0 40px 80px -40px rgba(26,23,19,.5)">${ILLU.carteBali().replace('width="1000" height="640"', 'width="780" height="499"')}</div>`, p10.cadre);
  surgir(boiteCarte, 43.6, { son: null, y: 50 });
  const svg10 = boiteCarte.querySelector('svg');
  const NS = 'http://www.w3.org/2000/svg';
  function epingle(svg, lieu, couleur, t, numero, gauche = false) {
    const [x, y] = ILLU.projeter(ILLU.LIEUX[lieu]);
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = `<g class="ep"><path d="M0,0 C-14,-18 -22,-28 -22,-40 A22,22 0 1 1 22,-40 C22,-28 14,-18 0,0Z" fill="${couleur}" stroke="#fffdf8" stroke-width="3"/>
      <text x="0" y="-33" text-anchor="middle" font-family="Inter Tight" font-weight="800" font-size="20" fill="#fff">${numero}</text></g>
      <g class="lb"><rect x="${gauche ? -30 - ILLU.LIEUX[lieu][2].length * 11.5 - 24 : 30}" y="-60" rx="10" width="${ILLU.LIEUX[lieu][2].length * 11.5 + 24}" height="36" fill="#fffdf8" stroke="#e6ddcb"/>
      <text x="${gauche ? -30 - ILLU.LIEUX[lieu][2].length * 11.5 - 12 : 42}" y="-35" font-family="Inter Tight" font-weight="650" font-size="20" fill="#1a1713">${ILLU.LIEUX[lieu][2]}</text></g>`;
    g.setAttribute('transform', `translate(${x},${y})`);
    svg.querySelector('.epingles').appendChild(g);
    tl.fromTo(g.querySelector('.ep'), { y: -60, scale: 0.4, autoAlpha: 0, transformOrigin: '50% 100%' }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.55, ease: ease.pose }, t);
    tl.fromTo(g.querySelector('.lb'), { autoAlpha: 0, x: gauche ? 10 : -10 }, { autoAlpha: 1, x: 0, duration: 0.4, ease: ease.pose }, t + 0.15);
    sfx('epingle', t);
    return [x, y];
  }
  function route(svg, a, b, couleur, t, duree = 0.6) {
    const p = document.createElementNS(NS, 'path');
    const mx = (a[0] + b[0]) / 2 + (b[1] - a[1]) * 0.2, my = (a[1] + b[1]) / 2 - (b[0] - a[0]) * 0.2;
    p.setAttribute('d', `M${a[0]},${a[1] - 6} Q${mx},${my} ${b[0]},${b[1] - 6}`);
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', couleur); p.setAttribute('stroke-width', '5'); p.setAttribute('stroke-linecap', 'round');
    svg.querySelector('.routes').appendChild(p);
    trait(p, t, duree);
  }
  const J1 = '#2f8f88', J2 = '#1a5fb4', J3 = '#c08a2e', J4 = '#8b6cf0';
  const a1 = epingle(svg10, 'seminyak', J1, 44.3, 1, true), b1 = epingle(svg10, 'canggu', J1, 44.75, 1, true);
  route(svg10, a1, b1, J1, 44.5);
  const a2 = epingle(svg10, 'ubud', J2, 45.3, 2, true), b2 = epingle(svg10, 'tegallalang', J2, 45.7, 2), c2b = epingle(svg10, 'tibumana', J2, 46.1, 2);
  route(svg10, a2, b2, J2, 45.45); route(svg10, b2, c2b, J2, 45.85);
  const a3 = epingle(svg10, 'sidemen', J3, 46.5, 3), b3 = epingle(svg10, 'amed', J3, 46.9, 3, true);
  route(svg10, a3, b3, J3, 46.65);
  const jours = h(`<div class="carte" style="left:1450px;top:300px;width:400px;padding:22px 24px;z-index:3"><div class="etiquette" style="margin-bottom:10px">${L('Le programme', 'The plan')}</div></div>`, p10.cadre);
  surgir(jours, 44.1, { son: null });
  const lignesJours = L([['Jour 1', 'Seminyak et Canggu', J1], ['Jour 2', 'Ubud et les rizières', J2], ['Jour 3', 'Plongée à Amed', J3], ['Jour 4', 'Musées et spa', J4]],
    [['Day 1', 'Seminyak and Canggu', J1], ['Day 2', 'Ubud and rice fields', J2], ['Day 3', 'Diving in Amed', J3], ['Day 4', 'Museums and spa', J4]]).map(([j, d, c], i) => {
    const l = h(`<div style="position:relative;display:flex;align-items:center;gap:14px;padding:13px 0;border-top:1px solid var(--filet);font-size:22px;min-height:57px">
        <b style="width:76px">${j}</b><span class="activite" style="flex:1;display:flex;align-items:center;gap:12px;color:var(--encre-douce);font-weight:500;line-height:1.2"><span style="flex:none;width:14px;height:14px;border-radius:50%;background:${c}"></span>${d}</span><span class="meteo" style="color:var(--marque)"></span></div>`, jours);
    surgir(l, 44.3 + i * 0.55, { y: 16, son: null });
    return l;
  });
  lignesJours[2].querySelector('.meteo').innerHTML = ico('cloud-rain', 28, 2.2);
  lignesJours[3].querySelector('.meteo').innerHTML = ico('sun', 28, 2.2);
  gsap.set(lignesJours[3].querySelector('.meteo'), { color: 'var(--or)' });
  tl.fromTo(lignesJours[2].querySelector('.meteo'), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4, ease: ease.pose }, 47.4);
  sfx('pluie', 47.4);
  const conseil = h(`<div class="carte" style="left:1450px;top:620px;width:400px;padding:22px 24px;z-index:3;font-size:21px;line-height:1.35">
      <div style="display:flex;gap:10px;align-items:center;font-weight:700;color:var(--marque)">${ico('cloud-rain', 26, 2.2)}${L('Pluie prévue jeudi', 'Rain expected Thursday')}</div>
      <div style="margin:8px 0 16px;color:var(--encre-douce)">${L('Échanger la plongée avec la journée à l’abri de vendredi ?', 'Swap the dive with Friday’s indoor day?')}</div>
      <div class="btn" style="display:inline-flex;align-items:center;gap:10px;padding:12px 18px;border-radius:12px;background:var(--marque);color:#fff;font-weight:650">${ico('arrow-left-right', 22, 2.4)}${L('Échanger', 'Swap')}</div></div>`, p10.cadre);
  surgir(conseil, 47.7, { hauteur: 2 });
  toucher(conseil, 120, 160, 48.55);
  tl.to(conseil.querySelector('.btn'), { scale: 0.94, duration: 0.1, yoyo: true, repeat: 1 }, 48.55);
  const ecart = lignesJours[3].offsetTop - lignesJours[2].offsetTop;
  tl.to(lignesJours[2].querySelector('.activite'), { y: ecart, duration: 0.55, ease: ease.entre }, 48.75);
  tl.to(lignesJours[3].querySelector('.activite'), { y: -ecart, duration: 0.55, ease: ease.entre }, 48.75);
  sfx('glisse', 48.75, { doux: true });
  const s10 = titre(p10.cadre, L('Il pleut jeudi ? Tripora propose d’échanger deux journées.', 'Rain on Thursday? Tripora suggests swapping two days.'), { x: 640, y: 840, classe: 'texte s', largeur: 800 });
  apparaitre(s10, 47.6, { stagger: 0.025 });

  /* =====================================================================
     P11 — Partager vers Tripora (50 → 54 s)
     ===================================================================== */
  const p11 = plan('partager');
  montrer(p11, 49.6, 54.5);
  glisse(p11, p10, 50.0);
  const video = h(`<div style="position:absolute;left:250px;top:200px;width:380px;height:676px;border-radius:30px;overflow:hidden;box-shadow:0 40px 80px -36px rgba(26,23,19,.6)">
      <div style="position:absolute;inset:0;transform:scale(1.7);transform-origin:50% 40%">${ILLU.cascade().replace('<svg', '<svg width="380" height="676"')}</div>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,.6))"></div>
      <div style="position:absolute;left:50%;top:44%;width:96px;height:96px;margin:-48px;border-radius:50%;background:rgba(255,255,255,.88);display:grid;place-items:center;color:#1a1713">${ico('play', 44, 2)}</div>
      <div style="position:absolute;left:24px;right:24px;bottom:120px;color:#fff;font-weight:700;font-size:26px;line-height:1.2">${L('Les 5 plus belles cascades de Bali', 'The 5 most beautiful waterfalls in Bali')}</div>
      <div style="position:absolute;left:24px;bottom:84px;color:rgba(255,255,255,.85);font-weight:600;font-size:18px">${L('@voyageuse · 1,2 M de vues', '@wanderer · 1.2M views')}</div>
      <div class="feuille-partage" style="position:absolute;left:0;right:0;bottom:0;height:250px;background:var(--feuille);border-radius:28px 28px 0 0;padding:26px 24px">
        <div style="font-weight:700;font-size:22px;margin-bottom:22px">${L('Partager', 'Share')}</div>
        <div style="display:flex;justify-content:space-between">
          ${[['#3cbf63', 'messages-square', 'Messages'], ['#3b8ae6', 'mail', L('E-mail', 'Mail')], ['', '', 'Tripora'], ['#8a8378', 'file-text', L('Copier', 'Copy')]].map(([c, i, n]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;font-size:16px;font-weight:600;color:#524b3f">${n === 'Tripora' ? '<img class="cible-tripora" src="/apps/web/public/icons/icon.svg" style="width:66px;height:66px;border-radius:16px">' : `<div style="width:66px;height:66px;border-radius:16px;background:${c};color:#fff;display:grid;place-items:center">${ico(i, 32, 2)}</div>`}${n}</div>`).join('')}
        </div></div></div>`, p11.cadre);
  surgir(video, 50.15, { son: null, y: 60 });
  const feuillePartage = video.querySelector('.feuille-partage');
  tl.fromTo(feuillePartage, { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: ease.pose }, 50.9);
  sfx('souffle', 50.9, { doux: true });
  toucher(feuillePartage, 225, 96, 51.45);
  tl.to(video, { scale: 0.18, x: 640, y: -40, rotation: 8, autoAlpha: 0, duration: 0.7, ease: 'power3.in' }, 51.8);
  sfx('glisse', 51.8);
  const t11 = titre(p11.cadre, L('Vu sur les réseaux ?<br><em>Partagez-le à Tripora.</em>', 'Saw it online?<br><em>Share it to Tripora.</em>'), { x: 820, y: 100, classe: 'titre s', largeur: 1000 });
  apparaitre(t11, 50.35);
  const boite11 = h(`<div style="position:absolute;left:820px;top:300px;width:1000px;height:640px;border-radius:28px;box-shadow:0 40px 80px -40px rgba(26,23,19,.5)">${ILLU.carteBali()}</div>`, p11.cadre);
  surgir(boite11, 50.6, { son: null, y: 40 });
  const svg11 = boite11.querySelector('svg');
  epingle(svg11, 'tegenungan', '#e2574c', 52.3, '♥', true);
  epingle(svg11, 'tibumana', '#e2574c', 52.5, '♥');
  epingle(svg11, 'sekumpul', '#e2574c', 52.7, '♥');
  const explication = titre(p11.cadre, L('Une vidéo, une page, un lien Maps : Tripora en tire les lieux et les épingle sur la carte du groupe.', 'A video, a page, a Maps link: Tripora finds the places and pins them on the group map.'), { x: 160, y: 430, classe: 'texte', largeur: 580 });
  apparaitre(explication, 52.35, { stagger: 0.02 });
  const ajout = h(`<div style="position:absolute;left:1300px;top:860px;display:flex;align-items:center;gap:12px;padding:14px 24px;border-radius:999px;background:var(--lagon);color:#fff;font-weight:650;font-size:26px;box-shadow:0 16px 30px -16px rgba(0,0,0,.45)">${ico('map-pin', 28, 2.4)}${L('3 épingles ajoutées au voyage', '3 pins added to the trip')}</div>`, p11.cadre);
  surgir(ajout, 52.95, { hauteur: 6 });

  /* =====================================================================
     P12 — Réservations et coffre (54 → 59 s)
     ===================================================================== */
  const p12 = plan('coffre');
  montrer(p12, 53.5, 59.5);
  feuille(p12, p11, 54.0, 0.9);
  const t12 = titre(p12.cadre, L('Réservations, billets, codes :<br><em>tout le groupe a tout.</em>', 'Bookings, tickets, codes:<br><em>the whole group has it all.</em>'), { x: 140, y: 100, classe: 'titre s', largeur: 1400 });
  apparaitre(t12, 54.3);
  const mail = h(`<div class="carte" style="left:140px;top:380px;width:600px;padding:30px 34px;font-size:24px;line-height:1.5">
      <div style="display:flex;align-items:center;gap:14px;font-weight:700;margin-bottom:14px"><span class="pastille" style="width:52px;height:52px;background:#3b8ae6">${ico('mail', 28, 2)}</span>${L('Confirmation de réservation', 'Booking confirmation')}</div>
      <div style="color:var(--encre-douce)">${L('Bonjour Inès, votre séjour est confirmé.', 'Hi Inès, your stay is confirmed.')}<br><b style="color:var(--encre)">Villa Kayu, Ubud</b><br>${L('Arrivée le 14 juillet · 5 nuits', 'Check-in July 14 · 5 nights')}<br>${L('Référence :', 'Reference:')} <b class="chiffre">HX82KQ</b></div></div>`, p12.cadre);
  surgir(mail, 54.45, { son: null, y: 50 });
  const fleche12 = h(`<div style="position:absolute;left:770px;top:520px;color:var(--marque)">${ico('sparkles', 56, 2)}</div>`, p12.cadre);
  surgir(fleche12, 55.2, { hauteur: 2 });
  const billet = h(`<div class="carte" style="left:860px;top:400px;width:500px;height:300px;padding:0;overflow:hidden;display:flex">
      <div style="width:18px;background:var(--marque)"></div>
      <div style="flex:1;padding:28px 30px;position:relative">
        <div class="etiquette" style="display:flex;align-items:center;gap:10px;color:var(--marque)">${ico('bed-double', 26, 2.2)}${L('Hébergement', 'Lodging')}</div>
        <div class="titre" style="font-size:44px;margin:12px 0 10px">Villa Kayu, Ubud</div>
        <div style="font-size:24px;color:var(--encre-douce);font-weight:500">${L('14 → 19 juillet · 5 nuits', 'July 14 → 19 · 5 nights')}</div>
        <div style="position:absolute;left:30px;right:30px;bottom:26px;display:flex;justify-content:space-between;border-top:2px dashed var(--filet);padding-top:16px;font-size:22px"><span class="etiquette">${L('Réf.', 'Ref.')}</span><b class="chiffre" style="letter-spacing:.12em">HX82KQ</b></div>
      </div></div>`, p12.cadre);
  surgir(billet, 55.45, { hauteur: 3, echelle: 0.8 });
  const lue = h(`<div class="texte s" style="position:absolute;left:860px;top:730px;width:520px;font-size:23px">${L('Lue dans l’e-mail, rangée dans le voyage, sans rien recopier.', 'Read from the email, filed in the trip.')}</div>`, p12.cadre);
  surgir(lue, 55.9, { son: null, y: 16 });
  const coffre = h(`<div style="position:absolute;left:1420px;top:330px;width:400px"><div class="etiquette" style="margin-bottom:16px">${L('Coffre du voyage', 'Trip vault')}</div></div>`, p12.cadre);
  surgir(coffre, 56.0, { son: null, y: 10 });
  L([['wifi', 'Wifi de la villa', 'kayu-guest · ••••••••', '#3b8ae6'], ['key-round', 'Code du portail', '4 8 1 5', '#c98a4a'], ['file-text', 'Billets d’avion', 'PDF · 4 passagers', '#6f6cf5']],
    [['wifi', 'Villa wifi', 'kayu-guest · ••••••••', '#3b8ae6'], ['key-round', 'Gate code', '4 8 1 5', '#c98a4a'], ['file-text', 'Plane tickets', 'PDF · 4 passengers', '#6f6cf5']]).forEach(([i, t, d, c], k) => {
    const e = h(`<div class="carte" style="position:relative;margin-bottom:18px;padding:20px 22px;display:flex;align-items:center;gap:18px">
        <span class="pastille" style="width:58px;height:58px;background:${c}">${ico(i, 30, 2)}</span>
        <div style="flex:1"><div style="font-weight:700;font-size:24px">${t}</div><div class="chiffre" style="font-size:21px;color:var(--muet);margin-top:2px">${d}</div></div>
        <span style="color:var(--muet)">${ico('lock', 24, 2.2)}</span></div>`, coffre);
    surgir(e, 56.2 + k * 0.28, { x: 30, hauteur: k + 2 });
  });
  const horsLigne = h(`<div style="position:absolute;left:1420px;top:830px;display:flex;gap:14px">
      <span style="display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:999px;background:var(--lagon);color:#fff;font-weight:650;font-size:22px">${ico('cloud-off', 24, 2.4)}${L('Disponible hors ligne', 'Available offline')}</span></div>`, p12.cadre);
  surgir(horsLigne, 57.15, { hauteur: 7 });
  const carteHL = h(`<div style="position:absolute;left:140px;top:780px;display:flex;align-items:center;gap:14px;padding:16px 24px;border-radius:16px;background:var(--feuille);border:1px solid var(--filet);font-size:24px;font-weight:600;box-shadow:0 14px 30px -20px rgba(0,0,0,.35)">
      <span style="color:var(--or)">${ico('map', 30, 2.2)}</span>${L('Et la carte de Bali, gardée sur le téléphone.', 'Plus the map of Bali, saved on your phone.')}</div>`, p12.cadre);
  surgir(carteHL, 57.5, { hauteur: 5 });

  /* =====================================================================
     P13 — Tout le reste (59 → 62 s)
     ===================================================================== */
  const p13 = plan('outils');
  montrer(p13, 58.5, 62.3);
  feuille(p13, p12, 59.0, 0.9);
  const t13 = titre(p13.cadre, L('Et tout ce qui va avec.', 'And everything else you need.'), { x: 0, y: 150, classe: 'titre m', largeur: 1920, centre: true });
  apparaitre(t13, 59.25);
  const OUTILS = L([
    ['route', 'Itinéraire', '#f05d6c'], ['bed-double', 'Réservations', '#6f6cf5'], ['key-round', 'Coffre', '#c98a4a'], ['clipboard-check', 'Qui fait quoi', '#7cb342'],
    ['vote', 'Sondages', '#ec6ea1'], ['images', 'Journal photo', '#26a69a'], ['messages-square', 'Discussion', '#42a5f5'], ['map', 'Carte hors ligne', '#f39a3d'],
    ['wallet', 'Dépenses', '#45a35f'], ['luggage', 'Ma valise', '#ff9f43'], ['info', 'Infos pratiques', '#7d8ca8'], ['calendar-plus', 'Calendrier', '#e2574c'],
  ], [
    ['route', 'Itinerary', '#f05d6c'], ['bed-double', 'Bookings', '#6f6cf5'], ['key-round', 'Vault', '#c98a4a'], ['clipboard-check', 'Who does what', '#7cb342'],
    ['vote', 'Polls', '#ec6ea1'], ['images', 'Photo journal', '#26a69a'], ['messages-square', 'Chat', '#42a5f5'], ['map', 'Offline map', '#f39a3d'],
    ['wallet', 'Expenses', '#45a35f'], ['luggage', 'My packing', '#ff9f43'], ['info', 'Practical info', '#7d8ca8'], ['calendar-plus', 'Calendar', '#e2574c'],
  ]);
  const ordre = [2, 3, 8, 9, 1, 4, 7, 10, 0, 5, 6, 11];
  OUTILS.forEach(([i, nom, c], k) => {
    const col = k % 6, lig = Math.floor(k / 6);
    const e = h(`<div style="position:absolute;left:${960 + (col - 2.5) * 260 - 100}px;top:${360 + lig * 300}px;width:200px;display:flex;flex-direction:column;align-items:center;gap:20px">
        <div class="pastille" style="width:150px;height:150px;background:${c}">${ico(i, 70, 1.9)}</div>
        <div style="font-weight:650;font-size:26px;text-align:center">${nom}</div></div>`, p13.cadre);
    const t = 59.55 + ordre.indexOf(k) * 0.105;
    tl.fromTo(e, { scale: 0.3, autoAlpha: 0, y: 40 }, { scale: 1, autoAlpha: 1, y: 0, duration: 0.6, ease: 'back.out(1.4)' }, t);
    sfx('pop', t, { hauteur: ordre.indexOf(k) });
    tl.to(e, { scale: 0.6, autoAlpha: 0, duration: 0.35, ease: ease.sort }, 61.55 + col * 0.02);
  });

  /* =====================================================================
     P14 — Scanner un ticket (62 → 67 s) · 03 Vivre
     ===================================================================== */
  const p14 = plan('ticket');
  montrer(p14, 61.9, 67.5);
  tl.fromTo(p14.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, 61.9);
  sfx('impact', 62.0, { leger: true });
  const st14 = h(`<div class="sur-titre" style="position:absolute;left:140px;top:80px">${L('03 — Vivre', '03 — Live')}</div>`, p14.cadre);
  surgir(st14, 62.1, { son: null, y: 20 });
  const t14 = titre(p14.cadre, L('Un ticket ? Une photo.<br><em>La dépense est notée.</em>', 'A receipt? Snap it.<br><em>The expense is logged.</em>'), { x: 140, y: 122, classe: 'titre s', largeur: 900 });
  apparaitre(t14, 62.2);
  const ticket = h(`<div style="position:absolute;left:180px;top:340px;width:430px;padding:34px 34px 54px;background:#fffef9;transform:rotate(-3deg);box-shadow:0 30px 60px -30px rgba(26,23,19,.45);font-size:21px;line-height:1.55;color:#2a251f;clip-path:polygon(0 0,100% 0,100% 96%,95% 100%,90% 96%,85% 100%,80% 96%,75% 100%,70% 96%,65% 100%,60% 96%,55% 100%,50% 96%,45% 100%,40% 96%,35% 100%,30% 96%,25% 100%,20% 96%,15% 100%,10% 96%,5% 100%,0 96%)" class="mono">
      <div style="text-align:center;font-weight:700;font-size:26px">WARUNG MADE</div><div style="text-align:center;font-size:18px;opacity:.7">Jl. Raya Ubud · 14/07/26</div>
      <div style="border-top:2px dashed #b9ae9a;margin:14px 0"></div>
      ${[['2 Nasi campur', '130.000'], ['1 Babi guling', '95.000'], ['3 Es kelapa', '84.000'], ['2 Mie goreng', '110.000'], ['1 Air mineral', '12.000'], ['Service', '21.000'], ['Pajak', '34.000']].map(([a, b]) => `<div style="display:flex;justify-content:space-between"><span>${a}</span><span>${b}</span></div>`).join('')}
      <div style="border-top:2px dashed #b9ae9a;margin:14px 0"></div>
      <div class="total" style="display:flex;justify-content:space-between;font-weight:700;font-size:26px;padding:4px 8px;margin:0 -8px;border-radius:6px"><span>TOTAL</span><span>486.000</span></div>
      <div style="text-align:center;margin-top:12px;opacity:.7">Terima kasih !</div></div>`, p14.cadre);
  surgir(ticket, 62.35, { son: 'papier', y: 80 });
  const viseur = h(`<div style="position:absolute;left:150px;top:310px;width:500px;height:690px;z-index:4">
      ${['left:0;top:0;border-left:6px solid;border-top:6px solid', 'right:0;top:0;border-right:6px solid;border-top:6px solid', 'left:0;bottom:0;border-left:6px solid;border-bottom:6px solid', 'right:0;bottom:0;border-right:6px solid;border-bottom:6px solid'].map((s) => `<div style="position:absolute;width:70px;height:70px;border-color:var(--lagon);border-radius:6px;${s}"></div>`).join('')}
      <div class="balayage" style="position:absolute;left:10px;right:10px;top:0;height:6px;border-radius:3px;background:var(--lagon);box-shadow:0 0 30px 10px rgba(47,143,136,.45)"></div></div>`, p14.cadre);
  tl.fromTo(viseur, { scale: 1.15, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: ease.pose }, 62.9);
  sfx('declic', 63.0);
  tl.fromTo(viseur.querySelector('.balayage'), { y: 20 }, { y: 660, duration: 1.0, ease: 'power1.inOut' }, 63.15);
  sfx('balayage', 63.15);
  tl.to(ticket.querySelector('.total'), { backgroundColor: 'rgba(47,143,136,.22)', boxShadow: '0 0 0 3px #2f8f88', duration: 0.25 }, 64.2);
  sfx('bip', 64.25);
  tl.to(viseur, { autoAlpha: 0, duration: 0.3 }, 64.5);
  const depense = h(`<div class="carte" style="left:860px;top:370px;width:620px;padding:34px 38px">
      <div class="etiquette" style="color:var(--lagon)">${L('Nouvelle dépense · lue sur le ticket', 'New expense · read from the receipt')}</div>
      <div class="titre" style="font-size:52px;margin:12px 0 4px">Warung Made</div>
      <div style="font-size:24px;color:var(--muet);font-weight:600">${L('Repas · payé par Inès · 14 juillet', 'Meal · paid by Inès · July 14')}</div>
      <div style="display:flex;align-items:baseline;gap:20px;margin-top:22px"><span class="titre chiffre" style="font-size:60px">${L('486 000 IDR', 'IDR 486,000')}</span></div>
      <div class="conv" style="display:flex;align-items:center;gap:14px;margin-top:6px;font-size:30px;font-weight:700;color:var(--lagon)">≈ <span class="chiffre">${L('27,80 €', '€27.80')}</span><span style="font-size:20px;font-weight:600;color:var(--muet)">${L('au taux de la BCE du jour', 'at today’s ECB rate')}</span></div>
      <div class="parts" style="display:flex;gap:16px;margin-top:26px;padding-top:22px;border-top:1px solid var(--filet)">
        ${votants.map((q) => `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">${avatar(q, 66)}<b class="chiffre" style="font-size:22px">${L('6,95 €', '€6.95')}</b></div>`).join('')}
        <div style="margin-left:auto;align-self:center;font-size:22px;color:var(--muet);font-weight:600;text-align:right">${L('Partagée<br>en quatre', 'Split<br>four ways')}</div></div></div>`, p14.cadre);
  tl.fromTo(depense, { x: -360, y: 80, scale: 0.5, rotation: -6, autoAlpha: 0 }, { x: 0, y: 0, scale: 1, rotation: 0, autoAlpha: 1, duration: 0.8, ease: ease.pose }, 64.5);
  sfx('souffle', 64.5);
  tl.fromTo(depense.querySelector('.conv'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: ease.pose }, 65.1);
  tl.fromTo(depense.querySelectorAll('.parts > div'), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: ease.pose, stagger: 0.09 }, 65.6);
  sfx('pieces', 65.6);
  const prive = h(`<div class="texte s" style="position:absolute;left:860px;top:922px;display:flex;align-items:center;gap:12px;font-size:23px"><span style="color:var(--lagon)">${ico('lock', 24, 2.4)}</span>${L('Lu sur votre téléphone : la photo ne part nulle part.', 'Read on your phone: the photo never leaves it.')}</div>`, p14.cadre);
  surgir(prive, 65.3, { son: null, y: 10 });

  /* =====================================================================
     P15 — Qui doit quoi (67 → 71 s)
     ===================================================================== */
  const p15 = plan('dettes');
  montrer(p15, 66.6, 71.5);
  glisse(p15, p14, 67.0);
  const t15a = titre(p15.cadre, L('Qui doit quoi ?', 'Who owes what?'), { x: 140, y: 200, classe: 'titre l' });
  apparaitre(t15a, 67.2);
  const t15b = titre(p15.cadre, L('<em class="lagon">Réglé en deux virements.</em>', '<em class="lagon">Settled in two transfers.</em>'), { x: 140, y: 330, classe: 'titre m', largeur: 1100 });
  apparaitre(t15b, 69.0);
  const s15 = titre(p15.cadre, L('Tripora simplifie les dettes du groupe : le moins de remboursements possible, au centime près.', 'Tripora simplifies the group’s debts: the fewest payments possible, down to the cent.'), { x: 140, y: 470, classe: 'texte', largeur: 640 });
  apparaitre(s15, 69.3, { stagger: 0.02 });
  const POS = { ines: [1330, 250], hugo: [1650, 560], sarah: [1330, 870], malik: [1010, 560] };
  const svg15 = h('<svg style="position:absolute;left:0;top:0;overflow:visible" width="1920" height="1080"><defs><marker id="pointe" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker></defs><g class="emmeles"></g><g class="nets"></g></svg>', p15.cadre);
  const fleche = (de, a, couleur, epaisseur, courbe, groupe, t, montant) => {
    const [x1, y1] = POS[de], [x2, y2] = POS[a];
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const sx = x1 + Math.cos(ang) * 80, sy = y1 + Math.sin(ang) * 80, ex = x2 - Math.cos(ang) * 86, ey = y2 - Math.sin(ang) * 86;
    const mx = (sx + ex) / 2 - Math.sin(ang) * courbe, my = (sy + ey) / 2 + Math.cos(ang) * courbe;
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', `M${sx},${sy} Q${mx},${my} ${ex},${ey}`);
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', couleur); p.setAttribute('stroke-width', epaisseur); p.setAttribute('stroke-linecap', 'round');
    svg15.querySelector(groupe).appendChild(p);
    // La pointe ne suit pas le tracé progressif : elle n'apparaît qu'une fois le trait arrivé.
    let pointe = null;
    parImage((temps) => {
      const arrivee = temps >= t + 0.42;
      if (arrivee === pointe) return;
      pointe = arrivee;
      if (arrivee) p.setAttribute('marker-end', 'url(#pointe)'); else p.removeAttribute('marker-end');
    });
    tl.fromTo(p, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06 }, t);
    trait(p, t, 0.45);
    if (montant) {
      const e = h(`<div class="chiffre" style="position:absolute;left:${mx - 50}px;top:${my - 26}px;width:100px;text-align:center;padding:8px 0;border-radius:12px;background:${couleur};color:#fff;font-weight:700;font-size:26px">${montant}</div>`, p15.cadre);
      surgir(e, t + 0.3, { son: null, echelle: 0.6, y: 0 });
    }
    return p;
  };
  const emmeles = [['ines', 'hugo', 60], ['hugo', 'sarah', -50], ['sarah', 'malik', 70], ['malik', 'ines', -40], ['ines', 'sarah', 120], ['hugo', 'malik', -110]]
    .map(([a, b, c], i) => fleche(a, b, '#b8ad99', 4, c, '.emmeles', 67.5 + i * 0.16));
  sfx('gribouillis', 67.5);
  tl.to(emmeles, { autoAlpha: 0, duration: 0.35 }, 68.7);
  fleche('hugo', 'ines', '#1a5fb4', 8, 40, '.nets', 68.95, L('42 €', '€42'));
  fleche('malik', 'sarah', '#2f8f88', 8, 40, '.nets', 69.15, L('18 €', '€18'));
  sfx('net', 68.95);
  Object.entries(POS).forEach(([q, [x, y]], i) => {
    const a = h(`<div style="position:absolute;left:${x - 66}px;top:${y - 66}px;display:flex;flex-direction:column;align-items:center;gap:8px;z-index:2">${avatar(q, 132)}<b style="font-size:24px">${AMIS[q].nom}</b></div>`, p15.cadre);
    surgir(a, 67.15 + i * 0.08, { son: null, echelle: 0.6 });
  });
  const remb = h(`<div style="position:absolute;left:1560px;top:700px;display:flex;align-items:center;gap:12px;padding:16px 24px;border-radius:14px;background:var(--marque);color:#fff;font-weight:700;font-size:24px;box-shadow:0 18px 34px -18px rgba(26,95,180,.7);z-index:3">
      <span class="ic">${ico('wallet', 26, 2.2)}</span><span class="lib">${L('Rembourser Inès', 'Pay Inès back')}</span></div>`, p15.cadre);
  surgir(remb, 69.6, { hauteur: 3 });
  toucher(remb, 130, 30, 70.05);
  tl.to(remb, { backgroundColor: '#2f8f88', boxShadow: '0 18px 34px -18px rgba(47,143,136,.7)', duration: 0.2 }, 70.15);
  const icRemb = remb.querySelector('.ic'), libRemb = remb.querySelector('.lib');
  let etatRemb = null;
  parImage((t) => {
    const fait = t >= 70.15;
    if (fait === etatRemb) return;
    etatRemb = fait;
    icRemb.innerHTML = fait ? ico('check', 26, 3) : ico('wallet', 26, 2.2);
    libRemb.textContent = fait ? L('Remboursé', 'Paid back') : L('Rembourser Inès', 'Pay Inès back');
  });
  sfx('ding', 70.15);

  /* =====================================================================
     P16 — Le journal photo (71 → 75 s)
     ===================================================================== */
  const p16 = plan('journal');
  montrer(p16, 70.5, 75.5);
  feuille(p16, p15, 71.0, 0.9);
  const t16 = titre(p16.cadre, L('Le journal photo<br><em>du groupe.</em>', 'The group’s<br><em>photo journal.</em>'), { x: 140, y: 170, classe: 'titre m', largeur: 640 });
  apparaitre(t16, 71.3);
  const s16 = titre(p16.cadre, L('Chacun ajoute les siennes, tout le monde les retrouve, rangées par jour.', 'Everyone adds theirs, everyone finds them, sorted by day.'), { x: 140, y: 400, classe: 'texte', largeur: 560 });
  apparaitre(s16, 72.1, { stagger: 0.025 });
  const PHOTOS = [['plage', L('Jimbaran, le soir', 'Jimbaran at dusk'), 'ines'], ['rizieres', 'Tegallalang', 'hugo'], ['temple', 'Lempuyang', 'sarah'], ['scooter', L('Vers Sidemen', 'To Sidemen'), 'malik'], ['cascade', 'Tibumana', 'ines'], ['amis', L('La bande', 'The crew'), 'hugo']];
  const grille = [[760, 250], [1110, 250], [1460, 250], [760, 640], [1110, 640], [1460, 640]];
  const jour1 = h(`<div class="etiquette" style="position:absolute;left:760px;top:200px">${L('Mardi 14 juillet', 'Tuesday, July 14')}</div>`, p16.cadre);
  const jour2 = h(`<div class="etiquette" style="position:absolute;left:760px;top:590px">${L('Mercredi 15 juillet', 'Wednesday, July 15')}</div>`, p16.cadre);
  PHOTOS.forEach(([illu, legende, qui], i) => {
    const [gx, gy] = grille[i];
    const e = h(`<div style="position:absolute;left:${gx}px;top:${gy}px;width:320px;padding:14px 14px 0;background:#fffef9;box-shadow:0 24px 46px -24px rgba(26,23,19,.5);border-radius:4px">
        <div style="width:292px;height:240px;overflow:hidden">${ILLU[illu]().replace('<svg', '<svg width="292" height="292" style="margin-top:-26px"')}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 4px 14px;font-size:20px;font-weight:600;color:var(--encre-douce)">${legende}<span>${avatar(qui, 36)}</span></div></div>`, p16.cadre);
    const pileX = 1020 + (hasard() * 260 - 130) - gx, pileY = 400 + (hasard() * 160 - 80) - gy, rot = hasard() * 30 - 15;
    const t = 71.4 + i * 0.2;
    tl.fromTo(e, { x: pileX, y: pileY - 700, rotation: rot - 20, autoAlpha: 1 }, { x: pileX, y: pileY, rotation: rot, duration: 0.55, ease: 'power3.out' }, t);
    sfx('photo', t, { hauteur: i });
    tl.to(e, { x: 0, y: 0, rotation: (i % 3 - 1) * 1.5, duration: 0.8, ease: ease.entre }, 73.0 + i * 0.05);
  });
  tl.fromTo([jour1, jour2], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 73.6);
  sfx('glisse', 73.0, { doux: true });

  /* =====================================================================
     P17 — Le bilan et le passeport (75 → 81 s) · 04 Se souvenir
     ===================================================================== */
  const p17 = plan('souvenir');
  montrer(p17, 74.5, 81.3);
  feuille(p17, p16, 75.0, 0.9);
  const st17 = h(`<div class="sur-titre" style="position:absolute;left:140px;top:80px">${L('04 — Se souvenir', '04 — Remember')}</div>`, p17.cadre);
  surgir(st17, 75.2, { son: null, y: 20 });
  const t17 = titre(p17.cadre, L('Votre bilan à partager.<br><em>Votre passeport de voyageur.</em>', 'Your trip recap to share.<br><em>Your traveler’s passport.</em>'), { x: 140, y: 122, classe: 'titre s', largeur: 1500 });
  apparaitre(t17, 75.3);
  const bilan = h(`<div style="position:absolute;left:170px;top:370px;width:480px;transform:rotate(-4deg)">
      <img src="${CAPTURES}/bilan-carte.jpg" style="width:480px;border-radius:26px;box-shadow:0 40px 80px -34px rgba(7,32,63,.7)">
      <div class="partage" style="position:absolute;left:130px;bottom:-74px;display:flex;align-items:center;gap:12px;padding:16px 28px;border-radius:14px;background:var(--marque);color:#fff;font-weight:700;font-size:26px;box-shadow:0 16px 30px -16px rgba(26,95,180,.7)">${ico('share-2', 26, 2.4)}${L('Partager', 'Share')}</div></div>`, p17.cadre);
  tl.fromTo(bilan, { y: 500, rotation: 6, autoAlpha: 0 }, { y: 0, rotation: -4, autoAlpha: 1, duration: 0.9, ease: ease.pose }, 75.5);
  sfx('souffle', 75.5, { doux: true });
  toucher(bilan.querySelector('.partage'), 110, 30, 76.7);
  const passeport = h(`<div style="position:absolute;left:820px;top:330px;width:960px;height:620px;display:flex;border-radius:18px;box-shadow:0 50px 90px -40px rgba(26,23,19,.55);background:#1d2f57;padding:16px">
      <div style="flex:1;background:#f8f1e2;border-radius:10px 0 0 10px;padding:40px 40px;position:relative;background-image:repeating-radial-gradient(circle at 0 100%,transparent 0 18px,rgba(26,95,180,.05) 18px 19px)">
        <div class="etiquette">${L('Passeport du voyageur', 'Traveler’s passport')}</div>
        <div style="display:flex;align-items:center;gap:20px;margin:26px 0">${avatar('ines', 110)}<div><div class="titre" style="font-size:46px">Inès</div><div style="font-size:22px;color:var(--muet);font-weight:600">${L('depuis 2026', 'since 2026')}</div></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:26px">
          ${L([['Pays', '5'], ['Voyages', '8'], ['Km parcourus', '61 380'], ['Jours sur la route', '58']], [['Countries', '5'], ['Trips', '8'], ['Km traveled', '61,380'], ['Days on the road', '58']]).map(([a, b], i) => `<div><div style="font-size:18px;color:var(--muet);font-weight:600">${a}</div><div class="titre chiffre ${i === 0 ? 'nb-pays' : ''}" style="font-size:40px">${b}</div></div>`).join('')}
        </div>
        <div style="font-size:20px;font-weight:700;display:flex;justify-content:space-between"><span class="rang">${L('Baroudeur', 'Adventurer')}</span><span class="suivant" style="color:var(--muet)">${L('Grand voyageur', 'Seasoned traveler')}</span></div>
        <div style="height:12px;border-radius:6px;background:#e6ddcb;margin-top:10px;overflow:hidden"><div class="niveau" style="height:100%;width:62%;background:var(--or);border-radius:6px"></div></div>
      </div>
      <div style="width:4px;background:linear-gradient(90deg,rgba(0,0,0,.18),rgba(0,0,0,0))"></div>
      <div class="tampons" style="flex:1;background:#f8f1e2;border-radius:0 10px 10px 0;position:relative;background-image:repeating-linear-gradient(0deg,transparent 0 46px,rgba(26,95,180,.06) 46px 47px)"></div></div>`, p17.cadre);
  tl.fromTo(passeport, { y: 120, autoAlpha: 0, rotationX: 30, transformPerspective: 1600 }, { y: 0, autoAlpha: 1, rotationX: 0, duration: 1, ease: ease.pose }, 75.8);
  const tampons = passeport.querySelector('.tampons');
  [[{ haut: L('BALI · INDONÉSIE', 'BALI · INDONESIA'), bas: L('ARRIVÉE', 'ARRIVAL'), centre: '07·26', couleur: '#c8463a', rotation: -12 }, 30, 30, 77.25],
   [{ haut: 'LISBOA · PORTUGAL', bas: L('ARRIVÉE', 'ARRIVAL'), centre: '10·25', couleur: '#2c4e8a', rotation: 9 }, 222, 178, 77.75],
   [{ haut: L('BUDAPEST · HONGRIE', 'BUDAPEST · HUNGARY'), bas: L('ARRIVÉE', 'ARRIVAL'), centre: '03·26', couleur: '#2f7a5e', rotation: -4 }, 44, 350, 78.25]].forEach(([o, x, y, t]) => {
    const e = h(`<div style="position:absolute;left:${x}px;top:${y}px;width:220px;height:220px">${ILLU.tampon(o)}</div>`, tampons);
    tl.fromTo(e, { scale: 2.2, autoAlpha: 0 }, { scale: 1, autoAlpha: 0.9, duration: 0.18, ease: 'power4.in' }, t);
    tl.to(passeport, { y: '+=5', duration: 0.05, yoyo: true, repeat: 1 }, t + 0.18);
    sfx('tampon', t + 0.18, { leger: true });
  });
  const niveau = passeport.querySelector('.niveau');
  tl.to(niveau, { width: '100%', duration: 0.6, ease: ease.entre }, 78.8);
  tl.set(niveau, { width: '0%' }, 79.5);
  tl.to(niveau, { width: '16%', duration: 0.5, ease: ease.pose }, 79.55);
  const rang = passeport.querySelector('.rang'), suivant = passeport.querySelector('.suivant'), nbPays = passeport.querySelector('.nb-pays');
  parImage((t) => {
    const promu = t >= 79.5;
    rang.textContent = promu ? L('Grand voyageur', 'Seasoned traveler') : L('Baroudeur', 'Adventurer');
    rang.style.color = promu ? '#c08a2e' : '';
    suivant.textContent = promu ? L('Globe-trotter', 'Globetrotter') : L('Grand voyageur', 'Seasoned traveler');
    nbPays.textContent = promu ? '6' : '5';
  });
  sfx('niveau', 79.5);
  const plusUn = h(`<div style="position:absolute;left:1640px;top:300px;padding:12px 22px;border-radius:999px;background:var(--or);color:#fff;font-weight:700;font-size:26px;box-shadow:0 16px 30px -16px rgba(0,0,0,.4)">${L('Nouveau rang !', 'New rank!')}</div>`, p17.cadre);
  surgir(plusUn, 79.55, { son: null, echelle: 0.6 });

  /* =====================================================================
     P18 — Bientôt (81 → 85 s)
     ===================================================================== */
  const p18 = plan('bientot', 'nuit');
  montrer(p18, 80.5, 85.4);
  iris(p18, 81.0, 0.55, '50%', '60%');
  for (let i = 0; i < 70; i++) {
    const s = h(`<div style="position:absolute;left:${hasard() * 1920}px;top:${hasard() * 1080}px;width:${1.5 + hasard() * 2.5}px;height:${1.5 + hasard() * 2.5}px;border-radius:50%;background:#f4efe4"></div>`, p18.cadre);
    const phase = hasard() * 6, vitesse = 1 + hasard() * 2;
    parImage((t) => { s.style.opacity = 0.15 + 0.45 * (0.5 + 0.5 * Math.sin(t * vitesse + phase)); });
  }
  const pastilleB = h(`<div style="position:absolute;left:50%;top:230px;padding:14px 34px;border-radius:999px;border:2px solid var(--or-clair);color:var(--or-clair);font-weight:700;font-size:26px;letter-spacing:.24em;text-transform:uppercase">${L('Bientôt', 'Coming soon')}</div>`, p18.cadre);
  gsap.set(pastilleB, { xPercent: -50 });
  surgir(pastilleB, 81.2, { son: null, y: 20 });
  const t18 = titre(p18.cadre, L('Et ce n’est que le début.', 'And this is just the beginning.'), { x: 0, y: 320, classe: 'titre m', largeur: 1920, centre: true });
  apparaitre(t18, 81.35);
  L([['smartphone', 'L’app iPhone', 'sur l’App Store'], ['gift', 'Des récompenses', 'à chaque réservation'], ['bell', 'Les notifications', 'du groupe, en direct']],
    [['smartphone', 'The iPhone app', 'on the App Store'], ['gift', 'Rewards', 'with every booking'], ['bell', 'Notifications', 'from your group, live']]).forEach(([i, a, b], k) => {
    const e = h(`<div style="position:absolute;left:${480 + k * 480 - 200}px;top:520px;width:400px;display:flex;flex-direction:column;align-items:center;gap:20px;text-align:center">
        <div style="width:118px;height:118px;border-radius:50%;border:2px solid rgba(232,195,122,.7);display:grid;place-items:center;color:var(--or-clair);background:rgba(232,195,122,.08)">${ico(i, 54, 1.8)}</div>
        <div class="titre" style="font-size:44px;color:#fbf7ee">${a}</div><div class="texte s" style="color:rgba(244,239,228,.75);margin-top:-12px">${b}</div></div>`, p18.cadre);
    surgir(e, 81.9 + k * 0.45, { hauteur: k, son: 'scintille' });
  });
  tl.to(p18.cadre, { autoAlpha: 0, duration: 0.5, ease: ease.sort }, 84.9);

  /* =====================================================================
     P19 — Promesses et fin (85 → 93 s)
     ===================================================================== */
  const p19 = plan('fin');
  montrer(p19, 84.9, 94);
  tl.fromTo(p19.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 84.9);
  const PROMESSES = L(['Gratuit.', 'Sans publicité.', 'Vos données ne sont jamais revendues.'], ['Free.', 'No ads.', 'Your data is never sold.']);
  const promesses = PROMESSES.map((p, i) => {
    const e = titre(p19.cadre, p, { x: 0, y: 300 + i * 130, classe: 'titre m', largeur: 1920, centre: true });
    apparaitre(e, 85.25 + i * 0.6, { stagger: 0.05 });
    sfx('pop', 85.25 + i * 0.6, { hauteur: 2 + i * 2, doux: true });
    effacer(e, 87.75);
    return e;
  });
  const plateformes = titre(p19.cadre, L('Sur le web, Android et iPhone', 'On the web, Android and iPhone'), { x: 0, y: 720, classe: 'texte', largeur: 1920, centre: true });
  apparaitre(plateformes, 87.0, { stagger: 0.03 });
  effacer(plateformes, 87.75);
  const logoFin = h('<img src="/apps/web/public/icons/icon.svg" style="position:absolute;left:870px;top:210px;width:180px;height:180px;border-radius:42px;box-shadow:0 30px 60px -26px rgba(7,32,63,.55)">', p19.cadre);
  tl.fromTo(logoFin, { scale: 0.4, rotation: -10, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 1, ease: 'expo.out' }, 88.0);
  sfx('final', 88.0);
  const motFin = h(`<div class="titre" style="position:absolute;left:0;top:410px;width:1920px;text-align:center;font-size:150px;letter-spacing:-0.04em">${[...'Tripora'].map((c) => `<span class="m"><span class="mi">${c}</span></span>`).join('')}</div>`, p19.cadre);
  apparaitre([...motFin.querySelectorAll('.mi')], 88.2, { stagger: 0.04, duree: 1.1 });
  const devFin = titre(p19.cadre, L('Partez <em>ensemble.</em>', 'Travel <em>together.</em>'), { x: 0, y: 600, classe: 'titre s', largeur: 1920, centre: true, style: 'font-weight:500' });
  apparaitre(devFin, 88.8);
  const cta = h(`<div style="position:absolute;left:50%;top:740px;display:flex;align-items:center;gap:14px;padding:22px 40px;border-radius:16px;background:var(--marque);color:#fff;font-weight:700;font-size:32px;white-space:nowrap;box-shadow:0 24px 44px -22px rgba(26,95,180,.75)">${L('Créez votre premier voyage, sans compte', 'Create your first trip — no account needed')} ${ico('plane', 32, 2.2)}</div>`, p19.cadre);
  gsap.set(cta, { xPercent: -50 });
  surgir(cta, 89.3, { hauteur: 6 });
  const url = h('<div style="position:absolute;left:0;top:860px;width:1920px;text-align:center;font-size:34px;font-weight:650;letter-spacing:.04em;color:var(--encre-douce)">tripora-3rg.pages.dev</div>', p19.cadre);
  surgir(url, 89.7, { son: null, y: 16 });
  tl.to(voile, { opacity: 1, duration: 0.8, ease: 'power1.in' }, 92.6);

  const DUREE = 93.4;
  tl.set({}, {}, DUREE);

  /* ---------- Le rythme ----------
     Les plans sont écrits en « temps de scène » (les secondes ci-dessus). La
     vidéo les joue ECHELLE fois plus lentement, pour laisser le temps de lire :
     ×1,2, 93,4 s de scène → 1 min 52 de vidéo. Les bruitages, la musique (dont
     le tempo suit : 120 → 100), la voix et les sous-titres prennent la même
     échelle, lue dans sortie/cues.json. */
  const ECHELLE = 1.2;
  const enVideo = (t) => Math.round(t * ECHELLE * 1000) / 1000;

  /* ---------- Interface pour le rendu (en temps de vidéo) ---------- */
  window.allerA = (t) => {
    const scene = t / ECHELLE;
    tl.seek(scene, false);
    for (const fn of PAR_IMAGE) fn(scene);
  };
  window.PUB = {
    duree: enVideo(DUREE),
    echelle: ECHELLE,
    cues: CUES.map((c) => ({ ...c, t: enVideo(c.t), ...(c.fin !== undefined ? { fin: enVideo(c.fin) } : {}) })).sort((a, b) => a.t - b.t),
    plans: PLANS.map((p) => ({ ...p, debut: enVideo(p.debut), fin: enVideo(p.fin) })),
  };
  window.pret = (async () => {
    await Promise.all([
      document.fonts.load('600 96px Fraunces'), document.fonts.load('500 96px Fraunces'),
      document.fonts.load('500 30px "Inter Tight"'), document.fonts.load('700 30px "Inter Tight"'), document.fonts.load('600 30px "Inter Tight"'),
    ]);
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((ok) => { i.onload = () => i.decode().then(ok, ok); i.onerror = ok; }))));
    window.allerA(0);
    return true;
  })();
  const t0 = Number(new URLSearchParams(location.search).get('t') ?? 'NaN');
  if (!Number.isNaN(t0)) window.pret.then(() => window.allerA(t0));
})();
