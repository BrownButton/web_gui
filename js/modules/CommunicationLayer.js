/**
 * CommunicationLayer - 시리얼 통신 관리
 *
 * Features:
 *   - Web Serial API 통신
 *   - 연결/해제 관리
 *   - Modbus 프레임 송수신
 *   - 응답 대기 (타임아웃)
 *   - 시뮬레이터 통합
 */

import { EVENTS } from '../core/EventBus.js';
import { delay } from '../utils/helpers.js';

export class CommunicationLayer {
    constructor(eventBus, modbus, simulator = null) {
        this.eventBus = eventBus;
        this.modbus = modbus;
        this.simulator = simulator;

        // Serial port state
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.readInProgress = false;

        // Receive buffer
        this.receiveBuffer = new Uint8Array(256);
        this.receiveIndex = 0;

        // Pending response handling
        this.pendingResponse = null;
        this.responseResolver = null;
        this.responseTimeout = null;

        // Simulator mode
        this.simulatorEnabled = false;

        // Default settings
        this.settings = {
            baudRate: 9600,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            frameTimeout: 50,
            responseTimeout: 1000
        };
    }

    /**
     * Check if connected
     * @returns {boolean}
     */
    isConnected() {
        return this.port !== null || this.simulatorEnabled;
    }

    /**
     * Set serial settings
     * @param {Object} settings - Serial settings
     */
    setSettings(settings) {
        Object.assign(this.settings, settings);
    }

    /**
     * Enable/disable simulator mode
     * @param {boolean} enabled - Enable simulator
     */
    setSimulatorEnabled(enabled) {
        this.simulatorEnabled = enabled;
        if (this.simulator) {
            this.simulator.enabled = enabled;
        }

        if (this.eventBus) {
            this.eventBus.emit(enabled ? EVENTS.SIMULATOR_ENABLED : EVENTS.SIMULATOR_DISABLED);
        }
    }

    /**
     * Connect to serial port
     * @param {Object} options - Serial options (baudRate, dataBits, parity, stopBits)
     * @returns {Promise<boolean>}
     */
    async connect(options = {}) {
        try {
            const settings = { ...this.settings, ...options };

            this.port = await navigator.serial.requestPort();

            const serialOptions = {
                baudRate: settings.baudRate,
                dataBits: settings.dataBits,
                parity: settings.parity,
                stopBits: settings.stopBits,
                flowControl: 'none'
            };

            console.log('Opening port with options:', serialOptions);

            await this.port.open(serialOptions);

            this.writer = this.port.writable.getWriter();
            this.startReading();

            // Emit event
            if (this.eventBus) {
                this.eventBus.emit(EVENTS.SERIAL_CONNECTED, {
                    settings: serialOptions
                });
            }

            return true;

        } catch (error) {
            console.error('Connection error:', error);

            if (this.eventBus) {
                this.eventBus.emit(EVENTS.SERIAL_ERROR, {
                    error: error.message,
                    type: 'connection'
                });
            }

            return false;
        }
    }

    /**
     * Disconnect from serial port
     * @returns {Promise<boolean>}
     */
    async disconnect() {
        try {
            this.readInProgress = false;

            if (this.reader) {
                await this.reader.cancel();
                this.reader.releaseLock();
                this.reader = null;
            }

            if (this.writer) {
                this.writer.releaseLock();
                this.writer = null;
            }

            if (this.port) {
                await this.port.close();
                this.port = null;
            }

            // Clear pending response
            this.clearPendingResponse();

            // Emit event
            if (this.eventBus) {
                this.eventBus.emit(EVENTS.SERIAL_DISCONNECTED);
            }

            return true;

        } catch (error) {
            console.error('Disconnect error:', error);

            if (this.eventBus) {
                this.eventBus.emit(EVENTS.SERIAL_ERROR, {
                    error: error.message,
                    type: 'disconnect'
                });
            }

            return false;
        }
    }

    /**
     * Start reading from serial port
     */
    async startReading() {
        this.readInProgress = true;
        this.reader = this.port.readable.getReader();

        try {
            while (this.readInProgress && this.port?.readable) {
                const { value, done } = await this.reader.read();

                if (done) break;
                if (value) this.handleReceivedData(value);
            }
        } catch (error) {
            if (this.readInProgress) {
                console.error('Read error:', error);

                if (this.eventBus) {
                    this.eventBus.emit(EVENTS.SERIAL_ERROR, {
                        error: error.message,
                        type: 'read'
                    });
                }
            }
        } finally {
            if (this.reader) {
                this.reader.releaseLock();
            }
        }
    }

    /**
     * Handle received data from serial port
     * @param {Uint8Array} data - Received data
     */
    handleReceivedData(data) {
        for (let i = 0; i < data.length && this.receiveIndex < this.receiveBuffer.length; i++) {
            this.receiveBuffer[this.receiveIndex++] = data[i];
        }
        this.tryParseFrame();
    }

    /**
     * Try to parse complete Modbus frame from buffer
     */
    tryParseFrame() {
        if (this.receiveIndex < 5) return;

        setTimeout(() => {
            if (this.receiveIndex > 0) {
                const frame = this.receiveBuffer.slice(0, this.receiveIndex);
                this.receiveIndex = 0;

                this.handleReceivedFrame(frame);
            }
        }, this.settings.frameTimeout);
    }

    /**
     * Handle received frame
     * @param {Uint8Array} frame - Received frame
     */
    handleReceivedFrame(frame) {
        try {
            // Verify CRC
            if (!this.modbus.verifyCRC(frame)) {
                throw new Error('Invalid CRC');
            }

            const response = this.modbus.parseResponse(frame);

            // Emit event
            if (this.eventBus) {
                this.eventBus.emit(EVENTS.FRAME_RECEIVED, {
                    frame: frame,
                    parsed: response,
                    slaveId: response.slaveId
                });
            }

            // Resolve pending response
            if (this.responseResolver) {
                this.responseResolver({ success: true, frame, parsed: response });
                this.clearPendingResponse();
            }

        } catch (error) {
            // Emit error event
            if (this.eventBus) {
                this.eventBus.emit(EVENTS.FRAME_ERROR, {
                    frame: frame,
                    error: error.message
                });
            }

            // Reject pending response
            if (this.responseResolver) {
                this.responseResolver({ success: false, frame, error: error.message });
                this.clearPendingResponse();
            }
        }
    }

    /**
     * Send frame and wait for response
     * @param {Uint8Array} frame - Frame to send
     * @param {number} timeout - Response timeout in ms
     * @returns {Promise<Object>}
     */
    async sendAndWaitResponse(frame, timeout = null) {
        const timeoutMs = timeout || this.settings.responseTimeout;

        // Check for simulator mode
        if (this.simulatorEnabled && this.simulator) {
            return this.sendToSimulator(frame);
        }

        // Check connection
        if (!this.writer) {
            throw new Error('Not connected');
        }

        return new Promise(async (resolve, reject) => {
            try {
                // Clear any pending response
                this.clearPendingResponse();

                // Set up response waiting
                this.pendingResponse = true;
                this.responseResolver = resolve;

                // Set timeout
                this.responseTimeout = setTimeout(() => {
                    if (this.eventBus) {
                        this.eventBus.emit(EVENTS.FRAME_TIMEOUT, { frame });
                    }
                    resolve({ success: false, error: 'Response timeout' });
                    this.clearPendingResponse();
                }, timeoutMs);

                // Send frame
                await this.writer.write(frame);

                // Emit sent event
                if (this.eventBus) {
                    this.eventBus.emit(EVENTS.FRAME_SENT, { frame });
                }

            } catch (error) {
                if (this.eventBus) {
                    this.eventBus.emit(EVENTS.SERIAL_ERROR, {
                        error: error.message,
                        type: 'send'
                    });
                }
                reject(error);
            }
        });
    }

    /**
     * Send frame to simulator
     * @param {Uint8Array} frame - Frame to send
     * @returns {Promise<Object>}
     */
    async sendToSimulator(frame) {
        if (!this.simulator || !this.simulator.enabled) {
            throw new Error('Simulator not enabled');
        }

        // Emit sent event
        if (this.eventBus) {
            this.eventBus.emit(EVENTS.FRAME_SENT, { frame, simulated: true });
        }

        try {
            const response = await this.simulator.processRequest(frame);

            if (response) {
                const parsed = this.modbus.parseResponse(response);

                // Emit received event
                if (this.eventBus) {
                    this.eventBus.emit(EVENTS.FRAME_RECEIVED, {
                        frame: response,
                        parsed: parsed,
                        slaveId: parsed.slaveId,
                        simulated: true
                    });
                }

                return { success: true, frame: response, parsed };
            } else {
                return { success: false, error: 'No response from simulator' };
            }

        } catch (error) {
            if (this.eventBus) {
                this.eventBus.emit(EVENTS.FRAME_ERROR, {
                    error: error.message,
                    simulated: true
                });
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * Send frame without waiting for response
     * @param {Uint8Array} frame - Frame to send
     * @returns {Promise<boolean>}
     */
    async sendFrame(frame) {
        if (this.simulatorEnabled && this.simulator) {
            // In simulator mode, still process through simulator
            this.sendToSimulator(frame);
            return true;
        }

        if (!this.writer) {
            throw new Error('Not connected');
        }

        try {
            await this.writer.write(frame);

            if (this.eventBus) {
                this.eventBus.emit(EVENTS.FRAME_SENT, { frame });
            }

            return true;

        } catch (error) {
            if (this.eventBus) {
                this.eventBus.emit(EVENTS.SERIAL_ERROR, {
                    error: error.message,
                    type: 'send'
                });
            }
            return false;
        }
    }

    /**
     * Clear pending response
     */
    clearPendingResponse() {
        if (this.responseTimeout) {
            clearTimeout(this.responseTimeout);
            this.responseTimeout = null;
        }
        this.pendingResponse = null;
        this.responseResolver = null;
    }

    /**
     * Build and send Modbus request
     * @param {number} slaveId - Slave ID
     * @param {number} functionCode - Function code
     * @param {number} startAddress - Start address
     * @param {number} quantity - Quantity or value
     * @param {number} writeValue - Write value (for FC5, FC6)
     * @param {Array} values - Values array (for FC15, FC16)
     * @returns {Promise<Object>}
     */
    async sendModbusRequest(slaveId, functionCode, startAddress, quantity, writeValue = 0, values = null) {
        let frame;

        switch (functionCode) {
            case 1:
                frame = this.modbus.buildReadCoils(slaveId, startAddress, quantity);
                break;
            case 2:
                frame = this.modbus.buildReadDiscreteInputs(slaveId, startAddress, quantity);
                break;
            case 3:
                frame = this.modbus.buildReadHoldingRegisters(slaveId, startAddress, quantity);
                break;
            case 4:
                frame = this.modbus.buildReadInputRegisters(slaveId, startAddress, quantity);
                break;
            case 5:
                frame = this.modbus.buildWriteSingleCoil(slaveId, startAddress, writeValue !== 0);
                break;
            case 6:
                frame = this.modbus.buildWriteSingleRegister(slaveId, startAddress, writeValue);
                break;
            case 15:
                const coilValues = values || Array(quantity).fill(writeValue !== 0);
                frame = this.modbus.buildWriteMultipleCoils(slaveId, startAddress, coilValues);
                break;
            case 16:
                const registerValues = values || Array(quantity).fill(writeValue);
                frame = this.modbus.buildWriteMultipleRegisters(slaveId, startAddress, registerValues);
                break;
            default:
                throw new Error('Invalid function code');
        }

        return this.sendAndWaitResponse(frame);
    }

    /**
     * Read holding registers
     * @param {number} slaveId - Slave ID
     * @param {number} startAddress - Start address
     * @param {number} quantity - Number of registers
     * @returns {Promise<Object>}
     */
    async readHoldingRegisters(slaveId, startAddress, quantity) {
        const frame = this.modbus.buildReadHoldingRegisters(slaveId, startAddress, quantity);
        return this.sendAndWaitResponse(frame);
    }

    /**
     * Read input registers
     * @param {number} slaveId - Slave ID
     * @param {number} startAddress - Start address
     * @param {number} quantity - Number of registers
     * @returns {Promise<Object>}
     */
    async readInputRegisters(slaveId, startAddress, quantity) {
        const frame = this.modbus.buildReadInputRegisters(slaveId, startAddress, quantity);
        return this.sendAndWaitResponse(frame);
    }

    /**
     * Write single register
     * @param {number} slaveId - Slave ID
     * @param {number} address - Register address
     * @param {number} value - Value to write
     * @returns {Promise<Object>}
     */
    async writeSingleRegister(slaveId, address, value) {
        const frame = this.modbus.buildWriteSingleRegister(slaveId, address, value);
        return this.sendAndWaitResponse(frame);
    }

    /**
     * Write multiple registers
     * @param {number} slaveId - Slave ID
     * @param {number} startAddress - Start address
     * @param {Array<number>} values - Values to write
     * @returns {Promise<Object>}
     */
    async writeMultipleRegisters(slaveId, startAddress, values) {
        const frame = this.modbus.buildWriteMultipleRegisters(slaveId, startAddress, values);
        return this.sendAndWaitResponse(frame);
    }

    /**
     * Destroy communication layer
     */
    async destroy() {
        await this.disconnect();
    }
}
