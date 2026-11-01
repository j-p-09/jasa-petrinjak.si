// EviDelo – pomožne funkcije: datumi, formatiranje, izračuni ur in statistike.

export const DAY_ABBR = ['ned.', 'pon.', 'tor.', 'sre.', 'čet.', 'pet.', 'sob.'];
export const DAY_NAMES = ['nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota'];
export const MONTHS = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];
export const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
export const MIN = 60000;
export const DAY_MS = 86400000;

export const pad = (n) => String(n).padStart(2, '0');

// ---------- datumi ----------
export const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const todayKey = () => keyOf(new Date());
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const monIdx = (d) => (d.getDay() + 6) % 7; // pon = 0
export const startOfWeek = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -monIdx(d));
export const weekDates = (start) => Array.from({ length: 7 }, (_, i) => addDays(start, i));
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

export function weekLabel(start) {
  const end = addDays(start, 6);
  return `${start.getDate()}. ${start.getMonth() + 1}. – ${end.getDate()}. ${end.getMonth() + 1}. ${end.getFullYear()}`;
}
export const monthLabel = (d) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
export function longDate(d) {
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
export const shortDate = (d) => `${d.getDate()}.${d.getMonth() + 1}.`;

// ---------- ure ----------
export const toMin = (s) => {
  if (!s) return 0;
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
};
export const hhmm = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
export const shortTime = (s) => (s ? `${Number(s.slice(0, 2))}:${s.slice(3, 5)}` : '');
// trajanje med "HH:MM" začetkom in koncem (konec <= začetek pomeni naslednji dan)
export function durMin(s, e) {
  if (!s || !e) return 0;
  const a = toMin(s);
  const b = toMin(e);
  if (b === a) return 0;
  return b > a ? b - a : b + 1440 - a;
}
export function tsOf(dateKey, time) {
  const d = parseKey(dateKey);
  const [h, m] = time.split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0).getTime();
}
export const clockOf = (ts) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const minOfTs = (ts) => Math.floor(ts / MIN);

export function fmtDur(min) {
  const neg = min < 0;
  const a = Math.round(Math.abs(min));
  return `${neg ? '−' : ''}${Math.floor(a / 60)}h ${pad(a % 60)}m`;
}
export const fmtDurSigned = (min) => (min > 0 ? '+' : '') + fmtDur(min);
export const hoursDec = (min) => (min / 60).toLocaleString('sl-SI', { maximumFractionDigits: 2 });
export const fmtMoney = (n) =>
  new Intl.NumberFormat('sl-SI', { style: 'currency', currency: 'EUR' }).format(n || 0);

// ---------- varnost: SHA-256 (neodvisno od crypto.subtle) ----------
const { K256, H256 } = (() => {
  const primes = [];
  for (let n = 2; primes.length < 64; n++) if (primes.every((p) => n % p)) primes.push(n);
  const f = (x) => Math.floor((x - Math.floor(x)) * 4294967296);
  return { K256: primes.map((p) => f(Math.cbrt(p))), H256: primes.slice(0, 8).map((p) => f(Math.sqrt(p))) };
})();
const rotr = (x, n) => (x >>> n) | (x << (32 - n));
export function sha256(str) {
  const bytes = new TextEncoder().encode(str);
  const l = bytes.length;
  const total = ((l + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[l] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, Math.floor((l * 8) / 4294967296));
  dv.setUint32(total - 4, (l * 8) >>> 0);
  const h = H256.slice();
  const w = new Uint32Array(64);
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((v, i) => (h[i] = (h[i] + v) >>> 0));
  }
  return h.map((x) => x.toString(16).padStart(8, '0')).join('');
}
export const hashPassword = (salt, pw) => sha256(`${salt}:${pw}`);
export const randomSalt = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');

// ---------- logika izmen ----------
// status: free | planned | running | ok | over | under | cancelled
export function dayInfo(k, data, now = Date.now()) {
  const plan = data.plans?.[k] || null;
  const sh = data.shifts?.[k] || null;
  const planMin = plan ? durMin(plan.s, plan.e) : 0;
  if (sh) {
    const P = sh.ps && sh.pe ? durMin(sh.ps, sh.pe) : 0;
    if (sh.st === 'cancelled') return { k, status: 'cancelled', plan, shift: sh, P, W: 0 };
    if (sh.st === 'running') {
      const W = Math.max(0, minOfTs(now) - minOfTs(sh.inAt));
      return { k, status: 'running', plan, shift: sh, P, W };
    }
    const W = Math.max(0, minOfTs(sh.outAt) - minOfTs(sh.inAt));
    const status = W < P ? 'under' : W > P ? 'over' : 'ok';
    return { k, status, plan, shift: sh, P, W };
  }
  if (plan) return { k, status: 'planned', plan, shift: null, P: planMin, W: 0 };
  return { k, status: 'free', plan: null, shift: null, P: 0, W: 0 };
}

// razdelitev dneva na dele za statistiko in graf
export function dayParts(info, today = todayKey()) {
  const z = { inPlan: 0, over: 0, under: 0, pending: 0, planned: 0, worked: 0 };
  const { status, P, W } = info;
  if (status === 'free') return z;
  if (status === 'cancelled') return { ...z, under: P, planned: P }; // odpovedana izmena šteje kot minus ure
  if (status === 'planned') return { ...z, pending: P, planned: P };
  if (status === 'running') {
    return { ...z, inPlan: Math.min(W, P), over: Math.max(0, W - P), pending: Math.max(0, P - W), planned: P, worked: W };
  }
  return { ...z, inPlan: Math.min(W, P), over: Math.max(0, W - P), under: Math.max(0, P - W), planned: P, worked: W };
}

export function periodRange(mode, anchor) {
  if (mode === 'week') {
    const s = startOfWeek(anchor);
    return { from: s, to: addDays(s, 6), label: weekLabel(s) };
  }
  if (mode === 'year') {
    const y = anchor.getFullYear();
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31), label: String(y) };
  }
  const f = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  return { from: f, to: new Date(f.getFullYear(), f.getMonth() + 1, 0), label: monthLabel(f) };
}

export function eachDay(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function periodStats(data, from, to, now = Date.now()) {
  const tk = keyOf(new Date(now));
  const r = { worked: 0, planned: 0, over: 0, under: 0, cancelled: 0, unlogged: 0, pendingMin: 0, shifts: 0 };
  for (const d of eachDay(from, to)) {
    const k = keyOf(d);
    const info = dayInfo(k, data, now);
    if (info.status === 'cancelled') r.cancelled++;
    const p = dayParts(info);
    r.worked += p.worked;
    r.planned += p.planned;
    r.over += p.over;
    r.under += p.under;
    if (info.status === 'planned') {
      if (k < tk) r.unlogged++;
      else r.pendingMin += p.pending;
    } else if (info.status === 'running') {
      r.pendingMin += p.pending;
    }
    if (info.shift && (info.status === 'ok' || info.status === 'over' || info.status === 'under')) r.shifts++;
  }
  return r;
}

// podatki za graf: seznam zabojnikov (dnevi ali meseci)
export function chartBuckets(data, mode, from, to, now = Date.now()) {
  const sum = (days) => {
    const b = { inPlan: 0, over: 0, under: 0, pending: 0, planned: 0, worked: 0 };
    for (const d of days) {
      const p = dayParts(dayInfo(keyOf(d), data, now));
      for (const key in b) b[key] += p[key];
    }
    return b;
  };
  if (mode === 'year') {
    return Array.from({ length: 12 }, (_, m) => {
      const days = eachDay(new Date(from.getFullYear(), m, 1), new Date(from.getFullYear(), m + 1, 0));
      return { label: MONTHS_SHORT[m], title: `${MONTHS[m]} ${from.getFullYear()}`, ...sum(days) };
    });
  }
  return eachDay(from, to).map((d) => ({
    label: mode === 'week' ? DAY_ABBR[d.getDay()] : String(d.getDate()),
    sub: mode === 'week' ? String(d.getDate()) : '',
    title: `${DAY_ABBR[d.getDay()]} ${d.getDate()}. ${d.getMonth() + 1}.`,
    key: keyOf(d),
    ...sum([d]),
  }));
}

// ---------- model obroča na domači strani ----------
// Obroč predstavlja trajanje plana (P minut). Začne teči ob predvideni uri ali ob prihodu (kar je prej).
// Prva zanka: oranžno (zamuda) in zeleno. Druga zanka (nadure): najprej zelena, ki "popravi" oranžni del,
// nato modra.
export function ringModel({ planStartTs, P, inTs, endTs }) {
  const segs = [];
  if (!P) return { segs, elapsed: 0, lateMin: 0, worked: 0 };
  const psM = Math.round(planStartTs / MIN);
  const endM = minOfTs(endTs);
  if (inTs == null) {
    const late = Math.max(0, endM - psM);
    if (late > 0) segs.push({ from: 0, to: Math.min(late, P) / P, color: 'orange' });
    return { segs, elapsed: late, lateMin: late, worked: 0 };
  }
  const inM = minOfTs(inTs);
  const lateMin = Math.max(0, inM - psM);
  const t0 = Math.min(psM, inM);
  const elapsed = Math.max(0, endM - t0);
  const lateC = Math.min(lateMin, P);
  if (lateC > 0) segs.push({ from: 0, to: lateC / P, color: 'orange' });
  const lap1End = Math.min(elapsed, P);
  if (lap1End > lateC) segs.push({ from: lateC / P, to: lap1End / P, color: 'green' });
  const over = Math.min(Math.max(0, elapsed - P), P);
  if (over > 0) {
    const fix = Math.min(over, lateMin);
    if (fix > 0) segs.push({ from: 0, to: fix / P, color: 'green' });
    if (over > lateMin) segs.push({ from: lateMin / P, to: over / P, color: 'blue' });
  }
  return { segs, elapsed, lateMin, worked: Math.max(0, endM - inM) };
}

// ---------- ostalo ----------
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const clean = (o) => JSON.parse(JSON.stringify(o));
