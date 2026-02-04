/**
 * Modbus RTU Protocol Library
 * Implements Modbus RTU protocol with CRC-16 calculation
 */

class ModbusRTU {
    constructor() {
        this.timeout = 1000; // Response timeout in ms
    }

    /**
     * Calculate CRC-16 (Modbus)
     * @param {Uint8Array} buffer - Data buffer
     * @returns {number} CRC-16 value
     */
    calculateCRC16(buffer) {
        let crc = 0xFFFF;

        for (let i = 0; i < buffer.length; i++) {
            crc ^= buffer[i];

            for (let j = 0; j < 8; j++) {
                if (crc & 0x0001) {
                    crc = (crc >> 1) ^ 0xA001;
                } else {
                    crc = crc >> 1;
                }
            }
        }

        return crc;
    }

    /**
     * Verify CRC of received frame
     * @param {Uint8Array} frame - Complete frame including CRC
     * @returns {boolean} True if CRC is valid
     */
    verifyCRC(frame) {
        if (frame.length < 4) return false;

        const data = frame.slice(0, -2);
        const receivedCRC = frame[frame.length - 2] | (frame[frame.length - 1] << 8);
        const calculatedCRC = this.calculateCRC16(data);

        return receivedCRC === calculatedCRC;
    }

    /**
     * Build Modbus RTU frame
     * @param {number} slaveId - Slave address (1-247)
     * @param {number} functionCode - Modbus function code
     * @param {Uint8Array} data - Function-specific data
     * @returns {Uint8Array} Complete frame with CRC
     */
    buildFrame(slaveId, functionCode, data) {
        const frameLength = 2 + data.length + 2; // slave + function + data + CRC
        const frame = new Uint8Array(frameLength);

        frame[0] = slaveId;
        frame[1] = functionCode;
        frame.set(data, 2);

        // Calculate and append CRC
        const crc = this.calculateCRC16(frame.slice(0, -2));
        frame[frame.length - 2] = crc & 0xFF;
        frame[frame.length - 1] = (crc >> 8) & 0xFF;

        return frame;
    }

    /**
     * Build Read Coils (FC01) request
     * @param {number} slaveId - Slave address
     * @param {number} startAddress - Starting address
     * @param {number} quantity - Number of coils to read
     * @returns {Uint8Array} Modbus frame
     */
    buildReadCoils(slaveId, startAddress, quantity) {
        const data = new Uint8Array(4);
        data[0] = (startAddress >> 8) & 0xFF;
        data[1] = startAddress & 0xFF;
        data[2] = (quantity >> 8) & 0xFF;
        data[3] = quantity & 0xFF;

        return this.buildFrame(slaveId, 0x01, data);
    }

    /**
     * Build Read Discrete Inputs (FC02) request
     * @param {number} slaveId - Slave address
     * @param {number} startAddress - Starting address
     * @param {number} quantity - Number of inputs to read
     * @returns {Uint8Array} Modbus frame
     */
    buildReadDiscreteInputs(slaveId, startAddress, quantity) {
        const data = new Uint8Array(4);
        data[0] = (startAddress >> 8) & 0xFF;
        data[1] = startAddress & 0xFF;
        data[2] = (quantity >> 8) & 0xFF;
        data[3] = quantity & 0xFF;

        return this.buildFrame(slaveId, 0x02, data);
    }

    /**
     * Build Read Holding Registers (FC03) request
     * @param {number} slaveId - Slave address
     * @param {number} startAddress - Starting address
     * @param {number} quantity - Number of registers to read
     * @returns {Uint8Array} Modbus frame
     */
    buildReadHoldingRegisters(slaveId, startAddress, quantity) {
        const data = new Uint8Array(4);
        data[0] = (startAddress >> 8) & 0xFF;
        data[1] = startAddress & 0xFF;
        data[2] = (quantity >> 8) & 0xFF;
        data[3] = quantity & 0xFF;

        return this.buildFrame(slaveId, 0x03, data);
    }

    /**
     * Build Read Input Registers (FC04) request
     * @param {number} slaveId - Slave address
     * @param {number} startAddress - Starting address
     * @param {number} quantity - Number of registers to read
     * @returns {Uint8Array} Modbus frame
     */
    buildReadInputRegisters(slaveId, startAddress, quantity) {
        const data = new Uint8Array(4);
        data[0] = (startAddress >> 8) & 0xFF;
        data[1] = startAddress & 0xFF;
        data[2] = (quantity >> 8) & 0xFF;
        data[3] = quantity & 0xFF;

        return this.buildFrame(slaveId, 0x04, data);
    }

    /**
     * Build Write Single Coil (FC05) request
     * @param {number} slaveId - Slave address
     * @param {number} address - Coil address
     * @param {boolean} value - Coil value (true/false)
     * @returns {Uint8Array} Modbus frame
     */
    buildWriteSingleCoil(slaveId, address, value) {
        const data = new Uint8Array(4);
        data[0] = (address >> 8) & 0xFF;
        data[1] = address & 0xFF;
        data[2] = value ? 0xFF : 0x00;
        data[3] = 0x00;

        return this.buildFrame(slaveId, 0x05, data);
    }

    /**
     * Build Write Single Register (FC06) request
     * @param {number} slaveId - Slave address
     * @param {number} address - Register address
     * @param {number} value - Register value
     * @returns {Uint8Array} Modbus frame
     */
    buildWriteSingleRegister(slaveId, address, value) {
        const data = new Uint8Array(4);
        data[0] = (address >> 8) & 0xFF;
        data[1] = address & 0xFF;
        data[2] = (value >> 8) & 0xFF;
        data[3] = value & 0xFF;

        return this.buildFrame(slaveId, 0x06, data);
    }

    /**
     * Build Write Multiple Coils (FC15) request
     * @param {number} slaveId - Slave address
     * @param {number} startAddress - Starting address
     * @param {Array<boolean>} values - Array of coil values
     * @returns {Uint8Array} Modbus frame
     */
    buildWriteMultipleCoils(slaveId, startAddress, values) {
        const quantity = values.length;
        const byteCount = Math.ceil(quantity / 8);
        const data = new Uint8Array(5 + byteCount);

        data[0] = (startAddress >> 8) & 0xFF;
        data[1] = startAddress & 0xFF;
        data[2] = (quantity >> 8) & 0xFF;
        data[3] = quantity & 0xFF;
        data[4] = byteCount;

        // Pack coils into bytes
        for (let i = 0; i < quantity; i++) {
            if (values[i]) {
                const byteIndex = Math.floor(i / 8);
                const bitIndex = i % 8;
                data[5 + byteIndex] |= (1 << bitIndex);
            }
        }

        return this.buildFrame(slaveId, 0x0F, data);
    }

    /**
     * Build Write Multiple Registers (FC16) request
     * @param {number} slaveId - Slave address
     * @param {number} startAddress - Starting address
     * @param {Array<number>} values - Array of register values
     * @returns {Uint8Array} Modbus frame
     */
    buildWriteMultipleRegisters(slaveId, startAddress, values) {
        const quantity = values.length;
        const byteCount = quantity * 2;
        const data = new Uint8Array(5 + byteCount);

        data[0] = (startAddress >> 8) & 0xFF;
        data[1] = startAddress & 0xFF;
        data[2] = (quantity >> 8) & 0xFF;
        data[3] = quantity & 0xFF;
        data[4] = byteCount;

        // Pack register values
        for (let i = 0; i < quantity; i++) {
            data[5 + i * 2] = (values[i] >> 8) & 0xFF;
            data[5 + i * 2 + 1] = values[i] & 0xFF;
        }

        return this.buildFrame(slaveId, 0x10, data);
    }

    /**
     * Parse Modbus response
     * @param {Uint8Array} response - Response frame
     * @returns {Object} Parsed response data
     */
    parseResponse(response) {
        if (!this.verifyCRC(response)) {
            throw new Error('Invalid CRC');
        }

        const slaveId = response[0];
        const functionCode = response[1];

        // Check for exception response
        if (functionCode & 0x80) {
            const exceptionCode = response[2];
            throw new Error(`Modbus Exception ${exceptionCode}: ${this.getExceptionMessage(exceptionCode)}`);
        }

        const result = {
            slaveId,
            functionCode,
            data: []
        };

        switch (functionCode) {
            case 0x01: // Read Coils
            case 0x02: // Read Discrete Inputs
                const coilByteCount = response[2];
                result.data = this.parseCoils(response.slice(3, 3 + coilByteCount));
                break;

            case 0x03: // Read Holding Registers
            case 0x04: // Read Input Registers
                const registerByteCount = response[2];
                result.data = this.parseRegisters(response.slice(3, 3 + registerByteCount));
                break;

            case 0x05: // Write Single Coil
            case 0x06: // Write Single Register
            case 0x0F: // Write Multiple Coils
            case 0x10: // Write Multiple Registers
                result.address = (response[2] << 8) | response[3];
                result.value = (response[4] << 8) | response[5];
                break;
        }

        return result;
    }

    /**
     * Parse coils from byte array
     * @param {Uint8Array} bytes - Coil bytes
     * @returns {Array<boolean>} Array of coil values
     */
    parseCoils(bytes) {
        const coils = [];
        for (let i = 0; i < bytes.length; i++) {
            for (let bit = 0; bit < 8; bit++) {
                coils.push((bytes[i] & (1 << bit)) !== 0);
            }
        }
        return coils;
    }

    /**
     * Parse registers from byte array
     * @param {Uint8Array} bytes - Register bytes
     * @returns {Array<number>} Array of register values
     */
    parseRegisters(bytes) {
        const registers = [];
        for (let i = 0; i < bytes.length; i += 2) {
            registers.push((bytes[i] << 8) | bytes[i + 1]);
        }
        return registers;
    }

    /**
     * Get exception message
     * @param {number} code - Exception code
     * @returns {string} Exception message
     */
    getExceptionMessage(code) {
        const exceptions = {
            0x01: 'Illegal Function',
            0x02: 'Illegal Data Address',
            0x03: 'Illegal Data Value',
            0x04: 'Slave Device Failure',
            0x05: 'Acknowledge',
            0x06: 'Slave Device Busy',
            0x08: 'Memory Parity Error',
            0x0A: 'Gateway Path Unavailable',
            0x0B: 'Gateway Target Device Failed to Respond'
        };
        return exceptions[code] || 'Unknown Exception';
    }

    /**
     * Convert buffer to hex string
     * @param {Uint8Array} buffer - Data buffer
     * @returns {string} Hex string representation
     */
    bufferToHex(buffer) {
        return Array.from(buffer)
            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');
    }

    // ===== Firmware Update Protocol (Function Code 0x66) =====

    /**
     * Build Firmware Update Init (OpCode 0x90) request
     * Sends file size to slave, slave will unlock flash
     * @param {number} slaveId - Slave address
     * @param {number} fileSize - Firmware file size in bytes
     * @returns {Uint8Array} Modbus frame
     */
    buildFirmwareInit(slaveId, fileSize) {
        // OpCode (1 byte) + FileSize (4 bytes, big-endian for DWORDSWAP)
        const data = new Uint8Array(5);
        data[0] = 0x90; // OpCode
        data[1] = (fileSize >> 24) & 0xFF;
        data[2] = (fileSize >> 16) & 0xFF;
        data[3] = (fileSize >> 8) & 0xFF;
        data[4] = fileSize & 0xFF;

        return this.buildFrame(slaveId, 0x66, data);
    }

    /**
     * Build Firmware Erase Confirm (OpCode 0x91) request
     * Sends 0x55555555 to check if flash erase is complete
     * @param {number} slaveId - Slave address
     * @returns {Uint8Array} Modbus frame
     */
    buildFirmwareEraseConfirm(slaveId) {
        // OpCode (1 byte) + Confirm data (4 bytes: 0x55555555)
        const data = new Uint8Array(5);
        data[0] = 0x91; // OpCode
        data[1] = 0x55;
        data[2] = 0x55;
        data[3] = 0x55;
        data[4] = 0x55;

        return this.buildFrame(slaveId, 0x66, data);
    }

    /**
     * Build Firmware Data Transfer (OpCode 0x03) request
     * Sends firmware data chunk
     * @param {number} slaveId - Slave address
     * @param {Uint8Array} chunk - Data chunk to send
     * @returns {Uint8Array} Modbus frame
     */
    buildFirmwareData(slaveId, chunk) {
        // OpCode (1 byte) + DataLength (1 byte) + Data (variable)
        const data = new Uint8Array(2 + chunk.length);
        data[0] = 0x03; // OpCode
        data[1] = chunk.length; // Data length
        data.set(chunk, 2);

        return this.buildFrame(slaveId, 0x66, data);
    }

    /**
     * Build Firmware Update Done (OpCode 0x99) request
     * Signals firmware update completion, slave will lock flash
     * @param {number} slaveId - Slave address
     * @returns {Uint8Array} Modbus frame
     */
    buildFirmwareDone(slaveId) {
        const data = new Uint8Array(1);
        data[0] = 0x99; // OpCode

        return this.buildFrame(slaveId, 0x66, data);
    }

    /**
     * Parse Firmware Update response
     * 펌웨어 응답에는 CRC가 없음
     * @param {Uint8Array} response - Response frame
     * @returns {Object} Parsed response data
     */
    parseFirmwareResponse(response) {
        // 펌웨어 응답에는 CRC가 없으므로 검증하지 않음

        const slaveId = response[0];
        const functionCode = response[1];

        // Check for exception response
        if (functionCode & 0x80) {
            const exceptionCode = response[2];
            throw new Error(`Modbus Exception ${exceptionCode}: ${this.getExceptionMessage(exceptionCode)}`);
        }

        if (functionCode !== 0x66) {
            throw new Error(`Unexpected function code: 0x${functionCode.toString(16)}`);
        }

        const opCode = response[2];
        const result = {
            slaveId,
            functionCode,
            opCode,
            success: false,
            data: null
        };

        switch (opCode) {
            case 0x90: // Init response - echo back
                result.success = true;
                break;

            case 0x91: // Erase confirm response
                // Response data: 0xFFFFFFFF = 성공 (erase 완료), 0x00000000 = 실패
                if (response.length >= 7) {
                    const status = (response[3] << 24) | (response[4] << 16) | (response[5] << 8) | response[6];
                    result.success = (status === 0xFFFFFFFF);
                    result.data = { eraseStatus: status };
                }
                break;

            case 0x04: // Data transfer ACK (성공)
                result.success = true;
                // Total Received Byte (4 bytes, big-endian)
                if (response.length >= 7) {
                    const totalReceivedByte = (response[3] << 24) | (response[4] << 16) | (response[5] << 8) | response[6];
                    result.data = { totalReceivedByte };
                }
                break;

            case 0x05: // Error response
                result.success = false;
                result.error = 'Slave reported error';
                break;

            default:
                result.success = false;
                result.error = `Unknown OpCode: 0x${opCode.toString(16)}`;
        }

        return result;
    }
}
