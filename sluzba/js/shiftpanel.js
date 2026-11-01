// EviDelo – plošča izmene za izbran datum (ogled, ročni vpis, urejanje, odpoved).
// Uporablja jo koledar (v oknu) in stran "Vpis dela".
import { icon } from './icons.js';
import { st, api } from './store.js';
import { MAX_SHIFT_MIN } from './config.js';
import {
  MIN, clockOf, dayInfo, durMin, effIn, effOut, esc, fmtDur, fmtDurSigned, fmtMoney, longDate, nearestTs, parseKey,
  roundArrival, roundDeparture, shortTime, todayKey, tsOf,
} from './util.js';
import { askReason, chip, confirmDialog, toast } from './ui.js';

const num = (v) => {
  const n = parseFloat(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

export function mountShiftPanel(host, { onNavigate } = {}) {
  let k = todayKey();
  let editing = false;
  let adding = false;
  let dirty = false;
  let roundTouched = false;

  const setDate = (key) => {
    k = key;
    editing = false;
    adding = false;
    dirty = false;
    render();
  };

  function planOf(info) {
    return info.shift?.ps ? { s: info.shift.ps, e: info.shift.pe } : info.plan;
  }
  function planLine(info) {
    const plan = planOf(info);
    if (!plan) return `<div class="sp-plan muted">Za ta dan ni plana – prost dan.</div>`;
    return `<div class="sp-plan">${icon('clock', 16)}<span>Plan: <b>${shortTime(plan.s)} – ${shortTime(plan.e)}</b> · ${fmtDur(durMin(plan.s, plan.e))}</span></div>`;
  }

  function walletRows(w) {
    const diff = (w.paid ?? 0) - (w.exp ?? 0);
    return `
      <div><dt>Denarnica: predvideno</dt><dd>${fmtMoney(w.exp)}</dd></div>
      <div><dt>Denarnica: oddano</dt><dd>${fmtMoney(w.paid)}</dd></div>
      <div><dt>Razlika</dt><dd class="diff ${diff < 0 ? 'under' : diff > 0 ? 'over' : 'ok'}">${diff > 0 ? '+' : ''}${fmtMoney(diff)}</dd></div>`;
  }

  function formHTML(info, shift) {
    const plan = info.plan || (shift?.ps ? { s: shift.ps, e: shift.pe } : null);
    const now = Date.now();
    const roundOn = !!st.user?.round;
    const showRounded = roundOn || shift?.rIn != null || shift?.rOut != null;
    let s = '';
    let e = '';
    if (shift && shift.st === 'done') {
      s = clockOf(shift.inAt);
      e = clockOf(shift.outAt);
    } else if (plan) {
      s = plan.s;
      e = tsOf(k, plan.s) + durMin(plan.s, plan.e) * MIN > now ? '' : plan.e;
    }
    let rs = '';
    let re = '';
    if (shift?.rIn != null) rs = clockOf(shift.rIn);
    if (shift?.rOut != null) re = clockOf(shift.rOut);
    const w = shift?.wallet;
    return `
      <form class="sp-form stack" novalidate>
        <div class="grid2">
          <label class="field"><span>Prihod <em>(dejanski)</em></span><input type="time" name="in" value="${esc(s)}" required></label>
          <label class="field"><span>Odhod <em>(dejanski)</em></span><input type="time" name="out" value="${esc(e)}" required></label>
        </div>
        ${
          showRounded
            ? `<div class="rounded-box">
                <div class="rb-title">${icon('clock', 15)} Zaokrožene ure <em>(štejejo v statistiki, lahko jih urediš ročno)</em></div>
                <div class="grid2">
                  <label class="field"><span>Prihod</span><input type="time" name="rin" value="${esc(rs)}"></label>
                  <label class="field"><span>Odhod</span><input type="time" name="rout" value="${esc(re)}"></label>
                </div>
              </div>`
            : ''
        }
        <label class="field"><span>Opombe <em>(neobvezno)</em></span>
          <textarea name="note" rows="2" maxlength="300" placeholder="Npr. dodatno delo, zamenjava …">${esc(shift?.note || '')}</textarea></label>
        <label class="check-line"><input type="checkbox" name="wallet" ${w ? 'checked' : ''}><span class="box">${icon('check', 14, 3.4)}</span><span>Denarnica</span></label>
        <div class="wallet-box" ${w ? '' : 'hidden'}>
          <div class="grid2">
            <label class="field"><span>Predvideno denarja (€)</span><input name="wexp" type="text" inputmode="decimal" value="${w ? esc(w.exp) : ''}" placeholder="0,00"></label>
            <label class="field"><span>Oddano denarja (€)</span><input name="wpaid" type="text" inputmode="decimal" value="${w ? esc(w.paid) : ''}" placeholder="0,00"></label>
          </div>
          <div class="wallet-diff">Razlika: <b data-wdiff>–</b></div>
        </div>
        <div class="form-err" role="alert"></div>
        <div class="btn-row wrap">
          ${editing || adding ? '<button type="button" class="btn ghost" data-cancel-edit>Prekliči</button>' : ''}
          ${info.plan && !shift ? '<button type="button" class="btn ghost danger-text" data-cancel-shift>Odpovej izmeno</button>' : ''}
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
    const status = info.status;

    if (shift?.st === 'running') {
      body = `
        ${planLine(info)}
        <div class="sp-box">
          <p>Izmena <b>poteka</b> od <b>${clockOf(shift.inAt)}</b>${shift.rIn != null ? ` (zaokroženo ${clockOf(shift.rIn)})` : ''}. Odhod zabeležiš na domači strani.</p>
        </div>
        <div class="btn-row"><button class="btn primary" data-go-home>${icon('home', 18)} Na domačo stran</button></div>`;
    } else if (shift?.st === 'done' && !editing) {
      const diff = info.W - info.P;
      const hasR = shift.rIn != null || shift.rOut != null;
      body = `
        ${planLine(info)}
        <dl class="sp-rows">
          <div><dt>Prihod${hasR ? ' (dejanski)' : ''}</dt><dd>${clockOf(shift.inAt)}</dd></div>
          <div><dt>Odhod${hasR ? ' (dejanski)' : ''}</dt><dd>${clockOf(shift.outAt)}</dd></div>
          ${
            hasR
              ? `<div><dt>Prihod (zaokrožen)</dt><dd><b>${clockOf(effIn(shift))}</b></dd></div>
                 <div><dt>Odhod (zaokrožen)</dt><dd><b>${clockOf(effOut(shift))}</b></dd></div>`
              : ''
          }
          <div><dt>Opravljeno${hasR ? ' (zaokroženo)' : ''}</dt><dd><b>${fmtDur(info.W)}</b></dd></div>
          <div><dt>Razlika od plana</dt><dd class="diff ${info.status}">${info.P || diff ? fmtDurSigned(diff) : '0h 00m'}</dd></div>
          ${shift.wallet ? walletRows(shift.wallet) : ''}
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
        <p class="muted-text">Odpovedana izmena se v statistiki šteje kot minus ure (${fmtDur(info.P)}).</p>
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
      const reason = await askReason({ text: 'Izmena bo označena kot odpovedana (v statistiki šteje kot minus ure).' });
      if (!reason) return;
      api.setShift(k, { st: 'cancelled', reason, ps: info.plan?.s ?? null, pe: info.plan?.e ?? null, at: Date.now() });
      editing = false;
      adding = false;
      toast('Izmena odpovedana');
    });

    const form = q('.sp-form');
    if (!form) return;
    const plan = info.plan || (shift?.ps ? { s: shift.ps, e: shift.pe } : null);
    const psTs = plan ? tsOf(k, plan.s) : null;

    // dejanske ure -> trenutni časovni žigi
    const realTs = () => {
      if (!form.in.value) return null;
      const inTs = tsOf(k, form.in.value);
      let outTs = null;
      if (form.out.value) {
        outTs = tsOf(k, form.out.value);
        if (outTs <= inTs) outTs += 86400000;
      }
      return { inTs, outTs };
    };

    // ali so zaokrožene ure ročno spremenjene (potem jih samodejno ne prepisujemo)
    roundTouched = false;
    if (shift?.st === 'done' && (shift.rIn != null || shift.rOut != null)) {
      const calcIn = roundArrival(shift.inAt, psTs);
      const calcOut = Math.max(roundDeparture(shift.outAt), calcIn);
      roundTouched = (shift.rIn != null && shift.rIn !== calcIn) || (shift.rOut != null && shift.rOut !== calcOut);
    }
    const autoRound = () => {
      if (!form.rin || roundTouched) return;
      const t = realTs();
      const rIn = t ? roundArrival(t.inTs, psTs) : null;
      form.rin.value = rIn != null ? clockOf(rIn) : '';
      form.rout.value = t?.outTs ? clockOf(Math.max(roundDeparture(t.outTs), rIn)) : '';
    };
    if (form.rin && shift?.st !== 'done') autoRound();

    const wdiff = q('[data-wdiff]');
    const wbox = q('.wallet-box');
    const updateDiff = () => {
      const a = num(form.wexp.value);
      const b = num(form.wpaid.value);
      if (Number.isNaN(a) || Number.isNaN(b)) {
        wdiff.textContent = '–';
        wdiff.className = '';
        return;
      }
      const d = b - a;
      wdiff.textContent = `${d > 0 ? '+' : ''}${fmtMoney(d)}`;
      wdiff.className = d < 0 ? 'neg' : d > 0 ? 'pos' : '';
    };
    form.wallet.addEventListener('change', () => {
      wbox.hidden = !form.wallet.checked;
      if (form.wallet.checked) form.wexp.focus();
    });
    form.wexp.addEventListener('input', updateDiff);
    form.wpaid.addEventListener('input', updateDiff);
    updateDiff();

    form.addEventListener('input', (ev) => {
      dirty = true;
      const n = ev.target.name;
      if (n === 'rin' || n === 'rout') roundTouched = true;
      if (n === 'in' || n === 'out') autoRound();
    });

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

      let rIn = null;
      let rOut = null;
      if (form.rin) {
        if (form.rin.value) rIn = nearestTs(form.rin.value, inTs);
        if (form.rout.value) rOut = nearestTs(form.rout.value, outTs);
        if ((rIn ?? inTs) > (rOut ?? outTs)) return fail('Zaokrožen odhod mora biti po zaokroženem prihodu.');
      }

      let wallet = null;
      if (form.wallet.checked) {
        const exp = num(form.wexp.value);
        const paid = num(form.wpaid.value);
        if (Number.isNaN(exp) || Number.isNaN(paid) || exp < 0 || paid < 0) return fail('Pri denarnici vpiši predvideni in oddani znesek.');
        wallet = { exp: Math.round(exp * 100) / 100, paid: Math.round(paid * 100) / 100 };
      }

      api.setShift(k, {
        st: 'done',
        inAt: inTs,
        outAt: outTs,
        rIn,
        rOut,
        ps: plan?.s ?? null,
        pe: plan?.e ?? null,
        note: form.note.value.trim() || null,
        wallet,
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
