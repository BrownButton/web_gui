/**
 * ChartManager - Real-time 4-channel data visualization
 * Pure Canvas API implementation with zoom, pan, and cursor support
 *
 * Features:
 *   - 4 configurable channels
 *   - Continuous and Trigger modes
 *   - Zoom (X/Y axis), Pan, Auto-scale
 *   - Cursor with value display
 *   - Markers with delta measurement
 *   - Export to CSV/PNG
 */

import { EVENTS } from '../core/EventBus.js';

export class ChartManager {
    constructor(canvasId, eventBus = null) {
        this.eventBus = eventBus;
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

        // Emit event
        if (this.eventBus) {
            this.eventBus.emit(EVENTS.CHART_DATA, { channelIndex, value, timestamp });
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

        // Emit event
        if (this.eventBus) {
            this.eventBus.emit(EVENTS.CHART_STARTED);
        }
    }

    stopCapture() {
        this.isRunning = false;
        this.trigger.armed = false;
        this.updateStatus('Stopped');
        this.cancelAnimation();

        // Emit event
        if (this.eventBus) {
            this.eventBus.emit(EVENTS.CHART_STOPPED);
        }
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

    /**
     * Destroy chart manager and cleanup
     */
    destroy() {
        this.cancelAnimation();
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.removeEventListener('wheel', this.handleWheel);
        this.canvas.removeEventListener('dblclick', this.handleDblClick);
        this.canvas.removeEventListener('click', this.handleClick);
    }
}
