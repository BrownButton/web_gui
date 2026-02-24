/**
 * OS Test Module - RS485
 * RS485 카테고리 테스트 정의
 *
 * window.OSTestModules 에 자기 등록 방식으로 적재된다.
 * steps 배열이 선언형(declarative) 스텝 객체 → OSTestManager 엔진이 자동 실행.
 *
 * [테스트 케이스 추가 방법]
 * 1. tests 객체에 새 항목 추가 (id, category, number, title, ... steps)
 * 2. steps 배열에 스텝 객체 나열 (지원 타입: os-test-manager.js 참조)
 * 3. executors 불필요 — 엔진이 steps 를 자동 실행함
 */

window.OSTestModules = window.OSTestModules || [];

window.OSTestModules.push({

    tests: {
        'rs485-1': {
            id: 'rs485-1',
            category: 'RS485',
            number: '1',
            title: 'Node ID 설정',
            description: 'RS485 통신 기본 기능 검증',
            purpose: '예지보전 툴을 이용해 Node ID 설정이 되는지 확인한다',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA, USB to RS485 Converter, EC FAN Configurator',
            criteria: '설정 Node ID 입력 시 Device, SW Ver, Boot Ver 출력',
            notes: [
                'A) EC Fan Control 프로그램 접속 방법',
                'B) Node ID 설정 방법'
            ],
            steps: [
                {
                    type: 'check_connection',
                    label: 'USB to 485 컨버터를 이용하여 EC FAN과 노트북을 서로 연결하고 포트 접속 상태를 확인한다.'
                },
                {
                    type: 'check_comm_settings',
                    label: 'COM Port 접속 설정 확인 (Baudrate: 19200bps, Parity: Even)\n' +
                           '※ 팬 드라이브 설정과 다를 경우 접속 불가'
                },
                {
                    // Broadcasting ID(0)로 현재 Node ID 읽기 — 장치가 이미 다른 ID일 수 있어 soft fail
                    type: 'read_holding',
                    slaveId: 0,
                    address: 0x2003,
                    label: 'Broadcasting ID(0)로 현재 Node ID 읽기 [0x2003]\n' +
                           '(설정된 Node의 파라미터 갱신 목적)',
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
                    // Save to Memory — 일부 펌웨어에서 지원하지 않을 수 있어 soft fail
                    type: 'write_holding',
                    slaveId: 0,
                    address: 0x2000,
                    value: 0x5555,
                    label: 'Save to Memory — 파라미터 메모리 저장 (0x2000 = 0x5555)',
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
                    // Device 정보는 합격 기준 참고용이므로 soft fail
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD000,
                    label: 'Device 정보 확인 [0xD000]',
                    storeAs: 'deviceInfo',
                    softFail: true
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD001,
                    label: 'SW Ver 확인 [0xD001]',
                    storeAs: 'swVer',
                    softFail: true
                },
                {
                    type: 'read_holding',
                    slaveId: 1,
                    address: 0xD002,
                    label: 'Boot Ver 확인 [0xD002]',
                    storeAs: 'bootVer',
                    softFail: true
                }
            ]
        }
    }

    // executors 불필요 — OSTestManager 선언형 엔진이 steps 를 자동 실행

});
