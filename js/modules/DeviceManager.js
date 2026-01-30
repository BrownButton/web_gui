/**
 * DeviceManager - 장치 관리
 *
 * Features:
 *   - 장치 목록 관리
 *   - 자동 폴링
 *   - 일괄 제어
 *   - 카드/리스트 뷰
 */

import { EVENTS } from '../core/EventBus.js';

export class DeviceManager {
    constructor(eventBus = null, communication = null) {
        this.eventBus = eventBus;
        this.comm = communication;

        // Device list
        this.devices = [];
        this.selectedDevices = new Set();

        // View settings
        this.viewMode = 'card'; // 'card' or 'list'

        // Polling state
        this.pollingEnabled = false;
        this.pollingInterval = 500;
        this.pollingTimer = null;
        this.currentPollingIndex = 0;

        // Status register address
        this.statusRegister = 0xD011;
        this.setpointRegister = 0xD001;
    }

    /**
     * Initialize device manager
     */
    init() {
        this.load();
        this.initUI();
    }

    /**
     * Initialize UI event listeners
     */
    initUI() {
        // Add device button
        const addBtn = document.getElementById('addDeviceBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddModal());
        }

        // Modal buttons
        const saveBtn = document.getElementById('saveDeviceBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveNewDevice());
        }

        const cancelBtn = document.getElementById('cancelDeviceBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideAddModal());
        }

        const closeBtn = document.getElementById('closeDeviceModalBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideAddModal());
        }

        // View mode toggle
        document.querySelectorAll('.view-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setViewMode(e.target.dataset.mode);
            });
        });

        // Select all button
        const selectAllBtn = document.getElementById('selectAllBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.selectAll());
        }

        // Deselect all button
        const deselectAllBtn = document.getElementById('deselectAllBtn');
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => this.deselectAll());
        }

        // Batch control buttons
        const batchApplyBtn = document.getElementById('batchApplyBtn');
        if (batchApplyBtn) {
            batchApplyBtn.addEventListener('click', () => this.applyBatchSetpoint());
        }

        const batchStopBtn = document.getElementById('batchStopBtn');
        if (batchStopBtn) {
            batchStopBtn.addEventListener('click', () => this.stopSelectedDevices());
        }

        // Auto polling toggle
        const pollingToggle = document.getElementById('autoPollingToggle');
        if (pollingToggle) {
            pollingToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.startPolling();
                } else {
                    this.stopPolling();
                }
            });
        }
    }

    /**
     * Load devices from localStorage
     */
    load() {
        const stored = localStorage.getItem('modbusDevices');
        if (stored) {
            try {
                this.devices = JSON.parse(stored);
                this.render();
            } catch (e) {
                console.error('Failed to load devices:', e);
            }
        }
    }

    /**
     * Save devices to localStorage
     */
    save() {
        localStorage.setItem('modbusDevices', JSON.stringify(this.devices));
    }

    /**
     * Get all devices
     * @returns {Array}
     */
    getAll() {
        return [...this.devices];
    }

    /**
     * Get device by ID
     * @param {string} id - Device ID
     * @returns {Object|null}
     */
    getById(id) {
        return this.devices.find(d => d.id === id) || null;
    }

    /**
     * Get device by slave ID
     * @param {number} slaveId - Slave ID
     * @returns {Object|null}
     */
    getBySlaveId(slaveId) {
        return this.devices.find(d => d.slaveId === slaveId) || null;
    }

    /**
     * Add device
     * @param {string} name - Device name
     * @param {number} slaveId - Slave ID
     * @returns {Object}
     */
    add(name, slaveId) {
        const device = {
            id: Date.now().toString(),
            name,
            slaveId,
            status: 'unknown',
            value: null,
            setpoint: null,
            lastUpdate: null,
            online: false
        };

        this.devices.push(device);
        this.save();
        this.render();

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.DEVICE_ADDED, device);
        }

        return device;
    }

    /**
     * Remove device
     * @param {string} id - Device ID
     */
    remove(id) {
        const device = this.getById(id);
        this.devices = this.devices.filter(d => d.id !== id);
        this.selectedDevices.delete(id);
        this.save();
        this.render();

        if (this.eventBus && device) {
            this.eventBus.emit(EVENTS.DEVICE_REMOVED, device);
        }
    }

    /**
     * Update device data
     * @param {string} id - Device ID
     * @param {Object} data - Data to update
     */
    update(id, data) {
        const device = this.getById(id);
        if (device) {
            Object.assign(device, data, { lastUpdate: new Date() });
            this.save();
            this.render();

            if (this.eventBus) {
                this.eventBus.emit(EVENTS.DEVICE_UPDATED, device);
            }
        }
    }

    /**
     * Set view mode
     * @param {string} mode - 'card' or 'list'
     */
    setViewMode(mode) {
        this.viewMode = mode;
        this.render();

        document.querySelectorAll('.view-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    /**
     * Select device
     * @param {string} id - Device ID
     */
    select(id) {
        this.selectedDevices.add(id);
        this.render();

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.DEVICE_SELECTED, { id });
        }
    }

    /**
     * Deselect device
     * @param {string} id - Device ID
     */
    deselect(id) {
        this.selectedDevices.delete(id);
        this.render();

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.DEVICE_DESELECTED, { id });
        }
    }

    /**
     * Toggle device selection
     * @param {string} id - Device ID
     */
    toggleSelection(id) {
        if (this.selectedDevices.has(id)) {
            this.deselect(id);
        } else {
            this.select(id);
        }
    }

    /**
     * Select all devices
     */
    selectAll() {
        this.devices.forEach(d => this.selectedDevices.add(d.id));
        this.render();
    }

    /**
     * Deselect all devices
     */
    deselectAll() {
        this.selectedDevices.clear();
        this.render();
    }

    /**
     * Get selected devices
     * @returns {Array}
     */
    getSelected() {
        return this.devices.filter(d => this.selectedDevices.has(d.id));
    }

    /**
     * Show add device modal
     */
    showAddModal() {
        const modal = document.getElementById('addDeviceModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    /**
     * Hide add device modal
     */
    hideAddModal() {
        const modal = document.getElementById('addDeviceModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Save new device from modal
     */
    saveNewDevice() {
        const nameInput = document.getElementById('deviceName');
        const slaveIdInput = document.getElementById('deviceSlaveId');

        const name = nameInput?.value.trim() || 'New Device';
        const slaveId = parseInt(slaveIdInput?.value) || 1;

        this.add(name, slaveId);
        this.hideAddModal();

        // Clear inputs
        if (nameInput) nameInput.value = '';
        if (slaveIdInput) slaveIdInput.value = '1';
    }

    /**
     * Render device grid
     */
    render() {
        const container = document.getElementById('deviceGrid');
        if (!container) return;

        if (this.devices.length === 0) {
            container.innerHTML = '<p class="placeholder">No devices added. Click "Add Device" or use "Auto Scan" to find devices.</p>';
            return;
        }

        container.className = `device-grid ${this.viewMode}-view`;

        container.innerHTML = this.devices.map(device => {
            const isSelected = this.selectedDevices.has(device.id);
            const statusClass = device.online ? 'online' : 'offline';

            if (this.viewMode === 'card') {
                return `
                    <div class="device-card ${statusClass} ${isSelected ? 'selected' : ''}" data-id="${device.id}">
                        <div class="device-header">
                            <input type="checkbox" class="device-checkbox" ${isSelected ? 'checked' : ''}>
                            <span class="device-name">${device.name}</span>
                            <span class="device-id">ID: ${device.slaveId}</span>
                        </div>
                        <div class="device-body">
                            <div class="device-value">${device.value ?? '-'}</div>
                            <div class="device-status">${device.online ? 'Online' : 'Offline'}</div>
                        </div>
                        <div class="device-actions">
                            <button class="btn btn-sm read-btn" data-id="${device.id}">Read</button>
                            <button class="btn btn-sm btn-danger remove-btn" data-id="${device.id}">Remove</button>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="device-row ${statusClass} ${isSelected ? 'selected' : ''}" data-id="${device.id}">
                        <input type="checkbox" class="device-checkbox" ${isSelected ? 'checked' : ''}>
                        <span class="device-id">ID: ${device.slaveId}</span>
                        <span class="device-name">${device.name}</span>
                        <span class="device-value">${device.value ?? '-'}</span>
                        <span class="device-status">${device.online ? 'Online' : 'Offline'}</span>
                        <button class="btn btn-sm read-btn" data-id="${device.id}">Read</button>
                        <button class="btn btn-sm btn-danger remove-btn" data-id="${device.id}">Remove</button>
                    </div>
                `;
            }
        }).join('');

        // Add event listeners
        container.querySelectorAll('.device-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const card = e.target.closest('[data-id]');
                if (card) {
                    this.toggleSelection(card.dataset.id);
                }
            });
        });

        container.querySelectorAll('.read-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.readDevice(btn.dataset.id);
            });
        });

        container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Remove this device?')) {
                    this.remove(btn.dataset.id);
                }
            });
        });
    }

    /**
     * Start auto polling
     */
    startPolling() {
        if (this.pollingTimer) return;

        this.pollingEnabled = true;
        this.currentPollingIndex = 0;

        this.pollingTimer = setInterval(() => {
            this.pollNextDevice();
        }, this.pollingInterval);

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.POLLING_STARTED);
        }
    }

    /**
     * Stop auto polling
     */
    stopPolling() {
        this.pollingEnabled = false;

        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.POLLING_STOPPED);
        }
    }

    /**
     * Poll next device in queue
     */
    async pollNextDevice() {
        if (!this.comm || this.devices.length === 0) return;

        const device = this.devices[this.currentPollingIndex];
        this.currentPollingIndex = (this.currentPollingIndex + 1) % this.devices.length;

        await this.readDevice(device.id);

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.POLLING_TICK, { device });
        }
    }

    /**
     * Read device status
     * @param {string} id - Device ID
     */
    async readDevice(id) {
        const device = this.getById(id);
        if (!device || !this.comm) return;

        try {
            const result = await this.comm.readHoldingRegisters(device.slaveId, this.statusRegister, 1);

            if (result.success && result.parsed?.data?.length > 0) {
                this.update(id, {
                    value: result.parsed.data[0],
                    online: true
                });
            } else {
                this.update(id, { online: false });
            }
        } catch (e) {
            this.update(id, { online: false });
        }
    }

    /**
     * Apply setpoint to device
     * @param {string} id - Device ID
     * @param {number} setpoint - Setpoint value
     */
    async applySetpoint(id, setpoint) {
        const device = this.getById(id);
        if (!device || !this.comm) return;

        try {
            const result = await this.comm.writeSingleRegister(device.slaveId, this.setpointRegister, setpoint);

            if (result.success) {
                this.update(id, { setpoint });
            }
        } catch (e) {
            console.error('Apply setpoint error:', e);
        }
    }

    /**
     * Apply batch setpoint to selected devices
     */
    async applyBatchSetpoint() {
        const setpointInput = document.getElementById('batchSetpoint');
        if (!setpointInput) return;

        const setpoint = parseInt(setpointInput.value) || 0;
        const selected = this.getSelected();

        for (const device of selected) {
            await this.applySetpoint(device.id, setpoint);
        }
    }

    /**
     * Stop selected devices (set setpoint to 0)
     */
    async stopSelectedDevices() {
        const selected = this.getSelected();

        for (const device of selected) {
            await this.applySetpoint(device.id, 0);
        }
    }

    /**
     * Set polling interval
     * @param {number} ms - Interval in milliseconds
     */
    setPollingInterval(ms) {
        this.pollingInterval = ms;

        if (this.pollingEnabled) {
            this.stopPolling();
            this.startPolling();
        }
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        this.stopPolling();
    }
}
