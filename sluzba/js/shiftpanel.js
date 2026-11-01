// EviDelo – plošča izmene za izbran datum (ogled, ročni vpis, urejanje, odpoved).
// Uporablja jo koledar (v oknu) in stran "Vpis dela".
import { icon } from './icons.js';
import { st, api } from './store.js';
import { MAX_SHIFT_MIN } from './config.js';
import {
  clockOf, dayInfo, durMin, esc, fmtDur, fmtDurSigned, longDate, parseKey, shortTime, todayKey, tsOf, MIN,
} from './util.js';
import { STATUS, askReason, chip, confirmDialog, toast } from './ui.js';

export function mountShiftPanel(host, { onNavigate } = {}) {
  let k = todayKey();
  let editing = false;
  let adding = false;
  let dirty = false;

  const setDate = (key) => {
    k = key;
    editing = false;
    adding = false;
    dirty = false;
    render();
  };

  function planLine(info) {
    const plan = info.shift?.ps ? { s: info.shift.ps, e: info.shift.pe } : info.plan;
    if (!plan) return `<div class="sp-plan muted">Za ta dan ni plana – prost dan.</div>`;
    return `<div class="sp-plan">${icon('clock', 16)}<span>Plan: <b>${shortTime(plan.s)} – ${shortTime(plan.e)}</b> · ${fmtDur(durMin(plan.s, plan.e))}</span></div>`;
  }

  function formHTML(info, shift) {
    const plan = info.plan;
    const now = Date.now();
    let s = '';
    let e = '';
    if (shift && shift.st === 'done') {
      s = clockOf(shift.inAt);
      e = clockOf(shift.outAt);
    } else if (plan) {
      s = plan.s;
      e = tsOf(k, plan.s) + durMin(plan.s, plan.e) * MIN > now ? '' : plan.e;
    }
    const note = shift?.note || '';
    return `
      <form class="sp-form stack" novalidate>
        <div class="grid2">
          <label class="field"><span>Ura prihoda</span><input type="time" name="in" value="${esc(s)}" required></label>
          <label class="field"><span>Ura odhoda</span><input type="time" name="out" value="${esc(e)}" required></label>
        </div>
        <label class="field"><span>Opombe <em>(neobvezno)</em></span>
          <textarea name="note" rows="2" maxlength="300" placeholder="Npr. dodatno delo, zamenjava …">${esc(note)}</textarea></label>
        <div class="form-err" role="alert"></div>
        <div class="btn-row wrap">
          ${editing || adding ? '<button type="button" class="btn ghost" data-cancel-edit>Prekliči</button>' : ''}
          ${plan && !shift ? '<button type="button" class="btn ghost danger-text" data-cancel-shift>Odpovej izmeno</button>' : ''}
          <button type="submit" class="btn primary">${icon('check', 18, 2.6)} Shrani</button>
        </div>
      </form>`;
  }

  function render() {
    const tk = todayKey();
    const future = k > tk;
    const info = dayInfo(k, st);
    const shift = info.shift;
    const d = parseKey(k);
    let body = '';
    let status = info.status;

    if (shift?.st === 'running') {
      body = `
        ${planLine(info)}
        <div class="sp-box">
          <p>Izmena <b>poteka</b> od <b>${clockOf(shift.inAt)}</b>. Odhod zabeležiš na domači strani.</p>
        </div>
        <div class="btn-row"><button class="btn primary" data-go-home>${icon('home', 18)} Na domačo stran</button></div>`;
    } else if (shift?.st === 'done' && !editing) {
      const diff = info.W - info.P;
      body = `
        ${planLine(info)}
        <dl class="sp-rows">
          <div><dt>Prihod</dt><dd>${clockOf(shift.inAt)}</dd></div>
          <div><dt>Odhod</dt><dd>${clockOf(shift.outAt)}</dd></div>
          <div><dt>Opravljeno</dt><dd><b>${fmtDur(info.W)}</b></dd></div>
          <div><dt>Razlika od plana</dt><dd class="diff ${info.status}">${info.P || diff ? fmtDurSigned(diff) : '0h 00m'}</dd></div>
          ${shift.note ? `<div><dt>Opombe</dt><dd class="note">${esc(shift.note)}</dd></div>` : ''}
        </dl>
        <div class="btn-row wrap">
          <button class="btn ghost danger-text" data-delete>${icon('trash', 18)} Izbriši vpis</button>
          <button class="btn primary" data-edit>${icon('pencil', 18)} Uredi</button>
        </div>`;
    } else if (shift?.st === 'done' && editing) {
      body = `${planLine(info)}${formHTML(info, shift)}`;
    } else if (shift?.st === 'cancelled' && !adding) {
      body = `
        ${planLine(info)}
        <div class="sp-box cancelled"><b>Razlog odpovedi</b><p>${esc(shift.reason || '–')}</p></div>
        <div class="btn-row wrap">
          <button class="btn ghost" data-undo>Razveljavi odpoved</button>
          ${!future ? `<button class="btn primary" data-add>${icon('plus', 18)} Vpiši delo</button>` : ''}
        </div>`;
    } else if (shift?.st === 'cancelled' && adding) {
      body = `${planLine(info)}${formHTML(info, null)}`;
    } else if (future) {
      body = info.plan
        ? `${planLine(info)}
           <p class="muted-text">V prihodnost ni mogoče vpisovati dela. Izmeno lahko samo odpoveš.</p>
           <div class="btn-row"><button class="btn ghost danger-text" data-cancel-shift>${icon('ban', 18)} Odpovej izmeno</button></div>`
        : `${planLine(info)}<p class="muted-text">V prihodnost ni mogoče vpisovati dela.</p>`;
    } else if (info.plan || adding) {
      body = `${planLine(info)}${formHTML(info, null)}
        ${k === tk ? '<p class="hint">Prihod lahko zabeležiš tudi z gumbom na domači strani.</p>' : ''}`;
    } else {
      body = `${planLine(info)}
        <div class="btn-row"><button class="btn ghost" data-add>${icon('plus', 18)} Vpiši dodatno delo</button></div>`;
    }

    host.innerHTML = `
      <div class="sp">
        <div class="sp-head">
          <div class="sp-date">${longDate(d)}</div>
          ${chip(status, status === 'planned' && k < tk ? 'Nevpisana' : undefined)}
        </div>
        ${body}
      </div>`;
    bind(info, shift);
  }

  function bind(info, shift) {
    const q = (s) => host.querySelector(s);
    const on = (s, fn) => {
      const el = q(s);
      if (el) el.onclick = fn;
    };
    on('[data-go-home]', () => onNavigate?.('#/domov'));
    on('[data-edit]', () => {
      editing = true;
      dirty = false;
      render();
    });
    on('[data-add]', () => {
      adding = true;
      dirty = false;
      render();
    });
    on('[data-cancel-edit]', () => {
      editing = false;
      adding = false;
      dirty = false;
      render();
    });
    on('[data-delete]', async () => {
      if (await confirmDialog({ title: 'Izbris vpisa', text: 'Vpis dela za ta dan bo izbrisan. Plan ostane.', okText: 'Izbriši', danger: true })) {
        api.setShift(k, null);
        toast('Vpis izbrisan');
      }
    });
    on('[data-undo]', () => {
      api.setShift(k, null);
      toast('Odpoved razveljavljena');
    });
    on('[data-cancel-shift]', async () => {
      const reason = await askReason({ text: 'Izmena bo označena kot odpovedana.' });
      if (!reason) return;
      api.setShift(k, { st: 'cancelled', reason, ps: info.plan?.s ?? null, pe: info.plan?.e ?? null, at: Date.now() });
      editing = false;
      adding = false;
      toast('Izmena odpovedana');
    });

    const form = q('.sp-form');
    if (!form) return;
    form.addEventListener('input', () => (dirty = true));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const err = form.querySelector('.form-err');
      const fail = (m) => (err.textContent = m);
      const inS = form.in.value;
      const outS = form.out.value;
      if (!inS || !outS) return fail('Vpiši uro prihoda in uro odhoda.');
      const now = Date.now();
      const inTs = tsOf(k, inS);
      let outTs = tsOf(k, outS);
      if (outTs <= inTs) outTs += 86400000;
      if (inTs > now || outTs > now) return fail('Dela ni mogoče vpisati v prihodnost.');
      if ((outTs - inTs) / MIN > MAX_SHIFT_MIN) return fail('Izmena je predolga – preveri uri.');
      if (outTs - inTs < MIN) return fail('Odhod mora biti po prihodu.');
      const plan = info.plan;
      api.setShift(k, {
        st: 'done',
        inAt: inTs,
        outAt: outTs,
        ps: plan?.s ?? shift?.ps ?? null,
        pe: plan?.e ?? shift?.pe ?? null,
        note: form.note.value.trim() || null,
        manual: true,
        at: now,
      });
      editing = false;
      adding = false;
      dirty = false;
      toast('Izmena shranjena', 'ok');
    });
  }

  render();
  return {
    setDate,
    get date() {
      return k;
    },
    // ob spremembah podatkov – obrazca ne prepišemo, če uporabnik že tipka
    refresh() {
      if (dirty) return;
      render();
    },
  };
}
