// EviDelo – domača stran: pozdrav, obroč izmene, tedenski plan
import { icon } from '../icons.js';
import { st, api } from '../store.js';
import { STALE_RUNNING_MS } from '../config.js';
import {
  DAY_NAMES, MIN, MONTHS, clockOf, dayInfo, durMin, esc, fmtDur, fmtDurSigned, keyOf, ringModel, shortTime,
  startOfWeek, todayKey, tsOf, pad,
} from '../util.js';
import { askReason, askTime, confirmDialog, h, toast } from '../ui.js';
import { mountWeek } from '../weekstrip.js';

const R = 92;
const ringSVG = (segs) => `
  <svg class="ring" viewBox="0 0 220 220" aria-hidden="true">
    <circle class="track" cx="110" cy="110" r="${R}" />
    <g transform="rotate(-90 110 110)">
      ${segs
        .map(
          (s) =>
            `<circle class="seg ${s.color}" cx="110" cy="110" r="${R}" pathLength="100" stroke-dasharray="${Math.max(0.01, (s.to - s.from) * 100)} 100" stroke-dashoffset="${-s.from * 100}" />`
        )
        .join('')}
    </g>
  </svg>`;

function findRunning() {
  for (const k of Object.keys(st.shifts)) if (st.shifts[k]?.st === 'running') return { k, ...st.shifts[k] };
  return null;
}

export function homeView({ navigate }) {
  const el = h(`
    <div class="view home">
      <header class="home-head">
        <div class="greet"><span>Pozdravljen/-a,</span><h1 data-name></h1></div>
        <div class="now"><div class="now-time" data-time></div><div class="now-date" data-date></div></div>
      </header>
      <section class="ring-card" data-card></section>
      <section class="card" data-week></section>
    </div>`);
  const $ = (s) => el.querySelector(s);
  let weekStartDate = startOfWeek(new Date());
  let lastHtml = '';
  let staleAsked = null;

  const week = mountWeek($('[data-week]'), {
    title: 'Tedenski plan',
    getStart: () => weekStartDate,
    setStart: (d) => (weekStartDate = d),
    selected: () => todayKey(),
    onPick: (k) => navigate(`#/koledar?d=${k}`),
  });

  function viewModel(now) {
    const tk = keyOf(new Date(now));
    const running = findRunning();
    if (running) return { mode: now - running.inAt > STALE_RUNNING_MS ? 'stale' : 'running', k: running.k, shift: running };
    const info = dayInfo(tk, st, now);
    if (info.status === 'cancelled') return { mode: 'cancelled', k: tk, shift: info.shift, info };
    if (info.shift?.st === 'done') return { mode: 'done', k: tk, shift: info.shift, info };
    if (info.plan) return { mode: 'planned', k: tk, plan: info.plan, info };
    return { mode: 'free', k: tk, info };
  }

  function renderCard() {
    const now = Date.now();
    const vm = viewModel(now);
    let segs = [];
    let centerIcon = 'briefcase';
    let big = '';
    let small = '';
    let tiny = '';
    let info = '';
    let actions = '';
    let tone = '';

    if (vm.mode === 'planned') {
      const { plan } = vm;
      const P = durMin(plan.s, plan.e);
      const m = ringModel({ planStartTs: tsOf(vm.k, plan.s), P, inTs: null, endTs: now });
      segs = m.segs;
      big = `${shortTime(plan.s)} – ${shortTime(plan.e)}`;
      small = `predviden plan · ${fmtDur(P)}`;
      if (m.lateMin > 0) info = `<div class="note-line orange">${icon('clock', 16)} Zamujaš ${m.lateMin} min</div>`;
      else {
        const until = Math.round((tsOf(vm.k, plan.s) - now) / MIN);
        info = `<div class="note-line">${icon('clock', 16)} Začetek ${until > 0 ? `čez ${fmtDur(until)}` : 'zdaj'}</div>`;
      }
      actions = `
        <button class="btn primary big" data-act="in">${icon('login', 20)} Prihod na delo</button>
        <button class="btn outline-light" data-act="cancel">${icon('ban', 18)} Odpovej izmeno</button>`;
    } else if (vm.mode === 'running' || vm.mode === 'stale') {
      const sh = vm.shift;
      const P = durMin(sh.ps, sh.pe);
      const m = ringModel({ planStartTs: tsOf(vm.k, sh.ps), P, inTs: sh.inAt, endTs: now });
      segs = m.segs;
      big = fmtDur(m.worked);
      small = `od ${shortTime(clockOf(sh.inAt))}`;
      tiny = `plan ${shortTime(sh.ps)} – ${shortTime(sh.pe)}`;
      const over = m.worked - P;
      if (m.lateMin > 0) info += `<div class="note-line orange">${icon('clock', 16)} Zamuda ob prihodu: ${m.lateMin} min</div>`;
      if (over > 0) info += `<div class="note-line blue">${icon('plus', 16)} Nadure: ${fmtDur(over)}</div>`;
      else if (P) info += `<div class="note-line">${icon('clock', 16)} Do konca plana še ${fmtDur(Math.max(0, P - m.worked))}</div>`;
      actions = `<button class="btn danger big" data-act="out">${icon('logout', 20)} Odhod iz dela</button>`;
    } else if (vm.mode === 'done') {
      const { shift, info: di } = vm;
      const P = di.P;
      const m = ringModel({ planStartTs: tsOf(vm.k, shift.ps || '00:00'), P, inTs: shift.inAt, endTs: shift.outAt });
      segs = m.segs;
      centerIcon = 'circleCheck';
      big = fmtDur(di.W);
      small = `${clockOf(shift.inAt)} – ${clockOf(shift.outAt)}`;
      tone = di.status;
      const diff = di.W - di.P;
      const label = di.status === 'ok' ? 'V skladu s planom' : di.status === 'over' ? `Nadure ${fmtDurSigned(diff)}` : `Minus ure ${fmtDurSigned(diff)}`;
      info = `<div class="note-line ${di.status}">${icon('check', 16, 3)} Izmena zaključena · ${label}</div>`;
    } else if (vm.mode === 'cancelled') {
      segs = [{ from: 0, to: 1, color: 'red' }];
      centerIcon = 'circleX';
      big = 'Odpovedana';
      small = 'današnja izmena';
      tone = 'cancelled';
      info = `<div class="note-line red">${icon('ban', 16)} ${esc(vm.shift.reason || '')}</div>
        <div class="note-line under">Šteje kot minus ure: ${fmtDur(vm.info.P)}</div>`;
    } else {
      centerIcon = 'coffee';
      big = 'Prost dan';
      small = 'danes ni plana dela';
      info = `<div class="note-line">Dodatno delo lahko vpišeš v zavihku <b>Vpis dela</b>.</div>`;
    }

    const html = `
      <div class="ring-box ${tone}">
        ${ringSVG(segs)}
        <div class="ring-center">
          <div class="ring-ic ${tone}">${icon(centerIcon, 26, 2)}</div>
          <div class="ring-big ${vm.mode === 'planned' || vm.mode === 'free' || vm.mode === 'cancelled' ? 'plan' : ''}">${esc(big)}</div>
          <div class="ring-small">${esc(small)}</div>
          ${tiny ? `<div class="ring-tiny">${esc(tiny)}</div>` : ''}
        </div>
      </div>
      <div class="ring-side">
        <div class="ring-info">${info}</div>
        <div class="ring-actions">${actions}</div>
      </div>`;
    if (html !== lastHtml) {
      lastHtml = html;
      $('[data-card]').innerHTML = html;
    }
    if (vm.mode === 'stale' && staleAsked !== vm.k) {
      staleAsked = vm.k;
      resolveStale(vm);
    }
  }

  async function resolveStale(vm) {
    const sh = vm.shift;
    const r = await askTime({
      title: 'Pozabljen odhod',
      text: `Izmena z dne ${sh.ps ? vm.k.split('-').reverse().join('. ') : ''} je še vedno odprta (prihod ob ${clockOf(sh.inAt)}). Vpiši, ob kateri uri si odšel/-la.`,
      value: sh.pe || '',
      okText: 'Shrani odhod',
      extra: 'Zavrži izmeno',
    });
    if (!r) return;
    if (r.discard) {
      api.setShift(vm.k, null);
      return;
    }
    const base = new Date(sh.inAt);
    const [hh, mm] = r.time.split(':').map(Number);
    let out = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm).getTime();
    if (out <= sh.inAt) out += 86400000;
    out = Math.min(out, Date.now());
    const orig = st.shifts[vm.k];
    if (!orig) return;
    api.setShift(vm.k, { ...orig, st: 'done', outAt: out, manual: true });
    toast('Odhod shranjen', 'ok');
  }

  function renderClock() {
    const d = new Date();
    $('[data-time]').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    $('[data-date]').textContent = `${DAY_NAMES[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
    $('[data-name]').textContent = st.user?.ime || '';
  }

  // dejanja (delegacija dogodkov)
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const now = Date.now();
    const vm = viewModel(now);
    if (b.dataset.act === 'in' && vm.mode === 'planned') {
      api.setShift(vm.k, { st: 'running', inAt: now, ps: vm.plan.s, pe: vm.plan.e });
      toast(`Prihod zabeležen ob ${clockOf(now)}`, 'ok');
    } else if (b.dataset.act === 'out' && (vm.mode === 'running' || vm.mode === 'stale')) {
      const ok = await confirmDialog({ title: 'Odhod iz dela', text: `Zabeležim odhod ob ${clockOf(Date.now())}?`, okText: 'Odhod' });
      if (!ok) return;
      const sh = st.shifts[vm.k];
      if (!sh || sh.st !== 'running') return;
      api.setShift(vm.k, { ...sh, st: 'done', outAt: Date.now() });
      toast('Odhod zabeležen. Dober počitek!', 'ok');
    } else if (b.dataset.act === 'cancel' && vm.mode === 'planned') {
      const reason = await askReason({ text: 'Današnja izmena bo označena kot odpovedana.' });
      if (!reason) return;
      api.setShift(vm.k, { st: 'cancelled', reason, ps: vm.plan.s, pe: vm.plan.e, at: Date.now() });
      toast('Izmena odpovedana');
    }
  });

  renderClock();
  renderCard();
  const timer = setInterval(() => {
    renderClock();
    renderCard();
  }, 1000);
  const onVis = () => {
    renderClock();
    renderCard();
  };
  document.addEventListener('visibilitychange', onVis);

  return {
    el,
    refresh() {
      renderClock();
      renderCard();
      week.render();
    },
    destroy() {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
