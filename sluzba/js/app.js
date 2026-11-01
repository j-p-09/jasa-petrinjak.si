// EviDelo – zagon aplikacije: prijava, lupina z menijem, usmerjanje
import { icon } from './icons.js';
import { init, st, subscribe, logout } from './store.js';
import { h } from './ui.js';
import { loginView, logoHTML } from './views/login.js';
import { homeView } from './views/home.js';
import { calendarView } from './views/calendar.js';
import { entryView } from './views/entry.js';
import { statsView } from './views/stats.js';
import { profileView } from './views/profile.js';
import { planView } from './views/plan.js';
import { APP_VERSION } from './config.js';
import './install.js';

const root = document.getElementById('app');
const routes = {
  domov: homeView,
  koledar: calendarView,
  vpis: entryView,
  statistika: statsView,
  profil: profileView,
  plan: planView,
};
const NAV = [
  ['domov', 'Domov', 'home'],
  ['koledar', 'Koledar', 'calendar'],
  ['vpis', 'Vpis dela', 'edit'],
  ['statistika', 'Statistika', 'chart'],
  ['profil', 'Profil', 'user'],
];

let mode = 'none'; // none | login | loading | app
let shell = null;
let current = null;
let graceOver = false;
setTimeout(() => {
  graceOver = true;
  updateChrome();
}, 5000);

export function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [name, qs] = raw.split('?');
  return { name: name || '', params: Object.fromEntries(new URLSearchParams(qs || '')) };
}

// ---------- zasloni ----------
function showLogin() {
  mode = 'login';
  shell = null;
  current?.destroy?.();
  current = null;
  const v = loginView({ onSuccess: () => {} });
  root.replaceChildren(v.el);
}

let loadingTimer = null;
function showLoading() {
  mode = 'loading';
  shell = null;
  const el = h(`
    <div class="splash">
      ${logoHTML('big')}
      <div class="spinner" aria-hidden="true"></div>
      <p class="splash-msg">Nalagam podatke …</p>
      <button class="btn ghost light" data-out hidden>Odjava</button>
    </div>`);
  root.replaceChildren(el);
  clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => {
    const msg = el.querySelector('.splash-msg');
    if (msg) msg.textContent = 'Podatkov ni mogoče naložiti. Ob prvem zagonu je potrebna internetna povezava.';
    const b = el.querySelector('[data-out]');
    if (b) {
      b.hidden = false;
      b.onclick = () => logout();
    }
  }, 9000);
}

function showApp() {
  mode = 'app';
  clearTimeout(loadingTimer);
  shell = h(`
    <div class="shell">
      <aside class="side">
        ${logoHTML('side')}
        <nav class="side-nav">
          ${NAV.map(([k, label, ic]) => `<a href="#/${k}" data-n="${k}">${icon(ic, 22)}<span>${label}</span></a>`).join('')}
        </nav>
        <div class="side-user"><div class="avatar sm" data-avatar></div><div><b data-uname></b><span data-ustatus></span></div></div>
        <div class="side-ver">Različica ${APP_VERSION}</div>
      </aside>
      <div class="main">
        <div class="banner" data-banner hidden></div>
        <main id="view"></main>
      </div>
      <nav class="tabbar" aria-label="Glavni meni">
        ${NAV.map(([k, label, ic]) => `<a href="#/${k}" data-n="${k}" aria-label="${label}" title="${label}">${icon(ic, 24)}</a>`).join('')}
      </nav>
    </div>`);
  root.replaceChildren(shell);
  if (!routes[parseHash().name]) history.replaceState(null, '', '#/domov');
  route();
  updateChrome();
}

function route() {
  if (mode !== 'app') return;
  const { name, params } = parseHash();
  const key = routes[name] ? name : 'domov';
  current?.destroy?.();
  current = routes[key]({ navigate, params });
  const main = shell.querySelector('#view');
  main.replaceChildren(current.el);
  main.className = `v-${key}`;
  const activeNav = key === 'plan' ? 'profil' : key;
  shell.querySelectorAll('[data-n]').forEach((a) => a.classList.toggle('active', a.dataset.n === activeNav));
  window.scrollTo(0, 0);
  document.title = `${NAV.find((n) => n[0] === activeNav)?.[1] || 'EviDelo'} · EviDelo`;
}

function updateChrome() {
  if (mode !== 'app' || !shell) return;
  const u = st.user || {};
  shell.querySelector('[data-avatar]').textContent = `${(u.ime || '?')[0]}${(u.priimek || '')[0] || ''}`.toUpperCase();
  shell.querySelector('[data-uname]').textContent = `${u.ime || ''} ${u.priimek || ''}`;
  const offline = navigator.onLine === false || (graceOver && !st.online);
  shell.querySelector('[data-ustatus]').textContent = offline ? 'Brez povezave' : st.pendingCount ? 'Sinhroniziram …' : 'Sinhronizirano';
  const banner = shell.querySelector('[data-banner]');
  let text = '';
  let cls = '';
  if (st.error === 'perm') {
    text = 'Firebase zavrača dostop do baze. V Firebase konzoli nastavi pravila baze (glej navodila).';
    cls = 'err';
  } else if (offline) {
    text = st.pendingCount
      ? `Brez povezave – ${st.pendingCount} sprememb se bo poslalo ob vrnitvi povezave.`
      : 'Brez povezave – spremembe se shranijo in sinhronizirajo ob vrnitvi povezave.';
  }
  banner.hidden = !text;
  banner.className = `banner ${cls}`;
  banner.textContent = text;
}

// ---------- odzivanje na spremembe podatkov ----------
let scheduled = false;
function onStore() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    if (!st.uid) {
      if (mode !== 'login') showLogin();
      return;
    }
    if (!st.ready) {
      if (mode !== 'loading') showLoading();
      return;
    }
    if (!st.user) {
      logout(); // uporabnik v bazi ne obstaja več
      return;
    }
    if (mode !== 'app') {
      showApp();
      return;
    }
    updateChrome();
    current?.refresh?.();
  });
}

window.addEventListener('hashchange', route);
window.addEventListener('online', updateChrome);
window.addEventListener('offline', updateChrome);

// ---------- zagon ----------
(async function boot() {
  subscribe(onStore);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sluzba-sw.js', { scope: './sluzba.html' }).catch((e) => console.warn('SW', e));
  }
  await init();
  document.getElementById('boot')?.remove();
  onStore();
  if (!st.uid) showLogin();
})();
