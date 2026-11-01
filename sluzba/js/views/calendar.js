// EviDelo – koledar: mesečni pregled, tedenski pregled in podrobnosti izmene
import { icon } from '../icons.js';
import { st } from '../store.js';
import { addMonths, dayInfo, daysInMonth, keyOf, monIdx, monthLabel, parseKey, startOfWeek, todayKey } from '../util.js';
import { h, openModal } from '../ui.js';
import { mountWeek } from '../weekstrip.js';
import { mountShiftPanel } from '../shiftpanel.js';

const HEAD = ['pon', 'tor', 'sre', 'čet', 'pet', 'sob', 'ned'];

export function calendarView({ navigate, params }) {
  const initial = params.d ? parseKey(params.d) : new Date();
  let monthCursor = new Date(initial.getFullYear(), initial.getMonth(), 1);
  let weekStartDate = startOfWeek(initial);
  let selected = params.d || null;
  let detail = null;

  const el = h(`
    <div class="view calendar">
      <h1 class="page-title">Koledar</h1>
      <section class="card" data-month></section>
      <section class="card" data-week></section>
    </div>`);

  function renderMonth() {
    const host = el.querySelector('[data-month]');
    const y = monthCursor.getFullYear();
    const m = monthCursor.getMonth();
    const lead = monIdx(new Date(y, m, 1));
    const n = daysInMonth(y, m);
    const tk = todayKey();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="mc-empty"></span>';
    for (let d = 1; d <= n; d++) {
      const k = keyOf(new Date(y, m, d));
      const info = dayInfo(k, st);
      cells += `<button class="mc s-${info.status} ${k === tk ? 'today' : ''} ${k === selected ? 'sel' : ''}" data-k="${k}" aria-label="${d}. ${m + 1}. ${y}"><span>${d}</span></button>`;
    }
    host.innerHTML = `
      <div class="card-head">
        <div><h2 class="cap">${monthLabel(monthCursor)}</h2></div>
        <div class="nav-btns">
          <button class="icon-btn" data-prev aria-label="Prejšnji mesec">${icon('chevL')}</button>
          <button class="icon-btn" data-next aria-label="Naslednji mesec">${icon('chevR')}</button>
        </div>
      </div>
      <div class="month-grid heads">${HEAD.map((x) => `<span>${x}</span>`).join('')}</div>
      <div class="month-grid">${cells}</div>
      <div class="legend">
        <span><i class="dot s-ok"></i>V skladu s planom</span>
        <span><i class="dot s-over"></i>Nadure</span>
        <span><i class="dot s-under"></i>Minus ure</span>
        <span><i class="dot s-cancelled"></i>Odpovedana</span>
        <span><i class="dot s-planned"></i>Predvidena</span>
      </div>`;
    host.querySelector('[data-prev]').onclick = () => {
      monthCursor = addMonths(monthCursor, -1);
      renderMonth();
    };
    host.querySelector('[data-next]').onclick = () => {
      monthCursor = addMonths(monthCursor, 1);
      renderMonth();
    };
    host.querySelectorAll('.mc').forEach((b) => (b.onclick = () => select(b.dataset.k)));
  }

  const week = mountWeek(el.querySelector('[data-week]'), {
    title: 'Teden',
    getStart: () => weekStartDate,
    setStart: (d) => (weekStartDate = d),
    selected: () => selected,
    onPick: (k) => select(k),
  });

  function select(k) {
    selected = k;
    weekStartDate = startOfWeek(parseKey(k));
    renderMonth();
    week.render();
    openDetail(k);
  }

  function openDetail(k) {
    if (detail) {
      detail.panel.setDate(k);
      return;
    }
    const box = h('<div class="detail"></div>');
    const panel = mountShiftPanel(box, {
      onNavigate: (to) => {
        detail?.modal.close();
        navigate(to);
      },
    });
    panel.setDate(k);
    const modal = openModal({
      title: 'Izmena',
      content: box,
      onClose: () => {
        detail = null;
      },
    });
    detail = { panel, modal };
  }

  renderMonth();
  if (selected) openDetail(selected);

  return {
    el,
    refresh() {
      renderMonth();
      week.render();
      detail?.panel.refresh();
    },
    destroy() {
      detail?.modal.close();
    },
  };
}
