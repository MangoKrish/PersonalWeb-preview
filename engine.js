// ==========================================================
// A small chess engine — full rules, alpha-beta search.
// One file, three uses: the page loads it for the rules (legal moves,
// check, mate, notation); a Web Worker loads it to think; Node loads
// it for the perft tests. No dependencies.
//
// Board: 0x88. Index = row * 16 + file, row 0 is the 8th rank —
// the same orientation the page draws. White pieces are positive
// (1 pawn … 6 king), black negative.
// ==========================================================
(function () {
  'use strict';
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const N_OFF = [-33, -31, -18, -14, 14, 18, 31, 33];
  const B_OFF = [-17, -15, 15, 17];
  const R_OFF = [-16, -1, 1, 16];
  const K_OFF = [-17, -16, -15, -1, 1, 15, 16, 17];
  const FILES = 'abcdefgh';
  const LETTER = ['', '', 'N', 'B', 'R', 'Q', 'K'];
  const sqName = (s) => FILES[s & 7] + (8 - (s >> 4));
  const sqFrom = (n) => (8 - +n[1]) * 16 + FILES.indexOf(n[0]);

  // move = from | to << 7 | promo << 14 | flags << 17
  const F_CAP = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8;
  const mv = (f, t, promo, flags) => f | (t << 7) | (promo << 14) | (flags << 17);
  const mFrom = (m) => m & 127, mTo = (m) => (m >> 7) & 127, mPromo = (m) => (m >> 14) & 7, mFlags = (m) => m >> 17;

  // ---------- zobrist keys (two 32-bit halves) ----------
  let seed = 0x2545F491;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const ZP = new Uint32Array(13 * 128 * 2);
  for (let i = 0; i < ZP.length; i++) ZP[i] = rnd();
  const ZC = new Uint32Array(32); for (let i = 0; i < 32; i++) ZC[i] = rnd();
  const ZE = new Uint32Array(16); for (let i = 0; i < 16; i++) ZE[i] = rnd();
  const ZS = [rnd(), rnd()];
  const zi = (p, s) => ((p + 6) * 128 + s) * 2;

  // castling rights lost when a piece leaves or lands on these squares
  const CAST_MASK = new Uint8Array(128).fill(15);
  CAST_MASK[116] = 12; CAST_MASK[119] = 14; CAST_MASK[112] = 13;
  CAST_MASK[4] = 3; CAST_MASK[7] = 11; CAST_MASK[0] = 7;

  function Pos() {
    this.b = new Int8Array(128);
    this.side = 1; this.cast = 0; this.ep = -1; this.half = 0; this.full = 1;
    this.kw = 116; this.kb = 4; this.h1 = 0; this.h2 = 0;
    this.undo = []; this.reps = [];
  }
  Pos.prototype.hashAll = function () {
    let a = 0, c = 0;
    for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = this.b[s]; if (p) { const i = zi(p, s); a ^= ZP[i]; c ^= ZP[i + 1]; } }
    a ^= ZC[this.cast * 2]; c ^= ZC[this.cast * 2 + 1];
    if (this.ep >= 0) { a ^= ZE[(this.ep & 7) * 2]; c ^= ZE[(this.ep & 7) * 2 + 1]; }
    if (this.side < 0) { a ^= ZS[0]; c ^= ZS[1]; }
    this.h1 = a >>> 0; this.h2 = c >>> 0;
  };
  Pos.prototype.load = function (fen) {
    const [board, side, cast, ep, half, full] = fen.split(' ');
    this.b.fill(0);
    let r = 0, f = 0;
    for (const ch of board) {
      if (ch === '/') { r++; f = 0; continue; }
      if (/\d/.test(ch)) { f += +ch; continue; }
      const t = ' pnbrqk'.indexOf(ch.toLowerCase());
      const s = r * 16 + f;
      this.b[s] = ch === ch.toUpperCase() ? t : -t;
      if (ch === 'K') this.kw = s; if (ch === 'k') this.kb = s;
      f++;
    }
    this.side = side === 'w' ? 1 : -1;
    this.cast = (cast.includes('K') ? 1 : 0) | (cast.includes('Q') ? 2 : 0) | (cast.includes('k') ? 4 : 0) | (cast.includes('q') ? 8 : 0);
    this.ep = ep && ep !== '-' ? sqFrom(ep) : -1;
    this.half = +half || 0; this.full = +full || 1;
    this.undo = []; this.hashAll(); this.reps = [this.h1];
    return this;
  };

  Pos.prototype.attacked = function (s, by) {
    const b = this.b;
    if (by > 0) { if (!((s + 15) & 0x88) && b[s + 15] === P) return true; if (!((s + 17) & 0x88) && b[s + 17] === P) return true; }
    else { if (!((s - 15) & 0x88) && b[s - 15] === -P) return true; if (!((s - 17) & 0x88) && b[s - 17] === -P) return true; }
    for (const o of N_OFF) { const t = s + o; if (!(t & 0x88) && b[t] === N * by) return true; }
    for (const o of K_OFF) { const t = s + o; if (!(t & 0x88) && b[t] === K * by) return true; }
    for (const o of B_OFF) { let t = s + o; while (!(t & 0x88)) { const p = b[t]; if (p) { if (p === B * by || p === Q * by) return true; break; } t += o; } }
    for (const o of R_OFF) { let t = s + o; while (!(t & 0x88)) { const p = b[t]; if (p) { if (p === R * by || p === Q * by) return true; break; } t += o; } }
    return false;
  };
  Pos.prototype.inCheck = function () { return this.attacked(this.side > 0 ? this.kw : this.kb, -this.side); };

  // pseudo-legal moves (legality checked after making them)
  Pos.prototype.gen = function (capsOnly) {
    const b = this.b, us = this.side, out = [];
    const dir = us > 0 ? -16 : 16, startRow = us > 0 ? 6 : 1, lastRow = us > 0 ? 0 : 7;
    const addPawn = (f, t, flags) => {
      if ((t >> 4) === lastRow) { out.push(mv(f, t, Q, flags)); if (!capsOnly) { out.push(mv(f, t, N, flags)); out.push(mv(f, t, R, flags)); out.push(mv(f, t, B, flags)); } }
      else out.push(mv(f, t, 0, flags));
    };
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s];
      if (!p || (p > 0) !== (us > 0)) continue;
      const t = p * us;
      if (t === P) {
        const one = s + dir;
        if (!(one & 0x88) && !b[one]) {
          if (!capsOnly || (one >> 4) === lastRow) addPawn(s, one, 0);
          if (!capsOnly && (s >> 4) === startRow && !b[one + dir]) out.push(mv(s, one + dir, 0, F_DOUBLE));
        }
        for (const d of [dir - 1, dir + 1]) {
          const c = s + d;
          if (c & 0x88) continue;
          if (b[c] * us < 0) addPawn(s, c, F_CAP);
          else if (c === this.ep) out.push(mv(s, c, 0, F_CAP | F_EP));
        }
      } else if (t === N || t === K) {
        for (const o of (t === N ? N_OFF : K_OFF)) {
          const c = s + o;
          if (c & 0x88) continue;
          const q = b[c];
          if (!q) { if (!capsOnly) out.push(mv(s, c, 0, 0)); }
          else if (q * us < 0) out.push(mv(s, c, 0, F_CAP));
        }
      } else {
        const offs = t === B ? B_OFF : t === R ? R_OFF : K_OFF;
        for (const o of offs) {
          let c = s + o;
          while (!(c & 0x88)) {
            const q = b[c];
            if (!q) { if (!capsOnly) out.push(mv(s, c, 0, 0)); }
            else { if (q * us < 0) out.push(mv(s, c, 0, F_CAP)); break; }
            c += o;
          }
        }
      }
    }
    if (!capsOnly) {
      const c = this.cast;
      if (us > 0) {
        if ((c & 1) && !b[117] && !b[118] && b[119] === R && !this.attacked(116, -1) && !this.attacked(117, -1) && !this.attacked(118, -1)) out.push(mv(116, 118, 0, F_CASTLE));
        if ((c & 2) && !b[115] && !b[114] && !b[113] && b[112] === R && !this.attacked(116, -1) && !this.attacked(115, -1) && !this.attacked(114, -1)) out.push(mv(116, 114, 0, F_CASTLE));
      } else {
        if ((c & 4) && !b[5] && !b[6] && b[7] === -R && !this.attacked(4, 1) && !this.attacked(5, 1) && !this.attacked(6, 1)) out.push(mv(4, 6, 0, F_CASTLE));
        if ((c & 8) && !b[3] && !b[2] && !b[1] && b[0] === -R && !this.attacked(4, 1) && !this.attacked(3, 1) && !this.attacked(2, 1)) out.push(mv(4, 2, 0, F_CASTLE));
      }
    }
    return out;
  };

  Pos.prototype.xp = function (p, s) { const i = zi(p, s); this.h1 = (this.h1 ^ ZP[i]) >>> 0; this.h2 = (this.h2 ^ ZP[i + 1]) >>> 0; };
  // make a move; returns false (and takes it back) if it leaves our king in check
  Pos.prototype.make = function (m) {
    const b = this.b, us = this.side;
    const f = mFrom(m), t = mTo(m), promo = mPromo(m), fl = mFlags(m);
    const p = b[f];
    let capSq = t;
    if (fl & F_EP) capSq = t + (us > 0 ? 16 : -16);
    const cap = b[capSq];
    this.undo.push([m, cap, this.cast, this.ep, this.half, this.h1, this.h2, this.kw, this.kb]);
    // pieces
    this.xp(p, f); b[f] = 0;
    if (cap) { this.xp(cap, capSq); b[capSq] = 0; }
    const placed = promo ? promo * us : p;
    b[t] = placed; this.xp(placed, t);
    if (fl & F_CASTLE) {
      let rf, rt;
      if (t === 118) { rf = 119; rt = 117; } else if (t === 114) { rf = 112; rt = 115; } else if (t === 6) { rf = 7; rt = 5; } else { rf = 0; rt = 3; }
      const rook = b[rf]; this.xp(rook, rf); b[rf] = 0; b[rt] = rook; this.xp(rook, rt);
    }
    if (p === K) this.kw = t; else if (p === -K) this.kb = t;
    // rights, en passant, clocks, side
    this.h1 ^= ZC[this.cast * 2]; this.h2 ^= ZC[this.cast * 2 + 1];
    this.cast &= CAST_MASK[f] & CAST_MASK[t];
    this.h1 ^= ZC[this.cast * 2]; this.h2 ^= ZC[this.cast * 2 + 1];
    if (this.ep >= 0) { this.h1 ^= ZE[(this.ep & 7) * 2]; this.h2 ^= ZE[(this.ep & 7) * 2 + 1]; }
    this.ep = fl & F_DOUBLE ? f + (us > 0 ? -16 : 16) : -1;
    if (this.ep >= 0) { this.h1 ^= ZE[(this.ep & 7) * 2]; this.h2 ^= ZE[(this.ep & 7) * 2 + 1]; }
    this.half = (p === P || p === -P || cap) ? 0 : this.half + 1;
    if (us < 0) this.full++;
    this.side = -us; this.h1 ^= ZS[0]; this.h2 ^= ZS[1];
    this.h1 >>>= 0; this.h2 >>>= 0;
    this.reps.push(this.h1);
    if (this.attacked(us > 0 ? this.kw : this.kb, -us)) { this.unmake(); return false; }
    return true;
  };
  Pos.prototype.unmake = function () {
    const [m, cap, cast, ep, half, h1, h2, kw, kb] = this.undo.pop();
    this.reps.pop();
    const b = this.b, us = -this.side;
    const f = mFrom(m), t = mTo(m), promo = mPromo(m), fl = mFlags(m);
    const p = promo ? P * us : b[t];
    b[f] = p; b[t] = 0;
    if (fl & F_EP) b[t + (us > 0 ? 16 : -16)] = cap; else if (cap) b[t] = cap;
    if (fl & F_CASTLE) {
      let rf, rt;
      if (t === 118) { rf = 119; rt = 117; } else if (t === 114) { rf = 112; rt = 115; } else if (t === 6) { rf = 7; rt = 5; } else { rf = 0; rt = 3; }
      b[rf] = b[rt]; b[rt] = 0;
    }
    if (us < 0) this.full--;
    this.side = us; this.cast = cast; this.ep = ep; this.half = half; this.h1 = h1; this.h2 = h2; this.kw = kw; this.kb = kb;
  };
  Pos.prototype.legal = function () {
    const out = [];
    for (const m of this.gen(false)) if (this.make(m)) { this.unmake(); out.push(m); }
    return out;
  };
  Pos.prototype.repeats = function () {
    let n = 0;
    const h = this.h1, L = this.reps.length;
    for (let i = L - 3; i >= 0 && i >= L - 1 - this.half; i -= 2) if (this.reps[i] === h) n++;
    return n;
  };
  Pos.prototype.lowMaterial = function () {
    let minors = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const t = Math.abs(this.b[s]);
      if (t === P || t === R || t === Q) return false;
      if (t === N || t === B) minors++;
    }
    return minors <= 1;
  };
  Pos.prototype.perft = function (d) {
    if (d === 0) return 1;
    let n = 0;
    for (const m of this.gen(false)) if (this.make(m)) { n += d === 1 ? 1 : this.perft(d - 1); this.unmake(); }
    return n;
  };

  // ---------- notation ----------
  const uci = (m) => sqName(mFrom(m)) + sqName(mTo(m)) + (mPromo(m) ? ' pnbrqk'[mPromo(m)] : '');
  Pos.prototype.fromUci = function (u) {
    for (const m of this.legal()) if (uci(m) === u) return m;
    return 0;
  };
  Pos.prototype.san = function (m, legalList) {
    const f = mFrom(m), t = mTo(m), fl = mFlags(m), type = Math.abs(this.b[f]);
    let s;
    if (fl & F_CASTLE) s = (t & 7) === 6 ? 'O-O' : 'O-O-O';
    else if (type === P) {
      s = (fl & F_CAP ? FILES[f & 7] + 'x' : '') + sqName(t) + (mPromo(m) ? '=' + LETTER[mPromo(m)] : '');
    } else {
      const rivals = (legalList || this.legal()).filter((o) => o !== m && mTo(o) === t && Math.abs(this.b[mFrom(o)]) === type);
      let dis = '';
      if (rivals.length) {
        const sameFile = rivals.some((o) => (mFrom(o) & 7) === (f & 7)), sameRow = rivals.some((o) => (mFrom(o) >> 4) === (f >> 4));
        dis = !sameFile ? FILES[f & 7] : !sameRow ? String(8 - (f >> 4)) : sqName(f);
      }
      s = LETTER[type] + dis + (fl & F_CAP ? 'x' : '') + sqName(t);
    }
    this.make(m);
    if (this.inCheck()) s += this.legal().length ? '+' : '#';
    this.unmake();
    return s;
  };

  // ---------- evaluation (centipawns, from the side to move) ----------
  const VAL = [0, 100, 320, 330, 500, 900, 0];
  const PST = [[],
    [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  ];
  const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
  Pos.prototype.evaluate = function () {
    const b = this.b;
    let score = 0, phase = 0, kwi = 0, kbi = 0;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s];
      if (!p) continue;
      const t = p > 0 ? p : -p;
      const i = p > 0 ? (s >> 4) * 8 + (s & 7) : (7 - (s >> 4)) * 8 + (s & 7);
      if (t === K) { if (p > 0) kwi = i; else kbi = i; continue; }
      if (t !== P) phase += VAL[t];
      const v = VAL[t] + PST[t][i];
      score += p > 0 ? v : -v;
    }
    // kings walk to the centre once the heavy pieces are gone
    const e = Math.min(1, Math.max(0, (3200 - phase) / 2400));
    score += PST[K][kwi] * (1 - e) + KING_END[kwi] * e;
    score -= PST[K][kbi] * (1 - e) + KING_END[kbi] * e;
    return (score * this.side) | 0;
  };

  // ---------- search ----------
  const MATE = 30000;
  const TT_SIZE = 1 << 18, TT_MASK = TT_SIZE - 1;
  const ttK1 = new Uint32Array(TT_SIZE), ttK2 = new Uint32Array(TT_SIZE), ttMove = new Int32Array(TT_SIZE);
  const ttScore = new Int32Array(TT_SIZE), ttDepth = new Int8Array(TT_SIZE), ttFlag = new Int8Array(TT_SIZE);
  const EXACT = 1, LOWER = 2, UPPER = 3;

  function search(pos, opts) {
    const maxDepth = opts.depth || 64, deadline = Date.now() + (opts.ms || 1000), noise = opts.noise || 0;
    const killers = []; const hist = new Int32Array(128 * 128);
    let nodes = 0, stop = false;

    const orderScore = (m, ttm, ply) => {
      if (m === ttm) return 1e7;
      const fl = mFlags(m);
      if (fl & F_CAP) return 1e6 + 10 * VAL[Math.abs(pos.b[mTo(m)]) || P] - VAL[Math.abs(pos.b[mFrom(m)])];
      if (mPromo(m)) return 9e5 + VAL[mPromo(m)];
      const k = killers[ply];
      if (k && (k[0] === m || k[1] === m)) return 8e5;
      return hist[mFrom(m) * 128 + mTo(m)];
    };
    const sortMoves = (list, ttm, ply) => {
      const sc = list.map((m) => orderScore(m, ttm, ply));
      const idx = list.map((_, i) => i).sort((a, c) => sc[c] - sc[a]);
      return idx.map((i) => list[i]);
    };

    function quiesce(alpha, beta, ply) {
      if ((++nodes & 2047) === 0 && Date.now() > deadline) stop = true;
      if (stop) return 0;
      const stand = pos.evaluate();
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      for (const m of sortMoves(pos.gen(true), 0, ply)) {
        if (!pos.make(m)) continue;
        const s = -quiesce(-beta, -alpha, ply + 1);
        pos.unmake();
        if (stop) return 0;
        if (s >= beta) return s;
        if (s > alpha) alpha = s;
      }
      return alpha;
    }

    function negamax(depth, alpha, beta, ply) {
      if ((++nodes & 2047) === 0 && Date.now() > deadline) stop = true;
      if (stop) return 0;
      if (ply > 0 && (pos.half >= 100 || pos.repeats() >= 1)) return 0;
      const check = pos.inCheck();
      if (check) depth++;
      if (depth <= 0) return quiesce(alpha, beta, ply);
      const slot = pos.h1 & TT_MASK;
      let ttm = 0;
      if (ttK1[slot] === pos.h1 && ttK2[slot] === pos.h2) {
        ttm = ttMove[slot];
        if (ply > 0 && ttDepth[slot] >= depth) {
          const s = ttScore[slot], f = ttFlag[slot];
          if (f === EXACT || (f === LOWER && s >= beta) || (f === UPPER && s <= alpha)) return s;
        }
      }
      const a0 = alpha;
      let best = -MATE - 1, bestMove = 0, legalCount = 0;
      for (const m of sortMoves(pos.gen(false), ttm, ply)) {
        if (!pos.make(m)) continue;
        legalCount++;
        let s;
        if (ply === 0 && noise) s = -negamax(depth - 1, -MATE - 1, MATE + 1, ply + 1);   // exact score, then a little variety
        else if (legalCount === 1) s = -negamax(depth - 1, -beta, -alpha, ply + 1);
        else {
          s = -negamax(depth - 1, -alpha - 1, -alpha, ply + 1);   // principal variation search
          if (s > alpha && s < beta) s = -negamax(depth - 1, -beta, -alpha, ply + 1);
        }
        pos.unmake();
        if (stop) return 0;
        if (ply === 0 && noise) s += ((m * 2654435761) >>> 0) % (2 * noise + 1) - noise;
        if (s > best) { best = s; bestMove = m; }
        if (s > alpha) alpha = s;
        if (alpha >= beta && !(ply === 0 && noise)) {
          if (!(mFlags(m) & F_CAP)) {
            const k = killers[ply] || (killers[ply] = [0, 0]);
            if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
            hist[mFrom(m) * 128 + mTo(m)] += depth * depth;
          }
          break;
        }
      }
      if (!legalCount) return check ? -MATE + ply : 0;
      ttK1[slot] = pos.h1; ttK2[slot] = pos.h2; ttMove[slot] = bestMove; ttScore[slot] = best; ttDepth[slot] = depth;
      ttFlag[slot] = best <= a0 ? UPPER : best >= beta ? LOWER : EXACT;
      if (ply === 0) rootBest = bestMove;
      return best;
    }

    let rootBest = 0, done = { move: 0, score: 0, depth: 0 };
    const legal = pos.legal();
    if (legal.length === 1) return { move: legal[0], score: 0, depth: 0, nodes: 0 };
    for (let d = 1; d <= maxDepth; d++) {
      const s = negamax(d, -MATE - 1, MATE + 1, 0);
      if (stop) break;
      done = { move: rootBest, score: s, depth: d };
      if (Math.abs(s) > MATE - 100 || Date.now() > deadline - (opts.ms || 1000) * 0.45) break;
    }
    if (!done.move) done.move = rootBest || legal[0];
    done.nodes = nodes;
    return done;
  }

  const LEVELS = { easy: { depth: 2, ms: 400, noise: 70 }, medium: { depth: 5, ms: 800, noise: 10 }, hard: { depth: 64, ms: 1600, noise: 0 } };
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const fromMoves = (list) => { const p = new Pos().load(START); for (const u of list || []) { const m = p.fromUci(u); if (!m) break; p.make(m); } return p; };

  const api = { Pos, START, fromMoves, search, uci, sqName, mFrom, mTo, mPromo, mFlags, F_CAP, F_EP, F_CASTLE, LEVELS, MATE };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (typeof window !== 'undefined') window.AKSChess = api;
  else if (typeof self !== 'undefined') {
    // Web Worker: { moves: ['e2e4', …], level } → { move: 'e7e5' }
    self.onmessage = (e) => {
      const pos = fromMoves(e.data.moves);
      const r = search(pos, LEVELS[e.data.level] || LEVELS.medium);
      self.postMessage({ id: e.data.id, move: r.move ? uci(r.move) : null, score: r.score, depth: r.depth, nodes: r.nodes });
    };
  }
})();
