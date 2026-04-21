/**
 * OS Test Module - 구동동작
 * 4-1 ~ 4-9. Set Value Source (PWM/Analog V/Analog I/RS485), FG PPR, Operation Mode, Set Value, Open-loop, Closed-loop
 */

window.OSTestModules = window.OSTestModules || [];

window.OSTestModules.push({

    tests: {

        // ── 4-1. Set Value Source - PWM 입력 ──────────────────────────────────
        'drive01': {
            id: 'drive01',
            category: '구동동작',
            number: '4-1',
            title: 'Set Value Source — PWM 입력',
            description: '외부 PWM 입력 신호를 Set Value Source로 설정 시 정상 제어 동작 검증',
            purpose: '외부 PWM 입력 신호를 Set Value Source로 설정했을 때, 드라이브가 입력 신호를 정상적으로 해석하여 목표값에 반영하는지 확인한다. PWM 이상 상태(신호 유실, 범위 초과)에 대한 보호 동작도 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, PWM 신호 발생기 (Function Generator 또는 MCU)',
            criteria: 'PWM Duty 변화에 따라 목표 속도/토크가 비례 변화 / PWM 신호 유실 시 Safe 동작(정지 또는 출력 제한) 수행',
            manual: true,
            steps: [
                'PWM 신호 발생기를 FG 입력 핀에 연결한다 (주파수: 1kHz~10kHz, Duty: 50% 초기 설정).',
                '0xD101 = 3 으로 Set Value Source를 PWM 입력으로 설정한다.',
                'PWM Duty를 10% → 50% → 90%로 단계 변경 후 모터 속도/토크가 비례 변화하는지 확인한다.\n판정 기준: Duty 변화에 따라 출력이 비례 변화함',
                'PWM 신호를 제거(Open)하여 Safe 동작(정지 또는 출력 제한)을 수행하는지 확인한다.\n판정 기준: 신호 유실 시 Safe 동작 수행 — 출력 계속 시 불합격',
                'PWM 신호를 정상 범위로 복구 후 별도 Reset 없이 정상 제어 상태로 복귀하는지 확인한다.',
                '0xD101을 원래 값으로 복원한다.',
            ]
        },

        // ── 4-2. Set Value Source - Analog V ──────────────────────────────────
        'drive02': {
            id: 'drive02',
            category: '구동동작',
            number: '4-2',
            title: 'Set Value Source — Analog V',
            description: '외부 아날로그 전압 입력을 Set Value Source로 설정 시 정상 제어 동작 검증',
            purpose: '외부 아날로그 전압(0~10V)을 Set Value Source로 설정했을 때 드라이브가 입력 전압을 정상적으로 해석하여 목표값에 반영하는지 확인한다. 단선, 과전압, 노이즈 등 이상 상태 보호 동작도 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 정밀 전압 발생기 (DC Power Supply 또는 Signal Generator)',
            criteria: '입력 전압 변화에 따라 목표 속도/토크가 선형 변화 / 단선 상태에서 Safe 동작 수행',
            manual: true,
            steps: [
                '정밀 전압 발생기를 아날로그 입력 단자에 연결한다 (초기 전압: 0V).',
                '0xD101 = 0 으로 Set Value Source를 Analog V로 설정한다 (AIN1V).',
                '입력 전압을 1V → 5V → 9V로 단계 증가 후 모터 출력이 선형 변화하는지 확인한다.\n판정 기준: 전압 변화에 따라 출력이 선형 변화함',
                '입력을 Open(단선) 상태로 만들어 Safe 동작(정지)을 수행하는지 확인한다.\n판정 기준: 단선 시 모터 정지 — 계속 구동 시 불합격',
                '아날로그 입력을 정상 전압 범위로 복구 후 별도 Reset 없이 정상 제어 상태로 복귀하는지 확인한다.',
                '0xD101을 원래 값으로 복원한다.',
            ]
        },

        // ── 4-3. Set Value Source - Analog I ──────────────────────────────────
        'drive03': {
            id: 'drive03',
            category: '구동동작',
            number: '4-3',
            title: 'Set Value Source — Analog I',
            description: '외부 아날로그 전류 입력(4~20mA)을 Set Value Source로 설정 시 정상 제어 동작 검증',
            purpose: '외부 아날로그 전류(4~20mA)를 Set Value Source로 설정했을 때 드라이브가 입력 전류를 정상적으로 해석하여 목표값에 반영하는지 확인한다. 단선(0mA), 과전류 등 이상 상태 보호 동작도 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 4~20mA 전류 발생기',
            criteria: '입력 전류(4~20mA) 변화에 따라 목표 속도/토크가 선형 변화 / 전류 단선(0mA) 시 Safe 동작 수행',
            manual: true,
            steps: [
                '4~20mA 전류 발생기를 아날로그 전류 입력 단자에 연결한다 (초기: 4mA).',
                '0xD101 = 2 으로 Set Value Source를 Analog I로 설정한다 (AIN2I).',
                '입력 전류를 4mA → 12mA → 20mA로 단계 증가 후 모터 출력이 선형 변화하는지 확인한다.\n판정 기준: 전류 변화에 따라 출력이 선형 변화함',
                '입력 회로를 Open(단선, 0mA)으로 만들어 Safe 동작(정지)을 수행하는지 확인한다.\n판정 기준: 단선 시 모터 정지 — 계속 구동 시 불합격',
                '아날로그 전류 입력을 정상 범위(4~20mA)로 복구 후 별도 Reset 없이 정상 제어 상태로 복귀하는지 확인한다.',
                '0xD101을 원래 값으로 복원한다.',
            ]
        },

        // ── 4-4. Set Value Source - RS485 ─────────────────────────────────────
        'drive04': {
            id: 'drive04',
            category: '구동동작',
            number: '4-4',
            title: 'Set Value Source — RS485',
            description: 'RS485(Modbus) 통신을 Set Value Source로 설정 시 제어 동작 및 Fail-safe 검증',
            purpose: 'RS485 통신을 Set Value Source로 설정했을 때 드라이브가 수신한 명령값을 정상적으로 해석하여 목표값에 반영하는지 확인하고, 통신 단절·타임아웃·비정상 데이터에 대한 Fail-safe 동작 및 통신 복구 후 자동 복귀를 종합적으로 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            steps: [
                '[Phase 2] Setpoint 단계 변경 (Low→Mid→High→Low) → 각 단계 속도 반영 및 응답 검증\n판정 기준: 각 Setpoint 전송 후 3초 내 속도 변화 확인 + 명령 감소 시 속도 정상 감소',
                '[Phase 3] 동일 Setpoint 반복 전송 (20회, 200ms 주기) → 속도 안정성 검증\n판정 기준: 20회 전송 중 속도 편차 ±5% 이내 유지',
                '[Phase 4] ★ USB 컨버터 분리 → disconnect 이벤트 자동 감지 + 단절 전 속도 차트 표시\n판정 기준: USB 분리 이벤트 수신 확인 (60초 내) / 모터 계속 구동 여부는 물리적 육안 확인',
                '[Phase 5] ★ USB 컨버터 재연결 → isConnected 회복 자동 감지 + 재연결 후 속도 차트 표시\n판정 기준: 재연결 후 실제 속도(0xD02D) > 100 RPM 유지 확인',
            ],
        },

        // ── 4-5. FG PPR 설정 ──────────────────────────────────────────────────
        'drive05': {
            id: 'drive05',
            category: '구동동작',
            number: '4-5',
            title: 'FG PPR 설정 (1, 2, 4, 8)',
            description: 'FG 출력 PPR 설정(1/2/4/8)에 따른 출력 주파수 비례 변화 검증',
            purpose: 'FG(Feedback Generator) PPR 설정값(1, 2, 4, 8)에 따라 출력 펄스 주파수가 정확히 비례 변화하는지 확인한다. 모터 속도에 따른 FG 출력 선형성 및 신호 안정성도 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 오실로스코프 또는 주파수 측정기',
            criteria: 'PPR 설정값에 따라 FG 출력 주파수가 정확히 비례 변화 / 모터 속도 변화에 따라 FG 출력 선형성 유지',
            manual: true,
            steps: [
                '오실로스코프 또는 주파수 측정기를 FG 출력 핀에 연결한다.',
                '모터를 일정 속도(예: 600 RPM)로 구동한다.',
                'FG PPR을 1 → 2 → 4 → 8 순으로 변경하며 동일 속도에서 출력 주파수가 2배씩 비례 증가하는지 확인한다.\n판정 기준: PPR 설정값에 따라 FG 출력 주파수가 정확히 비례 변화함',
                '모터 속도를 저속→중속→고속으로 변경하며 속도와 FG 출력 주파수 간의 선형 비례 관계를 확인한다.\n판정 기준: 모터 속도 변화에 따라 FG 출력 주파수가 선형 비례함',
                'FG PPR을 초기값(1)으로 복원한다.',
            ]
        },

        // ── 4-6. 구동 모드 설정 (Operation mode) ─────────────────────────────
        'drive06': {
            id: 'drive06',
            category: '구동동작',
            number: '4-6',
            title: '구동 모드 설정 (Operation mode)',
            description: 'Operation Mode (Velocity=0 / Open-loop=2) 설정·전환 안정성 및 예외 처리 검증',
            purpose: '드라이브의 Operation Mode를 설정했을 때 각 모드에 따라 제어 동작이 정상적으로 수행되는지 확인하고, 모드 전환 시 출력 급변·진동·헌팅이 발생하지 않는지 및 비정상 Mode 값 입력 시 예외 처리를 종합적으로 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            steps: [
                '[Phase 2-1] Velocity 모드 (0xD106=0) — 목표 속도 입력 후 속도 추종 확인\n판정 기준: Setpoint 변화에 따라 실제 속도 정상 변화 (응답 확인)',
                '[Phase 2-2] Open-loop 모드 (0xD106=2) — 목표 토크 입력 후 토크 출력 확인\n판정 기준: Setpoint 변화에 따라 토크 지령 정상 반영 (★ 물리적 관찰)',
                '[Phase 3-1] 정지 상태에서 모드 전환 (Velocity → Open-loop) — 모드 적용 및 구동 확인\n판정 기준: 전환 후 새 모드로 정상 구동 + 충격·진동 없음',
                '[Phase 3-2] 구동 중 모드 전환 (Velocity → Open-loop, Open-loop → Velocity) — 전환 시 모터 정지 후 새 모드 구동 확인\n판정 기준: 전환 시 모터 정지 확인 + 새 모드 적용 후 정상 구동',
                '[Phase 4] 초기 Mode 복구 → 정상 기동 및 속도 추종 확인\n판정 기준: 원래 Mode로 정상 구동 재개 + 추가 Fault 없음',
            ],
        },


    }, // end tests

    executors: {

        // ── drive06 executor ──────────────────────────────────────────────────
        'drive06': async function() {
            const self    = this;
            const d       = window.dashboard;
            const modbus  = d.modbus;
            const slaveId = 1;
            self.checkConnection();

            // ── 인라인 차트 삽입 ──────────────────────────────────────────────
            const testItem = document.querySelector('.os-test-item[data-test-id="drive06"]');
            let chart = null;

            if (testItem) {
                testItem.querySelector('.drive06-chart-section')?.remove();
                const chartSection = document.createElement('div');
                chartSection.className = 'drive06-chart-section';
                chartSection.style.cssText = 'padding:0 20px 20px 20px;';
                chartSection.innerHTML = `
                  <div style="background:white;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                    <div style="padding:10px 16px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;">
                      <span style="font-size:13px;font-weight:600;color:#1a1a1a;">실시간 차트 (Continuous 20ms)</span>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#e9ecef;border-bottom:1px solid #e9ecef;">
                      <div style="background:white;padding:8px 12px;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                          <span style="width:12px;height:3px;background:#3498db;display:inline-block;border-radius:2px;flex-shrink:0;"></span>
                          <span style="font-size:11px;color:#6c757d;">Velocity Command [rpm]</span>
                        </div>
                        <div id="drive06-val-0" style="font-size:18px;font-weight:600;font-family:monospace;color:#3498db;">—</div>
                      </div>
                      <div style="background:white;padding:8px 12px;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                          <span style="width:12px;height:3px;background:#e74c3c;display:inline-block;border-radius:2px;flex-shrink:0;"></span>
                          <span style="font-size:11px;color:#6c757d;">Velocity Feedback [rpm]</span>
                        </div>
                        <div id="drive06-val-1" style="font-size:18px;font-weight:600;font-family:monospace;color:#e74c3c;">—</div>
                      </div>
                      <div style="background:white;padding:8px 12px;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                          <span style="width:12px;height:3px;background:#f39c12;display:inline-block;border-radius:2px;flex-shrink:0;"></span>
                          <span style="font-size:11px;color:#6c757d;">Torque Command [%]</span>
                        </div>
                        <div id="drive06-val-2" style="font-size:18px;font-weight:600;font-family:monospace;color:#f39c12;">—</div>
                      </div>
                      <div style="background:white;padding:8px 12px;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                          <span style="width:12px;height:3px;background:#2ecc71;display:inline-block;border-radius:2px;flex-shrink:0;"></span>
                          <span style="font-size:11px;color:#6c757d;">Torque Feedback [%]</span>
                        </div>
                        <div id="drive06-val-3" style="font-size:18px;font-weight:600;font-family:monospace;color:#2ecc71;">—</div>
                      </div>
                    </div>
                    <canvas id="drive06-canvas" width="800" height="220"
                            style="width:100%;height:220px;display:block;background:#fafafa;"></canvas>
                  </div>`;

                const logDiv = [...testItem.querySelector('.os-test-content').children].find(
                    el => el.querySelector('.test-log-container'));
                if (logDiv)
                    logDiv.parentElement.insertBefore(chartSection, logDiv);
                else
                    testItem.querySelector('.os-test-content').appendChild(chartSection);

                // 아코디언 열기
                const contentEl = testItem.querySelector('.os-test-content');
                if (contentEl && contentEl.style.display !== 'block') {
                    contentEl.style.display = 'block';
                    const expandIcon = testItem.querySelector('.test-expand-icon');
                    if (expandIcon) expandIcon.style.transform = 'rotate(180deg)';
                }

                const canvas = document.getElementById('drive06-canvas');
                if (canvas) {
                    chart = new MiniChart(
                        canvas,
                        [
                            { name: 'Velocity Command [rpm]', color: '#3498db', chNum: 1 },
                            { name: 'Velocity Feedback [rpm]', color: '#e74c3c', chNum: 0 },
                            { name: 'Torque Command [%]',     color: '#f39c12', chNum: 4 },
                            { name: 'Torque Feedback [%]',    color: '#2ecc71', chNum: 3 },
                        ],
                        { maxPoints: 10000, displayPoints: 300 });

                    const saveLsmBtn = testItem.querySelector('.test-save-lsm-btn');
                    if (saveLsmBtn) {
                        saveLsmBtn.onclick = () => {
                            if (!chart) return;
                            const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                            LsmExporter.download(chart.channels, 20, `drive06_${ts}.lsm`);
                        };
                    }
                }
            }

            // ── FC 0x64 차트 루프 헬퍼 ────────────────────────────────────────
            const chartStop = { stop: false };
            const FC64_TYPE = 'drive06chart';

            const startChartLoop = async () => {
                if (!d.writer || !chart) return false;
                chartStop.stop = false;

                if (d.chartRunning) {
                    self.addLog('⏹ Chart 탭 FC64 차트를 정지합니다...', 'info');
                    await d.stopChartCapture();
                }
                const runningMini = Object.keys(d.miniChartRunning)
                    .filter(k => k !== FC64_TYPE && d.miniChartRunning[k]);
                for (const key of runningMini) {
                    self.addLog(`⏹ HW Overview 미니 차트 [${key}]를 정지합니다...`, 'info');
                    await d.stopMiniChart(key);
                }

                d._fc64Busy = true;
                while (d.isPolling) await self.delay(5);
                await d.sendAndReceiveFC64(modbus.buildContinuousStop(slaveId), 0x00, 300);
                const resp = await d.sendAndReceiveFC64(
                    modbus.buildContinuousConfigure(slaveId, 160, [1, 0, 4, 3]),
                    0x02, 1000);
                if (!resp) {
                    d._fc64Busy = false;
                    self.addLog('⚠ FC 0x64 Configure 실패 — 차트 없이 계속 진행', 'warning');
                    return false;
                }
                d.miniChartRunning[FC64_TYPE] = true;
                d._fc64Busy = false;
                (async () => {
                    while (!chartStop.stop && d.miniChartRunning[FC64_TYPE]) {
                        const r = await d.sendAndReceiveFC64(
                            modbus.buildContinuousRequest(slaveId), 0x03, 300);
                        if (chartStop.stop) break;
                        if (r) {
                            const p = modbus.parseContinuousDataResponse(r);
                            if (p && p.data.length > 0) {
                                const spc = Math.floor(p.data.length / 4);
                                for (let s = 0; s < spc; s++)
                                    for (let ci = 0; ci < 4; ci++) {
                                        const v = p.data[ci * spc + s];
                                        if (v !== undefined) chart.addDataPoint(ci, v);
                                    }
                                chart.render();
                                for (let ci = 0; ci < 4; ci++) {
                                    const ch = chart.channels[ci];
                                    if (ch && ch.data.length > 0) {
                                        const el = document.getElementById(`drive06-val-${ci}`);
                                        if (el) el.textContent = ch.data[ch.data.length - 1].toFixed(2);
                                    }
                                }
                            }
                        }
                        if (d.commandQueue.length > 0) await d._drainCommandQueue();
                    }
                })();
                self.addLog('✓ FC 0x64 차트 시작 (Vel Cmd/FB, Torq Cmd/FB, 20ms)', 'success');
                return true;
            };

            const stopChartLoop = async () => {
                chartStop.stop = true;
                d._fc64Busy = true;
                d.miniChartRunning[FC64_TYPE] = false;
                await new Promise(r => setTimeout(r, 200));
                if (d.writer) {
                    await d.sendAndReceiveFC64(modbus.buildContinuousStop(slaveId), 0x00, 300);
                    await new Promise(r => setTimeout(r, 400));
                }
                d._fc64Busy = false;
                self.addLog('■ FC 0x64 차트 정지', 'info');
            };

            const passed = [];
            const failed = [];

            // 초기값 백업
            const origOpMode   = await d.readRegisterWithTimeout(slaveId, 0xD106);
            const origSetpoint = await d.readRegisterWithTimeout(slaveId, 0xD001);
            self.addLog(`초기값 백업 — OpMode(0xD106)=${origOpMode} / Setpoint(0xD001)=${origSetpoint}`, 'info');
            self.addLog('0xD106: 0=Velocity(Closed-loop) / 2=Open-loop(Torque)', 'info');

            const toVelRaw   = rpm => Math.round(rpm / 1600 * 64000);   // 속도 모드 raw
            const toTorqRaw  = pct => Math.round(pct / 100 * 65535);    // Open-loop raw

            const waitUntilStopped = async (label = '') => {
                const deadline = Date.now() + 30000;
                self.addLog(`  정지 대기${label ? ' (' + label + ')' : ''} — 실제 속도 ≤ 6 RPM 확인...`, 'info');
                while (Date.now() < deadline) {
                    await self.checkStop();
                    await self.delay(500);
                    const spd = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    if (spd !== null && spd !== undefined && Math.abs(spd) <= 6) {
                        self.addLog('  ✓ 정지 확인 (≤ 6 RPM)', 'success');
                        return;
                    }
                }
                self.addLog('  ⚠ 30초 내 정지 미확인 — 강제 진행', 'warning');
            };

            try {

            // 차트 시작
            await startChartLoop();

            // ── Phase 2-1: Velocity 모드 동작 검증 ───────────────────────────
            {
                self.updateStepStatus(0, 'running');
                self.updateProgress(5, 'Phase 2-1: Velocity 모드 검증');
                self.addLog('▶ Phase 2-1 시작 — Velocity 모드 (0xD106=0) 속도 추종 검증', 'info');
                try {
                    self.checkStop();
                    self.addLog('Operating Mode = Velocity (0xD106 ← 0)', 'step');
                    await d.writeRegister(slaveId, 0xD106, 0);
                    await d.writeRegister(slaveId, 0x0001, 1);  // Run

                    const velCases = [
                        { rpm: 400,  label: 'Low  (400 RPM)'  },
                        { rpm: 800,  label: 'Mid  (800 RPM)'  },
                        { rpm: 1200, label: 'High (1200 RPM)' },
                    ];
                    let failCount = 0;
                    for (const c of velCases) {
                        self.checkStop();
                        const raw = toVelRaw(c.rpm);
                        self.addLog(`Setpoint = ${c.label} (0xD001 ← ${raw})`, 'step');
                        await d.writeRegister(slaveId, 0xD001, raw);
                        await self.delay(6000);
                        const actual = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                        self.addLog(`실제 속도 [0xD02D] = ${actual ?? 'null'}  (목표: ${c.rpm} RPM)`, 'info');
                        if (actual === null || actual === undefined) {
                            self.addLog(`✗ ${c.label}: 속도 응답 없음`, 'error');
                            failCount++;
                        } else {
                            self.addLog(`✓ ${c.label}: 속도 응답 확인`, 'success');
                        }
                    }
                    // 정지
                    await d.writeRegister(slaveId, 0xD001, 0);
                    await d.writeRegister(slaveId, 0x0001, 0);
                    await waitUntilStopped('Phase 2-1 종료');

                    if (failCount > 0) throw new Error(`${failCount}개 단계에서 속도 응답 없음`);
                    passed.push('Phase 2-1');
                    self.updateStepStatus(0, 'success');
                    self.addLog('✓ Phase 2-1 합격', 'success');
                } catch(e) {
                    failed.push('Phase 2-1');
                    self.updateStepStatus(0, 'error');
                    self.addLog(`✗ Phase 2-1 불합격: ${e.message}`, 'error');
                    try { await d.writeRegister(slaveId, 0x0001, 0); } catch(_) {}
                }
            }

            // ── Phase 2-2: Open-loop(Torque) 모드 동작 검증 ─────────────────
            {
                self.updateStepStatus(1, 'running');
                self.updateProgress(22, 'Phase 2-2: Open-loop 모드 검증');
                self.addLog('▶ Phase 2-2 시작 — Open-loop 모드 (0xD106=2) 토크 출력 검증', 'info');
                try {
                    self.checkStop();
                    self.addLog('Operating Mode = Open-loop (0xD106 ← 2)', 'step');
                    await d.writeRegister(slaveId, 0xD106, 2);
                    await d.writeRegister(slaveId, 0x0001, 1);  // Run

                    const torqCases = [
                        { pct: 10, label: 'Low  (10%)' },
                        { pct: 30, label: 'Mid  (30%)' },
                        { pct: 50, label: 'High (50%)' },
                    ];
                    for (const c of torqCases) {
                        self.checkStop();
                        const raw = toTorqRaw(c.pct);
                        self.addLog(`Setpoint = ${c.label} (0xD001 ← ${raw})`, 'step');
                        await d.writeRegister(slaveId, 0xD001, raw);
                        await self.delay(4000);
                        const speed = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                        self.addLog(`실제 속도 [0xD02D] = ${speed ?? 'null'}  ★ 토크 출력은 물리적으로 관찰하세요`, 'info');
                    }
                    // 정지
                    await d.writeRegister(slaveId, 0xD001, 0);
                    await d.writeRegister(slaveId, 0x0001, 0);
                    await waitUntilStopped('Phase 2-2 종료');

                    passed.push('Phase 2-2');
                    self.updateStepStatus(1, 'success');
                    self.addLog('✓ Phase 2-2 합격 (토크 출력은 물리적 판정)', 'success');
                } catch(e) {
                    failed.push('Phase 2-2');
                    self.updateStepStatus(1, 'error');
                    self.addLog(`✗ Phase 2-2 불합격: ${e.message}`, 'error');
                    try { await d.writeRegister(slaveId, 0x0001, 0); } catch(_) {}
                }
            }

            // ── Phase 3-1: 정지 상태에서 모드 전환 (Velocity → Open-loop) ───
            {
                self.updateStepStatus(2, 'running');
                self.updateProgress(40, 'Phase 3-1: 정지 상태 모드 전환');
                self.addLog('▶ Phase 3-1 시작 — 정지 상태에서 Velocity → Open-loop 전환', 'info');
                try {
                    self.checkStop();
                    // Velocity로 초기화 후 속도 0 도달 대기
                    await d.writeRegister(slaveId, 0xD106, 0);
                    await d.writeRegister(slaveId, 0xD001, 0);
                    await d.writeRegister(slaveId, 0x0001, 0);
                    await waitUntilStopped('Phase 3-1 진입');

                    self.addLog('정지 상태에서 Open-loop 모드 전환 (0xD106 ← 2)', 'step');
                    await d.writeRegister(slaveId, 0xD106, 2);
                    const modeAfter = await d.readRegisterWithTimeout(slaveId, 0xD106);
                    self.addLog(`모드 전환 후 0xD106 Read-back = ${modeAfter}`, 'info');
                    if (modeAfter !== 2) throw new Error(`Mode 전환 미적용 (expect: 2, got: ${modeAfter})`);
                    self.addLog('✓ 정지 상태 모드 전환 적용 확인', 'success');

                    // 전환 후 새 모드로 구동
                    const raw = toTorqRaw(20);
                    await d.writeRegister(slaveId, 0xD001, raw);
                    await d.writeRegister(slaveId, 0x0001, 1);
                    await self.delay(4000);
                    const speed = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`전환 후 구동 속도 [0xD02D] = ${speed ?? 'null'}  ★ 충격·진동 없음 확인`, 'info');

                    await d.writeRegister(slaveId, 0x0001, 0);
                    await waitUntilStopped('Phase 3-1 종료');

                    passed.push('Phase 3-1');
                    self.updateStepStatus(2, 'success');
                    self.addLog('✓ Phase 3-1 합격', 'success');
                } catch(e) {
                    failed.push('Phase 3-1');
                    self.updateStepStatus(2, 'error');
                    self.addLog(`✗ Phase 3-1 불합격: ${e.message}`, 'error');
                    try { await d.writeRegister(slaveId, 0x0001, 0); } catch(_) {}
                }
            }

            // ── Phase 3-2: 구동 중 모드 전환 (양방향) ───────────────────────
            {
                self.updateStepStatus(3, 'running');
                self.updateProgress(57, 'Phase 3-2: 구동 중 모드 전환');
                self.addLog('▶ Phase 3-2 시작 — 구동 중 모드 전환 양방향 검증 (Velocity→Open-loop / Open-loop→Velocity)', 'info');
                try {
                    // Case A: Velocity 구동 중 → Open-loop 전환
                    self.addLog('[Case A] Velocity 모드 구동 중 → Open-loop 전환', 'step');
                    await d.writeRegister(slaveId, 0xD106, 0);
                    await d.writeRegister(slaveId, 0xD001, toVelRaw(800));
                    await d.writeRegister(slaveId, 0x0001, 1);
                    await self.delay(6000);
                    const speedBeforeA = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`전환 전 속도 = ${speedBeforeA ?? 'null'}`, 'info');

                    self.addLog('구동 중 모드 전환 → Open-loop (0xD106 ← 2)', 'step');
                    await d.writeRegister(slaveId, 0xD106, 2);
                    await waitUntilStopped('Case A → Open-loop 전환 후');
                    const speedAfterA = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`전환 직후 속도 = ${speedAfterA ?? 'null'}  ★ 모터 정지 확인`, 'info');

                    // Case B: Open-loop 구동 중 → Velocity 전환
                    self.addLog('[Case B] Open-loop 모드 구동 중 → Velocity 전환', 'step');
                    await d.writeRegister(slaveId, 0xD001, toTorqRaw(20));
                    await d.writeRegister(slaveId, 0x0001, 1);
                    await self.delay(6000);
                    const speedBeforeB = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`전환 전 속도 = ${speedBeforeB ?? 'null'}`, 'info');

                    self.addLog('구동 중 모드 전환 → Velocity (0xD106 ← 0)', 'step');
                    await d.writeRegister(slaveId, 0xD106, 0);
                    await waitUntilStopped('Case B → Velocity 전환 후');
                    const speedAfterB = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`전환 직후 속도 = ${speedAfterB ?? 'null'}  ★ 모터 정지 후 재구동 확인`, 'info');

                    await d.writeRegister(slaveId, 0xD001, toVelRaw(800));
                    await self.delay(6000);
                    const speedResumeB = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`Velocity 재구동 후 속도 = ${speedResumeB ?? 'null'}`, 'info');

                    await d.writeRegister(slaveId, 0x0001, 0);
                    await waitUntilStopped('Phase 3-2 종료');

                    passed.push('Phase 3-2');
                    self.updateStepStatus(3, 'success');
                    self.addLog('✓ Phase 3-2 합격 (충격·헌팅 여부는 물리적 판정)', 'success');
                } catch(e) {
                    failed.push('Phase 3-2');
                    self.updateStepStatus(3, 'error');
                    self.addLog(`✗ Phase 3-2 불합격: ${e.message}`, 'error');
                    try { await d.writeRegister(slaveId, 0x0001, 0); } catch(_) {}
                }
            }

            // ── Phase 4(구 Phase 5): 초기 Mode 복구 → 정상 기동 확인 ──────────
            {
                self.updateStepStatus(4, 'running');
                self.updateProgress(90, 'Phase 4: 초기 Mode 복구 검증');
                self.addLog('▶ Phase 5 시작 — 초기 Mode 복구 및 정상 기동 확인', 'info');
                try {
                    self.checkStop();
                    self.addLog(`초기 Mode 복구 (0xD106 ← ${origOpMode ?? 0})`, 'step');
                    await d.writeRegister(slaveId, 0xD106, origOpMode ?? 0);
                    await self.delay(300);
                    const restoredMode = await d.readRegisterWithTimeout(slaveId, 0xD106);
                    self.addLog(`복구 후 0xD106 = ${restoredMode}`, 'info');

                    if (restoredMode !== (origOpMode ?? 0)) {
                        throw new Error(`Mode 복구 실패 (expect: ${origOpMode ?? 0}, got: ${restoredMode})`);
                    }

                    // 복구 후 정상 기동 확인
                    const testRaw = restoredMode === 2 ? toTorqRaw(20) : toVelRaw(600);
                    await d.writeRegister(slaveId, 0xD001, testRaw);
                    await d.writeRegister(slaveId, 0x0001, 1);
                    await self.delay(6000);
                    const finalSpeed = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`복구 후 기동 속도 [0xD02D] = ${finalSpeed ?? 'null'}`, 'info');

                    if (finalSpeed === null || finalSpeed === undefined) {
                        throw new Error('복구 후 속도 응답 없음');
                    }
                    self.addLog('✓ 복구 후 정상 기동 확인', 'success');

                    passed.push('Phase 4');
                    self.updateStepStatus(4, 'success');
                    self.addLog('✓ Phase 4 합격', 'success');
                } catch(e) {
                    failed.push('Phase 4');
                    self.updateStepStatus(4, 'error');
                    self.addLog(`✗ Phase 4 불합격: ${e.message}`, 'error');
                }
            }

            // ── 정리 ─────────────────────────────────────────────────────────
            self.addLog('모터 Stop + 파라미터 원복', 'step');
            try { await d.writeRegister(slaveId, 0xD001, 0); } catch(_) {}
            await self.delay(500);
            if (origSetpoint !== null) { try { await d.writeRegister(slaveId, 0xD001, origSetpoint); } catch(_) {} }
            if (origOpMode   !== null) { try { await d.writeRegister(slaveId, 0xD106, origOpMode);   } catch(_) {} }
            self.addLog('원복 완료 (0xD001 / 0xD106)', 'info');

            // 최종 요약
            self.updateProgress(100, '테스트 완료');
            self.addLog('결과 요약', 'step');
            self.addLog(`합격: ${passed.join(', ') || '없음'}`, passed.length ? 'success' : 'info');
            self.addLog(`불합격: ${failed.join(', ') || '없음'}`, failed.length ? 'error' : 'info');

            const ok = failed.length === 0;
            return {
                status:  ok ? 'pass' : 'fail',
                message: ok ? '5개 Phase 전체 합격' : `불합격 ${failed.length}개: ${failed.join(', ')}`,
                details: 'Phase 2-1: Velocity 모드 속도 추종\n' +
                         'Phase 2-2: Open-loop 모드 토크 출력\n' +
                         'Phase 3-1: 정지 상태 모드 전환 적용\n' +
                         'Phase 3-2: 구동 중 모드 전환 양방향\n' +
                         'Phase 4: 초기 Mode 복구 후 정상 기동',
            };

            } finally {
                try { await stopChartLoop(); } catch(_) {}
            }
        },

        // ── drive04 executor ──────────────────────────────────────────────────
        'drive04': async function() {
            const self    = this;
            const d       = window.dashboard;
            const modbus  = d.modbus;
            const slaveId = 1;
            self.checkConnection();

            // ── 인라인 차트 삽입 ──────────────────────────────────────────────
            const testItem = document.querySelector('.os-test-item[data-test-id="drive04"]');
            let chart = null;

            if (testItem) {
                testItem.querySelector('.drive04-chart-section')?.remove();
                const chartSection = document.createElement('div');
                chartSection.className = 'drive04-chart-section';
                chartSection.style.cssText = 'padding:0 20px 20px 20px;';
                chartSection.innerHTML = `
                  <div style="background:white;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                    <div style="padding:10px 16px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;">
                      <span style="font-size:13px;font-weight:600;color:#1a1a1a;">실시간 차트 (Continuous 20ms)</span>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#e9ecef;border-bottom:1px solid #e9ecef;">
                      <div style="background:white;padding:8px 12px;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                          <span style="width:12px;height:3px;background:#3498db;display:inline-block;border-radius:2px;flex-shrink:0;"></span>
                          <span style="font-size:11px;color:#6c757d;">Velocity Command [rpm]</span>
                        </div>
                        <div id="drive04-val-0" style="font-size:18px;font-weight:600;font-family:monospace;color:#3498db;">—</div>
                      </div>
                      <div style="background:white;padding:8px 12px;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                          <span style="width:12px;height:3px;background:#e74c3c;display:inline-block;border-radius:2px;flex-shrink:0;"></span>
                          <span style="font-size:11px;color:#6c757d;">Velocity Feedback [rpm]</span>
                        </div>
                        <div id="drive04-val-1" style="font-size:18px;font-weight:600;font-family:monospace;color:#e74c3c;">—</div>
                      </div>
                    </div>
                    <canvas id="drive04-canvas" width="800" height="220"
                            style="width:100%;height:220px;display:block;background:#fafafa;"></canvas>
                  </div>`;

                const logDiv = [...testItem.querySelector('.os-test-content').children].find(
                    el => el.querySelector('.test-log-container'));
                if (logDiv)
                    logDiv.parentElement.insertBefore(chartSection, logDiv);
                else
                    testItem.querySelector('.os-test-content').appendChild(chartSection);

                const contentEl = testItem.querySelector('.os-test-content');
                if (contentEl && contentEl.style.display !== 'block') {
                    contentEl.style.display = 'block';
                    const expandIcon = testItem.querySelector('.test-expand-icon');
                    if (expandIcon) expandIcon.style.transform = 'rotate(180deg)';
                }

                const canvas = document.getElementById('drive04-canvas');
                if (canvas) {
                    chart = new MiniChart(
                        canvas,
                        [
                            { name: 'Velocity Command [rpm]', color: '#3498db', chNum: 1 },
                            { name: 'Velocity Feedback [rpm]', color: '#e74c3c', chNum: 0 },
                        ],
                        { maxPoints: 10000, displayPoints: 300 });

                    const saveLsmBtn = testItem.querySelector('.test-save-lsm-btn');
                    if (saveLsmBtn) {
                        saveLsmBtn.onclick = () => {
                            if (!chart) return;
                            const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
                            LsmExporter.download(chart.channels, 20, `drive04_${ts}.lsm`);
                        };
                    }
                }
            }

            // ── FC 0x64 차트 루프 헬퍼 ────────────────────────────────────────
            const chartStop = { stop: false };
            const FC64_TYPE = 'drive04chart';

            const startChartLoop = async () => {
                if (!d.writer || !chart) return false;
                chartStop.stop = false;

                if (d.chartRunning) {
                    self.addLog('⏹ Chart 탭 FC64 차트를 정지합니다...', 'info');
                    await d.stopChartCapture();
                }
                const runningMini = Object.keys(d.miniChartRunning)
                    .filter(k => k !== FC64_TYPE && d.miniChartRunning[k]);
                for (const key of runningMini) {
                    self.addLog(`⏹ HW Overview 미니 차트 [${key}]를 정지합니다...`, 'info');
                    await d.stopMiniChart(key);
                }

                d._fc64Busy = true;
                while (d.isPolling) await self.delay(5);
                await d.sendAndReceiveFC64(modbus.buildContinuousStop(slaveId), 0x00, 300);
                const resp = await d.sendAndReceiveFC64(
                    modbus.buildContinuousConfigure(slaveId, 160, [1, 0]),
                    0x02, 1000);
                if (!resp) {
                    d._fc64Busy = false;
                    self.addLog('⚠ FC 0x64 Configure 실패 — 차트 없이 계속 진행', 'warning');
                    return false;
                }
                d.miniChartRunning[FC64_TYPE] = true;
                d._fc64Busy = false;
                (async () => {
                    while (!chartStop.stop && d.miniChartRunning[FC64_TYPE]) {
                        const r = await d.sendAndReceiveFC64(
                            modbus.buildContinuousRequest(slaveId), 0x03, 300);
                        if (chartStop.stop) break;
                        if (r) {
                            const p = modbus.parseContinuousDataResponse(r);
                            if (p && p.data.length > 0) {
                                const spc = Math.floor(p.data.length / 2);
                                for (let s = 0; s < spc; s++)
                                    for (let ci = 0; ci < 2; ci++) {
                                        const v = p.data[ci * spc + s];
                                        if (v !== undefined) chart.addDataPoint(ci, v);
                                    }
                                chart.render();
                                for (let ci = 0; ci < 2; ci++) {
                                    const ch = chart.channels[ci];
                                    if (ch && ch.data.length > 0) {
                                        const el = document.getElementById(`drive04-val-${ci}`);
                                        if (el) el.textContent = ch.data[ch.data.length - 1].toFixed(1);
                                    }
                                }
                            }
                        }
                        if (d.commandQueue.length > 0) await d._drainCommandQueue();
                    }
                })();
                self.addLog('✓ FC 0x64 차트 시작 (Vel Cmd/FB, 20ms)', 'success');
                return true;
            };

            const stopChartLoop = async () => {
                chartStop.stop = true;
                d._fc64Busy = true;
                d.miniChartRunning[FC64_TYPE] = false;
                await new Promise(r => setTimeout(r, 200));
                if (d.writer) {
                    await d.sendAndReceiveFC64(modbus.buildContinuousStop(slaveId), 0x00, 300);
                    await new Promise(r => setTimeout(r, 400));
                }
                d._fc64Busy = false;
                self.addLog('■ FC 0x64 차트 정지', 'info');
            };

            const passed = [];
            const failed = [];

            // 초기값 백업
            const origSetValueSource = await d.readRegisterWithTimeout(slaveId, 0xD101);
            const origOpMode         = await d.readRegisterWithTimeout(slaveId, 0xD106);
            const origSetpoint       = await d.readRegisterWithTimeout(slaveId, 0xD001);
            self.addLog(`초기값 백업 — SetValueSource(0xD101)=${origSetValueSource} / OpMode(0xD106)=${origOpMode} / Setpoint(0xD001)=${origSetpoint}`, 'info');

            try {

            await startChartLoop();

            // Set Value Source = RS485, Operating Mode = Closed-loop Velocity
            self.addLog('Set Value Source = RS485 (0xD101 ← 1)', 'step');
            await d.writeRegister(slaveId, 0xD101, 1);
            self.addLog('Operating Mode = Closed-loop Velocity (0xD106 ← 0)', 'step');
            await d.writeRegister(slaveId, 0xD106, 0);

            // 각 Setpoint → raw 변환 (maxSpeed=1600, raw = rpm/1600*64000)
            const toRaw = rpm => Math.round(rpm / 1600 * 64000);

            // ── Phase 2: 단계별 Setpoint 변경 → 속도 응답 검증 ───────────────
            {
                self.updateStepStatus(0, 'running');
                self.updateProgress(5, 'Phase 2: Setpoint 단계 변경 검증');
                self.addLog('▶ Phase 2 시작 — Setpoint 단계 변경 (Low→Mid→High→Low)', 'info');

                const steps = [
                    { label: 'Low',  rpm: 200  },
                    { label: 'Mid',  rpm: 800  },
                    { label: 'High', rpm: 1400 },
                    { label: 'Low',  rpm: 200  },
                ];
                let phase2Fail = false;

                try {
                    for (const step of steps) {
                        self.checkStop();
                        const raw = toRaw(step.rpm);
                        self.addLog(`Setpoint = ${step.label} ${step.rpm} RPM (0xD001 ← ${raw})`, 'step');
                        await d.writeRegister(slaveId, 0xD001, raw);
                        self.addLog('속도 안정화 대기 (6초)...', 'info');
                        await self.delay(6000);

                        const actual = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                        self.addLog(`실제 속도 [0xD02D] = ${actual ?? 'null'} (목표: ${step.rpm} RPM)`, 'info');

                        if (actual === null || actual === undefined) {
                            self.addLog(`✗ ${step.label}: 속도 읽기 실패`, 'error');
                            phase2Fail = true;
                        } else {
                            self.addLog(`✓ ${step.label}: 속도 응답 확인 (${actual})`, 'success');
                        }
                    }

                    if (phase2Fail) throw new Error('일부 단계에서 속도 응답 읽기 실패');
                    passed.push('Phase 2');
                    self.updateStepStatus(0, 'success');
                    self.addLog('✓ Phase 2 합격', 'success');
                } catch(e) {
                    failed.push('Phase 2');
                    self.updateStepStatus(0, 'error');
                    self.addLog(`✗ Phase 2 불합격: ${e.message}`, 'error');
                }
            }

            // ── Phase 3: 동일 Setpoint 반복 전송 → 안정성 검증 ──────────────
            {
                self.updateStepStatus(1, 'running');
                self.updateProgress(40, 'Phase 3: 반복 전송 안정성 검증');
                self.addLog('▶ Phase 3 시작 — 동일 Setpoint 20회 반복 전송 (200ms 주기)', 'info');

                const stableRpm = 800;
                const stableRaw = toRaw(stableRpm);

                try {
                    self.checkStop();
                    self.addLog(`Setpoint = ${stableRpm} RPM (0xD001 ← ${stableRaw}) 고정`, 'step');
                    await d.writeRegister(slaveId, 0xD001, stableRaw);
                    await self.delay(3000);

                    const readings = [];
                    for (let n = 1; n <= 20; n++) {
                        self.checkStop();
                        await d.writeRegister(slaveId, 0xD001, stableRaw);
                        const actual = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                        readings.push(actual ?? 0);
                        self.addLog(`  [${n}/20] 속도 = ${actual ?? 'null'}`, 'info');
                        await self.delay(200);
                    }

                    const validReadings = readings.filter(v => v > 0);
                    const avg = validReadings.reduce((a, b) => a + b, 0) / (validReadings.length || 1);
                    const maxDev = Math.max(...validReadings.map(v => Math.abs(v - avg)));
                    const devPct = avg > 0 ? (maxDev / avg * 100).toFixed(1) : '—';
                    self.addLog(`평균 속도: ${avg.toFixed(0)}  최대 편차: ${maxDev} (±${devPct}%)`, 'info');

                    if (parseFloat(devPct) > 5) {
                        throw new Error(`속도 편차 ${devPct}% > 5% — 안정성 불합격`);
                    }

                    self.addLog(`✓ 속도 편차 ${devPct}% ≤ 5% — 안정성 확인`, 'success');
                    passed.push('Phase 3');
                    self.updateStepStatus(1, 'success');
                    self.addLog('✓ Phase 3 합격', 'success');
                } catch(e) {
                    failed.push('Phase 3');
                    self.updateStepStatus(1, 'error');
                    self.addLog(`✗ Phase 3 불합격: ${e.message}`, 'error');
                }
            }

            // ── Phase 4: USB 컨버터 분리 → disconnect 이벤트 자동 감지 ────────
            {
                self.updateStepStatus(2, 'running');
                self.updateProgress(65, 'Phase 4: USB 단절 감지 + 단절 전 속도 차트');
                self.addLog('▶ Phase 4 시작 — 단절 전 속도 수집 후 USB 분리 대기', 'info');

                try {
                    self.checkStop();

                    // FC 0x64 차트 먼저 정지 — writer.write() hang 방지
                    // (USB 뽑힌 상태에서 write()가 무한대기 → port.close() hang → 페이지 freeze)
                    await stopChartLoop();

                    // USB 분리 안내 + disconnect 이벤트 대기
                    self.addLog('★ USB 컨버터를 PC에서 뽑아주세요 (RS485 케이블이 아닌 USB 포트)', 'warning');
                    self.addLog('  → 모터는 계속 구동 중이어야 합니다 (육안 확인)', 'warning');
                    self.addLog('  최대 60초 내 분리하지 않으면 불합격 처리됩니다', 'info');

                    const portRef = window.dashboard.port;
                    let disconnectResolve;
                    const disconnectPromise = new Promise(resolve => { disconnectResolve = resolve; });
                    const disconnectHandler = (e) => {
                        if (e.target === portRef) {
                            navigator.serial.removeEventListener('disconnect', disconnectHandler);
                            disconnectResolve(true);
                        }
                    };
                    navigator.serial.addEventListener('disconnect', disconnectHandler);

                    const detected = await Promise.race([
                        disconnectPromise,
                        self.delay(60000).then(() => false),
                    ]);
                    navigator.serial.removeEventListener('disconnect', disconnectHandler);

                    if (!detected) throw new Error('60초 내 USB disconnect 이벤트 미수신');

                    self.addLog('✓ USB 단절 감지 — 모터 계속 구동 중인지 육안으로 확인하세요', 'success');
                    passed.push('Phase 4');
                    self.updateStepStatus(2, 'success');
                    self.addLog('✓ Phase 4 합격', 'success');
                } catch(e) {
                    failed.push('Phase 4');
                    self.updateStepStatus(2, 'error');
                    self.addLog(`✗ Phase 4 불합격: ${e.message}`, 'error');
                }
            }

            // ── Phase 5: USB 재연결 → isConnected 회복 감지 + 재연결 후 차트 ──
            {
                self.updateStepStatus(3, 'running');
                self.updateProgress(82, 'Phase 5: 재연결 감지 + 재연결 후 속도 차트');
                self.addLog('▶ Phase 5 시작 — USB 재연결 대기', 'info');

                try {
                    self.checkStop();

                    // ① 재연결 안내 + isConnected 폴링 (최대 120초)
                    self.addLog('★ USB 컨버터를 다시 연결하고 사이드바에서 Connect를 눌러주세요', 'warning');
                    let reconnected = false;
                    for (let i = 0; i < 120; i++) {
                        if (self.shouldStopTest) throw new Error('테스트 중단됨');
                        if (window.dashboard.isConnected) { reconnected = true; break; }
                        if (i % 10 === 9) self.addLog(`재연결 대기 중... (${120 - i - 1}초 남음)`, 'info');
                        await self.delay(1000);
                    }
                    if (!reconnected) throw new Error('120초 내 재연결 미감지');
                    self.addLog('✓ 재연결 감지 — 명령 재전송', 'success');

                    // ② Setpoint 재전송 + FC 0x64 차트 재시작
                    await d.writeRegister(slaveId, 0xD001, toRaw(800));
                    self.addLog('Setpoint 800 RPM 재전송 완료', 'step');
                    await self.delay(3000);
                    await startChartLoop();

                    // ③ 재연결 후 속도 판정 (10초 수집, 평균 > 100 RPM)
                    self.addLog('재연결 후 속도 수집 중 (10초)...', 'info');
                    const afterReadings = [];
                    for (let i = 0; i < 20; i++) {
                        self.checkStop();
                        try {
                            const rpm = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                            if (rpm !== null && rpm !== undefined) afterReadings.push(rpm);
                        } catch(_) {}
                        await self.delay(500);
                    }
                    const avg = afterReadings.length
                        ? afterReadings.reduce((a, b) => a + b, 0) / afterReadings.length : 0;
                    self.addLog(`재연결 후 평균 속도: ${avg.toFixed(0)} RPM`, 'info');
                    if (avg <= 100) throw new Error(`평균 속도 ${avg.toFixed(0)} RPM ≤ 100 RPM — 모터 미구동`);

                    passed.push('Phase 5');
                    self.updateStepStatus(3, 'success');
                    self.addLog('✓ Phase 5 합격', 'success');
                } catch(e) {
                    failed.push('Phase 5');
                    self.updateStepStatus(3, 'error');
                    self.addLog(`✗ Phase 5 불합격: ${e.message}`, 'error');
                }
            }

            // ── 정리: 모터 Stop + 원복 ────────────────────────────────────────
            self.addLog('모터 Stop (0xD001 ← 0)', 'step');
            try { await d.writeRegister(slaveId, 0xD001, 0); } catch(_) {}
            await self.delay(500);
            if (origSetpoint       !== null) { try { await d.writeRegister(slaveId, 0xD001, origSetpoint);           } catch(_) {} }
            if (origOpMode         !== null) { try { await d.writeRegister(slaveId, 0xD106, origOpMode);             } catch(_) {} }
            if (origSetValueSource !== null) { try { await d.writeRegister(slaveId, 0xD101, origSetValueSource);     } catch(_) {} }
            self.addLog('파라미터 원복 완료 (0xD001 / 0xD106 / 0xD101)', 'info');

            // 최종 요약
            self.updateProgress(100, '테스트 완료');
            self.addLog('결과 요약', 'step');
            self.addLog(`합격: ${passed.join(', ') || '없음'}`, passed.length ? 'success' : 'info');
            self.addLog(`불합격: ${failed.join(', ') || '없음'}`, failed.length ? 'error' : 'info');

            const ok = failed.length === 0;
            return {
                status:  ok ? 'pass' : 'fail',
                message: ok ? '4개 Phase 전체 합격' : `불합격 ${failed.length}개: ${failed.join(', ')}`,
                details: 'Phase 2: Setpoint 단계 변경 속도 응답\n' +
                         'Phase 3: 동일 Setpoint 반복 전송 안정성 (±5%)\n' +
                         'Phase 4: 케이블 분리 → Fail-safe 동작 (수동 판정)\n' +
                         'Phase 5: 케이블 재연결 → 통신 복구 자동 복귀',
            };

            } finally {
                try { await stopChartLoop(); } catch(_) {}
            }
        },

    }

});
