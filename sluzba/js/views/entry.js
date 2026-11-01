// EviDelo – vpis dela (ročni vpis)
import { icon } from '../icons.js';
import { addDays, keyOf, parseKey, todayKey } from '../util.js';
import { h } from '../ui.js';
import { mountShiftPanel } from '../shiftpanel.js';

export function entryView({ navigate, params }) {
  let date = params.d || todayKey();
  const el = h(`
    <div class="view entry">
      <h1 class="page-title">Vpis dela</h1>
      <section class="card">
        <div class="date-pick">
          <button class="icon-btn" data-prev aria-label="Prejšnji dan">${icon('chevL')}</button>
          <label class="date-field"><span>Datum</span><input type="date" data-date></label>
          <button class="icon-btn" data-next aria-label="Naslednji dan">${icon('chevR')}</button>
        </div>
        <button class="link-btn" data-today>Danes</button>
      </section>
      <section class="card" data-panel></section>
    </div>`);
  const input = el.querySelector('[data-date]');
  const panel = mountShiftPanel(el.querySelector('[data-panel]'), { onNavigate: navigate });

  function setDate(k) {
    date = k;
    input.value = k;
    panel.setDate(k);
  }
  input.onchange = () => input.value && setDate(input.value);
  el.querySelector('[data-prev]').onclick = () => setDate(keyOf(addDays(parseKey(date), -1)));
  el.querySelector('[data-next]').onclick = () => setDate(keyOf(addDays(parseKey(date), 1)));
  el.querySelector('[data-today]').onclick = () => setDate(todayKey());
  setDate(date);

  return { el, refresh: () => panel.refresh() };
}
