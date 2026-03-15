/**
 * OS Test Module - 구동동작
 * 4-1-1. PWM 입력
 * 4-1-2. Analog V 입력
 * 4-1-3. Analog I 입력
 * 4-1-4. RS485 입력
 * 4-2.   FG / PPR 설정
 * 4-3.   구동 모드 설정 (Operation mode)
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
            purpose: 'Set Value Source를 PWM 입력으로 설정 시 PWM 신호에 의해 팬 모터가 정상 구동되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, PWM 발생기 (CN303 7번 핀)',
            criteria: 'PWM 듀티비에 비례하여 팬 모터 속도/토크가 정상 제어됨',
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
            purpose: 'Set Value Source를 Analog 전압 입력으로 설정 시 아날로그 전압 신호에 의해 팬 모터가 정상 구동되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, DC 전압원 (CN303 6번~4번 핀)',
            criteria: '아날로그 입력 전압에 비례하여 팬 모터 속도/토크가 정상 제어됨',
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
            purpose: 'Set Value Source를 Analog 전류 입력으로 설정 시 아날로그 전류 신호에 의해 팬 모터가 정상 구동되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, DC 전류원 (CN303 5번~4번 핀)',
            criteria: '아날로그 입력 전류에 비례하여 팬 모터 속도/토크가 정상 제어됨 / 4mA: 최소 출력(0%), 20mA: 최대 출력(100%)에 해당',
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
            purpose: 'Set Value Source를 RS485 통신으로 설정 시 Modbus 명령에 의해 팬 모터 속도/토크가 정상 제어되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'RS485 Set Point 명령에 비례하여 팬 모터 속도/토크가 정상 제어됨 / Actual Speed 파라미터가 명령값에 정상 추종',
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
            purpose: 'FG(Frequency Generator) PPR(Pulse Per Revolution) 설정에 따라 속도 피드백 신호가 정상적으로 동작하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (구동 중), USB to RS485 Converter, 주파수 카운터 or 오실로스코프',
            criteria: '각 PPR 설정값에 따라 FG 출력 펄스 주파수가 정확히 해당 배율로 출력됨 / Actual Speed 파라미터가 PPR 변경과 무관하게 실제 속도를 정확히 반영',
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
            title: '구동 모드 설정 (Operation mode)',
            description: 'Open-loop / Closed-loop Velocity 모드 전환 검증',
            purpose: 'Operating Mode 파라미터 설정에 따라 토크 제어(Open-loop) 및 속도 제어(Closed-loop Velocity) 모드가 정상 동작하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'Operating Mode = 0x0002: Open-loop 토크 제어 정상 동작 (Command Torque 추종 확인) / Operating Mode = 0x0000: Closed-loop 속도 제어 정상 동작 (Actual Speed 추종 확인)',
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
            purpose: 'Set Point [0xD001] 파라미터를 통해 다양한 지령값을 설정하고 드라이브가 해당 값에 정상 추종하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1, Speed Control 모드), USB to RS485 Converter',
            criteria: 'Set Point 값에 따라 토크/속도가 정상 비례하여 제어됨 / Command Torque / Actual Speed 파라미터가 기대값에 일치 또는 추종',
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
            purpose: 'Open-loop Control 모드를 이용해 팬 모터 운전이 가능한지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: '0xD050 (Command Torque) 파라미터의 값 10 확인 (Torque Command 약 10% 출력 확인)',
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
            purpose: 'Closed loop velocity control 모드를 이용해 팬 모터 운전이 가능한지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: '0xD051 (Command Velocity) 파라미터의 값 100 확인 (Velocity Command 100rpm 출력 확인) / 0xD02D (Actual Speed)가 100rpm에 추종',
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
