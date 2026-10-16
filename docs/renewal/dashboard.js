/* =====================================================================
   FanCM renewal · dashboard.js — Dashboard screen

   Real here: layout, selection, filters, grid/list, write lifecycle UI.
   Stand-in: the poll loop and the write queue are simulated. To wire the
   real bus, replace `pollCycle()` with readInputRegisterWithTimeout() calls
   and `processWriteQueue()` with writeRegister() (see CLAUDE.md rules —
   never call writer.write() directly).
   ===================================================================== */
(() => {
  'use strict';
  const { $, $$, reduceMotion, wait, initTheme, initSeg, setButtonLabel, setChip, toast, fmt, hhmmss } = FanCM;

  // ------------------------------------------------------------------
  // Session (from the Connect screen) and demo fallback
  // ------------------------------------------------------------------
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem('fancm.session') || 'null'); } catch {}

  const MODELS = {
    M: { name: 'EC-FAN M', badge: 'm', group: 'Supply air group', meta: 'Modbus RTU + CANopen tunnel · FW 1.0.8', max: 1600 },
    S: { name: 'EC-FAN S', badge: 's', group: 'Roof units', meta: 'Modbus RTU only · no CANopen, no fast update', max: 1400 },
    U: { name: 'Unidentified', badge: 'u', group: 'Unidentified', meta: 'found by scan', max: 1600 },
  };

  const DEMO = [
    { id: 7,  name: 'Supply Fan 1',  model: 'M', serial: '24A0012', mode: 'rpm', setpoint: 1250, actual: 1245, status: 'running', monitors: [['Iq', '2.4 A'], ['Temp', '41 °C']], write: { state: 'confirmed', at: '12:03:41' } },
    { id: 8,  name: 'Supply Fan 2',  model: 'M', serial: '24A0013', mode: 'rpm', setpoint: 1250, actual: 1248, status: 'running', monitors: [['Iq', '2.4 A'], ['Temp', '41 °C']] },
    { id: 9,  name: 'Supply Fan 3',  model: 'M', serial: '24A0014', mode: 'rpm', setpoint: 1250, actual: 980,  status: 'running', monitors: [['Iq', '2.1 A'], ['Temp', '39 °C']] },
    { id: 10, name: 'Exhaust Fan 1', model: 'M', serial: '24A0021', mode: 'rpm', setpoint: 1250, actual: 0,    status: 'alarm', alarm: { code: 'E12', text: 'Over temperature' }, monitors: [['Temp', '92 °C']] },
    { id: 21, name: 'Roof Fan A',    model: 'S', serial: null,      mode: 'pct', setpoint: 62.5, actual: 62.5, status: 'running', limit: 'Current limit active', monitors: [['Iq', '4.8 A']] },
    { id: 22, name: 'Roof Fan B',    model: 'S', serial: null,      mode: 'pct', setpoint: 40,   actual: 0,    status: 'offline', monitors: [] },
    { id: 12, name: 'Slave 12',      model: 'U', serial: null,      mode: 'rpm', setpoint: 0,    actual: 0,    status: 'stopped', monitors: [] },
  ];

  function fromSession(list) {
    return list.map(d => ({
      id: d.id, name: `Fan ${d.id}`, model: d.model || 'U', serial: d.serial || null,
      mode: d.model === 'S' ? 'pct' : 'rpm', setpoint: 0, actual: 0, status: 'stopped', monitors: [],
    }));
  }

  const state = {
    // Came from the Connect screen → use what it found (even nothing). Opened directly → demo data.
    devices: (session ? fromSession(session.devices || []) : DEMO).map(normalize),
    selected: new Set(),
    filter: 'all',
    query: '',
    view: 'grid',
    live: true,
    queue: [],          // [{ id, value }]  value in the device's own unit
    stats: { req: 0, ok: 0, err: 0 },
    cycleMs: 0,
    timer: null,
    port: session ? { label: session.portLabel || 'Port 1', ...session.serial } : { label: 'COM3', baudRate: 115200, dataBits: 8, parity: 'none', stopBits: 1 },
    simulator: session?.simulator ?? true,
  };

  function normalize(d) {
    const now = Date.now();
    return {
      write: null, limit: null, alarm: null, unit: d.mode, ...d,
      max: MODELS[d.model].max,
      lastSeen: d.status === 'offline' ? now - 42_000 : now,
      retries: d.status === 'offline' ? 3 : 0,
      pending: null,       // setpoint waiting in the queue
    };
  }

  // ------------------------------------------------------------------
  // Units
  // ------------------------------------------------------------------
  const toUnit = (dev, value, unit) => unit === dev.mode ? value : (unit === 'pct' ? value / dev.max * 100 : value / 100 * dev.max);
  const fromUnit = (dev, value, unit) => unit === dev.mode ? value : (unit === 'pct' ? value / 100 * dev.max : value / dev.max * 100);
  const fmtVal = (dev, v, unit = dev.unit) => unit === 'pct' ? fmt(v, 1) : fmt(Math.round(v));
  const unitLabel = (u) => u === 'pct' ? '%' : 'RPM';
  const ratio = (dev, v) => Math.max(0, Math.min(1, dev.mode === 'pct' ? v / 100 : v / dev.max));

  // ------------------------------------------------------------------
  // Shell
  // ------------------------------------------------------------------
  initTheme($('#themeBtn'));
  initSeg($('#roleSeg'), (role) => {
    $$('.rail-item[data-role]').forEach(b => { b.hidden = !(role === 'manufacture' || b.dataset.role === role); });
  });
  initSeg($('#viewSeg'), (v) => { state.view = v; renderView(); });
  const bulkUnitSeg = initSeg($('#bulkUnit'), (u) => { state.bulkUnit = u; });
  state.bulkUnit = 'rpm';

  const parityChar = { none: 'N', even: 'E', odd: 'O' };
  const portText = () => `${state.port.label} · ${state.port.baudRate} ${state.port.dataBits}${parityChar[state.port.parity] || 'N'}${state.port.stopBits}`;
  $('#portChipText').textContent = portText();
  $('#portInfo').innerHTML = [
    ['Port', state.port.label], ['Baud', state.port.baudRate], ['Framing', `${state.port.dataBits}${parityChar[state.port.parity] || 'N'}${state.port.stopBits}`],
    ['Mode', state.simulator ? 'Simulator' : 'Web Serial'],
  ].map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');

  // Port popover
  const portPop = $('#portPop');
  function openPop(pop, anchor) {
    pop.hidden = false; pop.classList.add('entering'); anchor?.setAttribute('aria-expanded', 'true');
    void pop.offsetWidth; pop.classList.remove('entering');
  }
  function closePop(pop, anchor) {
    if (pop.hidden) return;
    pop.classList.add('leaving'); anchor?.setAttribute('aria-expanded', 'false');
    setTimeout(() => { pop.hidden = true; pop.classList.remove('leaving'); }, reduceMotion.matches ? 0 : 100);
  }
  $('#portChip').addEventListener('click', () => portPop.hidden ? openPop(portPop, $('#portChip')) : closePop(portPop, $('#portChip')));
  document.addEventListener('pointerdown', (e) => {
    if (!portPop.hidden && !e.target.closest('.pop-anchor')) closePop(portPop, $('#portChip'));
    if (!menu.hidden && !e.target.closest('#menu')) closeMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePop(portPop, $('#portChip')); closeMenu(); clearSelection(); } });
  $('#disconnectBtn').addEventListener('click', () => { try { sessionStorage.removeItem('fancm.session'); } catch {} location.href = 'index.html'; });
  $('#reconnectBtn').addEventListener('click', () => { closePop(portPop, $('#portChip')); toast('Port reopened'); });

  // Live watch
  $('#liveBtn').addEventListener('click', (e) => {
    state.live = !state.live;
    e.currentTarget.setAttribute('aria-checked', String(state.live));
    $('.switch', e.currentTarget).classList.toggle('on', state.live);
    if (state.live) startPolling(); else stopPolling();
  });

  // Stats
  $('#statsClear').addEventListener('click', () => { state.stats = { req: 0, ok: 0, err: 0 }; renderStats(); });
  function renderStats() {
    const { req, ok, err } = state.stats;
    const rate = req ? (ok / req * 100) : null;
    $('#stOk').textContent = fmt(ok); $('#stErr').textContent = fmt(err);
    $('#stRate').textContent = rate === null ? '—' : rate.toFixed(2) + '%';
    $('#tReq').textContent = fmt(req); $('#tOk').textContent = fmt(ok); $('#tErr').textContent = fmt(err);
    $('#tRate').textContent = rate === null ? '—' : rate.toFixed(2) + '%';
    $('#tErrN').textContent = req ? (err / req * 1000).toFixed(1) : '0';
  }

  // ------------------------------------------------------------------
  // Filters
  // ------------------------------------------------------------------
  const FILTERS = [
    { key: 'all', label: 'All', count: d => true },
    { key: 'model:M', badge: 'm', label: 'EC-FAN M', count: d => d.model === 'M' },
    { key: 'model:S', badge: 's', label: 'EC-FAN S', count: d => d.model === 'S' },
    { key: 'model:U', badge: 'u', label: 'Unidentified', count: d => d.model === 'U' },
    { sep: true },
    { key: 'running', icon: 'i-play', cls: 'c-ok', label: 'Running', count: d => d.status === 'running' },
    { key: 'alarm', icon: 'i-warn', cls: 'c-err', label: 'Alarm', count: d => d.status === 'alarm' },
    { key: 'offline', icon: 'i-off', cls: 'c-off', label: 'Offline', count: d => d.status === 'offline' },
  ];
  function renderFilters() {
    const host = $('#filters');
    const html = FILTERS.map(f => f.sep ? `<span class="vsep"></span>` :
      `<button class="chip ${f.cls || ''}" role="radio" aria-checked="${state.filter === f.key}" data-filter="${f.key}">` +
      (f.badge ? `<span class="badge ${f.badge}">${f.label}</span>` : f.icon ? `<svg class="ic"><use href="#${f.icon}"/></svg>${f.label}` : f.label) +
      ` <b>${state.devices.filter(f.count).length}</b></button>`).join('');
    if (host.dataset.sig === html) return; // polled every cycle; only touch the DOM when a count changed
    host.dataset.sig = html;
    host.innerHTML = html;
  }
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]'); if (!b) return;
    state.filter = b.dataset.filter;
    $$('[data-filter]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    applyFilter();
  });
  $('#search').addEventListener('input', (e) => { state.query = e.target.value.trim().toLowerCase(); applyFilter(); });

  function matches(d) {
    const f = FILTERS.find(x => x.key === state.filter);
    if (f && !f.count(d)) return false;
    if (!state.query) return true;
    return [d.name, String(d.id), d.serial || '', MODELS[d.model].name].some(s => s.toLowerCase().includes(state.query));
  }
  function applyFilter() {
    state.devices.forEach(d => {
      const vis = matches(d);
      cardOf(d)?.toggleAttribute('hidden', !vis);
      rowOf(d)?.toggleAttribute('hidden', !vis);
    });
    $$('.group', $('#groups')).forEach(g => { g.hidden = !$$('.dev:not([hidden])', g).length; });
    renderDevSub();
  }

  // ------------------------------------------------------------------
  // Rendering: groups + cards
  // ------------------------------------------------------------------
  const cardOf = (d) => $(`.dev[data-id="${d.id}"]`);
  const rowOf = (d) => $(`tr[data-id="${d.id}"]`);
  const ICON = (id, cls = 'ic sm') => `<svg class="${cls}"><use href="#${id}"/></svg>`;

  function renderGroups(animate) {
    const host = $('#groups');
    host.innerHTML = '';
    const order = ['M', 'S', 'U'];
    let i = 0;
    order.forEach(key => {
      const devs = state.devices.filter(d => d.model === key);
      if (!devs.length) return;
      const m = MODELS[key];
      const g = document.createElement('section');
      g.className = 'group';
      g.dataset.model = key;
      g.innerHTML = `<div class="group-head"><span class="badge ${m.badge}">${m.name}</span><span class="gname">${m.group}</span><span class="gmeta">${devs.length} device${devs.length === 1 ? '' : 's'} · ${m.meta}</span><span class="grow"></span>` +
        (key !== 'U' ? `<button class="link" data-select-group="${key}">Select all</button>` : '') + `</div><div class="grid"></div>`;
      const grid = $('.grid', g);
      devs.forEach(d => {
        const el = renderCard(d);
        if (animate && !reduceMotion.matches) {
          el.classList.add('entering');
          el.style.transitionDelay = Math.min(i, 8) * 40 + 'ms';
          i++;
        }
        grid.appendChild(el);
      });
      host.appendChild(g);
    });
    if (animate) requestAnimationFrame(() => requestAnimationFrame(() => $$('.dev.entering').forEach(el => { el.classList.remove('entering'); el.addEventListener('transitionend', () => { el.style.transitionDelay = ''; }, { once: true }); })));
    // Card unit toggles are flipped many times a day: no sliding thumb, instant swap (see content click handler).
    $('#emptyState').hidden = state.devices.length > 0;
    renderFilters();
    applyFilter();
    renderDevSub();
    measureBars();
  }

  function renderCard(d) {
    const el = document.createElement('article');
    el.className = 'card dev';
    el.dataset.id = d.id;
    const m = MODELS[d.model];
    if (d.model === 'U') {
      el.classList.add('unid');
      el.innerHTML = `
        <div class="c-head"><span class="badge u">Unidentified</span><button class="name" data-act="rename">${d.name}</button><span class="grow"></span><span class="badge id">ID ${String(d.id).padStart(2, '0')}</span></div>
        <div class="c-unid">Responds on <span class="mono">0xD011</span> but the product ID is unknown. Choose a model to unlock controls, or keep it as a generic Modbus device.</div>
        <div class="c-ctl"><button class="btn sm primary" data-act="identify">Identify model</button><button class="btn sm" data-act="generic">Generic</button><button class="btn sm ghost" data-act="remove">Ignore</button></div>`;
      return el;
    }
    el.innerHTML = `
      <div class="c-head">
        <label class="check-wrap"><input type="checkbox" class="check sel" aria-label="Select ${d.name}"><span></span></label>
        <button class="name" data-act="rename" title="Click to rename">${d.name}</button>
        <span class="badge ${m.badge}">${d.model}</span>
        <span class="grow"></span>
        <span class="badge id">ID ${String(d.id).padStart(2, '0')}</span>
        <button class="btn ghost icon sm more" data-act="menu" aria-label="More" aria-haspopup="menu">${ICON('i-more')}</button>
      </div>
      <div class="c-status">
        <span class="chip sm" data-f="status" data-size="sm"></span>
        <span class="sn mono">SN ${d.serial || '—'}</span>
        <span class="grow"></span>
        <span class="fresh mono" data-f="fresh">${ICON('i-refresh')}<span>—</span></span>
      </div>
      <div class="c-value">
        <span class="big mono" data-f="actual">—</span>
        <span class="unit" data-f="unit">${unitLabel(d.unit)} actual</span>
        <span class="grow"></span>
        <span class="sp mono">SP <b data-f="sp">—</b></span>
      </div>
      <div class="bar"><i class="fill" data-f="fill"></i><i class="mark" data-f="mark"></i></div>
      <div class="c-ctl">
        <input class="input num mono" data-f="input" value="${fmtVal(d, toUnit(d, d.setpoint, d.unit)).replace(/,/g, '')}" inputmode="decimal" aria-label="Setpoint">
        <div class="seg sm unit" role="radiogroup" aria-label="Unit">
          <button role="radio" aria-checked="${d.unit === 'rpm'}" data-value="rpm">RPM</button>
          <button role="radio" aria-checked="${d.unit === 'pct'}" data-value="pct">%</button>
        </div>
        <button class="btn sm primary" data-act="apply">Apply</button>
        <span class="grow"></span>
        <span class="chip sm" data-f="write" data-size="sm"></span>
      </div>
      <div class="presets"><button data-preset="0">0</button><button data-preset="25">25</button><button data-preset="50">50</button><button data-preset="75">75</button><button data-preset="100">100 %</button></div>
      <div class="c-foot" data-f="foot"></div>`;
    updateCard(d, true);
    return el;
  }

  function statusChip(d) {
    switch (d.status) {
      case 'running': return ['ok', 'i-play', 'Running'];
      case 'alarm': return ['err', 'i-warn', `Alarm ${d.alarm?.code || ''}`.trim()];
      case 'offline': return ['off', 'i-off', 'Offline'];
      default: return ['off', 'i-stop', 'Stopped'];
    }
  }
  function writeChip(d) {
    const w = d.write;
    if (!w) return ['ghost', 'i-check', 'Idle'];
    switch (w.state) {
      case 'queued': return ['warn', 'i-clock', w.ahead ? `Queued · ${w.ahead} ahead` : 'Queued'];
      case 'writing': return ['info busy', 'i-spinner', 'Writing'];
      case 'confirmed': return ['ok', 'i-check', `Confirmed ${w.at}`];
      case 'failed': return ['err', 'i-x', 'Failed · retry'];
    }
    return ['ghost', 'i-check', '—'];
  }
  function freshText(d) {
    if (d.status === 'offline') return ['dead', 'no data'];
    const s = (Date.now() - d.lastSeen) / 1000;
    if (s < 10) return ['', s.toFixed(1) + ' s'];
    return ['stale', Math.round(s) + ' s ago'];
  }

  function updateCard(d, first = false) {
    const el = cardOf(d); if (!el) return;
    if (d.model === 'U') { el.classList.toggle('selected', false); return; }
    el.classList.toggle('s-running', d.status === 'running');
    el.classList.toggle('s-alarm', d.status === 'alarm');
    el.classList.toggle('s-offline', d.status === 'offline');
    el.classList.toggle('s-limit', !!d.limit && d.status === 'running');
    const f = (k) => $(`[data-f="${k}"]`, el);

    const [sk, si, st] = statusChip(d);
    const sc = f('status'); if (sc.dataset.state !== st) { sc.dataset.state = st; first ? setChipNow(sc, sk, si, st) : setChip(sc, sk, si, st); }

    const online = d.status !== 'offline';
    f('actual').textContent = online ? fmtVal(d, toUnit(d, d.actual, d.unit)) : '— —';
    f('actual').classList.toggle('dim', !online || d.actual === 0);
    f('unit').textContent = `${unitLabel(d.unit)} actual`;
    f('sp').innerHTML = fmtVal(d, toUnit(d, d.setpoint, d.unit)) + (d.pending !== null && d.pending !== d.setpoint ? ` <span class="pending">→ ${fmtVal(d, toUnit(d, d.pending, d.unit))}</span>` : '');
    f('fill').style.setProperty('--p', online ? ratio(d, d.actual) : 0);
    f('mark').style.setProperty('--m', ratio(d, d.pending ?? d.setpoint));
    const [fk, ft] = freshText(d);
    const fr = f('fresh'); fr.className = 'fresh mono ' + fk; fr.lastElementChild.textContent = ft;

    const [wk, wi, wt] = writeChip(d);
    const wc = f('write'); if (wc.dataset.state !== wt) { wc.dataset.state = wt; first ? setChipNow(wc, wk, wi, wt) : setChip(wc, wk, wi, wt); }
    const busy = d.write && (d.write.state === 'queued' || d.write.state === 'writing');
    f('input').disabled = busy; $('[data-act="apply"]', el).disabled = busy; $$('.presets button', el).forEach(b => b.disabled = busy);

    // footer
    let foot = '';
    if (d.status === 'alarm') foot = `<span class="chip err sm">${ICON('i-warn')}${d.alarm.code} ${d.alarm.text}</span><span class="grow"></span><button class="btn sm" data-act="reset-alarm">Reset alarm</button>`;
    else if (d.status === 'offline') foot = `<span>Last seen ${hhmmss(new Date(d.lastSeen))} · ${d.retries} retries · check wiring or ID</span><span class="grow"></span><button class="btn sm" data-act="retry">Retry</button>`;
    else if (d.limit) foot = `<span class="chip warn sm">${ICON('i-bolt')}${d.limit}</span><span class="grow"></span><button class="link" data-act="why" title="Coil current reached the configured maximum (0xD13B). Speed is held back until current drops.">Why?</button>`;
    else foot = d.monitors.map(([k, v]) => `<span class="kv">${k} <b class="${/A$/.test(v) && parseFloat(v) > 4 ? 'hot' : ''}">${v}</b></span>`).join('') + `<span class="grow"></span><button class="link" data-act="add-monitor">Add monitor</button>`;
    const fh = f('foot'); if (fh.dataset.sig !== foot) { fh.dataset.sig = foot; fh.innerHTML = foot; }

    el.classList.toggle('selected', state.selected.has(d.id));
    const cb = $('.sel', el); if (cb) cb.checked = state.selected.has(d.id);
    updateRow(d);
  }
  function setChipNow(chip, kind, icon, text) {
    chip.className = 'chip ' + kind + ' sm';
    chip.innerHTML = `<svg class="ic sm"><use href="#${icon}"/></svg><span>${text}</span>`;
  }

  // the setpoint marker is positioned in px from the bar width (transform only, no layout per frame)
  function measureBars() {
    $$('.bar').forEach(b => b.style.setProperty('--bar-w', b.clientWidth + 'px'));
  }
  addEventListener('resize', measureBars);

  // ------------------------------------------------------------------
  // List view
  // ------------------------------------------------------------------
  function renderView() {
    const grid = state.view === 'grid';
    $('#groups').hidden = !grid || !state.devices.length;
    $('#listWrap').hidden = grid || !state.devices.length;
    if (!grid) renderList();
    else measureBars();
  }
  function renderList() {
    const body = $('#listBody');
    body.innerHTML = state.devices.map(d => d.model === 'U'
      ? `<tr data-id="${d.id}"><td></td><td><span class="chip warn sm">${ICON('i-tag')}Identify</span></td><td class="name">${d.name}</td><td class="mono">${d.id}</td><td class="num">—</td><td class="num">—</td><td>—</td><td>—</td><td><button class="btn sm primary" data-act="identify">Identify model</button></td></tr>`
      : `<tr data-id="${d.id}"><td><label class="check-wrap"><input type="checkbox" class="check sel" aria-label="Select ${d.name}"><span></span></label></td>
         <td><span class="chip sm" data-f="status" data-size="sm"></span></td><td class="name">${d.name} <span class="badge ${MODELS[d.model].badge}">${d.model}</span></td><td class="mono">${d.id}</td>
         <td class="num" data-f="actual"></td><td class="num" data-f="sp"></td><td><span class="chip sm" data-f="write" data-size="sm"></span></td><td class="mono" data-f="fresh"></td>
         <td><button class="btn ghost icon sm" data-act="menu" aria-label="More">${ICON('i-more')}</button></td></tr>`).join('');
    state.devices.forEach(d => updateRow(d, true));
    applyFilter();
  }
  function updateRow(d, first = false) {
    const tr = rowOf(d); if (!tr || d.model === 'U') return;
    tr.className = (d.status === 'offline' ? 's-offline' : '') + (state.selected.has(d.id) ? ' selected' : '');
    const f = (k) => $(`[data-f="${k}"]`, tr);
    const [sk, si, st] = statusChip(d); const sc = f('status'); if (sc.dataset.state !== st) { sc.dataset.state = st; setChipNow(sc, sk, si, st); }
    f('actual').textContent = d.status === 'offline' ? '—' : `${fmtVal(d, toUnit(d, d.actual, d.unit))} ${unitLabel(d.unit)}`;
    f('sp').textContent = `${fmtVal(d, toUnit(d, d.setpoint, d.unit))} ${unitLabel(d.unit)}`;
    const [wk, wi, wt] = writeChip(d); const wc = f('write'); if (wc.dataset.state !== wt) { wc.dataset.state = wt; first ? setChipNow(wc, wk, wi, wt) : setChip(wc, wk, wi, wt); }
    f('fresh').textContent = freshText(d)[1];
    const cb = $('.sel', tr); if (cb) cb.checked = state.selected.has(d.id);
  }

  // ------------------------------------------------------------------
  // Device actions (event delegation on the page)
  // ------------------------------------------------------------------
  const devById = (id) => state.devices.find(d => d.id === +id);

  $('#content').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]'); const preset = e.target.closest('[data-preset]');
    const host = e.target.closest('.dev, tr[data-id]');
    if (e.target.closest('[data-select-group]')) { selectGroup(e.target.closest('[data-select-group]').dataset.selectGroup); return; }
    const unitBtn = e.target.closest('.seg.unit [role="radio"]');
    if (unitBtn && host) {
      const d = devById(host.dataset.id);
      if (d.unit !== unitBtn.dataset.value) {
        const input = $('[data-f="input"]', host);
        const current = parseFloat(input.value.replace(/,/g, ''));
        d.unit = unitBtn.dataset.value;
        $$('[role="radio"]', unitBtn.parentElement).forEach(b => b.setAttribute('aria-checked', String(b === unitBtn)));
        if (!Number.isNaN(current)) input.value = fmtVal(d, d.unit === 'pct' ? current / d.max * 100 : current / 100 * d.max).replace(/,/g, '');
        updateCard(d);
      }
      return;
    }
    if (preset && host) { applyPreset(devById(host.dataset.id), +preset.dataset.preset); return; }
    if (!act || !host) return;
    const d = devById(host.dataset.id);
    switch (act.dataset.act) {
      case 'apply': applySetpoint(d, $('[data-f="input"]', host).value); break;
      case 'rename': startRename(d, act); break;
      case 'menu': openMenu(act, d); break;
      case 'reset-alarm': resetAlarm(d); break;
      case 'retry': retry(d); break;
      case 'identify': identify(d); break;
      case 'generic': d.model = 'M'; d.name = `Generic ${d.id}`; renderGroups(false); toast(`ID ${d.id} kept as a generic Modbus device`); break;
      case 'remove': removeDevice(d); break;
      case 'add-monitor': toast('Monitoring parameters: pick from the list on the Devices page'); break;
    }
  });
  $('#content').addEventListener('change', (e) => {
    const cb = e.target.closest('.sel'); if (!cb) return;
    const host = cb.closest('.dev, tr[data-id]'); const d = devById(host.dataset.id);
    if (cb.checked) state.selected.add(d.id); else state.selected.delete(d.id);
    updateCard(d); renderBulk();
  });
  $('#content').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const input = e.target.closest('[data-f="input"]'); if (!input) return;
    applySetpoint(devById(input.closest('.dev').dataset.id), input.value);
  });

  function applyPreset(d, pct) {
    const v = d.unit === 'pct' ? pct : pct / 100 * d.max;
    const input = $('[data-f="input"]', cardOf(d)); if (input) input.value = fmtVal(d, v).replace(/,/g, '');
    applySetpoint(d, v);
  }
  function applySetpoint(d, raw) {
    const v = parseFloat(String(raw).replace(/,/g, ''));
    if (Number.isNaN(v)) { toast('Enter a number', 'err'); return; }
    const native = Math.max(0, Math.min(d.mode === 'pct' ? 100 : d.max, fromUnit(d, v, d.unit)));
    enqueueWrite(d, native);
  }
  function enqueueWrite(d, value) {
    if (state.queue.some(q => q.id === d.id)) state.queue = state.queue.filter(q => q.id !== d.id);
    state.queue.push({ id: d.id, value });
    d.pending = value;
    refreshQueueStates();
  }
  function refreshQueueStates() {
    state.queue.forEach((q, i) => {
      const d = devById(q.id);
      if (d.write?.state !== 'writing') d.write = { state: 'queued', ahead: i };
      updateCard(d);
    });
  }
  function resetAlarm(d) { d.status = 'stopped'; d.alarm = null; d.write = null; updateCard(d); renderFilters(); toast(`${d.name}: alarm reset`); }
  async function retry(d) {
    const btn = $('[data-act="retry"]', cardOf(d)); if (btn) { btn.disabled = true; btn.textContent = 'Retrying…'; }
    await wait(reduceMotion.matches ? 0 : 900);
    d.status = 'stopped'; d.retries = 0; d.lastSeen = Date.now(); d.write = null;
    updateCard(d); renderFilters(); toast(`${d.name} is back online`, 'ok');
  }
  function identify(d) {
    const pick = prompt('Model for ID ' + d.id + ' (M or S)', 'M');
    if (!pick) return;
    const key = pick.trim().toUpperCase();
    if (!MODELS[key] || key === 'U') { toast('Unknown model', 'err'); return; }
    Object.assign(d, { model: key, max: MODELS[key].max, mode: key === 'S' ? 'pct' : 'rpm', unit: key === 'S' ? 'pct' : 'rpm', name: d.name.startsWith('Slave') ? `Fan ${d.id}` : d.name });
    renderGroups(false); if (state.view === 'list') renderList();
    toast(`ID ${d.id} identified as ${MODELS[key].name}`, 'ok');
  }
  function removeDevice(d) {
    state.devices = state.devices.filter(x => x !== d);
    state.selected.delete(d.id);
    renderGroups(false); if (state.view === 'list') renderList(); renderBulk(); renderView();
    toast(`${d.name} removed`);
  }
  function startRename(d, btn) {
    const input = document.createElement('input');
    input.className = 'name-input'; input.value = d.name; input.setAttribute('aria-label', 'Device name');
    btn.replaceWith(input); input.focus(); input.select();
    let done = false;
    const finish = (commit) => {
      if (done) return; done = true;
      if (commit && input.value.trim()) d.name = input.value.trim();
      const b = document.createElement('button'); b.className = 'name'; b.dataset.act = 'rename'; b.title = 'Click to rename'; b.textContent = d.name;
      input.replaceWith(b);
      if (commit) { renderFilters(); if (state.view === 'list') renderList(); renderBulk(); }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
    input.addEventListener('blur', () => finish(true));
  }

  // ------------------------------------------------------------------
  // Context menu (origin-aware: scales from the trigger corner)
  // ------------------------------------------------------------------
  const menu = $('#menu');
  function openMenu(anchor, d) {
    menu.innerHTML = [
      ['i-edit', 'Rename', () => startRename(d, $('[data-act="rename"]', cardOf(d)))],
      ['i-tag', 'Change fan address…', () => toast('Fan Address (0xD100) editor opens on the Devices page')],
      ['i-eye', 'Live watch for this device', () => toast(`${d.name}: live watch toggled`)],
      ['i-bell', 'Reset alarm', () => resetAlarm(d)],
      ['i-power', 'Software reset', () => toast(`${d.name}: reset command queued`)],
      null,
      ['i-trash', 'Remove', () => removeDevice(d), 'danger'],
    ].map((it, i) => it ? `<button role="menuitem" data-i="${i}" class="${it[3] || ''}">${ICON(it[0], 'ic')}${it[1]}</button>` : `<div class="sep"></div>`).join('');
    menu._items = [
      () => startRename(d, $('[data-act="rename"]', cardOf(d))),
      () => toast('Fan Address (0xD100) editor opens on the Devices page'),
      () => toast(`${d.name}: live watch toggled`),
      () => resetAlarm(d),
      () => toast(`${d.name}: reset command queued`),
      null,
      () => removeDevice(d),
    ];
    const r = anchor.getBoundingClientRect();
    clearTimeout(menu._closeTimer);
    menu.classList.remove('leaving');
    menu.hidden = false;
    const w = menu.offsetWidth, h = menu.offsetHeight;
    const left = Math.min(r.right - w, innerWidth - w - 8), top = r.bottom + 6 + h > innerHeight ? r.top - 6 - h : r.bottom + 6;
    menu.style.left = Math.max(8, left) + 'px'; menu.style.top = top + 'px';
    menu.style.transformOrigin = (top < r.top ? 'bottom' : 'top') + ' right';
    menu.classList.add('entering'); void menu.offsetWidth; menu.classList.remove('entering');
    $('button', menu).focus();
  }
  function closeMenu() {
    if (menu.hidden) return;
    menu.classList.add('leaving');
    menu._closeTimer = setTimeout(() => { menu.hidden = true; menu.classList.remove('leaving'); }, reduceMotion.matches ? 0 : 90);
  }
  menu.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; closeMenu(); menu._items[+b.dataset.i]?.(); });

  // ------------------------------------------------------------------
  // Selection + bulk bar
  // ------------------------------------------------------------------
  const selectable = () => state.devices.filter(d => d.model !== 'U');
  function selectGroup(key) {
    const devs = state.devices.filter(d => d.model === key);
    const all = devs.every(d => state.selected.has(d.id));
    devs.forEach(d => all ? state.selected.delete(d.id) : state.selected.add(d.id));
    devs.forEach(updateCard); renderBulk();
  }
  $('#selectAll').addEventListener('change', (e) => {
    const devs = selectable().filter(matches);
    devs.forEach(d => e.target.checked ? state.selected.add(d.id) : state.selected.delete(d.id));
    devs.forEach(updateCard); renderBulk();
  });
  function clearSelection() { if (!state.selected.size) return; const ids = [...state.selected]; state.selected.clear(); ids.forEach(id => updateCard(devById(id))); renderBulk(); }
  $('#bulkClear').addEventListener('click', clearSelection);

  function renderBulk() {
    const n = state.selected.size;
    const bulk = $('#bulk');
    bulk.toggleAttribute('data-open', n > 0);
    if (n) { $('#bulkN').textContent = `${n} selected`; $('#bulkApplyN').textContent = n; }
    const sa = $('#selectAll'); const total = selectable().length;
    sa.checked = n > 0 && n === total; sa.indeterminate = n > 0 && n < total;
  }
  $('#bulkPresets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]'); if (!b) return;
    const pct = +b.dataset.preset;
    $('#bulkValue').value = state.bulkUnit === 'pct' ? pct : Math.round(pct / 100 * 1600);
  });
  $('#bulkApply').addEventListener('click', () => {
    const v = parseFloat($('#bulkValue').value); if (Number.isNaN(v)) { toast('Enter a number', 'err'); return; }
    [...state.selected].map(devById).forEach(d => enqueueWrite(d, Math.max(0, Math.min(d.mode === 'pct' ? 100 : d.max, fromUnit(d, v, state.bulkUnit)))));
    toast(`${state.selected.size} setpoint writes queued`);
  });
  $('#bulkStop').addEventListener('click', () => { [...state.selected].map(devById).forEach(d => enqueueWrite(d, 0)); toast(`Stop queued for ${state.selected.size} devices`); });
  $('#bulkReset').addEventListener('click', () => { [...state.selected].map(devById).filter(d => d.status === 'alarm').forEach(resetAlarm); });

  // ------------------------------------------------------------------
  // Toolbar: scan / add
  // ------------------------------------------------------------------
  async function scan() {
    const btn = $('#scanBtn');
    btn.disabled = true;
    setButtonLabel(btn, `${ICON('i-spinner', 'ic sm spin')}<span>Scanning…</span>`);
    await wait(reduceMotion.matches ? 0 : 1800);
    const free = [1, 2, 3, 4, 5, 6, 11, 13, 14, 15].find(id => !devById(id));
    if (free) {
      state.devices.push(normalize({ id: free, name: `Slave ${free}`, model: 'U', serial: null, mode: 'rpm', setpoint: 0, actual: 0, status: 'stopped', monitors: [] }));
      renderGroups(false); if (state.view === 'list') renderList(); renderView();
      toast(`1 new device found at ID ${free}`, 'ok');
    } else toast('No new devices');
    setButtonLabel(btn, `${ICON('i-scan')}<span>Scan</span>`);
    btn.disabled = false;
  }
  function addDevice() {
    const id = parseInt(prompt('Slave ID (1–247)', ''), 10);
    if (!id || id < 1 || id > 247) return;
    if (devById(id)) { toast(`ID ${id} already exists`, 'err'); return; }
    const name = prompt('Name', `Fan ${id}`) || `Fan ${id}`;
    state.devices.push(normalize({ id, name, model: 'M', serial: null, mode: 'rpm', setpoint: 0, actual: 0, status: 'stopped', monitors: [] }));
    renderGroups(false); if (state.view === 'list') renderList(); renderView();
    toast(`${name} added`, 'ok');
  }
  $('#scanBtn').addEventListener('click', scan);
  $('#emptyScanBtn').addEventListener('click', scan);
  $('#addBtn').addEventListener('click', addDevice);
  $('#emptyAddBtn').addEventListener('click', addDevice);

  // ------------------------------------------------------------------
  // Poll loop (simulated) — one cycle visits every online device once,
  // then drains one queued write before the next cycle.
  // ------------------------------------------------------------------
  function renderDevSub() {
    const n = state.devices.length, on = state.devices.filter(d => d.status !== 'offline' && d.model !== 'U').length, off = state.devices.filter(d => d.status === 'offline').length;
    $('#devSub').textContent = n ? `${on} online${off ? ` · ${off} offline` : ''}` : '';
    $('#topSub').textContent = n ? `${n} device${n === 1 ? '' : 's'} · poll cycle ${state.cycleMs} ms` : 'no devices';
  }

  function pollCycle() {
    const online = state.devices.filter(d => d.status !== 'offline');
    const offline = state.devices.filter(d => d.status === 'offline');
    const now = Date.now();
    online.forEach((d, i) => {
      // first-order response toward the setpoint, with a little measurement noise
      if (d.status === 'running' || d.status === 'stopped') {
        const target = d.setpoint;
        const noise = d.mode === 'pct' ? (Math.random() - .5) * .4 : (Math.random() - .5) * 6;
        d.actual = Math.max(0, d.actual + (target - d.actual) * .35 + (target > 0 ? noise : 0));
        if (Math.abs(target - d.actual) < (d.mode === 'pct' ? .3 : 4)) d.actual = target + (target > 0 ? noise / 2 : 0);
        d.status = d.actual > (d.mode === 'pct' ? .5 : 5) ? 'running' : 'stopped';
      }
      d.lastSeen = now - Math.round(i * state.cycleMs / Math.max(1, online.length));
      state.stats.req++; state.stats.ok++;
    });
    // offline devices are retried once every few cycles
    if (offline.length && Math.random() < .3) { state.stats.req += offline.length; state.stats.err += offline.length; offline.forEach(d => d.retries++); }

    processWriteQueue();
    state.devices.forEach(d => updateCard(d));
    renderFilters();
    renderDevSub();
    renderStats();
  }

  function processWriteQueue() {
    const writing = state.devices.find(d => d.write?.state === 'writing');
    if (writing) {
      // the frame went out last cycle; now the echo is in
      const value = writing.write.value;
      if (writing.status === 'offline') { writing.write = { state: 'failed' }; state.stats.req++; state.stats.err++; }
      else { writing.setpoint = value; writing.write = { state: 'confirmed', at: hhmmss() }; state.stats.req++; state.stats.ok++; }
      if (writing.pending === value) writing.pending = null; // a newer value may already be queued behind this one
      return;
    }
    const next = state.queue.shift();
    if (!next) return;
    const d = devById(next.id);
    if (d) d.write = { state: 'writing', value: next.value };
    refreshQueueStates();
  }

  function startPolling() {
    stopPolling();
    const tick = () => {
      state.cycleMs = Math.max(120, 60 * state.devices.filter(d => d.status !== 'offline').length + 60);
      $('#liveCycle').textContent = `${state.cycleMs} ms`;
      pollCycle();
      state.timer = setTimeout(tick, state.cycleMs);
    };
    tick();
  }
  function stopPolling() { clearTimeout(state.timer); state.timer = null; $('#liveCycle').textContent = 'paused'; }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  renderGroups(true);
  renderView();
  renderBulk();
  renderStats();
  startPolling();
})();
