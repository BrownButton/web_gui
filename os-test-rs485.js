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
        'rs-1': {
            id: 'rs-1',
            category: 'RS485',
            number: '1-1',
            title: '기본 연결 동작 시험 및 Baudrate, Parity 변경',
            description: 'RS485 기본 통신 기능 검증',
            purpose: '기본 Baudrate(19200) / Parity(Even) 설정에서 통신이 정상 동작하는지 확인하고, ' +
                     'Baudrate 및 Parity 변경 후에도 재접속하여 통신이 성공하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter',
            criteria: '기본 설정 및 변경된 Baudrate/Parity 환경 모두에서 FC03 응답 정상 수신',
            steps: [
                {
                    type: 'check_connection',
                    label: 'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결하고 포트 접속 상태를 확인한다.'
                },
                {
                    type: 'check_comm_settings',
                    required: { baud: '19200', parity: 'even' },
                    label: '통신 설정 확인: Baudrate 19200bps, Parity Even\n' +
                           '※ 드라이브 기본 설정값 — 불일치 시 접속 불가'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: '[기본 설정] FC03 통신 확인 — Setpoint [0xD001] 읽기',
                    storeAs: 'setpoint_default',
                    softFail: true
                },
                {
                    // Baudrate 변경 테스트: 38400으로 변경 후 확인 (softFail — 펌웨어 미지원 시 경고만)
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0x2008,   // Baudrate 설정 레지스터 (펌웨어 확인 필요)
                    value: 3,          // 3 = 38400 (펌웨어 정의에 따라 변경 필요)
                    label: 'Baudrate 변경 테스트 — [0x2008] = 3 (38400bps) 쓰기\n' +
                           '※ 레지스터 주소 및 값은 펌웨어 파라미터 맵 참조',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 5,
                    message: 'GUI 통신 설정을 38400bps로 변경 후 재접속하여 통신을 확인하세요.'
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0x2008,
                    value: 1,          // 1 = 19200 (기본값으로 복원)
                    label: 'Baudrate 기본값 복원 — [0x2008] = 1 (19200bps)',
                    softFail: true
                },
                {
                    type: 'wait_countdown',
                    seconds: 5,
                    message: 'GUI 통신 설정을 19200bps로 복원 후 재접속하세요.'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: '[복원 후] 기본 설정으로 FC03 통신 재확인',
                    softFail: true
                }
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

    }

});
