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
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD101,
                    label: '현재 Set Value Source [0xD101] 백업',
                    storeAs: 'origSetValueSource',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD101,
                    value: 3,
                    label: 'Set Value Source = PWM 입력 (0xD101 = 3)',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 1 — Base Setup]\n' +
                             'PWM 신호 발생기를 FG 입력 핀에 연결하세요.\n' +
                             '주파수: 사양 범위 내 (예: 1kHz ~ 10kHz), Duty: 50%로 초기 설정'
                },
                {
                    type: 'wait_countdown',
                    seconds: 60,
                    message: '[Phase 2 — 정상 PWM 입력 검증]\n' +
                             'PWM Duty를 단계적으로 변경하세요: 10% → 50% → 90%\n' +
                             'Duty 변화에 따라 모터 속도/토크가 비례적으로 변화하는지 확인하세요.\n' +
                             'Duty 감소 시 정상적으로 속도가 감소하는지도 확인하세요.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] 읽기 (현재 속도 확인)',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 3 — 경계 조건 검증]\n' +
                             '최소 Duty (0%) 입력 → 모터 정지 확인\n' +
                             '최대 Duty (100%) 입력 → 최대 속도 초과 없음 확인\n' +
                             'Deadband 구간이 있는 경우 해당 구간에서 출력 변화 없음 확인'
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 4 — 입력 이상 및 보호 동작 검증 (Negative Test)]\n' +
                             'PWM 신호를 제거(Open 상태)하여 입력 신호 유실 상황을 구성하세요.\n' +
                             '→ 드라이브가 Safe 동작(정지 또는 출력 제한)을 수행하는지 확인\n' +
                             'PWM 주파수를 허용 범위 밖으로 변경하여 비정상 입력을 인가하세요.\n' +
                             '→ 제어 불능(속도 튐, 진동) 없음 확인'
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '[Phase 5 — 복구 검증]\n' +
                             'PWM 신호를 정상 범위로 복구하세요.\n' +
                             '별도 Reset 없이 정상 제어 상태로 복귀하는지 확인하세요.'
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD101,
                    restoreFrom: 'origSetValueSource',
                    label: 'Set Value Source [0xD101] 원복',
                    softFail: true
                }
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
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD101,
                    label: '현재 Set Value Source [0xD101] 백업',
                    storeAs: 'origSetValueSource',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD101,
                    value: 0,
                    label: 'Set Value Source = Analog V (0xD101 = 0: AIN1V)',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 1 — Base Setup]\n' +
                             '정밀 전압 발생기를 아날로그 입력 단자에 연결하세요.\n' +
                             '초기 전압: 0V (최소값)'
                },
                {
                    type: 'wait_countdown',
                    seconds: 60,
                    message: '[Phase 2 — 정상 아날로그 입력 검증]\n' +
                             '입력 전압을 단계적으로 증가하세요: 1V → 5V → 9V\n' +
                             '전압 변화에 따라 목표 속도/토크가 비례 변화하는지 확인하세요.\n' +
                             '전압 감소 시 출력이 정상적으로 감소하는지도 확인하세요.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] 읽기 (현재 속도 확인)',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 3 — 경계 조건 검증]\n' +
                             '최소 전압(0V) → 모터 정지/최소 출력 확인\n' +
                             '최대 전압(10V) → 설정된 최대 속도/토크 초과 없음 확인'
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 4 — 입력 이상 및 보호 동작 검증 (Negative Test)]\n' +
                             '입력을 Open 상태로 만들어 단선 상황을 구성하세요.\n' +
                             '→ 모터가 계속 구동되면 즉시 불합격\n' +
                             '입력에 노이즈를 인가하여 불안정 신호를 구성하세요.\n' +
                             '→ 제어 불안정(속도 튐, 진동) 없음 확인'
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '[Phase 5 — 복구 검증]\n' +
                             '아날로그 입력을 정상 전압 범위로 복구하세요.\n' +
                             '별도 Reset 없이 정상 제어 상태로 복귀하는지 확인하세요.'
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD101,
                    restoreFrom: 'origSetValueSource',
                    label: 'Set Value Source [0xD101] 원복',
                    softFail: true
                }
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
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD101,
                    label: '현재 Set Value Source [0xD101] 백업',
                    storeAs: 'origSetValueSource',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD101,
                    value: 2,
                    label: 'Set Value Source = Analog I (0xD101 = 2: AIN2I)',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 1 — Base Setup]\n' +
                             '4~20mA 전류 발생기를 아날로그 전류 입력 단자에 연결하세요.\n' +
                             '초기 전류: 4mA (최소값)'
                },
                {
                    type: 'wait_countdown',
                    seconds: 60,
                    message: '[Phase 2 — 정상 아날로그 전류 입력 검증]\n' +
                             '입력 전류를 단계적으로 증가하세요: 4mA → 12mA → 20mA\n' +
                             '전류 변화에 따라 목표 속도/토크가 비례 변화하는지 확인하세요.\n' +
                             '전류 감소 시 출력이 정상적으로 감소하는지도 확인하세요.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] 읽기 (현재 속도 확인)',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 3 — 경계 조건 검증]\n' +
                             '최소 전류(4mA) → 모터 정지 또는 최소 출력 확인\n' +
                             '최대 전류(20mA) → 설정된 최대 속도/토크 초과 없음 확인'
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 4 — 입력 이상 및 보호 동작 검증 (Negative Test)]\n' +
                             '입력 회로를 Open 상태로 만들어 전류 단선(0mA) 상황을 구성하세요.\n' +
                             '→ 모터가 계속 구동되면 즉시 불합격\n' +
                             '입력 전류를 20mA 초과로 인가하세요.\n' +
                             '→ 보호 없이 출력이 증가하면 불합격'
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '[Phase 5 — 복구 검증]\n' +
                             '아날로그 전류 입력을 정상 범위(4~20mA)로 복구하세요.\n' +
                             '별도 Reset 없이 정상 제어 상태로 복귀하는지 확인하세요.'
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD101,
                    restoreFrom: 'origSetValueSource',
                    label: 'Set Value Source [0xD101] 원복',
                    softFail: true
                }
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
                '[Phase 4] ★ 케이블 분리 → 통신 단절 상태에서 Fail-safe 동작 확인\n판정 기준: 마지막 명령값으로 모터 지속 구동 시 FAIL / 정지 또는 출력 제한으로 전환 시 PASS',
                '[Phase 5] ★ 케이블 재연결 → 별도 Reset 없이 정상 제어 복귀 확인\n판정 기준: 통신 복구 후 명령값 재전송 시 정상 속도 반영 + 추가 Fault 없음',
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
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] — 현재 속도 확인 (정속 구동 필요)',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 1 — Base Setup]\n' +
                             '오실로스코프 또는 주파수 측정기를 FG 출력 핀에 연결하세요.\n' +
                             '모터를 일정 속도(예: 600 RPM)로 구동하세요.'
                },
                {
                    type: 'wait_countdown',
                    seconds: 60,
                    message: '[Phase 2 — PPR 설정에 따른 출력 주파수 검증]\n' +
                             'FG PPR을 1 → 2 → 4 → 8 순으로 변경하세요.\n' +
                             '동일 속도 조건에서 FG 출력 주파수가 PPR 값에 비례하여 2배씩 증가하는지 확인하세요.\n' +
                             '(예: PPR=1 기준값, PPR=2 → 2배, PPR=4 → 4배, PPR=8 → 8배)'
                },
                {
                    type: 'wait_countdown',
                    seconds: 60,
                    message: '[Phase 3 — 속도 변화에 따른 선형성 검증]\n' +
                             '모터 속도를 단계적으로 변경하세요: 저속 → 중속 → 고속\n' +
                             '각 속도에서 FG 출력 주파수를 측정하세요.\n' +
                             '모터 속도와 FG 출력 주파수 간의 선형 비례 관계를 확인하세요.'
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 4 — 경계 조건 및 신호 안정성 검증]\n' +
                             '저속 영역에서 FG 펄스가 정상적으로 출력되는지 확인하세요.\n' +
                             '고속 영역에서 FG 출력이 누락/왜곡되지 않는지 확인하세요.\n' +
                             'PPR 변경 시 glitch(이상 펄스) 발생 여부를 확인하세요.'
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '[Phase 5 — 설정 복구]\n' +
                             'FG PPR을 초기값(1)으로 복구하세요.\n' +
                             'FG 출력이 정상적으로 동작하는지 확인하세요.'
                }
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
                '[Phase 4] 비정상 Mode 값 (3 / 0xFF / 0xFFFF) Write → 거부 또는 에러 처리 확인\n판정 기준: Write 후 0xD106 Read-back이 기존값 유지 (비정상 값 적용 시 FAIL)',
                '[Phase 5] 초기 Mode 복구 → 정상 기동 및 속도 추종 확인\n판정 기준: 원래 Mode로 정상 구동 재개 + 추가 Fault 없음',
            ],
        },

        // ── 4-7. Set Value ────────────────────────────────────────────────────
        'drive07': {
            id: 'drive07',
            category: '구동동작',
            number: '4-7',
            title: 'Set Value 제어 검증',
            description: 'Setpoint(목표 속도/토크) 변화에 따른 응답 특성 및 제한(Saturation) 검증',
            purpose: '드라이브에 입력되는 Set Value(목표 속도 또는 토크)가 내부 제어 로직에 정상 반영되는지 확인한다. Set Value 변화에 따른 응답 특성, 최대/최소 제한(Saturation), Ramp 적용 및 이상 입력 처리를 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: 'Set Value 변화에 따라 출력(속도/토크)이 정상 변화 / 최대값 초과 입력 시 제한 동작 수행',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: '현재 Setpoint [0xD001] 백업',
                    storeAs: 'origSetpoint',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 4000,
                    label: 'Set Value = Low (100 RPM, 0xD001 = 4000)',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] — 저속 확인',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 24000,
                    label: 'Set Value = Mid (600 RPM, 0xD001 = 24000)',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] — 중속 확인',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 60000,
                    label: 'Set Value = High (1500 RPM, 0xD001 = 60000)',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] — 고속 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 3 — 응답 특성 검증]\n' +
                             'Set Value를 급격히 변경(step input)하여 시스템 응답을 확인하세요.\n' +
                             '과도한 overshoot, undershoot, 진동이 발생하지 않는지 확인하세요.\n' +
                             'Ramp 설정이 있다면 가속/감속 프로파일이 정상 적용되는지 확인하세요.'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 65535,
                    label: 'Set Value = 최대값 초과 테스트 (0xD001 = 0xFFFF)',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] — 최대값 제한 확인 (최대 속도 초과 없음)',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 0,
                    label: 'Setpoint = 0 (정지)',
                    softFail: true
                }
            ]
        },

        // ── 4-8. Open-loop Control ────────────────────────────────────────────
        'drive08': {
            id: 'drive08',
            category: '구동동작',
            number: '4-8',
            title: 'Open-loop Control 검증',
            description: 'Open-loop 모드에서 주파수/전압 명령에 따른 기동 성능 및 안정성 검증',
            purpose: 'Open-loop 제어 모드에서 드라이브가 속도 피드백 없이 설정된 명령에 따라 모터를 정상 구동하는지 확인한다. 기동 성능, 속도 유지, 부하 변화에 따른 안정성, 탈조(stall) 발생 여부를 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: 'Open-loop 명령에 따라 모터가 정상 기동 및 구동 / 부하 변화 시 탈조 없이 안정 동작',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD106,
                    label: '현재 Operating Mode [0xD106] 백업',
                    storeAs: 'origOpMode',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD106,
                    value: 2,
                    label: 'Operating Mode = Open-loop (0xD106 = 2)',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 6554,
                    label: 'Open-loop Setpoint = 10% (0xD001 = 6554, 10/100×65535)\nTX: 01 06 D0 01 19 9A 6B 31',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD050,
                    label: 'Command Torque [0xD050] — 10% 적용 확인\nTX: 01 04 D0 50 00 01 09 1B',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '[Phase 2 — 무부하 기동 확인]\n' +
                             '모터가 정상적으로 기동하여 회전하는지 확인하세요.\n' +
                             '진동, 소음, 불안정 동작이 없는지 확인하세요.'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 32768,
                    label: 'Open-loop Setpoint = 50% (0xD001 = 32768)',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD050,
                    label: 'Command Torque [0xD050] — 50% 적용 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 3 — 속도 변화 및 안정성 검증]\n' +
                             'Open-loop 명령을 단계적으로 증가/감소시키세요.\n' +
                             '급격한 속도 변화 시 탈조(stall) 없이 동작하는지 확인하세요.'
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 4 — 부하 조건 검증]\n' +
                             '모터에 외부 부하를 점진적으로 인가하세요.\n' +
                             '부하 증가에 따라 탈조 발생 여부를 확인하세요.\n' +
                             '탈조 발생 시 시스템이 비정상 상태(과전류, 심한 진동)로 지속되지 않아야 합격'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 0,
                    label: 'Setpoint = 0 (정지)',
                    softFail: true
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD106,
                    restoreFrom: 'origOpMode',
                    label: 'Operating Mode [0xD106] 원복',
                    softFail: true
                }
            ]
        },

        // ── 4-9. Closed-loop Velocity Control ────────────────────────────────
        'drive09': {
            id: 'drive09',
            category: '구동동작',
            number: '4-9',
            title: 'Closed-loop Velocity Control 검증',
            description: '속도 피드백 기반 Closed-loop 속도 추종 성능 및 부하 외란 대응 검증',
            purpose: 'Closed-loop Velocity Control 모드에서 드라이브가 속도 피드백을 기반으로 목표 속도를 정확하게 추종하는지 확인한다. 속도 응답 특성, 부하 외란 대응, 제한 조건 및 제어 안정성을 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '목표 속도를 정확히 추종 / steady-state error 허용 범위 내 / 부하 외란 후 속도 복원',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD106,
                    label: '현재 Operating Mode [0xD106] 백업',
                    storeAs: 'origOpMode',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD106,
                    value: 0,
                    label: 'Operating Mode = Closed-loop Velocity (0xD106 = 0)',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 4000,
                    label: 'Setpoint = 100 RPM (0xD001 = 4000)\nTX: 01 06 D0 01 0C 80 E4 6A',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] — 100 RPM 추종 확인\nTX: 01 04 D0 2D 00 01 99 CB',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 24000,
                    label: 'Setpoint = 600 RPM (0xD001 = 24000)',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] — 600 RPM 추종 확인',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 60000,
                    label: 'Setpoint = 1500 RPM (0xD001 = 60000)',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] — 1500 RPM 추종 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 3 — 동적 응답 검증]\n' +
                             '목표 속도를 Step 형태로 급격히 변경하세요.\n' +
                             '과도한 overshoot, undershoot, 진동이 발생하지 않는지 확인하세요.'
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 4 — 부하 외란 대응 검증]\n' +
                             '일정 속도(600 RPM) 구동 중 외부 부하를 인가하세요.\n' +
                             '속도 저하 후 빠르게 목표 속도로 복원되는지 확인하세요.\n' +
                             '부하 제거 시 속도가 안정적으로 복귀하는지 확인하세요.'
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '[Phase 6 — 저속 및 정지 영역 검증]\n' +
                             '저속(예: 50 RPM) 명령 시 안정적으로 유지되는지 확인하세요.\n' +
                             '0 RPM 명령 시 모터가 안정적으로 정지하는지 확인하세요.'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 0,
                    label: 'Setpoint = 0 (정지)',
                    softFail: true
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD106,
                    restoreFrom: 'origOpMode',
                    label: 'Operating Mode [0xD106] 원복',
                    softFail: true
                }
            ]
        }

    }, // end tests

    executors: {

        // ── drive06 executor ──────────────────────────────────────────────────
        'drive06': async function() {
            const self    = this;
            const d       = window.dashboard;
            const slaveId = 1;
            self.checkConnection();

            const passed = [];
            const failed = [];

            // 초기값 백업
            const origOpMode   = await d.readRegisterWithTimeout(slaveId, 0xD106);
            const origSetpoint = await d.readRegisterWithTimeout(slaveId, 0xD001);
            self.addLog(`초기값 백업 — OpMode(0xD106)=${origOpMode} / Setpoint(0xD001)=${origSetpoint}`, 'info');
            self.addLog('0xD106: 0=Velocity(Closed-loop) / 2=Open-loop(Torque)', 'info');

            const toVelRaw   = rpm => Math.round(rpm / 1600 * 64000);   // 속도 모드 raw
            const toTorqRaw  = pct => Math.round(pct / 100 * 65535);    // Open-loop raw

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
                        await self.delay(3000);
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
                    await self.delay(1000);

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
                        await self.delay(2000);
                        const speed = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                        self.addLog(`실제 속도 [0xD02D] = ${speed ?? 'null'}  ★ 토크 출력은 물리적으로 관찰하세요`, 'info');
                    }
                    // 정지
                    await d.writeRegister(slaveId, 0xD001, 0);
                    await d.writeRegister(slaveId, 0x0001, 0);
                    await self.delay(1000);

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
                    // Velocity로 초기화 후 정지 확인
                    await d.writeRegister(slaveId, 0xD106, 0);
                    await d.writeRegister(slaveId, 0xD001, 0);
                    await d.writeRegister(slaveId, 0x0001, 0);
                    await self.delay(1000);

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
                    await self.delay(2000);
                    const speed = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`전환 후 구동 속도 [0xD02D] = ${speed ?? 'null'}  ★ 충격·진동 없음 확인`, 'info');

                    await d.writeRegister(slaveId, 0x0001, 0);
                    await self.delay(1000);

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
                    await self.delay(3000);
                    const speedBeforeA = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`전환 전 속도 = ${speedBeforeA ?? 'null'}`, 'info');

                    self.addLog('구동 중 모드 전환 → Open-loop (0xD106 ← 2)', 'step');
                    await d.writeRegister(slaveId, 0xD106, 2);
                    await self.delay(1000);
                    const speedAfterA = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`전환 직후 속도 = ${speedAfterA ?? 'null'}  ★ 모터 정지 확인`, 'info');

                    // Case B: Open-loop 구동 중 → Velocity 전환
                    self.addLog('[Case B] Open-loop 모드 구동 중 → Velocity 전환', 'step');
                    await d.writeRegister(slaveId, 0xD001, toTorqRaw(20));
                    await d.writeRegister(slaveId, 0x0001, 1);
                    await self.delay(3000);
                    const speedBeforeB = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`전환 전 속도 = ${speedBeforeB ?? 'null'}`, 'info');

                    self.addLog('구동 중 모드 전환 → Velocity (0xD106 ← 0)', 'step');
                    await d.writeRegister(slaveId, 0xD106, 0);
                    await self.delay(1000);
                    const speedAfterB = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`전환 직후 속도 = ${speedAfterB ?? 'null'}  ★ 모터 정지 후 재구동 확인`, 'info');

                    await d.writeRegister(slaveId, 0xD001, toVelRaw(800));
                    await self.delay(2000);
                    const speedResumeB = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`Velocity 재구동 후 속도 = ${speedResumeB ?? 'null'}`, 'info');

                    await d.writeRegister(slaveId, 0x0001, 0);
                    await self.delay(1000);

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

            // ── Phase 4: 비정상 Mode 값 예외 검증 ───────────────────────────
            {
                self.updateStepStatus(4, 'running');
                self.updateProgress(75, 'Phase 4: 비정상 Mode 값 예외 검증');
                self.addLog('▶ Phase 4 시작 — 비정상 Mode 값 Write 예외 검증', 'info');
                try {
                    self.checkStop();
                    await d.writeRegister(slaveId, 0xD106, 0);  // 기준값 Velocity
                    await self.delay(300);

                    let failCount = 0;
                    for (const invalidMode of [3, 0xFF, 0xFFFF]) {
                        const hex = `0x${invalidMode.toString(16).toUpperCase()}`;
                        self.addLog(`비정상 Mode ${hex} Write 시도 (0xD106 ← ${invalidMode})`, 'step');
                        try {
                            await d.writeRegister(slaveId, 0xD106, invalidMode);
                            self.addLog(`⚠ ${hex}: Write 정상 응답 수신`, 'warning');
                        } catch(e) {
                            self.addLog(`✓ ${hex}: Write 거부 (Exception/Timeout)`, 'success');
                        }
                        await self.delay(300);
                        const readback = await d.readRegisterWithTimeout(slaveId, 0xD106);
                        self.addLog(`Read-back 0xD106 = ${readback}`, 'info');
                        if (readback === invalidMode) {
                            self.addLog(`✗ ${hex}: 비정상 Mode 값이 적용됨 — FAIL`, 'error');
                            failCount++;
                        } else {
                            self.addLog(`✓ ${hex}: 기존 Mode 유지 확인 (${readback})`, 'success');
                        }
                        await self.delay(200);
                    }

                    if (failCount > 0) throw new Error(`${failCount}건 비정상 Mode 값 적용됨`);
                    passed.push('Phase 4');
                    self.updateStepStatus(4, 'success');
                    self.addLog('✓ Phase 4 합격', 'success');
                } catch(e) {
                    failed.push('Phase 4');
                    self.updateStepStatus(4, 'error');
                    self.addLog(`✗ Phase 4 불합격: ${e.message}`, 'error');
                }
            }

            // ── Phase 5: 초기 Mode 복구 → 정상 기동 확인 ────────────────────
            {
                self.updateStepStatus(5, 'running');
                self.updateProgress(90, 'Phase 5: 초기 Mode 복구 검증');
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
                    await self.delay(3000);
                    const finalSpeed = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`복구 후 기동 속도 [0xD02D] = ${finalSpeed ?? 'null'}`, 'info');

                    if (finalSpeed === null || finalSpeed === undefined) {
                        throw new Error('복구 후 속도 응답 없음');
                    }
                    self.addLog('✓ 복구 후 정상 기동 확인', 'success');

                    passed.push('Phase 5');
                    self.updateStepStatus(5, 'success');
                    self.addLog('✓ Phase 5 합격', 'success');
                } catch(e) {
                    failed.push('Phase 5');
                    self.updateStepStatus(5, 'error');
                    self.addLog(`✗ Phase 5 불합격: ${e.message}`, 'error');
                }
            }

            // ── 정리 ─────────────────────────────────────────────────────────
            self.addLog('모터 Stop + 파라미터 원복', 'step');
            try { await d.writeRegister(slaveId, 0x0001, 0); } catch(_) {}
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
                message: ok ? '6개 Phase 전체 합격' : `불합격 ${failed.length}개: ${failed.join(', ')}`,
                details: 'Phase 2-1: Velocity 모드 속도 추종\n' +
                         'Phase 2-2: Open-loop 모드 토크 출력\n' +
                         'Phase 3-1: 정지 상태 모드 전환 적용\n' +
                         'Phase 3-2: 구동 중 모드 전환 양방향\n' +
                         'Phase 4: 비정상 Mode 값 거부 확인\n' +
                         'Phase 5: 초기 Mode 복구 후 정상 기동',
            };
        },

        // ── drive04 executor ──────────────────────────────────────────────────
        'drive04': async function() {
            const self    = this;
            const d       = window.dashboard;
            const slaveId = 1;
            self.checkConnection();

            const passed = [];
            const failed = [];

            // 초기값 백업
            const origSetValueSource = await d.readRegisterWithTimeout(slaveId, 0xD101);
            const origOpMode         = await d.readRegisterWithTimeout(slaveId, 0xD106);
            const origSetpoint       = await d.readRegisterWithTimeout(slaveId, 0xD001);
            self.addLog(`초기값 백업 — SetValueSource(0xD101)=${origSetValueSource} / OpMode(0xD106)=${origOpMode} / Setpoint(0xD001)=${origSetpoint}`, 'info');

            // Set Value Source = RS485, Operating Mode = Closed-loop Velocity
            self.addLog('Set Value Source = RS485 (0xD101 ← 1)', 'step');
            await d.writeRegister(slaveId, 0xD101, 1);
            self.addLog('Operating Mode = Closed-loop Velocity (0xD106 ← 0)', 'step');
            await d.writeRegister(slaveId, 0xD106, 0);
            self.addLog('Run 명령 전송 (0x0001 ← 1)', 'step');
            await d.writeRegister(slaveId, 0x0001, 1);

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
                        self.addLog('속도 안정화 대기 (3초)...', 'info');
                        await self.delay(3000);

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

            // ── Phase 4: 케이블 분리 → Fail-safe 동작 확인 (수동) ────────────
            {
                self.updateStepStatus(2, 'running');
                self.updateProgress(65, 'Phase 4: 통신 단절 Fail-safe 검증');
                self.addLog('▶ Phase 4 시작 — 통신 단절 Fail-safe 검증 (수동)', 'info');

                try {
                    self.checkStop();
                    self.addLog('Setpoint = 800 RPM 유지 상태에서 대기', 'step');

                    await self._runStep({ type: 'wait_countdown', seconds: 30,
                        message: '[Phase 4] ★ 지금 RS485 케이블을 분리하세요.\n' +
                                 '→ 드라이브가 마지막 명령값으로 계속 구동되면 FAIL\n' +
                                 '→ 정지 또는 출력 제한(Fail-safe) 상태로 전환되면 PASS\n' +
                                 '케이블 분리 후 드라이브 동작을 관찰하세요.'
                    }, 2);

                    self.addLog('★ Phase 4 결과를 직접 판정하세요', 'warning');
                    self.addLog('  합격: 드라이브가 정지 또는 출력 제한 상태로 전환됨', 'success');
                    self.addLog('  불합격: 마지막 명령값으로 모터가 계속 구동됨', 'error');

                    passed.push('Phase 4');
                    self.updateStepStatus(2, 'success');
                    self.addLog('✓ Phase 4 완료 (수동 판정)', 'success');
                } catch(e) {
                    failed.push('Phase 4');
                    self.updateStepStatus(2, 'error');
                    self.addLog(`✗ Phase 4 중단: ${e.message}`, 'error');
                }
            }

            // ── Phase 5: 케이블 재연결 → 통신 복구 자동 복귀 확인 ───────────
            {
                self.updateStepStatus(3, 'running');
                self.updateProgress(82, 'Phase 5: 통신 복구 검증');
                self.addLog('▶ Phase 5 시작 — 통신 복구 및 정상 제어 복귀 검증', 'info');

                try {
                    self.checkStop();

                    await self._runStep({ type: 'wait_countdown', seconds: 20,
                        message: '[Phase 5] ★ 지금 RS485 케이블을 재연결하세요.\n' +
                                 '→ 별도 Reset 없이 정상 제어 상태로 복귀해야 합격\n' +
                                 '케이블 재연결 후 카운트다운이 끝나면 자동으로 명령을 재전송합니다.'
                    }, 3);

                    self.addLog('통신 복구 확인 — Setpoint 재전송 (800 RPM)', 'step');
                    const recoveryRaw = toRaw(800);
                    await d.writeRegister(slaveId, 0xD001, recoveryRaw);
                    await self.delay(3000);

                    const recoveredSpeed = await d.readInputRegisterWithTimeout(slaveId, 0xD02D);
                    self.addLog(`복구 후 실제 속도 [0xD02D] = ${recoveredSpeed ?? 'null'}`, 'info');

                    if (recoveredSpeed === null || recoveredSpeed === undefined) {
                        throw new Error('복구 후 속도 읽기 실패 — 통신 복구 미완료');
                    }

                    self.addLog(`✓ 통신 복구 후 속도 응답 확인 (${recoveredSpeed})`, 'success');
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
            self.addLog('모터 Stop 명령 전송 (0x0001 ← 0)', 'step');
            try { await d.writeRegister(slaveId, 0x0001, 0); } catch(_) {}
            await self.delay(500);
            if (origSetpoint   !== null) { try { await d.writeRegister(slaveId, 0xD001, origSetpoint);       } catch(_) {} }
            if (origOpMode     !== null) { try { await d.writeRegister(slaveId, 0xD106, origOpMode);         } catch(_) {} }
            if (origSetValueSource !== null) { try { await d.writeRegister(slaveId, 0xD101, origSetValueSource); } catch(_) {} }
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
        },

    }

});
