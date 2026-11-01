// EviDelo – urejanje tedenskega plana dela
import { icon } from '../icons.js';
import { st, api } from '../store.js';
import { DAY_ABBR, addDays, keyOf, startOfWeek, weekDates, weekLabel } from '../util.js';
import { h, toast } from '../ui.js';

export function planView({ navigate }) {
  let start = startOfWeek(new Date());
  const draft = {}; // datum -> {on, s, e}  (samo spremenjeno)
  const el = h('<div class="view plan"></div>');

  const getRow = (k) => {
    if (draft[k]) return draft[k];
    const p = st.plans[k];
    return p ? { on: true, s: p.s, e: p.e } : { on: false, s: '', e: '' };
  };
  const touch = (k) => (draft[k] ||= { ...getRow(k) });

  function render() {
    const days = weekDates(start);
    const dirty = Object.keys(draft).length;
    el.innerHTML = `
      <div class="page-top">
        <button class="back-btn" data-back aria-label="Nazaj">${icon('back', 22, 2.4)}<h1>Uredi plan</h1></button>
      </div>
      <section class="card week-nav">
        <button class="icon-btn" data-prev aria-label="Prejšnji teden">${icon('chevL')}</button>
        <div class="wn-label">${weekLabel(start)}</div>
        <button class="icon-btn" data-next aria-label="Naslednji teden">${icon('chevR')}</button>
      </section>
      <section class="card plan-card">
        ${days
          .map((d) => {
            const k = keyOf(d);
            const r = getRow(k);
            return `<div class="plan-row ${r.on ? 'on' : ''}" data-k="${k}">
              <div class="pr-day"><b>${DAY_ABBR[d.getDay()]}</b><span>${d.getDate()}.${d.getMonth() + 1}.</span></div>
              <label class="switch" aria-label="Delaš ta dan"><input type="checkbox" ${r.on ? 'checked' : ''}><i></i></label>
              <input type="time" name="s" value="${r.s}" ${r.on ? '' : 'disabled'} aria-label="Začetek">
              <input type="time" name="e" value="${r.e}" ${r.on ? '' : 'disabled'} aria-label="Konec">
            </div>`;
          })
          .join('')}
        <button class="link-btn left" data-copy>${icon('copy', 16)} Kopiraj prejšnji teden</button>
      </section>
      ${dirty ? '<div class="unsaved">Imaš neshranjene spremembe.</div>' : ''}
      <button class="btn primary big full" data-save>Shrani plan</button>`;

    el.querySelector('[data-back]').onclick = () => navigate('#/profil');
    el.querySelector('[data-prev]').onclick = () => {
      start = addDays(start, -7);
      render();
    };
    el.querySelector('[data-next]').onclick = () => {
      start = addDays(start, 7);
      render();
    };
    el.querySelector('[data-copy]').onclick = () => {
      weekDates(start).forEach((d, i) => {
        const prev = getRow(keyOf(addDays(d, -7)));
        draft[keyOf(d)] = { ...prev };
      });
      render();
    };

    el.querySelectorAll('.plan-row').forEach((row) => {
      const k = row.dataset.k;
      const cb = row.querySelector('input[type=checkbox]');
      const s = row.querySelector('[name=s]');
      const e = row.querySelector('[name=e]');
      cb.onchange = () => {
        const r = touch(k);
        r.on = cb.checked;
        if (r.on && !r.s && !r.e) {
          // privzete ure: prvi vklopljen dan v tem tednu, sicer 8:00–16:00
          const ref = weekDates(start).map((d) => getRow(keyOf(d))).find((x) => x.on && x.s && x.e);
          r.s = ref?.s || '08:00';
          r.e = ref?.e || '16:00';
        }
        render();
      };
      s.oninput = () => (touch(k).s = s.value);
      e.oninput = () => (touch(k).e = e.value);
    });

    el.querySelector('[data-save]').onclick = () => {
      let bad = null;
      for (const [k, r] of Object.entries(draft)) {
        if (r.on && (!r.s || !r.e || r.s === r.e)) {
          bad = k;
          break;
        }
      }
      if (bad) {
        toast('Pri vklopljenih dnevih vpiši uro začetka in konca (različni).', 'err');
        const d = new Date(bad.split('-')[0], bad.split('-')[1] - 1, bad.split('-')[2]);
        start = startOfWeek(d);
        render();
        el.querySelector(`[data-k="${bad}"]`)?.classList.add('bad');
        return;
      }
      let n = 0;
      for (const [k, r] of Object.entries(draft)) {
        if (r.on) api.setPlan(k, { s: r.s, e: r.e });
        else if (st.plans[k]) api.setPlan(k, null);
        else continue;
        n++;
        delete draft[k];
      }
      Object.keys(draft).forEach((k) => delete draft[k]);
      toast(n ? 'Plan shranjen' : 'Ni sprememb za shranjevanje', n ? 'ok' : 'info');
      render();
    };
  }

  render();
  return {
    el,
    refresh() {
      if (!Object.keys(draft).length) render();
    },
  };
}
