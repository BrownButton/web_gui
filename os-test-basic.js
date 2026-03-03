/**
 * OS Test Module - 기본동작
 * 3-1-1. Software Reset
 * 3-1-2. Alarm Reset
 * 3-2.   전류제한 파라미터 설정
 * 3-3.   구동 방향 설정 (CW, CCW)
 * 3-4.   EEPROM Save
 * 3-5.   DCLink V
 * 3-6.   Board 온도
 * 3-7.   IGBT 온도
 * 3-8.   펌웨어 버전확인 main/main boot
 * 3-9.   펌웨어 버전확인 inverter/inverter boot
 * 3-10-1. main OS 다운로드
 * 3-10-2. inverter OS 다운로드
 * 3-10-3. OS 다운로드 중 분리 예외처리
 */

window.OSTestModules = window.OSTestModules || [];

window.OSTestModules.push({

    tests: {

        // ── 3-1-1. Software Reset ─────────────────────────────────────────────
        'basic-sw-reset': {
            id: 'basic-sw-reset',
            category: '기본동작',
            number: '3-1-1',
            title: 'Software Reset',
            description: 'SW Reset 명령 처리 검증',
            purpose: 'Modbus 명령으로 Software Reset을 수행한 후 드라이브가 재초기화되고 ' +
                     '통신이 재연결되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'Reset 명령 전송 후 드라이브 재부팅, 약 5~10초 내 통신 재연결 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: 'Reset 전 통신 동작 확인 — Setpoint [0xD001] 읽기',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0001,
                    label: 'Software Reset 명령 — [0xD000] = 0x0001\n' +
                           '※ Reset 직후 응답 없을 수 있음 (정상)',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 8,
                    message: '드라이브 재부팅 대기 중 (약 5~10초)...'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: 'Reset 후 통신 재연결 확인 — [0xD001] 읽기 가능 여부',
                    softFail: true,
                    storeAs: 'post_reset_val'
                }
            ]
        },

        // ── 3-1-2. Alarm Reset ───────────────────────────────────────────────
        'basic-alarm-reset': {
            id: 'basic-alarm-reset',
            category: '기본동작',
            number: '3-1-2',
            title: 'Alarm Reset',
            description: '알람 클리어 명령 처리 검증',
            purpose: '알람 발생 상태에서 Alarm Reset 명령을 전송했을 때 알람 코드가 ' +
                     '클리어(0)되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'Alarm Reset 명령 후 Motor Status [0xD011] 알람 비트 클리어 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: '현재 Motor Status [0xD011] 읽기 — 알람 비트 확인',
                    storeAs: 'motorStatus_before'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD000,
                    value: 0x0002,
                    label: 'Alarm Reset 명령 — [0xD000] = 0x0002',
                    softFail: true
                },
                {
                    type: 'delay', ms: 500
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD011,
                    label: 'Alarm Reset 후 Motor Status [0xD011] 재읽기 — 알람 비트 클리어 확인',
                    storeAs: 'motorStatus_after',
                    softMatch: true
                }
            ]
        },

        // ── 3-2. 전류제한 파라미터 설정 ──────────────────────────────────────
        'basic-current-limit': {
            id: 'basic-current-limit',
            category: '기본동작',
            number: '3-2',
            title: '전류제한 파라미터 설정',
            description: '최대 코일 전류 설정 및 반영 검증',
            purpose: '최대 코일 전류(Max Coil Current) 파라미터를 쓰고 읽어서 값이 올바르게 반영되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: '설정한 전류제한 값 Write 후 Read-back 일치',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD13B,
                    label: '현재 Max Coil Current [0xD13B] 읽기 (백업)',
                    storeAs: 'currentLimitBackup',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD13B,
                    value: 1000,
                    label: 'Max Coil Current [0xD13B] = 1000 쓰기',
                    verifyAfterWrite: true,
                    expectAfterWrite: 1000
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD13B,
                    from: 'currentLimitBackup',
                    label: 'Max Coil Current 원래 값 복원 [0xD13B]'
                }
            ]
        },

        // ── 3-3. 구동 방향 설정 ───────────────────────────────────────────────
        'basic-direction': {
            id: 'basic-direction',
            category: '기본동작',
            number: '3-3',
            title: '구동 방향 설정 (CW / CCW)',
            description: '모터 정·역 방향 설정 파라미터 검증',
            purpose: 'Running Direction 파라미터(0=CCW, 1=CW)를 변경하고 모터 구동 방향이 ' +
                     '실제로 바뀌는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'CW(1) / CCW(0) 설정 후 모터 회전 방향 변경 육안 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD102,
                    label: '현재 Running Direction [0xD102] 읽기 (백업)',
                    storeAs: 'directionBackup',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD102,
                    value: 1,
                    label: '[0xD102] = 1 (CW 방향) 설정',
                    verifyAfterWrite: true,
                    expectAfterWrite: 1
                },
                {
                    type: 'wait_countdown',
                    seconds: 3,
                    message: 'CW 방향 구동 확인 (시각 확인 또는 FG 신호 확인)'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD102,
                    value: 0,
                    label: '[0xD102] = 0 (CCW 방향) 설정',
                    verifyAfterWrite: true,
                    expectAfterWrite: 0
                },
                {
                    type: 'wait_countdown',
                    seconds: 3,
                    message: 'CCW 방향 구동 확인'
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD102,
                    from: 'directionBackup',
                    label: '원래 방향 값 복원 [0xD102]'
                }
            ]
        },

        // ── 3-4. EEPROM Save ──────────────────────────────────────────────────
        'basic-eeprom': {
            id: 'basic-eeprom',
            category: '기본동작',
            number: '3-4',
            title: 'EEPROM Save',
            description: '파라미터 저장 명령 처리 검증',
            purpose: '파라미터를 변경한 후 Store Parameters 명령으로 EEPROM에 저장하고, ' +
                     '전원 재투입 후 변경된 값이 유지되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: '전원 재투입 후 저장된 파라미터 값 유지 확인',
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
                    value: 500,
                    label: 'Setpoint [0xD001] = 500 쓰기 (저장 전 테스트 값)'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0x1010,
                    value: 0x6576,   // 'ev' (0x65766173 = "evas" — 상위 16bit)
                    label: 'Store Parameters [0x1010:01] 쓰기 — 0x65766173 ("evas")\n' +
                           '※ 32-bit 명령은 FC10으로 전송 필요 — softFail 처리',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 10,
                    message: '전원 재투입 후 10초 대기 — 재투입 후 Setpoint = 500 유지 여부 확인'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: '전원 재투입 후 Setpoint [0xD001] 읽기 — 500 유지 확인',
                    expect: 500,
                    softMatch: true
                }
            ]
        },

        // ── 3-5. DCLink V ─────────────────────────────────────────────────────
        'basic-dclink': {
            id: 'basic-dclink',
            category: '기본동작',
            number: '3-5',
            title: 'DCLink Voltage 읽기',
            description: 'DC 링크 전압 센싱 정상 여부 검증',
            purpose: 'DC Link Voltage 레지스터를 읽어 실측 전압과 일치하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (540Vdc 인가), USB to RS485 Converter, DC 전압계',
            criteria: 'DC Link Voltage [0x2605] 읽기 값이 실측 540Vdc의 ±5V 이내',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인 (540Vdc 인가 상태)' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x2605,
                    label: 'DC Link Voltage [0x2605] 읽기\n' +
                           '→ 540Vdc 입력 시 읽기 값 ±5V 이내이면 합격',
                    storeAs: 'dcLinkVoltage'
                }
            ]
        },

        // ── 3-6. Board 온도 ───────────────────────────────────────────────────
        'basic-board-temp': {
            id: 'basic-board-temp',
            category: '기본동작',
            number: '3-6',
            title: 'Board 온도 읽기',
            description: '드라이브 기판 온도 센싱 검증',
            purpose: '드라이브 기판 온도(Drive Temperature) 레지스터를 읽어 실내 온도 범위 내에 있는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'Board 온도 [0x260A] 읽기 값이 실내온도 기준 0~50℃ 범위 내',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x260A,
                    label: 'Drive Temperature [0x260A] 읽기\n' +
                           '→ 정상 실내 환경 기준 0~50℃ 범위이면 합격',
                    storeAs: 'boardTemp'
                }
            ]
        },

        // ── 3-7. IGBT 온도 ────────────────────────────────────────────────────
        'basic-igbt-temp': {
            id: 'basic-igbt-temp',
            category: '기본동작',
            number: '3-7',
            title: 'IGBT 온도 읽기',
            description: 'IGBT 모듈 온도 센싱 검증',
            purpose: 'IGBT 모듈 온도 레지스터를 읽어 실내 온도 범위 내에 있는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'IGBT Temp [0x260B] 읽기 값이 0~35℃ 범위 내',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0x260B,
                    label: 'IGBT Temperature [0x260B] 읽기\n' +
                           '→ 0~35℃ 범위이면 합격',
                    storeAs: 'igbtTemp'
                }
            ]
        },

        // ── 3-8. 펌웨어 버전 (MAIN / MAIN Boot) ──────────────────────────────
        'basic-fw-main': {
            id: 'basic-fw-main',
            category: '기본동작',
            number: '3-8',
            title: '펌웨어 버전 확인 (MAIN / MAIN Boot)',
            description: 'Main MCU 및 Boot 버전 레지스터 읽기 검증',
            purpose: 'Main MCU SW 버전 및 Boot 버전 레지스터를 읽어 기준 버전과 일치하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'Main SW Ver [0x2613] 및 Main Boot Ver 읽기 — 기준 버전과 일치',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0x2613,
                    label: 'Main MCU SW Version [0x2613] 읽기',
                    storeAs: 'mainSwVer'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0x2614,
                    label: 'Main MCU Boot Version [0x2614] 읽기\n' +
                           '※ 레지스터 주소 펌웨어 파라미터 맵 확인 필요',
                    storeAs: 'mainBootVer',
                    softFail: true
                }
            ]
        },

        // ── 3-9. 펌웨어 버전 (INVERTER / INVERTER Boot) ──────────────────────
        'basic-fw-inv': {
            id: 'basic-fw-inv',
            category: '기본동작',
            number: '3-9',
            title: '펌웨어 버전 확인 (INVERTER / INVERTER Boot)',
            description: 'Inverter MCU 및 Boot 버전 레지스터 읽기 검증',
            purpose: 'Inverter MCU SW 버전 및 Boot 버전 레지스터를 읽어 기준 버전과 일치하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'Inverter SW Ver [0x100A] 읽기 — 기준 버전과 일치',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0x100A,
                    label: 'Inverter MCU SW Version [0x100A] 읽기',
                    storeAs: 'invSwVer'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0x100B,
                    label: 'Inverter MCU Boot Version [0x100B] 읽기\n' +
                           '※ 레지스터 주소 펌웨어 파라미터 맵 확인 필요',
                    storeAs: 'invBootVer',
                    softFail: true
                }
            ]
        },

        // ── 3-10-1. Main OS 다운로드 ──────────────────────────────────────────
        'basic-dl-main': {
            id: 'basic-dl-main',
            category: '기본동작',
            number: '3-10-1',
            title: 'Main OS 다운로드',
            description: 'Main MCU 펌웨어 다운로드 기능 검증',
            purpose: 'GUI의 펌웨어 다운로드 기능을 통해 Main MCU OS를 정상적으로 다운로드할 수 있는지 확인한다. ' +
                     '다운로드 완료 후 SW 버전이 업데이트되는지 검증한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter, Main OS 바이너리 파일',
            criteria: 'Main OS 다운로드 완료 후 SW 버전 레지스터 값 변경 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0x2613,
                    label: '다운로드 전 Main SW Version [0x2613] 읽기 (기준값 기록)',
                    storeAs: 'mainSwVerBefore'
                },
                {
                    type: 'wait_countdown',
                    seconds: 1,
                    message: 'GUI Firmware Download 메뉴 → Main OS 파일 선택 → 다운로드 실행\n' +
                             '다운로드가 완료되면 테스트를 계속 진행하세요.'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0x2613,
                    label: '다운로드 후 Main SW Version [0x2613] 재읽기 — 버전 변경 확인',
                    storeAs: 'mainSwVerAfter',
                    softFail: true
                }
            ]
        },

        // ── 3-10-2. Inverter OS 다운로드 ──────────────────────────────────────
        'basic-dl-inv': {
            id: 'basic-dl-inv',
            category: '기본동작',
            number: '3-10-2',
            title: 'Inverter OS 다운로드',
            description: 'Inverter MCU 펌웨어 다운로드 기능 검증',
            purpose: 'GUI의 펌웨어 다운로드 기능을 통해 Inverter MCU OS를 정상적으로 다운로드할 수 있는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter, Inverter OS 바이너리 파일',
            criteria: 'Inverter OS 다운로드 완료 후 SW 버전 레지스터 값 변경 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0x100A,
                    label: '다운로드 전 Inverter SW Version [0x100A] 읽기 (기준값 기록)',
                    storeAs: 'invSwVerBefore'
                },
                {
                    type: 'wait_countdown',
                    seconds: 1,
                    message: 'GUI Firmware Download 메뉴 → Inverter OS 파일 선택 → 다운로드 실행\n' +
                             '다운로드가 완료되면 테스트를 계속 진행하세요.'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0x100A,
                    label: '다운로드 후 Inverter SW Version [0x100A] 재읽기 — 버전 변경 확인',
                    storeAs: 'invSwVerAfter',
                    softFail: true
                }
            ]
        },

        // ── 3-10-3. OS 다운로드 중 분리 예외처리 ───────────────────────────────
        'basic-dl-except': {
            id: 'basic-dl-except',
            category: '기본동작',
            number: '3-10-3',
            title: 'OS 다운로드 중 분리 예외처리',
            description: '다운로드 중단 처리 및 복구 검증',
            purpose: 'OS 다운로드 진행 중 USB 연결을 강제로 해제했을 때 시스템이 안전하게 ' +
                     '복구(재다운로드 가능)되는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter, OS 바이너리 파일',
            criteria: '다운로드 중 분리 후 재연결 시 정상 부팅 또는 재다운로드 진입 확인',
            steps: [
                { type: 'check_connection', label: 'EC FAN 연결 상태 확인' },
                {
                    type: 'wait_countdown',
                    seconds: 1,
                    message: 'GUI Firmware Download 메뉴 → OS 다운로드 시작\n' +
                             '다운로드 진행 중(30~50% 진행 시점) USB를 강제로 분리하세요.'
                },
                {
                    type: 'wait_countdown',
                    seconds: 5,
                    message: 'USB 분리 후 5초 대기 — 드라이브 상태 확인 (LED 점멸 등)'
                },
                {
                    type: 'wait_countdown',
                    seconds: 1,
                    message: 'USB 재연결 후 드라이브 응답 확인'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: '재연결 후 통신 가능 여부 확인 — [0xD001] 읽기',
                    softFail: true,
                    storeAs: 'reconnect_check'
                }
            ]
        }

    }

});
