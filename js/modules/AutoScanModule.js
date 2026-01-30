/**
 * AutoScanModule - 장치 자동 탐색
 *
 * Features:
 *   - Slave ID 범위 스캔
 *   - 진행률 표시
 *   - 발견된 장치 자동 추가
 */

import { EVENTS } from '../core/EventBus.js';
import { delay } from '../utils/helpers.js';

export class AutoScanModule {
    constructor(eventBus = null, communication = null, deviceManager = null) {
        this.eventBus = eventBus;
        this.comm = communication;
        this.deviceManager = deviceManager;

        // Scan state
        this.isScanning = false;
        this.isCancelled = false;
        this.foundDevices = [];

        // Scan settings
        this.rangeStart = 1;
        this.rangeEnd = 10;
        this.timeout = 200;
        this.scanDelay = 50;  // 스캔 간 딜레이 (ms)
        this.register = 0xD011;
        this.autoAdd = true;
    }

    /**
     * Initialize auto scan module
     */
    init() {
        this.initUI();
    }

    /**
     * Initialize UI event listeners
     */
    initUI() {
        // Start scan button
        const startBtn = document.getElementById('startScanBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startScan());
        }

        // Stop scan button
        const stopBtn = document.getElementById('stopScanBtn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopScan());
        }

        // Settings inputs
        const rangeStartInput = document.getElementById('scanRangeStart');
        if (rangeStartInput) {
            rangeStartInput.addEventListener('change', (e) => {
                this.rangeStart = parseInt(e.target.value) || 1;
            });
        }

        const rangeEndInput = document.getElementById('scanRangeEnd');
        if (rangeEndInput) {
            rangeEndInput.addEventListener('change', (e) => {
                this.rangeEnd = parseInt(e.target.value) || 10;
            });
        }

        const timeoutInput = document.getElementById('scanTimeout');
        if (timeoutInput) {
            timeoutInput.addEventListener('change', (e) => {
                this.timeout = parseInt(e.target.value) || 200;
            });
        }

        const scanDelayInput = document.getElementById('scanDelay');
        if (scanDelayInput) {
            scanDelayInput.addEventListener('change', (e) => {
                this.scanDelay = parseInt(e.target.value) || 50;
            });
        }

        const registerInput = document.getElementById('scanRegister');
        if (registerInput) {
            registerInput.addEventListener('change', (e) => {
                const value = e.target.value.trim();
                this.register = value.startsWith('0x')
                    ? parseInt(value, 16)
                    : parseInt(value);
            });
        }

        const autoAddCheckbox = document.getElementById('scanAutoAdd');
        if (autoAddCheckbox) {
            autoAddCheckbox.addEventListener('change', (e) => {
                this.autoAdd = e.target.checked;
            });
        }
    }

    /**
     * Start scanning for devices
     */
    async startScan() {
        if (!this.comm) {
            this.showError('Not connected');
            return;
        }

        if (this.isScanning) return;

        this.isScanning = true;
        this.isCancelled = false;
        this.foundDevices = [];

        this.updateUI(true);
        this.clearResults();
        this.addResult(`Scanning ID ${this.rangeStart} to ${this.rangeEnd}...`, 'info');

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.SCAN_STARTED, {
                rangeStart: this.rangeStart,
                rangeEnd: this.rangeEnd
            });
        }

        const total = this.rangeEnd - this.rangeStart + 1;
        let scanned = 0;

        for (let slaveId = this.rangeStart; slaveId <= this.rangeEnd; slaveId++) {
            if (this.isCancelled) break;

            const found = await this.scanSlaveId(slaveId);

            // 다음 스캔 전 딜레이 (디바이스 응답 시간 확보)
            await delay(this.scanDelay);

            if (found) {
                this.foundDevices.push(slaveId);
                this.addResult(`Found device at ID ${slaveId}`, 'success');

                if (this.eventBus) {
                    this.eventBus.emit(EVENTS.SCAN_FOUND, { slaveId });
                }

                // Auto add to device manager
                if (this.autoAdd && this.deviceManager) {
                    const existing = this.deviceManager.getBySlaveId(slaveId);
                    if (!existing) {
                        this.deviceManager.add(`Device ${slaveId}`, slaveId);
                    }
                }
            }

            scanned++;
            this.updateProgress((scanned / total) * 100);

            if (this.eventBus) {
                this.eventBus.emit(EVENTS.SCAN_PROGRESS, {
                    current: scanned,
                    total,
                    slaveId
                });
            }
        }

        // Complete
        if (this.isCancelled) {
            this.addResult('Scan cancelled', 'warning');
            if (this.eventBus) {
                this.eventBus.emit(EVENTS.SCAN_ABORTED);
            }
        } else {
            this.addResult(`Scan complete. Found ${this.foundDevices.length} device(s)`, 'info');
            if (this.eventBus) {
                this.eventBus.emit(EVENTS.SCAN_COMPLETED, {
                    found: this.foundDevices
                });
            }
        }

        this.isScanning = false;
        this.updateUI(false);
    }

    /**
     * Stop scanning
     */
    stopScan() {
        this.isCancelled = true;
    }

    /**
     * Scan a single slave ID
     * @param {number} slaveId - Slave ID to scan
     * @returns {Promise<boolean>} - True if device found
     */
    async scanSlaveId(slaveId) {
        try {
            // Set shorter timeout for scanning
            const originalTimeout = this.comm.settings?.responseTimeout;
            if (this.comm.settings) {
                this.comm.settings.responseTimeout = this.timeout;
            }

            const result = await this.comm.readHoldingRegisters(slaveId, this.register, 1);

            // Restore original timeout
            if (this.comm.settings && originalTimeout) {
                this.comm.settings.responseTimeout = originalTimeout;
            }

            return result.success;

        } catch (e) {
            return false;
        }
    }

    /**
     * Update progress display
     * @param {number} percent - Progress percentage
     */
    updateProgress(percent) {
        const progressBar = document.getElementById('scanProgressBar');
        const progressText = document.getElementById('scanProgressText');

        if (progressBar) progressBar.style.width = percent + '%';
        if (progressText) progressText.textContent = percent.toFixed(0) + '%';
    }

    /**
     * Update UI state
     * @param {boolean} scanning - Is scanning
     */
    updateUI(scanning) {
        const startBtn = document.getElementById('startScanBtn');
        const stopBtn = document.getElementById('stopScanBtn');
        const inputs = document.querySelectorAll('.scan-settings input, .scan-settings select');

        if (startBtn) startBtn.disabled = scanning;
        if (stopBtn) stopBtn.disabled = !scanning;

        inputs.forEach(input => {
            input.disabled = scanning;
        });
    }

    /**
     * Add result to display
     * @param {string} message - Result message
     * @param {string} type - Result type: 'info', 'success', 'warning', 'error'
     */
    addResult(message, type = 'info') {
        const resultsContainer = document.getElementById('scanResults');
        if (!resultsContainer) return;

        const entry = document.createElement('div');
        entry.className = `scan-result ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        resultsContainer.appendChild(entry);
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
    }

    /**
     * Clear results
     */
    clearResults() {
        const resultsContainer = document.getElementById('scanResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }
        this.updateProgress(0);
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.addResult(message, 'error');
    }

    /**
     * Get found devices
     * @returns {Array<number>}
     */
    getFoundDevices() {
        return [...this.foundDevices];
    }
}
