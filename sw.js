/* FreqHeal service worker
 * 1. Offline: bewaart de app zelf, zodat hij zonder internet werkt.
 * 2. Achtergrondaudio: levert een sessie als "gewoon" WAV-bestand (/fh-stream/<id>.wav),
 *    dat sample voor sample wordt berekend. iOS speelt zo'n audiobestand door bij een vergrendeld scherm.
 */
const VERSION = 'fh-app-v3';
const SESSIONS = 'fh-sessions';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== SESSIONS) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin === location.origin && u.pathname.includes('/fh-stream/')) return e.respondWith(streamResponse(e.request, u));
  if (e.request.method !== 'GET') return;
  if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return e.respondWith(cacheFirst(e.request));
  if (u.origin === location.origin) e.respondWith(networkFirst(e.request));
});
async function networkFirst(req){
  const c = await caches.open(VERSION);
  try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
  catch (err){ return (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html')) || Response.error(); }
}
async function cacheFirst(req){
  const c = await caches.open(VERSION), hit = await c.match(req); if (hit) return hit;
  try { const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; } catch (err){ return Response.error(); }
}

/* ---------- Synthese ---------- */
const loaded = new Map();
async function loadSession(id){
  if (loaded.has(id)) return loaded.get(id);
  const c = await caches.open(SESSIONS), base = self.registration.scope + 'fh-session/' + id;
  const j = await c.match(base + '.json'); if (!j) return null;
  const cfg = await j.json();
  let amb = null;
  if (cfg.amb){ const r = await c.match(base + '.amb'); if (r) amb = new Float32Array(await r.arrayBuffer()); }
  const s = makeSynth(cfg, amb);
  loaded.set(id, s); if (loaded.size > 3) loaded.delete(loaded.keys().next().value);
  return s;
}

function makeSynth(cfg, amb){
  const SR = cfg.sr, steps = cfg.steps, C = cfg.cycle, total = cfg.total, N = Math.floor(total * SR);
  const F = Math.max(.05, +cfg.fade || 0), TAU = Math.PI * 2, ambN = amb ? amb.length / 2 : 0;
  const sq = x => Math.sin(x) + Math.sin(3 * x) / 3 + Math.sin(5 * x) / 5 + Math.sin(7 * x) / 7;
  let pk = 0; for (let i = 0; i < 4000; i++) pk = Math.max(pk, Math.abs(sq(i / 4000 * TAU)));
  steps.forEach(s => s.H = Math.max(1, Math.min(40, Math.floor((SR / 2 - 400) / s.hz))));
  const wave = cfg.wave;

  function voice(s, tau, o){
    if (s.mode === 'tone'){
      const x = TAU * s.hz * tau; let v = 0;
      if (wave === 'sine') v = Math.sin(x) * .9;
      else if (wave === 'square'){ for (let n = 1; n <= s.H; n += 2) v += Math.sin(n * x) / n; v *= 4 / Math.PI * .3; }
      else if (wave === 'sawtooth'){ for (let n = 1; n <= s.H; n++) v += (n % 2 ? 1 : -1) * Math.sin(n * x) / n; v *= 2 / Math.PI * .3; }
      else { for (let n = 1, k = 0; n <= s.H; n += 2, k++) v += (k % 2 ? -1 : 1) * Math.sin(n * x) / (n * n); v *= 8 / (Math.PI * Math.PI) * .3; }
      o[0] = o[1] = v;
    } else if (s.mode === 'binaural'){
      o[0] = Math.sin(TAU * (s.carrier - s.hz / 2) * tau) * .8;
      o[1] = Math.sin(TAU * (s.carrier + s.hz / 2) * tau) * .8;
    } else {
      o[0] = o[1] = Math.sin(TAU * s.carrier * tau) * (.5 + .48 * sq(TAU * s.hz * tau) / pk);
    }
  }
  const clip = x => { const a = Math.abs(x); if (a <= .8) return x; const y = .8 + .2 * Math.tanh((a - .8) / .2); return x < 0 ? -y : y; };
  const A = [0, 0], B = [0, 0];
  let cur = 0;

  function render(s0, count){
    const out = new Int16Array(count * 2);
    for (let j = 0; j < count; j++){
      const n = s0 + j; if (n >= N) break;
      const t = n / SR, k = Math.floor(t / C), tc = t - k * C;
      let st = steps[cur];
      if (!(tc >= st.start && tc < st.start + st.sec)){ cur = 0; while (cur < steps.length - 1 && tc >= steps[cur].start + steps[cur].sec) cur++; st = steps[cur]; }
      const a0 = k * C + st.start, tau = t - a0;
      voice(st, tau, A); let L = A[0], R = A[1];
      if (tau < F && (k > 0 || cur > 0)){ // overgang vanaf de vorige stap
        const p = steps[cur > 0 ? cur - 1 : steps.length - 1];
        voice(p, t - (a0 - p.sec), B); const x = tau / F; L = L * x + B[0] * (1 - x); R = R * x + B[1] * (1 - x);
      }
      L *= cfg.tone; R *= cfg.tone;
      if (amb){ const m = (n % ambN) * 2; L += amb[m]; R += amb[m + 1]; }
      let env = t < 2 ? t / 2 : 1; const te = total - t; if (te < 4) env *= Math.max(0, te / 4);
      out[2 * j] = clip(L * cfg.gain * env) * 32767;
      out[2 * j + 1] = clip(R * cfg.gain * env) * 32767;
    }
    return out;
  }
  const dataBytes = N * 4, h = new DataView(new ArrayBuffer(44));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) h.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); h.setUint32(4, 36 + dataBytes, true); ws(8, 'WAVE'); ws(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true);
  h.setUint16(22, 2, true); h.setUint32(24, SR, true); h.setUint32(28, SR * 4, true); h.setUint16(32, 4, true); h.setUint16(34, 16, true);
  ws(36, 'data'); h.setUint32(40, dataBytes, true);
  return { N, size: 44 + dataBytes, header: new Uint8Array(h.buffer), render };
}

async function streamResponse(req, u){
  const id = u.pathname.split('/fh-stream/')[1].replace(/\.wav$/, '');
  const s = await loadSession(id);
  if (!s) return new Response('Sessie niet gevonden', { status: 404 });
  const size = s.size; let start = 0, end = size - 1, partial = false;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (m){
    partial = true;
    if (m[1] === '' && m[2] !== '') start = Math.max(0, size - +m[2]);
    else { start = +m[1] || 0; if (m[2] !== '') end = Math.min(+m[2], size - 1); }
  }
  if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  let pos = start; const CHUNK = 16384;
  const body = new ReadableStream({
    pull(ctrl){
      if (pos > end){ ctrl.close(); return; }
      if (pos < 44){ const e = Math.min(44, end + 1); ctrl.enqueue(s.header.slice(pos, e)); pos = e; return; }
      const d = pos - 44, s0 = Math.floor(d / 4), off = d - s0 * 4;
      const want = Math.min(CHUNK, Math.ceil((end + 1 - pos + off) / 4));
      const bytes = new Uint8Array(s.render(s0, want).buffer);
      const chunk = bytes.slice(off, Math.min(bytes.length, off + (end + 1 - pos)));
      if (!chunk.length){ ctrl.close(); return; }
      ctrl.enqueue(chunk); pos += chunk.length;
    }
  });
  const headers = { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), 'Cache-Control': 'no-store' };
  if (partial) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  return new Response(body, { status: partial ? 206 : 200, headers });
}
