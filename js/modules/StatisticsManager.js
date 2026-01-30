/**
 * StatisticsManager - 통신 통계 관리
 *
 * Features:
 *   - 전체 통계 (요청, 성공, 에러)
 *   - 장치별 통계
 *   - 에러율 계산
 *   - UI 업데이트
 */

import { EVENTS } from '../core/EventBus.js';

export class StatisticsManager {
    constructor(eventBus = null) {
        this.eventBus = eventBus;

        // Global statistics
        this.stats = {
            requests: 0,
            success: 0,
            errors: 0
        };

        // Per-device statistics
        this.deviceStats = {}; // { slaveId: { requests, success, errors } }

        // Settings
        this.baseFrameCount = 1000; // Base frame count for error rate calculation

        // Device list reference (optional, for device names)
        this.devices = [];

        // Subscribe to events
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.eventBus) {
            this.eventBus.on(EVENTS.FRAME_RECEIVED, (data) => {
                this.recordRequest(true, data?.slaveId);
            });

            this.eventBus.on(EVENTS.FRAME_ERROR, (data) => {
                this.recordRequest(false, data?.slaveId);
            });

            this.eventBus.on(EVENTS.FRAME_TIMEOUT, (data) => {
                this.recordRequest(false, data?.slaveId);
            });
        }
    }

    /**
     * Set device list reference
     * @param {Array} devices - Array of device objects
     */
    setDevices(devices) {
        this.devices = devices;
    }

    /**
     * Set base frame count for error rate calculation
     * @param {number} count - Base frame count
     */
    setBaseFrameCount(count) {
        this.baseFrameCount = count;
        this.updateDisplay();

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.SETTINGS_CHANGED, { baseFrameCount: count });
        }
    }

    /**
     * Record a request
     * @param {boolean} success - Whether the request was successful
     * @param {number} slaveId - Optional slave ID for device-specific stats
     */
    recordRequest(success, slaveId = null) {
        this.stats.requests++;

        if (success) {
            this.stats.success++;
        } else {
            this.stats.errors++;
        }

        // Update device-specific stats
        if (slaveId !== null) {
            this.updateDeviceStats(slaveId, success);
        }

        this.updateDisplay();

        // Emit event
        if (this.eventBus) {
            this.eventBus.emit(EVENTS.STATS_UPDATED, this.getStats());
        }
    }

    /**
     * Update device statistics
     * @param {number} slaveId - Slave ID
     * @param {boolean} success - Whether the request was successful
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
     * Get current statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        const rate = this.stats.requests > 0
            ? (this.stats.success / this.stats.requests) * 100
            : 0;

        const errorRate = this.stats.requests > 0
            ? (this.stats.errors / this.stats.requests) * this.baseFrameCount
            : 0;

        return {
            requests: this.stats.requests,
            success: this.stats.success,
            errors: this.stats.errors,
            successRate: rate,
            errorRate: errorRate,
            baseFrameCount: this.baseFrameCount,
            deviceStats: { ...this.deviceStats }
        };
    }

    /**
     * Get device statistics
     * @param {number} slaveId - Slave ID
     * @returns {Object|null} Device statistics or null
     */
    getDeviceStats(slaveId) {
        return this.deviceStats[slaveId] || null;
    }

    /**
     * Reset all statistics
     */
    reset() {
        this.stats = {
            requests: 0,
            success: 0,
            errors: 0
        };
        this.deviceStats = {};
        this.updateDisplay();

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.STATS_RESET);
        }
    }

    /**
     * Reset device statistics
     * @param {number} slaveId - Slave ID to reset (optional, resets all if not provided)
     */
    resetDeviceStats(slaveId = null) {
        if (slaveId !== null) {
            delete this.deviceStats[slaveId];
        } else {
            this.deviceStats = {};
        }
        this.updateDisplay();
    }

    /**
     * Update statistics display
     */
    updateDisplay() {
        const rate = this.stats.requests > 0
            ? ((this.stats.success / this.stats.requests) * 100).toFixed(1)
            : 0;

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
                    <span class="device-id">ID ${slaveId}</span>
                    <span class="device-name">${name}</span>
                    <span class="stat-ok">${stats.success}</span>
                    <span class="stat-err">${stats.errors}</span>
                    <span class="stat-rate">${rate}%</span>
                </div>
            `;
        }).join('');
    }

    /**
     * Initialize navbar stats tooltip
     */
    initNavbarStatsTooltip() {
        const statsArea = document.querySelector('.navbar-stats');
        const tooltip = document.getElementById('statsTooltip');

        if (!statsArea || !tooltip) return;

        let tooltipPinned = false;

        // Show tooltip on click (toggle pin)
        statsArea.addEventListener('click', (e) => {
            e.stopPropagation();
            tooltipPinned = !tooltipPinned;

            if (tooltipPinned) {
                tooltip.classList.add('pinned');
                this.updateDisplay();
            } else {
                tooltip.classList.remove('pinned');
            }
        });

        // Hide tooltip when clicking outside
        document.addEventListener('click', (e) => {
            if (tooltipPinned && !tooltip.contains(e.target) && !statsArea.contains(e.target)) {
                tooltipPinned = false;
                tooltip.classList.remove('pinned');
            }
        });
    }

    /**
     * Load statistics from localStorage
     */
    load() {
        const stored = localStorage.getItem('modbusStats');
        if (stored) {
            const data = JSON.parse(stored);
            this.stats = data.stats || this.stats;
            this.deviceStats = data.deviceStats || this.deviceStats;
            this.baseFrameCount = data.baseFrameCount || this.baseFrameCount;
            this.updateDisplay();
        }
    }

    /**
     * Save statistics to localStorage
     */
    save() {
        localStorage.setItem('modbusStats', JSON.stringify({
            stats: this.stats,
            deviceStats: this.deviceStats,
            baseFrameCount: this.baseFrameCount
        }));
    }
}
