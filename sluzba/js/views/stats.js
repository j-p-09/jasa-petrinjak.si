// EviDelo – statistika: tedensko, mesečno, letno
import { icon } from '../icons.js';
import { st } from '../store.js';
import {
  addDays, addMonths, chartBuckets, esc, fmtDur, fmtMoney, hoursDec, periodRange, periodStats,
} from '../util.js';
import { h } from '../ui.js';

const MODES = [
  ['week', 'Teden'],
  ['month', 'Mesec'],
  ['year', 'Leto'],
];

function niceScale(maxH) {
  if (maxH <= 0) return { max: 8, step: 2 };
  for (const step of [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000]) {
    if (maxH / step <= 5) return { max: Math.ceil(maxH / step) * step, step };
  }
  return { max: Math.ceil(maxH), step: Math.ceil(maxH / 5) };
}

function chartSVG(buckets, mode) {
  const W = 640;
  const H = 250;
  const m = { l: 40, r: 8, t: 12, b: mode === 'week' ? 44 : 30 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const tot = (b) => (b.inPlan + b.over + b.under + b.pending) / 60;
  const { max, step } = niceScale(Math.max(...buckets.map(tot)));
  const y = (v) => m.t + ih - (v / max) * ih;
  const n = buckets.length;
  const slot = iw / n;
  const bw = mode === 'month' ? slot * 0.68 : Math.min(slot * 0.6, 40);
  let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Graf ur po obdobju">`;
  for (let v = 0; v <= max; v += step) {
    out += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="ytick" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}h</text>`;
  }
  const empty = buckets.every((b) => tot(b) === 0);
  buckets.forEach((b, i) => {
    const cx = m.l + slot * i + slot / 2;
    const x = cx - bw / 2;
    let cursor = 0;
    const segs = [
      ['inPlan', b.inPlan, 'seg-ok'],
      ['over', b.over, 'seg-over'],
      ['under', b.under, 'seg-under'],
      ['pending', b.pending, 'seg-pending'],
    ];
    let rects = '';
    for (const [, val, cls] of segs) {
      const hh = val / 60;
      if (hh <= 0) continue;
      const top = y(cursor + hh);
      rects += `<rect class="${cls}" x="${x}" y="${top}" width="${bw}" height="${y(cursor) - top}"/>`;
      cursor += hh;
    }
    const total = cursor;
    const label =
      mode === 'month'
        ? b.label === '1' || Number(b.label) % 5 === 0
          ? `<text class="xtick" x="${cx}" y="${H - 10}" text-anchor="middle">${b.label}</text>`
          : ''
        : `<text class="xtick" x="${cx}" y="${H - (mode === 'week' ? 24 : 10)}" text-anchor="middle">${b.label}</text>${
            mode === 'week' ? `<text class="xtick sub" x="${cx}" y="${H - 8}" text-anchor="middle">${b.sub}</text>` : ''
          }`;
    out += `<g class="slot" data-i="${i}">
      <rect class="hl" x="${m.l + slot * i}" y="${m.t}" width="${slot}" height="${ih}" rx="6"/>
      ${
        total > 0
          ? `<clipPath id="c${i}"><rect x="${x}" y="${y(total)}" width="${bw}" height="${y(0) - y(total)}" rx="${Math.min(4, bw / 2)}"/></clipPath><g clip-path="url(#c${i})">${rects}</g>`
          : `<rect class="seg-zero" x="${x}" y="${y(0) - 2}" width="${bw}" height="2" rx="1"/>`
      }
      ${label}
      <rect class="hit" x="${m.l + slot * i}" y="${m.t}" width="${slot}" height="${ih + m.b}"/>
    </g>`;
  });
  if (empty) out += `<text class="empty" x="${W / 2}" y="${m.t + ih / 2}" text-anchor="middle">Za to obdobje še ni podatkov</text>`;
  return `${out}</svg>`;
}

export function statsView({ navigate }) {
  let mode = 'month';
  let anchor = new Date();
  const el = h('<div class="view stats"></div>');

  function shift(dir) {
    if (mode === 'week') anchor = addDays(anchor, 7 * dir);
    else if (mode === 'month') anchor = addMonths(anchor, dir);
    else anchor = new Date(anchor.getFullYear() + dir, 0, 1);
  }

  function render() {
    const r = periodRange(mode, anchor);
    const s = periodStats(st, r.from, r.to);
    const rate = Number(st.user?.rate) || 0;
    const earned = (s.worked / 60) * rate; // plača se računa po OPRAVLJENIH (zaokroženih) urah
    const buckets = chartBuckets(st, mode, r.from, r.to);

    el.innerHTML = `
      <h1 class="page-title">Statistika</h1>
      <section class="card">
        <div class="seg-ctl" role="tablist">
          ${MODES.map(([k, l]) => `<button role="tab" class="${k === mode ? 'on' : ''}" data-mode="${k}">${l}</button>`).join('')}
        </div>
        <div class="period-nav">
          <button class="icon-btn" data-prev aria-label="Prejšnje obdobje">${icon('chevL')}</button>
          <button class="period-label cap" data-reset title="Pojdi na tekoče obdobje">${esc(r.label)}</button>
          <button class="icon-btn" data-next aria-label="Naslednje obdobje">${icon('chevR')}</button>
        </div>
      </section>

      <section class="tiles">
        <div class="tile t-ok"><span class="tl">Opravljene ure</span><b>${fmtDur(s.worked)}</b><span class="ts">${hoursDec(s.worked)} h</span></div>
        <div class="tile t-plan"><span class="tl">Predvidene ure</span><b>${fmtDur(s.planned)}</b><span class="ts">${hoursDec(s.planned)} h</span></div>
        <div class="tile t-over"><span class="tl">Nadure</span><b>${fmtDur(s.over)}</b><span class="ts">${hoursDec(s.over)} h</span></div>
        <div class="tile t-under"><span class="tl">Minus ure</span><b>${fmtDur(s.under)}</b><span class="ts">${hoursDec(s.under)} h</span></div>
      </section>
      ${
        s.cancelled || s.unlogged
          ? `<div class="mini-row">
              ${s.cancelled ? `<span class="chip cancelled">Odpovedane izmene: ${s.cancelled}</span>` : ''}
              ${s.unlogged ? `<span class="chip planned">Nevpisane izmene: ${s.unlogged}</span>` : ''}
            </div>`
          : ''
      }

      <section class="card money">
        <div class="money-ic">${icon('euro', 22)}</div>
        <div class="money-body">
          <span class="tl">Predvidena plača</span>
          <b>${fmtMoney(earned)}</b>
          ${
            rate > 0
              ? `<span class="ts">${hoursDec(s.worked)} h opravljenih ur × ${fmtMoney(rate)}/h</span>`
              : `<a class="ts link" href="#/profil">Nastavi urno postavko v profilu</a>`
          }
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Pregled ur</h2><div class="sub">${mode === 'week' ? 'po dnevih' : mode === 'month' ? 'po dnevih' : 'po mesecih'}</div></div></div>
        ${chartSVG(buckets, mode)}
        <div class="chart-cap" aria-live="polite">Tapni ali premakni miško čez stolpec za podrobnosti.</div>
        <div class="legend">
          <span><i class="dot s-ok"></i>V planu</span>
          <span><i class="dot s-over"></i>Nadure</span>
          <span><i class="dot s-under faded"></i>Minus ure</span>
          <span><i class="dot s-pending"></i>Še predvideno</span>
        </div>
      </section>`;

    el.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => {
      mode = b.dataset.mode;
      render();
    }));
    el.querySelector('[data-prev]').onclick = () => {
      shift(-1);
      render();
    };
    el.querySelector('[data-next]').onclick = () => {
      shift(1);
      render();
    };
    el.querySelector('[data-reset]').onclick = () => {
      anchor = new Date();
      render();
    };
    const cap = el.querySelector('.chart-cap');
    const pick = (slot) => {
      el.querySelectorAll('.slot.picked').forEach((x) => x.classList.remove('picked'));
      slot.classList.add('picked');
      const b = buckets[Number(slot.dataset.i)];
      const parts = [`<b>${esc(b.title)}</b>: ${fmtDur(b.worked)} opravljeno`];
      if (b.planned) parts.push(`plan ${fmtDur(b.planned)}`);
      if (b.over) parts.push(`nadure ${fmtDur(b.over)}`);
      if (b.under) parts.push(`minus ${fmtDur(b.under)}`);
      cap.innerHTML = parts.join(' · ');
    };
    el.querySelectorAll('.slot').forEach((sl) => {
      sl.addEventListener('click', () => pick(sl));
      sl.addEventListener('mouseenter', () => pick(sl));
    });
  }

  render();
  return { el, refresh: render };
}
