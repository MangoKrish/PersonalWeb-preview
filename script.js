// ==========================================================
// AKSHAY KRISHNA SIRIGANA — personal site
// Theme · copy · lens & filters (FLIP) · case files ·
// boundary drawings · PULSE stats + live correspondence chess
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
  const html = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  const pad2 = (n) => String(n).padStart(2, '0');

  // ---------- helpers ----------
  function scrollToEl(el, focusEl) {
    if (!el) return;
    el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    if (focusEl) {
      if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
      focusEl.focus({ preventScroll: true });
    }
  }

  // ==========================================================
  // THEME (pre-paint theme set inline in <head>; values ink / paper)
  // ==========================================================
  const themeToggle = $('themeToggle');
  const followBtn = $('followSystem');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function storedTheme() { try { return localStorage.getItem('aks-theme'); } catch (e) { return null; } }
  function syncTheme() {
    const ink = html.getAttribute('data-theme') === 'ink';
    themeToggle.setAttribute('aria-pressed', String(ink));
    const st = storedTheme();
    followBtn.hidden = !(st === 'ink' || st === 'paper');
    updateLedgerTheme();
  }
  function setTheme(next, store) {
    html.classList.add('theming');
    html.setAttribute('data-theme', next);
    if (store) { try { localStorage.setItem('aks-theme', next); } catch (e) { /* private mode */ } }
    setTimeout(() => html.classList.remove('theming'), 300);
    syncTheme();
  }
  themeToggle.addEventListener('click', () => {
    setTheme(html.getAttribute('data-theme') === 'ink' ? 'paper' : 'ink', true);
  });
  followBtn.addEventListener('click', () => {
    try { localStorage.removeItem('aks-theme'); } catch (e) { /* ignore */ }
    setTheme(darkQuery.matches ? 'ink' : 'paper', false);
    themeToggle.focus();
  });
  const onSystemTheme = () => {
    const st = storedTheme();
    if (st !== 'ink' && st !== 'paper') setTheme(darkQuery.matches ? 'ink' : 'paper', false);
  };
  if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSystemTheme);

  // ==========================================================
  // COPY (email buttons + the forwardable #brief link)
  // ==========================================================
  const copyStatus = $('copyStatus');
  const copyTimers = new WeakMap();
  function flashCopied(btn, text) {
    const span = btn.querySelector('span');
    const use = btn.querySelector('use');
    if (!btn.dataset.orig) btn.dataset.orig = span.textContent;
    clearTimeout(copyTimers.get(btn));
    span.textContent = text;
    if (use) use.setAttribute('href', '#i-check');
    copyTimers.set(btn, setTimeout(() => {
      span.textContent = btn.dataset.orig;
      if (use) use.setAttribute('href', '#i-copy');
      copyStatus.textContent = '';
    }, 1600));
  }
  document.querySelectorAll('.copy-email').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.email);
        copyStatus.textContent = 'Email copied to clipboard';
        flashCopied(btn, 'Copied');
      } catch (e) {
        location.href = 'mailto:' + btn.dataset.email;
      }
    });
  });
  const copyBrief = $('copyBrief');
  copyBrief.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.origin + location.pathname + '#brief');
      copyStatus.textContent = 'Link copied';
      flashCopied(copyBrief, 'Link copied');
    } catch (e) { /* nothing sensible to fall back to */ }
  });

  // ==========================================================
  // BOUNDARY DRAWINGS — only crossing / return arrows draw in
  // ==========================================================
  function prep(fig) { if (fig && !reducedMotion) fig.classList.add('pre'); }
  function draw(fig) {
    if (!fig || fig.dataset.drawn) return;
    fig.dataset.drawn = '1';
    if (reducedMotion) { fig.classList.remove('pre'); return; }
    const n = fig.querySelectorAll('.dr').length;
    fig.classList.add('go');
    void fig.getBoundingClientRect();
    fig.classList.remove('pre');
    setTimeout(() => fig.classList.remove('go'), 600 + 120 * Math.max(0, n - 1) + 80);
  }
  const heroFig = $('fig-hero');
  const privFig = $('fig-privacy');
  prep(heroFig);
  prep(privFig);
  document.querySelectorAll('.case .flow').forEach(prep);
  const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => setTimeout(() => draw(heroFig), 400));

  // About: the second line of the display quote comes to full ink once
  const display = document.querySelector('.display');
  if (reducedMotion || !('IntersectionObserver' in window)) {
    display.classList.add('lit');
  } else {
    const dio = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { display.classList.add('lit'); dio.disconnect(); }
    }, { threshold: 0.5 });
    dio.observe(display);
  }

  // ==========================================================
  // PULSE — first-party stats beacon + live correspondence chess
  // Backend: zero-dependency Node service at PULSE. Everything
  // below fails silent: the site is fully functional with the
  // backend down (board falls back to exhibition mode).
  // ==========================================================
  const PULSE = 'https://aks-pulse.vercel.app';
  const DNT = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  html.classList.toggle('no-stats', DNT);

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

  // live ledger of what this visit has queued (the "Right now" row)
  const sentLog = [];
  const ledCount = $('ledCount');
  const ledRows = $('ledRows');
  const ledDetails = $('ledDetails');
  function updateLedger() {
    ledCount.textContent = String(sentLog.length);
    if (!ledDetails.open) return;
    ledRows.textContent = '';
    sentLog.forEach((s) => {
      const tr = document.createElement('tr');
      [s.type, s.label || '—', s.t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })].forEach((v) => {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });
      ledRows.appendChild(tr);
    });
  }
  ledDetails.addEventListener('toggle', updateLedger);

  function beacon(type, label) {
    if (DNT) return;
    sentLog.push({ type, label: String(label || '').slice(0, 80), t: new Date() });
    updateLedger();
    try {
      // plain-string body: CORS-safelisted (no preflight), server parses JSON regardless
      const body = JSON.stringify({ vid, type, label: String(label || '').slice(0, 80) });
      if (!navigator.sendBeacon || !navigator.sendBeacon(`${PULSE}/api/beacon`, body)) {
        fetch(`${PULSE}/api/beacon`, { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch (e) { /* stats are best-effort */ }
  }

  // ledger: static facts about this browser
  function updateLedgerTheme() {
    const el = $('ledTheme');
    if (!el) return;
    const st = storedTheme();
    el.textContent = st === 'ink' ? 'Set to dark.' : st === 'paper' ? 'Set to light.' : 'Not set.';
  }
  (function ledgerStatic() {
    let stored = null;
    try { stored = localStorage.getItem('aks-vid'); } catch (e) { stored = null; }
    $('ledVid').textContent = stored
      ? `a random id, ${stored.slice(0, 4)}…, created on your first visit so your chess game is still here when you return.`
      : 'not stored — your browser blocks storage.';
    if (DNT) {
      $('ledDnt').hidden = false;
      $('ledQueue').hidden = true;
      $('statsL1').textContent = 'stats off —';
      $('statsL2').textContent = 'your browser asked';
      const strike = privFig.querySelector('.stats-strike');
      if (strike) strike.removeAttribute('hidden');
      $('statsListItem').innerHTML = '<s>Stats</s> — off. Your browser sent a do-not-track signal.';
      $('statsListItem').className = 'gr';
    }
  })();
  syncTheme();

  beacon('pageview', location.hash || '/');

  const seenSections = new Set();
  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const id = entry.target.id;
      if (entry.isIntersecting && !seenSections.has(id)) {
        seenSections.add(id);
        beacon('section', id);
      }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('main .section').forEach((s) => sectionIO.observe(s));

  themeToggle.addEventListener('click', () => beacon('theme', html.getAttribute('data-theme')));
  document.querySelectorAll('.copy-email').forEach((b) => b.addEventListener('click', () => beacon('copy_email', '')));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href.startsWith('http')) beacon('outbound', a.hostname + a.pathname.slice(0, 40));
    else if (href.endsWith('.pdf')) beacon('resume', '');
  });

  if ('IntersectionObserver' in window) {
    const pio = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) { draw(privFig); pio.disconnect(); }
    }, { threshold: 0.4 });
    pio.observe(privFig);
  } else { draw(privFig); }

  // ==========================================================
  // THE WORK — lens, filters, case files
  // ==========================================================
  const workLead = $('workLead');
  const workIndex = $('workIndex');
  const alsoHead = $('alsoHead');
  const ruleNote = $('ruleNote');
  const lensNote = $('lensNote');
  const chipRow = $('chipRow');
  const chipLabel = $('chipLabel');
  const chipClear = $('chipClear');
  const countEl = $('filterCount');
  const openAllBtn = $('openAll');
  const items = Array.from(workIndex.querySelectorAll('.work-item'));
  const total = items.length;
  const slugOf = (it) => it.querySelector('article').id.replace(/^p-/, '');
  const bySlug = new Map(items.map((it) => [slugOf(it), it]));
  const lensRadios = Array.from(document.querySelectorAll('input[name="lens"]'));

  const LENSES = {
    nlp: { label: 'NLP', ranked: [
      ['peppa', 'Five on-device models behind a router with five thinking modes; speech streams sentence-by-sentence with barge-in interruption.'],
      ['argus', 'Gemini 2.5 Flash plus semantic embeddings: over 85% match accuracy with sub-3-second responses.'],
      ['proposalpilot', "Drafts in the freelancer's voice across OpenAI, Anthropic and Gemini; the AI layer is pure functions, unit-tested in Node."],
    ] },
    software: { label: 'Software', ranked: [
      ['mentormatch', 'Production work on a live platform: a security-definer plpgsql RPC under row-level security, then a 92-file refactor verified for byte-level behaviour parity.'],
      ['duetplanner', 'One last-write-wins merge-by-id algorithm, implemented identically on client and server; a 319-line Node backend with zero packages.'],
      ['argus', 'Full stack in a cross-university team of four: Next.js and React on the front end, FastAPI and Python on the back end.'],
      ['proposalpilot', 'Chrome MV3 with no backend; inserts drafts through the native value setter so React-controlled textareas accept them.'],
      ['peppa', '16,400+ lines with 242 tests.'],
      ['petal', '144 Kotlin files in a data/domain/presentation split.'],
    ] },
    robotics: { label: 'Robotics', ranked: [
      ['peppa', 'Sub-2-second voice-to-voice latency, barge-in interruption, and a deterministic reflex layer that keeps working with the LLM runtime offline.'],
      ['neondrift', 'A hand-rolled physics loop holding a 60 FPS render target.'],
      ['tejimola', 'A dspTime-based rhythm engine inside event-driven systems.'],
    ] },
  };

  // --- FLIP (reuses the old cancel-before-measure logic) ---
  const flipTimers = new WeakMap();
  const isShown = (it) => !it.hasAttribute('hidden') && !(it.parentElement && it.parentElement.hasAttribute('hidden'));
  function flip(mutate) {
    items.forEach((it) => {
      const t = flipTimers.get(it);
      if (t !== undefined) { clearTimeout(t); flipTimers.delete(it); }
      it.classList.remove('flip-move');
      it.style.transform = '';
      it.style.opacity = '';
    });
    if (reducedMotion) { mutate(); return; }
    const first = new Map(items.filter(isShown).map((it) => [it, it.getBoundingClientRect().top]));
    mutate();
    items.filter(isShown).forEach((it) => {
      const before = first.get(it);
      if (before === undefined) {
        it.style.opacity = '0';
        requestAnimationFrame(() => {
          it.classList.add('flip-move');
          it.style.opacity = '1';
          flipTimers.set(it, setTimeout(() => { it.classList.remove('flip-move'); it.style.opacity = ''; flipTimers.delete(it); }, 300));
        });
        return;
      }
      const delta = before - it.getBoundingClientRect().top;
      if (Math.abs(delta) < 2) return;
      it.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        it.classList.add('flip-move');
        it.style.transform = '';
        flipTimers.set(it, setTimeout(() => { it.classList.remove('flip-move'); flipTimers.delete(it); }, 300));
      });
    });
  }

  function updateCount() {
    const n = items.filter((it) => !it.hasAttribute('hidden')).length;
    countEl.textContent = n === total ? `${total} of ${total} shown` : `${pad2(n)} of ${total} shown`;
  }

  function clearReasons() {
    items.forEach((it) => {
      const r = it.querySelector('.reason');
      r.hidden = true;
      r.classList.remove('fade-in');
      r.textContent = '';
    });
  }

  let currentLens = 'all';
  function arrangeLens(name) {
    clearReasons();
    items.forEach((it) => it.removeAttribute('hidden'));
    chipRow.hidden = true;
    if (name === 'all' || !LENSES[name]) {
      items.forEach((it) => workIndex.appendChild(it));
      workLead.hidden = true;
      alsoHead.hidden = true;
      ruleNote.hidden = true;
      lensNote.hidden = true;
      return;
    }
    const lens = LENSES[name];
    const rankedSlugs = lens.ranked.map((r) => r[0]);
    lens.ranked.forEach(([slug, why]) => {
      const it = bySlug.get(slug);
      workLead.appendChild(it);
      const r = it.querySelector('.reason');
      const lab = document.createElement('span');
      lab.className = 'label';
      lab.textContent = `Why it's here for ${lens.label}`;
      const p = document.createElement('p');
      p.textContent = why;
      r.appendChild(lab);
      r.appendChild(p);
      r.hidden = false;
      if (!reducedMotion) r.classList.add('fade-in');
    });
    items.forEach((it) => { if (!rankedSlugs.includes(slugOf(it))) workIndex.appendChild(it); });
    workLead.hidden = false;
    alsoHead.hidden = false;
    ruleNote.hidden = false;
    lensNote.hidden = name !== 'robotics';
  }

  function setLens(name, { send = true, hash = true } = {}) {
    if (!LENSES[name]) name = 'all';
    currentLens = name;
    lensRadios.forEach((r) => { r.checked = r.value === name; });
    flip(() => arrangeLens(name));
    updateCount();
    if (hash) history.replaceState(null, '', name === 'all' ? '#work' : `#work=lens:${name}`);
    if (send) beacon('filter', 'lens:' + name);
  }
  lensRadios.forEach((r) => r.addEventListener('change', () => { if (r.checked) setLens(r.value); }));

  function applyFilter(pred, label) {
    // filters always read against the default order
    if (currentLens !== 'all') {
      currentLens = 'all';
      lensRadios.forEach((r) => { r.checked = r.value === 'all'; });
      arrangeLens('all');
    }
    flip(() => {
      items.forEach((it) => { if (pred(it)) it.removeAttribute('hidden'); else it.setAttribute('hidden', ''); });
    });
    chipLabel.textContent = `Showing: ${label}`;
    chipClear.setAttribute('aria-label', `Clear filter: ${label}`);
    chipRow.hidden = false;
    updateCount();
  }
  function filterByStack(token, label, updateHash = true) {
    applyFilter((it) => (` ${it.dataset.stack} `).includes(` ${token} `), label);
    if (updateHash) history.replaceState(null, '', `#work=stack:${token}`);
  }
  function filterByTerm(term, label, updateHash = true) {
    applyFilter((it) => (` ${it.dataset.terms} `).includes(` ${term} `), label);
    if (updateHash) history.replaceState(null, '', `#work=term:${term}`);
  }
  chipClear.addEventListener('click', () => {
    setLens('all', { send: false });
    const first = lensRadios.find((r) => r.value === 'all');
    if (first) first.focus();
  });

  const termLabels = {};
  document.querySelectorAll('button[data-term]').forEach((b) => {
    termLabels[b.dataset.term] = b.dataset.label;
    b.addEventListener('click', () => {
      filterByTerm(b.dataset.term, b.dataset.label);
      beacon('filter', 'term:' + b.dataset.term);
      scrollToEl($('work'), $('work-h'));
    });
  });

  // --- Tools: project names computed from the index, checked against the HTML ---
  document.querySelectorAll('button.skill').forEach((btn) => {
    const token = btn.dataset.skill;
    const name = btn.querySelector('.s-name').textContent.trim();
    const using = items.filter((it) => (` ${it.dataset.stack} `).includes(` ${token} `)).map((it) => it.dataset.name);
    const use = btn.querySelector('.s-use');
    const computed = using.join(', ');
    if (use.textContent.trim() !== computed) {
      console.warn(`Tools: "${name}" lists "${use.textContent.trim()}" but the index says "${computed}".`);
      use.textContent = computed;
    }
    if (using.length === 0) {
      const span = document.createElement('span');
      span.className = 'skill plain';
      span.innerHTML = btn.innerHTML;
      btn.replaceWith(span);
      return;
    }
    btn.addEventListener('click', () => {
      filterByStack(token, name);
      scrollToEl($('work'), $('work-h'));
      beacon('skill', token);
    });
  });

  // --- Case files: a 'project' beacon only when a person opens one ---
  const cases = Array.from(document.querySelectorAll('.case'));
  cases.forEach((d) => {
    const summary = d.querySelector('summary');
    summary.addEventListener('click', () => { d._user = true; });
    d.addEventListener('toggle', () => {
      if (d.open) {
        draw(d.querySelector('.flow'));
        if (d._user) beacon('project', d.closest('article').id.replace(/^p-/, ''));
      }
      d._user = false;
      syncOpenAll();
    });
  });
  function syncOpenAll() {
    const allOpen = cases.every((d) => d.open);
    openAllBtn.setAttribute('aria-pressed', String(allOpen));
    openAllBtn.textContent = allOpen ? 'Close all case files' : 'Open all case files';
  }
  openAllBtn.addEventListener('click', () => {
    const open = openAllBtn.getAttribute('aria-pressed') !== 'true';
    cases.forEach((d) => { d._user = false; d.open = open; });
    syncOpenAll();
    beacon('filter', open ? 'cases:open' : 'cases:close');
  });

  function openProject(id, focusIt) {
    const art = $(id);
    if (!art) return;
    const d = art.querySelector('.case');
    if (d) { d._user = false; d.open = true; }
    scrollToEl(art, focusIt ? art.querySelector('h3') : null);
  }
  document.querySelectorAll('[data-open]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      history.replaceState(null, '', '#' + a.dataset.open);
      openProject(a.dataset.open, true);
    });
  });
  document.querySelectorAll('[data-focus]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const sec = $(a.dataset.focus);
      history.replaceState(null, '', '#' + a.dataset.focus);
      scrollToEl(sec, sec.querySelector('h2'));
    });
  });

  // --- Restore state from the URL hash (old links keep working) ---
  (function initFromHash() {
    let h;
    try {
      h = decodeURIComponent(location.hash.slice(1));
    } catch (e) {
      h = ''; // malformed percent-encoding in a shared link
    }
    const legacy = { ai: 'nlp', web: 'software', games: 'all', mobile: 'all', all: 'all' };
    let handled = false;
    if (h.startsWith('work=lens:')) { setLens(h.slice(10), { send: false, hash: false }); handled = true; }
    else if (h.startsWith('work=stack:')) {
      const token = h.slice('work=stack:'.length);
      const btn = document.querySelector(`button.skill[data-skill="${CSS.escape(token)}"]`);
      if (btn) filterByStack(token, btn.querySelector('.s-name').textContent.trim(), false);
      handled = true;
    } else if (h.startsWith('work=term:')) {
      const t = h.slice('work=term:'.length);
      if (termLabels[t]) filterByTerm(t, termLabels[t], false);
      handled = true;
    } else if (h.startsWith('work=')) {
      const cat = h.slice(5);
      if (legacy[cat]) setLens(legacy[cat], { send: false, hash: false });
      handled = true;
    } else if (h.startsWith('p-')) {
      const art = $(h);
      if (art) openProject(h, false);
    }
    if (handled) setTimeout(() => $('work').scrollIntoView({ block: 'start' }), 0);
  })();
  updateCount();
  syncOpenAll();

  // ==========================================================
  // CHESS — live correspondence board (visitor plays White)
  // ==========================================================
  const board = $('chessboard');
  const piecesEl = $('cbPieces');
  const statusEl = $('chessStatus');
  const movesEl = $('chessMoves');
  const movesWrap = $('movesWrap');
  const figEl = $('chessFig');
  const resetBtn = $('chessReset');
  const indicator = $('chessInd');

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

    let lastMove = null;
    let selected = null;

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
      Object.keys(pieceLayer).forEach((k) => {
        if (!b[k]) { pieceLayer[k].remove(); delete pieceLayer[k]; }
      });
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
        if (reducedMotion) captured.remove();
        else { captured.classList.add('gone'); setTimeout(() => captured.remove(), 130); }
      }
      delete pieceLayer[from];
      pieceLayer[to] = el;
      el.classList.toggle('cb-reply', !!isReply);
      el.style.setProperty('--f', m.t[0]);
      el.style.setProperty('--r', m.t[1]);
    }

    function renderMoves(moves) {
      movesEl.textContent = '';
      for (let i = 0; i < moves.length; i += 2) {
        const tr = document.createElement('tr');
        const cells = [
          String(i / 2 + 1),
          `${coord(...moves[i].f)}–${coord(...moves[i].t)}`,
          moves[i + 1] ? `${coord(...moves[i + 1].f)}–${coord(...moves[i + 1].t)}` : '',
        ];
        cells.forEach((v) => { const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
        movesEl.appendChild(tr);
      }
      movesWrap.hidden = moves.length === 0;
      movesWrap.scrollTop = movesWrap.scrollHeight;
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
      statusEl.textContent = "The live board's server is resting. Here's the Italian Game, three moves in, while it wakes up.";
      figEl.textContent = 'Exhibition · the Italian Game, three moves in';
      movesWrap.hidden = true;
      resetBtn.hidden = true;
      if (reducedMotion) {
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
      updateIndicator();
    }

    // --- Live game ---
    let game = null;
    let waitingNoted = false;

    function myTurn() {
      return game && game.status === 'active' && game.moves.length % 2 === 0;
    }

    function updateIndicator() {
      const st = game ? replay(game.moves).status : null;
      const show = live && game && st === 'active' && game.moves.length > 0;
      if (!show) { indicator.hidden = true; indicator.classList.remove('show'); return; }
      const wasHidden = indicator.hidden;
      indicator.textContent = '';
      if (myTurn()) {
        const d = document.createElement('span');
        d.className = 'dot';
        d.setAttribute('aria-hidden', 'true');
        indicator.appendChild(d);
        indicator.appendChild(document.createTextNode('Your move'));
        indicator.classList.remove('waiting');
        indicator.setAttribute('aria-label', 'Chess: your move');
      } else {
        indicator.appendChild(document.createTextNode('Move sent'));
        indicator.classList.add('waiting');
        indicator.setAttribute('aria-label', 'Chess: waiting for my reply');
      }
      indicator.hidden = false;
      if (wasHidden && !reducedMotion) indicator.classList.add('show');
    }

    function updateUI() {
      const { b, status } = replay(game.moves);
      lastMove = game.moves.length ? game.moves[game.moves.length - 1] : null;
      render(b);
      renderMoves(game.moves);
      resetBtn.hidden = game.moves.length === 0 && status === 'active';
      figEl.textContent = 'Open challenge · you play White';
      if (status === 'won_v') statusEl.textContent = 'You took my king. Well played — rematch?';
      else if (status === 'won_o') statusEl.textContent = 'Got your king. Good game — rematch?';
      else if (myTurn()) {
        if (game.moves.length) {
          const m = game.moves[game.moves.length - 1];
          statusEl.textContent = `I played ${coord(...m.f)} to ${coord(...m.t)}. Your move.`;
        } else statusEl.textContent = 'Your move. Pick a white piece.';
        waitingNoted = false;
      } else statusEl.textContent = 'Sent. The move is on my desk — check back soon.';
      if (status !== 'active') resetBtn.hidden = false;
      updateIndicator();
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
      pollTimer = setInterval(() => {
        if (document.hidden || !game) return;
        checkForReply();
      }, 45000);
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
