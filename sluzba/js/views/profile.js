// EviDelo – profil: podatki, uporabniško ime, geslo, urna postavka, plan, namestitev
import { icon } from '../icons.js';
import { st, api, logout } from '../store.js';
import { esc } from '../util.js';
import { APP_VERSION } from '../config.js';
import { h, toast, confirmDialog } from '../ui.js';
import { install, isIOS, isStandalone, runInstall, wasInstalled } from '../install.js';

export function profileView({ navigate }) {
  const el = h('<div class="view profile"></div>');
  el.innerHTML = `
    <h1 class="page-title">Profil</h1>

    <section class="card who">
      <div class="avatar" data-avatar></div>
      <div><div class="who-name" data-fullname></div><div class="who-user" data-username></div></div>
    </section>

    <section class="card stack">
      <h2>Uporabniško ime</h2>
      <form data-f="username" class="stack" novalidate>
        <label class="field"><span>Novo uporabniško ime</span><input name="v" autocomplete="username" autocapitalize="none" spellcheck="false"></label>
        <div class="form-err" role="alert"></div>
        <button class="btn primary" type="submit">Shrani</button>
      </form>
    </section>

    <section class="card stack">
      <h2>Urna postavka</h2>
      <form data-f="rate" class="stack" novalidate>
        <label class="field"><span>Postavka na uro (€)</span>
          <div class="input-ic suffix"><input name="v" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0,00"><em>€ / h</em></div></label>
        <p class="hint">Uporablja se za izračun predvidene plače v statistiki.</p>
        <div class="form-err" role="alert"></div>
        <button class="btn primary" type="submit">Shrani</button>
      </form>
    </section>

    <section class="card stack">
      <h2>Tedenski plan dela</h2>
      <p class="muted-text">Določi, katere dni in v katerih urah delaš. Plan lahko urejaš za posamezne tedne.</p>
      <button class="btn primary" data-plan>${icon('calendar', 18)} Uredi plan</button>
    </section>

    <section class="card stack">
      <h2>Geslo</h2>
      <form data-f="password" class="stack" novalidate>
        <label class="field"><span>Trenutno geslo</span><input name="cur" type="password" autocomplete="current-password"></label>
        <label class="field"><span>Novo geslo</span><input name="n1" type="password" autocomplete="new-password"></label>
        <label class="field"><span>Ponovi novo geslo</span><input name="n2" type="password" autocomplete="new-password"></label>
        <div class="form-err" role="alert"></div>
        <button class="btn primary" type="submit">Spremeni geslo</button>
      </form>
    </section>

    <section class="card stack">
      <h2>Aplikacija</h2>
      <div class="status-row" data-install></div>
      <div class="status-row" data-sync></div>
    </section>

    <button class="btn outline-danger full" data-logout>${icon('logout', 18)} Odjava</button>
    <p class="app-ver">EviDelo · različica ${APP_VERSION}</p>`;

  const $ = (s) => el.querySelector(s);
  const forms = {
    username: $('[data-f=username]'),
    rate: $('[data-f=rate]'),
    password: $('[data-f=password]'),
  };
  const setErr = (f, m) => (f.querySelector('.form-err').textContent = m || '');
  const busy = (f, on) => {
    const b = f.querySelector('button[type=submit]');
    b.disabled = on;
    b.classList.toggle('busy', on);
  };

  forms.username.addEventListener('submit', async (e) => {
    e.preventDefault();
    setErr(forms.username);
    busy(forms.username, true);
    try {
      await api.changeUsername(forms.username.v.value);
      toast('Uporabniško ime spremenjeno', 'ok');
    } catch (ex) {
      setErr(forms.username, ex.message);
    }
    busy(forms.username, false);
  });

  forms.rate.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = parseFloat(String(forms.rate.v.value).replace(',', '.'));
    if (!(v >= 0)) return setErr(forms.rate, 'Vpiši veljaven znesek.');
    setErr(forms.rate);
    api.setRate(Math.round(v * 100) / 100);
    toast('Urna postavka shranjena', 'ok');
  });

  forms.password.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = forms.password;
    setErr(f);
    if (f.n1.value !== f.n2.value) return setErr(f, 'Novi gesli se ne ujemata.');
    busy(f, true);
    try {
      await api.changePassword(f.cur.value, f.n1.value);
      f.reset();
      toast('Geslo spremenjeno', 'ok');
    } catch (ex) {
      setErr(f, ex.message);
    }
    busy(f, false);
  });

  $('[data-plan]').onclick = () => navigate('#/plan');
  $('[data-logout]').onclick = async () => {
    if (await confirmDialog({ title: 'Odjava', text: 'Se res želiš odjaviti?', okText: 'Odjava' })) {
      logout();
      navigate('#/');
    }
  };

  function renderInstall() {
    const box = $('[data-install]');
    let state;
    if (isStandalone()) {
      state = `<span class="dot-ok"></span><div><b>Nameščena</b><span>Aplikacija je odprta kot nameščena aplikacija.</span></div>`;
    } else if (wasInstalled()) {
      state = `<span class="dot-ok"></span><div><b>Nameščena na tej napravi</b><span>Trenutno je odprta v brskalniku – odpri jo z začetnega zaslona.</span></div>`;
    } else if (install.prompt) {
      state = `<span class="dot-off"></span><div><b>Ni nameščena</b><span>Namesti jo za hiter dostop in delo brez povezave.</span></div>
        <button class="btn primary small" data-do-install>${icon('download', 16)} Namesti</button>`;
    } else if (isIOS()) {
      state = `<span class="dot-off"></span><div><b>Ni nameščena</b><span>V Safariju tapni ${icon('share', 14)} <i>Deli</i>, nato <i>Dodaj na začetni zaslon</i>.</span></div>`;
    } else {
      state = `<span class="dot-off"></span><div><b>Ni nameščena</b><span>V meniju brskalnika izberi <i>Namesti aplikacijo</i> ali <i>Dodaj na začetni zaslon</i>.</span></div>`;
    }
    box.innerHTML = `${icon('phone', 20)}${state}`;
    const b = box.querySelector('[data-do-install]');
    if (b) b.onclick = async () => (await runInstall()) && toast('Aplikacija nameščena', 'ok');
  }

  function renderSync() {
    const online = st.online && navigator.onLine !== false;
    const n = st.pendingCount;
    $('[data-sync]').innerHTML = `${icon(online ? 'wifi' : 'wifiOff', 20)}
      <span class="${online ? 'dot-ok' : 'dot-off'}"></span>
      <div><b>${online ? 'Povezano · sinhronizirano v živo' : 'Brez povezave'}</b>
      <span>${n ? `${n} ${n === 1 ? 'sprememba čaka' : 'sprememb čaka'} na pošiljanje.` : 'Vse spremembe so shranjene.'}</span></div>`;
  }

  function fill(initial = false) {
    const u = st.user || {};
    $('[data-avatar]').textContent = `${(u.ime || '?')[0] || ''}${(u.priimek || '')[0] || ''}`.toUpperCase();
    $('[data-fullname]').textContent = `${u.ime || ''} ${u.priimek || ''}`;
    $('[data-username]').textContent = `@${u.username || ''}`;
    if (initial || document.activeElement !== forms.username.v) forms.username.v.value = u.username || '';
    if (initial || document.activeElement !== forms.rate.v) forms.rate.v.value = u.rate ? String(u.rate) : '';
    renderSync();
  }

  fill(true);
  renderInstall();
  const onInst = () => renderInstall();
  install.listeners.add(onInst);

  return {
    el,
    refresh: () => fill(false),
    destroy: () => install.listeners.delete(onInst),
  };
}
