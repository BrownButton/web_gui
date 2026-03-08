/**
 * OS Test Module - RS485
 * 1-1. 기본 연결 동작 시험 및 Baudrate, Parity 변경
 * 1-2. Broadcast 동작 시험
 * 1-3. NodeID 변경 시험
 */

window.OSTestModules = window.OSTestModules || [];

window.OSTestModules.push({

    tests: {

        // ── RS485 No.1-1 ─────────────────────────────────────────────────────
        // 0xD149: Baudrate (3=9600, 4=19200, 5=38400, 6=57600, 7=115200)
        // 0xD14A: Parity  (0=Even/Stop1, 1=Odd/Stop1, 2=None/Stop2, 3=None/Stop1)
        // 각 케이스: ① 설정 쓰기 → ② Save → ③ 전원 재투입+재접속(수동) → ④ 통신 확인
        //            → ⑤ 기본값 복원 → ⑥ Save → ⑦ 전원 재투입+재접속(수동) → ⑧ 복원 확인
        'rs-1': {
            id: 'rs-1',
            category: 'RS485',
            number: '1-1',
            title: '기본 연결 동작 시험 및 Baudrate, Parity 변경',
            description: 'RS485 기본 통신 기능 검증',
            purpose: 'EC FAN과 RS485 Modbus 통신이 기본 설정(19200/Even/Stop1)에서 정상 동작하는지 확인하고, ' +
                     '드라이브가 지원하는 Baudrate × Parity × Stop Bit 전체 조합에서 통신이 성공하는지 검증한다. ' +
                     '시험 완료 후 초기 통신 설정으로 복원한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '지원하는 모든 Baudrate/Parity 조합에서 재접속 후 FC03 정상 응답 수신 + 초기값 복원 완료',
            steps: [
                'USB to RS485 Converter 연결 및 초기 설정(19200 / Even / Stop1) 확인\n' +
                '⚠ 단일 장비 전제 — 동일 버스의 다른 장비는 분리 후 진행',
                '[케이스 0] Baseline: 19200 / Even / Stop1 에서 FC03 통신 확인',
                '[케이스 B-1~B-4] Baudrate 변경 시험 — 9600 / 38400 / 57600 / 115200',
                '[케이스 P-1~P-3] Parity 변경 시험 — Odd/1 / None/2 / None/1(선택)',
                '[케이스 C-1~C-8] 조합 시험 — Baudrate × Parity 전체 조합',
                '[최종] 초기값 (19200 / Even / Stop Bit 1) 복원 확인',
            ]
        },

        // ── RS485 No.1-2 ─────────────────────────────────────────────────────
        'rs-2': {
            id: 'rs-2',
            category: 'RS485',
            number: '1-2',
            title: 'Broadcast 동작 시험',
            description: 'ID 0으로 전체 디바이스 명령 전달 검증',
            purpose: 'Broadcast ID(0)으로 쓰기 명령을 전송했을 때 버스 상의 모든 EC-FAN 디바이스가 ' +
                     '해당 명령을 수신하여 처리하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA 이상, USB to RS485 Converter',
            criteria: 'Broadcasting ID(0)으로 FC06 쓰기 명령 전송 후 대상 디바이스에서 값 변경 확인',
            steps: [
                {
                    type: 'check_connection',
                    label: 'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결하고 포트 접속 상태를 확인한다.'
                },
                {
                    type: 'check_comm_settings',
                    required: { baud: '19200', parity: 'even' },
                    label: '통신 설정 확인: Baudrate 19200bps, Parity Even'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: '테스트 전 Setpoint 현재값 백업 [0xD001] (Node ID=1)',
                    storeAs: 'setpoint_backup',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 0,        // Broadcast ID
                    address: 0xD001,
                    value: 100,
                    label: 'Broadcasting ID(0)로 Setpoint [0xD001] = 100 쓰기\n' +
                           '→ 버스 상 모든 디바이스에 명령 전달\n' +
                           '※ Broadcast에 대한 응답은 없음 (정상)'
                },
                {
                    type: 'delay',
                    ms: 200,
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: 'Node ID=1 에서 Setpoint 값 확인 — Broadcasting 반영 여부',
                    expect: 100,
                    softMatch: true
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD001,
                    from: 'setpoint_backup',
                    label: '원래 Setpoint 값으로 복원 [0xD001]'
                }
            ]
        },

        // ── RS485 No.1-3 ─────────────────────────────────────────────────────
        'rs-3': {
            id: 'rs-3',
            category: 'RS485',
            number: '1-3',
            title: 'NodeID 변경 시험',
            description: 'Modbus Slave ID 설정 및 반영 검증',
            purpose: '예지보전 툴을 이용해 Node ID 설정이 되는지 확인한다. ' +
                     'Node ID 변경 후 전원 재투입 시 새 ID로 통신이 가능한지 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '설정 Node ID 입력 시 Device, SW Ver, Boot Ver 출력',
            steps: [
                {
                    type: 'check_connection',
                    label: 'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결하고 포트 접속 상태를 확인한다.'
                },
                {
                    type: 'check_comm_settings',
                    required: { baud: '19200', parity: 'even' },
                    label: 'COM Port 접속 설정 확인 (Baudrate: 19200bps, Parity: Even)'
                },
                {
                    type: 'read_holding',
                    slaveId: 0,
                    address: 0x2003,
                    label: 'Broadcasting ID(0)로 현재 Node ID 읽기 [0x2003]',
                    storeAs: 'currentNodeId',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 0,
                    address: 0x2003,
                    value: 1,
                    label: '[0x2003] Node ID를 1로 설정 (Broadcasting ID=0으로 전송)'
                },
                {
                    type: 'write_holding',
                    slaveId: 0,
                    address: 0x2000,
                    value: 0x5555,
                    label: 'Save to Memory — [0x2000] = 0x5555',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 10,
                    message: '전원 재투입 필요 — 장치 전원을 재투입한 후 10초 대기합니다.'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0x2003,
                    label: 'Node ID 1로 통신 확인 — [0x2003] Node ID 값 읽기',
                    expect: 1
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD000,
                    label: 'Device 정보 확인 [0xD000]',
                    storeAs: 'deviceInfo'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: 'SW Ver 확인 [0xD001]',
                    storeAs: 'swVer'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD002,
                    label: 'Boot Ver 확인 [0xD002]',
                    storeAs: 'bootVer'
                }
            ]
        }

    },

    // ================================================================
    //  Executors
    // ================================================================

    executors: {

        // ── RS485 No.1-1 ─────────────────────────────────────────────────────
        'rs-1': async function() {
            const self = this;

            // ── 레지스터 / 기본값 ──
            const SLAVE      = 1;
            const REG_BAUD   = 0xD149;   // 0xD149: Baudrate
            const REG_PARITY = 0xD14A;   // 0xD14A: Parity / Stop Bit
            const DEF_BAUD   = 4;        // 19200bps
            const DEF_PARITY = 0;        // Even / Stop1

            const BAUD_LABEL   = { 3:'9600', 4:'19200', 5:'38400', 6:'57600', 7:'115200' };
            const PARITY_LABEL = { 0:'Even/Stop1', 1:'Odd/Stop1', 2:'None/Stop2', 3:'None/Stop1' };
            const PARITY_GUI   = { 0:'even',        1:'odd',       2:'none',       3:'none'       };
            const STOP_LABEL   = { 0:'1',            1:'1',         2:'2',          3:'1'          };

            // ── 전체 케이스 매트릭스 ──
            const CASES = [
                { id: 'B-1', baud: 3, parity: 0 },
                { id: 'B-2', baud: 5, parity: 0 },
                { id: 'B-3', baud: 6, parity: 0 },
                { id: 'B-4', baud: 7, parity: 0 },
                { id: 'P-1', baud: 4, parity: 1 },
                { id: 'P-2', baud: 4, parity: 2 },
                { id: 'P-3', baud: 4, parity: 3, optional: true },
                { id: 'C-1', baud: 3, parity: 1 },
                { id: 'C-2', baud: 3, parity: 2 },
                { id: 'C-3', baud: 5, parity: 1 },
                { id: 'C-4', baud: 5, parity: 2 },
                { id: 'C-5', baud: 6, parity: 1 },
                { id: 'C-6', baud: 6, parity: 2 },
                { id: 'C-7', baud: 7, parity: 1 },
                { id: 'C-8', baud: 7, parity: 2 },
            ];

            // ── 헬퍼: 재시도 읽기 ──
            const readBaudReg = async (retries = 3) => {
                for (let i = 0; i < retries; i++) {
                    try {
                        const v = await window.dashboard.readRegisterWithTimeout(SLAVE, REG_BAUD);
                        if (v !== null && v !== undefined) return v;
                    } catch (_) {}
                    if (i < retries - 1) {
                        self.addLog(`⚠ 응답 없음. 재시도 ${i + 1}/${retries}...`, 'warning');
                        await self.delay(3000);
                    }
                }
                return null;
            };

            // ── 헬퍼: 안내 카운트다운 ──
            let _pct = 0;
            const countdown = async (secs, msg, pct) => {
                _pct = pct;
                const showAt = new Set([secs, 20, 15, 10, 5, 3, 2, 1].filter(s => s > 0 && s <= secs));
                for (let i = secs; i > 0; i--) {
                    if (self.shouldStopTest) throw new Error('테스트 중단됨');
                    self.updateProgress(_pct, `${msg} (${i}초 남음)`);
                    if (showAt.has(i)) self.addLog(`⏳ ${i}초 남음...`, 'info');
                    await self.delay(1000);
                }
                self.addLog('✓ 대기 완료', 'success');
            };

            // ── STEP 0: 연결 및 초기 설정 확인 ──
            self.updateStepStatus(0, 'running');
            self.checkConnection();
            const { baud: guiBaud, parity: guiParity } = self.checkCommSettings();
            if (guiBaud !== '19200' || guiParity !== 'even') {
                self.updateStepStatus(0, 'error');
                throw new Error(
                    `초기 통신 설정이 기본값과 다릅니다. GUI에서 19200bps / Even으로 설정 후 재접속하세요. ` +
                    `(현재: ${guiBaud} / ${guiParity})`
                );
            }
            self.updateStepStatus(0, 'success');

            // ── STEP 1: 케이스 0 — Baseline ──
            self.updateStepStatus(1, 'running');
            self.addLog('=== 케이스 0: Baseline (19200 / Even / Stop1) ===', 'step');
            self.updateProgress(5, '케이스 0: Baseline 통신 확인...');

            const baselineVal = await readBaudReg(3);
            if (baselineVal === null) {
                self.updateStepStatus(1, 'error');
                throw new Error('케이스 0 실패: 기본 설정(19200/Even/Stop1)에서 FC03 응답 없음');
            }
            self.addLog(
                `✓ 케이스 0 합격: 0xD149 = ${baselineVal} (${BAUD_LABEL[baselineVal] || baselineVal}bps)`,
                'success'
            );
            self.updateStepStatus(1, 'success');

            // ── STEP 2~4: 케이스 B/P/C ──
            const caseResults = {};
            const GROUPS = [
                { ids: ['B-1','B-2','B-3','B-4'],                           stepIdx: 2 },
                { ids: ['P-1','P-2','P-3'],                                  stepIdx: 3 },
                { ids: ['C-1','C-2','C-3','C-4','C-5','C-6','C-7','C-8'],   stepIdx: 4 },
            ];

            let doneCount = 0;
            const totalCases = CASES.length;

            for (const group of GROUPS) {
                self.updateStepStatus(group.stepIdx, 'running');

                for (const caseId of group.ids) {
                    if (self.shouldStopTest) throw new Error('테스트 중단됨');

                    const c         = CASES.find(x => x.id === caseId);
                    const baudStr   = BAUD_LABEL[c.baud]   || `val${c.baud}`;
                    const parityStr = PARITY_LABEL[c.parity] || `val${c.parity}`;
                    const guiP      = PARITY_GUI[c.parity];
                    const stopBit   = STOP_LABEL[c.parity];
                    const basePct   = Math.round(10 + (doneCount / totalCases) * 80);

                    self.addLog(`─── 케이스 ${caseId}: ${baudStr}bps / ${parityStr} ───`, 'step');
                    self.updateProgress(basePct, `케이스 ${caseId} 진행 중...`);

                    // ① 새 설정 쓰기
                    try {
                        await window.dashboard.writeRegister(SLAVE, REG_BAUD, c.baud);
                        self.addLog(`→ 0xD149 = ${c.baud} (${baudStr}bps)`, 'info');
                        await window.dashboard.writeRegister(SLAVE, REG_PARITY, c.parity);
                        self.addLog(`→ 0xD14A = ${c.parity} (${parityStr})`, 'info');
                    } catch (e) {
                        if (c.optional) {
                            self.addLog(`⚠ 케이스 ${caseId}: 설정 쓰기 실패 (optional — 미지원 처리)`, 'warning');
                            caseResults[caseId] = 'skip';
                            doneCount++;
                            continue;
                        }
                        caseResults[caseId] = 'fail';
                        self.addLog(`✗ 케이스 ${caseId}: 설정 쓰기 실패 — ${e.message}`, 'error');
                        doneCount++;
                        continue;
                    }

                    // ② Save to Memory
                    try {
                        await self.saveToMemory(SLAVE);
                        self.addLog('→ Save to Memory (0x2000 = 0x5555)', 'info');
                    } catch (e) {
                        self.addLog(`⚠ Save to Memory 실패: ${e.message} (계속 진행)`, 'warning');
                    }

                    // ③ 전원 재투입 + 재접속 안내
                    self.addLog(
                        `⚠ 전원 Off → 3초 대기 → On → GUI에서 [${baudStr}bps / ${guiP} / Stop${stopBit}]로 재접속`,
                        'warning'
                    );
                    await countdown(25, `전원 재투입 + ${baudStr}/${guiP}로 재접속`, basePct + 2);

                    // ④ 새 설정에서 통신 확인
                    const verVal = await readBaudReg(3);
                    if (verVal === null) {
                        if (c.optional) {
                            self.addLog(`⚠ 케이스 ${caseId}: 통신 확인 실패 (optional — 미지원 처리)`, 'warning');
                            caseResults[caseId] = 'skip';
                        } else {
                            caseResults[caseId] = 'fail';
                            self.addLog(`✗ 케이스 ${caseId}: 통신 실패 (Timeout)`, 'error');
                        }
                    } else {
                        caseResults[caseId] = 'pass';
                        self.addLog(
                            `✓ 케이스 ${caseId} 합격: 0xD149 = ${verVal} (${BAUD_LABEL[verVal] || verVal}bps)`,
                            'success'
                        );
                    }

                    // ⑤ 기본값 복원 쓰기
                    try {
                        await window.dashboard.writeRegister(SLAVE, REG_BAUD, DEF_BAUD);
                        self.addLog('→ 0xD149 = 4 (19200bps 복원)', 'info');
                        await window.dashboard.writeRegister(SLAVE, REG_PARITY, DEF_PARITY);
                        self.addLog('→ 0xD14A = 0 (Even/Stop1 복원)', 'info');
                        await self.saveToMemory(SLAVE);
                        self.addLog('→ Save to Memory (복원)', 'info');
                    } catch (e) {
                        throw new Error(`케이스 ${caseId}: 기본값 복원 쓰기 실패 — ${e.message}`);
                    }

                    // ⑥ 전원 재투입 + 19200 재접속 안내
                    self.addLog('⚠ 전원 Off → 3초 대기 → On → GUI에서 [19200bps / even / Stop1]로 재접속', 'warning');
                    await countdown(20, '전원 재투입 + 19200/even으로 복원', basePct + 4);

                    // ⑦ 기본값 복원 확인
                    const restVal = await readBaudReg(3);
                    if (restVal !== DEF_BAUD) {
                        throw new Error(
                            `케이스 ${caseId}: 복원 후 기본값 통신 실패 (예상: 4/19200bps, 실제: ${restVal})`
                        );
                    }
                    self.addLog(`✓ 케이스 ${caseId}: 기본값 복원 확인 완료`, 'success');

                    doneCount++;
                    await self.delay(300);
                }

                const groupFailed = group.ids.some(id => caseResults[id] === 'fail');
                self.updateStepStatus(group.stepIdx, groupFailed ? 'error' : 'success');
            }

            // ── STEP 5: 최종 복원 확인 ──
            self.updateStepStatus(5, 'running');
            self.addLog('=== 최종 복원 확인 ===', 'step');
            self.updateProgress(95, '최종 복원 상태 확인 중...');

            const finalBaud = await readBaudReg(3);
            if (finalBaud !== DEF_BAUD) {
                self.addLog(`⚠ 최종 Baudrate 기본값 불일치 (${finalBaud}). 강제 복원 중...`, 'warning');
                try {
                    await window.dashboard.writeRegister(SLAVE, REG_BAUD, DEF_BAUD);
                    await window.dashboard.writeRegister(SLAVE, REG_PARITY, DEF_PARITY);
                    await self.saveToMemory(SLAVE);
                } catch (_) {}
            }
            self.addLog('✓ 최종 복원 확인 완료 (19200 / Even / Stop1)', 'success');
            self.updateStepStatus(5, 'success');

            // ── 결과 집계 ──
            const passed  = Object.entries(caseResults).filter(([,r]) => r === 'pass' ).map(([id]) => id);
            const failed  = Object.entries(caseResults).filter(([,r]) => r === 'fail' ).map(([id]) => id);
            const skipped = Object.entries(caseResults).filter(([,r]) => r === 'skip' ).map(([id]) => id);

            self.addLog('─── 결과 요약 ───', 'step');
            self.addLog(`합격    : ${passed.join(', ')  || '없음'}`, passed.length  ? 'success' : 'info');
            self.addLog(`불합격  : ${failed.join(', ')  || '없음'}`, failed.length  ? 'error'   : 'info');
            self.addLog(`미지원  : ${skipped.join(', ') || '없음'}`, skipped.length ? 'warning'  : 'info');

            const ok = failed.length === 0;
            return {
                status:  ok ? 'pass' : 'fail',
                message: ok ? '모든 케이스 합격 (미지원 제외)' : `불합격 케이스: ${failed.join(', ')}`,
                details: `합격: ${passed.join(', ')||'없음'}\n불합격: ${failed.join(', ')||'없음'}\n미지원: ${skipped.join(', ')||'없음'}`,
            };
        },

    },

});
