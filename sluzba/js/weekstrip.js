// EviDelo – tedenski prikaz plana (skupen za domačo stran in koledar)
import { icon } from './icons.js';
import { DAY_ABBR, addDays, dayInfo, keyOf, shortTime, todayKey, weekDates, weekLabel } from './util.js';
import { st } from './store.js';

const statusIcon = (status) => {
  if (status === 'ok') return `<span class="wd-ic ok" title="V skladu s planom">${icon('check', 14, 3.2)}</span>`;
  if (status === 'over') return `<span class="wd-ic over" title="Nadure">${icon('check', 14, 3.2)}</span>`;
  if (status === 'under') return `<span class="wd-ic under" title="Minus ure">${icon('check', 14, 3.2)}</span>`;
  if (status === 'cancelled') return `<span class="wd-ic cancelled" title="Odpovedana">${icon('x', 14, 3.2)}</span>`;
  if (status === 'running') return '<span class="wd-live" title="Poteka"></span>';
  return '';
};

export function mountWeek(host, { title = 'Teden', getStart, setStart, selected = () => null, onPick }) {
  function render() {
    const start = getStart();
    const tk = todayKey();
    const sel = selected();
    const days = weekDates(start);
    host.innerHTML = `
      <div class="card-head">
        <div><h2>${title}</h2><div class="sub">${weekLabel(start)}</div></div>
        <div class="nav-btns">
          <button class="icon-btn" data-prev aria-label="Prejšnji teden">${icon('chevL')}</button>
          <button class="icon-btn" data-next aria-label="Naslednji teden">${icon('chevR')}</button>
        </div>
      </div>
      <div class="week-row">
        ${days
          .map((d) => {
            const k = keyOf(d);
            const info = dayInfo(k, st);
            const plan = info.shift?.ps ? { s: info.shift.ps, e: info.shift.pe } : info.plan;
            return `<button class="wd ${k === tk ? 'today' : ''} ${k === sel ? 'sel' : ''} s-${info.status}" data-k="${k}">
              <span class="wd-n">${DAY_ABBR[d.getDay()]}</span>
              <span class="wd-d">${d.getDate()}</span>
              <span class="wd-t">${plan ? `${shortTime(plan.s)}<br>${shortTime(plan.e)}` : '<span class="wd-free">prosto</span>'}</span>
              <span class="wd-slot">${statusIcon(info.status)}</span>
            </button>`;
          })
          .join('')}
      </div>`;
    host.querySelector('[data-prev]').onclick = () => {
      setStart(addDays(getStart(), -7));
      render();
    };
    host.querySelector('[data-next]').onclick = () => {
      setStart(addDays(getStart(), 7));
      render();
    };
    host.querySelectorAll('.wd').forEach((b) => (b.onclick = () => onPick?.(b.dataset.k)));
  }
  render();
  return { render };
}
