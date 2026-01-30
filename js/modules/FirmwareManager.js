/**
 * FirmwareManager - 펌웨어 업데이트 관리
 *
 * Features:
 *   - 4단계 펌웨어 업로드 프로토콜
 *   - 진행률 표시
 *   - 로그 출력
 */

import { EVENTS } from '../core/EventBus.js';
import { delay, formatFileSize } from '../utils/helpers.js';

export class FirmwareManager {
    constructor(eventBus = null, communication = null, modbus = null) {
        this.eventBus = eventBus;
        this.comm = communication;
        this.modbus = modbus;

        // Firmware file
        this.file = null;
        this.fileData = null;

        // Upload state
        this.isUploading = false;
        this.isCancelled = false;
        this.currentStep = 0;
        this.progress = 0;

        // Upload settings
        this.packetSize = 60;
        this.packetDelay = 20;
        this.eraseTimeout = 5000;
        this.responseTimeout = 1000;
    }

    /**
     * Initialize firmware manager
     */
    init() {
        this.initUI();
    }

    /**
     * Initialize UI event listeners
     */
    initUI() {
        // File input
        const fileInput = document.getElementById('firmwareFile');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files[0]);
            });
        }

        // Start button
        const startBtn = document.getElementById('firmwareStartBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startUpload());
        }

        // Cancel button
        const cancelBtn = document.getElementById('firmwareCancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelUpload());
        }

        // Settings inputs
        const packetSizeInput = document.getElementById('fwPacketSize');
        if (packetSizeInput) {
            packetSizeInput.addEventListener('change', (e) => {
                this.packetSize = parseInt(e.target.value) || 60;
            });
        }

        const packetDelayInput = document.getElementById('fwPacketDelay');
        if (packetDelayInput) {
            packetDelayInput.addEventListener('change', (e) => {
                this.packetDelay = parseInt(e.target.value) || 20;
            });
        }
    }

    /**
     * Handle file selection
     * @param {File} file - Selected file
     */
    async handleFileSelect(file) {
        if (!file) return;

        // Validate file extension
        const validExtensions = ['.bin', '.hex', '.fw'];
        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

        if (!validExtensions.includes(ext)) {
            this.showError('Invalid file type. Please select .bin, .hex, or .fw file.');
            return;
        }

        this.file = file;

        // Read file data
        const reader = new FileReader();
        reader.onload = (e) => {
            this.fileData = new Uint8Array(e.target.result);
            this.updateFileInfo();
        };
        reader.readAsArrayBuffer(file);
    }

    /**
     * Update file info display
     */
    updateFileInfo() {
        const nameEl = document.getElementById('fwFileName');
        const sizeEl = document.getElementById('fwFileSize');
        const startBtn = document.getElementById('firmwareStartBtn');

        if (nameEl) nameEl.textContent = this.file?.name || '-';
        if (sizeEl) sizeEl.textContent = this.fileData ? formatFileSize(this.fileData.length) : '-';
        if (startBtn) startBtn.disabled = !this.fileData;
    }

    /**
     * Start firmware upload
     */
    async startUpload() {
        if (!this.fileData || !this.comm) {
            this.showError('No file selected or not connected');
            return;
        }

        const slaveIdInput = document.getElementById('fwSlaveId');
        const slaveId = parseInt(slaveIdInput?.value) || 1;

        this.isUploading = true;
        this.isCancelled = false;
        this.progress = 0;
        this.currentStep = 0;

        this.updateUI(true);
        this.addLog('Starting firmware upload...', 'info');

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.FIRMWARE_STARTED, { slaveId, fileSize: this.fileData.length });
        }

        try {
            // Step 1: Init (0x90)
            this.currentStep = 1;
            this.addLog('Step 1: Initializing flash...', 'info');
            await this.stepInit(slaveId);

            if (this.isCancelled) throw new Error('Cancelled');

            // Step 2: Erase Confirm (0x91)
            this.currentStep = 2;
            this.addLog('Step 2: Waiting for flash erase...', 'info');
            await this.stepEraseConfirm(slaveId);

            if (this.isCancelled) throw new Error('Cancelled');

            // Step 3: Data Transfer (0x03)
            this.currentStep = 3;
            this.addLog('Step 3: Transferring data...', 'info');
            await this.stepDataTransfer(slaveId);

            if (this.isCancelled) throw new Error('Cancelled');

            // Step 4: Done (0x99)
            this.currentStep = 4;
            this.addLog('Step 4: Finalizing...', 'info');
            await this.stepDone(slaveId);

            this.addLog('Firmware upload completed successfully!', 'success');

            if (this.eventBus) {
                this.eventBus.emit(EVENTS.FIRMWARE_COMPLETE, { success: true });
            }

        } catch (error) {
            if (error.message === 'Cancelled') {
                this.addLog('Upload cancelled by user', 'warning');
                if (this.eventBus) {
                    this.eventBus.emit(EVENTS.FIRMWARE_CANCELLED);
                }
            } else {
                this.addLog(`Error: ${error.message}`, 'error');
                if (this.eventBus) {
                    this.eventBus.emit(EVENTS.FIRMWARE_ERROR, { error: error.message });
                }
            }
        } finally {
            this.isUploading = false;
            this.updateUI(false);
        }
    }

    /**
     * Step 1: Initialize (0x90)
     * @param {number} slaveId - Slave ID
     */
    async stepInit(slaveId) {
        const frame = this.modbus.buildFirmwareInit(slaveId, this.fileData.length);
        const result = await this.sendAndWait(frame);

        if (!result.success) {
            throw new Error('Init failed: ' + (result.error || 'No response'));
        }

        this.updateProgress(5);
        this.addLog(`Init OK - File size: ${this.fileData.length} bytes`, 'success');
    }

    /**
     * Step 2: Erase Confirm (0x91)
     * @param {number} slaveId - Slave ID
     */
    async stepEraseConfirm(slaveId) {
        const startTime = Date.now();
        let erased = false;

        while (!erased && Date.now() - startTime < this.eraseTimeout) {
            if (this.isCancelled) return;

            const frame = this.modbus.buildFirmwareEraseConfirm(slaveId);
            const result = await this.sendAndWait(frame);

            if (result.success) {
                const parsed = this.modbus.parseFirmwareResponse(result.frame);
                if (parsed.success && parsed.data?.eraseStatus === 0) {
                    erased = true;
                } else {
                    this.addLog('Flash erase in progress...', 'info');
                    await delay(200);
                }
            } else {
                await delay(200);
            }
        }

        if (!erased) {
            throw new Error('Flash erase timeout');
        }

        this.updateProgress(10);
        this.addLog('Flash erase completed', 'success');
    }

    /**
     * Step 3: Data Transfer (0x03)
     * @param {number} slaveId - Slave ID
     */
    async stepDataTransfer(slaveId) {
        const totalBytes = this.fileData.length;
        let sentBytes = 0;

        while (sentBytes < totalBytes) {
            if (this.isCancelled) return;

            const remaining = totalBytes - sentBytes;
            const chunkSize = Math.min(this.packetSize, remaining);
            const chunk = this.fileData.slice(sentBytes, sentBytes + chunkSize);

            const frame = this.modbus.buildFirmwareData(slaveId, chunk);
            const result = await this.sendAndWait(frame);

            if (!result.success) {
                throw new Error(`Data transfer failed at ${sentBytes}/${totalBytes}`);
            }

            sentBytes += chunkSize;

            // Update progress (10% to 95%)
            const dataProgress = 10 + (sentBytes / totalBytes) * 85;
            this.updateProgress(dataProgress);

            // Delay between packets
            if (this.packetDelay > 0) {
                await delay(this.packetDelay);
            }
        }

        this.addLog(`Data transfer completed: ${sentBytes} bytes sent`, 'success');
    }

    /**
     * Step 4: Done (0x99)
     * @param {number} slaveId - Slave ID
     */
    async stepDone(slaveId) {
        const frame = this.modbus.buildFirmwareDone(slaveId);
        const result = await this.sendAndWait(frame);

        if (!result.success) {
            throw new Error('Finalize failed: ' + (result.error || 'No response'));
        }

        this.updateProgress(100);
        this.addLog('Firmware update finalized', 'success');
    }

    /**
     * Send frame and wait for response
     * @param {Uint8Array} frame - Frame to send
     * @returns {Promise<Object>}
     */
    async sendAndWait(frame) {
        if (this.comm) {
            return await this.comm.sendAndWaitResponse(frame, this.responseTimeout);
        }
        return { success: false, error: 'Not connected' };
    }

    /**
     * Cancel upload
     */
    cancelUpload() {
        this.isCancelled = true;
    }

    /**
     * Update progress display
     * @param {number} percent - Progress percentage
     */
    updateProgress(percent) {
        this.progress = percent;

        const progressBar = document.getElementById('fwProgressBar');
        const progressText = document.getElementById('fwProgressText');

        if (progressBar) progressBar.style.width = percent + '%';
        if (progressText) progressText.textContent = percent.toFixed(0) + '%';

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.FIRMWARE_PROGRESS, {
                percent,
                step: this.currentStep
            });
        }
    }

    /**
     * Update UI state
     * @param {boolean} uploading - Is uploading
     */
    updateUI(uploading) {
        const startBtn = document.getElementById('firmwareStartBtn');
        const cancelBtn = document.getElementById('firmwareCancelBtn');
        const fileInput = document.getElementById('firmwareFile');

        if (startBtn) startBtn.disabled = uploading;
        if (cancelBtn) cancelBtn.disabled = !uploading;
        if (fileInput) fileInput.disabled = uploading;

        // Update step indicators
        for (let i = 1; i <= 4; i++) {
            const stepEl = document.getElementById(`fwStep${i}`);
            if (stepEl) {
                stepEl.classList.remove('active', 'completed');
                if (i < this.currentStep) {
                    stepEl.classList.add('completed');
                } else if (i === this.currentStep) {
                    stepEl.classList.add('active');
                }
            }
        }
    }

    /**
     * Add log entry
     * @param {string} message - Log message
     * @param {string} type - Log type: 'info', 'success', 'warning', 'error'
     */
    addLog(message, type = 'info') {
        const logContainer = document.getElementById('fwLogContainer');
        if (!logContainer) return;

        const entry = document.createElement('div');
        entry.className = `fw-log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.addLog(message, 'error');
        alert(message);
    }

    /**
     * Clear logs
     */
    clearLogs() {
        const logContainer = document.getElementById('fwLogContainer');
        if (logContainer) {
            logContainer.innerHTML = '';
        }
    }
}
