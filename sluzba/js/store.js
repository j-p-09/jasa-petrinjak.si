// EviDelo – podatkovni sloj.
// Podatki so lokalno predpomnjeni (delo brez povezave), spremembe gredo v čakalno vrsto
// in se pošljejo v Firebase takoj, ko je povezava. Spremembe iz drugih naprav prihajajo v živo.
import { FIREBASE_URL, SEED_USERS } from './config.js';
import { hashPassword, randomSalt, clean } from './util.js';

const LS = window.localStorage;
const SS = window.sessionStorage;
const jget = (s, k, d) => {
  try {
    const v = s.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
};
const jset = (s, k, v) => {
  try {
    s.setItem(k, JSON.stringify(v));
  } catch {
    /* polno / zasebni način */
  }
};

export const st = {
  uid: null,
  user: null,
  plans: {},
  shifts: {},
  online: false,
  ready: false,
  fbOk: false,
  error: null,
  pendingCount: 0,
  allUsers: {},
};

let fb = null;
let fbInit = false;
let remote = { user: null, plans: {}, shifts: {} };
let pending = [];
let unsubs = [];
let flushing = false;
let adminListening = false;
const listeners = new Set();

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const emit = () => listeners.forEach((fn) => {
  try {
    fn(st);
  } catch (e) {
    console.error(e);
  }
});

const T = (p, ms = 10000) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

async function loadFb() {
  if (fb) return fb;
  try {
    const m = await import('./firebase.js');
    if (!fbInit) {
      m.initDb(FIREBASE_URL);
      fbInit = true;
    }
    fb = m;
    st.fbOk = true;
  } catch (e) {
    console.warn('Firebase SDK ni na voljo', e);
    st.fbOk = false;
  }
  return fb;
}

// ---------- združevanje oddaljenih podatkov in čakajočih sprememb ----------
function applyOp(d, op) {
  const [kind, key] = op.p.split('/');
  if (kind === 'user') {
    d.user = { ...(d.user || {}) };
    if (op.v === null) delete d.user[key];
    else d.user[key] = op.v;
  } else if (op.v === null) delete d[kind][key];
  else d[kind][key] = op.v;
}

function compute() {
  const d = {
    user: remote.user ? { ...remote.user } : null,
    plans: { ...(remote.plans || {}) },
    shifts: { ...(remote.shifts || {}) },
  };
  for (const op of pending) applyOp(d, op);
  st.user = d.user;
  st.plans = d.plans;
  st.shifts = d.shifts;
  st.pendingCount = pending.length;
  emit();
}

let cacheTimer = null;
function cacheSave() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => st.uid && jset(LS, `evidelo.cache.${st.uid}`, remote), 250);
}
const savePending = () => st.uid && jset(LS, `evidelo.pending.${st.uid}`, pending);

// ---------- pošiljanje ----------
const toPath = (p) => {
  const [kind, key] = p.split('/');
  return kind === 'user' ? `users/${st.uid}/${key}` : `${kind}/${st.uid}/${key}`;
};

async function flush() {
  if (flushing || !fb || !st.uid) return;
  flushing = true;
  try {
    while (pending.length) {
      const op = pending[0];
      try {
        await fb.set(fb.R(toPath(op.p)), op.v);
      } catch (e) {
        if (String(e?.code || e?.message).toUpperCase().includes('PERMISSION')) {
          st.error = 'perm';
          pending.shift();
          savePending();
          compute();
          continue;
        }
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }
      pending.shift();
      savePending();
      st.pendingCount = pending.length;
      emit();
    }
  } finally {
    flushing = false;
  }
}

function enqueue(p, v) {
  pending.push({ p, v });
  savePending();
  compute();
  flush();
}

// ---------- poslušalci ----------
function stopListeners() {
  unsubs.forEach((u) => {
    try {
      u();
    } catch {
      /* ignoriraj */
    }
  });
  unsubs = [];
  adminListening = false;
}

function onErr(e) {
  const perm = String(e?.code || e?.message).toUpperCase().includes('PERMISSION');
  st.error = perm ? 'perm' : String(e?.message || e);
  emit();
}

async function startListeners() {
  const f = await loadFb();
  if (!f || !st.uid) {
    emit();
    return;
  }
  stopListeners();
  const uid = st.uid;
  unsubs.push(
    f.onValue(f.R('.info/connected'), (s) => {
      st.online = !!s.val();
      emit();
      if (st.online) flush();
    }),
    f.onValue(
      f.R(`users/${uid}`),
      (s) => {
        remote.user = s.val();
        st.ready = true;
        if (remote.user?.role === 'admin' && !adminListening) {
          adminListening = true;
          unsubs.push(
            f.onValue(
              f.R('users'),
              (us) => {
                st.allUsers = us.val() || {};
                emit();
              },
              onErr
            )
          );
        }
        st.error = st.error === 'perm' ? null : st.error;
        cacheSave();
        compute();
      },
      onErr
    ),
    f.onValue(
      f.R(`plans/${uid}`),
      (s) => {
        remote.plans = s.val() || {};
        cacheSave();
        compute();
      },
      onErr
    ),
    f.onValue(
      f.R(`shifts/${uid}`),
      (s) => {
        remote.shifts = s.val() || {};
        cacheSave();
        compute();
      },
      onErr
    )
  );
  flush();
}

async function attach(uid) {
  st.uid = uid;
  const cache = jget(LS, `evidelo.cache.${uid}`, null);
  remote = cache ? { user: cache.user || null, plans: cache.plans || {}, shifts: cache.shifts || {} } : { user: null, plans: {}, shifts: {} };
  pending = jget(LS, `evidelo.pending.${uid}`, []);
  st.ready = !!cache?.user;
  st.error = null;
  compute();
  startListeners();
}

// ---------- seja ----------
export const hasSession = () => !!(jget(LS, 'evidelo.session', null) || jget(SS, 'evidelo.session', null))?.uid;

export async function init() {
  const s = jget(LS, 'evidelo.session', null) || jget(SS, 'evidelo.session', null);
  if (s?.uid) await attach(s.uid);
  window.addEventListener('online', () => {
    flush();
  });
}

async function ensureSeed(f) {
  // Začetni uporabniki se ustvarijo samo enkrat (izbrisan uporabnik ne "vstane od mrtvih").
  // Admin se vedno ustvari znova, če manjka – izbrisati ga ni mogoče.
  const flag = await T(f.get(f.R('meta/seeded')));
  const list = flag.exists() ? SEED_USERS.filter((x) => x.role === 'admin') : SEED_USERS;
  for (const s of list) {
    const ex = await T(f.get(f.R(`users/${s.id}`)));
    if (!ex.exists()) {
      const u = { ime: s.ime, priimek: s.priimek, username: s.username, salt: s.salt, hash: s.hash, rate: 0, createdAt: Date.now() };
      if (s.role) u.role = s.role;
      await T(f.update(f.R(), { [`users/${s.id}`]: u, [`usernames/${s.username.toLowerCase()}`]: s.id }));
    }
  }
  if (!flag.exists()) await T(f.set(f.R('meta/seeded'), true));
}

const BAD = 'Napačno uporabniško ime ali geslo.';
function friendly(e) {
  const m = String(e?.code || e?.message || e);
  if (m === BAD || e?.friendly) return e;
  if (m.toUpperCase().includes('PERMISSION'))
    return Object.assign(new Error('Firebase zavrača dostop. V Firebase konzoli nastavi pravila baze (glej navodila).'), { friendly: true });
  return Object.assign(new Error('Ni povezave s strežnikom. Preveri internet in poskusi znova.'), { friendly: true });
}

export async function login(username, password, remember) {
  const name = (username || '').trim().toLowerCase();
  if (!name || !password) throw Object.assign(new Error('Vnesi uporabniško ime in geslo.'), { friendly: true });
  const f = await loadFb();
  if (!f) throw Object.assign(new Error('Ne morem naložiti povezave s strežnikom. Preveri internet.'), { friendly: true });
  try {
    let uid = (await T(f.get(f.R(`usernames/${name}`)))).val();
    if (!uid && SEED_USERS.some((s) => s.username.toLowerCase() === name)) {
      await ensureSeed(f);
      uid = (await T(f.get(f.R(`usernames/${name}`)))).val();
    }
    if (!uid) throw new Error(BAD);
    const u = (await T(f.get(f.R(`users/${uid}`)))).val();
    if (!u || hashPassword(u.salt, password) !== u.hash) throw new Error(BAD);
    LS.removeItem('evidelo.session');
    SS.removeItem('evidelo.session');
    jset(remember ? LS : SS, 'evidelo.session', { uid });
    await attach(uid);
  } catch (e) {
    throw friendly(e);
  }
}

export function logout() {
  stopListeners();
  LS.removeItem('evidelo.session');
  SS.removeItem('evidelo.session');
  st.uid = null;
  st.user = null;
  st.plans = {};
  st.shifts = {};
  st.ready = false;
  st.allUsers = {};
  pending = [];
  remote = { user: null, plans: {}, shifts: {} };
  emit();
}

// ---------- pisanje podatkov ----------
export const api = {
  setShift: (date, v) => enqueue(`shifts/${date}`, v == null ? null : clean(v)),
  setPlan: (date, v) => enqueue(`plans/${date}`, v == null ? null : clean(v)),
  setRate: (rate) => enqueue('user/rate', Number(rate) || 0),
  setRound: (on) => enqueue('user/round', !!on),

  async changeUsername(newName) {
    if (!fb || !st.online) throw new Error('Za to dejanje je potrebna internetna povezava.');
    const nu = newName.trim();
    if (!/^[\p{L}\p{N}._-]{2,32}$/u.test(nu)) throw new Error('Uporabniško ime: 2–32 znakov (črke, številke, . _ -).');
    const lower = nu.toLowerCase();
    const old = (remote.user?.username || st.user?.username || '').toLowerCase();
    const up = { [`users/${st.uid}/username`]: nu };
    if (lower !== old) {
      const ex = (await T(fb.get(fb.R(`usernames/${lower}`)))).val();
      if (ex && ex !== st.uid) throw new Error('To uporabniško ime je že zasedeno.');
      up[`usernames/${lower}`] = st.uid;
      if (old) up[`usernames/${old}`] = null;
    }
    await T(fb.update(fb.R(), up));
  },

  async changePassword(current, next) {
    if (!fb || !st.online) throw new Error('Za to dejanje je potrebna internetna povezava.');
    const u = remote.user;
    if (!u || hashPassword(u.salt, current) !== u.hash) throw new Error('Trenutno geslo ni pravilno.');
    if ((next || '').length < 4) throw new Error('Novo geslo naj ima vsaj 4 znake.');
    const salt = randomSalt();
    await T(fb.update(fb.R(`users/${st.uid}`), { salt, hash: hashPassword(salt, next) }));
  },
};

const USERNAME_RE = /^[\p{L}\p{N}._-]{2,32}$/u;
const needOnline = () => {
  if (!fb || !st.online) throw new Error('Za to dejanje je potrebna internetna povezava.');
};
const requireAdmin = () => {
  if (remote.user?.role !== 'admin') throw new Error('Samo administrator lahko to naredi.');
};

export const admin = {
  async createUser({ ime, priimek, username, password }) {
    requireAdmin();
    needOnline();
    ime = (ime || '').trim();
    username = (username || '').trim();
    if (!ime) throw new Error('Vpiši ime.');
    if (!USERNAME_RE.test(username)) throw new Error('Uporabniško ime: 2–32 znakov (črke, številke, . _ -).');
    if ((password || '').length < 1) throw new Error('Vpiši geslo.');
    const lower = username.toLowerCase();
    if ((await T(fb.get(fb.R(`usernames/${lower}`)))).val()) throw new Error('To uporabniško ime je že zasedeno.');
    const uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const salt = randomSalt();
    await T(
      fb.update(fb.R(), {
        [`users/${uid}`]: { ime, priimek: (priimek || '').trim(), username, salt, hash: hashPassword(salt, password), rate: 0, createdAt: Date.now() },
        [`usernames/${lower}`]: uid,
      })
    );
    return uid;
  },

  async updateUser(uid, { ime, priimek, username, password }) {
    requireAdmin();
    needOnline();
    const cur = st.allUsers[uid];
    if (!cur) throw new Error('Uporabnik ne obstaja več.');
    ime = (ime || '').trim();
    username = (username || '').trim();
    if (!ime) throw new Error('Vpiši ime.');
    if (!USERNAME_RE.test(username)) throw new Error('Uporabniško ime: 2–32 znakov (črke, številke, . _ -).');
    const up = { [`users/${uid}/ime`]: ime, [`users/${uid}/priimek`]: (priimek || '').trim(), [`users/${uid}/username`]: username };
    const lower = username.toLowerCase();
    const old = (cur.username || '').toLowerCase();
    if (lower !== old) {
      const ex = (await T(fb.get(fb.R(`usernames/${lower}`)))).val();
      if (ex && ex !== uid) throw new Error('To uporabniško ime je že zasedeno.');
      up[`usernames/${lower}`] = uid;
      if (old) up[`usernames/${old}`] = null;
    }
    if (password) {
      const salt = randomSalt();
      up[`users/${uid}/salt`] = salt;
      up[`users/${uid}/hash`] = hashPassword(salt, password);
    }
    await T(fb.update(fb.R(), up));
  },

  async deleteUser(uid) {
    requireAdmin();
    needOnline();
    if (uid === st.uid) throw new Error('Svojega računa ne moreš izbrisati.');
    const cur = st.allUsers[uid];
    const up = { [`users/${uid}`]: null, [`plans/${uid}`]: null, [`shifts/${uid}`]: null };
    if (cur?.username) up[`usernames/${cur.username.toLowerCase()}`] = null;
    await T(fb.update(fb.R(), up));
  },
};

export const data = () => ({ plans: st.plans, shifts: st.shifts });
