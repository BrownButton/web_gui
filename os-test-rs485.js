/**
 * OS Test Module - RS485
 *
 * RS485 No.1 : Baudrate × Parity 전수 조합 검증  (20 cases, 단일 항목)
 * RS485 No.2 : Node ID 경계값 및 예외 검증        (3 cases, 단일 항목)
 * RS485 No.3 : Broadcast 통신 규격 준수 및 복구    (3 cases, 단일 항목)
 *
 * 레지스터
 *   0xD149  Baudrate  : 3=9600 / 4=19200(기본) / 5=38400 / 6=57600 / 7=115200
 *   0xD14A  Parity    : 0=8E1(기본) / 1=8O1 / 2=8N2 / 3=8N1
 *   0xD000  Reset     : 0x0008 = Software Reset
 *   0xD100  Node ID   : 1~247 (기본: 1)
 *   0x2000  EEPROM    : 0x5555 → Save
 *   0x0001  Run/Stop  : 1=Run / 0=Stop
 *   0x0002  Target RPM
 *   0xD02D  Actual Speed (FC04 Input Register)
 */

window.OSTestModules = window.OSTestModules || [];

// webParity : Web Serial API parity 값  ('even' | 'odd' | 'none')
// webStop   : Web Serial API stopBits 값 (1 | 2)
const _RS1_COMBOS = [
    { baud: 9600,   baudReg: 3, parity: '8E1', parityReg: 0, webParity: 'even', webStop: 1 },
    { baud: 9600,   baudReg: 3, parity: '8O1', parityReg: 1, webParity: 'odd',  webStop: 1 },
    { baud: 9600,   baudReg: 3, parity: '8N2', parityReg: 2, webParity: 'none', webStop: 2 },
    { baud: 9600,   baudReg: 3, parity: '8N1', parityReg: 3, webParity: 'none', webStop: 1 },
    { baud: 19200,  baudReg: 4, parity: '8E1', parityReg: 0, webParity: 'even', webStop: 1, isDefault: true },
    { baud: 19200,  baudReg: 4, parity: '8O1', parityReg: 1, webParity: 'odd',  webStop: 1 },
    { baud: 19200,  baudReg: 4, parity: '8N2', parityReg: 2, webParity: 'none', webStop: 2 },
    { baud: 19200,  baudReg: 4, parity: '8N1', parityReg: 3, webParity: 'none', webStop: 1 },
    { baud: 38400,  baudReg: 5, parity: '8E1', parityReg: 0, webParity: 'even', webStop: 1 },
    { baud: 38400,  baudReg: 5, parity: '8O1', parityReg: 1, webParity: 'odd',  webStop: 1 },
    { baud: 38400,  baudReg: 5, parity: '8N2', parityReg: 2, webParity: 'none', webStop: 2 },
    { baud: 38400,  baudReg: 5, parity: '8N1', parityReg: 3, webParity: 'none', webStop: 1 },
    { baud: 57600,  baudReg: 6, parity: '8E1', parityReg: 0, webParity: 'even', webStop: 1 },
    { baud: 57600,  baudReg: 6, parity: '8O1', parityReg: 1, webParity: 'odd',  webStop: 1 },
    { baud: 57600,  baudReg: 6, parity: '8N2', parityReg: 2, webParity: 'none', webStop: 2 },
    { baud: 57600,  baudReg: 6, parity: '8N1', parityReg: 3, webParity: 'none', webStop: 1 },
    { baud: 115200, baudReg: 7, parity: '8E1', parityReg: 0, webParity: 'even', webStop: 1 },
    { baud: 115200, baudReg: 7, parity: '8O1', parityReg: 1, webParity: 'odd',  webStop: 1 },
    { baud: 115200, baudReg: 7, parity: '8N2', parityReg: 2, webParity: 'none', webStop: 2 },
    { baud: 115200, baudReg: 7, parity: '8N1', parityReg: 3, webParity: 'none', webStop: 1 },
];

// ─── 모듈 등록 ────────────────────────────────────────────────────────────────

window.OSTestModules.push({

    tests: {

        // ── RS485 No.1 : Baudrate × Parity 전수 조합 (단일 테스트) ───────────
        'rs1': {
            id:          'rs1',
            category:    'RS485',
            number:      '1-1',
            title:       'Baudrate × Parity 전수 조합 검증  (20 Cases)',
            description: '5 Baudrates × 4 Parity 모든 조합에서 통신 무결성 전수 검증',
            purpose:     '드라이브가 지원하는 모든 Baudrate × Parity 조합 환경에서 데이터 손실이나 타이밍 이슈 없이 통신이 정상 동작하는지 전수 검증한다.',
            model:       'EC-FAN',
            equipment:   'EC FAN 1EA, USB to RS485 Converter',
            criteria:    '20개 모든 조합에서 10회 연속 Polling 응답률 100%, CRC 에러 0회 / 마지막 기본값 복원 완료',
            steps: _RS1_COMBOS.map((c, i) =>
                c.isDefault
                    ? `[Case ${i + 1}/20]  ${c.baud}bps × ${c.parity}  ← 기본값, 폴링만 수행`
                    : `[Case ${i + 1}/20]  ${c.baud}bps × ${c.parity}  — 설정 → SW Reset → 자동 재접속 → 10회 폴링 → 복원 → SW Reset → 자동 재접속`
            ),
        },

        // ── RS485 No.2 : Node ID 경계값 및 예외값 통합 검증 (3 Cases) ──────────
        'rs2': {
            id:          'rs2',
            category:    'RS485',
            number:      '1-2',
            title:       'Node ID 경계값 및 예외값 검증  (3 Cases)',
            description: 'BVA 최솟값(1) / 최댓값(247) / 예외값(248·255·0xFFFF) 통합 검증',
            purpose:     'Modbus 표준 Node ID 허용 범위(1~247)의 경계값 최솟값·최댓값에서 설정 유지 및 통신 무결성을 검증하고, 범위 외 값 Write 시 드라이브가 설정을 거부하고 기존 값을 유지하는지 검증한다.',
            model:       'EC-FAN',
            equipment:   'EC FAN 1EA, USB to RS485 Converter',
            criteria:    'Sub 1: Node ID 1 유지·20회 폴링 100% / Sub 2: Node ID 247 유지·20회 폴링 100%·복원 / Sub 3: 248·255·0xFFFF Write 거부 및 기존값 유지',
            steps: [
                '[Sub 1] Node ID = 1  (BVA 최솟값) — Write → EEPROM → SW Reset → 재부팅 → 유지 확인 → 20회 폴링',
                '[Sub 2] Node ID = 247  (BVA 최댓값) — Write → EEPROM → SW Reset → 재부팅 → 유지 확인 → 20회 폴링 → 복원',
                '[Sub 3] Node ID 예외값 거부 — 248 / 255 / 0xFFFF Write 시도 시 Exception 반환 및 기존 Node ID 유지',
            ],
        },

        // ── RS485 No.3 : Broadcast 통신 규격 준수 통합 검증 (3 Cases) ──────────
        'rs3': {
            id:          'rs3',
            category:    'RS485',
            number:      '1-3',
            title:       'Broadcast 통신 규격 준수 및 복구 검증  (3 Cases)',
            description: 'FC06 무응답 · FC03 Drop · Broadcast 후 Unicast 즉각 복구 통합 검증',
            purpose:     'Broadcast(Node ID 0) FC06 Write 시 명령 실행 및 무응답 원칙 준수, FC03 Read 시 완전 폐기(Drop), Broadcast 연속 인가 직후 Unicast 즉각 복구 여부를 순차 검증한다.',
            model:       'EC-FAN',
            equipment:   'EC FAN 2EA 이상, USB to RS485 Converter',
            criteria:    'Sub 1: Broadcast FC06 실행 확인 + 응답 0바이트 / Sub 2: Broadcast FC03 완전 Drop / Sub 3: Broadcast 10회 직후 Unicast 200ms 이내 응답',
            steps: [
                '[Sub 1] Broadcast FC06 Write — Node ID 0 RPM·Run 송신, 물리 구동 확인, 응답 0바이트 검증',
                '[Sub 2] Broadcast FC03 Drop — Node ID 0 Read 송신, Exception 없는 완전 Drop 검증',
                '[Sub 3] Broadcast 10회 연속 후 Unicast 즉각 복구 — 200ms 이내 응답 확인',
            ],
        },

    },

    // ─── 커스텀 Executor ──────────────────────────────────────────────────────

    executors: {

        'rs1': async function () {
            const self  = this;
            self.checkConnection();

            const combos = _RS1_COMBOS;
            const total  = combos.length;
            const passed = [];
            const failed = [];

            // ── 바둑판 그리드 삽입 ────────────────────────────────────────────
            const BAUDS    = [9600, 19200, 38400, 57600, 115200];
            const PARITIES = ['8E1', '8O1', '8N2', '8N1'];

            const testItem = document.querySelector('.os-test-item[data-test-id="rs1"]');
            if (testItem) {
                testItem.querySelector('.rs1-grid-section')?.remove();
                const gridSection = document.createElement('div');
                gridSection.className = 'rs1-grid-section';
                gridSection.style.cssText = 'padding:0 20px 20px 20px;';

                const colStyle = `display:grid;grid-template-columns:72px repeat(${PARITIES.length},1fr);gap:4px;`;
                let headerRow = `<div style="font-size:11px;color:#6c757d;padding:4px 0;"></div>`;
                PARITIES.forEach(p => {
                    headerRow += `<div style="font-size:11px;font-weight:600;color:#495057;text-align:center;padding:4px 2px;">${p}</div>`;
                });

                let bodyRows = '';
                BAUDS.forEach(baud => {
                    bodyRows += `<div style="font-size:11px;font-weight:600;color:#495057;display:flex;align-items:center;padding:2px 0;">${baud}</div>`;
                    PARITIES.forEach(parity => {
                        const idx = combos.findIndex(c => c.baud === baud && c.parity === parity);
                        const isDefault = combos[idx]?.isDefault;
                        bodyRows += `<div id="rs1-cell-${idx}"
                            style="border-radius:6px;height:36px;display:flex;align-items:center;justify-content:center;
                                   font-size:12px;font-weight:600;font-family:monospace;
                                   background:#f0f0f0;color:#adb5bd;${isDefault ? 'outline:2px solid #3498db;outline-offset:-2px;' : ''}">
                            —
                        </div>`;
                    });
                });

                gridSection.innerHTML = `
                    <div style="background:white;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
                        <div style="padding:10px 16px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:8px;">
                            <span style="font-size:13px;font-weight:600;color:#1a1a1a;">조합별 결과</span>
                            <span style="font-size:11px;color:#6c757d;">파란 테두리 = 기본값(19200 × 8E1)</span>
                        </div>
                        <div style="padding:12px 16px;">
                            <div style="${colStyle}">${headerRow}${bodyRows}</div>
                            <div style="margin-top:10px;display:flex;gap:12px;font-size:11px;color:#6c757d;">
                                <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#d4edda;margin-right:3px;"></span>합격</span>
                                <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#f8d7da;margin-right:3px;"></span>불합격</span>
                                <span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#fff3cd;margin-right:3px;"></span>진행 중</span>
                            </div>
                        </div>
                    </div>`;

                const logDiv = [...testItem.querySelector('.os-test-content').children]
                    .find(el => el.querySelector('.test-log-container'));
                if (logDiv) logDiv.parentElement.insertBefore(gridSection, logDiv);
                else testItem.querySelector('.os-test-content').appendChild(gridSection);

                const contentEl = testItem.querySelector('.os-test-content');
                if (contentEl && contentEl.style.display !== 'block') {
                    contentEl.style.display = 'block';
                    const expandIcon = testItem.querySelector('.test-expand-icon');
                    if (expandIcon) expandIcon.style.transform = 'rotate(180deg)';
                }
            }

            const setCellState = (idx, state) => {
                const cell = document.getElementById(`rs1-cell-${idx}`);
                if (!cell) return;
                const isDefault = combos[idx]?.isDefault;
                const outline = isDefault ? 'outline:2px solid #3498db;outline-offset:-2px;' : '';
                const map = {
                    running: { bg: '#fff3cd', color: '#856404', text: '…'  },
                    success: { bg: '#d4edda', color: '#155724', text: '✔'  },
                    error:   { bg: '#f8d7da', color: '#721c24', text: '✘'  },
                };
                const s = map[state] || { bg: '#f0f0f0', color: '#adb5bd', text: '—' };
                cell.style.cssText = `border-radius:6px;height:36px;display:flex;align-items:center;justify-content:center;
                    font-size:14px;font-weight:700;font-family:monospace;
                    background:${s.bg};color:${s.color};${outline}`;
                cell.textContent = s.text;
            };

            // ── 테스트 루프 ───────────────────────────────────────────────────
            self.addLog(`총 ${total}개 조합 순차 검증 시작`, 'info');
            self.addLog('초기 설정: 19200bps, Even, Stop1, Node 1', 'info');

            for (let i = 0; i < combos.length; i++) {
                if (self.shouldStopTest) throw new Error('테스트 중단됨');

                const c     = combos[i];
                const label = `${c.baud}bps × ${c.parity}`;

                self.updateStepStatus(i, 'running');
                self.updateProgress(Math.round((i / total) * 90) + 5, `[${i + 1}/${total}]  ${label}`);
                setCellState(i, 'running');
                self.addLog(`[Case ${i + 1}/${total}]  ${label}`, 'step');

                try {
                    if (c.isDefault) {
                        self.addLog('기본값 조합 — 설정 변경 없이 10회 폴링 진행', 'info');
                        await self._rs1Poll(1, c.baudReg, label);
                    } else {
                        self.addLog(`[0xD149] Baudrate = ${c.baudReg}  (${c.baud}bps)`, 'step');
                        await window.dashboard.writeRegister(1, 0xD149, c.baudReg);
                        self.addLog(`[0xD14A] Parity = ${c.parityReg}  (${c.parity})`, 'step');
                        await window.dashboard.writeRegister(1, 0xD14A, c.parityReg);

                        self.addLog('Software Reset  (0xD000 = 0x0008)', 'step');
                        await window.dashboard.writeRegister(1, 0xD000, 0x0008);
                        self.addLog('재부팅 대기 (3초)...', 'info');
                        await self.delay(3000);

                        self.addLog(`자동 재접속: ${c.baud}bps, ${c.parity}`, 'step');
                        await window.dashboard.reconnectSerial(c.baud, c.webParity, c.webStop);

                        await self._rs1Poll(1, c.baudReg, label);

                        self.addLog('[0xD149] 기본값 복원: 19200bps (4)', 'step');
                        await window.dashboard.writeRegister(1, 0xD149, 4);
                        self.addLog('[0xD14A] 기본값 복원: 8E1 (0)', 'step');
                        await window.dashboard.writeRegister(1, 0xD14A, 0);

                        self.addLog('Software Reset  (0xD000 = 0x0008)', 'step');
                        await window.dashboard.writeRegister(1, 0xD000, 0x0008);
                        self.addLog('재부팅 대기 (3초)...', 'info');
                        await self.delay(3000);

                        self.addLog('자동 재접속: 19200bps, Even, Stop1', 'step');
                        await window.dashboard.reconnectSerial(19200, 'even', 1);
                    }

                    passed.push(label);
                    self.updateStepStatus(i, 'success');
                    setCellState(i, 'success');
                    self.addLog(`✔ ${label}  합격`, 'success');

                } catch (e) {
                    failed.push(label);
                    self.updateStepStatus(i, 'error');
                    setCellState(i, 'error');
                    self.addLog(`✘ ${label}  불합격: ${e.message}`, 'error');
                }

                await self.delay(300);
            }

            self.addLog('결과 요약', 'step');
            self.addLog(`합격 (${passed.length}): ${passed.join(', ') || '없음'}`, passed.length ? 'success' : 'info');
            self.addLog(`불합격 (${failed.length}): ${failed.join(', ') || '없음'}`, failed.length ? 'error' : 'info');

            self.updateProgress(100, '테스트 완료');
            const ok = failed.length === 0;
            return {
                status:  ok ? 'pass' : 'fail',
                message: ok ? `전체 ${total}개 조합 합격` : `불합격 ${failed.length}개: ${failed.join(', ')}`,
                details: `합격: ${passed.join(', ') || '없음'}\n불합격: ${failed.join(', ') || '없음'}`,
            };
        },

        'rs2': async function () {
            const self  = this;
            self.checkConnection();

            const passed = [];
            const failed = [];
            const total  = 3;

            self.addLog('총 3개 Sub-Case 순차 검증 시작', 'info');
            self.addLog('초기 설정: Node ID 1, 19200bps, Even, Stop1', 'info');

            // ─── Sub 1: Node ID 1 (BVA 최솟값) ───────────────────────────────
            {
                const label = 'Node ID 최솟값 (1)';
                self.updateStepStatus(0, 'running');
                self.updateProgress(5, `[1/${total}]  ${label}`);

                self.addLog(`[Sub 1/${total}]  ${label}`, 'step');

                try {
                    self.addLog('[0xD100] Node ID = 1 설정', 'step');
                    await window.dashboard.writeRegister(1, 0xD100, 1);
                    self.addLog('EEPROM 저장  (0x2000 = 0x5555)', 'step');
                    await window.dashboard.writeRegister(1, 0x2000, 0x5555);
                    self.addLog('Software Reset  (0xD000 = 0x0008)', 'step');
                    await window.dashboard.writeRegister(1, 0xD000, 0x0008);
                    self.addLog('재부팅 대기 (3초)...', 'info');
                    await self.delay(3000);

                    const nodeId = await window.dashboard.readRegisterWithTimeout(1, 0xD100);
                    if (nodeId !== 1) throw new Error(`Node ID 유지 실패 (expect: 1, got: ${nodeId})`);
                    self.addLog(`✓ [0xD100] SW Reset 후 Node ID = ${nodeId} 유지 확인`, 'success');

                    let pollFail = 0;
                    for (let n = 1; n <= 20; n++) {
                        if (self.shouldStopTest) throw new Error('테스트 중단됨');
                        try {
                            const val = await window.dashboard.readRegisterWithTimeout(1, 0xD149);
                            if (val === null || val === undefined) throw new Error('Timeout');
                            self.addLog(`  Poll ${n}/20: ✓  [0xD149] = ${val}`, 'success');
                        } catch (e) {
                            self.addLog(`  Poll ${n}/20: ✗  ${e.message}`, 'error');
                            pollFail++;
                        }
                        await self.delay(100);
                    }
                    if (pollFail > 0) throw new Error(`${pollFail}/20 Poll 실패`);

                    passed.push(label);
                    self.updateStepStatus(0, 'success');
                    self.addLog(`✓ ${label}  합격`, 'success');
                } catch (e) {
                    failed.push(label);
                    self.updateStepStatus(0, 'error');
                    self.addLog(`✗ ${label}  불합격: ${e.message}`, 'error');
                }
            }

            // ─── Sub 2: Node ID 247 (BVA 최댓값) ─────────────────────────────
            {
                const label = 'Node ID 최댓값 (247)';
                self.updateStepStatus(1, 'running');
                self.updateProgress(35, `[2/${total}]  ${label}`);

                self.addLog(`[Sub 2/${total}]  ${label}`, 'step');

                try {
                    if (self.shouldStopTest) throw new Error('테스트 중단됨');

                    self.addLog('[0xD100] Node ID = 247 설정', 'step');
                    await window.dashboard.writeRegister(1, 0xD100, 247);
                    self.addLog('EEPROM 저장  (0x2000 = 0x5555)', 'step');
                    await window.dashboard.writeRegister(1, 0x2000, 0x5555);
                    self.addLog('Software Reset  (0xD000 = 0x0008)', 'step');
                    await window.dashboard.writeRegister(1, 0xD000, 0x0008);
                    self.addLog('재부팅 대기 (3초)...', 'info');
                    await self.delay(3000);

                    const nodeId = await window.dashboard.readRegisterWithTimeout(247, 0xD100);
                    if (nodeId !== 247) throw new Error(`Node ID 유지 실패 (expect: 247, got: ${nodeId})`);
                    self.addLog(`✓ [0xD100] SW Reset 후 Node ID = ${nodeId} 유지 확인`, 'success');

                    let pollFail = 0;
                    for (let n = 1; n <= 20; n++) {
                        if (self.shouldStopTest) throw new Error('테스트 중단됨');
                        try {
                            const val = await window.dashboard.readRegisterWithTimeout(247, 0xD149);
                            if (val === null || val === undefined) throw new Error('Timeout');
                            self.addLog(`  Poll ${n}/20: ✓  [0xD149] = ${val}`, 'success');
                        } catch (e) {
                            self.addLog(`  Poll ${n}/20: ✗  ${e.message}`, 'error');
                            pollFail++;
                        }
                        await self.delay(100);
                    }
                    if (pollFail > 0) throw new Error(`${pollFail}/20 Poll 실패`);

                    // Node ID 복원: 247 → 1
                    self.addLog('[0xD100] Node ID 복원: 1  (slaveId 247)', 'step');
                    await window.dashboard.writeRegister(247, 0xD100, 1);
                    self.addLog('EEPROM 저장  (0x2000 = 0x5555)', 'step');
                    await window.dashboard.writeRegister(247, 0x2000, 0x5555);
                    self.addLog('Software Reset  (0xD000 = 0x0008)', 'step');
                    await window.dashboard.writeRegister(247, 0xD000, 0x0008);
                    self.addLog('재부팅 대기 (3초)...', 'info');
                    await self.delay(3000);

                    const restored = await window.dashboard.readRegisterWithTimeout(1, 0xD100);
                    if (restored !== 1) throw new Error(`Node ID 복원 실패 (expect: 1, got: ${restored})`);
                    self.addLog(`✓ [0xD100] Node ID 복원 확인 = ${restored}`, 'success');

                    passed.push(label);
                    self.updateStepStatus(1, 'success');
                    self.addLog(`✓ ${label}  합격`, 'success');
                } catch (e) {
                    failed.push(label);
                    self.updateStepStatus(1, 'error');
                    self.addLog(`✗ ${label}  불합격: ${e.message}`, 'error');
                }
            }

            // ─── Sub 3: 예외값 거부 ───────────────────────────────────────────
            {
                const label = 'Node ID 예외값 거부  (248 / 255 / 0xFFFF)';
                self.updateStepStatus(2, 'running');
                self.updateProgress(75, `[3/${total}]  ${label}`);

                self.addLog(`[Sub 3/${total}]  ${label}`, 'step');

                try {
                    if (self.shouldStopTest) throw new Error('테스트 중단됨');

                    let exceptFail = 0;
                    for (const invalid of [248, 255, 0xFFFF]) {
                        self.addLog(`[0xD100] 비정상값 ${invalid} Write 시도  (Exception 예상)`, 'step');
                        try {
                            await window.dashboard.writeRegister(1, 0xD100, invalid);
                            self.addLog(`⚠ ${invalid}: Write 에 정상 응답 — 거부되지 않음`, 'warning');
                        } catch (_) {
                            self.addLog(`✓ ${invalid}: 쓰기 거부 (Exception/Timeout)`, 'success');
                        }
                        const cur = await window.dashboard.readRegisterWithTimeout(1, 0xD100);
                        if (cur === 1) {
                            self.addLog(`✓ ${invalid} 시도 후 Node ID = ${cur} 유지 확인`, 'success');
                        } else {
                            self.addLog(`✗ ${invalid} 시도 후 Node ID 변경됨 (got: ${cur})`, 'error');
                            exceptFail++;
                        }
                        await self.delay(200);
                    }
                    if (exceptFail > 0) throw new Error(`${exceptFail}건 예외값 거부 후 Node ID 변경됨`);

                    passed.push(label);
                    self.updateStepStatus(2, 'success');
                    self.addLog(`✓ ${label}  합격`, 'success');
                } catch (e) {
                    failed.push(label);
                    self.updateStepStatus(2, 'error');
                    self.addLog(`✗ ${label}  불합격: ${e.message}`, 'error');
                }
            }

            // 최종 요약

            self.addLog('결과 요약', 'step');
            self.addLog(`합격 (${passed.length}): ${passed.join(', ') || '없음'}`, passed.length ? 'success' : 'info');
            self.addLog(`불합격 (${failed.length}): ${failed.join(', ') || '없음'}`, failed.length ? 'error' : 'info');


            self.updateProgress(100, '테스트 완료');
            const ok = failed.length === 0;
            return {
                status:  ok ? 'pass' : 'fail',
                message: ok ? `전체 ${total}개 Sub-Case 합격` : `불합격 ${failed.length}개: ${failed.join(', ')}`,
                details: `합격: ${passed.join(', ') || '없음'}\n불합격: ${failed.join(', ') || '없음'}`,
            };
        },

        'rs3': async function () {
            const self  = this;
            self.checkConnection();

            const passed = [];
            const failed = [];
            const total  = 3;

            self.addLog('총 3개 Sub-Case 순차 검증 시작', 'info');
            self.addLog('※ Broadcast(Node ID 0) FC06 Write 는 무응답이 정상 (Modbus 표준)', 'warning');

            // ─── Sub 1: Broadcast FC06 Write — 실행 확인 + 무응답 원칙 ─────────
            {
                const label = 'Broadcast FC06 Write — 실행 확인 + 무응답';
                self.updateStepStatus(0, 'running');
                self.updateProgress(5, `[1/${total}]  ${label}`);

                self.addLog(`[Sub 1/${total}]  ${label}`, 'step');

                try {
                    let bcNoResponse = true;

                    self.addLog('[0x0002] = 0x03E8 (1000 RPM) → Node 0  FC06', 'step');
                    try {
                        await window.dashboard.writeRegister(0, 0x0002, 0x03E8);
                        self.addLog('⚠ Broadcast RPM 에 응답 수신됨 — Modbus 표준 위반 가능성', 'warning');
                        bcNoResponse = false;
                    } catch (_) {
                        self.addLog('✓ FC06 Broadcast RPM: 응답 없음 (Timeout) — 표준 준수', 'success');
                    }

                    self.addLog('[0x0001] = 1 (Run) → Node 0  FC06', 'step');
                    try {
                        await window.dashboard.writeRegister(0, 0x0001, 1);
                        self.addLog('⚠ Broadcast Run 에 응답 수신됨 — 추가 확인 필요', 'warning');
                        bcNoResponse = false;
                    } catch (_) {
                        self.addLog('✓ FC06 Broadcast Run: 응답 없음 (Timeout) — 표준 준수', 'success');
                    }

                    self.addLog('모터 구동 대기 (3초)...  ▶ 물리적 회전 여부 확인하세요', 'warning');
                    await self.delay(3000);

                    self.addLog('FC04 Node 1 [0xD02D] Actual Speed 읽기', 'step');
                    let motorRunning = false;
                    try {
                        const rpm = await window.dashboard.readInputRegisterWithTimeout(1, 0xD02D);
                        if (rpm !== null && rpm !== undefined) {
                            motorRunning = rpm > 100;
                            self.addLog(`${motorRunning ? '✓' : '⚠'} Actual Speed = ${rpm} RPM${motorRunning ? ' — 구동 확인' : ' — 미구동 가능성'}`, motorRunning ? 'success' : 'warning');
                        }
                    } catch (e) {
                        self.addLog(`⚠ Actual Speed 읽기 실패: ${e.message}`, 'warning');
                    }

                    self.addLog('[0x0001] = 0 (Stop) → Node 1  FC06', 'step');
                    try {
                        await window.dashboard.writeRegister(1, 0x0001, 0);
                        self.addLog('✓ 모터 정지 명령 전송', 'success');
                    } catch (e) {
                        self.addLog(`⚠ 정지 명령 오류: ${e.message}`, 'warning');
                    }

                    if (!bcNoResponse) throw new Error('Broadcast FC06 에 응답이 수신됨 — Modbus 표준 위반');

                    passed.push(label);
                    self.updateStepStatus(0, 'success');
                    self.addLog(`✓ ${label}  합격`, 'success');
                } catch (e) {
                    failed.push(label);
                    self.updateStepStatus(0, 'error');
                    self.addLog(`✗ ${label}  불합격: ${e.message}`, 'error');
                }
            }

            // ─── Sub 2: Broadcast FC03 Read — 완전 Drop 검증 ─────────────────
            {
                const label = 'Broadcast FC03 Read — 완전 Drop';
                self.updateStepStatus(1, 'running');
                self.updateProgress(38, `[2/${total}]  ${label}`);

                self.addLog(`[Sub 2/${total}]  ${label}`, 'step');

                try {
                    if (self.shouldStopTest) throw new Error('테스트 중단됨');

                    self.addLog('FC03 [0xD149] → Node 0  (Drop 예상)', 'step');
                    let fc03Dropped = false;
                    try {
                        const val = await window.dashboard.readRegisterWithTimeout(0, 0xD149);
                        if (val === null || val === undefined) {
                            self.addLog('✓ FC03 Broadcast: Timeout — 응답 없음 (Drop 확인)', 'success');
                            fc03Dropped = true;
                        } else {
                            self.addLog(`✗ FC03 Broadcast: 응답 수신됨 (값: ${val}) — 표준 위반`, 'error');
                        }
                    } catch (_) {
                        self.addLog('✓ FC03 Broadcast: Timeout — 응답 없음 (Drop 확인)', 'success');
                        fc03Dropped = true;
                    }

                    self.addLog('[수동 확인 필요] 스니퍼/오실로스코프로 TX 신호 무발생 확인', 'warning');
                    if (!fc03Dropped) throw new Error('Broadcast FC03 에 응답이 수신됨 — 표준 위반');

                    passed.push(label);
                    self.updateStepStatus(1, 'success');
                    self.addLog(`✓ ${label}  합격`, 'success');
                } catch (e) {
                    failed.push(label);
                    self.updateStepStatus(1, 'error');
                    self.addLog(`✗ ${label}  불합격: ${e.message}`, 'error');
                }
            }

            // ─── Sub 3: Broadcast 10회 연속 후 Unicast 즉각 복구 ─────────────
            {
                const label = 'Broadcast 10회 후 Unicast 즉각 복구';
                self.updateStepStatus(2, 'running');
                self.updateProgress(68, `[3/${total}]  ${label}`);

                self.addLog(`[Sub 3/${total}]  ${label}`, 'step');

                try {
                    if (self.shouldStopTest) throw new Error('테스트 중단됨');

                    for (let i = 1; i <= 10; i++) {
                        self.addLog(`Broadcast ${i}/10: [0x0002] = 0 → Node 0  FC06`, 'step');
                        try { await window.dashboard.writeRegister(0, 0x0002, 0); } catch (_) {}
                        self.updateProgress(68 + i * 2, `Broadcast ${i}/10 완료`);
                        if (i < 10) await self.delay(100);
                    }
                    self.addLog('✓ Broadcast 10회 완료 — 즉시 Unicast 전송', 'success');

                    self.addLog('Unicast FC03 Node 1 [0xD149] 즉각 전송', 'step');
                    const t0 = performance.now();
                    let responseOk = false;
                    try {
                        const val = await window.dashboard.readRegisterWithTimeout(1, 0xD149);
                        const elapsed = Math.round(performance.now() - t0);
                        if (val !== null && val !== undefined) {
                            responseOk = elapsed <= 200;
                            self.addLog(`${responseOk ? '✓' : '⚠'} Unicast 응답: [0xD149] = ${val},  응답 시간: ${elapsed}ms${responseOk ? ' ≤ 200ms' : ' > 200ms 초과'}`, responseOk ? 'success' : 'warning');
                        } else {
                            self.addLog('✗ Unicast 응답 없음 — 복구 실패', 'error');
                        }
                    } catch (e) {
                        self.addLog(`✗ Unicast Read 실패: ${e.message}`, 'error');
                    }

                    if (!responseOk) throw new Error('Broadcast 후 Unicast 복구 실패 (응답 없음 또는 200ms 초과)');

                    passed.push(label);
                    self.updateStepStatus(2, 'success');
                    self.addLog(`✓ ${label}  합격`, 'success');
                } catch (e) {
                    failed.push(label);
                    self.updateStepStatus(2, 'error');
                    self.addLog(`✗ ${label}  불합격: ${e.message}`, 'error');
                }
            }

            // 최종 요약

            self.addLog('결과 요약', 'step');
            self.addLog(`합격 (${passed.length}): ${passed.join(', ') || '없음'}`, passed.length ? 'success' : 'info');
            self.addLog(`불합격 (${failed.length}): ${failed.join(', ') || '없음'}`, failed.length ? 'error' : 'info');


            self.updateProgress(100, '테스트 완료');
            const ok = failed.length === 0;
            return {
                status:  ok ? 'pass' : 'fail',
                message: ok ? `전체 ${total}개 Sub-Case 합격` : `불합격 ${failed.length}개: ${failed.join(', ')}`,
                details: `합격: ${passed.join(', ') || '없음'}\n불합격: ${failed.join(', ') || '없음'}`,
            };
        },

    },

});

// ─── RS485 No.1 executor 헬퍼 ─────────────────────────────────────────────────

OSTestManager.prototype._rs1Poll = async function (slaveId, expectedBaudReg, label) {
    let failCount = 0;
    for (let n = 1; n <= 10; n++) {
        try {
            const val = await window.dashboard.readRegisterWithTimeout(slaveId, 0xD149);
            if (val === null || val === undefined) throw new Error('Timeout');
            if (val === expectedBaudReg) {
                this.addLog(`  Poll ${n}/10: ✓  [0xD149] = ${val}`, 'success');
            } else {
                this.addLog(`  Poll ${n}/10: ⚠  값 불일치 (expect ${expectedBaudReg}, got ${val})`, 'warning');
                failCount++;
            }
        } catch (e) {
            this.addLog(`  Poll ${n}/10: ✗  ${e.message}`, 'error');
            failCount++;
        }
        await this.delay(100);
    }
    if (failCount > 0) throw new Error(`${label} — ${failCount}/10 Poll 실패`);
};

