/**
 * Modbus RTU/RS-485 Dashboard Application
 * Modular Architecture Version
 *
 * 이 파일은 모든 모듈을 조합하고 초기화하는 메인 진입점입니다.
 */

// Core imports
import { EventBus, EVENTS, eventBus } from './core/EventBus.js';
import { ModbusRTU } from './core/ModbusProtocol.js';

// Module imports
import { ChartManager } from './modules/ChartManager.js';
import { CommunicationLayer } from './modules/CommunicationLayer.js';
import { MonitorModule } from './modules/MonitorModule.js';
import { StatisticsManager } from './modules/StatisticsManager.js';
import { SettingsManager } from './modules/SettingsManager.js';
import { ParameterManager } from './modules/ParameterManager.js';
import { DeviceManager } from './modules/DeviceManager.js';
import { FirmwareManager } from './modules/FirmwareManager.js';
import { AutoScanModule } from './modules/AutoScanModule.js';

// Simulator import
import { ModbusSimulator } from './simulator.js';

/**
 * ModbusDashboard - 메인 애플리케이션 클래스
 *
 * 모든 모듈을 조합하고 초기화를 관리합니다.
 * 기존 app.js의 기능을 모듈화된 형태로 유지합니다.
 */
class ModbusDashboard {
    constructor() {
        // Core instances
        this.eventBus = eventBus;
        this.modbus = new ModbusRTU();
        this.simulator = new ModbusSimulator();

        // Module instances
        this.communication = new CommunicationLayer(this.eventBus, this.modbus, this.simulator);
        this.monitor = new MonitorModule(this.eventBus);
        this.statistics = new StatisticsManager(this.eventBus);
        this.settings = new SettingsManager(this.eventBus);
        this.parameters = new ParameterManager(this.eventBus, this.communication);
        this.devices = new DeviceManager(this.eventBus, this.communication);
        this.firmware = new FirmwareManager(this.eventBus, this.communication, this.modbus);
        this.autoScan = new AutoScanModule(this.eventBus, this.communication, this.devices);
        this.chart = null; // Lazy initialization

        // UI state
        this.currentPage = 'dashboard';
        this.simulatorEnabled = false;
    }

    /**
     * Initialize application
     */
    async init() {
        console.log('Initializing Modbus Dashboard (Modular)...');

        // Load settings first
        this.settings.load();

        // Initialize modules
        this.monitor.init();
        this.monitor.load();
        this.statistics.initNavbarStatsTooltip();
        this.settings.initModal();
        this.parameters.init();
        this.devices.init();
        this.firmware.init();
        this.autoScan.init();

        // Initialize UI
        this.initializeUI();
        this.initializeNavigation();
        this.initializeSerialControls();
        this.initializeSimulator();
        this.initializeModbusPage();

        // Setup event subscriptions
        this.setupEventSubscriptions();

        // Set initial page
        this.switchPage('dashboard');

        console.log('Modbus Dashboard initialized successfully');
    }

    /**
     * Setup event subscriptions
     */
    setupEventSubscriptions() {
        // Connection events
        this.eventBus.on(EVENTS.SERIAL_CONNECTED, () => {
            this.updateConnectionStatus(true);
            this.showToast('시리얼 포트 연결됨', 'success');

            // Start auto polling if enabled
            if (this.settings.get('autoPollingEnabled')) {
                this.devices.startPolling();
            }
        });

        this.eventBus.on(EVENTS.SERIAL_DISCONNECTED, () => {
            this.updateConnectionStatus(false);
            this.showToast('시리얼 포트 연결 해제됨', 'info');
            this.devices.stopPolling();
        });

        this.eventBus.on(EVENTS.SERIAL_ERROR, (data) => {
            this.showToast(`통신 오류: ${data.error}`, 'error');
        });

        // Frame events for statistics
        this.eventBus.on(EVENTS.FRAME_RECEIVED, (data) => {
            this.statistics.recordRequest(true, data.slaveId);
        });

        this.eventBus.on(EVENTS.FRAME_ERROR, (data) => {
            this.statistics.recordRequest(false, data?.slaveId);
        });

        this.eventBus.on(EVENTS.FRAME_TIMEOUT, (data) => {
            this.statistics.recordRequest(false, data?.slaveId);
        });

        // Settings changes
        this.eventBus.on(EVENTS.SETTINGS_CHANGED, (data) => {
            if (data.baseFrameCount !== undefined) {
                this.statistics.setBaseFrameCount(data.baseFrameCount);
            }
        });

        // Simulator events
        this.eventBus.on(EVENTS.SIMULATOR_ENABLED, () => {
            this.simulatorEnabled = true;
            this.updateConnectionStatus(true);
        });

        this.eventBus.on(EVENTS.SIMULATOR_DISABLED, () => {
            this.simulatorEnabled = false;
            if (!this.communication.isConnected()) {
                this.updateConnectionStatus(false);
            }
        });
    }

    /**
     * Initialize UI components
     */
    initializeUI() {
        // Toast container
        if (!document.getElementById('toastContainer')) {
            const container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        // Close modals on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });
            }
        });

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    /**
     * Initialize navigation
     */
    initializeNavigation() {
        // Menu items
        document.querySelectorAll('.menu-item[data-page]').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.switchPage(page);
            });
        });

        // Expandable menu items
        document.querySelectorAll('.menu-item-expandable .menu-item-header').forEach(header => {
            header.addEventListener('click', () => {
                const parent = header.closest('.menu-item-expandable');
                if (parent) {
                    parent.classList.toggle('expanded');
                }
            });
        });

        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                document.querySelector('.sidebar')?.classList.toggle('collapsed');
                document.querySelector('.main-content')?.classList.toggle('sidebar-collapsed');
            });
        }
    }

    /**
     * Switch to page
     * @param {string} page - Page name
     */
    switchPage(page) {
        this.currentPage = page;

        // Update menu items
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Update page content
        document.querySelectorAll('.page-content').forEach(content => {
            content.classList.toggle('active', content.id === `page-${page}`);
        });

        // Initialize chart if switching to chart page
        if (page === 'chart' && !this.chart) {
            this.initializeChart();
        }

        this.eventBus.emit(EVENTS.PAGE_CHANGED, { page });
    }

    /**
     * Initialize serial controls
     */
    initializeSerialControls() {
        const connectBtn = document.getElementById('sidebar-connectBtn');
        const disconnectBtn = document.getElementById('sidebar-disconnectBtn');

        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connect());
        }

        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => this.disconnect());
        }

        // Load saved serial settings
        this.loadSerialSettings();
    }

    /**
     * Load serial settings from localStorage
     */
    loadSerialSettings() {
        const saved = localStorage.getItem('serialSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                const baudRate = document.getElementById('sidebar-baudRate');
                const dataBits = document.getElementById('sidebar-dataBits');
                const parity = document.getElementById('sidebar-parity');
                const stopBits = document.getElementById('sidebar-stopBits');

                if (baudRate && settings.baudRate) baudRate.value = settings.baudRate;
                if (dataBits && settings.dataBits) dataBits.value = settings.dataBits;
                if (parity && settings.parity) parity.value = settings.parity;
                if (stopBits && settings.stopBits) stopBits.value = settings.stopBits;
            } catch (e) {
                console.error('Failed to load serial settings:', e);
            }
        }
    }

    /**
     * Connect to serial port
     */
    async connect() {
        const baudRate = parseInt(document.getElementById('sidebar-baudRate')?.value) || 9600;
        const dataBits = parseInt(document.getElementById('sidebar-dataBits')?.value) || 8;
        const parity = document.getElementById('sidebar-parity')?.value || 'none';
        const stopBits = parseInt(document.getElementById('sidebar-stopBits')?.value) || 1;

        const options = { baudRate, dataBits, parity, stopBits };

        const success = await this.communication.connect(options);

        if (success) {
            localStorage.setItem('serialSettings', JSON.stringify(options));
        }
    }

    /**
     * Disconnect from serial port
     */
    async disconnect() {
        await this.communication.disconnect();
    }

    /**
     * Initialize simulator controls
     */
    initializeSimulator() {
        const simToggleBtn = document.getElementById('simToggleBtn');
        const simResetBtn = document.getElementById('simResetBtn');
        const simSlaveIdInput = document.getElementById('simSlaveId');
        const simDelayInput = document.getElementById('simDelay');

        if (simToggleBtn) {
            simToggleBtn.addEventListener('click', () => this.toggleSimulator());
        }

        if (simResetBtn) {
            simResetBtn.addEventListener('click', () => this.resetSimulator());
        }

        if (simSlaveIdInput) {
            simSlaveIdInput.addEventListener('change', (e) => {
                this.simulator.slaveId = parseInt(e.target.value) || 1;
            });
        }

        if (simDelayInput) {
            simDelayInput.addEventListener('change', (e) => {
                this.simulator.responseDelay = parseInt(e.target.value) || 50;
            });
        }
    }

    /**
     * Toggle simulator
     */
    toggleSimulator() {
        this.simulatorEnabled = !this.simulatorEnabled;
        this.communication.setSimulatorEnabled(this.simulatorEnabled);
        this.updateSimulatorDisplay();

        if (this.simulatorEnabled) {
            this.showToast('시뮬레이터 활성화됨', 'success');
        } else {
            this.showToast('시뮬레이터 비활성화됨', 'info');
        }
    }

    /**
     * Reset simulator
     */
    resetSimulator() {
        this.simulator.reset();
        this.showToast('시뮬레이터 초기화됨', 'info');
    }

    /**
     * Update simulator display
     */
    updateSimulatorDisplay() {
        const btn = document.getElementById('simToggleBtn');
        const status = document.getElementById('simStatus');

        if (btn) {
            btn.textContent = this.simulatorEnabled ? 'Deactivate' : 'Activate';
            btn.classList.toggle('btn-warning', this.simulatorEnabled);
            btn.classList.toggle('btn-success', !this.simulatorEnabled);
        }

        if (status) {
            status.textContent = this.simulatorEnabled ? '활성' : '비활성';
            status.style.color = this.simulatorEnabled ? '#28a745' : '#6c757d';
        }
    }

    /**
     * Initialize Modbus test page
     */
    initializeModbusPage() {
        const sendBtn = document.getElementById('sendBtn');
        const functionCodeSelect = document.getElementById('functionCode');

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendModbusRequest());
        }

        if (functionCodeSelect) {
            functionCodeSelect.addEventListener('change', (e) => {
                this.updateWriteValueVisibility(parseInt(e.target.value));
            });
        }
    }

    /**
     * Send Modbus request from test page
     */
    async sendModbusRequest() {
        const slaveId = parseInt(document.getElementById('slaveId')?.value) || 1;
        const functionCode = parseInt(document.getElementById('functionCode')?.value) || 3;
        const startAddress = parseInt(document.getElementById('startAddress')?.value) || 0;
        const quantity = parseInt(document.getElementById('quantity')?.value) || 1;
        const writeValue = parseInt(document.getElementById('writeValue')?.value) || 0;

        try {
            const result = await this.communication.sendModbusRequest(
                slaveId, functionCode, startAddress, quantity, writeValue
            );

            if (result.success && result.parsed) {
                this.displayModbusResponse(result.parsed);
            }
        } catch (error) {
            this.showToast(`요청 실패: ${error.message}`, 'error');
        }
    }

    /**
     * Display Modbus response
     * @param {Object} response - Parsed response
     */
    displayModbusResponse(response) {
        const responseArea = document.getElementById('responseArea');
        if (!responseArea) return;

        let html = '<div class="response-data">';
        html += `<div><strong>Slave ID:</strong> ${response.slaveId}</div>`;
        html += `<div><strong>Function:</strong> ${response.functionCode}</div>`;

        if (response.data && response.data.length > 0) {
            html += `<div><strong>Data:</strong></div>`;
            html += '<div class="data-values">';
            response.data.forEach((value, i) => {
                html += `<span class="data-value">[${i}] ${value}</span>`;
            });
            html += '</div>';
        }

        html += '</div>';
        responseArea.innerHTML = html;
    }

    /**
     * Update write value visibility based on function code
     * @param {number} functionCode - Function code
     */
    updateWriteValueVisibility(functionCode) {
        const writeValueGroup = document.getElementById('writeValueGroup');
        const quantityGroup = document.getElementById('quantity')?.parentElement;

        if (writeValueGroup) {
            const isWrite = [5, 6, 15, 16].includes(functionCode);
            writeValueGroup.style.display = isWrite ? 'flex' : 'none';
        }

        if (quantityGroup) {
            const hideQuantity = [5, 6].includes(functionCode);
            quantityGroup.style.display = hideQuantity ? 'none' : 'flex';
        }
    }

    /**
     * Initialize chart
     */
    initializeChart() {
        const canvas = document.getElementById('chartCanvas');
        if (!canvas) return;

        this.chart = new ChartManager('chartCanvas', this.eventBus);

        // Chart controls
        const startBtn = document.getElementById('chartStartBtn');
        const stopBtn = document.getElementById('chartStopBtn');
        const clearBtn = document.getElementById('chartClearBtn');

        if (startBtn) {
            startBtn.addEventListener('click', () => this.startChart());
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopChart());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.chart.clearData());
        }

        // Channel controls
        for (let i = 1; i <= 4; i++) {
            const enabledCheckbox = document.getElementById(`chartCh${i}Enabled`);
            const addressInput = document.getElementById(`chartCh${i}Address`);

            if (enabledCheckbox) {
                enabledCheckbox.addEventListener('change', (e) => {
                    this.chart.setChannelEnabled(i - 1, e.target.checked);
                });
            }

            if (addressInput) {
                addressInput.addEventListener('change', (e) => {
                    const value = e.target.value.trim();
                    const address = value.startsWith('0x')
                        ? parseInt(value, 16)
                        : parseInt(value);
                    this.chart.setChannelAddress(i - 1, address);
                });
            }
        }

        // Export buttons
        const exportCsvBtn = document.getElementById('chartExportCsvBtn');
        const exportPngBtn = document.getElementById('chartExportPngBtn');

        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => this.chart.exportToCSV());
        }

        if (exportPngBtn) {
            exportPngBtn.addEventListener('click', () => this.chart.exportToPNG());
        }
    }

    /**
     * Start chart data collection
     */
    startChart() {
        if (!this.chart) return;

        this.chart.startCapture();
        this.chartPollingTimer = setInterval(() => this.pollChartData(), this.chart.sampleRate);
    }

    /**
     * Stop chart data collection
     */
    stopChart() {
        if (!this.chart) return;

        this.chart.stopCapture();

        if (this.chartPollingTimer) {
            clearInterval(this.chartPollingTimer);
            this.chartPollingTimer = null;
        }
    }

    /**
     * Poll chart data from devices
     */
    async pollChartData() {
        if (!this.chart || !this.chart.isRunning) return;

        const timestamp = Date.now();

        for (let i = 0; i < 4; i++) {
            const channel = this.chart.channels[i];
            if (!channel.enabled || channel.address === 0) continue;

            try {
                const slaveId = 1; // Default slave ID for chart
                const result = await this.communication.readHoldingRegisters(slaveId, channel.address, 1);

                if (result.success && result.parsed?.data?.length > 0) {
                    this.chart.addDataPoint(i, result.parsed.data[0], timestamp);
                }
            } catch (e) {
                // Ignore errors during chart polling
            }
        }
    }

    /**
     * Update connection status UI
     * @param {boolean} connected - Connection status
     */
    updateConnectionStatus(connected) {
        const indicator = document.getElementById('navbar-status-indicator');
        const text = document.getElementById('navbar-status-text');
        const connectBtn = document.getElementById('sidebar-connectBtn');
        const disconnectBtn = document.getElementById('sidebar-disconnectBtn');
        const sendBtn = document.getElementById('sendBtn');

        if (indicator) {
            indicator.className = `navbar-status-indicator ${connected ? 'status-connected' : 'status-disconnected'}`;
        }

        if (text) {
            text.textContent = connected ? 'Connected' : 'Disconnected';
        }

        if (connectBtn) connectBtn.disabled = connected;
        if (disconnectBtn) disconnectBtn.disabled = !connected;
        if (sendBtn) sendBtn.disabled = !connected;
    }

    /**
     * Show toast notification
     * @param {string} message - Message
     * @param {string} type - Type: 'success', 'error', 'warning', 'info'
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new ModbusDashboard();
    window.dashboard.init();
});

// Export for external access
export { ModbusDashboard };
