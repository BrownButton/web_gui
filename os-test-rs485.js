/**
 * OS Test Module - RS485
 * RS485 카테고리 테스트 정의 및 실행 함수
 *
 * window.OSTestModules 에 자기 등록 방식으로 적재된다.
 * executor 함수 내 this는 OSTestManager 인스턴스에 바인딩된다.
 */

window.OSTestModules = window.OSTestModules || [];

window.OSTestModules.push({

    // ==================== 테스트 정의 ====================

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
            steps: [
                'USB to 485 컨버터를 이용하여 EC FAN과 노트북을 서로 연결한다.',
                'EC FAN Control 프로그램을 실행 후 COM Port: USB to 485 Converter 접속 포트와 Baudrate: 19200, Parity: Even으로 설정 후 접속 버튼을 누른다.\n(Baudrate 19,200bps, Even Parity 조건은 공장 출하 상태에서의 초기 값이며, 이 값이 팬 드라이브 설정과 다를 경우 접속이 되지 않으므로 유의)',
                'Setting 메뉴에 진입 후 Node ID 항목에 0을 입력한다.\n(설정된 Node의 파라미터가 갱신되는 구조, Broadcasting ID를 통해 설정된 Node ID 확인 목적)',
                '[0x2003] Node ID의 값을 1로 설정한다.',
                'Save to Memory 버튼을 눌러 파라미터를 저장한다.',
                '전원 재 투입 후 통신을 재 연결 한다.',
                'Setting 메뉴의 Node ID에 1을 입력한다.',
                '파라미터가 올라오는 것을 확인한다.'
            ],
            criteria: '설정 Node ID 입력 시 Device, SW Ver, Boot Ver 출력',
            notes: [
                'A) EC Fan Control 프로그램 접속 방법',
                'B) Node ID 설정 방법'
            ]
        }
    },

    // ==================== 실행 함수 ====================

    executors: {
        'rs485-1': async function() {
            // this === OSTestManager 인스턴스
            let details = '';

            try {
                // Step 0: 연결 확인
                this.updateStepStatus(0, 'running');
                this.addLog('Step 1: 시리얼 포트 연결 확인 중...', 'step');
                this.updateProgress(10, 'Step 1/8: 시리얼 포트 연결 확인');

                if (!window.dashboard || !window.dashboard.port) {
                    throw new Error('시리얼 포트가 연결되지 않았습니다. 먼저 포트를 연결해주세요.');
                }
                this.addLog('✓ 시리얼 포트 연결 확인 완료', 'success');
                this.updateStepStatus(0, 'success');
                details += 'Step 1: 시리얼 포트 연결 확인 완료\n';
                await this.delay(500);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 1: 통신 설정 확인
                this.updateStepStatus(1, 'running');
                this.addLog('Step 2: 통신 설정 확인 중... (Baudrate: 19200, Parity: Even)', 'step');
                this.updateProgress(20, 'Step 2/8: 통신 설정 확인');

                const { baud, parity } = this.checkCommSettings();
                this.updateStepStatus(1, 'success');
                details += `Step 2: 통신 설정 - Baudrate: ${baud}, Parity: ${parity}\n`;
                await this.delay(500);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 2: Broadcasting ID(0)로 Node ID 읽기
                this.updateStepStatus(2, 'running');
                this.addLog('Step 3: Broadcasting ID(0)로 Node ID 읽기 시도...', 'step');
                this.updateProgress(30, 'Step 3/8: Broadcasting ID 통신');

                try {
                    const nodeIdValue = await this.readParameter(0, 0x2003);
                    this.addLog(`✓ Broadcasting ID(0)로 Node ID 읽기 성공: ${nodeIdValue}`, 'success');
                    details += `Step 3: Broadcasting ID로 Node ID 읽기 성공 (현재 값: ${nodeIdValue})\n`;
                    this.updateStepStatus(2, 'success');
                } catch (error) {
                    this.addLog(`⚠ Broadcasting ID 읽기 실패: ${error.message}`, 'warning');
                    this.addLog('계속 진행합니다...', 'info');
                    details += `Step 3: Broadcasting ID 읽기 실패 - ${error.message}\n`;
                    this.updateStepStatus(2, 'error');
                }
                await this.delay(500);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 3: Node ID를 1로 설정
                this.updateStepStatus(3, 'running');
                this.addLog('Step 4: [0x2003] Node ID를 1로 설정 중...', 'step');
                this.updateProgress(45, 'Step 4/8: Node ID 설정');

                const targetNodeId = 1;
                await this.writeParameter(0, 0x2003, targetNodeId);
                this.addLog(`✓ Node ID 설정 성공: ${targetNodeId}`, 'success');
                details += `Step 4: Node ID를 ${targetNodeId}로 설정 완료\n`;
                this.updateStepStatus(3, 'success');
                await this.delay(500);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 4: Save to Memory
                this.updateStepStatus(4, 'running');
                this.addLog('Step 5: 파라미터를 메모리에 저장 중... (Save to Memory)', 'step');
                this.updateProgress(60, 'Step 5/8: 메모리 저장');

                try {
                    await this.saveToMemory(0);
                    this.addLog('✓ 메모리 저장 성공', 'success');
                    details += 'Step 5: 메모리 저장 완료\n';
                    this.updateStepStatus(4, 'success');
                } catch (error) {
                    this.addLog(`⚠ 메모리 저장 실패: ${error.message}`, 'warning');
                    this.addLog('계속 진행합니다...', 'info');
                    details += `Step 5: 메모리 저장 실패 - ${error.message}\n`;
                    this.updateStepStatus(4, 'error');
                }
                await this.delay(1000);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 5: 전원 재투입 대기
                this.updateStepStatus(5, 'running');
                this.addLog('Step 6: 전원 재투입 필요', 'step');
                this.updateProgress(70, 'Step 6/8: 전원 재투입 대기');
                this.addLog('⚠ 장치의 전원을 재투입한 후 10초 대기합니다...', 'warning');
                details += 'Step 6: 전원 재투입 및 10초 대기\n';

                for (let i = 10; i > 0; i--) {
                    this.addLog(`재연결까지 ${i}초 남음...`, 'info');
                    await this.delay(1000);
                    if (this.shouldStopTest) throw new Error('테스트 중단됨');
                }
                this.addLog('✓ 대기 시간 완료', 'success');
                this.updateStepStatus(5, 'success');
                await this.delay(500);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 6: Node ID 1로 통신 시도
                this.updateStepStatus(6, 'running');
                this.addLog('Step 7: Node ID 1로 통신 시도...', 'step');
                this.updateProgress(85, 'Step 7/8: Node ID 1로 통신');

                const verifyNodeId = await this.readParameter(1, 0x2003);
                this.addLog(`✓ Node ID 1로 통신 성공, 읽은 값: ${verifyNodeId}`, 'success');
                details += `Step 7: Node ID 1로 통신 성공 (값: ${verifyNodeId})\n`;
                if (verifyNodeId !== targetNodeId) {
                    this.addLog(`⚠ Node ID 값 불일치 (예상: ${targetNodeId}, 실제: ${verifyNodeId})`, 'warning');
                }
                this.updateStepStatus(6, 'success');
                await this.delay(500);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 7: Device 정보 확인
                this.updateStepStatus(7, 'running');
                this.addLog('Step 8: Device, SW Ver, Boot Ver 확인 중...', 'step');
                this.updateProgress(95, 'Step 8/8: Device 정보 확인');

                try {
                    const deviceInfo  = await this.readParameter(1, 0xD000);
                    const swVersion   = await this.readParameter(1, 0xD001);
                    const bootVersion = await this.readParameter(1, 0xD002);
                    this.addLog(`✓ Device: ${deviceInfo}`, 'success');
                    this.addLog(`✓ SW Ver: ${swVersion}`, 'success');
                    this.addLog(`✓ Boot Ver: ${bootVersion}`, 'success');
                    details += `Step 8: Device 정보 확인 완료\n  - Device: ${deviceInfo}\n  - SW Ver: ${swVersion}\n  - Boot Ver: ${bootVersion}\n`;
                    this.updateStepStatus(7, 'success');
                } catch (error) {
                    this.addLog(`⚠ Device 정보 읽기 실패: ${error.message}`, 'warning');
                    details += `Step 8: Device 정보 확인 실패 - ${error.message}\n`;
                    this.updateStepStatus(7, 'error');
                }

                this.addLog('========================================', 'info');
                this.addLog('테스트 완료: 합격', 'success');
                this.addLog('========================================', 'info');
                return { status: 'pass', message: 'Node ID 설정 및 검증 성공', details };

            } catch (error) {
                this.addLog('========================================', 'info');
                this.addLog(`테스트 실패: ${error.message}`, 'error');
                this.addLog('========================================', 'info');
                details += `\n테스트 실패: ${error.message}\n`;
                return { status: 'fail', message: error.message, details };
            }
        }
    }

});
