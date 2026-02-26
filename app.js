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
            { enabled: true, color: '#3498db', data: [], name: 'CH1', address: 0xD011 },
            { enabled: true, color: '#e74c3c', data: [], name: 'CH2', address: 0xD001 },
            { enabled: false, color: '#2ecc71', data: [], name: 'CH3', address: 0x0000 },
            { enabled: false, color: '#f39c12', data: [], name: 'CH4', address: 0x0000 }
        ];

        // Mode settings
        this.mode = 'continuous'; // 'continuous' | 'trigger'
        this.isRunning = false;
        this.isPaused = false;

        // Zoom and pan state
        this.zoom = { x: 1, y: 1 };
        this.pan = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.panStart = { x: 0, y: 0 };

        // Auto scale settings
        this.autoScale = true;
        this.yMin = 0;
        this.yMax = 100;
        this.margin = 0.1; // 10% margin

        // Time settings
        this.timeScale = 5000; // 5 seconds visible
        this.sampleRate = 100; // 100ms between samples
        this.bufferSize = 1000;
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
        this.canvas.addEventListener('click', this.handleClick);
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.isDragging) {
            const dx = x - this.dragStart.x;
            const dy = y - this.dragStart.y;
            this.pan.x = this.panStart.x + dx;
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

    isInChartArea(x, y) {
        return x >= this.chartMargins.left &&
               x <= this.width - this.chartMargins.right &&
               y >= this.chartMargins.top &&
               y <= this.height - this.chartMargins.bottom;
    }

    screenToChartX(screenX) {
        const chartWidth = this.width - this.chartMargins.left - this.chartMargins.right;
        const relX = (screenX - this.chartMargins.left - this.pan.x) / (chartWidth * this.zoom.x);
        return relX * this.timeScale;
    }

    screenToChartY(screenY) {
        const chartHeight = this.height - this.chartMargins.top - this.chartMargins.bottom;
        const relY = 1 - (screenY - this.chartMargins.top - this.pan.y) / (chartHeight * this.zoom.y);
        return this.yMin + relY * (this.yMax - this.yMin);
    }

    chartToScreenX(chartX) {
        const chartWidth = this.width - this.chartMargins.left - this.chartMargins.right;
        const relX = chartX / this.timeScale;
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
                <span class="cursor-value-num">${value.toFixed(1)}</span>
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

        // Find closest point
        let closest = null;
        let minDist = Infinity;

        for (const point of data) {
            const dist = Math.abs(point.t - timeMs);
            if (dist < minDist) {
                minDist = dist;
                closest = point;
            }
        }

        return closest ? closest.v : null;
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
            infoEl.textContent = 'No markers set (Click to add)';
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

        if (this.mode === 'trigger') {
            this.handleTriggerMode(channelIndex, point);
        } else {
            // Continuous mode
            this.channels[channelIndex].data.push(point);

            // Limit buffer size
            while (this.channels[channelIndex].data.length > this.bufferSize) {
                this.channels[channelIndex].data.shift();
            }
        }

        // Update current value display
        this.updateChannelValue(channelIndex, value);

        // Update auto scale
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
            el.textContent = value.toFixed(1);
        }
    }

    calculateAutoScale() {
        let min = Infinity;
        let max = -Infinity;

        for (const ch of this.channels) {
            if (!ch.enabled) continue;
            for (const point of ch.data) {
                if (point.v < min) min = point.v;
                if (point.v > max) max = point.v;
            }
        }

        if (min === Infinity || max === -Infinity) {
            this.yMin = 0;
            this.yMax = 100;
        } else {
            const range = max - min || 1;
            this.yMin = min - range * this.margin;
            this.yMax = max + range * this.margin;
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
        }
        this.markers = [];
        this.preTriggerBuffer = [];
        this.trigger.triggered = false;
        this.trigger.triggerIndex = -1;
        this.startTime = null;
        this.updateMarkersInfo();
        this.updateStats();
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
        const timeEl = document.getElementById('chartTimeRange');

        if (sampleEl) sampleEl.textContent = totalSamples;
        if (timeEl) timeEl.textContent = this.formatTime(timeRange);
    }

    // Animation
    startAnimation() {
        const animate = () => {
            if (!this.isRunning) return;

            if (!this.isPaused) {
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

    drawGrid() {
        const ctx = this.ctx;
        const left = this.chartMargins.left;
        const right = this.width - this.chartMargins.right;
        const top = this.chartMargins.top;
        const bottom = this.height - this.chartMargins.bottom;

        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;

        // Vertical grid lines (time)
        const xStep = (right - left) / 10;
        for (let i = 0; i <= 10; i++) {
            const x = left + i * xStep;
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
            ctx.stroke();
        }

        // Horizontal grid lines (value)
        const yStep = (bottom - top) / 8;
        for (let i = 0; i <= 8; i++) {
            const y = top + i * yStep;
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
        }
    }

    drawAxes() {
        const ctx = this.ctx;
        const left = this.chartMargins.left;
        const right = this.width - this.chartMargins.right;
        const top = this.chartMargins.top;
        const bottom = this.height - this.chartMargins.bottom;

        ctx.strokeStyle = '#adb5bd';
        ctx.lineWidth = 1;

        // Y-axis
        ctx.beginPath();
        ctx.moveTo(left, top);
        ctx.lineTo(left, bottom);
        ctx.stroke();

        // X-axis
        ctx.beginPath();
        ctx.moveTo(left, bottom);
        ctx.lineTo(right, bottom);
        ctx.stroke();

        // Y-axis labels
        ctx.fillStyle = '#6c757d';
        ctx.font = '10px Consolas, monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const yStep = (bottom - top) / 8;
        const valueStep = (this.yMax - this.yMin) / 8;
        for (let i = 0; i <= 8; i++) {
            const y = top + i * yStep;
            const value = this.yMax - i * valueStep;
            ctx.fillText(value.toFixed(0), left - 5, y);
        }

        // X-axis labels
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const xStep = (right - left) / 10;
        const timeStep = this.timeScale / 10;
        for (let i = 0; i <= 10; i++) {
            const x = left + i * xStep;
            const time = i * timeStep;
            ctx.fillText(this.formatTime(time), x, bottom + 5);
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

        // Determine visible time range
        let minTime = 0;
        let maxTime = this.timeScale;

        // For continuous mode with running data, shift view to show latest data
        if (this.mode === 'continuous' && this.channels[0].data.length > 0) {
            const latestTime = Math.max(...this.channels.filter(ch => ch.enabled && ch.data.length > 0)
                .map(ch => ch.data[ch.data.length - 1].t));

            if (latestTime > this.timeScale) {
                minTime = latestTime - this.timeScale;
                maxTime = latestTime;
            }
        }

        // Draw each channel
        for (const ch of this.channels) {
            if (!ch.enabled || ch.data.length < 2) continue;

            ctx.strokeStyle = ch.color;
            ctx.lineWidth = 2;
            ctx.beginPath();

            let started = false;
            for (const point of ch.data) {
                const x = left + ((point.t - minTime) / (maxTime - minTime)) * chartWidth * this.zoom.x + this.pan.x;
                const y = top + (1 - (point.v - this.yMin) / (this.yMax - this.yMin)) * chartHeight * this.zoom.y + this.pan.y;

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
        const left = this.chartMargins.left;
        const right = this.width - this.chartMargins.right;
        const chartHeight = this.height - this.chartMargins.top - this.chartMargins.bottom;

        const y = this.chartMargins.top + (1 - (this.trigger.level - this.yMin) / (this.yMax - this.yMin)) * chartHeight;

        ctx.strokeStyle = '#ffc107';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();

        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = '#ffc107';
        ctx.font = '10px Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Trigger: ${this.trigger.level}`, right - 80, y - 5);
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

    setBufferSize(size) {
        this.bufferSize = size;
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
        this.isScanning = false;
        this.scanAborted = false;
        this.scanResolve = null;  // Callback for scan response
        this.scanExpectedSlaveId = null;  // Expected slave ID for scan response

        // Auto polling for device status
        this.autoPollingEnabled = true;
        this.autoPollingInterval = 50; // ms between polls
        this.autoPollingTimer = null;
        this.currentPollingIndex = 0;
        this.isPolling = false; // Flag to prevent concurrent polling
        this.commandQueue = []; // Queue for user write commands - prevents 485 bus collision during polling
        this.pollingTimeout = 200; // Response timeout in ms for polling
        this.commandTimeout = 200; // Response timeout in ms for user commands (write/read)
        this.pendingResponse = null; // Current pending response promise
        this.offlineThreshold = 3; // Number of consecutive failures before marking offline
        this.paramPollingDelay = 20; // ms between monitoring parameters
        this.backgroundPollingEnabled = false; // Use Web Worker timer to avoid browser throttling
        this.pollingWorker = null; // Web Worker for background polling

        // Current page tracking - restore from sessionStorage if available
        this.currentPage = sessionStorage.getItem('currentPage') || 'dashboard';

        // Chart Manager
        this.chartManager = null;
        this.chartPollingTimer = null;
        this.chartSlaveId = 1; // Default slave ID for chart polling

        // Device Setup auto-apply debounce timers
        this.applyDebounceTimers = {};

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

        // Menu navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.switchPage(page);

                document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
                item.classList.add('active');
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
            });
        });

        document.querySelectorAll('.filter-btn[data-implemented]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn[data-implemented]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.paramImplementedFilter = e.target.dataset.implemented;
                this.renderParameters();
            });
        });

        document.getElementById('paramSearchInput').addEventListener('input', (e) => {
            this.paramSearchText = e.target.value.toLowerCase();
            this.renderParameters();
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

        // Set default values first
        if (sidebarBaudRate) sidebarBaudRate.value = '9600';
        if (sidebarParity) sidebarParity.value = 'none';
        if (sidebarDataBits) sidebarDataBits.value = '8';
        if (sidebarStopBits) sidebarStopBits.value = '1';

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

                // If 5 clicks within 2 seconds, activate developer mode
                if (clickCount >= 5) {
                    if (sessionStorage.getItem('developerMode') !== 'true') {
                        sessionStorage.setItem('developerMode', 'true');
                        this.enableDeveloperMode();
                        this.showToast('🔧 Developer Mode Activated!', 'success');
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

                this.showToast('Developer Mode Disabled', 'info');
                // Switch to dashboard if currently on manufacture page
                if (this.currentPage === 'manufacture') {
                    this.switchPage('dashboard');
                    document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
                    document.querySelector('.menu-item[data-page="dashboard"]').classList.add('active');
                }
            });
        }

        // Restore last visited page from sessionStorage and activate immediately
        const savedPage = sessionStorage.getItem('currentPage');
        const pageToShow = savedPage || 'dashboard';

        // Immediately activate the correct page without rendering other pages first
        const pageElement = document.getElementById(`page-${pageToShow}`);
        if (pageElement) {
            // Directly set active class to avoid rendering unwanted pages
            pageElement.classList.add('active');

            // Update menu item active state immediately
            document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
            const menuItem = document.querySelector(`.menu-item[data-page="${pageToShow}"]`);
            if (menuItem) {
                menuItem.classList.add('active');
            }

            // Call page-specific initialization if needed
            if (pageToShow === 'firmware') {
                this.updateFirmwareDeviceList();
            } else if (pageToShow === 'device-setup') {
                // Device setup will be fully initialized after tabs are restored in DOMContentLoaded
            }
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
    }

    /**
     * Switch between pages
     */
    switchPage(pageName) {
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

        // Start/stop polling based on page
        if (pageName === 'dashboard') {
            // Start polling when on Dashboard
            if (this.writer || this.simulatorEnabled) {
                this.startAutoPolling();
            }
        } else {
            // Stop polling when leaving Dashboard
            this.stopAutoPolling();
        }

        // Update firmware device list when switching to firmware page
        if (pageName === 'firmware') {
            this.updateFirmwareDeviceList();
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
                    this.showToast('복사 실패', 'error');
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
        this.showToast('Polling settings applied', 'success');
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
            const baudRate = parseInt(baudRateEl.value) || 9600;
            const dataBits = parseInt(dataBitsEl.value) || 8;
            const parity = parityEl.value || 'none';
            const stopBits = parseInt(stopBitsEl.value) || 1;

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

            // Save settings to localStorage
            this.saveSerialSettings({ baudRate, dataBits, parity, stopBits });

            const settingsStr = `${baudRate} baud, ${dataBits}${parity.charAt(0).toUpperCase()}${stopBits}`;
            this.addMonitorEntry('received', `Connected: ${settingsStr}`);
            this.showToast(`시리얼 포트 연결됨 (${settingsStr})`, 'success');

            // Auto scan if enabled
            if (this.autoScanEnabled) {
                this.showToast('자동 탐색을 시작합니다...', 'info');
                setTimeout(() => this.startDeviceScan(true), 500);
            }

            // Start auto polling only if on Dashboard page
            if (this.currentPage === 'dashboard') {
                this.startAutoPolling();
            }

        } catch (error) {
            console.error('Connection error:', error);
            this.addMonitorEntry('error', `Connection failed: ${error.message}`);
            this.showToast(`연결 실패: ${error.message}`, 'error');
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
        const saved = localStorage.getItem('serialSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                const baudRateEl = document.getElementById('sidebar-baudRate');
                const dataBitsEl = document.getElementById('sidebar-dataBits');
                const parityEl = document.getElementById('sidebar-parity');
                const stopBitsEl = document.getElementById('sidebar-stopBits');

                if (baudRateEl && settings.baudRate) baudRateEl.value = settings.baudRate;
                if (dataBitsEl && settings.dataBits) dataBitsEl.value = settings.dataBits;
                if (parityEl && settings.parity) parityEl.value = settings.parity;
                if (stopBitsEl && settings.stopBits) stopBitsEl.value = settings.stopBits;

                console.log('Loaded serial settings:', settings);
            } catch (e) {
                console.error('Failed to load serial settings:', e);
            }
        }
    }

    /**
     * Disconnect from serial port
     */
    async disconnect() {
        try {
            // Stop auto polling
            this.stopAutoPolling();

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
            this.showToast('시리얼 포트 연결 해제됨', 'info');

        } catch (error) {
            this.addMonitorEntry('error', `Disconnect error: ${error.message}`);
        } finally {
            // 물리적 제거 포함 모든 경우에 항상 연결 상태를 해제
            this.isConnected = false;
            this.updateConnectionStatus(false);
        }
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
                        this.showToast('시리얼 포트가 물리적으로 제거됨 - 자동 연결 해제', 'error');
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

        // 0xFF 바이어스 노이즈 즉시 폐기:
        // RS-485 DE→RE 전환 시 버스 floating → UART idle(mark) = 0xFF 연속 수신됨
        // Modbus 유효 슬레이브 주소는 1~247이므로 0xFF로 시작하는 바이트는 무효
        if (this.receiveBuffer[0] === 0xFF) {
            // 0xFF가 아닌 첫 번째 바이트까지 버퍼 앞으로 당김 (노이즈 바이트들 제거)
            let skipCount = 0;
            while (skipCount < this.receiveIndex && this.receiveBuffer[skipCount] === 0xFF) {
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

        const expectedLength = this.getExpectedFrameLength();
        if (expectedLength === null) return;          // 길이 확정 불가 (바이트 부족)
        if (this.receiveIndex < expectedLength) return; // 프레임 미완성, 추가 바이트 대기

        // 정확히 한 프레임만 추출
        const frame = this.receiveBuffer.slice(0, expectedLength);

        // 나머지 바이트를 버퍼 앞으로 이동
        const remaining = this.receiveIndex - expectedLength;
        for (let i = 0; i < remaining; i++) {
            this.receiveBuffer[i] = this.receiveBuffer[expectedLength + i];
        }
        this.receiveIndex = remaining;

        // CRC 검증 (가장 먼저 — 깨진 프레임 조기 폐기)
        if (!this.modbus.verifyCRC(frame)) {
            this.addMonitorEntry('error', frame, null, 'CRC mismatch');
            this.updateStats(false);
            if (this.receiveIndex >= 2) this.tryParseFrame();
            return;
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
     * Update converted value display for an input field
     * @param {string} inputId - Input element ID
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     */
    updateConvertedValue(inputId, min = 0, max = 65535) {
        const input = document.getElementById(inputId);
        const convertedEl = document.getElementById(`${inputId}-converted`);

        if (!input || !convertedEl) return;

        const value = input.value.trim();

        // Treat empty or just "0x"/"0X" as empty (no display)
        if (!value || value.toLowerCase() === '0x') {
            convertedEl.textContent = '';
            input.style.borderColor = '';
            input.style.background = '';
            return;
        }

        try {
            const parsed = this.parseModbusValue(value, min, max);
            const isHex = this.isHexadecimal(value);

            // Display the opposite format
            if (isHex) {
                convertedEl.textContent = `= ${parsed} (Dec)`;
            } else {
                convertedEl.textContent = `= 0x${parsed.toString(16).toUpperCase()} (Hex)`;
            }

            // Remove error styling
            input.style.borderColor = '';
            input.style.background = '';
            convertedEl.style.color = '';
        } catch (error) {
            // Show error state
            convertedEl.textContent = `⚠ ${error.message}`;
            convertedEl.style.color = '#dc3545';
            input.style.borderColor = '#dc3545';
            input.style.background = '#fff5f5';

            // Reset color after a moment
            setTimeout(() => {
                convertedEl.style.color = '';
            }, 2000);
        }
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
                        this.showToast(`복사됨: ${value}`, 'success');
                    }).catch(() => {
                        this.showToast('복사 실패', 'error');
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
        const sidebarConnectBtn = document.getElementById('sidebar-connectBtn');
        const sendBtn = document.getElementById('sendBtn');
        const serialPortMenu = document.getElementById('serialPortMenu');

        if (connected) {
            navbarStatusIndicator.className = 'navbar-status-indicator status-connected';
            navbarStatusText.textContent = 'Connected';
            sidebarConnectBtn.textContent = 'Disconnect';
            sidebarConnectBtn.className = 'btn btn-secondary btn-block';
            sendBtn.disabled = false;
        } else {
            navbarStatusIndicator.className = 'navbar-status-indicator status-disconnected';
            navbarStatusText.textContent = 'Disconnected';
            sidebarConnectBtn.textContent = 'Connect';
            sidebarConnectBtn.className = 'btn btn-primary btn-block';
            sendBtn.disabled = true;

            // Open Serial Port menu when disconnected
            if (serialPortMenu) {
                serialPortMenu.classList.add('expanded');
            }
        }
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
            scanRegister: this.scanRegister
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
                <span class="device-name">${device.name}</span>
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
            this.showToast('Please select a device first', 'warning');
            return;
        }

        if (!this.writer && !this.simulatorEnabled) {
            this.showToast('Please connect to serial port or enable simulator', 'warning');
            return;
        }

        const implementedParams = this.parameters.filter(p => p.implemented === 'Y');
        if (implementedParams.length === 0) {
            this.showToast('No implemented parameters to read', 'info');
            return;
        }

        const total = implementedParams.length;
        const progress = this.showProgressToast(`Reading ${total} parameters...`, total);

        let successCount = 0;
        let errorCount = 0;
        let current = 0;

        for (const param of implementedParams) {
            if (progress.isCancelled()) break;

            try {
                await this.readParameterByAddress(param, true);
                successCount++;
            } catch (error) {
                console.error(`Error reading ${param.name}:`, error);
                errorCount++;
            }

            current++;
            progress.update(current);
            // Small delay between reads
            await new Promise(resolve => setTimeout(resolve, 50));
        }

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
            typeBadge.textContent = param.type === 'input' ? 'Input' : 'Holding';
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
                // 설명 텍스트가 잘리거나 이름이 잘리는 경우 expandable
                const isOverflowing = (desc && desc.scrollWidth > desc.clientWidth) ||
                                      (name && name.scrollWidth > name.clientWidth);
                if (isOverflowing) {
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
                        functionCode: values[headers.indexOf('type')] === 'input' ? 4 : 3
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
            functionCode: p.type === 'input' ? 4 : 3
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
            {type:'holding',address:'0xD000',name:'Reset',implemented:'Y',description:'Software Reset, Error Reset, EEPROM to RAM'},
            {type:'holding',address:'0xD001',name:'Setpoint',implemented:'Y',description:'지령 값, 오픈루프 모드이면 % or 속도모드이면 RPM'},
            {type:'holding',address:'0xD005',name:'Factory setting Control',implemented:'N',description:'공장 초기값 변경 및 적용 용도'},
            {type:'holding',address:'0xD009',name:'Operating hours counter',implemented:'N',description:'65535시간까지 카운트 후 고정'},
            {type:'holding',address:'0xD00A',name:'Operating minutes counter',implemented:'N',description:'0분 to 59분 롤링'},
            {type:'holding',address:'0xD00D',name:'Stored set value',implemented:'N',description:'Set Point 설정값이 EEPROM에 저장됨, 급작스러운 전원 공급 중단 및 복구 후 마지막 설정값으로 재시작'},
            {type:'holding',address:'0xD00F',name:'Enable/Disable',implemented:'N',description:'서보드라이브의 SVON/SVOFF와 같은 기능, 0xD16A(Enable/Disable source)의 값에 따라 적절한 Enable state가 결정'},
            {type:'holding',address:'0xD100',name:'Fan address',implemented:'Y',description:'Node ID와 같은 역할'},
            {type:'holding',address:'0xD101',name:'Set value source',implemented:'N',description:'Setpoint를 어떤 수단으로 사용할 것인지 설정 (0:AIN1, 1:RS485, 2:AIN2, 3:PWM)'},
            {type:'holding',address:'0xD102',name:'Preferred running direction',implemented:'Y',description:'구동 방향 결정 (0:CCW, 1:CW)'},
            {type:'holding',address:'0xD106',name:'Operating mode',implemented:'Y',description:'모터 제어 방식을 설정합니다. | 0:Speed Control, 2:Open-loop control'},
            {type:'holding',address:'0xD112',name:'Motor stop enable',implemented:'N',description:'0: set value가 0이더라도 모터 항상 SVON, 1: set value가 0일 경우 모터 SVOFF'},
            {type:'holding',address:'0xD119',name:'Maximum speed',implemented:'N',description:'센서 제어모드 및 Open-loop control 모드에서는 이 파라미터에 지정된 속도로 제한 (토크모드에서의 속도제한 값)'},
            {type:'holding',address:'0xD11A',name:'Maximum permissible speed',implemented:'N',description:'최대 속도의 상한치를 설정 (모터 최대 속도)'},
            {type:'holding',address:'0xD11F',name:'Ramp-up curve',implemented:'N',description:'가/감속도 조정 파라미터, 알람 등 모터 정지조건이 감지되면 감속없이 정지함'},
            {type:'holding',address:'0xD120',name:'Ramp-down curve',implemented:'N',description:'감속 곡선 설정'},
            {type:'holding',address:'0xD12A',name:'Point 1 X-coordinate',implemented:'N',description:'아날로그 입력 또는 PWM 입력 신호에 설정값을 할당하는데 사용'},
            {type:'holding',address:'0xD12B',name:'Point 1 Y-coordinate',implemented:'N',description:'아날로그 입력 또는 PWM 입력 신호에 설정값을 할당하는데 사용'},
            {type:'holding',address:'0xD12C',name:'Point 2 X-coordinate',implemented:'N',description:'아날로그 입력 또는 PWM 입력 신호에 설정값을 할당하는데 사용'},
            {type:'holding',address:'0xD12D',name:'Point 2 Y-coordinate',implemented:'N',description:'아날로그 입력 또는 PWM 입력 신호에 설정값을 할당하는데 사용'},
            {type:'holding',address:'0xD12F',name:'Limitation Control',implemented:'N',description:'0번 비트 set: Power limit 활성화, 1번 비트 set: Current Limit 활성화'},
            {type:'holding',address:'0xD135',name:'Maximum permissible power',implemented:'N',description:'허용 가능한 최대 파워 설정'},
            {type:'holding',address:'0xD136',name:'Max. power at derating end',implemented:'N',description:'모듈과 모터의 온도를 토대로 출력을 디레이팅 하는 기능'},
            {type:'holding',address:'0xD137',name:'Module temperature power derating start',implemented:'N',description:'모듈 온도 파워 디레이팅 시작점'},
            {type:'holding',address:'0xD138',name:'Module temperature power derating end',implemented:'N',description:'모듈 온도 파워 디레이팅 종료점'},
            {type:'holding',address:'0xD13B',name:'Maximum coil current',implemented:'Y',description:'전류 제한이 활성화 되면 모터 코일전류(rms값)를 이 파라미터에 설정된 값으로 제한'},
            {type:'holding',address:'0xD14D',name:'Motor temperature power derating start address',implemented:'N',description:'모터 온도 파워 디레이팅 시작 주소'},
            {type:'holding',address:'0xD14E',name:'Motor temperature power derating end address',implemented:'N',description:'모터 온도 파워 디레이팅 종료 주소'},
            {type:'holding',address:'0xD145',name:'Speed limit for running monitoring',implemented:'N',description:'실행 모니터링 속도제한, 속도 피드백이 이 파라미터에 설정된 속도보다 낮을 경우 오류 해제 (n_Low)'},
            {type:'holding',address:'0xD149',name:'Transmission speed',implemented:'N',description:'RS-485 통신 속도를 설정합니다. | 0:1200bps, 1:2400bps, 2:4800bps, 3:9600bps, 4:19200bps(default), 5:38400bps, 6:57600bps, 7:115200bps'},
            {type:'holding',address:'0xD14A',name:'Parity configuration',implemented:'N',description:'시리얼 통신의 데이터 비트, 패리티, 스톱 비트를 설정합니다. | 0:Data8/Even/Stop1(default), 1:Data8/Odd/Stop1, 2:Data8/None/Stop2, 3:Data8/None/Stop1'},
            {type:'holding',address:'0xF150',name:'Shedding function',implemented:'N',description:'외부 환경에 의해 팬이 얼어 기동이 어려울 경우 이 기능 활성화를 통해 구속 상태를 제거'},
            {type:'holding',address:'0xF151',name:'Max. starting modulation level',implemented:'N',description:'최대 시작 모듈레이션 레벨'},
            {type:'holding',address:'0xF152',name:'Number of start attempts',implemented:'N',description:'시작 시도 횟수'},
            {type:'holding',address:'0xF153',name:'Relay dropout delay',implemented:'N',description:'에러나 경고 감지 시 릴레이 출력 지연시간을 설정하여 단기 이슈일 경우는 무시'},
            {type:'holding',address:'0xD155',name:'Maximum power',implemented:'N',description:'최대 파워 설정'},
            {type:'holding',address:'0xD158',name:'Configuration of I/O 1',implemented:'N',description:'I/O 활성/비활성화 설정 파라미터'},
            {type:'holding',address:'0xD159',name:'Configuration of I/O 2',implemented:'N',description:'I/O 활성/비활성화 설정 파라미터'},
            {type:'holding',address:'0xD15A',name:'Configuration of I/O 3',implemented:'N',description:'I/O 활성/비활성화 설정 파라미터'},
            {type:'holding',address:'0xD170',name:'Customer data 0',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD171',name:'Customer data 1',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD172',name:'Customer data 2',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD173',name:'Customer data 3',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD174',name:'Customer data 4',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD175',name:'Customer data 5',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD176',name:'Customer data 6',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD177',name:'Customer data 7',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD178',name:'Customer data 8',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD179',name:'Customer data 9',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD17A',name:'Customer data 10',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD17B',name:'Customer data 11',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD17C',name:'Customer data 12',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD17D',name:'Customer data 13',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD17E',name:'Customer data 14',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD17F',name:'Customer data 15',implemented:'N',description:'고객 사용 영역'},
            {type:'holding',address:'0xD180',name:'Operating hours counter (back-up)',implemented:'N',description:'0xD009의 사용시간을 저장하는 파라미터'},
            {type:'holding',address:'0xD182',name:'Error indicator',implemented:'N',description:'가장 최근 에러의 파라미터 번호를 표시'},
            {type:'holding',address:'0xD184',name:'Error 1',implemented:'N',description:'팬에서 발생한 첫 번째 오류 표시'},
            {type:'holding',address:'0xD185',name:'Error time',implemented:'N',description:'팬에서 발생한 에러를 최대 13개까지 저장'},
            {type:'holding',address:'0xD186',name:'Error history 1',implemented:'N',description:'에러 히스토리 1'},
            {type:'holding',address:'0xD187',name:'Error history time 1',implemented:'N',description:'에러 히스토리 시간 1'},
            {type:'holding',address:'0xD188',name:'Error history 2',implemented:'N',description:'에러 히스토리 2'},
            {type:'holding',address:'0xD189',name:'Error history time 2',implemented:'N',description:'에러 히스토리 시간 2'},
            {type:'holding',address:'0xD18A',name:'Error history 3',implemented:'N',description:'에러 히스토리 3'},
            {type:'holding',address:'0xD18B',name:'Error history time 3',implemented:'N',description:'에러 히스토리 시간 3'},
            {type:'holding',address:'0xD18C',name:'Error history 4',implemented:'N',description:'에러 히스토리 4'},
            {type:'holding',address:'0xD18D',name:'Error history time 4',implemented:'N',description:'에러 히스토리 시간 4'},
            {type:'holding',address:'0xD18E',name:'Error history 5',implemented:'N',description:'에러 히스토리 5'},
            {type:'holding',address:'0xD18F',name:'Error history time 5',implemented:'N',description:'에러 히스토리 시간 5'},
            {type:'holding',address:'0xD190',name:'Error history 6',implemented:'N',description:'에러 히스토리 6'},
            {type:'holding',address:'0xD191',name:'Error history time 6',implemented:'N',description:'에러 히스토리 시간 6'},
            {type:'holding',address:'0xD192',name:'Error history 7',implemented:'N',description:'에러 히스토리 7'},
            {type:'holding',address:'0xD193',name:'Error history time 7',implemented:'N',description:'에러 히스토리 시간 7'},
            {type:'holding',address:'0xD194',name:'Error history 8',implemented:'N',description:'에러 히스토리 8'},
            {type:'holding',address:'0xD195',name:'Error history time 8',implemented:'N',description:'에러 히스토리 시간 8'},
            {type:'holding',address:'0xD196',name:'Error history 9',implemented:'N',description:'에러 히스토리 9'},
            {type:'holding',address:'0xD197',name:'Error history time 9',implemented:'N',description:'에러 히스토리 시간 9'},
            {type:'holding',address:'0xD198',name:'Error history 10',implemented:'N',description:'에러 히스토리 10'},
            {type:'holding',address:'0xD199',name:'Error history time 10',implemented:'N',description:'에러 히스토리 시간 10'},
            {type:'holding',address:'0xD19A',name:'Error history 11',implemented:'N',description:'에러 히스토리 11'},
            {type:'holding',address:'0xD19B',name:'Error history time 11',implemented:'N',description:'에러 히스토리 시간 11'},
            {type:'holding',address:'0xD19C',name:'Error history 12',implemented:'N',description:'에러 히스토리 12'},
            {type:'holding',address:'0xD19D',name:'Error history time 12',implemented:'N',description:'에러 히스토리 시간 12'},
            {type:'holding',address:'0xD19E',name:'Error history 13',implemented:'N',description:'에러 히스토리 13'},
            {type:'holding',address:'0xD19F',name:'Error history time 13',implemented:'N',description:'에러 히스토리 시간 13'},
            {type:'holding',address:'0xD1A2',name:'Serial Number 1',implemented:'N',description:'팬 시리얼 번호 데이터'},
            {type:'holding',address:'0xD1A3',name:'Serial Number 2',implemented:'N',description:'팬 시리얼 번호 데이터'},
            {type:'holding',address:'0xD1A4',name:'Date of manufacture',implemented:'N',description:'제조 날짜'},
            {type:'holding',address:'0xD1A5',name:'FAN type 1',implemented:'N',description:'ASCII 코드 형태로 표현'},
            {type:'holding',address:'0xD1A6',name:'FAN type 2',implemented:'N',description:'ASCII 코드 형태로 표현'},
            {type:'holding',address:'0xD1A7',name:'FAN type 3',implemented:'N',description:'ASCII 코드 형태로 표현'},
            {type:'holding',address:'0xD1A8',name:'FAN type 4',implemented:'N',description:'ASCII 코드 형태로 표현'},
            {type:'holding',address:'0xD1A9',name:'FAN type 5',implemented:'N',description:'ASCII 코드 형태로 표현'},
            {type:'holding',address:'0xD1AA',name:'FAN type 6',implemented:'N',description:'ASCII 코드 형태로 표현'},
            {type:'holding',address:'0xD623',name:'Error Mask',implemented:'N',description:'마스크 씌운 경고 또는 에러가 날 경우 릴레이 출력'},
            {type:'holding',address:'0xD624',name:'Warning Mask',implemented:'N',description:'마스크 씌운 경고 또는 에러가 날 경우 릴레이 출력'},
            // Input Registers
            {type:'input',address:'0xD000',name:'Identification',implemented:'Y',description:'장치 식별'},
            {type:'input',address:'0xD001',name:'Max. number of bytes',implemented:'Y',description:'최대 바이트 수'},
            {type:'input',address:'0xD002',name:'Bus controller software name',implemented:'Y',description:'Main 부트버전'},
            {type:'input',address:'0xD003',name:'Bus controller software version',implemented:'Y',description:'Main 펌웨어 버전'},
            {type:'input',address:'0xD004',name:'Commutation controller software name',implemented:'Y',description:'Inverter 부트 버전'},
            {type:'input',address:'0xD005',name:'Commutation controller software version',implemented:'Y',description:'Inverter 펌웨어 버전'},
            {type:'input',address:'0xD010',name:'Actual speed (Relative)',implemented:'N',description:'상대 속도'},
            {type:'input',address:'0xD011',name:'Motor status',implemented:'Y',description:'모터 상태'},
            {type:'input',address:'0xD012',name:'Warning',implemented:'Y',description:'경고'},
            {type:'input',address:'0xD013',name:'DC-link voltage',implemented:'Y',description:'DC 링크 전압'},
            {type:'input',address:'0xD014',name:'DC-link current',implemented:'N',description:'DC 링크 전류'},
            {type:'input',address:'0xD015',name:'Module temperature',implemented:'Y',description:'IGBT Temperature Sensor 값'},
            {type:'input',address:'0xD017',name:'Electronics temperature',implemented:'Y',description:'제어부 Temperature 값'},
            {type:'input',address:'0xD018',name:'Current direction of rotation',implemented:'N',description:'현재 회전 방향'},
            {type:'input',address:'0xD01A',name:'Current set value',implemented:'N',description:'현재 설정값'},
            {type:'input',address:'0xD01C',name:'Enable/Disable input state',implemented:'N',description:'Enable/Disable 입력 상태'},
            {type:'input',address:'0xD021',name:'Current power (Relative)',implemented:'N',description:'상대 전력'},
            {type:'input',address:'0xD02D',name:'Actual speed [RPM] (Absolute)',implemented:'Y',description:'절대 속도 [RPM]'},
            {type:'input',address:'0xD03D',name:'Line Voltage',implemented:'N',description:'라인 전압'},
            {type:'input',address:'0xD050',name:'Command speed',implemented:'Y',description:'지령 속도'},
            {type:'input',address:'0xD051',name:'Command torque',implemented:'Y',description:'지령 토크'}
        ];
    }

    /**
     * Read parameter by address (for CSV-based parameters)
     */
    async readParameterByAddress(param, silent = false) {
        if (!this.writer && !this.simulatorEnabled) {
            if (!silent) this.showToast('먼저 연결하거나 시뮬레이터를 활성화하세요', 'warning');
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
        const functionCode = param.type === 'input' ? 4 : 3;

        let frame;
        if (functionCode === 4) {
            frame = this.modbus.buildReadInputRegisters(slaveId, address, 1);
        } else {
            frame = this.modbus.buildReadHoldingRegisters(slaveId, address, 1);
        }

        if (this.simulatorEnabled) {
            this.addMonitorEntry('sent', frame, { functionCode, startAddress: address, quantity: 1 });
            this.stats.requests++;
            this.updateStatsDisplay();

            const response = await this.simulator.processRequest(frame);
            if (response && response.length >= 5) {
                this.addMonitorEntry('received', response);
                const value = (response[3] << 8) | response[4];
                param.value = value;
                this.saveParameters();
                this.renderParameters();
                this.updateStats(true);
                if (!silent) this.showToast(`${param.name}: ${value} (0x${value.toString(16).toUpperCase()})`, 'success');
            } else {
                this.updateStats(false);
                if (!silent) this.showToast(`${param.name} 읽기 실패`, 'error');
            }
        } else if (this.writer) {
            // Use sendAndWaitResponse to wait for response (it handles stats internally)
            const value = await this.sendAndWaitResponse(frame, slaveId);
            if (value !== null) {
                param.value = value;
                this.saveParameters();
                this.renderParameters();
                if (!silent) this.showToast(`${param.name}: ${value} (0x${value.toString(16).toUpperCase()})`, 'success');
            } else {
                if (!silent) this.showToast(`${param.name} 읽기 실패`, 'error');
            }
        }
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
            this.showToast('가상 시뮬레이터 활성화됨', 'success');

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

            // Stop auto polling
            this.stopAutoPolling();
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
            this.showToast('가상 시뮬레이터 비활성화됨', 'info');
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

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        // Icon mapping
        const icons = {
            success: '✓',
            info: 'ⓘ',
            warning: '⚠',
            error: '✕'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-message">${message}</div>
        `;

        // Add to container
        container.appendChild(toast);

        let autoHideTimeout;
        let isHovered = false;

        // Function to remove toast
        const removeToast = () => {
            toast.classList.add('toast-hide');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300); // Wait for animation to complete
        };

        // Auto hide after duration
        const startAutoHide = () => {
            autoHideTimeout = setTimeout(() => {
                if (!isHovered) {
                    removeToast();
                }
            }, duration);
        };

        // Click to dismiss immediately
        toast.addEventListener('click', () => {
            clearTimeout(autoHideTimeout);
            removeToast();
        });

        // Pause auto-hide on hover
        toast.addEventListener('mouseenter', () => {
            isHovered = true;
            clearTimeout(autoHideTimeout);
        });

        // Resume auto-hide on mouse leave
        toast.addEventListener('mouseleave', () => {
            isHovered = false;
            startAutoHide();
        });

        // Start auto-hide timer
        startAutoHide();
    }

    /**
     * Show a persistent progress toast with circular progress bar
     * Returns a controller: { update(current), dismiss(finalMsg), isCancelled() }
     */
    showProgressToast(message, total) {
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
                        stroke-dasharray="${circumference.toFixed(2)}"
                        stroke-dashoffset="${circumference.toFixed(2)}"/>
                </svg>
                <span class="toast-ring-pct">0%</span>
            </div>
            <button class="toast-cancel-btn" title="중단">✕</button>
        `;

        container.appendChild(toast);

        let cancelled = false;
        let hidden = false;

        const ringFg = toast.querySelector('.toast-ring-fg');
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
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cancelled = true;
            dismiss('중단됨');
        });

        const dismiss = (finalMsg) => {
            if (finalMsg && !hidden) {
                progressLabel.textContent = finalMsg;
                setTimeout(() => {
                    toast.classList.add('toast-hide');
                    setTimeout(() => {
                        if (container.contains(toast)) container.removeChild(toast);
                    }, 300);
                }, 800);
            } else if (!hidden) {
                toast.classList.add('toast-hide');
                setTimeout(() => {
                    if (container.contains(toast)) container.removeChild(toast);
                }, 300);
            }
        };

        const update = (current) => {
            const pct = total > 0 ? Math.round((current / total) * 100) : 0;
            const offset = circumference - (pct / 100) * circumference;
            ringFg.style.strokeDashoffset = offset;
            ringPct.textContent = `${pct}%`;
            subLabel.textContent = `${current} / ${total}`;
        };

        return { update, dismiss, isCancelled: () => cancelled };
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
    showDeviceEditModal(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) {
            console.error('Device not found:', deviceId);
            return;
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

        // Clear modal body and create proper flex container structure
        modalBody.innerHTML = '';
        console.log('Step 1: Modal body cleared');

        // Create wrapper that mimics Device Setup page structure
        const configWrapper = document.createElement('div');
        configWrapper.style.cssText = 'display: flex; flex-direction: column; width: 100%; min-height: 0; flex: 1;';
        console.log('Step 2: Config wrapper created');

        // Create the deviceSetupConfig container with proper flex context
        const configContainer = document.createElement('div');
        configContainer.id = 'deviceSetupConfig';
        configContainer.style.cssText = 'flex: 1; overflow-y: auto; display: block; min-height: 0;';
        console.log('Step 3: Config container created with id:', configContainer.id);

        // Build container hierarchy
        configWrapper.appendChild(configContainer);
        modalBody.appendChild(configWrapper);
        console.log('Step 4: Container hierarchy built');

        // Show modal
        modal.style.display = 'flex';
        console.log('Step 5: Modal displayed');

        // CRITICAL: Temporarily remove the page's deviceSetupConfig to avoid ID collision
        const pageConfigContainer = document.querySelector('#page-device-setup #deviceSetupConfig');
        let originalId = null;
        if (pageConfigContainer) {
            originalId = pageConfigContainer.id;
            pageConfigContainer.id = 'deviceSetupConfig_temp';
            console.log('Step 5.5: Temporarily renamed page config container to avoid ID collision');
        }

        // Render device configuration - it will find #deviceSetupConfig in modal
        console.log('Step 6: About to call renderDeviceSetupConfig for device:', device.name);
        this.renderDeviceSetupConfig(device);
        console.log('Step 7: renderDeviceSetupConfig called');

        // Restore the page's deviceSetupConfig ID
        if (pageConfigContainer && originalId) {
            pageConfigContainer.id = originalId;
            console.log('Step 7.5: Restored page config container ID');
        }

        // Verify rendering
        const deviceNameSpan = document.getElementById(`deviceName_${device.id}`);
        console.log('Step 8: Device name span found:', !!deviceNameSpan);
        console.log('Config container innerHTML length:', configContainer.innerHTML.length);
        console.log('Config container offsetHeight:', configContainer.offsetHeight);
        console.log('Config container offsetWidth:', configContainer.offsetWidth);

        if (!deviceNameSpan) {
            console.warn('Device configuration may not have rendered correctly');
        }

        // Close button handler
        const handleClose = () => {
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
    }

    // ========================================
    // Product Test Dashboard Functions
    // ========================================

    /**
     * Initialize Dashboard UI event listeners
     */
    initDashboardUI() {
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

        // Auto Assign ID button
        const autoAssignIdBtn = document.getElementById('autoAssignIdBtn');
        if (autoAssignIdBtn) {
            autoAssignIdBtn.addEventListener('click', () => this.showAutoAssignModal());
        }

        // Close auto assign modal
        const closeAutoAssignModalBtn = document.getElementById('closeAutoAssignModalBtn');
        if (closeAutoAssignModalBtn) {
            closeAutoAssignModalBtn.addEventListener('click', () => this.hideAutoAssignModal());
        }

        const cancelAutoAssignBtn = document.getElementById('cancelAutoAssignBtn');
        if (cancelAutoAssignBtn) {
            cancelAutoAssignBtn.addEventListener('click', () => this.hideAutoAssignModal());
        }

        const autoAssignModal = document.getElementById('autoAssignModal');
        if (autoAssignModal) {
            let mouseDownTarget = null;

            autoAssignModal.addEventListener('mousedown', (e) => {
                mouseDownTarget = e.target;
            });

            autoAssignModal.addEventListener('click', (e) => {
                if (e.target.id === 'autoAssignModal' && mouseDownTarget && mouseDownTarget.id === 'autoAssignModal') {
                    this.hideAutoAssignModal();
                }
                mouseDownTarget = null;
            });
        }

        const startAutoAssignBtn = document.getElementById('startAutoAssignBtn');
        if (startAutoAssignBtn) {
            startAutoAssignBtn.addEventListener('click', () => this.startAutoAssign());
        }

        // Refresh All button
        const refreshAllBtn = document.getElementById('refreshAllBtn');
        if (refreshAllBtn) {
            refreshAllBtn.addEventListener('click', () => this.refreshAllDevices());
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

        // All device setpoint input and slider sync
        const allDeviceSetpoint = document.getElementById('allDeviceSetpoint');
        const allDeviceSetpointSlider = document.getElementById('allDeviceSetpointSlider');
        if (allDeviceSetpoint && allDeviceSetpointSlider) {
            allDeviceSetpoint.addEventListener('input', () => {
                allDeviceSetpointSlider.value = allDeviceSetpoint.value;
                this.updateSliderBackground(allDeviceSetpointSlider);
            });
            allDeviceSetpointSlider.addEventListener('input', () => {
                allDeviceSetpoint.value = allDeviceSetpointSlider.value;
                this.updateSliderBackground(allDeviceSetpointSlider);
            });
        }

        // Quick preset buttons (all device control)
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const percent = parseInt(btn.dataset.percent);
                const maxValue = parseInt(allDeviceSetpointSlider?.max || 10000);
                const value = Math.round((percent / 100) * maxValue);
                if (allDeviceSetpoint) allDeviceSetpoint.value = value;
                if (allDeviceSetpointSlider) {
                    allDeviceSetpointSlider.value = value;
                    this.updateSliderBackground(allDeviceSetpointSlider);
                }
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
        }

        // Update section style based on selection
        if (allDeviceControlSection) {
            if (this.selectedDevices.size > 0) {
                allDeviceControlSection.classList.add('has-selection');
            } else {
                allDeviceControlSection.classList.remove('has-selection');
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
        if (badge) {
            badge.textContent = `${this.devices.length}개`;
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
            maxSpeed: 10000,
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
            this.updateSelectedCount();
            this.showToast('장치가 삭제되었습니다', 'info');

            // If currently on Device Setup page for this device, go back to Dashboard
            if (this.currentPage === 'device-setup' && this.currentDeviceId === deviceId) {
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
        const statusInfo = this.getMotorStatusInfo(device.motorStatus, device.online);

        item.innerHTML = `
            <span class="drag-handle" title="Drag to reorder">≡</span>
            <input type="checkbox" class="device-checkbox" ${this.selectedDevices.has(device.id) ? 'checked' : ''}>
            <span class="device-name" title="Click to edit name">${device.name}</span>
            <span class="device-id-badge ${device.slaveId === 0 ? 'unassigned' : ''}">
                ${device.slaveId === 0 ? 'ID 미할당' : 'ID: ' + device.slaveId}
            </span>
            <div class="device-status" title="${statusInfo.tooltip}">
                <span class="status-indicator ${statusInfo.class}"></span>
                <span class="status-text">${statusInfo.text}</span>
            </div>
            <div class="device-value">
                <div class="device-value-number">
                    ${device.setpoint}<span class="device-value-unit">${modeText}</span>
                </div>
            </div>
            <div class="device-mode-btns compact">
                <button class="mode-btn ${device.operationMode === 0 ? 'active' : ''}" data-mode="0">RPM</button>
                <button class="mode-btn ${device.operationMode !== 0 ? 'active' : ''}" data-mode="2">%</button>
            </div>
            <div class="device-controls">
                <input type="number" class="device-setpoint-input" placeholder="${modeText}" min="0" max="${device.maxSpeed || (device.operationMode === 0 ? 10000 : 100)}" value="${device.setpoint}">
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
                this.showToast(`Device name changed to "${newName}"`, 'success');

                // Update Device List in Device Setup page
                this.renderDeviceSetupList();

                // Update Dashboard
                this.renderDashboard();
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
        card.draggable = true;

        if (this.selectedDevices.has(device.id)) {
            card.classList.add('selected');
        }

        const modeText = device.operationMode === 0 ? 'RPM' : '%';
        const statusInfo = this.getMotorStatusInfo(device.motorStatus, device.online);

        card.innerHTML = `
            <div class="device-card-header">
                <div class="device-select">
                    <span class="drag-handle" title="Drag to reorder">≡</span>
                    <input type="checkbox" class="device-checkbox" ${this.selectedDevices.has(device.id) ? 'checked' : ''}>
                    <span class="device-name" title="Click to edit name">${device.name}</span>
                </div>
                <div class="device-header-right">
                    <span class="device-id-badge ${device.slaveId === 0 ? 'unassigned' : ''}">
                        ${device.slaveId === 0 ? 'ID 미할당' : 'ID: ' + device.slaveId}
                    </span>
                    <button class="btn-delete-icon" title="Delete device">×</button>
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
                        <div class="device-value-number">
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
                    <input type="number" class="device-setpoint-input" placeholder="Setpoint (${modeText})" min="0" max="${device.maxSpeed || (device.operationMode === 0 ? 10000 : 100)}" value="${device.setpoint}">
                    <span class="input-unit">${modeText}</span>
                </div>
                <div class="device-quick-btns">
                    ${device.operationMode === 0 ? `
                    <button class="quick-btn" data-value="0">0</button>
                    <button class="quick-btn" data-value="${Math.round((device.maxSpeed || 10000) * 0.25)}">${Math.round((device.maxSpeed || 10000) * 0.25)}</button>
                    <button class="quick-btn" data-value="${Math.round((device.maxSpeed || 10000) * 0.5)}">${Math.round((device.maxSpeed || 10000) * 0.5)}</button>
                    <button class="quick-btn" data-value="${Math.round((device.maxSpeed || 10000) * 0.75)}">${Math.round((device.maxSpeed || 10000) * 0.75)}</button>
                    <button class="quick-btn" data-value="${device.maxSpeed || 10000}">${device.maxSpeed || 10000}</button>
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
                    <div class="monitoring-params-list">
                        ${this.renderMonitoringParamsHTML(device.monitoringParams)}
                    </div>
                    <div class="monitoring-add-section">
                        <div class="add-param-tabs">
                            <button class="add-tab active" data-tab="csv">Parameter List</button>
                            <button class="add-tab" data-tab="manual">Manual Input</button>
                        </div>
                        <div class="add-tab-content active" data-tab="csv">
                            <select class="param-select">
                                ${this.generateParameterOptions()}
                            </select>
                            <button class="btn btn-success btn-sm add-param-btn">+ Add</button>
                        </div>
                        <div class="add-tab-content" data-tab="manual">
                            <div class="manual-input-row">
                                <select class="manual-type">
                                    <option value="holding">Holding</option>
                                    <option value="input">Input</option>
                                </select>
                                <input type="text" class="manual-address" placeholder="0xD001">
                                <input type="text" class="manual-name" placeholder="Name">
                                <button class="btn btn-success btn-sm add-manual-btn">+ Add</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="device-card-footer">
                <div class="device-footer-left">
                    <button class="btn-action-icon btn-alarm-reset" title="알람 리셋"><svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zm.995-14.901a1 1 0 1 0-1.99 0A5.002 5.002 0 0 0 3 6c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7 0-2.42-1.72-4.44-4.005-4.901z"/></svg></button>
                    <button class="btn-action-icon btn-software-reset" title="소프트웨어 리셋">↺</button>
                </div>
                <div class="device-footer-right">
                    <button class="btn-edit" title="Edit device">⚙</button>
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
            slider.max = 10000;
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
            const maxSpeed = device.maxSpeed || 10000;
            return Math.round(setpoint / maxSpeed * 64000);
        } else {
            // Open-loop Control: user enters %
            return Math.round(setpoint / 100 * 65535);
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
            this.renderDeviceGrid();

            const unit = device.operationMode === 0 ? 'RPM' : '%';
            if (!silent) this.showToast(`${device.name}: Setpoint ${setpoint}${unit} (raw: ${rawSetpoint}) 적용`, 'success');
        } catch (error) {
            if (!silent) this.showToast(`${device.name}: 설정 실패 - ${error.message}`, 'error');
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
            this.showToast(`${device.name}: 알람 리셋 완료`, 'success');

            // Read device status after reset to update UI
            setTimeout(() => {
                this.readDeviceStatus(deviceId);
            }, 500);
        } catch (error) {
            this.showToast(`${device.name}: 알람 리셋 실패 - ${error.message}`, 'error');
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
            // Send software reset command (write 1 to SOFTWARE_RESET register)
            await this.writeRegister(device.slaveId, this.REGISTERS.SOFTWARE_RESET, 1);
            this.showToast(`${device.name}: 소프트웨어 리셋 완료`, 'success');

            // Mark device as offline temporarily
            device.online = false;
            this.renderDeviceGrid();

            // Try to reconnect after a delay
            setTimeout(() => {
                this.showToast(`${device.name}: 재연결 시도 중...`, 'info');
                this.readDeviceStatus(deviceId);
            }, 3000);
        } catch (error) {
            this.showToast(`${device.name}: 소프트웨어 리셋 실패 - ${error.message}`, 'error');
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
                device.maxSpeed = maxSpeed > 0 ? maxSpeed : 10000;
            } else {
                // Open-loop mode uses percentage (0-100%)
                device.maxSpeed = 100;
            }

            device.lastUpdate = Date.now();
            device.online = true;

            this.saveDevices();
            this.renderDeviceGrid();

            this.showToast(`${device.name}: 상태 읽기 완료`, 'success');
        } catch (error) {
            device.online = false;
            this.showToast(`${device.name}: 읽기 실패 - ${error.message}`, 'error');
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
            device.operationMode = mode;

            // If Speed Control mode (RPM), read maximum speed
            if (mode === 0) {
                const maxSpeed = await this.readRegister(device.slaveId, this.REGISTERS.MAXIMUM_SPEED);
                device.maxSpeed = maxSpeed > 0 ? maxSpeed : 10000;
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
                device.maxSpeed = maxSpeed > 0 ? maxSpeed : 10000;
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
            this.showToast(`${device.name}: ${modeText} 모드로 변경`, 'success');
        } catch (error) {
            this.showToast(`${device.name}: 모드 변경 실패 - ${error.message}`, 'error');
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
        this.showToast(`${successCount}개 장치에 Setpoint ${setpoint}${unit} 적용 완료`, 'success');
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

        this.showToast(`${successCount}개 장치 정지 완료`, 'info');
    }

    /**
     * Refresh all devices
     */
    async refreshAllDevices() {
        this.showToast('모든 장치 상태 읽는 중...', 'info');

        for (const device of this.devices) {
            if (device.slaveId !== 0) {
                await this.readDeviceStatus(device.id, true);
            }
        }

        this.showToast('모든 장치 상태 업데이트 완료', 'success');
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
    }

    /**
     * Stop auto polling
     */
    stopAutoPolling() {
        this.autoPollingTimer = null;
        this.isPolling = false;
        if (this.pendingResponse) {
            this.pendingResponse = null;
        }
        // 대기 중인 write 명령을 모두 reject (연결 해제 시 caller가 catch 처리 가능)
        while (this.commandQueue.length > 0) {
            const cmd = this.commandQueue.shift();
            cmd.reject(new Error('Polling stopped (disconnected)'));
        }
        this.destroyPollingWorker();
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

        if (this.devices.length === 0) {
            // No devices, wait and retry
            setTimeout(() => this.pollNextDeviceSequential(), 500);
            return;
        }

        // Prevent concurrent polling
        if (this.isPolling) return;
        this.isPolling = true;

        // Command queue: polling 사이클 사이에 사용자 write 명령을 처리
        // 이 블록에서만 TX가 발생하므로 485 버스 충돌 원천 차단
        if (this.commandQueue.length > 0) {
            const cmd = this.commandQueue.shift();
            try {
                // commandTimeout (설정의 Timeout)을 사용해 write 후 응답 대기
                await this.sendWriteAndWaitResponse(cmd.frame, cmd.slaveId, cmd.address);
                cmd.resolve();
            } catch (err) {
                cmd.reject(err);
            } finally {
                this.isPolling = false;
                // Interval(설정의 Interval)만큼 대기 후 다음 사이클 (queue에 더 있으면 즉시 처리)
                this.scheduleNextPoll();
            }
            return;
        }

        // Get devices with valid slave IDs
        const validDevices = this.devices.filter(d => d.slaveId !== 0);
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
            const status = await this.readInputRegisterWithTimeout(device.slaveId, this.REGISTERS.MOTOR_STATUS);

            if (status !== null) {
                device.motorStatus = status;
                device.lastUpdate = Date.now();
                device.online = true;
                device.failCount = 0; // Reset fail count on success
                this.updateDeviceStats(device.slaveId, true);

                // Inter-frame gap before next read (메시지 간격 설정 적용)
                if (this.paramPollingDelay > 0) await this.delay(this.paramPollingDelay);

                // Read actual speed (Function Code 04 - Input Register)
                const actualSpeed = await this.readInputRegisterWithTimeout(device.slaveId, this.REGISTERS.ACTUAL_SPEED);
                if (actualSpeed !== null) {
                    // Handle signed 16-bit value
                    device.actualSpeed = actualSpeed > 32767 ? actualSpeed - 65536 : actualSpeed;
                }

                this.updateDeviceCardStatus(device);

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
            // Real serial communication with timeout
            return await this.sendAndWaitResponse(frame, slaveId);
        }

        return null;
    }

    /**
     * Send frame and wait for response with timeout
     */
    async sendAndWaitResponse(frame, expectedSlaveId) {
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

        const statusInfo = this.getMotorStatusInfo(device.motorStatus, device.online);

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

        // No errors - check if running (status > 0 could mean running)
        // If status is 0, motor is stopped/idle
        if (status === 0) {
            return {
                text: 'Stopped',
                class: 'stopped',
                errors: [],
                hasError: false,
                tooltip: 'Motor stopped'
            };
        }

        // Non-zero but no error bits - assume running
        return {
            text: 'Running',
            class: 'running',
            errors: [],
            hasError: false,
            tooltip: 'Motor running normally'
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
            if (this.autoPollingTimer) {
                // Polling active: enqueue to avoid 485 bus collision
                // Uses commandTimeout (설정의 Timeout 값) for the actual write response
                return new Promise((resolve, reject) => {
                    this.commandQueue.push({ frame, slaveId, address, resolve, reject });
                });
            } else {
                // Polling not active: execute directly
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
                    this.addMonitorEntry('received', response);
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
            await this.writer.write(frame);
            this.addMonitorEntry('sent', frame, { functionCode: 3, startAddress: address, quantity: 1 });
            this.stats.requests++;
            this.updateStatsDisplay();
            // Note: Real implementation would need to wait and parse the response
            return 0;
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

        const element = document.querySelector(`[data-device-id="${deviceId}"]`);
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
     * Parse address string (0xD001 or 53249)
     */
    parseMonitoringAddress(addressStr) {
        if (typeof addressStr === 'number') return addressStr;
        addressStr = addressStr.toString().trim();

        if (addressStr.toLowerCase().startsWith('0x')) {
            return parseInt(addressStr, 16);
        }
        return parseInt(addressStr, 10);
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
            this.showToast('Parameter already exists', 'warning');
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
        this.showToast(`${newParam.name} added`, 'success');
    }

    /**
     * Add monitoring parameter manually
     */
    addMonitoringParamManual(deviceId, type, addressStr, name) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const address = this.parseMonitoringAddress(addressStr);
        if (isNaN(address)) {
            this.showToast('Invalid address format', 'error');
            return;
        }

        if (!device.monitoringParams) {
            device.monitoringParams = [];
        }

        // Check for duplicates
        if (device.monitoringParams.some(p => p.type === type && p.address === address)) {
            this.showToast('Parameter already exists', 'warning');
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
        this.showToast(`${newParam.name} added`, 'success');
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
        this.showToast(`${paramName} removed`, 'info');
    }

    /**
     * Render monitoring parameters list
     */
    renderMonitoringParams(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        const element = document.querySelector(`[data-device-id="${deviceId}"]`);
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
                <div class="param-value ${param.value === null ? 'stale' : ''}" id="param-value-${param.id}">
                    ${param.value !== null ? param.value : '--'}
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
                <div class="param-value ${param.value === null ? 'stale' : ''}" id="param-value-${param.id}">
                    ${param.value !== null ? param.value : '--'}
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

        // Add from CSV
        const addCsvBtn = card.querySelector('.add-param-btn');
        if (addCsvBtn) {
            addCsvBtn.addEventListener('click', () => {
                const select = card.querySelector('.param-select');
                this.addMonitoringParamFromCSV(deviceId, select.value);
                select.value = '';
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

                if (param.type === 'input') {
                    value = await this.readInputRegisterWithTimeout(device.slaveId, param.address);
                } else {
                    value = await this.readRegisterWithTimeout(device.slaveId, param.address);
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
            return await this.sendAndWaitResponse(frame, slaveId);
        }

        return null;
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
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== End Monitoring Parameters Methods ====================

    /**
     * Show Auto Assign Modal
     */
    showAutoAssignModal() {
        const modal = document.getElementById('autoAssignModal');
        if (modal) {
            modal.classList.add('active');
            document.getElementById('autoAssignProgress').style.display = 'none';
        }
    }

    /**
     * Hide Auto Assign Modal
     */
    hideAutoAssignModal() {
        const modal = document.getElementById('autoAssignModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Start auto ID assignment
     */
    async startAutoAssign() {
        const startingId = parseInt(document.getElementById('startingSlaveId').value);
        const method = document.querySelector('input[name="assignMethod"]:checked').value;

        const unassignedDevices = this.devices.filter(d => d.slaveId === 0);

        if (unassignedDevices.length === 0) {
            this.showToast('ID를 할당할 장치가 없습니다', 'info');
            return;
        }

        const progressDiv = document.getElementById('autoAssignProgress');
        const progressBar = document.getElementById('assignProgressBar');
        const progressText = document.getElementById('assignProgressText');

        progressDiv.style.display = 'block';

        for (let i = 0; i < unassignedDevices.length; i++) {
            const device = unassignedDevices[i];
            const newId = startingId + i;

            progressBar.style.width = `${((i + 1) / unassignedDevices.length) * 100}%`;
            progressText.textContent = `${device.name}에 ID ${newId} 할당 중... (${i + 1}/${unassignedDevices.length})`;

            // In real scenario, you would send Modbus command to set the ID
            // For now, just update the local device
            device.slaveId = newId;

            // Small delay for visual feedback
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        this.saveDevices();
        this.renderDeviceGrid();

        progressText.textContent = '할당 완료!';
        this.showToast(`${unassignedDevices.length}개 장치에 ID 할당 완료`, 'success');

        setTimeout(() => {
            this.hideAutoAssignModal();
        }, 1000);
    }

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
            manualScanBtn.addEventListener('click', () => this.startDeviceScan());
        }

        // Stop scan button
        const stopScanBtn = document.getElementById('stopScanBtn');
        if (stopScanBtn) {
            stopScanBtn.addEventListener('click', () => this.stopDeviceScan());
        }
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
        const totalToScan = this.scanRangeEnd - this.scanRangeStart + 1;

        this.addMonitorEntry('received', `Device scan started (ID ${this.scanRangeStart} ~ ${this.scanRangeEnd})${autoAdd ? ' [Auto Add]' : ''}`);

        for (let slaveId = this.scanRangeStart; slaveId <= this.scanRangeEnd; slaveId++) {
            if (this.scanAborted) {
                this.addMonitorEntry('received', 'Device scan aborted');
                break;
            }

            const progress = ((slaveId - this.scanRangeStart + 1) / totalToScan) * 100;
            if (scanProgressBar) scanProgressBar.style.width = `${progress}%`;
            if (scanProgressText) scanProgressText.textContent = `Scanning ID ${slaveId}... (${slaveId - this.scanRangeStart + 1}/${totalToScan})`;

            const response = await this.scanSlaveId(slaveId);

            if (response !== null) {
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

        const autoAddMsg = autoAdd && foundDevices.length > 0 ? ' (Dashboard에 자동 추가됨)' : '';
        this.showToast(`탐색 완료: ${foundDevices.length}개 장치 발견${autoAddMsg}`, foundDevices.length > 0 ? 'success' : 'info');
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
            maxSpeed: 10000,
            lastUpdate: Date.now(),
            online: true,
            runningDirection: 0,  // 0: CCW, 1: CW
            maxCurrent: 0         // Maximum coil current in Amperes
        };

        this.devices.push(device);
        this.saveDevices();
        this.renderDeviceGrid();

        // 연결 후 디바이스에서 모드와 최대 속도 읽기
        this.initializeDeviceMode(device.id);

        // Start auto polling if connection is active, on Dashboard, and wasn't running (first device added)
        if (!this.autoPollingTimer && (this.simulatorEnabled || this.writer) && this.currentPage === 'dashboard') {
            this.startAutoPolling();
        }

        if (!silent) {
            this.showToast(`Device ${slaveId} 추가됨`, 'success');
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
     * Update firmware device list
     */
    updateFirmwareDeviceList() {
        const deviceList = document.getElementById('firmwareDeviceList');
        if (!deviceList) return;

        if (this.devices.length === 0) {
            deviceList.innerHTML = '<p class="placeholder">연결된 장치가 없습니다</p>';
            return;
        }

        deviceList.innerHTML = this.devices.map(device => `
            <div class="firmware-device-item" data-device-id="${device.id}">
                <input type="checkbox" id="fw-device-${device.id}">
                <label class="firmware-device-name" for="fw-device-${device.id}">${device.name}</label>
                <span class="firmware-device-id">ID: ${device.slaveId}</span>
            </div>
        `).join('');

        // Add click handlers
        deviceList.querySelectorAll('.firmware-device-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                }
                item.classList.toggle('selected', item.querySelector('input').checked);
            });
        });
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

        this.showToast('펌웨어 검증 완료', 'success');
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

        // Get settings
        const slaveId = parseInt(document.getElementById('firmwareSlaveId')?.value) || 1;
        const packetSize = parseInt(document.getElementById('fwPacketSize')?.value) || 60;
        const packetDelay = parseInt(document.getElementById('fwPacketDelay')?.value) || 50;
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

                // Delay between packets
                await this.delay(packetDelay);
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

            // 응답 OpCode가 0x04면 성공, 0x05면 에러
            const doneResult = this.modbus.parseFirmwareResponse(doneResponse);
            if (!doneResult.success) {
                throw new Error('펌웨어 완료 처리 실패');
            }

            this.setFirmwareStepStatus('0x99', 'completed');
            this.addFirmwareLog('[0x99] 펌웨어 업데이트 완료 - Flash Lock', 'success');

            this.addFirmwareLog('펌웨어 다운로드 성공!', 'success');
            this.showToast('펌웨어 다운로드 완료', 'success');

        } catch (error) {
            this.addFirmwareLog(`에러: ${error.message}`, 'error');
            this.showToast(`펌웨어 다운로드 실패: ${error.message}`, 'error');

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

            // 버퍼에 남아있을 수 있는 이전 데이터 제거를 위한 짧은 딜레이
            await this.delay(50);

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
                        this.addMonitorEntry('rx', response);
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
            startBtn.addEventListener('click', () => {
                this.startChartCapture();
                startBtn.disabled = true;
                stopBtn.disabled = false;
                pauseBtn.disabled = false;
            });
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.stopChartCapture();
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
        const sampleRateEl = document.getElementById('chartSampleRate');
        const bufferSizeEl = document.getElementById('chartBufferSize');

        if (timeScaleEl) {
            timeScaleEl.addEventListener('change', () => {
                this.chartManager.setTimeScale(parseInt(timeScaleEl.value));
            });
        }

        if (sampleRateEl) {
            sampleRateEl.addEventListener('change', () => {
                this.chartManager.setSampleRate(parseInt(sampleRateEl.value));
            });
        }

        if (bufferSizeEl) {
            bufferSizeEl.addEventListener('change', () => {
                this.chartManager.setBufferSize(parseInt(bufferSizeEl.value));
            });
        }

        // Channel configuration
        for (let i = 0; i < 4; i++) {
            const enableEl = document.getElementById(`chartCh${i + 1}Enable`);
            const addrEl = document.getElementById(`chartCh${i + 1}Addr`);

            if (enableEl) {
                enableEl.addEventListener('change', () => {
                    this.chartManager.setChannelEnabled(i, enableEl.checked);
                });
            }

            if (addrEl) {
                addrEl.addEventListener('change', () => {
                    let addr = addrEl.value.trim();
                    if (addr.startsWith('0x') || addr.startsWith('0X')) {
                        addr = parseInt(addr, 16);
                    } else {
                        addr = parseInt(addr);
                    }
                    if (!isNaN(addr)) {
                        this.chartManager.setChannelAddress(i, addr);
                    }
                });
            }
        }

        // Trigger settings
        const triggerChannelEl = document.getElementById('triggerChannel');
        const triggerEdgeEl = document.getElementById('triggerEdge');
        const triggerLevelEl = document.getElementById('triggerLevel');
        const triggerPreSamplesEl = document.getElementById('triggerPreSamples');
        const triggerPostSamplesEl = document.getElementById('triggerPostSamples');

        if (triggerChannelEl) {
            triggerChannelEl.addEventListener('change', () => {
                this.chartManager.setTriggerChannel(parseInt(triggerChannelEl.value));
            });
        }

        if (triggerEdgeEl) {
            triggerEdgeEl.addEventListener('change', () => {
                this.chartManager.setTriggerEdge(triggerEdgeEl.value);
            });
        }

        if (triggerLevelEl) {
            triggerLevelEl.addEventListener('change', () => {
                this.chartManager.setTriggerLevel(parseInt(triggerLevelEl.value));
            });
        }

        if (triggerPreSamplesEl) {
            triggerPreSamplesEl.addEventListener('change', () => {
                this.chartManager.setPreSamples(parseInt(triggerPreSamplesEl.value));
            });
        }

        if (triggerPostSamplesEl) {
            triggerPostSamplesEl.addEventListener('change', () => {
                this.chartManager.setPostSamples(parseInt(triggerPostSamplesEl.value));
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
    }

    /**
     * Start chart data capture
     */
    startChartCapture() {
        if (!this.chartManager) return;

        this.chartManager.startCapture();

        // Start polling for chart data
        const sampleRate = this.chartManager.sampleRate;

        this.chartPollingTimer = setInterval(() => {
            this.pollChartData();
        }, sampleRate);
    }

    /**
     * Stop chart data capture
     */
    stopChartCapture() {
        if (!this.chartManager) return;

        this.chartManager.stopCapture();

        if (this.chartPollingTimer) {
            clearInterval(this.chartPollingTimer);
            this.chartPollingTimer = null;
        }
    }

    /**
     * Poll data for chart channels
     */
    async pollChartData() {
        if (!this.chartManager || !this.chartManager.isRunning) return;
        if (!this.port && !this.simulatorEnabled) return;

        const timestamp = Date.now();

        for (let i = 0; i < 4; i++) {
            const channel = this.chartManager.channels[i];
            if (!channel.enabled || channel.address === 0) continue;

            try {
                // Use first device's slave ID or default to 1
                const slaveId = this.devices.length > 0 ? this.devices[0].slaveId : 1;

                const frame = this.modbus.buildReadHoldingRegistersRequest(slaveId, channel.address, 1);

                if (this.simulatorEnabled) {
                    // Simulator returns a Promise
                    const response = await this.simulator.processRequest(frame);
                    if (response && response.length >= 5) {
                        const value = (response[3] << 8) | response[4];
                        this.chartManager.addDataPoint(i, value, timestamp);
                    }
                } else if (this.port) {
                    // Send request
                    await this.writer.write(frame);

                    // Wait for response with timeout
                    const response = await this.waitForResponseWithTimeout(100);
                    if (response && response.length >= 5) {
                        const value = (response[3] << 8) | response[4];
                        this.chartManager.addDataPoint(i, value, timestamp);
                    }
                }
            } catch (error) {
                // Silently ignore errors during chart polling
                console.debug('Chart polling error for channel', i, error);
            }
        }
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

        // Update configuration panel and parameters panel
        this.renderDeviceSetupConfig(device);

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

        // Create menu
        const menu = document.createElement('div');
        menu.id = 'configContextMenu';
        menu.className = 'config-context-menu';
        menu.innerHTML = `
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
    renderDeviceSetupConfig(device) {
        const configContainer = document.getElementById('deviceSetupConfig');
        if (!configContainer) return;

        const modeText = device.operationMode === 0 ? 'Speed Control (RPM)' : 'Open-loop Control (%)';

        configContainer.innerHTML = `
            <div style="display: block; position: relative;">
                <!-- Device Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; min-height: 48px;">
                    <div>
                        <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; line-height: 1.4; min-height: 29px; display: flex; align-items: center;">
                            <span class="device-name"
                                  id="deviceName_${device.id}"
                                  title="Click to edit name"
                                  style="cursor: pointer; display: inline-block; padding: 2px 4px; border: 1px solid transparent; border-radius: 4px; transition: background 0.2s; box-sizing: border-box;"
                                  onmouseover="this.style.background='#f0f0f0'"
                                  onmouseout="this.style.background='transparent'">${device.name}</span>
                        </h2>
                        <div style="font-size: 13px; color: #6c757d; line-height: 1.4;">Slave ID: ${device.slaveId === 0 ? 'Not Assigned' : device.slaveId}</div>
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
                <div style="display: flex; gap: 20px;">
                    <!-- Category Selector -->
                    <div style="width: 140px; flex-shrink: 0; border: 1px solid #e9ecef; border-radius: 8px; padding: 8px; background: #fafafa;">
                        <div class="config-category-item config-category-active" data-category="general">
                            일반
                        </div>
                    </div>

                    <!-- Category Content -->
                    <div style="flex: 1; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; background: white;">
                        <!-- Settings List -->
                        <div style="margin-top: 0;">
                            <!-- Fan Address -->
                    <div class="config-item" data-config="fanAddress" onclick="window.dashboard.selectConfigItem(this, event)" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0 12px 8px; border-bottom: 1px solid #e9ecef; position: relative; cursor: pointer; transition: background 0.2s; border-radius: 4px; margin: 0 -8px;">
                        <div class="config-item-icon" style="width: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 8px; opacity: 0; transition: opacity 0.2s; pointer-events: none;">
                            <span onclick="window.dashboard.showConfigMenu(event, 'fanAddress', '${device.id}')" style="cursor: pointer; font-size: 16px;">⚙</span>
                        </div>
                        <div style="flex: 1; padding-right: 20px;">
                            <div style="font-size: 13px; font-weight: 500; color: #1a1a1a; margin-bottom: 2px;">Fan Address</div>
                            <div style="font-size: 12px; color: #6c757d;">Modbus device address (0xD100)</div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center; width: 220px; justify-content: flex-end;">
                            <input type="number" id="fanAddress_${device.id}"
                                value="${device.slaveId}"
                                min="1" max="247"
                                style="width: 180px; padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; background: white;"
                                onchange="window.dashboard.debouncedApply('fanAddress', ${device.id})"
                                onclick="event.stopPropagation()">
                            <span id="fanAddress_${device.id}_status" style="width: 24px; font-size: 13px; color: #6c757d; text-align: center;"></span>
                        </div>
                    </div>

                    <!-- Operating Mode -->
                    <div class="config-item" data-config="operatingMode" onclick="window.dashboard.selectConfigItem(this, event)" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0 12px 8px; border-bottom: 1px solid #e9ecef; position: relative; cursor: pointer; transition: background 0.2s; border-radius: 4px; margin: 0 -8px;">
                        <div class="config-item-icon" style="width: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 8px; opacity: 0; transition: opacity 0.2s; pointer-events: none;">
                            <span onclick="window.dashboard.showConfigMenu(event, 'operatingMode', '${device.id}')" style="cursor: pointer; font-size: 16px;">⚙</span>
                        </div>
                        <div style="flex: 1; padding-right: 20px;">
                            <div style="font-size: 13px; font-weight: 500; color: #1a1a1a; margin-bottom: 2px;">Operating Mode</div>
                            <div style="font-size: 12px; color: #6c757d;">Motor control method (0xD106)</div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center; width: 220px; justify-content: flex-end;">
                            <select id="operatingMode_${device.id}"
                                style="width: 180px; padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; background: white;"
                                onchange="window.dashboard.applyOperatingMode(${device.id})"
                                onclick="event.stopPropagation()">
                                <option value="0" ${device.operationMode === 0 ? 'selected' : ''}>Speed Control</option>
                                <option value="2" ${device.operationMode === 2 ? 'selected' : ''}>Open-loop</option>
                            </select>
                            <span id="operatingMode_${device.id}_status" style="width: 24px; font-size: 13px; color: #6c757d; text-align: center;"></span>
                        </div>
                    </div>

                    <!-- Running Direction -->
                    <div class="config-item" data-config="runningDirection" onclick="window.dashboard.selectConfigItem(this, event)" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0 12px 8px; border-bottom: 1px solid #e9ecef; position: relative; cursor: pointer; transition: background 0.2s; border-radius: 4px; margin: 0 -8px;">
                        <div class="config-item-icon" style="width: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 8px; opacity: 0; transition: opacity 0.2s; pointer-events: none;">
                            <span onclick="window.dashboard.showConfigMenu(event, 'runningDirection', '${device.id}')" style="cursor: pointer; font-size: 16px;">⚙</span>
                        </div>
                        <div style="flex: 1; padding-right: 20px;">
                            <div style="font-size: 13px; font-weight: 500; color: #1a1a1a; margin-bottom: 2px;">Running Direction</div>
                            <div style="font-size: 12px; color: #6c757d;">Motor rotation direction (0xD102)</div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center; width: 220px; justify-content: flex-end;">
                            <select id="runningDirection_${device.id}"
                                style="width: 180px; padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; background: white;"
                                onchange="window.dashboard.applyRunningDirection(${device.id})"
                                onclick="event.stopPropagation()">
                                <option value="0" ${device.runningDirection === 0 ? 'selected' : ''}>CCW</option>
                                <option value="1" ${device.runningDirection === 1 ? 'selected' : ''}>CW</option>
                            </select>
                            <span id="runningDirection_${device.id}_status" style="width: 24px; font-size: 13px; color: #6c757d; text-align: center;"></span>
                        </div>
                    </div>

                    <!-- Maximum Coil Current -->
                    <div class="config-item" data-config="maxCurrent" onclick="window.dashboard.selectConfigItem(this, event)" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0 12px 8px; border-bottom: 1px solid #e9ecef; position: relative; cursor: pointer; transition: background 0.2s; border-radius: 4px; margin: 0 -8px;">
                        <div class="config-item-icon" style="width: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 8px; opacity: 0; transition: opacity 0.2s; pointer-events: none;">
                            <span onclick="window.dashboard.showConfigMenu(event, 'maxCurrent', '${device.id}')" style="cursor: pointer; font-size: 16px;">⚙</span>
                        </div>
                        <div style="flex: 1; padding-right: 20px;">
                            <div style="font-size: 13px; font-weight: 500; color: #1a1a1a; margin-bottom: 2px;">Maximum Coil Current (A)</div>
                            <div style="font-size: 12px; color: #6c757d;">Current limit in Amperes (0xD13B)</div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center; width: 220px; justify-content: flex-end;">
                            <input type="number" id="maxCurrent_${device.id}"
                                value="${device.maxCurrent || 0}"
                                min="0" max="100" step="0.1"
                                style="width: 180px; padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; background: white;"
                                onchange="window.dashboard.debouncedApply('maxCurrent', ${device.id})"
                                onclick="event.stopPropagation()">
                            <span id="maxCurrent_${device.id}_status" style="width: 24px; font-size: 13px; color: #6c757d; text-align: center;"></span>
                        </div>
                    </div>

                    <!-- Software Reset -->
                    <div class="config-item" data-config="softwareReset" onclick="window.dashboard.selectConfigItem(this, event)" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0 12px 8px; border-bottom: 1px solid #e9ecef; position: relative; cursor: pointer; transition: background 0.2s; border-radius: 4px; margin: 0 -8px;">
                        <div class="config-item-icon" style="width: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 8px; opacity: 0; transition: opacity 0.2s; pointer-events: none;">
                            <span onclick="window.dashboard.showConfigMenu(event, 'softwareReset', '${device.id}')" style="cursor: pointer; font-size: 16px;">⚙</span>
                        </div>
                        <div style="flex: 1; padding-right: 20px;">
                            <div style="font-size: 13px; font-weight: 500; color: #1a1a1a; margin-bottom: 2px;">Software Reset</div>
                            <div style="font-size: 12px; color: #6c757d;">Restart the device software (0xD000)</div>
                        </div>
                        <div style="display: flex; gap: 8px; width: 220px; justify-content: flex-end;">
                            <button class="btn btn-warning btn-sm"
                                onclick="event.stopPropagation(); window.dashboard.resetDevice(${device.id}, 'software')">Reset</button>
                            <span style="width: 24px;"></span>
                        </div>
                    </div>

                    <!-- Error Reset -->
                    <div class="config-item" data-config="errorReset" onclick="window.dashboard.selectConfigItem(this, event)" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0 12px 8px; border-bottom: 1px solid #e9ecef; position: relative; cursor: pointer; transition: background 0.2s; border-radius: 4px; margin: 0 -8px;">
                        <div class="config-item-icon" style="width: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 8px; opacity: 0; transition: opacity 0.2s; pointer-events: none;">
                            <span onclick="window.dashboard.showConfigMenu(event, 'errorReset', '${device.id}')" style="cursor: pointer; font-size: 16px;">⚙</span>
                        </div>
                        <div style="flex: 1; padding-right: 20px;">
                            <div style="font-size: 13px; font-weight: 500; color: #1a1a1a; margin-bottom: 2px;">Error Reset</div>
                            <div style="font-size: 12px; color: #6c757d;">Clear error status and flags (0xD000)</div>
                        </div>
                        <div style="display: flex; gap: 8px; width: 220px; justify-content: flex-end;">
                            <button class="btn btn-warning btn-sm"
                                onclick="event.stopPropagation(); window.dashboard.resetDevice(${device.id}, 'error')">Reset</button>
                            <span style="width: 24px;"></span>
                        </div>
                    </div>

                    <!-- EEPROM to RAM -->
                    <div class="config-item" data-config="eepromToRam" onclick="window.dashboard.selectConfigItem(this, event)" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0 12px 8px; border-bottom: 1px solid #e9ecef; position: relative; cursor: pointer; transition: background 0.2s; border-radius: 4px; margin: 0 -8px;">
                        <div class="config-item-icon" style="width: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; margin-right: 8px; opacity: 0; transition: opacity 0.2s; pointer-events: none;">
                            <span onclick="window.dashboard.showConfigMenu(event, 'eepromToRam', '${device.id}')" style="cursor: pointer; font-size: 16px;">⚙</span>
                        </div>
                        <div style="flex: 1; padding-right: 20px;">
                            <div style="font-size: 13px; font-weight: 500; color: #1a1a1a; margin-bottom: 2px;">EEPROM to RAM</div>
                            <div style="font-size: 12px; color: #6c757d;">Load settings from EEPROM to RAM (0xD000)</div>
                        </div>
                        <div style="display: flex; gap: 8px; width: 220px; justify-content: flex-end;">
                            <button class="btn btn-info btn-sm"
                                onclick="event.stopPropagation(); window.dashboard.resetDevice(${device.id}, 'eeprom')">Load</button>
                            <span style="width: 24px;"></span>
                        </div>
                    </div>
                        </div>
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
                this.showToast(`Value read: ${value}`, 'success');
            } else {
                this.showToast('Failed to read parameter', 'error');
            }
        } catch (error) {
            console.error('Read parameter error:', error);
            this.showToast('Failed to read parameter', 'error');
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
            this.showToast('Parameter written successfully', 'success');
        } else {
            this.showToast('Failed to write parameter', 'error');
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
        const success = await this.writeHoldingRegister(device.slaveId, 0xD100, newAddress);
        if (success) {
            device.slaveId = newAddress;
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
                statusElement.textContent = '✓';
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
                statusElement.textContent = '✓';
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
                statusElement.textContent = '✓';
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
        const maxValue = device.operationMode === 0 ? 10000 : 100;

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
                statusElement.textContent = '✓';
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
                statusElement.textContent = '✓';
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
            this.showToast(`${resetType.charAt(0).toUpperCase() + resetType.slice(1)} reset completed successfully`, 'success');

            // Refresh device status after reset
            setTimeout(() => {
                this.refreshDevice(deviceId);
            }, 1000);
        } else {
            this.showToast(`Failed to perform ${resetType} reset`, 'error');
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
    window.osTestManager = new OSTestManager();

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
            if (targetTab === 'configuration') {
                document.getElementById('deviceSetupConfigTab').style.display = 'block';
            } else if (targetTab === 'parameters') {
                document.getElementById('deviceSetupParamsTab').style.display = 'block';
            } else if (targetTab === 'manufacture') {
                document.getElementById('deviceSetupManufactureTab').style.display = 'flex';
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

            // Hide all subtab contents
            const subtabContents = document.querySelectorAll('.manufacture-subtab-content');
            subtabContents.forEach(content => {
                content.style.display = 'none';
            });

            // Show selected subtab content
            if (targetSubtab === 'os-verification') {
                document.getElementById('manufactureOsVerification').style.display = 'block';
            } else if (targetSubtab === 'hardware-test') {
                document.getElementById('manufactureHardwareTest').style.display = 'block';
            } else if (targetSubtab === 'tuning') {
                document.getElementById('manufactureTuning').style.display = 'block';
            } else if (targetSubtab === 'offset') {
                document.getElementById('manufactureOffset').style.display = 'block';
            } else if (targetSubtab === 'serial-number') {
                document.getElementById('manufactureSerialNumber').style.display = 'block';
            }
        });
    });

    // OS Test Event Handlers
    // Initialize test status on page load
    window.osTestManager.updateTestStatus();

    // Test item header click to expand/collapse
    document.querySelectorAll('.os-test-header').forEach(header => {
        header.addEventListener('click', () => {
            const testItem = header.closest('.os-test-item');
            const testId = testItem.dataset.testId;
            window.osTestManager.expandTestItem(testId);
        });
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
});
