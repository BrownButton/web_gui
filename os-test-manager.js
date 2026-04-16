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

        this.results          = this.loadResults();
        this.currentTest      = null;
        this.isTestRunning    = false;
        this.shouldStopTest   = false;
        this.currentStepIndex = 0;
        this.testLogs         = {}; // { testId: [{message, type, ts}] }
        this.testStepResults  = {}; // { testId: { index: status } }
        this.testTimeRange    = {}; // { testId: { start, end } }
        this.singleStepTarget = null; // 단일 step 실행 시 대상 index
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
            if (r === 'pass')      { badge.textContent = 'Passed'; badge.style.background = '#e6faf3'; badge.style.color = '#00a85a'; }
            else if (r === 'fail') { badge.textContent = 'Failed'; badge.style.background = '#fff0f1'; badge.style.color = '#f04452'; }
            else                   { badge.textContent = 'Pending'; badge.style.background = '#f2f4f6'; badge.style.color = '#8b95a1'; }
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

            // JS 정의에서 info/criteria 필드 자동 주입 (HTML에 placeholder '-' 가 있을 때)
            const set = (cls, val) => { const el = testItem.querySelector(cls); if (el && val) el.textContent = val; };
            set('.test-category', test.category);
            set('.test-number',   test.number);
            set('.test-purpose',  test.purpose);
            set('.test-model',    test.model);
            set('.test-equipment', test.equipment);
            set('.test-criteria', test.criteria);

            // 단계 목록 렌더링 (Phase 부제목 그룹핑 지원)
            const stepsList = testItem.querySelector('.test-steps-list');
            if (stepsList) {
                stepsList.innerHTML = '';

                // Phase 기준으로 그룹핑 (주 Phase 번호만: [Phase 3-1] → Phase 3)
                const phaseGroups = [];
                let currentGroup  = null;
                test.steps.forEach((step, index) => {
                    const text  = this._getStepLabel(step);
                    const match = text.match(/^\[Phase (\d+)/i);
                    const phase = match ? match[1] : null;
                    if (phase && (!currentGroup || currentGroup.phase !== phase)) {
                        currentGroup = { phase, items: [] };
                        phaseGroups.push(currentGroup);
                    } else if (!phase && !currentGroup) {
                        currentGroup = { phase: null, items: [] };
                        phaseGroups.push(currentGroup);
                    }
                    currentGroup.items.push({ step, index, text });
                });

                const hasPhases = phaseGroups.some(g => g.phase !== null);

                phaseGroups.forEach(group => {
                    // Phase 부제목
                    if (hasPhases && group.phase !== null) {
                        const header = document.createElement('div');
                        header.style.cssText = 'margin:10px 0 4px 0;padding:4px 10px;font-size:12px;font-weight:600;color:#3182f6;border-left:3px solid #3182f6;background:#f0f6ff;border-radius:0 6px 6px 0;';
                        header.textContent = `Phase ${group.phase}`;
                        stepsList.appendChild(header);
                    }

                    group.items.forEach(({ step, index, text }) => {
                        const stepDiv = document.createElement('div');
                        stepDiv.id          = `test-step-${testId}-${index}`;
                        const isManual = typeof step === 'string';
                        stepDiv.style.cssText = 'display:flex;gap:12px;align-items:flex-start;padding:8px 12px;background:#f8f9fa;border-radius:4px;cursor:pointer;transition:filter .15s;';
                        stepDiv.title = isManual
                            ? '클릭: 완료(✓) → 실패(✗) → 초기화 순으로 토글'
                            : '클릭하여 이 단계만 실행';
                        // Phase 태그를 텍스트에서 제거하여 부제목과 중복 방지
                        const displayText = hasPhases ? text.replace(/^\[Phase [^\]]+\]\s*/i, '') : text;
                        const renderedText = displayText.split('\n').map(line => {
                            if (line.startsWith('TX:'))
                                return `<div style="margin-top:5px;padding:2px 6px;font-family:monospace;font-size:11px;color:#555;background:#e2e4e8;border-radius:3px;display:inline-block;">${line}</div>`;
                            if (line.startsWith('판정 기준:'))
                                return `<div style="margin-top:6px;padding:3px 8px;font-size:11px;color:#1d4ed8;background:#eff6ff;border-left:2px solid #3b82f6;border-radius:0 3px 3px 0;">${line}</div>`;
                            return `<div>${line}</div>`;
                        }).join('');
                        stepDiv.innerHTML = `
                            <div class="step-status" style="flex-shrink:0;margin-top:2px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#f2f4f6;color:#8b95a1;font-size:11px;font-weight:600;">${index + 1}</div>
                            <div style="flex:1;font-size:12px;color:#191f28;line-height:1.6;">${renderedText}</div>
                        `;
                        stepDiv.addEventListener('mouseover', () => { stepDiv.style.filter = 'brightness(0.95)'; });
                        stepDiv.addEventListener('mouseout',  () => { stepDiv.style.filter = ''; });
                        stepDiv.addEventListener('click', () => this.runSingleStep(testId, index));
                        stepsList.appendChild(stepDiv);
                    });
                });
            }

            // onExpand 훅 — 테스트 정의에 onExpand 함수가 있으면 항목 열릴 때 호출
            if (typeof test.onExpand === 'function') {
                test.onExpand.call(this, testItem);
            }

            const startBtn    = testItem.querySelector('.test-start-btn');
            const stopBtn     = testItem.querySelector('.test-stop-btn');
            const savePngBtn  = testItem.querySelector('.test-save-png-btn');
            const saveLogBtn  = testItem.querySelector('.test-save-log-btn');
            const copyPngBtn  = testItem.querySelector('.test-copy-png-btn');
            const copyLogBtn  = testItem.querySelector('.test-copy-log-btn');
            const saveLsmBtn  = testItem.querySelector('.test-save-lsm-btn');
            const progressBar = testItem.querySelector('.test-progress-bar');
            const progressTxt = testItem.querySelector('.test-progress-text');
            if (startBtn)   startBtn.style.display   = 'inline-block';
            if (stopBtn)    stopBtn.style.display     = 'none';
            if (savePngBtn) savePngBtn.onclick = () => this.saveTestScreenshot(testId);
            if (saveLogBtn) saveLogBtn.onclick = () => this.saveTestLog(testId);
            if (copyPngBtn) copyPngBtn.onclick = () => this.copyTestScreenshot(testId);
            if (copyLogBtn) copyLogBtn.onclick = () => this.copyTestLog(testId);
            if (saveLsmBtn) saveLsmBtn.style.display = (testId === 'basic03' || testId === 'basic06') ? 'inline-block' : 'none';

            const hasStoredLog  = this.testLogs[testId]?.length > 0;
            const hasStoredSteps = this.testStepResults[testId] && Object.keys(this.testStepResults[testId]).length > 0;

            if (hasStoredLog || hasStoredSteps) {
                // 이전 실행 결과 복원 (Run All 이후 재확장 시)
                this._restoreLog(testId);
                if (hasStoredSteps) {
                    Object.entries(this.testStepResults[testId]).forEach(([idx, status]) => {
                        this._applyStepStatus(testId, parseInt(idx), status);
                    });
                }
                if (progressBar) progressBar.style.width = this.results[testId] ? '100%' : '0%';
                if (progressTxt) progressTxt.textContent = this.results[testId]
                    ? (this.results[testId].result === 'pass' ? '테스트 완료: 합격' : '테스트 완료: 불합격')
                    : '테스트를 시작하려면 Start Test 버튼을 클릭하세요';
            } else {
                if (progressBar) progressBar.style.width   = '0%';
                if (progressTxt) progressTxt.textContent   = '테스트를 시작하려면 Start Test 버튼을 클릭하세요';
                this.clearLog(testId);
            }

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
        const ts = new Date().toLocaleTimeString('ko-KR', { hour12: false });

        // 메모리에 저장 (재확장 시 복원용)
        if (!this.testLogs[this.currentTest]) this.testLogs[this.currentTest] = [];
        this.testLogs[this.currentTest].push({ message, type, ts });

        const logContainer = document.querySelector(`.os-test-item[data-test-id="${this.currentTest}"] .test-log-container`);
        if (!logContainer) return;
        this._appendLogEntry(logContainer, message, type, ts);
    }

    _appendLogEntry(container, message, type, ts) {
        const MAP = { success: ['#4ade80','[SUCCESS]'], error: ['#f87171','[ERROR]'], warning: ['#fbbf24','[WARNING]'], step: ['#60a5fa','[STEP]'] };
        const [color, prefix] = MAP[type] || ['#d4d4d4', '[INFO]'];
        const entry = document.createElement('div');
        entry.style.marginBottom = '4px';
        entry.innerHTML = `<span style="color:#6c757d;">[${ts}]</span> <span style="color:${color};">${prefix}</span> ${message}`;
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
    }

    _restoreLog(testId) {
        const el = document.querySelector(`.os-test-item[data-test-id="${testId}"] .test-log-container`);
        if (!el) return;
        const entries = this.testLogs[testId];
        if (!entries?.length) {
            el.innerHTML = '<div style="color:#6e7681;">테스트 로그가 여기에 표시됩니다...</div>';
            return;
        }
        el.innerHTML = '';
        entries.forEach(({ message, type, ts }) => this._appendLogEntry(el, message, type, ts));
    }

    clearLog(testId = null) {
        const id = testId || this.currentTest;
        delete this.testLogs[id];
        delete this.testStepResults[id];

        const testItem = document.querySelector(`.os-test-item[data-test-id="${id}"]`);

        // 로그 초기화
        const logEl = testItem?.querySelector('.test-log-container');
        if (logEl) logEl.innerHTML = '<div style="color:#6c757d;">테스트 로그가 여기에 표시됩니다...</div>';

        // 모든 step 스타일 초기화
        testItem?.querySelectorAll('[id^="test-step-"]').forEach(stepEl => {
            const statusEl = stepEl.querySelector('.step-status');
            stepEl.style.background = '#f7f8fa';
            stepEl.style.borderLeft = '';
            if (statusEl) {
                statusEl.style.background = '#f2f4f6';
                statusEl.style.color      = '#8b95a1';
                statusEl.innerHTML        = stepEl.id.split('-').pop();
            }
        });

        // 결과 영역 초기화
        const display = testItem?.querySelector('.test-result-display');
        const pending = testItem?.querySelector('.test-result-pending');
        if (display) display.style.display = 'none';
        if (pending) pending.style.display = 'block';

        // 진행 바 초기화
        const progressBar = testItem?.querySelector('.test-progress-bar');
        const progressTxt = testItem?.querySelector('.test-progress-text');
        if (progressBar) progressBar.style.width = '0%';
        if (progressTxt) progressTxt.textContent = '테스트를 시작하려면 Start 버튼을 클릭하세요';
    }

    // ================================================================
    //  단계 / 진행 상태
    // ================================================================

    updateStepStatus(index, status) {
        if (!this.currentTest) return;

        // 메모리에 저장 (재확장 시 복원용)
        if (!this.testStepResults[this.currentTest]) this.testStepResults[this.currentTest] = {};
        this.testStepResults[this.currentTest][index] = status;

        this._applyStepStatus(this.currentTest, index, status);

        // 단일 step 실행 모드: 목표 step 완료 시 중단 플래그 설정
        if (this.singleStepTarget !== null &&
            index === this.singleStepTarget &&
            (status === 'success' || status === 'error' || status === 'warning')) {
            this.shouldStopTest   = true;
        }
    }

    _applyStepStatus(testId, index, status) {
        const stepEl   = document.getElementById(`test-step-${testId}-${index}`);
        const statusEl = stepEl?.querySelector('.step-status');
        if (!stepEl || !statusEl) return;

        const S = {
            running: { bg: '#f0f6ff', border: '#3182f6', dot: '#3182f6', icon: '⏳' },
            success: { bg: '#e6faf3', border: '#00c471', dot: '#00c471', icon: '✓'  },
            warning: { bg: '#fffbeb', border: '#f59e0b', dot: '#f59e0b', icon: '⚠'  },
            error:   { bg: '#fff0f1', border: '#f04452', dot: '#f04452', icon: '✗'  }
        }[status];
        if (!S) return;
        stepEl.style.background   = S.bg;
        stepEl.style.borderLeft   = `3px solid ${S.border}`;
        statusEl.style.background = S.dot;
        statusEl.style.color      = 'white';
        statusEl.innerHTML        = S.icon;
    }

    _resetStepStyle(testId, index) {
        const stepEl   = document.getElementById(`test-step-${testId}-${index}`);
        const statusEl = stepEl?.querySelector('.step-status');
        if (!stepEl || !statusEl) return;
        stepEl.style.background = '#f7f8fa';
        stepEl.style.borderLeft = '';
        statusEl.style.background = '#f2f4f6';
        statusEl.style.color      = '#8b95a1';
        statusEl.innerHTML        = String(index + 1);
    }

    // 개별 step 클릭 실행
    // - string step : 수동 토글 (없음 → pass → fail → 없음)
    // - object step : _runStep() 자동 실행
    async runSingleStep(testId, stepIndex) {
        if (this.isTestRunning) {
            window.dashboard?.showToast('테스트가 실행 중입니다. 완료 후 시도하세요.', 'warning');
            return;
        }
        const test = this.getTest(testId);
        if (!test) return;
        const step = test.steps[stepIndex];
        if (step === undefined) return;

        if (typeof step === 'string') {
            if (this.executors[testId]) {
                // executor 기반 테스트: 해당 step까지 실행 후 자동 중단
                this.currentTest      = testId;
                this.singleStepTarget = stepIndex;
                await this.executeTest();
            } else {
                // executor 없는 수동 step: pass → fail → 초기화 토글
                if (!this.testStepResults[testId]) this.testStepResults[testId] = {};
                const cur  = this.testStepResults[testId][stepIndex];
                const next = !cur ? 'success' : cur === 'success' ? 'error' : null;
                if (next) {
                    this.testStepResults[testId][stepIndex] = next;
                    this._applyStepStatus(testId, stepIndex, next);
                } else {
                    delete this.testStepResults[testId][stepIndex];
                    this._resetStepStyle(testId, stepIndex);
                }
            }
            return;
        }

        // 객체 step: 자동 실행
        this.isTestRunning  = true;
        this.shouldStopTest = false;
        const prevTest = this.currentTest;
        this.currentTest = testId;
        try {
            this._applyStepStatus(testId, stepIndex, 'running');
            await this._runStep(step, stepIndex + 1);
            if (!this.testStepResults[testId]) this.testStepResults[testId] = {};
            this.testStepResults[testId][stepIndex] = 'success';
            this._applyStepStatus(testId, stepIndex, 'success');
        } catch (e) {
            if (!this.testStepResults[testId]) this.testStepResults[testId] = {};
            this.testStepResults[testId][stepIndex] = 'error';
            this._applyStepStatus(testId, stepIndex, 'error');
            window.dashboard?.showToast(`Step ${stepIndex + 1} 실패: ${e.message}`, 'error');
        } finally {
            this.isTestRunning = false;
            this.currentTest   = prevTest;
        }
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
        const bg      = isPass ? '#e6faf3' : '#fff0f1';
        const border  = isPass ? '#00c471' : '#f04452';
        const color   = isPass ? '#00845a' : '#d63b49';
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
        this.testTimeRange[this.currentTest] = { start: Date.now(), end: null };
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
            if (error.message === '__stopped__') {
                this.updateProgress(0, '테스트 중단됨');
            } else if (error.message !== '__singleStepDone__') {
                this.addLog(`테스트 실행 중 오류 발생: ${error.message}`, 'error');
                this.updateProgress(0, '테스트 실패');
                this.displayTestResult('fail', { timestamp: new Date().toISOString(), message: `오류: ${error.message}` });
            }
        } finally {
            if (this.testTimeRange[this.currentTest])
                this.testTimeRange[this.currentTest].end = Date.now();
            this.singleStepTarget = null;
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

    checkStop() {
        if (this.shouldStopTest) throw new Error('__stopped__');
    }

    // ================================================================
    //  저장 기능
    // ================================================================

    async saveTestScreenshot(testId) {
        if (typeof html2canvas === 'undefined') {
            alert('html2canvas 라이브러리가 로드되지 않았습니다.');
            return;
        }
        const testItem = document.querySelector(`.os-test-item[data-test-id="${testId}"]`);
        if (!testItem) return;

        const test     = this.getTest(testId);
        const filename = `${testId}_${this._fileTimestamp()}.png`;

        try {
            const canvas = await html2canvas(testItem, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            canvas.toBlob(blob => {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename;
                a.click();
                URL.revokeObjectURL(a.href);
            }, 'image/png');
        } catch (e) {
            alert(`캡처 실패: ${e.message}`);
        }
    }

    saveTestLog(testId) {
        const test      = this.getTest(testId);
        const range     = this.testTimeRange[testId];
        const logs      = this.testLogs[testId] || [];
        const filename  = `${testId}_${this._fileTimestamp()}_log.txt`;

        const lines = [];

        // ── 헤더 ──
        lines.push('='.repeat(60));
        lines.push(`테스트 항목  : [${test?.number}] ${test?.title}`);
        lines.push(`시작 시각    : ${range?.start ? new Date(range.start).toLocaleString() : '-'}`);
        lines.push(`종료 시각    : ${range?.end   ? new Date(range.end).toLocaleString()   : '-'}`);
        lines.push(`저장 시각    : ${new Date().toLocaleString()}`);
        lines.push('='.repeat(60));
        lines.push('');

        // ── 실행 로그 ──
        lines.push('[실행 로그]');
        lines.push('-'.repeat(60));
        if (logs.length === 0) {
            lines.push('(로그 없음)');
        } else {
            logs.forEach(({ message, type, ts }) => {
                const tag = type.toUpperCase();
                lines.push(`[${ts}] [${tag}] ${message}`);
            });
        }
        lines.push('');

        // ── 패킷 로그 ──
        lines.push('[패킷 로그]');
        lines.push('-'.repeat(60));
        const entries = (window.dashboard?.monitorEntries || []).filter(e =>
            range?.start && e.timestamp >= range.start &&
            (!range.end || e.timestamp <= range.end)
        );
        if (entries.length === 0) {
            lines.push('(패킷 없음)');
        } else {
            entries.forEach(({ type, dataOrMessage, timeStr, deltaStr }) => {
                const dir = type === 'sent'     ? 'TX'
                          : type === 'received' ? 'RX'
                          : 'ER';
                let data;
                if (dataOrMessage instanceof Uint8Array) {
                    data = Array.from(dataOrMessage)
                        .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                        .join(' ');
                } else {
                    data = String(dataOrMessage);
                }
                const delta = deltaStr ? `  (${deltaStr})` : '';
                lines.push(`[${timeStr}] ${dir}  ${data}${delta}`);
            });
        }
        lines.push('');
        lines.push('='.repeat(60));

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const a    = document.createElement('a');
        a.href     = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    async copyTestScreenshot(testId) {
        if (typeof html2canvas === 'undefined') {
            alert('html2canvas 라이브러리가 로드되지 않았습니다.');
            return;
        }
        const testItem = document.querySelector(`.os-test-item[data-test-id="${testId}"]`);
        if (!testItem) return;

        try {
            const canvas = await html2canvas(testItem, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            canvas.toBlob(async blob => {
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    window.dashboard?.showToast('PNG가 클립보드에 복사되었습니다.', 'success');
                } catch (e) {
                    alert(`클립보드 복사 실패: ${e.message}`);
                }
            }, 'image/png');
        } catch (e) {
            alert(`캡처 실패: ${e.message}`);
        }
    }

    async copyTestLog(testId) {
        const test      = this.getTest(testId);
        const range     = this.testTimeRange[testId];
        const logs      = this.testLogs[testId] || [];

        const lines = [];

        lines.push('='.repeat(60));
        lines.push(`테스트 항목  : [${test?.number}] ${test?.title}`);
        lines.push(`시작 시각    : ${range?.start ? new Date(range.start).toLocaleString() : '-'}`);
        lines.push(`종료 시각    : ${range?.end   ? new Date(range.end).toLocaleString()   : '-'}`);
        lines.push(`저장 시각    : ${new Date().toLocaleString()}`);
        lines.push('='.repeat(60));
        lines.push('');

        lines.push('[실행 로그]');
        lines.push('-'.repeat(60));
        if (logs.length === 0) {
            lines.push('(로그 없음)');
        } else {
            logs.forEach(({ message, type, ts }) => {
                lines.push(`[${ts}] [${type.toUpperCase()}] ${message}`);
            });
        }
        lines.push('');

        lines.push('[패킷 로그]');
        lines.push('-'.repeat(60));
        const entries = (window.dashboard?.monitorEntries || []).filter(e =>
            range?.start && e.timestamp >= range.start &&
            (!range.end || e.timestamp <= range.end)
        );
        if (entries.length === 0) {
            lines.push('(패킷 없음)');
        } else {
            entries.forEach(({ type, dataOrMessage, timeStr, deltaStr }) => {
                const dir = type === 'sent' ? 'TX' : type === 'received' ? 'RX' : 'ER';
                let data;
                if (dataOrMessage instanceof Uint8Array) {
                    data = Array.from(dataOrMessage).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
                } else {
                    data = String(dataOrMessage);
                }
                const delta = deltaStr ? `  (${deltaStr})` : '';
                lines.push(`[${timeStr}] ${dir}  ${data}${delta}`);
            });
        }
        lines.push('');
        lines.push('='.repeat(60));

        try {
            await navigator.clipboard.writeText(lines.join('\n'));
            window.dashboard?.showToast('로그가 클립보드에 복사되었습니다.', 'success');
        } catch (e) {
            alert(`클립보드 복사 실패: ${e.message}`);
        }
    }

    _fileTimestamp() {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
             + `_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
    }

    // ================================================================
    //  Run All / Reset All
    // ================================================================

    async runAllOsTests() {
        if (this.isTestRunning) {
            window.dashboard?.showToast('테스트가 이미 실행 중입니다.', 'warning');
            return;
        }

        const btn = document.getElementById('osRunAllTestsBtn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ 실행 중...'; }

        // 모든 결과·로그·단계 상태 초기화 → Pending
        this.results = {};
        this.testLogs = {};
        this.testStepResults = {};
        this.saveResults();
        this.updateTestStatus();

        // 열린 아코디언 모두 닫기 (Run All 중 DOM 간섭 방지)
        document.querySelectorAll('.os-test-item .os-test-content').forEach(c => { c.style.display = 'none'; });
        document.querySelectorAll('.os-test-item .test-expand-icon').forEach(i => { i.style.transform = 'rotate(0deg)'; });

        const testIds = Object.keys(this.tests);
        let passCount = 0, failCount = 0;

        for (const testId of testIds) {
            // 사용자가 Stop 요청 시 중단
            if (this.shouldStopTest) break;

            const test = this.tests[testId];

            this._setTestBadge(testId, 'running');
            await this.delay(20);

            // 모든 테스트를 실제 실행
            // wait_countdown 유무로 미구현 판정하지 않음 — 현재 등록된 모든 테스트는 구현됨
            this.currentTest    = testId;
            this.isTestRunning  = true;
            this.shouldStopTest = false;
            this.stepContext    = {};

            try {
                const executor = this.executors[testId];
                const result = executor
                    ? await executor.call(this)
                    : await this.executeStepDefinitions(test.steps);

                this.results[testId] = {
                    result: result.status,
                    notes: result.details || '',
                    timestamp: new Date().toISOString(),
                    completedSteps: result.status === 'pass' ? test.steps.length : 0
                };
                if (result.status === 'pass') passCount++;
                else failCount++;
            } catch (e) {
                this.results[testId] = {
                    result: 'fail',
                    notes: `오류: ${e.message}`,
                    timestamp: new Date().toISOString(),
                    completedSteps: 0
                };
                failCount++;
            } finally {
                this.isTestRunning = false;
            }

            this._setTestBadge(testId, this.results[testId].result);
        }

        this.currentTest = null;
        this.shouldStopTest = false;
        this.saveResults();
        this.updateTestStatus();

        if (btn) { btn.disabled = false; btn.textContent = '▶ Run All Tests'; }

        window.dashboard?.showToast(
            `Run All 완료: ${passCount}/${testIds.length} 합격, ${failCount}개 불합격`,
            failCount === 0 ? 'success' : 'warning'
        );
    }

    async runCategoryTests(category) {
        if (this.isTestRunning) {
            window.dashboard?.showToast('테스트가 이미 실행 중입니다.', 'warning');
            return;
        }

        const section = document.querySelector(`section[data-category="${CSS.escape(category)}"]`);
        const btn = section?.querySelector('.os-run-category-btn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ 실행 중...'; }

        const testIds = Object.keys(this.tests).filter(id => (this.tests[id].category || '기타') === category);
        let passCount = 0, failCount = 0;

        // 해당 카테고리 결과·로그·단계 상태 초기화
        for (const id of testIds) {
            delete this.results[id];
            delete this.testLogs[id];
            delete this.testStepResults[id];
        }
        this.saveResults();
        this.updateTestStatus();

        // 해당 카테고리 아코디언 닫기
        testIds.forEach(id => {
            const item = document.querySelector(`.os-test-item[data-test-id="${id}"]`);
            if (!item) return;
            item.querySelector('.os-test-content').style.display = 'none';
            item.querySelector('.test-expand-icon').style.transform = 'rotate(0deg)';
        });

        for (const testId of testIds) {
            if (this.shouldStopTest) break;

            const test = this.tests[testId];
            this._setTestBadge(testId, 'running');
            await this.delay(20);

            this.currentTest    = testId;
            this.isTestRunning  = true;
            this.shouldStopTest = false;
            this.stepContext    = {};

            try {
                const executor = this.executors[testId];
                const result = executor
                    ? await executor.call(this)
                    : await this.executeStepDefinitions(test.steps);

                this.results[testId] = {
                    result: result.status,
                    notes: result.details || '',
                    timestamp: new Date().toISOString(),
                    completedSteps: result.status === 'pass' ? test.steps.length : 0
                };
                if (result.status === 'pass') passCount++;
                else failCount++;
            } catch (e) {
                this.results[testId] = {
                    result: 'fail',
                    notes: `오류: ${e.message}`,
                    timestamp: new Date().toISOString(),
                    completedSteps: 0
                };
                failCount++;
            } finally {
                this.isTestRunning = false;
            }

            this._setTestBadge(testId, this.results[testId].result);
        }

        this.currentTest = null;
        this.shouldStopTest = false;
        this.saveResults();
        this.updateTestStatus();

        if (btn) { btn.disabled = false; btn.textContent = '▶ Run'; }

        window.dashboard?.showToast(
            `[${category}] 완료: ${passCount}/${testIds.length} 합격, ${failCount}개 불합격`,
            failCount === 0 ? 'success' : 'warning'
        );
    }

    resetAllTests() {
        this.results = {};
        this.testLogs = {};
        this.testStepResults = {};
        this.saveResults();
        this.updateTestStatus();
    }

    _setTestBadge(testId, state) {
        const testItem = document.querySelector(`.os-test-item[data-test-id="${testId}"]`);
        const badge = testItem?.querySelector('.test-status-badge');
        if (!badge) return;
        const S = {
            running: { text: 'Running...', bg: '#cfe2ff', color: '#084298' },
            pass:    { text: 'Passed',     bg: '#d4edda', color: '#155724' },
            fail:    { text: 'Failed',     bg: '#f8d7da', color: '#721c24' },
            pending: { text: 'Pending',    bg: '#e9ecef', color: '#6c757d' },
        };
        const s = S[state] || S.pending;
        badge.textContent = s.text;
        badge.style.background = s.bg;
        badge.style.color = s.color;
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
                    try {
                        detail = await this._runStep(step, stepNum);
                        this.updateStepStatus(i, 'success');
                    } catch (e) {
                        this.updateStepStatus(i, 'error'); // 실패 단계 ✗ 표시
                        throw e;                           // 상위 catch 로 전달
                    }
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
    //  동적 테스트 목록 렌더링
    // ================================================================

    /**
     * JS 테스트 정의로부터 DOM 항목을 동적 생성.
     * 기존 하드코딩된 HTML을 완전히 대체한다.
     */
    renderTestList() {
        const container = document.getElementById('osTestListContainer');
        if (!container) return;

        // 카테고리별 그룹화 (삽입 순서 유지)
        const groups = new Map();
        for (const test of Object.values(this.tests)) {
            const cat = test.category || '기타';
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat).push(test);
        }

        container.innerHTML = '';
        for (const [cat, tests] of groups) {
            const section = document.createElement('section');
            section.style.marginBottom = '0';
            section.dataset.category = cat;
            section.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:0 4px;">
                    <h3 style="margin:0;font-size:15px;font-weight:700;color:#191f28;letter-spacing:-0.2px;">${cat}</h3>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:12px;color:#b0b8c1;font-weight:500;">${tests.length}개 항목</span>
                        <button class="os-run-category-btn" style="padding:6px 14px;background:#f0f6ff;color:#3182f6;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:-0.1px;">▶ Run</button>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    ${tests.map(t => this._buildTestItemHtml(t)).join('')}
                </div>`;
            section.querySelector('.os-run-category-btn').addEventListener('click', () => {
                this.runCategoryTests(cat);
            });
            container.appendChild(section);
        }

        this.updateTestStatus();
    }

    _buildTestItemHtml(test) {
        const esc = s => String(s ?? '-').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
<div class="os-test-item" data-test-id="${test.id}" style="background:#fff;border:1px solid #f0f0f5;border-radius:14px;overflow:hidden;transition:box-shadow 0.2s;box-shadow:0 1px 4px rgba(0,0,0,0.05);">
  <div class="os-test-header" style="padding:16px 18px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
    <div style="flex:1;min-width:0;">
      <div style="font-size:14px;font-weight:600;color:#191f28;margin-bottom:3px;letter-spacing:-0.1px;">${test.number ? `<span style="color:#8b95a1;font-weight:500;margin-right:6px;">[${esc(test.number)}]</span>` : ''}${esc(test.title)}</div>
      <div style="font-size:12px;color:#8b95a1;">${esc(test.description)}</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;margin-left:12px;">
      <span class="test-status-badge" style="padding:4px 12px;background:#f2f4f6;color:#8b95a1;border-radius:20px;font-size:12px;font-weight:500;">Pending</span>
      <span class="test-expand-icon" style="font-size:16px;color:#b0b8c1;transition:transform 0.3s;">▼</span>
    </div>
  </div>
  <div class="os-test-content" style="display:none;border-top:1px solid #f0f0f5;">
    <div style="padding:16px 18px;background:#f7f8fa;">
      <div style="font-size:11px;font-weight:600;color:#8b95a1;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:10px;">시험 정보</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;font-size:13px;">
        <div><div style="color:#b0b8c1;font-size:11px;margin-bottom:3px;">시험 분류</div><div style="color:#191f28;font-weight:500;" class="test-category">${esc(test.category)}</div></div>
        <div><div style="color:#b0b8c1;font-size:11px;margin-bottom:3px;">시험 번호</div><div style="color:#191f28;font-weight:500;" class="test-number">${esc(test.number)}</div></div>
        <div style="grid-column:1/-1;"><div style="color:#b0b8c1;font-size:11px;margin-bottom:3px;">시험 목적</div><div style="color:#191f28;line-height:1.6;" class="test-purpose">${esc(test.purpose)}</div></div>
        <div><div style="color:#b0b8c1;font-size:11px;margin-bottom:3px;">적용 모델</div><div style="color:#191f28;" class="test-model">${esc(test.model)}</div></div>
        <div><div style="color:#b0b8c1;font-size:11px;margin-bottom:3px;">시험 장비</div><div style="color:#191f28;" class="test-equipment">${esc(test.equipment)}</div></div>
      </div>
    </div>
    <div style="padding:16px 18px;background:#fff;border-top:1px solid #f0f0f5;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:600;color:#191f28;">테스트 실행</div>
        <div style="display:flex;gap:8px;">
          <button class="test-start-btn" style="padding:7px 16px;background:#3182f6;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">▶ Start</button>
          <button class="test-stop-btn" style="display:none;padding:7px 16px;background:#f7f8fa;color:#4e5968;border:1.5px solid #e8eaed;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">⏹ Stop</button>
        </div>
      </div>
      <div style="background:#f2f4f6;height:4px;border-radius:2px;overflow:hidden;">
        <div class="test-progress-bar" style="height:100%;background:#3182f6;width:0%;transition:width 0.3s;border-radius:2px;"></div>
      </div>
      <div class="test-progress-text" style="margin-top:6px;font-size:12px;color:#b0b8c1;text-align:center;">테스트를 시작하려면 Start 버튼을 클릭하세요</div>
    </div>
    <div style="padding:16px 18px;border-top:1px solid #f0f0f5;">
      <div style="font-size:13px;font-weight:600;color:#191f28;margin-bottom:10px;">시험 단계</div>
      <div class="test-steps-list" style="display:flex;flex-direction:column;gap:6px;"></div>
    </div>
    <div style="padding:0 18px 16px 18px;">
      <div style="font-size:13px;font-weight:600;color:#191f28;margin-bottom:8px;">실행 로그</div>
      <div class="test-log-container" style="background:#13141a;color:#c9d1d9;padding:12px 14px;border-radius:10px;font-family:'Consolas','Monaco',monospace;font-size:11px;max-height:200px;overflow-y:auto;line-height:1.6;">
        <div style="color:#6e7681;">테스트 로그가 여기에 표시됩니다...</div>
      </div>
    </div>
    <div style="padding:0 18px 16px 18px;">
      <div style="font-size:13px;font-weight:600;color:#191f28;margin-bottom:8px;">판정 기준</div>
      <div style="padding:12px 14px;background:#f0f6ff;border-left:3px solid #3182f6;border-radius:6px;">
        <div style="font-size:13px;color:#191f28;" class="test-criteria">-</div>
      </div>
    </div>
    <div style="padding:16px 18px;background:#f7f8fa;border-top:1px solid #f0f0f5;">
      <div style="font-size:13px;font-weight:600;color:#191f28;margin-bottom:10px;">테스트 결과</div>
      <div class="test-result-display" style="display:none;"></div>
      <div class="test-result-pending" style="padding:12px;background:#f0f0f5;border-radius:8px;text-align:center;color:#8b95a1;font-size:13px;">테스트를 실행하면 결과가 자동으로 표시됩니다</div>
    </div>
    <div style="padding:12px 18px 16px 18px;background:#f7f8fa;border-top:1px solid #f0f0f5;display:flex;gap:6px;justify-content:flex-end;">
      <button class="test-copy-png-btn" style="padding:6px 12px;background:#fff;color:#4e5968;border:1.5px solid #e8eaed;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;">📋 PNG 복사</button>
      <button class="test-copy-log-btn" style="padding:6px 12px;background:#fff;color:#4e5968;border:1.5px solid #e8eaed;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;">📋 로그 복사</button>
      <button class="test-save-png-btn" style="padding:6px 12px;background:#fff;color:#4e5968;border:1.5px solid #e8eaed;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;">📷 PNG 저장</button>
      <button class="test-save-log-btn" style="padding:6px 12px;background:#fff;color:#4e5968;border:1.5px solid #e8eaed;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;">📄 로그 저장</button>
      <button class="test-save-lsm-btn" style="display:none;padding:6px 12px;background:#fff;color:#4e5968;border:1.5px solid #e8eaed;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;">💾 LSM 저장</button>
    </div>
  </div>
</div>`;
    }

    // ================================================================
    //  유틸리티
    // ================================================================

    delay(ms) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const TICK  = 50; // ms 단위로 shouldStopTest 폴링
            const tick = () => {
                // Stop 버튼 → 즉시 중단
                if (this.shouldStopTest) {
                    if (this.singleStepTarget !== null)
                        reject(new Error('__singleStepDone__'));
                    else
                        reject(new Error('__stopped__'));
                    return;
                }
                const remaining = ms - (Date.now() - start);
                if (remaining <= 0) { resolve(); return; }
                setTimeout(tick, Math.min(TICK, remaining));
            };
            setTimeout(tick, Math.min(TICK, ms));
        });
    }
    toHex4(v) { return (v ?? 0).toString(16).toUpperCase().padStart(4, '0'); }
    toHex2(v) { return (v ?? 0).toString(16).toUpperCase().padStart(2, '0'); }
}
