/**
 * OS Test Manager - Base Class
 * Manufacture 탭의 OS 검증 테스트를 관리하는 기본 클래스
 *
 * 테스트 모듈은 각 카테고리별 파일(os-test-rs485.js, os-test-modbus.js 등)에
 * 정의되어 window.OSTestModules 배열에 자기 등록 방식으로 적재된다.
 *
 * 로딩 순서: os-test-manager.js → os-test-*.js → app.js
 */

// 각 모듈 파일이 자신의 테스트를 등록하는 전역 레지스트리
window.OSTestModules = window.OSTestModules || [];

class OSTestManager {
    constructor() {
        this.tests = {};
        this.executors = {};

        // 모듈 파일들이 등록한 테스트/실행함수를 병합
        window.OSTestModules.forEach(module => {
            Object.assign(this.tests, module.tests);
            Object.assign(this.executors, module.executors);
        });

        this.results = this.loadResults();
        this.currentTest = null;
        this.isTestRunning = false;
        this.shouldStopTest = false;
        this.currentStepIndex = 0;
    }

    // ==================== 결과 저장/로드 ====================

    loadResults() {
        const saved = localStorage.getItem('osTestResults');
        return saved ? JSON.parse(saved) : {};
    }

    saveResults() {
        localStorage.setItem('osTestResults', JSON.stringify(this.results));
    }

    getTest(testId) {
        return this.tests[testId];
    }

    getTestResult(testId) {
        return this.results[testId];
    }

    setTestResult(testId, result, notes = '') {
        this.results[testId] = {
            result: result,
            notes: notes,
            timestamp: new Date().toISOString(),
            completedSteps: result === 'pass' ? (this.tests[testId]?.steps.length || 0) : 0
        };
        this.saveResults();
        this.updateTestStatus();
    }

    // ==================== UI 상태 업데이트 ====================

    updateTestStatus() {
        const total = Object.keys(this.tests).length;
        const passed = Object.values(this.results).filter(r => r.result === 'pass').length;
        const failed = Object.values(this.results).filter(r => r.result === 'fail').length;
        const pending = total - passed - failed;
        const progress = total > 0 ? Math.round((passed / total) * 100) : 0;

        const totalEl = document.getElementById('osTestTotal');
        const passedEl = document.getElementById('osTestPassed');
        const failedEl = document.getElementById('osTestFailed');
        const pendingEl = document.getElementById('osTestPending');
        const progressEl = document.getElementById('osTestProgress');

        if (totalEl) totalEl.textContent = total;
        if (passedEl) passedEl.textContent = passed;
        if (failedEl) failedEl.textContent = failed;
        if (pendingEl) pendingEl.textContent = pending;
        if (progressEl) progressEl.textContent = progress + '%';

        Object.keys(this.tests).forEach(testId => {
            const testItem = document.querySelector(`.os-test-item[data-test-id="${testId}"]`);
            if (!testItem) return;
            const badge = testItem.querySelector('.test-status-badge');
            const result = this.results[testId];
            if (!badge) return;
            if (result?.result === 'pass') {
                badge.textContent = 'Passed';
                badge.style.background = '#d4edda';
                badge.style.color = '#155724';
            } else if (result?.result === 'fail') {
                badge.textContent = 'Failed';
                badge.style.background = '#f8d7da';
                badge.style.color = '#721c24';
            } else {
                badge.textContent = 'Pending';
                badge.style.background = '#e9ecef';
                badge.style.color = '#6c757d';
            }
        });
    }

    expandTestItem(testId) {
        const test = this.getTest(testId);
        if (!test) return;

        const testItem = document.querySelector(`.os-test-item[data-test-id="${testId}"]`);
        if (!testItem) return;

        const testContent = testItem.querySelector('.os-test-content');
        const expandIcon = testItem.querySelector('.test-expand-icon');
        const isExpanded = testContent.style.display === 'block';

        // 다른 항목 모두 닫기
        document.querySelectorAll('.os-test-item').forEach(item => {
            const content = item.querySelector('.os-test-content');
            const icon = item.querySelector('.test-expand-icon');
            if (content?.style.display === 'block') {
                content.style.display = 'none';
                if (icon) icon.style.transform = 'rotate(0deg)';
            }
        });

        if (!isExpanded) {
            this.currentTest = testId;
            this.currentStepIndex = 0;
            this.isTestRunning = false;
            this.shouldStopTest = false;
            const result = this.getTestResult(testId);

            // 단계 목록 렌더링
            const stepsList = testItem.querySelector('.test-steps-list');
            if (stepsList) {
                stepsList.innerHTML = '';
                test.steps.forEach((step, index) => {
                    const stepDiv = document.createElement('div');
                    stepDiv.id = `test-step-${testId}-${index}`;
                    stepDiv.style.cssText = 'display:flex;gap:12px;align-items:flex-start;padding:8px 12px;background:#f8f9fa;border-radius:4px;';
                    stepDiv.innerHTML = `
                        <div class="step-status" style="margin-top:2px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#e9ecef;color:#6c757d;font-size:11px;font-weight:600;">${index + 1}</div>
                        <div style="flex:1;"><div style="font-size:12px;color:#1a1a1a;line-height:1.5;">${step.replace(/\n/g, '<br>')}</div></div>
                    `;
                    stepsList.appendChild(stepDiv);
                });
            }

            const startBtn = testItem.querySelector('.test-start-btn');
            const stopBtn = testItem.querySelector('.test-stop-btn');
            const progressBar = testItem.querySelector('.test-progress-bar');
            const progressText = testItem.querySelector('.test-progress-text');

            if (startBtn) startBtn.style.display = 'inline-block';
            if (stopBtn) stopBtn.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';
            if (progressText) progressText.textContent = '테스트를 시작하려면 Start Test 버튼을 클릭하세요';

            this.clearLog(testId);

            const notesTextarea = testItem.querySelector('.test-notes');
            if (notesTextarea) {
                notesTextarea.value = result?.notes || '';
            }

            const resultDisplay = testItem.querySelector('.test-result-display');
            const resultPending = testItem.querySelector('.test-result-pending');
            if (result) {
                this.displayTestResult(result.result, { timestamp: result.timestamp, notes: result.notes }, testId);
            } else {
                if (resultDisplay) resultDisplay.style.display = 'none';
                if (resultPending) resultPending.style.display = 'block';
            }

            testContent.style.display = 'block';
            expandIcon.style.transform = 'rotate(180deg)';
            setTimeout(() => testItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
        } else {
            testContent.style.display = 'none';
            expandIcon.style.transform = 'rotate(0deg)';
            this.currentTest = null;
        }
    }

    // ==================== 로그 ====================

    addLog(message, type = 'info') {
        if (!this.currentTest) return;
        const testItem = document.querySelector(`.os-test-item[data-test-id="${this.currentTest}"]`);
        if (!testItem) return;
        const logContainer = testItem.querySelector('.test-log-container');
        if (!logContainer) return;

        const colors = { success: '#4ade80', error: '#f87171', warning: '#fbbf24', step: '#60a5fa' };
        const prefixes = { success: '[SUCCESS]', error: '[ERROR]', warning: '[WARNING]', step: '[STEP]' };
        const color = colors[type] || '#d4d4d4';
        const prefix = prefixes[type] || '[INFO]';
        const timestamp = new Date().toLocaleTimeString('ko-KR', { hour12: false });

        const logEntry = document.createElement('div');
        logEntry.style.marginBottom = '4px';
        logEntry.innerHTML = `<span style="color:#6c757d;">[${timestamp}]</span> <span style="color:${color};">${prefix}</span> ${message}`;
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    clearLog(testId = null) {
        const id = testId || this.currentTest;
        if (!id) return;
        const testItem = document.querySelector(`.os-test-item[data-test-id="${id}"]`);
        const logContainer = testItem?.querySelector('.test-log-container');
        if (logContainer) {
            logContainer.innerHTML = '<div style="color:#6c757d;">테스트 로그가 여기에 표시됩니다...</div>';
        }
    }

    // ==================== 단계/진행 상태 ====================

    updateStepStatus(index, status) {
        if (!this.currentTest) return;
        const stepEl = document.getElementById(`test-step-${this.currentTest}-${index}`);
        if (!stepEl) return;
        const statusEl = stepEl.querySelector('.step-status');

        const styles = {
            running: { bg: '#e0e7ff', border: '#667eea', dot: '#667eea', icon: '⏳' },
            success: { bg: '#d4edda', border: '#28a745', dot: '#28a745', icon: '✓' },
            error:   { bg: '#f8d7da', border: '#dc3545', dot: '#dc3545', icon: '✗' }
        };
        const s = styles[status];
        if (!s) return;
        stepEl.style.background = s.bg;
        stepEl.style.borderLeft = `3px solid ${s.border}`;
        statusEl.style.background = s.dot;
        statusEl.style.color = 'white';
        statusEl.innerHTML = s.icon;
    }

    updateProgress(percent, message) {
        if (!this.currentTest) return;
        const testItem = document.querySelector(`.os-test-item[data-test-id="${this.currentTest}"]`);
        if (!testItem) return;
        const progressBar = testItem.querySelector('.test-progress-bar');
        const progressText = testItem.querySelector('.test-progress-text');
        if (progressBar) progressBar.style.width = percent + '%';
        if (progressText) progressText.textContent = message;
    }

    displayTestResult(result, details = {}, testId = null) {
        const id = testId || this.currentTest;
        if (!id) return;
        const testItem = document.querySelector(`.os-test-item[data-test-id="${id}"]`);
        if (!testItem) return;

        const resultDisplay = testItem.querySelector('.test-result-display');
        const resultPending = testItem.querySelector('.test-result-pending');
        if (resultPending) resultPending.style.display = 'none';
        if (resultDisplay) resultDisplay.style.display = 'block';

        const isPass = result === 'pass';
        const bgColor = isPass ? '#d4edda' : '#f8d7da';
        const borderColor = isPass ? '#28a745' : '#dc3545';
        const textColor = isPass ? '#155724' : '#721c24';

        if (resultDisplay) {
            resultDisplay.innerHTML = `
                <div style="padding:14px;background:${bgColor};border-left:4px solid ${borderColor};border-radius:4px;">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
                        <div style="width:28px;height:28px;background:${borderColor};color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;">${isPass ? '✓' : '✗'}</div>
                        <div style="flex:1;">
                            <div style="font-size:15px;font-weight:600;color:${textColor};">${isPass ? '합격 (PASS)' : '불합격 (FAIL)'}</div>
                            ${details.timestamp ? `<div style="font-size:11px;color:${textColor};opacity:0.8;margin-top:2px;">${new Date(details.timestamp).toLocaleString('ko-KR')}</div>` : ''}
                        </div>
                    </div>
                    ${details.message ? `<div style="font-size:12px;color:${textColor};margin-top:6px;">${details.message}</div>` : ''}
                </div>
            `;
        }
    }

    // ==================== 테스트 실행 제어 ====================

    async executeTest() {
        if (this.isTestRunning) return;
        if (!this.currentTest) return;

        const test = this.getTest(this.currentTest);
        if (!test) return;

        const executor = this.executors[this.currentTest];
        if (!executor) {
            this.addLog(`지원하지 않는 테스트입니다: ${this.currentTest}`, 'error');
            return;
        }

        this.isTestRunning = true;
        this.shouldStopTest = false;
        this.currentStepIndex = 0;

        const testItem = document.querySelector(`.os-test-item[data-test-id="${this.currentTest}"]`);
        const startBtn = testItem?.querySelector('.test-start-btn');
        const stopBtn = testItem?.querySelector('.test-stop-btn');

        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'inline-block';
        this.clearLog();
        this.addLog(`테스트 시작: ${test.title}`, 'info');
        this.updateProgress(0, '테스트 초기화 중...');

        try {
            // executor는 모듈 파일에서 등록된 함수, this 바인딩으로 호출
            const result = await executor.call(this);

            const notesTextarea = testItem?.querySelector('.test-notes');
            const notes = notesTextarea ? notesTextarea.value : '';
            this.setTestResult(this.currentTest, result.status, notes + '\n\n' + result.details);

            this.displayTestResult(result.status, {
                timestamp: new Date().toISOString(),
                message: result.message
            });

            this.addLog(`테스트 완료: ${result.status === 'pass' ? '합격' : '불합격'}`, result.status === 'pass' ? 'success' : 'error');
            this.updateProgress(100, `테스트 완료: ${result.status === 'pass' ? '합격' : '불합격'}`);

        } catch (error) {
            this.addLog(`테스트 실행 중 오류 발생: ${error.message}`, 'error');
            this.updateProgress(0, '테스트 실패');
            this.displayTestResult('fail', {
                timestamp: new Date().toISOString(),
                message: `오류: ${error.message}`
            });
        } finally {
            this.isTestRunning = false;
            if (startBtn) startBtn.style.display = 'inline-block';
            if (stopBtn) stopBtn.style.display = 'none';
        }
    }

    stopTest() {
        if (!this.isTestRunning) return;
        this.shouldStopTest = true;
        this.addLog('사용자가 테스트를 중단했습니다.', 'warning');
    }

    // ==================== 공통 Modbus 헬퍼 ====================

    async readParameter(slaveId, address) {
        if (!window.dashboard) throw new Error('Modbus 통신이 초기화되지 않았습니다.');
        const value = await window.dashboard.readRegister(slaveId, address);
        if (value === null || value === undefined) {
            throw new Error(`주소 0x${address.toString(16).toUpperCase()} 응답 데이터 없음`);
        }
        return value;
    }

    async writeParameter(slaveId, address, value) {
        if (!window.dashboard) throw new Error('Modbus 통신이 초기화되지 않았습니다.');
        await window.dashboard.writeRegister(slaveId, address, value);
        return true;
    }

    async saveToMemory(slaveId) {
        const saveAddress = 0x2000;
        const saveValue = 0x5555;
        return await this.writeParameter(slaveId, saveAddress, saveValue);
    }

    checkConnection() {
        if (!window.dashboard || (!window.dashboard.port && !window.dashboard.simulatorEnabled)) {
            throw new Error('시리얼 포트가 연결되지 않았습니다. 먼저 포트를 연결해주세요.');
        }
    }

    checkCommSettings() {
        const currentBaud = document.getElementById('sidebar-baudRate')?.value;
        const currentParity = document.getElementById('sidebar-parity')?.value;
        this.addLog(`현재 설정 - Baudrate: ${currentBaud}, Parity: ${currentParity}`, 'info');
        if (currentBaud !== '19200' || currentParity !== 'even') {
            this.addLog('⚠ 권장 설정(19200, Even)과 다릅니다. 계속 진행합니다.', 'warning');
        } else {
            this.addLog('✓ 통신 설정 확인 완료', 'success');
        }
        return { baud: currentBaud, parity: currentParity };
    }

    // ==================== 유틸리티 ====================

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    toHex4(value) {
        return value.toString(16).toUpperCase().padStart(4, '0');
    }

    toHex2(value) {
        return value.toString(16).toUpperCase().padStart(2, '0');
    }
}
