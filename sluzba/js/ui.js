// EviDelo – skupni UI gradniki: modalna okna, obvestila, statusi.
import { icon } from './icons.js';
import { esc } from './util.js';

export const STATUS = {
  ok: { label: 'V skladu s planom', short: 'Po planu' },
  over: { label: 'Nadure', short: 'Nadure' },
  under: { label: 'Minus ure', short: 'Minus' },
  cancelled: { label: 'Odpovedana', short: 'Odpovedana' },
  running: { label: 'Poteka', short: 'Poteka' },
  planned: { label: 'Predvidena', short: 'Predvidena' },
  free: { label: 'Prost dan', short: 'Prosto' },
};

export const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

// ---------- modalna okna ----------
let openCount = 0;
export function openModal({ title = '', content, onClose, wide = false }) {
  const back = h(`
    <div class="modal-back">
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal-grab"></div>
        <div class="modal-head"><h2>${esc(title)}</h2>
          <button class="icon-btn" data-close aria-label="Zapri">${icon('x', 20)}</button></div>
        <div class="modal-body"></div>
      </div>
    </div>`);
  const body = back.querySelector('.modal-body');
  if (content) body.append(content);
  document.body.append(back);
  openCount++;
  document.body.classList.add('lock');
  requestAnimationFrame(() => back.classList.add('in'));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    back.classList.remove('in');
    setTimeout(() => {
      back.remove();
      openCount = Math.max(0, openCount - 1);
      if (!openCount) document.body.classList.remove('lock');
    }, 200);
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  back.addEventListener('click', (e) => {
    if (e.target === back || e.target.closest('[data-close]')) close();
  });
  return { close, body, el: back };
}

export function confirmDialog({ title, text, okText = 'Potrdi', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const c = h(`<div class="stack">
      <p class="muted-text">${esc(text)}</p>
      <div class="btn-row">
        <button class="btn ghost" data-no>Prekliči</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(okText)}</button>
      </div></div>`);
    const m = openModal({ title, content: c, onClose: () => resolve(result) });
    c.querySelector('[data-no]').onclick = () => m.close();
    c.querySelector('[data-yes]').onclick = () => {
      result = true;
      m.close();
    };
  });
}

export function askReason({ title = 'Odpoved izmene', text = '', label = 'Razlog odpovedi', okText = 'Odpovej izmeno' }) {
  return new Promise((resolve) => {
    let result = null;
    const c = h(`<div class="stack">
      ${text ? `<p class="muted-text">${esc(text)}</p>` : ''}
      <label class="field"><span>${esc(label)} <em>(obvezno)</em></span>
        <textarea rows="3" maxlength="300" placeholder="Npr. bolezen, dopust, dogovor z delodajalcem …"></textarea></label>
      <div class="btn-row">
        <button class="btn ghost" data-no>Nazaj</button>
        <button class="btn danger" data-yes disabled>${esc(okText)}</button>
      </div></div>`);
    const ta = c.querySelector('textarea');
    const yes = c.querySelector('[data-yes]');
    ta.addEventListener('input', () => (yes.disabled = !ta.value.trim()));
    const m = openModal({ title, content: c, onClose: () => resolve(result) });
    setTimeout(() => ta.focus(), 250);
    c.querySelector('[data-no]').onclick = () => m.close();
    yes.onclick = () => {
      result = ta.value.trim();
      m.close();
    };
  });
}

export function askTime({ title, text, value = '', okText = 'Shrani', extra = null }) {
  return new Promise((resolve) => {
    let result = null;
    const c = h(`<div class="stack">
      <p class="muted-text">${esc(text)}</p>
      <label class="field"><span>Ura odhoda</span><input type="time" value="${esc(value)}" required></label>
      <div class="btn-row">
        ${extra ? `<button class="btn ghost" data-extra>${esc(extra)}</button>` : ''}
        <button class="btn primary" data-yes>${esc(okText)}</button>
      </div></div>`);
    const inp = c.querySelector('input');
    const m = openModal({ title, content: c, onClose: () => resolve(result) });
    c.querySelector('[data-yes]').onclick = () => {
      if (!inp.value) return inp.focus();
      result = { time: inp.value };
      m.close();
    };
    const ex = c.querySelector('[data-extra]');
    if (ex)
      ex.onclick = () => {
        result = { discard: true };
        m.close();
      };
  });
}

// ---------- obvestila ----------
export function toast(msg, type = 'info') {
  let box = document.querySelector('.toasts');
  if (!box) {
    box = h('<div class="toasts" aria-live="polite"></div>');
    document.body.append(box);
  }
  const t = h(`<div class="toast ${type}">${esc(msg)}</div>`);
  box.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => {
    t.classList.remove('in');
    setTimeout(() => t.remove(), 250);
  }, 3200);
}

export const chip = (status, text) => `<span class="chip ${status}">${esc(text ?? STATUS[status].label)}</span>`;
