/* =====================================================================
   FanCM renewal · shared.js — bits every screen uses
   theme · segmented control thumb · button label swap · small helpers
   ===================================================================== */
window.FanCM = (() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // ---------- theme ----------
  function initTheme(btn) {
    const root = document.documentElement;
    try {
      const saved = localStorage.getItem('fancm.theme');
      if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
    } catch {}
    btn?.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('fancm.theme', next); } catch {}
    });
  }

  // ---------- segmented control: a thumb slides under the checked option ----------
  // Markup: <div class="seg"><button role="radio" aria-checked="true">A</button>…</div>
  function initSeg(seg, onChange) {
    if (!seg || seg.classList.contains('has-thumb')) return;
    const thumb = document.createElement('span');
    thumb.className = 'seg-thumb';
    seg.prepend(thumb);
    seg.classList.add('has-thumb');
    const place = (btn) => {
      thumb.style.setProperty('--x', btn.offsetLeft + 'px');
      thumb.style.setProperty('--w', btn.offsetWidth + 'px');
    };
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('[role="radio"]');
      if (!btn || btn.getAttribute('aria-checked') === 'true') return;
      $$('[role="radio"]', seg).forEach(b => b.setAttribute('aria-checked', String(b === btn)));
      place(btn);
      onChange?.(btn.dataset.value ?? btn.textContent.trim(), btn);
    });
    const current = () => $('[aria-checked="true"]', seg);
    place(current());
    document.fonts?.ready.then(() => place(current()));
    return { set(value) { const b = $$('[role="radio"]', seg).find(b => (b.dataset.value ?? b.textContent.trim()) === value); if (b) { $$('[role="radio"]', seg).forEach(x => x.setAttribute('aria-checked', String(x === b))); place(b); } } };
  }

  // ---------- button label swap with a blur crossfade ----------
  function setButtonLabel(btn, html) {
    const label = $('.btn-label', btn) || btn;
    if (label.innerHTML === html) return;
    if (reduceMotion.matches) { label.innerHTML = html; return; }
    btn.classList.add('swapping');
    setTimeout(() => { label.innerHTML = html; btn.classList.remove('swapping'); }, 110);
  }

  // ---------- chip content swap (status chips change state, not just text) ----------
  function setChip(chip, kind, icon, text) {
    const apply = () => {
      chip.className = 'chip ' + kind + (chip.dataset.size ? ' ' + chip.dataset.size : '');
      chip.innerHTML = `<svg class="ic sm"><use href="#${icon}"/></svg><span>${text}</span>`;
    };
    if (reduceMotion.matches || !chip.firstChild) { apply(); return; }
    chip.classList.add('swapping');
    setTimeout(() => { apply(); }, 100);
  }

  // ---------- toast ----------
  let toastHost;
  function toast(text, kind = '') {
    if (!toastHost) { toastHost = document.createElement('div'); toastHost.className = 'toasts'; document.body.appendChild(toastHost); }
    const el = document.createElement('div');
    el.className = 'toast entering' + (kind ? ' ' + kind : '');
    el.textContent = text;
    toastHost.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('entering')));
    setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 200); }, 2600);
  }

  const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const hhmmss = (t = new Date()) => t.toTimeString().slice(0, 8);

  return { $, $$, reduceMotion, wait, initTheme, initSeg, setButtonLabel, setChip, toast, fmt, hhmmss };
})();
