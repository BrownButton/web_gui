/**
 * OS Test Module - Modbus RTU
 * Modbus RTU 카테고리 테스트 정의
 *
 * window.OSTestModules 에 자기 등록 방식으로 적재된다.
 * steps 배열이 선언형(declarative) 스텝 객체 → OSTestManager 엔진이 자동 실행.
 *
 * [테스트 케이스 추가 방법]
 * 1. tests 객체에 새 항목 추가 (id, category, number, title, ... steps)
 * 2. steps 배열에 스텝 객체 나열 (지원 타입: os-test-manager.js 참조)
 * 3. executors 불필요 — 엔진이 steps 를 자동 실행함
 *
 * [자주 쓰는 스텝 패턴]
 *   FC03: { type: 'read_holding',  slaveId: 1, address: 0xXXXX, expect: 0xXXXX }
 *   FC04: { type: 'read_input',    slaveId: 1, address: 0xXXXX, expect: 0xXXXX }
 *   FC06: { type: 'write_holding', slaveId: 1, address: 0xXXXX, value: N, verifyAfterWrite: true }
 *   복원: { type: 'restore_holding', slaveId: 1, address: 0xXXXX, from: 'storedKey' }
 */

window.OSTestModules = window.OSTestModules || [];

window.OSTestModules.push({

    tests: {

        // ── Modbus No.1 ────────────────────────────────────────────────────
        'modbus-1': {
            id: 'modbus-1',
            category: 'Modbus RTU',
            number: '1',
            title: 'FC03 Read Holding Register',
            description: 'Modbus RTU 프로토콜 기본 기능',
            purpose: 'Modbus RTU Read Holding Register [0x03] 명령 입력 시 동작을 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1로 설정), USB to RS485 Converter',
            criteria: 'FC03 응답 정상 수신 및 Value = 0x0000 (Set Point = 0)',
            steps: [
                {
                    type: 'check_connection',
                    label: 'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결하고 포트 접속 상태를 확인한다.'
                },
                {
                    type: 'check_comm_settings',
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
                    softMatch: true     // Setpoint 초기값이 0이 아닐 수 있어 경고만
                }
            ]
        },

        // ── Modbus No.2 ────────────────────────────────────────────────────
        'modbus-2': {
            id: 'modbus-2',
            category: 'Modbus RTU',
            number: '2',
            title: 'FC04 Read Input Register',
            description: 'Read Input Register 기능 검증',
            purpose: 'Modbus RTU Read Input Register [0x04] 명령 입력 시 동작을 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1로 설정), USB to RS485 Converter',
            criteria: 'FC04 응답 정상 수신 및 Value = 0x4242 (Identification)',
            steps: [
                {
                    type: 'check_connection',
                    label: 'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결하고 포트 접속 상태를 확인한다.'
                },
                {
                    type: 'check_comm_settings',
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
                    expect: 0x4242      // strict — 값이 다르면 실패
                }
            ]
        },

        // ── Modbus No.3 ────────────────────────────────────────────────────
        'modbus-3': {
            id: 'modbus-3',
            category: 'Modbus RTU',
            number: '3',
            title: 'FC06 Write Single Register',
            description: 'Write Single Register 기능 검증',
            purpose: 'Modbus RTU Write Single Register [0x06] 명령 입력 시 동작을 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1로 설정), USB to RS485 Converter',
            criteria: 'FC06 응답이 송신 데이터와 동일하게 echo되면 합격',
            steps: [
                {
                    type: 'check_connection',
                    label: 'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결하고 포트 접속 상태를 확인한다.'
                },
                {
                    type: 'check_comm_settings',
                    label: 'COM Port 접속 설정 확인 (Baud: 19200bps, Parity: Even)'
                },
                {
                    // 테스트 후 복원을 위해 현재 값 백업 — 읽기 실패해도 계속 진행
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
                    rxHex: '01 06 D0 01 00 01 21 0A',
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
        }

    }

    // executors 불필요 — OSTestManager 선언형 엔진이 steps 를 자동 실행

});
