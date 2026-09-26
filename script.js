// ==========================================================
// AKSHAY KRISHNA SIRIGANA — cinematic scenes
// A point field (plain canvas, no libraries) morphs from scene to
// scene as you scroll; each scene's words arrive line by line.
// Also: case-file drawers, PULSE stats + live correspondence chess.
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
  const html = document.documentElement;
  const RM = html.classList.contains('rm');
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // ==========================================================
  // SCENES + PALETTES
  // ==========================================================
  const scenes = Array.from(document.querySelectorAll('.scene'));
  const N_SC = scenes.length;
  const CFG = [
    { shape: 'cloud', ox: 0.2, scale: 1.05, tilt: 0.25, alpha: 1 },
    { shape: 'wave', ox: 0.23, scale: 1.1, tilt: 0.35, alpha: 1 },
    { shape: 'globe', ox: 0.26, scale: 0.86, tilt: 0.3, alpha: 1 },
    { shape: 'match', ox: 0.23, scale: 1.0, tilt: 0.2, alpha: 1 },
    { shape: 'seven', ox: 0.23, scale: 0.85, tilt: 0.3, alpha: 0.9 },
    { shape: 'knight', ox: -0.05, scale: 0.66, tilt: 0.04, alpha: 0.85, still: true },
    { shape: 'ring', ox: 0.24, scale: 1.05, tilt: 1.05, alpha: 1 },
  ];
  const PAL = {
    paper: [
      { bg: '#ECE8DF', fg: '#171614', dot: '#171614' },
      { bg: '#15463A', fg: '#EEF3EE', dot: '#CFE7D8' },
      { bg: '#A9431D', fg: '#FFF3EB', dot: '#FFD8C2' },
      { bg: '#1E2C54', fg: '#EDF1FA', dot: '#B9C8EE' },
      { bg: '#E3B64A', fg: '#1B1709', dot: '#2A230E' },
      { bg: '#2B2621', fg: '#F1E9DC', dot: '#D9C9AE' },
      { bg: '#ECE8DF', fg: '#171614', dot: '#171614' },
    ],
    ink: [
      { bg: '#111110', fg: '#EDE9E0', dot: '#EDE9E0' },
      { bg: '#0D2620', fg: '#E3EEE6', dot: '#9CCBAE' },
      { bg: '#34170B', fg: '#FBE9DD', dot: '#F2A57E' },
      { bg: '#10182F', fg: '#E3E9F6', dot: '#8FA6E0' },
      { bg: '#2A220E', fg: '#F2E6C4', dot: '#E0C067' },
      { bg: '#191613', fg: '#EFE6D6', dot: '#C9B795' },
      { bg: '#111110', fg: '#EDE9E0', dot: '#EDE9E0' },
    ],
  };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  let palette = [];
  function loadPalette() {
    const p = PAL[html.getAttribute('data-theme') === 'ink' ? 'ink' : 'paper'];
    palette = p.map((c) => ({ bg: hex(c.bg), fg: hex(c.fg), dot: hex(c.dot) }));
    scenes.forEach((s, i) => { s.style.setProperty('--scene-bg', p[i].bg); s.style.setProperty('--scene-fg', p[i].fg); });
  }
  loadPalette();
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  let lastBg = '';
  // backgrounds blend slowly; text flips quickly at the midpoint so it never
  // passes through the same mid-tone as the background
  function applyColours(a, b, m) {
    const bg = toHex(mix(palette[a].bg, palette[b].bg, m));
    if (bg === lastBg) return;
    lastBg = bg;
    const fg = toHex(mix(palette[a].fg, palette[b].fg, smooth(0.44, 0.56, m)));
    html.style.setProperty('--bg', bg);
    html.style.setProperty('--fg', fg);
    themeMeta.setAttribute('content', bg);
  }

  // ---------- scroll geometry ----------
  let centers = [], vh = window.innerHeight;
  function measure() {
    vh = window.innerHeight;
    centers = scenes.map((s) => s.offsetTop + s.offsetHeight / 2);
    fitKnight();
  }
  // the knight stands in whatever gap the layout leaves between the words and the board
  function fitKnight() {
    const cfg = CFG[5], wrap = document.querySelector('.board-wrap');
    if (!wrap) return;
    const range = document.createRange();
    let right = 0;
    scenes[5].querySelectorAll('.chess-copy > *').forEach((el) => { range.selectNodeContents(el); right = Math.max(right, range.getBoundingClientRect().right); });
    const left = wrap.getBoundingClientRect().left, gap = left - right;
    const w = window.innerWidth, unitPx = Math.min(w, window.innerHeight) * 0.34;
    if (gap > 170) {
      cfg.ox = ((left + right) / 2 - w / 2) / w;
      cfg.scale = Math.min(0.66, (gap * 0.62) / (1.5 * unitPx));
      cfg.alpha = 0.85;
    } else {
      cfg.ox = -0.05; cfg.scale = 0.66; cfg.alpha = 0.22;
    }
  }
  function sceneFloat() {
    const y = window.scrollY + vh / 2;
    if (y <= centers[0]) return 0;
    for (let i = 0; i < N_SC - 1; i++) {
      if (y < centers[i + 1]) return i + (y - centers[i]) / (centers[i + 1] - centers[i]);
    }
    return N_SC - 1;
  }
  function scrollToScene(i, instant) {
    const top = Math.max(0, centers[i] - vh / 2);
    window.scrollTo({ top, behavior: instant || RM ? 'auto' : 'smooth' });
  }
  measure();
  if (document.fonts) document.fonts.ready.then(measure);
  window.addEventListener('resize', () => { measure(); sizeCanvas(); });

  // ---------- line-by-line reveal ----------
  const revealSets = scenes.map((s) => {
    const els = Array.from(s.querySelectorAll('.rv'));
    const kmax = Math.max(1, ...els.map((el) => +el.dataset.k || 0));
    // the whole scene is composed by the time it reaches centre, however many lines it has
    return els.map((el) => ({ el, d: Math.min(0.07 * (+el.dataset.k || 0), 0.34 * (+el.dataset.k || 0) / kmax), last: -1 }));
  });
  function reveal(sf) {
    revealSets.forEach((set, i) => {
      const local = sf - i;
      if (local < -1.2 || local > 1.2) {
        set.forEach((r) => { if (r.last !== 0) { r.el.style.opacity = '0'; r.el.style.pointerEvents = 'none'; r.last = 0; } });
        return;
      }
      set.forEach((r) => {
        const inT = easeOut(clamp((local - (-0.56 + r.d)) / 0.2));
        const outT = easeIO(clamp((local - 0.3 - r.d * 0.15) / 0.2));
        const op = inT * (1 - outT);
        const key = Math.round(op * 200);
        if (key === r.last) return;
        r.last = key;
        const ty = (1 - inT) * 34 - outT * 34;
        const blur = (1 - op) * 10;
        r.el.style.opacity = op.toFixed(3);
        r.el.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0)`;
        r.el.style.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
        r.el.style.pointerEvents = op > 0.5 ? '' : 'none';
      });
    });
  }
  // keyboard users: bring a scene into view when focus lands inside it
  scenes.forEach((s, i) => s.addEventListener('focusin', () => {
    if (Math.abs(sceneFloat() - i) > 0.2) scrollToScene(i, true);
  }));

  // ==========================================================
  // THE POINT FIELD
  // ==========================================================
  const cv = $('field');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  function sizeCanvas() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  const small = window.matchMedia('(max-width: 760px)').matches;
  const N = small ? 1300 : 2600;

  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const R = rng(20260926);
  const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const unit = () => { const z = R() * 2 - 1, a = R() * Math.PI * 2, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), z, r * Math.sin(a)]; };

  const SHAPES = {
    cloud() {
      const o = [];
      for (let i = 0; i < N; i++) {
        if (i % 5 === 0) { const u = unit(); const r = 1.15 + R() * 0.12; o.push(u[0] * r, u[1] * r * 0.85, u[2] * r); }
        else { o.push(gauss() * 0.42, gauss() * 0.34, gauss() * 0.42); }
      }
      return o;
    },
    wave() {
      const o = [], L = 14;
      for (let i = 0; i < N; i++) {
        const line = i % L, x = (R() * 2 - 1) * 1.55, env = Math.exp(-x * x * 0.85);
        const amp = 0.62 * env * (0.55 + 0.45 * Math.sin(line * 0.9 + 1));
        o.push(x, amp * Math.sin(x * 7 + line * 0.45), -0.5 + (line / (L - 1)));
      }
      return o;
    },
    globe() {
      const o = [], sN = Math.floor(N * 0.74), g = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < sN; i++) {
        const y = 1 - (i / (sN - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i;
        o.push(Math.cos(th) * r * 0.95, y * 0.95, Math.sin(th) * r * 0.95);
      }
      const arcs = 9, per = Math.ceil((N - sN) / arcs);
      for (let a = 0; a < arcs; a++) {
        const p = unit(), q = unit();
        for (let j = 0; j < per && o.length < N * 3; j++) {
          const t = j / (per - 1), h = 1 + 0.42 * Math.sin(Math.PI * t);
          let x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t, z = p[2] + (q[2] - p[2]) * t;
          const l = Math.hypot(x, y, z) || 1;
          o.push(x / l * 0.95 * h, y / l * 0.95 * h, z / l * 0.95 * h);
        }
      }
      while (o.length < N * 3) o.push(0, 0, 0);
      return o;
    },
    match() {
      const o = [], left = [], right = [];
      for (let i = 0; i < 12; i++) { left.push([-0.95 + gauss() * 0.12, gauss() * 0.3, gauss() * 0.2]); right.push([0.95 + gauss() * 0.12, gauss() * 0.3, gauss() * 0.2]); }
      const pairs = [[0, 3], [1, 7], [2, 0], [4, 9], [5, 5], [6, 11], [8, 2]];
      for (let i = 0; i < N; i++) {
        const k = i % 10;
        if (k < 3) { const c = left[i % 12]; o.push(c[0] + gauss() * 0.07, c[1] + gauss() * 0.07, c[2] + gauss() * 0.07); }
        else if (k < 6) { const c = right[i % 12]; o.push(c[0] + gauss() * 0.07, c[1] + gauss() * 0.07, c[2] + gauss() * 0.07); }
        else {
          const pr = pairs[i % pairs.length], a = left[pr[0]], b = right[pr[1]], t = R();
          o.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * 0.32, a[2] + (b[2] - a[2]) * t);
        }
      }
      return o;
    },
    seven() {
      const o = [];
      for (let i = 0; i < N; i++) {
        const k = i % 7, u = unit(), r = 0.2 * Math.cbrt(R());
        const ang = (k / 6) * Math.PI;
        o.push(-1.08 + k * 0.36 + u[0] * r, Math.sin(ang) * 0.35 - 0.1 + u[1] * r, Math.cos(ang) * 0.35 + u[2] * r);
      }
      return o;
    },
    knight() {
      const c = document.createElement('canvas'); c.width = c.height = 200;
      const x = c.getContext('2d');
      const p = new Path2D('M12 31h16v-5c0-9-3-16-11-19l-2 4-6 5 1 4 5-1-3 7Z');
      const base = new Path2D('M10 31h20v5H10Z');
      x.scale(5, 5);
      // mostly outline (reads as a knight in dots), a little fill
      const inside = (a, b) => x.isPointInPath(p, a * 5, b * 5) || x.isPointInPath(base, a * 5, b * 5);
      const o = [];
      let guard = 0;
      while (o.length < N * 3 && guard++ < N * 200) {
        const px = R() * 40, py = R() * 40;
        if (!inside(px, py)) continue;
        const d = 0.6;
        const edge = !(inside(px + d, py) && inside(px - d, py) && inside(px, py + d) && inside(px, py - d));
        if (!edge && R() > 0.18) continue;
        o.push((px - 20) / 15, -(py - 21.5) / 15, (R() - 0.5) * (edge ? 0.08 : 0.3));
      }
      while (o.length < N * 3) o.push(0, 0, 0);
      return o;
    },
    ring() {
      const o = [];
      for (let i = 0; i < N; i++) {
        const a = R() * Math.PI * 2, r = 1.05 + gauss() * 0.035;
        if (i % 9 === 0) o.push(gauss() * 0.07, gauss() * 0.07, gauss() * 0.07);
        else o.push(Math.cos(a) * r, gauss() * 0.02, Math.sin(a) * r);
      }
      return o;
    },
  };
  const shapeData = CFG.map((c) => Float32Array.from(SHAPES[c.shape]()));
  const burst = new Float32Array(N * 3);
  const delay = new Float32Array(N);
  for (let i = 0; i < N; i++) { const u = unit(); burst.set(u, i * 3); delay[i] = R(); }

  let sSmooth = RM ? 0 : -0.55;   // the opening lines arrive on load
  let pointerX = 0, pointerY = 0, px = 0, py = 0;
  window.addEventListener('pointermove', (e) => { pointerX = e.clientX / window.innerWidth - 0.5; pointerY = e.clientY / window.innerHeight - 0.5; }, { passive: true });

  const buckets = [[], [], []];
  function drawField(sf, time) {
    const idx = clamp(sf, 0, N_SC - 1);
    const a = Math.floor(idx), b = Math.min(a + 1, N_SC - 1);
    const m = smooth(0.18, 0.82, idx - a);
    applyColours(a, b, m);
    const A = shapeData[a], B = shapeData[b], ca = CFG[a], cb = CFG[b];
    const ox = small ? 0 : ca.ox + (cb.ox - ca.ox) * m;
    const scale = ca.scale + (cb.scale - ca.scale) * m;
    const tilt = ca.tilt + (cb.tilt - ca.tilt) * m + py * 0.25;
    const alphaF = (ca.alpha + (cb.alpha - ca.alpha) * m) * (small ? 0.3 : 1);
    const dot = mix(palette[a].dot, palette[b].dot, smooth(0.38, 0.62, m));
    const waveW = (ca.shape === 'wave' ? 1 - m : 0) + (cb.shape === 'wave' ? m : 0);
    // flat shapes (the knight) sway to face you; the rest keep turning
    const spin = time * 0.00013 + sf * 0.9 + px * 0.5;
    const sway = Math.sin(time * 0.0004) * 0.28 + px * 0.5;
    const rA = ca.still ? sway : spin, rB = cb.still ? sway : spin;
    const cA = Math.cos(rA), sA = Math.sin(rA), cB = Math.cos(rB), sB = Math.sin(rB);
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const U = Math.min(W, H) * 0.34 * scale;
    const cx0 = W / 2 + ox * W, cy0 = H / 2;
    const D = 3.3;
    ctx.clearRect(0, 0, W, H);
    buckets[0].length = buckets[1].length = buckets[2].length = 0;
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      const t = clamp((m - delay[i] * 0.35) / 0.65);
      const e = easeIO(t);
      const bu = Math.sin(Math.PI * t) * 0.6;
      const xa = A[j] * cA + A[j + 2] * sA, za = -A[j] * sA + A[j + 2] * cA;
      const xb = B[j] * cB + B[j + 2] * sB, zb = -B[j] * sB + B[j + 2] * cB;
      const X = xa + (xb - xa) * e + burst[j] * bu;
      let y = A[j + 1] + (B[j + 1] - A[j + 1]) * e + burst[j + 1] * bu;
      const Z = za + (zb - za) * e + burst[j + 2] * bu;
      if (waveW > 0) y += Math.sin(X * 5 + time * 0.0022 + Z * 4) * 0.07 * waveW;
      const Y = y * ct - Z * st, Z2 = y * st + Z * ct;
      const p = D / (D + Z2);
      const sx = cx0 + X * U * p, syy = cy0 - Y * U * p;
      if (sx < -10 || sx > W + 10 || syy < -10 || syy > H + 10) continue;
      buckets[p > 1.06 ? 0 : p > 0.94 ? 1 : 2].push(sx, syy, p);
    }
    const ALPHA = [0.95, 0.62, 0.32];
    for (let k = 0; k < 3; k++) {
      const bk = buckets[k];
      ctx.fillStyle = `rgba(${dot[0] | 0},${dot[1] | 0},${dot[2] | 0},${(ALPHA[k] * alphaF).toFixed(3)})`;
      for (let i = 0; i < bk.length; i += 3) {
        const s = 1.1 + 1.5 * bk[i + 2];
        ctx.fillRect(bk[i] - s / 2, bk[i + 1] - s / 2, s, s);
      }
    }
  }

  // ---------- the loop ----------
  let lastT = performance.now();
  let seenIdx = -1;
  function frame(now) {
    const dt = Math.min(64, now - lastT); lastT = now;
    const target = sceneFloat();
    sSmooth += (target - sSmooth) * Math.min(1, dt * 0.0055);
    if (Math.abs(target - sSmooth) < 0.0005) sSmooth = target;
    px += (pointerX - px) * 0.04; py += (pointerY - py) * 0.04;
    reveal(sSmooth);
    drawField(sSmooth, now);
    sectionBeacon(target, now);
    requestAnimationFrame(frame);
  }

  // ==========================================================
  // THEME (values ink / paper, as before)
  // ==========================================================
  const themeToggle = $('themeToggle');
  function syncTheme() { themeToggle.setAttribute('aria-pressed', String(html.getAttribute('data-theme') === 'ink')); }
  themeToggle.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'ink' ? 'paper' : 'ink';
    html.setAttribute('data-theme', next);
    try { localStorage.setItem('aks-theme', next); } catch (e) { /* private mode */ }
    loadPalette();
    lastBg = '';
    if (RM) staticColours();
    syncTheme();
  });
  syncTheme();
  function staticColours() {
    html.style.setProperty('--bg', toHex(palette[0].bg));
    html.style.setProperty('--fg', toHex(palette[0].fg));
  }

  // ==========================================================
  // PULSE — first-party stats beacon (respects DNT and GPC)
  // ==========================================================
  const PULSE = 'https://aks-pulse.vercel.app';
  const DNT = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  function getVid() {
    try {
      let v = localStorage.getItem('aks-vid');
      if (!v) {
        v = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('aks-vid', v);
      }
      return v;
    } catch (e) {
      return 'anon';
    }
  }
  const vid = getVid();
  function beacon(type, label) {
    if (DNT) return;
    try {
      // plain-string body: CORS-safelisted (no preflight), server parses JSON regardless
      const body = JSON.stringify({ vid, type, label: String(label || '').slice(0, 80) });
      if (!navigator.sendBeacon || !navigator.sendBeacon(`${PULSE}/api/beacon`, body)) {
        fetch(`${PULSE}/api/beacon`, { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch (e) { /* stats are best-effort */ }
  }
  beacon('pageview', location.hash || '/');
  // a scene counts as read once it has held the screen for a moment
  const seen = new Set();
  let dwellSince = 0;
  function sectionBeacon(sf, now) {
    const i = Math.round(sf);
    const settled = Math.abs(sf - i) < 0.3;
    if (i !== seenIdx || !settled) { seenIdx = settled ? i : -1; dwellSince = now; return; }
    const id = scenes[i] && scenes[i].id;
    if (id && now - dwellSince > 900 && !seen.has(id)) { seen.add(id); beacon('section', id); }
  }
  themeToggle.addEventListener('click', () => beacon('theme', html.getAttribute('data-theme')));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href.startsWith('http')) beacon('outbound', a.hostname + a.pathname.slice(0, 40));
    else if (href.endsWith('.pdf')) beacon('resume', '');
  });

  // ==========================================================
  // DRAWERS — case files and the 30-second version
  // ==========================================================
  const facts = $('facts');
  function openDrawer(d) {
    if (!d || d.open) return;
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  document.querySelectorAll('[data-case]').forEach((b) => {
    b.addEventListener('click', () => {
      const d = $('p-' + b.dataset.case);
      openDrawer(d);
      history.replaceState(null, '', '#p-' + b.dataset.case);
      beacon('project', b.dataset.case);
    });
  });
  $('factsBtn').addEventListener('click', () => { openDrawer(facts); beacon('filter', 'facts:open'); });
  document.querySelectorAll('dialog.drawer').forEach((d) => {
    d.querySelectorAll('[data-close]').forEach((c) => c.addEventListener('click', () => d.close()));
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => { if (location.hash.startsWith('#p-')) history.replaceState(null, '', location.pathname + location.search); });
  });

  // in-page links scroll to the middle of a scene, where it is fully composed
  const sceneIndex = (id) => scenes.findIndex((s) => s.id === id);
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const i = sceneIndex(id);
      if (i < 0) return;
      e.preventDefault();
      scrollToScene(i);
    });
  });

  // ---------- copy email ----------
  const copyStatus = $('copyStatus');
  document.querySelectorAll('.copy-email').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.email);
        btn.textContent = 'Copied';
        copyStatus.textContent = 'Email copied to clipboard';
        setTimeout(() => { btn.textContent = 'Copy'; copyStatus.textContent = ''; }, 1600);
      } catch (e) {
        location.href = 'mailto:' + btn.dataset.email;
      }
      beacon('copy_email', '');
    });
  });

  // ---------- old links keep working ----------
  function route() {
    let h;
    try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) { h = ''; }
    if (!h) return;
    const lead = ['peppa', 'argus', 'mentormatch'];
    const go = (i) => setTimeout(() => { measure(); scrollToScene(i, true); if (!RM) sSmooth = sceneFloat(); }, 0);
    if (h.startsWith('p-')) {
      const slug = h.slice(2);
      const d = $(h);
      if (d) { go(sceneIndex(lead.includes(slug) ? slug : 'more')); setTimeout(() => openDrawer(d), 350); }
    } else if (h === 'brief') { setTimeout(() => openDrawer(facts), 200); }
    else if (h.startsWith('work')) go(sceneIndex('peppa'));
    else if (h === 'chess' || h === 'offhours') go(sceneIndex('offhours'));
    else if (sceneIndex(h) >= 0) go(sceneIndex(h));
  }
  route();
  window.addEventListener('hashchange', route);

  // ---------- start ----------
  if (RM) {
    staticColours();
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting && !seen.has(e.target.id)) { seen.add(e.target.id); beacon('section', e.target.id); }
    }), { threshold: 0.35 });
    scenes.forEach((sc) => io.observe(sc));
  } else {
    sizeCanvas();
    requestAnimationFrame((t) => { lastT = t; frame(t); });
  }

  // ==========================================================
  // CHESS — live correspondence board (visitor plays White)
  // Backend contract unchanged: GET /api/game, POST /api/move, POST /api/reset
  // ==========================================================
  const board = $('chessboard');
  const piecesEl = $('cbPieces');
  const statusEl = $('chessStatus');
  const resetBtn = $('chessReset');

  if (board) {
    const FILES = 'abcdefgh';
    const SVGNS = 'http://www.w3.org/2000/svg';
    const BACK = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    const NAME = { P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' };
    const sq = (f, r) => `${f},${r}`;
    const coord = (f, r) => FILES[f] + (8 - r);

    function startBoard() {
      const b = {};
      BACK.forEach((t, f) => { b[sq(f, 0)] = { t, c: 'b' }; b[sq(f, 7)] = { t, c: 'w' }; });
      for (let f = 0; f < 8; f++) { b[sq(f, 1)] = { t: 'P', c: 'b' }; b[sq(f, 6)] = { t: 'P', c: 'w' }; }
      return b;
    }
    function pathClear(b, f1, r1, f2, r2) {
      const df = Math.sign(f2 - f1), dr = Math.sign(r2 - r1);
      let f = f1 + df, r = r1 + dr;
      while (f !== f2 || r !== r2) {
        if (b[sq(f, r)]) return false;
        f += df; r += dr;
      }
      return true;
    }
    // House rules: no castling, no en passant, kings may be captured.
    function isLegal(b, from, to, color) {
      const [f1, r1] = from, [f2, r2] = to;
      if (f2 < 0 || f2 > 7 || r2 < 0 || r2 > 7) return false;
      const p = b[sq(f1, r1)];
      if (!p || p.c !== color) return false;
      const target = b[sq(f2, r2)];
      if (target && target.c === color) return false;
      const df = f2 - f1, dr = r2 - r1, adf = Math.abs(df), adr = Math.abs(dr);
      switch (p.t) {
        case 'P': {
          const dir = p.c === 'w' ? -1 : 1;
          const home = p.c === 'w' ? 6 : 1;
          if (df === 0 && dr === dir && !target) return true;
          if (df === 0 && dr === 2 * dir && r1 === home && !target && !b[sq(f1, r1 + dir)]) return true;
          if (adf === 1 && dr === dir && target) return true;
          return false;
        }
        case 'N': return (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
        case 'B': return adf === adr && adf > 0 && pathClear(b, f1, r1, f2, r2);
        case 'R': return (df === 0 || dr === 0) && (adf + adr > 0) && pathClear(b, f1, r1, f2, r2);
        case 'Q': return ((adf === adr && adf > 0) || df === 0 || dr === 0) && pathClear(b, f1, r1, f2, r2);
        case 'K': return adf <= 1 && adr <= 1 && (adf + adr > 0);
        default: return false;
      }
    }
    // Replay a move list from the start position -> {b, turn, status}
    function replay(moves) {
      const b = startBoard();
      let status = 'active';
      moves.forEach((m) => {
        const p = b[sq(m.f[0], m.f[1])];
        if (!p) return;
        const target = b[sq(m.t[0], m.t[1])];
        if (target && target.t === 'K') status = target.c === 'b' ? 'won_v' : 'won_o';
        delete b[sq(m.f[0], m.f[1])];
        const promo = p.t === 'P' && (m.t[1] === 0 || m.t[1] === 7);
        b[sq(m.t[0], m.t[1])] = { t: promo ? 'Q' : p.t, c: p.c };
      });
      return { b, turn: moves.length % 2 === 0 ? 'w' : 'b', status };
    }

    // --- DOM: 8 rows x 8 gridcells, each holding a square button ---
    const squares = [];
    for (let r = 0; r < 8; r++) {
      const row = document.createElement('div');
      row.className = 'cb-row';
      row.setAttribute('role', 'row');
      for (let f = 0; f < 8; f++) {
        const cell = document.createElement('div');
        cell.className = 'cb-cell';
        cell.setAttribute('role', 'gridcell');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cb-sq' + ((r + f) % 2 ? ' dark' : '');
        btn.dataset.f = f;
        btn.dataset.r = r;
        btn.tabIndex = -1;
        btn.setAttribute('aria-label', coord(f, r) + ', empty');
        cell.appendChild(btn);
        row.appendChild(cell);
        squares.push(btn);
      }
      board.appendChild(row);
    }
    const squareAt = (f, r) => squares[r * 8 + f];
    let focusIdx = 6 * 8 + 4; // e2
    squares[focusIdx].tabIndex = 0;
    function setFocusSquare(idx, move) {
      squares[focusIdx].tabIndex = -1;
      focusIdx = idx;
      squares[focusIdx].tabIndex = 0;
      if (move) squares[focusIdx].focus();
    }

    const pieceLayer = {};
    let current = startBoard();
    let lastMove = null;
    let selected = null;

    function makePiece(p) {
      const svg = document.createElementNS(SVGNS, 'svg');
      svg.setAttribute('class', 'cb-piece ' + p.c);
      svg.setAttribute('viewBox', '0 0 40 40');
      const use = document.createElementNS(SVGNS, 'use');
      use.setAttribute('href', '#pc-' + p.t);
      svg.appendChild(use);
      piecesEl.appendChild(svg);
      return svg;
    }
    function labelSquares() {
      squares.forEach((cell) => {
        const f = +cell.dataset.f, r = +cell.dataset.r;
        const p = current[sq(f, r)];
        let label = `${coord(f, r)}, ${p ? (p.c === 'w' ? 'white ' : 'black ') + NAME[p.t] : 'empty'}`;
        if (cell.classList.contains('cb-selected')) label += ', selected';
        if (cell.classList.contains('cb-target')) label += ', legal move';
        if (cell.classList.contains('cb-cap')) label += ', capture';
        cell.setAttribute('aria-label', label);
      });
    }
    function markLast() {
      squares.forEach((c) => c.classList.remove('cb-last'));
      if (!lastMove) return;
      squareAt(lastMove.f[0], lastMove.f[1]).classList.add('cb-last');
      squareAt(lastMove.t[0], lastMove.t[1]).classList.add('cb-last');
    }
    function render(b) {
      current = b;
      Object.keys(pieceLayer).forEach((k) => { if (!b[k]) { pieceLayer[k].remove(); delete pieceLayer[k]; } });
      Object.entries(b).forEach(([k, p]) => {
        const [f, r] = k.split(',').map(Number);
        let el = pieceLayer[k];
        if (!el) { el = makePiece(p); pieceLayer[k] = el; }
        el.setAttribute('class', 'cb-piece ' + p.c);
        el.firstChild.setAttribute('href', '#pc-' + p.t);
        el.style.setProperty('--f', f);
        el.style.setProperty('--r', r);
      });
      markLast();
      labelSquares();
    }
    // Move a piece with animation (used for smooth transitions)
    function animateMove(m, isReply) {
      const from = sq(m.f[0], m.f[1]), to = sq(m.t[0], m.t[1]);
      const el = pieceLayer[from];
      if (!el) return;
      if (pieceLayer[to]) {
        const captured = pieceLayer[to];
        if (RM) captured.remove();
        else { captured.classList.add('gone'); setTimeout(() => captured.remove(), 130); }
      }
      delete pieceLayer[from];
      pieceLayer[to] = el;
      el.classList.toggle('cb-reply', !!isReply);
      el.style.setProperty('--f', m.t[0]);
      el.style.setProperty('--r', m.t[1]);
    }

    // --- Exhibition fallback: the Italian Game, three moves in ---
    let live = false;
    function exhibition() {
      live = false;
      board.classList.remove('live');
      render(startBoard());
      const MOVES = [
        { f: [4, 6], t: [4, 4] }, { f: [4, 1], t: [4, 3] },
        { f: [6, 7], t: [5, 5] }, { f: [1, 0], t: [2, 2] },
        { f: [5, 7], t: [2, 4] }, { f: [5, 0], t: [2, 3] },
      ];
      statusEl.textContent = "The live board is resting — here's the Italian Game, three moves in.";
      resetBtn.hidden = true;
      if (RM) {
        lastMove = MOVES[MOVES.length - 1];
        render(replay(MOVES).b);
      } else {
        const io = new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io.disconnect();
            MOVES.forEach((m, i) => setTimeout(() => {
              animateMove(m);
              lastMove = m;
              current = replay(MOVES.slice(0, i + 1)).b;
              markLast();
              labelSquares();
            }, 900 + i * 850));
          }
        }, { threshold: 0.4 });
        io.observe(board);
      }
    }

    // --- Live game ---
    let game = null;
    let waitingNoted = false;
    function myTurn() { return game && game.status === 'active' && game.moves.length % 2 === 0; }
    function updateUI() {
      const { b, status } = replay(game.moves);
      lastMove = game.moves.length ? game.moves[game.moves.length - 1] : null;
      render(b);
      resetBtn.hidden = game.moves.length === 0 && status === 'active';
      if (status === 'won_v') statusEl.textContent = 'You took my king. Well played — rematch?';
      else if (status === 'won_o') statusEl.textContent = 'Got your king. Good game — rematch?';
      else if (myTurn()) {
        if (game.moves.length) {
          const m = game.moves[game.moves.length - 1];
          statusEl.textContent = `I played ${coord(...m.f)} to ${coord(...m.t)}. Your move.`;
        } else statusEl.textContent = 'Pick a white piece to begin.';
        waitingNoted = false;
      } else statusEl.textContent = 'Sent. The move is on my desk — check back soon.';
      if (status !== 'active') resetBtn.hidden = false;
    }
    async function api(path, payload) {
      const res = await fetch(`${PULSE}${path}`, payload ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      } : undefined);
      if (!res.ok) throw new Error(`pulse ${res.status}`);
      return res.json();
    }
    // While waiting on the owner's reply, quietly poll so an open tab
    // sees the response without a refresh.
    let pollTimer;
    let lastCheck = 0;
    async function checkForReply() {
      if (!game) return;
      if (myTurn() || replay(game.moves).status !== 'active') { clearInterval(pollTimer); return; }
      lastCheck = Date.now();
      try {
        const resp = await api(`/api/game?vid=${encodeURIComponent(vid)}`, null);
        if (resp.game && resp.game.moves.length > game.moves.length) {
          const reply = resp.game.moves[game.moves.length];
          game = resp.game;
          animateMove(reply, true);
          setTimeout(updateUI, 500);
        }
      } catch (e) { /* next tick */ }
    }
    function schedulePoll() {
      clearInterval(pollTimer);
      pollTimer = setInterval(() => { if (!document.hidden && game) checkForReply(); }, 45000);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || !game || !live) return;
      if (replay(game.moves).status !== 'active' || myTurn()) return;
      if (Date.now() - lastCheck > 20000) checkForReply();
    });
    function clearSelection() {
      selected = null;
      squares.forEach((c) => c.classList.remove('cb-selected', 'cb-target', 'cb-cap'));
      labelSquares();
    }
    async function onSquare(cell) {
      if (!game || !live) return;
      if (!myTurn()) {
        if (!waitingNoted && replay(game.moves).status === 'active') {
          statusEl.textContent = 'Waiting for my reply — the board unlocks when I move.';
          waitingNoted = true;
        }
        return;
      }
      const f = +cell.dataset.f, r = +cell.dataset.r;
      const { b } = replay(game.moves);
      const here = b[sq(f, r)];
      if (selected === null) {
        if (here && here.c === 'w') {
          selected = [f, r];
          cell.classList.add('cb-selected');
          squares.forEach((c) => {
            const tf = +c.dataset.f, tr = +c.dataset.r;
            if (isLegal(b, selected, [tf, tr], 'w')) c.classList.add(b[sq(tf, tr)] ? 'cb-cap' : 'cb-target');
          });
          labelSquares();
        }
        return;
      }
      if (selected[0] === f && selected[1] === r) { clearSelection(); return; }
      if (here && here.c === 'w') { clearSelection(); onSquare(cell); return; }
      if (!isLegal(b, selected, [f, r], 'w')) return;
      const move = { f: selected, t: [f, r] };
      clearSelection();
      game.moves.push(move);
      animateMove(move);
      updateUI();
      beacon('chess_move', coord(...move.f) + coord(...move.t));
      try {
        game = (await api('/api/move', { vid, f: move.f, t: move.t })).game;
        updateUI();
        schedulePoll();
      } catch (e) {
        game.moves.pop();
        updateUI();
        statusEl.textContent = "Couldn't reach the board — try again in a minute.";
      }
    }
    squares.forEach((cell, idx) => {
      cell.addEventListener('click', () => { setFocusSquare(idx, false); onSquare(cell); });
      cell.addEventListener('keydown', (e) => {
        const f = idx % 8, r = Math.floor(idx / 8);
        let nf = f, nr = r;
        switch (e.key) {
          case 'ArrowLeft': nf = Math.max(0, f - 1); break;
          case 'ArrowRight': nf = Math.min(7, f + 1); break;
          case 'ArrowUp': nr = Math.max(0, r - 1); break;
          case 'ArrowDown': nr = Math.min(7, r + 1); break;
          case 'Home': nf = 0; break;
          case 'End': nf = 7; break;
          case 'Escape': if (selected) { e.preventDefault(); clearSelection(); } return;
          default: return;
        }
        e.preventDefault();
        setFocusSquare(nr * 8 + nf, true);
      });
    });
    resetBtn.addEventListener('click', async () => {
      try {
        game = (await api('/api/reset', { vid })).game;
        clearSelection();
        updateUI();
        beacon('chess_reset', '');
      } catch (e) { /* keep current state */ }
    });

    render(startBoard());
    (async () => {
      try {
        const resp = await api(`/api/game?vid=${encodeURIComponent(vid)}`, null);
        game = resp.game || { moves: [], status: 'active' };
        live = true;
        board.classList.add('live');
        lastCheck = Date.now();
        updateUI();
        if (!myTurn()) schedulePoll();
      } catch (e) {
        exhibition();
      }
    })();
  }
});
