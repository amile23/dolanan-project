/* Dolanan AR – Game Aji Saka
   Permainan: Labirin Dora, Labirin Aji Saka, Ukir Aksara (bintang berurutan), Latihan Aksara
   (tulis bintang -> belajar -> pecah gelembung 2 tangan -> kuis).
   Pengendali utama: ujung telunjuk (MediaPipe Hands lewat kamera). Mouse/sentuh hanya cadangan. */
(() => {
'use strict';
const W = 1280, H = 720, TAU = Math.PI * 2;
const $ = s => document.querySelector(s);
const stage = $('#stage'), cv = $('#cv'), ctx = cv.getContext('2d'), vid = $('#vid'), cur = $('#cur');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const now = () => performance.now();

/* ---------- pengaturan ---------- */
const S = { assist: 1, sound: true, dim: .45, mode: null, seq: false, scr: 'sStart', hashGame: null };
try { const o = JSON.parse(localStorage.getItem('dolanan_set') || '{}'); Object.assign(S, { assist: o.assist ?? 1, sound: o.sound ?? true, dim: o.dim ?? .45 }); } catch (e) {}
const saveSet = () => { try { localStorage.setItem('dolanan_set', JSON.stringify({ assist: S.assist, sound: S.sound, dim: S.dim })); } catch (e) {} };
$('#optAssist').value = S.assist; $('#optSound').value = S.sound ? '1' : '0'; $('#optDim').value = String(S.dim);
if (![...$('#optDim').options].some(o => +o.value === S.dim)) { S.dim = .45; $('#optDim').value = '0.45'; }
$('#optAssist').onchange = e => { S.assist = +e.target.value; saveSet(); };
$('#optSound').onchange = e => { S.sound = e.target.value === '1'; saveSet(); if (!S.sound) { voice.audio && voice.audio.pause(); } };
$('#optDim').onchange = e => { S.dim = +e.target.value; saveSet(); };
$('#gear').onclick = () => $('#panel').classList.toggle('on');
const DONE_KEY = 'dolanan_aksara_done', LAT_KEY = 'dolanan_latihan_done';
const loadDone = () => { try { return clamp(+localStorage.getItem(DONE_KEY) || 0, 0, 20); } catch (e) { return 0; } };
const saveDone = n => { try { localStorage.setItem(DONE_KEY, String(n)); } catch (e) {} };
const loadLat = () => { try { return JSON.parse(localStorage.getItem(LAT_KEY) || '[]'); } catch (e) { return []; } };
const saveLat = a => { try { localStorage.setItem(LAT_KEY, JSON.stringify(a)); } catch (e) {} };
$('#bReset').onclick = () => { saveDone(0); saveLat([]); if (G.id === 'aksara') startGame('aksara'); };

/* ---------- gambar ---------- */
const IM = {};
['cut_aji', 'cut_dora', 'cut_sembada', 'cut_duo'].forEach(n => { const i = new Image(); i.src = 'img/' + n + '.png'; IM[n] = i; });
['s18', 's11'].forEach(n => { const i = new Image(); i.src = 'img/' + n + '.webp'; IM[n] = i; });

/* ---------- suara & teks ---------- */
const VL = {};
const EXTRA = [
  { key: 'p10_1_dora', file: 'p10_1_dora.mp3', dur: 4.68, text: 'Wah, jalannya bercabang! Teman-teman, maukah kalian membantuku menemukan Sembada?' },
  { key: 'p16_1_aji', file: 'p16_1_aji.mp3', dur: 4.18, text: 'Teman-teman, aku harus menemukan mereka. Bisakah kalian membantuku?' },
  { key: 'p20_1_aji', file: 'p20_1_aji.mp3', dur: 5.21, text: 'Teman-teman, aku ingin menuliskan sebuah pesan untuk mengenang Dora dan Sembada.' },
  { key: 'p20_2_aji', file: 'p20_2_aji.mp3', dur: 3.17, text: 'Maukah kalian membantuku mengukir aksara-aksara ini?' }
];
EXTRA.forEach(v => VL[v.key] = v);
fetch('audio/voices.json').then(r => r.json()).then(a => a.forEach(v => VL[v.key] = v)).catch(() => {});
const COL = { 'Aji Saka': '#365D85', 'Dora': '#32715C', 'Sembada': '#A64F3C' };
const voice = { tok: 0, audio: null, t: 0, dur: 0, chunks: [], res: null, active: false, ci: -1 };
const capEl = $('#cap'), capT = $('#capT'), capN = $('#capN');
let tcount = 0;
function sayText(text, speaker, sec) { const k = '_t' + (++tcount); VL[k] = { key: k, file: null, text, dur: sec || Math.max(2.4, text.length * .07 + 1.2) }; return say(k, speaker); }

function chunkify(text) {
  const sent = text.match(/[^.!?]+[.!?]*["”]?\s*/g) || [text];
  const out = []; let cu = '';
  for (const s of sent) {
    const t = s.trim(); if (!t) continue;
    if ((cu + ' ' + t).trim().length <= 80) cu = (cu + ' ' + t).trim();
    else { if (cu) out.push(cu); cu = t; }
  }
  if (cu) out.push(cu);
  const res = [];
  for (const c of out) {
    if (c.length <= 84) { res.push(c); continue; }
    const mid = c.length / 2; let best = -1;
    for (let i = 0; i < c.length; i++) if (/[,; ]/.test(c[i]) && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    res.push(c.slice(0, best + 1).trim(), c.slice(best + 1).trim());
  }
  return res;
}
function say(key, speaker) {
  stopVoice();
  const v = VL[key];
  if (!v) return Promise.resolve(false);
  return new Promise(res => {
    voice.tok++;
    voice.res = res; voice.t = 0; voice.active = true; voice.ci = -1;
    const base = (S.sound && v.file) ? v.dur + .3 : Math.max(v.dur + .3, v.text.length * .075 + 1.5);
    voice.dur = base;
    const ch = chunkify(v.text), tot = ch.reduce((a, c) => a + c.length + 8, 0); let a = 0;
    voice.chunks = ch.map(c => { const d = (c.length + 8) / tot * base; const o = { a, b: a + d, text: c }; a += d; return o; });
    capN.textContent = speaker || 'Aji Saka';
    capEl.style.setProperty('--c', COL[speaker] || COL['Aji Saka']);
    if (S.sound && v.file) { try { const au = new Audio('audio/' + v.file); voice.audio = au; au.play().catch(() => {}); } catch (e) {} }
  });
}
function stopVoice() {
  if (voice.audio) { try { voice.audio.pause(); } catch (e) {} voice.audio = null; }
  capEl.classList.remove('on');
  if (voice.res) { const r = voice.res; voice.res = null; voice.active = false; r(false); }
  voice.active = false;
}
function voiceUpdate(dt) {
  if (!voice.active || paused) return;
  voice.t += dt;
  let i = voice.chunks.findIndex(c => voice.t >= c.a && voice.t < c.b);
  if (i < 0 && voice.t < voice.dur) i = voice.chunks.length - 1;
  if (i >= 0 && i !== voice.ci) { voice.ci = i; capT.textContent = voice.chunks[i].text; capEl.classList.add('on'); }
  if (voice.t >= voice.dur) {
    voice.active = false; capEl.classList.remove('on');
    if (voice.audio) voice.audio = null;
    const r = voice.res; voice.res = null; r && r(true);
  }
}

/* ---------- pointer (tangan) ---------- */
const P = { x: W / 2, y: H / 2, on: false, seen: 0, inj: false };
const P2 = { x: 0, y: 0, on: false };                  // tangan kedua (hanya untuk uji / sentuh dua jari)
const T = [{ x: 0, y: 0, on: false, seen: 0 }, { x: 0, y: 0, on: false, seen: 0 }];   // jejak dua tangan dari kamera
let paused = false, okSince = 0, maxHands = 1;
const isCam = () => S.mode === 'cam';
const tracks = () => isCam() ? T.filter(t => t.on) : [P, P2].filter(t => t.on);
function toLogical(e) { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
stage.addEventListener('pointermove', e => { if (isCam()) return; const [x, y] = toLogical(e); P.x = x; P.y = y; P.on = true; P.seen = now(); });
stage.addEventListener('pointerdown', e => { if (isCam()) return; const [x, y] = toLogical(e); P.x = x; P.y = y; P.on = true; P.seen = now(); });
stage.addEventListener('pointerleave', () => { if (!isCam() && !P.inj) P.on = false; });
stage.addEventListener('pointerup', e => { if (e.pointerType === 'touch' && !isCam() && !P.inj) P.on = false; });

let hands = null, handBusy = false, camStream = null;
function setMaxHands(n) { maxHands = n; if (hands) { try { hands.setOptions({ maxNumHands: n }); } catch (e) {} } }
function coverRect(vw, vh) {
  const ar = W / H; let sw = vw, sh = vw / ar, sx = 0, sy = (vh - sh) / 2;
  if (sh > vh) { sh = vh; sw = vh * ar; sy = 0; sx = (vw - sw) / 2; }
  return { sx, sy, sw, sh };
}
function updTrack(t, d, tn, first) {
  if (first || !t.on || tn - t.seen > 600) { t.x = d.x; t.y = d.y; }
  else { const dist = Math.hypot(d.x - t.x, d.y - t.y), a = clamp(.2 + dist / 300, .2, .7); t.x += (d.x - t.x) * a; t.y += (d.y - t.y) * a; }
  t.on = true; t.seen = tn;
}
function onResults(r) {
  const L = r.multiHandLandmarks || [];
  if (!vid.videoWidth) return;
  const cr = coverRect(vid.videoWidth, vid.videoHeight), dets = [], tn = now();
  for (let i = 0; i < L.length && i < maxHands; i++) {
    const t = L[i][8];
    let ux = 1 - (t.x * vid.videoWidth - cr.sx) / cr.sw, uy = (t.y * vid.videoHeight - cr.sy) / cr.sh;
    ux = clamp((ux - .5) * 1.3 + .5, 0, 1); uy = clamp((uy - .5) * 1.3 + .5, 0, 1);
    dets.push({ x: ux * W, y: uy * H });
  }
  const pairs = [], dU = {}, tU = {};
  dets.forEach((d, di) => T.forEach((t, ti) => { if (t.on) pairs.push({ di, ti, d: Math.hypot(d.x - t.x, d.y - t.y) }); }));
  pairs.sort((a, b) => a.d - b.d);
  pairs.forEach(p => { if (dU[p.di] || tU[p.ti] || p.d > 380) return; dU[p.di] = tU[p.ti] = true; updTrack(T[p.ti], dets[p.di], tn); });
  dets.forEach((d, di) => { if (dU[di]) return; const ti = T.findIndex((t, i) => !tU[i] && !t.on); if (ti >= 0) { tU[ti] = true; updTrack(T[ti], d, tn, true); } });
}
async function startCamera() {
  const msg = $('#camMsg');
  if (typeof Hands === 'undefined') { msg.textContent = 'Pelacak tangan tidak ada di versi ini (hanya pratinjau). Pilih "Coba tanpa kamera", atau jalankan paket lengkap di komputermu.'; return false; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = 'Kamera tidak bisa dipakai di halaman ini. Buka lewat http://localhost atau https, atau pilih "Coba tanpa kamera".'; return false; }
  try {
    msg.textContent = 'Meminta izin kamera…';
    camStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
    vid.srcObject = camStream; await vid.play();
  } catch (e) { msg.textContent = 'Kamera belum bisa dipakai (' + (e.name || 'error') + '). Izinkan kamera di browser, atau pilih "Coba tanpa kamera".'; return false; }
  try {
    msg.textContent = 'Menyiapkan pelacak tangan… (beberapa detik)';
    hands = new Hands({ locateFile: f => 'lib/' + (/\.(tflite|binarypb|data)$/.test(f) ? f + '.wasm' : f) });
    hands.setOptions({ maxNumHands: maxHands, modelComplexity: 0, minDetectionConfidence: .6, minTrackingConfidence: .5 });
    hands.onResults(onResults);
    await hands.initialize();
  } catch (e) { msg.textContent = 'Pelacak tangan gagal dimulai. Coba muat ulang halaman atau pilih "Coba tanpa kamera".'; return false; }
  S.mode = 'cam'; P.on = false; msg.textContent = '';
  return true;
}
function handTick() {
  if (!hands || handBusy || vid.readyState < 2) return;
  handBusy = true;
  Promise.resolve(hands.send({ image: vid })).catch(() => {}).finally(() => { handBusy = false; });
}

/* ---------- layar & tombol tahan ---------- */
const scrs = {}; document.querySelectorAll('.scr').forEach(s => scrs[s.id] = s);
function show(id) { for (const k in scrs) scrs[k].classList.toggle('on', k === id); S.scr = id || ''; }
const hud = $('#hud'), hud2 = $('#hud2'), lost = $('#lost');
const visible = el => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
const dw = new Map(); let cooldown = 0;
function updateDwell(dt) {
  cooldown = Math.max(0, cooldown - dt);
  const rc = stage.getBoundingClientRect();
  const px = rc.left + P.x / W * rc.width, py = rc.top + P.y / H * rc.height;
  document.querySelectorAll('.hbtn').forEach(b => {
    let st = dw.get(b); if (!st) dw.set(b, st = { t: 0 });
    if (!visible(b)) { st.t = 0; b.style.setProperty('--p', 0); return; }
    const r = b.getBoundingClientRect(), pad = rc.width * .008;
    const inside = P.on && !paused && px >= r.left - pad && px <= r.right + pad && py >= r.top - pad && py <= r.bottom + pad;
    const ms = +(b.dataset.ms || (b.dataset.act === 'menu' ? 2400 : 1500));
    if (inside && cooldown <= 0) st.t += dt * 1000; else st.t = Math.max(0, st.t - dt * 2500);
    const p = clamp(st.t / ms, 0, 1); b.style.setProperty('--p', p.toFixed(3));
    if (p >= 1) { st.t = 0; fire(b.dataset.act); }
  });
}
stage.addEventListener('click', e => { const b = e.target.closest('.hbtn'); if (b) { const s = dw.get(b); if (s) s.t = 0; fire(b.dataset.act); } });
$('#bCam').onclick = async () => {
  $('#bCam').disabled = true;
  if (await startCamera()) afterStart(); else $('#bCam').disabled = false;
};
$('#bNoCam').onclick = () => { S.mode = 'pointer'; afterStart(); };
function afterStart() {
  $('#modeInfo').textContent = S.mode === 'cam' ? 'Mode: kamera (telunjuk jadi pengendali).' : 'Mode: tanpa kamera (mouse/sentuh sebagai cadangan).';
  const h = (location.hash || '').replace('#', '');
  const map = { 'labirin-dora': 'dora', 'labirin-aji': 'aji', 'susun-aksara': 'aksara' };
  if (map[h]) { S.hashGame = map[h]; openIntro(map[h]); } else if (h === 'latihan') openPick(); else toMenu();
}
function fire(act) {
  if (!act || cooldown > 0) return;
  cooldown = .9;
  if (act === 'game:latihan' || act === 'pick' || (act === 'begin' && G.introId === 'aksara')) { stopVoice(); location.href = 'nulis.html'; }
  else if (act.startsWith('game:')) { S.seq = false; openIntro(act.slice(5)); }
  else if (act.startsWith('letter:')) startWrite(+act.slice(7), 'latihan');
  else if (act === 'seq') { S.seq = true; openIntro('dora'); }
  else if (act === 'begin') startGame(G.introId);
  else if (act === 'menu') toMenu();
  else if (act === 'again') { if (G.lastId === 'latihan') startWrite(G.lastLetter || 0, 'latihan'); else startGame(G.lastId); }
  else if (act === 'next') {
    const order = ['dora', 'aji', 'aksara'], i = order.indexOf(G.lastId);
    if (G.lastId === 'latihan') startWrite(((G.lastLetter || 0) + 1) % 20, 'latihan');
    else if (S.seq && i >= 0 && i < 2) openIntro(order[i + 1]); else toMenu();
  }
  else if (act === 'lanjut') nextLetter();
  else if (act === 'listen') replayLetter();
  else if (act === 'learnnext') startBubInst();
  else if (act === 'bubgo') bubBegin();
}

/* ---------- alur ---------- */
let G = { id: null, run: 0 };
let PARTS = [];
function resetG() {
  stopVoice(); G.run++; const last = G.lastId, ll = G.lastLetter;
  G = { id: null, run: G.run, lastId: last, lastLetter: ll, introId: null };
  paused = false; lost.classList.remove('on'); hud.classList.remove('on'); hud2.classList.remove('on');
  $('#bLanjut').classList.remove('show'); $('#bListen').classList.remove('show');
  PARTS = []; setMaxHands(1);
}
function toMenu() { resetG(); show('sMenu'); }
const sleep = s => new Promise(res => setTimeout(res, s * 1000));
function after(ms, fn) { const run = G.run; setTimeout(() => { if (run === G.run) fn(); }, ms); }
const INTRO = {
  dora: { tag: 'GAME 1', title: 'Labirin Dora', mission: 'Misi: Temukan Sembada!', sub: 'Gerakkan telunjukmu, Dora akan mengikuti jalan.', art: 'cut_dora', who: 'Dora', voices: ['p10_1_dora'] },
  aji: { tag: 'GAME 2', title: 'Labirin Aji Saka', mission: 'Misi: Temukan Dora dan Sembada!', sub: 'Gerakkan telunjukmu, Aji Saka akan mengikuti jalan.', art: 'cut_aji', who: 'Aji Saka', voices: ['p16_1_aji'] },
  aksara: { tag: 'GAME 3', title: 'Ukir Aksara', mission: 'Misi: Ukir 20 aksara di batu!', sub: 'Sentuh bintang yang bersinar, urut dari angka 1.', art: 'cut_aji', who: 'Aji Saka', voices: ['p20_1_aji', 'p20_2_aji'] }
};
async function openIntro(id) {
  resetG(); G.introId = id; G.lastId = id; const I = INTRO[id], run = G.run;
  $('#inArt').src = 'img/' + I.art + '.png'; $('#inTag').textContent = I.tag; $('#inTitle').textContent = I.title;
  $('#inMission').textContent = I.mission; $('#inSub').textContent = I.sub;
  show('sIntro');
  for (const k of I.voices) { const ok = await say(k, I.who); if (!ok || run !== G.run) return; await sleep(.35); if (run !== G.run) return; }
}

/* ---------- labirin ---------- */
const MZ = { cols: 6, rows: 4, MX: 190, MY: 130, CW: 150, CH: 135 };
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function genMaze(seed, startC, endC, extra) {
  const { cols, rows } = MZ, rnd = mulberry(seed);
  const R = Array.from({ length: rows }, () => Array(cols).fill(false)), D = Array.from({ length: rows }, () => Array(cols).fill(false));
  const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
  const st = [[startC[0], startC[1]]]; seen[startC[1]][startC[0]] = true;
  while (st.length) {
    const [x, y] = st[st.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(d => [x + d[0], y + d[1], d]).filter(n => n[0] >= 0 && n[1] >= 0 && n[0] < cols && n[1] < rows && !seen[n[1]][n[0]]);
    if (!nb.length) { st.pop(); continue; }
    const [nx, ny, d] = nb[Math.floor(rnd() * nb.length)];
    if (d[0] === 1) R[y][x] = true; else if (d[0] === -1) R[y][nx] = true; else if (d[1] === 1) D[y][x] = true; else D[ny][x] = true;
    seen[ny][nx] = true; st.push([nx, ny]);
  }
  for (let k = 0; k < extra; k++) {
    const x = Math.floor(rnd() * cols), y = Math.floor(rnd() * rows);
    if (rnd() < .5) { if (x < cols - 1) R[y][x] = true; } else if (y < rows - 1) D[y][x] = true;
  }
  const m = { R, D, start: startC, end: endC };
  m.sol = solve(m); return m;
}
function nbrs(m, x, y) {
  const o = [];
  if (x < MZ.cols - 1 && m.R[y][x]) o.push([x + 1, y]); if (x > 0 && m.R[y][x - 1]) o.push([x - 1, y]);
  if (y < MZ.rows - 1 && m.D[y][x]) o.push([x, y + 1]); if (y > 0 && m.D[y - 1][x]) o.push([x, y - 1]);
  return o;
}
function solve(m) {
  const key = (x, y) => y * MZ.cols + x, prev = new Map(), q = [m.start]; prev.set(key(...m.start), null);
  while (q.length) {
    const c = q.shift(); if (c[0] === m.end[0] && c[1] === m.end[1]) break;
    for (const n of nbrs(m, c[0], c[1])) if (!prev.has(key(...n))) { prev.set(key(...n), c); q.push(n); }
  }
  const path = []; let c = m.end; while (c) { path.unshift(c); c = prev.get(key(...c)); } return path;
}
const cc = (x, y) => [MZ.MX + (x + .5) * MZ.CW, MZ.MY + (y + .5) * MZ.CH];
function mazeRects(m, hw) {
  const rs = [];
  for (let y = 0; y < MZ.rows; y++) for (let x = 0; x < MZ.cols; x++) {
    const [cx, cy] = cc(x, y); rs.push([cx - hw, cy - hw, cx + hw, cy + hw]);
    if (x < MZ.cols - 1 && m.R[y][x]) rs.push([cx, cy - hw, cx + MZ.CW, cy + hw]);
    if (y < MZ.rows - 1 && m.D[y][x]) rs.push([cx - hw, cy, cx + hw, cy + MZ.CH]);
  }
  return rs;
}
const inRects = (rs, x, y) => { for (const r of rs) if (x >= r[0] && x <= r[1 + 1] && y >= r[1] && y <= r[3]) return true; return false; };
function setupMaze(id) {
  const m = id === 'dora' ? genMaze(7, [0, 0], [5, 3], 3) : genMaze(21, [5, 3], [0, 0], 3);
  const hw = [36, 42, 50][S.assist];
  G.maze = m; G.hw = hw; G.drawRects = mazeRects(m, hw); G.colRects = mazeRects(m, hw - 14);
  const [sx, sy] = cc(...m.start), [ex, ey] = cc(...m.end);
  G.head = { x: sx, y: sy }; G.fin = { x: ex, y: ey }; G.trail = []; G.lastTrail = { x: sx, y: sy };
  G.state = 'ready'; G.hold = 0; G.idle = 0; G.t = 0;
  G.headImg = id === 'dora' ? 'cut_dora' : 'cut_aji'; G.finImg = id === 'dora' ? 'cut_sembada' : 'cut_duo';
}
function moveHead(dt) {
  const h = G.head, V = 360;
  const dist = Math.hypot(P.x - h.x, P.y - h.y); if (dist < 8) return false;
  const ux = (P.x - h.x) / dist, uy = (P.y - h.y) / dist; let rem = Math.min(dist - 4, V * dt), moved = false;
  while (rem > 0) {
    const s = Math.min(4, rem); rem -= s; const nx = h.x + ux * s, ny = h.y + uy * s;
    if (inRects(G.colRects, nx, ny)) { h.x = nx; h.y = ny; moved = true; }
    else if (Math.abs(ux) > .15 && inRects(G.colRects, nx, h.y)) { h.x = nx; moved = true; }
    else if (Math.abs(uy) > .15 && inRects(G.colRects, h.x, ny)) { h.y = ny; moved = true; }
    else break;
  }
  return moved;
}
function updateMaze(dt) {
  G.t += dt; const h = G.head;
  if (G.state === 'ready') {
    if (P.on && Math.hypot(P.x - h.x, P.y - h.y) < 90) G.hold += dt; else G.hold = Math.max(0, G.hold - dt * 2);
    if (G.hold >= .8) { G.state = 'play'; G.idle = 0; }
  } else if (G.state === 'play') {
    if (P.on && moveHead(dt)) G.idle = 0; else G.idle += dt;
    if (Math.hypot(h.x - G.lastTrail.x, h.y - G.lastTrail.y) > 26) { G.trail.push({ x: h.x, y: h.y }); if (G.trail.length > 70) G.trail.shift(); G.lastTrail = { x: h.x, y: h.y }; }
    if (Math.hypot(h.x - G.fin.x, h.y - G.fin.y) < 60) { G.state = 'done'; G.doneT = 0; }
  } else if (G.state === 'done') {
    G.doneT += dt;
    h.x = lerp(h.x, G.fin.x - 40, Math.min(1, dt * 3)); h.y = lerp(h.y, G.fin.y, Math.min(1, dt * 3));
    if (G.doneT > 2.2 && !G.finished) { G.finished = true; finishGame(G.id); }
  }
}
function drawSprite(name, cx, cy, hgt, bob) {
  const im = IM[name]; if (!im || !im.complete || !im.naturalWidth) return;
  const w = hgt * im.naturalWidth / im.naturalHeight;
  ctx.drawImage(im, cx - w / 2, cy - hgt * .62 + (bob || 0), w, hgt);
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function chip(text, x, y, bg) {
  ctx.font = '700 25px "Andika","Trebuchet MS",sans-serif'; const w = ctx.measureText(text).width + 44;
  rr(x - w / 2, y - 24, w, 48, 24); ctx.fillStyle = bg || 'rgba(27,39,48,.9)'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
}
function drawMaze() {
  const T = G.t || 0;
  rr(MZ.MX - 26, MZ.MY - 26, MZ.cols * MZ.CW + 52, MZ.rows * MZ.CH + 52, 30); ctx.fillStyle = 'rgba(30,45,56,.78)'; ctx.fill();
  ctx.fillStyle = '#F5D675'; for (const r of G.drawRects) ctx.fillRect(r[0] - 4, r[1] - 4, r[2] - r[0] + 8, r[3] - r[1] + 8);
  ctx.fillStyle = '#FAF7F0'; for (const r of G.drawRects) ctx.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
  // jejak bintang lembut
  ctx.fillStyle = 'rgba(245,214,117,.85)'; G.trail.forEach((p, i) => { ctx.beginPath(); ctx.arc(p.x, p.y, 4 + i / 70 * 3, 0, 7); ctx.fill(); });
  // tujuan
  const g = ctx.createRadialGradient(G.fin.x, G.fin.y, 6, G.fin.x, G.fin.y, 78); const br = .5 + Math.sin(T * 2.2) * .08;
  g.addColorStop(0, `rgba(245,214,117,${br})`); g.addColorStop(1, 'rgba(245,214,117,0)'); ctx.fillStyle = g; ctx.fillRect(G.fin.x - 80, G.fin.y - 80, 160, 160);
  drawSprite(G.finImg, G.fin.x, G.fin.y, G.finImg === 'cut_duo' ? 84 : 92, Math.sin(T * 2) * 2);
  // titik mulai
  const sc = cc(...G.maze.start);
  if (G.state === 'ready') {
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(54,93,133,.25)'; ctx.beginPath(); ctx.arc(G.head.x, G.head.y, 62, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#32715C'; ctx.beginPath(); ctx.arc(G.head.x, G.head.y, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(G.hold / .8, 0, 1)); ctx.stroke();
  }
  drawSprite(G.headImg, G.head.x, G.head.y, 96, Math.sin(T * 3) * 2);
  if (G.state === 'ready') chip(G.id === 'dora' ? 'Dekatkan jarimu ke Dora' : 'Dekatkan jarimu ke Aji Saka', W / 2, 78, 'rgba(50,113,92,.95)');
  else if (G.state === 'play' && G.idle > 10) chip('Gerakkan tanganmu pelan-pelan mengikuti jalan', W / 2, 78, 'rgba(54,93,133,.95)');
  else if (G.state === 'done') chip('Ketemu!', W / 2, 78, 'rgba(50,113,92,.95)');
}

/* ---------- huruf, bintang, cat ---------- */
const LET = [['ha', 'ꦲ', 'Ha'], ['na', 'ꦤ', 'Na'], ['ca', 'ꦕ', 'Ca'], ['ra', 'ꦫ', 'Ra'], ['ka', 'ꦏ', 'Ka'],
  ['da', 'ꦢ', 'Da'], ['ta', 'ꦠ', 'Ta'], ['sa', 'ꦱ', 'Sa'], ['wa', 'ꦮ', 'Wa'], ['la', 'ꦭ', 'La'],
  ['pa', 'ꦥ', 'Pa'], ['dha', 'ꦝ', 'Dha'], ['ja', 'ꦗ', 'Ja'], ['ya', 'ꦪ', 'Ya'], ['nya', 'ꦚ', 'Nya'],
  ['ma', 'ꦩ', 'Ma'], ['ga', 'ꦒ', 'Ga'], ['ba', 'ꦧ', 'Ba'], ['tha', 'ꦛ', 'Tha'], ['nga', 'ꦔ', 'Nga']];
const COLS = ['#A64F3C', '#365D85', '#32715C', '#7B5EA7', '#B8762E'];
const HC_LINES = [['Hana caraka', 'ada utusan'], ['Data sawala', 'saling bertengkar'], ['Padha jayanya', 'sama-sama sakti'], ['Maga bathanga', 'inilah jasad mereka']];
/* Urutan bintang (titik awal, belok, akhir goresan) dari editor guru. [x, y, nomor goresan], x & y relatif terhadap kotak huruf. */
const BAKED = {"ha":[[0.1224,0.8783,0],[0.0599,0.558,0],[0.0859,0.201,0],[0.2526,0.201,0],[0.2786,0.6403,0],[0.4036,0.8783,0],[0.5182,0.558,0],[0.6016,0.1156,0],[0.7283,0.201,0],[0.7283,0.558,0],[0.7283,0.8783,0],[0.8359,0.1156,1],[0.9366,0.201,1],[0.9366,0.558,1],[0.9366,0.8783,1]],"na":[[0.138,0.8825,0],[0.0755,0.5216,0],[0.1797,0.1304,0],[0.3307,0.5216,0],[0.3307,0.8825,0],[0.4141,0.5216,1],[0.5964,0.5216,1],[0.7266,0.7054,1],[0.6224,0.8825,1],[0.5391,0.7054,1],[0.5391,0.3306,1],[0.6641,0.1304,1],[0.862,0.1766,1],[0.9349,0.5216,1],[0.9349,0.8825,1]],"ra":[[0.1455,0.3264,0],[0.0762,0.0685,0],[0.3623,0.1544,0],[0.3623,0.4355,0],[0.2468,0.7133,0],[0.3623,0.829,0],[0.5506,0.829,0],[0.5773,0.5248,0],[0.6519,0.1544,0],[0.8598,0.1544,0],[0.9238,0.5248,0],[0.9238,0.829,0]],"ka":[[0.1198,0.8519,0],[0.0599,0.4595,0],[0.1198,0.1353,0],[0.263,0.4595,0],[0.263,0.8519,0],[0.4089,0.5448,1],[0.5859,0.724,1],[0.4401,0.8519,1],[0.4922,0.1353,1],[0.7474,0.276,1],[0.7474,0.8519,1],[0.862,0.1353,2],[0.9505,0.4595,2],[0.9505,0.8519,2]],"da":[[0.1432,0.8644,0],[0.0703,0.6267,0],[0.1068,0.1392,0],[0.388,0.1392,0],[0.2839,0.5053,0],[0.3203,0.8644,0],[0.5286,0.6267,0],[0.7214,0.6267,0],[0.6276,0.8644,0],[0.5755,0.2729,0],[0.8359,0.1392,0],[0.9245,0.6267,0],[0.9245,0.8644,0]],"ta":[[0.0833,0.7985,0],[0.0833,0.1603,0],[0.2578,0.2097,0],[0.2891,0.7985,0],[0.5703,0.7985,0],[0.4401,0.1603,0],[0.6849,0.1603,0],[0.737,0.4753,0],[0.737,0.8644,0],[0.8724,0.1603,1],[0.9453,0.4753,1],[0.9453,0.8644,1]],"sa":[[0.1354,0.8464,0],[0.0651,0.566,0],[0.1354,0.2013,0],[0.4036,0.2013,0],[0.4297,0.8464,0],[0.2786,0.7694,0],[0.4036,0.566,0],[0.6745,0.8464,0],[0.7161,0.2636,0],[0.9323,0.2013,0],[0.9323,0.8464,0]],"wa":[[0.1589,0.8761,0],[0.0755,0.5354,0],[0.1328,0.134,0],[0.3255,0.2723,0],[0.3932,0.8761,0],[0.6849,0.8086,0],[0.6849,0.3634,0],[0.5964,0.134,0],[0.8828,0.134,0],[0.9245,0.8761,0]],"la":[[0.1224,0.858,0],[0.0599,0.5,0],[0.1484,0.1243,0],[0.2734,0.3132,0],[0.2734,0.858,0],[0.388,0.1243,1],[0.487,0.5,1],[0.5286,0.858,1],[0.7057,0.858,1],[0.7839,0.1243,1],[0.9427,0.3132,1],[0.9427,0.858,1]],"dha":[[0.1276,0.8811,0],[0.0651,0.5871,0],[0.0964,0.1653,0],[0.2682,0.1653,0],[0.3099,0.8134,0],[0.4714,0.8134,0],[0.5026,0.5871,0],[0.6068,0.8811,0],[0.7161,0.5871,0],[0.7682,0.1653,0],[0.9375,0.2853,0],[0.9375,0.8811,0]],"nya":[[0.0911,0.8763,0],[0.0495,0.4631,0],[0.0911,0.1701,0],[0.2109,0.1701,0],[0.2474,0.8763,0],[0.4036,0.8763,0],[0.3464,0.4631,1],[0.3464,0.1701,1],[0.4505,0.1701,1],[0.5495,0.1701,1],[0.612,0.4631,1],[0.612,0.8763,1],[0.7422,0.1701,2],[0.7786,0.8763,2],[0.888,0.1701,3],[0.9505,0.5812,3],[0.9505,0.8763,3]],"ga":[[0.1449,0.6042,0],[0.0765,0.2966,0],[0.2554,0.1346,0],[0.3553,0.5298,0],[0.3553,0.872,0],[0.3869,0.2222,0],[0.5658,0.1346,0],[0.6394,0.5298,0],[0.6394,0.872,0],[0.7289,0.1346,0],[0.9235,0.2222,0],[0.9235,0.872,0]]};
const ORDER_KEY = 'dolanGerak.nulisAksara.urutan.v1';
let ORD = {}; try { const o = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null'); if (o && typeof o === 'object') ORD = o; } catch (e) {}
const getOrder = name => { const o = ORD[name] || BAKED[name]; return o && o.length >= 2 ? o : null; };
const layer = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
const maskCv = layer(), mctx = maskCv.getContext('2d', { willReadFrequently: true }), guideCv = layer(), gctx = guideCv.getContext('2d'),
  colCv = layer(), cctx = colCv.getContext('2d'), paintCv = layer(), pctx = paintCv.getContext('2d'), fillCv = layer(), fctx = fillCv.getContext('2d');
const FILLR = 27;
const GX = 640, GY = 338, SLOT = { x0: 950, y0: 108, s: 56, g: 6 };
const slotC = i => [SLOT.x0 + (i % 5) * (SLOT.s + SLOT.g) + SLOT.s / 2, SLOT.y0 + Math.floor(i / 5) * (SLOT.s + SLOT.g) + SLOT.s / 2];
const GFONT = px => `700 ${px}px AksaraJawa, JV, "Noto Sans Javanese", serif`;

function glyphText(g, cx, cy, maxW, maxH, color, outline) {
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = GFONT(100);
  let m = ctx.measureText(g); const bw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, bh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const k = Math.min(maxW / bw, maxH / bh); ctx.font = GFONT(100 * k); m = ctx.measureText(g);
  const x = cx - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, y = cy - (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
  if (outline) { ctx.lineJoin = 'round'; ctx.lineWidth = outline.w; ctx.strokeStyle = outline.c; ctx.strokeText(g, x, y); }
  ctx.fillStyle = color; ctx.fillText(g, x, y); ctx.restore();
}
function starPath(c, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const r2 = i % 2 ? r * .45 : r, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); } c.closePath(); }

/* ---- kerangka otomatis (untuk aksara yang urutannya belum diatur guru) ---- */
function thin(img, w, h) {
  let changed = true; const rm = [];
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      rm.length = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x; if (!img[i]) continue;
        const p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1], p5 = img[i + w + 1], p6 = img[i + w], p7 = img[i + w - 1], p8 = img[i - 1], p9 = img[i - w - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2); if (A !== 1) continue;
        if (step === 0) { if (p2 * p4 * p6 || p4 * p6 * p8) continue; } else if (p2 * p4 * p8 || p2 * p6 * p8) continue;
        rm.push(i);
      }
      if (rm.length) { changed = true; for (let k = 0; k < rm.length; k++) img[rm[k]] = 0; }
    }
  }
}
function skeletonPath(alpha) {
  const gw = W / 4, gh = H / 4, img = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) img[y * gw + x] = alpha[((y * 4 + 2) * W + (x * 4 + 2)) * 4 + 3] > 100 ? 1 : 0;
  thin(img, gw, gh);
  const OFF = [-gw - 1, -gw, -gw + 1, -1, 1, gw - 1, gw, gw + 1];
  const nbrs = i => { const r = []; for (let k = 0; k < 8; k++) { const j = i + OFF[k]; if (j >= 0 && j < img.length && img[j]) r.push(j); } return r; };
  const lab = new Int32Array(img.length).fill(-1), comps = [];
  for (let i0 = 0; i0 < img.length; i0++) {
    if (!img[i0] || lab[i0] >= 0) continue;
    const members = [i0]; lab[i0] = comps.length;
    for (let h = 0; h < members.length; h++) { const nb = nbrs(members[h]); for (let k = 0; k < nb.length; k++) if (lab[nb[k]] < 0) { lab[nb[k]] = comps.length; members.push(nb[k]); } }
    if (members.length < 6) continue;
    const ends = members.filter(i => nbrs(i).length === 1), pool = ends.length ? ends : members;
    let st = pool[0], bsc = 1e9;
    pool.forEach(i => { const sc = (i % gw) - .3 * Math.floor(i / gw); if (sc < bsc) { bsc = sc; st = i; } });
    comps.push({ start: st, n: members.length, x: st % gw, id: lab[i0] });
  }
  if (!comps.length) return [];
  let maxN = 0; comps.forEach(c => { if (c.n > maxN) maxN = c.n; });
  const smallId = {}; comps.forEach(c => { c.small = comps.length > 1 && c.n < .16 * maxN; if (c.small) smallId[c.id] = 1; });
  comps.sort((a, b) => (a.small ? 1 : 0) - (b.small ? 1 : 0) || a.x - b.x);
  let total = 0; comps.forEach(c => { total += c.n; });
  const start = comps[0].start, vis = new Uint8Array(img.length), seen = new Int32Array(img.length); let stamp = 0;
  const order = []; let cu = start, dx0 = 0, dy0 = 0, run = 0;
  vis[cu] = 1; order.push({ x: (cu % gw) * 4 + 2, y: Math.floor(cu / gw) * 4 + 2, run });
  let visited = 1; const par = new Int32Array(img.length);
  function bfsPath(from) {
    stamp++; const q = [from]; seen[from] = stamp; par[from] = -1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (!vis[i]) { const path = []; for (let n = i; n !== from; n = par[n]) path.push(n); return path.reverse(); }
      const nb = nbrs(i); for (let k = 0; k < nb.length; k++) if (seen[nb[k]] !== stamp) { seen[nb[k]] = stamp; par[nb[k]] = i; q.push(nb[k]); }
    }
    return null;
  }
  const pushPt = (i, extra) => { const o = { x: (i % gw) * 4 + 2, y: Math.floor(i / gw) * 4 + 2, run }; if (extra) for (const k in extra) o[k] = extra[k]; order.push(o); };
  while (visited < total) {
    const cands = nbrs(cu).filter(j => !vis[j]); let nxt = -1, brk = false;
    if (cands.length) {
      let best = -1e9; const cx = cu % gw, cy = Math.floor(cu / gw);
      for (let k = 0; k < cands.length; k++) { const j = cands[k], dx = (j % gw) - cx, dy = Math.floor(j / gw) - cy, len = Math.hypot(dx, dy), sc = .8 * (dx * dx0 + dy * dy0) / len + (len === 1 ? .2 : 0) + .35 * dx / len; if (sc > best) { best = sc; nxt = j; } }
      const nbN = {}; nbrs(nxt).forEach(j => { nbN[j] = 1; });
      cands.forEach(j => { if (j !== nxt && nbN[j]) { vis[j] = 1; visited++; } });
    } else {
      let le = -1, lsc = 1e9;
      for (let i = 0; i < img.length; i++) if (img[i] && !vis[i] && !smallId[lab[i]] && nbrs(i).length === 1) { const sc = (i % gw) - .3 * Math.floor(i / gw); if (sc < lsc) { lsc = sc; le = i; } }
      const path = (le >= 0 && (le % gw) < (cu % gw) - 10) ? null : bfsPath(cu);
      if (le >= 0 && !path) { nxt = le; brk = true; }
      else if (path) {
        order[order.length - 1].turn = true;
        for (let k = 0; k < path.length - 1; k++) pushPt(path[k], { back: true });
        const tgt = path[path.length - 1]; vis[tgt] = 1; visited++; cu = tgt; pushPt(cu, { turn: true }); dx0 = 0; dy0 = 0; continue;
      } else {
        nxt = -1; for (let c = 0; c < comps.length; c++) if (!vis[comps[c].start]) { nxt = comps[c].start; break; }
        if (nxt < 0) break; brk = true;
      }
    }
    const ddx = (nxt % gw) - (cu % gw), ddy = Math.floor(nxt / gw) - Math.floor(cu / gw), dl = Math.hypot(ddx, ddy) || 1;
    if (brk) { dx0 = 0; dy0 = 0; run++; } else { dx0 = .6 * dx0 + .4 * (ddx / dl); dy0 = .6 * dy0 + .4 * (ddy / dl); }
    if (!vis[nxt]) { vis[nxt] = 1; visited++; }
    cu = nxt; order.push({ x: (cu % gw) * 4 + 2, y: Math.floor(cu / gw) * 4 + 2, run });
  }
  return order;
}
function placeStars(op) {
  const runs = {}; op.forEach((p, i) => { (runs[p.run] = runs[p.run] || []).push(i); });
  const keep = []; let totalLen = 0;
  Object.keys(runs).forEach(r => {
    const ids = runs[r]; if (ids.length < 4) return;
    keep.push(ids); for (let k = 1; k < ids.length; k++) if (!op[ids[k]].back) totalLen += Math.hypot(op[ids[k]].x - op[ids[k - 1]].x, op[ids[k]].y - op[ids[k - 1]].y);
  });
  const spacing = Math.max(74, Math.min(140, totalLen / 11)), stars = [];
  keep.forEach((ids, ri) => {
    let acc = 0, lastOi = -1;
    const add = (oi, must) => { stars.push({ x: op[oi].x, y: op[oi].y, oi, run: ri, must: !!must }); acc = 0; lastOi = oi; };
    add(ids[0], true);
    for (let k = 1; k < ids.length; k++) {
      const o = op[ids[k]], pv = op[ids[k - 1]];
      if (!o.back) acc += Math.hypot(o.x - pv.x, o.y - pv.y);
      if (o.turn) { if (lastOi !== ids[k]) add(ids[k], true); } else if (!o.back && acc >= spacing) add(ids[k], false);
    }
    if (lastOi !== ids[ids.length - 1]) add(ids[ids.length - 1], true);
  });
  const out = [], pend = {};
  stars.forEach((s, n) => {
    const firstOfRun = n === 0 || stars[n - 1].run !== s.run, th = s.must ? 40 : 62;
    if (out.some(o => Math.hypot(s.x - o.x, s.y - o.y) < th)) { if (firstOfRun) pend[s.run] = s.oi; return; }
    if (pend[s.run] !== undefined) { s.from = pend[s.run]; delete pend[s.run]; }
    out.push(s);
  });
  return { stars: out, keep };
}
function planFromOrder(pts, box) {
  const op = [], stars = [], keep = []; let ri = -1, curRun = null, ids = null, prev = null;
  pts.forEach(p => {
    const x = box.x + p[0] * box.w, y = box.y + p[1] * box.h, r = p[2] | 0;
    if (r !== curRun) { curRun = r; ri++; ids = []; keep.push(ids); prev = null; }
    if (prev) { const d = Math.hypot(x - prev.x, y - prev.y), n = Math.max(1, Math.ceil(d / 4)); for (let k = 1; k < n; k++) { ids.push(op.length); op.push({ x: prev.x + (x - prev.x) * k / n, y: prev.y + (y - prev.y) * k / n, run: ri }); } }
    ids.push(op.length); op.push({ x, y, run: ri }); stars.push({ x, y, oi: op.length - 1, run: ri, must: true }); prev = { x, y };
  });
  return { op, stars, keep: keep.filter(k => k.length > 1) };
}
function buildLetter(i) {
  const g = LET[i][1]; G.color = COLS[i % 5];
  const base = 400;
  mctx.clearRect(0, 0, W, H); mctx.textAlign = 'left'; mctx.textBaseline = 'alphabetic'; mctx.font = GFONT(base);
  let m = mctx.measureText(g);
  const bw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, bh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  const k = Math.min(H * .58 / bh, W * .4 / bw), px = base * k, gx = G.id === 'aksara' ? 620 : GX;
  mctx.font = GFONT(px); m = mctx.measureText(g);
  const x = gx - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, y = GY - (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;
  G.box = { x: x - m.actualBoundingBoxLeft, y: y - m.actualBoundingBoxAscent, w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent };
  mctx.fillStyle = '#000'; mctx.fillText(g, x, y);
  const alpha = mctx.getImageData(0, 0, W, H).data;
  gctx.clearRect(0, 0, W, H); gctx.font = GFONT(px); gctx.textAlign = 'left'; gctx.textBaseline = 'alphabetic'; gctx.lineJoin = 'round';
  gctx.fillStyle = 'rgba(38,55,67,.16)'; gctx.fillText(g, x, y); gctx.strokeStyle = 'rgba(38,55,67,.42)'; gctx.lineWidth = 5; gctx.strokeText(g, x, y);
  cctx.clearRect(0, 0, W, H); cctx.font = GFONT(px); cctx.textAlign = 'left'; cctx.textBaseline = 'alphabetic'; cctx.lineJoin = 'round';
  cctx.fillStyle = G.color; cctx.fillText(g, x, y); cctx.strokeStyle = '#263743'; cctx.lineWidth = 3; cctx.strokeText(g, x, y);
  pctx.clearRect(0, 0, W, H); fctx.clearRect(0, 0, W, H);
  const cu = getOrder(LET[i][0]); G.baked = !!cu; let pl;
  if (cu) { const pp = planFromOrder(cu, G.box); G.op = pp.op; pl = { stars: pp.stars, keep: pp.keep }; }
  else { G.op = skeletonPath(alpha); pl = placeStars(G.op); }
  G.stars = pl.stars; G.got = 0; G.pq = []; G.pops = []; G.fillDirty = false; G.lp = null; G.hintUntil = 0; G.lastGain = G.t || 0; G.done = false; G.fullAt = 0;
  gctx.save(); gctx.strokeStyle = 'rgba(166,79,60,.8)'; gctx.lineWidth = 5; gctx.lineCap = 'round'; gctx.setLineDash([14, 12]);
  pl.keep.forEach(ids => { gctx.beginPath(); ids.forEach((oi, n) => { if (n) gctx.lineTo(G.op[oi].x, G.op[oi].y); else gctx.moveTo(G.op[oi].x, G.op[oi].y); }); gctx.stroke(); });
  gctx.restore();
}
function paintRange(from, to, withDot) {
  pctx.strokeStyle = pctx.fillStyle = G.color; pctx.lineWidth = FILLR * 2; pctx.lineCap = pctx.lineJoin = 'round';
  pctx.beginPath(); for (let i = from; i <= to; i++) { if (i === from) pctx.moveTo(G.op[i].x, G.op[i].y); else pctx.lineTo(G.op[i].x, G.op[i].y); } pctx.stroke();
  if (withDot) { pctx.beginPath(); pctx.arc(G.op[to].x, G.op[to].y, FILLR, 0, TAU); pctx.fill(); }
  G.fillDirty = true;
}
function queueSeg(k) {
  const s = G.stars[k], p = G.stars[k - 1];
  const from = s.from !== undefined ? s.from : (p && p.run === s.run ? p.oi : s.oi);
  G.pq.push({ pos: from, to: s.oi }); paintRange(from, from, true);
}
function advancePaint() {
  for (let n = G.pq.length - 1; n >= 0; n--) {
    const j = G.pq[n], nx = Math.min(j.to, j.pos + 5);
    if (nx > j.pos) { paintRange(j.pos, nx, true); j.pos = nx; }
    if (j.pos >= j.to) G.pq.splice(n, 1);
  }
}
function flushPaint() { G.pq.forEach(j => paintRange(j.pos, j.to, true)); G.pq = []; }
function updateFill() {
  fctx.globalCompositeOperation = 'source-over'; fctx.clearRect(0, 0, W, H); fctx.drawImage(paintCv, 0, 0);
  fctx.globalCompositeOperation = 'destination-in'; fctx.drawImage(maskCv, 0, 0); fctx.globalCompositeOperation = 'source-over'; G.fillDirty = false;
}
function sparkle(x, y, n, cols) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 40 + Math.random() * 110; PARTS.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 160, c: cols[i % cols.length], s: 9 + Math.random() * 8, rot: 0, vr: 4, shape: 'star', life: 1, d: .9 }); }
}
function confetti(n, mode) {
  const cols = ['#F5D675', '#EDB5A3', '#C7B4DF', '#9CD3E1', '#32715C', '#FAF7F0'], shapes = ['rect', 'star', 'circle'];
  for (let i = 0; i < n; i++) {
    const burst = mode === 'burst', side = i % 2 ? W : 0;
    PARTS.push({ x: burst ? side : Math.random() * W, y: burst ? H * .9 : -20 - Math.random() * 200, vx: burst ? (side ? -1 : 1) * (150 + Math.random() * 250) : (Math.random() - .5) * 60, vy: burst ? -(380 + Math.random() * 300) : 70 + Math.random() * 90,
      g: burst ? 600 : 20, c: cols[Math.floor(Math.random() * cols.length)], s: 12 + Math.random() * 12, rot: Math.random() * TAU, vr: (Math.random() - .5) * 5, shape: shapes[Math.floor(Math.random() * 3)], life: 1, d: burst ? .16 : .1 });
  }
}
function drawParts(dt) {
  for (const p of PARTS) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.rot += p.vr * dt; p.life -= p.d * dt; }
  PARTS = PARTS.filter(p => p.life > 0 && p.y < H + 40);
  for (const p of PARTS) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.c;
    if (p.shape === 'rect') ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    else if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.2, 0, TAU); ctx.fill(); }
    else { starPath(ctx, p.s / 1.6); ctx.fill(); }
    ctx.restore();
  }
}
function takeStar(k) {
  const s = G.stars[k]; queueSeg(k); G.got++; G.pops.push({ x: s.x, y: s.y, t: G.t });
  sparkle(s.x, s.y, 8, ['#F5D675', '#FAF7F0', '#EDB5A3']);
}
function collectAt(x, y) {
  const R = [44, 56, 70][S.assist];
  for (let look = 0; look < 2 && G.got + look < G.stars.length; look++) {
    const s = G.stars[G.got + look];
    if (Math.hypot(x - s.x, y - s.y) < R) { const tgt = G.got + look; while (G.got <= tgt) takeStar(G.got); G.lastGain = G.t; G.hintUntil = 0; break; }
  }
}
function setWord(text) { G.word = text ? { t: text, t0: G.t } : null; }

/* ---------- menulis (dipakai Ukir Aksara & Latihan) ---------- */
async function beginLetter(i) {
  const run = G.run; G.idx = i; G.lastLetter = i; G.state = 'load';
  try { await document.fonts.load('700 120px AksaraJawa', LET[i][1]); } catch (e) {}
  if (run !== G.run) return;
  buildLetter(i); G.state = 'trace'; G.lastHint = -99;
  $('#bLanjut').classList.remove('show'); $('#bListen').classList.remove('show');
}
function updateWrite(dt) {
  G.t += dt;
  if (G.state === 'trace') {
    if (P.on) {
      const lp = G.lp;
      if (lp) { const d = Math.hypot(P.x - lp.x, P.y - lp.y), n = Math.max(1, Math.ceil(d / 18)); for (let k = 1; k <= n; k++) collectAt(lerp(lp.x, P.x, k / n), lerp(lp.y, P.y, k / n)); }
      else collectAt(P.x, P.y);
      G.lp = { x: P.x, y: P.y };
    } else G.lp = null;
    advancePaint();
    if (G.stars.length && G.got >= G.stars.length) { G.state = 'fill'; G.tt = 0; G.done = true; flushPaint(); updateFill(); G.fullAt = G.t; confetti(22, 'burst'); }
    else {
      if (G.t - G.lastGain > 7 && G.hintUntil < G.t) G.hintUntil = G.t + 4;
      if (G.t - G.lastGain > 10 && G.t - G.lastHint > 25) { G.lastHint = G.t; say('ikuti_garis', 'Aji Saka'); }
    }
  } else if (G.state === 'fill') {
    G.tt += dt; advancePaint(); if (G.tt >= 1) { G.state = 'say'; onWritten(); }
  } else if (G.state === 'fly') {
    G.tt += dt; if (G.tt >= 1.1) { G.slots[G.idx] = true; G.state = 'flown'; G.tt = 0; }
  }
  if (G.fillDirty) updateFill();
  if (G.bub) updateBub(dt);
  if (G.quiz) updateQuiz(dt);
}
function onWritten() { if (G.id === 'aksara') engraveFlow(G.idx); else practiceFlow(); }
function drawStars() {
  for (let k = G.got; k < G.stars.length; k++) {
    const s = G.stars[k], next = k === G.got, hint = next && G.t < G.hintUntil;
    const pul = next ? 1 + .1 * Math.sin(G.t * 4) : 1, r = (next ? 26 : 19) * pul * (hint ? 1.3 : 1);
    if (next) { ctx.beginPath(); ctx.arc(s.x, s.y, r + 14 + 3 * Math.sin(G.t * 4), 0, TAU); ctx.fillStyle = 'rgba(245,214,117,.5)'; ctx.fill(); }
    ctx.save(); ctx.translate(s.x, s.y + Math.sin(G.t * 2.4 + k) * 2); starPath(ctx, r);
    ctx.fillStyle = '#F5D675'; ctx.fill(); ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = '#A64F3C'; ctx.stroke();
    ctx.fillStyle = '#263743'; ctx.font = `800 ${next ? 25 : 20}px "Baloo 2","Trebuchet MS",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(k + 1), 0, next ? 3 : 2); ctx.restore();
  }
}
function drawPops() {
  for (let i = G.pops.length - 1; i >= 0; i--) {
    const p = G.pops[i], t = (G.t - p.t) / .45;
    if (t >= 1) { G.pops.splice(i, 1); continue; }
    const e = 1 - Math.pow(1 - t, 3);
    ctx.save(); ctx.translate(p.x, p.y - 30 * e); ctx.globalAlpha = 1 - t; ctx.scale(1 + .9 * e, 1 + .9 * e); starPath(ctx, 20);
    ctx.fillStyle = '#F5D675'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#FAF7F0'; ctx.stroke(); ctx.restore();
  }
}
function drawWrite() {
  const st = G.state; if (!G.box || st === 'load') return;
  const showCard = ['trace', 'fill', 'say', 'fly', 'flown', 'row', 'wait', 'end'].includes(st);
  if (showCard) {
    const b = G.box; rr(b.x - 46, b.y - 46, b.w + 92, b.h + 92, 34); ctx.fillStyle = 'rgba(250,247,240,.94)'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#F5D675'; ctx.stroke();
  }
  if (['trace', 'fill', 'say'].includes(st) || (st === 'fly' && G.tt < .01)) {
    ctx.drawImage(guideCv, 0, 0); ctx.drawImage(fillCv, 0, 0);
    if (G.done) { ctx.globalAlpha = clamp((G.t - G.fullAt) / .5, 0, 1); ctx.drawImage(colCv, 0, 0); ctx.globalAlpha = 1; }
    if (!G.done) drawStars();
    drawPops();
  } else if (st === 'fly') {
    const b = G.box, e = ease(clamp(G.tt / 1.1, 0, 1)), [sx, sy] = slotC(G.idx), sc = lerp(1, 40 / Math.max(b.w, b.h), e), pad = 10;
    ctx.save(); ctx.translate(lerp(b.x + b.w / 2, sx, e), lerp(b.y + b.h / 2, sy, e)); ctx.scale(sc, sc);
    ctx.drawImage(colCv, b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad, -(b.w / 2 + pad), -(b.h / 2 + pad), b.w + 2 * pad, b.h + 2 * pad); ctx.restore();
  }
  if (st === 'say' || st === 'fly') { ctx.fillStyle = '#365D85'; ctx.font = '800 46px "Baloo 2","Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(LET[G.idx][2], G.box.x + G.box.w / 2, G.box.y + G.box.h + 74); }
  if (st === 'trace') {
    if (G.id === 'aksara') chip(`Aksara ${G.idx + 1} dari 20`, W / 2 - 40, 38, 'rgba(54,93,133,.95)');
    else chip(`Aksara ${LET[G.idx][2]}`, W / 2 - 40, 38, 'rgba(54,93,133,.95)');
    if (G.t < G.hintUntil) chip('Sentuh bintang yang bersinar', W / 2, 96, 'rgba(50,113,92,.95)');
    else if (G.got === 0 && G.t < 12 && G.id === 'latihan') chip('Sentuh bintang 1, lalu 2, 3, …', W / 2, 96, 'rgba(50,113,92,.95)');
  }
  if (G.id === 'aksara') drawSlots();
}
function drawSlots() {
  rr(SLOT.x0 - 12, SLOT.y0 - 12, 5 * (SLOT.s + SLOT.g) + 6, 4 * (SLOT.s + SLOT.g) + 6, 20); ctx.fillStyle = 'rgba(30,45,56,.55)'; ctx.fill();
  for (let i = 0; i < 20; i++) {
    const [cx, cy] = slotC(i); let sc = 1;
    if (G.hl && Math.floor(i / 5) === G.hl.row) { const k = Math.floor(clamp((G.t - G.hl.t0) / G.hl.dur * 5, 0, 4.99)); if (i % 5 === k) sc = 1.18; }
    rr(cx - SLOT.s / 2 * sc, cy - SLOT.s / 2 * sc, SLOT.s * sc, SLOT.s * sc, 12);
    const filled = G.slots[i]; ctx.fillStyle = filled ? '#FAF7F0' : 'rgba(250,247,240,.28)'; ctx.fill();
    ctx.lineWidth = sc > 1 ? 5 : 2; ctx.strokeStyle = sc > 1 ? '#F5D675' : filled ? '#F5D675' : 'rgba(250,247,240,.55)'; ctx.stroke();
    if (filled) glyphText(LET[i][1], cx, cy, 38 * sc, 38 * sc, COLS[i % 5], { w: 2, c: '#263743' });
    else { ctx.fillStyle = 'rgba(250,247,240,.7)'; ctx.font = '700 17px "Andika",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i + 1, cx, cy + 1); }
  }
}

/* ---------- Ukir Aksara (alur cerita) ---------- */
async function startGame(id) {
  if (!id) return;
  if (id === 'latihan') return openPick();
  resetG(); G.lastId = id; G.id = id; show(null); hud.classList.add('on');
  if (id === 'aksara') {
    let d = loadDone(); if (d >= 20) { d = 0; saveDone(0); }
    G.slots = Array(20).fill(false); for (let i = 0; i < d; i++) G.slots[i] = true; G.hl = null; G.t = 0; G.state = 'load';
    hud2.classList.add('on');
    if (d === 0) say('start', 'Aji Saka');
    await beginLetter(d);
  } else setupMaze(id);
}
async function engraveFlow(i) {
  const run = G.run, L = LET[i];
  let ok = await say('huruf_' + L[0], 'Aji Saka'); if (!ok || run !== G.run) return;
  G.state = 'fly'; G.tt = 0;
  while (G.state !== 'flown') { await sleep(.1); if (run !== G.run) return; }
  saveDone(i + 1);
  if (i % 5 === 4) {
    const n = (i + 1) / 5; G.state = 'row';
    ok = await say('baris' + n + '_selesai', 'Aji Saka'); if (!ok || run !== G.run) return;
    if (n === 4) { ok = await say('baris4_ajak', 'Aji Saka'); if (!ok || run !== G.run) return; }
    G.hl = { row: n - 1, t0: G.t, dur: VL['baris' + n + '_baca'].dur };
    ok = await say('baris' + n + '_baca', 'Aji Saka'); G.hl = null; if (!ok || run !== G.run) return;
  }
  if (i === 19) {
    G.state = 'end'; confetti(70, 'rain'); after(2500, () => confetti(50, 'rain')); after(5000, () => confetti(40, 'rain'));
    ok = await say('selesai', 'Aji Saka'); if (!ok || run !== G.run) return;
    await sleep(.8); if (run !== G.run) return; finishGame('aksara'); return;
  }
  G.state = 'wait'; $('#bLanjut').classList.add('show'); $('#bListen').classList.add('show');
}
function nextLetter() {
  if (G.id !== 'aksara' || G.state !== 'wait') return;
  beginLetter(G.idx + 1);
}
function replayLetter() {
  if (G.id !== 'aksara' || G.state !== 'wait') return;
  say('huruf_' + LET[G.idx][0], 'Aji Saka');
}

/* ---------- Latihan Aksara ---------- */
function openPick() {
  resetG(); G.lastId = 'latihan'; show('sPick');
  const grid = $('#pickGrid'), done = loadLat(); grid.innerHTML = '';
  LET.forEach((l, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'hbtn'; b.dataset.act = 'letter:' + i; b.style.setProperty('--c', COLS[i % 5]);
    b.innerHTML = `<span class="g">${l[1]}</span><span class="n">${l[2]}</span>${done.includes(i) ? '<span class="ok">★</span>' : ''}`;
    grid.appendChild(b);
  });
}
function startWrite(i, id) {
  resetG(); G.lastId = id; G.id = id; G.lastLetter = i; show(null); hud.classList.add('on'); G.t = 0;
  beginLetter(i);
}
async function practiceFlow() {
  const run = G.run; G.mode = 'letter';
  let ok = await say('huruf_' + LET[G.idx][0], 'Aji Saka'); if (!ok || run !== G.run) return;
  startLearn();
}
function startLearn() {
  const i = G.idx, row = Math.floor(i / 5), pos = i % 5, name = LET[i][2], run = G.run;
  G.state = 'learn'; show('sLearn'); hud.classList.add('on');
  $('#sLearn').style.setProperty('--c', COLS[i % 5]);
  $('#lrnG').textContent = LET[i][1]; $('#lrnN').textContent = name.toLowerCase();
  const box = $('#pills'); box.innerHTML = '';
  for (let k = 0; k < 5; k++) {
    const L = LET[row * 5 + k], d = document.createElement('div'); d.className = 'pill' + (k === pos ? ' me' : '');
    d.innerHTML = `<span class="g">${L[1]}</span><span class="r">${L[2]}</span>`; box.appendChild(d);
    after(450 + k * 520, () => d.classList.add('on'));
  }
  $('#lrnLine').textContent = HC_LINES[row][0]; $('#lrnMean').textContent = 'Artinya: ' + HC_LINES[row][1];
  $('#lrnPos').textContent = `Aksara ${name} ada di baris ke-${row + 1} Hanacaraka, urutan ke-${pos + 1}.`;
  after(20000, () => { if (G.state === 'learn') startBubInst(); });
}
function startBubInst() {
  if (G.id !== 'latihan' || G.state !== 'learn') return;
  G.state = 'binst'; show('sBub'); setMaxHands(2);
  $('#bubG').textContent = LET[G.idx][1]; $('#bubN').textContent = '“' + LET[G.idx][0] + '”';
  after(12000, () => { if (G.state === 'binst') bubBegin(); });
}
const BUB = { goal: 10, secs: 45 };
function bubBegin() {
  if (G.state !== 'binst') return;
  show(null); G.state = 'bready'; G.bub = { items: [], got: 0, left: BUB.secs, spawnAt: 0, over: false }; setWord('SIAP');
  after(900, () => setWord('SEDIA')); after(1800, () => setWord('AYO!'));
  after(2600, () => { setWord(''); G.state = 'bplay'; for (let k = 0; k < 3; k++) { bubSpawn(); G.bub.items[G.bub.items.length - 1].y = H * (.3 + .22 * k); } });
}
function bubSpawn() {
  const b = G.bub;
  b.items.push({ x: 120 + Math.random() * (W - 300), y: H + 80, r: 78, vy: 78 + Math.random() * 48, vx: (Math.random() - .5) * 30, ph: Math.random() * TAU, dying: false, pop: 0 });
}
function updateBub(dt) {
  const b = G.bub; if (!b) return;
  if (G.state === 'bplay') {
    b.left -= dt;
    if (G.t >= b.spawnAt && b.items.filter(it => !it.dying).length < 8) { bubSpawn(); b.spawnAt = G.t + .45 + Math.random() * .35; }
    const ts = tracks();
    b.items.forEach(it => { if (it.dying || b.got >= BUB.goal) return; if (ts.some(t => Math.hypot(t.x - it.x, t.y - it.y) <= it.r + 40)) { it.dying = true; it.pop = 1; b.got++; sparkle(it.x, it.y, 12, ['#F5D675', '#FAF7F0', '#EDB5A3']); } });
    if (b.got >= BUB.goal) bubFinish('YEAY!'); else if (b.left <= 0) { b.left = 0; bubFinish('SELESAI!'); }
  }
  b.items.forEach(it => { if (it.dying) { it.pop -= 4 * dt; return; } it.y -= it.vy * dt; it.x += (it.vx + Math.sin(G.t * 1.4 + it.ph) * 20) * dt; });
  b.items = b.items.filter(it => !(it.dying && it.pop <= 0) && it.y > -110);
}
function bubFinish(word) {
  const b = G.bub; if (!b || G.state !== 'bplay') return;
  G.state = 'bfinish'; setMaxHands(1);
  b.items.forEach(it => { if (!it.dying) { it.dying = true; it.pop = 1; sparkle(it.x, it.y, 6, ['#F5D675', '#FAF7F0']); } });
  setWord(word); confetti(30, 'burst');
  after(3000, () => { setWord('HEBAT!'); G.state = 'good'; confetti(40, 'rain'); after(2500, () => confetti(40, 'rain')); after(6500, startQuiz); });
}
function drawBub() {
  const b = G.bub; if (!b) return;
  b.items.forEach(it => {
    if (it.dying) { const t = 1 - it.pop; ctx.save(); ctx.globalAlpha = Math.max(0, it.pop); ctx.beginPath(); ctx.arc(it.x, it.y, it.r * (1 + t * .9), 0, TAU); ctx.lineWidth = 9 * it.pop + 1; ctx.strokeStyle = '#FAF7F0'; ctx.stroke(); ctx.restore(); return; }
    ctx.save(); ctx.translate(it.x, it.y);
    const g = ctx.createRadialGradient(-it.r * .3, -it.r * .35, it.r * .1, 0, 0, it.r);
    g.addColorStop(0, 'rgba(250,247,240,.96)'); g.addColorStop(.7, 'rgba(199,180,223,.78)'); g.addColorStop(1, 'rgba(156,211,225,.72)');
    ctx.beginPath(); ctx.arc(0, 0, it.r, 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(250,247,240,.95)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(-it.r * .42, -it.r * .42, it.r * .2, Math.PI * 1.05, Math.PI * 1.6); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke(); ctx.restore();
    glyphText(LET[G.idx][1], it.x, it.y, it.r * 1.3, it.r * 1.2, COLS[G.idx % 5]);
  });
  if (G.state === 'bplay' || G.state === 'bfinish') {
    const f = clamp(b.left / BUB.secs, 0, 1);
    chip(`Gelembung ${b.got}/${BUB.goal}`, W / 2 - 40, 38, 'rgba(54,93,133,.95)');
    rr(W / 2 - 200, 84, 320, 14, 7); ctx.fillStyle = 'rgba(250,247,240,.45)'; ctx.fill();
    rr(W / 2 - 200, 84, Math.max(14, 320 * f), 14, 7); ctx.fillStyle = f > .5 ? '#32715C' : f > .25 ? '#B8762E' : '#A64F3C'; ctx.fill();
  }
}
/* kuis: 3 pertanyaan, tahan jari di kartu untuk memilih */
const QUIZ_CARDS = [0, 1, 2].map(k => ({ x: 100 + k * 370, y: 250, w: 310, h: 300 })), QUIZ_PRESS = 1600;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
function startQuiz() {
  if (G.id !== 'latihan') return;
  G.bub = null; setWord(''); show(null); G.state = 'quiz';
  const pool = []; for (let k = 0; k < 20; k++) if (k !== G.idx) pool.push(k); shuffle(pool);
  G.quiz = { q: 0, targets: [G.idx, pool[0], pool[1]], cards: [], dw: [0, 0, 0], fb: [0, 0, 0], lock: 0, hold: [false, false, false], wrong: 0, busy: false }; quizSet();
}
function quizSet() {
  const z = G.quiz, t = z.targets[z.q], o = []; for (let k = 0; k < 20; k++) if (k !== t) o.push(k); shuffle(o);
  z.cards = shuffle([t, o[0], o[1]]); z.dw = [0, 0, 0]; z.fb = [0, 0, 0]; z.wrong = 0; z.hold = [false, false, false]; z.lock = G.t + 2; z.busy = false;
}
function quizPick(k) {
  const z = G.quiz; if (!z || G.t < z.lock || z.busy) return;
  const c = QUIZ_CARDS[k];
  if (z.cards[k] === z.targets[z.q]) {
    z.busy = true; z.lock = G.t + 5; z.fb[k] = 1; sparkle(c.x + c.w / 2, c.y + c.h / 2, 16, ['#F5D675', '#FAF7F0', '#32715C']); confetti(30, 'burst');
    setWord(z.q + 1 >= z.targets.length ? 'HEBAT SEKALI!' : 'BETUL!');
    after(3600, () => { setWord(''); z.q++; if (z.q >= z.targets.length) { G.quiz = null; finishGame('latihan'); } else quizSet(); });
  } else { z.fb[k] = -1; z.dw[k] = 0; z.hold[k] = true; z.lock = G.t + 1.8; z.wrong++; setWord('COBA LAGI YA'); after(1700, () => { if (G.quiz === z && !z.busy) setWord(''); }); }
}
function updateQuiz(dt) {
  const z = G.quiz; if (!z) return; const ts = tracks();
  QUIZ_CARDS.forEach((c, k) => {
    const inside = ts.some(t => t.x > c.x && t.x < c.x + c.w && t.y > c.y && t.y < c.y + c.h);
    if (!inside) z.hold[k] = false;
    const live = G.t >= z.lock && !z.hold[k] && !z.busy;
    z.dw[k] = inside && live ? z.dw[k] + dt * 1000 : Math.max(0, z.dw[k] - dt * 2000);
    if (z.dw[k] >= QUIZ_PRESS) { z.dw[k] = 0; quizPick(k); }
    if (z.fb[k] < 0) z.fb[k] *= .97; if (z.fb[k] > -.02 && z.fb[k] < 0) z.fb[k] = 0;
  });
}
function drawQuiz() {
  const z = G.quiz; if (!z) return; const t = z.targets[z.q];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 56px "Baloo 2","Trebuchet MS",sans-serif'; ctx.lineJoin = 'round';
  const txt = `Sentuh aksara ${LET[t][0]}`; ctx.lineWidth = 12; ctx.strokeStyle = '#263743'; ctx.strokeText(txt, W / 2, 130); ctx.fillStyle = '#F5D675'; ctx.fillText(txt, W / 2, 130);
  chip(`${z.q + 1} / ${z.targets.length}`, W / 2, 195, 'rgba(54,93,133,.95)');
  QUIZ_CARDS.forEach((c, k) => {
    const fb = z.fb[k], inside = tracks().some(tr => tr.x > c.x && tr.x < c.x + c.w && tr.y > c.y && tr.y < c.y + c.h);
    const sx = fb < 0 ? Math.sin(G.t * 25) * 10 * -fb : 0, pr = Math.min(1, z.dw[k] / QUIZ_PRESS), sc = 1 - .07 * pr;
    ctx.save(); ctx.translate(c.x + c.w / 2 + sx, c.y + c.h / 2 + (inside ? -8 : 0) + 10 * pr); ctx.scale(sc, sc); ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
    rr(c.x, c.y, c.w, c.h, 40); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8; ctx.fillStyle = fb > 0 ? '#E3F1EA' : '#FAF7F0'; ctx.fill(); ctx.shadowColor = 'transparent';
    const hint = z.wrong >= 2 && z.cards[k] === t && fb === 0;
    ctx.lineWidth = hint ? 9 + 6 * Math.abs(Math.sin(G.t * 4)) : 9; ctx.strokeStyle = fb > 0 ? '#32715C' : fb < 0 ? '#A64F3C' : hint ? '#32715C' : inside ? '#F5D675' : '#C7B4DF'; ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(c.x + c.w / 2 + sx, c.y + c.h / 2 + (inside ? -8 : 0) + 10 * pr); ctx.scale(sc, sc); ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
    glyphText(LET[z.cards[k]][1], c.x + c.w / 2, c.y + c.h / 2 - 10, c.w - 80, c.h - 100, COLS[z.cards[k] % 5]);
    if (z.dw[k] > 0) { rr(c.x + 40, c.y + c.h - 26, c.w - 80, 12, 6); ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fill(); rr(c.x + 40, c.y + c.h - 26, Math.max(12, (c.w - 80) * z.dw[k] / QUIZ_PRESS), 12, 6); ctx.fillStyle = '#32715C'; ctx.fill(); }
    ctx.restore();
  });
}
function drawWord() {
  const w = G.word; if (!w) return; const t = clamp((G.t - w.t0) / .6, 0, 1), sc = t < .6 ? .3 + (1.15 - .3) * (t / .6) : 1.15 - .15 * ((t - .6) / .4);
  ctx.save(); ctx.translate(W / 2, G.state === 'quiz' ? 640 : 330); ctx.scale(sc, sc); ctx.globalAlpha = Math.min(1, t * 2);
  ctx.font = '800 120px "Baloo 2","Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 18; ctx.strokeStyle = '#365D85'; ctx.strokeText(w.t, 0, 0); ctx.fillStyle = '#F5D675'; ctx.fillText(w.t, 0, 0); ctx.restore();
}

/* ---------- selesai ---------- */
const WIN = {
  dora: ['Sembada ketemu!', 'Hebat! Dora dan Sembada bertemu lagi.'],
  aji: ['Dora dan Sembada ketemu!', 'Terima kasih sudah membantu Aji Saka.'],
  aksara: ['20 aksara selesai!', 'Kamu sudah mengukir semua aksara Jawa di batu.']
};
function finishGame(id) {
  const lastLetter = G.idx; stopVoice(); G.finished = true; G.state = 'win'; G.run++;
  hud.classList.remove('on'); hud2.classList.remove('on'); paused = false; lost.classList.remove('on'); PARTS = [];
  if (id === 'aksara') saveDone(20);
  if (id === 'latihan') {
    const d = loadLat(); if (!d.includes(lastLetter)) { d.push(lastLetter); saveLat(d); }
    $('#wTitle').textContent = `Aksara ${LET[lastLetter][2]} selesai!`; $('#wSub').textContent = `Kamu menulis, belajar, dan memecah gelembung aksara ${LET[lastLetter][2]}.`;
    $('#bNext').textContent = 'Aksara berikutnya'; $('#bPick').style.display = '';
  } else {
    $('#wTitle').textContent = WIN[id][0]; $('#wSub').textContent = WIN[id][1];
    const order = ['dora', 'aji', 'aksara'], last = !(S.seq && order.indexOf(id) < 2);
    $('#bNext').textContent = last ? 'Menu' : 'Lanjut'; $('#bPick').style.display = 'none';
  }
  G.lastId = id; G.lastLetter = lastLetter;
  show('sWin');
  try { window.dispatchEvent(new CustomEvent('dolanan:game-complete', { detail: { game: id } })); } catch (e) {}
  try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'dolanan-game-complete', game: id }, '*'); } catch (e) {}
}

/* ---------- gambar utama ---------- */
function drawBG() {
  const maze = G.id === 'dora' || G.id === 'aji';
  if (isCam() && vid.readyState >= 2 && vid.videoWidth) {
    const cr = coverRect(vid.videoWidth, vid.videoHeight);
    ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(vid, cr.sx, cr.sy, cr.sw, cr.sh, 0, 0, W, H); ctx.restore();
    ctx.fillStyle = `rgba(22,34,43,${S.dim})`; ctx.fillRect(0, 0, W, H);
  } else {
    const im = IM[maze ? 's11' : 's18'];
    if (im && im.complete && im.naturalWidth) ctx.drawImage(im, 0, 0, W, H); else { ctx.fillStyle = '#365D85'; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = 'rgba(22,34,43,.38)'; ctx.fillRect(0, 0, W, H);
  }
  if (!G.id) { ctx.fillStyle = 'rgba(22,34,43,.3)'; ctx.fillRect(0, 0, W, H); }
}
const isWrite = () => G.id === 'aksara' || G.id === 'latihan';
function draw(dt) {
  const sc = cv.width / W; ctx.setTransform(sc, 0, 0, sc, 0, 0);
  drawBG();
  if (G.id === 'dora' || G.id === 'aji') G.maze && drawMaze();
  else if (isWrite()) { drawWrite(); drawBub(); drawQuiz(); }
  drawParts(dt); drawWord();
}

/* ---------- loop ---------- */
let last = now();
const PAUSE_STATES = ['trace', 'ready', 'play', 'bplay', 'quiz'];
function frame(t) {
  const dt = Math.min(.05, (t - last) / 1000); last = t;
  const w = stage.clientWidth, dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr * H / W); }
  if (isCam()) {
    handTick(); const tn = now(); T.forEach(tr => { if (tr.on && tn - tr.seen > 450) tr.on = false; });
    const f = T.find(tr => tr.on); if (f) { P.x = f.x; P.y = f.y; P.on = true; P.seen = f.seen; } else P.on = false;
  }
  const playing = G.id && PAUSE_STATES.includes(G.state);
  if (isCam() && playing) {
    if (now() - P.seen > 1500) { if (!paused) { paused = true; voice.audio && voice.audio.pause(); lost.classList.add('on'); } okSince = 0; }
    else if (paused) { okSince = okSince || now(); if (now() - okSince > 350) { paused = false; voice.audio && voice.audio.play().catch(() => {}); lost.classList.remove('on'); } }
  } else if (paused) { paused = false; lost.classList.remove('on'); }
  if (!paused) {
    if (G.id === 'dora' || G.id === 'aji') G.maze && updateMaze(dt); else if (isWrite() && G.state) updateWrite(dt);
  }
  voiceUpdate(dt);
  updateDwell(dt);
  draw(paused ? 0 : dt);
  const showCur = isCam() && P.on;
  cur.classList.toggle('on', showCur);
  if (showCur) { cur.style.left = (P.x / W * 100) + '%'; cur.style.top = (P.y / H * 100) + '%'; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ---------- API uji / integrasi ---------- */
window.DolananGame = {
  injectPointer(x, y) { P.inj = true; P.x = x; P.y = y; P.on = true; P.seen = now(); },
  injectPointer2(x, y) { P2.x = x; P2.y = y; P2.on = true; },
  releasePointer() { P.on = false; P2.on = false; },
  act: fire,
  start: startGame,
  startWrite,
  openIntro,
  openPick,
  setMode(m) { S.mode = m; },
  get S() { return S; },
  get G() { return G; },
  get P() { return P; },
  get paused() { return paused; },
  cellCenter: cc,
  LET, BAKED, VL
};
})();
