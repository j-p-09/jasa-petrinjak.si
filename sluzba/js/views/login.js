// EviDelo – prijavni zaslon
import { icon } from '../icons.js';
import { login } from '../store.js';
import { APP_VERSION } from '../config.js';
import { h } from '../ui.js';

export const logoHTML = (cls = '') => `
  <div class="logo ${cls}">
    <img src="${new URL('../../icons/logo.svg', import.meta.url).href}" alt="" class="logo-mark" width="88" height="88">
    <div class="logo-word"><span>Evi</span><b>Delo</b></div>
  </div>`;

export function loginView({ onSuccess }) {
  const el = h(`
    <div class="login">
      <div class="login-bg" aria-hidden="true"></div>
      <form class="login-card" novalidate>
        ${logoHTML('big')}
        <p class="login-tag">Evidenca dela, vedno pri roki.</p>
        <label class="field dark"><span>Uporabniško ime</span>
          <div class="input-ic">${icon('user', 18)}<input name="u" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required></div></label>
        <label class="field dark"><span>Geslo</span>
          <div class="input-ic">${icon('lock', 18)}<input name="p" type="password" autocomplete="current-password" required>
            <button type="button" class="eye" aria-label="Pokaži geslo">${icon('eye', 18)}</button></div></label>
        <label class="check"><input type="checkbox" name="r" checked><span class="box">${icon('check', 14, 3.4)}</span><span>Ostani prijavljen do odjave</span></label>
        <div class="form-err" role="alert"></div>
        <button class="btn primary big" type="submit"><span class="lbl">Prijava</span></button>
        <p class="login-ver">Različica ${APP_VERSION}</p>
      </form>
    </div>`);
  const form = el.querySelector('form');
  const err = el.querySelector('.form-err');
  const btn = el.querySelector('button[type=submit]');
  const eye = el.querySelector('.eye');
  eye.onclick = () => {
    const show = form.p.type === 'password';
    form.p.type = show ? 'text' : 'password';
    eye.innerHTML = icon(show ? 'eyeOff' : 'eye', 18);
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    btn.disabled = true;
    btn.classList.add('busy');
    try {
      await login(form.u.value, form.p.value, form.r.checked);
      onSuccess();
    } catch (ex) {
      err.textContent = ex.message || 'Prijava ni uspela.';
      btn.disabled = false;
      btn.classList.remove('busy');
    }
  });
  setTimeout(() => form.u.focus(), 50);
  return { el };
}
