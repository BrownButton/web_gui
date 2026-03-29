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
            purpose: 'RS485 통신을 Set Value Source로 설정했을 때 드라이브가 수신한 명령값을 정상적으로 해석하여 목표값에 반영하는지 확인한다. 통신 단절, 타임아웃, 비정상 데이터에 대한 Fail-safe 동작도 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: 'Modbus 명령값에 따라 목표 속도/토크가 정상 반영 / 통신 단절 시 Fail-safe 동작(정지 또는 출력 제한) 수행',
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
                    address: 0xD101,
                    value: 1,
                    label: 'Set Value Source = RS485 (0xD101 = 1)',
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
                    label: 'Setpoint = 100 RPM (0xD001 = 4000, 100/1600×64000)',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] — 100 RPM 근처 확인',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 16000,
                    label: 'Setpoint = 400 RPM (0xD001 = 16000, 400/1600×64000)',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] — 400 RPM 근처 확인',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 40000,
                    label: 'Setpoint = 1000 RPM (0xD001 = 40000, 1000/1600×64000)',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] — 1000 RPM 근처 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '[Phase 3 — 통신 주기 및 안정성 검증]\n' +
                             '현재 1000 RPM 명령 유지 중 — 속도가 안정적으로 유지되는지 확인하세요.'
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '[Phase 4 — 통신 이상 및 Fail-safe 검증 (Negative Test)]\n' +
                             '통신 케이블을 분리하여 통신 단절 상태를 구성하세요.\n' +
                             '→ 드라이브가 Safe 상태(정지 또는 출력 제한)로 전환되어야 합격\n' +
                             '→ 마지막 명령값으로 모터가 계속 구동되면 불합격'
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '[Phase 5 — 통신 복구 검증]\n' +
                             '통신 케이블을 재연결하세요.\n' +
                             '정상 제어 상태로 자동 복귀하는지 확인하세요.'
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
            description: 'Operation Mode(속도/토크/위치 제어) 설정 및 모드 전환 안정성 검증',
            purpose: '드라이브의 Operation Mode를 설정했을 때 각 모드에 따라 제어 동작이 정상적으로 수행되는지 확인한다. 모드 전환 시 시스템이 안정적으로 동작하며 출력 급변, 진동 등이 발생하지 않는지 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '각 Operation Mode에서 정의된 제어 방식이 정상 동작 / 모드 전환 시 출력 급변 또는 진동 없음',
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
                    label: 'Setpoint = 100 RPM (속도 제어 모드 검증용)',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: 'Actual Speed [0xD02D] — Closed-loop 100 RPM 추종 확인',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 0,
                    label: 'Setpoint = 0 (정지 후 모드 전환)',
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
                    label: 'Setpoint = 10% Open-loop (0xD001 = 6554, 10/100×65535)',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD050,
                    label: 'Command Torque [0xD050] — Open-loop 10% 적용 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '[Phase 3 — Mode 전환 안정성 검증]\n' +
                             '모터 구동 중 Mode를 Open-loop ↔ Closed-loop으로 전환하세요.\n' +
                             '전환 시 PWM 출력 급변, 토크/속도 튐 현상이 없는지 확인하세요.\n' +
                             '전환 후 새로운 제어 모드가 정상 적용되는지 확인하세요.'
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '[Phase 4 — 예외 상황 검증]\n' +
                             '비정상적인 Mode 값(예: 0xFFFF) 쓰기를 시도하세요.\n' +
                             '→ 시스템이 해당 명령을 거부하거나 에러 처리하는지 확인'
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

    executors: {}

});
