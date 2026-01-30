/**
 * Virtual Modbus RTU Slave Simulator
 * Simulates a Modbus slave device for testing without hardware
 *
 * 지원 Function Code:
 *   0x01-0x06, 0x0F, 0x10 - 표준 Modbus
 *   0x66 - Firmware Update (Custom)
 */

export class ModbusSimulator {
    constructor() {
        this.enabled = false;
        this.slaveId = 1;

        // Virtual memory areas (65536 to support full address range 0x0000-0xFFFF)
        this.coils = new Array(65536).fill(false);
        this.discreteInputs = new Array(65536).fill(false);
        this.holdingRegisters = new Array(65536).fill(0);
        this.inputRegisters = new Array(65536).fill(0);

        // Response delay (ms)
        this.responseDelay = 50;

        // Data variation interval
        this.variationIntervalId = null;

        // Firmware update state (for 0x66 function code)
        this.fwUpdate = {
            active: false,
            flashUnlocked: false,
            flashErased: false,
            fileSize: 0,
            rxPacketSize: 0,
            done: false
        };

        this.initializeSimulatedData();
    }

    /**
     * Initialize simulated data with realistic values
     */
    initializeSimulatedData() {
        // Simulate some sensor values in holding registers
        this.holdingRegisters[0] = 2350;  // Temperature (23.50°C)
        this.holdingRegisters[1] = 6520;  // Humidity (65.20%)
        this.holdingRegisters[2] = 10132; // Pressure (1013.2 hPa)
        this.holdingRegisters[3] = 2205;  // Voltage (220.5V)
        this.holdingRegisters[4] = 5000;  // Current (50.00A)
        this.holdingRegisters[5] = 6000;  // Speed (RPM)
        this.holdingRegisters[10] = 100;  // Status
        this.holdingRegisters[11] = 255;  // Control

        // Chart-friendly addresses (0xD001 = 53249, 0xD011 = 53265)
        // Motor Status at 0xD011
        this.holdingRegisters[0xD011] = 1;     // Motor running
        // Setpoint at 0xD001
        this.holdingRegisters[0xD001] = 3000;  // Setpoint RPM
        // Additional chart data addresses
        this.holdingRegisters[0xD002] = 2500;  // Actual RPM
        this.holdingRegisters[0xD003] = 4500;  // Motor current
        this.holdingRegisters[0xD004] = 2200;  // Voltage

        // Simulate some status coils
        this.coils[0] = true;  // System running
        this.coils[1] = false; // Alarm
        this.coils[2] = true;  // Ready
        this.coils[3] = false; // Error

        // Simulate input registers (read-only sensors)
        this.inputRegisters[0] = 2500;  // External temp
        this.inputRegisters[1] = 5000;  // External humidity
        this.inputRegisters[2] = 1000;  // Analog input 1
        this.inputRegisters[3] = 2000;  // Analog input 2

        // Start data variation simulation
        this.startDataVariation();
    }

    /**
     * Simulate realistic data variation over time
     */
    startDataVariation() {
        // Clear existing interval if any
        if (this.variationIntervalId) {
            clearInterval(this.variationIntervalId);
        }

        // Faster variation for chart demo (every 100ms)
        this.variationIntervalId = setInterval(() => {
            if (!this.enabled) return;

            // Vary temperature slightly
            this.holdingRegisters[0] += Math.floor(Math.random() * 20) - 10;
            this.holdingRegisters[0] = Math.max(1500, Math.min(3500, this.holdingRegisters[0]));

            // Vary humidity
            this.holdingRegisters[1] += Math.floor(Math.random() * 50) - 25;
            this.holdingRegisters[1] = Math.max(3000, Math.min(9000, this.holdingRegisters[1]));

            // Vary pressure
            this.holdingRegisters[2] += Math.floor(Math.random() * 10) - 5;
            this.holdingRegisters[2] = Math.max(9500, Math.min(10500, this.holdingRegisters[2]));

            // Vary speed (register 5)
            this.holdingRegisters[5] += Math.floor(Math.random() * 100) - 50;
            this.holdingRegisters[5] = Math.max(0, Math.min(10000, this.holdingRegisters[5]));

            // Randomly toggle alarm
            if (Math.random() < 0.05) {
                this.coils[1] = !this.coils[1];
            }

            // === Chart-friendly data variation ===
            // Motor Status (0xD011) - sine wave pattern
            const t = Date.now() / 1000;
            this.holdingRegisters[0xD011] = Math.floor(3000 + 1500 * Math.sin(t * 0.5) + (Math.random() * 100 - 50));
            this.holdingRegisters[0xD011] = Math.max(0, Math.min(6000, this.holdingRegisters[0xD011]));

            // Setpoint (0xD001) - step changes occasionally
            if (Math.random() < 0.02) {
                this.holdingRegisters[0xD001] = Math.floor(1000 + Math.random() * 4000);
            }

            // Actual RPM (0xD002) - follows setpoint with lag and noise
            const setpoint = this.holdingRegisters[0xD001];
            const currentRpm = this.holdingRegisters[0xD002];
            const diff = setpoint - currentRpm;
            this.holdingRegisters[0xD002] = Math.floor(currentRpm + diff * 0.1 + (Math.random() * 50 - 25));
            this.holdingRegisters[0xD002] = Math.max(0, Math.min(6000, this.holdingRegisters[0xD002]));

            // Motor current (0xD003) - proportional to RPM with noise
            this.holdingRegisters[0xD003] = Math.floor(this.holdingRegisters[0xD002] * 0.8 + Math.random() * 200);

            // Voltage (0xD004) - relatively stable with small variation
            this.holdingRegisters[0xD004] += Math.floor(Math.random() * 20) - 10;
            this.holdingRegisters[0xD004] = Math.max(2100, Math.min(2300, this.holdingRegisters[0xD004]));

        }, 100); // 100ms update rate for smooth chart animation
    }

    /**
     * Stop data variation
     */
    stopDataVariation() {
        if (this.variationIntervalId) {
            clearInterval(this.variationIntervalId);
            this.variationIntervalId = null;
        }
    }

    /**
     * Process Modbus request and generate response
     * @param {Uint8Array} requestFrame - Request frame
     * @returns {Promise<Uint8Array|null>} Response frame or null
     */
    processRequest(requestFrame) {
        if (!this.enabled) return null;

        try {
            const slaveId = requestFrame[0];

            // Ignore if not our slave ID
            if (slaveId !== this.slaveId) return null;

            const functionCode = requestFrame[1];

            // Simulate processing delay
            return new Promise((resolve) => {
                setTimeout(() => {
                    try {
                        const response = this.handleFunction(requestFrame);
                        resolve(response);
                    } catch (error) {
                        resolve(this.buildExceptionResponse(slaveId, functionCode, 0x04));
                    }
                }, this.responseDelay);
            });

        } catch (error) {
            return Promise.resolve(null);
        }
    }

    /**
     * Handle different function codes
     * @param {Uint8Array} frame - Request frame
     * @returns {Uint8Array} Response frame
     */
    handleFunction(frame) {
        const slaveId = frame[0];
        const functionCode = frame[1];
        const startAddress = (frame[2] << 8) | frame[3];
        const quantity = (frame[4] << 8) | frame[5];

        switch (functionCode) {
            case 0x01: return this.handleReadCoils(slaveId, startAddress, quantity);
            case 0x02: return this.handleReadDiscreteInputs(slaveId, startAddress, quantity);
            case 0x03: return this.handleReadHoldingRegisters(slaveId, startAddress, quantity);
            case 0x04: return this.handleReadInputRegisters(slaveId, startAddress, quantity);
            case 0x05: return this.handleWriteSingleCoil(slaveId, startAddress, frame[4], frame[5]);
            case 0x06: return this.handleWriteSingleRegister(slaveId, startAddress, (frame[4] << 8) | frame[5]);
            case 0x0F: return this.handleWriteMultipleCoils(slaveId, frame);
            case 0x10: return this.handleWriteMultipleRegisters(slaveId, frame);
            case 0x66: return this.handleFirmwareUpdate(slaveId, frame);
            default:
                return this.buildExceptionResponse(slaveId, functionCode, 0x01);
        }
    }

    /**
     * Handle Read Coils (FC01)
     */
    handleReadCoils(slaveId, startAddress, quantity) {
        if (quantity < 1 || quantity > 2000) {
            return this.buildExceptionResponse(slaveId, 0x01, 0x03);
        }
        if (startAddress + quantity > this.coils.length) {
            return this.buildExceptionResponse(slaveId, 0x01, 0x02);
        }

        const byteCount = Math.ceil(quantity / 8);
        const response = new Uint8Array(3 + byteCount + 2);

        response[0] = slaveId;
        response[1] = 0x01;
        response[2] = byteCount;

        for (let i = 0; i < quantity; i++) {
            if (this.coils[startAddress + i]) {
                const byteIndex = Math.floor(i / 8);
                const bitIndex = i % 8;
                response[3 + byteIndex] |= (1 << bitIndex);
            }
        }

        return this.addCRC(response);
    }

    /**
     * Handle Read Discrete Inputs (FC02)
     */
    handleReadDiscreteInputs(slaveId, startAddress, quantity) {
        if (quantity < 1 || quantity > 2000) {
            return this.buildExceptionResponse(slaveId, 0x02, 0x03);
        }
        if (startAddress + quantity > this.discreteInputs.length) {
            return this.buildExceptionResponse(slaveId, 0x02, 0x02);
        }

        const byteCount = Math.ceil(quantity / 8);
        const response = new Uint8Array(3 + byteCount + 2);

        response[0] = slaveId;
        response[1] = 0x02;
        response[2] = byteCount;

        for (let i = 0; i < quantity; i++) {
            if (this.discreteInputs[startAddress + i]) {
                const byteIndex = Math.floor(i / 8);
                const bitIndex = i % 8;
                response[3 + byteIndex] |= (1 << bitIndex);
            }
        }

        return this.addCRC(response);
    }

    /**
     * Handle Read Holding Registers (FC03)
     */
    handleReadHoldingRegisters(slaveId, startAddress, quantity) {
        if (quantity < 1 || quantity > 125) {
            return this.buildExceptionResponse(slaveId, 0x03, 0x03);
        }
        if (startAddress + quantity > this.holdingRegisters.length) {
            return this.buildExceptionResponse(slaveId, 0x03, 0x02);
        }

        const byteCount = quantity * 2;
        const response = new Uint8Array(3 + byteCount + 2);

        response[0] = slaveId;
        response[1] = 0x03;
        response[2] = byteCount;

        for (let i = 0; i < quantity; i++) {
            const value = this.holdingRegisters[startAddress + i];
            response[3 + i * 2] = (value >> 8) & 0xFF;
            response[3 + i * 2 + 1] = value & 0xFF;
        }

        return this.addCRC(response);
    }

    /**
     * Handle Read Input Registers (FC04)
     */
    handleReadInputRegisters(slaveId, startAddress, quantity) {
        if (quantity < 1 || quantity > 125) {
            return this.buildExceptionResponse(slaveId, 0x04, 0x03);
        }
        if (startAddress + quantity > this.inputRegisters.length) {
            return this.buildExceptionResponse(slaveId, 0x04, 0x02);
        }

        const byteCount = quantity * 2;
        const response = new Uint8Array(3 + byteCount + 2);

        response[0] = slaveId;
        response[1] = 0x04;
        response[2] = byteCount;

        for (let i = 0; i < quantity; i++) {
            const value = this.inputRegisters[startAddress + i];
            response[3 + i * 2] = (value >> 8) & 0xFF;
            response[3 + i * 2 + 1] = value & 0xFF;
        }

        return this.addCRC(response);
    }

    /**
     * Handle Write Single Coil (FC05)
     */
    handleWriteSingleCoil(slaveId, address, valueMSB, valueLSB) {
        if (address >= this.coils.length) {
            return this.buildExceptionResponse(slaveId, 0x05, 0x02);
        }

        const value = valueMSB === 0xFF && valueLSB === 0x00;
        this.coils[address] = value;

        const response = new Uint8Array(6 + 2);
        response[0] = slaveId;
        response[1] = 0x05;
        response[2] = (address >> 8) & 0xFF;
        response[3] = address & 0xFF;
        response[4] = valueMSB;
        response[5] = valueLSB;

        return this.addCRC(response);
    }

    /**
     * Handle Write Single Register (FC06)
     */
    handleWriteSingleRegister(slaveId, address, value) {
        if (address >= this.holdingRegisters.length) {
            return this.buildExceptionResponse(slaveId, 0x06, 0x02);
        }

        this.holdingRegisters[address] = value;

        const response = new Uint8Array(6 + 2);
        response[0] = slaveId;
        response[1] = 0x06;
        response[2] = (address >> 8) & 0xFF;
        response[3] = address & 0xFF;
        response[4] = (value >> 8) & 0xFF;
        response[5] = value & 0xFF;

        return this.addCRC(response);
    }

    /**
     * Handle Write Multiple Coils (FC15)
     */
    handleWriteMultipleCoils(slaveId, frame) {
        const startAddress = (frame[2] << 8) | frame[3];
        const quantity = (frame[4] << 8) | frame[5];
        const byteCount = frame[6];

        if (quantity < 1 || quantity > 1968) {
            return this.buildExceptionResponse(slaveId, 0x0F, 0x03);
        }
        if (startAddress + quantity > this.coils.length) {
            return this.buildExceptionResponse(slaveId, 0x0F, 0x02);
        }

        for (let i = 0; i < quantity; i++) {
            const byteIndex = Math.floor(i / 8);
            const bitIndex = i % 8;
            const value = (frame[7 + byteIndex] & (1 << bitIndex)) !== 0;
            this.coils[startAddress + i] = value;
        }

        const response = new Uint8Array(6 + 2);
        response[0] = slaveId;
        response[1] = 0x0F;
        response[2] = (startAddress >> 8) & 0xFF;
        response[3] = startAddress & 0xFF;
        response[4] = (quantity >> 8) & 0xFF;
        response[5] = quantity & 0xFF;

        return this.addCRC(response);
    }

    /**
     * Handle Write Multiple Registers (FC16)
     */
    handleWriteMultipleRegisters(slaveId, frame) {
        const startAddress = (frame[2] << 8) | frame[3];
        const quantity = (frame[4] << 8) | frame[5];
        const byteCount = frame[6];

        if (quantity < 1 || quantity > 123) {
            return this.buildExceptionResponse(slaveId, 0x10, 0x03);
        }
        if (startAddress + quantity > this.holdingRegisters.length) {
            return this.buildExceptionResponse(slaveId, 0x10, 0x02);
        }

        for (let i = 0; i < quantity; i++) {
            const value = (frame[7 + i * 2] << 8) | frame[7 + i * 2 + 1];
            this.holdingRegisters[startAddress + i] = value;
        }

        const response = new Uint8Array(6 + 2);
        response[0] = slaveId;
        response[1] = 0x10;
        response[2] = (startAddress >> 8) & 0xFF;
        response[3] = startAddress & 0xFF;
        response[4] = (quantity >> 8) & 0xFF;
        response[5] = quantity & 0xFF;

        return this.addCRC(response);
    }

    /**
     * Build exception response
     */
    buildExceptionResponse(slaveId, functionCode, exceptionCode) {
        const response = new Uint8Array(3 + 2);
        response[0] = slaveId;
        response[1] = functionCode | 0x80;
        response[2] = exceptionCode;
        return this.addCRC(response);
    }

    /**
     * Add CRC to frame
     */
    addCRC(frame) {
        const dataLength = frame.length - 2;
        let crc = 0xFFFF;

        for (let i = 0; i < dataLength; i++) {
            crc ^= frame[i];
            for (let j = 0; j < 8; j++) {
                if (crc & 0x0001) {
                    crc = (crc >> 1) ^ 0xA001;
                } else {
                    crc = crc >> 1;
                }
            }
        }

        frame[dataLength] = crc & 0xFF;
        frame[dataLength + 1] = (crc >> 8) & 0xFF;
        return frame;
    }

    /**
     * Get current memory state
     */
    getMemoryState() {
        return {
            coils: this.coils.slice(0, 20),
            discreteInputs: this.discreteInputs.slice(0, 20),
            holdingRegisters: this.holdingRegisters.slice(0, 20),
            inputRegisters: this.inputRegisters.slice(0, 20)
        };
    }

    /**
     * Reset all memory
     */
    reset() {
        this.coils.fill(false);
        this.discreteInputs.fill(false);
        this.holdingRegisters.fill(0);
        this.inputRegisters.fill(0);
        this.initializeSimulatedData();
        this.resetFirmwareUpdate();
    }

    /**
     * Reset firmware update state
     */
    resetFirmwareUpdate() {
        this.fwUpdate = {
            active: false,
            flashUnlocked: false,
            flashErased: false,
            fileSize: 0,
            rxPacketSize: 0,
            done: false
        };
    }

    /**
     * Handle Firmware Update (FC 0x66)
     * Simulates the firmware update protocol
     */
    handleFirmwareUpdate(slaveId, frame) {
        const opCode = frame[2];

        switch (opCode) {
            case 0x90: // Init - Flash Unlock, receive file size
                return this.handleFwInit(slaveId, frame);

            case 0x91: // Erase Confirm - Check if erase complete
                return this.handleFwEraseConfirm(slaveId, frame);

            case 0x03: // Data Transfer - Receive firmware data
                return this.handleFwDataTransfer(slaveId, frame);

            case 0x99: // Done - Flash Lock, complete update
                return this.handleFwDone(slaveId, frame);

            default:
                return this.buildFwResponse(slaveId, 0x05, null); // Error
        }
    }

    /**
     * Handle Firmware Init (OpCode 0x90)
     */
    handleFwInit(slaveId, frame) {
        // Read file size (4 bytes, big-endian)
        const fileSize = (frame[3] << 24) | (frame[4] << 16) | (frame[5] << 8) | frame[6];

        // Simulate Flash Unlock
        this.fwUpdate.active = true;
        this.fwUpdate.flashUnlocked = true;
        this.fwUpdate.fileSize = fileSize;
        this.fwUpdate.rxPacketSize = 0;
        this.fwUpdate.done = false;

        // Simulate flash erase (will complete after a delay)
        this.fwUpdate.flashErased = false;
        setTimeout(() => {
            if (this.fwUpdate.active) {
                this.fwUpdate.flashErased = true;
            }
        }, 300); // Simulate 300ms erase time

        console.log(`[Simulator] FW Init: fileSize=${fileSize} bytes, Flash Unlocked`);

        // Echo back the init command
        return this.buildFwResponse(slaveId, 0x90, frame.slice(3, 7));
    }

    /**
     * Handle Firmware Erase Confirm (OpCode 0x91)
     */
    handleFwEraseConfirm(slaveId, frame) {
        // Check request data (should be 0x55555555)
        const requestData = (frame[3] << 24) | (frame[4] << 16) | (frame[5] << 8) | frame[6];

        if (requestData !== 0x55555555) {
            // Invalid request
            return this.buildFwResponse(slaveId, 0x05, null);
        }

        // Check if flash erase is complete
        let responseData;
        if (this.fwUpdate.flashErased) {
            // Erase complete: return 0x00000000
            responseData = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
            console.log('[Simulator] FW Erase Confirm: Flash Erased OK');
        } else {
            // Erase not complete: return 0xFFFFFFFF
            responseData = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
            console.log('[Simulator] FW Erase Confirm: Flash Erase in progress...');
        }

        return this.buildFwResponse(slaveId, 0x91, responseData);
    }

    /**
     * Handle Firmware Data Transfer (OpCode 0x03)
     */
    handleFwDataTransfer(slaveId, frame) {
        if (!this.fwUpdate.active || !this.fwUpdate.flashErased) {
            return this.buildFwResponse(slaveId, 0x05, null); // Error
        }

        const dataLength = frame[3];
        const data = frame.slice(4, 4 + dataLength);

        // Accumulate received bytes
        this.fwUpdate.rxPacketSize += dataLength;

        // Check if this is the last packet (less than 60 bytes)
        if (dataLength <= 60) {
            this.fwUpdate.done = true;
        }

        console.log(`[Simulator] FW Data: received ${dataLength} bytes, total ${this.fwUpdate.rxPacketSize}/${this.fwUpdate.fileSize}`);

        // Respond with ACK (0x04) and rxPacketSize
        const rxSize = this.fwUpdate.rxPacketSize;
        const responseData = new Uint8Array([
            (rxSize >> 24) & 0xFF,
            (rxSize >> 16) & 0xFF,
            (rxSize >> 8) & 0xFF,
            rxSize & 0xFF
        ]);

        return this.buildFwResponse(slaveId, 0x04, responseData);
    }

    /**
     * Handle Firmware Done (OpCode 0x99)
     */
    handleFwDone(slaveId, frame) {
        if (!this.fwUpdate.active) {
            return this.buildFwResponse(slaveId, 0x05, null); // Error
        }

        if (this.fwUpdate.done) {
            // Success - Flash Lock
            console.log(`[Simulator] FW Done: Update complete! Total ${this.fwUpdate.rxPacketSize} bytes received`);
            this.resetFirmwareUpdate();
            return this.buildFwResponse(slaveId, 0x04, null); // ACK
        } else {
            // Error - update not complete
            console.log('[Simulator] FW Done: Error - update not complete');
            return this.buildFwResponse(slaveId, 0x05, null); // NAK
        }
    }

    /**
     * Build Firmware Update response frame
     */
    buildFwResponse(slaveId, opCode, data) {
        const dataLen = data ? data.length : 0;
        const response = new Uint8Array(3 + dataLen + 2); // slaveId + FC + opCode + data + CRC

        response[0] = slaveId;
        response[1] = 0x66;
        response[2] = opCode;

        if (data && dataLen > 0) {
            response.set(data, 3);
        }

        return this.addCRC(response);
    }

    /**
     * Destroy simulator and cleanup
     */
    destroy() {
        this.stopDataVariation();
        this.enabled = false;
    }
}

// 기본 인스턴스 export (선택적 사용)
export const modbusSimulator = new ModbusSimulator();
