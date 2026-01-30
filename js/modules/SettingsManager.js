/**
 * SettingsManager - 설정 관리
 *
 * Features:
 *   - 설정 로드/저장 (localStorage)
 *   - 설정 모달 UI 관리
 *   - 시리얼 설정 동기화
 */

import { EVENTS } from '../core/EventBus.js';

export class SettingsManager {
    constructor(eventBus = null) {
        this.eventBus = eventBus;

        // Default settings
        this.settings = {
            // Statistics
            baseFrameCount: 1000,

            // Auto scan
            autoScanEnabled: false,
            scanRangeStart: 1,
            scanRangeEnd: 10,
            scanTimeout: 200,
            scanRegister: 0xD011,

            // Monitor
            monitorPanelOpen: false,
            monitorPanelWidth: 400,
            displayFormat: 'hex',

            // Serial
            baudRate: 9600,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,

            // Simulator
            simulatorEnabled: false,
            simulatorSlaveId: 1,
            simulatorDelay: 50,

            // Auto polling
            autoPollingEnabled: false,
            autoPollingInterval: 500
        };
    }

    /**
     * Initialize settings modal UI
     */
    initModal() {
        const settingsModal = document.getElementById('settingsModal');
        const openSettingsBtn = document.getElementById('openSettingsBtn');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');

        if (!settingsModal) return;

        // Open settings modal
        if (openSettingsBtn) {
            openSettingsBtn.addEventListener('click', () => {
                this.openModal();
            });
        }

        // Close settings modal
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        // Close on outside click
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                this.closeModal();
            }
        });

        // Settings menu navigation
        document.querySelectorAll('.settings-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const setting = item.dataset.setting;
                this.switchPanel(setting);

                // Update active state
                document.querySelectorAll('.settings-menu-item').forEach(mi => mi.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // Base frame count
        const baseFrameCountEl = document.getElementById('modal-baseFrameCount');
        if (baseFrameCountEl) {
            baseFrameCountEl.addEventListener('change', (e) => {
                this.settings.baseFrameCount = parseInt(e.target.value);
                this.save();
                this.emitChange('baseFrameCount', this.settings.baseFrameCount);
            });
        }
    }

    /**
     * Open settings modal
     */
    openModal() {
        const modal = document.getElementById('settingsModal');
        if (!modal) return;

        modal.classList.add('active');

        // Sync values to modal
        this.syncToModal();

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.SETTINGS_CHANGED, { modalOpened: true });
        }
    }

    /**
     * Close settings modal
     */
    closeModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Switch between settings panels in modal
     * @param {string} panelName - Panel name
     */
    switchPanel(panelName) {
        document.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        const panel = document.getElementById(`settings-${panelName}`);
        if (panel) {
            panel.classList.add('active');
        }
    }

    /**
     * Sync settings values to modal UI
     */
    syncToModal() {
        const elements = {
            'modal-baseFrameCount': this.settings.baseFrameCount,
            'modal-simSlaveId': this.settings.simulatorSlaveId,
            'modal-simDelay': this.settings.simulatorDelay
        };

        for (const [id, value] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.value = value;
        }
    }

    /**
     * Get a setting value
     * @param {string} key - Setting key
     * @returns {*} Setting value
     */
    get(key) {
        return this.settings[key];
    }

    /**
     * Set a setting value
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    set(key, value) {
        this.settings[key] = value;
        this.save();
        this.emitChange(key, value);
    }

    /**
     * Get all settings
     * @returns {Object} All settings
     */
    getAll() {
        return { ...this.settings };
    }

    /**
     * Update multiple settings
     * @param {Object} settings - Settings to update
     */
    update(settings) {
        Object.assign(this.settings, settings);
        this.save();

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.SETTINGS_CHANGED, settings);
        }
    }

    /**
     * Emit setting change event
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    emitChange(key, value) {
        if (this.eventBus) {
            this.eventBus.emit(EVENTS.SETTINGS_CHANGED, { [key]: value });
        }
    }

    /**
     * Load settings from localStorage
     */
    load() {
        const stored = localStorage.getItem('modbusSettings');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                Object.assign(this.settings, data);
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        }

        // Sync to UI
        this.syncToUI();

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.SETTINGS_LOADED, this.settings);
        }
    }

    /**
     * Save settings to localStorage
     */
    save() {
        try {
            localStorage.setItem('modbusSettings', JSON.stringify(this.settings));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
    }

    /**
     * Sync settings to UI elements
     */
    syncToUI() {
        // Base frame count
        const baseFrameCountEl = document.getElementById('baseFrameCount');
        if (baseFrameCountEl) {
            baseFrameCountEl.value = this.settings.baseFrameCount;
        }

        // Auto scan settings
        const autoScanToggle = document.getElementById('autoScanEnabled');
        const autoScanStatus = document.getElementById('autoScanStatus');
        if (autoScanToggle) {
            autoScanToggle.checked = this.settings.autoScanEnabled;
            if (autoScanStatus) {
                autoScanStatus.textContent = this.settings.autoScanEnabled ? '활성' : '비활성';
                autoScanStatus.classList.toggle('active', this.settings.autoScanEnabled);
            }
        }

        const scanRangeStart = document.getElementById('scanRangeStart');
        const scanRangeEnd = document.getElementById('scanRangeEnd');
        const scanTimeout = document.getElementById('scanTimeout');
        const scanRegister = document.getElementById('scanRegister');

        if (scanRangeStart) scanRangeStart.value = this.settings.scanRangeStart;
        if (scanRangeEnd) scanRangeEnd.value = this.settings.scanRangeEnd;
        if (scanTimeout) scanTimeout.value = this.settings.scanTimeout;
        if (scanRegister) {
            scanRegister.value = '0x' + this.settings.scanRegister.toString(16).toUpperCase();
        }

        // Serial settings
        this.syncSerialSettings();
    }

    /**
     * Sync serial settings to sidebar UI
     */
    syncSerialSettings() {
        const elements = {
            'sidebar-baudRate': this.settings.baudRate,
            'sidebar-dataBits': this.settings.dataBits,
            'sidebar-parity': this.settings.parity,
            'sidebar-stopBits': this.settings.stopBits
        };

        for (const [id, value] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.value = value;
        }
    }

    /**
     * Load serial settings from sidebar UI
     */
    loadSerialSettings() {
        const baudRateEl = document.getElementById('sidebar-baudRate');
        const dataBitsEl = document.getElementById('sidebar-dataBits');
        const parityEl = document.getElementById('sidebar-parity');
        const stopBitsEl = document.getElementById('sidebar-stopBits');

        if (baudRateEl) this.settings.baudRate = parseInt(baudRateEl.value) || 9600;
        if (dataBitsEl) this.settings.dataBits = parseInt(dataBitsEl.value) || 8;
        if (parityEl) this.settings.parity = parityEl.value || 'none';
        if (stopBitsEl) this.settings.stopBits = parseInt(stopBitsEl.value) || 1;
    }

    /**
     * Get serial port options
     * @returns {Object} Serial port options
     */
    getSerialOptions() {
        return {
            baudRate: this.settings.baudRate,
            dataBits: this.settings.dataBits,
            parity: this.settings.parity,
            stopBits: this.settings.stopBits
        };
    }

    /**
     * Reset settings to defaults
     */
    reset() {
        this.settings = {
            baseFrameCount: 1000,
            autoScanEnabled: false,
            scanRangeStart: 1,
            scanRangeEnd: 10,
            scanTimeout: 200,
            scanRegister: 0xD011,
            monitorPanelOpen: false,
            monitorPanelWidth: 400,
            displayFormat: 'hex',
            baudRate: 9600,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            simulatorEnabled: false,
            simulatorSlaveId: 1,
            simulatorDelay: 50,
            autoPollingEnabled: false,
            autoPollingInterval: 500
        };

        this.save();
        this.syncToUI();

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.SETTINGS_CHANGED, this.settings);
        }
    }
}
