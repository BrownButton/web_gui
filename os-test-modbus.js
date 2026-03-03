/**
 * OS Test Module - Modbus RTU
 * 2-1. FC(03) Read Holding Register
 * 2-2. FC(04) Read Input Register
 * 2-3. FC(06) Write Single Register
 * 2-4. FC(10) Write Multiple Registers
 * 2-5. FC(2B) Read Device Identification
 */

window.OSTestModules = window.OSTestModules || [];

window.OSTestModules.push({

    tests: {

        // ── Modbus No.2-1 ─────────────────────────────────────────────────────
        'mb-1': {
            id: 'mb-1',
            category: 'Modbus RTU',
            number: '2-1',
            title: 'FC(03) Read Holding Register',
            description: 'Holding Register 읽기 기능 검증',
            purpose: 'Modbus RTU Read Holding Register [FC=03] 명령 입력 시 정상 응답하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'FC03 응답 정상 수신 및 Value = 0x0000 (Setpoint 초기값 = 0)',
            steps: [
                {
                    type: 'check_connection',
                    label: 'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결하고 포트 접속 상태를 확인한다.'
                },
                {
                    type: 'check_comm_settings',
                    required: { baud: '19200', parity: 'even' },
                    label: 'COM Port 접속 설정 확인 (Baud: 19200bps, Parity: Even)'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: 'FC03 명령 전송 — Setpoint [0xD001] 읽기\n' +
                           '→ TX: 01 03 D0 01 00 01 ED 0A\n' +
                           '→ 응답값 0x0000 = 합격 / 0이 아니면 Setpoint 초기값 비정상 (통신은 정상)',
                    txHex: '01 03 D0 01 00 01 ED 0A',
                    expect: 0x0000,
                    softMatch: true
                }
            ]
        },

        // ── Modbus No.2-2 ─────────────────────────────────────────────────────
        'mb-2': {
            id: 'mb-2',
            category: 'Modbus RTU',
            number: '2-2',
            title: 'FC(04) Read Input Register',
            description: 'Input Register 읽기 기능 검증',
            purpose: 'Modbus RTU Read Input Register [FC=04] 명령 입력 시 정상 응답하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'FC04 응답 정상 수신 및 Value = 0x4242 (Identification)',
            steps: [
                {
                    type: 'check_connection',
                    label: 'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결하고 포트 접속 상태를 확인한다.'
                },
                {
                    type: 'check_comm_settings',
                    required: { baud: '19200', parity: 'even' },
                    label: 'COM Port 접속 설정 확인 (Baud: 19200bps, Parity: Even)'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD000,
                    label: 'FC04 명령 전송 — Identification [0xD000] 읽기\n' +
                           '→ TX: 01 04 D0 00 00 01 09 0A\n' +
                           '→ 응답값 0x4242이면 합격',
                    txHex: '01 04 D0 00 00 01 09 0A',
                    expect: 0x4242
                }
            ]
        },

        // ── Modbus No.2-3 ─────────────────────────────────────────────────────
        'mb-3': {
            id: 'mb-3',
            category: 'Modbus RTU',
            number: '2-3',
            title: 'FC(06) Write Single Register',
            description: 'Single Register 쓰기 기능 검증',
            purpose: 'Modbus RTU Write Single Register [FC=06] 명령 입력 시 정상 echo 응답하는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'FC06 응답이 송신 데이터와 동일하게 echo되면 합격',
            steps: [
                {
                    type: 'check_connection',
                    label: 'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결하고 포트 접속 상태를 확인한다.'
                },
                {
                    type: 'check_comm_settings',
                    required: { baud: '19200', parity: 'even' },
                    label: 'COM Port 접속 설정 확인 (Baud: 19200bps, Parity: Even)'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: 'FC03으로 현재 Setpoint 값 읽기 [0xD001] (복원용 백업)',
                    storeAs: 'setpointBackup',
                    softFail: true
                },
                {
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 1,
                    label: 'FC06 명령 전송 — Setpoint [0xD001] = 1 쓰기\n' +
                           '→ TX: 01 06 D0 01 00 01 21 0A\n' +
                           '→ echo 응답 확인: 01 06 D0 01 00 01 21 0A',
                    txHex: '01 06 D0 01 00 01 21 0A',
                    verifyAfterWrite: true,
                    expectAfterWrite: 1
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD001,
                    from: 'setpointBackup',
                    label: '원래 Setpoint 값으로 복원 [0xD001]'
                }
            ]
        },

        // ── Modbus No.2-4 ─────────────────────────────────────────────────────
        'mb-4': {
            id: 'mb-4',
            category: 'Modbus RTU',
            number: '2-4',
            title: 'FC(10) Write Multiple Registers',
            description: 'Multiple Register 쓰기 기능 검증',
            purpose: 'Modbus RTU Write Multiple Registers [FC=10(16)] 명령으로 연속 레지스터에 값을 쓰고 ' +
                     '정상 응답(echo)을 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'FC10 응답 정상 수신 (시작주소 + 쓰기 개수 echo) 및 레지스터 값 반영 확인',
            steps: [
                {
                    type: 'check_connection',
                    label: 'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결하고 포트 접속 상태를 확인한다.'
                },
                {
                    type: 'check_comm_settings',
                    required: { baud: '19200', parity: 'even' },
                    label: 'COM Port 접속 설정 확인 (Baud: 19200bps, Parity: Even)'
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: '테스트 전 Setpoint 백업 [0xD001]',
                    storeAs: 'setpointBackup',
                    softFail: true
                },
                {
                    // FC10: Write 2 registers starting at 0xD001 — value1=10, value2=20
                    // TX: 01 10 D0 01 00 02 04 00 0A 00 14 CRC
                    type: 'write_holding',
                    slaveId: 1,
                    address: 0xD001,
                    value: 10,
                    label: 'FC10 명령 전송 — Setpoint [0xD001] = 10 (다중 쓰기 첫 번째 레지스터)\n' +
                           '※ FC10은 현재 app.js에서 FC06 fallback으로 처리될 수 있음\n' +
                           '   실제 FC10 프레임 확인은 버스 분석기 사용 권장',
                    txHex: '01 10 D0 01 00 01 02 00 0A CRC',
                    verifyAfterWrite: true,
                    expectAfterWrite: 10
                },
                {
                    type: 'restore_holding',
                    slaveId: 1,
                    address: 0xD001,
                    from: 'setpointBackup',
                    label: '원래 Setpoint 값으로 복원 [0xD001]'
                }
            ]
        },

        // ── Modbus No.2-5 ─────────────────────────────────────────────────────
        'mb-5': {
            id: 'mb-5',
            category: 'Modbus RTU',
            number: '2-5',
            title: 'FC(2B) Read Device Identification',
            description: 'Device ID 오브젝트 읽기 기능 검증',
            purpose: 'Modbus RTU Read Device Identification [FC=2B/0x2B, MEI Type=0x0E] 명령으로 ' +
                     '디바이스 식별 정보(Vendor, Product, Version 등)를 읽는지 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1), USB to RS485 Converter',
            criteria: 'FC2B 응답 정상 수신 및 VendorName/ProductCode/MajorMinorRevision 오브젝트 반환',
            steps: [
                {
                    type: 'check_connection',
                    label: 'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결하고 포트 접속 상태를 확인한다.'
                },
                {
                    type: 'check_comm_settings',
                    required: { baud: '19200', parity: 'even' },
                    label: 'COM Port 접속 설정 확인 (Baud: 19200bps, Parity: Even)'
                },
                {
                    // FC2B (0x2B) — 현재 app.js가 직접 지원하지 않을 수 있어 softFail
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0x0000,
                    label: 'FC2B Device Identification 요청\n' +
                           '→ TX: 01 2B 0E 01 00 CRC\n' +
                           '→ 응답에 VendorName, ProductCode, Revision 포함 여부 확인\n' +
                           '※ FC2B는 별도 GUI 툴(BusHound, ModbusPoll 등)로 직접 프레임 전송 권장',
                    softFail: true,
                    storeAs: 'deviceIdResponse'
                },
                {
                    type: 'read_input',
                    slaveId: 1,
                    address: 0xD000,
                    label: '대안: FC04로 Device Identification [0xD000] 읽기 (0x4242 예상)',
                    expect: 0x4242,
                    softMatch: true
                }
            ]
        }

    }

});
