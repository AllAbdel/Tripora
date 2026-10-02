/* Illustrations vectorielles de la pub : cartes postales, polaroïds, carte de
   Bali, tampons du passeport. Style « affiche de voyage » : aplats, dégradés
   doux, pas de photo (aucune banque d'images, rien à créditer). */
(function () {
  let n = 0;
  const id = (p) => `${p}${++n}`;

  /** Générateur pseudo-aléatoire déterministe : la vidéo est identique à chaque rendu. */
  function graine(s) {
    return function () {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const vague = (y, a, l = 600) =>
    `M0,${y} C${l * 0.25},${y - a} ${l * 0.5},${y + a} ${l * 0.75},${y - a * 0.4} S${l},${y + a * 0.5} ${l},${y} L${l},${l} L0,${l} Z`;

  /** Portail balinais fendu (candi bentar), en silhouette. */
  function portail(x, base, h, couleur) {
    const largeur = h * 0.36;
    const marches = 7;
    let gauche = `M${x - largeur - 6},${base}`;
    for (let i = 0; i < marches; i++) {
      const y = base - (h / marches) * (i + 1);
      const rx = x - largeur + (largeur * 0.82 * (i + 1)) / marches;
      gauche += ` L${rx - (largeur * 0.82) / marches},${base - (h / marches) * i} L${rx - (largeur * 0.82) / marches},${y} L${rx},${y}`;
    }
    gauche += ` L${x - 8},${base - h} L${x - 8},${base} Z`;
    const droite = gauche.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, a, b) => `${2 * x - Number(a)},${b}`);
    return `<path d="${gauche}" fill="${couleur}"/><path d="${droite}" fill="${couleur}"/>
      <rect x="${x - largeur - 24}" y="${base - 4}" width="${2 * largeur + 48}" height="16" fill="${couleur}"/>`;
  }

  function palmier(x, base, h, couleur, sens = 1) {
    const sx = x + 26 * sens, sy = base - h;
    let feuilles = '';
    const angles = [-160, -125, -90, -55, -20, 15, -200];
    for (const a of angles) {
      const r = (a * Math.PI) / 180;
      const ex = sx + Math.cos(r) * h * 0.42, ey = sy + Math.sin(r) * h * 0.42 + h * 0.08;
      const cx = sx + Math.cos(r) * h * 0.2, cy = sy + Math.sin(r) * h * 0.2 - h * 0.1;
      feuilles += `<path d="M${sx},${sy} Q${cx},${cy} ${ex},${ey}" stroke="${couleur}" stroke-width="${h * 0.05}" fill="none" stroke-linecap="round"/>`;
    }
    return `<path d="M${x},${base} Q${x + 4 * sens},${base - h * 0.5} ${sx},${sy}" stroke="${couleur}" stroke-width="${h * 0.045}" fill="none" stroke-linecap="round"/>${feuilles}`;
  }

  function bali(w = 600, h = 400, avecPortail = true) {
    const c = id('ciel');
    return `<svg viewBox="0 0 600 400" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe3b4"/><stop offset="1" stop-color="#f5a36d"/></linearGradient></defs>
      <rect width="600" height="400" fill="url(#${c})"/>
      <circle cx="430" cy="150" r="62" fill="#fff4dc" opacity="0.92"/>
      <path d="M150,235 L310,92 Q322,84 334,92 L500,235 Z" fill="#c98b66" opacity="0.6"/>
      <path d="M290,110 L310,92 Q322,84 334,92 L352,110 Q320,124 290,110 Z" fill="#fff2df" opacity="0.7"/>
      <path d="${vague(215, 26)}" fill="#8db85a"/>
      <path d="${vague(250, 22)}" fill="#76a84c"/>
      <path d="${vague(288, 26)}" fill="#5f9442"/>
      <path d="${vague(326, 20)}" fill="#4a7f37"/>
      <path d="${vague(364, 18)}" fill="#3a6a2f"/>
      ${[215, 250, 288, 326].map((y, i) => `<path d="${vague(y, 26 - i * 2).split(' L')[0]}" stroke="#c6e39a" stroke-width="3" fill="none" opacity="0.55"/>`).join('')}
      ${avecPortail ? portail(118, 330, 190, '#3b2a22') : ''}
      ${palmier(520, 300, 170, '#3b2a22', -1)}
    </svg>`;
  }

  function lisbonne(w = 600, h = 400) {
    const c = id('ciel');
    const r = graine(7);
    const couleurs = ['#f6c1a6', '#f7e1a0', '#a9d3e8', '#f2a7a1', '#fff2dc', '#c9e2c5', '#f4b97e'];
    let maisons = '';
    for (const [y0, pente, nb] of [[200, -0.12, 9], [262, 0.08, 10]]) {
      for (let i = 0; i < nb; i++) {
        const x = i * 66 - 10 + r() * 10;
        const hh = 60 + r() * 50;
        const y = y0 + pente * x - hh + 40;
        const coul = couleurs[Math.floor(r() * couleurs.length)];
        maisons += `<rect x="${x}" y="${y}" width="62" height="${hh + 80}" fill="${coul}"/>
          <path d="M${x - 3},${y} L${x + 31},${y - 14} L${x + 65},${y} Z" fill="#c8664b"/>`;
        for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++)
          maisons += `<rect x="${x + 12 + j * 24}" y="${y + 14 + k * 28}" width="12" height="16" rx="2" fill="#5b6f86" opacity="0.75"/>`;
      }
    }
    return `<svg viewBox="0 0 600 400" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9d8ee"/><stop offset="1" stop-color="#eaf5f3"/></linearGradient></defs>
      <rect width="600" height="400" fill="url(#${c})"/>
      <circle cx="110" cy="80" r="40" fill="#fff6dc"/>
      <path d="M380,120 L392,96 L404,120 L416,96 L428,120 L440,96 L452,120 L452,170 L380,170 Z" fill="#d9b48a"/>
      ${maisons}
      <rect x="0" y="330" width="600" height="70" fill="#d8c7a8"/>
      <rect x="0" y="352" width="600" height="5" fill="#8a7c66"/>
      <g transform="translate(205,250)">
        <line x1="70" y1="0" x2="100" y2="-38" stroke="#2a2520" stroke-width="4"/>
        <line x1="100" y1="-38" x2="130" y2="-38" stroke="#2a2520" stroke-width="4"/>
        <rect x="0" y="0" width="200" height="98" rx="16" fill="#f6c234"/>
        <rect x="0" y="0" width="200" height="30" rx="14" fill="#fff4d0"/>
        ${[0, 1, 2, 3].map((i) => `<rect x="${16 + i * 46}" y="36" width="34" height="30" rx="5" fill="#33506b"/>`).join('')}
        <rect x="0" y="74" width="200" height="10" fill="#c8463a"/>
        <circle cx="46" cy="102" r="12" fill="#2a2520"/><circle cx="154" cy="102" r="12" fill="#2a2520"/>
      </g>
    </svg>`;
  }

  function budapest(w = 600, h = 400) {
    const c = id('ciel'), e = id('eau');
    const parlement = (o) => `<g opacity="${o}">
      <rect x="120" y="230" width="360" height="70" fill="#f0c56a"/>
      ${Array.from({ length: 18 }, (_, i) => `<rect x="${128 + i * 20}" y="246" width="7" height="40" fill="#c58a2e"/>`).join('')}
      <path d="M250,230 Q300,140 350,230 Z" fill="#f0c56a"/>
      <rect x="296" y="110" width="8" height="70" fill="#f0c56a"/>
      ${[150, 200, 400, 450].map((x) => `<path d="M${x - 10},230 L${x - 10},190 L${x},170 L${x + 10},190 L${x + 10},230 Z" fill="#f0c56a"/>`).join('')}
      <rect x="100" y="270" width="400" height="30" fill="#e2ac4e"/>
    </g>`;
    return `<svg viewBox="0 0 600 400" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#28396f"/><stop offset="0.65" stop-color="#9c6f8e"/><stop offset="1" stop-color="#f0a37a"/></linearGradient>
        <linearGradient id="${e}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b4372"/><stop offset="1" stop-color="#162848"/></linearGradient>
      </defs>
      <rect width="600" height="400" fill="url(#${c})"/>
      ${[[80, 60], [190, 40], [520, 70], [450, 30], [330, 55]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#fff" opacity="0.8"/>`).join('')}
      ${parlement(1)}
      <rect x="0" y="300" width="600" height="100" fill="url(#${e})"/>
      <g transform="translate(0,600) scale(1,-1)">${parlement(0.22)}</g>
      ${[320, 340, 362, 384].map((y, i) => `<rect x="${140 + i * 30}" y="${y}" width="${300 - i * 50}" height="3" rx="1.5" fill="#f0c56a" opacity="${0.5 - i * 0.1}"/>`).join('')}
    </svg>`;
  }

  /* Polaroïds du journal (carrés). */
  function plage() {
    const c = id('ciel');
    return `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf96"/><stop offset="1" stop-color="#ff8f6b"/></linearGradient></defs>
      <rect width="400" height="400" fill="url(#${c})"/>
      <circle cx="200" cy="232" r="70" fill="#fff0c8"/>
      <rect x="0" y="230" width="400" height="80" fill="#2f8f88"/>
      ${[246, 262, 280].map((y, i) => `<rect x="${110 - i * 20}" y="${y}" width="${180 + i * 40}" height="4" rx="2" fill="#ffe1a8" opacity="${0.7 - i * 0.18}"/>`).join('')}
      <path d="M0,300 Q200,280 400,305 L400,400 L0,400 Z" fill="#f3d6a3"/>
      ${palmier(330, 330, 200, '#3b2a22', -1)}
    </svg>`;
  }
  function rizieres() { return bali(400, 400, false).replace('viewBox="0 0 600 400"', 'viewBox="100 0 400 400"'); }
  function temple() {
    const c = id('ciel');
    return `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f9c784"/><stop offset="1" stop-color="#f08a5d"/></linearGradient></defs>
      <rect width="400" height="400" fill="url(#${c})"/>
      <circle cx="200" cy="170" r="48" fill="#fff1d6" opacity="0.95"/>
      ${portail(200, 330, 250, '#3b2a22')}
      <rect x="0" y="336" width="400" height="64" fill="#5a3d2e"/>
      ${[0, 1, 2].map((i) => `<rect x="${120 - i * 26}" y="${344 + i * 18}" width="${160 + i * 52}" height="10" fill="#7a5340"/>`).join('')}
    </svg>`;
  }
  function scooter() {
    const c = id('ciel');
    return `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd3e6"/><stop offset="1" stop-color="#e8f4ef"/></linearGradient></defs>
      <rect width="400" height="400" fill="url(#${c})"/>
      <path d="M0,230 Q120,190 220,215 T400,205 L400,400 L0,400 Z" fill="#7fb35a"/>
      <path d="M170,215 L230,215 L330,400 L70,400 Z" fill="#6b6355"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="${197 - i * 2}" y="${228 + i * 44}" width="${6 + i * 4}" height="${18 + i * 8}" fill="#f4efe4"/>`).join('')}
      ${palmier(60, 300, 190, '#2f4a2a')}${palmier(350, 290, 170, '#2f4a2a', -1)}
      <g transform="translate(160,268)">
        <circle cx="20" cy="92" r="20" fill="#2a2520"/><circle cx="100" cy="92" r="20" fill="#2a2520"/>
        <path d="M0,80 Q10,40 50,48 L90,48 Q118,50 122,82 Z" fill="#e2574c"/>
        <path d="M86,48 L96,10 L112,8" stroke="#2a2520" stroke-width="6" fill="none" stroke-linecap="round"/>
        <circle cx="56" cy="14" r="14" fill="#3b2a22"/><path d="M42,30 Q56,22 70,30 L74,52 L40,52 Z" fill="#1a5fb4"/>
      </g>
    </svg>`;
  }
  function cascade() {
    return `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="400" fill="#cfe9e1"/>
      <path d="M0,0 L150,0 L140,260 L0,300 Z" fill="#3f7533"/><path d="M400,0 L250,0 L262,260 L400,300 Z" fill="#335f2b"/>
      <path d="M150,0 L250,0 L262,270 L140,270 Z" fill="#e9f6f7"/>
      ${[160, 182, 204, 226].map((x, i) => `<rect x="${x}" y="0" width="${6 + (i % 2) * 4}" height="270" fill="#9fd0d8" opacity="0.6"/>`).join('')}
      <ellipse cx="200" cy="300" rx="190" ry="60" fill="#7ec6c2"/>
      ${[[160, 270, 30], [215, 262, 38], [250, 278, 26], [190, 285, 22]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="0.65"/>`).join('')}
      <path d="M0,320 Q100,300 200,330 T400,320 L400,400 L0,400 Z" fill="#4f8a3c"/>
    </svg>`;
  }
  function amis() {
    const c = id('ciel');
    const tete = (x, y, s) => `<circle cx="${x}" cy="${y}" r="${18 * s}" fill="#2a1f1a"/><path d="M${x - 34 * s},${y + 70 * s} Q${x - 30 * s},${y + 16 * s} ${x},${y + 18 * s} Q${x + 30 * s},${y + 16 * s} ${x + 34 * s},${y + 70 * s} Z" fill="#2a1f1a"/>`;
    return `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="${c}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb980"/><stop offset="1" stop-color="#ee6c6c"/></linearGradient></defs>
      <rect width="400" height="400" fill="url(#${c})"/>
      <circle cx="200" cy="250" r="80" fill="#ffe0a6"/>
      <rect x="0" y="250" width="400" height="60" fill="#c45a6a"/>
      <path d="M0,300 L400,300 L400,400 L0,400 Z" fill="#3a2a2a"/>
      ${tete(110, 262, 1)}${tete(170, 252, 1.1)}${tete(232, 258, 1.05)}${tete(292, 266, 0.95)}
    </svg>`;
  }

  /* Carte de Bali, projetée à la main depuis les coordonnées des côtes. */
  const COTE = [
    [114.43, -8.17], [114.55, -8.13], [114.75, -8.15], [114.95, -8.18], [115.05, -8.12], [115.2, -8.08], [115.35, -8.11],
    [115.5, -8.18], [115.62, -8.29], [115.71, -8.38], [115.62, -8.45], [115.51, -8.53], [115.4, -8.58], [115.3, -8.66],
    [115.26, -8.72], [115.23, -8.79], [115.2, -8.85], [115.1, -8.85], [115.08, -8.82], [115.12, -8.78], [115.16, -8.77],
    [115.17, -8.72], [115.13, -8.65], [115.09, -8.62], [114.95, -8.55], [114.8, -8.47], [114.62, -8.39], [114.5, -8.3],
  ];
  const PENIDA = [[115.45, -8.68], [115.53, -8.66], [115.6, -8.68], [115.62, -8.73], [115.55, -8.8], [115.47, -8.78], [115.43, -8.73]];
  const LIEUX = {
    ubud: [115.262, -8.507, 'Ubud'], tegallalang: [115.279, -8.434, 'Tegallalang'], seminyak: [115.16, -8.69, 'Seminyak'],
    canggu: [115.13, -8.648, 'Canggu'], uluwatu: [115.087, -8.829, 'Uluwatu'], amed: [115.65, -8.345, 'Amed'],
    sidemen: [115.44, -8.48, 'Sidemen'], tegenungan: [115.289, -8.575, 'Tegenungan'], tibumana: [115.37, -8.49, 'Tibumana'],
    sekumpul: [115.18, -8.17, 'Sekumpul'], jimbaran: [115.165, -8.775, 'Jimbaran'], penida: [115.53, -8.73, 'Nusa Penida'],
    agung: [115.508, -8.343, 'Agung'], batur: [115.375, -8.242, 'Batur'],
  };
  const projeter = ([lon, lat]) => [(lon - 114.36) * 720, (-lat - 8.02) * 720 + 18];

  function lisse(points) {
    const p = points.map(projeter);
    let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length; i++) {
      const p0 = p[(i - 1 + p.length) % p.length], p1 = p[i], p2 = p[(i + 1) % p.length], p3 = p[(i + 2) % p.length];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d + 'Z';
  }

  function carteBali() {
    const mer = id('mer'), relief = id('relief');
    const [ax, ay] = projeter(LIEUX.agung), [bx, by] = projeter(LIEUX.batur);
    return `<svg viewBox="0 0 1000 640" width="1000" height="640">
      <defs>
        <pattern id="${mer}" width="36" height="18" patternUnits="userSpaceOnUse">
          <path d="M0,9 Q9,3 18,9 T36,9" stroke="#a9d1d6" stroke-width="1.6" fill="none"/>
        </pattern>
        <radialGradient id="${relief}" cx="0.62" cy="0.38" r="0.6"><stop offset="0" stop-color="#d9e4bf"/><stop offset="1" stop-color="#f2ead9"/></radialGradient>
      </defs>
      <rect width="1000" height="640" rx="28" fill="#d6ebee"/>
      <rect width="1000" height="640" rx="28" fill="url(#${mer})" opacity="0.7"/>
      <path d="${lisse(COTE)}" fill="#e8dcc2" transform="translate(6,10)" opacity="0.6"/>
      <path class="terre" d="${lisse(COTE)}" fill="url(#${relief})" stroke="#bfae8c" stroke-width="2.5"/>
      <path d="${lisse(PENIDA)}" fill="#efe6d2" stroke="#bfae8c" stroke-width="2"/>
      <path d="M${ax - 60},${ay + 46} L${ax},${ay - 34} L${ax + 64},${ay + 46} Z" fill="#c9b48a" opacity="0.75"/>
      <path d="M${ax - 14},${ay - 16} L${ax},${ay - 34} L${ax + 14},${ay - 16} Q${ax},${ay - 10} ${ax - 14},${ay - 16} Z" fill="#fffaf0"/>
      <path d="M${bx - 44},${by + 34} L${bx},${by - 24} L${bx + 46},${by + 34} Z" fill="#c9b48a" opacity="0.6"/>
      <text x="${ax}" y="${ay + 72}" text-anchor="middle" font-family="Inter Tight" font-weight="650" font-size="15" letter-spacing="2" fill="#8a7c66">MONT AGUNG</text>
      <text x="830" y="600" text-anchor="end" font-family="Fraunces" font-weight="600" font-size="44" fill="#7d6f58" opacity="0.5">Bali</text>
      <g class="routes"></g><g class="epingles"></g>
    </svg>`;
  }

  function qr(taille = 25, graineQr = 3) {
    const r = graine(graineQr);
    let carres = '';
    const repere = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#1a1713"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fffdf8"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#1a1713"/>`;
    for (let y = 0; y < taille; y++) for (let x = 0; x < taille; x++) {
      const dansRepere = (x < 8 && y < 8) || (x > taille - 9 && y < 8) || (x < 8 && y > taille - 9);
      if (!dansRepere && r() > 0.52) carres += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="#1a1713"/>`;
    }
    return `<svg viewBox="-1 -1 ${taille + 2} ${taille + 2}" shape-rendering="crispEdges">${carres}${repere(0, 0)}${repere(taille - 7, 0)}${repere(0, taille - 7)}</svg>`;
  }

  /** Tampon encreur, bords rongés par un filtre (comme un vrai coup de tampon). */
  function tampon({ haut, bas, centre, couleur, rond = true, rotation = 0 }) {
    const f = id('encre'), c = id('arc');
    const filtre = `<filter id="${f}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${n}"/><feDisplacementMap in="SourceGraphic" scale="5"/><feComponentTransfer><feFuncA type="discrete" tableValues="0 1 1 1 0.85 1"/></feComponentTransfer></filter>`;
    if (!rond) {
      return `<svg viewBox="0 0 360 150" style="transform:rotate(${rotation}deg)"><defs>${filtre}</defs><g filter="url(#${f})" fill="none" stroke="${couleur}">
        <rect x="8" y="8" width="344" height="134" rx="14" stroke-width="7"/><rect x="22" y="22" width="316" height="106" rx="8" stroke-width="2.5"/>
        <text x="180" y="98" text-anchor="middle" fill="${couleur}" stroke="none" font-family="Inter Tight" font-weight="800" font-size="62" letter-spacing="8">${centre}</text></g></svg>`;
    }
    return `<svg viewBox="0 0 240 240" style="transform:rotate(${rotation}deg)"><defs>${filtre}
      <path id="${c}" d="M40,120 A80,80 0 0 1 200,120"/><path id="${c}b" d="M36,120 A84,84 0 0 0 204,120"/></defs>
      <g filter="url(#${f})" fill="none" stroke="${couleur}">
        <circle cx="120" cy="120" r="112" stroke-width="6"/><circle cx="120" cy="120" r="98" stroke-width="2.5"/><circle cx="120" cy="120" r="56" stroke-width="2.5"/>
        <text fill="${couleur}" stroke="none" font-family="Inter Tight" font-weight="800" font-size="22" letter-spacing="5"><textPath href="#${c}" startOffset="50%" text-anchor="middle">${haut}</textPath></text>
        <text fill="${couleur}" stroke="none" font-family="Inter Tight" font-weight="700" font-size="18" letter-spacing="4"><textPath href="#${c}b" startOffset="50%" text-anchor="middle" dominant-baseline="hanging">${bas}</textPath></text>
        <text x="120" y="133" text-anchor="middle" fill="${couleur}" stroke="none" font-family="Fraunces" font-weight="700" font-size="38">${centre}</text>
      </g></svg>`;
  }

  window.ILLU = { bali, lisbonne, budapest, plage, rizieres, temple, scooter, cascade, amis, carteBali, qr, tampon, projeter, LIEUX, graine };
})();
