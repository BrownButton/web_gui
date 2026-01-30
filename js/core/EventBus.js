/**
 * EventBus - 모듈 간 느슨한 결합을 위한 이벤트 버스
 *
 * 사용법:
 *   eventBus.on('event:name', callback)    // 구독
 *   eventBus.off('event:name', callback)   // 구독 해제
 *   eventBus.emit('event:name', data)      // 이벤트 발행
 *   eventBus.once('event:name', callback)  // 일회성 구독
 */

// 이벤트 상수 정의
export const EVENTS = {
    // 시리얼 통신
    SERIAL_CONNECTED: 'serial:connected',
    SERIAL_DISCONNECTED: 'serial:disconnected',
    SERIAL_ERROR: 'serial:error',

    // Modbus 프레임
    FRAME_SENT: 'frame:sent',
    FRAME_RECEIVED: 'frame:received',
    FRAME_ERROR: 'frame:error',
    FRAME_TIMEOUT: 'frame:timeout',

    // 장치 관리
    DEVICE_ADDED: 'device:added',
    DEVICE_REMOVED: 'device:removed',
    DEVICE_UPDATED: 'device:updated',
    DEVICE_SELECTED: 'device:selected',
    DEVICE_DESELECTED: 'device:deselected',

    // 자동 스캔
    SCAN_STARTED: 'scan:started',
    SCAN_PROGRESS: 'scan:progress',
    SCAN_FOUND: 'scan:found',
    SCAN_COMPLETED: 'scan:completed',
    SCAN_ABORTED: 'scan:aborted',

    // 폴링
    POLLING_STARTED: 'polling:started',
    POLLING_STOPPED: 'polling:stopped',
    POLLING_TICK: 'polling:tick',

    // 통계
    STATS_UPDATED: 'stats:updated',
    STATS_RESET: 'stats:reset',

    // 파라미터
    PARAM_LOADED: 'param:loaded',
    PARAM_SAVED: 'param:saved',
    PARAM_READ: 'param:read',
    PARAM_WRITTEN: 'param:written',

    // 펌웨어
    FIRMWARE_STARTED: 'firmware:started',
    FIRMWARE_PROGRESS: 'firmware:progress',
    FIRMWARE_COMPLETE: 'firmware:complete',
    FIRMWARE_ERROR: 'firmware:error',
    FIRMWARE_CANCELLED: 'firmware:cancelled',

    // 차트
    CHART_STARTED: 'chart:started',
    CHART_STOPPED: 'chart:stopped',
    CHART_DATA: 'chart:data',

    // 설정
    SETTINGS_CHANGED: 'settings:changed',
    SETTINGS_LOADED: 'settings:loaded',

    // UI
    PAGE_CHANGED: 'page:changed',
    TOAST_SHOW: 'toast:show',
    MONITOR_TOGGLE: 'monitor:toggle',

    // 시뮬레이터
    SIMULATOR_ENABLED: 'simulator:enabled',
    SIMULATOR_DISABLED: 'simulator:disabled'
};

export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * 이벤트 구독
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     * @returns {Function} 구독 해제 함수
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // 구독 해제 함수 반환
        return () => this.off(event, callback);
    }

    /**
     * 이벤트 구독 해제
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
            if (this.listeners.get(event).size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    /**
     * 이벤트 발행
     * @param {string} event - 이벤트 이름
     * @param {*} data - 전달할 데이터
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`EventBus: Error in listener for "${event}":`, error);
                }
            });
        }
    }

    /**
     * 일회성 이벤트 구독
     * @param {string} event - 이벤트 이름
     * @param {Function} callback - 콜백 함수
     * @returns {Function} 구독 해제 함수
     */
    once(event, callback) {
        const onceWrapper = (data) => {
            this.off(event, onceWrapper);
            callback(data);
        };
        return this.on(event, onceWrapper);
    }

    /**
     * 특정 이벤트의 모든 리스너 제거
     * @param {string} event - 이벤트 이름
     */
    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    /**
     * 특정 이벤트의 리스너 수 반환
     * @param {string} event - 이벤트 이름
     * @returns {number} 리스너 수
     */
    listenerCount(event) {
        return this.listeners.has(event) ? this.listeners.get(event).size : 0;
    }
}

// 싱글톤 인스턴스 (선택적 사용)
export const eventBus = new EventBus();
