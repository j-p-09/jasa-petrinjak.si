// EviDelo – administrator: upravljanje uporabnikov (dodajanje, urejanje, brisanje)
import { icon } from '../icons.js';
import { st, admin } from '../store.js';
import { esc } from '../util.js';
import { confirmDialog, h, openModal, toast } from '../ui.js';

const initials = (u) => `${(u.ime || '?')[0] || ''}${(u.priimek || '')[0] || ''}`.toUpperCase();

function userForm(uid) {
  const u = uid ? st.allUsers[uid] : null;
  const f = h(`
    <form class="stack" novalidate>
      <div class="grid2">
        <label class="field"><span>Ime</span><input name="ime" value="${esc(u?.ime || '')}" autocomplete="off"></label>
        <label class="field"><span>Priimek</span><input name="priimek" value="${esc(u?.priimek || '')}" autocomplete="off"></label>
      </div>
      <label class="field"><span>Uporabniško ime</span>
        <input name="username" value="${esc(u?.username || '')}" autocapitalize="none" autocomplete="off" spellcheck="false"></label>
      <label class="field"><span>${u ? 'Novo geslo <em>(prazno = geslo ostane isto)</em>' : 'Geslo'}</span>
        <input name="password" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${u ? 'Vpiši samo, če ga želiš spremeniti' : ''}"></label>
      <div class="form-err" role="alert"></div>
      <div class="btn-row">
        <button type="button" class="btn ghost" data-close>Prekliči</button>
        <button type="submit" class="btn primary">${u ? 'Shrani spremembe' : 'Dodaj uporabnika'}</button>
      </div>
    </form>`);
  return f;
}

export function adminView() {
  const el = h('<div class="view admin"></div>');

  function render() {
    const entries = Object.entries(st.allUsers || {}).sort((a, b) =>
      (a[1].role === 'admin') - (b[1].role === 'admin') || (a[1].username || '').localeCompare(b[1].username || '', 'sl')
    );
    el.innerHTML = `
      <div class="admin-head">
        <div><h1 class="page-title">Uporabniki</h1><p class="muted-text">Skupaj: ${entries.length}</p></div>
        <button class="btn primary" data-add>${icon('plus', 18, 2.6)} Dodaj</button>
      </div>
      <section class="card user-list">
        ${
          entries.length
            ? entries
                .map(
                  ([uid, u]) => `
          <div class="user-row" data-uid="${esc(uid)}">
            <div class="avatar sm">${esc(initials(u))}</div>
            <div class="ur-main">
              <b>${esc(`${u.ime || ''} ${u.priimek || ''}`.trim() || u.username)}</b>
              <span>@${esc(u.username || '')}${u.role === 'admin' ? ' · <em class="badge">admin</em>' : ''}</span>
            </div>
            <button class="icon-btn" data-edit aria-label="Uredi">${icon('pencil', 18)}</button>
            ${uid === st.uid ? '' : `<button class="icon-btn del" data-del aria-label="Izbriši">${icon('trash', 18)}</button>`}
          </div>`
                )
                .join('')
            : '<p class="muted-text">Nalagam uporabnike …</p>'
        }
      </section>
      <p class="hint">Gesel ni mogoče prebrati (shranjena so zgoščena) – lahko pa jih kadarkoli nastaviš na novo.</p>`;

    el.querySelector('[data-add]').onclick = () => openForm(null);
    el.querySelectorAll('.user-row').forEach((row) => {
      const uid = row.dataset.uid;
      row.querySelector('[data-edit]').onclick = () => openForm(uid);
      const del = row.querySelector('[data-del]');
      if (del)
        del.onclick = async () => {
          const u = st.allUsers[uid];
          const ok = await confirmDialog({
            title: 'Brisanje uporabnika',
            text: `Izbrišem uporabnika @${u?.username}? Izbrisani bodo tudi njegov plan in vsi vpisi dela. Tega ni mogoče razveljaviti.`,
            okText: 'Izbriši',
            danger: true,
          });
          if (!ok) return;
          try {
            await admin.deleteUser(uid);
            toast('Uporabnik izbrisan');
          } catch (e) {
            toast(e.message, 'err');
          }
        };
    });
  }

  function openForm(uid) {
    const form = userForm(uid);
    const m = openModal({ title: uid ? 'Uredi uporabnika' : 'Nov uporabnik', content: form });
    setTimeout(() => form.ime.focus(), 260);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type=submit]');
      const err = form.querySelector('.form-err');
      err.textContent = '';
      btn.disabled = true;
      btn.classList.add('busy');
      try {
        const v = { ime: form.ime.value, priimek: form.priimek.value, username: form.username.value, password: form.password.value };
        if (uid) await admin.updateUser(uid, v);
        else await admin.createUser(v);
        toast(uid ? 'Spremembe shranjene' : 'Uporabnik dodan', 'ok');
        m.close();
      } catch (ex) {
        err.textContent = ex.message || 'Napaka pri shranjevanju.';
        btn.disabled = false;
        btn.classList.remove('busy');
      }
    });
  }

  render();
  return { el, refresh: render };
}
