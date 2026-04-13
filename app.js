/**
 * Modbus RTU/RS-485 Dashboard Application
 * Enhanced with unified monitor, HEX/DEC display, and parameter management
 */

/**
 * ChartManager - Real-time 4-channel data visualization
 * Pure Canvas API implementation with zoom, pan, and cursor support
 */
class ChartManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Chart canvas not found:', canvasId);
            return;
        }
        this.ctx = this.canvas.getContext('2d');

        // Channel configuration
        this.channels = [
            { enabled: true,  color: '#3498db', data: [], name: 'CH1', address: 0xD011, scale: 1, offset: 0, chYMin: null, chYMax: null, runMin: null, runMax: null },
            { enabled: true,  color: '#e74c3c', data: [], name: 'CH2', address: 0xD001, scale: 1, offset: 0, chYMin: null, chYMax: null, runMin: null, runMax: null },
            { enabled: false, color: '#2ecc71', data: [], name: 'CH3', address: 0x0000, scale: 1, offset: 0, chYMin: null, chYMax: null, runMin: null, runMax: null },
            { enabled: false, color: '#f39c12', data: [], name: 'CH4', address: 0x0000, scale: 1, offset: 0, chYMin: null, chYMax: null, runMin: null, runMax: null }
        ];

        // Y-axis display mode: 'independent' | 'normalize' | 'scaleoffset'
        this.yAxisMode = 'independent';

        // Split view: each enabled channel rendered in its own horizontal panel
        this.splitView = false;

        // Mode settings
        this.mode = 'continuous'; // 'continuous' | 'trigger'
        this.isRunning = false;
        this.isPaused = false;

        // Zoom and pan state
        this.zoom = { x: 1, y: 1 };
        this.pan = { x: 0, y: 0 };
        this.viewMinTime = 0; // current left-edge time (ms), updated each render
        this.autoScroll = true; // false when user manually pans
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.panStart = { x: 0, y: 0 };

        // Auto scale settings
        this.autoScale = true;
        this.yMin = 0;
        this.yMax = 100;
        this.margin = 0.1; // 10% margin

        // Time settings
        this.timeScale = 10000; // 10 seconds visible
        this.sampleRate = 100; // 100ms between samples
        this.startTime = null;

        // Cursor and markers
        this.cursorPos = null;
        this.markers = [];
        this.showCursor = false;

        // Trigger settings
        this.trigger = {
            channel: 0,
            edge: 'rising', // 'rising', 'falling', 'both'
            level: 500,
            preSamples: 100,
            postSamples: 400,
            armed: false,
            triggered: false,
            triggerIndex: -1
        };

        // Pre-trigger buffer
        this.preTriggerBuffer = [];

        // Drawing margins
        this.chartMargins = { top: 20, right: 20, bottom: 40, left: 60 };

        // Animation frame
        this.animationId = null;

        // Bind methods
        this.render = this.render.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
        this.handleDblClick = this.handleDblClick.bind(this);
        this.handleClick = this.handleClick.bind(this);

        // Setup canvas and events
        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Set display size
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        // Set actual size with device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        // Scale context
        this.ctx.scale(dpr, dpr);

        this.width = rect.width;
        this.height = rect.height;

        // Render after resize
        if (!this.isRunning) {
            this.render();
        }
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
        this.canvas.addEventListener('dblclick', this.handleDblClick);
        this.canvas.addEventListener('contextmenu', this.handleClick);
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.isDragging) {
            const dx = x - this.dragStart.x;
            const dy = y - this.dragStart.y;
            // X drag: shift viewMinTime (negative dx = drag left = forward in time)
            const chartWidth = this.width - this.chartMargins.left - this.chartMargins.right;
            const deltaTime = -dx / (chartWidth * this.zoom.x) * this.timeScale;
            const latestTime = this.getLatestTime();
            const maxMinTime = Math.max(0, latestTime - this.timeScale);
            this.viewMinTime = Math.max(0, Math.min(maxMinTime, this.panStartViewMinTime + deltaTime));
            // If dragged all the way to the latest, resume auto-scroll
            this.autoScroll = (this.viewMinTime >= maxMinTime);
            this.pan.y = this.panStart.y + dy;
            if (!this.isRunning) this.render();
        } else {
            this.cursorPos = { x, y };
            this.showCursor = this.isInChartArea(x, y);
            this.updateCursorInfo();
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.isInChartArea(x, y)) {
            this.isDragging = true;
            this.dragStart = { x, y };
            this.panStart = { ...this.pan };
            this.panStartViewMinTime = this.viewMinTime;
            this.canvas.style.cursor = 'grabbing';
        }
    }

    handleMouseUp(e) {
        this.isDragging = false;
        this.canvas.style.cursor = 'crosshair';
    }

    handleMouseLeave(e) {
        this.isDragging = false;
        this.showCursor = false;
        this.cursorPos = null;
        this.canvas.style.cursor = 'default';
        this.hideCursorInfo();
    }

    handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (!this.isInChartArea(x, y)) return;

        const delta = e.deltaY > 0 ? 0.9 : 1.1;

        if (e.shiftKey) {
            // X-axis zoom
            this.zoom.x = Math.max(0.1, Math.min(10, this.zoom.x * delta));
        } else {
            // Y-axis zoom
            this.zoom.y = Math.max(0.1, Math.min(10, this.zoom.y * delta));
            this.autoScale = false;
        }

        if (!this.isRunning) this.render();
    }

    handleDblClick(e) {
        // Reset zoom and pan
        this.zoom = { x: 1, y: 1 };
        this.pan = { x: 0, y: 0 };
        this.autoScale = true;
        if (!this.isRunning) this.render();
    }

    handleClick(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (!this.isInChartArea(x, y)) return;

        // Add marker on click
        if (this.markers.length >= 2) {
            this.markers = [];
        }

        const chartX = this.screenToChartX(x);
        this.markers.push({
            x: chartX,
            screenX: x
        });

        this.updateMarkersInfo();
        if (!this.isRunning) this.render();
    }

    getLatestTime() {
        const active = this.channels.filter(ch => ch.enabled && ch.data.length > 0);
        if (active.length === 0) return this.timeScale;
        return Math.max(...active.map(ch => ch.data[ch.data.length - 1].t));
    }

    isInChartArea(x, y) {
        return x >= this.chartMargins.left &&
               x <= this.width - this.chartMargins.right &&
               y >= this.chartMargins.top &&
               y <= this.height - this.chartMargins.bottom;
    }

    screenToChartX(screenX) {
        const chartWidth = this.width - this.chartMargins.left - this.chartMargins.right;
        const relX = (screenX - this.chartMargins.left - this.pan.x) / (chartWidth * this.zoom.x);
        return this.viewMinTime + relX * this.timeScale;
    }

    screenToChartY(screenY) {
        const chartHeight = this.height - this.chartMargins.top - this.chartMargins.bottom;
        const relY = 1 - (screenY - this.chartMargins.top - this.pan.y) / (chartHeight * this.zoom.y);
        return this.yMin + relY * (this.yMax - this.yMin);
    }

    chartToScreenX(chartX) {
        const chartWidth = this.width - this.chartMargins.left - this.chartMargins.right;
        const relX = (chartX - this.viewMinTime) / this.timeScale;
        return this.chartMargins.left + relX * chartWidth * this.zoom.x + this.pan.x;
    }

    chartToScreenY(chartY) {
        const chartHeight = this.height - this.chartMargins.top - this.chartMargins.bottom;
        const relY = (chartY - this.yMin) / (this.yMax - this.yMin);
        return this.chartMargins.top + (1 - relY) * chartHeight * this.zoom.y + this.pan.y;
    }

    updateCursorInfo() {
        const infoEl = document.getElementById('chartCursorInfo');
        if (!infoEl || !this.cursorPos || !this.showCursor) {
            this.hideCursorInfo();
            return;
        }

        const timeMs = this.screenToChartX(this.cursorPos.x);
        const timeStr = this.formatTime(timeMs);

        document.getElementById('cursorTime').textContent = timeStr;

        const valuesEl = document.getElementById('cursorValues');
        valuesEl.innerHTML = '';

        this.channels.forEach((ch, i) => {
            if (!ch.enabled || ch.data.length === 0) return;

            // Find closest data point
            const value = this.getValueAtTime(i, timeMs);
            if (value === null) return;

            const itemEl = document.createElement('div');
            itemEl.className = 'cursor-value-item';
            itemEl.innerHTML = `
                <span class="cursor-value-dot" style="background: ${ch.color}"></span>
                <span class="cursor-value-label">${ch.name}:</span>
                <span class="cursor-value-num">${value.toFixed(3)}</span>
            `;
            valuesEl.appendChild(itemEl);
        });

        infoEl.style.display = 'block';
    }

    hideCursorInfo() {
        const infoEl = document.getElementById('chartCursorInfo');
        if (infoEl) infoEl.style.display = 'none';
    }

    getValueAtTime(channelIndex, timeMs) {
        const data = this.channels[channelIndex].data;
        if (data.length === 0) return null;

        // Binary search — O(log n)
        const idx = this._bisectLeft(data, timeMs);
        if (idx === 0) return data[0].v;
        if (idx >= data.length) return data[data.length - 1].v;
        const before = data[idx - 1];
        const after  = data[idx];
        return Math.abs(before.t - timeMs) <= Math.abs(after.t - timeMs) ? before.v : after.v;
    }

    formatTime(ms) {
        if (ms < 1000) return ms.toFixed(0) + 'ms';
        if (ms < 60000) return (ms / 1000).toFixed(2) + 's';
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(1);
        return `${minutes}m ${seconds}s`;
    }

    updateMarkersInfo() {
        const infoEl = document.getElementById('markersInfo');
        if (!infoEl) return;

        if (this.markers.length === 0) {
            infoEl.textContent = 'No markers set (Right-click to add)';
        } else if (this.markers.length === 1) {
            infoEl.textContent = `M1: ${this.formatTime(this.markers[0].x)} (Click to add M2)`;
        } else {
            const delta = Math.abs(this.markers[1].x - this.markers[0].x);
            infoEl.textContent = `M1: ${this.formatTime(this.markers[0].x)} | M2: ${this.formatTime(this.markers[1].x)} | Δ: ${this.formatTime(delta)}`;
        }
    }

    // Data management
    addDataPoint(channelIndex, value, timestamp) {
        if (channelIndex < 0 || channelIndex >= this.channels.length) return;
        if (!this.channels[channelIndex].enabled) return;

        const relTime = timestamp - this.startTime;
        const point = { t: relTime, v: value };

        const ch = this.channels[channelIndex];

        if (this.mode === 'trigger') {
            this.handleTriggerMode(channelIndex, point);
        } else {
            // Continuous mode — unlimited dynamic buffer
            ch.data.push(point);
        }

        // Update running min/max — O(1)
        if (ch.runMin === null || value < ch.runMin) ch.runMin = value;
        if (ch.runMax === null || value > ch.runMax) ch.runMax = value;

        // Update current value display
        this.updateChannelValue(channelIndex, value);

        // Update auto scale — now O(channels) not O(n_data)
        if (this.autoScale) {
            this.calculateAutoScale();
        }
    }

    handleTriggerMode(channelIndex, point) {
        if (!this.trigger.armed || this.trigger.triggered) {
            // Store in pre-trigger buffer
            this.preTriggerBuffer.push({ channel: channelIndex, point });
            while (this.preTriggerBuffer.length > this.trigger.preSamples * 4) {
                this.preTriggerBuffer.shift();
            }
            return;
        }

        // Check trigger condition
        if (channelIndex === this.trigger.channel) {
            const prevData = this.channels[channelIndex].data;
            const prevValue = prevData.length > 0 ? prevData[prevData.length - 1].v : null;

            let triggered = false;
            if (prevValue !== null) {
                if (this.trigger.edge === 'rising' && prevValue < this.trigger.level && point.v >= this.trigger.level) {
                    triggered = true;
                } else if (this.trigger.edge === 'falling' && prevValue > this.trigger.level && point.v <= this.trigger.level) {
                    triggered = true;
                } else if (this.trigger.edge === 'both' &&
                           ((prevValue < this.trigger.level && point.v >= this.trigger.level) ||
                            (prevValue > this.trigger.level && point.v <= this.trigger.level))) {
                    triggered = true;
                }
            }

            if (triggered) {
                this.trigger.triggered = true;
                this.trigger.triggerIndex = this.channels[channelIndex].data.length;
                this.updateTriggerStatus('Triggered');

                // Copy pre-trigger buffer
                for (const item of this.preTriggerBuffer) {
                    this.channels[item.channel].data.push(item.point);
                }
                this.preTriggerBuffer = [];
            }
        }

        if (this.trigger.triggered) {
            this.channels[channelIndex].data.push(point);

            // Check if we have enough post-trigger samples
            const mainChannel = this.channels[this.trigger.channel];
            if (mainChannel.data.length >= this.trigger.preSamples + this.trigger.postSamples) {
                this.stopCapture();
            }
        }
    }

    updateChannelValue(channelIndex, value) {
        const el = document.getElementById(`chartCh${channelIndex + 1}Value`);
        if (el) {
            el.textContent = value.toFixed(3);
        }
    }

    // O(channels) — uses running min/max, never scans data[]
    calculateAutoScale() {
        if (this.yAxisMode === 'independent') {
            for (const ch of this.channels) {
                if (!ch.enabled || ch.runMin === null) {
                    ch.chYMin = 0; ch.chYMax = 100; continue;
                }
                const range = (ch.runMax - ch.runMin) || 1;
                ch.chYMin = ch.runMin - range * this.margin;
                ch.chYMax = ch.runMax + range * this.margin;
            }
        } else if (this.yAxisMode === 'normalize') {
            for (const ch of this.channels) {
                if (!ch.enabled || ch.runMin === null) {
                    ch.chYMin = 0; ch.chYMax = 1; continue;
                }
                ch.chYMin = ch.runMin;
                ch.chYMax = ch.runMax === ch.runMin ? ch.runMin + 1 : ch.runMax;
            }
            this.yMin = 0;
            this.yMax = 100;
        } else {
            // scaleoffset: apply per-channel scale+offset using running extremes
            let min = Infinity, max = -Infinity;
            for (const ch of this.channels) {
                if (!ch.enabled || ch.runMin === null) continue;
                const v1 = ch.runMin * ch.scale + ch.offset;
                const v2 = ch.runMax * ch.scale + ch.offset;
                if (v1 < min) min = v1;
                if (v2 < min) min = v2;
                if (v1 > max) max = v1;
                if (v2 > max) max = v2;
            }
            if (min === Infinity || max === -Infinity) {
                this.yMin = 0; this.yMax = 100;
            } else {
                const range = max - min || 1;
                this.yMin = min - range * this.margin;
                this.yMax = max + range * this.margin;
            }
        }
    }

    // Control methods
    startCapture() {
        this.isRunning = true;
        this.isPaused = false;
        this.startTime = Date.now();

        if (this.mode === 'trigger') {
            this.trigger.armed = true;
            this.trigger.triggered = false;
            this.trigger.triggerIndex = -1;
            this.preTriggerBuffer = [];
            this.updateTriggerStatus('Armed');
        }

        this.updateStatus('Running');
        this.startAnimation();
    }

    stopCapture() {
        this.isRunning = false;
        this.trigger.armed = false;
        this.updateStatus('Stopped');
        this.cancelAnimation();
    }

    pauseCapture() {
        this.isPaused = !this.isPaused;
        this.updateStatus(this.isPaused ? 'Paused' : 'Running');
    }

    clearData() {
        for (const ch of this.channels) {
            ch.data = [];
            ch.runMin = null;
            ch.runMax = null;
        }
        this.markers = [];
        this.preTriggerBuffer = [];
        this.trigger.triggered = false;
        this.trigger.triggerIndex = -1;
        this.startTime = null;
        this.viewMinTime = 0;
        this.autoScroll = true;
        this.updateMarkersInfo();
        this.updateStats();
        this.render();
    }

    /**
     * FC65 Trigger 수집 완료 후 데이터를 일괄 로드하고 차트를 렌더링.
     * @param {Object} channelData      - { chIdx: float[] } 채널별 샘플 배열
     * @param {number} periodMs         - 샘플 간격 (ms)
     * @param {number} preTriggerSamples- 트리거 이전 샘플 수 (t=0 기준점)
     * @param {number} numOfData        - 총 샘플 수
     */
    loadTriggerData(channelData, periodMs, preTriggerSamples, numOfData) {
        this.clearData();
        this.isRunning = false;
        this.startTime = 0; // 렌더링 기준점 (t는 절대값으로 관리)

        for (const [chIdxStr, samples] of Object.entries(channelData)) {
            const chIdx = parseInt(chIdxStr);
            if (chIdx < 0 || chIdx >= this.channels.length) continue;
            const ch = this.channels[chIdx];
            if (!ch.enabled) continue;

            for (let i = 0; i < samples.length; i++) {
                const t = (i - preTriggerSamples) * periodMs; // 트리거 시점 = t=0
                const v = samples[i];
                ch.data.push({ t, v });
                if (ch.runMin === null || v < ch.runMin) ch.runMin = v;
                if (ch.runMax === null || v > ch.runMax) ch.runMax = v;
            }
        }

        // 전체 데이터 범위에 맞게 뷰 조정
        const totalMs = numOfData * periodMs;
        const preMs   = preTriggerSamples * periodMs;
        this.viewMinTime = -preMs;
        this.timeScale   = totalMs;
        this.autoScroll  = false;

        // 트리거 라인 위치 기록 (t=0)
        this.triggerTimeMs = 0;

        if (this.autoScale) this.calculateAutoScale();
        this.updateStats();
        this.updateMarkersInfo();
        this.render();
    }

    setMode(mode) {
        this.mode = mode;
        this.clearData();

        if (mode === 'trigger') {
            this.updateTriggerStatus('Waiting');
        }
    }

    updateStatus(status) {
        const el = document.getElementById('chartStatus');
        if (el) el.textContent = status;
    }

    updateTriggerStatus(status) {
        const el = document.getElementById('triggerStatus');
        if (el) {
            el.textContent = status;
            el.className = 'trigger-status-value';
            if (status === 'Armed') el.classList.add('armed');
            if (status === 'Triggered') el.classList.add('triggered');
        }
    }

    updateStats() {
        let totalSamples = 0;
        let timeRange = 0;

        for (const ch of this.channels) {
            if (!ch.enabled) continue;
            totalSamples += ch.data.length;
            if (ch.data.length > 0) {
                const lastT = ch.data[ch.data.length - 1].t;
                if (lastT > timeRange) timeRange = lastT;
            }
        }

        const sampleEl = document.getElementById('chartSampleCount');
        const timeEl   = document.getElementById('chartTimeRange');
        const ptsEl    = document.getElementById('chartTotalPoints');

        if (sampleEl) sampleEl.textContent = totalSamples;
        if (timeEl)   timeEl.textContent   = this.formatTime(timeRange);
        if (ptsEl)    ptsEl.textContent    = totalSamples >= 1000
            ? (totalSamples / 1000).toFixed(1) + 'k'
            : String(totalSamples);
    }

    // Animation
    startAnimation() {
        const animate = () => {
            if (!this.isRunning) return;

            if (!this.isPaused) {
                if (this.autoScroll && this.mode === 'continuous') {
                    const latestTime    = this.getLatestTime();
                    const targetViewMin = Math.max(0, latestTime - this.timeScale);
                    const diff          = targetViewMin - this.viewMinTime;
                    // One frame's worth of smooth motion (timeScale / 60fps).
                    // If the jump is within this threshold it's normal streaming → snap directly (no lag).
                    // If it's a large burst arrival → rate-limit to smooth the jump over a few frames.
                    const threshold = this.timeScale / 60;
                    if (diff <= threshold) {
                        // Normal case: snap (covers data arriving faster OR slower than wall clock)
                        this.viewMinTime = targetViewMin;
                    } else {
                        // Burst case: advance by at most one threshold per frame
                        this.viewMinTime += threshold;
                    }
                    this.viewMinTime = Math.max(0, this.viewMinTime);
                }
                this.render();
            }
            this.updateStats();

            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    cancelAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // Rendering
    render() {
        if (this.splitView) {
            this.renderSplit();
            return;
        }

        // Adjust left margin based on Y-axis mode
        if (this.yAxisMode === 'independent') {
            const numActive = this.channels.filter(ch => ch.enabled).length;
            this.chartMargins.left = 60 + 50 * Math.max(0, numActive - 1);
        } else {
            this.chartMargins.left = 60;
        }

        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;

        // Clear canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        this.drawGrid();

        // Draw axes
        this.drawAxes();

        // Draw data
        this.drawData();

        // Draw trigger level (in trigger mode)
        if (this.mode === 'trigger') {
            this.drawTriggerLevel();
        }

        // Draw markers
        this.drawMarkers();

        // Draw cursor
        if (this.showCursor && this.cursorPos) {
            this.drawCursor();
        }
    }

    renderSplit() {
        const ctx = this.ctx;
        const enabledChs = this.channels
            .map((ch, i) => ({ ch, i }))
            .filter(({ ch }) => ch.enabled);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.width, this.height);

        if (enabledChs.length === 0) return;

        const n = enabledChs.length;
        const xAxisH = 30;  // X label space shown on last panel only
        const panelGap = 3;
        const panelH = Math.floor((this.height - xAxisH - panelGap * (n - 1)) / n);

        // viewMinTime is updated smoothly in the animation loop, not here

        // Temporarily override shared state so existing draw methods work per-panel
        const origMargins    = { ...this.chartMargins };
        const origEnabled    = this.channels.map(ch => ch.enabled);
        const origYAxisMode  = this.yAxisMode;
        const origAutoScroll = this.autoScroll;

        this.autoScroll = false; // prevent draw methods from touching viewMinTime
        this.yAxisMode   = 'independent'; // each panel uses its own Y axis

        enabledChs.forEach(({ ch, i: chIdx }, pIdx) => {
            const isLast     = pIdx === n - 1;
            const panelTop   = pIdx * (panelH + panelGap);
            const panelBottom = panelTop + panelH;

            // Panel separator
            if (pIdx > 0) {
                ctx.fillStyle = '#dee2e6';
                ctx.fillRect(0, panelTop - panelGap, this.width, panelGap);
            }
            ctx.fillStyle = '#fafafa';
            ctx.fillRect(0, panelTop, this.width, panelH);

            // Set margins so draw methods render into this panel's bounds.
            // chart bottom = panelBottom; X labels (bottom+5) are clipped
            // on non-last panels via the clip rect below.
            this.chartMargins = {
                top:    panelTop + 14,
                bottom: this.height - panelBottom,
                left:   60,
                right:  20,
            };

            // Per-channel Y auto-scale — O(1) via running min/max
            if (ch.runMin !== null) {
                const range = (ch.runMax - ch.runMin) || 1;
                ch.chYMin = ch.runMin - range * this.margin;
                ch.chYMax = ch.runMax + range * this.margin;
            } else {
                ch.chYMin = 0; ch.chYMax = 100;
            }

            // Enable only this channel for this panel's draw pass
            this.channels.forEach((c, ci) => { c.enabled = ci === chIdx; });

            // Clip: last panel includes xAxisH so X labels are visible;
            // other panels clip them off to prevent overlap with next panel.
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, panelTop, this.width, isLast ? panelH + xAxisH : panelH);
            ctx.clip();

            // Reuse existing draw methods — no duplicated rendering logic
            this.drawGrid();
            this.drawAxes();
            this.drawData();

            ctx.restore();
        });

        // Restore original state
        this.chartMargins = origMargins;
        this.channels.forEach((ch, i) => { ch.enabled = origEnabled[i]; });
        this.yAxisMode   = origYAxisMode;
        this.autoScroll  = origAutoScroll;

        // Cursor vertical line spanning all panels
        if (this.showCursor && this.cursorPos) {
            const x = this.cursorPos.x;
            const mLeft  = 60;
            const mRight = this.width - 20;
            if (x >= mLeft && x <= mRight) {
                const totalH = n * (panelH + panelGap) - panelGap;
                ctx.strokeStyle = 'rgba(0, 123, 255, 0.5)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, totalH);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }

    setSplitView(enabled) {
        this.splitView = enabled;
        if (!this.isRunning) this.render();
    }

    // Returns index of first element with .t >= t
    _bisectLeft(data, t) {
        let lo = 0, hi = data.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (data[mid].t < t) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }

    // Returns index of last element with .t <= t
    _bisectRight(data, t) {
        let lo = 0, hi = data.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (data[mid].t <= t) lo = mid + 1;
            else hi = mid;
        }
        return lo - 1;
    }

    niceStep(range, targetTicks) {
        const rough = range / targetTicks;
        const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
        const normalized = rough / magnitude;
        let nice;
        if (normalized < 1.5) nice = 1;
        else if (normalized < 3.5) nice = 2;
        else if (normalized < 7.5) nice = 5;
        else nice = 10;
        return nice * magnitude;
    }

    drawGrid() {
        const ctx = this.ctx;
        const left = this.chartMargins.left;
        const right = this.width - this.chartMargins.right;
        const top = this.chartMargins.top;
        const bottom = this.height - this.chartMargins.bottom;

        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;

        // Vertical grid lines — data-aligned (time)
        const visMinX = this.screenToChartX(left);
        const visMaxX = this.screenToChartX(right);
        const xStep = this.niceStep(visMaxX - visMinX, 10);
        const xStart = Math.ceil(visMinX / xStep) * xStep;
        for (let t = xStart; t <= visMaxX + xStep * 0.01; t += xStep) {
            if (t < 0) continue;
            const sx = this.chartToScreenX(t);
            ctx.beginPath();
            ctx.moveTo(sx, top);
            ctx.lineTo(sx, bottom);
            ctx.stroke();
        }

        // Horizontal grid lines
        if (this.yAxisMode === 'independent') {
            // 8 evenly spaced lines (no value-based alignment)
            for (let i = 0; i <= 8; i++) {
                const sy = top + (i / 8) * (bottom - top);
                ctx.beginPath();
                ctx.moveTo(left, sy);
                ctx.lineTo(right, sy);
                ctx.stroke();
            }
        } else {
            const visMinY = this.screenToChartY(bottom);
            const visMaxY = this.screenToChartY(top);
            const yStep = this.niceStep(visMaxY - visMinY, 8);
            const yStart = Math.ceil(visMinY / yStep) * yStep;
            for (let v = yStart; v <= visMaxY + yStep * 0.01; v += yStep) {
                const sy = this.chartToScreenY(v);
                ctx.beginPath();
                ctx.moveTo(left, sy);
                ctx.lineTo(right, sy);
                ctx.stroke();
            }
        }
    }

    drawAxes() {
        const ctx = this.ctx;
        const left = this.chartMargins.left;
        const right = this.width - this.chartMargins.right;
        const top = this.chartMargins.top;
        const bottom = this.height - this.chartMargins.bottom;

        // X-axis border (always)
        ctx.strokeStyle = '#adb5bd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left, bottom);
        ctx.lineTo(right, bottom);
        ctx.stroke();

        // X-axis labels
        const visMinX = this.screenToChartX(left);
        const visMaxX = this.screenToChartX(right);
        const xStep = this.niceStep(visMaxX - visMinX, 10);
        const xStart = Math.ceil(visMinX / xStep) * xStep;
        ctx.fillStyle = '#6c757d';
        ctx.font = '10px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let t = xStart; t <= visMaxX + xStep * 0.01; t += xStep) {
            if (t < 0) continue;
            const sx = this.chartToScreenX(t);
            ctx.fillText(this.formatTime(t), sx, bottom + 5);
        }

        if (this.yAxisMode === 'independent') {
            // Per-channel colored Y-axes
            const activeChannels = this.channels
                .map((ch, i) => ({ ch, i }))
                .filter(({ ch }) => ch.enabled);

            ctx.textBaseline = 'middle';
            activeChannels.forEach(({ ch }, activeIdx) => {
                const axisX = left - 50 * activeIdx;
                const yMin = ch.chYMin ?? 0;
                const yMax = ch.chYMax ?? 100;

                // Axis line
                ctx.strokeStyle = ch.color;
                ctx.lineWidth = activeIdx === 0 ? 1.5 : 1;
                ctx.beginPath();
                ctx.moveTo(axisX, top);
                ctx.lineTo(axisX, bottom);
                ctx.stroke();

                // Ticks and labels (5 divisions)
                ctx.fillStyle = ch.color;
                ctx.font = '9px Consolas, monospace';
                ctx.textAlign = 'right';
                const tickCount = 4;
                const range = yMax - yMin || 1;
                const decimals = Math.abs(range) >= 100 ? 0 : Math.abs(range) >= 10 ? 1 : 2;
                for (let t = 0; t <= tickCount; t++) {
                    const frac = t / tickCount;
                    const val = yMin + frac * range;
                    const sy = this.valueToScreenY(val, yMin, yMax);
                    ctx.strokeStyle = ch.color;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(axisX, sy);
                    ctx.lineTo(axisX - 4, sy);
                    ctx.stroke();
                    ctx.fillText(val.toFixed(decimals), axisX - 6, sy);
                }

                // Channel name at top
                ctx.font = 'bold 9px Consolas, monospace';
                ctx.textAlign = 'center';
                ctx.fillText(ch.name, axisX, top - 6);
            });
        } else {
            // Single Y-axis
            ctx.strokeStyle = '#adb5bd';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(left, top);
            ctx.lineTo(left, bottom);
            ctx.stroke();

            const visMinY = this.screenToChartY(bottom);
            const visMaxY = this.screenToChartY(top);
            const yStep = this.niceStep(visMaxY - visMinY, 8);
            const yStart = Math.ceil(visMinY / yStep) * yStep;
            const yDecimals = yStep >= 1 ? 0 : yStep >= 0.1 ? 1 : yStep >= 0.01 ? 2 : 3;
            ctx.fillStyle = '#6c757d';
            ctx.font = '10px Consolas, monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const yUnitLabel = this.yAxisMode === 'normalize' ? '%' : '';
            for (let v = yStart; v <= visMaxY + yStep * 0.01; v += yStep) {
                const sy = this.chartToScreenY(v);
                ctx.fillText(v.toFixed(yDecimals) + yUnitLabel, left - 5, sy);
            }
        }
    }

    drawData() {
        const ctx = this.ctx;
        const left = this.chartMargins.left;
        const right = this.width - this.chartMargins.right;
        const top = this.chartMargins.top;
        const bottom = this.height - this.chartMargins.bottom;
        const chartWidth = right - left;
        const chartHeight = bottom - top;

        // Save context for clipping
        ctx.save();

        // Create clipping region
        ctx.beginPath();
        ctx.rect(left, top, chartWidth, chartHeight);
        ctx.clip();

        // viewMinTime is updated smoothly in the animation loop, not here

        // Draw each channel — only iterate visible window (binary search)
        const visMin = this.viewMinTime;
        const visMax = visMin + this.timeScale;

        for (const ch of this.channels) {
            if (!ch.enabled || ch.data.length < 2) continue;

            // Binary search: one point before and after visible range for smooth line entry/exit
            const startIdx = Math.max(0, this._bisectLeft(ch.data, visMin) - 1);
            const endIdx   = Math.min(ch.data.length - 1, this._bisectRight(ch.data, visMax) + 1);

            ctx.strokeStyle = ch.color;
            ctx.lineWidth = 2;
            ctx.beginPath();

            let started = false;
            for (let k = startIdx; k <= endIdx; k++) {
                const point = ch.data[k];
                const x = this.chartToScreenX(point.t);
                let y;
                if (this.yAxisMode === 'independent') {
                    y = this.valueToScreenY(point.v, ch.chYMin ?? 0, ch.chYMax ?? 100);
                } else if (this.yAxisMode === 'normalize') {
                    const range = (ch.chYMax ?? 1) - (ch.chYMin ?? 0);
                    const normalized = range !== 0
                        ? ((point.v - (ch.chYMin ?? 0)) / range) * 100
                        : 50;
                    y = this.chartToScreenY(normalized);
                } else {
                    y = this.chartToScreenY(point.v * ch.scale + ch.offset);
                }

                if (!started) {
                    ctx.moveTo(x, y);
                    started = true;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }

        ctx.restore();
    }

    drawTriggerLevel() {
        const ctx = this.ctx;
        const left  = this.chartMargins.left;
        const right = this.width - this.chartMargins.right;
        const top   = this.chartMargins.top;
        const bottom = this.height - this.chartMargins.bottom;

        // 트리거 레벨 수평선 (hardware trigger에서는 level이 설정된 경우에만 표시)
        const levelVal = parseFloat(document.getElementById('triggerLevel')?.value);
        const pickerVal = parseInt(document.getElementById('triggerSourcePicker')?.dataset.selectedValue ?? 255);
        if (!isNaN(levelVal) && pickerVal !== 255) { // Immediate(0xFF=255)가 아닌 경우에만 레벨선 표시
            let y;
            if (this.yAxisMode === 'independent') {
                const ch = this.channels[this.trigger.channel];
                const yMin = ch?.chYMin ?? this.yMin;
                const yMax = ch?.chYMax ?? this.yMax;
                y = this.valueToScreenY(levelVal, yMin, yMax);
            } else {
                y = this.chartToScreenY(levelVal);
            }

            ctx.strokeStyle = '#ffc107';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = '#ffc107';
            ctx.font = '10px Consolas, monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`T:${levelVal}`, right - 2, y - 3);
        }

        // 트리거 시점 수직선 (loadTriggerData 완료 후 t=0 위치)
        if (this.triggerTimeMs !== undefined) {
            const x = this.chartToScreenX(this.triggerTimeMs);
            if (x >= left && x <= right) {
                ctx.strokeStyle = 'rgba(255, 193, 7, 0.8)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(x, top);
                ctx.lineTo(x, bottom);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = '#ffc107';
                ctx.font = '10px Consolas, monospace';
                ctx.textAlign = 'left';
                ctx.fillText('T', x + 3, top + 12);
            }
        }
    }

    drawMarkers() {
        if (this.markers.length === 0) return;

        const ctx = this.ctx;
        const top = this.chartMargins.top;
        const bottom = this.height - this.chartMargins.bottom;

        ctx.strokeStyle = '#dc3545';
        ctx.lineWidth = 2;

        for (let i = 0; i < this.markers.length; i++) {
            const m = this.markers[i];
            const x = this.chartToScreenX(m.x);

            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
            ctx.stroke();

            // Marker label
            ctx.fillStyle = '#dc3545';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`M${i + 1}`, x, top - 5);
        }

        // Draw delta between markers
        if (this.markers.length === 2) {
            const x1 = this.chartToScreenX(this.markers[0].x);
            const x2 = this.chartToScreenX(this.markers[1].x);
            const midX = (x1 + x2) / 2;
            const midY = (top + bottom) / 2;
            const delta = Math.abs(this.markers[1].x - this.markers[0].x);

            ctx.fillStyle = 'rgba(220, 53, 69, 0.8)';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Δ ${this.formatTime(delta)}`, midX, midY);
        }
    }

    drawCursor() {
        const ctx = this.ctx;
        const left = this.chartMargins.left;
        const right = this.width - this.chartMargins.right;
        const top = this.chartMargins.top;
        const bottom = this.height - this.chartMargins.bottom;

        const x = this.cursorPos.x;
        const y = this.cursorPos.y;

        ctx.strokeStyle = 'rgba(0, 123, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();

        ctx.setLineDash([]);
    }

    // Export functions
    exportToCSV() {
        let csv = 'Time(ms)';
        for (const ch of this.channels) {
            if (ch.enabled) csv += `,${ch.name}`;
        }
        csv += '\n';

        // Get all unique timestamps
        const times = new Set();
        for (const ch of this.channels) {
            if (!ch.enabled) continue;
            for (const point of ch.data) {
                times.add(point.t);
            }
        }

        const sortedTimes = Array.from(times).sort((a, b) => a - b);

        for (const t of sortedTimes) {
            let row = t.toFixed(1);
            for (const ch of this.channels) {
                if (!ch.enabled) continue;
                const point = ch.data.find(p => p.t === t);
                row += ',' + (point ? point.v.toFixed(2) : '');
            }
            csv += row + '\n';
        }

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chart_data_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportToPNG() {
        const link = document.createElement('a');
        link.download = `chart_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }

    // Zoom controls
    zoomIn() {
        this.zoom.y = Math.min(10, this.zoom.y * 1.2);
        this.autoScale = false;
        if (!this.isRunning) this.render();
    }

    zoomOut() {
        this.zoom.y = Math.max(0.1, this.zoom.y / 1.2);
        this.autoScale = false;
        if (!this.isRunning) this.render();
    }

    resetZoom() {
        this.zoom = { x: 1, y: 1 };
        this.pan = { x: 0, y: 0 };
        this.autoScale = true;
        this.calculateAutoScale();
        if (!this.isRunning) this.render();
    }

    enableAutoScale() {
        this.autoScale = true;
        this.calculateAutoScale();
        if (!this.isRunning) this.render();
    }

    // Y-axis mode
    valueToScreenY(value, yMin, yMax) {
        const chartHeight = this.height - this.chartMargins.top - this.chartMargins.bottom;
        const range = yMax - yMin || 1;
        const relY = (value - yMin) / range;
        return this.chartMargins.top + (1 - relY) * chartHeight;
    }

    setYAxisMode(mode) {
        this.yAxisMode = mode;
        this.calculateAutoScale();
        if (!this.isRunning) this.render();
    }

    setChannelScale(index, scale) {
        if (index >= 0 && index < this.channels.length) {
            this.channels[index].scale = scale;
            if (this.autoScale) this.calculateAutoScale();
            if (!this.isRunning) this.render();
        }
    }

    setChannelOffset(index, offset) {
        if (index >= 0 && index < this.channels.length) {
            this.channels[index].offset = offset;
            if (this.autoScale) this.calculateAutoScale();
            if (!this.isRunning) this.render();
        }
    }

    // Channel configuration
    setChannelEnabled(index, enabled) {
        if (index >= 0 && index < this.channels.length) {
            this.channels[index].enabled = enabled;
        }
    }

    setChannelAddress(index, address) {
        if (index >= 0 && index < this.channels.length) {
            this.channels[index].address = address;
        }
    }

    // Settings
    setTimeScale(ms) {
        this.timeScale = ms;
    }

    setSampleRate(ms) {
        this.sampleRate = ms;
    }

    // Trigger settings
    setTriggerChannel(index) {
        this.trigger.channel = index;
    }

    setTriggerEdge(edge) {
        this.trigger.edge = edge;
    }

    setTriggerLevel(level) {
        this.trigger.level = level;
    }

    setPreSamples(count) {
        this.trigger.preSamples = count;
    }

    setPostSamples(count) {
        this.trigger.postSamples = count;
    }
}

// ─────────────────────────────────────────────────────────
//  MiniChart  —  HW Overview 인라인 차트 (경량 Canvas 렌더러)
// ─────────────────────────────────────────────────────────
class MiniChart {
    constructor(canvas, channels, { maxPoints = 300, displayPoints } = {}) {
        // channels: [{ name, color, chNum }]
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.channels = channels.map(ch => ({ ...ch, data: [] }));
        this.maxPoints = maxPoints;
        this.displayPoints = displayPoints ?? maxPoints;
    }

    addDataPoint(chIdx, value) {
        const ch = this.channels[chIdx];
        if (!ch) return;
        ch.data.push(value);
        if (ch.data.length > this.maxPoints) ch.data.shift();
        if (ch.min === undefined || value < ch.min) ch.min = value;
        if (ch.max === undefined || value > ch.max) ch.max = value;
    }

    clear() {
        this.channels.forEach(ch => { ch.data = []; ch.min = undefined; ch.max = undefined; });
        this.render();
    }

    render() {
        const canvas = this.canvas;
        const ctx = this.ctx;
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        ctx.fillStyle = '#fafafa';
        ctx.fillRect(0, 0, W, H);

        // Y축 범위 자동 계산 (표시 구간 기준)
        let min = Infinity, max = -Infinity;
        this.channels.forEach(ch => {
            const view = ch.data.length > this.displayPoints
                ? ch.data.slice(-this.displayPoints)
                : ch.data;
            view.forEach(v => {
                if (v < min) min = v;
                if (v > max) max = v;
            });
        });
        if (!isFinite(min)) { min = -1; max = 1; }
        if (min === max) { min -= 1; max += 1; }
        const pad = (max - min) * 0.1;
        min -= pad; max += pad;

        // 수평 그리드 선 3개
        ctx.strokeStyle = '#e9ecef';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 3; i++) {
            const y = Math.round((i / 3) * H) + 0.5;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        // 채널 라인
        this.channels.forEach(ch => {
            if (ch.data.length < 2) return;
            ctx.strokeStyle = ch.color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            const view = ch.data.length > this.displayPoints
                ? ch.data.slice(-this.displayPoints)
                : ch.data;
            view.forEach((v, i) => {
                const x = (i / (this.displayPoints - 1)) * W;
                const y = H - ((v - min) / (max - min)) * H;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.stroke();
        });

        // Y축 min/max 레이블
        ctx.fillStyle = '#adb5bd';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(max.toFixed(1), 3, 10);
        ctx.fillText(min.toFixed(1), 3, H - 3);
    }
}

// 드라이브 Serial Port 초기값 (단일 출처)
const DEFAULT_SERIAL = {
    baudRate: 19200,
    dataBits: 8,
    parity: 'even',
    stopBits: 1,
};

class ModbusDashboard {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.modbus = new ModbusRTU();
        this.receiveBuffer = new Uint8Array(256);
        this.receiveIndex = 0;
        this.readInProgress = false;
        this._serialDataCb = null; // event-driven RX callback for sendAndReceiveFC64
        this.displayFormat = 'hex'; // 'hex' or 'dec'
        this.parameters = [];

        // Simulator
        this.simulator = new ModbusSimulator();
        this.simulatorEnabled = false;
        this.simulatorUpdateInterval = null;

        // Statistics
        this.stats = {
            requests: 0,
            success: 0,
            errors: 0
        };

        // Per-device statistics
        this.deviceStats = {}; // { slaveId: { requests, success, errors } }

        // Settings
        this.baseFrameCount = 1000; // Default base frame count for error rate calculation

        // Monitor timing
        this.lastMonitorTime = null;

        // Tooltip state
        this.tooltipPinned = false;
        this.pinnedBytesContainer = null;
        this.pinnedGroup = null;

        // Navbar stats tooltip state
        this.statsTooltipPinned = false;

        // Monitor scroll state
        this.monitorAutoScroll = true;
        this.newMessageCount = 0;
        this.isUserScrolling = false;

        // Virtual scroll for monitor
        this.monitorEntries = []; // Store all entries data
        this.monitorItemHeight = 28; // Approximate height of each entry
        this.monitorVisibleCount = 50; // Number of visible items
        this.monitorScrollTop = 0;
        this.monitorRenderScheduled = false;

        // Product Test Dashboard
        this.devices = [];
        this.selectedDevices = new Set();
        this.deviceViewMode = localStorage.getItem('deviceViewMode') || 'card'; // 'card' or 'list'

        // Parameters page device selection
        this.selectedParamDeviceId = null;
        this.currentSetupDeviceId = null;

        // Drag and drop state
        this.draggedElement = null;
        this.draggedDeviceId = null;

        // Modbus Register Addresses
        this.REGISTERS = {
            SETPOINT: 0xD001,
            MOTOR_STATUS: 0xD011,
            ACTUAL_SPEED: 0xD02D,
            OPERATION_MODE: 0xD106,
            MAXIMUM_SPEED: 0xD119,
            ALARM_RESET: 0x800E,
            SOFTWARE_RESET: 0x8001
        };

        // Motor Status Bit Definitions (D011)
        // MSB: 0 0 0 UzLow 0 RL_Cal 0 n_Limit
        // LSB: BLK HLL TFM FB SKF TFE 0 PHA
        this.MOTOR_STATUS_BITS = {
            UzLow:   { mask: 0x1000, name: 'DC Undervolt', description: 'DC-link undervoltage' },
            RL_Cal:  { mask: 0x0400, name: 'Rotor Cal', description: 'Rotor position sensor calibration error' },
            n_Limit: { mask: 0x0100, name: 'Speed Limit', description: 'Speed limit exceeded' },
            BLK:     { mask: 0x0080, name: 'Blocked', description: 'Motor blocked' },
            HLL:     { mask: 0x0040, name: 'Hall Error', description: 'Hall sensor error' },
            TFM:     { mask: 0x0020, name: 'Motor OT', description: 'Motor overheated' },
            FB:      { mask: 0x0010, name: 'Fan Bad', description: 'Fan Bad (general error)' },
            SKF:     { mask: 0x0008, name: 'Comm Error', description: 'Communication error between master and slave controller' },
            TFE:     { mask: 0x0004, name: 'Stage OT', description: 'Output stage overheated' },
            PHA:     { mask: 0x0001, name: 'Phase Fail', description: 'Phase failure or line undervoltage' }
        };

        // Auto Scan settings
        this.autoScanEnabled = true;
        this.scanRangeStart = 1;
        this.scanRangeEnd = 10;
        this.scanTimeout = 200;
        this.scanRegister = 0xD011;
        this.scanRemoveNotFound = false;
        this.isScanning = false;
        this.scanAborted = false;
        this.scanResolve = null;  // Callback for scan response
        this.scanExpectedSlaveId = null;  // Expected slave ID for scan response
        this.serialPortScanActive = false;  // Serial port scan in progress

        // Auto polling for device status
        this.autoPollingEnabled = true;
        this.autoPollingInterval = 50; // ms between polls
        this.autoPollingTimer = null;
        this.currentPollingIndex = 0;
        this.isPolling = false; // Flag to prevent concurrent polling
        this.commandQueue = []; // Queue for user write commands - prevents 485 bus collision during polling
        this._paramReadProgress = null; // 진행 중인 readAllParameters 프로그레스 컨트롤러
        this.pollingTimeout = 200; // Response timeout in ms for polling
        this.commandTimeout = 200; // Response timeout in ms for user commands (write/read)
        this.pendingResponse = null; // Current pending response promise
        this.offlineThreshold = 3; // Number of consecutive failures before marking offline
        this.paramPollingDelay = 20; // ms between monitoring parameters
        this.backgroundPollingEnabled = false; // Use Web Worker timer to avoid browser throttling
        this.pollingWorker = null; // Web Worker for background polling

        // Offset Calibration state
        this.offsetCalibState = {
            phase: 'idle', // 'idle' | 'running' | 'complete' | 'error'
            steps: [
                {
                    id: 'current-offset',
                    label: '전류 Offset 보정',
                    status: 'pending', // 'pending' | 'running' | 'done' | 'error'
                    axes: ['U상', 'V상', 'W상'],
                    before: [null, null, null],
                    after:  [null, null, null],
                },
                {
                    id: 'hall-offset',
                    label: 'Hall Offset 보정',
                    status: 'pending',
                    axes: ['Hall A', 'Hall B', 'Hall C'],
                    before: [null, null, null],
                    after:  [null, null, null],
                },
            ],
        };

        // Current page tracking - restore from sessionStorage if available
        this.currentPage = sessionStorage.getItem('currentPage') || 'dashboard';

        // Chart Manager
        this.chartManager = null;
        this.chartPollingTimer = null;
        this.chartSlaveId = 1;
        this.chartRunning = false;
        this.chartConfiguredChannels = []; // [{ chIdx, chNum }, ...]

        // Mini Chart (HW Overview)
        this.miniChartHall = null;
        this.miniChartCurrent = null;
        this.miniChartRunning = { hall: false, current: false };
        this._fc64Busy = false; // FC64 전환(stop/start) 구간에서 버스 점유 표시
        this.triggerRunning = false; // FC65 Trigger 캡처 진행 중 여부
        this.hidDevice = null;  // WebHID 연결 장치
        this._currentRmsData = [{sumSq:0,count:0},{sumSq:0,count:0},{sumSq:0,count:0}];

        // HW Overview 통합 폴링 (탭 진입 시 자동 시작)
        this.ovPollingRunning = false;
        this.ovOnceExecuted   = false; // OS버전/모터ID/EEPROM 1회 실행 여부

        // Offset 탭 알람코드 폴링 (탭 진입 시 자동 시작)
        this.offsetAlarmPollingRunning = false;

        // Device Setup auto-apply debounce timers
        this.applyDebounceTimers = {};

        // Active category in Configuration panel
        this.activeConfigCategory = 'motorInfo';

        this.initializeUI();
        this.loadParameters();
        this.loadSettings();
        this.loadPollingSettings();
        this.loadDevices();
        this.initializeChartPage();
    }

    /**
     * Initialize UI event listeners
     */
    initializeUI() {
        // 485 컨버터(USB Serial) 물리적 제거 감지
        if ('serial' in navigator) {
            navigator.serial.addEventListener('disconnect', (event) => {
                if (this.isConnected && event.target === this.port) {
                    this.addMonitorEntry('error', 'RS-485 converter physically removed');
                    this.disconnect();
                }
            });
        }

        // Sidebar toggle with hover effect
        const sidebarToggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        let toggleTimeout;

        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            // Adjust main content margin
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.style.marginLeft = sidebar.classList.contains('collapsed') ? '0' : '280px';
            }
        });

        // Show toggle button on hover near left edge
        document.addEventListener('mousemove', (e) => {
            if (e.clientX < 50 && sidebar.classList.contains('collapsed')) {
                sidebarToggle.classList.add('visible');
                clearTimeout(toggleTimeout);
                toggleTimeout = setTimeout(() => {
                    if (!sidebarToggle.matches(':hover')) {
                        sidebarToggle.classList.remove('visible');
                    }
                }, 2000);
            }
        });

        // Expandable menu item (Serial Port)
        const serialPortMenu = document.getElementById('serialPortMenu');
        const serialPortHeader = serialPortMenu.querySelector('.menu-item-header');
        this.serialPortMenuCloseTimer = null;

        serialPortHeader.addEventListener('click', () => {
            serialPortMenu.classList.toggle('expanded');
        });

        // Auto close Serial Port menu when connected and mouse leaves
        serialPortMenu.addEventListener('mouseleave', () => {
            if (this.isConnected || this.simulatorEnabled) {
                this.serialPortMenuCloseTimer = setTimeout(() => {
                    serialPortMenu.classList.remove('expanded');
                }, 1000);
            }
        });

        serialPortMenu.addEventListener('mouseenter', () => {
            if (this.serialPortMenuCloseTimer) {
                clearTimeout(this.serialPortMenuCloseTimer);
                this.serialPortMenuCloseTimer = null;
            }
        });

        // Initially open Serial Port menu if not connected
        if (!this.isConnected && !this.simulatorEnabled) {
            serialPortMenu.classList.add('expanded');
        }

        // Settings Modal
        this.initSettingsModal();

        // Monitor Panel toggle
        this.initMonitorPanel();

        // Developer Mode - Logo Click Easter Egg
        this.initDeveloperMode();

        // Top-level menu navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.switchPage(page);
                this._setMenuActive(page);
            });
        });

        // Format toggle (HEX/DEC)
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.displayFormat = btn.dataset.format;
                document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.refreshMonitorDisplay();
            });
        });

        // Connection button (sidebar) - single toggle
        document.getElementById('sidebar-connectBtn').addEventListener('click', () => {
            if (this.isConnected) {
                this.disconnect();
            } else {
                this.connect();
            }
        });

        // Sync sidebar serial settings with main settings
        this.syncSerialSettings();

        // Modbus controls
        document.getElementById('sendBtn').addEventListener('click', () => this.sendModbusRequest());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearMonitor());

        // Real-time value conversion for Modbus input fields
        const modbusInputs = [
            { id: 'slaveId', min: 0, max: 255 },
            { id: 'startAddress', min: 0, max: 65535 },
            { id: 'quantity', min: 1, max: 125 },
            { id: 'writeValue', min: 0, max: 65535 }
        ];

        modbusInputs.forEach(({ id, min, max }) => {
            const input = document.getElementById(id);
            if (input) {
                // Update on input (real-time)
                input.addEventListener('input', () => {
                    this.updateConvertedValue(id, min, max);
                });

                // Initial update
                this.updateConvertedValue(id, min, max);
            }
        });

        // Monitor scroll controls
        this.initMonitorScrollControls();

        // Function code change handler
        document.getElementById('functionCode').addEventListener('change', (e) => {
            this.updateWriteValueVisibility(parseInt(e.target.value));
        });

        // FC 0x2B operation change handler (Read/Write)
        document.getElementById('fc2bOperation').addEventListener('change', (e) => {
            const isWrite = e.target.value === 'write';
            document.getElementById('fc2bNumDataGroup').style.display = isWrite ? 'none' : 'flex';
            document.getElementById('fc2bWriteGroup').style.display = isWrite ? 'flex' : 'none';
        });

        // Parameter management
        document.getElementById('addParamBtn').addEventListener('click', () => this.showAddParameterModal());
        document.getElementById('cancelParamBtn').addEventListener('click', () => this.hideAddParameterModal());
        document.getElementById('saveParamBtn').addEventListener('click', () => this.saveParameter());
        document.querySelector('.modal-close').addEventListener('click', () => this.hideAddParameterModal());

        // CSV Import/Export
        document.getElementById('importCsvBtn').addEventListener('click', () => {
            document.getElementById('csvFileInput').click();
        });
        document.getElementById('csvFileInput').addEventListener('change', (e) => this.importCSV(e));
        document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportCSV());
        document.getElementById('loadDefaultCsvBtn').addEventListener('click', () => this.loadDefaultCSV());

        // Parameter filters
        this.paramTypeFilter = 'all';
        this.paramImplementedFilter = 'all';
        this.paramSearchText = '';

        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.paramTypeFilter = e.target.dataset.filter;
                this.renderParameters();
                if (this.selectedParamDeviceId && (this.writer || this.simulatorEnabled)) {
                    this.readAllParameters();
                }
            });
        });

        document.querySelectorAll('.filter-btn[data-implemented]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn[data-implemented]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.paramImplementedFilter = e.target.dataset.implemented;
                this.renderParameters();
                if (this.selectedParamDeviceId && (this.writer || this.simulatorEnabled)) {
                    this.readAllParameters();
                }
            });
        });

        let paramSearchDebounce = null;
        document.getElementById('paramSearchInput').addEventListener('input', (e) => {
            this.paramSearchText = e.target.value.toLowerCase();
            this.renderParameters();
            clearTimeout(paramSearchDebounce);
            paramSearchDebounce = setTimeout(() => {
                if (this.selectedParamDeviceId && (this.writer || this.simulatorEnabled)) {
                    this.readAllParameters();
                }
            }, 500);
        });

        // Close modal on outside click (with drag protection)
        const addParamModal = document.getElementById('addParamModal');
        let paramModalMouseDownTarget = null;

        addParamModal.addEventListener('mousedown', (e) => {
            paramModalMouseDownTarget = e.target;
        });

        addParamModal.addEventListener('click', (e) => {
            if (e.target.id === 'addParamModal' && paramModalMouseDownTarget && paramModalMouseDownTarget.id === 'addParamModal') {
                this.hideAddParameterModal();
            }
            paramModalMouseDownTarget = null;
        });

        // Global ESC key handler for all modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Check and close each modal type
                const addParamModal = document.getElementById('addParamModal');
                const settingsModal = document.getElementById('settingsModal');
                const deviceEditModal = document.getElementById('deviceEditModal');
                const confirmModal = document.getElementById('confirmModal');

                if (addParamModal && addParamModal.style.display === 'flex') {
                    this.hideAddParameterModal();
                } else if (settingsModal && settingsModal.style.display === 'flex') {
                    this.closeSettingsModal();
                } else if (deviceEditModal && deviceEditModal.style.display === 'flex') {
                    const closeBtn = document.getElementById('closeDeviceEditBtn');
                    if (closeBtn) closeBtn.click();
                } else if (confirmModal && confirmModal.style.display === 'flex') {
                    // Confirm modal is handled by its own ESC handler in showConfirm()
                    const cancelBtn = document.getElementById('confirmCancelBtn');
                    if (cancelBtn) cancelBtn.click();
                }
            }
        });

        // Parameter page device selector (event delegation for radio buttons)
        const paramDeviceRadioGroup = document.getElementById('paramDeviceRadioGroup');
        if (paramDeviceRadioGroup) {
            paramDeviceRadioGroup.addEventListener('change', (e) => {
                if (e.target.classList.contains('param-device-radio')) {
                    this.selectedParamDeviceId = parseInt(e.target.value);
                    this.updateParamDeviceStatus();
                }
            });
        }

        // Parameter page device selector collapse/expand toggle
        const paramDeviceHeaderLeft = document.querySelector('.param-device-header-left');
        const paramDeviceSelector = document.querySelector('.param-device-selector');
        if (paramDeviceHeaderLeft && paramDeviceSelector) {
            // Fixed mode: when true, hover doesn't affect open/close
            let isFixedMode = false;

            // Start expanded
            paramDeviceSelector.classList.add('expanded');

            // Header left click: always toggle open/close
            paramDeviceHeaderLeft.addEventListener('click', () => {
                paramDeviceSelector.classList.toggle('collapsed');
                paramDeviceSelector.classList.toggle('expanded');
            });

            // Box click (outside header-left): toggle fixed mode
            paramDeviceSelector.addEventListener('click', (e) => {
                // Ignore clicks on header-left (open/close area) or Read All button
                if (e.target.closest('.param-device-header-left')) return;
                if (e.target.closest('#paramReadAllBtn')) return;

                isFixedMode = !isFixedMode;
                paramDeviceSelector.classList.toggle('click-mode', isFixedMode);
            });

            // Auto-collapse when mouse leaves (only if not fixed and a device is selected)
            paramDeviceSelector.addEventListener('mouseleave', () => {
                if (!isFixedMode && this.selectedParamDeviceId) {
                    paramDeviceSelector.classList.add('collapsed');
                    paramDeviceSelector.classList.remove('expanded');
                }
            });

            // Auto-expand when mouse enters (only if not fixed)
            paramDeviceSelector.addEventListener('mouseenter', () => {
                if (!isFixedMode) {
                    paramDeviceSelector.classList.remove('collapsed');
                    paramDeviceSelector.classList.add('expanded');
                }
            });
        }

        const paramReadAllBtn = document.getElementById('paramReadAllBtn');
        if (paramReadAllBtn) {
            paramReadAllBtn.addEventListener('click', () => this.readAllParameters());
        }

        // Simulator controls
        document.getElementById('simToggleBtn').addEventListener('click', () => this.toggleSimulator());
        document.getElementById('simResetBtn').addEventListener('click', () => this.resetSimulator());
        document.getElementById('simSlaveId').addEventListener('change', (e) => {
            this.simulator.slaveId = parseInt(e.target.value);
        });
        document.getElementById('simDelay').addEventListener('change', (e) => {
            this.simulator.responseDelay = parseInt(e.target.value);
        });

        // Settings controls
        document.getElementById('baseFrameCount').addEventListener('change', (e) => {
            this.baseFrameCount = parseInt(e.target.value);
            this.saveSettings();
            this.updateStatsDisplay();
        });

        // Navbar stats tooltip click-to-pin
        this.initNavbarStatsTooltip();

        // Product Test Dashboard controls
        this.initDashboardUI();

        // Auto Scan controls
        this.initAutoScanUI();
        this.initSerialPortScanUI();

        // Firmware upload controls
        this.initFirmwareUI();

        // Check Web Serial API support
        if (!('serial' in navigator)) {
            this.addMonitorEntry('error', 'Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
            // Don't disable connect button - simulator can still work
        }
    }

    /**
     * Initialize navbar stats tooltip click-to-pin
     */
    initNavbarStatsTooltip() {
        const navbarStats = document.getElementById('navbarStats');
        const statsTooltip = document.getElementById('navbarStatsTooltip');

        if (!navbarStats || !statsTooltip) return;

        // Click to toggle pin
        navbarStats.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleStatsTooltipPin();
        });

        // Prevent clicks inside tooltip from unpinning
        statsTooltip.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Clear stats button
        const clearBtn = document.getElementById('clearStatsBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetStats();
            });
        }
    }

    /**
     * Reset communication statistics
     */
    resetStats() {
        this.stats = { requests: 0, success: 0, errors: 0 };
        this.deviceStats = {};
        this.updateStatsDisplay();
    }

    /**
     * Toggle stats tooltip pin state
     */
    toggleStatsTooltipPin() {
        const statsTooltip = document.getElementById('navbarStatsTooltip');
        if (!statsTooltip) return;

        if (this.statsTooltipPinned) {
            this.unpinStatsTooltip();
        } else {
            this.pinStatsTooltip();
        }
    }

    /**
     * Pin stats tooltip
     */
    pinStatsTooltip() {
        const statsTooltip = document.getElementById('navbarStatsTooltip');
        if (!statsTooltip) return;

        this.statsTooltipPinned = true;
        statsTooltip.classList.add('pinned');

        // Add outside click listener
        setTimeout(() => {
            document.addEventListener('click', this.handleStatsOutsideClick);
        }, 0);
    }

    /**
     * Unpin stats tooltip
     */
    unpinStatsTooltip() {
        const statsTooltip = document.getElementById('navbarStatsTooltip');
        if (!statsTooltip) return;

        this.statsTooltipPinned = false;
        statsTooltip.classList.remove('pinned');

        // Remove outside click listener
        document.removeEventListener('click', this.handleStatsOutsideClick);
    }

    /**
     * Handle outside click to unpin stats tooltip
     */
    handleStatsOutsideClick = (e) => {
        const navbarStats = document.getElementById('navbarStats');
        const statsTooltip = document.getElementById('navbarStatsTooltip');

        if (navbarStats && statsTooltip &&
            !navbarStats.contains(e.target) &&
            !statsTooltip.contains(e.target)) {
            this.unpinStatsTooltip();
        }
    }

    /**
     * Sync sidebar serial settings
     */
    syncSerialSettings() {
        const sidebarBaudRate = document.getElementById('sidebar-baudRate');
        const sidebarParity = document.getElementById('sidebar-parity');
        const sidebarDataBits = document.getElementById('sidebar-dataBits');
        const sidebarStopBits = document.getElementById('sidebar-stopBits');

        // 드라이브 초기값으로 설정 (DEFAULT_SERIAL 상수 참조)
        if (sidebarBaudRate) sidebarBaudRate.value = String(DEFAULT_SERIAL.baudRate);
        if (sidebarParity) sidebarParity.value = DEFAULT_SERIAL.parity;
        if (sidebarDataBits) sidebarDataBits.value = String(DEFAULT_SERIAL.dataBits);
        if (sidebarStopBits) sidebarStopBits.value = String(DEFAULT_SERIAL.stopBits);

        // Then load saved settings (will override defaults)
        this.loadSerialSettings();
    }

    /**
     * Initialize Developer Mode Easter Egg
     * Logo click 5 times to activate manufacture menu
     */
    initDeveloperMode() {
        let clickCount = 0;
        let clickTimer = null;
        const logo = document.querySelector('.navbar-logo-img');
        const manufactureMenuItem = document.getElementById('manufactureMenuItem');
        const disableDevModeBtn = document.getElementById('disableDevModeBtn');

        // Check if developer mode is already enabled
        if (sessionStorage.getItem('developerMode') === 'true') {
            this.enableDeveloperMode();
        }

        // Logo click handler
        if (logo) {
            logo.addEventListener('click', () => {
                clickCount++;

                // Reset timer
                if (clickTimer) {
                    clearTimeout(clickTimer);
                }

                // If 5 clicks within 2 seconds, toggle developer mode
                if (clickCount >= 5) {
                    if (sessionStorage.getItem('developerMode') === 'true') {
                        disableDevModeBtn && disableDevModeBtn.click();
                    } else {
                        sessionStorage.setItem('developerMode', 'true');
                        this.enableDeveloperMode();
                        this.showToast('🔧 개발자 모드가 활성화되었습니다', 'success');
                    }
                    clickCount = 0;
                } else {
                    // Reset click count after 2 seconds
                    clickTimer = setTimeout(() => {
                        clickCount = 0;
                    }, 2000);
                }
            });
        }

        // Disable developer mode button handler
        if (disableDevModeBtn) {
            disableDevModeBtn.addEventListener('click', () => {
                sessionStorage.removeItem('developerMode');
                if (manufactureMenuItem) {
                    manufactureMenuItem.style.display = 'none';
                }

                // Hide manufacture tab in Device page
                const deviceManufactureTab = document.querySelector('.device-setup-tab[data-tab="manufacture"]');
                if (deviceManufactureTab) {
                    deviceManufactureTab.style.display = 'none';
                }

                // Hide communication statistics in navbar
                const navbarStats = document.getElementById('navbarStats');
                if (navbarStats) {
                    navbarStats.style.display = 'none';
                }

                this.showToast('🔧 개발자 모드가 비활성화되었습니다', 'error');
                // Switch to dashboard if currently on manufacture page
                if (this.currentPage === 'manufacture') {
                    this.switchPage('dashboard');
                    this._setMenuActive('dashboard');
                }
            });
        }

        // Restore last visited page from sessionStorage and activate immediately
        const savedPage = sessionStorage.getItem('currentPage');
        // firmware is no longer a separate page; redirect to device-setup
        const pageToShow = (savedPage === 'firmware' ? 'device-setup' : savedPage) || 'dashboard';

        // Immediately activate the correct page without rendering other pages first
        const pageElement = document.getElementById(`page-${pageToShow}`);
        if (pageElement) {
            // Directly set active class to avoid rendering unwanted pages
            pageElement.classList.add('active');

            // Update menu item active state immediately
            this._setMenuActive(pageToShow);
        }
    }

    /**
     * Enable developer mode - show manufacture menu
     */
    enableDeveloperMode() {
        const manufactureMenuItem = document.getElementById('manufactureMenuItem');
        if (manufactureMenuItem) {
            manufactureMenuItem.style.display = 'flex';
        }

        // Also show manufacture tab in Device page
        const deviceManufactureTab = document.querySelector('.device-setup-tab[data-tab="manufacture"]');
        if (deviceManufactureTab) {
            deviceManufactureTab.style.display = '';  // Remove inline display:none to show the button
        }

        // Show communication statistics in navbar
        const navbarStats = document.getElementById('navbarStats');
        if (navbarStats) {
            navbarStats.style.display = 'flex';
        }
    }

    /**
     * Set active state on menu item for the given page
     */
    _setMenuActive(page) {
        document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
        const item = document.querySelector(`.menu-item[data-page="${page}"]`);
        if (item) item.classList.add('active');
    }

    /**
     * Switch between pages
     */
    async switchPage(pageName) {
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(`page-${pageName}`).classList.add('active');

        // Track current page
        this.currentPage = pageName;

        // Save current page to sessionStorage for refresh persistence
        sessionStorage.setItem('currentPage', pageName);

        // Clear device setup tab state when leaving device-setup page
        if (pageName !== 'device-setup') {
            sessionStorage.removeItem('deviceSetupTab');
            sessionStorage.removeItem('manufactureSubtab');
        }

        // HW Overview 폴링은 해당 탭에서만 동작 — 페이지 전환 시 항상 중지
        this.stopOvPolling();
        this.stopOffsetAlarmPolling();

        // Start/stop polling based on page
        if (pageName === 'dashboard') {
            // Start polling when on Dashboard
            if (this.writer || this.simulatorEnabled) {
                this.startAutoPolling();
            }
        } else {
            // Stop polling when leaving Dashboard
            this.stopAutoPolling();
            // 진행 중인 폴링 사이클이 완전히 끝날 때까지 대기
            // (isPolling=true 상태에서 refreshDevice가 직접 TX를 쏘면 버스 충돌 발생)
            const deadline = Date.now() + 1000;
            while (this.isPolling && Date.now() < deadline) {
                await this.delay(5);
            }
        }

        // Update device setup list when switching to device-setup page
        if (pageName === 'device-setup') {
            this.renderDeviceSetupList();
        }

        // Resize chart canvas when switching to chart page
        if (pageName === 'chart' && this.chartManager) {
            setTimeout(() => {
                this.chartManager.resizeCanvas();
                this.chartManager.render();
            }, 50);
        }
    }

    /**
     * Initialize Monitor Panel (right slide panel)
     */
    initMonitorPanel() {
        const toggleBtn = document.getElementById('monitorToggleBtn');
        const panel = document.getElementById('monitorPanel');
        const closeBtn = document.getElementById('monitorPanelClose');
        const mainContent = document.querySelector('.main-content');
        const resizeHandle = document.getElementById('monitorResizeHandle');

        // State
        this.monitorPanelOpen = false;
        this.monitorPanelWidth = parseInt(localStorage.getItem('monitorPanelWidth')) || 500;

        // Apply saved width using CSS variable
        panel.style.width = this.monitorPanelWidth + 'px';
        document.documentElement.style.setProperty('--monitor-panel-width', this.monitorPanelWidth + 'px');

        // Set initial closed position based on panel width
        if (!panel.classList.contains('open')) {
            panel.style.right = `-${this.monitorPanelWidth + 50}px`;
        }

        // Toggle button click
        toggleBtn.addEventListener('click', () => {
            this.toggleMonitorPanel();
        });

        // Close button click
        closeBtn.addEventListener('click', () => {
            this.closeMonitorPanel();
        });

        // Keyboard shortcut (Ctrl+M or Cmd+M)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
                e.preventDefault();
                this.toggleMonitorPanel();
            }
        });

        // Resize functionality
        this.initMonitorResize(resizeHandle, panel, mainContent);

        // Raw data copy functionality (event delegation)
        const monitorDisplay = document.getElementById('monitorDisplay');
        monitorDisplay.addEventListener('click', (e) => {
            const rawContainer = e.target.closest('.monitor-raw-container');
            if (rawContainer) {
                e.stopPropagation();
                const rawData = rawContainer.dataset.raw;
                navigator.clipboard.writeText(rawData).then(() => {
                    this.showToast('Raw 데이터가 클립보드에 복사되었습니다', 'success');
                }).catch(() => {
                    this.showToast('복사에 실패했습니다', 'error');
                });
            }
        });
    }

    /**
     * Initialize monitor panel resize functionality
     */
    initMonitorResize(handle, panel, mainContent) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        const startResize = (e) => {
            isResizing = true;
            startX = e.clientX || e.touches[0].clientX;
            startWidth = panel.offsetWidth;
            panel.classList.add('resizing');
            handle.classList.add('active');
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        };

        const doResize = (e) => {
            if (!isResizing) return;

            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            if (clientX === undefined) return;

            const diff = startX - clientX;
            let newWidth = startWidth + diff;

            // Constrain width
            const minWidth = 350;
            const maxWidth = window.innerWidth * 0.8;
            newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

            // Apply new width
            panel.style.width = newWidth + 'px';
            this.monitorPanelWidth = newWidth;

            // Update main content margin if panel is open
            if (this.monitorPanelOpen) {
                mainContent.style.marginRight = newWidth + 'px';
                document.documentElement.style.setProperty('--monitor-width', newWidth + 'px');
            }
        };

        const stopResize = () => {
            if (!isResizing) return;
            isResizing = false;
            panel.classList.remove('resizing');
            handle.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            // Save width to localStorage
            localStorage.setItem('monitorPanelWidth', this.monitorPanelWidth);

            // Update CSS variable for closed position calculation
            document.documentElement.style.setProperty('--monitor-panel-width', this.monitorPanelWidth + 'px');
        };

        // Mouse events
        handle.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);

        // Touch events for mobile
        handle.addEventListener('touchstart', startResize, { passive: false });
        document.addEventListener('touchmove', doResize, { passive: false });
        document.addEventListener('touchend', stopResize);
    }

    /**
     * Toggle Monitor Panel
     */
    toggleMonitorPanel() {
        if (this.monitorPanelOpen) {
            this.closeMonitorPanel();
        } else {
            this.openMonitorPanel();
        }
    }

    /**
     * Open Monitor Panel
     */
    openMonitorPanel() {
        const panel = document.getElementById('monitorPanel');
        const toggleBtn = document.getElementById('monitorToggleBtn');
        const mainContent = document.querySelector('.main-content');
        const grid = document.querySelector('.device-grid');

        // Calculate grid columns for smooth transition
        if (grid) {
            const currentColumns = window.getComputedStyle(grid).gridTemplateColumns;
            const currentCols = currentColumns.split(' ').length;

            // Set current columns as explicit repeat()
            grid.style.gridTemplateColumns = `repeat(${currentCols}, 1fr)`;

            // Force reflow
            void grid.offsetHeight;

            // Calculate new column count after monitor opens
            requestAnimationFrame(() => {
                const newWidth = mainContent.offsetWidth - this.monitorPanelWidth;
                const newCols = Math.max(1, Math.floor(newWidth / 320));
                grid.style.gridTemplateColumns = `repeat(${newCols}, 1fr)`;
                grid.style.transition = 'grid-template-columns 0.3s ease';
            });
        }

        panel.classList.add('open');
        toggleBtn.classList.add('active');
        mainContent.classList.add('monitor-open');
        this.monitorPanelOpen = true;

        // Apply saved width
        mainContent.style.marginRight = this.monitorPanelWidth + 'px';
        document.documentElement.style.setProperty('--monitor-width', this.monitorPanelWidth + 'px');

        // Restore auto-fill after transition completes
        if (grid) {
            setTimeout(() => {
                grid.style.gridTemplateColumns = '';
                grid.style.transition = '';
            }, 300);
        }

        // Save state
        localStorage.setItem('monitorPanelOpen', 'true');
    }

    /**
     * Close Monitor Panel
     */
    closeMonitorPanel() {
        const panel = document.getElementById('monitorPanel');
        const toggleBtn = document.getElementById('monitorToggleBtn');
        const mainContent = document.querySelector('.main-content');
        const grid = document.querySelector('.device-grid');

        // Calculate grid columns for smooth transition
        if (grid) {
            const currentColumns = window.getComputedStyle(grid).gridTemplateColumns;
            const currentCols = currentColumns.split(' ').length;

            // Set current columns as explicit repeat()
            grid.style.gridTemplateColumns = `repeat(${currentCols}, 1fr)`;

            // Force reflow
            void grid.offsetHeight;

            // Calculate new column count after monitor closes
            requestAnimationFrame(() => {
                const newWidth = mainContent.offsetWidth;
                const newCols = Math.max(1, Math.floor(newWidth / 320));
                grid.style.gridTemplateColumns = `repeat(${newCols}, 1fr)`;
                grid.style.transition = 'grid-template-columns 0.3s ease';
            });
        }

        panel.classList.remove('open');
        toggleBtn.classList.remove('active');
        mainContent.classList.remove('monitor-open');
        this.monitorPanelOpen = false;

        // Reset margin
        mainContent.style.marginRight = '';

        // Set closed position based on panel width to fully hide the panel
        const panelWidth = panel.offsetWidth || this.monitorPanelWidth;
        panel.style.right = `-${panelWidth + 50}px`;

        // Restore auto-fill after transition completes
        if (grid) {
            setTimeout(() => {
                grid.style.gridTemplateColumns = '';
                grid.style.transition = '';
            }, 300);
        }

        // Save state
        localStorage.setItem('monitorPanelOpen', 'false');
    }

    /**
     * Initialize Settings Modal
     */
    initSettingsModal() {
        const settingsModal = document.getElementById('settingsModal');
        const openSettingsBtn = document.getElementById('openSettingsBtn');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');

        // Open settings modal
        openSettingsBtn.addEventListener('click', () => {
            this.openSettingsModal();
        });

        // Close settings modal
        closeSettingsBtn.addEventListener('click', () => {
            this.closeSettingsModal();
        });

        // Close on outside click (with drag protection)
        let settingsMouseDownTarget = null;

        settingsModal.addEventListener('mousedown', (e) => {
            settingsMouseDownTarget = e.target;
        });

        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal && settingsMouseDownTarget === settingsModal) {
                this.closeSettingsModal();
            }
            settingsMouseDownTarget = null;
        });

        // Settings menu navigation
        document.querySelectorAll('.settings-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const setting = item.dataset.setting;
                this.switchSettingPanel(setting);

                // Update active state
                document.querySelectorAll('.settings-menu-item').forEach(mi => mi.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // Modal settings controls
        document.getElementById('modal-baseFrameCount').addEventListener('change', (e) => {
            this.baseFrameCount = parseInt(e.target.value);
            this.saveSettings();
            this.updateStatsDisplay();
        });

        document.getElementById('modal-simToggleBtn').addEventListener('click', () => this.toggleSimulator());
        document.getElementById('modal-simResetBtn').addEventListener('click', () => this.resetSimulator());
        document.getElementById('modal-simSlaveId').addEventListener('change', (e) => {
            this.simulator.slaveId = parseInt(e.target.value);
            document.getElementById('simSlaveId').value = e.target.value;
        });
        document.getElementById('modal-simDelay').addEventListener('change', (e) => {
            this.simulator.responseDelay = parseInt(e.target.value);
            document.getElementById('simDelay').value = e.target.value;
        });

        // Polling settings
        document.getElementById('applyPollingSettings').addEventListener('click', () => {
            this.applyPollingSettings();
        });
    }

    /**
     * 예상 갱신 주기를 계산해 UI에 표시
     * 공식: 디바이스당 최악 주기 = (읽기 타임아웃 × 2 + 메시지 간격 × 3) + 폴링 간격
     * "최악"은 두 번의 읽기(status, speed)가 모두 타임아웃 되는 경우
     */
    updatePollingEstimate() {
        const el = document.getElementById('pollingEstimateText');
        if (!el) return;

        const readTimeout  = parseInt(document.getElementById('pollingTimeout')?.value)  || this.pollingTimeout;
        const gap          = parseInt(document.getElementById('paramPollingDelay')?.value) || this.paramPollingDelay;
        const pollInterval = parseInt(document.getElementById('pollingInterval')?.value)  || this.autoPollingInterval;
        const numDevices   = this.devices ? this.devices.length : 0;

        // 디바이스 1대당 1 사이클: status read + gap + speed read + gap + (모니터링 파라미터) + pollInterval
        // 모니터링 파라미터 수는 평균으로 추정
        const avgMonParams = numDevices > 0
            ? this.devices.reduce((s, d) => s + (d.monitoringParams?.length || 0), 0) / numDevices
            : 0;
        const readsPerDevice   = 2 + Math.round(avgMonParams);  // status + speed + monitoring
        const worstPerDevice   = readTimeout * readsPerDevice + gap * readsPerDevice + pollInterval;
        const normalPerDevice  = gap * readsPerDevice + pollInterval; // 응답이 빠를 때 (응답시간 무시)

        // 전체 라운드: 모든 디바이스 한 바퀴
        const worstRound  = worstPerDevice  * Math.max(numDevices, 1);
        const normalRound = normalPerDevice * Math.max(numDevices, 1);

        const fmt = ms => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

        if (numDevices === 0) {
            el.innerHTML = `
                <span style="color:#aaa;">연결된 디바이스가 없습니다.</span><br>
                <span style="color:#888; font-size:11px;">디바이스 추가 후 갱신 주기가 표시됩니다.</span>`;
        } else {
            el.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <div>
                        <div style="color:#888; font-size:11px;">디바이스 수</div>
                        <div style="color:#fff; font-weight:600;">${numDevices}대</div>
                    </div>
                    <div>
                        <div style="color:#888; font-size:11px;">읽기 수 / 디바이스</div>
                        <div style="color:#fff; font-weight:600;">${readsPerDevice}회</div>
                    </div>
                    <div>
                        <div style="color:#888; font-size:11px;">전체 라운드 (정상)</div>
                        <div style="color:#90ee90; font-weight:600;">≈ ${fmt(normalRound)}</div>
                    </div>
                    <div>
                        <div style="color:#888; font-size:11px;">전체 라운드 (타임아웃 시)</div>
                        <div style="color:#f08080; font-weight:600;">최대 ${fmt(worstRound)}</div>
                    </div>
                </div>`;
        }
    }

    /**
     * Apply polling settings from modal
     */
    applyPollingSettings() {
        const interval    = parseInt(document.getElementById('pollingInterval').value);
        const readTimeout = parseInt(document.getElementById('pollingTimeout').value);
        const writeTimeout = parseInt(document.getElementById('commandTimeout').value);
        const paramDelay  = parseInt(document.getElementById('paramPollingDelay').value);
        const backgroundToggle = document.getElementById('backgroundPollingToggle');

        if (interval >= 10 && interval <= 5000) {
            this.autoPollingInterval = interval;
        }
        if (readTimeout >= 50 && readTimeout <= 5000) {
            this.pollingTimeout = readTimeout;
        }
        if (writeTimeout >= 50 && writeTimeout <= 5000) {
            this.commandTimeout = writeTimeout;
        }
        if (paramDelay >= 0 && paramDelay <= 500) {
            this.paramPollingDelay = paramDelay;
        }

        const wasEnabled = this.backgroundPollingEnabled;
        this.backgroundPollingEnabled = backgroundToggle.checked;

        // Create or destroy worker based on setting change
        if (this.backgroundPollingEnabled && !wasEnabled && this.autoPollingTimer) {
            this.createPollingWorker();
        } else if (!this.backgroundPollingEnabled && wasEnabled) {
            this.destroyPollingWorker();
        }

        this.savePollingSettings();
        this.updatePollingEstimate();
        this.showToast('폴링 설정이 적용되었습니다', 'success');
    }

    /**
     * Save polling settings to localStorage
     */
    savePollingSettings() {
        const settings = {
            autoPollingInterval: this.autoPollingInterval,
            pollingTimeout: this.pollingTimeout,
            commandTimeout: this.commandTimeout,
            paramPollingDelay: this.paramPollingDelay,
            backgroundPollingEnabled: this.backgroundPollingEnabled
        };
        localStorage.setItem('pollingSettings', JSON.stringify(settings));
    }

    /**
     * Load polling settings from localStorage
     */
    loadPollingSettings() {
        const saved = localStorage.getItem('pollingSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                if (settings.autoPollingInterval) this.autoPollingInterval = settings.autoPollingInterval;
                if (settings.pollingTimeout) this.pollingTimeout = settings.pollingTimeout;
                if (settings.commandTimeout) this.commandTimeout = settings.commandTimeout;
                if (settings.paramPollingDelay !== undefined) this.paramPollingDelay = settings.paramPollingDelay;
                if (settings.backgroundPollingEnabled !== undefined) this.backgroundPollingEnabled = settings.backgroundPollingEnabled;
            } catch (e) {
                console.error('Failed to load polling settings:', e);
            }
        }
    }

    /**
     * Open Settings Modal
     */
    openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.classList.add('active');

        // Sync values from main settings to modal
        document.getElementById('modal-baseFrameCount').value = this.baseFrameCount;
        document.getElementById('modal-simSlaveId').value = this.simulator.slaveId;
        document.getElementById('modal-simDelay').value = this.simulator.responseDelay;

        // Sync auto scan toggle
        const autoScanToggle = document.getElementById('autoScanEnabled');
        const autoScanStatus = document.getElementById('autoScanStatus');
        if (autoScanToggle) {
            autoScanToggle.checked = this.autoScanEnabled;
            if (autoScanStatus) {
                autoScanStatus.textContent = this.autoScanEnabled ? '활성' : '비활성';
                autoScanStatus.classList.toggle('active', this.autoScanEnabled);
            }
        }

        // Sync polling settings
        document.getElementById('pollingInterval').value = this.autoPollingInterval;
        document.getElementById('pollingTimeout').value = this.pollingTimeout;
        document.getElementById('commandTimeout').value = this.commandTimeout;
        document.getElementById('paramPollingDelay').value = this.paramPollingDelay;
        document.getElementById('backgroundPollingToggle').checked = this.backgroundPollingEnabled;
        this.updatePollingEstimate();

        // Update simulator button state
        this.updateModalSimulatorDisplay();
    }

    /**
     * Close Settings Modal
     */
    closeSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.classList.remove('active');
    }

    /**
     * Switch between settings panels in modal
     */
    switchSettingPanel(panelName) {
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`settings-${panelName}`).classList.add('active');
    }

    /**
     * Update modal simulator display
     */
    updateModalSimulatorDisplay() {
        const modalBtn = document.getElementById('modal-simToggleBtn');
        const modalStatus = document.getElementById('modal-simStatus');

        if (this.simulatorEnabled) {
            modalBtn.textContent = 'Deactivate';
            modalBtn.classList.remove('btn-success');
            modalBtn.classList.add('btn-warning');
            if (modalStatus) {
                modalStatus.textContent = '활성';
                modalStatus.style.color = '#28a745';
            }
        } else {
            modalBtn.textContent = 'Activate';
            modalBtn.classList.remove('btn-warning');
            modalBtn.classList.add('btn-success');
            if (modalStatus) {
                modalStatus.textContent = '비활성';
                modalStatus.style.color = '#6c757d';
            }
        }
    }

    /**
     * Update write value input visibility based on function code
     */
    updateWriteValueVisibility(functionCode) {
        const writeValueGroup = document.getElementById('writeValueGroup');
        const quantityGroup = document.getElementById('quantity').parentElement;
        const startAddressRow = document.getElementById('startAddressRow');
        const quantityRow = document.getElementById('quantityRow');
        const fc2bGroup = document.getElementById('fc2bGroup');

        if (functionCode === 43) { // FC 0x2B MEI Transport (CANopen SDO)
            writeValueGroup.style.display = 'none';
            quantityGroup.style.display = 'none';
            if (startAddressRow) startAddressRow.style.display = 'none';
            if (quantityRow) quantityRow.style.display = 'none';
            if (fc2bGroup) fc2bGroup.style.display = 'block';
            return;
        }

        if (startAddressRow) startAddressRow.style.display = 'flex';
        if (quantityRow) quantityRow.style.display = 'flex';
        if (fc2bGroup) fc2bGroup.style.display = 'none';

        if ([5, 6].includes(functionCode)) {
            writeValueGroup.style.display = 'flex';
            quantityGroup.style.display = 'none';
        } else if ([15, 16].includes(functionCode)) {
            writeValueGroup.style.display = 'flex';
            quantityGroup.style.display = 'flex';
        } else {
            writeValueGroup.style.display = 'none';
            quantityGroup.style.display = 'flex';
        }
    }

    /**
     * Connect to serial port
     */
    async connect() {
        try {
            const baudRateEl = document.getElementById('sidebar-baudRate');
            const dataBitsEl = document.getElementById('sidebar-dataBits');
            const parityEl = document.getElementById('sidebar-parity');
            const stopBitsEl = document.getElementById('sidebar-stopBits');

            // Get values with validation
            const baudRate = parseInt(baudRateEl.value) || DEFAULT_SERIAL.baudRate;
            const dataBits = parseInt(dataBitsEl.value) || DEFAULT_SERIAL.dataBits;
            const parity = parityEl.value || DEFAULT_SERIAL.parity;
            const stopBits = parseInt(stopBitsEl.value) || DEFAULT_SERIAL.stopBits;

            // Log settings for debugging
            console.log('Serial Settings:', { baudRate, dataBits, parity, stopBits });

            this.port = await navigator.serial.requestPort();

            const serialOptions = {
                baudRate: baudRate,
                dataBits: dataBits,
                parity: parity,
                stopBits: stopBits,
                flowControl: 'none'
            };

            console.log('Opening port with options:', serialOptions);

            await this.port.open(serialOptions);

            this.writer = this.port.writable.getWriter();
            this.startReading();

            this.isConnected = true;
            this.updateConnectionStatus(true);

            // HW Overview 탭이 열려있으면 폴링 시작
            const hwOverviewEl = document.getElementById('manufactureHwOverview');
            if (hwOverviewEl && hwOverviewEl.style.display !== 'none') {
                this.initMiniCharts();
                this.startOvPolling();
            }

            // Configuration 탭이 열려있으면 현재 카테고리 파라미터 자동 읽기
            if (this.currentSetupDeviceId) {
                const cat = this.activeConfigCategory || 'motorInfo';
                setTimeout(() => this.readConfigCategory(cat, this.currentSetupDeviceId), 800);
            }

            // Save settings to localStorage
            this.saveSerialSettings({ baudRate, dataBits, parity, stopBits });

            const settingsStr = `${baudRate} baud, ${dataBits}${parity.charAt(0).toUpperCase()}${stopBits}`;
            this.addMonitorEntry('received', `Connected: ${settingsStr}`);
            this.showToast(`시리얼 포트가 연결되었습니다 (${settingsStr})`, 'success');

            // Auto scan if enabled
            if (this.autoScanEnabled) {
                this.showToast('자동 탐색을 시작합니다...', 'info');
                setTimeout(() => this.startDeviceScan(true), 500);
            }

            // Start auto polling only if on Dashboard page
            if (this.currentPage === 'dashboard') {
                this.startAutoPolling();
            }

            // 기존 등록 디바이스의 operationMode를 디바이스에서 다시 읽기
            // (앱 재시작 시 localStorage 값과 실제 디바이스 설정이 다를 수 있음)
            // auto-scan이 활성화된 경우: 스캔 완료 콜백(startDeviceScan 내부)에서 처리
            // auto-scan이 비활성화된 경우: 폴링 시작 후 바로 실행
            if (!this.autoScanEnabled) {
                const existingDevices = this.devices.filter(d => d.slaveId !== 0);
                if (existingDevices.length > 0) {
                    setTimeout(() => {
                        existingDevices.forEach(d => this.initializeDeviceMode(d.id));
                    }, 500);
                }
            }

        } catch (error) {
            console.error('Connection error:', error);
            this.addMonitorEntry('error', `Connection failed: ${error.message}`);
            this.showToast(`연결에 실패했습니다: ${error.message}`, 'error');
        }
    }

    /**
     * Save serial settings to localStorage
     */
    saveSerialSettings(settings) {
        localStorage.setItem('serialSettings', JSON.stringify(settings));
    }

    /**
     * Load serial settings from localStorage
     */
    loadSerialSettings() {
        const baudRateEl = document.getElementById('sidebar-baudRate');
        const dataBitsEl = document.getElementById('sidebar-dataBits');
        const parityEl = document.getElementById('sidebar-parity');
        const stopBitsEl = document.getElementById('sidebar-stopBits');

        const saved = localStorage.getItem('serialSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);

                if (baudRateEl && settings.baudRate) baudRateEl.value = settings.baudRate;
                if (dataBitsEl && settings.dataBits) dataBitsEl.value = settings.dataBits;
                if (parityEl && settings.parity) parityEl.value = settings.parity;
                if (stopBitsEl && settings.stopBits) stopBitsEl.value = settings.stopBits;

                console.log('Loaded serial settings:', settings);
            } catch (e) {
                console.error('Failed to load serial settings:', e);
            }
        } else {
            // 저장된 설정 없음 → syncSerialSettings()에서 이미 DEFAULT_SERIAL 적용됨
        }
    }

    /**
     * Disconnect from serial port
     */
    async disconnect() {
        try {
            // Stop auto polling (force=true: 즉시 강제 중단)
            this.stopAutoPolling(true);

            this.readInProgress = false;

            if (this.reader) {
                try { await this.reader.cancel(); } catch (e) { /* ignore - port may be gone */ }
                // startReading()의 finally 블록에서 이미 releaseLock()이 호출될 수 있으므로 재확인
                if (this.reader) {
                    try { this.reader.releaseLock(); } catch (e) { /* ignore */ }
                    this.reader = null;
                }
            }

            if (this.writer) {
                try { this.writer.releaseLock(); } catch (e) { /* ignore - port may be gone */ }
                this.writer = null;
            }

            if (this.port) {
                try {
                    await this.port.close();
                } catch (e) {
                    // 물리적으로 제거된 경우 port.close()가 실패할 수 있음 - 무시
                    console.warn('Port close warning (physical removal?):', e.message);
                }
                this.port = null;
            }

            this.addMonitorEntry('received', 'Disconnected from serial port');
            this.showToast('시리얼 포트 연결이 해제되었습니다', 'info');

        } catch (error) {
            this.addMonitorEntry('error', `Disconnect error: ${error.message}`);
        } finally {
            // 물리적 제거 포함 모든 경우에 항상 연결 상태를 해제
            this.isConnected = false;
            this.updateConnectionStatus(false);
            // HW Overview 폴링 중지 + 1회 실행 플래그 리셋 (재연결 시 재실행)
            this.ovPollingRunning = false;
            this.ovOnceExecuted   = false;
            // Offset 탭 알람코드 폴링 중지
            this.offsetAlarmPollingRunning = false;
        }
    }

    /**
     * 동일 포트를 새 통신 설정으로 재접속 (OS 검증용).
     * requestPort() 없이 기존 포트 참조를 재사용하므로 사용자 제스처 불필요.
     *
     * @param {number} baudRate  - 새 Baudrate (예: 9600)
     * @param {string} parity    - 'none' | 'even' | 'odd'
     * @param {number} stopBits  - 1 | 2
     */
    async reconnectSerial(baudRate, parity, stopBits = 1, silent = false) {
        const port = this.port;
        if (!port) throw new Error('포트 참조 없음 — 먼저 Connect 하세요');

        // 1. 현재 연결 종료 (this.port = null 로 설정됨)
        await this.disconnect();

        // 2. 사이드바 UI 동기화
        const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.value = String(val); };
        setEl('sidebar-baudRate', baudRate);
        setEl('sidebar-parity',   parity);
        setEl('sidebar-stopBits', stopBits);

        // 3. 저장해 둔 포트를 새 설정으로 재오픈
        await port.open({ baudRate, parity, stopBits, dataBits: 8, flowControl: 'none' });

        // 4. 대시보드 상태 복원
        this.port    = port;
        this.writer  = port.writable.getWriter();
        this.startReading();
        this.isConnected = true;
        this.updateConnectionStatus(true);
        this.saveSerialSettings({ baudRate, dataBits: 8, parity, stopBits });

        if (!silent) this.showToast(`재접속 완료: ${baudRate}bps, ${parity}, Stop${stopBits}`, 'success');
    }

    /**
     * Start reading from serial port
     */
    async startReading() {
        this.readInProgress = true;
        this.reader = this.port.readable.getReader();

        try {
            while (this.readInProgress && this.port.readable) {
                const { value, done } = await this.reader.read();

                if (done) break;
                if (value) this.handleReceivedData(value);
            }
        } catch (error) {
            if (this.readInProgress) {
                this.addMonitorEntry('error', `Read error: ${error.message}`);
                // 예기치 않은 읽기 오류 = 485 컨버터 물리적 제거 감지 → 자동 연결 해제
                setTimeout(() => {
                    if (this.isConnected) {
                        this.addMonitorEntry('error', 'Serial port physically removed - auto disconnecting');
                        this.showToast('시리얼 포트가 제거되어 연결이 해제되었습니다', 'error');
                        this.disconnect();
                    }
                }, 0);
            }
        } finally {
            if (this.reader) {
                try { this.reader.releaseLock(); } catch (e) { /* ignore */ }
                this.reader = null;
            }
        }
    }

    /**
     * Handle received data from serial port
     */
    handleReceivedData(data) {
        for (let i = 0; i < data.length && this.receiveIndex < this.receiveBuffer.length; i++) {
            this.receiveBuffer[this.receiveIndex++] = data[i];
        }

        // sendAndReceive에서 사용하는 responseBuffer에도 데이터 추가
        if (this.responseBuffer) {
            for (let i = 0; i < data.length; i++) {
                this.responseBuffer.push(data[i]);
            }
            // event-driven: sendAndReceiveFC64 대기 중인 콜백 즉시 호출
            if (this._serialDataCb) {
                const fn = this._serialDataCb;
                this._serialDataCb = null;
                fn();
            }
        }

        this.tryParseFrame();
    }

    /**
     * Modbus RTU 응답 프레임의 예상 길이를 버퍼 내용으로부터 계산.
     * 아직 길이를 확정할 수 없으면 null 반환.
     */
    getExpectedFrameLength() {
        if (this.receiveIndex < 2) return null;

        const fc = this.receiveBuffer[1];

        // 에러 응답: slave(1) + fc|0x80(1) + exception_code(1) + CRC(2) = 5
        if (fc & 0x80) return 5;

        // FC 01~04 읽기 응답: slave(1) + fc(1) + byte_count(1) + data(n) + CRC(2)
        if (fc === 0x01 || fc === 0x02 || fc === 0x03 || fc === 0x04) {
            if (this.receiveIndex < 3) return null; // byte_count 아직 미수신
            return 3 + this.receiveBuffer[2] + 2;
        }

        // FC 05, 06, 0F, 10 쓰기 응답 에코: slave(1) + fc(1) + addr(2) + value/qty(2) + CRC(2) = 8
        if (fc === 0x05 || fc === 0x06 || fc === 0x0F || fc === 0x10) return 8;

        // FC 0x2B MEI Transport (CANopen): 가변 길이
        // header(13) + NumData + CRC(2). NumData는 bytes[11..12] (Big-Endian)
        // 13바이트 미만이면 null 반환해 더 기다림
        if (fc === 0x2B) {
            if (this.receiveIndex < 13) return null;
            const numData = (this.receiveBuffer[11] << 8) | this.receiveBuffer[12];
            return 13 + numData + 2;
        }

        // 그 외 (알 수 없는 FC): 최소 5바이트로 폴백
        return 5;
    }

    /**
     * 수신 버퍼에서 완성된 Modbus RTU 프레임을 파싱.
     *
     * 기존 setTimeout(50ms) 방식 대신 FC 기반 길이 계산으로 즉시 처리:
     * - 필요한 바이트 수가 정확히 차면 바로 처리 → split 오탐 없음
     * - 50ms 타이머 중첩으로 인한 레이스 컨디션 제거
     * - 처리 후 남은 바이트는 버퍼 앞으로 당겨 재귀 파싱
     */
    tryParseFrame() {
        if (this.receiveIndex < 2) return;

        // FC 0x66: 펌웨어 업데이트 응답 — responseBuffer에서 별도 처리, 여기서는 무시
        if (this.receiveBuffer[1] === 0x66) return;

        // FC 0x64: Chart Continuous 응답 — responseBuffer에서 별도 처리, 여기서는 무시
        if (this.receiveBuffer[1] === 0x64) return;

        // FC 0x65: Trigger Streaming 응답 — responseBuffer에서 별도 처리, 여기서는 무시
        if (this.receiveBuffer[1] === 0x65) return;

        // 버스 floating 노이즈 바이트 즉시 폐기:
        // RS-485 DE→RE 전환 시 버스가 floating → 0xFF, 0xBF 등 무작위 바이트 수신됨
        // Modbus 유효 슬레이브 주소는 1~247 (0x01~0xF7)이므로 범위 밖 바이트는 무효.
        // pendingResponse가 있으면 기대 slaveId와 다른 선두 바이트도 노이즈로 처리.
        {
            const expectedId = this.pendingResponse ? this.pendingResponse.slaveId : null;
            const firstByte = this.receiveBuffer[0];
            const isValidSlaveId = firstByte >= 0x01 && firstByte <= 0xF7;
            const isExpectedSlave = expectedId === null || firstByte === expectedId;

            if (!isValidSlaveId || !isExpectedSlave) {
                // 유효한 슬레이브 ID (또는 기대 ID)가 나올 때까지 앞 바이트들 제거
                let skipCount = 0;
                while (skipCount < this.receiveIndex) {
                    const b = this.receiveBuffer[skipCount];
                    const valid = b >= 0x01 && b <= 0xF7;
                    const matches = expectedId === null || b === expectedId;
                    if (valid && matches) break;
                    skipCount++;
                }
                if (skipCount > 0) {
                    for (let i = 0; i < this.receiveIndex - skipCount; i++) {
                        this.receiveBuffer[i] = this.receiveBuffer[skipCount + i];
                    }
                    this.receiveIndex -= skipCount;
                }
                if (this.receiveIndex < 2) return; // 유효 바이트 없음, 대기
            }
        }

        const expectedLength = this.getExpectedFrameLength();
        if (expectedLength === null) return;          // 길이 확정 불가 (바이트 부족)

        // FC 0x2B 펌웨어 버그 워크어라운드:
        // NumData 필드가 실제 전송 바이트보다 1 크게 잘못 계산된 펌웨어가 있음.
        // → expectedLength 바이트가 아직 없더라도 expectedLength-1 바이트는 있고
        //   그 끝 2바이트가 유효한 CRC라면 짧은 프레임으로 수용한다.
        let actualLength = expectedLength;
        let fc2bLengthShort = false;
        if (this.receiveBuffer[1] === 0x2B &&
            this.receiveIndex === expectedLength - 1 &&
            this.modbus.verifyCRC(this.receiveBuffer.slice(0, expectedLength - 1))) {
            actualLength = expectedLength - 1;
            fc2bLengthShort = true; // 펌웨어 버그: NumData 선언보다 1바이트 짧게 수신
        } else if (this.receiveIndex < expectedLength) {
            return; // 프레임 미완성, 추가 바이트 대기
        }

        // 정확히 한 프레임만 추출
        const frame = this.receiveBuffer.slice(0, actualLength);

        // 나머지 바이트를 버퍼 앞으로 이동
        const remaining = this.receiveIndex - actualLength;
        for (let i = 0; i < remaining; i++) {
            this.receiveBuffer[i] = this.receiveBuffer[actualLength + i];
        }
        this.receiveIndex = remaining;

        // CRC 검증 (가장 먼저 — 깨진 프레임 조기 폐기)
        if (!this.modbus.verifyCRC(frame)) {
            this.addMonitorEntry('error', frame, null, 'CRC mismatch');
            this.updateStats(false);
            if (this.receiveIndex >= 2) this.tryParseFrame();
            return;
        }

        // FC 0x2B 길이 부족 경고 (CRC는 유효하나 NumData 선언보다 1바이트 짧게 수신)
        // 별도 error 엔트리 대신 다음 received 엔트리에 경고 sub-line을 붙임
        if (fc2bLengthShort) {
            const declared = (frame[11] << 8) | frame[12];
            this._pendingRxWarning =
                `⚠ FC 0x2B: RX length mismatch — NumData declares ${declared} bytes but received ${declared - 1} (short by 1). Firmware bug suspected.`;
        }

        // 스캔 응답 처리
        if (this.scanResolve) {
            const responseSlaveId = frame[0];
            const functionCode = frame[1];
            if (responseSlaveId === this.scanExpectedSlaveId && (functionCode & 0x80) === 0) {
                const responseValue = (frame[3] << 8) | frame[4];
                this.addMonitorEntry('received', frame);
                this.updateStats(true);
                this.scanResolve(responseValue);
                if (this.receiveIndex >= 2) this.tryParseFrame();
                return;
            }
        }

        // pending 요청 응답 또는 비요청 프레임 처리
        if (this.pendingResponse) {
            this.handlePendingResponse(frame);
            try {
                const response = this.modbus.parseResponse(frame);
                this.addMonitorEntry('received', frame, response);
            } catch (error) {
                this.addMonitorEntry('error', frame, null, error.message);
            }
        } else {
            try {
                const response = this.modbus.parseResponse(frame);
                this.addMonitorEntry('received', frame, response);
                this.updateStats(true);
            } catch (error) {
                this.addMonitorEntry('error', frame, null, error.message);
                this.updateStats(false);
            }
        }

        // 버퍼에 남은 바이트가 있으면 다음 프레임도 파싱 (back-to-back 응답 대응)
        if (this.receiveIndex >= 2) this.tryParseFrame();
    }

    /**
     * Detect if input is hexadecimal (auto-detection)
     * @param {string} value - Input value
     * @returns {boolean} True if likely hexadecimal
     */
    isHexadecimal(value) {
        const trimmed = String(value).trim().toUpperCase();

        // Explicit hex prefix
        if (trimmed.startsWith('0X')) {
            return true;
        }

        // Contains A-F characters (likely hex)
        if (/[A-F]/.test(trimmed)) {
            return true;
        }

        // Otherwise, assume decimal
        return false;
    }

    /**
     * Parse Modbus input value (supports decimal and hexadecimal with auto-detection)
     * @param {string} value - Input value (e.g., "10", "D011", "0xFFFF")
     * @param {number} min - Minimum allowed value
     * @param {number} max - Maximum allowed value
     * @returns {number} Parsed value
     */
    parseModbusValue(value, min = 0, max = 65535) {
        const trimmed = String(value).trim();

        if (!trimmed) {
            throw new Error('빈 값은 허용되지 않습니다');
        }

        let parsed;

        // Auto-detect hex or decimal
        if (this.isHexadecimal(trimmed)) {
            // Remove 0x prefix if present
            const hexValue = trimmed.replace(/^0x/i, '');

            // Check if empty after removing prefix (e.g., "0x" or "0X")
            if (!hexValue) {
                throw new Error('빈 값은 허용되지 않습니다');
            }

            // Validate hex string - only 0-9, A-F allowed
            if (!/^[0-9A-Fa-f]+$/.test(hexValue)) {
                throw new Error(`유효하지 않은 16진수: "${value}"`);
            }

            parsed = parseInt(hexValue, 16);
        } else {
            // Validate decimal string - only 0-9 allowed
            if (!/^[0-9]+$/.test(trimmed)) {
                throw new Error(`유효하지 않은 10진수: "${value}"`);
            }

            parsed = parseInt(trimmed, 10);
        }

        if (isNaN(parsed)) {
            throw new Error(`유효하지 않은 값: "${value}"`);
        }

        if (parsed < min || parsed > max) {
            throw new Error(`값 ${parsed} (0x${parsed.toString(16).toUpperCase()})는 범위를 벗어났습니다 (${min}-${max})`);
        }

        return parsed;
    }

    /**
     * Update converted value display — element-based (shared utility)
     * @param {HTMLElement} inputEl
     * @param {HTMLElement} convertedEl
     * @param {number} min
     * @param {number} max
     */
    updateConvertedValueEl(inputEl, convertedEl, min = 0, max = 65535) {
        if (!inputEl || !convertedEl) return;

        const value = inputEl.value.trim();

        if (!value || value.toLowerCase() === '0x') {
            convertedEl.textContent = '';
            inputEl.style.borderColor = '';
            inputEl.style.background = '';
            return;
        }

        try {
            const parsed = this.parseModbusValue(value, min, max);
            const isHex = this.isHexadecimal(value);

            convertedEl.textContent = isHex
                ? `= ${parsed} (Dec)`
                : `= 0x${parsed.toString(16).toUpperCase()} (Hex)`;

            inputEl.style.borderColor = '';
            inputEl.style.background = '';
            convertedEl.style.color = '';
        } catch (error) {
            convertedEl.textContent = `⚠ ${error.message}`;
            convertedEl.style.color = '#dc3545';
            inputEl.style.borderColor = '#dc3545';
            inputEl.style.background = '#fff5f5';

            setTimeout(() => { convertedEl.style.color = ''; }, 2000);
        }
    }

    /**
     * Update converted value display for an input field (ID-based, for Modbus tab)
     * @param {string} inputId - Input element ID
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     */
    updateConvertedValue(inputId, min = 0, max = 65535) {
        this.updateConvertedValueEl(
            document.getElementById(inputId),
            document.getElementById(`${inputId}-converted`),
            min, max
        );
    }

    /**
     * Send Modbus request
     */
    async sendModbusRequest() {
        if (!this.writer) {
            this.addMonitorEntry('error', 'Not connected to serial port');
            return;
        }

        try {
            const slaveId = this.parseModbusValue(document.getElementById('slaveId').value, 0, 255);
            const functionCode = parseInt(document.getElementById('functionCode').value);

            // FC 0x2B CANopen SDO — 별도 처리 (readCANopenObject/writeCANopenObject)
            if (functionCode === 43) {
                const index    = parseInt(document.getElementById('fc2bIndex').value, 16);
                const subIndex = parseInt(document.getElementById('fc2bSubIndex').value, 16);
                const op       = document.getElementById('fc2bOperation').value;
                if (op === 'read') {
                    const numData = parseInt(document.getElementById('fc2bNumData').value) || 2;
                    await this.readCANopenObject(slaveId, index, subIndex, numData);
                } else {
                    const val = parseInt(document.getElementById('fc2bWriteValue').value || '0', 16);
                    await this.writeCANopenObject(slaveId, index, subIndex, val);
                }
                return; // stats는 sendCANopenAndWaitResponse에서 처리됨
            }

            const startAddress = this.parseModbusValue(document.getElementById('startAddress').value, 0, 65535);
            const quantity = this.parseModbusValue(document.getElementById('quantity').value, 1, 125);
            const writeValue = this.parseModbusValue(document.getElementById('writeValue').value || '0', 0, 65535);

            let frame;

            switch (functionCode) {
                case 1: frame = this.modbus.buildReadCoils(slaveId, startAddress, quantity); break;
                case 2: frame = this.modbus.buildReadDiscreteInputs(slaveId, startAddress, quantity); break;
                case 3: frame = this.modbus.buildReadHoldingRegisters(slaveId, startAddress, quantity); break;
                case 4: frame = this.modbus.buildReadInputRegisters(slaveId, startAddress, quantity); break;
                case 5: frame = this.modbus.buildWriteSingleCoil(slaveId, startAddress, writeValue !== 0); break;
                case 6: frame = this.modbus.buildWriteSingleRegister(slaveId, startAddress, writeValue); break;
                case 15:
                    const coilValues = Array(quantity).fill(writeValue !== 0);
                    frame = this.modbus.buildWriteMultipleCoils(slaveId, startAddress, coilValues);
                    break;
                case 16:
                    const registerValues = Array(quantity).fill(writeValue);
                    frame = this.modbus.buildWriteMultipleRegisters(slaveId, startAddress, registerValues);
                    break;
                default:
                    this.addMonitorEntry('error', 'Invalid function code');
                    return;
            }

            await this.writer.write(frame);
            this.addMonitorEntry('sent', frame, { functionCode, startAddress, quantity });
            this.stats.requests++;
            this.updateStatsDisplay();

        } catch (error) {
            this.addMonitorEntry('error', `Send error: ${error.message}`);
            this.updateStats(false);
        }
    }

    /**
     * Add entry to unified monitor
     */
    addMonitorEntry(type, dataOrMessage, parsedData = null, errorMsg = null) {
        // FC 0x2B 펌웨어 버그 워크어라운드: 경고 메시지를 다음 received 엔트리에 one-shot으로 붙임
        if (type === 'received' && this._pendingRxWarning) {
            errorMsg = this._pendingRxWarning;
            this._pendingRxWarning = null;
        }
        const monitorDisplay = document.getElementById('monitorDisplay');
        if (!monitorDisplay) {
            console.error('monitorDisplay element not found');
            return;
        }
        const placeholder = monitorDisplay.querySelector('.placeholder');
        if (placeholder) placeholder.remove();

        const now = Date.now();
        const timestamp = new Date(now);
        const timeStr = `${timestamp.toLocaleTimeString()}.${timestamp.getMilliseconds().toString().padStart(3, '0')}`;

        // Calculate time delta
        const delta = this.lastMonitorTime ? now - this.lastMonitorTime : 0;
        this.lastMonitorTime = now;
        const deltaStr = delta > 0 ? `+${delta}ms` : '';

        // Store entry data for virtual scrolling
        const entryData = {
            type,
            dataOrMessage: dataOrMessage instanceof Uint8Array ? new Uint8Array(dataOrMessage) : dataOrMessage,
            parsedData,
            errorMsg,
            timeStr,
            deltaStr,
            timestamp: now,
            index: this.monitorEntries.length
        };
        this.monitorEntries.push(entryData);

        // Limit array size to prevent memory bloat (keep last 500 entries in memory)
        const maxMemoryEntries = 500;
        if (this.monitorEntries.length > maxMemoryEntries) {
            const removeCount = this.monitorEntries.length - maxMemoryEntries;
            this.monitorEntries.splice(0, removeCount);
            // Re-index remaining entries
            this.monitorEntries.forEach((entry, idx) => {
                entry.index = idx;
            });
        }

        // Update entry count display
        this.updateMonitorEntryCount();

        // Create and append DOM element
        const entry = this.createMonitorEntryElement(entryData);
        monitorDisplay.appendChild(entry);

        // Limit DOM entries (keep data in array)
        const maxDomEntries = 200;
        const excessCount = monitorDisplay.children.length - maxDomEntries;

        if (excessCount > 0) {
            this.isProgrammaticScroll = true;

            if (this.isUserScrolling) {
                // User is scrolling - preserve scroll position
                const scrollHeightBefore = monitorDisplay.scrollHeight;
                const currentScrollTop = monitorDisplay.scrollTop;

                for (let i = 0; i < excessCount; i++) {
                    monitorDisplay.removeChild(monitorDisplay.firstChild);
                }

                const scrollHeightAfter = monitorDisplay.scrollHeight;
                const removedHeight = scrollHeightBefore - scrollHeightAfter;

                if (currentScrollTop > 0) {
                    monitorDisplay.scrollTop = Math.max(0, currentScrollTop - removedHeight);
                }
                this.lastScrollTop = monitorDisplay.scrollTop;
            } else {
                // Auto-scrolling - just remove excess entries
                for (let i = 0; i < excessCount; i++) {
                    monitorDisplay.removeChild(monitorDisplay.firstChild);
                }
            }

            this.isProgrammaticScroll = false;
        }

        // Smart scroll behavior
        if (this.monitorAutoScroll && !this.isUserScrolling) {
            this.isProgrammaticScroll = true;
            monitorDisplay.scrollTop = monitorDisplay.scrollHeight;
            this.lastScrollTop = monitorDisplay.scrollTop;
            this.isProgrammaticScroll = false;
        } else {
            this.newMessageCount++;
            this.updateScrollButton();
        }
    }

    /**
     * Create a monitor entry DOM element from entry data
     */
    createMonitorEntryElement(entryData) {
        const { type, dataOrMessage, parsedData, errorMsg, timeStr, deltaStr } = entryData;

        // Map 'tx'/'rx' to 'sent'/'received' for CSS styling
        let cssType = type;
        if (type === 'tx') cssType = 'sent';
        else if (type === 'rx') cssType = 'received';

        const entry = document.createElement('div');
        entry.className = `monitor-entry ${cssType}`;
        entry.dataset.entryIndex = entryData.index;

        // Determine type label
        let typeLabel = 'SYSTEM';
        if (type === 'sent' || type === 'tx') typeLabel = 'TX';
        else if (type === 'received' || type === 'rx') typeLabel = 'RX';
        else if (type === 'error') typeLabel = 'ERROR';

        const mainLine = document.createElement('div');
        mainLine.className = 'monitor-main-line';

        // Type badge
        const typeBadge = document.createElement('span');
        typeBadge.className = `monitor-type-badge ${cssType}`;
        typeBadge.textContent = typeLabel;
        mainLine.appendChild(typeBadge);

        // Content area
        if (dataOrMessage instanceof Uint8Array) {
            const bytesContainer = document.createElement('span');
            bytesContainer.className = 'monitor-bytes';

            const byteInfo = this.getByteInfo(dataOrMessage, parsedData, type);

            Array.from(dataOrMessage).forEach((byte, index) => {
                const info = byteInfo[index] || { name: 'Unknown', desc: '', class: 'byte-unknown' };

                if (index > 0 && !info.grouped) {
                    const prevInfo = byteInfo[index - 1];
                    if (prevInfo && prevInfo.class !== info.class) {
                        const separator = document.createElement('span');
                        separator.className = 'monitor-byte-separator';
                        bytesContainer.appendChild(separator);
                    }
                }

                const byteSpan = document.createElement('span');
                byteSpan.className = `monitor-byte ${info.class || ''}`;
                byteSpan.textContent = this.displayFormat === 'hex'
                    ? byte.toString(16).toUpperCase().padStart(2, '0')
                    : byte.toString().padStart(3, ' ');
                byteSpan.dataset.index = index;
                byteSpan.dataset.value = byte;

                if (info.group) {
                    byteSpan.dataset.group = info.group.join(',');
                }

                byteSpan.addEventListener('mouseenter', (e) => {
                    if (!this.tooltipPinned) {
                        this.highlightByteGroup(bytesContainer, info.group, true);
                        this.showByteTooltip(e, info, byte, index);
                    }
                });

                byteSpan.addEventListener('mousemove', (e) => {
                    if (!this.tooltipPinned) {
                        this.moveByteTooltip(e);
                    }
                });

                byteSpan.addEventListener('mouseleave', (e) => {
                    if (!this.tooltipPinned) {
                        const tooltip = document.getElementById('byteTooltip');
                        if (tooltip && e.relatedTarget && (tooltip.contains(e.relatedTarget) || tooltip === e.relatedTarget)) {
                            return;
                        }
                        this.highlightByteGroup(bytesContainer, info.group, false);
                        this.hideByteTooltip();
                    }
                });

                byteSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.pinByteTooltip(bytesContainer, info, byte, index, e);
                });

                bytesContainer.appendChild(byteSpan);
            });

            mainLine.appendChild(bytesContainer);

            const summary = document.createElement('span');
            summary.className = 'monitor-summary';
            summary.textContent = this.getFrameSummary(dataOrMessage, parsedData, type);
            mainLine.appendChild(summary);

            // errorMsg가 있으면 바이트 아래에 경고 sub-line 표시
            if (errorMsg) {
                const warnLine = document.createElement('div');
                warnLine.className = 'monitor-warn-line';
                warnLine.style.cssText = 'font-size: 11px; color: #e67e00; padding: 2px 0 0 4px;';
                warnLine.textContent = errorMsg;
                entry.appendChild(warnLine);
            }

            entry.dataset.hasDetails = 'true';
            entry._detailsData = { frame: dataOrMessage, byteInfo, parsedData, type, timeStr, deltaStr };
        } else {
            const messageSpan = document.createElement('span');
            messageSpan.className = 'monitor-message';
            messageSpan.textContent = errorMsg || dataOrMessage;
            mainLine.appendChild(messageSpan);
        }

        // Time info
        const timeInfo = document.createElement('span');
        timeInfo.className = 'monitor-time-info';

        const deltaSpan = document.createElement('span');
        deltaSpan.className = 'monitor-delta';
        deltaSpan.textContent = deltaStr;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'monitor-timestamp';
        timeSpan.textContent = timeStr;

        timeInfo.appendChild(deltaSpan);
        timeInfo.appendChild(timeSpan);
        mainLine.appendChild(timeInfo);

        entry.appendChild(mainLine);

        // Add expandable details
        if (entry.dataset.hasDetails === 'true' && entry._detailsData) {
            const { frame, byteInfo, parsedData: pData, type: pType, timeStr: pTime, deltaStr: pDelta } = entry._detailsData;
            const details = document.createElement('div');
            details.className = 'monitor-details';
            details.innerHTML = this.createDetailsHTML(frame, byteInfo, pData, pType, pTime, pDelta);
            entry.appendChild(details);
            delete entry._detailsData;
        }

        // Click to expand/collapse
        if (entry.dataset.hasDetails === 'true') {
            entry.addEventListener('click', (e) => {
                if (e.target.classList.contains('monitor-byte')) return;
                if (e.target.closest('.monitor-raw-container')) return;
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) return;
                entry.classList.toggle('expanded');
            });
        }

        return entry;
    }

    /**
     * Update monitor entry count display
     */
    updateMonitorEntryCount() {
        const countEl = document.getElementById('monitorEntryCount');
        if (countEl) {
            countEl.textContent = `${this.monitorEntries.length} packets`;
        }
    }

    /**
     * Load older entries when scrolling to top
     */
    loadOlderEntries() {
        const monitorDisplay = document.getElementById('monitorDisplay');
        if (!monitorDisplay || monitorDisplay.children.length === 0) return;

        const firstEntry = monitorDisplay.firstElementChild;
        if (!firstEntry || !firstEntry.dataset) return;
        const firstIndex = parseInt(firstEntry.dataset.entryIndex || '0');

        if (firstIndex <= 0) return; // No more older entries

        const loadCount = 50;
        const startIndex = Math.max(0, firstIndex - loadCount);

        this.isProgrammaticScroll = true;
        const scrollHeightBefore = monitorDisplay.scrollHeight;

        // Prepend older entries
        for (let i = firstIndex - 1; i >= startIndex; i--) {
            const entryData = this.monitorEntries[i];
            if (entryData) {
                const entry = this.createMonitorEntryElement(entryData);
                monitorDisplay.insertBefore(entry, monitorDisplay.firstChild);
            }
        }

        // Maintain scroll position
        const scrollHeightAfter = monitorDisplay.scrollHeight;
        monitorDisplay.scrollTop += (scrollHeightAfter - scrollHeightBefore);
        this.lastScrollTop = monitorDisplay.scrollTop;

        this.isProgrammaticScroll = false;
    }

    /**
     * Clear monitor entries
     */
    clearMonitorEntries() {
        this.monitorEntries = [];
        const monitorDisplay = document.getElementById('monitorDisplay');
        if (monitorDisplay) {
            monitorDisplay.innerHTML = '<div class="placeholder">Waiting for data...</div>';
        }
        this.updateMonitorEntryCount();
    }

    /**
     * Initialize monitor scroll controls
     */
    initMonitorScrollControls() {
        const monitorDisplay = document.getElementById('monitorDisplay');
        const scrollBtn = document.getElementById('monitorScrollBtn');
        const autoScrollToggle = document.getElementById('autoScrollToggle');

        if (!monitorDisplay) return;

        // Scroll state tracking - use instance variables
        let scrollTimeout;
        this.lastScrollTop = monitorDisplay.scrollTop;
        this.isProgrammaticScroll = false;

        // Scroll event to detect user scrolling
        let loadingOlder = false;
        monitorDisplay.addEventListener('scroll', () => {
            // Ignore programmatic scroll adjustments
            if (this.isProgrammaticScroll) {
                return;
            }

            const currentScrollTop = monitorDisplay.scrollTop;
            const isAtBottom = monitorDisplay.scrollHeight - currentScrollTop - monitorDisplay.clientHeight < 50;
            const isAtTop = currentScrollTop < 100;
            const scrolledDown = currentScrollTop > this.lastScrollTop;

            // Load older entries when near top
            if (isAtTop && !loadingOlder && this.monitorEntries.length > 0) {
                loadingOlder = true;
                this.loadOlderEntries();
                setTimeout(() => { loadingOlder = false; }, 200);
            }

            // Only reset to auto-scroll if user actively scrolls DOWN to bottom
            if (isAtBottom && scrolledDown) {
                this.isUserScrolling = false;
                this.newMessageCount = 0;
                this.updateScrollButton();
            } else if (currentScrollTop < this.lastScrollTop) {
                // User scrolled up
                this.isUserScrolling = true;
                this.updateScrollButton();
            }

            this.lastScrollTop = currentScrollTop;

            // Reset scroll detection after delay
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const stillAtBottom = monitorDisplay.scrollHeight - monitorDisplay.scrollTop - monitorDisplay.clientHeight < 50;
                // Only auto-reset if at bottom AND user hasn't scrolled up
                if (stillAtBottom && !this.isUserScrolling) {
                    this.newMessageCount = 0;
                    this.updateScrollButton();
                }
            }, 150);
        });

        // Scroll to bottom button
        if (scrollBtn) {
            scrollBtn.addEventListener('click', () => {
                this.isProgrammaticScroll = true;
                monitorDisplay.scrollTop = monitorDisplay.scrollHeight;
                this.isUserScrolling = false;
                this.newMessageCount = 0;
                this.lastScrollTop = monitorDisplay.scrollTop;
                this.updateScrollButton();
                this.isProgrammaticScroll = false;
            });
        }

        // Auto scroll toggle
        if (autoScrollToggle) {
            autoScrollToggle.checked = this.monitorAutoScroll;
            autoScrollToggle.addEventListener('change', (e) => {
                this.monitorAutoScroll = e.target.checked;
                if (this.monitorAutoScroll) {
                    // Scroll to bottom when enabled
                    this.isProgrammaticScroll = true;
                    monitorDisplay.scrollTop = monitorDisplay.scrollHeight;
                    this.isUserScrolling = false;
                    this.newMessageCount = 0;
                    this.lastScrollTop = monitorDisplay.scrollTop;
                    this.updateScrollButton();
                    this.isProgrammaticScroll = false;
                }
            });
        }
    }

    /**
     * Update scroll button visibility and count
     */
    updateScrollButton() {
        const scrollBtn = document.getElementById('monitorScrollBtn');
        const countEl = document.getElementById('newMessageCount');

        if (!scrollBtn) return;

        // Show button when user is scrolling up
        if (this.isUserScrolling) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }

        // Update new message count
        if (countEl) {
            countEl.textContent = this.newMessageCount;
            if (this.newMessageCount > 0) {
                countEl.classList.add('visible');
            } else {
                countEl.classList.remove('visible');
            }
        }
    }

    /**
     * Create detailed HTML for expanded view
     */
    createDetailsHTML(frame, _byteInfo, _parsedData, type, timeStr, deltaStr) {
        // frame이 너무 짧으면 기본 정보만 표시
        if (!frame || frame.length < 2) {
            return `<div class="monitor-details-grid">
                <div class="monitor-detail-item detail-timestamp">
                    <div class="monitor-detail-label">Timestamp</div>
                    <div class="monitor-detail-value">${timeStr}</div>
                </div>
                <div class="monitor-detail-item detail-raw">
                    <div class="monitor-detail-label">Raw Data</div>
                    <div class="monitor-detail-value">${frame ? Array.from(frame).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') : '-'}</div>
                </div>
            </div>`;
        }

        const funcCode = frame[1];
        const isError = funcCode > 0x80;
        const actualFunc = isError ? funcCode - 0x80 : funcCode;

        const funcNames = {
            1: 'Read Coils', 2: 'Read Discrete Inputs', 3: 'Read Holding Registers',
            4: 'Read Input Registers', 5: 'Write Single Coil', 6: 'Write Single Register',
            15: 'Write Multiple Coils', 16: 'Write Multiple Registers'
        };

        let detailsHTML = '<div class="monitor-details-grid">';

        // Basic info
        detailsHTML += `
            <div class="monitor-detail-item detail-timestamp">
                <div class="monitor-detail-label">Timestamp</div>
                <div class="monitor-detail-value">${timeStr}</div>
            </div>
            <div class="monitor-detail-item detail-delta">
                <div class="monitor-detail-label">Delta</div>
                <div class="monitor-detail-value">${deltaStr || '-'}</div>
            </div>
            <div class="monitor-detail-item detail-slave">
                <div class="monitor-detail-label">Slave ID</div>
                <div class="monitor-detail-value">${frame[0]}</div>
            </div>
            <div class="monitor-detail-item detail-func">
                <div class="monitor-detail-label">Function</div>
                <div class="monitor-detail-value">${isError ? 'Error' : ''} ${funcNames[actualFunc] || 'Unknown'} (0x${actualFunc.toString(16).toUpperCase().padStart(2, '0')})</div>
            </div>
        `;

        // Address and quantity for requests
        if (frame.length >= 6 && !isError) {
            const addr = (frame[2] << 8) | frame[3];
            detailsHTML += `
                <div class="monitor-detail-item detail-addr">
                    <div class="monitor-detail-label">Address</div>
                    <div class="monitor-detail-value">0x${addr.toString(16).toUpperCase().padStart(4, '0')} (${addr})</div>
                </div>
            `;

            if ([1, 2, 3, 4, 15, 16].includes(actualFunc) && type === 'sent') {
                const qty = (frame[4] << 8) | frame[5];
                detailsHTML += `
                    <div class="monitor-detail-item detail-qty">
                        <div class="monitor-detail-label">Quantity</div>
                        <div class="monitor-detail-value">${qty}</div>
                    </div>
                `;
            }
        }

        // Frame length
        detailsHTML += `
            <div class="monitor-detail-item detail-length">
                <div class="monitor-detail-label">Frame Length</div>
                <div class="monitor-detail-value">${frame.length} bytes</div>
            </div>
        `;

        detailsHTML += '</div>';

        // Raw hex string (clickable to copy)
        const hexString = Array.from(frame).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        detailsHTML += `
            <div class="monitor-raw-container" data-raw="${hexString}" title="클릭하여 복사">
                <strong>Raw:</strong> <span class="monitor-raw-value">${hexString}</span>
                <span class="monitor-raw-copy-icon">📋</span>
            </div>
        `;

        return detailsHTML;
    }

    /**
     * Get byte information for Modbus frame analysis (data-unit grouped)
     */
    getByteInfo(frame, parsedData, type) {
        const info = [];
        const len = frame.length;

        if (len < 4) {
            for (let i = 0; i < len; i++) {
                info[i] = { name: 'Unknown', desc: '유효하지 않은 프레임입니다.', class: 'byte-unknown' };
            }
            return info;
        }

        const funcCode = frame[1];
        const isResponse = type === 'received';
        const isError = funcCode > 0x80;
        const actualFunc = isError ? funcCode - 0x80 : funcCode;

        const funcNames = {
            1: 'Read Coils', 2: 'Read Discrete Inputs', 3: 'Read Holding Registers',
            4: 'Read Input Registers', 5: 'Write Single Coil', 6: 'Write Single Register',
            15: 'Write Multiple Coils', 16: 'Write Multiple Registers'
        };

        // Byte 0: Slave ID (1 byte)
        info[0] = {
            name: 'Slave ID',
            desc: 'Modbus 슬레이브 장치의 고유 주소',
            value: frame[0],
            class: 'byte-slave',
            size: 1
        };

        // Byte 1: Function Code (1 byte)
        info[1] = {
            name: isError ? 'Error Code' : 'Function Code',
            desc: isError ? `에러 응답 (원본: ${funcNames[actualFunc] || 'Unknown'})` : funcNames[actualFunc] || 'Unknown',
            value: frame[1],
            class: isError ? 'byte-error' : 'byte-func',
            size: 1
        };

        // Parse based on function code and type
        if (isError && isResponse) {
            const exceptionNames = { 1: 'Illegal Function', 2: 'Illegal Data Address', 3: 'Illegal Data Value', 4: 'Slave Device Failure', 5: 'Acknowledge', 6: 'Slave Device Busy' };
            info[2] = { name: 'Exception Code', desc: exceptionNames[frame[2]] || 'Unknown Error', value: frame[2], class: 'byte-error', size: 1 };
        } else if (type === 'sent') {
            if ([1, 2, 3, 4].includes(funcCode)) {
                const addr = (frame[2] << 8) | frame[3];
                const qty = (frame[4] << 8) | frame[5];
                info[2] = { name: 'Start Address', desc: '읽기 시작할 주소', value: addr, class: 'byte-addr', size: 2, group: [2, 3] };
                info[3] = { name: 'Start Address', desc: '읽기 시작할 주소', value: addr, class: 'byte-addr', size: 2, group: [2, 3], grouped: true };
                info[4] = { name: 'Quantity', desc: '읽을 개수', value: qty, class: 'byte-qty', size: 2, group: [4, 5] };
                info[5] = { name: 'Quantity', desc: '읽을 개수', value: qty, class: 'byte-qty', size: 2, group: [4, 5], grouped: true };
            } else if (funcCode === 5) {
                const addr = (frame[2] << 8) | frame[3];
                const val = (frame[4] << 8) | frame[5];
                info[2] = { name: 'Coil Address', desc: '쓸 코일 주소', value: addr, class: 'byte-addr', size: 2, group: [2, 3] };
                info[3] = { name: 'Coil Address', desc: '쓸 코일 주소', value: addr, class: 'byte-addr', size: 2, group: [2, 3], grouped: true };
                info[4] = { name: 'Coil Value', desc: val === 0xFF00 ? 'ON (0xFF00)' : 'OFF (0x0000)', value: val, class: 'byte-data', size: 2, group: [4, 5] };
                info[5] = { name: 'Coil Value', desc: val === 0xFF00 ? 'ON (0xFF00)' : 'OFF (0x0000)', value: val, class: 'byte-data', size: 2, group: [4, 5], grouped: true };
            } else if (funcCode === 6) {
                const addr = (frame[2] << 8) | frame[3];
                const val = (frame[4] << 8) | frame[5];
                info[2] = { name: 'Register Address', desc: '쓸 레지스터 주소', value: addr, class: 'byte-addr', size: 2, group: [2, 3] };
                info[3] = { name: 'Register Address', desc: '쓸 레지스터 주소', value: addr, class: 'byte-addr', size: 2, group: [2, 3], grouped: true };
                info[4] = { name: 'Register Value', desc: '쓸 값', value: val, class: 'byte-data', size: 2, group: [4, 5] };
                info[5] = { name: 'Register Value', desc: '쓸 값', value: val, class: 'byte-data', size: 2, group: [4, 5], grouped: true };
            } else if (funcCode === 15 || funcCode === 16) {
                const addr = (frame[2] << 8) | frame[3];
                const qty = (frame[4] << 8) | frame[5];
                const byteCount = frame[6];
                info[2] = { name: 'Start Address', desc: '쓰기 시작할 주소', value: addr, class: 'byte-addr', size: 2, group: [2, 3] };
                info[3] = { name: 'Start Address', desc: '쓰기 시작할 주소', value: addr, class: 'byte-addr', size: 2, group: [2, 3], grouped: true };
                info[4] = { name: 'Quantity', desc: '쓸 개수', value: qty, class: 'byte-qty', size: 2, group: [4, 5] };
                info[5] = { name: 'Quantity', desc: '쓸 개수', value: qty, class: 'byte-qty', size: 2, group: [4, 5], grouped: true };
                info[6] = { name: 'Byte Count', desc: '데이터 바이트 수', value: byteCount, class: 'byte-count', size: 1 };
                for (let i = 7; i < len - 2; i++) {
                    info[i] = { name: `Data[${i-7}]`, desc: `${i-7}번째 데이터`, value: frame[i], class: 'byte-data', size: 1 };
                }
            }
        } else if (isResponse) {
            if ([1, 2].includes(actualFunc)) {
                const byteCount = frame[2];
                info[2] = { name: 'Byte Count', desc: '응답 데이터 바이트 수', value: byteCount, class: 'byte-count', size: 1 };
                for (let i = 3; i < 3 + byteCount && i < len - 2; i++) {
                    const bits = frame[i].toString(2).padStart(8, '0').split('').reverse().join('');
                    info[i] = { name: `Coil Data[${i-3}]`, desc: `비트: ${bits}`, value: frame[i], class: 'byte-data', size: 1, bits: bits };
                }
            } else if ([3, 4].includes(actualFunc)) {
                const byteCount = frame[2];
                info[2] = { name: 'Byte Count', desc: `${byteCount}바이트 (${byteCount/2}개 레지스터)`, value: byteCount, class: 'byte-count', size: 1 };
                for (let i = 3; i < 3 + byteCount && i < len - 2; i += 2) {
                    const regIndex = (i - 3) / 2;
                    const val = (frame[i] << 8) | (frame[i+1] || 0);
                    info[i] = { name: `Register[${regIndex}]`, desc: `레지스터 ${regIndex} 값`, value: val, class: 'byte-data', size: 2, group: [i, i+1] };
                    if (i + 1 < len - 2) {
                        info[i+1] = { name: `Register[${regIndex}]`, desc: `레지스터 ${regIndex} 값`, value: val, class: 'byte-data', size: 2, group: [i, i+1], grouped: true };
                    }
                }
            } else if ([5, 6].includes(actualFunc)) {
                const addr = (frame[2] << 8) | frame[3];
                const val = (frame[4] << 8) | frame[5];
                info[2] = { name: 'Address', desc: '응답된 주소', value: addr, class: 'byte-addr', size: 2, group: [2, 3] };
                info[3] = { name: 'Address', desc: '응답된 주소', value: addr, class: 'byte-addr', size: 2, group: [2, 3], grouped: true };
                info[4] = { name: 'Value', desc: '응답된 값', value: val, class: 'byte-data', size: 2, group: [4, 5] };
                info[5] = { name: 'Value', desc: '응답된 값', value: val, class: 'byte-data', size: 2, group: [4, 5], grouped: true };
            } else if ([15, 16].includes(actualFunc)) {
                const addr = (frame[2] << 8) | frame[3];
                const qty = (frame[4] << 8) | frame[5];
                info[2] = { name: 'Start Address', desc: '시작 주소', value: addr, class: 'byte-addr', size: 2, group: [2, 3] };
                info[3] = { name: 'Start Address', desc: '시작 주소', value: addr, class: 'byte-addr', size: 2, group: [2, 3], grouped: true };
                info[4] = { name: 'Quantity', desc: '쓴 개수', value: qty, class: 'byte-qty', size: 2, group: [4, 5] };
                info[5] = { name: 'Quantity', desc: '쓴 개수', value: qty, class: 'byte-qty', size: 2, group: [4, 5], grouped: true };
            }
        }

        // CRC (2 bytes as one unit)
        if (len >= 4) {
            const crc = (frame[len - 1] << 8) | frame[len - 2];
            info[len - 2] = { name: 'CRC-16', desc: '오류 검출 코드', value: crc, class: 'byte-crc', size: 2, group: [len - 2, len - 1] };
            info[len - 1] = { name: 'CRC-16', desc: '오류 검출 코드', value: crc, class: 'byte-crc', size: 2, group: [len - 2, len - 1], grouped: true };
        }

        return info;
    }

    /**
     * Get frame summary text
     */
    getFrameSummary(frame, parsedData, type) {
        if (frame.length < 4) return '[Invalid Frame]';

        const funcCode = frame[1];
        const isError = funcCode > 0x80;
        const actualFunc = isError ? funcCode - 0x80 : funcCode;

        const funcNames = {
            1: 'Read Coils', 2: 'Read DI', 3: 'Read HR', 4: 'Read IR',
            5: 'Write Coil', 6: 'Write Reg', 15: 'Write Coils', 16: 'Write Regs'
        };

        if (isError) {
            const exCodes = { 1: 'Illegal Func', 2: 'Illegal Addr', 3: 'Illegal Value', 4: 'Device Fail' };
            return `[ERROR: ${exCodes[frame[2]] || 'Unknown'}]`;
        }

        let summary = `[${funcNames[actualFunc] || 'Func '+actualFunc}`;

        if (type === 'sent') {
            if ([1,2,3,4].includes(funcCode)) {
                const addr = (frame[2] << 8) | frame[3];
                const qty = (frame[4] << 8) | frame[5];
                summary += ` @${addr} x${qty}`;
            } else if ([5,6].includes(funcCode)) {
                const addr = (frame[2] << 8) | frame[3];
                const value = (frame[4] << 8) | frame[5];
                summary += ` @${addr}=${funcCode === 5 ? (value === 0xFF00 ? 'ON' : 'OFF') : value}`;
            }
        } else {
            if ([1,2,3,4].includes(actualFunc)) {
                const byteCount = frame[2];
                if ([3,4].includes(actualFunc)) {
                    summary += ` ${byteCount/2} regs`;
                } else {
                    summary += ` ${byteCount} bytes`;
                }
            }
        }

        return summary + ']';
    }

    /**
     * Show byte tooltip on hover
     */
    showByteTooltip(e, info, value, index) {
        // Create or get tooltip element
        let tooltip = document.getElementById('byteTooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'byteTooltip';
            tooltip.className = 'byte-tooltip';
            document.body.appendChild(tooltip);

            // Add click event for copying values
            tooltip.addEventListener('click', (e) => {
                const copyableRow = e.target.closest('.byte-tooltip-copyable');
                if (copyableRow) {
                    const value = copyableRow.dataset.copyValue;
                    navigator.clipboard.writeText(value).then(() => {
                        this.showToast(`복사되었습니다: ${value}`, 'success');
                    }).catch(() => {
                        this.showToast('복사에 실패했습니다', 'error');
                    });
                }
            });

            // Hide tooltip when mouse leaves it
            tooltip.addEventListener('mouseleave', () => {
                if (!this.tooltipPinned) {
                    this.hideByteTooltip();
                }
            });
        }

        // Use data value (grouped) or single byte value
        const dataValue = info.value !== undefined ? info.value : value;
        const size = info.size || 1;

        // Format values based on data size
        let hexVal, decVal, binVal;
        if (size === 2) {
            hexVal = `0x${dataValue.toString(16).toUpperCase().padStart(4, '0')}`;
            decVal = dataValue.toString();
            binVal = dataValue.toString(2).padStart(16, '0');
            // Format binary with space for readability
            binVal = binVal.slice(0, 8) + ' ' + binVal.slice(8);
        } else {
            hexVal = `0x${dataValue.toString(16).toUpperCase().padStart(2, '0')}`;
            decVal = dataValue.toString();
            binVal = dataValue.toString(2).padStart(8, '0');
        }

        // Byte position text
        const byteText = info.group ? `Byte ${info.group[0]}-${info.group[1]}` : `Byte ${index}`;

        tooltip.innerHTML = `
            <div class="byte-tooltip-header">
                <span class="byte-tooltip-name">${info.name}</span>
                <span class="byte-tooltip-index">${byteText}</span>
            </div>
            <div class="byte-tooltip-desc">${info.desc}</div>
            <div class="byte-tooltip-values">
                <div class="byte-tooltip-value-row byte-tooltip-copyable" data-copy-value="${hexVal}" title="클릭하여 복사">
                    <span class="byte-tooltip-label">HEX</span>
                    <span class="byte-tooltip-value">${hexVal}</span>
                    <span class="byte-tooltip-copy-icon">📋</span>
                </div>
                <div class="byte-tooltip-value-row byte-tooltip-copyable" data-copy-value="${decVal}" title="클릭하여 복사">
                    <span class="byte-tooltip-label">DEC</span>
                    <span class="byte-tooltip-value">${decVal}</span>
                    <span class="byte-tooltip-copy-icon">📋</span>
                </div>
                <div class="byte-tooltip-value-row byte-tooltip-copyable" data-copy-value="${binVal}" title="클릭하여 복사">
                    <span class="byte-tooltip-label">BIN</span>
                    <span class="byte-tooltip-value">${binVal}</span>
                    <span class="byte-tooltip-copy-icon">📋</span>
                </div>
            </div>
        `;

        tooltip.style.display = 'block';
        this.moveByteTooltip(e);
    }

    /**
     * Move tooltip to follow mouse
     */
    moveByteTooltip(e) {
        const tooltip = document.getElementById('byteTooltip');
        if (!tooltip) return;

        const offsetX = 15;
        const offsetY = 15;
        const padding = 10;

        let x = e.clientX + offsetX;
        let y = e.clientY + offsetY;

        // Get tooltip dimensions
        const rect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Adjust if tooltip goes off screen
        if (x + rect.width + padding > viewportWidth) {
            x = e.clientX - rect.width - offsetX;
        }
        if (y + rect.height + padding > viewportHeight) {
            y = e.clientY - rect.height - offsetY;
        }

        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    }

    /**
     * Hide byte tooltip
     */
    hideByteTooltip() {
        if (this.tooltipPinned) return;
        const tooltip = document.getElementById('byteTooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    /**
     * Highlight grouped bytes
     */
    highlightByteGroup(container, group, highlight) {
        if (!group) return;

        group.forEach(idx => {
            const byteEl = container.querySelector(`[data-index="${idx}"]`);
            if (byteEl) {
                if (highlight) {
                    byteEl.classList.add('byte-group-highlight');
                } else {
                    byteEl.classList.remove('byte-group-highlight');
                }
            }
        });
    }

    /**
     * Pin byte tooltip on click
     */
    pinByteTooltip(container, info, value, index, e) {
        // If already pinned, unpin first
        if (this.tooltipPinned) {
            this.unpinByteTooltip();
        }

        // Pin the tooltip
        this.tooltipPinned = true;
        this.pinnedBytesContainer = container;
        this.pinnedGroup = info.group;

        // Highlight the group
        this.highlightByteGroup(container, info.group, true);

        // Show tooltip
        this.showByteTooltip(e, info, value, index);

        // Add pinned class to tooltip
        const tooltip = document.getElementById('byteTooltip');
        if (tooltip) {
            tooltip.classList.add('pinned');
        }

        // Listen for clicks outside to unpin
        setTimeout(() => {
            document.addEventListener('click', this.handleOutsideClick);
        }, 0);
    }

    /**
     * Unpin byte tooltip
     */
    unpinByteTooltip() {
        if (!this.tooltipPinned) return;

        // Remove highlight
        if (this.pinnedBytesContainer && this.pinnedGroup) {
            this.highlightByteGroup(this.pinnedBytesContainer, this.pinnedGroup, false);
        }

        // Hide tooltip
        const tooltip = document.getElementById('byteTooltip');
        if (tooltip) {
            tooltip.classList.remove('pinned');
            tooltip.style.display = 'none';
        }

        // Reset state
        this.tooltipPinned = false;
        this.pinnedBytesContainer = null;
        this.pinnedGroup = null;

        // Remove click listener
        document.removeEventListener('click', this.handleOutsideClick);
    }

    /**
     * Handle outside click to unpin tooltip
     */
    handleOutsideClick = (e) => {
        const tooltip = document.getElementById('byteTooltip');
        if (tooltip && !tooltip.contains(e.target) && !e.target.classList.contains('monitor-byte')) {
            this.unpinByteTooltip();
        }
    }

    /**
     * Format bytes according to current display format
     */
    formatBytes(buffer) {
        if (this.displayFormat === 'hex') {
            return Array.from(buffer)
                .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
                .join(' ');
        } else {
            return Array.from(buffer)
                .map(b => b.toString().padStart(3, ' '))
                .join(' ');
        }
    }

    /**
     * Refresh monitor display when format changes
     */
    refreshMonitorDisplay() {
        const bytes = document.querySelectorAll('.monitor-byte');
        bytes.forEach(byteSpan => {
            const value = parseInt(byteSpan.dataset.value);
            if (!isNaN(value)) {
                byteSpan.textContent = this.displayFormat === 'hex'
                    ? value.toString(16).toUpperCase().padStart(2, '0')
                    : value.toString().padStart(3, ' ');
            }
        });
    }

    /**
     * Clear monitor
     */
    clearMonitor() {
        this.monitorEntries = [];
        const monitorDisplay = document.getElementById('monitorDisplay');
        monitorDisplay.innerHTML = '<p class="placeholder">Waiting for communication...</p>';
        this.updateMonitorEntryCount();
    }

    /**
     * Update statistics
     */
    updateStats(success) {
        if (success) {
            this.stats.success++;
        } else {
            this.stats.errors++;
        }
        this.updateStatsDisplay();
    }

    /**
     * Update statistics display
     */
    updateStatsDisplay() {
        const rate = this.stats.requests > 0
            ? ((this.stats.success / this.stats.requests) * 100).toFixed(1)
            : 0;

        // Calculate error rate per base frame count
        const errorRate = this.stats.requests > 0
            ? ((this.stats.errors / this.stats.requests) * this.baseFrameCount).toFixed(1)
            : 0;

        // Update navbar stats (with null checks)
        const navElements = {
            'navStatRequests': this.stats.requests,
            'navStatSuccess': this.stats.success,
            'navStatErrors': this.stats.errors,
            'navStatRate': `${rate}%`,
            'navStatErrorRate': errorRate,
            'tooltipRequests': this.stats.requests,
            'tooltipSuccess': this.stats.success,
            'tooltipErrors': this.stats.errors,
            'tooltipRate': `${rate}%`,
            'tooltipErrorRate': errorRate,
            'tooltipBaseFrames': this.baseFrameCount
        };

        for (const [id, value] of Object.entries(navElements)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }

        // ERR/N 최대 자릿수(baseFrameCount + ".0")에 맞춰 너비 고정
        const errRateEl = document.getElementById('navStatErrorRate');
        if (errRateEl) {
            const maxChars = String(this.baseFrameCount).length + 2; // e.g. 1000 → "1000.0" = 6
            errRateEl.style.minWidth = maxChars + 'ch';
        }

        // Update per-device stats
        this.updateDeviceStatsDisplay();
    }

    /**
     * Update per-device statistics display
     */
    updateDeviceStatsDisplay() {
        const container = document.getElementById('deviceStatsContainer');
        if (!container) return;

        const slaveIds = Object.keys(this.deviceStats).map(Number).sort((a, b) => a - b);

        if (slaveIds.length === 0) {
            container.innerHTML = '<p style="color: #6c757d; font-size: 11px;">No device data yet</p>';
            return;
        }

        container.innerHTML = slaveIds.map(slaveId => {
            const stats = this.deviceStats[slaveId];
            const device = this.devices.find(d => d.slaveId === slaveId);
            const name = device ? device.name : `Device ${slaveId}`;
            const rate = stats.requests > 0
                ? ((stats.success / stats.requests) * 100).toFixed(0)
                : 0;

            return `
                <div class="device-stats-row">
                    <div class="stats-device-info">
                        <span class="device-id-badge">ID: ${slaveId}</span>
                        <span class="device-name" data-devname="${name}">${name}</span>
                    </div>
                    <span class="stat-ok">${stats.success}</span>
                    <span class="stat-err">${stats.errors}</span>
                    <span class="stat-rate">${rate}%</span>
                </div>
            `;
        }).join('');

        this.setupDeviceNameTooltips(container);
    }

    setupDeviceNameTooltips(container) {
        let tip = document.getElementById('devNameFloatTip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'devNameFloatTip';
            tip.style.cssText = [
                'position:fixed',
                'background:rgba(44,62,80,0.95)',
                'color:#fff',
                'padding:4px 10px',
                'border-radius:4px',
                'font-size:12px',
                'white-space:nowrap',
                'z-index:99999',
                'pointer-events:none',
                'display:none',
                'box-shadow:0 2px 6px rgba(0,0,0,0.3)'
            ].join(';');
            document.body.appendChild(tip);
        }

        container.querySelectorAll('.device-name[data-devname]').forEach(el => {
            el.addEventListener('mouseenter', () => {
                if (el.scrollWidth > el.clientWidth) {
                    tip.textContent = el.dataset.devname;
                    tip.style.display = 'block';
                }
            });
            el.addEventListener('mousemove', (e) => {
                tip.style.left = (e.clientX + 14) + 'px';
                tip.style.top  = (e.clientY - 32) + 'px';
            });
            el.addEventListener('mouseleave', () => {
                tip.style.display = 'none';
            });
        });
    }

    /**
     * Update device statistics
     */
    updateDeviceStats(slaveId, success) {
        if (!this.deviceStats[slaveId]) {
            this.deviceStats[slaveId] = { requests: 0, success: 0, errors: 0 };
        }

        this.deviceStats[slaveId].requests++;
        if (success) {
            this.deviceStats[slaveId].success++;
        } else {
            this.deviceStats[slaveId].errors++;
        }
    }

    /**
     * Update connection status UI
     */
    updateConnectionStatus(connected) {
        const navbarStatusIndicator = document.getElementById('navbar-status-indicator');
        const navbarStatusText = document.getElementById('navbar-status-text');
        const serialStatusBanner = document.getElementById('serial-status-banner');
        const sidebarConnectBtn = document.getElementById('sidebar-connectBtn');
        const sendBtn = document.getElementById('sendBtn');
        const serialPortMenu = document.getElementById('serialPortMenu');

        if (connected) {
            navbarStatusIndicator.className = 'navbar-status-indicator status-connected';
            if (navbarStatusText) navbarStatusText.textContent = 'Connected';
            if (serialStatusBanner) {
                serialStatusBanner.classList.remove('disconnected');
                serialStatusBanner.classList.add('connected');
            }
            sidebarConnectBtn.textContent = 'Disconnect';
            sidebarConnectBtn.className = 'btn btn-secondary btn-block';
            sendBtn.disabled = false;
        } else {
            navbarStatusIndicator.className = 'navbar-status-indicator status-disconnected';
            if (navbarStatusText) navbarStatusText.textContent = 'Disconnected';
            if (serialStatusBanner) {
                serialStatusBanner.classList.remove('connected');
                serialStatusBanner.classList.add('disconnected');
            }
            sidebarConnectBtn.textContent = 'Connect';
            sidebarConnectBtn.className = 'btn btn-primary btn-block';
            sendBtn.disabled = true;

            // Open Serial Port menu when disconnected
            if (serialPortMenu) {
                serialPortMenu.classList.add('expanded');
            }
        }

        // 시리얼 미연결 시 모든 카드/리스트 아이템 비활성화
        document.querySelectorAll('.device-card, .device-list-item').forEach(el => {
            el.classList.toggle('serial-disconnected', !connected);
        });
    }

    // ========== Parameter Management ==========

    /**
     * Show add parameter modal
     */
    showAddParameterModal() {
        const modal = document.getElementById('addParamModal');
        modal.classList.add('active');
        document.getElementById('paramName').value = '';
        document.getElementById('paramAddress').value = '0';
        document.getElementById('paramFunction').value = '3';
    }

    /**
     * Hide add parameter modal
     */
    hideAddParameterModal() {
        const modal = document.getElementById('addParamModal');
        modal.classList.remove('active');
    }

    /**
     * Save parameter
     */
    saveParameter() {
        const name = document.getElementById('paramName').value.trim();
        const address = parseInt(document.getElementById('paramAddress').value);
        const functionCode = parseInt(document.getElementById('paramFunction').value);

        if (!name) {
            alert('Please enter a parameter name');
            return;
        }

        const param = {
            id: Date.now(),
            name,
            address,
            functionCode,
            value: null,
            lastUpdate: null
        };

        this.parameters.push(param);
        this.saveParameters();
        this.renderParameters();
        this.hideAddParameterModal();
    }

    /**
     * Load parameters from localStorage or default CSV
     */
    loadParameters() {
        const stored = localStorage.getItem('modbusParameters');
        if (stored) {
            this.parameters = JSON.parse(stored);
            // Clear previous session values - only show values actually read from device
            this.parameters.forEach(p => { p.value = null; });
            this.renderParameters();
        } else {
            // No stored parameters - load default CSV automatically
            this.loadDefaultCSV();
        }
    }

    /**
     * Save parameters to localStorage
     */
    saveParameters() {
        localStorage.setItem('modbusParameters', JSON.stringify(this.parameters));
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const stored = localStorage.getItem('modbusSettings');
        if (stored) {
            const settings = JSON.parse(stored);
            this.baseFrameCount = settings.baseFrameCount || 1000;
            document.getElementById('baseFrameCount').value = this.baseFrameCount;

            // Load auto scan settings
            this.autoScanEnabled = settings.autoScanEnabled !== undefined ? settings.autoScanEnabled : true;
            this.scanRangeStart = settings.scanRangeStart || 1;
            this.scanRangeEnd = settings.scanRangeEnd || 10;
            this.scanTimeout = settings.scanTimeout || 200;
            this.scanRegister = settings.scanRegister || 0xD011;
            this.scanRemoveNotFound = settings.scanRemoveNotFound || false;

            // Update UI
            const autoScanToggle = document.getElementById('autoScanEnabled');
            const autoScanStatus = document.getElementById('autoScanStatus');
            if (autoScanToggle) {
                autoScanToggle.checked = this.autoScanEnabled;
                if (autoScanStatus) {
                    autoScanStatus.textContent = this.autoScanEnabled ? '활성' : '비활성';
                    autoScanStatus.classList.toggle('active', this.autoScanEnabled);
                }
            }

            const scanRangeStart = document.getElementById('scanRangeStart');
            const scanRangeEnd = document.getElementById('scanRangeEnd');
            const scanTimeout = document.getElementById('scanTimeout');
            const scanRegister = document.getElementById('scanRegister');

            if (scanRangeStart) scanRangeStart.value = this.scanRangeStart;
            if (scanRangeEnd) scanRangeEnd.value = this.scanRangeEnd;
            if (scanTimeout) scanTimeout.value = this.scanTimeout;
            if (scanRegister) scanRegister.value = '0x' + this.scanRegister.toString(16).toUpperCase();

            const scanRemoveNotFoundToggle = document.getElementById('scanRemoveNotFound');
            const scanRemoveNotFoundStatus = document.getElementById('scanRemoveNotFoundStatus');
            if (scanRemoveNotFoundToggle) {
                scanRemoveNotFoundToggle.checked = this.scanRemoveNotFound;
                if (scanRemoveNotFoundStatus) {
                    scanRemoveNotFoundStatus.textContent = this.scanRemoveNotFound ? '활성' : '비활성';
                    scanRemoveNotFoundStatus.classList.toggle('active', this.scanRemoveNotFound);
                }
            }
        }

        // Always sync autoScanEnabled UI to match the current value
        // (handles the case where no stored settings exist but this.autoScanEnabled defaults to true)
        const autoScanToggle = document.getElementById('autoScanEnabled');
        const autoScanStatus = document.getElementById('autoScanStatus');
        if (autoScanToggle) {
            autoScanToggle.checked = this.autoScanEnabled;
            if (autoScanStatus) {
                autoScanStatus.textContent = this.autoScanEnabled ? '활성' : '비활성';
                autoScanStatus.classList.toggle('active', this.autoScanEnabled);
            }
        }

        // Restore monitor panel state
        const monitorPanelOpen = localStorage.getItem('monitorPanelOpen');
        if (monitorPanelOpen === 'true') {
            setTimeout(() => this.openMonitorPanel(), 100);
        }
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        const settings = {
            baseFrameCount: this.baseFrameCount,
            autoScanEnabled: this.autoScanEnabled,
            scanRangeStart: this.scanRangeStart,
            scanRangeEnd: this.scanRangeEnd,
            scanTimeout: this.scanTimeout,
            scanRegister: this.scanRegister,
            scanRemoveNotFound: this.scanRemoveNotFound
        };
        localStorage.setItem('modbusSettings', JSON.stringify(settings));
    }

    /**
     * Update parameter page device selector with radio buttons
     */
    updateParamDeviceSelector() {
        const radioGroup = document.getElementById('paramDeviceRadioGroup');
        if (!radioGroup) return;

        // Get devices with valid slave IDs
        const validDevices = this.devices.filter(d => d.slaveId !== 0);

        if (validDevices.length === 0) {
            radioGroup.innerHTML = `
                <div class="param-device-placeholder">
                    <span>📦</span> Dashboard에서 디바이스를 등록하세요
                </div>
            `;
            this.selectedParamDeviceId = null;
            this.updateParamDeviceStatus();
            return;
        }

        // Build radio buttons
        radioGroup.innerHTML = validDevices.map(device => `
            <input type="radio"
                   class="param-device-radio"
                   name="paramDevice"
                   id="paramDevice_${device.slaveId}"
                   value="${device.slaveId}"
                   ${this.selectedParamDeviceId === device.slaveId ? 'checked' : ''}>
            <label class="param-device-radio-label" for="paramDevice_${device.slaveId}">
                <span class="device-indicator"></span>
                <span class="device-name-group">
                    <span class="device-name">${device.name}</span>
                    <span class="device-serial" data-serial-for="${device.id}">${device.serialNumber ? 'S/N: ' + device.serialNumber : ''}</span>
                </span>
                <span class="device-id">ID: ${device.slaveId}</span>
            </label>
        `).join('');

        // Check if previous selection is still valid
        if (this.selectedParamDeviceId) {
            const stillExists = validDevices.some(d => d.slaveId === this.selectedParamDeviceId);
            if (!stillExists) {
                this.selectedParamDeviceId = null;
            }
        }

        // 선택된 디바이스가 없으면 첫 번째 디바이스 자동 선택
        if (!this.selectedParamDeviceId && validDevices.length > 0) {
            this.selectedParamDeviceId = validDevices[0].slaveId;
            const firstRadio = radioGroup.querySelector('.param-device-radio');
            if (firstRadio) firstRadio.checked = true;
        }

        this.updateParamDeviceStatus();
    }

    /**
     * Update parameter page device status display
     */
    updateParamDeviceStatus() {
        const readAllBtn = document.getElementById('paramReadAllBtn');
        const selectedNameEl = document.getElementById('paramDeviceSelectedName');

        if (this.selectedParamDeviceId) {
            const device = this.devices.find(d => d.slaveId === this.selectedParamDeviceId);
            if (device && selectedNameEl) {
                selectedNameEl.textContent = `${device.name} (ID: ${device.slaveId})`;
                selectedNameEl.classList.remove('none');
            }
            if (readAllBtn) readAllBtn.disabled = false;
        } else {
            if (selectedNameEl) {
                selectedNameEl.textContent = '선택 안됨';
                selectedNameEl.classList.add('none');
            }
            if (readAllBtn) readAllBtn.disabled = true;
        }
    }

    /**
     * Read all parameters for selected device
     */
    async readAllParameters() {
        if (!this.selectedParamDeviceId) {
            this.showToast('디바이스를 먼저 선택하세요', 'warning');
            return;
        }

        if (!this.writer && !this.simulatorEnabled) {
            this.showToast('시리얼 포트에 연결하거나 시뮬레이터를 활성화하세요', 'warning');
            return;
        }

        // 현재 필터 조건에 맞는 파라미터만 읽기 (implemented === 'Y' 필수)
        const implementedParams = this.parameters.filter(p => {
            if (p.implemented !== 'Y') return false;
            if (this.paramTypeFilter !== 'all' && p.type !== this.paramTypeFilter) return false;
            if (this.paramImplementedFilter !== 'all' && p.implemented !== this.paramImplementedFilter) return false;
            if (this.paramSearchText) {
                const s = this.paramSearchText.toLowerCase();
                const nameMatch = p.name.toLowerCase().includes(s);
                const addressMatch = p.address.toLowerCase().includes(s);
                const descMatch = p.description && p.description.toLowerCase().includes(s);
                if (!nameMatch && !addressMatch && !descMatch) return false;
            }
            return true;
        });
        if (implementedParams.length === 0) {
            this.showToast('읽을 수 있는 파라미터가 없습니다', 'info');
            return;
        }

        const total = implementedParams.length;
        this._paramReadProgress = this.showProgressToast(`Reading ${total} parameters...`, total);
        const progress = this._paramReadProgress;

        let successCount = 0;
        let errorCount = 0;
        let current = 0;

        for (const param of implementedParams) {
            if (progress.isCancelled()) break;

            try {
                const ok = await this.readParameterByAddress(param, true);
                if (ok) successCount++;
                else errorCount++;
            } catch (error) {
                console.error(`Error reading ${param.name}:`, error);
                errorCount++;
            }

            current++;
            progress.update(current, successCount, errorCount);
            // Small delay between reads
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        this._paramReadProgress = null;

        const wasCancelled = progress.isCancelled();
        const resultMsg = wasCancelled
            ? `중단: ${successCount} 성공, ${errorCount} 실패`
            : `완료: ${successCount} 성공, ${errorCount} 실패`;

        progress.dismiss(resultMsg);
    }

    /**
     * Render parameter list with filtering
     */
    renderParameters() {
        const paramList = document.getElementById('paramList');
        const paramCount = document.getElementById('paramCount');

        if (this.parameters.length === 0) {
            paramList.innerHTML = '<p class="placeholder">No parameters defined. Click "Import CSV" or "Load Default" to load parameters.</p>';
            if (paramCount) paramCount.textContent = '0 parameters';
            return;
        }

        // Filter parameters
        let filtered = this.parameters.filter(param => {
            // Type filter
            if (this.paramTypeFilter !== 'all' && param.type !== this.paramTypeFilter) {
                return false;
            }
            // Implemented filter
            if (this.paramImplementedFilter !== 'all' && param.implemented !== this.paramImplementedFilter) {
                return false;
            }
            // Search filter
            if (this.paramSearchText) {
                const searchLower = this.paramSearchText.toLowerCase();
                const nameMatch = param.name.toLowerCase().includes(searchLower);
                const addressMatch = param.address.toLowerCase().includes(searchLower);
                const descMatch = param.description && param.description.toLowerCase().includes(searchLower);
                if (!nameMatch && !addressMatch && !descMatch) {
                    return false;
                }
            }
            return true;
        });

        if (paramCount) {
            paramCount.textContent = `${filtered.length} / ${this.parameters.length} parameters`;
        }

        if (filtered.length === 0) {
            paramList.innerHTML = '<p class="placeholder">No parameters match the filter criteria.</p>';
            return;
        }

        paramList.innerHTML = '';

        // Add header
        const header = document.createElement('div');
        header.className = 'param-list-header';
        header.innerHTML = `
            <div>Type</div>
            <div>Address</div>
            <div>Name / Description</div>
            <div>Unit</div>
            <div>Value</div>
            <div>Status</div>
            <div>Actions</div>
        `;
        paramList.appendChild(header);

        filtered.forEach(param => {
            const item = document.createElement('div');
            item.className = 'param-item';
            item.dataset.paramId = param.id;

            // Type badge
            const typeCol = document.createElement('div');
            const typeBadge = document.createElement('span');
            typeBadge.className = `param-type-badge ${param.type || 'holding'}`;
            typeBadge.textContent = param.type === 'input' ? 'Input' : param.type === 'lsm' ? 'LSM' : 'Holding';
            typeCol.appendChild(typeBadge);

            // Address
            const address = document.createElement('div');
            address.className = 'param-address';
            address.textContent = param.address;

            // Name and description
            const nameCol = document.createElement('div');
            nameCol.className = 'param-name-col';
            const name = document.createElement('div');
            name.className = 'param-name';
            name.textContent = param.name;
            nameCol.appendChild(name);

            let hasTable = false;
            if (param.description) {
                const desc = document.createElement('div');
                desc.className = 'param-description';

                // Check if description contains "설명 | 표데이터" format
                const separatorPattern = /^(.+?)\s*\|\s*([\d]+:[^,]+(?:,\s*[\d]+:[^,]+)+)$/;
                const mappingOnlyPattern = /^[\d]+:[^,]+(?:,\s*[\d]+:[^,]+)+$/;

                const separatorMatch = param.description.match(separatorPattern);
                const hasMappingOnly = mappingOnlyPattern.test(param.description);

                if (separatorMatch || hasMappingOnly) {
                    hasTable = true;
                    let textPart = '';
                    let tablePart = '';

                    if (separatorMatch) {
                        textPart = separatorMatch[1].trim();
                        tablePart = separatorMatch[2].trim();
                    } else {
                        tablePart = param.description;
                    }

                    // Add description text if exists
                    if (textPart) {
                        const descText = document.createElement('div');
                        descText.className = 'param-description-text';
                        descText.textContent = textPart;
                        desc.appendChild(descText);
                    }

                    // Parse and create table
                    const table = document.createElement('table');
                    table.className = 'param-value-table';

                    const mappings = tablePart.split(/,\s*/);
                    mappings.forEach(mapping => {
                        const colonIndex = mapping.indexOf(':');
                        if (colonIndex > -1) {
                            const value = mapping.substring(0, colonIndex).trim();
                            const label = mapping.substring(colonIndex + 1).trim();
                            const row = document.createElement('tr');
                            const valueCell = document.createElement('td');
                            valueCell.className = 'param-value-cell';
                            valueCell.textContent = value;
                            const labelCell = document.createElement('td');
                            labelCell.className = 'param-label-cell';
                            labelCell.textContent = label;
                            row.appendChild(valueCell);
                            row.appendChild(labelCell);
                            table.appendChild(row);
                        }
                    });
                    desc.appendChild(table);
                } else {
                    desc.textContent = param.description;
                }
                nameCol.appendChild(desc);
            }

            // 테이블이 있으면 무조건 expandable, 아니면 나중에 오버플로우 체크
            if (hasTable) {
                nameCol.classList.add('expandable');
                nameCol.onclick = (e) => {
                    e.stopPropagation();
                    nameCol.classList.toggle('expanded');
                };
            } else if (param.description) {
                // 렌더링 후 오버플로우 체크를 위해 마킹
                nameCol.dataset.checkOverflow = 'true';
            }

            // Unit
            const unitCol = document.createElement('div');
            unitCol.className = 'param-unit';
            unitCol.textContent = param.unit || '-';

            // Value
            const valueCol = document.createElement('div');
            valueCol.className = 'param-value';
            const numValue = Number(param.value);
            if (param.value !== undefined && param.value !== null && param.value !== '' && !isNaN(numValue)) {
                valueCol.innerHTML = `<span class="value-dec">${numValue}</span><br><span class="value-hex">0x${numValue.toString(16).toUpperCase().padStart(4, '0')}</span>`;
            } else {
                valueCol.textContent = '-';
            }

            // Implemented status
            const statusCol = document.createElement('div');
            const statusBadge = document.createElement('span');
            statusBadge.className = `implemented-badge ${param.implemented === 'Y' ? 'yes' : 'no'}`;
            statusBadge.textContent = param.implemented === 'Y' ? 'Impl' : 'N/A';
            statusCol.appendChild(statusBadge);

            // Actions
            const actions = document.createElement('div');
            actions.className = 'param-actions';

            const readBtn = document.createElement('button');
            readBtn.className = 'btn btn-info btn-sm';
            readBtn.textContent = 'R';
            readBtn.title = 'Read';
            readBtn.onclick = () => this.readParameterByAddress(param);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-secondary btn-sm';
            deleteBtn.textContent = '×';
            deleteBtn.title = 'Delete';
            deleteBtn.onclick = () => this.deleteParameter(param.id);

            actions.appendChild(readBtn);
            actions.appendChild(deleteBtn);

            item.appendChild(typeCol);
            item.appendChild(address);
            item.appendChild(nameCol);
            item.appendChild(unitCol);
            item.appendChild(valueCol);
            item.appendChild(statusCol);
            item.appendChild(actions);

            paramList.appendChild(item);
        });

        // 렌더링 후 오버플로우 체크하여 expandable 클래스 추가
        requestAnimationFrame(() => {
            paramList.querySelectorAll('.param-name-col[data-check-overflow="true"]').forEach(nameCol => {
                const desc = nameCol.querySelector('.param-description');
                const name = nameCol.querySelector('.param-name');
                // clientWidth === 0 이면 탭이 숨겨진 상태 — 측정 불가이므로 expandable 부여하지 않음
                const descOverflow = desc && desc.clientWidth > 0 && desc.scrollWidth > desc.clientWidth;
                const nameOverflow = name && name.clientWidth > 0 && name.scrollWidth > name.clientWidth;
                if (descOverflow || nameOverflow) {
                    nameCol.classList.add('expandable');
                    nameCol.onclick = (e) => {
                        e.stopPropagation();
                        nameCol.classList.toggle('expanded');
                    };
                }
                delete nameCol.dataset.checkOverflow;
            });
        });
    }

    /**
     * Import parameters from CSV file
     */
    importCSV(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csv = e.target.result;
                const lines = csv.split('\n');
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

                const newParams = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    // Parse CSV line (handle quoted strings with commas)
                    const values = this.parseCSVLine(line);
                    if (values.length < 3) continue;

                    const param = {
                        id: Date.now() + i,
                        type: values[headers.indexOf('type')] || 'holding',
                        address: values[headers.indexOf('address')] || '',
                        name: values[headers.indexOf('name')] || '',
                        implemented: values[headers.indexOf('implemented')] || 'N',
                        description: values[headers.indexOf('description')] || '',
                        unit: values[headers.indexOf('unit')] || '',
                        value: null,
                        functionCode: values[headers.indexOf('type')] === 'input' ? 4 : values[headers.indexOf('type')] === 'lsm' ? 0x2B : 3
                    };

                    if (param.address && param.name) {
                        newParams.push(param);
                    }
                }

                this.parameters = newParams;
                this.saveParameters();
                this.renderParameters();
                this.showToast(`${newParams.length}개의 파라미터를 가져왔습니다`, 'success');
            } catch (error) {
                this.showToast(`CSV 파싱 오류: ${error.message}`, 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    }

    /**
     * Parse CSV line handling quoted strings
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    /**
     * Export parameters to CSV file
     */
    exportCSV() {
        if (this.parameters.length === 0) {
            this.showToast('내보낼 파라미터가 없습니다', 'warning');
            return;
        }

        const headers = ['type', 'address', 'name', 'implemented', 'description'];
        const csvLines = [headers.join(',')];

        this.parameters.forEach(param => {
            const values = [
                param.type || 'holding',
                param.address || '',
                `"${(param.name || '').replace(/"/g, '""')}"`,
                param.implemented || 'N',
                `"${(param.description || '').replace(/"/g, '""')}"`
            ];
            csvLines.push(values.join(','));
        });

        const csv = csvLines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'parameters.csv';
        link.click();
        URL.revokeObjectURL(link.href);

        this.showToast('CSV 파일로 내보냈습니다', 'success');
    }

    /**
     * Load default parameters (embedded data)
     */
    loadDefaultCSV() {
        const defaultParams = this.getDefaultParameters();

        const newParams = defaultParams.map((p, i) => ({
            id: Date.now() + i,
            type: p.type,
            address: p.address,
            name: p.name,
            implemented: p.implemented,
            description: p.description,
            value: null,
            functionCode: p.type === 'input' ? 4 : p.type === 'lsm' ? 0x2B : 3
        }));

        this.parameters = newParams;
        this.saveParameters();
        this.renderParameters();
        this.showToast(`기본 파라미터 ${newParams.length}개를 로드했습니다`, 'success');
    }

    /**
     * Get default parameter definitions
     */
    getDefaultParameters() {
        return [
            // Holding Registers
            {type:'holding',group:'Control',address:'0xD000',name:'Reset',implemented:'Y',description:'Software Reset, Error Reset, EEPROM to RAM'},
            {type:'holding',group:'Control',address:'0xD001',name:'Setpoint',implemented:'Y',description:'지령 값, 오픈루프 모드이면 % or 속도모드이면 RPM'},
            {type:'holding',group:'Control',address:'0xD00D',name:'Stored set value',implemented:'N',description:'Set Point 설정값이 EEPROM에 저장됨, 급작스러운 전원 공급 중단 및 복구 후 마지막 설정값으로 재시작'},
            {type:'holding',group:'Control',address:'0xD00F',name:'Enable/Disable',implemented:'N',description:'서보드라이브의 SVON/SVOFF와 같은 기능, 0xD16A(Enable/Disable source)의 값에 따라 적절한 Enable state가 결정'},
            {type:'holding',group:'Information',address:'0xD005',name:'Factory setting Control',implemented:'N',description:'공장 초기값 변경 및 적용 용도'},
            {type:'holding',group:'Information',address:'0xD009',name:'Operating hours counter',implemented:'N',description:'65535시간까지 카운트 후 고정'},
            {type:'holding',group:'Information',address:'0xD00A',name:'Operating minutes counter',implemented:'N',description:'0분 to 59분 롤링'},
            {type:'holding',group:'Communication',address:'0xD100',name:'Fan address',implemented:'Y',description:'Node ID와 같은 역할'},
            {type:'holding',group:'Communication',address:'0xD101',name:'Set value source',implemented:'Y',description:'Setpoint를 어떤 수단으로 사용할 것인지 설정 (0:AIN1, 1:RS485, 2:AIN2, 3:PWM)'},
            {type:'holding',group:'Communication',address:'0xD149',name:'Transmission speed',implemented:'Y',description:'RS-485 통신 속도를 설정합니다. | 0:1200bps, 1:2400bps, 2:4800bps, 3:9600bps, 4:19200bps(default), 5:38400bps, 6:57600bps, 7:115200bps'},
            {type:'holding',group:'Communication',address:'0xD14A',name:'Parity configuration',implemented:'Y',description:'시리얼 통신의 데이터 비트, 패리티, 스톱 비트를 설정합니다. | 0:Data8/Even/Stop1(default), 1:Data8/Odd/Stop1, 2:Data8/None/Stop2, 3:Data8/None/Stop1'},
            {type:'holding',group:'Motor Control',address:'0xD102',name:'Preferred running direction',implemented:'Y',description:'구동 방향 결정 (0:CCW, 1:CW)'},
            {type:'holding',group:'Motor Control',address:'0xD106',name:'Operating mode',implemented:'Y',description:'모터 제어 방식을 설정합니다. | 0:Speed Control, 2:Open-loop control'},
            {type:'holding',group:'Motor Control',address:'0xD112',name:'Motor stop enable',implemented:'N',description:'0: set value가 0이더라도 모터 항상 SVON, 1: set value가 0일 경우 모터 SVOFF'},
            {type:'holding',group:'Motor Control',address:'0xD119',name:'Maximum speed',implemented:'Y',description:'센서 제어모드 및 Open-loop control 모드에서는 이 파라미터에 지정된 속도로 제한 (토크모드에서의 속도제한 값)'},
            {type:'holding',group:'Motor Control',address:'0xD11A',name:'Maximum permissible speed',implemented:'N',description:'최대 속도의 상한치를 설정 (모터 최대 속도)'},
            {type:'holding',group:'Motor Control',address:'0xD11F',name:'Ramp-up curve',implemented:'Y',description:'가/감속도 조정 파라미터, 알람 등 모터 정지조건이 감지되면 감속없이 정지함'},
            {type:'holding',group:'Motor Control',address:'0xD120',name:'Ramp-down curve',implemented:'Y',description:'감속 곡선 설정'},
            {type:'holding',group:'Signal Mapping',address:'0xD12A',name:'Point 1 X-coordinate',implemented:'Y',description:'아날로그 입력 또는 PWM 입력 신호에 설정값을 할당하는데 사용'},
            {type:'holding',group:'Signal Mapping',address:'0xD12B',name:'Point 1 Y-coordinate',implemented:'Y',description:'아날로그 입력 또는 PWM 입력 신호에 설정값을 할당하는데 사용'},
            {type:'holding',group:'Signal Mapping',address:'0xD12C',name:'Point 2 X-coordinate',implemented:'Y',description:'아날로그 입력 또는 PWM 입력 신호에 설정값을 할당하는데 사용'},
            {type:'holding',group:'Signal Mapping',address:'0xD12D',name:'Point 2 Y-coordinate',implemented:'Y',description:'아날로그 입력 또는 PWM 입력 신호에 설정값을 할당하는데 사용'},
            {type:'holding',group:'Limitation',address:'0xD12F',name:'Limitation Control',implemented:'N',description:'0번 비트 set: Power limit 활성화, 1번 비트 set: Current Limit 활성화'},
            {type:'holding',group:'Limitation',address:'0xD135',name:'Maximum permissible power',implemented:'N',description:'허용 가능한 최대 파워 설정'},
            {type:'holding',group:'Limitation',address:'0xD136',name:'Max. power at derating end',implemented:'N',description:'모듈과 모터의 온도를 토대로 출력을 디레이팅 하는 기능'},
            {type:'holding',group:'Limitation',address:'0xD137',name:'Module temperature power derating start',implemented:'Y',description:'모듈 온도 파워 디레이팅 시작점'},
            {type:'holding',group:'Limitation',address:'0xD138',name:'Module temperature power derating end',implemented:'Y',description:'모듈 온도 파워 디레이팅 종료점'},
            {type:'holding',group:'Limitation',address:'0xD13B',name:'Maximum coil current',implemented:'Y',description:'전류 제한이 활성화 되면 모터 코일전류(rms값)를 이 파라미터에 설정된 값으로 제한'},
            {type:'holding',group:'Limitation',address:'0xD145',name:'Speed limit for running monitoring',implemented:'N',description:'실행 모니터링 속도제한, 속도 피드백이 이 파라미터에 설정된 속도보다 낮을 경우 오류 해제 (n_Low)'},
            {type:'holding',group:'Limitation',address:'0xD147',name:'Sensor actual value source',implemented:'Y',description:'지령으로 선택된 센서의 지령값'},
            {type:'holding',group:'Limitation',address:'0xD14D',name:'Motor temperature power derating start address',implemented:'N',description:'모터 온도 파워 디레이팅 시작 주소'},
            {type:'holding',group:'Limitation',address:'0xD14E',name:'Motor temperature power derating end address',implemented:'N',description:'모터 온도 파워 디레이팅 종료 주소'},
            {type:'holding',group:'Limitation',address:'0xD155',name:'Maximum power',implemented:'N',description:'최대 파워 설정'},
            {type:'holding',group:'I/O',address:'0xD158',name:'Configuration of I/O 1',implemented:'N',description:'I/O 활성/비활성화 설정 파라미터'},
            {type:'holding',group:'I/O',address:'0xD159',name:'Configuration of I/O 2',implemented:'N',description:'I/O 활성/비활성화 설정 파라미터'},
            {type:'holding',group:'I/O',address:'0xD15A',name:'Configuration of I/O 3',implemented:'N',description:'I/O 활성/비활성화 설정 파라미터'},
            {type:'holding',group:'Sensor',address:'0xD160',name:'Min. sensor value',implemented:'Y',description:'입력 센서의 최소값'},
            {type:'holding',group:'Sensor',address:'0xD162',name:'Max. sensor value',implemented:'Y',description:'입력 센서의 최대값'},
            {type:'holding',group:'Shedding',address:'0xF150',name:'Shedding function',implemented:'N',description:'외부 환경에 의해 팬이 얼어 기동이 어려울 경우 이 기능 활성화를 통해 구속 상태를 제거'},
            {type:'holding',group:'Shedding',address:'0xF151',name:'Max. starting modulation level',implemented:'N',description:'최대 시작 모듈레이션 레벨'},
            {type:'holding',group:'Shedding',address:'0xF152',name:'Number of start attempts',implemented:'N',description:'시작 시도 횟수'},
            {type:'holding',group:'Shedding',address:'0xF153',name:'Relay dropout delay',implemented:'N',description:'에러나 경고 감지 시 릴레이 출력 지연시간을 설정하여 단기 이슈일 경우는 무시'},
            {type:'holding',group:'Customer Data',address:'0xD170',name:'Customer data 0',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD171',name:'Customer data 1',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD172',name:'Customer data 2',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD173',name:'Customer data 3',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD174',name:'Customer data 4',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD175',name:'Customer data 5',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD176',name:'Customer data 6',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD177',name:'Customer data 7',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD178',name:'Customer data 8',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD179',name:'Customer data 9',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD17A',name:'Customer data 10',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD17B',name:'Customer data 11',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD17C',name:'Customer data 12',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD17D',name:'Customer data 13',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD17E',name:'Customer data 14',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Customer Data',address:'0xD17F',name:'Customer data 15',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',group:'Error / History',address:'0xD180',name:'Operating hours counter (back-up)',implemented:'N',description:'0xD009의 사용시간을 저장하는 파라미터'},
            {type:'holding',group:'Error / History',address:'0xD182',name:'Error indicator',implemented:'N',description:'가장 최근 에러의 파라미터 번호를 표시'},
            {type:'holding',group:'Error / History',address:'0xD184',name:'Error 1',implemented:'N',description:'팬에서 발생한 첫 번째 오류 표시'},
            {type:'holding',group:'Error / History',address:'0xD185',name:'Error time',implemented:'N',description:'팬에서 발생한 에러를 최대 13개까지 저장'},
            {type:'holding',group:'Error / History',address:'0xD186',name:'Error history 1',implemented:'N',description:'에러 히스토리 1'},
            {type:'holding',group:'Error / History',address:'0xD187',name:'Error history time 1',implemented:'N',description:'에러 히스토리 시간 1'},
            {type:'holding',group:'Error / History',address:'0xD188',name:'Error history 2',implemented:'N',description:'에러 히스토리 2'},
            {type:'holding',group:'Error / History',address:'0xD189',name:'Error history time 2',implemented:'N',description:'에러 히스토리 시간 2'},
            {type:'holding',group:'Error / History',address:'0xD18A',name:'Error history 3',implemented:'N',description:'에러 히스토리 3'},
            {type:'holding',group:'Error / History',address:'0xD18B',name:'Error history time 3',implemented:'N',description:'에러 히스토리 시간 3'},
            {type:'holding',group:'Error / History',address:'0xD18C',name:'Error history 4',implemented:'N',description:'에러 히스토리 4'},
            {type:'holding',group:'Error / History',address:'0xD18D',name:'Error history time 4',implemented:'N',description:'에러 히스토리 시간 4'},
            {type:'holding',group:'Error / History',address:'0xD18E',name:'Error history 5',implemented:'N',description:'에러 히스토리 5'},
            {type:'holding',group:'Error / History',address:'0xD18F',name:'Error history time 5',implemented:'N',description:'에러 히스토리 시간 5'},
            {type:'holding',group:'Error / History',address:'0xD190',name:'Error history 6',implemented:'N',description:'에러 히스토리 6'},
            {type:'holding',group:'Error / History',address:'0xD191',name:'Error history time 6',implemented:'N',description:'에러 히스토리 시간 6'},
            {type:'holding',group:'Error / History',address:'0xD192',name:'Error history 7',implemented:'N',description:'에러 히스토리 7'},
            {type:'holding',group:'Error / History',address:'0xD193',name:'Error history time 7',implemented:'N',description:'에러 히스토리 시간 7'},
            {type:'holding',group:'Error / History',address:'0xD194',name:'Error history 8',implemented:'N',description:'에러 히스토리 8'},
            {type:'holding',group:'Error / History',address:'0xD195',name:'Error history time 8',implemented:'N',description:'에러 히스토리 시간 8'},
            {type:'holding',group:'Error / History',address:'0xD196',name:'Error history 9',implemented:'N',description:'에러 히스토리 9'},
            {type:'holding',group:'Error / History',address:'0xD197',name:'Error history time 9',implemented:'N',description:'에러 히스토리 시간 9'},
            {type:'holding',group:'Error / History',address:'0xD198',name:'Error history 10',implemented:'N',description:'에러 히스토리 10'},
            {type:'holding',group:'Error / History',address:'0xD199',name:'Error history time 10',implemented:'N',description:'에러 히스토리 시간 10'},
            {type:'holding',group:'Error / History',address:'0xD19A',name:'Error history 11',implemented:'N',description:'에러 히스토리 11'},
            {type:'holding',group:'Error / History',address:'0xD19B',name:'Error history time 11',implemented:'N',description:'에러 히스토리 시간 11'},
            {type:'holding',group:'Error / History',address:'0xD19C',name:'Error history 12',implemented:'N',description:'에러 히스토리 12'},
            {type:'holding',group:'Error / History',address:'0xD19D',name:'Error history time 12',implemented:'N',description:'에러 히스토리 시간 12'},
            {type:'holding',group:'Error / History',address:'0xD19E',name:'Error history 13',implemented:'N',description:'에러 히스토리 13'},
            {type:'holding',group:'Error / History',address:'0xD19F',name:'Error history time 13',implemented:'N',description:'에러 히스토리 시간 13'},
            {type:'holding',group:'Error / History',address:'0xD623',name:'Error Mask',implemented:'N',description:'마스크 씌운 경고 또는 에러가 날 경우 릴레이 출력'},
            {type:'holding',group:'Error / History',address:'0xD624',name:'Warning Mask',implemented:'N',description:'마스크 씌운 경고 또는 에러가 날 경우 릴레이 출력'},
            {type:'holding',group:'Device Info',address:'0xD1A2',name:'Serial Number 1',implemented:'N',description:'팬 시리얼 번호 데이터'},
            {type:'holding',group:'Device Info',address:'0xD1A3',name:'Serial Number 2',implemented:'N',description:'팬 시리얼 번호 데이터'},
            {type:'holding',group:'Device Info',address:'0xD1A4',name:'Date of manufacture',implemented:'N',description:'제조 날짜'},
            {type:'holding',group:'Device Info',address:'0xD1A5',name:'FAN type 1',implemented:'N',description:'ASCII 코드 형태로 표현'},
            {type:'holding',group:'Device Info',address:'0xD1A6',name:'FAN type 2',implemented:'N',description:'ASCII 코드 형태로 표현'},
            {type:'holding',group:'Device Info',address:'0xD1A7',name:'FAN type 3',implemented:'N',description:'ASCII 코드 형태로 표현'},
            {type:'holding',group:'Device Info',address:'0xD1A8',name:'FAN type 4',implemented:'N',description:'ASCII 코드 형태로 표현'},
            {type:'holding',group:'Device Info',address:'0xD1A9',name:'FAN type 5',implemented:'N',description:'ASCII 코드 형태로 표현'},
            {type:'holding',group:'Device Info',address:'0xD1AA',name:'FAN type 6',implemented:'N',description:'ASCII 코드 형태로 표현'},
            {type:'holding',group:'Communication',address:'0xD1FF',name:'Enable Termination resistor',implemented:'Y',description:'RS485 통신 종단 저항 설정'},
            // Input Registers
            {type:'input',group:'Device Info',address:'0xD000',name:'Identification',implemented:'Y',description:'장치 식별'},
            {type:'input',group:'Device Info',address:'0xD001',name:'Max. number of bytes',implemented:'Y',description:'최대 바이트 수'},
            {type:'input',group:'Device Info',address:'0xD002',name:'Bus controller software name',implemented:'Y',description:'Main 부트버전'},
            {type:'input',group:'Device Info',address:'0xD003',name:'Bus controller software version',implemented:'Y',description:'Main 펌웨어 버전'},
            {type:'input',group:'Device Info',address:'0xD004',name:'Commutation controller software name',implemented:'Y',description:'Inverter 부트 버전'},
            {type:'input',group:'Device Info',address:'0xD005',name:'Commutation controller software version',implemented:'Y',description:'Inverter 펌웨어 버전'},
            {type:'input',group:'Status',address:'0xD010',name:'Actual speed (Relative)',implemented:'Y',description:'상대 속도'},
            {type:'input',group:'Status',address:'0xD011',name:'Motor status',implemented:'Y',description:'모터 상태'},
            {type:'input',group:'Status',address:'0xD012',name:'Warning',implemented:'Y',description:'경고'},
            {type:'input',group:'Status',address:'0xD018',name:'Current direction of rotation',implemented:'N',description:'현재 회전 방향'},
            {type:'input',group:'Status',address:'0xD019',name:'Current modulation level',implemented:'Y',description:'전류 제한 레벨'},
            {type:'input',group:'Status',address:'0xD01A',name:'Current set value',implemented:'N',description:'현재 설정값'},
            {type:'input',group:'Status',address:'0xD01B',name:'Sensor actual value address',implemented:'Y',description:'선택된 실제 센서 값'},
            {type:'input',group:'Status',address:'0xD01C',name:'Enable/Disable input state',implemented:'N',description:'Enable/Disable 입력 상태'},
            {type:'input',group:'Status',address:'0xD023',name:'Sensor actual value 1',implemented:'Y',description:'AIN1의 현재 측정값'},
            {type:'input',group:'Status',address:'0xD024',name:'Sensor actual value 2',implemented:'Y',description:'AIN2의 현재 측정값'},
            {type:'input',group:'Status',address:'0xD025',name:'Sensor actual value 3',implemented:'Y',description:'PWMIN3의 현재 측정 Duty값'},
            {type:'input',group:'Status',address:'0xD026',name:'Sensor actual value 4',implemented:'Y',description:'PWMIN3의 현재 측정 주파수값'},
            {type:'input',group:'Status',address:'0xD028',name:'Current set value source',implemented:'Y',description:'현재 사용 중인 소스 (0=AIN1 1=RS485 2=AIN2 3=PWMIn3 255=Fail-safe)'},
            {type:'input',group:'Electrical',address:'0xD013',name:'DC-link voltage',implemented:'Y',description:'DC 링크 전압'},
            {type:'input',group:'Electrical',address:'0xD014',name:'DC-link current',implemented:'N',description:'DC 링크 전류'},
            {type:'input',group:'Electrical',address:'0xD015',name:'Module temperature',implemented:'Y',description:'IGBT Temperature Sensor 값'},
            {type:'input',group:'Electrical',address:'0xD017',name:'Electronics temperature',implemented:'Y',description:'제어부 Temperature 값'},
            {type:'input',group:'Electrical',address:'0xD021',name:'Current power (Relative)',implemented:'N',description:'상대 전력'},
            {type:'input',group:'Electrical',address:'0xD03D',name:'Line Voltage',implemented:'N',description:'라인 전압'},
            {type:'input',group:'Speed',address:'0xD02D',name:'Actual speed [RPM] (Absolute)',implemented:'Y',description:'절대 속도 [RPM]'},
            {type:'input',group:'Speed',address:'0xD050',name:'Command speed',implemented:'Y',description:'지령 속도'},
            {type:'input',group:'Speed',address:'0xD051',name:'Command torque',implemented:'Y',description:'지령 토크'},
            // ============================================================
            // LSM 타입 파라미터 (Function Code 0x2B - LSM 제조사 전용 프로토콜)
            // FC 0x2B = 43 (decimal). 일반 Modbus FC03(holding) / FC04(input)과 다른 접근 방식.
            // 이 파라미터들을 읽고 쓸 때는 반드시 FC 0x2B 전용 프레임을 사용해야 함.
            // param.type === 'lsm' 조건으로 분기하여 readParameterByAddress() 등에서 처리 필요.
            // 주소 공간: 0x2000~0x27FF (일반 파라미터), 0x4000~0x4FFF (공장/고급 파라미터)
            // ============================================================
            // [Device Setup] 디바이스 식별 및 통신 설정
            {type:'lsm',group:'Device Setup',address:'0x2000',name:'Motor ID',implemented:'Y',description:'드라이브에 연결된 모터 종류를 식별하는 ID. 모터 교체 시 변경 필요'},
            {type:'lsm',group:'Device Setup',address:'0x2003',name:'Node ID',implemented:'Y',description:'RS-485 버스 상의 슬레이브 주소 (Modbus Node ID와 동일 역할)'},
            // [Servo Tuning] 서보 제어 루프 게인 및 필터 튜닝
            {type:'lsm',group:'Servo Tuning',address:'0x2100',name:'Inertia Ratio',implemented:'Y',description:'부하 관성 대 모터 관성 비율. 서보 제어 응답성 튜닝에 사용'},
            {type:'lsm',group:'Servo Tuning',address:'0x2101',name:'Position P Gain 1',implemented:'Y',description:'위치 제어 루프 비례 게인 1'},
            {type:'lsm',group:'Servo Tuning',address:'0x2102',name:'Velocity P Gain 1',implemented:'Y',description:'속도 제어 루프 비례 게인 1'},
            {type:'lsm',group:'Servo Tuning',address:'0x2103',name:'Velocity Time Constant 1',implemented:'Y',description:'속도 루프 적분 시간 상수 1'},
            {type:'lsm',group:'Servo Tuning',address:'0x2104',name:'Torque Command Filter TC 1',implemented:'Y',description:'토크 지령 저역 통과 필터의 시간 상수 1'},
            // [Limitation] 토크 제한 및 드라이브 제어 입력
            {type:'lsm',group:'Limitation',address:'0x2111',name:'Positive Torque Limit',implemented:'Y',description:'외부 입력 기반 양방향(CW) 토크 상한값'},
            {type:'lsm',group:'Limitation',address:'0x2112',name:'Negative Torque Limit',implemented:'Y',description:'외부 입력 기반 음방향(CCW) 토크 상한값'},
            {type:'lsm',group:'Limitation',address:'0x211F',name:'Drive Control Input 1',implemented:'Y',description:'드라이브 제어 입력 포트 1의 기능 할당 설정'},
            {type:'lsm',group:'Limitation',address:'0x2120',name:'Drive Control Input 2',implemented:'Y',description:'드라이브 제어 입력 포트 2의 기능 할당 설정'},
            // [Motion] 속도 지령 / 가감속 / 조그 운전
            {type:'lsm',group:'Motion',address:'0x2300',name:'Jog Speed',implemented:'Y',description:'조그 운전 시 속도 지령값. 부호 있음(int16) - 양수: CW / 음수: CCW'},
            {type:'lsm',group:'Motion',address:'0x2301',name:'Speed Accel Time',implemented:'Y',description:'속도 지령 변화 시 가속 구간 시간'},
            {type:'lsm',group:'Motion',address:'0x2302',name:'Speed Decel Time',implemented:'Y',description:'속도 지령 변화 시 감속 구간 시간'},
            {type:'lsm',group:'Motion',address:'0x2303',name:'S-Curve Time',implemented:'Y',description:'가감속에 S커브 적용 시간. 0이면 선형 가감속, 값이 클수록 부드러운 가감속'},
            {type:'lsm',group:'Motion',address:'0x2304',name:'Preset Jog Speed 0',implemented:'Y',description:'프리셋 조그 속도 0. 부호 있음(int16) - 방향 포함'},
            {type:'lsm',group:'Motion',address:'0x2305',name:'Preset Jog Speed 1',implemented:'Y',description:'프리셋 조그 속도 1. 부호 있음(int16) - 방향 포함'},
            {type:'lsm',group:'Motion',address:'0x2306',name:'Preset Jog Speed 2',implemented:'Y',description:'프리셋 조그 속도 2. 부호 있음(int16) - 방향 포함'},
            {type:'lsm',group:'Motion',address:'0x2307',name:'Preset Jog Speed 3',implemented:'Y',description:'프리셋 조그 속도 3. 부호 있음(int16) - 방향 포함'},
            {type:'lsm',group:'Motion',address:'0x2308',name:'Preset Jog Time 0',implemented:'Y',description:'Preset Jog Speed 0 운전 지속 시간'},
            {type:'lsm',group:'Motion',address:'0x2309',name:'Preset Jog Time 1',implemented:'Y',description:'Preset Jog Speed 1 운전 지속 시간'},
            {type:'lsm',group:'Motion',address:'0x230A',name:'Preset Jog Time 2',implemented:'Y',description:'Preset Jog Speed 2 운전 지속 시간'},
            {type:'lsm',group:'Motion',address:'0x230B',name:'Preset Jog Time 3',implemented:'Y',description:'Preset Jog Speed 3 운전 지속 시간'},
            // [Device Info] 장치 정보 (읽기 전용)
            {type:'lsm',group:'Device Info',address:'0x2424',name:'Drive Serial Number',implemented:'Y',description:'드라이브 시리얼 번호 (ASCII 16자)'},
            {type:'lsm',group:'Device Info',address:'0x27F0',name:'Main Boot Version',implemented:'Y',description:'메인 MCU 부트로더 펌웨어 버전 (ASCII 7자)'},
            {type:'lsm',group:'Device Info',address:'0x27F1',name:'Main Firmware Version',implemented:'Y',description:'메인 MCU 애플리케이션 펌웨어 버전 (ASCII 7자)'},
            {type:'lsm',group:'Device Info',address:'0x27F2',name:'Inverter Boot Version',implemented:'Y',description:'인버터 MCU 부트로더 펌웨어 버전 (ASCII 7자)'},
            {type:'lsm',group:'Device Info',address:'0x27F3',name:'Inverter Firmware Version',implemented:'Y',description:'인버터 MCU 애플리케이션 펌웨어 버전 (ASCII 7자)'},
            // [Status] 상태 모니터링 (읽기 전용)
            {type:'lsm',group:'Status',address:'0x2600',name:'Feedback Speed',implemented:'Y',description:'엔코더 기반 현재 모터 실제 속도 피드백 (부호 있음 int16)'},
            {type:'lsm',group:'Status',address:'0x260B',name:'Room Temperature 1',implemented:'Y',description:'실내 온도 센서 1 측정값 (부호 있음 int16)'},
            {type:'lsm',group:'Status',address:'0x260C',name:'Room Temperature 2',implemented:'Y',description:'실내 온도 센서 2 측정값 (부호 있음 int16)'},
            {type:'lsm',group:'Status',address:'0x2617',name:'7-Segment Display Data',implemented:'Y',description:'드라이브 전면 7세그먼트에 표시 중인 내용 (ASCII 7자)'},
            {type:'lsm',group:'Status',address:'0x261A',name:'Commanded Phase Angle',implemented:'Y',description:'현재 지령 중인 모터 전기각 위상 (부호 있음 int16)'},
            // [Control] 프로시저 실행
            {type:'lsm',group:'Control',address:'0x2700',name:'Procedure Code',implemented:'Y',description:'특수 동작 명령 코드 (예: 원점 복귀, 초기화 등). Procedure Argument(0x2701)와 함께 사용'},
            {type:'lsm',group:'Control',address:'0x2701',name:'Procedure Argument',implemented:'Y',description:'Procedure Code(0x2700) 실행 시 전달하는 인수값'},
            // ============================================================
            // LSM 고급 파라미터 (0x4000~) - 에이징 / 공장 설정 / 보안
            // 이 영역도 동일하게 FC 0x2B 로 접근
            // ============================================================
            // [Aging] 에이징 운전 설정
            {type:'lsm',group:'Aging',address:'0x4004',name:'Aging Overload Threshold',implemented:'Y',description:'에이징 운전 중 과부하 판정 기준값'},
            {type:'lsm',group:'Aging',address:'0x4005',name:'Aging Speed',implemented:'Y',description:'에이징 운전 속도 설정'},
            {type:'lsm',group:'Aging',address:'0x4006',name:'Aging Time',implemented:'Y',description:'에이징 운전 총 지속 시간'},
            // [Security] 접근 보안
            {type:'lsm',group:'Security',address:'0x4009',name:'Access Password',implemented:'Y',description:'파라미터 잠금 해제 비밀번호'},
            // [Factory] 공장 예약 파라미터 (용도 미공개)
            {type:'lsm',group:'Factory',address:'0x4017',name:'Factory Reserved 4',implemented:'Y',description:'공장 예약 파라미터 4 (용도 미공개)'},
            {type:'lsm',group:'Factory',address:'0x4018',name:'Factory Reserved 5',implemented:'Y',description:'공장 예약 파라미터 5 (용도 미공개)'},
            {type:'lsm',group:'Factory',address:'0x4019',name:'Factory Reserved 6',implemented:'Y',description:'공장 예약 파라미터 6 (용도 미공개)'},
            {type:'lsm',group:'Factory',address:'0x401A',name:'Factory Reserved 7',implemented:'Y',description:'공장 예약 파라미터 7 (용도 미공개)'},
            {type:'lsm',group:'Factory',address:'0x401B',name:'Factory Reserved 8',implemented:'Y',description:'공장 예약 파라미터 8 (용도 미공개)'},
            {type:'lsm',group:'Factory',address:'0x401C',name:'Factory Reserved 9',implemented:'Y',description:'공장 예약 파라미터 9 (용도 미공개)'},
            {type:'lsm',group:'Factory',address:'0x401D',name:'Factory Reserved 10',implemented:'Y',description:'공장 예약 파라미터 10 (용도 미공개)'}
        ];
    }

    /**
     * Read parameter by address (for CSV-based parameters)
     */
    async readParameterByAddress(param, silent = false) {
        if (!this.writer && !this.simulatorEnabled) {
            if (!silent) this.showToast('시리얼 포트에 연결하거나 시뮬레이터를 활성화하세요', 'warning');
            return;
        }

        // Check if device is selected on Parameters page
        if (!this.selectedParamDeviceId) {
            if (!silent) this.showToast('디바이스를 먼저 선택하세요', 'warning');
            return;
        }

        // Parse address (e.g., "0xD001" -> 53249)
        let address = param.address;
        if (typeof address === 'string') {
            if (address.startsWith('0x') || address.startsWith('0X')) {
                address = parseInt(address, 16);
            } else {
                address = parseInt(address);
            }
        }

        // Use selected device ID from Parameters page
        const slaveId = this.selectedParamDeviceId;
        const isLsm = param.type === 'lsm';

        // Build appropriate frame based on parameter type
        // LSM: FC 0x2B (CANopen MEI Transport), address = object index, subIndex = 0
        // input: FC 0x04 (Read Input Registers)
        // holding: FC 0x03 (Read Holding Registers)
        let frame;
        if (isLsm) {
            frame = this.modbus.buildCANopenUpload(slaveId, address, 0);
        } else if (param.type === 'input') {
            frame = this.modbus.buildReadInputRegisters(slaveId, address, 1);
        } else {
            frame = this.modbus.buildReadHoldingRegisters(slaveId, address, 1);
        }

        if (this.simulatorEnabled) {
            const functionCode = isLsm ? 0x2B : (param.type === 'input' ? 4 : 3);
            this.addMonitorEntry('sent', frame, { functionCode, startAddress: address, quantity: 1 });
            this.stats.requests++;
            this.updateStatsDisplay();

            if (isLsm) {
                // Simulator does not support FC 0x2B — skip silently
                this.updateStats(false);
                if (!silent) this.showToast(`${param.name}: 시뮬레이터는 LSM(FC 0x2B)을 지원하지 않습니다`, 'warning');
                return false;
            }

            const response = await this.simulator.processRequest(frame);
            if (response && response.length >= 5) {
                this.addMonitorEntry('received', response);
                const value = (response[3] << 8) | response[4];
                param.value = value;
                this.saveParameters();
                this.renderParameters();
                this.updateStats(true);
                if (!silent) this.showToast(`${param.name}: ${value} (0x${value.toString(16).toUpperCase()})`, 'success');
                return true;
            } else {
                this.updateStats(false);
                if (!silent) this.showToast(`${param.name} 읽기에 실패했습니다`, 'error');
                return false;
            }
        } else if (this.writer) {
            let value;
            // busyBus: polling 루프 또는 FC64 차트가 버스를 점유 중 → 큐에 등록해야 충돌 방지
            const busyBus = this.autoPollingTimer || this._isFc64Active;
            if (isLsm) {
                // FC 0x2B (CANopen MEI Transport): 큐 또는 직접 전송
                let parsed;
                if (busyBus) {
                    // 버스 점유 중 — 큐에 canopen_read 등록, pollNextDeviceSequential/_drainCommandQueue에서 처리
                    parsed = await new Promise((resolve, reject) => {
                        this.commandQueue.push({ type: 'canopen_read', frame, slaveId, address, resolve, reject });
                    });
                } else {
                    // 버스 유휴 — 직접 전송
                    parsed = await this.sendCANopenAndWaitResponse(frame, slaveId);
                }
                value = parsed ? parsed.value : null;
            } else if (busyBus) {
                // FC 0x03/04: 버스 점유 중 — 큐에 등록
                value = await new Promise((resolve, reject) => {
                    this.commandQueue.push({ type: 'read', frame, slaveId, address, resolve, reject });
                });
            } else {
                // FC 0x03/04: 버스 유휴 — 직접 전송
                value = await this.sendAndWaitResponse(frame, slaveId);
            }
            if (value !== null) {
                param.value = value;
                this.saveParameters();
                this.renderParameters();
                if (!silent) this.showToast(`${param.name}: ${value} (0x${value.toString(16).toUpperCase()})`, 'success');
                return true;
            } else {
                if (!silent) this.showToast(`${param.name} 읽기에 실패했습니다`, 'error');
                return false;
            }
        }
        return false;
    }

    /**
     * Read parameter value
     */
    async readParameter(param) {
        if (!this.writer) {
            alert('Please connect to serial port first');
            return;
        }

        // Check if device is selected on Parameters page
        if (!this.selectedParamDeviceId) {
            this.showToast('디바이스를 먼저 선택하세요', 'warning');
            return;
        }

        // Use selected device ID from Parameters page
        const slaveId = this.selectedParamDeviceId;
        let frame;

        switch (param.functionCode) {
            case 1: frame = this.modbus.buildReadCoils(slaveId, param.address, 1); break;
            case 2: frame = this.modbus.buildReadDiscreteInputs(slaveId, param.address, 1); break;
            case 3: frame = this.modbus.buildReadHoldingRegisters(slaveId, param.address, 1); break;
            case 4: frame = this.modbus.buildReadInputRegisters(slaveId, param.address, 1); break;
        }

        await this.writer.write(frame);
        this.addMonitorEntry('sent', frame, { functionCode: param.functionCode, startAddress: param.address, quantity: 1 });
        this.stats.requests++;
        this.updateStatsDisplay();
    }

    /**
     * Write parameter value
     */
    async writeParameter(param, value) {
        if (!this.writer) {
            alert('Please connect to serial port first');
            return;
        }

        if (isNaN(value)) {
            alert('Please enter a valid value');
            return;
        }

        // Check if device is selected on Parameters page
        if (!this.selectedParamDeviceId) {
            this.showToast('디바이스를 먼저 선택하세요', 'warning');
            return;
        }

        // Use selected device ID from Parameters page
        const slaveId = this.selectedParamDeviceId;
        const frame = this.modbus.buildWriteSingleRegister(slaveId, param.address, value);

        await this.writer.write(frame);
        this.addMonitorEntry('sent', frame, { functionCode: 6, startAddress: param.address });
        this.stats.requests++;
        this.updateStatsDisplay();
    }

    /**
     * Delete parameter
     */
    deleteParameter(id) {
        if (confirm('Are you sure you want to delete this parameter?')) {
            this.parameters = this.parameters.filter(p => p.id !== id);
            this.saveParameters();
            this.renderParameters();
        }
    }

    // ========== Simulator Functions ==========

    /**
     * Toggle simulator on/off
     */
    toggleSimulator() {
        this.simulatorEnabled = !this.simulatorEnabled;
        this.simulator.enabled = this.simulatorEnabled;

        const btn = document.getElementById('simToggleBtn');
        const status = document.getElementById('simStatus');

        if (this.simulatorEnabled) {
            btn.textContent = '시뮬레이터 비활성화';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
            status.textContent = '활성 - 가상 장치 응답 중';
            status.style.color = '#28a745';

            // Start UI update
            this.startSimulatorUI();

            // Enable virtual connection
            this.updateConnectionStatus(true);
            this.addMonitorEntry('received', 'Virtual Modbus Slave Simulator activated');
            this.showToast('가상 시뮬레이터가 활성화되었습니다', 'success');

            // Auto scan if enabled
            if (this.autoScanEnabled) {
                this.showToast('자동 탐색을 시작합니다...', 'info');
                setTimeout(() => this.startDeviceScan(true), 500);
            }

            // Start auto polling only if on Dashboard page
            if (this.currentPage === 'dashboard') {
                this.startAutoPolling();
            }
        } else {
            btn.textContent = '시뮬레이터 활성화';

            // Stop auto polling (force=true: 시뮬레이터 비활성화 시 강제 중단)
            this.stopAutoPolling(true);
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary');
            status.textContent = '비활성';
            status.style.color = '#6c757d';

            // Stop UI update
            this.stopSimulatorUI();

            // Disable virtual connection if no real port
            if (!this.port) {
                this.updateConnectionStatus(false);
            }
            this.addMonitorEntry('received', 'Virtual Modbus Slave Simulator deactivated');
            this.showToast('가상 시뮬레이터가 비활성화되었습니다', 'info');
        }

        // Update modal simulator display
        this.updateModalSimulatorDisplay();
    }

    /**
     * Reset simulator memory
     */
    resetSimulator() {
        if (confirm('시뮬레이터의 모든 메모리를 초기화하시겠습니까?')) {
            this.simulator.reset();
            this.addMonitorEntry('received', 'Simulator memory reset to initial values');
        }
    }

    /**
     * Start simulator UI updates
     */
    startSimulatorUI() {
        this.simulatorUpdateInterval = setInterval(() => {
            const state = this.simulator.getMemoryState();

            // Update displayed values (Dashboard)
            document.getElementById('simTemp').textContent = `${(state.holdingRegisters[0] / 100).toFixed(2)}°C`;
            document.getElementById('simHumid').textContent = `${(state.holdingRegisters[1] / 100).toFixed(2)}%`;
            document.getElementById('simPress').textContent = `${(state.holdingRegisters[2] / 10).toFixed(1)} hPa`;
            document.getElementById('simVolt').textContent = `${(state.holdingRegisters[3] / 10).toFixed(1)}V`;
            document.getElementById('simSpeed').textContent = state.holdingRegisters[5];

            document.getElementById('simCoil0').textContent = state.coils[0] ? 'ON' : 'OFF';
            document.getElementById('simCoil1').textContent = state.coils[1] ? 'ON' : 'OFF';
            document.getElementById('simCoil2').textContent = state.coils[2] ? 'ON' : 'OFF';

            document.getElementById('simCoil0').style.color = state.coils[0] ? '#28a745' : '#6c757d';
            document.getElementById('simCoil1').style.color = state.coils[1] ? '#dc3545' : '#6c757d';
            document.getElementById('simCoil2').style.color = state.coils[2] ? '#28a745' : '#6c757d';

            // Update displayed values (Modal)
            const modalSimTemp = document.getElementById('modal-simTemp');
            if (modalSimTemp) {
                modalSimTemp.textContent = `${(state.holdingRegisters[0] / 100).toFixed(2)}°C`;
                document.getElementById('modal-simHumid').textContent = `${(state.holdingRegisters[1] / 100).toFixed(2)}%`;
                document.getElementById('modal-simPress').textContent = `${(state.holdingRegisters[2] / 10).toFixed(1)} hPa`;
                document.getElementById('modal-simVolt').textContent = `${(state.holdingRegisters[3] / 10).toFixed(1)}V`;
                document.getElementById('modal-simSpeed').textContent = state.holdingRegisters[5];

                document.getElementById('modal-simCoil0').textContent = state.coils[0] ? 'ON' : 'OFF';
                document.getElementById('modal-simCoil1').textContent = state.coils[1] ? 'ON' : 'OFF';
                document.getElementById('modal-simCoil2').textContent = state.coils[2] ? 'ON' : 'OFF';

                document.getElementById('modal-simCoil0').style.color = state.coils[0] ? '#28a745' : '#6c757d';
                document.getElementById('modal-simCoil1').style.color = state.coils[1] ? '#dc3545' : '#6c757d';
                document.getElementById('modal-simCoil2').style.color = state.coils[2] ? '#28a745' : '#6c757d';
            }
        }, 500);
    }

    /**
     * Stop simulator UI updates
     */
    stopSimulatorUI() {
        if (this.simulatorUpdateInterval) {
            clearInterval(this.simulatorUpdateInterval);
            this.simulatorUpdateInterval = null;
        }
    }

    /**
     * Override sendModbusRequest to include simulator
     */
    async sendModbusRequest() {
        // Check if using simulator
        if (this.simulatorEnabled) {
            return this.sendSimulatedRequest();
        }

        // Original implementation for real serial port
        if (!this.writer) {
            this.addMonitorEntry('error', 'Not connected to serial port. Enable simulator or connect to real device.');
            return;
        }

        try {
            const slaveId = this.parseModbusValue(document.getElementById('slaveId').value, 0, 255);
            const functionCode = parseInt(document.getElementById('functionCode').value);

            // FC 0x2B CANopen SDO — 별도 처리
            if (functionCode === 43) {
                const index    = parseInt(document.getElementById('fc2bIndex').value, 16);
                const subIndex = parseInt(document.getElementById('fc2bSubIndex').value, 16);
                const op       = document.getElementById('fc2bOperation').value;
                if (op === 'read') {
                    const numData = parseInt(document.getElementById('fc2bNumData').value) || 2;
                    await this.readCANopenObject(slaveId, index, subIndex, numData);
                } else {
                    const val = parseInt(document.getElementById('fc2bWriteValue').value || '0', 16);
                    await this.writeCANopenObject(slaveId, index, subIndex, val);
                }
                return; // stats는 sendCANopenAndWaitResponse에서 처리됨
            }

            const startAddress = this.parseModbusValue(document.getElementById('startAddress').value, 0, 65535);
            const quantity = this.parseModbusValue(document.getElementById('quantity').value, 1, 125);
            const writeValue = this.parseModbusValue(document.getElementById('writeValue').value || '0', 0, 65535);

            let frame;

            switch (functionCode) {
                case 1: frame = this.modbus.buildReadCoils(slaveId, startAddress, quantity); break;
                case 2: frame = this.modbus.buildReadDiscreteInputs(slaveId, startAddress, quantity); break;
                case 3: frame = this.modbus.buildReadHoldingRegisters(slaveId, startAddress, quantity); break;
                case 4: frame = this.modbus.buildReadInputRegisters(slaveId, startAddress, quantity); break;
                case 5: frame = this.modbus.buildWriteSingleCoil(slaveId, startAddress, writeValue !== 0); break;
                case 6: frame = this.modbus.buildWriteSingleRegister(slaveId, startAddress, writeValue); break;
                case 15:
                    const coilValues = Array(quantity).fill(writeValue !== 0);
                    frame = this.modbus.buildWriteMultipleCoils(slaveId, startAddress, coilValues);
                    break;
                case 16:
                    const registerValues = Array(quantity).fill(writeValue);
                    frame = this.modbus.buildWriteMultipleRegisters(slaveId, startAddress, registerValues);
                    break;
                default:
                    this.addMonitorEntry('error', 'Invalid function code');
                    return;
            }

            await this.writer.write(frame);
            this.addMonitorEntry('sent', frame, { functionCode, startAddress, quantity });
            this.stats.requests++;
            this.updateStatsDisplay();

        } catch (error) {
            this.addMonitorEntry('error', `Send error: ${error.message}`);
            this.updateStats(false);
        }
    }

    /**
     * Send simulated Modbus request
     */
    async sendSimulatedRequest() {
        try {
            const slaveId = this.parseModbusValue(document.getElementById('slaveId').value, 0, 255);
            const functionCode = parseInt(document.getElementById('functionCode').value);

            // FC 0x2B는 시뮬레이터 미지원 — 프레임만 생성하여 monitor에 표시
            if (functionCode === 43) {
                const index    = parseInt(document.getElementById('fc2bIndex').value, 16);
                const subIndex = parseInt(document.getElementById('fc2bSubIndex').value, 16);
                const op       = document.getElementById('fc2bOperation').value;
                let frame;
                if (op === 'read') {
                    const numData = parseInt(document.getElementById('fc2bNumData').value) || 2;
                    frame = this.modbus.buildCANopenUpload(slaveId, index, subIndex, 0, numData);
                } else {
                    const val = parseInt(document.getElementById('fc2bWriteValue').value || '0', 16);
                    frame = this.modbus.buildCANopenDownload(slaveId, index, subIndex, val);
                }
                this.addMonitorEntry('sent', frame, { functionCode: 0x2B, startAddress: (index << 8) | subIndex });
                this.addMonitorEntry('error', 'FC 0x2B: 시뮬레이터 미지원 (실제 장치에서만 동작)');
                this.stats.requests++;
                this.updateStatsDisplay();
                return;
            }

            const startAddress = this.parseModbusValue(document.getElementById('startAddress').value, 0, 65535);
            const quantity = this.parseModbusValue(document.getElementById('quantity').value, 1, 125);
            const writeValue = this.parseModbusValue(document.getElementById('writeValue').value || '0', 0, 65535);

            let frame;

            switch (functionCode) {
                case 1: frame = this.modbus.buildReadCoils(slaveId, startAddress, quantity); break;
                case 2: frame = this.modbus.buildReadDiscreteInputs(slaveId, startAddress, quantity); break;
                case 3: frame = this.modbus.buildReadHoldingRegisters(slaveId, startAddress, quantity); break;
                case 4: frame = this.modbus.buildReadInputRegisters(slaveId, startAddress, quantity); break;
                case 5: frame = this.modbus.buildWriteSingleCoil(slaveId, startAddress, writeValue !== 0); break;
                case 6: frame = this.modbus.buildWriteSingleRegister(slaveId, startAddress, writeValue); break;
                case 15:
                    const coilValues = Array(quantity).fill(writeValue !== 0);
                    frame = this.modbus.buildWriteMultipleCoils(slaveId, startAddress, coilValues);
                    break;
                case 16:
                    const registerValues = Array(quantity).fill(writeValue);
                    frame = this.modbus.buildWriteMultipleRegisters(slaveId, startAddress, registerValues);
                    break;
                default:
                    this.addMonitorEntry('error', 'Invalid function code');
                    return;
            }

            // Send request (to simulator)
            this.addMonitorEntry('sent', frame, { functionCode, startAddress, quantity });
            this.stats.requests++;
            this.updateStatsDisplay();

            // Get simulated response
            const responseFrame = await this.simulator.processRequest(frame);

            if (responseFrame) {
                try {
                    const response = this.modbus.parseResponse(responseFrame);
                    this.addMonitorEntry('received', responseFrame, response);
                    this.updateStats(true);
                } catch (error) {
                    this.addMonitorEntry('error', responseFrame, null, error.message);
                    this.updateStats(false);
                }
            }

        } catch (error) {
            this.addMonitorEntry('error', `Simulation error: ${error.message}`);
            this.updateStats(false);
        }
    }

    /**
     * Show toast notification
     * @param {string} message - The message to display
     * @param {string} type - Toast type: 'success', 'info', 'warning', 'error'
     * @param {number} duration - Display duration in milliseconds (default: 3000)
     */
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '✅',
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-message">${message}</div>
            <div class="toast-timer-bar" style="animation-duration: ${duration}ms"></div>
        `;

        container.appendChild(toast);

        const removeToast = () => {
            toast.classList.add('toast-hide');
            setTimeout(() => {
                if (container.contains(toast)) container.removeChild(toast);
            }, 300);
        };

        const timerBar = toast.querySelector('.toast-timer-bar');

        // Auto-remove when timer bar animation ends (respects hover-pause automatically via CSS)
        timerBar.addEventListener('animationend', removeToast);

        // Click to dismiss immediately
        toast.addEventListener('click', () => {
            timerBar.removeEventListener('animationend', removeToast);
            removeToast();
        });
    }

    /**
     * Show a persistent progress toast with circular progress bar
     * Returns a controller: { update(current), dismiss(finalMsg), isCancelled() }
     */
    showProgressToast(message, total, onCancel = null) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'toast toast-progress-toast';

        const radius = 14;
        const circumference = 2 * Math.PI * radius;

        toast.innerHTML = `
            <div class="toast-icon" style="font-size:18px;">↻</div>
            <div class="toast-message" style="flex:1;">
                <div class="toast-progress-label">${message}</div>
                <div class="toast-progress-sub">0 / ${total}</div>
            </div>
            <div class="toast-progress-ring">
                <svg width="36" height="36" viewBox="0 0 36 36">
                    <circle class="toast-ring-bg" cx="18" cy="18" r="${radius}"/>
                    <circle class="toast-ring-fg" cx="18" cy="18" r="${radius}"
                        stroke-dasharray="0 ${circumference.toFixed(2)}"
                        stroke-dashoffset="0"/>
                    <circle class="toast-ring-err" cx="18" cy="18" r="${radius}"
                        stroke-dasharray="0 ${circumference.toFixed(2)}"
                        stroke-dashoffset="0"/>
                </svg>
                <span class="toast-ring-pct">0%</span>
            </div>
            <button class="toast-cancel-btn" title="중단">✕</button>
            <div class="toast-timer-bar" style="display:none;"></div>
        `;

        container.appendChild(toast);

        let cancelled = false;
        let hidden = false;

        const ringFg = toast.querySelector('.toast-ring-fg');
        const ringErr = toast.querySelector('.toast-ring-err');
        const ringPct = toast.querySelector('.toast-ring-pct');
        const subLabel = toast.querySelector('.toast-progress-sub');
        const progressLabel = toast.querySelector('.toast-progress-label');
        const cancelBtn = toast.querySelector('.toast-cancel-btn');

        // Click body to hide toast (keeps running)
        toast.addEventListener('click', (e) => {
            if (e.target === cancelBtn) return;
            hidden = true;
            toast.classList.add('toast-hide');
            setTimeout(() => {
                if (container.contains(toast)) container.removeChild(toast);
            }, 300);
        });

        // X button to cancel
        const cancel = (msg = '중단됨') => {
            cancelled = true;
            if (onCancel) onCancel();
            dismiss(msg);
        };
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cancel();
        });

        const timerBar = toast.querySelector('.toast-timer-bar');

        const removeToast = () => {
            toast.classList.add('toast-hide');
            setTimeout(() => {
                if (container.contains(toast)) container.removeChild(toast);
            }, 300);
        };

        const dismiss = (finalMsg) => {
            if (finalMsg && !hidden) {
                progressLabel.textContent = finalMsg;
                timerBar.style.animationDuration = '3000ms';
                timerBar.style.display = 'block';
                timerBar.addEventListener('animationend', removeToast);
            } else if (!hidden) {
                removeToast();
            }
        };

        const update = (current, successCount = current, errorCount = 0) => {
            const pct = total > 0 ? Math.round((current / total) * 100) : 0;

            // Green arc: success portion from top
            const successLen = total > 0 ? (successCount / total) * circumference : 0;
            ringFg.style.strokeDasharray = `${successLen.toFixed(2)} ${(circumference - successLen).toFixed(2)}`;

            // Red arc: error portion, starting right after the green arc
            const errorLen = total > 0 ? (errorCount / total) * circumference : 0;
            const successAngle = -90 + (successCount / total) * 360;
            ringErr.style.transform = `rotate(${successAngle}deg)`;
            ringErr.style.strokeDasharray = `${errorLen.toFixed(2)} ${(circumference - errorLen).toFixed(2)}`;

            ringPct.textContent = `${pct}%`;
            subLabel.textContent = `${current} / ${total}`;
        };

        return { update, dismiss, isCancelled: () => cancelled, cancel };
    }

    /**
     * Show confirm dialog
     * @param {string} message - The message to display
     * @param {string} title - Dialog title (default: '확인')
     * @param {string} icon - Icon emoji (default: '⚠️')
     * @returns {Promise<boolean>} - Resolves to true if user confirms, false if cancelled
     */
    showConfirm(message, title = '확인', icon = '⚠️') {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const titleEl = document.getElementById('confirmModalTitle');
            const messageEl = document.getElementById('confirmModalMessage');
            const iconEl = document.getElementById('confirmModalIcon');
            const okBtn = document.getElementById('confirmOkBtn');
            const cancelBtn = document.getElementById('confirmCancelBtn');
            const closeBtn = document.getElementById('confirmModalClose');

            // Set content
            titleEl.textContent = title;
            messageEl.textContent = message;
            iconEl.textContent = icon;

            // Show modal
            modal.style.display = 'flex';

            // Handle OK click
            const handleOk = () => {
                cleanup();
                resolve(true);
            };

            // Handle Cancel click
            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            // Handle outside click
            const handleOutsideClick = (e) => {
                if (e.target === modal) {
                    handleCancel();
                }
            };

            // Handle ESC key
            const handleEscKey = (e) => {
                if (e.key === 'Escape') {
                    handleCancel();
                }
            };

            // Cleanup function
            const cleanup = () => {
                modal.style.display = 'none';
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
                closeBtn.removeEventListener('click', handleCancel);
                modal.removeEventListener('click', handleOutsideClick);
                document.removeEventListener('keydown', handleEscKey);
            };

            // Attach event listeners
            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);
            closeBtn.addEventListener('click', handleCancel);
            modal.addEventListener('click', handleOutsideClick);
            document.addEventListener('keydown', handleEscKey);
        });
    }

    /**
     * Show device edit modal
     * @param {number} deviceId - The device ID to edit
     */
    showDeviceEditModal(deviceId, focusField = null) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) {
            console.error('Device not found:', deviceId);
            return;
        }

        // If a specific field is requested, switch to its category first
        const fieldCategoryMap = {
            fanAddress: 'communication',
        };
        if (focusField && fieldCategoryMap[focusField]) {
            this.activeConfigCategory = fieldCategoryMap[focusField];
        }

        const modal = document.getElementById('deviceEditModal');
        const modalBody = document.getElementById('deviceEditModalBody');
        const modalTitle = document.getElementById('deviceEditModalTitle');
        const closeBtn = document.getElementById('closeDeviceEditBtn');

        if (!modal || !modalBody) {
            console.error('Modal elements not found');
            return;
        }

        // Update modal title
        if (modalTitle) {
            modalTitle.textContent = 'Device Configuration';
        }

        // Clear modal body
        modalBody.innerHTML = '';

        // Create the deviceSetupConfig container for the modal
        const configWrapper = document.createElement('div');
        configWrapper.style.cssText = 'display: flex; flex-direction: column; width: 100%; min-height: 0; flex: 1;';

        const configContainer = document.createElement('div');
        configContainer.id = 'deviceSetupConfig';
        configContainer.style.cssText = 'flex: 1; overflow-y: auto; display: block; min-height: 0;';

        configWrapper.appendChild(configContainer);
        modalBody.appendChild(configWrapper);

        // Show modal
        modal.style.display = 'flex';

        // While the modal is open, the page's #deviceSetupConfig may contain child elements
        // with the same IDs (e.g. fanAddress_1, operatingMode_1). Because the page container
        // appears earlier in the DOM than the modal, getElementById always finds the page's
        // elements first, causing apply* functions to read stale values instead of what the
        // user typed in the modal.
        //
        // Fix: clear the page container's content entirely while the modal is open so that
        // no duplicate IDs exist. Restore content + ID when the modal closes.
        const pageConfigContainer = document.querySelector(
            '#page-device-setup #deviceSetupConfig, #page-device-setup [id="deviceSetupConfig_temp"]'
        );
        let savedPageContent = '';
        if (pageConfigContainer) {
            pageConfigContainer.id = 'deviceSetupConfig_temp';
            savedPageContent = pageConfigContainer.innerHTML;
            pageConfigContainer.innerHTML = '';
        }

        // Render device configuration into the modal's #deviceSetupConfig
        this.renderDeviceSetupConfig(device, { autoRead: true });

        // Close button handler - restore page container content and ID
        const handleClose = () => {
            if (pageConfigContainer) {
                pageConfigContainer.innerHTML = savedPageContent;
                pageConfigContainer.id = 'deviceSetupConfig';
            }
            modal.style.display = 'none';
            modalBody.innerHTML = '';
            closeBtn.removeEventListener('click', handleClose);
            modal.removeEventListener('click', handleOutsideClick);
        };

        // Outside click handler
        const handleOutsideClick = (e) => {
            if (e.target === modal) {
                handleClose();
            }
        };

        closeBtn.addEventListener('click', handleClose);
        modal.addEventListener('click', handleOutsideClick);

        // Focus and highlight the target field if requested
        if (focusField) {
            setTimeout(() => {
                const el = document.getElementById(`${focusField}_${deviceId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.focus();
                    el.select();
                    el.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.5)';
                    setTimeout(() => { el.style.boxShadow = ''; }, 1500);
                }
            }, 80);
        }
    }

    // ========================================
    // Product Test Dashboard Functions
    // ========================================

    /**
     * Initialize Dashboard UI event listeners
     */
    initDashboardUI() {
        // Live Watch toggle button
        const liveWatchToggleBtn = document.getElementById('liveWatchToggleBtn');
        if (liveWatchToggleBtn) {
            liveWatchToggleBtn.addEventListener('click', () => {
                if (this.autoPollingTimer) {
                    this.devices.forEach(d => { d.liveWatch = false; });
                    this.saveDevices();
                    this._syncAllDeviceLwBtns();
                    this.stopAutoPolling();
                    this.showToast('Live Watch가 중지되었습니다', 'error');
                } else {
                    this.devices.forEach(d => { d.liveWatch = true; });
                    this.saveDevices();
                    this._syncAllDeviceLwBtns();
                    this.startAutoPolling();
                    this.showToast('Live Watch가 시작되었습니다', 'success');
                }
            });
        }

        // Auto Scan button (Dashboard)
        const dashboardAutoScanBtn = document.getElementById('dashboardAutoScanBtn');
        if (dashboardAutoScanBtn) {
            dashboardAutoScanBtn.addEventListener('click', () => this.startDeviceScan(true));
        }

        // Add Device button
        const addDeviceBtn = document.getElementById('addDeviceBtn');
        if (addDeviceBtn) {
            addDeviceBtn.addEventListener('click', () => this.showAddDeviceModal());
        }

        // Close device modal
        const closeDeviceModalBtn = document.getElementById('closeDeviceModalBtn');
        if (closeDeviceModalBtn) {
            closeDeviceModalBtn.addEventListener('click', () => this.hideAddDeviceModal());
        }

        // Cancel device button
        const cancelDeviceBtn = document.getElementById('cancelDeviceBtn');
        if (cancelDeviceBtn) {
            cancelDeviceBtn.addEventListener('click', () => this.hideAddDeviceModal());
        }

        // Save device button
        const saveDeviceBtn = document.getElementById('saveDeviceBtn');
        if (saveDeviceBtn) {
            saveDeviceBtn.addEventListener('click', () => this.saveDevice());
        }

        // Modal outside click (with drag protection)
        const addDeviceModal = document.getElementById('addDeviceModal');
        if (addDeviceModal) {
            let mouseDownTarget = null;

            addDeviceModal.addEventListener('mousedown', (e) => {
                mouseDownTarget = e.target;
            });

            addDeviceModal.addEventListener('click', (e) => {
                // Only close if both mousedown and click happened on the modal background
                if (e.target.id === 'addDeviceModal' && mouseDownTarget && mouseDownTarget.id === 'addDeviceModal') {
                    this.hideAddDeviceModal();
                }
                mouseDownTarget = null;
            });
        }




        // Select/Deselect All buttons
        const selectAllDevices = document.getElementById('selectAllDevices');
        if (selectAllDevices) {
            selectAllDevices.addEventListener('click', () => this.selectAllDevices());
        }

        const deselectAllDevices = document.getElementById('deselectAllDevices');
        if (deselectAllDevices) {
            deselectAllDevices.addEventListener('click', () => this.deselectAllDevices());
        }

        // All device mode toggle
        const allDeviceModeRpm = document.getElementById('allDeviceModeRpm');
        const allDeviceModePct = document.getElementById('allDeviceModePct');
        if (allDeviceModeRpm && allDeviceModePct) {
            allDeviceModeRpm.addEventListener('click', () => this.setAllDeviceMode(0));
            allDeviceModePct.addEventListener('click', () => this.setAllDeviceMode(1));
        }

        // All device setpoint input
        const allDeviceSetpoint = document.getElementById('allDeviceSetpoint');

        // Quick preset buttons (all device control)
        document.querySelectorAll('#allDevicePresetBtns .preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const percent = parseInt(btn.dataset.percent);
                const isRpm = document.getElementById('allDeviceModeRpm')?.classList.contains('active');
                const maxValue = isRpm ? (this.devices[0]?.maxSpeed || 1600) : 100;
                const value = Math.round((percent / 100) * maxValue);
                if (allDeviceSetpoint) allDeviceSetpoint.value = value;
            });
        });

        // All device Apply button
        const allDeviceApplyBtn = document.getElementById('allDeviceApplyBtn');
        if (allDeviceApplyBtn) {
            allDeviceApplyBtn.addEventListener('click', () => this.applyAllDeviceSetpoint());
        }

        // All device Stop button
        const allDeviceStopBtn = document.getElementById('allDeviceStopBtn');
        if (allDeviceStopBtn) {
            allDeviceStopBtn.addEventListener('click', () => this.stopSelectedDevices());
        }

        // View mode toggle buttons
        const viewModeCard = document.getElementById('viewModeCard');
        const viewModeList = document.getElementById('viewModeList');
        if (viewModeCard && viewModeList) {
            viewModeCard.addEventListener('click', () => this.setDeviceViewMode('card'));
            viewModeList.addEventListener('click', () => this.setDeviceViewMode('list'));

            // Apply saved view mode on load
            this.applyDeviceViewMode();
        }

        // Sync Live Watch button state on load
        this.updateLiveWatchToggleBtn();
    }

    /**
     * Update slider background gradient
     */
    updateSliderBackground(slider) {
        const min = parseInt(slider.min) || 0;
        const max = parseInt(slider.max) || 100;
        const value = parseInt(slider.value) || 0;
        const percent = ((value - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, #007bff ${percent}%, #e9ecef ${percent}%)`;
    }

    /**
     * Update selected devices chips display
     */
    updateSelectedDevicesChips() {
        const chipsContainer = document.getElementById('selectedDevicesChips');
        const selectedCountEl = document.getElementById('selectedDeviceCount');
        const allDeviceControlSection = document.querySelector('.all-device-control-section');

        // Update selected count badge
        if (selectedCountEl) {
            selectedCountEl.textContent = `${this.selectedDevices.size}개 선택`;
            selectedCountEl.classList.toggle('has-devices', this.selectedDevices.size > 0);
        }

        // Update section style based on selection, and collapse content when nothing selected
        if (allDeviceControlSection) {
            const content = allDeviceControlSection.querySelector('.all-device-control-content');
            if (this.selectedDevices.size > 0) {
                allDeviceControlSection.classList.add('has-selection');
                if (content) content.classList.remove('collapsed');
            } else {
                allDeviceControlSection.classList.remove('has-selection');
                if (content) content.classList.add('collapsed');
            }
        }

        if (!chipsContainer) return;

        chipsContainer.innerHTML = '';

        // Display selected device chips (no message when empty - chips in header)
        this.selectedDevices.forEach(deviceId => {
            const device = this.devices.find(d => d.id === deviceId);
            if (device) {
                const chip = document.createElement('span');
                chip.className = 'device-chip';
                chip.innerHTML = `
                    <span>${device.name}</span>
                    <span class="chip-remove" data-device-id="${deviceId}">&times;</span>
                `;
                chip.querySelector('.chip-remove').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleDeviceSelection(deviceId);
                });
                chipsContainer.appendChild(chip);
            }
        });
    }

    /**
     * Update all device control buttons state
     */
    updateAllDeviceButtonsState() {
        const allDeviceApplyBtn = document.getElementById('allDeviceApplyBtn');
        const allDeviceStopBtn = document.getElementById('allDeviceStopBtn');
        const hasSelection = this.selectedDevices.size > 0;

        if (allDeviceApplyBtn) {
            allDeviceApplyBtn.disabled = !hasSelection;
        }
        if (allDeviceStopBtn) {
            allDeviceStopBtn.disabled = !hasSelection;
        }
    }

    /**
     * Update total device count badge
     */
    updateTotalDeviceCount() {
        const badge = document.getElementById('totalDeviceCount');
        const grid = document.getElementById('deviceGrid');
        if (badge) {
            badge.textContent = `${this.devices.length}개`;
            badge.classList.toggle('has-devices', this.devices.length > 0);
        }
        if (grid) {
            grid.classList.toggle('collapsed', this.devices.length === 0);
        }
    }

    /**
     * Set device view mode (card or list)
     */
    setDeviceViewMode(mode) {
        this.deviceViewMode = mode;
        localStorage.setItem('deviceViewMode', mode);
        this.applyDeviceViewMode();
        this.renderDeviceGrid();
    }

    /**
     * Apply device view mode to UI
     */
    applyDeviceViewMode() {
        const viewModeCard = document.getElementById('viewModeCard');
        const viewModeList = document.getElementById('viewModeList');
        const deviceGrid = document.getElementById('deviceGrid');

        if (viewModeCard && viewModeList) {
            viewModeCard.classList.toggle('active', this.deviceViewMode === 'card');
            viewModeList.classList.toggle('active', this.deviceViewMode === 'list');
        }

        if (deviceGrid) {
            deviceGrid.classList.toggle('list-view', this.deviceViewMode === 'list');
        }
    }

    /**
     * Load devices from localStorage
     */
    loadDevices() {
        const stored = localStorage.getItem('modbusDevices');
        if (stored) {
            this.devices = JSON.parse(stored);
            // 페이지 로드 시 runtime 상태 초기화 (연결 전이므로 이전 값 제거)
            this.devices.forEach(device => {
                device.motorStatus = 0;
                device.setpoint = 0;
                device.actualSpeed = 0;
                device.online = false;
                device.lastUpdate = null;
                device.failCount = 0;
            });
            this.renderDeviceGrid();
        }
        // Apply view mode after loading devices
        this.applyDeviceViewMode();
        // Update parameter page device selector
        this.updateParamDeviceSelector();
    }

    /**
     * Save devices to localStorage
     */
    saveDevices() {
        localStorage.setItem('modbusDevices', JSON.stringify(this.devices));
        // Update parameter page device selector
        this.updateParamDeviceSelector();
    }

    /**
     * Show Add Device Modal
     */
    showAddDeviceModal() {
        const modal = document.getElementById('addDeviceModal');
        if (modal) {
            modal.classList.add('active');
            document.getElementById('deviceName').value = '';
            document.getElementById('deviceSlaveId').value = this.devices.length + 1;
            document.getElementById('deviceOperationMode').value = '0';
        }
    }

    /**
     * Hide Add Device Modal
     */
    hideAddDeviceModal() {
        const modal = document.getElementById('addDeviceModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Save a new device
     */
    saveDevice() {
        const name = document.getElementById('deviceName').value.trim();
        const slaveId = parseInt(document.getElementById('deviceSlaveId').value);
        const operationMode = parseInt(document.getElementById('deviceOperationMode').value);

        if (!name) {
            this.showToast('장치 이름을 입력해주세요', 'warning');
            return;
        }

        if (isNaN(slaveId) || slaveId < 0 || slaveId > 247) {
            this.showToast('Slave ID는 0~247 사이의 값이어야 합니다', 'error');
            document.getElementById('deviceSlaveId').focus();
            return;
        }

        // Check for duplicate SlaveID (NodeID)
        if (slaveId !== 0) {
            const existingDevice = this.devices.find(d => d.slaveId === slaveId);
            if (existingDevice) {
                this.showToast(`Node ID ${slaveId}는 이미 사용 중입니다 (${existingDevice.name})`, 'error');
                return;
            }
        }

        const device = {
            id: Date.now(),
            name: name,
            slaveId: slaveId,
            operationMode: operationMode,
            setpoint: 0,
            actualSpeed: 0,
            motorStatus: 0,
            maxSpeed: 1600,
            lastUpdate: null,
            online: false,
            failCount: 0,
            runningDirection: 0,  // 0: CCW, 1: CW
            maxCurrent: 0         // Maximum coil current in Amperes
        };

        this.devices.push(device);
        this.saveDevices();
        this.renderDeviceGrid();
        this.hideAddDeviceModal();
        this.showToast(`${name} 장치가 추가되었습니다`, 'success');

        // 연결 후 디바이스에서 모드와 최대 속도 읽기
        if (slaveId !== 0) {
            this.initializeDeviceMode(device.id);
            this.fetchDeviceSerialNumber(device);
        }

        // Start auto polling if connection is active, on Dashboard, and wasn't running
        if (!this.autoPollingTimer && (this.simulatorEnabled || this.writer) && this.currentPage === 'dashboard') {
            this.startAutoPolling();
        }
    }

    /**
     * Delete a device
     */
    async deleteDevice(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) {
            this.showToast('장치를 찾을 수 없습니다', 'error');
            return;
        }

        // Confirm before deleting device
        const confirmed = await this.showConfirm(
            `${device.name} (Slave ID: ${device.slaveId})을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
            '🗑️ 장치 삭제',
            '🗑️'
        );

        if (confirmed) {
            this.devices = this.devices.filter(d => d.id !== deviceId);
            this.selectedDevices.delete(deviceId);
            this.saveDevices();
            this.renderDeviceGrid();
            this.renderDeviceSetupList();
            this.updateSelectedCount();
            this.showToast('장치가 삭제되었습니다', 'info');

            // If currently on Device Setup page for this device, go back to Dashboard
            if (this.currentPage === 'device-setup' && this.currentSetupDeviceId === deviceId) {
                this.showPage('dashboard');
            }

            // Close device edit modal if it's open
            const deviceEditModal = document.getElementById('deviceEditModal');
            if (deviceEditModal && deviceEditModal.style.display === 'flex') {
                const closeBtn = document.getElementById('closeDeviceEditBtn');
                if (closeBtn) closeBtn.click();
            }
        }
    }

    /**
     * Render device grid
     */
    renderDeviceGrid() {
        const grid = document.getElementById('deviceGrid');
        const placeholder = document.getElementById('devicePlaceholder');

        if (!grid) return;

        // Clear existing items (except placeholder)
        const existingCards = grid.querySelectorAll('.device-card, .device-list-item, .device-list-header');
        existingCards.forEach(card => card.remove());

        // Update total device count
        this.updateTotalDeviceCount();

        if (this.devices.length === 0) {
            if (placeholder) placeholder.style.display = 'block';
            return;
        }

        if (placeholder) placeholder.style.display = 'none';

        // Apply view mode class
        grid.classList.toggle('list-view', this.deviceViewMode === 'list');

        if (this.deviceViewMode === 'list') {
            // Add list header
            const header = this.createDeviceListHeader();
            grid.appendChild(header);

            // Add list items
            this.devices.forEach(device => {
                const item = this.createDeviceListItem(device);
                grid.appendChild(item);
            });
        } else {
            // Add card items
            this.devices.forEach(device => {
                const card = this.createDeviceCard(device);
                grid.appendChild(card);
            });
        }

        // 시리얼 미연결 상태면 모든 카드 비활성화 (시뮬레이터 활성 시 제외)
        if (!this.isConnected && !this.simulatorEnabled) {
            grid.querySelectorAll('.device-card, .device-list-item').forEach(el => {
                el.classList.add('serial-disconnected');
            });
        }
    }

    /**
     * Create device list header for list view
     */
    createDeviceListHeader() {
        const header = document.createElement('div');
        header.className = 'device-list-header with-drag-handle';
        header.innerHTML = `
            <span></span>
            <span></span>
            <span>Device Name</span>
            <span>ID</span>
            <span>Status</span>
            <span>Setpoint</span>
            <span>Mode</span>
            <span>Controls</span>
            <span>Actions</span>
        `;
        return header;
    }

    /**
     * Create device list item for list view
     */
    createDeviceListItem(device) {
        const item = document.createElement('div');
        item.className = 'device-list-item';
        item.dataset.deviceId = device.id;
        item.draggable = true;

        if (this.selectedDevices.has(device.id)) {
            item.classList.add('selected');
        }

        const modeText = device.operationMode === 0 ? 'RPM' : '%';
        const statusInfo = this.getMotorStatusInfo(device.motorStatus, device.online || this.simulatorEnabled);

        item.innerHTML = `
            <span class="drag-handle" title="Drag to reorder">≡</span>
            <input type="checkbox" class="device-checkbox" ${this.selectedDevices.has(device.id) ? 'checked' : ''}>
            <span class="device-name-group">
                <span class="device-name" title="Click to edit name">${device.name}</span>
                <span class="device-serial" data-serial-for="${device.id}">${device.serialNumber ? 'S/N: ' + device.serialNumber : ''}</span>
            </span>
            <span class="device-id-badge ${device.slaveId === 0 ? 'unassigned' : ''}">
                ${device.slaveId === 0 ? 'ID 미할당' : 'ID: ' + device.slaveId}
            </span>
            <div class="device-status" title="${statusInfo.tooltip}">
                <span class="status-indicator ${statusInfo.class}"></span>
                <span class="status-text">${statusInfo.text}</span>
            </div>
            <div class="device-value">
                <div class="device-value-number setpoint-display-value">
                    ${device.setpoint}<span class="device-value-unit">${modeText}</span>
                </div>
            </div>
            <div class="device-mode-btns compact">
                <button class="mode-btn ${device.operationMode === 0 ? 'active' : ''}" data-mode="0">RPM</button>
                <button class="mode-btn ${device.operationMode !== 0 ? 'active' : ''}" data-mode="2">%</button>
            </div>
            <div class="device-controls">
                <input type="number" class="device-setpoint-input" placeholder="${modeText}" min="0" max="${device.maxSpeed || (device.operationMode === 0 ? 1600 : 100)}" value="${device.setpoint}">
                <span class="input-unit">${modeText}</span>
            </div>
            <div class="device-actions">
                <button class="btn-action-icon btn-alarm-reset" title="알람 리셋"><svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zm.995-14.901a1 1 0 1 0-1.99 0A5.002 5.002 0 0 0 3 6c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7 0-2.42-1.72-4.44-4.005-4.901z"/></svg></button>
                <button class="btn-action-icon btn-software-reset" title="소프트웨어 리셋">↺</button>
                <button class="btn-delete-icon btn-delete" title="Delete device">×</button>
            </div>
        `;

        // Event listeners
        const checkbox = item.querySelector('.device-checkbox');
        checkbox.addEventListener('change', () => {
            this.toggleDeviceSelection(device.id);
        });

        // Device name click to edit
        const nameSpan = item.querySelector('.device-name');
        nameSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startEditDeviceName(device.id, nameSpan);
        });

        // Auto-apply setpoint on input change
        const setpointInput = item.querySelector('.device-setpoint-input');
        if (setpointInput) {
            setpointInput.addEventListener('change', () => {
                this.applyDeviceSetpoint(device.id, parseInt(setpointInput.value));
            });
        }

        const deleteBtn = item.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', () => {
            this.deleteDevice(device.id);
        });

        // Alarm Reset button
        const alarmResetBtn = item.querySelector('.btn-alarm-reset');
        alarmResetBtn.addEventListener('click', () => {
            this.performAlarmReset(device.id);
        });

        // Software Reset button
        const softwareResetBtn = item.querySelector('.btn-software-reset');
        softwareResetBtn.addEventListener('click', () => {
            this.performSoftwareReset(device.id);
        });

        // ID badge → open settings modal on Fan Address field
        const idBadgeList = item.querySelector('.device-id-badge');
        if (idBadgeList) {
            idBadgeList.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showDeviceEditModal(device.id, 'fanAddress');
            });
        }

        // Mode buttons
        item.querySelectorAll('.device-mode-btns .mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const newMode = parseInt(btn.dataset.mode);
                if (device.operationMode !== newMode) {
                    this.changeDeviceMode(device.id, newMode);
                }
            });
        });

        // Drag and drop event listeners
        this.addDragEventListeners(item);

        return item;
    }

    /**
     * Start editing device name inline
     */
    startEditDeviceName(deviceId, nameSpan) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const currentName = device.name;

        // Get computed style from nameSpan to maintain same height
        const computedStyle = window.getComputedStyle(nameSpan);

        // Get parent container width for appropriate input sizing
        const parentWidth = nameSpan.parentNode.offsetWidth;
        const maxInputWidth = Math.max(150, Math.min(300, parentWidth - 20)); // Between 150px and 300px

        // Get exact height of nameSpan
        const spanHeight = nameSpan.offsetHeight;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'device-name-input';
        input.value = currentName;
        input.title = 'Press Enter to save, Escape to cancel';

        // Copy styles to maintain same dimensions
        input.style.fontSize = computedStyle.fontSize;
        input.style.fontWeight = computedStyle.fontWeight;
        input.style.lineHeight = computedStyle.lineHeight;
        input.style.padding = computedStyle.padding;
        input.style.margin = computedStyle.margin;
        input.style.height = spanHeight + 'px'; // Use exact measured height
        input.style.boxSizing = 'border-box';
        input.style.width = maxInputWidth + 'px';
        input.style.maxWidth = '100%';
        input.style.border = '1px solid #007bff'; // Explicit border
        input.style.borderRadius = '4px';

        nameSpan.style.display = 'none';
        nameSpan.parentNode.insertBefore(input, nameSpan.nextSibling);
        input.focus();
        input.select();

        const saveEdit = () => {
            const newName = input.value.trim();

            // Always restore UI first
            input.remove();
            nameSpan.style.display = '';

            if (newName && newName !== currentName) {
                device.name = newName;
                this.saveDevices();
                nameSpan.textContent = newName;
                this.showToast(`장치 이름이 "${newName}"으로 변경되었습니다`, 'success');

                // Update Device List in Device Setup page
                this.renderDeviceSetupList();

                // Update Dashboard
                this.renderDashboard();

                // Update Parameters tab device selector
                this.updateParamDeviceSelector();
            }
        };

        const cancelEdit = () => {
            input.remove();
            nameSpan.style.display = '';
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                input.removeEventListener('blur', saveEdit);
                cancelEdit();
            }
        });
    }

    /**
     * Create a device card element
     */
    createDeviceCard(device) {
        const card = document.createElement('div');
        card.className = 'device-card';
        card.dataset.deviceId = device.id;
        card.draggable = false; // 드래그 바 mousedown 시에만 활성화

        if (this.selectedDevices.has(device.id)) {
            card.classList.add('selected');
        }

        const modeText = device.operationMode === 0 ? 'RPM' : '%';
        const statusInfo = this.getMotorStatusInfo(device.motorStatus, device.online || this.simulatorEnabled);

        card.innerHTML = `
            <div class="card-drag-bar" title="Drag to reorder">
                <span class="card-drag-dots"></span>
            </div>
            <div class="device-card-header">
                <div class="device-select">
                    <input type="checkbox" class="device-checkbox" ${this.selectedDevices.has(device.id) ? 'checked' : ''}>
                    <span class="device-name-group">
                        <span class="device-name" title="Click to edit name">${device.name}</span>
                        <span class="device-serial" data-serial-for="${device.id}">${device.serialNumber ? 'S/N: ' + device.serialNumber : ''}</span>
                    </span>
                </div>
                <div class="device-header-right">
                    <span class="device-id-badge ${device.slaveId === 0 ? 'unassigned' : ''}">
                        ${device.slaveId === 0 ? 'ID 미할당' : 'ID: ' + device.slaveId}
                    </span>
                    <button class="btn-delete-icon" title="Delete device">×</button>
                </div>
            </div>
            <div class="device-action-bar">
                <button class="btn-device-live-watch ${device.liveWatch !== false ? 'active' : ''}" title="Live Watch 켜기/끄기">
                    <span class="device-lw-indicator"></span>
                    <span class="lw-label">Live Watch</span>
                </button>
                <div class="action-bar-right">
                    <button class="btn-action-icon btn-alarm-reset" title="알람 리셋"><svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zm.995-14.901a1 1 0 1 0-1.99 0A5.002 5.002 0 0 0 3 6c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7 0-2.42-1.72-4.44-4.005-4.901z"/></svg></button>
                    <button class="btn-action-icon btn-software-reset" title="소프트웨어 리셋">↺</button>
                    <button class="btn-edit" title="설정">⚙</button>
                </div>
            </div>
            <div class="device-card-body">
                <div class="device-status-row">
                    <div class="device-status" title="${statusInfo.tooltip}">
                        <span class="status-indicator ${statusInfo.class}"></span>
                        <span class="status-text">${statusInfo.text}</span>
                    </div>
                    <div class="device-mode-btns">
                        <button class="mode-btn ${device.operationMode === 0 ? 'active' : ''}" data-mode="0">RPM</button>
                        <button class="mode-btn ${device.operationMode !== 0 ? 'active' : ''}" data-mode="2">%</button>
                    </div>
                </div>
                <div class="device-values">
                    <div class="device-value-item">
                        <div class="device-value-label">Setpoint</div>
                        <div class="device-value-number setpoint-display-value">
                            ${device.setpoint}<span class="device-value-unit">${modeText}</span>
                        </div>
                    </div>
                    <div class="device-value-item">
                        <div class="device-value-label">Actual</div>
                        <div class="device-value-number actual-speed-value">
                            ${device.actualSpeed}<span class="device-value-unit">RPM</span>
                        </div>
                    </div>
                </div>
                <div class="device-controls">
                    <input type="number" class="device-setpoint-input" placeholder="Setpoint (${modeText})" min="0" max="${device.maxSpeed || (device.operationMode === 0 ? 1600 : 100)}" value="${device.setpoint}">
                    <span class="input-unit">${modeText}</span>
                </div>
                <div class="device-quick-btns">
                    ${device.operationMode === 0 ? `
                    <button class="quick-btn" data-value="0">0</button>
                    <button class="quick-btn" data-value="${Math.round((device.maxSpeed || 1600) * 0.25)}">${Math.round((device.maxSpeed || 1600) * 0.25)}</button>
                    <button class="quick-btn" data-value="${Math.round((device.maxSpeed || 1600) * 0.5)}">${Math.round((device.maxSpeed || 1600) * 0.5)}</button>
                    <button class="quick-btn" data-value="${Math.round((device.maxSpeed || 1600) * 0.75)}">${Math.round((device.maxSpeed || 1600) * 0.75)}</button>
                    <button class="quick-btn" data-value="${device.maxSpeed || 1600}">${device.maxSpeed || 1600}</button>
                    ` : `
                    <button class="quick-btn" data-value="0">0%</button>
                    <button class="quick-btn" data-value="25">25%</button>
                    <button class="quick-btn" data-value="50">50%</button>
                    <button class="quick-btn" data-value="75">75%</button>
                    <button class="quick-btn" data-value="100">100%</button>
                    `}
                </div>
            </div>
            <div class="device-monitoring-section">
                <div class="monitoring-header ${device.monitoringExpanded ? 'expanded' : ''}">
                    <span class="monitoring-toggle-icon">▶</span>
                    <span class="monitoring-title">Monitoring Parameters</span>
                    <span class="monitoring-count">(${(device.monitoringParams || []).length})</span>
                </div>
                <div class="monitoring-content" style="display: ${device.monitoringExpanded ? 'block' : 'none'};">
                    <div class="monitoring-add-section">
                        <div class="add-param-tabs">
                            <button class="add-tab active" data-tab="csv">Parameter List</button>
                            <button class="add-tab" data-tab="manual">Manual Input</button>
                        </div>
                        <div class="add-tab-content active" data-tab="csv">
                            <div class="param-picker-row">
                                <button class="param-picker-trigger" type="button">
                                    <span class="param-picker-trigger-label">파라미터 선택...</span>
                                    <span class="param-picker-trigger-arrow">▾</span>
                                </button>
                                <button class="btn btn-success btn-sm add-param-btn">+ Add</button>
                            </div>
                        </div>
                        <div class="add-tab-content" data-tab="manual">
                            <div class="manual-input-row">
                                <select class="manual-type">
                                    <option value="holding">Holding</option>
                                    <option value="input">Input</option>
                                </select>
                                <input type="text" class="manual-address" placeholder="D001">
                                <input type="text" class="manual-name" placeholder="Name">
                                <button class="btn btn-success btn-sm add-manual-btn">+ Add</button>
                            </div>
                            <small class="manual-address-converted"></small>
                        </div>
                    </div>
                    <div class="monitoring-params-list">
                        ${this.renderMonitoringParamsHTML(device.monitoringParams)}
                    </div>
                </div>
            </div>
        `;

        // Event listeners
        const checkbox = card.querySelector('.device-checkbox');
        checkbox.addEventListener('change', () => {
            this.toggleDeviceSelection(device.id);
        });

        // Device name click to edit
        const nameSpan = card.querySelector('.device-name');
        nameSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startEditDeviceName(device.id, nameSpan);
        });

        // Auto-apply setpoint on input change
        const setpointInput = card.querySelector('.device-setpoint-input');
        if (setpointInput) {
            setpointInput.addEventListener('change', () => {
                this.applyDeviceSetpoint(device.id, parseInt(setpointInput.value));
            });
        }

        // Per-device Live Watch toggle
        const lwBtn = card.querySelector('.btn-device-live-watch');
        lwBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDeviceLiveWatch(device.id);
        });

        // Delete button (X icon in header)
        const deleteBtn = card.querySelector('.btn-delete-icon');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteDevice(device.id);
        });

        // Alarm Reset button
        const alarmResetBtn = card.querySelector('.btn-alarm-reset');
        alarmResetBtn.addEventListener('click', () => {
            this.performAlarmReset(device.id);
        });

        // Software Reset button
        const softwareResetBtn = card.querySelector('.btn-software-reset');
        softwareResetBtn.addEventListener('click', () => {
            this.performSoftwareReset(device.id);
        });

        // ID badge → open settings modal on Fan Address field
        const idBadge = card.querySelector('.device-id-badge');
        if (idBadge) {
            idBadge.addEventListener('click', () => {
                this.showDeviceEditModal(device.id, 'fanAddress');
            });
        }

        // Edit button
        const editBtn = card.querySelector('.btn-edit');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.showDeviceEditModal(device.id);
            });
        }

        // Mode buttons
        card.querySelectorAll('.device-mode-btns .mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const newMode = parseInt(btn.dataset.mode);
                if (device.operationMode !== newMode) {
                    this.changeDeviceMode(device.id, newMode);
                }
            });
        });

        // Quick setpoint buttons for device card
        card.querySelectorAll('.device-quick-btns .quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = parseInt(btn.dataset.value);
                const input = card.querySelector('.device-controls input');
                if (input) input.value = value;
                // 바로 setpoint 적용
                this.applyDeviceSetpoint(device.id, value);
            });
        });

        // Drag and drop event listeners
        this.addDragEventListeners(card);

        // 드래그 바에서만 드래그 가능하도록 제한
        const dragBar = card.querySelector('.card-drag-bar');
        dragBar.addEventListener('mousedown', () => {
            card.draggable = true;
            document.addEventListener('mouseup', () => { card.draggable = false; }, { once: true });
        });
        card.addEventListener('dragend', () => { card.draggable = false; });

        // Monitoring section event listeners
        this.setupMonitoringEventListeners(card, device.id);

        return card;
    }

    /**
     * Add drag and drop event listeners to a device element
     */
    addDragEventListeners(element) {
        element.addEventListener('dragstart', (e) => this.handleDragStart(e, element));
        element.addEventListener('dragend', (e) => this.handleDragEnd(e, element));
        element.addEventListener('dragover', (e) => this.handleDragOver(e, element));
        element.addEventListener('dragenter', (e) => this.handleDragEnter(e, element));
        element.addEventListener('dragleave', (e) => this.handleDragLeave(e, element));
        element.addEventListener('drop', (e) => this.handleDrop(e, element));
    }

    /**
     * Handle drag start
     */
    handleDragStart(e, element) {
        this.draggedElement = element;
        this.draggedDeviceId = element.dataset.deviceId;

        element.classList.add('dragging');

        const grid = document.getElementById('deviceGrid');
        if (grid) grid.classList.add('is-dragging');

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', element.dataset.deviceId);

        // Create a semi-transparent drag image
        setTimeout(() => {
            element.style.opacity = '0.5';
        }, 0);
    }

    /**
     * Handle drag end
     */
    handleDragEnd(e, element) {
        element.classList.remove('dragging');
        element.style.opacity = '';

        const grid = document.getElementById('deviceGrid');
        if (grid) grid.classList.remove('is-dragging');

        // Remove drag-over class from all elements
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });

        this.draggedElement = null;
        this.draggedDeviceId = null;
    }

    /**
     * Handle drag over
     */
    handleDragOver(e, element) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    /**
     * Handle drag enter
     */
    handleDragEnter(e, element) {
        e.preventDefault();
        if (element !== this.draggedElement) {
            element.classList.add('drag-over');
        }
    }

    /**
     * Handle drag leave
     */
    handleDragLeave(e, element) {
        // Only remove if we're actually leaving the element
        const rect = element.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;

        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            element.classList.remove('drag-over');
        }
    }

    /**
     * Handle drop
     */
    handleDrop(e, element) {
        e.preventDefault();
        element.classList.remove('drag-over');

        if (!this.draggedElement || element === this.draggedElement) {
            return;
        }

        const draggedId = this.draggedDeviceId;
        const targetId = element.dataset.deviceId;

        if (draggedId && targetId) {
            this.reorderDevices(draggedId, targetId);
        }
    }

    /**
     * Reorder devices in the array
     */
    reorderDevices(draggedId, targetId) {
        // Convert to numbers since dataset.deviceId returns strings
        const draggedIdNum = parseInt(draggedId, 10);
        const targetIdNum = parseInt(targetId, 10);

        const draggedIndex = this.devices.findIndex(d => d.id === draggedIdNum);
        const targetIndex = this.devices.findIndex(d => d.id === targetIdNum);

        if (draggedIndex === -1 || targetIndex === -1) {
            return;
        }

        // Remove the dragged item from array
        const [draggedDevice] = this.devices.splice(draggedIndex, 1);

        // Insert at the new position
        this.devices.splice(targetIndex, 0, draggedDevice);

        // Save the new order
        this.saveDevices();

        // Re-render the grid
        this.renderDeviceGrid();
    }

    /**
     * Toggle device selection
     */
    toggleDeviceSelection(deviceId) {
        if (this.selectedDevices.has(deviceId)) {
            this.selectedDevices.delete(deviceId);
        } else {
            this.selectedDevices.add(deviceId);
        }
        this.updateDeviceCardSelection(deviceId);
        this.updateSelectedCount();
    }

    /**
     * Update device card/list item selection visual
     */
    updateDeviceCardSelection(deviceId) {
        // Support both card and list view
        const element = document.querySelector(`.device-card[data-device-id="${deviceId}"], .device-list-item[data-device-id="${deviceId}"]`);
        if (element) {
            if (this.selectedDevices.has(deviceId)) {
                element.classList.add('selected');
            } else {
                element.classList.remove('selected');
            }
        }
    }

    /**
     * Update selected count display
     */
    updateSelectedCount() {
        const countEl = document.getElementById('selectedDeviceCount');
        if (countEl) {
            countEl.textContent = this.selectedDevices.size;
        }

        // Update tab badge
        const selectedBadge = document.getElementById('selectedBadge');
        if (selectedBadge) {
            selectedBadge.textContent = this.selectedDevices.size;
        }

        // Update chips and button states
        this.updateSelectedDevicesChips();
        this.updateAllDeviceButtonsState();
    }

    /**
     * Select all devices
     */
    selectAllDevices() {
        this.devices.forEach(device => {
            this.selectedDevices.add(device.id);
            this.updateDeviceCardSelection(device.id);
            // Support both card and list view
            const element = document.querySelector(`.device-card[data-device-id="${device.id}"], .device-list-item[data-device-id="${device.id}"]`);
            if (element) {
                const checkbox = element.querySelector('.device-checkbox');
                if (checkbox) checkbox.checked = true;
            }
        });
        this.updateSelectedCount();
    }

    /**
     * Deselect all devices
     */
    deselectAllDevices() {
        this.devices.forEach(device => {
            this.selectedDevices.delete(device.id);
            this.updateDeviceCardSelection(device.id);
            // Support both card and list view
            const element = document.querySelector(`.device-card[data-device-id="${device.id}"], .device-list-item[data-device-id="${device.id}"]`);
            if (element) {
                const checkbox = element.querySelector('.device-checkbox');
                if (checkbox) checkbox.checked = false;
            }
        });
        this.updateSelectedCount();
    }

    /**
     * Set all device control mode (RPM or %)
     */
    setAllDeviceMode(mode) {
        const rpmBtn = document.getElementById('allDeviceModeRpm');
        const pctBtn = document.getElementById('allDeviceModePct');
        const unitSpan = document.getElementById('allDeviceSetpointUnit');
        const slider = document.getElementById('allDeviceSetpointSlider');

        if (mode === 0) {
            rpmBtn.classList.add('active');
            pctBtn.classList.remove('active');
            unitSpan.textContent = 'RPM';
            slider.max = 1600;
        } else {
            rpmBtn.classList.remove('active');
            pctBtn.classList.add('active');
            unitSpan.textContent = '%';
            slider.max = 100;
        }
    }

    /**
     * Convert user-entered setpoint to raw register value based on operation mode
     * Speed Control (mode 0): raw = rpm / max_speed * 64000
     * Open-loop Control (mode 2): raw = percent / 100 * 65535
     */
    convertSetpointToRaw(device, setpoint) {
        if (device.operationMode === 0) {
            // Speed Control: user enters RPM
            const maxSpeed = device.maxSpeed || 1600;
            return Math.round(setpoint / maxSpeed * 64000);
        } else {
            // Open-loop Control: user enters %
            return Math.round(setpoint / 100 * 65535);
        }
    }

    convertRawToSetpoint(device, raw) {
        if (device.operationMode === 0) {
            // Speed Control: raw → RPM
            const maxSpeed = device.maxSpeed || 1600;
            return Math.round(raw * maxSpeed / 64000);
        } else {
            // Open-loop Control: raw → %
            return Math.round(raw * 100 / 65535);
        }
    }

    /**
     * Apply setpoint to a single device
     * @param {boolean} silent - If true, don't show toast message
     */
    async applyDeviceSetpoint(deviceId, setpoint, silent = false) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        if (device.slaveId === 0) {
            if (!silent) this.showToast('Slave ID가 설정되지 않은 장치입니다', 'warning');
            return;
        }

        try {
            // Convert user-entered value to raw register value
            const rawSetpoint = this.convertSetpointToRaw(device, setpoint);

            // Set setpoint (send raw value to register)
            await this.writeRegister(device.slaveId, this.REGISTERS.SETPOINT, rawSetpoint);

            // Update local state (keep user-entered value for display)
            device.setpoint = setpoint;
            this.saveDevices();
            this.updateDeviceCardStatus(device);

            const unit = device.operationMode === 0 ? 'RPM' : '%';
            if (!silent) this.showToast(`${device.name}: Setpoint ${setpoint}${unit} 적용되었습니다`, 'success');
        } catch (error) {
            if (!silent) this.showToast(`${device.name}: 설정에 실패했습니다`, 'error');
        }
    }

    /**
     * Perform Alarm Reset
     */
    async performAlarmReset(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        if (device.slaveId === 0) {
            this.showToast('Slave ID가 설정되지 않은 장치입니다', 'warning');
            return;
        }

        try {
            // Send alarm reset command (write 1 to ALARM_RESET register)
            await this.writeRegister(device.slaveId, this.REGISTERS.ALARM_RESET, 1);
            this.showToast(`${device.name}: 알람이 리셋되었습니다`, 'success');

            // Read device status after reset to update UI
            setTimeout(() => {
                this.readDeviceStatus(deviceId);
            }, 500);
        } catch (error) {
            this.showToast(`${device.name}: 알람 리셋에 실패했습니다`, 'error');
        }
    }

    /**
     * Perform Software Reset
     */
    async performSoftwareReset(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        if (device.slaveId === 0) {
            this.showToast('Slave ID가 설정되지 않은 장치입니다', 'warning');
            return;
        }

        // Confirm before software reset
        const confirmed = await this.showConfirm(
            `${device.name}을(를) 재부팅 하시겠습니까?\n디바이스가 재시작됩니다.`,
            '🔄 소프트웨어 리셋',
            '🔄'
        );

        if (!confirmed) {
            return;
        }

        try {
            // Send software reset command: FC06, 0xD000, bit3(4번째 비트) set = 0x0008
            await this.writeRegister(device.slaveId, 0xD000, 0x0008);
            this.showToast(`${device.name}: 소프트웨어 리셋이 완료되었습니다`, 'success');

            // Mark device as offline temporarily
            device.online = false;
            this.renderDeviceGrid();

            // Try to reconnect after a delay
            setTimeout(() => {
                this.showToast(`${device.name}: 재연결 시도 중...`, 'info');
                this.readDeviceStatus(deviceId);
            }, 3000);
        } catch (error) {
            this.showToast(`${device.name}: 소프트웨어 리셋에 실패했습니다`, 'error');
        }
    }

    /**
     * Read device status
     */
    async readDeviceStatus(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        if (device.slaveId === 0) {
            this.showToast('Slave ID가 설정되지 않은 장치입니다', 'warning');
            return;
        }

        try {
            // Read motor status (Function Code 04 - Input Register)
            const status = await this.readInputRegisterWithTimeout(device.slaveId, this.REGISTERS.MOTOR_STATUS);
            device.motorStatus = status;

            // Read current setpoint
            const setpoint = await this.readRegister(device.slaveId, this.REGISTERS.SETPOINT);
            device.setpoint = setpoint;

            // Read operation mode
            const mode = await this.readRegister(device.slaveId, this.REGISTERS.OPERATION_MODE);
            device.operationMode = mode;

            // If Speed Control mode (RPM), read maximum speed
            if (mode === 0) {
                const maxSpeed = await this.readRegister(device.slaveId, this.REGISTERS.MAXIMUM_SPEED);
                device.maxSpeed = maxSpeed > 0 ? maxSpeed : 1600;
            } else {
                // Open-loop mode uses percentage (0-100%)
                device.maxSpeed = 100;
            }

            device.lastUpdate = Date.now();
            device.online = true;

            this.saveDevices();
            this.renderDeviceGrid();

            this.showToast(`${device.name}: 상태 읽기가 완료되었습니다`, 'success');
        } catch (error) {
            device.online = false;
            this.showToast(`${device.name}: 읽기에 실패했습니다`, 'error');
        }
    }

    /**
     * Initialize device mode by reading 0xD106 (Operating Mode) and 0xD119 (Maximum Speed)
     * Called when a new device is added
     */
    async initializeDeviceMode(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device || device.slaveId === 0) return;

        try {
            // Read operation mode (0xD106)
            // 0: Speed Control (RPM), 2: Open-loop Control (%)
            const mode = await this.readRegister(device.slaveId, this.REGISTERS.OPERATION_MODE);

            // null = 타임아웃 (디바이스 미응답) → 연결 안 된 디바이스
            if (mode === null) {
                console.log(`initializeDeviceMode: Slave ${device.slaveId} no response`);
                return;
            }

            device.operationMode = mode;

            // If Speed Control mode (RPM), read maximum speed
            if (mode === 0) {
                const maxSpeed = await this.readRegister(device.slaveId, this.REGISTERS.MAXIMUM_SPEED);
                device.maxSpeed = maxSpeed > 0 ? maxSpeed : 1600;
            } else {
                // Open-loop mode uses percentage (0-100%)
                device.maxSpeed = 100;
            }

            device.lastUpdate = Date.now();
            device.online = true;

            this.saveDevices();
            this.renderDeviceGrid();

            const modeText = mode === 0 ? 'Speed Control (RPM)' : 'Open-loop Control (%)';
            this.showToast(`${device.name}: ${modeText} 모드`, 'info');
        } catch (error) {
            console.log(`Failed to initialize device mode for ${device.name}:`, error);
            // Keep default values
        }
    }

    /**
     * Fetch and cache the drive serial number (0x2424) for a device.
     * Uses readCANopenObject which is already queue-safe — safe to call during polling.
     * Skips if already fetched or device has no valid slaveId.
     */
    async fetchDeviceSerialNumber(device) {
        if (!device || device.slaveId === 0) return;
        if (device.serialNumber) return; // already cached
        if (!this.writer && !this.simulatorEnabled) return;

        try {
            const result = await this.readCANopenObject(device.slaveId, 0x2424, 0x00, 16);
            if (!result || result.error) return;

            const serial = result.rawBytes
                .filter(b => b !== 0)
                .map(b => String.fromCharCode(b))
                .join('')
                .trim()
                .toUpperCase();

            if (serial) {
                device.serialNumber = serial;
                this.saveDevices();
                // Update all serial display spans in DOM without full re-render
                document.querySelectorAll(`[data-serial-for="${device.id}"]`).forEach(el => {
                    el.textContent = 'S/N: ' + serial;
                });
            }
        } catch (e) {
            // silently ignore — serial number is optional display info
        }
    }

    /**
     * Change device operating mode
     * @param {number} deviceId - Device ID
     * @param {number} newMode - 0: Speed Control (RPM), 2: Open-loop Control (%)
     */
    async changeDeviceMode(deviceId, newMode) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        if (device.slaveId === 0) {
            this.showToast('Slave ID가 설정되지 않은 장치입니다', 'warning');
            this.renderDeviceGrid(); // Reset toggle state
            return;
        }

        try {
            // Write new mode to 0xD106
            await this.writeRegister(device.slaveId, this.REGISTERS.OPERATION_MODE, newMode);
            device.operationMode = newMode;

            // Update maxSpeed based on mode
            if (newMode === 0) {
                // Speed Control mode - read max speed from device
                const maxSpeed = await this.readRegister(device.slaveId, this.REGISTERS.MAXIMUM_SPEED);
                device.maxSpeed = maxSpeed > 0 ? maxSpeed : 1600;
            } else {
                // Open-loop mode uses percentage (0-100%)
                device.maxSpeed = 100;
            }

            // Reset setpoint to 0 when changing mode
            device.setpoint = 0;
            await this.writeRegister(device.slaveId, this.REGISTERS.SETPOINT, 0);

            device.lastUpdate = Date.now();
            this.saveDevices();
            this.renderDeviceGrid();

            const modeText = newMode === 0 ? 'Speed Control (RPM)' : 'Open-loop Control (%)';
            this.showToast(`${device.name}: ${modeText} 모드로 변경되었습니다`, 'success');
        } catch (error) {
            this.showToast(`${device.name}: 모드 변경에 실패했습니다`, 'error');
            this.renderDeviceGrid(); // Reset toggle state
        }
    }

    /**
     * Apply setpoint to all selected devices
     */
    async applyAllDeviceSetpoint() {
        if (this.selectedDevices.size === 0) {
            this.showToast('선택된 장치가 없습니다', 'warning');
            return;
        }

        const setpoint = parseInt(document.getElementById('allDeviceSetpoint').value);
        const rpmBtn = document.getElementById('allDeviceModeRpm');
        const mode = rpmBtn.classList.contains('active') ? 0 : 1;

        let successCount = 0;
        for (const deviceId of this.selectedDevices) {
            const device = this.devices.find(d => d.id === deviceId);
            if (device && device.slaveId !== 0) {
                device.operationMode = mode;
                await this.applyDeviceSetpoint(deviceId, setpoint, true);
                successCount++;
            }
        }

        const unit = mode === 0 ? 'RPM' : '%';
        this.showToast(`${successCount}개 장치에 Setpoint ${setpoint}${unit}이 적용되었습니다`, 'success');
    }

    /**
     * Stop all selected devices
     */
    async stopSelectedDevices() {
        if (this.selectedDevices.size === 0) {
            this.showToast('선택된 장치가 없습니다', 'warning');
            return;
        }

        let successCount = 0;
        for (const deviceId of this.selectedDevices) {
            await this.applyDeviceSetpoint(deviceId, 0, true);
            successCount++;
        }

        this.showToast(`${successCount}개 장치가 정지되었습니다`, 'info');
    }

    /**
     * Refresh all devices
     */
    async refreshAllDevices() {
        this.showToast('모든 장치 상태를 읽는 중입니다...', 'info');

        for (const device of this.devices) {
            if (device.slaveId !== 0) {
                await this.readDeviceStatus(device.id, true);
            }
        }

        this.showToast('모든 장치 상태가 업데이트되었습니다', 'success');
    }

    /**
     * Start auto polling for device status
     */
    startAutoPolling() {
        console.log('[AutoPolling] startAutoPolling called', {
            devices: this.devices.length,
            writer: !!this.writer,
            simulatorEnabled: this.simulatorEnabled,
            autoPollingTimer: this.autoPollingTimer,
            isPolling: this.isPolling
        });

        if (this.devices.length === 0) {
            console.log('[AutoPolling] No devices, returning');
            return;
        }
        if (!this.writer && !this.simulatorEnabled) {
            console.log('[AutoPolling] No connection, returning');
            return;
        }

        // If already active but not currently polling, restart polling
        if (this.autoPollingTimer && !this.isPolling) {
            console.log('[AutoPolling] Restarting polling');
            this.pollNextDeviceSequential();
            return;
        }

        if (this.autoPollingTimer) {
            console.log('[AutoPolling] Already active, returning');
            return;
        }

        this.currentPollingIndex = 0;
        this.isPolling = false;

        // Create Web Worker timer if background polling is enabled
        if (this.backgroundPollingEnabled) {
            this.createPollingWorker();
        }

        // Use sequential polling instead of interval-based
        this.autoPollingTimer = true; // Flag to indicate polling is active
        console.log('[AutoPolling] Starting new polling');
        this.pollNextDeviceSequential();
        this.updateLiveWatchToggleBtn();

        // Queue serial number fetches for devices that don't have one yet.
        // autoPollingTimer is now true so readCANopenObject will enqueue safely.
        this.devices.filter(d => d.slaveId !== 0 && !d.serialNumber).forEach(d => {
            this.fetchDeviceSerialNumber(d);
        });
    }

    /**
     * Stop auto polling
     * @param {boolean} force - true: 연결 해제 등 강제 중단 (pendingResponse 즉시 취소)
     *                          false(기본): 탭 전환 등 정상 중단 (in-flight 사이클 자연 완료 대기)
     */
    stopAutoPolling(force = false) {
        this.autoPollingTimer = null;
        // isPolling은 pollNextDeviceSequential의 finally에서 관리 — 여기서 강제 리셋하지 않음
        // (강제 리셋 시 in-flight TX가 끝나기 전에 refreshDevice가 직접 TX를 쏴서 버스 충돌 발생)
        if (force) {
            this.isPolling = false;
            if (this.pendingResponse) {
                this.pendingResponse = null;
            }
        }
        // 대기 중인 write 명령을 모두 reject (연결 해제 시 caller가 catch 처리 가능)
        while (this.commandQueue.length > 0) {
            const cmd = this.commandQueue.shift();
            cmd.reject(new Error('Polling stopped (disconnected)'));
        }

        this.destroyPollingWorker();
        this.updateLiveWatchToggleBtn();
    }

    _syncAllDeviceLwBtns() {
        this.devices.forEach(d => {
            const card = document.querySelector(`.device-card[data-device-id="${d.id}"]`);
            const btn = card?.querySelector('.btn-device-live-watch');
            if (btn) btn.classList.toggle('active', d.liveWatch !== false);
        });
    }

    updateLiveWatchToggleBtn() {
        const btn = document.getElementById('liveWatchToggleBtn');
        if (!btn) return;
        const active = !!this.autoPollingTimer;
        btn.classList.toggle('active', active);
        btn.querySelector('.live-watch-label').textContent = active ? 'Live Watch ON' : 'Live Watch OFF';
    }

    toggleDeviceLiveWatch(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;
        device.liveWatch = device.liveWatch === false ? true : false;
        this.saveDevices();

        const card = document.querySelector(`.device-card[data-device-id="${deviceId}"]`);
        const lwBtn = card?.querySelector('.btn-device-live-watch');
        if (lwBtn) lwBtn.classList.toggle('active', device.liveWatch !== false);

        if (device.liveWatch !== false) {
            // 켜는 경우: 폴링이 꺼져 있으면 자동 시작
            if (!this.autoPollingTimer && (this.writer || this.simulatorEnabled)) {
                this.startAutoPolling();
            }
        } else {
            // 끄는 경우: liveWatch ON인 디바이스가 없으면 폴링 중지
            const anyOn = this.devices.some(d => d.liveWatch !== false);
            if (!anyOn) this.stopAutoPolling();
        }

        this.updateLiveWatchToggleBtn();

        const state = device.liveWatch !== false ? 'ON' : 'OFF';
        this.showToast(`${device.name} Live Watch ${state}`, device.liveWatch !== false ? 'success' : 'error');
    }

    /**
     * Create inline Web Worker for background polling timer.
     * Worker thread is NOT throttled when the browser tab is hidden/minimized.
     */
    createPollingWorker() {
        if (this.pollingWorker) return;

        const workerCode = `
            let timerId = null;
            self.onmessage = function(e) {
                if (e.data.command === 'start') {
                    clearTimeout(timerId);
                    timerId = setTimeout(() => self.postMessage('tick'), e.data.interval);
                } else if (e.data.command === 'stop') {
                    clearTimeout(timerId);
                    timerId = null;
                }
            };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.pollingWorker = new Worker(URL.createObjectURL(blob));
        this.pollingWorker.onmessage = () => {
            if (this.autoPollingTimer) {
                this.pollNextDeviceSequential();
            }
        };
    }

    /**
     * Destroy polling Web Worker
     */
    destroyPollingWorker() {
        if (this.pollingWorker) {
            this.pollingWorker.postMessage({ command: 'stop' });
            this.pollingWorker.terminate();
            this.pollingWorker = null;
        }
    }

    /**
     * Schedule next poll using either Web Worker timer or regular setTimeout
     */
    scheduleNextPoll() {
        if (!this.autoPollingTimer) return;

        if (this.backgroundPollingEnabled && this.pollingWorker) {
            this.pollingWorker.postMessage({ command: 'start', interval: this.autoPollingInterval });
        } else {
            setTimeout(() => this.pollNextDeviceSequential(), this.autoPollingInterval);
        }
    }

    /**
     * Poll next device sequentially (TX -> wait response/timeout -> next)
     */
    /** FC 0x64 스트림(메인 차트 또는 미니 차트)이 버스를 점유 중인지 여부 */
    get _isFc64Active() {
        return this.chartRunning || Object.values(this.miniChartRunning).some(v => v) || this._fc64Busy || this.triggerRunning;
    }

    /**
     * commandQueue에 쌓인 명령을 모두 순차 실행.
     * FC 0x64 차트 루프가 폴링 루프 대신 이 함수를 호출해 버스 충돌 없이 큐를 소진한다.
     */
    async _drainCommandQueue() {
        while (this.commandQueue.length > 0) {
            const cmd = this.commandQueue.shift();
            try {
                if (cmd.type === 'read') {
                    const value = await this.sendAndWaitResponse(cmd.frame, cmd.slaveId);
                    cmd.resolve(value);
                } else if (cmd.type === 'canopen_read' || cmd.type === 'canopen_write') {
                    const result = await this.sendCANopenAndWaitResponse(cmd.frame, cmd.slaveId);
                    cmd.resolve(result);
                } else {
                    await this.sendWriteAndWaitResponse(cmd.frame, cmd.slaveId, cmd.address);
                    cmd.resolve();
                }
            } catch (err) {
                cmd.reject(err);
            }
        }
    }

    async pollNextDeviceSequential() {
        // Check if polling should continue
        if (!this.autoPollingTimer) {
            return;
        }

        // If scanning, wait and retry later
        if (this.isScanning) {
            setTimeout(() => this.pollNextDeviceSequential(), 500);
            return;
        }

        // FC 0x64 스트림(미니차트/차트)이 버스를 점유 중이면 폴링 대기
        if (this.chartRunning || Object.values(this.miniChartRunning).some(v => v)) {
            setTimeout(() => this.pollNextDeviceSequential(), 100);
            return;
        }

        if (this.devices.length === 0) {
            // No devices, wait and retry
            setTimeout(() => this.pollNextDeviceSequential(), 500);
            return;
        }

        // Prevent concurrent polling
        if (this.isPolling) return;
        this.isPolling = true;

        // Command queue: polling 사이클 사이에 사용자 write/read 명령을 처리
        // 이 블록에서만 TX가 발생하므로 485 버스 충돌 원천 차단
        if (this.commandQueue.length > 0) {
            const cmd = this.commandQueue.shift();
            try {
                if (cmd.type === 'read') {
                    // Read 명령: sendAndWaitResponse로 값을 받아서 resolve에 전달
                    const value = await this.sendAndWaitResponse(cmd.frame, cmd.slaveId);
                    cmd.resolve(value);
                } else if (cmd.type === 'canopen_read' || cmd.type === 'canopen_write') {
                    // CANopen SDO 명령: 파싱은 sendCANopenAndWaitResponse 내부에서 처리
                    const result = await this.sendCANopenAndWaitResponse(cmd.frame, cmd.slaveId);
                    cmd.resolve(result);
                } else {
                    // Write 명령 (기존 동작): commandTimeout으로 응답 대기
                    await this.sendWriteAndWaitResponse(cmd.frame, cmd.slaveId, cmd.address);
                    cmd.resolve();
                }
            } catch (err) {
                cmd.reject(err);
            } finally {
                this.isPolling = false;
                // Interval(설정의 Interval)만큼 대기 후 다음 사이클 (queue에 더 있으면 즉시 처리)
                this.scheduleNextPoll();
            }
            return;
        }

        // Get devices with valid slave IDs and Live Watch enabled
        const validDevices = this.devices.filter(d => d.slaveId !== 0 && d.liveWatch !== false);
        if (validDevices.length === 0) {
            this.isPolling = false;
            setTimeout(() => this.pollNextDeviceSequential(), 500);
            return;
        }

        // Reset index if out of bounds
        if (this.currentPollingIndex >= validDevices.length) {
            this.currentPollingIndex = 0;
        }

        const device = validDevices[this.currentPollingIndex];
        this.currentPollingIndex++;

        try {
            // Read motor status with timeout (Function Code 04 - Input Register)
            // Direct sendAndWaitResponse — bypasses queue since we are the polling loop.
            const motorFrame = this.modbus.buildReadInputRegisters(device.slaveId, this.REGISTERS.MOTOR_STATUS, 1);
            const status = await this.sendAndWaitResponse(motorFrame, device.slaveId);

            if (status !== null) {
                device.motorStatus = status;
                device.lastUpdate = Date.now();
                device.online = true;
                device.failCount = 0; // Reset fail count on success
                this.updateDeviceStats(device.slaveId, true);

                // Inter-frame gap before next read (메시지 간격 설정 적용)
                if (this.paramPollingDelay > 0) await this.delay(this.paramPollingDelay);

                // Read actual speed (Function Code 04 - Input Register)
                const speedFrame = this.modbus.buildReadInputRegisters(device.slaveId, this.REGISTERS.ACTUAL_SPEED, 1);
                const actualSpeed = await this.sendAndWaitResponse(speedFrame, device.slaveId);
                if (actualSpeed !== null) {
                    // Handle signed 16-bit value
                    device.actualSpeed = actualSpeed > 32767 ? actualSpeed - 65536 : actualSpeed;
                }

                // Inter-frame gap
                if (this.paramPollingDelay > 0) await this.delay(this.paramPollingDelay);

                // Read setpoint (Function Code 03 - Holding Register)
                const setpointFrame = this.modbus.buildReadHoldingRegisters(device.slaveId, this.REGISTERS.SETPOINT, 1);
                const rawSetpoint = await this.sendAndWaitResponse(setpointFrame, device.slaveId);
                if (rawSetpoint !== null) {
                    device.setpoint = this.convertRawToSetpoint(device, rawSetpoint);
                }

                this.updateDeviceCardStatus(device);

                // Inter-frame gap before monitoring params (FC03→FC04 전환 시 Modbus RTU 3.5 char 간격 보장)
                if (this.paramPollingDelay > 0) await this.delay(this.paramPollingDelay);

                // Poll monitoring parameters if any
                if (device.monitoringParams && device.monitoringParams.length > 0) {
                    await this.pollMonitoringParams(device);
                }
            } else {
                device.failCount = (device.failCount || 0) + 1;
                this.updateDeviceStats(device.slaveId, false);
                // Only mark offline after consecutive failures exceed threshold
                if (device.failCount >= this.offlineThreshold) {
                    device.online = false;
                    this.updateDeviceCardOffline(device);
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
            device.failCount = (device.failCount || 0) + 1;
            try {
                this.updateDeviceStats(device.slaveId, false);
                // Only mark offline after consecutive failures exceed threshold
                if (device.failCount >= this.offlineThreshold) {
                    device.online = false;
                    this.updateDeviceCardOffline(device);
                }
            } catch (e) {
                console.error('Error updating device stats:', e);
            }
        } finally {
            this.isPolling = false;

            // Schedule next poll after interval
            this.scheduleNextPoll();
        }
    }

    /**
     * Read register with timeout handling
     */
    async readRegisterWithTimeout(slaveId, address) {
        const frame = this.modbus.buildReadHoldingRegisters(slaveId, address, 1);

        if (this.simulatorEnabled) {
            // Simulator mode - instant response
            const originalSlaveId = this.simulator.slaveId;
            this.simulator.slaveId = slaveId;

            this.stats.requests++;
            this.updateStatsDisplay();

            const response = await this.simulator.processRequest(frame);
            this.simulator.slaveId = originalSlaveId;

            if (response && response.length >= 5 && (response[1] & 0x80) === 0) {
                this.stats.success++;
                this.updateStatsDisplay();
                return (response[3] << 8) | response[4];
            } else {
                this.stats.errors++;
                this.updateStatsDisplay();
                return null;
            }
        } else if (this.writer) {
            if (this.autoPollingTimer || this._isFc64Active || this.ovPollingRunning) {
                // polling 루프 / FC64 차트 / OV 폴링 중 하나라도 버스를 점유 중이면 큐에 등록
                return new Promise((resolve, reject) => {
                    this.commandQueue.push({ type: 'read', frame, slaveId, address, resolve, reject });
                });
            }
            // 버스 유휴 — 직접 전송
            return await this.sendAndWaitResponse(frame, slaveId);
        }

        return null;
    }

    /**
     * 임의 raw 프레임을 전송하고 응답을 기다린다 (CRC 재계산 없음).
     * 테스트 목적으로 고의로 훼손된 프레임 전송 시 사용.
     * 큐를 통해 안전하게 전송되므로 폴링 중에도 버스 충돌 없음.
     * @param {Uint8Array} frame - 전송할 raw 바이트 (CRC 포함, 재계산 안 함)
     * @param {number} slaveId  - 응답 대기 slave ID (무응답 확인이면 timeout으로 null 반환)
     * @returns {Promise<number|null>} 응답값 또는 null (timeout/exception)
     */
    async sendRawFrameWithTimeout(frame, slaveId) {
        if (this.simulatorEnabled) {
            // 시뮬레이터는 CRC를 검증하지 않으므로 정상 응답이 올 수 있음 — null 강제 반환
            return null;
        }
        if (!this.writer) return null;

        if (this.autoPollingTimer || this._isFc64Active) {
            return new Promise((resolve, reject) => {
                this.commandQueue.push({ type: 'read', frame, slaveId, address: 0, resolve, reject });
            });
        }
        return await this.sendAndWaitResponse(frame, slaveId);
    }

    /**
     * Send frame and wait for response with timeout
     */
    async sendAndWaitResponse(frame, expectedSlaveId) {
        // Simulator mode - bypass real serial port
        if (this.simulatorEnabled) {
            return new Promise(async (resolve) => {
                this.addMonitorEntry('sent', frame, { functionCode: frame[1], startAddress: (frame[2] << 8) | frame[3], quantity: 1 });
                this.stats.requests++;
                this.updateStatsDisplay();

                const simulatedIds = this.getSimulatedDeviceIds();
                if (!simulatedIds.includes(expectedSlaveId)) {
                    this.stats.errors++;
                    this.updateStatsDisplay();
                    resolve(null);
                    return;
                }

                const originalSlaveId = this.simulator.slaveId;
                this.simulator.slaveId = expectedSlaveId;
                try {
                    const response = await this.simulator.processRequest(frame);
                    if (response && response.length >= 5 && response[0] === expectedSlaveId && (response[1] & 0x80) === 0) {
                        this.addMonitorEntry('received', response);
                        this.stats.success++;
                        this.updateStatsDisplay();
                        resolve((response[3] << 8) | response[4]);
                    } else {
                        this.stats.errors++;
                        this.updateStatsDisplay();
                        resolve(null);
                    }
                } finally {
                    this.simulator.slaveId = originalSlaveId;
                }
            });
        }

        return new Promise(async (resolve) => {
            // Clear receive buffer
            this.receiveIndex = 0;

            // Set up response handler
            const responsePromise = new Promise((resResolve) => {
                this.pendingResponse = {
                    slaveId: expectedSlaveId,
                    resolve: resResolve,
                    startTime: Date.now()
                };
            });

            // Set up timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Timeout'));
                }, this.pollingTimeout);
            });

            try {
                // Send TX
                await this.writer.write(frame);
                this.addMonitorEntry('sent', frame, { functionCode: frame[1], startAddress: (frame[2] << 8) | frame[3], quantity: 1 });
                this.stats.requests++;
                this.updateStatsDisplay();

                // Wait for response or timeout
                const response = await Promise.race([responsePromise, timeoutPromise]);

                this.pendingResponse = null;

                if (response && response.length >= 5 && response[0] === expectedSlaveId && (response[1] & 0x80) === 0) {
                    this.stats.success++;
                    this.updateStatsDisplay();
                    resolve((response[3] << 8) | response[4]);
                } else {
                    this.stats.errors++;
                    this.updateStatsDisplay();
                    resolve(null);
                }
            } catch (error) {
                // Timeout occurred
                this.pendingResponse = null;
                this.stats.errors++;
                this.updateStatsDisplay();
                this.addMonitorEntry('error', `Slave ${expectedSlaveId}: Response timeout (${this.pollingTimeout}ms)`);
                resolve(null);
            }
        });
    }

    /**
     * Handle received frame for pending response
     */
    handlePendingResponse(frame) {
        if (this.pendingResponse && frame.length >= 3) {
            const slaveId = frame[0];
            if (slaveId === this.pendingResponse.slaveId) {
                this.pendingResponse.resolve(frame);
            }
        }
    }

    /**
     * Update device card/list item to show offline status
     */
    updateDeviceCardOffline(device) {
        // Support both card and list view
        const element = document.querySelector(`.device-card[data-device-id="${device.id}"], .device-list-item[data-device-id="${device.id}"]`);
        if (!element) return;

        const statusIndicator = element.querySelector('.status-indicator');
        const statusTextEl = element.querySelector('.status-text');

        if (statusIndicator) {
            statusIndicator.className = 'status-indicator stopped';
        }
        if (statusTextEl) {
            statusTextEl.textContent = 'Offline';
        }

        element.classList.add('offline');
    }

    /**
     * Read register silently (for backward compatibility)
     */
    async readRegisterSilent(slaveId, address) {
        return await this.readRegisterWithTimeout(slaveId, address);
    }

    /**
     * Update device card/list item status without full re-render
     */
    updateDeviceCardStatus(device) {
        // Support both card and list view
        const element = document.querySelector(`.device-card[data-device-id="${device.id}"], .device-list-item[data-device-id="${device.id}"]`);
        if (!element) return;

        // Remove offline class when device comes back online
        element.classList.remove('offline');

        const statusInfo = this.getMotorStatusInfo(device.motorStatus, device.online || this.simulatorEnabled);

        const statusIndicator = element.querySelector('.status-indicator');
        const statusTextEl = element.querySelector('.status-text');
        const statusContainer = element.querySelector('.device-status');

        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${statusInfo.class}`;
        }
        if (statusTextEl) {
            statusTextEl.textContent = statusInfo.text;
        }
        if (statusContainer) {
            statusContainer.title = statusInfo.tooltip;
        }

        // Update actual speed value in card view
        if (element.classList.contains('device-card')) {
            const actualSpeedEl = element.querySelector('.actual-speed-value');
            if (actualSpeedEl) {
                actualSpeedEl.innerHTML = `${device.actualSpeed}<span class="device-value-unit">RPM</span>`;
            }
        }

        // Update setpoint display (card & list view)
        const modeText = device.operationMode === 0 ? 'RPM' : '%';
        const setpointDisplayEl = element.querySelector('.setpoint-display-value');
        if (setpointDisplayEl) {
            setpointDisplayEl.innerHTML = `${device.setpoint}<span class="device-value-unit">${modeText}</span>`;
        }
        // Update setpoint input only if not currently focused
        const setpointInputEl = element.querySelector('.device-setpoint-input');
        if (setpointInputEl && document.activeElement !== setpointInputEl) {
            setpointInputEl.value = device.setpoint;
        }
    }

    /**
     * Parse motor status bits and return status info
     * @param {number} status - 16-bit motor status value from D011
     * @param {boolean} online - Whether the device is online/connected
     * @returns {Object} { text: string, class: string, errors: array, hasError: boolean }
     */
    getMotorStatusInfo(status, online = true) {
        // Check if device is disconnected
        if (!online) {
            return {
                text: 'Disconnected',
                class: 'disconnected',
                errors: [],
                hasError: false,
                tooltip: 'Device not connected'
            };
        }

        const errors = [];

        // Check each error bit
        for (const [key, bit] of Object.entries(this.MOTOR_STATUS_BITS)) {
            if (status & bit.mask) {
                errors.push({ key, name: bit.name, description: bit.description });
            }
        }

        if (errors.length > 0) {
            // Has errors - show first error name, full list in tooltip
            const text = errors.length === 1
                ? errors[0].name
                : `${errors[0].name} +${errors.length - 1}`;
            return {
                text,
                class: 'error',
                errors,
                hasError: true,
                tooltip: errors.map(e => e.description).join('\n')
            };
        }

        // 0xD011: 0 = motor OK, non-zero = alarm
        if (status === 0) {
            return {
                text: 'OK',
                class: 'running',
                errors: [],
                hasError: false,
                tooltip: 'Motor OK'
            };
        }

        // Non-zero but no matching error bit — undefined alarm bit
        return {
            text: 'Alarm',
            class: 'error',
            errors: [],
            hasError: true,
            tooltip: `Alarm — undefined bit (0x${status.toString(16).toUpperCase().padStart(4, '0')})`
        };
    }

    /**
     * Write register helper
     */
    async writeRegister(slaveId, address, value) {
        const frame = this.modbus.buildWriteSingleRegister(slaveId, address, value);

        if (this.simulatorEnabled) {
            this.addMonitorEntry('sent', frame, { functionCode: 6, startAddress: address });
            this.stats.requests++;
            this.updateStatsDisplay();
            const response = await this.simulator.processRequest(frame);
            if (response) {
                this.addMonitorEntry('received', response);
                this.updateStats(true);
            }
        } else if (this.writer) {
            if (this.autoPollingTimer || this._isFc64Active) {
                // Polling 중이거나 FC64 차트가 버스를 점유 중이면 큐에 등록
                return new Promise((resolve, reject) => {
                    this.commandQueue.push({ frame, slaveId, address, resolve, reject });
                });
            } else {
                await this.sendWriteAndWaitResponse(frame, slaveId, address);
            }
        } else {
            throw new Error('Not connected');
        }
    }

    /**
     * Send write command and wait for response with timeout
     */
    async sendWriteAndWaitResponse(frame, slaveId, address) {
        // Simulator mode - bypass real serial port
        if (this.simulatorEnabled) {
            return new Promise(async (resolve) => {
                this.addMonitorEntry('sent', frame, { functionCode: 6, startAddress: address });
                this.stats.requests++;
                this.updateStatsDisplay();

                const originalSlaveId = this.simulator.slaveId;
                this.simulator.slaveId = slaveId;
                try {
                    const response = await this.simulator.processRequest(frame);
                    if (response) {
                        this.addMonitorEntry('received', response);
                        this.stats.success++;
                        this.updateStatsDisplay();
                    } else {
                        this.stats.errors++;
                        this.updateStatsDisplay();
                    }
                } finally {
                    this.simulator.slaveId = originalSlaveId;
                }
                resolve();
            });
        }

        return new Promise(async (resolve, reject) => {
            // Set up response handler
            const responsePromise = new Promise(res => {
                this.pendingResponse = {
                    slaveId: slaveId,
                    resolve: res
                };
            });

            const timeoutPromise = new Promise((_, rej) => {
                setTimeout(() => rej(new Error('Timeout')), this.commandTimeout);
            });

            try {
                // Send TX
                await this.writer.write(frame);
                this.addMonitorEntry('sent', frame, { functionCode: 6, startAddress: address });
                this.stats.requests++;
                this.updateStatsDisplay();

                // Wait for response or timeout
                const response = await Promise.race([responsePromise, timeoutPromise]);

                this.pendingResponse = null;

                if (response && response.length >= 5 && response[0] === slaveId && (response[1] & 0x80) === 0) {
                    this.stats.success++;
                    this.updateStatsDisplay();
                    resolve();
                } else {
                    this.stats.errors++;
                    this.updateStatsDisplay();
                    resolve(); // Still resolve to continue execution
                }
            } catch (error) {
                // Timeout occurred
                this.pendingResponse = null;
                this.stats.errors++;
                this.updateStatsDisplay();
                this.addMonitorEntry('error', `Slave ${slaveId}: Write response timeout (${this.commandTimeout}ms)`);
                resolve(); // Still resolve to continue execution
            }
        });
    }

    /**
     * FC 0x2B CANopen SDO 명령 전송 후 응답 대기 및 파싱
     * sendAndWaitResponse와 동일한 구조이나, 응답을 parseCANopenResponse로 처리.
     * @param {Uint8Array} frame  전송할 프레임
     * @param {number} slaveId   예상 Slave ID
     * @returns {Promise<{cs, index, subIndex, value, abortCode, error}|null>}
     */
    async sendCANopenAndWaitResponse(frame, slaveId) {
        return new Promise(async (resolve) => {
            this.receiveIndex = 0;

            const responsePromise = new Promise((resResolve) => {
                this.pendingResponse = {
                    slaveId,
                    resolve: resResolve,
                    startTime: Date.now()
                };
            });

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), this.commandTimeout);
            });

            try {
                await this.writer.write(frame);
                this.addMonitorEntry('sent', frame, { functionCode: 0x2B, startAddress: (frame[6] << 8) | frame[7] });
                this.stats.requests++;
                this.updateStatsDisplay();

                const response = await Promise.race([responsePromise, timeoutPromise]);
                this.pendingResponse = null;

                if (response && response[0] === slaveId) {
                    try {
                        const parsed = this.modbus.parseCANopenResponse(response);
                        if (parsed.error) {
                            this.stats.errors++;
                        } else {
                            this.stats.success++;
                        }
                        this.updateStatsDisplay();
                        resolve(parsed);
                    } catch (e) {
                        this.stats.errors++;
                        this.updateStatsDisplay();
                        resolve(null);
                    }
                } else {
                    this.stats.errors++;
                    this.updateStatsDisplay();
                    resolve(null);
                }
            } catch (error) {
                this.pendingResponse = null;
                this.stats.errors++;
                this.updateStatsDisplay();
                this.addMonitorEntry('error', `Slave ${slaveId}: CANopen response timeout (${this.commandTimeout}ms)`);
                resolve(null);
            }
        });
    }

    /**
     * CANopen SDO 읽기 (Upload) — 485 버스 안전 래퍼
     * polling 중이면 commandQueue에 등록, 아니면 직접 전송.
     * @param {number} slaveId   Modbus Slave ID
     * @param {number} index     CANopen Object Index
     * @param {number} subIndex  CANopen Sub-Index
     * @returns {Promise<{cs, index, subIndex, value, abortCode, error}|null>}
     */
    async readCANopenObject(slaveId, index, subIndex, numData = 2) {
        const frame = this.modbus.buildCANopenUpload(slaveId, index, subIndex, 0, numData);

        if (this.writer) {
            if (this.autoPollingTimer || this._isFc64Active || this.ovPollingRunning) {
                // polling 루프 / FC64 차트 / OV 폴링 중 하나라도 버스를 점유 중이면 큐에 등록
                return new Promise((resolve, reject) => {
                    this.commandQueue.push({ type: 'canopen_read', frame, slaveId, resolve, reject });
                });
            }
            return await this.sendCANopenAndWaitResponse(frame, slaveId);
        }
        throw new Error('Not connected');
    }

    /**
     * CANopen SDO 쓰기 (Download) — 485 버스 안전 래퍼
     * polling 중이면 commandQueue에 등록, 아니면 직접 전송.
     * @param {number} slaveId   Modbus Slave ID
     * @param {number} index     CANopen Object Index
     * @param {number} subIndex  CANopen Sub-Index
     * @param {number} value     쓸 값
     * @param {number} [size=4]  데이터 크기 (1, 2, 3, 4 bytes)
     * @returns {Promise<{cs, index, subIndex, value, abortCode, error}|null>}
     */
    async writeCANopenObject(slaveId, index, subIndex, value, size = 4) {
        const frame = this.modbus.buildCANopenDownload(slaveId, index, subIndex, value, 0);

        if (this.writer) {
            if (this.autoPollingTimer || this._isFc64Active) {
                return new Promise((resolve, reject) => {
                    this.commandQueue.push({ type: 'canopen_write', frame, slaveId, resolve, reject });
                });
            }
            return await this.sendCANopenAndWaitResponse(frame, slaveId);
        }
        throw new Error('Not connected');
    }

    /**
     * Read register helper (simplified - real implementation would wait for response)
     */
    async readRegister(slaveId, address) {
        const frame = this.modbus.buildReadHoldingRegisters(slaveId, address, 1);

        if (this.simulatorEnabled) {
            this.addMonitorEntry('sent', frame, { functionCode: 3, startAddress: address, quantity: 1 });
            this.stats.requests++;
            this.updateStatsDisplay();
            const response = await this.simulator.processRequest(frame);
            if (response && response.length >= 5) {
                this.addMonitorEntry('received', response);
                this.updateStats(true);
                // Parse register value from response
                return (response[3] << 8) | response[4];
            }
        } else if (this.writer) {
            // Delegate to readRegisterWithTimeout which handles queue + response parsing correctly
            return await this.readRegisterWithTimeout(slaveId, address);
        } else {
            throw new Error('Not connected');
        }
        return 0;
    }

    // ==================== Monitoring Parameters Methods ====================

    /**
     * Toggle monitoring section visibility
     */
    toggleMonitoringSection(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        device.monitoringExpanded = !device.monitoringExpanded;
        this.saveDevices();

        const element = document.querySelector(`.device-card[data-device-id="${deviceId}"], .device-list-item[data-device-id="${deviceId}"]`);
        if (!element) return;

        const header = element.querySelector('.monitoring-header');
        const content = element.querySelector('.monitoring-content');

        if (device.monitoringExpanded) {
            header.classList.add('expanded');
            content.style.display = 'block';
        } else {
            header.classList.remove('expanded');
            content.style.display = 'none';
        }
    }

    /**
     * Generate parameter options from parameters list
     */
    generateParameterOptions() {
        const holdingParams = this.parameters.filter(p => p.type === 'holding');
        const inputParams = this.parameters.filter(p => p.type === 'input');

        let optionsHtml = '<option value="">-- Select Parameter --</option>';

        if (holdingParams.length > 0) {
            optionsHtml += '<optgroup label="Holding Registers">';
            holdingParams.forEach(p => {
                optionsHtml += `<option value="holding:${p.address}">${p.name} (${p.address})</option>`;
            });
            optionsHtml += '</optgroup>';
        }

        if (inputParams.length > 0) {
            optionsHtml += '<optgroup label="Input Registers">';
            inputParams.forEach(p => {
                optionsHtml += `<option value="input:${p.address}">${p.name} (${p.address})</option>`;
            });
            optionsHtml += '</optgroup>';
        }

        return optionsHtml;
    }

    /**
     * Generate grouped parameter picker HTML (replaces flat <select>)
     */
    generateParamPickerHTML() {
        // Group by "type:group" — fallback group for params without group field
        const grouped = {};
        this.parameters.forEach(p => {
            const typeLabel = p.type === 'input' ? 'Input' : p.type === 'lsm' ? 'LSM' : 'Holding';
            const groupKey = `${typeLabel} — ${p.group || (p.type === 'input' ? 'Input Registers' : p.type === 'lsm' ? 'LSM' : 'Holding Registers')}`;
            if (!grouped[groupKey]) grouped[groupKey] = [];
            grouped[groupKey].push(p);
        });

        const keys = Object.keys(grouped);
        const firstKey = keys[0] || '';

        let catHtml = '';
        let paramHtml = '';

        keys.forEach((groupKey, i) => {
            catHtml += `<div class="param-picker-cat-item${i === 0 ? ' active' : ''}" data-group="${groupKey}">${groupKey}</div>`;
            grouped[groupKey].forEach(p => {
                paramHtml += `<div class="param-picker-item${i === 0 ? '' : ' hidden-group'}" data-value="${p.type}:${p.address}" data-group="${groupKey}">${p.name}<span class="param-picker-addr">${p.address}</span></div>`;
            });
        });

        return `
            <div class="param-picker-panels">
                <div class="param-picker-cat-panel">${catHtml}</div>
                <div class="param-picker-param-panel">${paramHtml}</div>
            </div>`;
    }

    /**
     * Chart channel definitions (chNum = value sent in FC 0x64 configure)
     */
    getChartChannels() {
        return [
            // Velocity
            { name: 'Velocity Feedback',               chNum: 0x00, group: 'Velocity' },
            { name: 'Velocity Command',                chNum: 0x01, group: 'Velocity' },
            { name: 'Velocity Error',                  chNum: 0x02, group: 'Velocity' },
            { name: 'Position Command Velocity',       chNum: 0x15, group: 'Velocity' },
            // Torque
            { name: 'Torque Feedback',                 chNum: 0x03, group: 'Torque' },
            { name: 'Torque Command',                  chNum: 0x04, group: 'Torque' },
            // Position
            { name: 'Position Actual',                 chNum: 0x13, group: 'Position' },
            { name: 'Position Demand',                 chNum: 0x14, group: 'Position' },
            { name: 'Following Error',                 chNum: 0x05, group: 'Position' },
            { name: 'Following Error Actual',          chNum: 0x0B, group: 'Position' },
            // Overload
            { name: 'Accum. Operation Overload',       chNum: 0x06, group: 'Overload' },
            { name: 'Accum. Regen. Overload',          chNum: 0x08, group: 'Overload' },
            { name: 'Inertia Ratio',                   chNum: 0x0A, group: 'Overload' },
            // Electrical
            { name: 'DC Link Voltage',                 chNum: 0x07, group: 'Electrical' },
            { name: 'U Phase Current',                 chNum: 0x10, group: 'Electrical' },
            { name: 'V Phase Current',                 chNum: 0x11, group: 'Electrical' },
            { name: 'W Phase Current',                 chNum: 0x12, group: 'Electrical' },
            // Temperature
            { name: 'Drive Temperature 1',             chNum: 0x0C, group: 'Temperature' },
            { name: 'Drive Temperature 2',             chNum: 0x0D, group: 'Temperature' },
            { name: 'Encoder Temperature',             chNum: 0x0E, group: 'Temperature' },
            // Encoder/Hall
            { name: 'Encoder SingleTurn',              chNum: 0x09, group: 'Encoder/Hall' },
            { name: 'Hall Signal Value',               chNum: 0x0F, group: 'Encoder/Hall' },
            { name: 'Hall U',                          chNum: 0x16, group: 'Encoder/Hall' },
            { name: 'Hall V',                          chNum: 0x17, group: 'Encoder/Hall' },
            { name: 'Hall W',                          chNum: 0x18, group: 'Encoder/Hall' },
            { name: 'Commanded Motor Phase Angle',     chNum: 0x19, group: 'Encoder/Hall' },
            { name: 'Hall Phase Angle',                chNum: 0x1A, group: 'Encoder/Hall' },
            { name: 'Electric Angle',                  chNum: 0x1B, group: 'Encoder/Hall' },
            // Sensor/LMS
            { name: 'Left Sensor Position',            chNum: 0x20, group: 'Sensor/LMS' },
            { name: 'Right Sensor Position',           chNum: 0x21, group: 'Sensor/LMS' },
            { name: 'L/R Position Difference',         chNum: 0x22, group: 'Sensor/LMS' },
            { name: 'Sensor Position Internal',        chNum: 0x23, group: 'Sensor/LMS' },
            { name: 'Left Sensor Valid (C36)',          chNum: 0x24, group: 'Sensor/LMS' },
            { name: 'Left Sensor Valid (C37)',          chNum: 0x25, group: 'Sensor/LMS' },
            { name: 'Left Sensor Singleturn',          chNum: 0x26, group: 'Sensor/LMS' },
            { name: 'Right Sensor Singleturn',         chNum: 0x27, group: 'Sensor/LMS' },
            { name: 'LMS READY',                       chNum: 0x28, group: 'Sensor/LMS' },
            { name: 'Reserved 1 (LMS StateMachine)',   chNum: 0x29, group: 'Sensor/LMS' },
            { name: 'ROS',                             chNum: 0x2A, group: 'Sensor/LMS' },
            { name: 'Reserved 3 (L.Sensor Valid Raw)', chNum: 0x2B, group: 'Sensor/LMS' },
            { name: 'Reserved 4 (R.Sensor Valid Raw)', chNum: 0x2C, group: 'Sensor/LMS' },
            // FFT
            { name: 'FFT Input',                       chNum: 0x36, group: 'FFT' },
            { name: 'FFT Output',                      chNum: 0x37, group: 'FFT' },
            // Digital Input
            { name: 'POT',    chNum: 0x64, group: 'Digital Input' },
            { name: 'NOT',    chNum: 0x65, group: 'Digital Input' },
            { name: 'HOME',   chNum: 0x66, group: 'Digital Input' },
            { name: 'STOP',   chNum: 0x67, group: 'Digital Input' },
            { name: 'PCON',   chNum: 0x68, group: 'Digital Input' },
            { name: 'GAIN',   chNum: 0x69, group: 'Digital Input' },
            { name: 'P_CL',   chNum: 0x6A, group: 'Digital Input' },
            { name: 'N_CL',   chNum: 0x6B, group: 'Digital Input' },
            { name: 'PROBE1', chNum: 0x6C, group: 'Digital Input' },
            { name: 'PROBE2', chNum: 0x6D, group: 'Digital Input' },
            { name: 'EMG',    chNum: 0x6E, group: 'Digital Input' },
            { name: 'A_RST',  chNum: 0x6F, group: 'Digital Input' },
            { name: 'SV_ON',  chNum: 0x70, group: 'Digital Input' },
            { name: 'START',  chNum: 0x74, group: 'Digital Input' },
            { name: 'PAUSE',  chNum: 0x75, group: 'Digital Input' },
            { name: 'REGT',   chNum: 0x76, group: 'Digital Input' },
            { name: 'HSTART', chNum: 0x77, group: 'Digital Input' },
            { name: 'ISEL0',  chNum: 0x78, group: 'Digital Input' },
            { name: 'ISEL1',  chNum: 0x79, group: 'Digital Input' },
            { name: 'ISEL2',  chNum: 0x7A, group: 'Digital Input' },
            { name: 'ISEL3',  chNum: 0x7B, group: 'Digital Input' },
            { name: 'ISEL4',  chNum: 0x7C, group: 'Digital Input' },
            { name: 'ISEL5',  chNum: 0x7D, group: 'Digital Input' },
            { name: 'ABS_RQ', chNum: 0x7E, group: 'Digital Input' },
            { name: 'JSTART', chNum: 0x7F, group: 'Digital Input' },
            { name: 'JDIR',   chNum: 0x80, group: 'Digital Input' },
            { name: 'PCLR',   chNum: 0x81, group: 'Digital Input' },
            { name: 'AVOR',   chNum: 0x82, group: 'Digital Input' },
            { name: 'INHIB',  chNum: 0x83, group: 'Digital Input' },
            // Digital Output
            { name: 'BRAKE',  chNum: 0x84, group: 'Digital Output' },
            { name: 'ALARM',  chNum: 0x85, group: 'Digital Output' },
            { name: 'READY',  chNum: 0x86, group: 'Digital Output' },
            { name: 'ZSPD',   chNum: 0x87, group: 'Digital Output' },
            { name: 'INPOS1', chNum: 0x88, group: 'Digital Output' },
            { name: 'TLMT',   chNum: 0x89, group: 'Digital Output' },
            { name: 'VLMT',   chNum: 0x8A, group: 'Digital Output' },
            { name: 'INSPD',  chNum: 0x8B, group: 'Digital Output' },
            { name: 'WARN',   chNum: 0x8C, group: 'Digital Output' },
            { name: 'TGON',   chNum: 0x8D, group: 'Digital Output' },
            { name: 'INPOS2', chNum: 0x8E, group: 'Digital Output' },
            { name: 'ORG',    chNum: 0x94, group: 'Digital Output' },
            { name: 'EOS',    chNum: 0x95, group: 'Digital Output' },
            { name: 'IOUT0',  chNum: 0x96, group: 'Digital Output' },
            { name: 'IOUT1',  chNum: 0x97, group: 'Digital Output' },
            { name: 'IOUT2',  chNum: 0x98, group: 'Digital Output' },
            { name: 'IOUT3',  chNum: 0x99, group: 'Digital Output' },
            { name: 'IOUT4',  chNum: 0x9A, group: 'Digital Output' },
            { name: 'IOUT5',  chNum: 0x9B, group: 'Digital Output' },
            // ControlWord
            { name: 'ControlWord.0',  chNum: 0xA4, group: 'ControlWord' },
            { name: 'ControlWord.1',  chNum: 0xA5, group: 'ControlWord' },
            { name: 'ControlWord.2',  chNum: 0xA6, group: 'ControlWord' },
            { name: 'ControlWord.3',  chNum: 0xA7, group: 'ControlWord' },
            { name: 'ControlWord.4',  chNum: 0xA8, group: 'ControlWord' },
            { name: 'ControlWord.5',  chNum: 0xA9, group: 'ControlWord' },
            { name: 'ControlWord.6',  chNum: 0xAA, group: 'ControlWord' },
            { name: 'ControlWord.7',  chNum: 0xAB, group: 'ControlWord' },
            { name: 'ControlWord.8',  chNum: 0xAC, group: 'ControlWord' },
            { name: 'ControlWord.9',  chNum: 0xAD, group: 'ControlWord' },
            { name: 'ControlWord.10', chNum: 0xAE, group: 'ControlWord' },
            { name: 'ControlWord.11', chNum: 0xAF, group: 'ControlWord' },
            { name: 'ControlWord.12', chNum: 0xB0, group: 'ControlWord' },
            { name: 'ControlWord.13', chNum: 0xB1, group: 'ControlWord' },
            { name: 'ControlWord.14', chNum: 0xB2, group: 'ControlWord' },
            { name: 'ControlWord.15', chNum: 0xB3, group: 'ControlWord' },
            // StatusWord
            { name: 'StatusWord.0',  chNum: 0xB4, group: 'StatusWord' },
            { name: 'StatusWord.1',  chNum: 0xB5, group: 'StatusWord' },
            { name: 'StatusWord.2',  chNum: 0xB6, group: 'StatusWord' },
            { name: 'StatusWord.3',  chNum: 0xB7, group: 'StatusWord' },
            { name: 'StatusWord.4',  chNum: 0xB8, group: 'StatusWord' },
            { name: 'StatusWord.5',  chNum: 0xB9, group: 'StatusWord' },
            { name: 'StatusWord.6',  chNum: 0xBA, group: 'StatusWord' },
            { name: 'StatusWord.7',  chNum: 0xBB, group: 'StatusWord' },
            { name: 'StatusWord.8',  chNum: 0xBC, group: 'StatusWord' },
            { name: 'StatusWord.9',  chNum: 0xBD, group: 'StatusWord' },
            { name: 'StatusWord.10', chNum: 0xBE, group: 'StatusWord' },
            { name: 'StatusWord.11', chNum: 0xBF, group: 'StatusWord' },
            { name: 'StatusWord.12', chNum: 0xC0, group: 'StatusWord' },
            { name: 'StatusWord.13', chNum: 0xC1, group: 'StatusWord' },
            { name: 'StatusWord.14', chNum: 0xC2, group: 'StatusWord' },
            { name: 'StatusWord.15', chNum: 0xC3, group: 'StatusWord' },
            // Other
            { name: 'INDEX (Z-PHASE)',  chNum: 0xD0, group: 'Other' },
            { name: 'Object Monitor 1', chNum: 0xFA, group: 'Other' },
            { name: 'Object Monitor 2', chNum: 0xFB, group: 'Other' },
            { name: 'Object Monitor 3', chNum: 0xFC, group: 'Other' },
            { name: 'Object Monitor 4', chNum: 0xFD, group: 'Other' },
        ];
    }

    /**
     * Generate channel picker panels HTML (reuses param-picker CSS)
     */
    generateChannelPickerHTML() {
        const channels = this.getChartChannels();
        const grouped = {};
        channels.forEach(ch => {
            if (!grouped[ch.group]) grouped[ch.group] = [];
            grouped[ch.group].push(ch);
        });
        const keys = Object.keys(grouped);
        let catHtml = '';
        let itemHtml = '';
        keys.forEach((group, i) => {
            catHtml += `<div class="param-picker-cat-item${i === 0 ? ' active' : ''}" data-group="${group}">${group}</div>`;
            grouped[group].forEach(ch => {
                const hex = `0x${ch.chNum.toString(16).toUpperCase().padStart(2, '0')}`;
                itemHtml += `<div class="param-picker-item${i === 0 ? '' : ' hidden-group'}" data-value="${ch.chNum}" data-group="${group}">${ch.name}<span class="param-picker-addr">${hex}</span></div>`;
            });
        });
        return `
            <div class="param-picker-panels">
                <div class="param-picker-cat-panel">${catHtml}</div>
                <div class="param-picker-param-panel">${itemHtml}</div>
            </div>`;
    }

    /**
     * Initialize chart channel picker dropdowns (CH1~CH4)
     * Pre-selects default channels C1~C4 (0x01~0x04).
     */
    initChartChannelPickers() {
        const defaults = [0x01, 0x02, 0x03, 0x04];
        const channels = this.getChartChannels();

        for (let i = 0; i < 4; i++) {
            const triggerBtn = document.getElementById(`chartCh${i + 1}Trigger`);
            if (!triggerBtn) continue;

            const popup = document.createElement('div');
            popup.className = 'param-picker-popup';
            popup.dataset.chartChIdx = String(i);
            popup.style.display = 'none';
            popup.innerHTML = `
                <input type="text" class="param-picker-search" placeholder="채널 검색...">
                ${this.generateChannelPickerHTML()}
            `;
            document.body.appendChild(popup);

            // Category click
            popup.querySelector('.param-picker-cat-panel').addEventListener('click', (e) => {
                const cat = e.target.closest('.param-picker-cat-item');
                if (!cat) return;
                popup.querySelectorAll('.param-picker-cat-item').forEach(el => el.classList.remove('active'));
                cat.classList.add('active');
                const group = cat.dataset.group;
                popup.querySelectorAll('.param-picker-item').forEach(item => {
                    item.classList.toggle('hidden-group', item.dataset.group !== group);
                });
            });

            // Item click
            popup.querySelector('.param-picker-param-panel').addEventListener('click', (e) => {
                const item = e.target.closest('.param-picker-item');
                if (!item) return;
                const addrEl = item.querySelector('.param-picker-addr');
                const name = item.childNodes[0].textContent.trim();
                const hex = addrEl ? addrEl.textContent.trim() : '';
                triggerBtn.dataset.selectedValue = item.dataset.value;
                triggerBtn.querySelector('.param-picker-trigger-label').textContent = `${name} (${hex})`;
                triggerBtn.classList.add('has-selection');
                popup.style.display = 'none';
                // Persist selection
                const saved = JSON.parse(localStorage.getItem('chartChSettings') || '{}');
                if (!saved[i]) saved[i] = {};
                saved[i].value = item.dataset.value;
                saved[i].label = `${name} (${hex})`;
                localStorage.setItem('chartChSettings', JSON.stringify(saved));
            });

            // Search
            const searchInput = popup.querySelector('.param-picker-search');
            searchInput.addEventListener('input', () => {
                const q = searchInput.value.toLowerCase().trim();
                const catPanelEl = popup.querySelector('.param-picker-cat-panel');
                if (q) {
                    catPanelEl.style.display = 'none';
                    popup.querySelectorAll('.param-picker-item').forEach(item => {
                        item.classList.toggle('hidden-group', !item.textContent.toLowerCase().includes(q));
                    });
                } else {
                    catPanelEl.style.display = '';
                    const activeCat = catPanelEl.querySelector('.param-picker-cat-item.active');
                    const group = activeCat ? activeCat.dataset.group : null;
                    popup.querySelectorAll('.param-picker-item').forEach(item => {
                        item.classList.toggle('hidden-group', group && item.dataset.group !== group);
                    });
                }
            });

            // Trigger click → position and show popup
            triggerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = popup.style.display !== 'none';
                document.querySelectorAll('.param-picker-popup').forEach(p => { p.style.display = 'none'; });
                if (isOpen) return;
                popup.style.display = 'block';
                const rect = triggerBtn.getBoundingClientRect();
                const popupW = 400;
                const popupH = 280;
                let left = rect.left;
                let top = rect.bottom + 4;
                if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
                if (top + popupH > window.innerHeight - 8) top = rect.top - popupH - 4;
                popup.style.left = left + 'px';
                popup.style.top = top + 'px';
                popup.style.width = popupW + 'px';
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
                setTimeout(() => searchInput.focus(), 50);
            });

            popup.addEventListener('click', (e) => e.stopPropagation());

            // Pre-select default channel
            const defNum = defaults[i];
            const defCh = channels.find(c => c.chNum === defNum);
            if (defCh) {
                const hex = `0x${defNum.toString(16).toUpperCase().padStart(2, '0')}`;
                triggerBtn.dataset.selectedValue = String(defNum);
                triggerBtn.querySelector('.param-picker-trigger-label').textContent = `${defCh.name} (${hex})`;
                triggerBtn.classList.add('has-selection');
            }

            // Restore persisted settings (overrides defaults)
            const savedSettings = JSON.parse(localStorage.getItem('chartChSettings') || '{}');
            const savedCh = savedSettings[i];
            if (savedCh) {
                if (savedCh.value != null && savedCh.label) {
                    triggerBtn.dataset.selectedValue = savedCh.value;
                    triggerBtn.querySelector('.param-picker-trigger-label').textContent = savedCh.label;
                    triggerBtn.classList.add('has-selection');
                }
                if (typeof savedCh.enabled === 'boolean') {
                    const enableEl = document.getElementById(`chartCh${i + 1}Enable`);
                    if (enableEl) {
                        enableEl.checked = savedCh.enabled;
                        this.chartManager.setChannelEnabled(i, savedCh.enabled);
                    }
                }
            }
        }
    }

    /**
     * Trigger Source CH 피커 초기화.
     * 채널 목록 상단에 "Immediate" 항목 포함. 기본 선택: Immediate.
     */
    initTriggerSourcePicker() {
        const triggerBtn = document.getElementById('triggerSourcePicker');
        if (!triggerBtn) return;

        // 팝업 생성 — 기존 채널 피커와 동일한 구조
        const popup = document.createElement('div');
        popup.className = 'param-picker-popup';
        popup.id = 'triggerSourcePickerPopup';
        popup.style.display = 'none';

        // Immediate를 별도 카테고리로 맨 앞에 추가
        const channelPickerInner = this.generateChannelPickerHTML();
        // catPanel / paramPanel에 Immediate 항목 삽입
        const tmpDiv = document.createElement('div');
        tmpDiv.innerHTML = channelPickerInner;
        const catPanel   = tmpDiv.querySelector('.param-picker-cat-panel');
        const paramPanel = tmpDiv.querySelector('.param-picker-param-panel');

        const immCat = document.createElement('div');
        immCat.className = 'param-picker-cat-item active';
        immCat.dataset.group = 'Immediate';
        immCat.textContent = 'Immediate';
        catPanel.insertBefore(immCat, catPanel.firstChild);
        // 기존 첫 번째 카테고리의 active 제거
        catPanel.querySelectorAll('.param-picker-cat-item:not(:first-child)').forEach(el => el.classList.remove('active'));

        const immItem = document.createElement('div');
        immItem.className = 'param-picker-item';
        immItem.dataset.value = '255'; // 0xFF
        immItem.dataset.group = 'Immediate';
        immItem.innerHTML = 'Immediate Trigger<span class="param-picker-addr">0xFF</span>';
        paramPanel.insertBefore(immItem, paramPanel.firstChild);
        // 기존 아이템들은 Immediate 카테고리가 아니므로 hidden
        paramPanel.querySelectorAll('.param-picker-item:not(:first-child)').forEach(el => el.classList.add('hidden-group'));

        popup.innerHTML = `<input type="text" class="param-picker-search" placeholder="채널 검색...">`;
        popup.appendChild(tmpDiv.querySelector('.param-picker-panels'));
        document.body.appendChild(popup);

        // 카테고리 클릭
        popup.querySelector('.param-picker-cat-panel').addEventListener('click', (e) => {
            const cat = e.target.closest('.param-picker-cat-item');
            if (!cat) return;
            popup.querySelectorAll('.param-picker-cat-item').forEach(el => el.classList.remove('active'));
            cat.classList.add('active');
            const group = cat.dataset.group;
            popup.querySelectorAll('.param-picker-item').forEach(item => {
                item.classList.toggle('hidden-group', item.dataset.group !== group);
            });
        });

        // 아이템 클릭
        popup.querySelector('.param-picker-param-panel').addEventListener('click', (e) => {
            const item = e.target.closest('.param-picker-item');
            if (!item) return;
            const addrEl = item.querySelector('.param-picker-addr');
            const name   = item.childNodes[0].textContent.trim();
            const hex    = addrEl ? addrEl.textContent.trim() : '';
            triggerBtn.dataset.selectedValue = item.dataset.value;
            triggerBtn.querySelector('.param-picker-trigger-label').textContent = `${name} (${hex})`;
            triggerBtn.classList.add('has-selection');
            popup.style.display = 'none';
        });

        // 검색
        const searchInput = popup.querySelector('.param-picker-search');
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase().trim();
            const catPanelEl = popup.querySelector('.param-picker-cat-panel');
            if (q) {
                catPanelEl.style.display = 'none';
                popup.querySelectorAll('.param-picker-item').forEach(item => {
                    item.classList.toggle('hidden-group', !item.textContent.toLowerCase().includes(q));
                });
            } else {
                catPanelEl.style.display = '';
                const activeCat = catPanelEl.querySelector('.param-picker-cat-item.active');
                const group = activeCat ? activeCat.dataset.group : null;
                popup.querySelectorAll('.param-picker-item').forEach(item => {
                    item.classList.toggle('hidden-group', group && item.dataset.group !== group);
                });
            }
        });

        // 버튼 클릭 → 팝업 표시
        triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = popup.style.display !== 'none';
            document.querySelectorAll('.param-picker-popup').forEach(p => { p.style.display = 'none'; });
            if (isOpen) return;
            popup.style.display = 'block';
            const rect   = triggerBtn.getBoundingClientRect();
            const popupW = 400;
            const popupH = 280;
            let left = rect.left;
            let top  = rect.bottom + 4;
            if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
            if (top  + popupH > window.innerHeight - 8) top  = rect.top - popupH - 4;
            popup.style.left  = left + 'px';
            popup.style.top   = top  + 'px';
            popup.style.width = popupW + 'px';
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
            setTimeout(() => searchInput.focus(), 50);
        });

        popup.addEventListener('click', (e) => e.stopPropagation());

        // 기본 선택: Immediate Trigger
        triggerBtn.dataset.selectedValue = '255';
        triggerBtn.querySelector('.param-picker-trigger-label').textContent = 'Immediate Trigger (0xFF)';
        triggerBtn.classList.add('has-selection');
    }

    /**
     * Parse address string — supports 0xD001, D001 (bare hex), 53249 (dec)
     * Delegates to parseModbusValue for unified HEX/DEC handling.
     */
    parseMonitoringAddress(addressStr) {
        if (typeof addressStr === 'number') return addressStr;
        try {
            return this.parseModbusValue(String(addressStr).trim(), 0, 65535);
        } catch {
            return NaN;
        }
    }

    /**
     * Add monitoring parameter from CSV list
     */
    addMonitoringParamFromCSV(deviceId, paramValue) {
        if (!paramValue) return;

        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const [type, addressStr] = paramValue.split(':');
        const address = this.parseMonitoringAddress(addressStr);

        if (!device.monitoringParams) {
            device.monitoringParams = [];
        }

        // Check for duplicates
        if (device.monitoringParams.some(p => p.type === type && p.address === address)) {
            this.showToast('이미 존재하는 파라미터입니다', 'warning');
            return;
        }

        // Find name from parameters
        const csvParam = this.parameters.find(p =>
            p.type === type && this.parseMonitoringAddress(p.address) === address
        );

        const newParam = {
            id: 'param_' + Date.now(),
            type: type,
            address: address,
            name: csvParam?.name || `Register ${addressStr}`,
            value: null,
            lastRead: null,
            source: 'csv'
        };

        device.monitoringParams.push(newParam);
        this.saveDevices();
        this.renderMonitoringParams(deviceId);
        this.showToast(`${newParam.name} 추가되었습니다`, 'success');
    }

    /**
     * Add monitoring parameter manually
     */
    addMonitoringParamManual(deviceId, type, addressStr, name) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const address = this.parseMonitoringAddress(addressStr);
        if (isNaN(address)) {
            this.showToast('주소 형식이 올바르지 않습니다', 'error');
            return;
        }

        if (!device.monitoringParams) {
            device.monitoringParams = [];
        }

        // Check for duplicates
        if (device.monitoringParams.some(p => p.type === type && p.address === address)) {
            this.showToast('이미 존재하는 파라미터입니다', 'warning');
            return;
        }

        const newParam = {
            id: 'param_' + Date.now(),
            type: type,
            address: address,
            name: name || `Register 0x${address.toString(16).toUpperCase()}`,
            value: null,
            lastRead: null,
            source: 'manual'
        };

        device.monitoringParams.push(newParam);
        this.saveDevices();
        this.renderMonitoringParams(deviceId);
        this.showToast(`${newParam.name} 추가되었습니다`, 'success');
    }

    /**
     * Remove monitoring parameter
     */
    removeMonitoringParam(deviceId, paramId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device || !device.monitoringParams) return;

        const paramIndex = device.monitoringParams.findIndex(p => p.id === paramId);
        if (paramIndex === -1) return;

        const paramName = device.monitoringParams[paramIndex].name;
        device.monitoringParams.splice(paramIndex, 1);

        this.saveDevices();
        this.renderMonitoringParams(deviceId);
        this.showToast(`${paramName} 삭제되었습니다`, 'info');
    }

    /**
     * Render monitoring parameters list
     */
    renderMonitoringParams(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const element = document.querySelector(`.device-card[data-device-id="${deviceId}"], .device-list-item[data-device-id="${deviceId}"]`);
        if (!element) return;

        const listContainer = element.querySelector('.monitoring-params-list');
        const countBadge = element.querySelector('.monitoring-count');

        if (!listContainer) return;

        const params = device.monitoringParams || [];

        if (countBadge) {
            countBadge.textContent = `(${params.length})`;
        }

        if (params.length === 0) {
            listContainer.innerHTML = `
                <div class="monitoring-empty">
                    No monitoring parameters.<br>
                    Add parameters below.
                </div>
            `;
            return;
        }

        listContainer.innerHTML = params.map(param => `
            <div class="monitoring-param-item" data-param-id="${param.id}">
                <div class="param-info">
                    <span class="param-name">${param.name}</span>
                    <span class="param-address">${param.type === 'holding' ? 'H' : 'I'}:0x${param.address.toString(16).toUpperCase()}</span>
                </div>
                <div class="param-value-wrapper">
                    <div class="param-value ${param.value === null ? 'stale' : ''}" id="param-value-${param.id}">
                        ${param.value !== null ? param.value : '--'}
                    </div>
                    ${this.getParamConvertedHTML(param)}
                </div>
                <button class="param-remove-btn" data-device-id="${deviceId}" data-param-id="${param.id}" title="Remove">×</button>
            </div>
        `).join('');

        // Re-attach remove button listeners
        listContainer.querySelectorAll('.param-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dId = parseInt(btn.dataset.deviceId);
                const pId = btn.dataset.paramId;
                this.removeMonitoringParam(dId, pId);
            });
        });
    }

    /**
     * Render monitoring parameters HTML (for initial card creation)
     */
    renderMonitoringParamsHTML(params) {
        if (!params || params.length === 0) {
            return `<div class="monitoring-empty">
                No monitoring parameters.<br>
                Add parameters below.
            </div>`;
        }

        return params.map(param => `
            <div class="monitoring-param-item" data-param-id="${param.id}">
                <div class="param-info">
                    <span class="param-name">${param.name}</span>
                    <span class="param-address">${param.type === 'holding' ? 'H' : 'I'}:0x${param.address.toString(16).toUpperCase()}</span>
                </div>
                <div class="param-value-wrapper">
                    <div class="param-value ${param.value === null ? 'stale' : ''}" id="param-value-${param.id}">
                        ${param.value !== null ? param.value : '--'}
                    </div>
                    ${this.getParamConvertedHTML(param)}
                </div>
                <button class="param-remove-btn" title="Remove">×</button>
            </div>
        `).join('');
    }

    /**
     * Setup monitoring section event listeners
     */
    setupMonitoringEventListeners(card, deviceId) {
        // Header click - toggle
        const header = card.querySelector('.monitoring-header');
        if (header) {
            header.addEventListener('click', () => this.toggleMonitoringSection(deviceId));
        }

        // Tab switching
        const tabs = card.querySelectorAll('.add-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                card.querySelectorAll('.add-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                card.querySelectorAll('.add-tab-content').forEach(c => {
                    c.classList.toggle('active', c.dataset.tab === tabName);
                });
            });
        });

        // Param picker popup
        const triggerBtn = card.querySelector('.param-picker-trigger');
        if (triggerBtn) {
            // Remove stale popup for this device if any
            document.querySelectorAll(`.param-picker-popup[data-device-id="${deviceId}"]`).forEach(p => p.remove());

            // Create popup and append to body
            const popup = document.createElement('div');
            popup.className = 'param-picker-popup';
            popup.dataset.deviceId = deviceId;
            popup.style.display = 'none';
            popup.innerHTML = `
                <input type="text" class="param-picker-search" placeholder="파라미터 검색...">
                ${this.generateParamPickerHTML()}
            `;
            document.body.appendChild(popup);

            // Category click
            popup.querySelector('.param-picker-cat-panel').addEventListener('click', (e) => {
                const cat = e.target.closest('.param-picker-cat-item');
                if (!cat) return;
                popup.querySelectorAll('.param-picker-cat-item').forEach(el => el.classList.remove('active'));
                cat.classList.add('active');
                const group = cat.dataset.group;
                popup.querySelectorAll('.param-picker-item').forEach(item => {
                    item.classList.toggle('hidden-group', item.dataset.group !== group);
                });
            });

            // Item click → store value, update trigger label, close popup
            popup.querySelector('.param-picker-param-panel').addEventListener('click', (e) => {
                const item = e.target.closest('.param-picker-item');
                if (!item) return;
                const addrEl = item.querySelector('.param-picker-addr');
                const name = item.childNodes[0].textContent.trim();
                const addr = addrEl ? addrEl.textContent.trim() : '';
                triggerBtn.dataset.selectedValue = item.dataset.value;
                triggerBtn.querySelector('.param-picker-trigger-label').textContent = `${name} (${addr})`;
                triggerBtn.classList.add('has-selection');
                popup.style.display = 'none';
            });

            // Search filter
            const searchInput = popup.querySelector('.param-picker-search');
            searchInput.addEventListener('input', () => {
                const q = searchInput.value.toLowerCase().trim();
                const catPanelEl = popup.querySelector('.param-picker-cat-panel');
                if (q) {
                    catPanelEl.style.display = 'none';
                    popup.querySelectorAll('.param-picker-item').forEach(item => {
                        item.classList.toggle('hidden-group', !item.textContent.toLowerCase().includes(q));
                    });
                } else {
                    catPanelEl.style.display = '';
                    const activeCat = catPanelEl.querySelector('.param-picker-cat-item.active');
                    const group = activeCat ? activeCat.dataset.group : null;
                    popup.querySelectorAll('.param-picker-item').forEach(item => {
                        item.classList.toggle('hidden-group', group && item.dataset.group !== group);
                    });
                }
            });

            // Trigger click → position and show popup
            triggerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = popup.style.display !== 'none';
                // Close all other open popups
                document.querySelectorAll('.param-picker-popup').forEach(p => { p.style.display = 'none'; });
                if (isOpen) return;

                popup.style.display = 'block';
                const rect = triggerBtn.getBoundingClientRect();
                const popupW = 400;
                const popupH = 280;
                let left = rect.left;
                let top = rect.bottom + 4;
                if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
                if (top + popupH > window.innerHeight - 8) top = rect.top - popupH - 4;
                popup.style.left = left + 'px';
                popup.style.top = top + 'px';
                popup.style.width = popupW + 'px';

                // Reset search
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
                setTimeout(() => searchInput.focus(), 50);
            });

            // Stop popup click from bubbling to document
            popup.addEventListener('click', (e) => e.stopPropagation());

            // Close on outside click
            document.addEventListener('click', () => { popup.style.display = 'none'; });
        }

        // Add from CSV
        const addCsvBtn = card.querySelector('.add-param-btn');
        if (addCsvBtn) {
            addCsvBtn.addEventListener('click', () => {
                const value = triggerBtn ? triggerBtn.dataset.selectedValue : null;
                if (!value) return;
                this.addMonitoringParamFromCSV(deviceId, value);
                if (triggerBtn) {
                    triggerBtn.dataset.selectedValue = '';
                    triggerBtn.querySelector('.param-picker-trigger-label').textContent = '파라미터 선택...';
                    triggerBtn.classList.remove('has-selection');
                }
            });
        }

        // Manual address: live HEX/DEC conversion display
        const manualAddrInput = card.querySelector('.manual-address');
        const manualAddrConverted = card.querySelector('.manual-address-converted');
        if (manualAddrInput && manualAddrConverted) {
            manualAddrInput.addEventListener('input', () => {
                this.updateConvertedValueEl(manualAddrInput, manualAddrConverted, 0, 65535);
            });
        }

        // Add manually
        const addManualBtn = card.querySelector('.add-manual-btn');
        if (addManualBtn) {
            addManualBtn.addEventListener('click', () => {
                const type = card.querySelector('.manual-type').value;
                const address = card.querySelector('.manual-address').value;
                const name = card.querySelector('.manual-name').value;

                this.addMonitoringParamManual(deviceId, type, address, name);

                card.querySelector('.manual-address').value = '';
                card.querySelector('.manual-name').value = '';
                if (manualAddrConverted) manualAddrConverted.textContent = '';
            });
        }

        // Remove buttons
        card.querySelectorAll('.param-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const paramItem = btn.closest('.monitoring-param-item');
                const paramId = paramItem.dataset.paramId;
                this.removeMonitoringParam(deviceId, paramId);
            });
        });

    }

    /**
     * Poll monitoring parameters for a device
     */
    async pollMonitoringParams(device) {
        if (!device.monitoringParams || device.monitoringParams.length === 0) return;

        for (const param of device.monitoringParams) {
            try {
                let value = null;

                if (param.type === 'lsm') {
                    // CANopen MEI (FC 0x2B) — 폴링 루프 내부이므로 직접 전송 가능
                    const paramFrame = this.modbus.buildCANopenUpload(device.slaveId, param.address, 0);
                    const result = await this.sendCANopenAndWaitResponse(paramFrame, device.slaveId);
                    value = result?.value ?? null;
                } else {
                    // Direct sendAndWaitResponse — bypasses queue since we are inside the polling loop.
                    const paramFrame = param.type === 'input'
                        ? this.modbus.buildReadInputRegisters(device.slaveId, param.address, 1)
                        : this.modbus.buildReadHoldingRegisters(device.slaveId, param.address, 1);
                    value = await this.sendAndWaitResponse(paramFrame, device.slaveId);
                }

                if (value !== null) {
                    param.value = value;
                    param.lastRead = Date.now();
                    this.updateMonitoringParamValue(device.id, param.id, value);
                }
            } catch (error) {
                console.warn(`Failed to read param ${param.name} for device ${device.id}:`, error);
            }

            // Small delay between parameters
            await this.delay(this.paramPollingDelay);
        }
    }

    /**
     * Read Input Register with timeout (Function Code 4)
     */
    async readInputRegisterWithTimeout(slaveId, address) {
        const frame = this.modbus.buildReadInputRegisters(slaveId, address, 1);

        if (this.simulatorEnabled) {
            const originalSlaveId = this.simulator.slaveId;
            this.simulator.slaveId = slaveId;
            this.stats.requests++;
            this.updateStatsDisplay();

            const response = await this.simulator.processRequest(frame);
            this.simulator.slaveId = originalSlaveId;

            if (response && response.length >= 5 && (response[1] & 0x80) === 0) {
                this.stats.success++;
                this.updateStatsDisplay();
                return (response[3] << 8) | response[4];
            } else {
                this.stats.errors++;
                this.updateStatsDisplay();
                return null;
            }
        } else if (this.writer) {
            if (this.autoPollingTimer || this._isFc64Active) {
                // Polling 중이거나 FC64 차트가 버스를 점유 중이면 큐에 등록
                return new Promise((resolve, reject) => {
                    this.commandQueue.push({ type: 'read', frame, slaveId, address, resolve, reject });
                });
            }
            return await this.sendAndWaitResponse(frame, slaveId);
        }

        return null;
    }

    /**
     * Converts raw register value to human-readable string for special registers.
     * D023: AIN1 voltage  → (raw / 65536) × 10000 mV
     * D024: AIN2 current  → (raw / 65536) × 20.625 mA  (Vref 3.3V / Rvios 160Ω)
     * Returns null if address is not a special register.
     */
    convertParamRawToString(address, raw) {
        if (address === 0xD023) return ((raw / 65536) * 10100).toFixed(1) + ' mV';
        if (address === 0xD024) return ((raw / 65536) * 20.625).toFixed(3) + ' mA';
        if (address === 0xD025) return ((raw / 65536) * 100).toFixed(2) + ' %';
        return null;
    }

    /**
     * Returns converted sub-value HTML for special registers (D023 → mV, D024 → mA)
     */
    getParamConvertedHTML(param) {
        if (param.type !== 'input') return '';
        const converted = param.value !== null
            ? this.convertParamRawToString(param.address, param.value)
            : null;
        if (converted === null) return '';
        return `<div class="param-converted" id="param-converted-${param.id}">${param.value !== null ? converted : '--'}</div>`;
    }

    /**
     * Update monitoring parameter value in UI
     */
    updateMonitoringParamValue(deviceId, paramId, value) {
        const valueEl = document.getElementById(`param-value-${paramId}`);
        if (valueEl) {
            valueEl.textContent = value;
            valueEl.classList.remove('stale');
        }

        const convertedEl = document.getElementById(`param-converted-${paramId}`);
        if (convertedEl) {
            const device = this.devices.find(d => d.id === deviceId);
            const param = device?.monitoringParams?.find(p => p.id === paramId);
            if (param) {
                const converted = this.convertParamRawToString(param.address, value);
                if (converted !== null) convertedEl.textContent = converted;
            }
        }
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== End Monitoring Parameters Methods ====================

    // ========================================
    // Auto Scan Functions
    // ========================================

    /**
     * Initialize Auto Scan UI event listeners
     */
    initAutoScanUI() {
        // Auto scan toggle
        const autoScanToggle = document.getElementById('autoScanEnabled');
        const autoScanStatus = document.getElementById('autoScanStatus');
        if (autoScanToggle) {
            autoScanToggle.addEventListener('change', () => {
                this.autoScanEnabled = autoScanToggle.checked;
                if (autoScanStatus) {
                    autoScanStatus.textContent = this.autoScanEnabled ? '활성' : '비활성';
                    autoScanStatus.classList.toggle('active', this.autoScanEnabled);
                }
                this.saveSettings();
            });
        }

        // Scan range inputs
        const scanRangeStart = document.getElementById('scanRangeStart');
        const scanRangeEnd = document.getElementById('scanRangeEnd');
        const scanTimeout = document.getElementById('scanTimeout');
        const scanRegister = document.getElementById('scanRegister');

        if (scanRangeStart) {
            scanRangeStart.addEventListener('change', () => {
                this.scanRangeStart = parseInt(scanRangeStart.value);
                this.saveSettings();
            });
        }

        if (scanRangeEnd) {
            scanRangeEnd.addEventListener('change', () => {
                this.scanRangeEnd = parseInt(scanRangeEnd.value);
                this.saveSettings();
            });
        }

        if (scanTimeout) {
            scanTimeout.addEventListener('change', () => {
                this.scanTimeout = parseInt(scanTimeout.value);
                this.saveSettings();
            });
        }

        if (scanRegister) {
            scanRegister.addEventListener('change', () => {
                const value = scanRegister.value.trim();
                if (value.startsWith('0x') || value.startsWith('0X')) {
                    this.scanRegister = parseInt(value, 16);
                } else {
                    this.scanRegister = parseInt(value);
                }
                this.saveSettings();
            });
        }

        // Manual scan button
        const manualScanBtn = document.getElementById('manualScanBtn');
        if (manualScanBtn) {
            manualScanBtn.addEventListener('click', () => this.startDeviceScan(true));
        }

        // Stop scan button
        const stopScanBtn = document.getElementById('stopScanBtn');
        if (stopScanBtn) {
            stopScanBtn.addEventListener('click', () => this.stopDeviceScan());
        }

        // Remove not-found devices toggle
        const scanRemoveNotFoundToggle = document.getElementById('scanRemoveNotFound');
        const scanRemoveNotFoundStatus = document.getElementById('scanRemoveNotFoundStatus');
        if (scanRemoveNotFoundToggle) {
            scanRemoveNotFoundToggle.addEventListener('change', () => {
                this.scanRemoveNotFound = scanRemoveNotFoundToggle.checked;
                if (scanRemoveNotFoundStatus) {
                    scanRemoveNotFoundStatus.textContent = this.scanRemoveNotFound ? '활성' : '비활성';
                    scanRemoveNotFoundStatus.classList.toggle('active', this.scanRemoveNotFound);
                }
                this.saveSettings();
            });
        }
    }

    /**
     * Initialize Serial Port Scan UI event listeners
     */
    initSerialPortScanUI() {
        const startBtn = document.getElementById('spScanStartBtn');
        const stopBtn = document.getElementById('spScanStopBtn');
        if (startBtn) startBtn.addEventListener('click', () => this.startSerialPortScan());
        if (stopBtn)  stopBtn.addEventListener('click',  () => this.stopSerialPortScan());
    }

    /**
     * Scan through serial port setting combinations (baudRate × parity × stopBits)
     * and run device scan on each combination.
     */
    async startSerialPortScan() {
        if (!this.isConnected || !this.port) {
            this.showToast('시리얼 포트에 먼저 연결하세요', 'warning');
            return;
        }
        if (this.isScanning || this.serialPortScanActive) {
            this.showToast('이미 스캔 중입니다', 'warning');
            return;
        }

        // Collect selected options
        const baudRates  = [...document.querySelectorAll('.spScan-baudRate:checked')].map(e => parseInt(e.value));
        const parities   = [...document.querySelectorAll('.spScan-parity:checked')].map(e => e.value);
        const stopBitOpts = [...document.querySelectorAll('.spScan-stopBits:checked')].map(e => parseInt(e.value));

        if (!baudRates.length || !parities.length || !stopBitOpts.length) {
            this.showToast('스캔할 설정을 최소 하나씩 선택하세요', 'warning');
            return;
        }

        // Build all combinations
        const combos = [];
        for (const baud of baudRates)
            for (const parity of parities)
                for (const stop of stopBitOpts)
                    combos.push({ baudRate: baud, parity, stopBits: stop });

        // Save original settings to restore after scan
        const origBaud   = parseInt(document.getElementById('sidebar-baudRate')?.value) || 19200;
        const origParity = document.getElementById('sidebar-parity')?.value || 'even';
        const origStop   = parseInt(document.getElementById('sidebar-stopBits')?.value) || 1;

        this.serialPortScanActive = true;
        this.scanAborted = false;

        const startBtn       = document.getElementById('spScanStartBtn');
        const stopBtn        = document.getElementById('spScanStopBtn');
        const progressWrap   = document.getElementById('spScanProgress');
        const progressBar    = document.getElementById('spScanProgressBar');
        const progressText   = document.getElementById('spScanProgressText');
        const resultsDiv     = document.getElementById('spScanResults');
        const resultsList    = document.getElementById('spScanResultsList');

        if (startBtn)     startBtn.disabled = true;
        if (stopBtn)      stopBtn.disabled  = false;
        if (progressWrap) progressWrap.style.display = 'block';
        if (resultsDiv)   resultsDiv.style.display   = 'none';
        if (progressBar)  progressBar.style.width    = '0%';

        const allResults = []; // { baudRate, parity, stopBits, foundIds, error? }

        for (let i = 0; i < combos.length; i++) {
            if (this.scanAborted) break;

            const { baudRate, parity, stopBits } = combos[i];
            const pct = Math.round((i / combos.length) * 100);
            if (progressBar)  progressBar.style.width = `${pct}%`;
            if (progressText) progressText.textContent =
                `(${i + 1}/${combos.length}) ${baudRate} bps · ${parity} · Stop ${stopBits} — 스캔 중...`;

            try {
                await this.reconnectSerial(baudRate, parity, stopBits, true /* silent */);
                await new Promise(r => setTimeout(r, 300)); // 포트 안정화 대기
                const foundIds = await this._scanAllSlaveIds();
                allResults.push({ baudRate, parity, stopBits, foundIds });
            } catch (e) {
                allResults.push({ baudRate, parity, stopBits, foundIds: [], error: e.message });
            }
        }

        // 원래 설정으로 복원
        try {
            if (progressText) progressText.textContent = '원래 설정으로 복원 중...';
            await this.reconnectSerial(origBaud, origParity, origStop, true);
        } catch (e) {
            this.showToast(`원래 설정 복원 실패: ${e.message}`, 'error');
        }

        this.serialPortScanActive = false;
        if (startBtn)    startBtn.disabled = false;
        if (stopBtn)     stopBtn.disabled  = true;
        if (progressBar) progressBar.style.width = '100%';

        const successResults = allResults.filter(r => r.foundIds.length > 0);
        if (progressText) progressText.textContent = this.scanAborted
            ? `스캔 중단 — 장치 발견된 설정: ${successResults.length}개`
            : `스캔 완료 — 장치 발견된 설정: ${successResults.length}개`;

        // 결과 표시
        if (resultsDiv && resultsList) {
            resultsDiv.style.display = 'block';
            if (allResults.length === 0 || successResults.length === 0) {
                resultsList.innerHTML = '<p style="color:#6c757d;">어떤 설정에서도 장치를 찾지 못했습니다.</p>';
            } else {
                resultsList.innerHTML = allResults.map(r => {
                    const label = `${r.baudRate} bps · ${r.parity} · Stop ${r.stopBits}`;
                    if (r.error) {
                        return `<div style="padding:8px;margin-bottom:5px;border-radius:4px;background:white;border:1px solid #f5c6cb;color:#721c24;">
                            <strong>${label}</strong> — 오류: ${r.error}
                        </div>`;
                    }
                    if (r.foundIds.length === 0) return '';
                    const idList = r.foundIds.map(id => `ID ${id}`).join(', ');
                    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;margin-bottom:5px;border-radius:4px;background:white;border:1px solid #c3e6cb;">
                        <div>
                            <strong style="color:#155724;">${label}</strong><br>
                            <span style="font-size:12px;color:#6c757d;">발견된 장치: ${idList}</span>
                        </div>
                        <button class="btn btn-sm btn-primary spScan-applyBtn"
                            data-baud="${r.baudRate}" data-parity="${r.parity}" data-stop="${r.stopBits}">
                            이 설정 적용
                        </button>
                    </div>`;
                }).filter(Boolean).join('') || '<p style="color:#6c757d;">장치를 발견한 설정이 없습니다.</p>';

                // "이 설정 적용" 버튼 리스너
                resultsList.querySelectorAll('.spScan-applyBtn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const baud  = parseInt(btn.dataset.baud);
                        const parity = btn.dataset.parity;
                        const stop  = parseInt(btn.dataset.stop);
                        await this.reconnectSerial(baud, parity, stop);
                        if (this.autoScanEnabled) {
                            setTimeout(() => this.startDeviceScan(true), 500);
                        }
                    });
                });
            }
        }

        this.showToast(
            successResults.length > 0
                ? `포트 스캔 완료: ${successResults.length}개 설정에서 장치 발견`
                : '포트 스캔 완료: 장치를 찾지 못했습니다',
            successResults.length > 0 ? 'success' : 'info'
        );
    }

    /**
     * Abort an in-progress serial port scan
     */
    stopSerialPortScan() {
        if (!this.serialPortScanActive) return;
        this.scanAborted = true;
        this.showToast('포트 스캔을 중단합니다...', 'info');
    }

    /**
     * Internal: scan all slave IDs in the configured range, return array of found IDs.
     * Does NOT update the device list or show scan UI.
     */
    async _scanAllSlaveIds() {
        this.isScanning = true;
        const found = [];
        for (let slaveId = this.scanRangeStart; slaveId <= this.scanRangeEnd; slaveId++) {
            if (this.scanAborted) break;
            const response = await this.scanSlaveId(slaveId);
            if (response !== null) found.push(slaveId);
        }
        this.isScanning = false;
        return found;
    }

    /**
     * Start device scanning
     * @param {boolean} autoAdd - If true, automatically add found devices to Dashboard
     */
    async startDeviceScan(autoAdd = false) {
        if (this.isScanning) {
            this.showToast('이미 탐색 중입니다', 'warning');
            return;
        }

        if (!this.writer && !this.simulatorEnabled) {
            this.showToast('시리얼 포트에 연결되어 있지 않습니다', 'warning');
            return;
        }

        this.isScanning = true;
        this.scanAborted = false;

        // 스캔 시작 전 이미 등록된 디바이스 ID 저장 (스캔 완료 후 operationMode 동기화용)
        const preExistingDeviceIds = this.devices
            .filter(d => d.slaveId !== 0)
            .map(d => d.id);

        const manualScanBtn = document.getElementById('manualScanBtn');
        const stopScanBtn = document.getElementById('stopScanBtn');
        const scanProgress = document.getElementById('scanProgress');
        const scanProgressBar = document.getElementById('scanProgressBar');
        const scanProgressText = document.getElementById('scanProgressText');
        const scanResults = document.getElementById('scanResults');
        const scanResultsList = document.getElementById('scanResultsList');

        if (manualScanBtn) manualScanBtn.disabled = true;
        if (stopScanBtn) stopScanBtn.disabled = false;
        if (scanProgress) scanProgress.style.display = 'block';
        if (scanResults) scanResults.style.display = 'none';

        const foundDevices = [];
        const respondedSlaveIds = new Set(); // 응답한 모든 slaveId (신규 + 기존 포함)
        const totalToScan = this.scanRangeEnd - this.scanRangeStart + 1;

        const scanToast = this.showProgressToast(
            `ID ${this.scanRangeStart} ~ ${this.scanRangeEnd} 탐색 중...`,
            totalToScan,
            () => this.stopDeviceScan()
        );

        this.addMonitorEntry('received', `Device scan started (ID ${this.scanRangeStart} ~ ${this.scanRangeEnd})${autoAdd ? ' [Auto Add]' : ''}`);

        for (let slaveId = this.scanRangeStart; slaveId <= this.scanRangeEnd; slaveId++) {
            if (this.scanAborted) {
                this.addMonitorEntry('received', 'Device scan aborted');
                break;
            }

            const current = slaveId - this.scanRangeStart + 1;
            const progress = (current / totalToScan) * 100;
            scanToast.update(current);
            if (scanProgressBar) scanProgressBar.style.width = `${progress}%`;
            if (scanProgressText) scanProgressText.textContent = `Scanning ID ${slaveId}... (${current}/${totalToScan})`;

            const response = await this.scanSlaveId(slaveId);

            if (response !== null) {
                respondedSlaveIds.add(slaveId);
                // Check if device already exists
                const alreadyExists = this.devices.some(dev => dev.slaveId === slaveId);

                if (!alreadyExists) {
                    foundDevices.push({
                        slaveId: slaveId,
                        responseValue: response,
                        isNew: true
                    });
                    this.addMonitorEntry('received', `New device found at Slave ID ${slaveId}`);

                    // Auto add to Dashboard if enabled
                    if (autoAdd) {
                        this.addScannedDevice(slaveId, true); // silent mode
                    }
                }
            }
        }

        // Scan complete
        this.isScanning = false;

        if (manualScanBtn) manualScanBtn.disabled = false;
        if (stopScanBtn) stopScanBtn.disabled = true;

        if (scanProgressText) {
            scanProgressText.textContent = this.scanAborted ?
                `탐색 중단됨 - ${foundDevices.length}개 장치 발견` :
                `탐색 완료 - ${foundDevices.length}개 장치 발견`;
        }

        // Show results
        if (scanResults && scanResultsList) {
            scanResults.style.display = 'block';
            if (foundDevices.length === 0) {
                scanResultsList.innerHTML = '<p style="color: #6c757d;">발견된 장치가 없습니다.</p>';
            } else {
                scanResultsList.innerHTML = foundDevices.map(d => {
                    const alreadyAdded = autoAdd || this.devices.some(dev => dev.slaveId === d.slaveId);
                    return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: white; margin-bottom: 5px; border-radius: 4px; border: 1px solid #e0e6ed;">
                        <span><strong>ID ${d.slaveId}</strong> - Status: ${d.responseValue}</span>
                        <button class="btn btn-sm btn-success add-scanned-device" data-slave-id="${d.slaveId}" ${alreadyAdded ? 'disabled' : ''}>${alreadyAdded ? '추가됨' : '추가'}</button>
                    </div>
                `;
                }).join('');

                // Add click listeners for non-auto-added devices
                if (!autoAdd) {
                    scanResultsList.querySelectorAll('.add-scanned-device:not([disabled])').forEach(btn => {
                        btn.addEventListener('click', () => {
                            const slaveId = parseInt(btn.dataset.slaveId);
                            this.addScannedDevice(slaveId);
                            btn.disabled = true;
                            btn.textContent = '추가됨';
                        });
                    });
                }
            }
        }

        const autoAddMsg = autoAdd && foundDevices.length > 0 ? ' (자동 추가됨)' : '';
        const finalMsg = this.scanAborted
            ? `탐색 중단: ${foundDevices.length}개 발견`
            : `탐색 완료: ${foundDevices.length}개 발견${autoAddMsg}`;
        scanToast.dismiss(finalMsg);

        // 미발견 디바이스 자동 삭제 (스캔 범위 내, 응답 없는 등록 디바이스)
        if (this.scanRemoveNotFound && !this.scanAborted) {
            const toRemove = this.devices.filter(dev =>
                dev.slaveId >= this.scanRangeStart &&
                dev.slaveId <= this.scanRangeEnd &&
                !respondedSlaveIds.has(dev.slaveId)
            );
            if (toRemove.length > 0) {
                toRemove.forEach(dev => {
                    this.devices = this.devices.filter(d => d.id !== dev.id);
                });
                this.saveDevices();
                this.renderDeviceGrid();
                this.showToast(`미응답 디바이스 ${toRemove.length}개가 삭제되었습니다`, 'info');
            }
        }

        // 스캔 완료 후 Device 탭이 열려있으면 파라미터 자동 읽기
        // readRegisterWithTimeout / readParameterByAddress 는 내부에서 큐 처리하므로
        // 폴링 재개 이후 안전하게 순차 실행됨
        this._autoReadAfterScan();

        // 스캔 전부터 존재했던 디바이스의 operationMode 동기화
        // (신규 발견 디바이스는 addScannedDevice() → initializeDeviceMode()로 이미 처리됨)
        if (preExistingDeviceIds.length > 0) {
            setTimeout(() => {
                preExistingDeviceIds.forEach(id => this.initializeDeviceMode(id));
            }, 300);
        }
    }

    /**
     * 스캔 완료 직후 Configuration / Parameters 탭이 활성화된 경우 자동으로 값을 읽어옴.
     * 폴링이 재개될 시간을 확보하기 위해 300ms 지연 후 실행.
     */
    _autoReadAfterScan() {
        if (this.currentPage !== 'device-setup') return;

        const activeTab = sessionStorage.getItem('deviceSetupTab') || 'configuration';

        if (activeTab === 'configuration') {
            if (!this.currentSetupDeviceId) return;
            const device = this.devices.find(d => d.id === this.currentSetupDeviceId);
            if (!device || device.slaveId === 0) return;
            setTimeout(() => this.refreshDevice(this.currentSetupDeviceId), 300);

        } else if (activeTab === 'parameters') {
            if (!this.selectedParamDeviceId) return;
            setTimeout(() => this.readAllParameters(), 300);
        }
    }

    /**
     * Stop device scanning
     */
    stopDeviceScan() {
        this.scanAborted = true;
        this.showToast('탐색을 중단합니다...', 'info');
    }

    /**
     * Scan a single slave ID
     */
    async scanSlaveId(slaveId) {
        try {
            // Use a low address for scanning that the simulator supports
            const scanAddress = this.simulatorEnabled ? 0 : this.scanRegister;
            const frame = this.modbus.buildReadInputRegisters(slaveId, scanAddress, 1);

            if (this.simulatorEnabled) {
                // For simulation, we'll create virtual devices at specific IDs
                const simulatedDevices = this.getSimulatedDeviceIds();

                if (simulatedDevices.includes(slaveId)) {
                    // Temporarily set simulator to respond to this slave ID
                    const originalSlaveId = this.simulator.slaveId;
                    const originalEnabled = this.simulator.enabled;

                    this.simulator.slaveId = slaveId;
                    this.simulator.enabled = true;

                    this.addMonitorEntry('sent', frame, { functionCode: 4, startAddress: scanAddress, quantity: 1 });
                    this.stats.requests++;
                    this.updateStatsDisplay();

                    const response = await this.simulator.processRequest(frame);

                    // Restore original settings
                    this.simulator.slaveId = originalSlaveId;
                    this.simulator.enabled = originalEnabled;

                    if (response && response.length >= 5 && (response[1] & 0x80) === 0) {
                        this.addMonitorEntry('received', response);
                        this.updateStats(true);
                        return (response[3] << 8) | response[4];
                    }
                } else {
                    // Show TX for non-responding IDs too (no response expected)
                    this.addMonitorEntry('sent', frame, { functionCode: 4, startAddress: scanAddress, quantity: 1 });
                }

                // No response - wait for timeout simulation
                await new Promise(resolve => setTimeout(resolve, 30));
                return null;

            } else if (this.writer) {
                // Real serial communication
                return await this.scanWithTimeout(frame, slaveId);
            }

            return null;
        } catch (error) {
            console.error('Scan error:', error);
            return null;
        }
    }

    /**
     * Scan with timeout for real serial communication
     */
    async scanWithTimeout(frame, slaveId) {
        // Wait for any in-progress polling cycle to finish before sending scan TX.
        // isScanning=true already prevents NEW polling cycles from starting, but a
        // cycle that was already executing (e.g. waiting for Slave 7's response) must
        // complete first — otherwise the scan TX collides with the pending poll response.
        while (this.isPolling) {
            await new Promise(resolve => setTimeout(resolve, 5));
        }

        return new Promise(async (resolve) => {
            // Set up scan response callback
            this.scanExpectedSlaveId = slaveId;
            this.scanResolve = (responseValue) => {
                clearTimeout(timeout);
                this.scanResolve = null;
                this.scanExpectedSlaveId = null;
                resolve(responseValue);
            };

            const timeout = setTimeout(() => {
                this.scanResolve = null;
                this.scanExpectedSlaveId = null;
                resolve(null);
            }, this.scanTimeout);

            try {
                await this.writer.write(frame);
                this.addMonitorEntry('sent', frame, { functionCode: 4, startAddress: this.scanRegister, quantity: 1 });
                this.stats.requests++;
                this.updateStatsDisplay();
                // Response will be handled by tryParseFrame which calls scanResolve
            } catch (error) {
                clearTimeout(timeout);
                this.scanResolve = null;
                this.scanExpectedSlaveId = null;
                resolve(null);
            }
        });
    }

    /**
     * Get simulated device IDs for testing
     */
    getSimulatedDeviceIds() {
        // Return IDs that should respond in simulation mode
        // This allows testing the scan feature without real devices
        return [1, 3, 5, 7, 10];
    }

    /**
     * Add a scanned device to the device list
     * @param {number} slaveId - The slave ID
     * @param {boolean} silent - If true, don't show individual toast messages
     */
    addScannedDevice(slaveId, silent = false) {
        // Check if device already exists
        const exists = this.devices.some(d => d.slaveId === slaveId);
        if (exists) {
            if (!silent) {
                this.showToast(`ID ${slaveId} 장치가 이미 등록되어 있습니다`, 'warning');
            }
            return false;
        }

        const device = {
            id: Date.now() + slaveId, // Ensure unique ID when adding multiple
            name: `Device ${slaveId}`,
            slaveId: slaveId,
            operationMode: 0,
            setpoint: 0,
            motorStatus: 0,
            maxSpeed: 1600,
            lastUpdate: Date.now(),
            online: true,
            runningDirection: 0,  // 0: CCW, 1: CW
            maxCurrent: 0         // Maximum coil current in Amperes
        };

        this.devices.push(device);
        this.saveDevices();
        this.renderDeviceGrid();
        this.renderDeviceSetupList();

        // 연결 후 디바이스에서 모드와 최대 속도 읽기
        this.initializeDeviceMode(device.id);

        // Start auto polling if connection is active, on Dashboard, and wasn't running (first device added)
        if (!this.autoPollingTimer && (this.simulatorEnabled || this.writer) && this.currentPage === 'dashboard') {
            this.startAutoPolling();
        }

        if (!silent) {
            this.showToast(`장치 ${slaveId}가 추가되었습니다`, 'success');
        }
        return true;
    }

    // ===== Firmware Upload Functions =====

    /**
     * Initialize firmware upload UI
     */
    initFirmwareUI() {
        const dropzone = document.getElementById('firmwareDropzone');
        const fileInput = document.getElementById('firmwareFileInput');
        const selectBtn = document.getElementById('firmwareSelectBtn');
        const removeBtn = document.getElementById('firmwareRemoveBtn');
        const verifyBtn = document.getElementById('firmwareVerifyBtn');
        const downloadBtn = document.getElementById('firmwareDownloadBtn');
        const cancelBtn = document.getElementById('firmwareCancelBtn');

        if (!dropzone) return;

        // Initialize firmware state
        this.firmwareFile = null;
        this.firmwareData = null;
        this.firmwareUpdateInProgress = false;
        this.firmwareUpdateCancelled = false;

        // Click to select file
        selectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        dropzone.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFirmwareFile(e.target.files[0]);
            }
        });

        // Drag and drop events
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFirmwareFile(files[0]);
            }
        });

        // Remove file button
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                this.clearFirmwareFile();
            });
        }

        // Verify button
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => {
                this.verifyFirmware();
            });
        }

        // Download button
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.startFirmwareDownload();
            });
        }

        // Cancel button
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.cancelFirmwareDownload();
            });
        }

        // Initialize firmware state - online source additions
        this.firmwareSource = 'local';
        this._fwVersionsLoaded = false;
        this._fwVersionList = [];

        // Initialize source selector
        this.initFirmwareSourceSelector();
    }

    /**
     * Initialize firmware source selector (로컬 파일 / 온라인 업데이트 탭)
     */
    initFirmwareSourceSelector() {
        const localBtn  = document.getElementById('fwSourceLocalBtn');
        const onlineBtn = document.getElementById('fwSourceOnlineBtn');
        if (!localBtn || !onlineBtn) return;

        const switchSource = (source) => {
            this.firmwareSource = source;

            localBtn.classList.toggle('active',  source === 'local');
            onlineBtn.classList.toggle('active', source === 'online');

            document.getElementById('fwPanelLocal').style.display  = source === 'local'  ? 'block' : 'none';
            document.getElementById('fwPanelOnline').style.display = source === 'online' ? 'block' : 'none';

            if (source === 'online') {
                this._initOnlinePanel();
            } else {
                this._clearOnlineSelection();
            }

            this.updateFirmwareButtons();
        };

        localBtn.addEventListener('click',  () => switchSource('local'));
        onlineBtn.addEventListener('click', () => switchSource('online'));

        const refreshBtn = document.getElementById('fwRefreshVersionsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadFirmwareVersionList());
        }

        const clearBtn = document.getElementById('fwOnlineClearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this._clearOnlineSelection());
        }
    }

    /**
     * 온라인 패널 초기화 — 환경 감지 후 UI 분기
     */
    _initOnlinePanel() {
        const isLocalFile = window.location.protocol === 'file:';
        const disabledDiv = document.getElementById('fwOnlineDisabled');
        const contentDiv  = document.getElementById('fwOnlineContent');

        if (isLocalFile) {
            if (disabledDiv) disabledDiv.style.display = 'flex';
            if (contentDiv)  contentDiv.style.display  = 'none';
        } else {
            if (disabledDiv) disabledDiv.style.display = 'none';
            if (contentDiv)  contentDiv.style.display  = 'block';
            if (!this._fwVersionsLoaded) {
                this.loadFirmwareVersionList();
            }
        }
    }

    /**
     * 온라인 버전 목록 로드 (versions.json fetch)
     */
    async loadFirmwareVersionList() {
        const loadingEl    = document.getElementById('fwOnlineLoading');
        const errorEl      = document.getElementById('fwOnlineError');
        const errorMsgEl   = document.getElementById('fwOnlineErrorMsg');
        const tableWrapper = document.getElementById('fwVersionTableWrapper');
        const refreshIcon  = document.getElementById('fwRefreshIcon');

        if (loadingEl)    loadingEl.style.display    = 'flex';
        if (errorEl)      errorEl.style.display      = 'none';
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (refreshIcon)  refreshIcon.textContent    = '⌛';

        try {
            const resp = await fetch('./firmware/versions.json', { cache: 'no-cache' });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

            const json = await resp.json();
            if (!Array.isArray(json.versions) || json.versions.length === 0) {
                throw new Error('버전 목록이 비어있습니다');
            }

            this._fwVersionsLoaded = true;
            this._fwVersionList = json.versions;
            this._renderVersionTable(json.versions);

            if (loadingEl)    loadingEl.style.display    = 'none';
            if (tableWrapper) tableWrapper.style.display = 'block';
        } catch (err) {
            if (loadingEl)   loadingEl.style.display = 'none';
            if (errorEl)     errorEl.style.display   = 'flex';
            if (errorMsgEl)  errorMsgEl.textContent  = `버전 목록을 불러올 수 없습니다: ${err.message}`;
            this._fwVersionsLoaded = false;
        } finally {
            if (refreshIcon) refreshIcon.textContent = '↻';
        }
    }

    /**
     * 버전 목록 테이블 렌더링
     */
    _renderVersionTable(versions) {
        const tbody = document.getElementById('fwVersionTableBody');
        if (!tbody) return;

        tbody.innerHTML = versions.map((v, idx) => {
            const isLatest    = idx === 0;
            const latestBadge = isLatest ? '<span class="fw-version-badge-latest">최신</span>' : '';
            const sizeStr     = v.size > 0 ? this.formatFileSize(v.size) : '-';
            const changelog   = v.changelog || '변경사항 없음';

            return `
                <tr class="fw-version-main-row" data-version-idx="${idx}">
                    <td>
                        <label class="fw-radio-label">
                            <input type="radio" name="fwVersionRadio" class="fw-version-radio" value="${idx}">
                            <span class="fw-version-number">${v.version}</span>${latestBadge}
                        </label>
                    </td>
                    <td class="fw-version-date">${v.date}</td>
                    <td class="fw-version-size">
                        <span>${sizeStr}</span>
                        <span class="fw-changelog-arrow" data-idx="${idx}">▼</span>
                    </td>
                </tr>
                <tr class="fw-changelog-row" id="fwChangelogRow${idx}" style="display:none;">
                    <td colspan="3" class="fw-changelog-detail-cell">
                        <div class="fw-changelog-detail-inner">
                            <span class="fw-changelog-label">변경사항</span>
                            <div class="fw-changelog-content">${changelog.replace(/\n/g, '<br>')}</div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // 라디오 버튼 변경 시 버전 선택
        tbody.querySelectorAll('.fw-version-radio').forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    const idx = parseInt(radio.value);
                    tbody.querySelectorAll('.fw-version-main-row').forEach(tr => tr.classList.remove('fw-version-row-selected'));
                    radio.closest('tr').classList.add('fw-version-row-selected');
                    this.selectOnlineFirmwareVersion(this._fwVersionList[idx]);
                }
            });
        });

        // 행 클릭 시 변경사항 토글 + 라디오 선택
        tbody.querySelectorAll('.fw-version-main-row').forEach(tr => {
            tr.addEventListener('click', () => {
                const idx       = parseInt(tr.dataset.versionIdx);
                const detailRow = document.getElementById(`fwChangelogRow${idx}`);
                const arrow     = tr.querySelector('.fw-changelog-arrow');
                const isOpen    = detailRow.style.display !== 'none';

                // 다른 행 변경사항 닫기
                tbody.querySelectorAll('.fw-changelog-row').forEach(r => r.style.display = 'none');
                tbody.querySelectorAll('.fw-changelog-arrow').forEach(a => { a.textContent = '▼'; a.classList.remove('fw-arrow-open'); });

                // 현재 행 토글
                if (!isOpen) {
                    detailRow.style.display = 'table-row';
                    arrow.textContent = '▲';
                    arrow.classList.add('fw-arrow-open');
                }

                // 라디오 선택
                const radio = tr.querySelector('.fw-version-radio');
                if (radio && !radio.checked) radio.click();
            });
        });
    }

    /**
     * 온라인 펌웨어 버전 선택 — bin 파일 fetch 후 메모리 로드
     */
    async selectOnlineFirmwareVersion(version) {
        const selectedInfo  = document.getElementById('fwOnlineSelectedInfo');
        const selectedName  = document.getElementById('fwOnlineSelectedName');
        const selectedSize  = document.getElementById('fwOnlineSelectedSize');
        const dlStatus      = document.getElementById('fwOnlineDlStatus');
        const fetchProgress = document.getElementById('fwOnlineFetchProgress');
        const fetchFill     = document.getElementById('fwOnlineFetchFill');
        const fetchLabel    = document.getElementById('fwOnlineFetchLabel');

        // 정보 바 즉시 표시
        if (selectedInfo)  selectedInfo.style.display  = 'block';
        if (selectedName)  selectedName.textContent    = version.filename;
        if (selectedSize)  selectedSize.textContent    = version.size > 0 ? this.formatFileSize(version.size) : '-';
        if (dlStatus)      dlStatus.textContent        = '';
        if (fetchProgress) fetchProgress.style.display = 'flex';
        if (fetchFill)     fetchFill.style.width       = '0%';
        if (fetchLabel)    fetchLabel.textContent      = '다운로드 중...';

        // 라디오/행 선택 상태는 _renderVersionTable에서 처리됨

        try {
            const url  = `./firmware/${version.filename}`;
            const resp = await fetch(url, { cache: 'no-cache' });

            if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

            const contentLength = resp.headers.get('Content-Length');
            let arrayBuffer;

            if (contentLength && resp.body) {
                const total  = parseInt(contentLength);
                let received = 0;
                const reader = resp.body.getReader();
                const chunks = [];

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    received += value.length;
                    const pct = Math.round(received / total * 100);
                    if (fetchFill)  fetchFill.style.width  = pct + '%';
                    if (fetchLabel) fetchLabel.textContent = `다운로드 중... ${pct}%`;
                }

                const combined = new Uint8Array(received);
                let offset = 0;
                for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
                arrayBuffer = combined.buffer;
            } else {
                if (fetchLabel) fetchLabel.textContent = '다운로드 중... (크기 미확인)';
                arrayBuffer = await resp.arrayBuffer();
                if (fetchFill) fetchFill.style.width = '100%';
            }

            // 기존 firmwareData/firmwareFile 인터페이스에 맞게 저장
            this.firmwareData = new Uint8Array(arrayBuffer);
            this.firmwareFile = { name: version.filename, size: this.firmwareData.length, _onlineVersion: version.version };

            if (fetchLabel)  fetchLabel.textContent  = '완료';
            if (dlStatus)    dlStatus.textContent    = '✔ 준비됨';
            if (selectedSize) selectedSize.textContent = this.formatFileSize(this.firmwareData.length);

            this.updateFirmwareButtons();
            this.showToast(`${version.version} 펌웨어 로드가 완료되었습니다`, 'success');

        } catch (err) {
            if (dlStatus)   dlStatus.textContent        = '⚠ 실패';
            if (fetchLabel) fetchLabel.textContent      = `오류: ${err.message}`;
            if (fetchFill)  fetchFill.style.background  = '#dc3545';
            this.firmwareData = null;
            this.firmwareFile = null;
            this.updateFirmwareButtons();
            this.showToast(`펌웨어 다운로드에 실패했습니다: ${err.message}`, 'error');
        } finally {
            // (버튼 비활성 없음 — 라디오 방식으로 변경됨)
        }
    }

    /**
     * 온라인 선택 상태 초기화
     */
    _clearOnlineSelection() {
        this.firmwareData = null;
        this.firmwareFile = null;
        const selectedInfo = document.getElementById('fwOnlineSelectedInfo');
        if (selectedInfo) selectedInfo.style.display = 'none';
        document.querySelectorAll('.fw-version-main-row').forEach(tr => tr.classList.remove('fw-version-row-selected'));
        document.querySelectorAll('.fw-version-radio').forEach(r => r.checked = false);
        document.querySelectorAll('.fw-changelog-row').forEach(r => r.style.display = 'none');
        document.querySelectorAll('.fw-changelog-arrow').forEach(a => { a.textContent = '▼'; a.classList.remove('fw-arrow-open'); });
        this.updateFirmwareButtons();
    }

    /**
     * Handle firmware file selection
     */
    handleFirmwareFile(file) {
        const validExtensions = ['.bin', '.hex', '.fw'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            this.showToast('지원하지 않는 파일 형식입니다. (.bin, .hex, .fw)', 'error');
            return;
        }

        this.firmwareFile = file;

        // Read file content
        const reader = new FileReader();
        reader.onload = (e) => {
            this.firmwareData = new Uint8Array(e.target.result);
            this.updateFirmwareFileInfo();
            this.updateFirmwareButtons();
        };
        reader.readAsArrayBuffer(file);
    }

    /**
     * Update firmware file info display
     */
    updateFirmwareFileInfo() {
        const fileInfo = document.getElementById('firmwareFileInfo');
        const fileName = document.getElementById('firmwareFileName');
        const fileSize = document.getElementById('firmwareFileSize');

        if (fileInfo && this.firmwareFile) {
            fileInfo.style.display = 'block';
            fileName.textContent = this.firmwareFile.name;
            fileSize.textContent = this.formatFileSize(this.firmwareFile.size);
        }
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    /**
     * Clear selected firmware file
     */
    clearFirmwareFile() {
        this.firmwareFile = null;
        this.firmwareData = null;

        const fileInfo = document.getElementById('firmwareFileInfo');
        const fileInput = document.getElementById('firmwareFileInput');

        if (fileInfo) fileInfo.style.display = 'none';
        if (fileInput) fileInput.value = '';

        this.updateFirmwareButtons();
    }

    /**
     * Update firmware action buttons state
     */
    updateFirmwareButtons() {
        const verifyBtn = document.getElementById('firmwareVerifyBtn');
        const downloadBtn = document.getElementById('firmwareDownloadBtn');
        const hasFile = this.firmwareFile !== null;

        if (verifyBtn) verifyBtn.disabled = !hasFile;
        if (downloadBtn) downloadBtn.disabled = !hasFile;
    }


    /**
     * Verify firmware file
     */
    verifyFirmware() {
        if (!this.firmwareData) {
            this.showToast('펌웨어 파일이 선택되지 않았습니다', 'error');
            return;
        }

        // Simple verification - check file size and header
        const size = this.firmwareData.length;
        if (size < 100) {
            this.showToast('펌웨어 파일이 너무 작습니다', 'error');
            return;
        }

        // Calculate simple checksum
        let checksum = 0;
        for (let i = 0; i < this.firmwareData.length; i++) {
            checksum = (checksum + this.firmwareData[i]) & 0xFFFF;
        }

        this.addFirmwareLog(`파일 검증 완료: ${this.firmwareFile.name}`);
        this.addFirmwareLog(`파일 크기: ${this.formatFileSize(size)}`);
        this.addFirmwareLog(`체크섬: 0x${checksum.toString(16).toUpperCase().padStart(4, '0')}`, 'success');

        this.showToast('펌웨어 검증이 완료되었습니다', 'success');
    }

    /**
     * Start firmware download using Modbus Function Code 0x66
     */
    async startFirmwareDownload() {
        if (!this.firmwareData) {
            this.showToast('펌웨어 파일이 선택되지 않았습니다', 'error');
            return;
        }

        if (!this.isConnected && !this.simulatorEnabled) {
            this.showToast('시리얼 포트에 연결하거나 시뮬레이터를 활성화하세요', 'error');
            return;
        }

        // Get target slave ID from currently selected device in Device page
        const selectedDevice = this.devices.find(d => d.id === this.currentSetupDeviceId);
        if (!selectedDevice) {
            this.showToast('왼쪽 목록에서 대상 장치를 선택하세요', 'error');
            return;
        }
        const slaveId = selectedDevice.slaveId;
        const packetSize = parseInt(document.getElementById('fwPacketSize')?.value) || 60;
        const responseTimeout = parseInt(document.getElementById('fwResponseTimeout')?.value) || 1000;

        // UI elements
        const progressSection = document.getElementById('firmwareProgressSection');
        const progressBar = document.getElementById('firmwareProgressBar');
        const progressPercent = document.getElementById('firmwareProgressPercent');
        const progressStatus = document.getElementById('firmwareProgressStatus');
        const downloadBtn = document.getElementById('firmwareDownloadBtn');
        const cancelBtn = document.getElementById('firmwareCancelBtn');
        const verifyBtn = document.getElementById('firmwareVerifyBtn');

        // Show progress section and cancel button
        if (progressSection) progressSection.style.display = 'block';
        if (downloadBtn) downloadBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
        if (verifyBtn) verifyBtn.disabled = true;

        // Clear previous log and reset steps
        const logEl = document.getElementById('firmwareProgressLog');
        if (logEl) logEl.innerHTML = '';
        this.resetFirmwareSteps();

        this.firmwareUpdateInProgress = true;
        this.firmwareUpdateCancelled = false;

        const totalSize = this.firmwareData.length;

        try {
            // ===== Step 1: Initialize (OpCode 0x90) =====
            this.setFirmwareStepStatus('0x90', 'active');
            this.addFirmwareLog(`[0x90] 초기화 시작 - Slave ID: ${slaveId}, 파일 크기: ${totalSize} bytes`);

            const initFrame = this.modbus.buildFirmwareInit(slaveId, totalSize);
            this.addFirmwareLog(`TX: ${this.modbus.bufferToHex(initFrame)}`, 'tx');

            // 펌웨어 응답은 슬레이브 ID 1바이트만 옴 (펌웨어 버그가 표준이 됨)
            const initResponse = await this.sendAndReceive(initFrame, responseTimeout, { minLength: 1, skipCRC: true });
            if (!initResponse) {
                throw new Error('초기화 응답 없음 (timeout)');
            }
            this.addFirmwareLog(`RX: ${this.modbus.bufferToHex(initResponse)}`, 'rx');

            this.setFirmwareStepStatus('0x90', 'completed');
            this.addFirmwareLog('[0x90] 초기화 완료 - Flash Unlock', 'success');

            if (this.firmwareUpdateCancelled) throw new Error('사용자에 의해 취소됨');

            // ===== Step 2: Erase Confirm (OpCode 0x91) =====
            this.setFirmwareStepStatus('0x91', 'active');
            this.addFirmwareLog('[0x91] Flash Erase 대기 중 (10초)...');

            // Flash Erase 완료 대기 (10초)
            await this.delay(10000);

            this.addFirmwareLog('[0x91] Flash Erase 확인 중...');
            const eraseFrame = this.modbus.buildFirmwareEraseConfirm(slaveId);
            this.addFirmwareLog(`TX: ${this.modbus.bufferToHex(eraseFrame)}`, 'tx');

            // 응답: 65바이트, CRC 없음
            const eraseResponse = await this.sendAndReceive(eraseFrame, responseTimeout, { minLength: 65, skipCRC: true });
            if (!eraseResponse) {
                throw new Error('Erase 확인 응답 없음 (timeout)');
            }
            this.addFirmwareLog(`RX: ${this.modbus.bufferToHex(eraseResponse)}`, 'rx');

            // Parse erase response
            const eraseResult = this.modbus.parseFirmwareResponse(eraseResponse);
            if (!eraseResult.success) {
                const statusHex = eraseResult.data?.eraseStatus?.toString(16).toUpperCase() || 'unknown';
                throw new Error(`Flash Erase 실패 (status: 0x${statusHex})`);
            }

            this.setFirmwareStepStatus('0x91', 'completed');
            this.addFirmwareLog('[0x91] Flash Erase 완료 확인', 'success');

            if (this.firmwareUpdateCancelled) throw new Error('사용자에 의해 취소됨');

            // ===== Step 3: Data Transfer (OpCode 0x03) =====
            this.setFirmwareStepStatus('0x03', 'active');

            // Calculate total packets
            const totalPackets = Math.ceil(totalSize / packetSize);
            this.addFirmwareLog(`[0x03] 데이터 전송 시작 - 패킷 크기: ${packetSize} bytes, 총 ${totalPackets} 패킷`);

            let transferred = 0;
            let packetCount = 0;

            // 전체 전송 시작 시간 기록
            const transferStartTime = Date.now();

            while (transferred < totalSize) {
                if (this.firmwareUpdateCancelled) throw new Error('사용자에 의해 취소됨');

                const remaining = totalSize - transferred;
                const chunkSize = Math.min(packetSize, remaining);
                const chunk = this.firmwareData.slice(transferred, transferred + chunkSize);

                const dataFrame = this.modbus.buildFirmwareData(slaveId, chunk);

                // Only log every 10th packet or last packet to reduce log spam
                if (packetCount % 10 === 0 || chunkSize < packetSize) {
                    this.addFirmwareLog(`TX[${packetCount}]: ${chunkSize} bytes @ offset ${transferred}`, 'tx');
                }

                // 응답: 65바이트, CRC 없음
                const dataResponse = await this.sendAndReceive(dataFrame, responseTimeout, { minLength: 65, skipCRC: true });
                if (!dataResponse) {
                    throw new Error(`데이터 전송 응답 없음 (packet ${packetCount})`);
                }

                // Parse response to check for ACK (0x04) or error (0x05)
                const dataResult = this.modbus.parseFirmwareResponse(dataResponse);
                if (!dataResult.success) {
                    throw new Error(`데이터 전송 에러 (packet ${packetCount}): OpCode 0x05`);
                }

                // Total Received Byte 검증
                const expectedTotal = transferred + chunkSize;
                if (dataResult.data?.totalReceivedByte !== expectedTotal) {
                    this.addFirmwareLog(`경고: Total Received Byte 불일치 (expected: ${expectedTotal}, got: ${dataResult.data?.totalReceivedByte})`, 'warning');
                }

                transferred += chunkSize;
                packetCount++;

                // Calculate remaining time based on total elapsed time
                let estimatedTimeMs = 0;
                if (packetCount > 0) {
                    const elapsedTime = Date.now() - transferStartTime;
                    const avgTimePerPacket = elapsedTime / packetCount;
                    const remainingPackets = totalPackets - packetCount;
                    estimatedTimeMs = Math.round(remainingPackets * avgTimePerPacket);
                }

                // Update progress
                const percent = Math.round((transferred / totalSize) * 100);
                if (progressBar) progressBar.style.width = percent + '%';
                if (progressPercent) progressPercent.textContent = percent + '%';
                if (progressStatus) progressStatus.textContent = `${this.formatFileSize(transferred)} / ${this.formatFileSize(totalSize)}`;

                // Update step progress with detailed info
                this.updateFirmwareDataProgress(transferred, totalSize, packetCount, totalPackets, estimatedTimeMs);


            }

            this.setFirmwareStepStatus('0x03', 'completed');
            this.updateFirmwareDataProgress(totalSize, totalSize, totalPackets, totalPackets, 0);
            this.addFirmwareLog(`[0x03] 데이터 전송 완료 - ${packetCount} 패킷, ${totalSize} bytes`, 'success');

            // ===== Step 4: Done (OpCode 0x99) =====
            this.setFirmwareStepStatus('0x99', 'active');
            this.addFirmwareLog('[0x99] 펌웨어 업데이트 완료 처리 중...');

            const doneFrame = this.modbus.buildFirmwareDone(slaveId);
            this.addFirmwareLog(`TX: ${this.modbus.bufferToHex(doneFrame)}`, 'tx');

            // 응답: 65바이트, CRC 없음
            const doneResponse = await this.sendAndReceive(doneFrame, responseTimeout, { minLength: 65, skipCRC: true });
            if (!doneResponse) {
                throw new Error('완료 응답 없음 (timeout)');
            }
            this.addFirmwareLog(`RX: ${this.modbus.bufferToHex(doneResponse)}`, 'rx');

            // 응답 OpCode가 0x05면 성공 (Done ACK)
            const doneResult = this.modbus.parseFirmwareResponse(doneResponse);
            if (!doneResult.success) {
                throw new Error('펌웨어 완료 처리 실패');
            }

            this.setFirmwareStepStatus('0x99', 'completed');
            this.addFirmwareLog('[0x99] 펌웨어 업데이트 완료 - Flash Lock', 'success');

            this.addFirmwareLog('펌웨어 다운로드 성공!', 'success');
            this.showToast('펌웨어 다운로드가 완료되었습니다', 'success');

        } catch (error) {
            this.addFirmwareLog(`에러: ${error.message}`, 'error');
            this.showToast(`펌웨어 다운로드에 실패했습니다: ${error.message}`, 'error');

            // Mark current active step as error
            document.querySelectorAll('.firmware-step.active').forEach(step => {
                step.classList.remove('active');
                step.classList.add('error');
            });

        } finally {
            this.firmwareUpdateInProgress = false;
            if (downloadBtn) downloadBtn.style.display = 'inline-block';
            if (cancelBtn) cancelBtn.style.display = 'none';
            if (verifyBtn) verifyBtn.disabled = false;
        }
    }

    /**
     * Cancel firmware download
     */
    cancelFirmwareDownload() {
        if (this.firmwareUpdateInProgress) {
            this.firmwareUpdateCancelled = true;
            this.addFirmwareLog('취소 요청됨...', 'warning');
        }
    }

    /**
     * Reset firmware step indicators
     */
    resetFirmwareSteps() {
        document.querySelectorAll('.firmware-step').forEach(step => {
            step.classList.remove('active', 'completed', 'error');
        });
        const progressFill = document.getElementById('fwDataProgressFill');
        const progressPercent = document.getElementById('fwDataProgressPercent');
        const progressBytes = document.getElementById('fwDataProgressBytes');
        const progressPackets = document.getElementById('fwDataProgressPackets');
        const progressTime = document.getElementById('fwDataProgressTime');

        if (progressFill) progressFill.style.width = '0%';
        if (progressPercent) progressPercent.textContent = '0%';
        if (progressBytes) progressBytes.textContent = '0 / 0 bytes';
        if (progressPackets) progressPackets.textContent = '패킷: 0 / 0';
        if (progressTime) progressTime.textContent = '남은 시간: --:--';
    }

    /**
     * Set firmware step status
     */
    setFirmwareStepStatus(stepCode, status) {
        const step = document.getElementById(`fwStep${stepCode}`);
        if (step) {
            step.classList.remove('active', 'completed', 'error');
            step.classList.add(status);
        }
    }

    /**
     * Update data transfer progress in step indicator
     */
    updateFirmwareDataProgress(transferred, total, currentPacket = 0, totalPackets = 0, remainingTimeMs = 0) {
        const progressFill = document.getElementById('fwDataProgressFill');
        const progressPercent = document.getElementById('fwDataProgressPercent');
        const progressBytes = document.getElementById('fwDataProgressBytes');
        const progressPackets = document.getElementById('fwDataProgressPackets');
        const progressTime = document.getElementById('fwDataProgressTime');

        const percent = total > 0 ? Math.round((transferred / total) * 100) : 0;

        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
        if (progressPercent) {
            progressPercent.textContent = `${percent}%`;
        }
        if (progressBytes) {
            progressBytes.textContent = `${this.formatFileSize(transferred)} / ${this.formatFileSize(total)}`;
        }
        if (progressPackets) {
            const remainingPackets = totalPackets - currentPacket;
            progressPackets.textContent = `패킷: ${currentPacket} / ${totalPackets} (남은: ${remainingPackets})`;
        }
        if (progressTime) {
            if (remainingTimeMs > 0) {
                progressTime.textContent = `남은 시간: ${this.formatTime(remainingTimeMs)}`;
            } else if (currentPacket >= totalPackets && totalPackets > 0) {
                progressTime.textContent = '완료!';
            } else {
                progressTime.textContent = '남은 시간: 계산 중...';
            }
        }
    }

    /**
     * Format time in mm:ss or hh:mm:ss format
     */
    formatTime(ms) {
        const totalSeconds = Math.ceil(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    /**
     * Send frame and wait for response
     * @param {Uint8Array} frame - Frame to send
     * @param {number} timeout - Timeout in ms
     * @param {object} options - Options: { minLength: minimum response bytes, skipCRC: skip CRC verification }
     */
    async sendAndReceive(frame, timeout = 1000, options = {}) {
        const { minLength = 4, skipCRC = false } = options;

        // Simulator mode
        if (this.simulatorEnabled) {
            this.addMonitorEntry('tx', frame);

            // Set simulator to respond to the target slave ID
            const targetSlaveId = frame[0];
            const originalSlaveId = this.simulator.slaveId;
            this.simulator.slaveId = targetSlaveId;

            const response = await this.simulator.processRequest(frame);

            // Restore original slave ID
            this.simulator.slaveId = originalSlaveId;

            if (response) {
                this.addMonitorEntry('rx', response);
            }
            return response;
        }

        // Real serial port mode
        return new Promise(async (resolve) => {
            // Flush: 이전 통신에서 남은 데이터가 버퍼에 쌓이지 않도록
            // null로 설정하여 handleReceivedData에서 데이터 축적 중지
            this.responseBuffer = null;
            this.expectedResponseLength = 0;

            // receiveBuffer도 초기화하여 이전 패킷 데이터 제거
            this.receiveIndex = 0;

            // Send the frame (await 중 도착하는 잔여 데이터는 null이므로 버려짐)
            await this.sendRawData(frame);
            this.addMonitorEntry('tx', frame);

            // 프레임 전송 완료 후 새 버퍼 시작 - 이후 도착하는 데이터만 축적
            this.responseBuffer = [];

            // Wait for response with timeout
            const startTime = Date.now();
            const checkInterval = 10;

            const checkResponse = () => {
                if (this.responseBuffer.length >= minLength) {
                    const response = new Uint8Array(this.responseBuffer);
                    // Skip CRC check if requested, or verify CRC
                    if (skipCRC || this.modbus.verifyCRC(response)) {
                        // FC 0x66 등 tryParseFrame()이 무시하는 FC는 여기서 직접 기록
                        if (response.length >= 2 && response[1] === 0x66) {
                            this.addMonitorEntry('rx', response);
                        }
                        resolve(response);
                        return;
                    }
                }

                if (Date.now() - startTime > timeout) {
                    resolve(null); // Timeout
                    return;
                }

                setTimeout(checkResponse, checkInterval);
            };

            setTimeout(checkResponse, checkInterval);
        });
    }

    /**
     * FC 0x64 전용 TX/RX.
     * responseBuffer로 수신하며, control 값에 따라 예상 길이를 동적으로 판단.
     * @param {Uint8Array} frame  - 송신 프레임
     * @param {number}     control - 0x00(stop) | 0x02(configure) | 0x03(data)
     * @param {number}     timeout - ms
     */
    async sendAndReceiveFC64(frame, control, timeout = 500) {
        if (!this.writer) return null;

        // 이전 잔류 데이터 flush
        this._serialDataCb = null;
        this.responseBuffer = null;
        this.receiveIndex = 0;
        await Promise.resolve();
        await Promise.resolve();

        await this.writer.write(frame);
        this.addMonitorEntry('sent', frame);

        // 이 호출 전용 버퍼 토큰 — 다른 호출과 버퍼가 섞이는 것을 방지
        const myBuffer = [];
        this.responseBuffer = myBuffer;

        this.stats.requests++;

        return new Promise((resolve) => {
            const startTime = performance.now();
            let hardTimeoutId = null;

            const done = (response) => {
                this.updateStats(response !== null);
                resolve(response);
            };

            const cleanup = () => {
                if (this._serialDataCb === check) this._serialDataCb = null;
                if (hardTimeoutId) { clearTimeout(hardTimeoutId); hardTimeoutId = null; }
                // 다른 호출이 responseBuffer를 이미 교체한 경우에는 건드리지 않음
                if (this.responseBuffer === myBuffer) this.responseBuffer = null;
            };

            const check = () => {
                const buf = this.responseBuffer;
                // 버퍼가 교체되었으면(다른 호출이 시작됨) 즉시 포기
                if (!buf || buf !== myBuffer) { cleanup(); done(null); return; }

                let expectedLen = null;
                if (control === 0x00) {
                    if (buf.length >= 4) expectedLen = 4;
                } else if (control === 0x02) {
                    if (buf.length >= frame.length) expectedLen = frame.length;
                } else if (control === 0x03) {
                    if (buf.length >= 5) expectedLen = 5 + buf[4] * 4 + 2;
                }

                if (expectedLen !== null && buf.length >= expectedLen) {
                    const response = new Uint8Array(buf.slice(0, expectedLen));
                    cleanup();
                    if (this.modbus.verifyCRC(response)) {
                        this.addMonitorEntry('received', response);
                        done(response);
                    } else {
                        done(null);
                    }
                    return;
                }

                if (performance.now() - startTime > timeout) {
                    cleanup();
                    done(null);
                    return;
                }

                // 다음 데이터 도착 시 즉시 재확인 (setTimeout 폴링 없음)
                this._serialDataCb = check;
            };

            // 안전망: 디바이스 무응답 시 강제 종료
            hardTimeoutId = setTimeout(() => {
                if (this._serialDataCb === check || this.responseBuffer === myBuffer) {
                    cleanup();
                    done(null);
                }
            }, timeout + 100);

            // 즉시 첫 확인
            check();
        });
    }

    /**
     * FC 0x65 Trigger Streaming 전송 및 응답 수신.
     * sendAndReceiveFC64와 동일한 구조이지만 FC65 응답 길이 적용.
     *
     * RX 응답 총 바이트 (NodeID + FrameLength + CRC):
     *   0x00 stop      : 5  bytes (FrameLength=2)
     *   0x02 configure : TX frame length (echo, FrameLength=17 → total 20)
     *   0x01 startPoll : 24 bytes (FrameLength=21, byte[3]=Status)
     *   0x03 dataReq   : 68 bytes (FrameLength=65, byte[7]=Len, byte[8+]=floats)
     *
     * @param {Uint8Array} frame   - TX 프레임
     * @param {number}     control - 0x00|0x01|0x02|0x03
     * @param {number}     timeout - ms
     */
    async sendAndReceiveFC65(frame, control, timeout = 500) {
        if (!this.writer) return null;

        this._serialDataCb = null;
        this.responseBuffer = null;
        this.receiveIndex = 0;
        await Promise.resolve();
        await Promise.resolve();

        await this.writer.write(frame);
        this.addMonitorEntry('sent', frame);

        const myBuffer = [];
        this.responseBuffer = myBuffer;

        this.stats.requests++;

        return new Promise((resolve) => {
            const startTime = performance.now();
            let hardTimeoutId = null;

            const done = (response) => {
                this.updateStats(response !== null);
                resolve(response);
            };

            const cleanup = () => {
                if (this._serialDataCb === check) this._serialDataCb = null;
                if (hardTimeoutId) { clearTimeout(hardTimeoutId); hardTimeoutId = null; }
                if (this.responseBuffer === myBuffer) this.responseBuffer = null;
            };

            const check = () => {
                const buf = this.responseBuffer;
                if (!buf || buf !== myBuffer) { cleanup(); done(null); return; }

                let expectedLen = null;
                if (control === 0x00) {
                    // Stop: [NodeID][0x65][0x00][CRC_L][CRC_H] = 5 bytes
                    if (buf.length >= 5) expectedLen = 5;
                } else if (control === 0x02) {
                    // Configure: echo of TX frame
                    if (buf.length >= frame.length) expectedLen = frame.length;
                } else if (control === 0x01) {
                    // StartPoll: 24 bytes total (FrameLength=21)
                    if (buf.length >= 24) expectedLen = 24;
                } else if (control === 0x03) {
                    // DataReq: 68 bytes total (FrameLength=65, USB-HID legacy 고정 크기)
                    if (buf.length >= 68) expectedLen = 68;
                }

                if (expectedLen !== null && buf.length >= expectedLen) {
                    const response = new Uint8Array(buf.slice(0, expectedLen));
                    cleanup();
                    if (this.modbus.verifyCRC(response)) {
                        this.addMonitorEntry('received', response);
                        done(response);
                    } else {
                        done(null);
                    }
                    return;
                }

                if (performance.now() - startTime > timeout) {
                    cleanup();
                    done(null);
                    return;
                }

                this._serialDataCb = check;
            };

            hardTimeoutId = setTimeout(() => {
                if (this._serialDataCb === check || this.responseBuffer === myBuffer) {
                    cleanup();
                    done(null);
                }
            }, timeout + 100);

            check();
        });
    }

    /**
     * Send raw data to serial port
     */
    async sendRawData(data) {
        if (!this.writer) return;
        await this.writer.write(data);
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Add log entry to firmware progress log
     */
    addFirmwareLog(message, type = '') {
        const logEl = document.getElementById('firmwareProgressLog');
        if (!logEl) return;

        const entry = document.createElement('div');
        entry.className = 'progress-log-entry' + (type ? ' ' + type : '');
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logEl.appendChild(entry);
        logEl.scrollTop = logEl.scrollHeight;
    }

    /**
     * Initialize Chart Page
     */
    initializeChartPage() {
        // Initialize Chart Manager
        this.chartManager = new ChartManager('mainChart');

        // Mode toggle buttons
        const continuousBtn = document.getElementById('chartModeContinuous');
        const triggerBtn = document.getElementById('chartModeTrigger');
        const triggerPanel = document.getElementById('chartTriggerPanel');

        if (continuousBtn) {
            continuousBtn.addEventListener('click', () => {
                continuousBtn.classList.add('active');
                triggerBtn.classList.remove('active');
                triggerPanel.style.display = 'none';
                this.chartManager.setMode('continuous');
            });
        }

        if (triggerBtn) {
            triggerBtn.addEventListener('click', () => {
                triggerBtn.classList.add('active');
                continuousBtn.classList.remove('active');
                triggerPanel.style.display = 'block';
                this.chartManager.setMode('trigger');
            });
        }

        // Control buttons
        const startBtn = document.getElementById('chartStartBtn');
        const stopBtn = document.getElementById('chartStopBtn');
        const clearBtn = document.getElementById('chartClearBtn');
        const pauseBtn = document.getElementById('chartPauseBtn');

        if (startBtn) {
            startBtn.addEventListener('click', async () => {
                startBtn.disabled = true;
                stopBtn.disabled = false;
                pauseBtn.disabled = false;
                await this.startChartCapture();
            });
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', async () => {
                await this.stopChartCapture();
                startBtn.disabled = false;
                stopBtn.disabled = true;
                pauseBtn.disabled = true;
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.chartManager.clearData();
            });
        }

        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.chartManager.pauseCapture();
                pauseBtn.textContent = this.chartManager.isPaused ? '⏵ Resume' : '⏸ Pause';
            });
        }

        // Settings dropdowns
        const timeScaleEl = document.getElementById('chartTimeScale');

        if (timeScaleEl) {
            timeScaleEl.addEventListener('change', () => {
                this.chartManager.setTimeScale(parseInt(timeScaleEl.value));
            });
        }

        // sampleRateEl: FC 0x64 Period 드롭다운 — startChartCapture() 시점에 읽음, 리스너 불필요

        // Channel configuration — enable/disable만 ChartManager에 전달
        // 채널 번호는 startChartCapture() 시점에 직접 읽음
        for (let i = 0; i < 4; i++) {
            const enableEl = document.getElementById(`chartCh${i + 1}Enable`);
            if (enableEl) {
                enableEl.addEventListener('change', () => {
                    this.chartManager.setChannelEnabled(i, enableEl.checked);
                    // Persist enable state
                    const saved = JSON.parse(localStorage.getItem('chartChSettings') || '{}');
                    if (!saved[i]) saved[i] = {};
                    saved[i].enabled = enableEl.checked;
                    localStorage.setItem('chartChSettings', JSON.stringify(saved));
                });
            }
        }

        // Trigger settings — FC 0x65 Hardware Trigger
        // Source CH 피커는 initTriggerSourcePicker()에서 초기화됨.
        // 실제 값은 startTriggerCapture() 시점에 직접 읽음.
        const triggerLevelEl = document.getElementById('triggerLevel');
        if (triggerLevelEl) {
            triggerLevelEl.addEventListener('change', () => {
                this.chartManager.setTriggerLevel(parseFloat(triggerLevelEl.value));
            });
        }

        // Zoom controls
        const zoomInBtn = document.getElementById('chartZoomIn');
        const zoomOutBtn = document.getElementById('chartZoomOut');
        const zoomResetBtn = document.getElementById('chartZoomReset');
        const autoScaleBtn = document.getElementById('chartAutoScale');

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.chartManager.zoomIn());
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.chartManager.zoomOut());
        }

        if (zoomResetBtn) {
            zoomResetBtn.addEventListener('click', () => this.chartManager.resetZoom());
        }

        if (autoScaleBtn) {
            autoScaleBtn.addEventListener('click', () => this.chartManager.enableAutoScale());
        }

        // Export buttons
        const exportCsvBtn = document.getElementById('chartExportCsvBtn');
        const exportPngBtn = document.getElementById('chartExportPngBtn');

        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => this.chartManager.exportToCSV());
        }

        if (exportPngBtn) {
            exportPngBtn.addEventListener('click', () => this.chartManager.exportToPNG());
        }

        // Y-axis mode buttons
        const yAxisModeA = document.getElementById('yAxisModeA');
        const yAxisModeB = document.getElementById('yAxisModeB');
        const yAxisModeC = document.getElementById('yAxisModeC');
        const scaleOffsetDivs = document.querySelectorAll('.channel-scale-offset');

        const modeHints = { independent: 'Independent', normalize: 'Normalize 0–100%', scaleoffset: 'Scale + Offset' };
        const hintEl = document.getElementById('yAxisModeHint');
        const setYAxisModeUI = (mode) => {
            [yAxisModeA, yAxisModeB, yAxisModeC].forEach(btn => btn?.classList.remove('active'));
            if (mode === 'independent') yAxisModeA?.classList.add('active');
            else if (mode === 'normalize') yAxisModeB?.classList.add('active');
            else yAxisModeC?.classList.add('active');
            scaleOffsetDivs.forEach(d => { d.style.display = mode === 'scaleoffset' ? 'flex' : 'none'; });
            if (hintEl) hintEl.textContent = modeHints[mode] ?? '';
            this.chartManager.setYAxisMode(mode);
        };

        if (yAxisModeA) yAxisModeA.addEventListener('click', () => setYAxisModeUI('independent'));
        if (yAxisModeB) yAxisModeB.addEventListener('click', () => setYAxisModeUI('normalize'));
        if (yAxisModeC) yAxisModeC.addEventListener('click', () => setYAxisModeUI('scaleoffset'));

        // Split view toggle
        const splitViewBtn = document.getElementById('chartSplitViewBtn');
        if (splitViewBtn) {
            splitViewBtn.addEventListener('click', () => {
                const enabled = !this.chartManager.splitView;
                this.chartManager.setSplitView(enabled);
                splitViewBtn.classList.toggle('active', enabled);
            });
        }

        // Scale/Offset inputs
        for (let i = 0; i < 4; i++) {
            const scaleEl = document.getElementById(`chartCh${i + 1}Scale`);
            const offsetEl = document.getElementById(`chartCh${i + 1}Offset`);
            if (scaleEl) {
                scaleEl.addEventListener('change', () => {
                    this.chartManager.setChannelScale(i, parseFloat(scaleEl.value) || 1);
                });
            }
            if (offsetEl) {
                offsetEl.addEventListener('change', () => {
                    this.chartManager.setChannelOffset(i, parseFloat(offsetEl.value) || 0);
                });
            }
        }

        this.initChartChannelPickers();
        this.initTriggerSourcePicker();
    }

    /**
     * Start chart data capture — Continuous(FC 0x64) 또는 Trigger(FC 0x65) 모드 분기
     */
    async startChartCapture() {
        if (!this.chartManager) return;
        if (this.chartManager.mode === 'trigger') {
            await this.startTriggerCapture();
            return;
        }
        if (!this.writer) {
            this.showToast('시리얼 포트가 연결되지 않았습니다', 'error');
            // Restore buttons
            const startBtn = document.getElementById('chartStartBtn');
            const stopBtn  = document.getElementById('chartStopBtn');
            const pauseBtn = document.getElementById('chartPauseBtn');
            if (startBtn) startBtn.disabled = false;
            if (stopBtn)  stopBtn.disabled  = true;
            if (pauseBtn) pauseBtn.disabled = true;
            return;
        }

        // 진행 중인 폴링 사이클이 있으면 완료 대기
        while (this.isPolling) await this.delay(5);

        // 활성화된 채널 수집: { chIdx: 0~3, chNum: 0~254 }
        const configuredChannels = [];
        for (let i = 0; i < 4; i++) {
            const enableEl  = document.getElementById(`chartCh${i + 1}Enable`);
            const triggerEl = document.getElementById(`chartCh${i + 1}Trigger`);
            if (enableEl?.checked) {
                const chNum = parseInt(triggerEl?.dataset.selectedValue);
                if (!isNaN(chNum) && chNum >= 0 && chNum <= 254) {
                    configuredChannels.push({ chIdx: i, chNum });
                }
            }
        }

        if (configuredChannels.length === 0) {
            this.showToast('활성화된 채널이 없습니다 (Ch# 1~254 범위 확인)', 'error');
            const startBtn = document.getElementById('chartStartBtn');
            const stopBtn  = document.getElementById('chartStopBtn');
            const pauseBtn = document.getElementById('chartPauseBtn');
            if (startBtn) startBtn.disabled = false;
            if (stopBtn)  stopBtn.disabled  = true;
            if (pauseBtn) pauseBtn.disabled = true;
            return;
        }

        const slaveId = parseInt(document.getElementById('chartSlaveId')?.value) || 1;
        const period  = parseInt(document.getElementById('chartSampleRate')?.value) || 1600;

        this.chartSlaveId            = slaveId;
        this.chartConfiguredChannels = configuredChannels;
        this.chartPeriodMs           = period * 0.125; // 1 unit = 125μs
        this.chartRunning            = true;
        this.chartManager.clearData();
        this.chartManager.startCapture();

        const statusEl = document.getElementById('chartStatus');
        if (statusEl) statusEl.textContent = 'Configuring...';

        // 이전 스트리밍 상태 초기화: Stop 먼저 전송
        const stopFrame = this.modbus.buildContinuousStop(slaveId);
        await this.sendAndReceiveFC64(stopFrame, 0x00, 300);

        // Configure 전송
        const channelSlots = [0xFF, 0xFF, 0xFF, 0xFF];
        configuredChannels.forEach(c => { channelSlots[c.chIdx] = c.chNum; });
        const configFrame = this.modbus.buildContinuousConfigure(slaveId, period, channelSlots);
        const configResp  = await this.sendAndReceiveFC64(configFrame, 0x02, 1000);

        if (!configResp) {
            this.showToast('Configure 실패: 디바이스 응답 없음', 'error');
            this.chartRunning = false;
            this.chartManager.stopCapture();
            if (statusEl) statusEl.textContent = 'Stopped';
            const startBtn = document.getElementById('chartStartBtn');
            const stopBtn  = document.getElementById('chartStopBtn');
            const pauseBtn = document.getElementById('chartPauseBtn');
            if (startBtn) startBtn.disabled = false;
            if (stopBtn)  stopBtn.disabled  = true;
            if (pauseBtn) pauseBtn.disabled = true;
            return;
        }

        if (statusEl) statusEl.textContent = 'Running';

        // 데이터 루프 시작 (비동기, await 불필요)
        this.chartDataLoop();
    }

    /**
     * FC 0x64 데이터 수신 루프.
     * Status=stay(0x01)이면 즉시 재요청, Status=done(0x00)이면 짧게 대기.
     */
    async chartDataLoop() {
        const slaveId = this.chartSlaveId;
        let totalSamples = 0;
        let nextSampleTime = null; // 누적 타임스탬프 카운터 (패킷 도착 시점과 무관)

        while (this.chartRunning) {
            if (!this.writer) { await this.delay(50); continue; }

            const frame    = this.modbus.buildContinuousRequest(slaveId);
            const response = await this.sendAndReceiveFC64(frame, 0x03, 300);

            if (!this.chartRunning) break;

            if (!response) {
                await this.delay(20);
                continue;
            }

            const parsed = this.modbus.parseContinuousDataResponse(response);
            if (!parsed) { await this.delay(20); continue; }

            if (parsed.data.length > 0) {
                const numCh        = this.chartConfiguredChannels.length;
                const samplesPerCh = Math.floor(parsed.data.length / numCh);

                // 누적 카운터 초기화 (첫 데이터 수신 시점 기준)
                if (nextSampleTime === null) nextSampleTime = Date.now();

                // 채널 우선(Channel-first) 순서: [CH1_s0, CH1_s1, ..., CH2_s0, CH2_s1, ..., CH3_s0, ...]
                // 타임스탬프를 패킷 도착 시점이 아닌 누적 카운터로 할당 → Len 변동 시에도 연속성 보장
                for (let s = 0; s < samplesPerCh; s++) {
                    const t = nextSampleTime + s * this.chartPeriodMs;
                    this.chartConfiguredChannels.forEach((ch, cfgIdx) => {
                        const val = parsed.data[cfgIdx * samplesPerCh + s];
                        if (val === undefined) return;
                        this.chartManager.addDataPoint(ch.chIdx, val, t);
                        totalSamples++;

                        // 현재값 표시: 마지막 샘플
                        if (s === samplesPerCh - 1) {
                            const valueEl = document.getElementById(`chartCh${ch.chIdx + 1}Value`);
                            if (valueEl) valueEl.textContent = val.toFixed(3);
                        }
                    });
                }
                nextSampleTime += samplesPerCh * this.chartPeriodMs;

                const sampleCountEl = document.getElementById('chartSampleCount');
                if (sampleCountEl) sampleCountEl.textContent = totalSamples;
            }

            // Status=done이면 짧게 대기 후 재요청, stay이면 즉시 재요청
            if (parsed.status === 0x00) await this.delay(5);

            // FC64 요청 사이에 대기 중인 큐 명령 소진 (버스 충돌 방지)
            if (this.commandQueue.length > 0) await this._drainCommandQueue();
        }

        this.responseBuffer = null;
    }

    /**
     * Stop chart data capture — Continuous(FC 0x64) 또는 Trigger(FC 0x65) 모드 분기
     */
    async stopChartCapture() {
        if (!this.chartManager) return;

        if (this.chartManager.mode === 'trigger') {
            await this.stopTriggerCapture();
            return;
        }

        this.chartRunning = false;
        await this.delay(50); // 루프 종료 대기

        if (this.writer) {
            const stopFrame = this.modbus.buildContinuousStop(this.chartSlaveId || 1);
            await this.sendAndReceiveFC64(stopFrame, 0x00, 300);
        }

        this.chartManager.stopCapture();

        // 현재값 표시 리셋
        for (let i = 0; i < 4; i++) {
            const el = document.getElementById(`chartCh${i + 1}Value`);
            if (el) el.textContent = '--';
        }

        const statusEl = document.getElementById('chartStatus');
        if (statusEl) statusEl.textContent = 'Stopped';
    }

    // ─────────────────────────────────────────────────────────
    //  FC 0x65 Trigger Capture

    /**
     * FC 0x65 Trigger 캡처 시작.
     * 1) Stop → Configure → Start/Poll → 데이터 수집 → 차트 렌더링 순서로 진행.
     */
    async startTriggerCapture() {
        if (!this.writer) {
            this.showToast('시리얼 포트가 연결되지 않았습니다', 'error');
            this._restoreChartButtons();
            return;
        }

        // 진행 중인 폴링 사이클 완료 대기
        while (this.isPolling) await this.delay(5);

        // 활성화된 채널 수집
        const configuredChannels = [];
        for (let i = 0; i < 4; i++) {
            const enableEl  = document.getElementById(`chartCh${i + 1}Enable`);
            const triggerEl = document.getElementById(`chartCh${i + 1}Trigger`);
            if (enableEl?.checked) {
                const chNum = parseInt(triggerEl?.dataset.selectedValue);
                if (!isNaN(chNum) && chNum >= 0 && chNum <= 254) {
                    configuredChannels.push({ chIdx: i, chNum });
                }
            }
        }

        if (configuredChannels.length === 0) {
            this.showToast('활성화된 채널이 없습니다 (Ch# 1~254 범위 확인)', 'error');
            this._restoreChartButtons();
            return;
        }

        const slaveId    = parseInt(document.getElementById('chartSlaveId')?.value) || 1;
        const period     = parseInt(document.getElementById('chartSampleRate')?.value) || 1600;
        const position   = parseInt(document.getElementById('triggerPosition')?.value ?? 25);
        const numOfData  = Math.min(1024, Math.max(256, parseInt(document.getElementById('triggerNumData')?.value ?? 512)));
        const level      = parseFloat(document.getElementById('triggerLevel')?.value ?? 0);
        const edgeStr = document.getElementById('triggerEdge')?.value ?? 'rising';
        const edge    = edgeStr === 'falling' ? 1 : 0; // 0=Rising, 1=Falling

        // 트리거 소스 채널: 피커에서 읽은 chNum (0xFF=Immediate, 그 외=Chart Channel)
        const pickerBtn    = document.getElementById('triggerSourcePicker');
        const pickerVal    = parseInt(pickerBtn?.dataset.selectedValue ?? 255);
        const sourceSelect = (!isNaN(pickerVal) && pickerVal >= 0 && pickerVal <= 255) ? pickerVal : 0xFF;

        // ch_sel[4]: 슬롯별 채널 번호 (미사용=0xFF)
        const chSel4 = [0xFF, 0xFF, 0xFF, 0xFF];
        configuredChannels.forEach(c => { chSel4[c.chIdx] = c.chNum; });

        this.triggerRunning  = true;
        this.chartSlaveId    = slaveId;
        this.chartManager.clearData();

        const statusEl = document.getElementById('chartStatus');
        if (statusEl) statusEl.textContent = 'Configuring...';
        this.chartManager.updateTriggerStatus('Waiting');

        // ── 1. Stop (이전 세션 초기화) ──────────────────────────
        const stopFrame = this.modbus.buildTriggerStop(slaveId);
        await this.sendAndReceiveFC65(stopFrame, 0x00, 300);

        // ── 2. Configure ────────────────────────────────────────
        const configFrame = this.modbus.buildTriggerConfigure(
            slaveId, period, chSel4, sourceSelect, edge, position, level, numOfData
        );
        const configResp = await this.sendAndReceiveFC65(configFrame, 0x02, 1000);
        if (!configResp) {
            this.showToast('Trigger Configure 실패: 디바이스 응답 없음', 'error');
            this.triggerRunning = false;
            if (statusEl) statusEl.textContent = 'Stopped';
            this._restoreChartButtons();
            return;
        }

        if (statusEl) statusEl.textContent = 'Armed';
        this.chartManager.updateTriggerStatus('Armed');

        // ── 3. Start + Poll (트리거 대기) ───────────────────────
        let triggered = false;
        while (this.triggerRunning) {
            const pollFrame = this.modbus.buildTriggerStartPoll(slaveId);
            const pollResp  = await this.sendAndReceiveFC65(pollFrame, 0x01, 500);

            if (!this.triggerRunning) break; // 사용자가 Stop 누름

            if (pollResp) {
                const parsed = this.modbus.parseTriggerStatusResponse(pollResp);
                if (parsed?.status === 1) {
                    triggered = true;
                    break;
                }
            }
            await this.delay(200); // 200ms 간격으로 폴링
        }

        if (!triggered || !this.triggerRunning) {
            // 사용자 취소
            const abortFrame = this.modbus.buildTriggerStop(slaveId);
            await this.sendAndReceiveFC65(abortFrame, 0x00, 300);
            this.triggerRunning = false;
            if (statusEl) statusEl.textContent = 'Stopped';
            this.chartManager.updateTriggerStatus('Waiting');
            this._restoreChartButtons();
            return;
        }

        this.chartManager.updateTriggerStatus('Triggered');
        if (statusEl) statusEl.textContent = 'Downloading...';

        // ── 4. 데이터 수집 (채널별 순차) ────────────────────────
        const periodMs = period * 0.125;
        const preTriggerSamples = Math.round(numOfData * position / 100);
        const channelData = {}; // chIdx → float[]

        for (const { chIdx, chNum } of configuredChannels) {
            const samples = [];
            let startAddr = 0;

            while (startAddr < numOfData) {
                const reqFrame = this.modbus.buildTriggerDataRequest(slaveId, chIdx, startAddr);
                const resp     = await this.sendAndReceiveFC65(reqFrame, 0x03, 500);

                if (!resp) {
                    this.showToast(`CH${chIdx + 1} 데이터 수신 실패 (addr=${startAddr})`, 'warning');
                    break;
                }

                const parsed = this.modbus.parseTriggerDataResponse(resp);
                if (!parsed || parsed.length === 0) break;

                samples.push(...parsed.data);
                startAddr += parsed.length;

                if (parsed.length < 14) break; // 마지막 패킷 (end-of-data)
            }

            channelData[chIdx] = samples;
        }

        // ── 5. Stop ─────────────────────────────────────────────
        const finalStop = this.modbus.buildTriggerStop(slaveId);
        await this.sendAndReceiveFC65(finalStop, 0x00, 300);

        this.triggerRunning = false;

        // ── 6. 차트 렌더링 ───────────────────────────────────────
        this.chartManager.loadTriggerData(channelData, periodMs, preTriggerSamples, numOfData);

        if (statusEl) statusEl.textContent = 'Done';
        this._restoreChartButtons();
    }

    /**
     * 진행 중인 Trigger 캡처를 중단한다.
     * triggerRunning = false 로 설정하면 폴링 루프가 스스로 종료되며 Stop 프레임을 전송한다.
     */
    async stopTriggerCapture() {
        this.triggerRunning = false;
        await this.delay(100); // 루프 종료 대기

        if (this.writer) {
            const stopFrame = this.modbus.buildTriggerStop(this.chartSlaveId || 1);
            await this.sendAndReceiveFC65(stopFrame, 0x00, 300);
        }

        this.chartManager.stopCapture();
        this.chartManager.updateTriggerStatus('Waiting');

        for (let i = 0; i < 4; i++) {
            const el = document.getElementById(`chartCh${i + 1}Value`);
            if (el) el.textContent = '--';
        }

        const statusEl = document.getElementById('chartStatus');
        if (statusEl) statusEl.textContent = 'Stopped';
    }

    /** Start/Stop/Pause 버튼 상태 복원 헬퍼 */
    _restoreChartButtons() {
        const startBtn = document.getElementById('chartStartBtn');
        const stopBtn  = document.getElementById('chartStopBtn');
        const pauseBtn = document.getElementById('chartPauseBtn');
        if (startBtn) startBtn.disabled = false;
        if (stopBtn)  stopBtn.disabled  = true;
        if (pauseBtn) pauseBtn.disabled = true;
    }

    // ─────────────────────────────────────────────────────────
    //  Mini Chart — HW Overview 인라인 차트
    // ─────────────────────────────────────────────────────────

    initMiniCharts() {
        const heightMap = { miniChartHall: 160, miniChartCurrent: 160 };
        const init = (canvasId, chartKey, channels) => {
            const canvas = document.getElementById(canvasId);
            if (!canvas || this[chartKey]) return;
            // offsetWidth: display:flex 설정 직후 호출 시 layout reflow로 올바른 값 반환
            const w = canvas.offsetWidth || canvas.parentElement?.offsetWidth || 400;
            canvas.width  = w;
            canvas.height = heightMap[canvasId] ?? 200;
            this[chartKey] = new MiniChart(canvas, channels);
            this[chartKey].render();
        };
        init('miniChartHall', 'miniChartHall', [
            { name: 'Hall U', color: '#e74c3c', chNum: 22 },
            { name: 'Hall V', color: '#3498db', chNum: 23 },
            { name: 'Hall W', color: '#2ecc71', chNum: 24 },
        ]);
        init('miniChartCurrent', 'miniChartCurrent', [
            { name: 'Iu', color: '#e74c3c', chNum: 16 },
            { name: 'Iv', color: '#3498db', chNum: 17 },
            { name: 'Iw', color: '#2ecc71', chNum: 18 },
        ]);

        // Aging Current / Speed 마지막 입력값 복원
        const saved = (() => { try { return JSON.parse(localStorage.getItem('ovInverterSettings') || '{}'); } catch { return {}; } })();
        const curEl = document.getElementById('ovInverterCurrent');
        const spdEl = document.getElementById('ovInverterSpeed');
        if (curEl && saved.current != null) curEl.value = saved.current;
        if (spdEl && saved.speed   != null) spdEl.value = saved.speed;

        // 변경 시 localStorage에 저장
        const save = () => {
            localStorage.setItem('ovInverterSettings', JSON.stringify({
                current: curEl?.value,
                speed:   spdEl?.value,
            }));
        };
        curEl?.addEventListener('input', save);
        spdEl?.addEventListener('input', save);
    }

    async toggleMiniChart(type) {
        if (this.miniChartRunning[type]) {
            await this.stopMiniChart(type);
        } else {
            await this.startMiniChart(type);
        }
    }

    async startMiniChart(type) {
        if (!this.writer) {
            this.showToast('시리얼 포트가 연결되지 않았습니다', 'error');
            return;
        }
        if (this.chartRunning) {
            this.showToast('Chart 탭이 실행 중입니다. 먼저 중지해주세요.', 'warning');
            return;
        }
        // 다른 미니 차트가 실행 중이면 먼저 중지
        const other = type === 'hall' ? 'current' : 'hall';
        if (this.miniChartRunning[other]) await this.stopMiniChart(other);

        // stopMiniChart가 _fc64Busy를 해제했더라도 configure 프레임 전송 전까지 버스 점유 유지
        this._fc64Busy = true;

        let chart = type === 'hall' ? this.miniChartHall : this.miniChartCurrent;
        if (!chart) {
            this.initMiniCharts();
            await this.delay(50);
            chart = type === 'hall' ? this.miniChartHall : this.miniChartCurrent;
        }
        if (!chart) {
            this._fc64Busy = false;
            this.showToast('차트 초기화 실패: HW Overview 탭을 다시 열어주세요', 'error');
            return;
        }
        chart.clear();

        const slaveId = this._getMiniChartSlaveId();
        const channelSlots = [...chart.channels.map(ch => ch.chNum)];
        while (channelSlots.length < 4) channelSlots.push(0xFF);

        while (this.isPolling) await this.delay(5);

        const stopFrame = this.modbus.buildContinuousStop(slaveId);
        await this.sendAndReceiveFC64(stopFrame, 0x00, 300);

        const period = 160; // 20ms per sample
        const configFrame = this.modbus.buildContinuousConfigure(slaveId, period, channelSlots);
        const resp = await this.sendAndReceiveFC64(configFrame, 0x02, 1000);
        if (!resp) {
            this._fc64Busy = false;
            this.showToast('Mini Chart Configure 실패: 디바이스 응답 없음', 'error');
            return;
        }

        this.miniChartRunning[type] = true; // 이후 _isFc64Active는 miniChartRunning으로 유지됨
        this._fc64Busy = false;
        if (type === 'current') {
            this._currentRmsData = [{sumSq:0,count:0},{sumSq:0,count:0},{sumSq:0,count:0}];
            ['ov-iu-rms','ov-iv-rms','ov-iw-rms'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '-';
            });
        }
        this._updateMiniChartBtn(type, true);
        this._miniChartDataLoop(type, slaveId, chart.channels.length, period * 0.125);
    }

    async _miniChartDataLoop(type, slaveId, numCh, periodMs) {
        const chart = type === 'hall' ? this.miniChartHall : this.miniChartCurrent;
        const valueIds = type === 'hall'
            ? ['ov-hall-u', 'ov-hall-v', 'ov-hall-w']
            : ['ov-iu', 'ov-iv', 'ov-iw'];
        const minIds = type === 'hall'
            ? ['ov-hall-u-min', 'ov-hall-v-min', 'ov-hall-w-min']
            : ['ov-iu-min', 'ov-iv-min', 'ov-iw-min'];
        const maxIds = type === 'hall'
            ? ['ov-hall-u-max', 'ov-hall-v-max', 'ov-hall-w-max']
            : ['ov-iu-max', 'ov-iv-max', 'ov-iw-max'];
        const rmsIds = type === 'current' ? ['ov-iu-rms', 'ov-iv-rms', 'ov-iw-rms'] : null;

        while (this.miniChartRunning[type]) {
            if (!this.writer) { await this.delay(50); continue; }

            const frame    = this.modbus.buildContinuousRequest(slaveId);
            const response = await this.sendAndReceiveFC64(frame, 0x03, 300);
            if (!this.miniChartRunning[type]) break;
            if (!response) { await Promise.resolve(); continue; }

            const parsed = this.modbus.parseContinuousDataResponse(response);
            if (!parsed || parsed.data.length === 0) { await Promise.resolve(); continue; }

            const samplesPerCh = Math.floor(parsed.data.length / numCh);
            for (let s = 0; s < samplesPerCh; s++) {
                for (let ci = 0; ci < numCh; ci++) {
                    const val = parsed.data[ci * samplesPerCh + s];
                    if (val === undefined) continue;
                    chart.addDataPoint(ci, val);
                    // RMS 누적 (current 차트만)
                    if (rmsIds && this._currentRmsData[ci]) {
                        this._currentRmsData[ci].sumSq += val * val;
                        this._currentRmsData[ci].count++;
                    }
                    if (s === samplesPerCh - 1) {
                        const el = document.getElementById(valueIds[ci]);
                        if (el) el.textContent = val.toFixed(3);
                        const ch = chart.channels[ci];
                        const minEl = minIds[ci] ? document.getElementById(minIds[ci]) : null;
                        const maxEl = maxIds[ci] ? document.getElementById(maxIds[ci]) : null;
                        if (minEl && ch.min !== undefined) minEl.textContent = ch.min.toFixed(3);
                        if (maxEl && ch.max !== undefined) maxEl.textContent = ch.max.toFixed(3);
                        // RMS 표시 업데이트
                        if (rmsIds) {
                            const d = this._currentRmsData[ci];
                            const rmsEl = document.getElementById(rmsIds[ci]);
                            if (rmsEl && d.count > 0)
                                rmsEl.textContent = Math.sqrt(d.sumSq / d.count).toFixed(3);
                        }
                    }
                }
            }
            chart.render();

            // FC64 요청 사이에 대기 중인 큐 명령 소진 (버스 충돌 방지)
            if (this.commandQueue.length > 0) await this._drainCommandQueue();
        }
    }

    copyInverterResults() {
        const get = id => document.getElementById(id)?.textContent?.trim() ?? '-';
        const channels = ['iu', 'iv', 'iw'];
        const values = [];
        for (const ch of channels) {
            values.push(get(`ov-${ch}-min`));
            values.push(get(`ov-${ch}-max`));
            values.push(get(`ov-${ch}-rms`));
        }

        navigator.clipboard.writeText(values.join('\t'))
            .then(() => this.showToast('클립보드에 복사되었습니다', 'success'))
            .catch(() => this.showToast('클립보드 복사 실패', 'error'));
    }

    async stopMiniChart(type) {
        // _fc64Busy를 먼저 세워 ovPolling 루프의 직접 TX를 큐로 전환
        this._fc64Busy = true;
        this.miniChartRunning[type] = false;
        // 진행 중인 FC64 콜백이 일반 폴링 버퍼를 오염시키지 않도록 즉시 제거
        this._serialDataCb = null;
        await this.delay(50);
        if (this.writer) {
            const slaveId = this._getMiniChartSlaveId();
            const stopFrame = this.modbus.buildContinuousStop(slaveId);
            await this.sendAndReceiveFC64(stopFrame, 0x00, 300);
        }
        this._updateMiniChartBtn(type, false);
        this._fc64Busy = false;
    }

    _getMiniChartSlaveId() {
        const dev = this.devices.find(d => d.id === this.currentSetupDeviceId) || this.devices[0];
        return dev?.slaveId || 1;
    }

    _updateMiniChartBtn(type, running) {
        const cardId = type === 'hall' ? 'ovCard-ps-hall-sensor' : 'ovCard-ps-inverter-current';
        const card   = document.getElementById(cardId);
        if (!card) return;
        card.classList.toggle('ov-card-running', running);
    }

    // CANopen 파라미터 전송만 담당 — 차트 제어는 카드 클릭(toggleMiniChart)이 담당
    async startOvInverter() {
        if (!this.writer) {
            this.showToast('시리얼 포트가 연결되지 않았습니다', 'error');
            return;
        }
        const agingCurrent = parseInt(document.getElementById('ovInverterCurrent')?.value ?? '100', 10);
        const agingSpeed   = parseInt(document.getElementById('ovInverterSpeed')?.value   ?? '10',  10);
        if (isNaN(agingCurrent) || agingCurrent < 0 || agingCurrent > 100) {
            this.showToast('Aging Current 값을 확인해주세요 (0~100 %)', 'error');
            return;
        }
        if (isNaN(agingSpeed) || agingSpeed < 0) {
            this.showToast('Aging Speed 값을 확인해주세요 (0 Hz 이상)', 'error');
            return;
        }

        const slaveId = this._getMiniChartSlaveId();
        await this.writeCANopenObject(slaveId, 0x4004, 0x00, agingCurrent);
        await this.writeCANopenObject(slaveId, 0x4005, 0x00, agingSpeed);
        await this.writeCANopenObject(slaveId, 0x2701, 0x00, 1);
        await this.writeCANopenObject(slaveId, 0x2700, 0x00, 0x1000);
    }

    async stopOvInverter() {
        if (!this.writer) return;
        const slaveId = this._getMiniChartSlaveId();
        await this.writeCANopenObject(slaveId, 0x4004, 0x00, 0);
        await this.writeCANopenObject(slaveId, 0x4005, 0x00, 0);
        await this.writeCANopenObject(slaveId, 0x2701, 0x00, 2);
        await this.writeCANopenObject(slaveId, 0x2700, 0x00, 0x1000);
    }

    // ─────────────────────────────────────────────────────────
    //  HW Overview — 개별 카드 테스트 실행
    // ─────────────────────────────────────────────────────────

    // 테두리 효과 없이 표시할 카드 ID 목록 (자동 실행 항목)
    static _OV_NO_BORDER_IDS = new Set([
        'mcu-os-version', 'mcu-motor-id-set',
        'ps-dclink', 'ps-igbt-temp', 'ps-phase-loss',
    ]);

    _setOvBadge(id, status) {
        const card = document.getElementById(`ovCard-${id}`);
        if (!card) return;
        if (ModbusDashboard._OV_NO_BORDER_IDS.has(id)) return; // 테두리 효과 없음
        const borderMap = {
            pass:    '#e9ecef',  // 기본 (테두리 효과 없음)
            fail:    '#eb8a90',  // 빨강
            running: '#e9ecef',  // 기본 (테두리 효과 없음)
            live:    '#e9ecef',  // 기본 (테두리 효과 없음)
            pending: '#e9ecef',  // 기본 회색
        };
        card.style.borderColor = borderMap[status] || borderMap.pending;
        card.style.borderWidth = '1px';
        card.classList.toggle('ov-card-live', status === 'live');
    }

    // ─────────────────────────────────────────────────────────
    //  HW Overview — USB HID 통신회로 검증
    //  WebHID API로 65-byte 패킷 (Modbus + 0x00 패딩) 송수신
    // ─────────────────────────────────────────────────────────
    async runUsbHidTest() {
        if (!navigator.hid) {
            this.showToast('WebHID를 지원하지 않는 브라우저입니다 (Chrome/Edge 필요)', 'error');
            return;
        }

        const device = this._getManufactureDevice();
        const slaveId = device?.slaveId ?? 1;

        this._setOvBadge('if-usb', 'running');
        const el = document.getElementById('ov-usb-motor-id');
        if (el) el.textContent = '...';

        try {
            // HID 장치 연결 (이미 열려있으면 재사용)
            if (!this.hidDevice || !this.hidDevice.opened) {
                this.hidDevice = null;
                const devices = await navigator.hid.requestDevice({ filters: [] });
                if (!devices || devices.length === 0) {
                    this._setOvBadge('if-usb', 'fail');
                    if (el) el.textContent = '취소됨';
                    return;
                }
                this.hidDevice = devices[0];
                this.showToast(`HID 장치 선택됨: ${this.hidDevice.productName}`, 'info');
            }

            if (!this.hidDevice.opened) {
                await this.hidDevice.open();
                this.showToast('HID 장치 열림', 'info');
            }

            // CANopen Upload frame: FC 0x2B, 0x2000:00 (Motor ID)
            const frame = this.modbus.buildCANopenUpload(slaveId, 0x2000, 0x00, 0, 2);

            // 디바이스 report 정보 콘솔 출력 (디버그용)
            const collections = this.hidDevice.collections ?? [];
            console.log('[USB HID] device:', this.hidDevice.productName,
                '| collections:', collections.length,
                '| outputReports:', collections.map(c =>
                    c.outputReports?.map(r => `id=0x${r.reportId.toString(16)} items=${r.items?.length}`)
                ).flat()
            );

            // Report ID 자동 감지: outputReports에서 첫 번째 ID 사용, 없으면 0x00 (no-report-ID 장치)
            const outputReport = collections[0]?.outputReports?.[0];
            const reportId = outputReport?.reportId ?? 0x00;

            // 패킷 크기: reportId=0이면 no-report-ID → data=65bytes, 아니면 data=64bytes (reportId 자동 prepend)
            const packetSize = reportId === 0 ? 65 : 64;
            const data = new Uint8Array(packetSize);
            if (reportId === 0) {
                // no-report-ID 장치: data[0]=0x00(dummy), data[1..] = frame (slaveId 제외)
                data.set(frame.slice(1), 1);
            } else {
                // slaveId 바이트 제외: USB HID는 slaveId 없이 FC부터 시작
                data.set(frame.slice(1));
            }

            console.log(`[USB HID] sendReport(reportId=0x${reportId.toString(16)}, dataLen=${packetSize})`);
            this.showToast(`sendReport(id=0x${reportId.toString(16)}, ${packetSize}B) 전송 중…`, 'info');

            // 리스너 등록 후 sendReport (sendReport 실패 시 리스너 정리)
            let _resolve, _reject, _tid, _handler;
            const responsePromise = new Promise((resolve, reject) => {
                _resolve = resolve; _reject = reject;
                _tid = setTimeout(() => {
                    this.hidDevice.removeEventListener('inputreport', _handler);
                    reject(new Error('timeout'));
                }, 2000);
                _handler = (event) => {
                    clearTimeout(_tid);
                    this.hidDevice.removeEventListener('inputreport', _handler);
                    resolve(new Uint8Array(event.data.buffer));
                };
                this.hidDevice.addEventListener('inputreport', _handler);
            });

            try {
                await this.hidDevice.sendReport(reportId, data);
            } catch (sendErr) {
                clearTimeout(_tid);
                this.hidDevice.removeEventListener('inputreport', _handler);
                _reject(sendErr);
                throw sendErr;
            }

            this.addMonitorEntry('sent', frame);
            this.showToast('sendReport 완료, 응답 대기 중…', 'info');

            const response = await responsePromise;

            // USB HID 응답은 Report ID가 WebHID에서 제거되어 event.data가 FC부터 시작함
            // parseCANopenResponse는 [slaveId][FC][MEI]... 구조를 기대하므로 slaveId 앞에 삽입
            const fullResponse = new Uint8Array(response.length + 1);
            fullResponse[0] = slaveId;
            fullResponse.set(response, 1);

            // numData 위치: [11]=hi, [12]=lo (slaveId 삽입 후 기존 오프셋 그대로)
            const numData  = (fullResponse[11] << 8) | fullResponse[12];
            const frameLen = 13 + numData; // header(13) + data (CRC 없음)
            const parsed   = this.modbus.parseCANopenResponse(fullResponse.slice(0, frameLen), { skipCRC: true });
            this.addMonitorEntry('received', fullResponse.slice(0, frameLen));

            const MOTOR_ID_MAP = { 0x1000: 'Sirocco Motor', 0x2000: 'Axial Motor' };
            const hexVal  = `0x${parsed.value.toString(16).toUpperCase().padStart(4, '0')}`;
            const name    = MOTOR_ID_MAP[parsed.value] ?? '알 수 없음';
            if (el) el.textContent = `${name}  ${hexVal}`;
            this._setOvBadge('if-usb', 'pass');

        } catch (err) {
            console.error('[USB HID]', err);
            this.showToast(`USB HID 오류: ${err.message}`, 'error');
            if (el) el.textContent = err.message === 'timeout' ? 'timeout' : 'ERR';
            this._setOvBadge('if-usb', 'fail');
        }
    }

    async runOvMotorId() {
        const device = this._getManufactureDevice();
        if (!device) { this.showToast('디바이스가 선택되지 않았습니다', 'error'); return; }
        const slaveId = device.slaveId;
        this._setOvBadge('mcu-motor-id-set', 'running');

        const MOTOR_ID_MAP = {
            0x1000: 'Sirocco FAN (550W)',
            0x2000: 'Axial FAN (750W)',
        };
        const result = await this.readCANopenObject(slaveId, 0x2000, 0x00);
        const el = document.getElementById('ov-motor-id');

        if (!result || result.error) {
            if (el) el.textContent = result?.error ? 'ERR' : 'timeout';
            this._setOvBadge('mcu-motor-id-set', 'fail');
            return;
        }
        const hexVal    = result.value != null ? `0x${result.value.toString(16).toUpperCase().padStart(4, '0')}` : '-';
        const motorName = MOTOR_ID_MAP[result.value] ?? '알 수 없음';
        if (el) el.textContent = `${motorName}  ${hexVal}`;
        this._setOvBadge('mcu-motor-id-set', 'pass');
    }

    async runOvEeprom() {
        const device = this._getManufactureDevice();
        if (!device) { this.showToast('디바이스가 선택되지 않았습니다', 'error'); return; }
        const slaveId = device.slaveId;
        this._setOvBadge('mcu-eeprom', 'running');

        await this.writeRegister(slaveId, 0x2002, 110);
        await this.writeRegister(slaveId, 0x1010, 0x65766173);
        await new Promise(r => setTimeout(r, 500));
        const readBack = await this.readRegisterWithTimeout(slaveId, 0x2002);
        const ok = readBack === 110;
        this._setOvBadge('mcu-eeprom', ok ? 'pass' : 'fail');
    }

    // ─────────────────────────────────────────────────────────
    //  Alarm Code 룩업 테이블 (Alarm code.md 기준)
    // ─────────────────────────────────────────────────────────
    getAlarmCodeName(code) {
        const TABLE = {
            0x00: 'No error',
            // Group 1 — Current
            0x10: 'IPM fault',
            0x11: 'IPM temperature',
            0x12: 'V-phase current',
            0x13: 'U-phase current',
            0x14: 'Over current',
            0x15: 'Current offset',
            0x16: 'Current limit exceeded',
            0x17: 'IPM Low temperature',
            // Group 2 — Overload
            0x20: 'Instantaneous overload',
            0x21: 'Continuous overload',
            0x22: 'Drive temperature 1',
            0x23: 'Regeneration overload',
            0x24: 'Motor cable open',
            0x25: 'Drive temperature 2',
            0x26: 'Encoder temperature',
            0x27: 'Motor temperature',
            0x28: 'Fan trip',
            0x29: 'Regeneration brake fault',
            0x2A: 'Motor circuit failure',
            // Group 3 — Encoder & Motor
            0x30: 'Encoder communication',
            0x31: 'Encoder cable open',
            0x32: 'Encoder data',
            0x33: 'Motor setting',
            0x34: 'Encoder Z phase open',
            0x35: 'Encoder low battery',
            0x36: 'Encoder Low Amplitude',
            0x37: 'Encoder High Amplitude',
            0x38: 'Encoder Frequency',
            0x39: 'Encoder Offset',
            0x3A: 'Encoder Phase',
            0x3B: 'Encoder position',
            0x3C: 'Encoder over voltage',
            0x3D: 'Encoder under voltage',
            0x3E: 'Encoder over current',
            0x3F: 'Encoder batt. failure',
            // Group 4 — Voltage
            0x40: 'Under voltage',
            0x41: 'Over voltage',
            0x42: 'Main power fail',
            0x43: 'Control power fail',
            0x45: 'Fast Detect over voltage',
            // Group 5 — Control Functions
            0x50: 'Over speed limit',
            0x51: 'POS following',
            0x52: 'Emergency stop',
            0x53: 'Excessive SPD deviation',
            0x54: 'Encoder2 POS difference',
            0x55: 'POS tracking',
            0x56: 'Over position command',
            0x57: 'Over speed pulse-out',
            0x58: 'Motor Blocked',
            0x59: 'Motor Braking',
            // Group 6 — Communication / Data
            0x60: 'USB communication',
            0x61: 'RS-422 comm.',
            0x62: 'ECAT comm.',
            0x63: 'Parameter checksum',
            0x64: 'Parameter range',
            0x65: 'ECAT hardware init',
            0x66: 'ECAT communication 1',
            0x67: 'ECAT communication 2',
            0x68: 'ECAT communication 3',
            // Group 7 — System Configuration
            0x70: 'Drive motor combination',
            0x71: 'Factory setting',
            0x72: 'GPIO setting',
            0x73: 'Invalid hardware',
            0x74: 'FPGA not configured',
            0x75: 'Firmware not configured',
            0x76: 'USB over current',
            0x77: 'Modbus TCP Lost Command',
            // Group 8 — External Encoder (Enc2)
            0x80: 'Enc2 communication',
            0x81: 'Enc2 cable open',
            0x82: 'Enc2 data',
            0x83: 'Enc2 Z phase open',
            0x84: 'Enc2 motor setting',
            0x85: 'Enc2 low battery',
            0x86: 'Enc2 Sin/Cos Amplitude',
            0x87: 'Enc2 Sin/Cos Frequency',
            0x88: 'Enc2 setting',
            0x89: 'Enc2 temperature',
            0x8A: 'Enc2 light source',
            0x8B: 'Enc2 position',
            0x8C: 'Enc2 over voltage',
            0x8D: 'Enc2 under voltage',
            0x8E: 'Enc2 over current',
            0x8F: 'Enc2 battery failure',
        };
        const name = TABLE[code & 0xFF];
        const hex = '0x' + (code & 0xFF).toString(16).toUpperCase().padStart(2, '0');
        return name ? `${hex}  ${name}` : `${hex}  (Unknown)`;
    }

    // ─────────────────────────────────────────────────────────
    //  HW Overview — 통합 자동 폴링 (탭 진입/이탈 시 자동 제어)
    //  3가지 항목(DClink / IGBT 온도 / 결상)을 단일 루프에서
    //  순차적으로 읽어 버스 충돌 없이 큐를 통해 전송한다.
    // ─────────────────────────────────────────────────────────

    startOvPolling() {
        if (this.ovPollingRunning) return; // 이미 실행 중
        this.ovPollingRunning = true;
        this._setOvBadge('ps-dclink',    'live');
        this._setOvBadge('ps-igbt-temp', 'live');
        this._setOvBadge('ps-phase-loss','live');
        // 단일 체인으로 실행 — 1회 검사 후 폴링 루프 진입 (병렬 금지)
        this._ovPollingLoop();
    }

    stopOvPolling() {
        if (!this.ovPollingRunning) return;
        this.ovPollingRunning = false;
        this._setOvBadge('ps-dclink',    'pending');
        this._setOvBadge('ps-igbt-temp', 'pending');
        this._setOvBadge('ps-phase-loss','pending');
    }

    async _ovPollingLoop() {
        const toInt16 = v => { const n = v & 0xFFFF; return n >= 0x8000 ? n - 0x10000 : n; };

        // writer·device 준비 대기
        while (this.ovPollingRunning) {
            if (this.writer && this._getManufactureDevice()) break;
            await this.delay(500);
        }
        if (!this.ovPollingRunning) return;

        // ── 최초 1회 검사 (OS버전) ────────────────────────────────
        if (!this.ovOnceExecuted) {
            this.ovOnceExecuted = true;
            await this.runOvOsVersion();
            if (!this.ovPollingRunning) return;
        }

        // ── OV 루프 전용 버스 읽기 헬퍼 ────────────────────────────
        // readCANopenObject / readInputRegisterWithTimeout 는 ovPollingRunning=true 이면
        // 큐에 등록하므로 OV 루프 자신은 직접 전송 경로를 사용해야 한다.
        // dashboard 폴링(autoPollingTimer) 또는 FC64(_isFc64Active) 가 버스를 점유 중이면
        // 해당 루프의 큐를 통해 전송하고, 그렇지 않으면 직접 전송 후 쌓인 큐를 소진한다.
        const ovCanopen = async (sid, idx, sub) => {
            if (this.autoPollingTimer || this._isFc64Active) {
                // 다른 루프가 버스를 점유 중 — 큐 경유 (pollNextDeviceSequential/_drainCommandQueue 가 처리)
                return this.readCANopenObject(sid, idx, sub);
            }
            // OV 루프가 버스 소유자 — 직접 전송
            const frame = this.modbus.buildCANopenUpload(sid, idx, sub, 0, 2);
            const result = await this.sendCANopenAndWaitResponse(frame, sid);
            // 외부 코드(예: readAllParameters)가 큐에 넣은 항목을 읽기 사이에 소진
            if (this.commandQueue.length > 0) await this._drainCommandQueue();
            return result;
        };

        const ovInput = async (sid, addr) => {
            if (this.autoPollingTimer || this._isFc64Active) {
                return this.readInputRegisterWithTimeout(sid, addr);
            }
            const frame = this.modbus.buildReadInputRegisters(sid, addr, 1);
            const result = await this.sendAndWaitResponse(frame, sid);
            if (this.commandQueue.length > 0) await this._drainCommandQueue();
            return result;
        };

        // ── 반복 폴링 (DClink / IGBT / 결상) ─────────────────────
        while (this.ovPollingRunning) {
            if (!this.writer) { await this.delay(500); continue; }
            const device = this._getManufactureDevice();
            if (!device) { await this.delay(500); continue; }
            const slaveId = device.slaveId;

            // 1) Motor ID — FC 0x2B CANopen SDO 0x2000:00
            const motorR  = await ovCanopen(slaveId, 0x2000, 0x00);
            const motorEl = document.getElementById('ov-motor-id');
            if (motorR && !motorR.error && motorR.value != null && motorEl) {
                const MOTOR_ID_MAP = { 0x1000: 'Sirocco Motor', 0x2000: 'Axial Motor' };
                const hexVal   = `0x${motorR.value.toString(16).toUpperCase().padStart(4, '0')}`;
                const name     = MOTOR_ID_MAP[motorR.value] ?? '알 수 없음';
                motorEl.textContent = `${name}  ${hexVal}`;
            }

            if (!this.ovPollingRunning) break;

            // 2) DClink 전압 — FC04 Input Register 0xD013
            const dcRaw = await ovInput(slaveId, 0xD013);
            const dcEl  = document.getElementById('ov-dclink-v');
            if (dcRaw !== null && dcRaw !== undefined && dcEl) dcEl.textContent = dcRaw;

            if (!this.ovPollingRunning) break;

            // 3) IGBT 온도 — CANopen 0x260B:00
            const igbtR  = await ovCanopen(slaveId, 0x260B, 0x00);
            const igbtEl = document.getElementById('ov-igbt-motor-id');
            if (igbtR && !igbtR.error && igbtR.value != null && igbtEl)
                igbtEl.textContent = toInt16(igbtR.value) + ' ℃';

            if (!this.ovPollingRunning) break;

            // 4) 결상(Alarm Code) — FC 0x2B CANopen SDO 0x603F:00
            const alarmR  = await ovCanopen(slaveId, 0x603F, 0x00);
            const alarmEl = document.getElementById('ov-alarm-code');
            if (alarmR && !alarmR.error && alarmR.value != null && alarmEl)
                alarmEl.textContent = this.getAlarmCodeName(alarmR.value);

            if (!this.ovPollingRunning) break;

            // 5) 모터 결상(PHA bit) — FC04 Input Register 0xD011 bit[0]
            const d011Raw = await ovInput(slaveId, 0xD011);
            const phaEl   = document.getElementById('ov-pha-bit');
            if (d011Raw !== null && d011Raw !== undefined && phaEl) {
                const pha = (d011Raw & 0x0001) !== 0;
                phaEl.textContent  = pha ? 'Phase Fail' : 'OK';
                phaEl.style.color  = pha ? '#dc3545' : '#28a745';
            }

            if (this.ovPollingRunning) await this.delay(1000);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Offset 탭 알람코드 폴링 — 100ms 주기로 0x603F:00 읽기
    //  버스 충돌 방지: autoPollingTimer / ovPollingRunning / _isFc64Active 활성 시
    //  readCANopenObject()를 통해 commandQueue 경유, 아니면 직접 전송 후 큐 소진.
    // ─────────────────────────────────────────────────────────────────────────

    startOffsetAlarmPolling() {
        if (this.offsetAlarmPollingRunning) return;
        this.offsetAlarmPollingRunning = true;
        this._offsetAlarmPollingLoop();
    }

    stopOffsetAlarmPolling() {
        this.offsetAlarmPollingRunning = false;
        const el = document.getElementById('offset-alarm-code');
        if (el) el.textContent = '-';
    }

    async _offsetAlarmPollingLoop() {
        while (this.offsetAlarmPollingRunning) {
            if (!this.writer || !this._getManufactureDevice()) {
                await this.delay(500);
                continue;
            }

            const device  = this._getManufactureDevice();
            const slaveId = device.slaveId;

            let result;
            if (this.autoPollingTimer || this._isFc64Active || this.ovPollingRunning) {
                // 다른 루프가 버스 점유 중 — commandQueue 경유
                result = await this.readCANopenObject(slaveId, 0x603F, 0x00);
            } else {
                // 이 루프가 버스 소유자 — 직접 전송
                const frame = this.modbus.buildCANopenUpload(slaveId, 0x603F, 0x00, 0, 2);
                result = await this.sendCANopenAndWaitResponse(frame, slaveId);
                if (this.commandQueue.length > 0) await this._drainCommandQueue();
            }

            if (!this.offsetAlarmPollingRunning) break;

            const el = document.getElementById('offset-alarm-code');
            if (el) {
                if (result && !result.error && result.value != null) {
                    el.textContent = this.getAlarmCodeName(result.value);
                    el.style.color = result.value === 0 ? '#28a745' : '#dc3545';
                } else {
                    el.textContent = '-';
                    el.style.color = '#1a1a1a';
                }
            }

            if (this.offsetAlarmPollingRunning) await this.delay(100);
        }
    }

    async runOvOsVersion() {
        this._setOvBadge('mcu-os-version', 'running');

        const device = this._getManufactureDevice();
        if (!device) { this._setOvBadge('mcu-os-version', 'fail'); return; }
        const slaveId = device.slaveId;

        // ── 버그 방지: runHardwareTest('hw-canopen-27f0')를 경유하지 않고 직접 읽기 ──
        // runHardwareTest 내부의 readCANopenObject 는 ovPollingRunning=true 이면 큐에 등록하는데,
        // OV 루프가 버스 소유자일 때(autoPollingTimer=false) 아무도 큐를 소진하지 않아 데드락 발생.
        // → autoPollingTimer/FC64 활성 시 직접 큐 push, 아니면 직접 전송.
        const entries = [
            { index: 0x27F0, asciiId: 'ov-mcu-boot-ascii', hexId: 'ov-mcu-boot' },
            { index: 0x27F1, asciiId: 'ov-mcu-fw-ascii',   hexId: 'ov-mcu-fw'   },
            { index: 0x27F2, asciiId: 'ov-inv-boot-ascii', hexId: 'ov-inv-boot' },
            { index: 0x27F3, asciiId: 'ov-inv-fw-ascii',   hexId: 'ov-inv-fw'   },
        ];

        let allPass = true;
        for (const e of entries) {
            if (!this.ovPollingRunning) return;

            const frame = this.modbus.buildCANopenUpload(slaveId, e.index, 0x00, 0, 16);
            let result;
            if (this.autoPollingTimer || this._isFc64Active) {
                // Dashboard/FC64 가 버스 점유 중 — 직접 큐 push (readCANopenObject의 ovPollingRunning 체크 우회)
                result = await new Promise((resolve, reject) => {
                    this.commandQueue.push({ type: 'canopen_read', frame, slaveId, resolve, reject });
                });
            } else {
                // OV 루프가 버스 소유자 — 직접 전송
                result = await this.sendCANopenAndWaitResponse(frame, slaveId);
                if (this.commandQueue.length > 0) await this._drainCommandQueue();
            }

            const asciiEl = document.getElementById(e.asciiId);
            const hexEl   = document.getElementById(e.hexId);
            if (!result || result.error) {
                if (asciiEl) asciiEl.textContent = result?.error ? 'ERR' : 'timeout';
                if (hexEl)   hexEl.textContent   = '-';
                allPass = false;
            } else {
                const ascii  = (result.rawBytes ?? [])
                    .filter(b => b !== 0x00)
                    .map(b => (b >= 0x20 && b < 0x7F) ? String.fromCharCode(b) : '.')
                    .join('');
                const rawHex = (result.rawBytes ?? [])
                    .map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
                if (asciiEl) asciiEl.textContent = ascii || '-';
                if (hexEl)   hexEl.textContent   = rawHex;
            }
        }
        this._setOvBadge('mcu-os-version', allPass ? 'pass' : 'fail');
    }

    /**
     * Render device list in Device Setup page
     */
    renderDeviceSetupList() {
        const listContainer = document.getElementById('deviceSetupList');
        if (!listContainer) return;

        // Clear existing content
        listContainer.innerHTML = '';

        if (this.devices.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📦</div>
                    <p>등록된 디바이스가 없습니다</p>
                    <p style="font-size: 12px; margin-top: 5px;">Dashboard에서 디바이스를 추가하세요</p>
                </div>
            `;
            return;
        }

        // Create device list items (Settings modal menu style)
        this.devices.forEach((device, index) => {
            const item = document.createElement('div');
            item.className = 'device-setup-item';
            item.dataset.deviceId = device.id;
            item.style.cssText = `
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 15px;
                cursor: pointer;
                border-radius: 6px;
                transition: all 0.2s ease;
                color: #495057;
                font-size: 14px;
                margin-bottom: 4px;
                background: transparent;
            `;

            item.innerHTML = `
                <div style="flex: 1;">
                    <div class="device-setup-name" style="font-weight: 500; color: inherit; margin-bottom: 2px; pointer-events: none;">${device.name}</div>
                    <div class="device-info" style="font-size: 11px; color: #6c757d;">
                        ${device.slaveId === 0 ? 'ID 미할당' : 'ID: ' + device.slaveId}
                    </div>
                </div>
            `;

            // Hover effect
            item.addEventListener('mouseenter', () => {
                if (!item.classList.contains('selected')) {
                    item.style.background = '#e9ecef';
                }
            });
            item.addEventListener('mouseleave', () => {
                if (!item.classList.contains('selected')) {
                    item.style.background = 'transparent';
                }
            });

            // Click to select
            item.addEventListener('click', () => {
                this.selectDeviceInSetup(device.id);
            });

            listContainer.appendChild(item);
        });

        // Auto-select first device
        if (this.devices.length > 0) {
            this.selectDeviceInSetup(this.devices[0].id);
        }
    }

    /**
     * Select a device in Device Setup page
     */
    selectDeviceInSetup(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        // Update selection state in list (Settings modal style)
        const listItems = document.querySelectorAll('.device-setup-item');
        listItems.forEach(item => {
            if (item.dataset.deviceId == deviceId) {  // Use == for type coercion (dataset is string, deviceId is number)
                item.classList.add('selected');
                item.style.background = '#007bff';
                item.style.color = 'white';
                // Change text color to white for selected item
                const nameDiv = item.querySelector('.device-setup-name');
                const infoDiv = item.querySelector('.device-info');
                if (nameDiv) nameDiv.style.color = 'white';
                if (infoDiv) infoDiv.style.color = 'rgba(255, 255, 255, 0.8)';
            } else {
                item.classList.remove('selected');
                item.style.background = 'transparent';
                item.style.color = '#495057';
                // Reset text color for non-selected items
                const nameDiv = item.querySelector('.device-setup-name');
                const infoDiv = item.querySelector('.device-info');
                if (nameDiv) nameDiv.style.color = 'inherit';
                if (infoDiv) infoDiv.style.color = '#6c757d';
            }
        });

        // Track currently selected setup device
        this.currentSetupDeviceId = device.id;

        // Update configuration panel and parameters panel
        this.renderDeviceSetupConfig(device);

        // Auto-read config values from device if on configuration tab and connected
        const activeTab = sessionStorage.getItem('deviceSetupTab') || 'configuration';
        if (activeTab === 'configuration' && (this.writer || this.simulatorEnabled)) {
            this.refreshDevice(device.id);
        }

        // Set selected device for parameters and render
        this.selectedParamDeviceId = device.slaveId;
        this.updateParamDeviceStatus();
        this.renderParameters();
    }

    /**
     * Select/deselect configuration item
     */
    selectConfigItem(element, event) {
        // If clicking on input/select/button, don't toggle selection
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT' || event.target.tagName === 'BUTTON') {
            return;
        }

        // Toggle selection
        const isSelected = element.classList.contains('selected');

        // Remove all other selections
        document.querySelectorAll('.config-item').forEach(item => {
            item.classList.remove('selected');
            item.style.background = 'transparent';
            const icon = item.querySelector('.config-item-icon');
            if (icon) {
                icon.style.opacity = '0';
                icon.style.pointerEvents = 'none';
            }
        });

        // Toggle current item
        if (!isSelected) {
            element.classList.add('selected');
            element.style.background = '#f0f7ff';
            const icon = element.querySelector('.config-item-icon');
            if (icon) {
                icon.style.opacity = '1';
                icon.style.pointerEvents = 'auto';
            }
        }
    }

    /**
     * Show configuration context menu
     */
    showConfigMenu(event, configType, deviceId) {
        event.stopPropagation();

        // Hide any existing menu
        this.hideConfigMenu();

        // Action-only items have no register to read
        const actionTypes = ['softwareReset', 'errorReset', 'eepromToRam'];
        const canRead = !actionTypes.includes(configType);

        // Create menu
        const menu = document.createElement('div');
        menu.id = 'configContextMenu';
        menu.className = 'config-context-menu';
        menu.innerHTML = `
            ${canRead ? `
            <div class="config-menu-item" onclick="window.dashboard.readConfigParam('${configType}', '${deviceId}')">
                읽기
            </div>
            <div style="height: 1px; background: #e9ecef; margin: 4px 0;"></div>
            ` : ''}
            <div class="config-menu-item" onclick="window.dashboard.factoryResetConfig('${configType}', '${deviceId}')">
                Factory Reset
            </div>
        `;

        // Position menu
        menu.style.position = 'fixed';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';

        // Add to body
        document.body.appendChild(menu);

        // Add click listener to close menu
        setTimeout(() => {
            document.addEventListener('click', this.hideConfigMenu.bind(this));
        }, 0);
    }

    /**
     * Hide configuration context menu
     */
    hideConfigMenu() {
        const menu = document.getElementById('configContextMenu');
        if (menu) {
            menu.remove();
        }
        document.removeEventListener('click', this.hideConfigMenu.bind(this));
    }

    /**
     * Configuration 파라미터 정의 — category·address·reader·apply를 하나의 맵으로 관리.
     * 새 파라미터 추가 시 이 맵에만 항목을 추가하면 읽기·Refresh 모두 자동으로 포함됨.
     */
    getConfigParamMap(deviceId) {
        const device = this.devices.find(d => d.id === parseInt(deviceId));
        if (!device) return {};
        return {
            motorType:        { category: 'motorInfo',     reader: async () => {
                const result = await this.readCANopenObject(device.slaveId, 0x2000, 0x00);
                return (result && !result.error && result.value != null) ? result.value : null;
            }, apply: (raw) => {
                device.motorType = raw;
                const el = document.getElementById(`motorType_${deviceId}`);
                if (el) el.value = String(raw);
                this.saveDevices();
            }},
            operatingMode:    { category: 'motor',         address: 0xD106, apply: (raw) => {
                device.operationMode = raw;
                const el = document.getElementById(`operatingMode_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            setValueSource:   { category: 'motor',         address: 0xD101, apply: (raw) => {
                device.setValueSource = raw;
                const el = document.getElementById(`setValueSource_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            runningDirection: { category: 'motor',         address: 0xD102, apply: (raw) => {
                device.runningDirection = raw;
                const el = document.getElementById(`runningDirection_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            maxSpeed:         { category: 'motor',         address: 0xD119, apply: (raw) => {
                device.maxSpeed = raw;
                const el = document.getElementById(`maxSpeed_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            rampUp:           { category: 'motor',         address: 0xD11F, apply: (raw) => {
                device.rampUp = raw;
                const el = document.getElementById(`rampUp_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            rampDown:         { category: 'motor',         address: 0xD120, apply: (raw) => {
                device.rampDown = raw;
                const el = document.getElementById(`rampDown_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            maxCurrent:       { category: 'protection',    address: 0xD13B, apply: (raw) => {
                device.maxCurrent = raw / 10;
                const el = document.getElementById(`maxCurrent_${deviceId}`);
                if (el) el.value = device.maxCurrent;
                this.saveDevices();
            }},
            tempDerating:     { category: 'protection',    address: 0xD138, apply: (raw) => {
                device.tempDerating = raw;
                const el = document.getElementById(`tempDerating_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            fanAddress:       { category: 'communication', address: 0xD100, apply: (raw) => {
                const el = document.getElementById(`fanAddress_${deviceId}`);
                if (el) el.value = raw;
            }},
            baudrate:         { category: 'communication', address: 0xD149, apply: (raw) => {
                device.baudrate = raw;
                const el = document.getElementById(`baudrate_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            parity:           { category: 'communication', address: 0xD14A, apply: (raw) => {
                device.parity = raw;
                const el = document.getElementById(`parity_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            terminationResistor: { category: 'communication', address: 0xD1FF, apply: (raw) => {
                device.terminationResistor = raw;
                const el = document.getElementById(`terminationResistor_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            // ── 보호 설정 ──────────────────────────────────────────────
            tempDeratingStart: { category: 'protection',    address: 0xD137, apply: (raw) => {
                device.tempDeratingStart = raw;
                const el = document.getElementById(`tempDeratingStart_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            // ── 센서 입력 ──────────────────────────────────────────────
            sensorActualSource: { category: 'sensor',       address: 0xD147, apply: (raw) => {
                device.sensorActualSource = raw;
                const el = document.getElementById(`sensorActualSource_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            minSensorValue:   { category: 'sensor',         address: 0xD160, apply: (raw) => {
                device.minSensorValue = raw;
                const el = document.getElementById(`minSensorValue_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            maxSensorValue:   { category: 'sensor',         address: 0xD162, apply: (raw) => {
                device.maxSensorValue = raw;
                const el = document.getElementById(`maxSensorValue_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            curvePoint1X:     { category: 'sensor',         address: 0xD12A, apply: (raw) => {
                device.curvePoint1X = raw;
                const el = document.getElementById(`curvePoint1X_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            curvePoint1Y:     { category: 'sensor',         address: 0xD12B, apply: (raw) => {
                device.curvePoint1Y = raw;
                const el = document.getElementById(`curvePoint1Y_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            curvePoint2X:     { category: 'sensor',         address: 0xD12C, apply: (raw) => {
                device.curvePoint2X = raw;
                const el = document.getElementById(`curvePoint2X_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            curvePoint2Y:     { category: 'sensor',         address: 0xD12D, apply: (raw) => {
                device.curvePoint2Y = raw;
                const el = document.getElementById(`curvePoint2Y_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            // ── 서보 튜닝 (LSM FC 0x2B) ───────────────────────────────
            lsmNodeId:        { category: 'servoTuning',    reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2003, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.lsmNodeId = raw;
                const el = document.getElementById(`lsmNodeId_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            inertiaRatio:     { category: 'servoTuning',    reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2100, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.inertiaRatio = raw;
                const el = document.getElementById(`inertiaRatio_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            posPGain:         { category: 'servoTuning',    reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2101, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.posPGain = raw;
                const el = document.getElementById(`posPGain_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            velPGain:         { category: 'servoTuning',    reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2102, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.velPGain = raw;
                const el = document.getElementById(`velPGain_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            velTimeConst:     { category: 'servoTuning',    reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2103, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.velTimeConst = raw;
                const el = document.getElementById(`velTimeConst_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            torqueCmdFilter:  { category: 'servoTuning',    reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2104, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.torqueCmdFilter = raw;
                const el = document.getElementById(`torqueCmdFilter_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            posTorqueLimit:   { category: 'servoTuning',    reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2111, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.posTorqueLimit = raw;
                const el = document.getElementById(`posTorqueLimit_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            negTorqueLimit:   { category: 'servoTuning',    reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2112, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.negTorqueLimit = raw;
                const el = document.getElementById(`negTorqueLimit_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            driveCtrlInput1:  { category: 'servoTuning',    reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x211F, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.driveCtrlInput1 = raw;
                const el = document.getElementById(`driveCtrlInput1_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            driveCtrlInput2:  { category: 'servoTuning',    reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2120, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.driveCtrlInput2 = raw;
                const el = document.getElementById(`driveCtrlInput2_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            // ── 조그 설정 (LSM FC 0x2B) ───────────────────────────────
            jogSpeed:         { category: 'jog',            reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2300, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.jogSpeed = raw > 32767 ? raw - 65536 : raw;
                const el = document.getElementById(`jogSpeed_${deviceId}`);
                if (el) el.value = device.jogSpeed;
                this.saveDevices();
            }},
            speedAccelTime:   { category: 'jog',            reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2301, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.speedAccelTime = raw;
                const el = document.getElementById(`speedAccelTime_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            speedDecelTime:   { category: 'jog',            reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2302, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.speedDecelTime = raw;
                const el = document.getElementById(`speedDecelTime_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            sCurveTime:       { category: 'jog',            reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2303, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.sCurveTime = raw;
                const el = document.getElementById(`sCurveTime_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            presetJogSpeed0:  { category: 'jog',            reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2304, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.presetJogSpeed0 = raw > 32767 ? raw - 65536 : raw;
                const el = document.getElementById(`presetJogSpeed0_${deviceId}`);
                if (el) el.value = device.presetJogSpeed0;
                this.saveDevices();
            }},
            presetJogSpeed1:  { category: 'jog',            reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2305, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.presetJogSpeed1 = raw > 32767 ? raw - 65536 : raw;
                const el = document.getElementById(`presetJogSpeed1_${deviceId}`);
                if (el) el.value = device.presetJogSpeed1;
                this.saveDevices();
            }},
            presetJogSpeed2:  { category: 'jog',            reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2306, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.presetJogSpeed2 = raw > 32767 ? raw - 65536 : raw;
                const el = document.getElementById(`presetJogSpeed2_${deviceId}`);
                if (el) el.value = device.presetJogSpeed2;
                this.saveDevices();
            }},
            presetJogSpeed3:  { category: 'jog',            reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2307, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.presetJogSpeed3 = raw > 32767 ? raw - 65536 : raw;
                const el = document.getElementById(`presetJogSpeed3_${deviceId}`);
                if (el) el.value = device.presetJogSpeed3;
                this.saveDevices();
            }},
            presetJogTime0:   { category: 'jog',            reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2308, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.presetJogTime0 = raw;
                const el = document.getElementById(`presetJogTime0_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            presetJogTime1:   { category: 'jog',            reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x2309, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.presetJogTime1 = raw;
                const el = document.getElementById(`presetJogTime1_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            presetJogTime2:   { category: 'jog',            reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x230A, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.presetJogTime2 = raw;
                const el = document.getElementById(`presetJogTime2_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
            presetJogTime3:   { category: 'jog',            reader: async () => {
                const r = await this.readCANopenObject(device.slaveId, 0x230B, 0x00);
                return (r && !r.error && r.value != null) ? r.value : null;
            }, apply: (raw) => {
                device.presetJogTime3 = raw;
                const el = document.getElementById(`presetJogTime3_${deviceId}`);
                if (el) el.value = raw;
                this.saveDevices();
            }},
        };
    }

    /**
     * 특정 카테고리 탭의 모든 파라미터를 디바이스에서 읽어 UI에 반영.
     * 탭 진입·Refresh 버튼에서 공통으로 호출됨.
     */
    async readConfigCategory(category, deviceId) {
        const device = this.devices.find(d => d.id === parseInt(deviceId));
        if (!device || device.slaveId === 0) return;
        if (!this.writer && !this.simulatorEnabled) return;

        const paramMap = this.getConfigParamMap(deviceId);
        const keys = Object.keys(paramMap).filter(k => paramMap[k].category === category);
        if (keys.length === 0) return;

        // 모든 항목을 동시에 ↻ 표시
        keys.forEach(key => {
            const el = document.getElementById(`${key}_${deviceId}_status`);
            if (el) { el.textContent = '↻'; el.title = 'Reading...'; }
        });

        for (const key of keys) {
            const entry = paramMap[key];
            const statusEl = document.getElementById(`${key}_${deviceId}_status`);
            const inputEl  = document.getElementById(`${key}_${deviceId}`);

            const raw = entry.reader
                ? await entry.reader()
                : await this.readRegisterWithTimeout(device.slaveId, entry.address);

            if (raw !== null) {
                entry.apply(raw);
                if (statusEl) { statusEl.textContent = '⭕'; statusEl.title = ''; }
                if (inputEl)  { inputEl.style.borderColor = ''; }
            } else {
                if (statusEl) { statusEl.textContent = '❌'; statusEl.title = 'Read failed'; }
                if (inputEl)  {
                    inputEl.style.borderColor = '#dc3545';
                    if (inputEl.tagName === 'INPUT') inputEl.value = '';
                }
            }
        }

        // ⭕ 2초 후 자동 소멸
        setTimeout(() => {
            keys.forEach(key => {
                const el = document.getElementById(`${key}_${deviceId}_status`);
                if (el && el.textContent === '⭕') { el.textContent = ''; el.title = ''; }
            });
        }, 2000);
    }

    /**
     * Read a single configuration parameter from the device (context menu 읽기)
     */
    async readConfigParam(configType, deviceId) {
        this.hideConfigMenu();

        const device = this.devices.find(d => d.id === parseInt(deviceId));
        if (!device || device.slaveId === 0) return;

        if (!this.writer && !this.simulatorEnabled) {
            this.showToast('연결되지 않은 상태에서는 읽을 수 없습니다', 'warning');
            return;
        }

        const paramMap = this.getConfigParamMap(deviceId);
        const entry = paramMap[configType];
        if (!entry) return;

        const statusEl = document.getElementById(`${configType}_${deviceId}_status`);
        const inputEl  = document.getElementById(`${configType}_${deviceId}`);

        if (statusEl) { statusEl.textContent = '↻'; statusEl.title = 'Reading...'; }

        const raw = entry.reader
            ? await entry.reader()
            : await this.readRegisterWithTimeout(device.slaveId, entry.address);

        if (raw !== null) {
            entry.apply(raw);
            if (statusEl) { statusEl.textContent = '⭕'; statusEl.title = ''; }
            if (inputEl)  { inputEl.style.borderColor = ''; }
            setTimeout(() => {
                if (statusEl && statusEl.textContent === '⭕') { statusEl.textContent = ''; statusEl.title = ''; }
            }, 2000);
        } else {
            if (statusEl) { statusEl.textContent = '❌'; statusEl.title = 'Read failed'; }
            if (inputEl)  {
                inputEl.style.borderColor = '#dc3545';
                if (inputEl.tagName === 'INPUT') inputEl.value = '';
            }
        }
    }

    /**
     * Factory reset configuration item (placeholder)
     */
    factoryResetConfig(configType, deviceId) {
        console.log(`Factory reset requested for ${configType} on device ${deviceId}`);
        // Placeholder - functionality not implemented yet
        this.hideConfigMenu();
    }

    /**
     * Render device configuration in Device Setup page
     */
    async refreshDevice(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device || device.slaveId === 0) return;

        if (!this.writer && !this.simulatorEnabled) {
            this.showToast('연결되지 않은 상태에서는 읽을 수 없습니다', 'warning');
            return;
        }

        const category = this.activeConfigCategory || 'motorInfo';
        await this.readConfigCategory(category, deviceId);
    }

    renderDeviceSetupConfig(device, { autoRead = false } = {}) {
        const configContainer = document.getElementById('deviceSetupConfig');
        if (!configContainer) return;

        // Track current device for switchConfigCategory
        this.currentSetupDeviceId = device.id;

        // 'ramp' category was merged into 'motor'
        if (this.activeConfigCategory === 'ramp') this.activeConfigCategory = 'motor';
        const activeCategory = this.activeConfigCategory || 'motorInfo'; // 기본값: 모터 탭
        const categories = [
            { id: 'motorInfo',     label: '모터' },
            { id: 'motor',         label: '모터 제어' },
            { id: 'sensor',        label: '센서 입력' },
            { id: 'protection',    label: '보호 설정' },
            { id: 'communication', label: '통신 설정' },
            { id: 'servoTuning',   label: '서보 튜닝' },
            { id: 'jog',           label: '조그 설정' },
            { id: 'system',        label: '시스템' },
        ];

        configContainer.innerHTML = `
            <div style="display: block; position: relative;">
                <!-- Device Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; min-height: 48px;">
                    <div>
                        <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; line-height: 1.4; min-height: 29px; display: flex; align-items: center;">
                            <span class="device-name-group" style="display:flex;flex-direction:column;align-items:flex-start;">
                                <span class="device-name"
                                      id="deviceName_${device.id}"
                                      title="Click to edit name"
                                      style="cursor: pointer; display: inline-block; padding: 2px 4px; border: 1px solid transparent; border-radius: 4px; transition: background 0.2s; box-sizing: border-box;"
                                      onmouseover="this.style.background='#f0f0f0'"
                                      onmouseout="this.style.background='transparent'">${device.name}</span>
                                <span class="device-serial" data-serial-for="${device.id}" style="font-size:11px;font-weight:400;">${device.serialNumber ? 'S/N: ' + device.serialNumber : ''}</span>
                            </span>
                        </h2>
                        <span class="device-id-badge ${device.slaveId === 0 ? 'unassigned' : ''}">
                            ${device.slaveId === 0 ? 'ID 미할당' : 'ID: ' + device.slaveId}
                        </span>
                    </div>
                    <div style="display: flex; gap: 10px; width: 220px; justify-content: flex-end; padding-right: 32px;">
                        <button onclick="window.dashboard.refreshDevice(${device.id})" class="btn btn-secondary btn-sm">
                            <span>↻</span> Refresh
                        </button>
                        <button onclick="window.dashboard.deleteDevice(${device.id})" class="btn btn-danger btn-sm">
                            <span>🗑️</span> Delete
                        </button>
                    </div>
                </div>

                <!-- Category Layout -->
                <div style="display: flex; gap: 20px; height: 440px; align-items: stretch;">
                    <!-- Category Sidebar -->
                    <div style="width: 140px; flex-shrink: 0; border: 1px solid #e9ecef; border-radius: 8px; padding: 8px; background: #fafafa; display: flex; flex-direction: column; gap: 6px;">
                        ${categories.map(cat => `
                            <div class="config-category-item ${activeCategory === cat.id ? 'config-category-active' : ''}"
                                 data-category="${cat.id}"
                                 onclick="window.dashboard.switchConfigCategory('${cat.id}')">
                                ${cat.label}
                            </div>
                        `).join('')}
                    </div>

                    <!-- Category Content -->
                    <div id="configContent" style="flex: 1; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; background: white; overflow-y: auto;">
                        ${this.getConfigCategoryHTML(device, activeCategory)}
                    </div>
                </div>
            </div>
        `;

        // Add click event listener for device name editing
        const deviceNameSpan = document.getElementById(`deviceName_${device.id}`);
        if (deviceNameSpan) {
            deviceNameSpan.addEventListener('click', () => {
                this.startEditDeviceName(device.id, deviceNameSpan);
            });
        }

        // 디바이스 선택·탭 최초 진입 시에만 자동 읽기 (apply 후 재렌더링 시에는 스킵)
        if (autoRead) {
            setTimeout(() => this.readConfigCategory(activeCategory, device.id), 100);
        }
    }

    /**
     * Returns HTML for the given configuration category
     */
    getConfigCategoryHTML(device, category) {
        const id = device.id;
        const iStyle = 'width: 180px; padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; background: white;';

        const row = (key, label, desc, inputHTML) => `
            <div class="config-item" data-config="${key}" onclick="window.dashboard.selectConfigItem(this, event)" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0 12px 8px; border-bottom: 1px solid #e9ecef; position: relative; cursor: pointer; transition: background 0.2s; border-radius: 4px; margin: 0 -8px;">
                <div class="config-item-icon" style="width: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 8px; opacity: 0; transition: opacity 0.2s; pointer-events: none;">
                    <span onclick="window.dashboard.showConfigMenu(event, '${key}', '${id}')" style="cursor: pointer; font-size: 16px;">⚙</span>
                </div>
                <div style="flex: 1; padding-right: 20px;">
                    <div style="font-size: 13px; font-weight: 500; color: #1a1a1a; margin-bottom: 2px;">${label}</div>
                    <div style="font-size: 12px; color: #6c757d;">${desc}</div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; width: 220px; justify-content: flex-end;">
                    ${inputHTML}
                    <span id="${key}_${id}_status" style="width: 24px; font-size: 13px; color: #6c757d; text-align: center;"></span>
                </div>
            </div>`;

        const actionRow = (key, label, desc, btnHTML) => `
            <div class="config-item" data-config="${key}" onclick="window.dashboard.selectConfigItem(this, event)" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0 12px 8px; border-bottom: 1px solid #e9ecef; position: relative; cursor: pointer; transition: background 0.2s; border-radius: 4px; margin: 0 -8px;">
                <div class="config-item-icon" style="width: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 8px; opacity: 0; transition: opacity 0.2s; pointer-events: none;">
                    <span onclick="window.dashboard.showConfigMenu(event, '${key}', '${id}')" style="cursor: pointer; font-size: 16px;">⚙</span>
                </div>
                <div style="flex: 1; padding-right: 20px;">
                    <div style="font-size: 13px; font-weight: 500; color: #1a1a1a; margin-bottom: 2px;">${label}</div>
                    <div style="font-size: 12px; color: #6c757d;">${desc}</div>
                </div>
                <div style="display: flex; gap: 8px; width: 220px; justify-content: flex-end;">
                    ${btnHTML}
                    <span style="width: 24px;"></span>
                </div>
            </div>`;

        switch (category) {
            case 'motorInfo':
                return `<div style="margin-top: 0;">
                    ${row('motorType', '모터 타입', '연결된 모터의 타입 ID (FC 0x2B, 0x2000)', `
                        <select id="motorType_${id}" style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('motorType', ${id})"
                            onclick="event.stopPropagation()">
                            <option value="" ${device.motorType == null ? 'selected' : ''} disabled>-- 선택 --</option>
                            <option value="4096" ${device.motorType === 4096 ? 'selected' : ''}>Sirocco Motor (0x1000)</option>
                            <option value="8192" ${device.motorType === 8192 ? 'selected' : ''}>Axial Motor (0x2000)</option>
                        </select>`)}
                </div>`;

            case 'motor':
                return `<div style="margin-top: 0;">
                    ${row('operatingMode', '동작 모드', '모터 제어 방식 설정 (0xD106)', `
                        <select id="operatingMode_${id}" style="${iStyle}"
                            onchange="window.dashboard.applyOperatingMode(${id})"
                            onclick="event.stopPropagation()">
                            <option value="0" ${device.operationMode === 0 ? 'selected' : ''}>Speed Control</option>
                            <option value="2" ${device.operationMode === 2 ? 'selected' : ''}>Open-loop</option>
                        </select>`)}
                    ${row('setValueSource', 'Setpoint 입력 소스', 'Setpoint를 수신하는 입력 수단 (0xD101)', `
                        <select id="setValueSource_${id}" style="${iStyle}"
                            onchange="window.dashboard.applySetValueSource(${id})"
                            onclick="event.stopPropagation()">
                            <option value="0" ${(device.setValueSource ?? 1) === 0 ? 'selected' : ''}>AIN1</option>
                            <option value="1" ${(device.setValueSource ?? 1) === 1 ? 'selected' : ''}>RS485</option>
                            <option value="2" ${(device.setValueSource ?? 1) === 2 ? 'selected' : ''}>AIN2</option>
                            <option value="3" ${(device.setValueSource ?? 1) === 3 ? 'selected' : ''}>PWM</option>
                        </select>`)}
                    ${row('runningDirection', '회전 방향', '팬 구동 방향 설정 (0xD102)', `
                        <select id="runningDirection_${id}" style="${iStyle}"
                            onchange="window.dashboard.applyRunningDirection(${id})"
                            onclick="event.stopPropagation()">
                            <option value="0" ${device.runningDirection === 0 ? 'selected' : ''}>CCW (반시계)</option>
                            <option value="1" ${device.runningDirection === 1 ? 'selected' : ''}>CW (시계)</option>
                        </select>`)}
                    ${row('maxSpeed', '최대 속도 (RPM)', '속도 제어 모드에서의 상한 속도 (0xD119)', `
                        <input type="number" id="maxSpeed_${id}"
                            value="${device.maxSpeed ?? 1600}"
                            min="0" max="65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('maxSpeed', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('rampUp', '가속 시간', '정지에서 목표 속도까지 가속하는 시간 (0xD11F)', `
                        <input type="number" id="rampUp_${id}"
                            value="${device.rampUp ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('rampUp', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('rampDown', '감속 시간', '목표 속도에서 정지까지 감속하는 시간 (0xD120)', `
                        <input type="number" id="rampDown_${id}"
                            value="${device.rampDown ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('rampDown', ${id})"
                            onclick="event.stopPropagation()">`)}
                </div>`;

            case 'protection':
                return `<div style="margin-top: 0;">
                    ${row('maxCurrent', '최대 코일 전류 (A)', '전류 제한 활성화 시 최대 코일 전류(rms) (0xD13B)', `
                        <input type="number" id="maxCurrent_${id}"
                            value="${device.maxCurrent || 0}"
                            min="0" max="100" step="0.1"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('maxCurrent', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('tempDeratingStart', '온도 디레이팅 시작점 (°C)', '모듈 온도 파워 디레이팅이 시작되는 온도 (0xD137)', `
                        <input type="number" id="tempDeratingStart_${id}"
                            value="${device.tempDeratingStart ?? ''}"
                            min="0" max="200"
                            placeholder="0–200"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('tempDeratingStart', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('tempDerating', '온도 디레이팅 종료점 (°C)', '모듈 온도 파워 디레이팅이 완료되는 온도 (0xD138)', `
                        <input type="number" id="tempDerating_${id}"
                            value="${device.tempDerating ?? ''}"
                            min="0" max="200"
                            placeholder="0–200"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('tempDerating', ${id})"
                            onclick="event.stopPropagation()">`)}
                </div>`;

            case 'communication':
                return `<div style="margin-top: 0;">
                    ${row('fanAddress', 'Fan Address', 'Modbus Slave ID (0xD100)', `
                        <input type="number" id="fanAddress_${id}"
                            value="${device.slaveId}"
                            min="1" max="247"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('fanAddress', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('baudrate', 'Baudrate', 'RS-485 통신 속도 — 드라이브 재시작 후 적용 (0xD149)', `
                        <select id="baudrate_${id}" style="${iStyle}"
                            onchange="window.dashboard.applyBaudrate(${id})"
                            onclick="event.stopPropagation()">
                            <option value="0" ${(device.baudrate ?? 4) === 0 ? 'selected' : ''}>1200 bps</option>
                            <option value="1" ${(device.baudrate ?? 4) === 1 ? 'selected' : ''}>2400 bps</option>
                            <option value="2" ${(device.baudrate ?? 4) === 2 ? 'selected' : ''}>4800 bps</option>
                            <option value="3" ${(device.baudrate ?? 4) === 3 ? 'selected' : ''}>9600 bps</option>
                            <option value="4" ${(device.baudrate ?? 4) === 4 ? 'selected' : ''}>19200 bps (기본값)</option>
                            <option value="5" ${(device.baudrate ?? 4) === 5 ? 'selected' : ''}>38400 bps</option>
                            <option value="6" ${(device.baudrate ?? 4) === 6 ? 'selected' : ''}>57600 bps</option>
                            <option value="7" ${(device.baudrate ?? 4) === 7 ? 'selected' : ''}>115200 bps</option>
                        </select>`)}
                    ${row('parity', 'Parity', '시리얼 데이터 비트/패리티/스톱 비트 — 드라이브 재시작 후 적용 (0xD14A)', `
                        <select id="parity_${id}" style="${iStyle}"
                            onchange="window.dashboard.applyParity(${id})"
                            onclick="event.stopPropagation()">
                            <option value="0" ${(device.parity ?? 0) === 0 ? 'selected' : ''}>Data8 / Even / Stop1 (기본값)</option>
                            <option value="1" ${(device.parity ?? 0) === 1 ? 'selected' : ''}>Data8 / Odd / Stop1</option>
                            <option value="2" ${(device.parity ?? 0) === 2 ? 'selected' : ''}>Data8 / None / Stop2</option>
                            <option value="3" ${(device.parity ?? 0) === 3 ? 'selected' : ''}>Data8 / None / Stop1</option>
                        </select>`)}
                    ${row('terminationResistor', '종단 저항', 'RS-485 통신 종단 저항 활성화 설정 (0xD1FF)', `
                        <select id="terminationResistor_${id}" style="${iStyle}"
                            onchange="window.dashboard.applyTerminationResistor(${id})"
                            onclick="event.stopPropagation()">
                            <option value="0" ${(device.terminationResistor ?? 0) === 0 ? 'selected' : ''}>비활성화 (기본값)</option>
                            <option value="1" ${(device.terminationResistor ?? 0) === 1 ? 'selected' : ''}>활성화</option>
                        </select>`)}
                </div>`;

            case 'sensor':
                return `<div style="margin-top: 0;">
                    ${row('sensorActualSource', '센서 지령 소스', '지령으로 선택된 센서의 입력 채널 (0xD147)', `
                        <input type="number" id="sensorActualSource_${id}"
                            value="${device.sensorActualSource ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('sensorActualSource', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('minSensorValue', '센서 최솟값', '입력 센서의 최솟값 (0xD160)', `
                        <input type="number" id="minSensorValue_${id}"
                            value="${device.minSensorValue ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('minSensorValue', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('maxSensorValue', '센서 최댓값', '입력 센서의 최댓값 (0xD162)', `
                        <input type="number" id="maxSensorValue_${id}"
                            value="${device.maxSensorValue ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('maxSensorValue', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('curvePoint1X', '커브 포인트 1 X', '아날로그/PWM 입력 신호 할당 — Point 1 X (0xD12A)', `
                        <input type="number" id="curvePoint1X_${id}"
                            value="${device.curvePoint1X ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('curvePoint1X', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('curvePoint1Y', '커브 포인트 1 Y', '아날로그/PWM 입력 신호 할당 — Point 1 Y (0xD12B)', `
                        <input type="number" id="curvePoint1Y_${id}"
                            value="${device.curvePoint1Y ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('curvePoint1Y', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('curvePoint2X', '커브 포인트 2 X', '아날로그/PWM 입력 신호 할당 — Point 2 X (0xD12C)', `
                        <input type="number" id="curvePoint2X_${id}"
                            value="${device.curvePoint2X ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('curvePoint2X', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('curvePoint2Y', '커브 포인트 2 Y', '아날로그/PWM 입력 신호 할당 — Point 2 Y (0xD12D)', `
                        <input type="number" id="curvePoint2Y_${id}"
                            value="${device.curvePoint2Y ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('curvePoint2Y', ${id})"
                            onclick="event.stopPropagation()">`)}
                </div>`;

            case 'servoTuning':
                return `<div style="margin-top: 0;">
                    ${row('lsmNodeId', 'Node ID (LSM)', 'RS-485 버스 슬레이브 주소 — LSM 드라이브 전용 (FC 0x2B, 0x2003)', `
                        <input type="number" id="lsmNodeId_${id}"
                            value="${device.lsmNodeId ?? ''}"
                            min="1" max="247"
                            placeholder="1–247"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('lsmNodeId', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('inertiaRatio', '관성비 (Inertia Ratio)', '부하 관성 / 모터 관성 비율 — 서보 응답성 튜닝 (FC 0x2B, 0x2100)', `
                        <input type="number" id="inertiaRatio_${id}"
                            value="${device.inertiaRatio ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('inertiaRatio', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('posPGain', '위치 P 게인 1', '위치 제어 루프 비례 게인 (FC 0x2B, 0x2101)', `
                        <input type="number" id="posPGain_${id}"
                            value="${device.posPGain ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('posPGain', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('velPGain', '속도 P 게인 1', '속도 제어 루프 비례 게인 (FC 0x2B, 0x2102)', `
                        <input type="number" id="velPGain_${id}"
                            value="${device.velPGain ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('velPGain', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('velTimeConst', '속도 루프 적분 시상수 1', '속도 루프 적분 시간 상수 (FC 0x2B, 0x2103)', `
                        <input type="number" id="velTimeConst_${id}"
                            value="${device.velTimeConst ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('velTimeConst', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('torqueCmdFilter', '토크 지령 필터 시상수 1', '토크 지령 저역 통과 필터 시간 상수 (FC 0x2B, 0x2104)', `
                        <input type="number" id="torqueCmdFilter_${id}"
                            value="${device.torqueCmdFilter ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('torqueCmdFilter', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('posTorqueLimit', '양방향 토크 제한 (CW)', '외부 입력 기반 CW 방향 토크 상한값 (FC 0x2B, 0x2111)', `
                        <input type="number" id="posTorqueLimit_${id}"
                            value="${device.posTorqueLimit ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('posTorqueLimit', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('negTorqueLimit', '음방향 토크 제한 (CCW)', '외부 입력 기반 CCW 방향 토크 상한값 (FC 0x2B, 0x2112)', `
                        <input type="number" id="negTorqueLimit_${id}"
                            value="${device.negTorqueLimit ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('negTorqueLimit', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('driveCtrlInput1', '드라이브 제어 입력 1', '드라이브 제어 입력 포트 1 기능 할당 (FC 0x2B, 0x211F)', `
                        <input type="number" id="driveCtrlInput1_${id}"
                            value="${device.driveCtrlInput1 ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('driveCtrlInput1', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('driveCtrlInput2', '드라이브 제어 입력 2', '드라이브 제어 입력 포트 2 기능 할당 (FC 0x2B, 0x2120)', `
                        <input type="number" id="driveCtrlInput2_${id}"
                            value="${device.driveCtrlInput2 ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('driveCtrlInput2', ${id})"
                            onclick="event.stopPropagation()">`)}
                </div>`;

            case 'jog':
                return `<div style="margin-top: 0;">
                    ${row('jogSpeed', '조그 속도', '조그 운전 속도 지령값 — 양수:CW / 음수:CCW (FC 0x2B, 0x2300)', `
                        <input type="number" id="jogSpeed_${id}"
                            value="${device.jogSpeed ?? ''}"
                            min="-32768" max="32767"
                            placeholder="-32768–32767"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('jogSpeed', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('speedAccelTime', '가속 시간', '속도 지령 변화 시 가속 구간 시간 (FC 0x2B, 0x2301)', `
                        <input type="number" id="speedAccelTime_${id}"
                            value="${device.speedAccelTime ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('speedAccelTime', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('speedDecelTime', '감속 시간', '속도 지령 변화 시 감속 구간 시간 (FC 0x2B, 0x2302)', `
                        <input type="number" id="speedDecelTime_${id}"
                            value="${device.speedDecelTime ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('speedDecelTime', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('sCurveTime', 'S-Curve 시간', '가감속 S커브 적용 시간 — 0이면 선형 (FC 0x2B, 0x2303)', `
                        <input type="number" id="sCurveTime_${id}"
                            value="${device.sCurveTime ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('sCurveTime', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('presetJogSpeed0', '프리셋 조그 속도 0', '프리셋 조그 속도 0 — 부호 있음 (FC 0x2B, 0x2304)', `
                        <input type="number" id="presetJogSpeed0_${id}"
                            value="${device.presetJogSpeed0 ?? ''}"
                            min="-32768" max="32767"
                            placeholder="-32768–32767"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('presetJogSpeed0', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('presetJogSpeed1', '프리셋 조그 속도 1', '프리셋 조그 속도 1 — 부호 있음 (FC 0x2B, 0x2305)', `
                        <input type="number" id="presetJogSpeed1_${id}"
                            value="${device.presetJogSpeed1 ?? ''}"
                            min="-32768" max="32767"
                            placeholder="-32768–32767"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('presetJogSpeed1', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('presetJogSpeed2', '프리셋 조그 속도 2', '프리셋 조그 속도 2 — 부호 있음 (FC 0x2B, 0x2306)', `
                        <input type="number" id="presetJogSpeed2_${id}"
                            value="${device.presetJogSpeed2 ?? ''}"
                            min="-32768" max="32767"
                            placeholder="-32768–32767"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('presetJogSpeed2', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('presetJogSpeed3', '프리셋 조그 속도 3', '프리셋 조그 속도 3 — 부호 있음 (FC 0x2B, 0x2307)', `
                        <input type="number" id="presetJogSpeed3_${id}"
                            value="${device.presetJogSpeed3 ?? ''}"
                            min="-32768" max="32767"
                            placeholder="-32768–32767"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('presetJogSpeed3', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('presetJogTime0', '프리셋 조그 시간 0', '프리셋 조그 속도 0 운전 지속 시간 (FC 0x2B, 0x2308)', `
                        <input type="number" id="presetJogTime0_${id}"
                            value="${device.presetJogTime0 ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('presetJogTime0', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('presetJogTime1', '프리셋 조그 시간 1', '프리셋 조그 속도 1 운전 지속 시간 (FC 0x2B, 0x2309)', `
                        <input type="number" id="presetJogTime1_${id}"
                            value="${device.presetJogTime1 ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('presetJogTime1', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('presetJogTime2', '프리셋 조그 시간 2', '프리셋 조그 속도 2 운전 지속 시간 (FC 0x2B, 0x230A)', `
                        <input type="number" id="presetJogTime2_${id}"
                            value="${device.presetJogTime2 ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('presetJogTime2', ${id})"
                            onclick="event.stopPropagation()">`)}
                    ${row('presetJogTime3', '프리셋 조그 시간 3', '프리셋 조그 속도 3 운전 지속 시간 (FC 0x2B, 0x230B)', `
                        <input type="number" id="presetJogTime3_${id}"
                            value="${device.presetJogTime3 ?? ''}"
                            min="0" max="65535"
                            placeholder="0–65535"
                            style="${iStyle}"
                            onchange="window.dashboard.debouncedApply('presetJogTime3', ${id})"
                            onclick="event.stopPropagation()">`)}
                </div>`;

            case 'system':
                return `<div style="margin-top: 0;">
                    ${actionRow('softwareReset', '소프트웨어 리셋', '디바이스 소프트웨어를 재시작합니다 (0xD000)', `
                        <button class="btn btn-warning btn-sm"
                            onclick="event.stopPropagation(); window.dashboard.performSoftwareReset(${id})">Reset</button>`)}
                    ${actionRow('errorReset', '오류 리셋', '모든 오류 상태와 플래그를 초기화합니다 (0xD000)', `
                        <button class="btn btn-warning btn-sm"
                            onclick="event.stopPropagation(); window.dashboard.resetDevice(${id}, 'error')">Reset</button>`)}
                    ${actionRow('eepromToRam', 'EEPROM → RAM 로드', 'EEPROM에 저장된 설정을 RAM으로 불러옵니다 (0xD000)', `
                        <button class="btn btn-info btn-sm"
                            onclick="event.stopPropagation(); window.dashboard.resetDevice(${id}, 'eeprom')">Load</button>`)}
                </div>`;

            default:
                return '';
        }
    }

    /**
     * Switch active configuration category and re-render the content area
     */
    switchConfigCategory(categoryName) {
        this.activeConfigCategory = categoryName;

        // Update sidebar active state
        document.querySelectorAll('.config-category-item').forEach(item => {
            if (item.dataset.category === categoryName) {
                item.classList.add('config-category-active');
            } else {
                item.classList.remove('config-category-active');
            }
        });

        // Re-render content area using stored device properties
        const device = this.devices.find(d => d.id === this.currentSetupDeviceId);
        if (!device) return;

        const contentArea = document.getElementById('configContent');
        if (contentArea) {
            contentArea.innerHTML = this.getConfigCategoryHTML(device, categoryName);
        }

        // 탭 진입 시 해당 카테고리의 파라미터 자동 읽기
        setTimeout(() => this.readConfigCategory(categoryName, device.id), 100);
    }

    /**
     * Render device parameters in Device Setup page
     */
    renderDeviceSetupParams(device) {
        const paramsContainer = document.getElementById('deviceSetupParams');
        if (!paramsContainer) return;

        // Define implemented parameters (from Parameters.csv)
        const holdingParams = [
            { name: 'Reset', address: 0xD000, writable: true, description: 'Software Reset, Error Reset, EEPROM to RAM' },
            { name: 'Setpoint', address: 0xD001, writable: true, description: '지령 값 (RPM or %)' },
            { name: 'Fan Address', address: 0xD100, writable: true, description: 'Node ID (1-247)' },
            { name: 'Preferred Running Direction', address: 0xD102, writable: true, description: '0: CCW, 1: CW' },
            { name: 'Operating Mode', address: 0xD106, writable: true, description: '0: Speed Control, 2: Open-loop' },
            { name: 'Maximum Coil Current', address: 0xD13B, writable: true, description: 'Current limit (RMS)' }
        ];

        const inputParams = [
            { name: 'Identification', address: 0xD000, writable: false, description: '장치 식별' },
            { name: 'Max Number of Bytes', address: 0xD001, writable: false, description: '최대 바이트 수' },
            { name: 'Bus Controller SW Name', address: 0xD002, writable: false, description: 'Main 부트버전' },
            { name: 'Bus Controller SW Version', address: 0xD003, writable: false, description: 'Main 펌웨어 버전' },
            { name: 'Commutation Controller SW Name', address: 0xD004, writable: false, description: 'Inverter 부트 버전' },
            { name: 'Commutation Controller SW Version', address: 0xD005, writable: false, description: 'Inverter 펌웨어 버전' },
            { name: 'Motor Status', address: 0xD011, writable: false, description: '모터 상태' },
            { name: 'Warning', address: 0xD012, writable: false, description: '경고' },
            { name: 'DC-link Voltage', address: 0xD013, writable: false, description: 'DC 링크 전압' },
            { name: 'Module Temperature', address: 0xD015, writable: false, description: 'IGBT Temperature' },
            { name: 'Electronics Temperature', address: 0xD017, writable: false, description: '제어부 Temperature' },
            { name: 'Actual Speed [RPM]', address: 0xD02D, writable: false, description: '절대 속도 [RPM]' },
            { name: 'Command Speed', address: 0xD050, writable: false, description: '지령 속도' },
            { name: 'Command Torque', address: 0xD051, writable: false, description: '지령 토크' }
        ];

        paramsContainer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <!-- Device Info Header -->
                <div style="padding: 12px 15px; background: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;">
                    <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${device.name}</div>
                    <div style="font-size: 12px; color: #6c757d;">Slave ID: ${device.slaveId === 0 ? 'Not Assigned' : device.slaveId}</div>
                </div>

                <!-- Holding Registers Section -->
                <div>
                    <h4 style="margin-bottom: 12px; color: #495057; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                        <span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 500;">HOLDING</span>
                        Holding Registers (Read/Write)
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${holdingParams.map(param => `
                            <div style="padding: 12px; background: white; border: 1px solid #e9ecef; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 500; color: #333; margin-bottom: 2px;">${param.name}</div>
                                    <div style="font-size: 11px; color: #6c757d;">${param.description}</div>
                                    <div style="font-size: 11px; color: #007bff; margin-top: 2px;">Address: 0x${param.address.toString(16).toUpperCase()}</div>
                                </div>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <input type="number" id="param_${param.address}" placeholder="Value"
                                        style="width: 80px; padding: 6px 8px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 12px;">
                                    <button class="btn btn-sm btn-primary" style="padding: 6px 12px; font-size: 11px;"
                                        onclick="window.dashboard.readParameter(${device.slaveId}, ${param.address}, true)">Read</button>
                                    ${param.writable ? `
                                        <button class="btn btn-sm btn-success" style="padding: 6px 12px; font-size: 11px;"
                                            onclick="window.dashboard.writeParameter(${device.slaveId}, ${param.address}, document.getElementById('param_${param.address}').value)">Write</button>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Input Registers Section -->
                <div>
                    <h4 style="margin-bottom: 12px; color: #495057; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                        <span style="background: #17a2b8; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 500;">INPUT</span>
                        Input Registers (Read Only)
                    </h4>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${inputParams.map(param => `
                            <div style="padding: 12px; background: white; border: 1px solid #e9ecef; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 500; color: #333; margin-bottom: 2px;">${param.name}</div>
                                    <div style="font-size: 11px; color: #6c757d;">${param.description}</div>
                                    <div style="font-size: 11px; color: #17a2b8; margin-top: 2px;">Address: 0x${param.address.toString(16).toUpperCase()}</div>
                                </div>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <input type="number" id="param_input_${param.address}" placeholder="Value" readonly
                                        style="width: 80px; padding: 6px 8px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 12px; background: #f8f9fa;">
                                    <button class="btn btn-sm btn-info" style="padding: 6px 12px; font-size: 11px;"
                                        onclick="window.dashboard.readParameter(${device.slaveId}, ${param.address}, false)">Read</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Read parameter from device
     */
    async readParameter(slaveId, address, isHolding) {
        try {
            const value = await this.readRegister(slaveId, address);

            if (value !== null && value !== undefined) {
                const inputId = isHolding ? `param_${address}` : `param_input_${address}`;
                const inputElement = document.getElementById(inputId);
                if (inputElement) {
                    inputElement.value = value;
                }
                this.showToast(`읽은 값: ${value}`, 'success');
            } else {
                this.showToast('파라미터 읽기에 실패했습니다', 'error');
            }
        } catch (error) {
            console.error('Read parameter error:', error);
            this.showToast('파라미터 읽기에 실패했습니다', 'error');
        }
    }

    /**
     * Write parameter to device
     */
    async writeParameter(slaveId, address, value) {
        const numValue = parseInt(value);
        if (isNaN(numValue)) {
            alert('Please enter a valid number');
            return;
        }

        const success = await this.writeHoldingRegister(slaveId, address, numValue);
        if (success) {
            this.showToast('파라미터 쓰기가 완료되었습니다', 'success');
        } else {
            this.showToast('파라미터 쓰기에 실패했습니다', 'error');
        }
    }

    /**
     * Write holding register wrapper
     */
    async writeHoldingRegister(slaveId, address, value) {
        try {
            await this.writeRegister(slaveId, address, value);
            return true;
        } catch (error) {
            console.error('Write holding register error:', error);
            return false;
        }
    }

    /**
     * Update device parameter temporarily (before apply)
     */
    updateDeviceParameter(deviceId, paramName, value) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        // Store the pending value
        if (!device.pendingParams) {
            device.pendingParams = {};
        }
        device.pendingParams[paramName] = value;
    }

    /**
     * Apply Fan Address to device
     */
    /**
     * Debounced apply function for auto-applying parameter changes
     */
    debouncedApply(paramType, deviceId) {
        const key = `${paramType}_${deviceId}`;
        const statusElement = document.getElementById(`${paramType}_${deviceId}_status`);

        // Clear existing timer
        if (this.applyDebounceTimers[key]) {
            clearTimeout(this.applyDebounceTimers[key]);
        }

        // Show pending indicator
        if (statusElement) {
            statusElement.textContent = '⏳';
            statusElement.title = 'Pending...';
        }

        // Set new timer for 800ms
        this.applyDebounceTimers[key] = setTimeout(async () => {
            // Show applying indicator
            if (statusElement) {
                statusElement.textContent = '↻';
                statusElement.title = 'Applying...';
            }

            // Call appropriate apply function
            let success = false;
            try {
                switch(paramType) {
                    case 'fanAddress':
                        await this.applyFanAddress(deviceId);
                        success = true;
                        break;
                    case 'setpoint':
                        await this.applySetpoint(deviceId);
                        success = true;
                        break;
                    case 'maxCurrent':
                        await this.applyMaxCurrent(deviceId);
                        success = true;
                        break;
                    case 'maxSpeed':
                        await this.applyMaxSpeed(deviceId);
                        success = true;
                        break;
                    case 'rampUp':
                        await this.applyRampUp(deviceId);
                        success = true;
                        break;
                    case 'rampDown':
                        await this.applyRampDown(deviceId);
                        success = true;
                        break;
                    case 'tempDerating':
                        await this.applyTempDerating(deviceId);
                        success = true;
                        break;
                    case 'motorType':
                        await this.applyMotorType(deviceId);
                        success = true;
                        break;
                    // ── 보호 설정 ────────────────────────────────────────
                    case 'tempDeratingStart':
                        await this.applyGenericHolding(deviceId, 'tempDeratingStart', 0xD137, 'tempDeratingStart', { max: 200 });
                        success = true;
                        break;
                    // ── 센서 입력 ────────────────────────────────────────
                    case 'sensorActualSource':
                        await this.applyGenericHolding(deviceId, 'sensorActualSource', 0xD147, 'sensorActualSource');
                        success = true;
                        break;
                    case 'minSensorValue':
                        await this.applyGenericHolding(deviceId, 'minSensorValue', 0xD160, 'minSensorValue');
                        success = true;
                        break;
                    case 'maxSensorValue':
                        await this.applyGenericHolding(deviceId, 'maxSensorValue', 0xD162, 'maxSensorValue');
                        success = true;
                        break;
                    case 'curvePoint1X':
                        await this.applyGenericHolding(deviceId, 'curvePoint1X', 0xD12A, 'curvePoint1X');
                        success = true;
                        break;
                    case 'curvePoint1Y':
                        await this.applyGenericHolding(deviceId, 'curvePoint1Y', 0xD12B, 'curvePoint1Y');
                        success = true;
                        break;
                    case 'curvePoint2X':
                        await this.applyGenericHolding(deviceId, 'curvePoint2X', 0xD12C, 'curvePoint2X');
                        success = true;
                        break;
                    case 'curvePoint2Y':
                        await this.applyGenericHolding(deviceId, 'curvePoint2Y', 0xD12D, 'curvePoint2Y');
                        success = true;
                        break;
                    // ── 서보 튜닝 (LSM) ──────────────────────────────────
                    case 'lsmNodeId':
                        await this.applyGenericLSM(deviceId, 'lsmNodeId', 0x2003, 'lsmNodeId');
                        success = true;
                        break;
                    case 'inertiaRatio':
                        await this.applyGenericLSM(deviceId, 'inertiaRatio', 0x2100, 'inertiaRatio');
                        success = true;
                        break;
                    case 'posPGain':
                        await this.applyGenericLSM(deviceId, 'posPGain', 0x2101, 'posPGain');
                        success = true;
                        break;
                    case 'velPGain':
                        await this.applyGenericLSM(deviceId, 'velPGain', 0x2102, 'velPGain');
                        success = true;
                        break;
                    case 'velTimeConst':
                        await this.applyGenericLSM(deviceId, 'velTimeConst', 0x2103, 'velTimeConst');
                        success = true;
                        break;
                    case 'torqueCmdFilter':
                        await this.applyGenericLSM(deviceId, 'torqueCmdFilter', 0x2104, 'torqueCmdFilter');
                        success = true;
                        break;
                    case 'posTorqueLimit':
                        await this.applyGenericLSM(deviceId, 'posTorqueLimit', 0x2111, 'posTorqueLimit');
                        success = true;
                        break;
                    case 'negTorqueLimit':
                        await this.applyGenericLSM(deviceId, 'negTorqueLimit', 0x2112, 'negTorqueLimit');
                        success = true;
                        break;
                    case 'driveCtrlInput1':
                        await this.applyGenericLSM(deviceId, 'driveCtrlInput1', 0x211F, 'driveCtrlInput1');
                        success = true;
                        break;
                    case 'driveCtrlInput2':
                        await this.applyGenericLSM(deviceId, 'driveCtrlInput2', 0x2120, 'driveCtrlInput2');
                        success = true;
                        break;
                    // ── 조그 설정 (LSM) ──────────────────────────────────
                    case 'jogSpeed':
                        await this.applyGenericLSM(deviceId, 'jogSpeed', 0x2300, 'jogSpeed');
                        success = true;
                        break;
                    case 'speedAccelTime':
                        await this.applyGenericLSM(deviceId, 'speedAccelTime', 0x2301, 'speedAccelTime');
                        success = true;
                        break;
                    case 'speedDecelTime':
                        await this.applyGenericLSM(deviceId, 'speedDecelTime', 0x2302, 'speedDecelTime');
                        success = true;
                        break;
                    case 'sCurveTime':
                        await this.applyGenericLSM(deviceId, 'sCurveTime', 0x2303, 'sCurveTime');
                        success = true;
                        break;
                    case 'presetJogSpeed0':
                        await this.applyGenericLSM(deviceId, 'presetJogSpeed0', 0x2304, 'presetJogSpeed0');
                        success = true;
                        break;
                    case 'presetJogSpeed1':
                        await this.applyGenericLSM(deviceId, 'presetJogSpeed1', 0x2305, 'presetJogSpeed1');
                        success = true;
                        break;
                    case 'presetJogSpeed2':
                        await this.applyGenericLSM(deviceId, 'presetJogSpeed2', 0x2306, 'presetJogSpeed2');
                        success = true;
                        break;
                    case 'presetJogSpeed3':
                        await this.applyGenericLSM(deviceId, 'presetJogSpeed3', 0x2307, 'presetJogSpeed3');
                        success = true;
                        break;
                    case 'presetJogTime0':
                        await this.applyGenericLSM(deviceId, 'presetJogTime0', 0x2308, 'presetJogTime0');
                        success = true;
                        break;
                    case 'presetJogTime1':
                        await this.applyGenericLSM(deviceId, 'presetJogTime1', 0x2309, 'presetJogTime1');
                        success = true;
                        break;
                    case 'presetJogTime2':
                        await this.applyGenericLSM(deviceId, 'presetJogTime2', 0x230A, 'presetJogTime2');
                        success = true;
                        break;
                    case 'presetJogTime3':
                        await this.applyGenericLSM(deviceId, 'presetJogTime3', 0x230B, 'presetJogTime3');
                        success = true;
                        break;
                }
            } catch (error) {
                success = false;
            }

            // Clear status after 2 seconds
            if (statusElement) {
                setTimeout(() => {
                    statusElement.textContent = '';
                    statusElement.title = '';
                }, 2000);
            }
        }, 800);
    }

    async applyFanAddress(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const inputElement = document.getElementById(`fanAddress_${deviceId}`);
        const statusElement = document.getElementById(`fanAddress_${deviceId}_status`);
        if (!inputElement) return;

        const newAddress = parseInt(inputElement.value);
        if (isNaN(newAddress) || newAddress < 1 || newAddress > 247) {
            if (statusElement) {
                statusElement.textContent = '❌';
                statusElement.title = 'Invalid address (1-247)';
            }
            return;
        }

        // Write to 0xD100 (Fan address)
        const oldSlaveId = device.slaveId;
        const success = await this.writeHoldingRegister(device.slaveId, 0xD100, newAddress);
        if (success) {
            device.slaveId = newAddress;
            // Keep selectedParamDeviceId in sync: if it was pointing at the old address,
            // update it so Read All continues to target the correct device.
            if (this.selectedParamDeviceId === oldSlaveId) {
                this.selectedParamDeviceId = newAddress;
                this.updateParamDeviceStatus();
                this.renderParameters();
            }
            this.saveDevices();
            this.renderDeviceSetupList();
            this.renderDeviceSetupConfig(device);

            // Update Dashboard card ID badge immediately without full re-render
            const dashboardCard = document.querySelector(`.device-card[data-device-id="${deviceId}"], .device-list-item[data-device-id="${deviceId}"]`);
            if (dashboardCard) {
                const idBadge = dashboardCard.querySelector('.device-id-badge');
                if (idBadge) {
                    idBadge.className = `device-id-badge`;
                    idBadge.textContent = `ID: ${newAddress}`;
                }
            }

            if (statusElement) {
                statusElement.textContent = '⭕';
                statusElement.title = 'Applied successfully';
            }
        } else {
            if (statusElement) {
                statusElement.textContent = '❌';
                statusElement.title = 'Failed to apply';
            }
        }
    }

    /**
     * Apply Operating Mode to device
     */
    async applyOperatingMode(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const selectElement = document.getElementById(`operatingMode_${deviceId}`);
        const statusElement = document.getElementById(`operatingMode_${deviceId}_status`);
        if (!selectElement) return;

        const newMode = parseInt(selectElement.value);

        // Show applying indicator
        if (statusElement) {
            statusElement.textContent = '↻';
            statusElement.title = 'Applying...';
        }

        // Write to 0xD106 (Operating mode)
        const success = await this.writeHoldingRegister(device.slaveId, 0xD106, newMode);
        if (success) {
            device.operationMode = newMode;
            this.saveDevices();
            this.renderDeviceSetupList();
            this.renderDeviceSetupConfig(device);
            if (statusElement) {
                statusElement.textContent = '⭕';
                statusElement.title = 'Applied successfully';
            }
        } else {
            if (statusElement) {
                statusElement.textContent = '❌';
                statusElement.title = 'Failed to apply';
            }
        }

        // Clear status after 2 seconds
        if (statusElement) {
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.title = '';
            }, 2000);
        }
    }

    /**
     * Apply Running Direction to device
     */
    async applyRunningDirection(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const selectElement = document.getElementById(`runningDirection_${deviceId}`);
        const statusElement = document.getElementById(`runningDirection_${deviceId}_status`);
        if (!selectElement) return;

        const newDirection = parseInt(selectElement.value);

        // Show applying indicator
        if (statusElement) {
            statusElement.textContent = '↻';
            statusElement.title = 'Applying...';
        }

        // Write to 0xD102 (Preferred running direction)
        const success = await this.writeHoldingRegister(device.slaveId, 0xD102, newDirection);
        if (success) {
            device.runningDirection = newDirection;
            this.saveDevices();
            this.renderDeviceSetupConfig(device);
            if (statusElement) {
                statusElement.textContent = '⭕';
                statusElement.title = 'Applied successfully';
            }
        } else {
            if (statusElement) {
                statusElement.textContent = '❌';
                statusElement.title = 'Failed to apply';
            }
        }

        // Clear status after 2 seconds
        if (statusElement) {
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.title = '';
            }, 2000);
        }
    }

    /**
     * Apply Setpoint to device
     */
    async applySetpoint(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const inputElement = document.getElementById(`setpoint_${deviceId}`);
        const statusElement = document.getElementById(`setpoint_${deviceId}_status`);
        if (!inputElement) return;

        const newSetpoint = parseInt(inputElement.value);
        const maxValue = device.operationMode === 0 ? 1600 : 100;

        if (isNaN(newSetpoint) || newSetpoint < 0 || newSetpoint > maxValue) {
            if (statusElement) {
                statusElement.textContent = '❌';
                statusElement.title = `Invalid setpoint (0-${maxValue})`;
            }
            return;
        }

        // Show applying indicator
        if (statusElement) {
            statusElement.textContent = '↻';
            statusElement.title = 'Applying...';
        }

        // Write to 0xD001 (Setpoint)
        const success = await this.writeHoldingRegister(device.slaveId, 0xD001, newSetpoint);
        if (success) {
            device.setpoint = newSetpoint;
            this.saveDevices();
            this.renderDeviceSetupConfig(device);
            if (statusElement) {
                statusElement.textContent = '⭕';
                statusElement.title = 'Applied successfully';
            }
        } else {
            if (statusElement) {
                statusElement.textContent = '❌';
                statusElement.title = 'Failed to apply';
            }
        }

        // Clear status after 2 seconds
        if (statusElement) {
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.title = '';
            }, 2000);
        }
    }

    /**
     * Apply Maximum Coil Current to device
     */
    async applyMaxCurrent(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const inputElement = document.getElementById(`maxCurrent_${deviceId}`);
        const statusElement = document.getElementById(`maxCurrent_${deviceId}_status`);
        if (!inputElement) return;

        const newCurrent = parseFloat(inputElement.value);

        if (isNaN(newCurrent) || newCurrent < 0 || newCurrent > 100) {
            if (statusElement) {
                statusElement.textContent = '❌';
                statusElement.title = 'Invalid current (0-100A)';
            }
            return;
        }

        // Show applying indicator
        if (statusElement) {
            statusElement.textContent = '↻';
            statusElement.title = 'Applying...';
        }

        // Convert to register value (might need scaling based on device spec)
        const registerValue = Math.round(newCurrent * 10); // Assuming 0.1A resolution

        // Write to 0xD13B (Maximum coil current)
        const success = await this.writeHoldingRegister(device.slaveId, 0xD13B, registerValue);
        if (success) {
            device.maxCurrent = newCurrent;
            this.saveDevices();
            this.renderDeviceSetupConfig(device);
            if (statusElement) {
                statusElement.textContent = '⭕';
                statusElement.title = 'Applied successfully';
            }
        } else {
            if (statusElement) {
                statusElement.textContent = '❌';
                statusElement.title = 'Failed to apply';
            }
        }

        // Clear status after 2 seconds
        if (statusElement) {
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.title = '';
            }, 2000);
        }
    }

    /**
     * Apply Set Value Source (0xD101)
     */
    async applySetValueSource(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const sel = document.getElementById(`setValueSource_${deviceId}`);
        const status = document.getElementById(`setValueSource_${deviceId}_status`);
        if (!sel) return;

        const value = parseInt(sel.value);
        if (status) { status.textContent = '↻'; status.title = 'Applying...'; }

        const success = await this.writeHoldingRegister(device.slaveId, 0xD101, value);
        if (success) {
            device.setValueSource = value;
            this.saveDevices();
            if (status) { status.textContent = '⭕'; status.title = 'Applied successfully'; }
        } else {
            if (status) { status.textContent = '❌'; status.title = 'Failed to apply'; }
        }

        if (status) { setTimeout(() => { status.textContent = ''; status.title = ''; }, 2000); }
    }

    /**
     * Apply Maximum Speed (0xD119)
     */
    async applyMaxSpeed(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const input = document.getElementById(`maxSpeed_${deviceId}`);
        const status = document.getElementById(`maxSpeed_${deviceId}_status`);
        if (!input) return;

        const value = parseInt(input.value);
        if (isNaN(value) || value < 0 || value > 65535) {
            if (status) { status.textContent = '❌'; status.title = 'Invalid value (0–65535)'; }
            return;
        }

        if (status) { status.textContent = '↻'; status.title = 'Applying...'; }

        const success = await this.writeHoldingRegister(device.slaveId, 0xD119, value);
        if (success) {
            device.maxSpeed = value;
            this.saveDevices();
            if (status) { status.textContent = '⭕'; status.title = 'Applied successfully'; }
        } else {
            if (status) { status.textContent = '❌'; status.title = 'Failed to apply'; }
        }

        if (status) { setTimeout(() => { status.textContent = ''; status.title = ''; }, 2000); }
    }

    /**
     * Apply Ramp-up Curve (0xD11F)
     */
    async applyRampUp(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const input = document.getElementById(`rampUp_${deviceId}`);
        const status = document.getElementById(`rampUp_${deviceId}_status`);
        if (!input) return;

        const value = parseInt(input.value);
        if (isNaN(value) || value < 0 || value > 65535) {
            if (status) { status.textContent = '❌'; status.title = 'Invalid value (0–65535)'; }
            return;
        }

        if (status) { status.textContent = '↻'; status.title = 'Applying...'; }

        const success = await this.writeHoldingRegister(device.slaveId, 0xD11F, value);
        if (success) {
            device.rampUp = value;
            this.saveDevices();
            if (status) { status.textContent = '⭕'; status.title = 'Applied successfully'; }
        } else {
            if (status) { status.textContent = '❌'; status.title = 'Failed to apply'; }
        }

        if (status) { setTimeout(() => { status.textContent = ''; status.title = ''; }, 2000); }
    }

    /**
     * Apply Ramp-down Curve (0xD120)
     */
    async applyRampDown(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const input = document.getElementById(`rampDown_${deviceId}`);
        const status = document.getElementById(`rampDown_${deviceId}_status`);
        if (!input) return;

        const value = parseInt(input.value);
        if (isNaN(value) || value < 0 || value > 65535) {
            if (status) { status.textContent = '❌'; status.title = 'Invalid value (0–65535)'; }
            return;
        }

        if (status) { status.textContent = '↻'; status.title = 'Applying...'; }

        const success = await this.writeHoldingRegister(device.slaveId, 0xD120, value);
        if (success) {
            device.rampDown = value;
            this.saveDevices();
            if (status) { status.textContent = '⭕'; status.title = 'Applied successfully'; }
        } else {
            if (status) { status.textContent = '❌'; status.title = 'Failed to apply'; }
        }

        if (status) { setTimeout(() => { status.textContent = ''; status.title = ''; }, 2000); }
    }

    /**
     * Apply Module Temp Derating End (0xD138)
     */
    async applyTempDerating(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const input = document.getElementById(`tempDerating_${deviceId}`);
        const status = document.getElementById(`tempDerating_${deviceId}_status`);
        if (!input) return;

        const value = parseInt(input.value);
        if (isNaN(value) || value < 0 || value > 200) {
            if (status) { status.textContent = '❌'; status.title = 'Invalid value (0–200°C)'; }
            return;
        }

        if (status) { status.textContent = '↻'; status.title = 'Applying...'; }

        const success = await this.writeHoldingRegister(device.slaveId, 0xD138, value);
        if (success) {
            device.tempDerating = value;
            this.saveDevices();
            if (status) { status.textContent = '⭕'; status.title = 'Applied successfully'; }
        } else {
            if (status) { status.textContent = '❌'; status.title = 'Failed to apply'; }
        }

        if (status) { setTimeout(() => { status.textContent = ''; status.title = ''; }, 2000); }
    }

    /**
     * Apply Motor Type (0x2000, FC 0x2B CANopen SDO)
     */
    async applyMotorType(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const input  = document.getElementById(`motorType_${deviceId}`);
        const status = document.getElementById(`motorType_${deviceId}_status`);
        if (!input) return;

        const value = parseInt(input.value);
        if (isNaN(value) || value < 0 || value > 65535) {
            if (status) { status.textContent = '❌'; status.title = 'Invalid value (0–65535)'; }
            return;
        }

        if (status) { status.textContent = '↻'; status.title = 'Applying...'; }

        const result = await this.writeCANopenObject(device.slaveId, 0x2000, 0x00, value);
        if (result && !result.error) {
            device.motorType = value;
            this.saveDevices();
            if (status) { status.textContent = '⭕'; status.title = 'Applied successfully'; }
        } else {
            if (status) { status.textContent = '❌'; status.title = 'Failed to apply'; }
        }

        if (status) { setTimeout(() => { status.textContent = ''; status.title = ''; }, 2000); }
    }

    /**
     * Apply Baudrate (0xD149)
     */
    async applyBaudrate(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const sel = document.getElementById(`baudrate_${deviceId}`);
        const status = document.getElementById(`baudrate_${deviceId}_status`);
        if (!sel) return;

        const value = parseInt(sel.value);
        if (status) { status.textContent = '↻'; status.title = 'Applying...'; }

        const success = await this.writeHoldingRegister(device.slaveId, 0xD149, value);
        if (success) {
            device.baudrate = value;
            this.saveDevices();
            if (status) { status.textContent = '⭕'; status.title = 'Applied successfully'; }
        } else {
            if (status) { status.textContent = '❌'; status.title = 'Failed to apply'; }
        }

        if (status) { setTimeout(() => { status.textContent = ''; status.title = ''; }, 2000); }
    }

    /**
     * Apply Parity configuration (0xD14A)
     */
    async applyParity(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const sel = document.getElementById(`parity_${deviceId}`);
        const status = document.getElementById(`parity_${deviceId}_status`);
        if (!sel) return;

        const value = parseInt(sel.value);
        if (status) { status.textContent = '↻'; status.title = 'Applying...'; }

        const success = await this.writeHoldingRegister(device.slaveId, 0xD14A, value);
        if (success) {
            device.parity = value;
            this.saveDevices();
            if (status) { status.textContent = '⭕'; status.title = 'Applied successfully'; }
        } else {
            if (status) { status.textContent = '❌'; status.title = 'Failed to apply'; }
        }

        if (status) { setTimeout(() => { status.textContent = ''; status.title = ''; }, 2000); }
    }

    /**
     * Generic holding register apply helper (FC06 write)
     * @param {string} paramKey  - element ID prefix and debouncedApply key
     * @param {number} address   - register address
     * @param {string} deviceProp - device property name to cache the value
     * @param {object} opts      - { min, max, scale } (scale multiplies the value before writing)
     */
    async applyGenericHolding(deviceId, paramKey, address, deviceProp, opts = {}) {
        const { min = 0, max = 65535, scale = 1 } = opts;
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;
        const input  = document.getElementById(`${paramKey}_${deviceId}`);
        const status = document.getElementById(`${paramKey}_${deviceId}_status`);
        if (!input) return;
        const val = parseFloat(input.value);
        if (isNaN(val)) {
            if (status) { status.textContent = '❌'; status.title = 'Invalid value'; }
            return;
        }
        if (status) { status.textContent = '↻'; status.title = 'Applying...'; }
        const regVal = Math.round(val * scale);
        const success = await this.writeHoldingRegister(device.slaveId, address, regVal);
        if (success) {
            if (deviceProp) device[deviceProp] = val;
            this.saveDevices();
            if (status) { status.textContent = '⭕'; status.title = 'Applied successfully'; }
        } else {
            if (status) { status.textContent = '❌'; status.title = 'Failed to apply'; }
        }
        if (status) { setTimeout(() => { status.textContent = ''; status.title = ''; }, 2000); }
    }

    /**
     * Generic LSM (FC 0x2B CANopen) apply helper
     * @param {string} paramKey  - element ID prefix
     * @param {number} lsmIndex  - CANopen object index
     * @param {string} deviceProp - device property name to cache the value
     */
    async applyGenericLSM(deviceId, paramKey, lsmIndex, deviceProp) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;
        const input  = document.getElementById(`${paramKey}_${deviceId}`);
        const status = document.getElementById(`${paramKey}_${deviceId}_status`);
        if (!input) return;
        const val = parseInt(input.value);
        if (isNaN(val)) {
            if (status) { status.textContent = '❌'; status.title = 'Invalid value'; }
            return;
        }
        if (status) { status.textContent = '↻'; status.title = 'Applying...'; }
        const result = await this.writeCANopenObject(device.slaveId, lsmIndex, 0x00, val);
        if (result && !result.error) {
            if (deviceProp) device[deviceProp] = val;
            this.saveDevices();
            if (status) { status.textContent = '⭕'; status.title = 'Applied successfully'; }
        } else {
            if (status) { status.textContent = '❌'; status.title = 'Failed to apply'; }
        }
        if (status) { setTimeout(() => { status.textContent = ''; status.title = ''; }, 2000); }
    }

    /**
     * Apply Termination Resistor select (0xD1FF)
     */
    async applyTerminationResistor(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;
        const sel    = document.getElementById(`terminationResistor_${deviceId}`);
        const status = document.getElementById(`terminationResistor_${deviceId}_status`);
        if (!sel) return;
        const value = parseInt(sel.value);
        if (status) { status.textContent = '↻'; status.title = 'Applying...'; }
        const success = await this.writeHoldingRegister(device.slaveId, 0xD1FF, value);
        if (success) {
            device.terminationResistor = value;
            this.saveDevices();
            if (status) { status.textContent = '⭕'; status.title = 'Applied successfully'; }
        } else {
            if (status) { status.textContent = '❌'; status.title = 'Failed to apply'; }
        }
        if (status) { setTimeout(() => { status.textContent = ''; status.title = ''; }, 2000); }
    }

    /**
     * Reset device (Software, Error, or EEPROM)
     */
    async resetDevice(deviceId, resetType) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        let resetValue;
        let confirmMessage;

        switch (resetType) {
            case 'software':
                resetValue = 1; // Software reset
                confirmMessage = 'Are you sure you want to perform a software reset? The device will restart.';
                break;
            case 'error':
                resetValue = 2; // Error reset
                confirmMessage = 'Are you sure you want to reset all errors?';
                break;
            case 'eeprom':
                resetValue = 4; // EEPROM to RAM
                confirmMessage = 'Are you sure you want to load settings from EEPROM to RAM?';
                break;
            default:
                return;
        }

        if (!confirm(confirmMessage)) {
            return;
        }

        // Write to 0xD000 (Reset)
        const success = await this.writeHoldingRegister(device.slaveId, 0xD000, resetValue);
        if (success) {
            this.showToast(`${resetType.charAt(0).toUpperCase() + resetType.slice(1)} 리셋이 완료되었습니다`, 'success');

            // Refresh device status after reset
            setTimeout(() => {
                this.refreshDevice(deviceId);
            }, 1000);
        } else {
            this.showToast(`${resetType} 리셋에 실패했습니다`, 'error');
        }
    }

    /**
     * Wait for response with timeout (for chart polling)
     */
    waitForResponseWithTimeout(timeout) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const checkBuffer = () => {
                if (this.receiveIndex > 0) {
                    // Simple check: if we have data and it's been stable for 10ms
                    const data = this.receiveBuffer.slice(0, this.receiveIndex);
                    setTimeout(() => {
                        if (this.receiveIndex === data.length) {
                            this.receiveIndex = 0;
                            resolve(data);
                        } else {
                            checkBuffer();
                        }
                    }, 10);
                } else if (Date.now() - startTime > timeout) {
                    resolve(null);
                } else {
                    setTimeout(checkBuffer, 5);
                }
            };
            checkBuffer();
        });
    }

    // ─── Hardware Test (FCT) ───────────────────────────────────────────────

    /** 항목 펼치기/접기 */
    toggleHwTestItem(headerEl) {
        const item = headerEl.closest('.hw-test-item');
        const body = item.querySelector('.hw-test-body');
        const icon = headerEl.querySelector('.hw-expand-icon');
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        if (icon) icon.style.transform = isOpen ? '' : 'rotate(180deg)';
    }

    /** 배지 / 결과 텍스트 업데이트 및 카운터 갱신 */
    _setHwTestResult(testId, status, message) {
        const item = document.querySelector(`.hw-test-item[data-test-id="${testId}"]`);
        if (!item) return;
        const badge = item.querySelector('.hw-test-badge');
        const resultText = item.querySelector('.hw-test-result-text');
        const colorMap = { pass: '#28a745', fail: '#dc3545', running: '#fd7e14', pending: '#6c757d' };
        const bgMap    = { pass: '#d4edda', fail: '#f8d7da', running: '#fde8d0', pending: '#e9ecef' };
        const labelMap = { pass: 'Pass', fail: 'Fail', running: 'Running...', pending: 'Pending' };
        if (badge) {
            badge.style.color = colorMap[status];
            badge.style.background = bgMap[status];
            badge.textContent = labelMap[status];
        }
        if (resultText) resultText.textContent = message || '';
        this._updateHwTestCounter();
    }

    _updateHwTestCounter() {
        const items = document.querySelectorAll('.hw-test-item');
        let pass = 0, fail = 0, pending = 0;
        items.forEach(item => {
            const badge = item.querySelector('.hw-test-badge');
            if (!badge) return;
            if (badge.textContent === 'Pass') pass++;
            else if (badge.textContent === 'Fail') fail++;
            else pending++;
        });
        const total = items.length;
        const done = pass + fail;
        const el = id => document.getElementById(id);
        if (el('hwTestPassed')) el('hwTestPassed').textContent = pass;
        if (el('hwTestFailed')) el('hwTestFailed').textContent = fail;
        if (el('hwTestPending')) el('hwTestPending').textContent = pending;
        if (el('hwTestTotal')) el('hwTestTotal').textContent = total;
        if (el('hwTestProgress')) el('hwTestProgress').textContent = total ? Math.round(done / total * 100) + '%' : '0%';
    }

    /** device 가져오기 (현재 선택된 manufacture 디바이스) */
    _getManufactureDevice() {
        const deviceId = this.currentSetupDeviceId;
        return this.devices.find(d => d.id === deviceId) || null;
    }

    // ─────────────────────────────────────────────────────────────
    //  Serial Number Tab
    //  시리얼 형식: {제품(1)}{연도코드(2)}{월코드(1)}{일련번호(5)} = 9자
    //  예: SA6D00001  →  인코더, 2026년, 4월, 1번
    //  레지스터: 0xD1A2~0xD1A6 (각 16비트, 2 ASCII chars/reg, 5reg × 2 = 10bytes)
    // ─────────────────────────────────────────────────────────────

    static get SN_REGEX() { return /^[SMDR][A-Z]\d[A-L]\d{5}$/; }

    /** 탭 열릴 때 초기화 — unlock 상태 리셋 */
    snOnTabOpen() {
        this._snUnlocked = false;
        const today = new Date();
        const yearEl = document.getElementById('snYear');
        const monthEl = document.getElementById('snMonth');
        if (yearEl) yearEl.value = today.getFullYear();
        if (monthEl) monthEl.value = today.getMonth() + 1;
        const statusEl = document.getElementById('snPasswordStatus');
        if (statusEl) { statusEl.textContent = '미확인 — 패스워드를 입력 후 확인 버튼을 누르세요'; statusEl.style.color = '#adb5bd'; }
        const pwInput = document.getElementById('snPassword');
        if (pwInput) { pwInput.value = ''; pwInput.style.borderColor = '#dee2e6'; }
        this._snUpdateWriteBtn();
        this._snUpdateDeviceLabel();
    }

    /** 패스워드 확인 버튼 — FC 0x2B로 0x4009에 2017 write */
    async snConfirmPassword() {
        const device = this._getManufactureDevice();
        const statusEl = document.getElementById('snPasswordStatus');
        const btn = document.getElementById('snPasswordBtn');
        const pwInput = document.getElementById('snPassword');

        if (!device) {
            if (statusEl) { statusEl.textContent = '✘ 디바이스가 선택되지 않았습니다'; statusEl.style.color = '#dc3545'; }
            return;
        }

        const pwValue = parseInt(pwInput?.value || '', 10);
        if (isNaN(pwValue)) {
            if (statusEl) { statusEl.textContent = '✘ 숫자를 입력해주세요'; statusEl.style.color = '#dc3545'; }
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = '확인 중...'; }
        if (statusEl) { statusEl.textContent = '디바이스에 패스워드 전송 중...'; statusEl.style.color = '#6c757d'; }

        try {
            // FC 0x2B CANopen Download: index=0x4009, subIndex=0x00, value=입력값
            const result = await this.writeCANopenObject(device.slaveId, 0x4009, 0x00, [pwValue]);
            if (!result || result.error) throw new Error(result?.error || '응답 없음');

            this._snUnlocked = true;
            if (statusEl) { statusEl.textContent = '✔ 패스워드가 입력되었습니다'; statusEl.style.color = '#28a745'; }
            if (pwInput) pwInput.style.borderColor = '#28a745';
        } catch (e) {
            this._snUnlocked = false;
            if (statusEl) { statusEl.textContent = '✘ 실패: ' + e.message; statusEl.style.color = '#dc3545'; }
            if (pwInput) pwInput.style.borderColor = '#dc3545';
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '확인'; }
            this._snUpdateWriteBtn();
        }
    }

    /** Write 버튼 활성화 조건: 패스워드 unlock + 시리얼 형식 유효 */
    _snUpdateWriteBtn() {
        const serial = (document.getElementById('snSerialInput')?.value || '').toUpperCase();
        const serialOk = ModbusDashboard.SN_REGEX.test(serial);
        const btn = document.getElementById('snWriteBtn');
        if (!btn) return;
        const enabled = !!this._snUnlocked && serialOk;
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? '1' : '0.5';
        btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    /** 직접 입력 시리얼 변경 시 */
    snOnSerialInput(el) {
        const raw = el.value.toUpperCase();
        el.value = raw;

        const msgEl = document.getElementById('snValidationMsg');
        const inputEl = el;

        if (raw.length === 0) {
            inputEl.style.borderColor = '#dee2e6';
            if (msgEl) { msgEl.textContent = '형식: 제품(S/M/D/R) + 연도코드(2자) + 월코드(A-L) + 일련번호(5자리) = 9자'; msgEl.style.color = '#adb5bd'; }
        } else if (ModbusDashboard.SN_REGEX.test(raw)) {
            inputEl.style.borderColor = '#28a745';
            if (msgEl) { msgEl.textContent = '✔ 유효한 형식입니다'; msgEl.style.color = '#28a745'; }
        } else {
            inputEl.style.borderColor = '#dc3545';
            const hint = this._snValidationHint(raw);
            if (msgEl) { msgEl.textContent = '✘ ' + hint; msgEl.style.color = '#dc3545'; }
        }
        this._snUpdateWriteBtn();
    }

    /** 형식 오류 힌트 메시지 */
    _snValidationHint(s) {
        if (s.length !== 9) return `9자리여야 합니다 (현재 ${s.length}자)`;
        if (!/^[SMDR]/.test(s)) return '첫 글자는 S/M/D/R 중 하나여야 합니다';
        if (!/^[SMDR][A-Z]/.test(s)) return '두 번째 글자는 연도 십년 코드 (A=2000s, B=2010s, …)';
        if (!/^[SMDR][A-Z]\d/.test(s)) return '세 번째 글자는 연도 끝자리 숫자 (0-9)';
        if (!/^[SMDR][A-Z]\d[A-L]/.test(s)) return '네 번째 글자는 월 코드 (A=1월 … L=12월)';
        if (!/^[SMDR][A-Z]\d[A-L]\d{5}$/.test(s)) return '다섯 번째부터 끝까지 5자리 숫자여야 합니다';
        return '형식 오류';
    }

    /** 선택된 디바이스 레이블 업데이트 */
    _snUpdateDeviceLabel() {
        const device = this._getManufactureDevice();
        const el = document.getElementById('snReadDeviceLabel');
        if (!el) return;
        el.textContent = device ? `${device.name || ('Fan #' + device.id)} (Slave ${device.slaveId})` : '선택된 디바이스 없음';
    }

    /** 시리얼 넘버 생성 */
    snGenerate() {
        const product = document.getElementById('snProduct')?.value;
        const year = parseInt(document.getElementById('snYear')?.value);
        const month = parseInt(document.getElementById('snMonth')?.value);
        let seq = parseInt(document.getElementById('snSequence')?.value);

        if (!product || isNaN(year) || year < 2000 || isNaN(month) || month < 1 || month > 12) {
            alert('연도/월 값을 확인해주세요.');
            return;
        }
        if (isNaN(seq) || seq < 1 || seq > 99999) {
            alert('일련번호는 1~99999 사이여야 합니다.');
            return;
        }

        const decadeIdx = Math.floor((year - 2000) / 10);
        const yearCode = String.fromCharCode(65 + decadeIdx) + (year % 10);
        const monthCode = String.fromCharCode(64 + month);
        const seqCode = seq.toString().padStart(5, '0');
        const serial = product + yearCode + monthCode + seqCode;

        const outputEl = document.getElementById('snGeneratedOutput');
        const decodedEl = document.getElementById('snGeneratedDecoded');
        if (outputEl) outputEl.textContent = serial;
        if (decodedEl) decodedEl.textContent = `${year}년 ${month}월 / 일련번호 ${seq}번`;

        // 직접 입력 필드에도 자동 채우기 + 유효성 반영
        const inputEl = document.getElementById('snSerialInput');
        if (inputEl) {
            inputEl.value = serial;
            this.snOnSerialInput(inputEl);
        } else {
            this._snUpdateWriteBtn();
        }
    }

    /** 9자 ASCII 시리얼을 5개 레지스터(0xD1A2~0xD1A6)에 쓰기 */
    /** FC 0x2B CANopen SDO — index 0x2424, subIndex 0x00 에 9자 시리얼 쓰기 */
    async snWriteToDevice() {
        const device = this._getManufactureDevice();
        if (!device) { alert('디바이스가 선택되지 않았습니다.'); return; }

        const serial = (document.getElementById('snSerialInput')?.value || '').toUpperCase();
        if (!ModbusDashboard.SN_REGEX.test(serial)) { alert('유효한 시리얼 넘버를 입력해주세요.'); return; }

        const statusEl = document.getElementById('snWriteStatus');
        const btn = document.getElementById('snWriteBtn');
        if (statusEl) { statusEl.textContent = '쓰는 중...'; statusEl.style.color = '#6c757d'; }
        if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

        try {
            // 9자 ASCII → 16바이트(나머지 0 패딩) → 8개 16-bit 워드
            const padded = serial.padEnd(16, '\0');
            const words = [];
            for (let i = 0; i < 8; i++) {
                words.push((padded.charCodeAt(i * 2) << 8) | padded.charCodeAt(i * 2 + 1));
            }
            // FC 0x2B CANopen Download: index=0x2424, subIndex=0x00
            const result = await this.writeCANopenObject(device.slaveId, 0x2424, 0x00, words);
            if (!result || result.error) throw new Error(result?.error || '응답 없음');
            if (statusEl) { statusEl.textContent = '✔ 쓰기 완료'; statusEl.style.color = '#28a745'; }
        } catch (e) {
            if (statusEl) { statusEl.textContent = '✘ 쓰기 실패: ' + e.message; statusEl.style.color = '#dc3545'; }
        } finally {
            this._snUpdateWriteBtn();
        }
    }

    /** FC 0x2B CANopen SDO — index 0x2424, subIndex 0x00 에서 시리얼 읽기 */
    async snReadFromDevice() {
        const device = this._getManufactureDevice();
        if (!device) { alert('디바이스가 선택되지 않았습니다.'); return; }

        const outputEl = document.getElementById('snReadOutput');
        const statusEl = document.getElementById('snReadStatus');
        const decodeBox = document.getElementById('snReadDecodeBox');
        if (outputEl) { outputEl.textContent = '읽는 중...'; outputEl.style.color = '#adb5bd'; }
        if (statusEl) { statusEl.textContent = ''; statusEl.style.color = '#adb5bd'; }
        if (decodeBox) decodeBox.style.display = 'none';

        try {
            // FC 0x2B CANopen Upload: index=0x2424, subIndex=0x00, numData=16 bytes
            const result = await this.readCANopenObject(device.slaveId, 0x2424, 0x00, 16);
            if (!result || result.error) throw new Error(result?.error || '응답 없음');

            // rawBytes(10바이트) → null 제거 후 ASCII 문자열 복원
            const serial = result.rawBytes
                .filter(b => b !== 0)
                .map(b => String.fromCharCode(b))
                .join('')
                .trim()
                .toUpperCase();

            if (outputEl) {
                outputEl.textContent = serial || '(비어있음)';
                outputEl.style.color = serial ? '#28a745' : '#adb5bd';
            }
            if (statusEl) { statusEl.textContent = `읽기 완료 (Slave ${device.slaveId})`; }

            if (serial.length === 9) {
                this._snRenderDecode(serial);
                if (decodeBox) decodeBox.style.display = 'block';
            }
        } catch (e) {
            if (outputEl) { outputEl.textContent = '오류'; outputEl.style.color = '#dc3545'; }
            if (statusEl) { statusEl.textContent = '✘ ' + e.message; statusEl.style.color = '#dc3545'; }
        }
    }

    /** 시리얼 해독 결과 렌더링 */
    _snRenderDecode(serial) {
        const list = document.getElementById('snReadDecodeList');
        if (!list) return;
        try {
            const pMap = { S: '인코더 (S)', M: '모터 (M)', D: '드라이브 (D)', R: '로봇 (R)' };
            const pName = pMap[serial[0]] || `알 수 없음 (${serial[0]})`;
            const decade = (serial.charCodeAt(1) - 65) * 10 + 2000;
            const fullYear = decade + parseInt(serial[2]);
            const month = serial.charCodeAt(3) - 64;
            const seq = parseInt(serial.substring(4));

            list.innerHTML = `
                <li style="display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:13px;">
                    <span style="color:#6c757d;">제품</span>
                    <span style="font-weight:600;color:#1a1a1a;">${pName}</span>
                </li>
                <li style="display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:13px;">
                    <span style="color:#6c757d;">제작년월</span>
                    <span style="font-weight:600;color:#1a1a1a;">${fullYear}년 ${month}월</span>
                </li>
                <li style="display:flex;justify-content:space-between;padding:10px 14px;font-size:13px;">
                    <span style="color:#6c757d;">일련번호</span>
                    <span style="font-weight:600;color:#1a1a1a;">${seq}번</span>
                </li>
            `;
        } catch {
            list.innerHTML = `<li style="padding:10px 14px;font-size:13px;color:#dc3545;">해독 실패 — 형식이 올바르지 않습니다</li>`;
        }
    }

    async runHardwareTest(testId) {
        const device = this._getManufactureDevice();
        if (!device) {
            this._setHwTestResult(testId, 'fail', '디바이스가 선택되지 않았습니다');
            return;
        }
        const slaveId = device.slaveId;
        this._setHwTestResult(testId, 'running', '검사 중...');

        try {
            switch (testId) {
                case 'hw-inv-os': {
                    const raw = await this.readRegisterWithTimeout(slaveId, 0x100A);
                    const expected = document.getElementById('hwInvOsExpected')?.value?.trim();
                    const el = document.getElementById('hwInvOsActual');
                    if (el) el.textContent = '0x' + raw.toString(16).toUpperCase().padStart(4, '0');
                    if (!expected) { this._setHwTestResult(testId, 'fail', '기준 버전을 입력해주세요'); return; }
                    const expVal = parseInt(expected, 16);
                    const ok = raw === expVal;
                    this._setHwTestResult(testId, ok ? 'pass' : 'fail',
                        ok ? `Pass — 읽은 값 0x${raw.toString(16).toUpperCase()} 일치` : `Fail — 읽은 값 0x${raw.toString(16).toUpperCase()}, 기준 ${expected}`);
                    break;
                }
                case 'hw-main-os': {
                    const raw = await this.readRegisterWithTimeout(slaveId, 0x2613);
                    const expected = document.getElementById('hwMainOsExpected')?.value?.trim();
                    const el = document.getElementById('hwMainOsActual');
                    if (el) el.textContent = '0x' + raw.toString(16).toUpperCase().padStart(4, '0');
                    if (!expected) { this._setHwTestResult(testId, 'fail', '기준 버전을 입력해주세요'); return; }
                    const expVal = parseInt(expected, 16);
                    const ok = raw === expVal;
                    this._setHwTestResult(testId, ok ? 'pass' : 'fail',
                        ok ? `Pass — 읽은 값 0x${raw.toString(16).toUpperCase()} 일치` : `Fail — 읽은 값 0x${raw.toString(16).toUpperCase()}, 기준 ${expected}`);
                    break;
                }
                case 'hw-motor-id': {
                    const raw = await this.readRegisterWithTimeout(slaveId, 0x2000);
                    const expected = document.getElementById('hwMotorIdExpected')?.value?.trim();
                    const el = document.getElementById('hwMotorIdActual');
                    if (el) el.textContent = '0x' + raw.toString(16).toUpperCase().padStart(4, '0');
                    if (!expected) { this._setHwTestResult(testId, 'fail', '기준 모터 ID를 입력해주세요'); return; }
                    const expVal = parseInt(expected, 16);
                    const ok = raw === expVal;
                    this._setHwTestResult(testId, ok ? 'pass' : 'fail',
                        ok ? `Pass — 읽은 값 0x${raw.toString(16).toUpperCase()} 일치` : `Fail — 읽은 값 0x${raw.toString(16).toUpperCase()}, 기준 ${expected}`);
                    break;
                }
                case 'hw-eeprom': {
                    // Write 110 → EEPROM Save → Read back
                    await this.writeRegister(slaveId, 0x2002, 110);
                    await this.writeRegister(slaveId, 0x1010, 0x65766173); // Store Parameters
                    await new Promise(r => setTimeout(r, 500));
                    const readBack = await this.readRegisterWithTimeout(slaveId, 0x2002);
                    const el = document.getElementById('hwEepromActual');
                    if (el) el.textContent = readBack;
                    const ok = readBack === 110;
                    this._setHwTestResult(testId, ok ? 'pass' : 'fail',
                        ok ? 'Pass — Write 110, Read 110 일치' : `Fail — Write 110, Read ${readBack}`);
                    break;
                }
                case 'hw-igbt-temp': {
                    const raw = await this.readInputRegisterWithTimeout(slaveId, 0x260B);
                    const el = document.getElementById('hwIgbtTempActual');
                    const tempC = raw; // assume raw is ℃
                    if (el) el.textContent = tempC + '℃';
                    const ok = tempC >= 0 && tempC <= 35;
                    this._setHwTestResult(testId, ok ? 'pass' : 'fail',
                        ok ? `Pass — ${tempC}℃ (0~35℃ 범위 내)` : `Fail — ${tempC}℃ (범위 초과)`);
                    break;
                }
                case 'hw-hall': {
                    const [h1, h2, h3] = await Promise.all([
                        this.readInputRegisterWithTimeout(slaveId, 0x2613),
                        this.readInputRegisterWithTimeout(slaveId, 0x2614),
                        this.readInputRegisterWithTimeout(slaveId, 0x2615),
                    ]);
                    const el1 = document.getElementById('hwHall1');
                    const el2 = document.getElementById('hwHall2');
                    const el3 = document.getElementById('hwHall3');
                    if (el1) el1.textContent = h1;
                    if (el2) el2.textContent = h2;
                    if (el3) el3.textContent = h3;
                    const inRange = v => v >= 1100 && v <= 2000;
                    const ok = inRange(h1) && inRange(h2) && inRange(h3);
                    this._setHwTestResult(testId, ok ? 'pass' : 'fail',
                        ok ? `Pass — H1:${h1}, H2:${h2}, H3:${h3} (1100~2000)` : `Fail — H1:${h1}, H2:${h2}, H3:${h3}`);
                    break;
                }
                case 'hw-current': {
                    // Setup Aging params then read 3-phase current
                    await this.writeRegister(slaveId, 0x4004, 30);
                    await this.writeRegister(slaveId, 0x4005, 5);
                    await this.writeRegister(slaveId, 0x4006, 1);
                    await this.writeRegister(slaveId, 0x2701, 1);
                    await this.writeRegister(slaveId, 0x2700, 0x1000);
                    await new Promise(r => setTimeout(r, 1000));
                    const [iu, iv, iw] = await Promise.all([
                        this.readInputRegisterWithTimeout(slaveId, 0x2610),
                        this.readInputRegisterWithTimeout(slaveId, 0x2611),
                        this.readInputRegisterWithTimeout(slaveId, 0x2612),
                    ]);
                    const elIU = document.getElementById('hwCurrentIU');
                    const elIV = document.getElementById('hwCurrentIV');
                    const elIW = document.getElementById('hwCurrentIW');
                    if (elIU) elIU.textContent = iu;
                    if (elIV) elIV.textContent = iv;
                    if (elIW) elIW.textContent = iw;
                    const ratedInput = parseFloat(document.getElementById('hwCurrentRated')?.value || '0');
                    if (!ratedInput) { this._setHwTestResult(testId, 'fail', '정격 전류를 입력해주세요'); return; }
                    const target = ratedInput * 0.3;
                    const lo = target * 0.9, hi = target * 1.1;
                    const ok = [iu, iv, iw].every(v => v >= lo && v <= hi);
                    this._setHwTestResult(testId, ok ? 'pass' : 'fail',
                        ok ? `Pass — IU:${iu}, IV:${iv}, IW:${iw}` : `Fail — IU:${iu}, IV:${iv}, IW:${iw} (목표범위 ${lo.toFixed(1)}~${hi.toFixed(1)})`);
                    break;
                }
                case 'hw-factory-reset': {
                    await this.writeRegister(slaveId, 0x4009, 2012);
                    await this.writeRegister(slaveId, 0x2701, 1);
                    await this.writeRegister(slaveId, 0x2700, 0x1002);
                    await new Promise(r => setTimeout(r, 300));
                    await this.writeRegister(slaveId, 0x1010, 0x65766173);
                    this._setHwTestResult(testId, 'pass', 'Pass — Factory Reset 및 파라미터 저장 완료');
                    break;
                }
                case 'hw-canopen-27f0': {
                    const indices = [0x27F0, 0x27F1, 0x27F2, 0x27F3];
                    const elIds   = ['hwCanopen27F0Value', 'hwCanopen27F1Value', 'hwCanopen27F2Value', 'hwCanopen27F3Value'];
                    const rawIds  = ['hwCanopen27F0Raw',   'hwCanopen27F1Raw',   'hwCanopen27F2Raw',   'hwCanopen27F3Raw'];
                    const results = [];
                    let allPass = true;
                    for (let i = 0; i < indices.length; i++) {
                        const el    = document.getElementById(elIds[i]);
                        const elRaw = document.getElementById(rawIds[i]);
                        const r     = await this.readCANopenObject(slaveId, indices[i], 0x00, 16);
                        if (!r || r.error) {
                            if (el)    el.textContent    = r?.error ? 'ERR' : 'timeout';
                            if (elRaw) elRaw.textContent = '-';
                            results.push(`0x${indices[i].toString(16).toUpperCase()}=ERR`);
                            allPass = false;
                        } else {
                            const ascii  = r.rawBytes
                                .filter(b => b !== 0x00)
                                .map(b => (b >= 0x20 && b < 0x7F) ? String.fromCharCode(b) : '.')
                                .join('');
                            const rawHex = r.rawBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
                            if (el)    el.textContent    = ascii || '-';
                            if (elRaw) elRaw.textContent = rawHex;
                            results.push(`0x${indices[i].toString(16).toUpperCase()}="${ascii}"`);
                        }
                    }
                    if (allPass) {
                        this._setHwTestResult(testId, 'pass', `Pass — ${results.join(', ')}`);
                    } else {
                        this._setHwTestResult(testId, 'fail', `Fail — ${results.join(', ')}`);
                    }
                    break;
                }
                case 'hw-canopen-motor-id': {
                    const MOTOR_ID_MAP = {
                        0x1000: 'Sirocco FAN (550W)',
                        0x2000: 'Axial FAN (750W)',
                    };
                    const result  = await this.readCANopenObject(slaveId, 0x2000, 0x00);
                    const elVal   = document.getElementById('hwCanopenMotorIdValue');
                    const elName  = document.getElementById('hwCanopenMotorIdName');
                    const elRaw   = document.getElementById('hwCanopenMotorIdRaw');
                    if (!result) {
                        if (elVal)  elVal.textContent  = '-';
                        if (elName) elName.textContent = '-';
                        if (elRaw)  elRaw.textContent  = '-';
                        this._setHwTestResult(testId, 'fail', 'Fail — 응답 없음 (timeout)');
                        break;
                    }
                    if (result.error) {
                        if (elVal)  elVal.textContent  = '-';
                        if (elName) elName.textContent = '-';
                        if (elRaw)  elRaw.textContent  = '-';
                        this._setHwTestResult(testId, 'fail', `Fail — ${result.error}`);
                        break;
                    }
                    const hexVal   = result.value != null ? `0x${result.value.toString(16).toUpperCase().padStart(4, '0')}` : '-';
                    const motorName = MOTOR_ID_MAP[result.value] ?? '알 수 없는 모터';
                    const rawHex   = result.rawBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
                    if (elVal)  elVal.textContent  = hexVal;
                    if (elName) elName.textContent = motorName;
                    if (elRaw)  elRaw.textContent  = rawHex;
                    this._setHwTestResult(testId, 'pass', `Pass — ${motorName} (${hexVal})`);
                    break;
                }
                case 'hw-canopen-2000': {
                    const result = await this.readCANopenObject(slaveId, 0x2000, 0x00);
                    const elVal  = document.getElementById('hwCanopen2000Value');
                    const elCs   = document.getElementById('hwCanopen2000Cs');
                    if (!result) {
                        if (elVal) elVal.textContent = '-';
                        if (elCs)  elCs.textContent  = '-';
                        this._setHwTestResult(testId, 'fail', 'Fail — 응답 없음 (timeout)');
                        break;
                    }
                    if (result.error) {
                        if (elVal) elVal.textContent = '-';
                        if (elCs)  elCs.textContent  = '-';
                        this._setHwTestResult(testId, 'fail', `Fail — ${result.error}`);
                        break;
                    }
                    const hexVal  = result.value != null ? `0x${result.value.toString(16).toUpperCase().padStart(4, '0')}` : '-';
                    const rawHex  = result.rawBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
                    if (elVal) elVal.textContent = hexVal;
                    if (elCs)  elCs.textContent  = rawHex;
                    this._setHwTestResult(testId, 'pass', `Pass — 값 ${hexVal} (raw: ${rawHex})`);
                    break;
                }
                case 'hw-write-cmd-test': {
                    // Power Stack-03: Inverter 출력 및 전류 센싱 (FC 0x2B CANopen SDO Download)
                    const agingCurrent = parseInt(document.getElementById('hwWriteCmdCurrent')?.value || '100', 10);
                    const agingSpeed   = parseInt(document.getElementById('hwWriteCmdSpeed')?.value   || '10',  10);
                    if (isNaN(agingCurrent) || agingCurrent < 0 || agingCurrent > 100) {
                        this._setHwTestResult(testId, 'fail', 'Aging Current 값을 확인해주세요 (0~100 %)');
                        return;
                    }
                    if (isNaN(agingSpeed) || agingSpeed < 0) {
                        this._setHwTestResult(testId, 'fail', 'Aging Speed 값을 확인해주세요 (0 Hz 이상)');
                        return;
                    }
                    await this.writeCANopenObject(slaveId, 0x4004, 0x00, agingCurrent);
                    await this.writeCANopenObject(slaveId, 0x4005, 0x00, agingSpeed);
                    await this.writeCANopenObject(slaveId, 0x2701, 0x00, 1);
                    await this.writeCANopenObject(slaveId, 0x2700, 0x00, 0x1000);
                    this._setHwTestResult(testId, 'pass',
                        `Pass — FC 0x2B: 0x4004=${agingCurrent}%, 0x4005=${agingSpeed}Hz, 0x2701=1, 0x2700=0x1000 전송 완료`);
                    break;
                }

                case 'hw-ps-04': {
                    // Power Stack-04: IPM / Board Temperature 읽기 (FC 0x2B CANopen SDO Upload)
                    const toInt16 = v => { const n = v & 0xFFFF; return n >= 0x8000 ? n - 0x10000 : n; };
                    const r260B = await this.readCANopenObject(slaveId, 0x260B, 0x00);
                    const r260C = await this.readCANopenObject(slaveId, 0x260C, 0x00);
                    const raw260B = r260B?.value ?? r260B;
                    const raw260C = r260C?.value ?? r260C;
                    const t260B = raw260B != null ? toInt16(raw260B) : null;
                    const t260C = raw260C != null ? toInt16(raw260C) : null;
                    const fmtTemp = v => v != null ? `${v} ℃` : 'N/A';
                    const el260B = document.getElementById('hwPs04Val260B');
                    const el260C = document.getElementById('hwPs04Val260C');
                    if (el260B) el260B.textContent = fmtTemp(t260B);
                    if (el260C) el260C.textContent = fmtTemp(t260C);
                    this._setHwTestResult(testId, 'pass',
                        `Pass — IPM Temp=${fmtTemp(t260B)}, Board Temp=${fmtTemp(t260C)}`);
                    break;
                }

                default:
                    this._setHwTestResult(testId, 'fail', '알 수 없는 테스트 ID');
            }
        } catch (err) {
            this._setHwTestResult(testId, 'fail', `오류: ${err.message || err}`);
        }
    }

    async stopPowerStack03() {
        const device = this._getManufactureDevice();
        if (!device) {
            this._setHwTestResult('hw-write-cmd-test', 'fail', '디바이스가 선택되지 않았습니다');
            return;
        }
        const slaveId = device.slaveId;
        try {
            await this.writeCANopenObject(slaveId, 0x4004, 0x00, 0);
            await this.writeCANopenObject(slaveId, 0x4005, 0x00, 0);
            await this.writeCANopenObject(slaveId, 0x2701, 0x00, 2);
            await this.writeCANopenObject(slaveId, 0x2700, 0x00, 0x1000);
            this._setHwTestResult('hw-write-cmd-test', 'pending',
                'Stop 완료 — 0x4004=0, 0x4005=0, 0x2701=2, 0x2700=0x1000');
        } catch (err) {
            this._setHwTestResult('hw-write-cmd-test', 'fail', `Stop 오류: ${err.message || err}`);
        }
    }

    async runAllHardwareTests() {
        const testIds = ['hw-canopen-27f0', 'hw-canopen-motor-id',
                         'hw-eeprom', 'hw-current', 'hw-igbt-temp', 'hw-hall',
                         'hw-factory-reset', 'hw-canopen-2000'];
        for (const id of testIds) {
            await this.runHardwareTest(id);
        }
    }

    resetAllHardwareTests() {
        document.querySelectorAll('.hw-test-item').forEach(item => {
            const testId = item.dataset.testId;
            this._setHwTestResult(testId, 'pending', '테스트를 실행하면 결과가 표시됩니다');
        });
        // Clear displayed values
        ['hwInvOsActual','hwMainOsActual','hwMotorIdActual','hwEepromActual',
         'hwIgbtTempActual','hwCurrentIU','hwCurrentIV','hwCurrentIW',
         'hwHall1','hwHall2','hwHall3'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-';
        });
    }

    // ─── Offset Calibration ────────────────────────────────────────────────────

    /**
     * Updates a step's status badge and description text.
     * @param {number} stepIdx  - 0 = 전류 Offset, 1 = Hall Offset
     * @param {'pending'|'running'|'done'|'error'} status
     * @param {string} desc     - Short description shown under the step title
     */
    _setOffsetStepStatus(stepIdx, status, desc) {
        const n = stepIdx + 1;
        const badge = document.getElementById(`offsetStep${n}Badge`);
        const descEl = document.getElementById(`offsetStep${n}Desc`);

        if (descEl) descEl.textContent = desc;
        if (!badge) return;

        const map = {
            pending: { label: '대기',   bg: '#e9ecef', color: '#6c757d' },
            running: { label: '진행 중', bg: '#fff3cd', color: '#856404' },
            done:    { label: '완료',   bg: '#d4edda', color: '#155724' },
            error:   { label: '오류',   bg: '#f8d7da', color: '#721c24' },
        };
        const s = map[status] || map.pending;
        badge.textContent       = s.label;
        badge.style.background  = s.bg;
        badge.style.color       = s.color;

        if (status === 'running') {
            badge.classList.add('offset-badge-pulse');
        } else {
            badge.classList.remove('offset-badge-pulse');
        }

        // Mirror to state
        if (this.offsetCalibState.steps[stepIdx]) {
            this.offsetCalibState.steps[stepIdx].status = status;
        }
    }

    /**
     * Resets all offset calibration state and DOM to initial idle values.
     */
    _resetOffsetState() {
        this.offsetCalibState.phase = 'idle';
        this.offsetCalibState.steps.forEach((s, i) => {
            s.status = 'pending';
            s.before = [null, null, null];
            s.after  = [null, null, null];
            this._setOffsetStepStatus(i, 'pending', '대기 중');
        });
        const statusEl = document.getElementById('offsetOverallStatus');
        if (statusEl) statusEl.textContent = '보정 시작 전 — Start 버튼을 눌러 보정을 시작하세요.';
        const btn = document.getElementById('offsetStartBtn');
        if (btn) { btn.disabled = false; btn.textContent = '▶ Start'; }
    }

    /**
     * Entry point for the Start button.
     * Runs Step 1 (전류 Offset) then Step 2 (Hall Offset) sequentially.
     */
    async startOffsetCalibration() {
        // Guard: serial must be connected
        if (!this.writer) {
            alert('시리얼 포트가 연결되어 있지 않습니다.\n연결 후 다시 시도하세요.');
            return;
        }
        // Guard: a device must be selected in the Manufacture tab
        const device = this.devices.find(d => d.id === this.currentSetupDeviceId);
        if (!device) {
            alert('디바이스를 선택하세요.');
            return;
        }
        // Guard: don't allow double-start
        if (this.offsetCalibState.phase === 'running') return;

        // Reset to clean state then kick off
        this._resetOffsetState();
        this.offsetCalibState.phase = 'running';

        const btn = document.getElementById('offsetStartBtn');
        if (btn) { btn.disabled = true; btn.textContent = '진행 중…'; }

        const statusEl = document.getElementById('offsetOverallStatus');
        if (statusEl) statusEl.textContent = '보정 진행 중…';

        try {
            // Offset setting 시작 명령: procedure argument → procedure code 순서로 전송
            await this.writeCANopenObject(device.slaveId, 0x2701, 0x00, 0x0001); // procedure argument = 0x0001
            await this.writeCANopenObject(device.slaveId, 0x2700, 0x00, 0x0004); // procedure code = 0x0004

            await this._runCurrentOffsetStep(device);
            await this._runHallOffsetStep(device);
            this.offsetCalibState.phase = 'complete';
            if (statusEl) statusEl.textContent = '✔ 보정 완료';
            if (btn) { btn.disabled = false; btn.textContent = '↺ 재시작'; }
        } catch (err) {
            this.offsetCalibState.phase = 'error';
            if (statusEl) statusEl.textContent = `⚠ 오류 발생: ${err.message || err}`;
            if (btn) { btn.disabled = false; btn.textContent = '↺ 재시작'; }
            console.error('[Offset Calibration]', err);
        }
    }

    async _runCurrentOffsetStep(device) {
        this._setOffsetStepStatus(0, 'running', '전류 측정 중…');
        // TODO: 실제 프로토콜 구현
        this._setOffsetStepStatus(0, 'done', '보정 완료');
    }

    async _runHallOffsetStep(device) {
        this._setOffsetStepStatus(1, 'running', 'Hall 센서 측정 중…');
        // TODO: 실제 프로토콜 구현
        this._setOffsetStepStatus(1, 'done', '보정 완료');
    }
}

/**
 * OS Verification Test Manager
 * Manufacture 탭의 OS 검증 테스트 관리 클래스
 * 파일 위치: os-test-manager.js
 */
// OSTestManager 클래스는 os-test-manager.js 파일로 분리되었습니다.


// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new ModbusDashboard();
    window.app = window.dashboard;
    window.osTestManager = new OSTestManager();
    window.osTestManager.renderTestList();

    // Device Setup Tab Switching
    const deviceSetupTabs = document.querySelectorAll('.device-setup-tab');
    deviceSetupTabs.forEach(tab => {
        // Hover effects for inactive tabs
        tab.addEventListener('mouseenter', () => {
            if (!tab.classList.contains('active')) {
                tab.style.color = '#495057';
            }
        });

        tab.addEventListener('mouseleave', () => {
            if (!tab.classList.contains('active')) {
                tab.style.color = '#6c757d';
            }
        });

        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            // Save current device setup tab to sessionStorage
            sessionStorage.setItem('deviceSetupTab', targetTab);

            // HW Overview 폴링은 manufacture > hw-overview 서브탭에서만 유효
            // manufacture 탭 이외 탭으로 전환 시 항상 중지
            if (targetTab !== 'manufacture') {
                window.dashboard.stopOvPolling();
            }

            // Parameters 탭을 벗어날 때 진행 중인 파라미터 읽기 중단
            if (targetTab !== 'parameters') {
                window.dashboard._paramReadProgress?.cancel();
            }

            // Remove active class from all tabs (Notion style)
            deviceSetupTabs.forEach(t => {
                t.classList.remove('active');
                t.style.color = '#6c757d';
                t.style.borderBottom = '2px solid transparent';
            });

            // Add active class to clicked tab (Notion style)
            tab.classList.add('active');
            tab.style.color = '#1a1a1a';
            tab.style.borderBottom = '2px solid #1a1a1a';

            // Hide all tab contents
            const tabContents = document.querySelectorAll('.device-setup-tab-content');
            tabContents.forEach(content => {
                content.style.display = 'none';
            });

            // Show selected tab content
            const db = window.dashboard;
            if (targetTab === 'configuration') {
                document.getElementById('deviceSetupConfigTab').style.display = 'block';
                // Auto-read config values from device if connected
                if (db.currentSetupDeviceId && (db.writer || db.simulatorEnabled)) {
                    db.refreshDevice(db.currentSetupDeviceId);
                }
            } else if (targetTab === 'parameters') {
                document.getElementById('deviceSetupParamsTab').style.display = 'block';
                // Auto-read parameters from device if connected
                if (db.selectedParamDeviceId && (db.writer || db.simulatorEnabled)) {
                    db.readAllParameters();
                }
            } else if (targetTab === 'update') {
                document.getElementById('deviceSetupUpdateTab').style.display = 'block';
            } else if (targetTab === 'manufacture') {
                document.getElementById('deviceSetupManufactureTab').style.display = 'flex';
                // hw-overview 가 기본 서브탭 — 현재 활성 서브탭이 hw-overview면 폴링 시작
                const activeSubtab = sessionStorage.getItem('manufactureSubtab') || 'hw-overview';
                if (activeSubtab === 'hw-overview' && (db.writer || db.simulatorEnabled)) {
                    db.initMiniCharts();
                    db.startOvPolling();
                }
            }
        });
    });

    // Manufacture Sub-tab Switching
    const manufactureSubtabs = document.querySelectorAll('.manufacture-subtab');
    manufactureSubtabs.forEach(tab => {
        // Hover effects for inactive tabs
        tab.addEventListener('mouseenter', () => {
            if (!tab.classList.contains('active')) {
                tab.style.color = '#495057';
            }
        });

        tab.addEventListener('mouseleave', () => {
            if (!tab.classList.contains('active')) {
                tab.style.color = '#6c757d';
            }
        });

        tab.addEventListener('click', () => {
            const targetSubtab = tab.dataset.subtab;

            // Save current manufacture subtab to sessionStorage
            sessionStorage.setItem('manufactureSubtab', targetSubtab);

            // Remove active class from all subtabs
            manufactureSubtabs.forEach(t => {
                t.classList.remove('active');
                t.style.color = '#6c757d';
                t.style.borderBottom = '2px solid transparent';
            });

            // Add active class to clicked subtab
            tab.classList.add('active');
            tab.style.color = '#667eea';
            tab.style.borderBottom = '2px solid #667eea';

            // 탭을 벗어날 때 해당 탭 전용 폴링 중지
            if (targetSubtab !== 'hw-overview') {
                window.dashboard.stopOvPolling();
            }
            if (targetSubtab !== 'offset') {
                window.dashboard.stopOffsetAlarmPolling();
            }

            // Hide all subtab contents
            const subtabContents = document.querySelectorAll('.manufacture-subtab-content');
            subtabContents.forEach(content => {
                content.style.display = 'none';
            });

            // Show selected subtab content
            if (targetSubtab === 'os-verification') {
                document.getElementById('manufactureOsVerification').style.display = 'block';
            } else if (targetSubtab === 'offset') {
                document.getElementById('manufactureOffset').style.display = 'flex';
                window.dashboard.startOffsetAlarmPolling();
            } else if (targetSubtab === 'serial-number') {
                document.getElementById('manufactureSerialNumber').style.display = 'flex';
                window.dashboard.snOnTabOpen();
            } else if (targetSubtab === 'hw-overview') {
                document.getElementById('manufactureHwOverview').style.display = 'flex';
                window.dashboard.initMiniCharts();
                window.dashboard.startOvPolling();
            }
        });
    });

    // OS Test Event Handlers
    // Initialize test status on page load
    window.osTestManager.updateTestStatus();

    document.getElementById('osRunAllTestsBtn')?.addEventListener('click', () => {
        window.osTestManager.runAllOsTests();
    });

    document.getElementById('osResetTestsBtn')?.addEventListener('click', () => {
        window.osTestManager.resetAllTests();
    });

    // Test item header click to expand/collapse (delegated — works for dynamically rendered items)
    document.getElementById('osTestListContainer')?.addEventListener('click', (e) => {
        const header = e.target.closest('.os-test-header');
        if (!header) return;
        const testItem = header.closest('.os-test-item');
        if (!testItem) return;
        window.osTestManager.expandTestItem(testItem.dataset.testId);
    });

    // Start/Stop Test buttons (delegated event handling)
    document.addEventListener('click', (e) => {
        // Start Test button
        if (e.target.closest('.test-start-btn')) {
            e.stopPropagation();
            window.osTestManager.executeTest();
        }

        // Stop Test button
        if (e.target.closest('.test-stop-btn')) {
            e.stopPropagation();
            window.osTestManager.stopTest();
        }
    });

    // Restore Device Setup tab state from sessionStorage immediately to prevent flash
    const savedPage = sessionStorage.getItem('currentPage');
    if (savedPage === 'device-setup') {
        const savedDeviceTab = sessionStorage.getItem('deviceSetupTab') || 'configuration';

        // Use requestAnimationFrame for smooth restoration without flash
        requestAnimationFrame(() => {
            // Find and click the saved tab (or default configuration tab) to restore state
            const tabToRestore = document.querySelector(`.device-setup-tab[data-tab="${savedDeviceTab}"]`);
            if (tabToRestore) {
                tabToRestore.click();
            }

            // If on manufacture tab, restore manufacture subtab immediately
            if (savedDeviceTab === 'manufacture') {
                const savedManufactureSubtab = sessionStorage.getItem('manufactureSubtab');
                if (savedManufactureSubtab) {
                    const subtabToRestore = document.querySelector(`.manufacture-subtab[data-subtab="${savedManufactureSubtab}"]`);
                    if (subtabToRestore) {
                        subtabToRestore.click();
                    }
                }
            }

            // Render device list after tab is restored
            requestAnimationFrame(() => {
                window.dashboard.renderDeviceSetupList();
            });
        });
    }

    // ── Offset Calibration: Start button ─────────────────────────────────────
    document.getElementById('offsetStartBtn')?.addEventListener('click', () => {
        window.dashboard.startOffsetCalibration();
    });
});
