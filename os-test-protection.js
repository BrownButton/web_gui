/**
 * OS Test Module - 보호동작
 * 5-1  ~ 5-20. Error 0x10 ~ 0x58  (17개)
 * 5-21 ~ 5-27. Warning 0x01 ~ 0x40 (6개)
 * 5-28 ~ 5-29. 엔코더 에러 (2개)
 *
 * ▶ 4단계 시험 구조 (docx 기준)
 *   Phase 1 : Base Setup — 연결 확인 및 초기 상태 읽기
 *   Phase 2 : 고장 주입 및 보호 동작 확인 — PWM 차단, 에러 코드 확인
 *   Phase 3 : Alarm Reset 거부 검증 — 원인 미제거 상태에서 리셋 명령 → 거부되어야 PASS
 *   Phase 4 : 복구 검증 — 원인 제거 후 리셋 또는 전원 재투입 → 정상 복귀
 *
 * ▶ Warning 항목은 Phase 3 대신 "경고 상태 안정성" 확인, Phase 4에서 자동 해제 확인
 *
 * 레지스터:
 *   0xD010 : 에러 코드 (FC04)
 *   0xD011 : Motor Status (FC04)  — Bit4=FB(Fault Brake), Bit0=PHA(Phase) ...
 *   0xD000 : Alarm Reset (FC06, write 0x0002)
 */

window.OSTestModules = window.OSTestModules || [];

window.OSTestModules.push({

    tests: {

        // ══════════════════════════════════════════════════════════════════
        //  ERROR ITEMS  (5-1 ~ 5-20)
        // ══════════════════════════════════════════════════════════════════

        // ── 5-1. Error 0x10 IPM fault ──────────────────────────────────────
        'prot-0x10': {
            id: 'prot-0x10',
            category: '보호동작',
            number: '5-1',
            title: 'Error 0x10 — IPM fault',
            description: 'IPM 하드웨어 고장 조건 유발 시 즉각적인 PWM 차단 및 알람 리셋 거부 로직 검증',
            purpose: '오배선/결상 등으로 IPM 내부 고장 조건을 강제 유발했을 때 드라이브가 즉시 PWM 출력을 차단하는지, ' +
                     '원인 미제거 상태의 Alarm Reset 명령을 거부하는지, 원인 제거 후 정상 복귀하는지 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 오실로스코프',
            criteria: '[Phase 2] IPM Fault 발생 즉시 PWM 차단(Freewheeling 정지) / Motor Status Bit4(FB) Set / Error 코드 0x10 확인\n' +
                      '[Phase 3] 원인 미제거 상태에서 Alarm Reset 명령 거부 — 알람 해제 없음 / PWM 차단 상태 유지\n' +
                      '[Phase 4] 원인 제거 + 전원 재투입 후 알람 해제 및 정상 구동 재개',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인 (19200bps, Even, Node 1)' },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 1] Motor Status [0xD011] 초기값 확인 (정상: 0x0000)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 30,
                    message: '[Phase 2 — 고장 주입]\n' +
                             '모터 오배선, 결상 등 IPM Fault 유발 환경을 구성하세요.\n' +
                             '(출력 단자 간 일시 단락 또는 제조사 FCT 프로시저)\n' +
                             '⚠ 드라이브가 Fault를 감지하는 즉시 PWM이 차단되는지 오실로스코프로 확인하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status — IPM Fault 검출 확인 (Bit4 FB Set 기대)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x10 (IPM fault) 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 명령 전송 (원인 미제거 상태 — 거부되어야 PASS)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 여전히 유지 확인 (리셋 거부 PASS)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 3] 에러 코드 — 0x10 여전히 존재 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 30,
                    message: '[Phase 4 — 복구]\n' +
                             '① IPM Fault 유발 원인(오배선/결상)을 완전히 제거하세요.\n' +
                             '② 드라이브 전원을 재투입하세요 (Power-cycle).\n' +
                             '③ 재연결 후 Run 지령을 인가하여 모터 정상 기동을 확인하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인 (0x0000 기대)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 4] 에러 코드 — 해제 확인 (0x0000 기대)', softFail: true
                }
            ]
        },

        // ── 5-2. Error 0x11 IPM Over temperature ──────────────────────────
        'prot-0x11': {
            id: 'prot-0x11',
            category: '보호동작',
            number: '5-2',
            title: 'Error 0x11 — IPM Over temperature',
            description: 'IPM 과온 보호 동작 및 알람 리셋 거부 로직 검증',
            purpose: 'IPM 온도가 과온 임계값을 초과했을 때 드라이브가 PWM 차단 보호 동작을 수행하는지, ' +
                     '냉각 전 Alarm Reset 명령을 거부하는지, 냉각 후 정상 복귀하는지 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 열풍기 (IPM 가열용)',
            criteria: '[Phase 2] IPM 과온 임계값 초과 시 PWM 차단 / Error 코드 0x11 확인\n' +
                      '[Phase 3] 냉각 전 Alarm Reset 거부\n' +
                      '[Phase 4] 냉각 후 Alarm Reset 정상 처리 및 구동 재개',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0x260B,
                    label: '[Phase 1] IGBT 온도 [0x260B] 초기값 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 60,
                    message: '[Phase 2 — IPM 가열]\n' +
                             '열풍기로 IPM/IGBT 모듈을 가열하세요.\n' +
                             'IGBT 과온 임계값(사양서 확인) 초과까지 대기합니다.\n' +
                             '⚠ 과도한 가열로 소자 손상에 주의하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0x260B,
                    label: '[Phase 2] IGBT 온도 [0x260B] — 임계값 초과 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x11 검출 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x11 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 명령 전송 (과온 상태 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 여전히 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 60,
                    message: '[Phase 4 — 냉각 및 복구]\n' +
                             'IPM/IGBT 온도가 내려가도록 자연 냉각 또는 냉각 팬을 동작시키세요.\n' +
                             '온도가 임계값 이하로 내려간 후 Alarm Reset을 전송합니다.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (냉각 완료 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-3. Error 0x14 Over current ──────────────────────────────────
        'prot-0x14': {
            id: 'prot-0x14',
            category: '보호동작',
            number: '5-3',
            title: 'Error 0x14 — Over current',
            description: '과전류 보호 동작 및 알람 리셋 거부 로직 검증',
            purpose: '드라이브 출력 전류가 과전류 임계값을 초과했을 때 보호 동작(알람)이 수행되는지 확인한다. ' +
                     '원인 미제거 상태의 Alarm Reset 거부 및 복구를 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '[Phase 2] Over Current 발생 시 PWM 차단 / Error 코드 0x14 확인\n' +
                      '[Phase 3] 원인 미제거 상태 Alarm Reset 거부\n' +
                      '[Phase 4] 원인 제거 후 Alarm Reset 정상 처리',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_holding', slaveId: 1, address: 0xD13B,
                    label: '[Phase 1] Max Coil Current [0xD13B] 백업', storeAs: 'maxCurrentBackup', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0x2610,
                    label: '[Phase 1] U상 전류 [0x2610] 초기값 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — 과전류 유발]\n' +
                             '아래 방법 중 하나를 선택하세요:\n' +
                             '① Max Coil Current [0xD13B] 값을 현재 동작 전류보다 낮게 설정\n' +
                             '② FCT 프로시저로 과전류 주입\n' +
                             '설정 후 모터를 구동하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x14 검출 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x14 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (원인 미제거 상태 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'restore_holding', slaveId: 1, address: 0xD13B,
                    restoreFrom: 'maxCurrentBackup',
                    label: '[Phase 4] Max Coil Current [0xD13B] 원복 (과전류 원인 제거)', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (원인 제거 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-4. Error 0x15 Current offset ────────────────────────────────
        'prot-0x15': {
            id: 'prot-0x15',
            category: '보호동작',
            number: '5-4',
            title: 'Error 0x15 — Current offset',
            description: '전류 오프셋 이상 보호 동작 검증',
            purpose: '전류 센서 오프셋 이상이 감지되었을 때 보호 동작(알람)이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '[Phase 2] Current Offset 이상 발생 시 보호 동작 수행 / Error 코드 0x15 확인\n' +
                      '[Phase 3] 원인 미제거 상태 Alarm Reset 거부\n' +
                      '[Phase 4] 원인 제거 + 전원 재투입 후 정상 복귀',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0x2610,
                    label: '[Phase 1] U상 전류 센서값 [0x2610] (정지 시 0 기대)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0x2611,
                    label: '[Phase 1] V상 전류 센서값 [0x2611]', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — 전류 오프셋 이상 유발]\n' +
                             '제조사 FCT 프로시저를 통해 전류 오프셋 이상 조건을 주입하세요.\n' +
                             '또는 전류 센서 신호선을 분리하여 오프셋 이상 조건을 유발하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x15 검출 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x15 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (원인 미제거 상태 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 4 — 복구]\n' +
                             '전류 센서 신호선을 정상 연결하고 전원을 재투입하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-5. Error 0x17 IPM Low temperature (환경 챔버 필요) ──────────
        'prot-0x17': {
            id: 'prot-0x17',
            category: '보호동작',
            number: '5-5',
            title: 'Error 0x17 — IPM Low temperature',
            description: 'IPM 저온 보호 동작 검증 (저온 환경 챔버 필요)',
            purpose: 'IPM 온도가 저온 임계값 이하로 내려갔을 때 보호 동작(알람)이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 저온 환경 챔버',
            criteria: '[Phase 2] IPM 저온 조건 발생 시 보호 동작 수행 / Error 코드 0x17 확인\n' +
                      '[Phase 4] 온도 정상 복귀 후 Alarm Reset 처리',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0x260B,
                    label: '[Phase 1] IGBT 온도 [0x260B] 초기값 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 15,
                    message: '[Phase 2 — 저온 환경 구성]\n' +
                             '⚠ 저온 환경 챔버가 필요한 항목입니다.\n' +
                             'IPM을 저온 임계값(사양서 확인) 이하로 냉각하세요.\n' +
                             '챔버 환경 미구축 시 이 항목은 SKIP 처리하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x17 검출 확인 (챔버 시험 시)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x17 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (저온 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 4 — 복구]\n온도를 정상 범위로 복귀시킨 후 Alarm Reset을 전송합니다.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (온도 정상 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-6. Error 0x22 Drive temperature 1 ───────────────────────────
        'prot-0x22': {
            id: 'prot-0x22',
            category: '보호동작',
            number: '5-6',
            title: 'Error 0x22 — Drive temperature 1',
            description: '드라이브 과온 보호 동작 및 알람 리셋 거부 로직 검증 (레벨 1)',
            purpose: '드라이브 온도가 과온 임계값을 초과했을 때 PWM 차단 보호 동작이 수행되는지 확인한다. ' +
                     '냉각 전 Alarm Reset 거부 및 냉각 후 복구를 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 열풍기',
            criteria: '[Phase 2] 드라이브 과온 발생 시 PWM 차단 / Error 코드 0x22 확인\n' +
                      '[Phase 3] 냉각 전 Alarm Reset 거부\n' +
                      '[Phase 4] 냉각 후 Alarm Reset 처리 및 정상 복귀',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0x260A,
                    label: '[Phase 1] Board 온도 [0x260A] 초기값 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0x260B,
                    label: '[Phase 1] IGBT 온도 [0x260B] 초기값 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 90,
                    message: '[Phase 2 — 과온 유발]\n' +
                             '열풍기로 드라이브 보드(0x22 담당 센서 부위)를 가열하세요.\n' +
                             'Error 0x22 임계값(사양서 확인) 초과까지 대기합니다.\n' +
                             '⚠ 소자 손상 방지를 위해 알람 발생 즉시 열풍기를 제거하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0x260A,
                    label: '[Phase 2] Board 온도 [0x260A] — 임계값 초과 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x22 검출 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x22 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (과온 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 60,
                    message: '[Phase 4 — 냉각 및 복구]\n드라이브 온도가 임계값 이하로 냉각되도록 대기하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (냉각 완료 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-7. Error 0x24 Motor cable open ──────────────────────────────
        'prot-0x24': {
            id: 'prot-0x24',
            category: '보호동작',
            number: '5-7',
            title: 'Error 0x24 — Motor cable open',
            description: '모터 케이블 단선 보호 동작 및 알람 리셋 거부 로직 검증',
            purpose: '모터 케이블이 단선(Open) 상태에서 구동 시도 시 드라이브가 보호 동작을 수행하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '[Phase 2] 케이블 단선 상태에서 구동 시도 시 Error 0x24 발생\n' +
                      '[Phase 3] 단선 유지 중 Alarm Reset 거부\n' +
                      '[Phase 4] 케이블 재연결 후 Alarm Reset 정상 처리',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 1] Motor Status [0xD011] 초기값 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — 케이블 단선]\n' +
                             '드라이브를 정지시킨 후 모터 출력 케이블(U/V/W 중 하나 이상)을 분리하세요.\n' +
                             '⚠ 전원 인가 상태에서 분리하지 마세요 — 정지 후 작업하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD001, value: 16000,
                    label: '[Phase 2] Setpoint = 400 RPM (단선 상태에서 구동 시도)', softFail: true
                },
                {
                    type: 'delay', ms: 3000, label: '3초 대기 (케이블 오픈 검출 대기)'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x24 검출 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x24 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD001, value: 0,
                    label: 'Setpoint = 0 (정지)', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (케이블 미연결 상태 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 4 — 복구]\n분리한 모터 케이블을 정상 연결하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (케이블 재연결 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-8. Error 0x25 Drive temperature 2 ───────────────────────────
        'prot-0x25': {
            id: 'prot-0x25',
            category: '보호동작',
            number: '5-8',
            title: 'Error 0x25 — Drive temperature 2',
            description: '드라이브 과온 보호 동작 및 알람 리셋 거부 로직 검증 (레벨 2)',
            purpose: '인버터부 온도가 과온 임계값을 초과했을 때 보호 동작이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 열풍기',
            criteria: '[Phase 2] 인버터부 과온 발생 시 Error 0x25 확인\n' +
                      '[Phase 3] 냉각 전 Alarm Reset 거부\n' +
                      '[Phase 4] 냉각 후 Alarm Reset 처리',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0x260A,
                    label: '[Phase 1] Board 온도 [0x260A] 초기값', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 90,
                    message: '[Phase 2 — 과온 유발]\n' +
                             '열풍기로 인버터부(0x25 담당 온도 센서 부위)를 가열하세요.\n' +
                             'Error 0x25 임계값(사양서 확인) 초과까지 대기합니다.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x25 검출 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x25 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (과온 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 60,
                    message: '[Phase 4 — 냉각]\n드라이브 온도가 임계값 이하로 냉각되도록 대기하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (냉각 완료 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-9. Error 0x2A Motor circuit abnormality ──────────────────────
        'prot-0x2a': {
            id: 'prot-0x2a',
            category: '보호동작',
            number: '5-9',
            title: 'Error 0x2A — Motor circuit abnormality',
            description: '모터 회로 이상 보호 동작 및 알람 리셋 거부 로직 검증',
            purpose: '모터 회로 이상(권선 단선, 상간 불평형 등) 감지 시 드라이브가 보호 동작을 수행하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '[Phase 2] 모터 회로 이상 시 Error 0x2A 검출\n' +
                      '[Phase 3] 이상 유지 중 Alarm Reset 거부\n' +
                      '[Phase 4] 회로 복구 후 Alarm Reset 처리',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0x2610,
                    label: '[Phase 1] U상 전류 [0x2610] 초기값', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — 모터 회로 이상 유발]\n' +
                             '아래 방법 중 하나를 선택하세요:\n' +
                             '① 모터 권선 단선 시뮬레이션\n' +
                             '② 상간 불평형 부하 삽입\n' +
                             '설정 후 드라이브를 구동하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD001, value: 8000,
                    label: '[Phase 2] Setpoint = 200 RPM (이상 상태에서 구동 시도)', softFail: true
                },
                {
                    type: 'delay', ms: 3000, label: '3초 대기'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x2A 검출 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x2A 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD001, value: 0,
                    label: 'Setpoint = 0 (정지)', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (회로 이상 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 4 — 복구]\n모터 회로를 정상 상태로 복구하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (회로 복구 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-10. Error 0x36 Sinusoidal encoder amplitude too low ─────────
        'prot-0x36': {
            id: 'prot-0x36',
            category: '보호동작',
            number: '5-10',
            title: 'Error 0x36 — Sinusoidal encoder amplitude too low',
            description: '정현파 엔코더 신호 저진폭 보호 동작 및 알람 리셋 거부 로직 검증',
            purpose: '사인파 엔코더 신호 진폭이 최소 임계값 이하로 내려갔을 때 보호 동작이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 가변 저항(감쇠기)',
            criteria: '[Phase 2] 엔코더 신호 저진폭 시 Error 0x36 확인\n' +
                      '[Phase 3] 신호 이상 유지 중 Alarm Reset 거부\n' +
                      '[Phase 4] 신호 복구 후 Alarm Reset 처리',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 1] Motor Status [0xD011] 초기값 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — 엔코더 신호 저진폭 유발]\n' +
                             '정현파 엔코더 신호선에 감쇠기(저항)를 삽입하여 진폭을 낮추세요.\n' +
                             '또는 엔코더 신호선을 부분 단락하여 하한 임계값 이하로 조절하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x36 검출 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x36 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (신호 이상 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 15,
                    message: '[Phase 4 — 복구]\n감쇠기를 제거하고 엔코더 신호를 정상으로 복구하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (신호 복구 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-11. Error 0x37 Sinusoidal encoder amplitude too high ────────
        'prot-0x37': {
            id: 'prot-0x37',
            category: '보호동작',
            number: '5-11',
            title: 'Error 0x37 — Sinusoidal encoder amplitude too high',
            description: '정현파 엔코더 신호 고진폭 보호 동작 및 알람 리셋 거부 로직 검증',
            purpose: '사인파 엔코더 신호 진폭이 최대 임계값을 초과했을 때 보호 동작이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 신호 증폭기 (선택)',
            criteria: '[Phase 2] 엔코더 신호 고진폭 시 Error 0x37 확인\n' +
                      '[Phase 3] 신호 이상 유지 중 Alarm Reset 거부\n' +
                      '[Phase 4] 신호 복구 후 Alarm Reset 처리',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 1] Motor Status [0xD011] 초기값', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — 엔코더 신호 고진폭 유발]\n' +
                             '신호 증폭기로 엔코더 신호 진폭을 상한 임계값 이상으로 높이거나,\n' +
                             '외부 신호 발생기로 고진폭 정현파 신호를 주입하세요.\n' +
                             '⚠ 장비 미구축 시 이 항목은 SKIP 처리하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x37 검출 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x37 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (신호 이상 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 15,
                    message: '[Phase 4 — 복구]\n신호 증폭기를 제거하고 엔코더 신호를 정상으로 복구하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (신호 복구 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-14. Error 0x40 Under voltage ────────────────────────────────
        'prot-0x40': {
            id: 'prot-0x40',
            category: '보호동작',
            number: '5-14',
            title: 'Error 0x40 — Under voltage',
            description: '저전압 보호 동작 및 알람 리셋 거부 로직 검증',
            purpose: 'DC Link 전압이 저전압 임계값 이하로 내려갔을 때 PWM 차단 보호 동작이 수행되는지 확인한다. ' +
                     '저전압 유지 중 Alarm Reset 거부 및 전압 복구 후 정상 처리를 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 가변 AC/DC 전원공급기, 오실로스코프',
            criteria: '[Phase 2] 저전압 발생 시 즉각적 PWM 차단 / Motor Status Bit4(FB)+Bit12(UzLow) Set (기대값 0x1010)\n' +
                      '[Phase 3] 저전압 유지 중 Alarm Reset 거부\n' +
                      '[Phase 4] 전압 정상 복구 후 Alarm Reset 처리 및 구동 재개',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0x2605,
                    label: '[Phase 1] DC Link 전압 [0x2605] 초기값 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — 저전압 유발]\n' +
                             '가변 DC 전원 공급 장치를 이용하여 DC Bus 전압을 서서히 감소시키세요.\n' +
                             'Error 0x40 임계값 이하로 내려갈 때 드라이브가 즉시 PWM을 차단하는지 확인하세요.\n' +
                             '⚠ 오실로스코프로 PWM 차단 순간을 확인하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0x2605,
                    label: '[Phase 2] DC Link 전압 [0x2605] — 임계값 이하 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x40 검출 확인 (기대: 0x1010)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x40 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (저전압 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 15,
                    message: '[Phase 4 — 전압 복구]\nDC Bus 전압을 정상 동작 범위 이상으로 복구하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (전압 복구 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-15. Error 0x41 Over voltage ─────────────────────────────────
        'prot-0x41': {
            id: 'prot-0x41',
            category: '보호동작',
            number: '5-15',
            title: 'Error 0x41 — Over voltage',
            description: '과전압 보호 동작 및 알람 리셋 거부 로직 검증',
            purpose: 'DC Link 전압이 과전압 임계값을 초과했을 때 즉각적인 PWM 차단이 이루어지는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 가변 AC/DC 전원공급기, 오실로스코프',
            criteria: '[Phase 2] 과전압 발생 시 즉각적 PWM 차단 / Error 코드 0x41 확인\n' +
                      '[Phase 3] 과전압 유지 중 Alarm Reset 거부\n' +
                      '[Phase 4] 전압 정상화 후 Alarm Reset 처리',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0x2605,
                    label: '[Phase 1] DC Link 전압 [0x2605] 초기값', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — 과전압 유발]\n' +
                             '가변 전원공급기로 DC Bus 전압을 과전압 임계값(사양서 확인) 이상으로 높이세요.\n' +
                             '⚠ 소자 손상 방지: 임계값 직후 즉시 전압을 낮추세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0x2605,
                    label: '[Phase 2] DC Link 전압 [0x2605] — 임계값 초과 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x41 검출 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x41 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (과전압 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 15,
                    message: '[Phase 4 — 전압 정상화]\nDC Bus 전압을 정상 동작 범위로 복구하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (전압 정상화 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-16. Error 0x42 RST power fail ───────────────────────────────
        'prot-0x42': {
            id: 'prot-0x42',
            category: '보호동작',
            number: '5-16',
            title: 'Error 0x42 — RST power fail',
            description: 'RST 전원 결상 보호 동작 및 알람 리셋 거부 로직 검증',
            purpose: '주 전원(RST) 결상이 발생했을 때 드라이브가 보호 동작을 수행하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '[Phase 2] RST 결상 발생 시 보호 동작 수행 / Motor Status Bit0(PHA)+Bit4(FB) Set (기대값 0x0011)\n' +
                      '[Phase 3] 결상 유지 중 Alarm Reset 거부\n' +
                      '[Phase 4] 전원 복구 + 재투입 후 정상 복귀',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 1] Motor Status [0xD011] 초기값 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — RST 결상 유발]\n' +
                             'RST 전원 라인 중 하나를 일시 단락하거나 제어 전원을 순간 차단하세요.\n' +
                             '드라이브가 에러를 감지할 때까지 대기합니다.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x42 검출 확인 (기대: 0x0011)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x42 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (결상 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 4 — 복구]\n' +
                             '① RST 전원을 정상 연결 상태로 복구하세요.\n' +
                             '② 드라이브 전원을 재투입하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-18. Error 0x50 Over speed limit ─────────────────────────────
        'prot-0x50': {
            id: 'prot-0x50',
            category: '보호동작',
            number: '5-18',
            title: 'Error 0x50 — Over speed limit',
            description: '속도 초과 보호 동작 및 알람 리셋 거부 로직 검증',
            purpose: '모터 속도가 최대 속도 제한을 초과했을 때 보호 동작이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '[Phase 2] 속도 초과 시 보호 동작 수행 / Motor Status Bit4(FB)+Bit8(N_Limit) Set (기대값 0x0110)\n' +
                      '[Phase 3] 속도 초과 유지 중 Alarm Reset 거부\n' +
                      '[Phase 4] 정지 및 최대 속도 원복 후 Alarm Reset 처리',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0xD02D,
                    label: '[Phase 1] Actual Speed [0xD02D] 초기값', softFail: true
                },
                {
                    type: 'read_holding', slaveId: 1, address: 0xD119,
                    label: '[Phase 1] 최대 속도 [0xD119] 백업', storeAs: 'maxSpeedBackup', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD119, value: 200,
                    label: '[Phase 2] 최대 속도 [0xD119] = 200 RPM (낮게 설정)', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD001, value: 64000,
                    label: '[Phase 2] Setpoint = 최대 (0xD001 = 64000)', softFail: true
                },
                {
                    type: 'delay', ms: 3000, label: '3초 대기 (속도 상승 후 초과 검출 대기)'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x50 검출 확인 (기대: 0x0110)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x50 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (속도 초과 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD001, value: 0,
                    label: '[Phase 4] Setpoint = 0 (정지)', softFail: true
                },
                {
                    type: 'restore_holding', slaveId: 1, address: 0xD119,
                    restoreFrom: 'maxSpeedBackup',
                    label: '[Phase 4] 최대 속도 [0xD119] 원복', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (정지 및 속도 제한 원복 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-19. Error 0x53 Excessive speed deviation ────────────────────
        'prot-0x53': {
            id: 'prot-0x53',
            category: '보호동작',
            number: '5-19',
            title: 'Error 0x53 — Excessive speed deviation',
            description: '과도 속도 편차 보호 동작 및 알람 리셋 거부 로직 검증',
            purpose: 'Closed-loop 속도 제어 중 목표 속도와 실제 속도의 편차가 허용 범위를 초과했을 때 보호 동작이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 부하 장치(샤프트 잠금 또는 부하기)',
            criteria: '[Phase 2] 속도 편차 초과 시 Error 0x53 검출\n' +
                      '[Phase 3] 과부하 유지 중 Alarm Reset 거부\n' +
                      '[Phase 4] 부하 제거 후 Alarm Reset 처리',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD001, value: 32000,
                    label: '[Phase 1] Setpoint = 800 RPM (정상 구동 시작)', softFail: true
                },
                {
                    type: 'delay', ms: 3000, label: '정상 구동 안정화 대기 3초'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD02D,
                    label: '[Phase 1] 정상 구동 속도 [0xD02D] 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — 과부하 유발]\n' +
                             '모터 샤프트에 갑작스러운 과부하를 가하여 목표 속도와 편차를 크게 만드세요.\n' +
                             '(부하기 급격한 토크 인가 또는 샤프트 강제 저항 증가)'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x53 검출 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x53 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD001, value: 0,
                    label: 'Setpoint = 0 (정지)', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (과부하 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 15,
                    message: '[Phase 4 — 복구]\n외부 부하를 제거하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (부하 제거 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ── 5-20. Error 0x58 Motor shaft blocked ──────────────────────────
        'prot-0x58': {
            id: 'prot-0x58',
            category: '보호동작',
            number: '5-20',
            title: 'Error 0x58 — Motor shaft blocked',
            description: '모터 샤프트 고착 보호 동작 및 알람 리셋 거부 로직 검증',
            purpose: '모터 샤프트가 물리적으로 구속된 상태에서 구동 시도 시 드라이브가 보호 동작을 수행하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 샤프트 잠금 장치',
            criteria: '[Phase 2] 샤프트 고착 시 보호 동작 수행 / Motor Status Bit4(FB)+Bit7(BLK) Set (기대값 0x0090)\n' +
                      '[Phase 3] 샤프트 잠금 유지 중 Alarm Reset 거부\n' +
                      '[Phase 4] 잠금 해제 후 Alarm Reset 처리',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — 샤프트 잠금]\n' +
                             '모터 샤프트를 물리적으로 잠그세요.\n' +
                             '(샤프트 고착 장치 또는 단단히 고정)\n' +
                             '⚠ 잠금 확인 후 즉시 구동 명령을 내립니다.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD001, value: 32000,
                    label: '[Phase 2] Setpoint = 800 RPM (고착 상태에서 구동 시도)', softFail: true
                },
                {
                    type: 'delay', ms: 5000, label: '5초 대기 (고착 검출 대기)'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Error 0x58 검출 확인 (기대: 0x0090)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 0x58 기대', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD001, value: 0,
                    label: 'Setpoint = 0 (정지)', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (샤프트 잠금 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 15,
                    message: '[Phase 4 — 복구]\n샤프트 잠금을 해제하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (잠금 해제 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인', softFail: true
                }
            ]
        },

        // ══════════════════════════════════════════════════════════════════
        //  WARNING ITEMS  (5-21 ~ 5-27)
        //  Warning: 드라이브 운전을 차단하지 않고 경고 상태만 표시
        //  Phase 3: Warning 상태에서 제어 안정성 확인 (Alarm Reset 불필요)
        //  Phase 4: 조건 복구 시 Warning 자동 해제 확인
        // ══════════════════════════════════════════════════════════════════

        // ── 5-21. Warning 0x01 DC Link under voltage ──────────────────────
        'prot-w01': {
            id: 'prot-w01',
            category: '보호동작',
            number: '5-21',
            title: 'Warning 0x01 — DC Link under voltage',
            description: 'DC Link 저전압 경고 동작 검증 (운전 유지, 경고 코드만 발생)',
            purpose: 'DC Bus 전압이 Warning 임계치 이하로 저하될 때 드라이브가 운전을 유지하면서 Warning 상태를 발생시키고 ' +
                     '통신으로 보고하는지 확인한다. 전압 복구 시 Warning이 자동 해제되는지 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 가변 AC/DC 전원공급기',
            criteria: '[Phase 2] Warning 구간 진입 시 PWM 출력 유지(운전 계속) / Motor Status Warning 0x01 비트 Set\n' +
                      '[Phase 3] Warning 상태에서 모터 구동 안정적 유지\n' +
                      '[Phase 4] 전압 복구 시 별도 Reset 없이 Warning 자동 해제',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0x2605,
                    label: '[Phase 1] DC Link 전압 [0x2605] 초기값 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — Warning 조건 유발]\n' +
                             '가변 DC 전원 공급 장치로 DC Bus 전압을 서서히 감소시키세요.\n' +
                             'Warning 임계치 이하로 진입하되, Fault(0x40) 임계치보다는 높은 구간을 유지하세요.\n' +
                             '드라이브가 구동을 유지하면서 Warning 코드(0x01)를 보고하는지 확인하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0x2605,
                    label: '[Phase 2] DC Link 전압 [0x2605] — Warning 구간 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Warning 0x01 플래그 Set 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD02D,
                    label: '[Phase 2] Actual Speed [0xD02D] — 모터 운전 유지 확인 (PWM 차단되지 않음)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 3 — Warning 상태 안정성 확인]\n' +
                             'Warning 상태를 유지하면서 모터가 안정적으로 구동되는지 관찰하세요.\n' +
                             '속도 변동, 토크 저하, 진동 등 이상 동작이 없어야 합격입니다.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD02D,
                    label: '[Phase 3] Actual Speed — Warning 상태에서 구동 안정성 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 15,
                    message: '[Phase 4 — 전압 복구]\nDC Bus 전압을 정상 범위로 복구하세요.\n별도의 Alarm Reset 없이 Warning이 자동 해제되는지 확인합니다.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status [0xD011] — Warning 자동 해제 확인', softFail: true
                }
            ]
        },

        // ── 5-22. Warning 0x02 DC Link over voltage ───────────────────────
        'prot-w02': {
            id: 'prot-w02',
            category: '보호동작',
            number: '5-22',
            title: 'Warning 0x02 — DC Link over voltage',
            description: 'DC Link 과전압 경고 동작 검증 (운전 유지, 경고 코드만 발생)',
            purpose: 'DC Bus 전압이 과전압 Warning 임계치를 초과했을 때 Warning 상태가 발생하고 ' +
                     '운전이 유지되는지, 전압 정상화 시 자동 해제되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 가변 AC/DC 전원공급기',
            criteria: '[Phase 2] 과전압 Warning 발생 시 운전 유지 / Warning 0x02 비트 Set\n' +
                      '[Phase 4] 전압 정상화 시 Warning 자동 해제',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0x2605,
                    label: '[Phase 1] DC Link 전압 [0x2605] 초기값', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — Warning 조건 유발]\n' +
                             '가변 전원공급기로 DC Bus 전압을 과전압 Warning 임계치(Fault 0x41 임계치보다 낮은 구간)로 높이세요.\n' +
                             '드라이브가 운전을 유지하면서 Warning 코드(0x02)를 보고해야 합격입니다.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0x2605,
                    label: '[Phase 2] DC Link 전압 [0x2605] — Warning 구간 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Warning 0x02 플래그 Set 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD02D,
                    label: '[Phase 2] Actual Speed — 모터 운전 유지 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 15,
                    message: '[Phase 4 — 전압 정상화]\nDC Bus 전압을 정상 범위로 복구하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status [0xD011] — Warning 자동 해제 확인', softFail: true
                }
            ]
        },

        // ── 5-23. Warning 0x04 Motor over temperature ─────────────────────
        'prot-w04': {
            id: 'prot-w04',
            category: '보호동작',
            number: '5-23',
            title: 'Warning 0x04 — Motor over temperature',
            description: '모터 과온 경고 동작 검증 (운전 유지, 경고 코드만 발생)',
            purpose: '모터 온도가 Warning 임계치를 초과했을 때 Warning 상태가 발생하고 운전이 유지되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 열풍기',
            criteria: '[Phase 2] 모터 과온 Warning 발생 시 운전 유지 / Warning 0x04 비트 Set\n' +
                      '[Phase 4] 냉각 후 Warning 자동 해제',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 1] Motor Status [0xD011] 초기값', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 60,
                    message: '[Phase 2 — 모터 과온 유발]\n' +
                             '열풍기로 모터를 가열하거나 부하를 증가시켜 모터 온도를 Warning 임계치 이상으로 높이세요.\n' +
                             '드라이브가 운전을 유지하면서 Warning 코드(0x04)를 보고하는지 확인하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Warning 0x04 플래그 Set 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD02D,
                    label: '[Phase 2] Actual Speed — 모터 운전 유지 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 60,
                    message: '[Phase 4 — 냉각 및 복구]\n모터 온도가 내려가도록 냉각하세요.\nWarning이 별도 Reset 없이 자동 해제되는지 확인합니다.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status [0xD011] — Warning 자동 해제 확인', softFail: true
                }
            ]
        },

        // ── 5-24. Warning 0x08 IGBT Module over temperature ───────────────
        'prot-w08': {
            id: 'prot-w08',
            category: '보호동작',
            number: '5-24',
            title: 'Warning 0x08 — IGBT Module over temperature',
            description: 'IGBT 모듈 과온 경고 동작 검증 (운전 유지, 경고 코드만 발생)',
            purpose: 'IGBT 모듈 온도가 Warning 임계치를 초과했을 때 Warning 상태가 발생하고 운전이 유지되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 열풍기',
            criteria: '[Phase 2] IGBT 과온 Warning 발생 시 운전 유지 / Warning 0x08 비트 Set\n' +
                      '[Phase 4] 냉각 후 Warning 자동 해제',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0x260B,
                    label: '[Phase 1] IGBT 온도 [0x260B] 초기값', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 60,
                    message: '[Phase 2 — IGBT 가열]\n' +
                             '열풍기로 IGBT 모듈을 가열하여 Warning 임계치(사양서 확인)를 초과시키세요.\n' +
                             'Fault 0x11 임계치보다는 낮은 구간을 유지하면서 Warning 0x08을 발생시키세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0x260B,
                    label: '[Phase 2] IGBT 온도 [0x260B] — Warning 구간 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Warning 0x08 플래그 Set 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD02D,
                    label: '[Phase 2] Actual Speed — 모터 운전 유지 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 60,
                    message: '[Phase 4 — 냉각 및 복구]\nIGBT 모듈 온도가 내려가도록 냉각하세요.\nWarning 자동 해제를 확인합니다.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status [0xD011] — Warning 자동 해제 확인', softFail: true
                }
            ]
        },

        // ── 5-25. Warning 0x10 Drive over temperature ─────────────────────
        'prot-w10': {
            id: 'prot-w10',
            category: '보호동작',
            number: '5-25',
            title: 'Warning 0x10 — Drive (Control part) over temperature',
            description: '드라이브 제어부 과온 경고 동작 검증 (운전 유지, 경고 코드만 발생)',
            purpose: '드라이브 제어부 온도가 Warning 임계치를 초과했을 때 Warning 상태가 발생하고 운전이 유지되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 열풍기',
            criteria: '[Phase 2] 드라이브 제어부 과온 Warning 발생 시 운전 유지 / Warning 0x10 비트 Set\n' +
                      '[Phase 4] 냉각 후 Warning 자동 해제',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0x260A,
                    label: '[Phase 1] Board 온도 [0x260A] 초기값', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 60,
                    message: '[Phase 2 — 드라이브 제어부 가열]\n' +
                             '열풍기로 드라이브 제어부(Control PCB)를 가열하여 Warning 임계치를 초과시키세요.\n' +
                             'Fault 0x22/0x25 임계치보다는 낮은 구간을 유지하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0x260A,
                    label: '[Phase 2] Board 온도 [0x260A] — Warning 구간 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Warning 0x10 플래그 Set 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD02D,
                    label: '[Phase 2] Actual Speed — 모터 운전 유지 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 60,
                    message: '[Phase 4 — 냉각]\n드라이브를 냉각하세요.\nWarning 자동 해제를 확인합니다.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status [0xD011] — Warning 자동 해제 확인', softFail: true
                }
            ]
        },

        // ── 5-27. Warning 0x40 Torque Limit ───────────────────────────────
        'prot-w40': {
            id: 'prot-w40',
            category: '보호동작',
            number: '5-27',
            title: 'Warning 0x40 — Torque Limit',
            description: '토크 제한 경고 동작 검증 (운전 유지, 토크 제한 상태 표시)',
            purpose: '모터에 토크 제한값 이상의 부하가 인가되었을 때 Warning 상태가 발생하고 ' +
                     '드라이브가 토크를 제한하면서 운전을 유지하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 부하기',
            criteria: '[Phase 2] 토크 제한 조건 발생 시 Warning 0x40 비트 Set / 운전 유지(PWM 차단 없음)\n' +
                      '[Phase 4] 부하 감소 후 Warning 자동 해제',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_holding', slaveId: 1, address: 0xD13B,
                    label: '[Phase 1] Max Coil Current [0xD13B] 백업 (토크 제한값)', storeAs: 'torqueLimitBackup', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD001, value: 24000,
                    label: '[Phase 2] Setpoint = 600 RPM (정상 구동)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 2 — 토크 제한 유발]\n' +
                             '모터 샤프트에 부하를 가하여 토크 제한값에 도달하도록 하세요.\n' +
                             '(부하기 토크 인가 또는 기계적 부하 증가)\n' +
                             '또는 Max Coil Current [0xD13B]를 현재 구동 전류보다 낮게 설정하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — Warning 0x40 플래그 Set 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD02D,
                    label: '[Phase 2] Actual Speed — 모터 운전 유지 확인 (토크 제한 상태에서도 동작)', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 4 — 복구]\n외부 부하를 감소시키거나 제거하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD001, value: 0,
                    label: '[Phase 4] Setpoint = 0 (정지)', softFail: true
                },
                {
                    type: 'restore_holding', slaveId: 1, address: 0xD13B,
                    restoreFrom: 'torqueLimitBackup',
                    label: '[Phase 4] Max Coil Current [0xD13B] 원복', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status [0xD011] — Warning 해제 확인', softFail: true
                }
            ]
        },

        // ══════════════════════════════════════════════════════════════════
        //  ENCODER ERROR ITEMS  (5-28 ~ 5-29)
        // ══════════════════════════════════════════════════════════════════

        // ── 5-28. 엔코더 보정 에러 ────────────────────────────────────────
        'prot-enc-cal': {
            id: 'prot-enc-cal',
            category: '보호동작',
            number: '5-28',
            title: '엔코더 보정 에러 보호',
            description: '엔코더 보정값 이상 시 PWM 차단 및 알람 리셋 거부 로직 검증',
            purpose: '엔코더 보정(Calibration) 파라미터가 비정상이거나 보정 절차가 완료되지 않은 상태에서 드라이브가 ' +
                     'PWM 출력을 차단하는지, 원인 미제거 상태의 Alarm Reset 명령을 거부하는지, 보정 복구 후 정상 복귀하는지 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '[Phase 2] 보정 이상 감지 즉시 PWM 차단(기동 금지) / 엔코더 보정 에러 코드 확인\n' +
                      '[Phase 3] 보정 불량 상태 유지 중 Alarm Reset 거부\n' +
                      '[Phase 4] 보정 정상 복구 후 Alarm Reset 처리 및 정상 기동',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 1] Motor Status [0xD011] 초기값 확인 (정상: 0x0000)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 1] 에러 코드 [0xD010] 초기값 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 30,
                    message: '[Phase 2 — 엔코더 보정 오류 유발]\n' +
                             '아래 방법 중 하나를 선택하세요:\n' +
                             '① 엔코더 보정 파라미터(Offset/Gain/Zero position)를 허용 범위 밖 값으로 변경\n' +
                             '② 보정 절차 수행 중 전원 차단으로 보정 완료 상태를 비정상으로 만들기\n' +
                             '드라이브 전원 재투입 또는 Run 지령 인가 후 보정 이상이 감지되는지 확인하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — 엔코더 보정 에러 검출 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 엔코더 보정 에러 코드 확인', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (보정 불량 상태 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 3] 에러 코드 — 여전히 존재 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 30,
                    message: '[Phase 4 — 복구]\n' +
                             '① 비정상 보정값을 정상값으로 복구하거나 엔코더 보정 절차를 다시 수행하세요.\n' +
                             '② 통신으로 Alarm Reset 명령을 전송하거나 전원을 재투입하세요.\n' +
                             '③ Run 지령을 인가하여 모터가 정상 기동되는지 확인하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (보정 복구 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인 (0x0000 기대)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 4] 에러 코드 — 해제 확인 (0x0000 기대)', softFail: true
                }
            ]
        },

        // ── 5-29. 엔코더 신호 이상 보호 ──────────────────────────────────
        'prot-enc-sig': {
            id: 'prot-enc-sig',
            category: '보호동작',
            number: '5-29',
            title: '엔코더 신호 이상 보호',
            description: '엔코더 신호 단선/소실 시 PWM 차단 및 알람 리셋 거부 로직 검증',
            purpose: '엔코더 신호(SIN/COS, A/B/Z)에 단선, 노이즈, 신호 유실 등의 이상이 발생했을 때 드라이브가 ' +
                     'PWM 출력을 차단하는지, 원인 미제거 상태의 Alarm Reset 명령을 거부하는지, 신호 복구 후 정상 복귀하는지 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '[Phase 2] 신호 이상 감지 즉시 PWM 차단 / 엔코더 신호 이상 에러 코드 확인\n' +
                      '[Phase 3] 신호 이상 유지 중 Alarm Reset 거부\n' +
                      '[Phase 4] 신호 복구 후 Alarm Reset 처리 및 정상 구동 재개',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 1] Motor Status [0xD011] 초기값 확인 (정상: 0x0000)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 1] 에러 코드 [0xD010] 초기값 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 30,
                    message: '[Phase 2 — 엔코더 신호 이상 유발]\n' +
                             '모터 구동 중 아래 방법 중 하나를 선택하세요:\n' +
                             '① 엔코더 신호선(SIN/COS 또는 A/B/Z) 중 하나를 일시 단선\n' +
                             '② 엔코더 전원선을 일시 차단\n' +
                             '③ 신호선에 외부 노이즈 주입\n' +
                             '드라이브가 즉시 PWM을 차단하는지 확인하세요.'
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 2] Motor Status [0xD011] — 엔코더 신호 이상 에러 검출 확인', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 2] 에러 코드 [0xD010] — 엔코더 관련 에러 코드 확인', softFail: true
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 3] 알람 리셋 (신호 이상 유지 중 — 거부 확인)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 3] Motor Status — 알람 유지 확인 (거부 PASS)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 3] 에러 코드 — 여전히 존재 확인', softFail: true
                },
                {
                    type: 'wait_countdown', seconds: 20,
                    message: '[Phase 4 — 복구]\n엔코더 신호선을 정상 연결 상태로 복구하세요.'
                },
                {
                    type: 'write_holding', slaveId: 1, address: 0xD000, value: 0x0002,
                    label: '[Phase 4] 알람 리셋 (신호 복구 후)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD011,
                    label: '[Phase 4] Motor Status — 정상 복귀 확인 (0x0000 기대)', softFail: true
                },
                {
                    type: 'read_input', slaveId: 1, address: 0xD010,
                    label: '[Phase 4] 에러 코드 — 해제 확인 (0x0000 기대)', softFail: true
                }
            ]
        }

    }, // end tests

    executors: {}

}); // end push
