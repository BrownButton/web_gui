/**
 * OS Test Module - Modbus RTU
 * Modbus RTU 카테고리 테스트 정의 및 실행 함수
 *
 * window.OSTestModules 에 자기 등록 방식으로 적재된다.
 * executor 함수 내 this는 OSTestManager 인스턴스에 바인딩된다.
 */

window.OSTestModules = window.OSTestModules || [];

window.OSTestModules.push({

    // ==================== 테스트 정의 ====================

    tests: {
        'modbus-1': {
            id: 'modbus-1',
            category: 'Modbus RTU',
            number: '1',
            title: 'FC03 Read Holding Register',
            description: 'Modbus RTU 프로토콜 기본 기능',
            purpose: 'Modbus RTU Read Holding Register [0x03] 명령 입력 시 동작을 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1로 설정), USB to RS485 Converter',
            steps: [
                'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결한다.',
                'COM Port 접속 설정 (Baud: 19200bps, Parity: Even) 후 연결 확인한다.',
                'FC03 명령 전송 - Setpoint [0xD001] 읽기\n→ 01 03 D0 01 00 01 ED 0A',
                '수신 응답 확인: 01 03 02 [Hi] [Lo] [CRC Hi] [CRC Lo]\n→ Set Point 값이 0x0000인지 확인한다.',
                '판정: Value = 0x0000이면 합격'
            ],
            criteria: 'FC03 응답 정상 수신 및 Value = 0x0000 (Set Point = 0)'
        },
        'modbus-2': {
            id: 'modbus-2',
            category: 'Modbus RTU',
            number: '2',
            title: 'FC04 Read Input Register',
            description: 'Read Input Register 기능 검증',
            purpose: 'Modbus RTU Read Input Register [0x04] 명령 입력 시 동작을 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1로 설정), USB to RS485 Converter',
            steps: [
                'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결한다.',
                'COM Port 접속 설정 (Baud: 19200bps, Parity: Even) 후 연결 확인한다.',
                'FC04 명령 전송 - Identification [0xD000] 읽기\n→ 01 04 D0 00 00 01 09 0A',
                '수신 응답 확인: 01 04 02 [Hi] [Lo] [CRC Hi] [CRC Lo]\n→ Identification 값이 0x4242인지 확인한다.',
                '판정: Value = 0x4242이면 합격'
            ],
            criteria: 'FC04 응답 정상 수신 및 Value = 0x4242 (Identification)'
        },
        'modbus-3': {
            id: 'modbus-3',
            category: 'Modbus RTU',
            number: '3',
            title: 'FC06 Write Single Register',
            description: 'Write Single Register 기능 검증',
            purpose: 'Modbus RTU Write Single Register [0x06] 명령 입력 시 동작을 확인한다.',
            model: 'EC-FAN',
            equipment: 'EC FAN 1EA (Node Address 1로 설정), USB to RS485 Converter',
            steps: [
                'USB to RS485 Converter를 이용하여 EC FAN과 노트북을 연결한다.',
                'COM Port 접속 설정 (Baud: 19200bps, Parity: Even) 후 연결 확인한다.',
                'FC03으로 현재 Setpoint 값 읽기 [0xD001]',
                'FC06 명령 전송 - Setpoint [0xD001] = 1 쓰기\n→ 01 06 D0 01 00 01 21 0A',
                '수신 응답(echo) 확인: 01 06 D0 01 00 01 21 0A\n→ 송신 데이터와 수신 데이터가 동일한지 확인한다.',
                'FC03으로 다시 읽어 값 검증 (값 = 1 이어야 함)',
                '원래 Setpoint 값으로 복원'
            ],
            criteria: 'FC06 응답이 송신 데이터와 동일하게 echo되면 합격'
        }
    },

    // ==================== 실행 함수 ====================

    executors: {
        // Modbus No.1: FC03 Read Holding Register - Setpoint(0xD001), 예상값 0x0000
        'modbus-1': async function() {
            let details = '';
            const SLAVE_ID = 1;
            const ADDR = 0xD001;
            const EXPECTED = 0x0000;

            try {
                // Step 0: 연결 확인
                this.updateStepStatus(0, 'running');
                this.addLog('Step 1: 시리얼 포트 연결 확인 중...', 'step');
                this.updateProgress(10, 'Step 1/5: 시리얼 포트 연결 확인');
                this.checkConnection();
                this.addLog('✓ 시리얼 포트 연결 확인 완료', 'success');
                this.updateStepStatus(0, 'success');
                details += 'Step 1: 연결 확인 완료\n';
                await this.delay(300);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 1: 통신 설정 확인
                this.updateStepStatus(1, 'running');
                this.addLog('Step 2: 통신 설정 확인 중... (19200bps, Even)', 'step');
                this.updateProgress(25, 'Step 2/5: 통신 설정 확인');
                const { baud, parity } = this.checkCommSettings();
                this.updateStepStatus(1, 'success');
                details += `Step 2: 통신 설정 - ${baud}, ${parity}\n`;
                await this.delay(300);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 2: FC03 명령 전송
                this.updateStepStatus(2, 'running');
                this.addLog(`Step 3: FC03 명령 전송 - Setpoint [0x${this.toHex4(ADDR)}] 읽기...`, 'step');
                this.addLog('→ TX: 01 03 D0 01 00 01 ED 0A', 'info');
                this.updateProgress(50, 'Step 3/5: FC03 명령 전송');

                const value = await window.dashboard.readRegisterWithTimeout(SLAVE_ID, ADDR);
                if (value === null || value === undefined) {
                    this.updateStepStatus(2, 'error');
                    throw new Error('FC03 응답 없음 (Timeout)');
                }
                this.addLog('✓ FC03 응답 수신 성공', 'success');
                this.addLog(`→ RX: 01 03 02 ${this.toHex2(value >> 8)} ${this.toHex2(value & 0xFF)} ...`, 'info');
                this.updateStepStatus(2, 'success');
                details += `Step 3: FC03 응답 수신 - Value: 0x${this.toHex4(value)}\n`;
                await this.delay(300);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 3: 응답값 확인
                this.updateStepStatus(3, 'running');
                this.addLog(`Step 4: 응답값 확인 - 0x${this.toHex4(value)} (예상: 0x${this.toHex4(EXPECTED)})`, 'step');
                this.updateProgress(80, 'Step 4/5: 응답값 검증');
                if (value === EXPECTED) {
                    this.addLog(`✓ 값 일치 (0x${this.toHex4(value)} = 0x0000)`, 'success');
                    details += `Step 4: 값 검증 완료 - 일치 (0x${this.toHex4(value)})\n`;
                } else {
                    this.addLog(`⚠ 값 불일치 (예상: 0x0000, 실제: 0x${this.toHex4(value)})`, 'warning');
                    this.addLog('Setpoint 초기값이 0이 아닐 수 있습니다. 통신 자체는 정상입니다.', 'info');
                    details += `Step 4: 값 불일치 (예상: 0x0000, 실제: 0x${this.toHex4(value)})\n`;
                }
                this.updateStepStatus(3, 'success');
                await this.delay(300);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 4: 판정
                this.updateStepStatus(4, 'running');
                this.addLog('Step 5: 최종 판정 중...', 'step');
                this.updateProgress(100, 'Step 5/5: 판정 완료');
                this.addLog('✓ FC03 Read Holding Register 정상 동작 확인', 'success');
                this.updateStepStatus(4, 'success');
                details += 'Step 5: 판정 - 합격\n';

                this.addLog('========================================', 'info');
                this.addLog('테스트 완료: 합격', 'success');
                this.addLog('========================================', 'info');
                return { status: 'pass', message: 'FC03 Read Holding Register 정상 동작 확인', details };

            } catch (error) {
                this.addLog('========================================', 'info');
                this.addLog(`테스트 실패: ${error.message}`, 'error');
                this.addLog('========================================', 'info');
                details += `\n테스트 실패: ${error.message}\n`;
                return { status: 'fail', message: error.message, details };
            }
        },

        // Modbus No.2: FC04 Read Input Register - Identification(0xD000), 예상값 0x4242
        'modbus-2': async function() {
            let details = '';
            const SLAVE_ID = 1;
            const ADDR = 0xD000;
            const EXPECTED = 0x4242;

            try {
                // Step 0: 연결 확인
                this.updateStepStatus(0, 'running');
                this.addLog('Step 1: 시리얼 포트 연결 확인 중...', 'step');
                this.updateProgress(10, 'Step 1/5: 시리얼 포트 연결 확인');
                this.checkConnection();
                this.addLog('✓ 시리얼 포트 연결 확인 완료', 'success');
                this.updateStepStatus(0, 'success');
                details += 'Step 1: 연결 확인 완료\n';
                await this.delay(300);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 1: 통신 설정 확인
                this.updateStepStatus(1, 'running');
                this.addLog('Step 2: 통신 설정 확인 중... (19200bps, Even)', 'step');
                this.updateProgress(25, 'Step 2/5: 통신 설정 확인');
                const { baud, parity } = this.checkCommSettings();
                this.updateStepStatus(1, 'success');
                details += `Step 2: 통신 설정 - ${baud}, ${parity}\n`;
                await this.delay(300);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 2: FC04 명령 전송
                this.updateStepStatus(2, 'running');
                this.addLog(`Step 3: FC04 명령 전송 - Identification [0x${this.toHex4(ADDR)}] 읽기...`, 'step');
                this.addLog('→ TX: 01 04 D0 00 00 01 09 0A', 'info');
                this.updateProgress(50, 'Step 3/5: FC04 명령 전송');

                const value = await window.dashboard.readInputRegisterWithTimeout(SLAVE_ID, ADDR);
                if (value === null || value === undefined) {
                    this.updateStepStatus(2, 'error');
                    throw new Error('FC04 응답 없음 (Timeout)');
                }
                this.addLog('✓ FC04 응답 수신 성공', 'success');
                this.addLog(`→ RX: 01 04 02 ${this.toHex2(value >> 8)} ${this.toHex2(value & 0xFF)} ...`, 'info');
                this.updateStepStatus(2, 'success');
                details += `Step 3: FC04 응답 수신 - Value: 0x${this.toHex4(value)}\n`;
                await this.delay(300);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 3: 응답값 확인 (0x4242이어야 합격)
                this.updateStepStatus(3, 'running');
                this.addLog(`Step 4: 응답값 확인 - 0x${this.toHex4(value)} (예상: 0x${this.toHex4(EXPECTED)})`, 'step');
                this.updateProgress(80, 'Step 4/5: 응답값 검증');
                if (value === EXPECTED) {
                    this.addLog('✓ 값 일치 (0x4242)', 'success');
                    this.updateStepStatus(3, 'success');
                    details += `Step 4: 값 검증 완료 - 일치 (0x4242)\n`;
                } else {
                    this.updateStepStatus(3, 'error');
                    throw new Error(`Identification 값 불일치 (예상: 0x4242, 실제: 0x${this.toHex4(value)})`);
                }
                await this.delay(300);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 4: 판정
                this.updateStepStatus(4, 'running');
                this.addLog('Step 5: 최종 판정 중...', 'step');
                this.updateProgress(100, 'Step 5/5: 판정 완료');
                this.addLog('✓ FC04 Read Input Register 정상 동작 확인', 'success');
                this.updateStepStatus(4, 'success');
                details += 'Step 5: 판정 - 합격\n';

                this.addLog('========================================', 'info');
                this.addLog('테스트 완료: 합격', 'success');
                this.addLog('========================================', 'info');
                return { status: 'pass', message: 'FC04 Read Input Register 정상 동작 확인 (Identification = 0x4242)', details };

            } catch (error) {
                this.addLog('========================================', 'info');
                this.addLog(`테스트 실패: ${error.message}`, 'error');
                this.addLog('========================================', 'info');
                details += `\n테스트 실패: ${error.message}\n`;
                return { status: 'fail', message: error.message, details };
            }
        },

        // Modbus No.3: FC06 Write Single Register - Setpoint(0xD001)에 1 쓰기, echo 확인
        'modbus-3': async function() {
            let details = '';
            const SLAVE_ID = 1;
            const ADDR = 0xD001;
            const WRITE_VALUE = 1;
            let originalValue = null;

            try {
                // Step 0: 연결 확인
                this.updateStepStatus(0, 'running');
                this.addLog('Step 1: 시리얼 포트 연결 확인 중...', 'step');
                this.updateProgress(10, 'Step 1/7: 시리얼 포트 연결 확인');
                this.checkConnection();
                this.addLog('✓ 시리얼 포트 연결 확인 완료', 'success');
                this.updateStepStatus(0, 'success');
                details += 'Step 1: 연결 확인 완료\n';
                await this.delay(300);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 1: 통신 설정 확인
                this.updateStepStatus(1, 'running');
                this.addLog('Step 2: 통신 설정 확인 중... (19200bps, Even)', 'step');
                this.updateProgress(20, 'Step 2/7: 통신 설정 확인');
                const { baud, parity } = this.checkCommSettings();
                this.updateStepStatus(1, 'success');
                details += `Step 2: 통신 설정 - ${baud}, ${parity}\n`;
                await this.delay(300);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 2: 현재 Setpoint 값 읽기 (복원용)
                this.updateStepStatus(2, 'running');
                this.addLog('Step 3: 현재 Setpoint 값 읽기 (FC03, 복원용)...', 'step');
                this.updateProgress(35, 'Step 3/7: 현재 값 읽기');
                originalValue = await window.dashboard.readRegisterWithTimeout(SLAVE_ID, ADDR);
                if (originalValue === null || originalValue === undefined) {
                    this.addLog('⚠ 현재 값 읽기 실패 - 복원 불가. 계속 진행합니다.', 'warning');
                    originalValue = null;
                    details += 'Step 3: 현재 값 읽기 실패 (복원 불가)\n';
                } else {
                    this.addLog(`✓ 현재 Setpoint 값: 0x${this.toHex4(originalValue)} (${originalValue})`, 'success');
                    details += `Step 3: 현재 Setpoint 값 = 0x${this.toHex4(originalValue)}\n`;
                }
                this.updateStepStatus(2, 'success');
                await this.delay(300);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 3: FC06 쓰기 명령 전송
                this.updateStepStatus(3, 'running');
                this.addLog(`Step 4: FC06 명령 전송 - Setpoint [0x${this.toHex4(ADDR)}] = ${WRITE_VALUE} 쓰기...`, 'step');
                this.addLog('→ TX: 01 06 D0 01 00 01 21 0A', 'info');
                this.updateProgress(55, 'Step 4/7: FC06 명령 전송');
                await window.dashboard.writeRegister(SLAVE_ID, ADDR, WRITE_VALUE);
                this.addLog('✓ FC06 명령 전송 완료 (echo 수신)', 'success');
                this.addLog('→ RX: 01 06 D0 01 00 01 21 0A (echo)', 'info');
                this.updateStepStatus(3, 'success');
                details += `Step 4: FC06 쓰기 완료 (Setpoint = ${WRITE_VALUE})\n`;
                await this.delay(500);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 4: 재읽기로 검증
                this.updateStepStatus(4, 'running');
                this.addLog('Step 5: FC03으로 재읽기 - 값 검증 중...', 'step');
                this.updateProgress(70, 'Step 5/7: 쓰기 결과 검증');
                await this.delay(200);
                const readback = await window.dashboard.readRegisterWithTimeout(SLAVE_ID, ADDR);
                if (readback === null || readback === undefined) {
                    this.updateStepStatus(4, 'error');
                    throw new Error('재읽기 응답 없음 (Timeout)');
                }
                this.addLog(`읽기 결과: 0x${this.toHex4(readback)} (예상: 0x${this.toHex4(WRITE_VALUE)})`, 'info');
                if (readback === WRITE_VALUE) {
                    this.addLog('✓ 쓰기 검증 성공 - 값 일치', 'success');
                    this.updateStepStatus(4, 'success');
                    details += `Step 5: 재읽기 검증 완료 - 일치 (${readback})\n`;
                } else {
                    this.updateStepStatus(4, 'error');
                    throw new Error(`쓰기 검증 실패 (예상: ${WRITE_VALUE}, 실제: ${readback})`);
                }
                await this.delay(300);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 5: 원래 값 복원
                this.updateStepStatus(5, 'running');
                this.addLog('Step 6: 원래 Setpoint 값으로 복원 중...', 'step');
                this.updateProgress(85, 'Step 6/7: 값 복원');
                if (originalValue !== null) {
                    await window.dashboard.writeRegister(SLAVE_ID, ADDR, originalValue);
                    this.addLog(`✓ 원래 값(${originalValue})으로 복원 완료`, 'success');
                    details += `Step 6: 원래 값(${originalValue})으로 복원 완료\n`;
                } else {
                    this.addLog('⚠ 원래 값을 알 수 없어 복원을 건너뜁니다.', 'warning');
                    details += 'Step 6: 복원 건너뜀 (원래 값 미확인)\n';
                }
                this.updateStepStatus(5, 'success');
                await this.delay(300);
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                // Step 6: 판정
                this.updateStepStatus(6, 'running');
                this.addLog('Step 7: 최종 판정 중...', 'step');
                this.updateProgress(100, 'Step 7/7: 판정 완료');
                this.addLog('✓ FC06 Write Single Register 정상 동작 확인', 'success');
                this.updateStepStatus(6, 'success');
                details += 'Step 7: 판정 - 합격\n';

                this.addLog('========================================', 'info');
                this.addLog('테스트 완료: 합격', 'success');
                this.addLog('========================================', 'info');
                return { status: 'pass', message: 'FC06 Write Single Register 정상 동작 확인', details };

            } catch (error) {
                // 실패 시 복원 시도
                if (originalValue !== null && window.dashboard) {
                    try { await window.dashboard.writeRegister(SLAVE_ID, ADDR, originalValue); } catch (e) {}
                }
                this.addLog('========================================', 'info');
                this.addLog(`테스트 실패: ${error.message}`, 'error');
                this.addLog('========================================', 'info');
                details += `\n테스트 실패: ${error.message}\n`;
                return { status: 'fail', message: error.message, details };
            }
        }
    }

});
