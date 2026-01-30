/**
 * helpers.js - 공통 유틸리티 함수
 */

/**
 * 지연 실행
 * @param {number} ms - 밀리초
 * @returns {Promise}
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 바이트 배열을 HEX 문자열로 변환
 * @param {Uint8Array|Array} bytes - 바이트 배열
 * @param {string} separator - 구분자 (기본: ' ')
 * @returns {string}
 */
export function bytesToHex(bytes, separator = ' ') {
    return Array.from(bytes)
        .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
        .join(separator);
}

/**
 * HEX 문자열을 바이트 배열로 변환
 * @param {string} hex - HEX 문자열
 * @returns {Uint8Array}
 */
export function hexToBytes(hex) {
    const cleanHex = hex.replace(/[\s-]/g, '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return bytes;
}

/**
 * 바이트 값 포맷팅
 * @param {number} byte - 바이트 값
 * @param {string} format - 'hex' 또는 'dec'
 * @returns {string}
 */
export function formatByte(byte, format = 'hex') {
    if (format === 'hex') {
        return byte.toString(16).toUpperCase().padStart(2, '0');
    }
    return byte.toString().padStart(3, '0');
}

/**
 * 파일 크기 포맷팅
 * @param {number} bytes - 바이트 수
 * @returns {string}
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 시간 포맷팅
 * @param {Date} date - Date 객체
 * @returns {string}
 */
export function formatTime(date = new Date()) {
    return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

/**
 * 타임스탬프 포맷팅 (밀리초 포함)
 * @param {Date} date - Date 객체
 * @returns {string}
 */
export function formatTimestamp(date = new Date()) {
    const time = formatTime(date);
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
}

/**
 * 숫자를 지정된 자릿수로 패딩
 * @param {number} num - 숫자
 * @param {number} length - 자릿수
 * @returns {string}
 */
export function padNumber(num, length) {
    return num.toString().padStart(length, '0');
}

/**
 * 범위 내의 값으로 제한
 * @param {number} value - 값
 * @param {number} min - 최소값
 * @param {number} max - 최대값
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * 두 배열이 같은지 비교
 * @param {Array} arr1 - 첫 번째 배열
 * @param {Array} arr2 - 두 번째 배열
 * @returns {boolean}
 */
export function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}

/**
 * 디바운스 함수
 * @param {Function} func - 실행할 함수
 * @param {number} wait - 대기 시간 (ms)
 * @returns {Function}
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 쓰로틀 함수
 * @param {Function} func - 실행할 함수
 * @param {number} limit - 제한 시간 (ms)
 * @returns {Function}
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 깊은 복사
 * @param {*} obj - 복사할 객체
 * @returns {*}
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (obj instanceof Uint8Array) return new Uint8Array(obj);

    const cloned = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone(obj[key]);
        }
    }
    return cloned;
}

/**
 * UUID 생성
 * @returns {string}
 */
export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * 짧은 ID 생성
 * @returns {string}
 */
export function generateShortId() {
    return Math.random().toString(36).substr(2, 9);
}

/**
 * HTML 이스케이프
 * @param {string} str - 문자열
 * @returns {string}
 */
export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * 색상 유틸리티
 */
export const colors = {
    channel: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
    success: '#2ecc71',
    error: '#e74c3c',
    warning: '#f39c12',
    info: '#3498db',
    primary: '#3498db',
    secondary: '#95a5a6'
};

/**
 * Modbus Function Code 이름
 */
export const functionCodeNames = {
    0x01: 'Read Coils',
    0x02: 'Read Discrete Inputs',
    0x03: 'Read Holding Registers',
    0x04: 'Read Input Registers',
    0x05: 'Write Single Coil',
    0x06: 'Write Single Register',
    0x0F: 'Write Multiple Coils',
    0x10: 'Write Multiple Registers',
    0x66: 'Firmware Update',
    0x81: 'Error: Read Coils',
    0x82: 'Error: Read Discrete Inputs',
    0x83: 'Error: Read Holding Registers',
    0x84: 'Error: Read Input Registers',
    0x85: 'Error: Write Single Coil',
    0x86: 'Error: Write Single Register',
    0x8F: 'Error: Write Multiple Coils',
    0x90: 'Error: Write Multiple Registers'
};

/**
 * Modbus Exception Code 이름
 */
export const exceptionCodeNames = {
    0x01: 'Illegal Function',
    0x02: 'Illegal Data Address',
    0x03: 'Illegal Data Value',
    0x04: 'Slave Device Failure',
    0x05: 'Acknowledge',
    0x06: 'Slave Device Busy',
    0x08: 'Memory Parity Error',
    0x0A: 'Gateway Path Unavailable',
    0x0B: 'Gateway Target Failed to Respond'
};
