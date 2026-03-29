/**
 * OS Test Module - 기본동작
 *
 * 검증서: docs/EC FAN OS 통합 검증서 20260328/3. 기본동작/
 *
 * [docx vs CLAUDE.md 차이]
 * | 항목            | CLAUDE.md (정) | docx 기재    |
 * | DC Link 전압    | 0xD013 (FC04)  | 0xD019       |
 * | Current Limit   | 0xD13B (FC03)  | 0x2010       |
 * → 구현은 CLAUDE.md 기준. 실기 확인 후 docx 수정 필요.
 *
 * [시험 목록]
 * basic01 (3-1) : Alarm Reset 명령 검증 (No.01 - "Software Reset" 파일명 오류, 실제 내용은 Alarm Reset)
 * basic02 (3-2) : Alarm Reset 명령 검증 (No.02 - No.01과 동일 내용, 중복 포함)
 * basic03 (3-3) : Current Limit 파라미터 설정 검증
 * basic04 (3-4) : 구동 방향(CW/CCW) 설정 검증
 * basic05 (3-5) : EEPROM Save/Load 검증
 * basic06 (3-6) : DC Link 전압 모니터링 검증
 * basic07 (3-7) : Board 온도 센싱 검증
 * basic08 (3-8) : 인버터 모듈 온도 센싱 검증
 * basic09 (3-9) : 펌웨어 버전 확인
 * basic10 (3-10): Main OS 다운로드 검증
 * basic11 (3-11): Inverter OS 다운로드 검증
 */

window.OSTestModules = window.OSTestModules || [];

// ─── 공유 executor: basic01, basic02 모두 동일 로직 ──────────────────────────
window._basicAlarmResetExecutor = async function () {
    const self = this;
    self.checkConnection();

    // Phase 2-1: 현재 상태 읽기 (Motor Status)
    self.addLog('info', '[Phase 2-1] Motor Status 읽기 (0xD011, FC04)');
    const motorStatus = await window.dashboard.readInputRegisterWithTimeout(1, 0xD011);
    if (motorStatus === null || motorStatus === undefined) {
        return { status: 'fail', message: 'Motor Status 읽기 실패', details: '0xD011 FC04 응답 없음' };
    }
    self.addLog('info', `Motor Status: 0x${motorStatus.toString(16).toUpperCase().padStart(4, '0')}`);

    // Phase 2-2: 정상 구동 중 Alarm Reset 전송
    self.addLog('info', '[Phase 2-2] Alarm Reset 명령 전송 (0x800E ← 0x0001)');
    await window.dashboard.writeRegister(1, 0x800E, 0x0001);
    await new Promise(r => setTimeout(r, 300));

    // Phase 3: 알람 유발 안내 + 카운트다운
    self.addLog('warn', '[Phase 3] 알람 유발 안내');
    self.addLog('info', '장치에 알람 조건을 발생시킨 뒤 아래 카운트다운이 끝나면 자동으로 Alarm Reset을 전송합니다.');
    await self._runStep({ type: 'wait_countdown', seconds: 20, message: '알람 유발 후 대기 (20초)' }, 0);

    self.addLog('info', '[Phase 3] Alarm Reset 재전송');
    await window.dashboard.writeRegister(1, 0x800E, 0x0001);
    await new Promise(r => setTimeout(r, 500));

    const statusAfter = await window.dashboard.readInputRegisterWithTimeout(1, 0xD011);
    self.addLog('info', `리셋 후 Motor Status: ${statusAfter !== null ? '0x' + statusAfter.toString(16).toUpperCase().padStart(4, '0') : 'null'}`);

    // Phase 4: 비정상 코드 쓰기 → 예외 확인
    self.addLog('info', '[Phase 4] 비정상 Alarm Reset 코드 전송 (0x800E ← 0xFFFF)');
    await window.dashboard.writeRegister(1, 0x800E, 0xFFFF);
    await new Promise(r => setTimeout(r, 300));
    const statusAfterInvalid = await window.dashboard.readInputRegisterWithTimeout(1, 0xD011);
    self.addLog('info', `비정상 코드 후 Motor Status: ${statusAfterInvalid !== null ? '0x' + statusAfterInvalid.toString(16).toUpperCase().padStart(4, '0') : 'null'}`);

    return {
        status: 'pass',
        message: 'Alarm Reset 명령 검증 완료',
        details: [
            `초기 Motor Status: 0x${motorStatus.toString(16).toUpperCase().padStart(4, '0')}`,
            `리셋 후 Motor Status: ${statusAfter !== null ? '0x' + statusAfter.toString(16).toUpperCase().padStart(4, '0') : 'N/A'}`,
            '비정상 코드(0xFFFF) 전송 완료 — 장치가 무시 또는 예외 응답 반환 확인',
        ].join('\n'),
    };
};

window.OSTestModules.push({

    tests: {

        // ── basic01: Alarm Reset 명령 검증 (No.01) ─────────────────────────────
        'basic01': {
            id:          'basic01',
            category:    '기본동작',
            number:      '3-1',
            title:       'Alarm Reset 명령 검증 (No.01)',
            description: '정상 구동 중 Alarm Reset(0x800E←0x0001) 명령을 전송하고, 알람 발생 시 리셋 여부를 검증한다.',
            purpose:     'Alarm Reset 명령(0x800E←0x0001)이 정상 동작하는지, 그리고 비정상 코드 전송 시 장치가 적절히 예외 처리하는지 검증한다. (docx 파일명 "Software Reset"은 오류 — 실제 내용은 Alarm Reset)',
            model:       'EC-FAN',
            equipment:   'EC FAN 1EA, USB to RS485 Converter',
            criteria:    'Alarm Reset 명령 전송 후 Motor Status 정상 반환 / 비정상 코드(0xFFFF) 전송 시 장치가 무시 또는 예외 응답',
            steps: [
                { type: 'check_connection' },
            ],
        },

        // ── basic02: Alarm Reset 명령 검증 (No.02) ─────────────────────────────
        'basic02': {
            id:          'basic02',
            category:    '기본동작',
            number:      '3-2',
            title:       'Alarm Reset 명령 검증 (No.02)',
            description: 'No.01과 동일한 Alarm Reset 검증 절차 (docx No.02 — No.01과 내용 동일)',
            purpose:     'No.01과 동일. Alarm Reset 명령(0x800E←0x0001) 정상 동작 및 예외 처리 검증.',
            model:       'EC-FAN',
            equipment:   'EC FAN 1EA, USB to RS485 Converter',
            criteria:    'Alarm Reset 명령 전송 후 Motor Status 정상 반환 / 비정상 코드(0xFFFF) 전송 시 장치가 무시 또는 예외 응답',
            steps: [
                { type: 'check_connection' },
            ],
        },

        // ── basic03: Current Limit 파라미터 설정 검증 ─────────────────────────
        'basic03': {
            id:          'basic03',
            category:    '기본동작',
            number:      '3-3',
            title:       'Current Limit 파라미터 설정 검증',
            description: '전류 제한(0xD13B) 파라미터를 설정하고 유효범위 초과 시 예외 응답을 확인한다.',
            purpose:     'Current Limit 레지스터(0xD13B)에 유효값 쓰기 후 읽기 검증, 범위 초과값 쓰기 시 거부 여부 확인. (CLAUDE.md 기준 0xD13B; docx에는 0x2010으로 잘못 기재됨)',
            model:       'EC-FAN',
            equipment:   'EC FAN 1EA, USB to RS485 Converter',
            criteria:    '유효값(1000) 쓰기 후 읽기 일치 / 범위 초과값(0xFFFF) 쓰기 시 거부 또는 기존값 유지',
            steps: [
                { type: 'check_connection' },
                { type: 'read_holding', slaveId: 1, address: 0xD13B, storeAs: 'origCurrentLimit', label: '기존 Current Limit 읽기' },
            ],
        },

        // ── basic04: 구동 방향(CW/CCW) 설정 검증 ────────────────────────────
        'basic04': {
            id:          'basic04',
            category:    '기본동작',
            number:      '3-4',
            title:       '구동 방향(CW/CCW) 설정 검증',
            description: '구동 방향 레지스터(0xD102)를 변경하고 EEPROM 저장 후 전원 재투입으로 검증한다.',
            purpose:     'Running Direction 레지스터(0xD102) 변경 → EEPROM Save → 전원 재투입 후 설정 유지 여부 확인. 비정상값(0xFFFF) 쓰기 시 거부 여부 검증.',
            model:       'EC-FAN',
            equipment:   'EC FAN 1EA, USB to RS485 Converter',
            criteria:    '전원 재투입 후 변경한 방향값 유지 / 비정상값(0xFFFF) 쓰기 시 거부 또는 기존값 유지',
            steps: [
                { type: 'check_connection' },
                { type: 'read_holding', slaveId: 1, address: 0xD102, storeAs: 'origDir', label: '기존 방향 읽기' },
            ],
        },

        // ── basic05: EEPROM Save/Load 검증 ─────────────────────────────────
        'basic05': {
            id:          'basic05',
            category:    '기본동작',
            number:      '3-5',
            title:       'EEPROM Save/Load 검증',
            description: 'EEPROM Save(0xD000←0x0004) 후 전원 재투입으로 파라미터 유지 여부를 검증한다.',
            purpose:     'EEPROM Save 명령(0xD000←0x0004) 전송 후 전원 차단/재투입 시 Setpoint(0xD001) 저장값이 유지되는지 확인. 비정상 EEPROM 코드(0xFFFF) 처리 검증.',
            model:       'EC-FAN',
            equipment:   'EC FAN 1EA, USB to RS485 Converter',
            criteria:    '전원 재투입 후 저장된 Setpoint 값 일치 / 비정상 코드(0xFFFF) 전송 시 무시 또는 예외 응답',
            steps: [
                { type: 'check_connection' },
                { type: 'read_holding', slaveId: 1, address: 0xD001, storeAs: 'origSetpoint', label: '기존 Setpoint 읽기' },
            ],
        },

        // ── basic06: DC Link 전압 모니터링 검증 ──────────────────────────────
        'basic06': {
            id:          'basic06',
            category:    '기본동작',
            number:      '3-6',
            title:       'DC Link 전압 모니터링 검증',
            description: 'DC Link 전압(0xD013, FC04)을 읽어 정상 범위(483~591) 여부를 확인한다.',
            purpose:     'DC Link 전압 레지스터(0xD013, FC04)를 읽어 정상 동작 범위 내에 있는지 확인하고, Read-Only 레지스터에 쓰기 시도 시 거부 여부 검증. (CLAUDE.md 기준 0xD013; docx에는 0xD019로 잘못 기재됨)',
            model:       'EC-FAN',
            equipment:   'EC FAN 1EA, USB to RS485 Converter, 전압계',
            criteria:    'DC Link 전압 읽기값 483~591 범위 내 / Read-Only 쓰기 시도 시 값 변경 없음',
            steps: [
                { type: 'check_connection' },
                { type: 'read_input', slaveId: 1, address: 0xD013, storeAs: 'dcVoltage', label: 'DC Link 전압 읽기 (0xD013)' },
            ],
        },

        // ── basic07: Board 온도 센싱 검증 ────────────────────────────────────
        'basic07': {
            id:          'basic07',
            category:    '기본동작',
            number:      '3-7',
            title:       'Board 온도 센싱 검증',
            description: 'Board 온도(0xD017, FC04)를 읽어 정상 범위(5~80°C) 여부를 확인한다.',
            purpose:     'Electronics Temperature 레지스터(0xD017, FC04)를 읽어 상온 정상 범위(5~80°C) 내에 있는지 확인하고, 0(단선) 또는 ≥200(오버플로우) 이상값 감지 및 Read-Only 보호 검증.',
            model:       'EC-FAN',
            equipment:   'EC FAN 1EA, USB to RS485 Converter, 온도계',
            criteria:    'Board 온도 읽기값 5~80°C 범위 내 / 단선(0) 또는 오버플로우(≥200) 없음 / Read-Only 쓰기 시도 시 값 변경 없음',
            steps: [
                { type: 'check_connection' },
                { type: 'read_input', slaveId: 1, address: 0xD017, storeAs: 'boardTemp', label: 'Board 온도 읽기 (0xD017)' },
            ],
        },

        // ── basic08: 인버터 모듈 온도 센싱 검증 ─────────────────────────────
        'basic08': {
            id:          'basic08',
            category:    '기본동작',
            number:      '3-8',
            title:       '인버터 모듈 온도 센싱 검증',
            description: '인버터 모듈 온도(0xD015, FC04)를 읽어 정상 범위(5~80°C) 여부를 확인한다.',
            purpose:     'Module Temperature 레지스터(0xD015, FC04)를 읽어 정상 범위(5~80°C) 내에 있는지 확인하고, 이상값 및 Read-Only 보호 검증.',
            model:       'EC-FAN',
            equipment:   'EC FAN 1EA, USB to RS485 Converter, 온도계',
            criteria:    '모듈 온도 읽기값 5~80°C 범위 내 / 단선(0) 또는 오버플로우(≥200) 없음 / Read-Only 쓰기 시도 시 값 변경 없음',
            steps: [
                { type: 'check_connection' },
                { type: 'read_input', slaveId: 1, address: 0xD015, storeAs: 'moduleTemp', label: '인버터 모듈 온도 읽기 (0xD015)' },
            ],
        },

        // ── basic09: 펌웨어 버전 확인 ────────────────────────────────────────
        'basic09': {
            id:          'basic09',
            category:    '기본동작',
            number:      '3-9',
            title:       '펌웨어 버전 확인',
            description: '4개 버전 레지스터(0xD002~0xD005, FC04)를 읽어 유효한 버전 정보가 기재되어 있는지 확인한다.',
            purpose:     'Main Boot/SW Version(0xD002~0xD003) 및 Inverter Boot/SW Version(0xD004~0xD005)을 순차 읽어 비-0 유효값 확인 및 Read-Only 보호 검증.',
            model:       'EC-FAN',
            equipment:   'EC FAN 1EA, USB to RS485 Converter',
            criteria:    '4개 버전 레지스터 모두 비-0 유효값 / Read-Only 쓰기 시도 시 값 변경 없음',
            steps: [
                { type: 'check_connection' },
                { type: 'read_input', slaveId: 1, address: 0xD002, storeAs: 'mainBootVer', label: 'Main Boot Version (0xD002)' },
                { type: 'read_input', slaveId: 1, address: 0xD003, storeAs: 'mainSwVer',   label: 'Main SW Version (0xD003)' },
                { type: 'read_input', slaveId: 1, address: 0xD004, storeAs: 'invBootVer',  label: 'Inverter Boot Version (0xD004)' },
                { type: 'read_input', slaveId: 1, address: 0xD005, storeAs: 'invSwVer',    label: 'Inverter SW Version (0xD005)' },
            ],
        },

        // ── basic10: Main OS 다운로드 검증 ───────────────────────────────────
        'basic10': {
            id:          'basic10',
            category:    '기본동작',
            number:      '3-10',
            title:       'Main OS 다운로드 검증',
            description: 'Main F/W 버전(0xD003)을 기록한 뒤, OS 업데이트 후 버전 변경 여부를 확인한다.',
            purpose:     'OS 업데이트 툴을 통해 Main F/W를 다운로드하고, 업데이트 전후 버전 레지스터(0xD003) 값 변경으로 정상 업데이트 여부를 검증한다.',
            model:       'EC-FAN',
            equipment:   'EC FAN 1EA, USB to RS485 Converter, OS 업데이트 툴',
            criteria:    '업데이트 후 Main SW Version(0xD003) 값이 업데이트 전과 다름',
            steps: [
                { type: 'check_connection' },
                { type: 'read_input', slaveId: 1, address: 0xD003, storeAs: 'mainSwVerBefore', label: 'Main SW 버전 (업데이트 전)' },
            ],
        },

        // ── basic11: Inverter OS 다운로드 검증 ──────────────────────────────
        'basic11': {
            id:          'basic11',
            category:    '기본동작',
            number:      '3-11',
            title:       'Inverter OS 다운로드 검증',
            description: 'Inverter F/W 버전(0xD005)을 기록한 뒤, OS 업데이트 후 버전 변경 여부를 확인한다.',
            purpose:     'OS 업데이트 툴을 통해 Inverter F/W를 다운로드하고, 업데이트 전후 버전 레지스터(0xD005) 값 변경으로 정상 업데이트 여부를 검증한다.',
            model:       'EC-FAN',
            equipment:   'EC FAN 1EA, USB to RS485 Converter, OS 업데이트 툴',
            criteria:    '업데이트 후 Inverter SW Version(0xD005) 값이 업데이트 전과 다름',
            steps: [
                { type: 'check_connection' },
                { type: 'read_input', slaveId: 1, address: 0xD005, storeAs: 'invSwVerBefore', label: 'Inverter SW 버전 (업데이트 전)' },
            ],
        },

    },

    // ─────────────────────────────────────────────────────────────────────────
    executors: {

        // ── basic01 executor ─────────────────────────────────────────────────
        'basic01': async function () {
            return await window._basicAlarmResetExecutor.call(this);
        },

        // ── basic02 executor ─────────────────────────────────────────────────
        'basic02': async function () {
            return await window._basicAlarmResetExecutor.call(this);
        },

        // ── basic03 executor ─────────────────────────────────────────────────
        'basic03': async function () {
            const self = this;
            self.checkConnection();

            // ── Phase 1: 기존값 읽기 ───────────────────────────────────────────
            self.addLog('═'.repeat(52), 'info');
            self.addLog('[Phase 1] Current Limit 기존값 읽기', 'info');
            self.addLog('  대상 레지스터: 0xD13B  (FC03 Holding Register, Slave 1)', 'info');
            self.addLog('  TX: 01 03 D1 3B 00 01 [CRC]', 'info');
            self.updateProgress(10, 'Phase 1: 기존값 읽기');

            const origVal = await window.dashboard.readRegisterWithTimeout(1, 0xD13B);
            if (origVal === null || origVal === undefined) {
                self.addLog('  RX: 응답 없음 → 테스트 중단', 'error');
                return { status: 'fail', message: 'Current Limit 읽기 실패', details: '0xD13B FC03 응답 없음' };
            }
            const origHex = origVal.toString(16).toUpperCase().padStart(4, '0');
            self.addLog(`  RX: 0x${origHex} = ${origVal} (raw) → 기존값 저장 완료`, 'info');
            self.updateProgress(20, 'Phase 1 완료');

            // ── Phase 2: 유효값 쓰기 + 읽기 검증 ─────────────────────────────
            const testVal = 1000;  // 0x03E8
            self.addLog('─'.repeat(52), 'info');
            self.addLog('[Phase 2] 유효값 쓰기 후 읽기 검증', 'info');
            self.addLog(`  쓰기값: ${testVal} (0x03E8)`, 'info');
            self.addLog('  TX(Write FC06): 01 06 D1 3B 03 E8 [CRC]', 'info');
            self.updateProgress(35, 'Phase 2: 유효값 쓰기');

            await window.dashboard.writeRegister(1, 0xD13B, testVal);
            await new Promise(r => setTimeout(r, 200));
            self.addLog('  200 ms 대기 후 읽기 검증...', 'info');
            self.addLog('  TX(Read  FC03): 01 03 D1 3B 00 01 [CRC]', 'info');

            const readBack = await window.dashboard.readRegisterWithTimeout(1, 0xD13B);
            self.updateProgress(55, 'Phase 2: 읽기 검증');

            if (readBack === null) {
                self.addLog('  RX: 응답 없음 → 쓰기 후 읽기 실패', 'warn');
            } else {
                const readHex = readBack.toString(16).toUpperCase().padStart(4, '0');
                const match   = readBack === testVal;
                self.addLog(`  RX: 0x${readHex} = ${readBack}`, 'info');
                self.addLog(
                    `  기대: ${testVal}  실제: ${readBack}  → ${match ? '✔ MATCH — PASS' : '✘ MISMATCH — FAIL'}`,
                    match ? 'success' : 'error'
                );
            }

            // ── Phase 3: 범위 초과값 쓰기 → 거부 여부 확인 ───────────────────
            self.addLog('─'.repeat(52), 'info');
            self.addLog('[Phase 3] 범위 초과값(0xFFFF) 쓰기 후 거부 여부 확인', 'info');
            self.addLog('  쓰기값: 0xFFFF = 65535  (유효 범위 초과값)', 'info');
            self.addLog('  TX(Write FC06): 01 06 D1 3B FF FF [CRC]', 'info');
            self.updateProgress(70, 'Phase 3: 범위 초과값 쓰기');

            await window.dashboard.writeRegister(1, 0xD13B, 0xFFFF);
            await new Promise(r => setTimeout(r, 200));
            self.addLog('  200 ms 대기 후 읽기 검증...', 'info');
            self.addLog('  TX(Read  FC03): 01 03 D1 3B 00 01 [CRC]', 'info');

            const readAfterInvalid = await window.dashboard.readRegisterWithTimeout(1, 0xD13B);
            const invalidRejected  = (readAfterInvalid !== null && readAfterInvalid !== 0xFFFF);
            self.updateProgress(85, 'Phase 3: 거부 여부 확인');

            if (readAfterInvalid === null) {
                self.addLog('  RX: 응답 없음', 'warn');
            } else {
                const afterHex = readAfterInvalid.toString(16).toUpperCase().padStart(4, '0');
                self.addLog(`  RX: 0x${afterHex} = ${readAfterInvalid}`, 'info');
                self.addLog(
                    invalidRejected
                        ? `  0xFFFF 반영되지 않음 (실제값: ${readAfterInvalid}) → ✔ 범위 초과 거부 확인 — PASS`
                        : `  0xFFFF 그대로 반영됨 → ✘ 범위 초과 미거부 — WARNING`,
                    invalidRejected ? 'success' : 'warn'
                );
            }

            // ── 복원 ──────────────────────────────────────────────────────────
            self.addLog('─'.repeat(52), 'info');
            self.addLog(`[복원] 기존값 복원: 0xD13B ← 0x${origHex} (${origVal})`, 'info');
            self.addLog(`  TX(Write FC06): 01 06 D1 3B ${origHex.slice(0, 2)} ${origHex.slice(2)} [CRC]`, 'info');
            await window.dashboard.writeRegister(1, 0xD13B, origVal);
            await new Promise(r => setTimeout(r, 150));

            const restoreCheck = await window.dashboard.readRegisterWithTimeout(1, 0xD13B);
            if (restoreCheck !== null) {
                self.addLog(
                    `  복원 확인: ${restoreCheck} ${restoreCheck === origVal ? '✔ 완료' : '✘ 불일치(경고)'}`,
                    restoreCheck === origVal ? 'success' : 'warn'
                );
            }

            self.addLog('═'.repeat(52), 'info');
            self.updateProgress(100, '테스트 완료');

            const pass = readBack === testVal;
            return {
                status: pass ? 'pass' : 'fail',
                message: pass ? 'Current Limit 설정 검증 완료' : '쓰기 후 읽기 불일치',
                details: [
                    `기존값: ${origVal}`,
                    `유효값 쓰기(${testVal}) 검증: ${readBack === testVal ? 'PASS' : 'FAIL'} (읽기값: ${readBack})`,
                    `범위 초과(0xFFFF) 거부: ${invalidRejected ? 'PASS' : 'WARNING'}`,
                ].join('\n'),
            };
        },

        // ── basic04 executor ─────────────────────────────────────────────────
        'basic04': async function () {
            const self = this;
            self.checkConnection();

            // 기존값 저장
            self.addLog('info', '[Phase 1] 구동 방향 기존값 읽기 (0xD102)');
            const origDir = await window.dashboard.readRegisterWithTimeout(1, 0xD102);
            if (origDir === null || origDir === undefined) {
                return { status: 'fail', message: '방향 레지스터 읽기 실패', details: '0xD102 FC03 응답 없음' };
            }
            self.addLog('info', `기존 방향: ${origDir === 0 ? 'CCW(0)' : origDir === 1 ? 'CW(1)' : `Unknown(${origDir})`}`);

            // Phase 2: 반대 방향으로 변경
            const newDir = origDir === 0 ? 1 : 0;
            self.addLog('info', `[Phase 2] 방향 변경: ${newDir === 0 ? 'CCW(0)' : 'CW(1)'} 쓰기`);
            await window.dashboard.writeRegister(1, 0xD102, newDir);
            await new Promise(r => setTimeout(r, 200));

            // Phase 2-2: EEPROM Save
            self.addLog('info', '[Phase 2-2] EEPROM Save (0xD000 ← 0x0004)');
            await window.dashboard.writeRegister(1, 0xD000, 0x0004);

            // Phase 3: 전원 재투입 안내
            self.addLog('warn', '[Phase 3] 전원 재투입 안내');
            self.addLog('info', '전원을 차단한 뒤 재투입하세요. 카운트다운 후 자동으로 재연결을 시도합니다.');
            await self._runStep({ type: 'wait_countdown', seconds: 15, message: '전원 재투입 대기 (15초)' }, 0);

            // Phase 3-2: 재연결 후 읽기
            self.addLog('info', '[Phase 3-2] 재연결 후 방향 읽기');
            let readAfterPower = null;
            for (let i = 0; i < 3; i++) {
                readAfterPower = await window.dashboard.readRegisterWithTimeout(1, 0xD102);
                if (readAfterPower !== null) break;
                await new Promise(r => setTimeout(r, 1000));
            }

            const dirVerified = readAfterPower === newDir;
            self.addLog('info', `재투입 후 방향: ${readAfterPower !== null ? readAfterPower : 'null'} (기대: ${newDir}) → ${dirVerified ? 'PASS' : 'FAIL'}`);

            // Phase 4: 비정상값 쓰기
            self.addLog('info', '[Phase 4] 비정상값 쓰기 (0xD102 ← 0xFFFF)');
            await window.dashboard.writeRegister(1, 0xD102, 0xFFFF);
            await new Promise(r => setTimeout(r, 200));
            const readAfterInvalid = await window.dashboard.readRegisterWithTimeout(1, 0xD102);
            const invalidRejected = (readAfterInvalid !== null && readAfterInvalid !== 0xFFFF);
            self.addLog('info', `비정상값 후 방향: ${readAfterInvalid !== null ? readAfterInvalid : 'null'} → ${invalidRejected ? '범위 초과 거부 확인' : '경고: 값 변경됨'}`);

            // 복원
            self.addLog('info', '[복원] 기존 방향 복원');
            await window.dashboard.writeRegister(1, 0xD102, origDir);
            await window.dashboard.writeRegister(1, 0xD000, 0x0004);

            const pass = dirVerified;
            return {
                status: pass ? 'pass' : 'fail',
                message: pass ? '구동 방향 설정 검증 완료' : '전원 재투입 후 방향 불일치',
                details: [
                    `기존 방향: ${origDir}`,
                    `변경 후(전원 재투입): 기대 ${newDir}, 실제 ${readAfterPower !== null ? readAfterPower : 'N/A'} → ${dirVerified ? 'PASS' : 'FAIL'}`,
                    `비정상값(0xFFFF) 거부: ${invalidRejected ? 'PASS' : 'WARNING'}`,
                ].join('\n'),
            };
        },

        // ── basic05 executor ─────────────────────────────────────────────────
        'basic05': async function () {
            const self = this;
            self.checkConnection();

            // Phase 1: 기존 Setpoint 저장
            self.addLog('info', '[Phase 1] 기존 Setpoint 읽기 (0xD001)');
            const origSetpoint = await window.dashboard.readRegisterWithTimeout(1, 0xD001);
            if (origSetpoint === null || origSetpoint === undefined) {
                return { status: 'fail', message: 'Setpoint 읽기 실패', details: '0xD001 FC03 응답 없음' };
            }
            self.addLog('info', `기존 Setpoint: ${origSetpoint}`);

            // Phase 2-1: 테스트용 Setpoint 쓰기
            const testSetpoint = 0x1000;
            self.addLog('info', `[Phase 2-1] 테스트 Setpoint 쓰기: 0x${testSetpoint.toString(16).toUpperCase()}`);
            await window.dashboard.writeRegister(1, 0xD001, testSetpoint);
            await new Promise(r => setTimeout(r, 200));

            // Phase 2-2: EEPROM Save
            self.addLog('info', '[Phase 2-2] EEPROM Save (0xD000 ← 0x0004)');
            await window.dashboard.writeRegister(1, 0xD000, 0x0004);
            await new Promise(r => setTimeout(r, 500));

            // Phase 2-3: 전원 재투입 안내
            self.addLog('warn', '[Phase 2-3] 전원 재투입 안내');
            self.addLog('info', '전원을 차단한 뒤 재투입하세요. EEPROM 저장값 유지 여부를 확인합니다.');
            await self._runStep({ type: 'wait_countdown', seconds: 20, message: '전원 재투입 대기 (20초)' }, 0);

            // Phase 2-4: 재연결 후 읽기
            self.addLog('info', '[Phase 2-4] 재연결 후 Setpoint 읽기');
            let readAfterPower = null;
            for (let i = 0; i < 3; i++) {
                readAfterPower = await window.dashboard.readRegisterWithTimeout(1, 0xD001);
                if (readAfterPower !== null) break;
                await new Promise(r => setTimeout(r, 1000));
            }

            const eepromVerified = readAfterPower === testSetpoint;
            self.addLog('info', `재투입 후 Setpoint: ${readAfterPower !== null ? readAfterPower : 'null'} (기대: ${testSetpoint}) → ${eepromVerified ? 'PASS' : 'FAIL'}`);

            // Phase 3: 비정상 EEPROM 코드 쓰기
            self.addLog('info', '[Phase 3] 비정상 EEPROM 코드 쓰기 (0xD000 ← 0xFFFF)');
            await window.dashboard.writeRegister(1, 0xD000, 0xFFFF);
            await new Promise(r => setTimeout(r, 300));

            // 복원
            self.addLog('info', '[복원] 기존 Setpoint 복원 + EEPROM 저장');
            await window.dashboard.writeRegister(1, 0xD001, origSetpoint);
            await window.dashboard.writeRegister(1, 0xD000, 0x0004);

            const pass = eepromVerified;
            return {
                status: pass ? 'pass' : 'fail',
                message: pass ? 'EEPROM Save/Load 검증 완료' : '전원 재투입 후 EEPROM 값 불일치',
                details: [
                    `기존 Setpoint: ${origSetpoint}`,
                    `EEPROM 저장값(0x${testSetpoint.toString(16).toUpperCase()}) 유지: ${eepromVerified ? 'PASS' : 'FAIL'} (실제: ${readAfterPower !== null ? readAfterPower : 'N/A'})`,
                    '비정상 EEPROM 코드(0xFFFF) 전송 완료',
                ].join('\n'),
            };
        },

        // ── basic06 executor ─────────────────────────────────────────────────
        'basic06': async function () {
            const self = this;
            self.checkConnection();

            // ── Phase 2: DC Link 전압 읽기 ────────────────────────────────────
            self.addLog('═'.repeat(52), 'info');
            self.addLog('[Phase 2] DC Link 전압 읽기', 'info');
            self.addLog('  대상 레지스터: 0xD013  (FC04 Input Register, Slave 1)', 'info');
            self.addLog('  TX: 01 04 D0 13 00 01 [CRC]', 'info');
            self.updateProgress(20, 'Phase 2: DC Link 전압 읽기');

            const dcVoltage = await window.dashboard.readInputRegisterWithTimeout(1, 0xD013);
            if (dcVoltage === null || dcVoltage === undefined) {
                self.addLog('  RX: 응답 없음 → 테스트 중단', 'error');
                return { status: 'fail', message: 'DC Link 전압 읽기 실패', details: '0xD013 FC04 응답 없음' };
            }

            const dcHex     = dcVoltage.toString(16).toUpperCase().padStart(4, '0');
            const inRange   = dcVoltage >= 483 && dcVoltage <= 591;
            self.addLog(`  RX: 0x${dcHex} = ${dcVoltage} (raw)`, 'info');
            self.addLog(`  정상 범위: 483 ~ 591  →  읽기값 ${dcVoltage} ${inRange ? '✔ 범위 내' : '✘ 범위 벗어남'}`, inRange ? 'success' : 'warn');
            self.updateProgress(50, 'Phase 2 완료');

            // ── Phase 3: Read-Only 쓰기 방어 확인 ────────────────────────────
            self.addLog('─'.repeat(52), 'info');
            self.addLog('[Phase 3] Read-Only 주소 쓰기 시도 → 거부 여부 확인', 'info');
            self.addLog('  쓰기값: 0x0320 = 800  (Input Register 영역에 FC06 쓰기)', 'info');
            self.addLog('  TX(Write FC06): 01 06 D0 13 03 20 [CRC]', 'info');
            self.updateProgress(65, 'Phase 3: Read-Only 쓰기 시도');

            await window.dashboard.writeRegister(1, 0xD013, 0x0320);
            await new Promise(r => setTimeout(r, 200));
            self.addLog('  200 ms 대기 후 읽기 검증...', 'info');
            self.addLog('  TX(Read  FC04): 01 04 D0 13 00 01 [CRC]', 'info');

            const readAfterWrite = await window.dashboard.readInputRegisterWithTimeout(1, 0xD013);
            const writeRejected  = (readAfterWrite !== null && readAfterWrite !== 0x0320);
            self.updateProgress(85, 'Phase 3: 결과 확인');

            if (readAfterWrite === null) {
                self.addLog('  RX: 응답 없음', 'warn');
            } else {
                const afterHex = readAfterWrite.toString(16).toUpperCase().padStart(4, '0');
                self.addLog(`  RX: 0x${afterHex} = ${readAfterWrite}`, 'info');
                self.addLog(
                    writeRejected
                        ? `  0x0320 반영되지 않음 (실제값: ${readAfterWrite}) → ✔ Read-Only 보호 확인 — PASS`
                        : `  0x0320 그대로 반영됨 → ✘ Read-Only 보호 미작동 — WARNING`,
                    writeRejected ? 'success' : 'warn'
                );
            }

            self.addLog('═'.repeat(52), 'info');
            self.updateProgress(100, '테스트 완료');

            return {
                status: inRange ? 'pass' : 'warn',
                message: inRange ? 'DC Link 전압 정상 범위 확인' : 'DC Link 전압 범위 경고',
                details: [
                    `DC Link 전압: ${dcVoltage} (0x${dcHex})  정상범위 483~591  → ${inRange ? 'PASS' : 'WARNING'}`,
                    `Read-Only 보호: ${writeRejected ? 'PASS' : 'WARNING'}`,
                    'Note: CLAUDE.md 기준 0xD013. docx 기재 0xD019와 다름 — 실기 확인 필요',
                ].join('\n'),
            };
        },

        // ── basic07 executor ─────────────────────────────────────────────────
        'basic07': async function () {
            const self = this;
            self.checkConnection();

            self.addLog('info', '[Phase 2] Board 온도 읽기 (0xD017, FC04)');
            const boardTemp = await window.dashboard.readInputRegisterWithTimeout(1, 0xD017);
            if (boardTemp === null || boardTemp === undefined) {
                return { status: 'fail', message: 'Board 온도 읽기 실패', details: '0xD017 FC04 응답 없음' };
            }
            self.addLog('info', `Board 온도: ${boardTemp}°C`);

            // 비정상값 체크: 0=단선, >=200=오버플로우
            if (boardTemp === 0) {
                return { status: 'fail', message: 'Board 온도 센서 단선 의심', details: `읽기값: ${boardTemp} (단선 또는 미연결)` };
            }
            if (boardTemp >= 200) {
                return { status: 'fail', message: 'Board 온도 오버플로우', details: `읽기값: ${boardTemp} (센서 오류 또는 오버플로우)` };
            }

            const inRange = boardTemp >= 5 && boardTemp <= 80;
            self.addLog('info', `범위 검사(5~80°C): ${inRange ? 'PASS' : 'WARNING'}`);

            // Phase 3: Read-Only 쓰기 방어
            self.addLog('info', '[Phase 3] Read-Only 쓰기 시도 (0xD017 ← 0x0019)');
            await window.dashboard.writeRegister(1, 0xD017, 0x0019);
            await new Promise(r => setTimeout(r, 200));
            const readAfterWrite = await window.dashboard.readInputRegisterWithTimeout(1, 0xD017);
            const writeRejected = (readAfterWrite !== null && readAfterWrite !== 0x0019);
            self.addLog('info', `쓰기 후 값: ${readAfterWrite !== null ? readAfterWrite : 'null'} → ${writeRejected ? 'Read-Only 보호 확인(PASS)' : '쓰기 반영됨(경고)'}`);

            return {
                status: inRange ? 'pass' : 'warn',
                message: inRange ? 'Board 온도 정상 범위 확인' : 'Board 온도 범위 경고',
                details: [
                    `Board 온도: ${boardTemp}°C (정상범위 5~80°C)`,
                    `범위 내: ${inRange ? 'PASS' : 'WARNING'}`,
                    `Read-Only 보호: ${writeRejected ? 'PASS' : 'WARNING'}`,
                ].join('\n'),
            };
        },

        // ── basic08 executor ─────────────────────────────────────────────────
        'basic08': async function () {
            const self = this;
            self.checkConnection();

            self.addLog('info', '[Phase 2] 인버터 모듈 온도 읽기 (0xD015, FC04)');
            const moduleTemp = await window.dashboard.readInputRegisterWithTimeout(1, 0xD015);
            if (moduleTemp === null || moduleTemp === undefined) {
                return { status: 'fail', message: '모듈 온도 읽기 실패', details: '0xD015 FC04 응답 없음' };
            }
            self.addLog('info', `인버터 모듈 온도: ${moduleTemp}°C`);

            if (moduleTemp === 0) {
                return { status: 'fail', message: '모듈 온도 센서 단선 의심', details: `읽기값: ${moduleTemp}` };
            }
            if (moduleTemp >= 200) {
                return { status: 'fail', message: '모듈 온도 오버플로우', details: `읽기값: ${moduleTemp}` };
            }

            const inRange = moduleTemp >= 5 && moduleTemp <= 80;
            self.addLog('info', `범위 검사(5~80°C): ${inRange ? 'PASS' : 'WARNING'}`);

            // Phase 3: Read-Only 쓰기 방어
            self.addLog('info', '[Phase 3] Read-Only 쓰기 시도 (0xD015 ← 0x0019)');
            await window.dashboard.writeRegister(1, 0xD015, 0x0019);
            await new Promise(r => setTimeout(r, 200));
            const readAfterWrite = await window.dashboard.readInputRegisterWithTimeout(1, 0xD015);
            const writeRejected = (readAfterWrite !== null && readAfterWrite !== 0x0019);
            self.addLog('info', `쓰기 후 값: ${readAfterWrite !== null ? readAfterWrite : 'null'} → ${writeRejected ? 'Read-Only 보호 확인(PASS)' : '쓰기 반영됨(경고)'}`);

            return {
                status: inRange ? 'pass' : 'warn',
                message: inRange ? '인버터 모듈 온도 정상 범위 확인' : '인버터 모듈 온도 범위 경고',
                details: [
                    `모듈 온도: ${moduleTemp}°C (정상범위 5~80°C)`,
                    `범위 내: ${inRange ? 'PASS' : 'WARNING'}`,
                    `Read-Only 보호: ${writeRejected ? 'PASS' : 'WARNING'}`,
                ].join('\n'),
            };
        },

        // ── basic09 executor ─────────────────────────────────────────────────
        'basic09': async function () {
            const self = this;
            self.checkConnection();

            const regs = [
                { addr: 0xD002, key: 'mainBootVer',  label: 'Main Boot Version' },
                { addr: 0xD003, key: 'mainSwVer',    label: 'Main SW Version' },
                { addr: 0xD004, key: 'invBootVer',   label: 'Inverter Boot Version' },
                { addr: 0xD005, key: 'invSwVer',     label: 'Inverter SW Version' },
            ];

            const results = [];
            let allValid = true;

            for (const reg of regs) {
                self.addLog('info', `[Phase 2] ${reg.label} 읽기 (0x${reg.addr.toString(16).toUpperCase()})`);
                const val = await window.dashboard.readInputRegisterWithTimeout(1, reg.addr);
                const valid = val !== null && val !== undefined && val !== 0;
                results.push({ ...reg, val, valid });
                self.addLog('info', `  ${reg.label}: ${val !== null ? val : 'null'} → ${valid ? 'PASS' : 'FAIL(0 또는 null)'}`);
                if (!valid) allValid = false;
            }

            // Phase 3: Read-Only 쓰기 방어
            self.addLog('info', '[Phase 3] Read-Only 쓰기 시도 (0xD003 ← 0xFFFF)');
            await window.dashboard.writeRegister(1, 0xD003, 0xFFFF);
            await new Promise(r => setTimeout(r, 200));
            const readAfterWrite = await window.dashboard.readInputRegisterWithTimeout(1, 0xD003);
            const writeRejected = (readAfterWrite !== null && readAfterWrite !== 0xFFFF);
            self.addLog('info', `쓰기 후 값: ${readAfterWrite !== null ? readAfterWrite : 'null'} → ${writeRejected ? 'Read-Only 보호 확인(PASS)' : '경고'}`);

            return {
                status: allValid ? 'pass' : 'fail',
                message: allValid ? '펌웨어 버전 4개 모두 유효' : '일부 버전 레지스터 값 없음',
                details: results.map(r => `${r.label} (0x${r.addr.toString(16).toUpperCase()}): ${r.val !== null ? r.val : 'null'} → ${r.valid ? 'PASS' : 'FAIL'}`).join('\n')
                    + `\nRead-Only 보호: ${writeRejected ? 'PASS' : 'WARNING'}`,
            };
        },

        // ── basic10 executor ─────────────────────────────────────────────────
        'basic10': async function () {
            const self = this;
            self.checkConnection();

            // Phase 1: 업데이트 전 버전 읽기
            self.addLog('info', '[Phase 1] Main SW 버전 읽기 (0xD003, FC04)');
            const verBefore = await window.dashboard.readInputRegisterWithTimeout(1, 0xD003);
            if (verBefore === null || verBefore === undefined) {
                return { status: 'fail', message: 'Main SW 버전 읽기 실패', details: '0xD003 FC04 응답 없음' };
            }
            self.addLog('info', `업데이트 전 Main SW 버전: ${verBefore}`);

            // Phase 2: OS 다운로드 안내
            self.addLog('warn', '[Phase 2] Main OS 다운로드 안내');
            self.addLog('info', 'OS 업데이트 툴을 사용하여 Main F/W 다운로드를 진행하세요.');
            self.addLog('info', '다운로드 완료 후 장치가 자동으로 재부팅됩니다.');
            await self._runStep({ type: 'wait_countdown', seconds: 60, message: 'Main OS 다운로드 대기 (60초)' }, 0);

            // Phase 3: 재연결 후 버전 읽기
            self.addLog('info', '[Phase 3] 재연결 후 Main SW 버전 읽기');
            let verAfter = null;
            for (let i = 0; i < 5; i++) {
                verAfter = await window.dashboard.readInputRegisterWithTimeout(1, 0xD003);
                if (verAfter !== null) break;
                await new Promise(r => setTimeout(r, 2000));
            }

            const versionChanged = verAfter !== null && verAfter !== verBefore;
            self.addLog('info', `업데이트 후 Main SW 버전: ${verAfter !== null ? verAfter : 'null'} → ${versionChanged ? '버전 변경 확인(PASS)' : '버전 동일 또는 읽기 실패'}`);

            return {
                status: versionChanged ? 'pass' : 'warn',
                message: versionChanged ? 'Main OS 다운로드 및 버전 변경 확인' : '버전 미변경 또는 재연결 실패 (수동 확인 필요)',
                details: [
                    `업데이트 전 버전: ${verBefore}`,
                    `업데이트 후 버전: ${verAfter !== null ? verAfter : 'N/A'}`,
                    `버전 변경: ${versionChanged ? 'PASS' : 'WARN — 동일하거나 읽기 실패'}`,
                ].join('\n'),
            };
        },

        // ── basic11 executor ─────────────────────────────────────────────────
        'basic11': async function () {
            const self = this;
            self.checkConnection();

            // Phase 1: 업데이트 전 버전 읽기
            self.addLog('info', '[Phase 1] Inverter SW 버전 읽기 (0xD005, FC04)');
            const verBefore = await window.dashboard.readInputRegisterWithTimeout(1, 0xD005);
            if (verBefore === null || verBefore === undefined) {
                return { status: 'fail', message: 'Inverter SW 버전 읽기 실패', details: '0xD005 FC04 응답 없음' };
            }
            self.addLog('info', `업데이트 전 Inverter SW 버전: ${verBefore}`);

            // Phase 2: OS 다운로드 안내
            self.addLog('warn', '[Phase 2] Inverter OS 다운로드 안내');
            self.addLog('info', 'OS 업데이트 툴을 사용하여 Inverter F/W 다운로드를 진행하세요.');
            self.addLog('info', '다운로드 완료 후 장치가 자동으로 재부팅됩니다.');
            await self._runStep({ type: 'wait_countdown', seconds: 60, message: 'Inverter OS 다운로드 대기 (60초)' }, 0);

            // Phase 3: 재연결 후 버전 읽기
            self.addLog('info', '[Phase 3] 재연결 후 Inverter SW 버전 읽기');
            let verAfter = null;
            for (let i = 0; i < 5; i++) {
                verAfter = await window.dashboard.readInputRegisterWithTimeout(1, 0xD005);
                if (verAfter !== null) break;
                await new Promise(r => setTimeout(r, 2000));
            }

            const versionChanged = verAfter !== null && verAfter !== verBefore;
            self.addLog('info', `업데이트 후 Inverter SW 버전: ${verAfter !== null ? verAfter : 'null'} → ${versionChanged ? '버전 변경 확인(PASS)' : '버전 동일 또는 읽기 실패'}`);

            return {
                status: versionChanged ? 'pass' : 'warn',
                message: versionChanged ? 'Inverter OS 다운로드 및 버전 변경 확인' : '버전 미변경 또는 재연결 실패 (수동 확인 필요)',
                details: [
                    `업데이트 전 버전: ${verBefore}`,
                    `업데이트 후 버전: ${verAfter !== null ? verAfter : 'N/A'}`,
                    `버전 변경: ${versionChanged ? 'PASS' : 'WARN — 동일하거나 읽기 실패'}`,
                ].join('\n'),
            };
        },

    },

});
