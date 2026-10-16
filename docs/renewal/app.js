/* =====================================================================
   FanCM renewal · app.js — Connect onboarding (first screen)

   What is real here:
     - Web Serial: granted-port listing, requestPort(), port.open()
   What is a stand-in until modbus.js is wired in:
     - scanBus(): yields fake slaves. Replace with the real Modbus sweep
       (FC04 @ 0xD011, see docs/claude-design-redesign-prompt.md §5.6).
   ===================================================================== */
(() => {
  'use strict';

  const { $, reduceMotion, wait, setButtonLabel } = FanCM;

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const state = {
    ports: [],           // [{ port, label, vendor, lastUsed }]
    selected: null,      // index into ports
    openPort: null,      // SerialPort currently open
    simulator: false,
    scanAfterConnect: true,
    scanRange: [1, 32],
    scanAbort: null,
    found: [],           // [{ id, model, serial }]
    scanSkipped: false,
    step: 1,
  };

  FanCM.initTheme($('#themeBtn'));
  FanCM.initSeg($('#roleSeg'));

  // ------------------------------------------------------------------
  // Connection chip in the top bar
  // ------------------------------------------------------------------
  function setConnChip(kind, icon, text) {
    const chip = $('#connChip');
    chip.className = 'chip ' + kind;
    $('use', chip).setAttribute('href', '#' + icon);
    $('#connChipText').textContent = text;
  }

  // ------------------------------------------------------------------
  // Web Serial: list granted ports
  // ------------------------------------------------------------------
  const supported = 'serial' in navigator;
  if (!supported) {
    $('#unsupportedBanner').hidden = false;
    $('#requestPortBtn').disabled = true;
    $('#connectBtn').disabled = true;
    $('#connectOnlyBtn').disabled = true;
  }

  const VENDORS = { 0x1a86: 'CH340 / CH34x', 0x0403: 'FTDI', 0x10c4: 'CP210x', 0x067b: 'Prolific' };

  function describePort(port, i) {
    const info = port.getInfo ? port.getInfo() : {};
    const vid = info.usbVendorId, pid = info.usbProductId;
    const vendor = vid ? (VENDORS[vid] || `USB ${vid.toString(16).padStart(4, '0')}:${(pid || 0).toString(16).padStart(4, '0')}`) : 'Serial device';
    return { port, label: `Port ${i + 1}`, vendor };
  }

  async function refreshPorts() {
    if (!supported) return;
    try {
      const ports = await navigator.serial.getPorts();
      state.ports = ports.map(describePort);
      if (state.selected === null && state.ports.length) state.selected = 0;
      if (state.selected !== null && state.selected >= state.ports.length) state.selected = state.ports.length ? 0 : null;
    } catch (err) {
      console.warn('getPorts failed', err);
    }
    renderPorts();
  }

  function renderPorts() {
    const list = $('#portList');
    const empty = $('#portEmpty');
    list.querySelectorAll('.port').forEach(el => el.remove());
    empty.hidden = state.ports.length > 0;
    state.ports.forEach((p, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'port';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(i === state.selected));
      btn.innerHTML = `<svg class="ic"><use href="#i-plug"/></svg><b>${p.label}</b><span>${p.vendor}</span>` +
        (i === 0 && state.ports.length > 1 ? `<span class="chip info">Last used</span>` : '');
      btn.addEventListener('click', () => selectPort(i));
      list.appendChild(btn);
    });
  }

  function selectPort(i) {
    state.selected = i;
    $('#portList').querySelectorAll('.port').forEach((el, j) => el.setAttribute('aria-checked', String(i === j)));
  }

  $('#requestPortBtn').addEventListener('click', async () => {
    try {
      const port = await navigator.serial.requestPort();
      await refreshPorts();
      const idx = state.ports.findIndex(p => p.port === port);
      if (idx >= 0) selectPort(idx);
    } catch (err) {
      // user cancelled the chooser — not an error worth showing
      if (err?.name !== 'NotFoundError') showError(err.message);
    }
  });

  if (supported) {
    navigator.serial.addEventListener('connect', refreshPorts);
    navigator.serial.addEventListener('disconnect', refreshPorts);
  }

  // ------------------------------------------------------------------
  // Scan-after-connect switch
  // ------------------------------------------------------------------
  $('#scanSwitch').addEventListener('click', (e) => {
    state.scanAfterConnect = !state.scanAfterConnect;
    e.currentTarget.classList.toggle('on', state.scanAfterConnect);
    e.currentTarget.setAttribute('aria-checked', String(state.scanAfterConnect));
    setButtonLabel($('#connectBtn'),
      state.scanAfterConnect
        ? `<svg class="ic"><use href="#i-plug"/></svg><span>Connect and scan</span>`
        : `<svg class="ic"><use href="#i-plug"/></svg><span>Connect</span>`);
  });
  $('#scanChangeBtn').addEventListener('click', () => {
    const v = prompt('Scan ID range (e.g. 1-32)', `${state.scanRange[0]}-${state.scanRange[1]}`);
    if (!v) return;
    const m = v.match(/^\s*(\d+)\s*[-–]\s*(\d+)\s*$/);
    if (!m) return;
    const a = Math.max(1, Math.min(247, +m[1])), b = Math.max(a, Math.min(247, +m[2]));
    state.scanRange = [a, b];
    $('#scanRangeText').textContent = `${a}–${b}`;
  });

  // ------------------------------------------------------------------
  // Errors
  // ------------------------------------------------------------------
  function showError(msg) {
    const el = $('#connectError');
    el.innerHTML = `<svg class="ic sm"><use href="#i-warn"/></svg><span></span>`;
    $('span', el).textContent = msg;
    el.hidden = false;
  }
  function clearError() { $('#connectError').hidden = true; }

  // ------------------------------------------------------------------
  // Connect
  // ------------------------------------------------------------------
  function serialOptions() {
    return {
      baudRate: +$('#baud').value,
      parity: $('#parity').value,
      dataBits: +$('#dataBits').value,
      stopBits: +$('#stopBits').value,
    };
  }

  async function connect({ scan }) {
    clearError();
    if (!state.simulator && state.selected === null) {
      showError('Choose a serial port first, or request access to one.');
      return;
    }
    const btn = $('#connectBtn');
    const other = $('#connectOnlyBtn');
    btn.disabled = other.disabled = true;
    setButtonLabel(btn, `<svg class="ic spin"><use href="#i-spinner"/></svg><span>Connecting…</span>`);
    setConnChip('info busy', 'i-spinner', 'Connecting');

    try {
      if (state.simulator) {
        await wait(reduceMotion.matches ? 0 : 500);
      } else {
        const entry = state.ports[state.selected];
        await entry.port.open(serialOptions());
        state.openPort = entry.port;
      }
      const o = serialOptions();
      const parity = { none: 'N', even: 'E', odd: 'O' }[o.parity];
      const where = state.simulator ? 'Simulator' : state.ports[state.selected].label;
      setConnChip('ok', 'i-plug', `${where} · ${o.baudRate} ${o.dataBits}${parity}${o.stopBits} · Connected`);
      $('#topbarSub').textContent = scan ? 'Discover devices' : 'Connected';
      unlockRail();

      if (scan) {
        await goToStep(2);
        runScan();
      } else {
        // Connect-only: skip discovery. Devices are added by ID from the dashboard.
        state.scanSkipped = true;
        $('#topbarSub').textContent = 'Identify models';
        await goToStep(3);
        renderIdentify();
      }
    } catch (err) {
      setConnChip('err', 'i-warn', 'Connection failed');
      showError(friendlySerialError(err));
      btn.disabled = other.disabled = false;
      setButtonLabel(btn, `<svg class="ic"><use href="#i-plug"/></svg><span>${state.scanAfterConnect ? 'Connect and scan' : 'Connect'}</span>`);
    }
  }

  function friendlySerialError(err) {
    const m = err?.message || String(err);
    if (/already open/i.test(m)) return 'That port is already open — maybe in another tab or program.';
    if (/Failed to open/i.test(m)) return 'The port could not be opened. Check that nothing else is using it and the adapter is still plugged in.';
    return m;
  }

  function unlockRail() {
    document.querySelectorAll('.rail-group .rail-item:not([data-role])').forEach(b => {
      b.disabled = false; b.removeAttribute('title');
    });
  }

  $('#connectBtn').addEventListener('click', () => connect({ scan: state.scanAfterConnect }));
  $('#connectOnlyBtn').addEventListener('click', () => connect({ scan: false }));
  $('#simBtn').addEventListener('click', () => {
    state.simulator = true;
    $('#connectBtn').disabled = false;
    $('#connectOnlyBtn').disabled = false;
    setConnChip('info', 'i-chip', 'Simulator');
    connect({ scan: true });
  });

  // ------------------------------------------------------------------
  // Step 2 · Scan
  // ------------------------------------------------------------------
  const MODELS = [
    { key: 'M', name: 'EC-FAN M', badge: 'm' },
    { key: 'S', name: 'EC-FAN S', badge: 's' },
    { key: 'U', name: 'Unknown', badge: 'u' },
  ];

  /** Stand-in for the real bus sweep. Yields { id, model?, serial? } for each responding slave. */
  async function* scanBus([from, to], signal) {
    const stepMs = reduceMotion.matches ? 20 : 120;
    const fakeHits = state.simulator
      ? { 1: 'M', 2: 'M', 3: 'S', 7: 'M', 12: 'U' }
      : {}; // TODO: replace with modbus.js FC04 read of 0xD011 per ID, 200 ms timeout
    for (let id = from; id <= to; id++) {
      if (signal.aborted) return;
      await wait(stepMs);
      yield { id, hit: id in fakeHits, model: fakeHits[id] };
    }
  }

  async function runScan() {
    const [from, to] = state.scanRange;
    const total = to - from + 1;
    const bar = $('#scanBar');
    const stepMs = reduceMotion.matches ? 20 : 120;
    bar.style.setProperty('--step-ms', stepMs + 'ms');
    bar.style.setProperty('--p', 0);
    $('#foundList').innerHTML = '';
    $('#scanCount').textContent = `ID ${from} / ${to}`;
    $('#scanFound').textContent = '0 found';
    $('#toIdentifyBtn').disabled = true;
    $('#toIdentifyBtn').textContent = 'Continue';
    state.found = [];
    state.scanSkipped = false;
    const ctrl = new AbortController();
    state.scanAbort = ctrl;
    setConnChip('info busy', 'i-spinner', `Scanning ID ${from}`);

    for await (const r of scanBus([from, to], ctrl.signal)) {
      const n = r.id - from + 1;
      bar.style.setProperty('--p', n / total);
      $('#scanCount').textContent = `ID ${r.id} / ${to}`;
      $('#connChipText').textContent = `Scanning ID ${r.id}`;
      if (r.hit) {
        const dev = { id: r.id, model: r.model || 'U', serial: fakeSerial(r.id) };
        state.found.push(dev);
        addFoundRow(dev);
        $('#scanFound').textContent = `${state.found.length} found`;
        $('#toIdentifyBtn').disabled = false;
      }
    }
    state.scanAbort = null;
    finishScan(ctrl.signal.aborted);
  }

  function finishScan(aborted) {
    const n = state.found.length;
    const o = serialOptions();
    const parity = { none: 'N', even: 'E', odd: 'O' }[o.parity];
    const where = state.simulator ? 'Simulator' : state.ports[state.selected].label;
    setConnChip('ok', 'i-plug', `${where} · ${o.baudRate} ${o.dataBits}${parity}${o.stopBits} · ${n} device${n === 1 ? '' : 's'}`);
    $('#scanFound').textContent = aborted ? `${n} found · stopped` : (n ? `${n} found` : 'Nothing answered');
    $('#stopScanBtn').disabled = true;
    $('#toIdentifyBtn').disabled = false;
    $('#toIdentifyBtn').textContent = n ? 'Continue' : 'Continue without devices';
  }

  function addFoundRow(dev) {
    const li = document.createElement('li');
    li.className = 'device entering';
    const m = MODELS.find(x => x.key === dev.model);
    li.innerHTML = `<svg class="ic"><use href="#i-fan"/></svg><span class="badge id">ID ${dev.id}</span><span class="name">${m.name}</span><span class="sn">${dev.serial}</span>`;
    const list = $('#foundList');
    list.appendChild(li);
    // keep the newest row in view — offsetTop ignores the entering translate, scrollIntoView would not
    list.scrollTop = Math.max(0, li.offsetTop + li.offsetHeight - list.clientHeight);
    requestAnimationFrame(() => requestAnimationFrame(() => li.classList.remove('entering')));
  }

  function fakeSerial(id) {
    return `LSM26${String(id).padStart(4, '0')}`;
  }

  $('#stopScanBtn').addEventListener('click', () => state.scanAbort?.abort());
  $('#toIdentifyBtn').addEventListener('click', async () => {
    state.scanAbort?.abort();
    $('#topbarSub').textContent = 'Identify models';
    await goToStep(3);
    renderIdentify();
  });

  // ------------------------------------------------------------------
  // Step 3 · Identify
  // ------------------------------------------------------------------
  function renderIdentify() {
    const ul = $('#identifyList');
    ul.innerHTML = '';
    if (!state.found.length) {
      const msg = state.scanSkipped
        ? 'Scan skipped. Add devices by slave ID from the dashboard, or rescan now.'
        : 'No devices answered. Check the A/B wiring and termination, then rescan.';
      ul.innerHTML = `<li class="port-empty"><svg class="ic"><use href="#i-fan"/></svg><span>${msg}</span></li>`;
    }
    state.found.forEach((dev, i) => {
      const li = document.createElement('li');
      li.className = 'device entering';
      li.style.transitionDelay = (reduceMotion.matches ? 0 : i * 40) + 'ms';
      const opts = MODELS.map(m => `<option value="${m.key}" ${m.key === dev.model ? 'selected' : ''}>${m.name}</option>`).join('');
      li.innerHTML = `<svg class="ic"><use href="#i-fan"/></svg><span class="badge id">ID ${dev.id}</span><span class="sn">${dev.serial}</span>` +
        `<label class="select"><select aria-label="Model for ID ${dev.id}">${opts}</select><svg class="ic sm"><use href="#i-chev"/></svg></label>`;
      $('select', li).addEventListener('change', (e) => { dev.model = e.target.value; });
      ul.appendChild(li);
      requestAnimationFrame(() => requestAnimationFrame(() => { li.classList.remove('entering'); li.style.transitionDelay = ''; }));
    });
  }

  $('#rescanBtn').addEventListener('click', async () => {
    $('#stopScanBtn').disabled = false;
    $('#topbarSub').textContent = 'Discover devices';
    await goToStep(2);
    runScan();
  });

  $('#openDashBtn').addEventListener('click', () => {
    const btn = $('#openDashBtn');
    setButtonLabel(btn, `<svg class="ic spin"><use href="#i-spinner"/></svg><span>Opening…</span>`);
    // Hand-off: the dashboard reads this session summary. The open SerialPort object
    // can't cross a page load, so the dashboard re-opens the granted port itself.
    try {
      sessionStorage.setItem('fancm.session', JSON.stringify({
        simulator: state.simulator,
        serial: serialOptions(),
        portLabel: state.simulator ? 'Simulator' : state.ports[state.selected]?.label,
        devices: state.found,
      }));
    } catch {}
    setTimeout(() => { location.href = 'dashboard.html'; }, reduceMotion.matches ? 0 : 250);
  });

  // ------------------------------------------------------------------
  // Step transitions
  //   outgoing panel: 140 ms fade/blur up · card height tweens · incoming: 220 ms fade/blur down
  // ------------------------------------------------------------------
  async function goToStep(n) {
    const card = $('#card');
    const from = $(`.panel[data-panel="${state.step}"]`);
    const to = $(`.panel[data-panel="${n}"]`);
    if (from === to) return;

    // stepper
    document.querySelectorAll('.step').forEach(s => {
      const k = +s.dataset.step;
      s.classList.toggle('done', k < n);
      s.classList.toggle('on', k === n);
    });
    document.querySelectorAll('.step-line').forEach((l, i) => l.classList.toggle('done', i + 1 < n));

    const startH = card.offsetHeight;
    const frame = startH - from.offsetHeight; // card borders
    card.style.height = startH + 'px';

    from.classList.add('leaving');
    await wait(reduceMotion.matches ? 0 : 140);
    from.hidden = true;
    from.classList.remove('leaving');

    to.classList.add('entering');
    to.hidden = false;
    const endH = to.offsetHeight + frame;
    // force the style flush so the height change actually transitions
    void card.offsetHeight;
    card.style.height = endH + 'px';
    requestAnimationFrame(() => to.classList.remove('entering'));
    await wait(reduceMotion.matches ? 0 : 260);
    card.style.height = '';
    state.step = n;
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  // Mount after the first layout so the stagger plays from a known start state.
  // Never gate this on getPorts(): if the serial API stalls, the screen must still appear.
  requestAnimationFrame(() => requestAnimationFrame(() => { $('#stage').dataset.mounted = ''; }));
  refreshPorts();
})();
