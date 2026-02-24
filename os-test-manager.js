/**
 * OS Test Manager - Base Class + Step Execution Engine
 *
 * [모듈 등록 방식]
 * 각 카테고리 파일(os-test-rs485.js 등)이 window.OSTestModules 배열에
 * { tests, executors } 객체를 push → new OSTestManager() 시 자동 병합.
 *
 * [테스트 케이스 추가 방법]
 * 1. 해당 카테고리 파일(또는 새 파일)의 tests 객체에 항목 추가
 * 2. steps 배열을 선언형(declarative) 스텝 객체로 작성
 * 3. executor 함수는 복잡한 로직이 필요한 경우에만 별도 작성
 *    (없으면 자동으로 선언형 스텝 엔진이 실행)
 *
 * [지원하는 스텝 타입]
 *  { type: 'check_connection' }
 *  { type: 'check_comm_settings', required: { baud: '19200', parity: 'even' } }
 *  { type: 'read_holding',  slaveId, address, label?, txHex?, expect?, softMatch?, storeAs? }
 *  { type: 'read_input',    slaveId, address, label?, txHex?, expect?, softMatch?, storeAs? }
 *  { type: 'write_holding', slaveId, address, value?, valueFrom?, label?, txHex?,
 *                            verifyAfterWrite?, expectAfterWrite? }
 *  { type: 'restore_holding', slaveId, address, from, label? }
 *  { type: 'wait_countdown', seconds, message? }
 *  { type: 'delay', ms }
 *
 * [스텝 파라미터]
 *  storeAs          : 읽은 값을 this.stepContext[key] 에 저장
 *  valueFrom        : this.stepContext[key] 의 값을 쓰기 값으로 사용
 *  softMatch        : expect 불일치 시 경고만 하고 계속 진행 (기본: false = 실패 처리)
 *  softFail         : 스텝 자체 실패(Timeout 등) 시 경고만 하고 계속 진행
 *  verifyAfterWrite : write 후 read-back 으로 검증
 */

window.OSTestModules = window.OSTestModules || [];

class OSTestManager {
    constructor() {
        this.tests     = {};
        this.executors = {};
        this.stepContext = {};

        window.OSTestModules.forEach(module => {
            Object.assign(this.tests,     module.tests     || {});
            Object.assign(this.executors, module.executors || {});
        });

        this.results         = this.loadResults();
        this.currentTest     = null;
        this.isTestRunning   = false;
        this.shouldStopTest  = false;
        this.currentStepIndex = 0;
    }

    // ================================================================
    //  결과 저장/로드
    // ================================================================

    loadResults() {
        try {
            const saved = localStorage.getItem('osTestResults');
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    }

    saveResults() {
        localStorage.setItem('osTestResults', JSON.stringify(this.results));
    }

    getTest(testId)       { return this.tests[testId]; }
    getTestResult(testId) { return this.results[testId]; }

    setTestResult(testId, result, notes = '') {
        this.results[testId] = {
            result,
            notes,
            timestamp: new Date().toISOString(),
            completedSteps: result === 'pass' ? (this.tests[testId]?.steps.length || 0) : 0
        };
        this.saveResults();
        this.updateTestStatus();
    }

    // ================================================================
    //  UI 상태 업데이트
    // ================================================================

    updateTestStatus() {
        const total    = Object.keys(this.tests).length;
        const passed   = Object.values(this.results).filter(r => r.result === 'pass').length;
        const failed   = Object.values(this.results).filter(r => r.result === 'fail').length;
        const progress = total > 0 ? Math.round((passed / total) * 100) : 0;

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('osTestTotal',   total);
        set('osTestPassed',  passed);
        set('osTestFailed',  failed);
        set('osTestPending', total - passed - failed);
        set('osTestProgress', progress + '%');

        Object.keys(this.tests).forEach(testId => {
            const testItem = document.querySelector(`.os-test-item[data-test-id="${testId}"]`);
            const badge    = testItem?.querySelector('.test-status-badge');
            if (!badge) return;
            const r = this.results[testId]?.result;
            if (r === 'pass')      { badge.textContent = 'Passed'; badge.style.background = '#d4edda'; badge.style.color = '#155724'; }
            else if (r === 'fail') { badge.textContent = 'Failed'; badge.style.background = '#f8d7da'; badge.style.color = '#721c24'; }
            else                   { badge.textContent = 'Pending'; badge.style.background = '#e9ecef'; badge.style.color = '#6c757d'; }
        });
    }

    expandTestItem(testId) {
        const test     = this.getTest(testId);
        const testItem = document.querySelector(`.os-test-item[data-test-id="${testId}"]`);
        if (!test || !testItem) return;

        const testContent = testItem.querySelector('.os-test-content');
        const expandIcon  = testItem.querySelector('.test-expand-icon');
        const isExpanded  = testContent.style.display === 'block';

        // 다른 항목 닫기
        document.querySelectorAll('.os-test-item').forEach(item => {
            const c = item.querySelector('.os-test-content');
            const i = item.querySelector('.test-expand-icon');
            if (c?.style.display === 'block') { c.style.display = 'none'; if (i) i.style.transform = 'rotate(0deg)'; }
        });

        if (!isExpanded) {
            this.currentTest      = testId;
            this.currentStepIndex = 0;
            this.isTestRunning    = false;
            this.shouldStopTest   = false;

            // 단계 목록 렌더링 (string | object 모두 지원)
            const stepsList = testItem.querySelector('.test-steps-list');
            if (stepsList) {
                stepsList.innerHTML = '';
                test.steps.forEach((step, index) => {
                    const text    = this._getStepLabel(step);
                    const stepDiv = document.createElement('div');
                    stepDiv.id          = `test-step-${testId}-${index}`;
                    stepDiv.style.cssText = 'display:flex;gap:12px;align-items:flex-start;padding:8px 12px;background:#f8f9fa;border-radius:4px;';
                    stepDiv.innerHTML   = `
                        <div class="step-status" style="flex-shrink:0;margin-top:2px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#e9ecef;color:#6c757d;font-size:11px;font-weight:600;">${index + 1}</div>
                        <div style="flex:1;font-size:12px;color:#1a1a1a;line-height:1.5;">${text.replace(/\n/g, '<br>')}</div>
                    `;
                    stepsList.appendChild(stepDiv);
                });
            }

            const startBtn    = testItem.querySelector('.test-start-btn');
            const stopBtn     = testItem.querySelector('.test-stop-btn');
            const progressBar = testItem.querySelector('.test-progress-bar');
            const progressTxt = testItem.querySelector('.test-progress-text');
            if (startBtn)    startBtn.style.display    = 'inline-block';
            if (stopBtn)     stopBtn.style.display     = 'none';
            if (progressBar) progressBar.style.width   = '0%';
            if (progressTxt) progressTxt.textContent   = '테스트를 시작하려면 Start Test 버튼을 클릭하세요';

            this.clearLog(testId);

            const notesTA = testItem.querySelector('.test-notes');
            if (notesTA) notesTA.value = this.results[testId]?.notes || '';

            const result = this.getTestResult(testId);
            if (result) {
                this.displayTestResult(result.result, { timestamp: result.timestamp, notes: result.notes }, testId);
            } else {
                testItem.querySelector('.test-result-display')?.style && (testItem.querySelector('.test-result-display').style.display = 'none');
                testItem.querySelector('.test-result-pending')?.style && (testItem.querySelector('.test-result-pending').style.display  = 'block');
            }

            testContent.style.display   = 'block';
            expandIcon.style.transform  = 'rotate(180deg)';
            setTimeout(() => testItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
        } else {
            testContent.style.display  = 'none';
            expandIcon.style.transform = 'rotate(0deg)';
            this.currentTest = null;
        }
    }

    // ================================================================
    //  로그
    // ================================================================

    addLog(message, type = 'info') {
        if (!this.currentTest) return;
        const logContainer = document.querySelector(`.os-test-item[data-test-id="${this.currentTest}"] .test-log-container`);
        if (!logContainer) return;

        const MAP = { success: ['#4ade80','[SUCCESS]'], error: ['#f87171','[ERROR]'], warning: ['#fbbf24','[WARNING]'], step: ['#60a5fa','[STEP]'] };
        const [color, prefix] = MAP[type] || ['#d4d4d4', '[INFO]'];
        const ts = new Date().toLocaleTimeString('ko-KR', { hour12: false });

        const entry = document.createElement('div');
        entry.style.marginBottom = '4px';
        entry.innerHTML = `<span style="color:#6c757d;">[${ts}]</span> <span style="color:${color};">${prefix}</span> ${message}`;
        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    clearLog(testId = null) {
        const id  = testId || this.currentTest;
        const el  = document.querySelector(`.os-test-item[data-test-id="${id}"] .test-log-container`);
        if (el) el.innerHTML = '<div style="color:#6c757d;">테스트 로그가 여기에 표시됩니다...</div>';
    }

    // ================================================================
    //  단계 / 진행 상태
    // ================================================================

    updateStepStatus(index, status) {
        if (!this.currentTest) return;
        const stepEl   = document.getElementById(`test-step-${this.currentTest}-${index}`);
        const statusEl = stepEl?.querySelector('.step-status');
        if (!stepEl || !statusEl) return;

        const S = {
            running: { bg: '#e0e7ff', border: '#667eea', dot: '#667eea', icon: '⏳' },
            success: { bg: '#d4edda', border: '#28a745', dot: '#28a745', icon: '✓'  },
            error:   { bg: '#f8d7da', border: '#dc3545', dot: '#dc3545', icon: '✗'  }
        }[status];
        if (!S) return;
        stepEl.style.background  = S.bg;
        stepEl.style.borderLeft  = `3px solid ${S.border}`;
        statusEl.style.background = S.dot;
        statusEl.style.color      = 'white';
        statusEl.innerHTML        = S.icon;
    }

    updateProgress(percent, message) {
        if (!this.currentTest) return;
        const testItem = document.querySelector(`.os-test-item[data-test-id="${this.currentTest}"]`);
        if (!testItem) return;
        const bar = testItem.querySelector('.test-progress-bar');
        const txt = testItem.querySelector('.test-progress-text');
        if (bar) bar.style.width  = percent + '%';
        if (txt) txt.textContent  = message;
    }

    displayTestResult(result, details = {}, testId = null) {
        const id       = testId || this.currentTest;
        const testItem = document.querySelector(`.os-test-item[data-test-id="${id}"]`);
        if (!testItem) return;

        const display  = testItem.querySelector('.test-result-display');
        const pending  = testItem.querySelector('.test-result-pending');
        if (pending) pending.style.display = 'none';
        if (display) display.style.display = 'block';

        const isPass  = result === 'pass';
        const bg      = isPass ? '#d4edda' : '#f8d7da';
        const border  = isPass ? '#28a745' : '#dc3545';
        const color   = isPass ? '#155724' : '#721c24';
        const icon    = isPass ? '✓' : '✗';
        const label   = isPass ? '합격 (PASS)' : '불합격 (FAIL)';

        if (display) display.innerHTML = `
            <div style="padding:14px;background:${bg};border-left:4px solid ${border};border-radius:4px;">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
                    <div style="width:28px;height:28px;background:${border};color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;">${icon}</div>
                    <div style="flex:1;">
                        <div style="font-size:15px;font-weight:600;color:${color};">${label}</div>
                        ${details.timestamp ? `<div style="font-size:11px;color:${color};opacity:0.8;margin-top:2px;">${new Date(details.timestamp).toLocaleString('ko-KR')}</div>` : ''}
                    </div>
                </div>
                ${details.message ? `<div style="font-size:12px;color:${color};margin-top:6px;">${details.message}</div>` : ''}
            </div>`;
    }

    // ================================================================
    //  테스트 실행 제어
    // ================================================================

    async executeTest() {
        if (this.isTestRunning || !this.currentTest) return;
        const test = this.getTest(this.currentTest);
        if (!test) return;

        this.isTestRunning  = true;
        this.shouldStopTest = false;
        this.stepContext    = {};

        const testItem = document.querySelector(`.os-test-item[data-test-id="${this.currentTest}"]`);
        const startBtn = testItem?.querySelector('.test-start-btn');
        const stopBtn  = testItem?.querySelector('.test-stop-btn');

        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn)  stopBtn.style.display  = 'inline-block';
        this.clearLog();
        this.addLog(`테스트 시작: ${test.title}`, 'info');
        this.updateProgress(0, '테스트 초기화 중...');

        try {
            const executor = this.executors[this.currentTest];

            // 커스텀 executor 가 있으면 사용, 없으면 선언형 스텝 엔진으로 자동 실행
            const result = executor
                ? await executor.call(this)
                : await this.executeStepDefinitions(test.steps);

            const notes = testItem?.querySelector('.test-notes')?.value || '';
            this.setTestResult(this.currentTest, result.status, notes + '\n\n' + result.details);
            this.displayTestResult(result.status, { timestamp: new Date().toISOString(), message: result.message });
            this.addLog(`테스트 완료: ${result.status === 'pass' ? '합격' : '불합격'}`, result.status === 'pass' ? 'success' : 'error');
            this.updateProgress(100, `테스트 완료: ${result.status === 'pass' ? '합격' : '불합격'}`);

        } catch (error) {
            this.addLog(`테스트 실행 중 오류 발생: ${error.message}`, 'error');
            this.updateProgress(0, '테스트 실패');
            this.displayTestResult('fail', { timestamp: new Date().toISOString(), message: `오류: ${error.message}` });
        } finally {
            this.isTestRunning = false;
            if (startBtn) startBtn.style.display = 'inline-block';
            if (stopBtn)  stopBtn.style.display  = 'none';
        }
    }

    stopTest() {
        if (!this.isTestRunning) return;
        this.shouldStopTest = true;
        this.addLog('사용자가 테스트를 중단했습니다.', 'warning');
    }

    // ================================================================
    //  선언형 스텝 실행 엔진
    // ================================================================

    /**
     * 스텝 객체 배열을 순서대로 실행한다.
     * 실패 시 restore_holding 스텝을 자동으로 실행해 정리한다.
     */
    async executeStepDefinitions(steps) {
        const total  = steps.length;
        let details  = '';

        try {
            for (let i = 0; i < steps.length; i++) {
                if (this.shouldStopTest) throw new Error('테스트 중단됨');

                const step     = steps[i];
                const stepNum  = i + 1;
                const label    = this._getStepLabel(step);
                const progress = Math.round((i / total) * 90) + 5;

                this.updateStepStatus(i, 'running');
                this.updateProgress(progress, `Step ${stepNum}/${total}: ${label.split('\n')[0]}`);
                this.addLog(`Step ${stepNum}: ${label}`, 'step');

                let detail;
                if (typeof step === 'object' && step.softFail) {
                    try {
                        detail = await this._runStep(step, stepNum);
                        this.updateStepStatus(i, 'success');
                    } catch (e) {
                        this.addLog(`⚠ ${e.message} (계속 진행)`, 'warning');
                        detail = `Step ${stepNum}: (soft fail) ${e.message}`;
                        this.updateStepStatus(i, 'error');
                    }
                } else {
                    detail = await this._runStep(step, stepNum);
                    this.updateStepStatus(i, 'success');
                }
                details += detail + '\n';

                await this.delay(typeof step === 'object' ? (step.delayAfter ?? 300) : 300);
            }

            this.updateProgress(100, '테스트 완료');
            this.addLog('========================================', 'info');
            this.addLog('테스트 완료: 합격', 'success');
            this.addLog('========================================', 'info');
            return { status: 'pass', message: '모든 단계 통과', details };

        } catch (error) {
            // 실패 시 restore_holding 스텝 자동 실행
            await this._runRestoreSteps(steps);

            this.addLog('========================================', 'info');
            this.addLog(`테스트 실패: ${error.message}`, 'error');
            this.addLog('========================================', 'info');
            details += `\n테스트 실패: ${error.message}\n`;
            return { status: 'fail', message: error.message, details };
        }
    }

    /** 실패 시 restore_holding 스텝만 골라서 실행 */
    async _runRestoreSteps(steps) {
        for (const step of steps) {
            if (typeof step === 'object' && step.type === 'restore_holding') {
                try {
                    const val = this.stepContext[step.from];
                    if (val !== null && val !== undefined && window.dashboard) {
                        await window.dashboard.writeRegister(step.slaveId, step.address, val);
                        this.addLog(`정리: [0x${this.toHex4(step.address)}] 원래 값(${val})으로 복원`, 'info');
                    }
                } catch (e) { /* 복원 실패는 무시 */ }
            }
        }
    }

    /**
     * 스텝 타입별 실행 함수
     * @returns {string} 결과 상세 텍스트 (details 에 누적됨)
     */
    async _runStep(step, stepNum) {
        if (typeof step === 'string') return `Step ${stepNum}: ${step}`;

        switch (step.type) {

            case 'check_connection': {
                this.checkConnection();
                this.addLog('✓ 연결 확인 완료', 'success');
                return `Step ${stepNum}: 연결 확인 완료`;
            }

            case 'check_comm_settings': {
                const { baud, parity } = this.checkCommSettings();
                return `Step ${stepNum}: 통신 설정 - ${baud}, ${parity}`;
            }

            case 'read_holding': {
                if (step.txHex) this.addLog(`→ TX: ${step.txHex}`, 'info');
                const val = await window.dashboard.readRegisterWithTimeout(step.slaveId, step.address);
                if (val === null || val === undefined) throw new Error(`FC03 응답 없음 [0x${this.toHex4(step.address)}] (Timeout)`);
                this.addLog(`✓ FC03 응답: 0x${this.toHex4(val)} (${val})`, 'success');
                if (step.rxHex) this.addLog(`→ RX: ${step.rxHex}`, 'info');
                if (step.storeAs) this.stepContext[step.storeAs] = val;
                this._checkExpect(val, step);
                return `Step ${stepNum}: FC03 [0x${this.toHex4(step.address)}] = 0x${this.toHex4(val)}`;
            }

            case 'read_input': {
                if (step.txHex) this.addLog(`→ TX: ${step.txHex}`, 'info');
                const val = await window.dashboard.readInputRegisterWithTimeout(step.slaveId, step.address);
                if (val === null || val === undefined) throw new Error(`FC04 응답 없음 [0x${this.toHex4(step.address)}] (Timeout)`);
                this.addLog(`✓ FC04 응답: 0x${this.toHex4(val)} (${val})`, 'success');
                if (step.rxHex) this.addLog(`→ RX: ${step.rxHex}`, 'info');
                if (step.storeAs) this.stepContext[step.storeAs] = val;
                this._checkExpect(val, step);
                return `Step ${stepNum}: FC04 [0x${this.toHex4(step.address)}] = 0x${this.toHex4(val)}`;
            }

            case 'write_holding': {
                const writeVal = step.valueFrom !== undefined
                    ? this.stepContext[step.valueFrom]
                    : step.value;
                if (writeVal === null || writeVal === undefined)
                    throw new Error(`쓰기 값 없음 (valueFrom: "${step.valueFrom}")`);
                if (step.txHex) this.addLog(`→ TX: ${step.txHex}`, 'info');
                await window.dashboard.writeRegister(step.slaveId, step.address, writeVal);
                this.addLog(`✓ FC06 쓰기 완료: [0x${this.toHex4(step.address)}] = ${writeVal}`, 'success');
                if (step.rxHex) this.addLog(`→ RX: ${step.rxHex} (echo)`, 'info');

                if (step.verifyAfterWrite) {
                    await this.delay(200);
                    const rb = await window.dashboard.readRegisterWithTimeout(step.slaveId, step.address);
                    if (rb === null || rb === undefined) throw new Error('재읽기 응답 없음 (Timeout)');
                    const expected = step.expectAfterWrite !== undefined ? step.expectAfterWrite : writeVal;
                    if (rb === expected) {
                        this.addLog(`✓ 쓰기 검증 성공 (0x${this.toHex4(rb)})`, 'success');
                    } else {
                        throw new Error(`쓰기 검증 실패 (예상: ${expected}, 실제: ${rb})`);
                    }
                }
                return `Step ${stepNum}: FC06 [0x${this.toHex4(step.address)}] = ${writeVal}`;
            }

            case 'restore_holding': {
                const val = this.stepContext[step.from];
                if (val === null || val === undefined) {
                    this.addLog(`⚠ 복원 값 없음 (${step.from}). 건너뜁니다.`, 'warning');
                    return `Step ${stepNum}: 복원 건너뜀`;
                }
                await window.dashboard.writeRegister(step.slaveId, step.address, val);
                this.addLog(`✓ 원래 값(${val})으로 복원 완료`, 'success');
                return `Step ${stepNum}: 복원 완료 (${val})`;
            }

            case 'wait_countdown': {
                const msg = step.message || `${step.seconds}초 대기`;
                this.addLog(`⚠ ${msg}`, 'warning');
                for (let i = step.seconds; i > 0; i--) {
                    this.addLog(`${i}초 남음...`, 'info');
                    await this.delay(1000);
                    if (this.shouldStopTest) throw new Error('테스트 중단됨');
                }
                this.addLog('✓ 대기 완료', 'success');
                return `Step ${stepNum}: ${msg} 완료`;
            }

            case 'delay': {
                await this.delay(step.ms || 500);
                return `Step ${stepNum}: ${step.ms || 500}ms 대기`;
            }

            default:
                throw new Error(`알 수 없는 step type: "${step.type}"`);
        }
    }

    /** expect 값 검사 (softMatch 이면 경고만, 아니면 예외) */
    _checkExpect(value, step) {
        if (step.expect === undefined || step.expect === null) return;
        if (value === step.expect) {
            this.addLog(`✓ 값 일치 (0x${this.toHex4(value)})`, 'success');
        } else if (step.softMatch) {
            this.addLog(`⚠ 값 불일치 (예상: 0x${this.toHex4(step.expect)}, 실제: 0x${this.toHex4(value)}) - 통신 자체는 정상`, 'warning');
        } else {
            throw new Error(`값 불일치 (예상: 0x${this.toHex4(step.expect)}, 실제: 0x${this.toHex4(value)})`);
        }
    }

    /** 스텝 표시용 라벨 반환 */
    _getStepLabel(step) {
        if (typeof step === 'string') return step;
        if (step.label) return step.label;
        const defaults = {
            check_connection:   '시리얼 포트 연결 확인',
            check_comm_settings:'통신 설정 확인',
            read_holding:       `FC03 읽기 [0x${step.address != null ? this.toHex4(step.address) : '????'}]`,
            read_input:         `FC04 읽기 [0x${step.address != null ? this.toHex4(step.address) : '????'}]`,
            write_holding:      `FC06 쓰기 [0x${step.address != null ? this.toHex4(step.address) : '????'}] = ${step.value ?? '?'}`,
            restore_holding:    `FC06 복원 [0x${step.address != null ? this.toHex4(step.address) : '????'}]`,
            wait_countdown:     `${step.seconds}초 대기`,
            delay:              `${step.ms}ms 대기`,
        };
        return defaults[step.type] || step.type;
    }

    // ================================================================
    //  공통 Modbus 헬퍼
    // ================================================================

    checkConnection() {
        if (!window.dashboard || (!window.dashboard.port && !window.dashboard.simulatorEnabled)) {
            throw new Error('시리얼 포트가 연결되지 않았습니다. 먼저 포트를 연결해주세요.');
        }
    }

    checkCommSettings() {
        const baud   = document.getElementById('sidebar-baudRate')?.value;
        const parity = document.getElementById('sidebar-parity')?.value;
        this.addLog(`현재 설정 - Baudrate: ${baud}, Parity: ${parity}`, 'info');
        if (baud !== '19200' || parity !== 'even') {
            this.addLog('⚠ 권장 설정(19200, Even)과 다릅니다. 계속 진행합니다.', 'warning');
        } else {
            this.addLog('✓ 통신 설정 확인 완료', 'success');
        }
        return { baud, parity };
    }

    async readParameter(slaveId, address) {
        if (!window.dashboard) throw new Error('Modbus 통신이 초기화되지 않았습니다.');
        const val = await window.dashboard.readRegister(slaveId, address);
        if (val === null || val === undefined)
            throw new Error(`주소 0x${this.toHex4(address)} 응답 없음`);
        return val;
    }

    async writeParameter(slaveId, address, value) {
        if (!window.dashboard) throw new Error('Modbus 통신이 초기화되지 않았습니다.');
        await window.dashboard.writeRegister(slaveId, address, value);
        return true;
    }

    async saveToMemory(slaveId) {
        return await this.writeParameter(slaveId, 0x2000, 0x5555);
    }

    // ================================================================
    //  유틸리티
    // ================================================================

    delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    toHex4(v) { return (v ?? 0).toString(16).toUpperCase().padStart(4, '0'); }
    toHex2(v) { return (v ?? 0).toString(16).toUpperCase().padStart(2, '0'); }
}
