/**
 * OS Test Module - 구동동작
 * 4-1-1. PWM 입력
 * 4-1-2. Analog V 입력
 * 4-1-3. Analog I 입력
 * 4-1-4. RS485 입력
 * 4-2.   FG / PPR 설정
 * 4-3.   구동 모드 설정 (Torque / Velocity)
 * 4-4.   Set Value
 * 4-5.   Open-loop Control
 * 4-6.   Closed-loop Velocity Control
 */

window.OSTestModules = window.OSTestModules || [];

window.OSTestModules.push({

    tests: {

        // ── 4-1-1. PWM 입력 ───────────────────────────────────────────────────
        'drive-pwm': {
            id: 'drive-pwm',
            category: '구동동작',
            number: '4-1-1',
            title: 'Set Value Source — PWM 입력',
            description: 'PWM 신호로 Setpoint 설정 검증',
            purpose: 'Set Value Source를 PWM으로 설정한 후 외부 PWM 신호 입력에 따라 ' +
                     '드라이브 Setpoint가 변경되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, PWM 발생기 (CN303 7번 핀)',
            criteria: 'PWM Duty에 비례한 Setpoint 값 변경 확인 (예: 80% Duty → 정격속도 80%)',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD106,
                    label: '현재 Operating Mode [0xD106] 백업',
                    storeAs: 'opModeBackup',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD106,
                    value: 0,
                    label: 'Operating Mode [0xD106] = 0 (Speed Control)',
                    verifyAfterWrite: true, expectAfterWrite: 0
                },
                {
                    // Procedure: Set Value Source = PWM (address/value 펌웨어 확인 필요)
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0x2701,
                    value: 3,
                    label: 'Set Value Source = PWM — Procedure Argument [0x2701] = 3',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0x2700,
                    value: 0x3000,
                    label: 'Procedure Command Code [0x2700] = 0x3000 (Set Source 설정)',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 3,
                    message: 'CN303 7번 핀에 100kHz, 80% Duty PWM 신호 인가 — FG OUT 주파수 확인'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: '현재 Actual Speed [0xD02D] 읽기 — PWM 입력에 따른 속도 변화 확인',
                    storeAs: 'actualSpeed_pwm',
                    softFail: true
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD106,
                    from: 'opModeBackup',
                    label: 'Operating Mode 복원 [0xD106]'
                }
            ]
        },

        // ── 4-1-2. Analog V 입력 ─────────────────────────────────────────────
        'drive-analog-v': {
            id: 'drive-analog-v',
            category: '구동동작',
            number: '4-1-2',
            title: 'Set Value Source — Analog V 입력',
            description: 'Analog 전압으로 Setpoint 설정 검증',
            purpose: 'Set Value Source를 Analog Voltage로 설정한 후 외부 전압 입력에 따라 ' +
                     '드라이브 Setpoint가 변경되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, DC 전압원 (CN303 6번~4번 핀)',
            criteria: '4V 입력 시 정격속도 40% 해당 FG OUT 주파수 출력 확인 (±3%)',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0x2701,
                    value: 1,
                    label: 'Set Value Source = Analog V — Procedure Argument [0x2701] = 1',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0x2700,
                    value: 0x3000,
                    label: 'Procedure Command Code [0x2700] = 0x3000',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 3,
                    message: 'CN303 6번 핀에 4V 입력 — FG OUT (CN303 3번~4번) 주파수 측정\n' +
                             '정격속도 기준 40% ±3% 확인'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] 읽기 — Analog V 입력에 따른 속도 확인',
                    storeAs: 'actualSpeed_analogv',
                    softFail: true
                }
            ]
        },

        // ── 4-1-3. Analog I 입력 ─────────────────────────────────────────────
        'drive-analog-i': {
            id: 'drive-analog-i',
            category: '구동동작',
            number: '4-1-3',
            title: 'Set Value Source — Analog I 입력',
            description: 'Analog 전류로 Setpoint 설정 검증',
            purpose: 'Set Value Source를 Analog Current로 설정한 후 외부 전류 입력에 따라 ' +
                     '드라이브 Setpoint가 변경되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, DC 전류원 (CN303 5번~4번 핀)',
            criteria: '12mA 입력 시 정격속도 60% 해당 FG OUT 주파수 출력 확인 (±3%)',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0x2701,
                    value: 2,
                    label: 'Set Value Source = Analog I — Procedure Argument [0x2701] = 2',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0x2700,
                    value: 0x3000,
                    label: 'Procedure Command Code [0x2700] = 0x3000',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 3,
                    message: 'CN303 5번 핀에 12mA 입력 — FG OUT 주파수 측정\n' +
                             '정격속도 기준 60% ±3% 확인'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] 읽기',
                    storeAs: 'actualSpeed_analogi',
                    softFail: true
                }
            ]
        },

        // ── 4-1-4. RS485 입력 ─────────────────────────────────────────────────
        'drive-rs485-input': {
            id: 'drive-rs485-input',
            category: '구동동작',
            number: '4-1-4',
            title: 'Set Value Source — RS485 입력',
            description: 'RS485 통신으로 Setpoint 설정 검증',
            purpose: 'RS485 통신을 통한 Setpoint 직접 제어가 동작하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'Setpoint 쓰기 후 모터 속도 변화 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: '현재 Setpoint [0xD001] 읽기 (백업)',
                    storeAs: 'setpointBackup',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 16000,
                    label: 'Setpoint [0xD001] = 16000 (Speed Control 25% 속도) 쓰기',
                    verifyAfterWrite: true,
                    expectAfterWrite: 16000
                },
                {
                    type: 'wait_countdown',
                    seconds: 3,
                    message: '모터 구동 확인 — 속도 변화 육안 또는 FG 신호 확인'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] 읽기',
                    storeAs: 'actualSpeed_rs485',
                    softFail: true
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD001,
                    from: 'setpointBackup',
                    label: 'Setpoint 원래 값 복원 [0xD001]'
                }
            ]
        },

        // ── 4-2. FG / PPR 설정 ────────────────────────────────────────────────
        'drive-fg': {
            id: 'drive-fg',
            category: '구동동작',
            number: '4-2',
            title: 'FG / PPR 설정 (1, 2, 4, 8)',
            description: 'FG 출력 및 PPR 파라미터 설정 검증',
            purpose: 'PPR(Pulse Per Revolution) 값을 1/2/4/8로 변경했을 때 FG OUT 주파수가 ' +
                     '설정값에 비례하여 변경되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (구동 중), USB to RS485 Converter, 주파수 카운터 or 오실로스코프',
            criteria: 'PPR 2배 증가 시 FG OUT 주파수 2배 증가 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인 (모터 구동 중)' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0x2616,
                    label: '현재 FG PPR [0x2616] 읽기 (백업)\n' +
                           '※ 레지스터 주소는 파라미터 맵 확인 필요',
                    storeAs: 'pprBackup',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0x2616,
                    value: 1,
                    label: 'PPR = 1 설정 — FG OUT 주파수 기준값 측정',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 2,
                    message: 'PPR=1 기준 FG OUT 주파수 측정 후 기록'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0x2616,
                    value: 4,
                    label: 'PPR = 4 설정 — FG OUT 주파수 4배 증가 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 2,
                    message: 'PPR=4 FG OUT 주파수 측정 — PPR=1 대비 4배 증가 확인'
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0x2616,
                    from: 'pprBackup',
                    label: 'PPR 원래 값 복원 [0x2616]'
                }
            ]
        },

        // ── 4-3. 구동 모드 설정 ───────────────────────────────────────────────
        'drive-mode': {
            id: 'drive-mode',
            category: '구동동작',
            number: '4-3',
            title: '구동 모드 설정 (Torque / Velocity)',
            description: 'Operating Mode 파라미터 설정 및 적용 검증',
            purpose: 'Operating Mode를 Torque 모드와 Velocity 모드로 각각 설정하고 ' +
                     '드라이브가 해당 모드로 동작하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'Operating Mode [0xD106] Write 후 값 반영 확인 및 구동 모드 전환 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD106,
                    label: '현재 Operating Mode [0xD106] 읽기 (백업)',
                    storeAs: 'opModeBackup'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD106,
                    value: 0,
                    label: '[0xD106] = 0 (Speed Control / Velocity) 설정',
                    verifyAfterWrite: true,
                    expectAfterWrite: 0
                },
                {
                    type: 'wait_countdown',
                    seconds: 2,
                    message: 'Velocity 모드 구동 확인'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD106,
                    value: 2,
                    label: '[0xD106] = 2 (Open-loop / Torque) 설정',
                    verifyAfterWrite: true,
                    expectAfterWrite: 2
                },
                {
                    type: 'wait_countdown',
                    seconds: 2,
                    message: 'Torque(Open-loop) 모드 구동 확인'
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD106,
                    from: 'opModeBackup',
                    label: 'Operating Mode 원래 값 복원 [0xD106]'
                }
            ]
        },

        // ── 4-4. Set Value ────────────────────────────────────────────────────
        'drive-setval': {
            id: 'drive-setval',
            category: '구동동작',
            number: '4-4',
            title: 'Set Value (Setpoint 입력 및 속도 확인)',
            description: 'Setpoint 쓰기 후 실제 속도 응답 검증',
            purpose: 'RS485를 통해 다양한 Setpoint 값을 쓰고 실제 모터 속도(Actual Speed)가 ' +
                     '비례하여 변경되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1, Speed Control 모드), USB to RS485 Converter',
            criteria: '각 Setpoint 단계별 Actual Speed 변화 확인 (16000 → 32000 → 48000 단계)',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인 (Speed Control 모드)' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: '현재 Setpoint [0xD001] 읽기 (백업)',
                    storeAs: 'spBackup',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 16000,
                    label: 'Setpoint = 16000 (약 400 RPM @ 1600 RPM 기준)'
                },
                {
                    type: 'wait_countdown',
                    seconds: 2,
                    message: '속도 안정화 대기'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] 읽기 — Setpoint 16000 기준',
                    storeAs: 'speed1',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 32000,
                    label: 'Setpoint = 32000 (약 800 RPM)'
                },
                {
                    type: 'wait_countdown',
                    seconds: 2,
                    message: '속도 안정화 대기'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] 읽기 — Setpoint 32000 기준',
                    storeAs: 'speed2',
                    softFail: true
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD001,
                    from: 'spBackup',
                    label: 'Setpoint 원래 값 복원 [0xD001]'
                }
            ]
        },

        // ── 4-5. Open-loop Control ────────────────────────────────────────────
        'drive-openloop': {
            id: 'drive-openloop',
            category: '구동동작',
            number: '4-5',
            title: 'Open-loop Control',
            description: '개방형 제어 모드 구동 검증',
            purpose: 'Operating Mode를 Open-loop(Torque)로 설정하고 Setpoint에 따라 ' +
                     '모터가 개방형 제어 모드로 구동되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'Open-loop 모드에서 Setpoint 변경에 따른 출력 전압 변화 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD106,
                    label: '현재 Operating Mode [0xD106] 백업',
                    storeAs: 'opModeBackup'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD106,
                    value: 2,
                    label: '[0xD106] = 2 (Open-loop 모드) 설정',
                    verifyAfterWrite: true,
                    expectAfterWrite: 2
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 32768,
                    label: 'Open-loop Setpoint [0xD001] = 32768 (50% 출력 전압)'
                },
                {
                    type: 'wait_countdown',
                    seconds: 3,
                    message: 'Open-loop 구동 확인 — 모터 회전 및 출력 전압 확인'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] 읽기',
                    storeAs: 'openloop_speed',
                    softFail: true
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD106,
                    from: 'opModeBackup',
                    label: 'Operating Mode 복원 [0xD106]'
                }
            ]
        },

        // ── 4-6. Closed-loop Velocity Control ────────────────────────────────
        'drive-closedloop': {
            id: 'drive-closedloop',
            category: '구동동작',
            number: '4-6',
            title: 'Closed-loop Velocity Control',
            description: '폐루프 속도 제어 모드 구동 검증',
            purpose: 'Speed Control 모드(Closed-loop)에서 Setpoint에 따라 ' +
                     '실제 모터 속도(Actual Speed)가 목표값을 추종하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'Setpoint 기반 목표속도와 Actual Speed [0xD02D] 편차 ±5% 이내',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD106,
                    label: '현재 Operating Mode [0xD106] 백업',
                    storeAs: 'opModeBackup'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD106,
                    value: 0,
                    label: '[0xD106] = 0 (Speed Control / Closed-loop) 설정',
                    verifyAfterWrite: true,
                    expectAfterWrite: 0
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 40000,
                    label: 'Setpoint [0xD001] = 40000 (약 1000 RPM @ 1600 RPM 기준)'
                },
                {
                    type: 'wait_countdown',
                    seconds: 3,
                    message: '속도 안정화 대기 (3초)'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] 읽기 — 목표속도 추종 여부 확인',
                    storeAs: 'closedloop_speed',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 0,
                    label: 'Setpoint = 0 (정지)'
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD106,
                    from: 'opModeBackup',
                    label: 'Operating Mode 복원 [0xD106]'
                }
            ]
        }

    }

});
