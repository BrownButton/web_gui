/**
 * OS Test Module - 보호동작
 * 5-1  ~ 5-20. Error 0x10 ~ 0x58
 * 5-21 ~ 5-27. Warning 0x01 ~ 0x40
 *
 * 대부분 하드웨어 조작이 필요한 시험.
 * 알람 코드 레지스터: FC04 0xD010 (추정)
 * 상태 레지스터:     FC04 0xD011 (Motor Status, 확정)
 * 알람 리셋:         FC06 0xD000 = 0x0002
 */

window.OSTestModules = window.OSTestModules || [];

window.OSTestModules.push({

    tests: {

        // ── 5-1. Error 0x10 IPM fault ──────────────────────────────────────────
        'prot-0x10': {
            id: 'prot-0x10',
            category: '보호동작',
            number: '5-1',
            title: 'Error 0x10 — IPM fault',
            description: 'IPM 하드웨어 이상 발생 시 보호 동작 검증',
            purpose: 'IPM(Intelligent Power Module) 내부 고장 발생 시 드라이브가 보호 동작(알람)을 수행하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 오실로스코프 (선택)',
            criteria: 'IPM Fault 조건 발생 시 드라이브가 보호 동작을 수행함 / Error 코드 0x10 (IPM Fault) 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: '현재 Motor Status [0xD011] 확인 (정상: 0x0000)',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '⚠ IPM 단락 또는 하드웨어 이상 조건을 인위적으로 만드세요.\n' +
                             '(예: 출력 단자 간 일시 단락, 제조사 정의 테스트 절차)\n' +
                             '드라이브가 에러를 검출할 때까지 대기합니다.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 검출 확인',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD010,
                    label: '에러 코드 레지스터 [0xD010] 읽기 (0x10 기대)',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: '리셋 후 Motor Status 확인',
                    softFail: true
                }
            ]
        },

        // ── 5-2. Error 0x11 IPM Over temperature ──────────────────────────────
        'prot-0x11': {
            id: 'prot-0x11',
            category: '보호동작',
            number: '5-2',
            title: 'Error 0x11 — IPM Over temperature',
            description: 'IPM 과온 보호 동작 검증',
            purpose: 'IPM 온도가 과도하게 상승했을 때 드라이브가 보호 동작(알람)을 수행하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 열풍기 (IPM 가열용)',
            criteria: 'IPM Over Temperature 조건 발생 시 드라이브가 보호 동작을 수행함 / Error 코드 0x11 (IPM Over Temperature) 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x260B,
                    label: '현재 IGBT 온도 [0x260B] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 60,
                    message: '⚠ 열풍기로 IPM/IGBT 모듈을 가열하세요.\n' +
                             'IGBT 과온 임계값(제품 사양 확인) 초과까지 대기합니다.\n' +
                             '주의: 과도한 가열로 인한 소자 손상에 유의하세요.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x260B,
                    label: 'IGBT 온도 [0x260B] — 과온 임계값 초과 확인',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x11 검출 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: 'IPM/IGBT 온도가 내려가도록 자연 냉각 또는 냉각 팬 동작 대기'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                }
            ]
        },

        // ── 5-3. Error 0x14 Over current ──────────────────────────────────────
        'prot-0x14': {
            id: 'prot-0x14',
            category: '보호동작',
            number: '5-3',
            title: 'Error 0x14 — Over current',
            description: '과전류 보호 동작 검증',
            purpose: '드라이브 출력 전류가 과전류 임계값을 초과했을 때 보호 동작(알람)이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: 'Over Current 조건 발생 시 드라이브가 보호 동작을 수행함 / Error 코드 0x14 (Over Current) 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD13B,
                    label: '현재 Max Coil Current [0xD13B] 백업',
                    storeAs: 'maxCurrentBackup',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2610,
                    label: '현재 U상 전류 [0x2610] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 과전류 조건 설정 방법 중 하나를 선택하세요:\n' +
                             '① Max Coil Current [0xD13B] 값을 현재 동작 전류보다 낮게 설정\n' +
                             '② 제조사 정의 FCT 프로시저로 과전류 주입\n' +
                             '설정 후 모터를 구동하세요.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x14 검출 확인',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD13B,
                    restoreFrom: 'maxCurrentBackup',
                    label: 'Max Coil Current [0xD13B] 원복',
                    softFail: true
                }
            ]
        },

        // ── 5-4. Error 0x15 Current offset ────────────────────────────────────
        'prot-0x15': {
            id: 'prot-0x15',
            category: '보호동작',
            number: '5-4',
            title: 'Error 0x15 — Current offset',
            description: '전류 오프셋 이상 보호 동작 검증',
            purpose: '전류 센서 오프셋 이상이 감지되었을 때 보호 동작(알람)이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: 'Current Offset 조건 발생 시 드라이브가 보호 동작을 수행함 / Error 코드 0x15 (Current Offset) 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2610,
                    label: 'U상 전류 센서값 [0x2610] 확인 (정지 시 0 기대)',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2611,
                    label: 'V상 전류 센서값 [0x2611] 확인',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2612,
                    label: 'W상 전류 센서값 [0x2612] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 제조사 정의 FCT 프로시저를 통해 전류 오프셋 이상 조건을 주입하세요.\n' +
                             '또는 전류 센서 신호선을 분리하여 오프셋 이상 조건을 유발하세요.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x15 검출 확인',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                }
            ]
        },

        // ── 5-5. Error 0x17 IPM Low temperature ───────────────────────────────
        'prot-0x17': {
            id: 'prot-0x17',
            category: '보호동작',
            number: '5-5',
            title: 'Error 0x17 — IPM Low temperature',
            description: 'IPM 저온 보호 동작 검증 (챔버 환경 필요)',
            purpose: 'IPM 온도가 저온 임계값 이하로 내려갔을 때 보호 동작(알람)이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 환경 챔버 (저온)',
            criteria: 'IPM 저온 조건 발생 시 드라이브가 보호 동작을 수행함 / Error 코드 0x17 (IPM Low Temperature) 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x260B,
                    label: '현재 IGBT 온도 [0x260B] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 10,
                    message: '⚠ 이 항목은 저온 환경 챔버가 필요합니다.\n' +
                             '현재 검증 환경 미흡으로 시험 불가.\n' +
                             '챔버 환경 구축 후 IPM을 저온 임계값(사양 확인) 이하로 냉각하여 시험하세요.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x17 검출 확인 (skip 가능)',
                    softFail: true
                }
            ]
        },

        // ── 5-6. Error 0x22 Drive temperature 1 ───────────────────────────────
        'prot-0x22': {
            id: 'prot-0x22',
            category: '보호동작',
            number: '5-6',
            title: 'Error 0x22 — Drive temperature 1',
            description: '드라이브 온도 과온 보호 동작 검증 (레벨 1)',
            purpose: '드라이브(Main 제어부) 온도가 과온 임계값을 초과했을 때 보호 동작(알람)이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 열풍기',
            criteria: '드라이브 과온 조건 발생 시 보호 동작을 수행함 / Error 코드 0x22 (Drive Temperature 1) 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x260A,
                    label: '현재 Board 온도 [0x260A] 확인',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x260B,
                    label: '현재 IGBT 온도 [0x260B] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 90,
                    message: '⚠ 열풍기로 드라이브 보드를 가열하세요.\n' +
                             '(0x22 vs 0x25: 인버터/드라이브 구분 확인 후 해당 센서 부위 가열)\n' +
                             '과온 임계값(사양서 확인) 초과까지 대기합니다.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x260A,
                    label: 'Board 온도 [0x260A] — 임계값 초과 확인',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x22 검출 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '드라이브가 냉각되도록 대기 (자연 냉각)'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                }
            ]
        },

        // ── 5-7. Error 0x24 Motor cable open ──────────────────────────────────
        'prot-0x24': {
            id: 'prot-0x24',
            category: '보호동작',
            number: '5-7',
            title: 'Error 0x24 — Motor cable open',
            description: '모터 케이블 단선 보호 동작 검증',
            purpose: '모터 케이블이 단선(Open) 되었을 때 드라이브가 보호 동작(알람)을 수행하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '모터 케이블 단선 시 드라이브가 보호 동작을 수행함 / Error 코드 0x24 (Motor Cable Open) 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 모터 출력 케이블(U/V/W 중 하나 이상)을 분리하세요.\n' +
                             '안전 주의: 전원 인가 상태에서 분리 전 드라이브를 정지하세요.'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 16000,
                    label: 'Setpoint [0xD001] = 16000 (모터 구동 시도)',
                    softFail: true
                },
                {
                    type: 'delay',
                    ms: 3000,
                    label: '구동 명령 후 3초 대기'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x24 검출 확인',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 0,
                    label: 'Setpoint [0xD001] = 0 (정지)',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 분리한 모터 케이블을 다시 연결하세요.'
                }
            ]
        },

        // ── 5-8. Error 0x25 Drive temperature 2 ───────────────────────────────
        'prot-0x25': {
            id: 'prot-0x25',
            category: '보호동작',
            number: '5-8',
            title: 'Error 0x25 — Drive temperature 2',
            description: '드라이브 온도 과온 보호 동작 검증 (레벨 2)',
            purpose: '드라이브(인버터부) 온도가 과온 임계값을 초과했을 때 보호 동작(알람)이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 열풍기',
            criteria: '인버터부 과온 조건 발생 시 보호 동작을 수행함 / Error 코드 0x25 (Drive Temperature 2) 또는 Motor Status TFE 비트 Set 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x260A,
                    label: '현재 Board 온도 [0x260A] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 90,
                    message: '⚠ 열풍기로 해당 온도 센서 부위(인버터 또는 드라이브 보드)를 가열하세요.\n' +
                             'Error 0x25 임계값(사양서 확인)까지 가열합니다.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x25 검출 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '드라이브 냉각 대기'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                }
            ]
        },

        // ── 5-9. Error 0x2A Motor circuit abnormality ──────────────────────────
        'prot-0x2a': {
            id: 'prot-0x2a',
            category: '보호동작',
            number: '5-9',
            title: 'Error 0x2A — Motor circuit abnormality',
            description: '모터 회로 이상 보호 동작 검증',
            purpose: '모터 회로 이상(Motor Circuit Abnormality) 감지 시 드라이브가 보호 동작(알람)을 수행하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '모터 회로 이상 조건 발생 시 드라이브가 보호 동작을 수행함 / Error 코드 0x2A (Motor Circuit Abnormality) 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2610,
                    label: '현재 U상 전류 [0x2610] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 모터 회로 이상 조건을 생성하세요.\n' +
                             '(예: 모터 권선 단선 시뮬레이션, 상간 불평형 부하 삽입)\n' +
                             '드라이브 구동 후 이상 검출을 확인합니다.'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 8000,
                    label: 'Setpoint [0xD001] = 8000 (모터 구동 시도)',
                    softFail: true
                },
                {
                    type: 'delay',
                    ms: 3000,
                    label: '3초 대기'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x2A 검출 확인',
                    softFail: true
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
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                }
            ]
        },

        // ── 5-10. Error 0x36 Sinusoidal encoder amplitude too low ─────────────
        'prot-0x36': {
            id: 'prot-0x36',
            category: '보호동작',
            number: '5-10',
            title: 'Error 0x36 — Sinusoidal encoder amplitude too low',
            description: '정현파 엔코더 신호 저진폭 보호 동작 검증',
            purpose: '사인파 엔코더(Sinusoidal Encoder) 신호 진폭이 최소 임계값 이하로 내려갔을 때 보호 동작(알람)이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 가변 저항 또는 감쇠기',
            criteria: '엔코더 신호 진폭 저하 시 보호 동작을 수행함 / Error 코드 0x36 확인 또는 Motor Status HLL 비트(Bit 6) Set 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: '현재 Motor Status [0xD011] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 정현파 엔코더 신호선에 감쇠기(저항)를 삽입하여 진폭을 낮추세요.\n' +
                             '또는 엔코더 신호선을 부분 단락하여 진폭을 하한 임계값 이하로 조절하세요.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x36 검출 확인',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                }
            ]
        },

        // ── 5-11. Error 0x37 Sinusoidal encoder amplitude too high ────────────
        'prot-0x37': {
            id: 'prot-0x37',
            category: '보호동작',
            number: '5-11',
            title: 'Error 0x37 — Sinusoidal encoder amplitude too high',
            description: '정현파 엔코더 신호 고진폭 보호 동작 검증',
            purpose: '사인파 엔코더(Sinusoidal Encoder) 신호 진폭이 최대 임계값을 초과했을 때 보호 동작(알람)이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 신호 증폭기 (선택)',
            criteria: '엔코더 신호 진폭 과대 시 보호 동작을 수행함 / Error 코드 0x37 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: '현재 Motor Status [0xD011] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 검증 실험 가능 여부 확인이 필요합니다.\n' +
                             '신호 증폭기로 엔코더 신호 진폭을 상한 임계값 이상으로 높이거나,\n' +
                             '외부 신호 발생기로 고진폭 정현파 신호를 주입하세요.\n' +
                             '불가 시 이 항목을 삭제하세요.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x37 검출 확인 (skip 가능)',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                }
            ]
        },

        // ── 5-14. Error 0x40 Under voltage ────────────────────────────────────
        'prot-0x40': {
            id: 'prot-0x40',
            category: '보호동작',
            number: '5-14',
            title: 'Error 0x40 — Under voltage',
            description: '저전압 보호 동작 검증',
            purpose: 'DC Link 전압이 한계값 이하로 내려갔을 경우 알람 동작 여부를 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 가변 AC/DC 전원공급기',
            criteria: '[0xD011] Motor Status의 값 중 4번 비트(FB)와 12번 비트(UzLow) 가 Set 되어 있을 경우 합격 / 예상 Motor Status 값: 0x1010',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2605,
                    label: '현재 DC Link 전압 [0x2605] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 입력 전압을 저전압 임계값(사양서 확인) 이하로 낮추세요.\n' +
                             '(가변 전원공급기 사용 또는 입력 전압 단계적 감소)'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2605,
                    label: 'DC Link 전압 [0x2605] — 저전압 임계값 이하 확인',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x40 검출 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 15,
                    message: '⚠ 입력 전압을 정상 범위로 복구하세요.'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                }
            ]
        },

        // ── 5-15. Error 0x41 Over voltage ─────────────────────────────────────
        'prot-0x41': {
            id: 'prot-0x41',
            category: '보호동작',
            number: '5-15',
            title: 'Error 0x41 — Over voltage',
            description: '과전압 보호 동작 검증',
            purpose: 'DC Link 전압이 과전압 임계값을 초과했을 때 드라이브가 보호 동작(알람)을 수행하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 가변 AC/DC 전원공급기',
            criteria: '과전압 조건 발생 시 드라이브가 보호 동작을 수행함 / Error 코드 0x41 (Over Voltage) 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2605,
                    label: '현재 DC Link 전압 [0x2605] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 입력 전압을 과전압 임계값(사양서 확인) 이상으로 높이세요.\n' +
                             '(가변 전원공급기 사용)\n' +
                             '주의: 소자 손상 방지를 위해 임계값 직후 즉시 전압을 낮추세요.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2605,
                    label: 'DC Link 전압 [0x2605] — 과전압 임계값 초과 확인',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x41 검출 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 15,
                    message: '⚠ 입력 전압을 정상 범위로 복구하세요.'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                }
            ]
        },

        // ── 5-16. Error 0x42 RST power fail ───────────────────────────────────
        'prot-0x42': {
            id: 'prot-0x42',
            category: '보호동작',
            number: '5-16',
            title: 'Error 0x42 — RST power fail',
            description: 'RST 전원 이상 보호 동작 검증',
            purpose: '주 전원(RST)이 결상 되었을 때 알람 동작 여부를 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '[0xD011] Motor Status의 값 중 0번 비트(PHA)와 4번 비트(FB) 가 Set 되어 있을 경우 합격 / 예상 Motor Status 값: 0x0011',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: '현재 Motor Status [0xD011] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ RST 전원 이상 조건을 생성하세요.\n' +
                             '(예: RST 전원 라인 일시 단락, 제어 전원 순간 차단)\n' +
                             '드라이브가 에러를 검출할 때까지 대기합니다.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x42 검출 확인',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                }
            ]
        },

        // ── 5-18. Error 0x50 Over speed limit ─────────────────────────────────
        'prot-0x50': {
            id: 'prot-0x50',
            category: '보호동작',
            number: '5-18',
            title: 'Error 0x50 — Over speed limit',
            description: '속도 초과 보호 동작 검증',
            purpose: '팬 모터가 과도한 속도로 회전할 경우 알람 동작 여부를 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '[0xD011] Motor Status의 값 중 4번 비트(FB)와 8번 비트(N_Limit) 가 Set 되어 있을 경우 합격 / 예상 Motor Status 값: 0x0110',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: '현재 실제 속도 [0xD02D] 확인',
                    softFail: true
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD119,
                    label: '현재 최대 속도 설정 [0xD119] 확인',
                    storeAs: 'maxSpeedBackup',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD119,
                    value: 200,
                    label: '최대 속도 [0xD119] = 200 (낮게 설정하여 쉽게 초과)',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 64000,
                    label: 'Setpoint [0xD001] = 64000 (최대 명령)',
                    softFail: true
                },
                {
                    type: 'delay',
                    ms: 3000,
                    label: '3초 대기 (속도 상승 후 제한 초과 대기)'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x50 검출 확인',
                    softFail: true
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
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD119,
                    restoreFrom: 'maxSpeedBackup',
                    label: '최대 속도 [0xD119] 원복',
                    softFail: true
                }
            ]
        },

        // ── 5-19. Error 0x53 Excessive speed deviation ────────────────────────
        'prot-0x53': {
            id: 'prot-0x53',
            category: '보호동작',
            number: '5-19',
            title: 'Error 0x53 — Excessive speed deviation',
            description: '과도 속도 편차 보호 동작 검증',
            purpose: 'Closed-loop 속도 제어 중 목표 속도와 실제 속도의 편차가 허용 범위를 초과했을 때 보호 동작(알람)이 수행되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 부하 장치 (샤프트 잠금 또는 부하기)',
            criteria: '속도 편차 과대 조건 발생 시 드라이브가 보호 동작을 수행함 / Error 코드 0x53 (Excessive Speed Deviation) 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 32000,
                    label: 'Setpoint [0xD001] = 32000 (정상 구동)',
                    softFail: true
                },
                {
                    type: 'delay',
                    ms: 3000,
                    label: '정상 구동 안정화 대기 3초'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD02D,
                    label: '정상 구동 속도 [0xD02D] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 모터 샤프트에 갑작스러운 과부하를 가하여 속도 편차를 크게 만드세요.\n' +
                             '(부하기 급격한 토크 인가 또는 샤프트 저항 증가)'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x53 검출 확인',
                    softFail: true
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
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                }
            ]
        },

        // ── 5-20. Error 0x58 Motor shaft blocked ──────────────────────────────
        'prot-0x58': {
            id: 'prot-0x58',
            category: '보호동작',
            number: '5-20',
            title: 'Error 0x58 — Motor shaft blocked',
            description: '모터 샤프트 고착 보호 동작 검증',
            purpose: '팬 모터가 알 수 없는 이유에 의해 구속되었을 때 알람 동작 여부를 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 샤프트 잠금 장치',
            criteria: '[0xD011] Motor Status의 값 중 4번 비트(FB)와 7번 비트(BLK) 가 Set 되어 있을 경우 합격 / 예상 Motor Status 값: 0x0090',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 모터 샤프트를 물리적으로 잠그세요.\n' +
                             '(샤프트 고착 장치 또는 샤프트를 손으로 단단히 고정)\n' +
                             '안전 주의: 잠금 후 즉시 구동 명령을 내립니다.'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 32000,
                    label: 'Setpoint [0xD001] = 32000 (구동 시도)',
                    softFail: true
                },
                {
                    type: 'delay',
                    ms: 5000,
                    label: '5초 대기 (고착 검출 대기)'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Error 0x58 검출 확인',
                    softFail: true
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
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: '알람 리셋 [0xD000=0x0002]',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 10,
                    message: '⚠ 샤프트 잠금 장치를 해제하세요.'
                }
            ]
        },

        // ══════════════════════════════════════════════════════════════════════
        // WARNING Tests
        // ══════════════════════════════════════════════════════════════════════

        // ── 5-21. Warning 0x01 DC Link under voltage ──────────────────────────
        'prot-w01': {
            id: 'prot-w01',
            category: '보호동작',
            number: '5-21',
            title: 'Warning 0x01 — DC Link under voltage',
            description: 'DC Link 저전압 경고 동작 검증',
            purpose: 'DC Link 전압이 경고 임계값 이하로 내려갔을 때 Warning 신호가 발생하는지 확인한다. ' +
                     '(에러와 달리 Warning은 드라이브 운전을 즉시 중단하지 않고 경고 상태를 알림)',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 가변 AC/DC 전원공급기',
            criteria: 'DC Link 전압이 Warning 임계값 이하로 내려갔을 때 Warning 비트(0x01) Set 확인 / Warning 상태에서의 드라이브 동작 정책 확인 (운전 계속 또는 속도 제한)',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2605,
                    label: '현재 DC Link 전압 [0x2605] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 입력 전압을 경고 레벨 저전압 임계값 부근(Error 0x40 임계값보다 높은 경고 구간)으로 조절하세요.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2605,
                    label: 'DC Link 전압 [0x2605] — 경고 구간 진입 확인',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Warning 0x01 플래그 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 15,
                    message: '⚠ 입력 전압을 정상 범위로 복구하세요.'
                }
            ]
        },

        // ── 5-22. Warning 0x02 DC Link over voltage ───────────────────────────
        'prot-w02': {
            id: 'prot-w02',
            category: '보호동작',
            number: '5-22',
            title: 'Warning 0x02 — DC Link over voltage',
            description: 'DC Link 과전압 경고 동작 검증',
            purpose: 'DC Link 전압이 과전압 경고 임계값을 초과했을 때 Warning 신호가 발생하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 가변 AC/DC 전원공급기',
            criteria: 'DC Link 전압이 과전압 Warning 임계값을 초과했을 때 Warning 비트(0x02) Set 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2605,
                    label: '현재 DC Link 전압 [0x2605] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 입력 전압을 경고 레벨 과전압 임계값 부근(Error 0x41 임계값보다 낮은 경고 구간)으로 높이세요.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2605,
                    label: 'DC Link 전압 [0x2605] — 경고 구간 진입 확인',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Warning 0x02 플래그 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 15,
                    message: '⚠ 입력 전압을 정상 범위로 복구하세요.'
                }
            ]
        },

        // ── 5-23. Warning 0x04 Motor over temperature ─────────────────────────
        'prot-w04': {
            id: 'prot-w04',
            category: '보호동작',
            number: '5-23',
            title: 'Warning 0x04 — Motor over temperature',
            description: '모터 과온 경고 동작 검증',
            purpose: '모터 온도가 경고 임계값을 초과했을 때 Warning 신호가 발생하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 열풍기 (모터 가열용)',
            criteria: '모터 온도가 Warning 임계값을 초과했을 때 Warning 비트(0x04) Set 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: '현재 Motor Status [0xD011] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 90,
                    message: '⚠ 모터를 과부하 운전 또는 열풍기로 가열하여 모터 온도를 경고 임계값 이상으로 올리세요.\n' +
                             '주의: 모터 코일 절연 파괴 방지를 위해 과도한 가열 금지.'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Warning 0x04 플래그 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '모터 냉각 대기'
                }
            ]
        },

        // ── 5-24. Warning 0x08 IGBT Module over temperature ───────────────────
        'prot-w08': {
            id: 'prot-w08',
            category: '보호동작',
            number: '5-24',
            title: 'Warning 0x08 — IGBT Module over temperature',
            description: 'IGBT 모듈 과온 경고 동작 검증',
            purpose: 'IGBT 모듈 온도가 경고 임계값을 초과했을 때 Warning 신호가 발생하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 열풍기',
            criteria: 'IGBT 온도가 Warning 임계값을 초과했을 때 Warning 비트(0x08) Set 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x260B,
                    label: '현재 IGBT 온도 [0x260B] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 60,
                    message: '⚠ 열풍기로 IGBT 모듈을 가열하여 경고 임계값(사양서 확인) 이상으로 올리세요.\n' +
                             '(Error 0x11 임계값보다 낮은 경고 구간 목표)'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x260B,
                    label: 'IGBT 온도 [0x260B] — 경고 임계값 초과 확인',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Warning 0x08 플래그 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: 'IGBT 냉각 대기'
                }
            ]
        },

        // ── 5-25. Warning 0x10 Drive (Control part) over temperature ──────────
        'prot-w10': {
            id: 'prot-w10',
            category: '보호동작',
            number: '5-25',
            title: 'Warning 0x10 — Drive (Control part) over temperature',
            description: '드라이브 제어부 과온 경고 동작 검증',
            purpose: '드라이브 제어부 온도가 경고 임계값을 초과했을 때 Warning 신호가 발생하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 열풍기',
            criteria: '드라이브 제어부 온도가 Warning 임계값을 초과했을 때 Warning 비트(0x10) Set 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x260A,
                    label: '현재 Board 온도 [0x260A] 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 60,
                    message: '⚠ 열풍기로 드라이브 제어 보드를 가열하여 경고 임계값 이상으로 올리세요.\n' +
                             '(Error 0x22/0x25 임계값보다 낮은 경고 구간 목표)'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x260A,
                    label: 'Board 온도 [0x260A] — 경고 임계값 초과 확인',
                    softFail: true
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Warning 0x10 플래그 확인',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 30,
                    message: '드라이브 냉각 대기'
                }
            ]
        },

        // ── 5-27. Warning 0x40 Torque Limit ───────────────────────────────────
        'prot-w40': {
            id: 'prot-w40',
            category: '보호동작',
            number: '5-27',
            title: 'Warning 0x40 — Torque Limit',
            description: '토크 제한 경고 동작 검증',
            purpose: '드라이브 출력 토크가 토크 제한값에 도달했을 때 Warning 신호가 발생하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, 부하 장치',
            criteria: '출력 토크가 토크 제한값에 도달했을 때 Warning 비트(0x40) Set 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                { type: 'check_comm_settings', label: 'Baudrate / Parity 설정 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD13B,
                    label: '현재 Max Coil Current [0xD13B] 확인 (토크 제한 파라미터)',
                    storeAs: 'torqueLimitBackup',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD13B,
                    value: 500,
                    label: 'Max Coil Current [0xD13B] = 500 (낮게 설정 → 토크 제한 쉽게 도달)',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 32000,
                    label: 'Setpoint [0xD001] = 32000 (구동)',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 20,
                    message: '⚠ 모터 샤프트에 부하를 가하여 토크 제한값에 도달하도록 하세요.\n' +
                             '(부하기 토크 인가 또는 기계적 부하 증가)'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Motor Status [0xD011] — Warning 0x40 플래그 확인',
                    softFail: true
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
                    address: 0xD13B,
                    restoreFrom: 'torqueLimitBackup',
                    label: 'Max Coil Current [0xD13B] 원복',
                    softFail: true
                }
            ]
        }

    }, // end tests

    executors: {}

}); // end push
