/**
 * MonitorModule - 통신 모니터 패널 관리
 *
 * Features:
 *   - 송수신 로그 표시
 *   - HEX/DEC 포맷 전환
 *   - 바이트 정보 툴팁
 *   - 가상 스크롤
 *   - 패널 리사이즈
 */

import { EVENTS } from '../core/EventBus.js';
import { formatByte, formatTimestamp, functionCodeNames, exceptionCodeNames } from '../utils/helpers.js';

export class MonitorModule {
    constructor(eventBus = null) {
        this.eventBus = eventBus;

        // Display format
        this.displayFormat = 'hex'; // 'hex' or 'dec'

        // Entry storage
        this.entries = [];
        this.maxEntries = 10000;

        // Timing
        this.lastEntryTime = null;

        // Scroll state
        this.autoScroll = true;
        this.isUserScrolling = false;
        this.newMessageCount = 0;
        this.lastScrollTop = 0;
        this.isProgrammaticScroll = false;

        // Panel state
        this.panelOpen = false;
        this.panelWidth = 400;

        // Tooltip state
        this.tooltipPinned = false;
        this.pinnedBytesContainer = null;
        this.pinnedGroup = null;

        // DOM elements
        this.monitorDisplay = null;
        this.panelElement = null;

        // Subscribe to events
        this.setupEventListeners();
    }

    /**
     * Initialize monitor module
     */
    init() {
        this.monitorDisplay = document.getElementById('monitorDisplay');
        this.panelElement = document.querySelector('.monitor-panel');

        this.initScrollControls();
        this.initResizeHandle();
        this.initFormatToggle();
        this.initPanelToggle();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.eventBus) {
            this.eventBus.on(EVENTS.FRAME_SENT, (data) => {
                this.addEntry('sent', data.frame, data.parsed);
            });

            this.eventBus.on(EVENTS.FRAME_RECEIVED, (data) => {
                this.addEntry('received', data.frame, data.parsed);
            });

            this.eventBus.on(EVENTS.FRAME_ERROR, (data) => {
                this.addEntry('error', data.frame, null, data.error);
            });

            this.eventBus.on(EVENTS.SERIAL_CONNECTED, () => {
                this.addEntry('system', 'Connected to serial port');
            });

            this.eventBus.on(EVENTS.SERIAL_DISCONNECTED, () => {
                this.addEntry('system', 'Disconnected from serial port');
            });
        }
    }

    /**
     * Add entry to monitor
     * @param {string} type - Entry type: 'sent', 'received', 'error', 'system'
     * @param {Uint8Array|string} dataOrMessage - Frame data or message string
     * @param {Object} parsedData - Parsed frame data
     * @param {string} errorMsg - Error message
     */
    addEntry(type, dataOrMessage, parsedData = null, errorMsg = null) {
        if (!this.monitorDisplay) return;

        const placeholder = this.monitorDisplay.querySelector('.placeholder');
        if (placeholder) placeholder.remove();

        const now = Date.now();
        const timestamp = new Date(now);
        const timeStr = formatTimestamp(timestamp);

        // Calculate time delta
        const delta = this.lastEntryTime ? now - this.lastEntryTime : 0;
        this.lastEntryTime = now;
        const deltaStr = delta > 0 ? `+${delta}ms` : '';

        // Create entry data
        const entryData = {
            type,
            data: dataOrMessage instanceof Uint8Array ? new Uint8Array(dataOrMessage) : dataOrMessage,
            parsedData,
            errorMsg,
            timeStr,
            deltaStr,
            timestamp: now,
            index: this.entries.length
        };

        this.entries.push(entryData);

        // Limit entries
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(-this.maxEntries);
        }

        // Update count display
        this.updateEntryCount();

        // Create DOM element
        const element = this.createEntryElement(entryData);
        this.monitorDisplay.appendChild(element);

        // Limit DOM entries
        this.trimDomEntries();

        // Handle scrolling
        this.handleAutoScroll();
    }

    /**
     * Create entry DOM element
     * @param {Object} entryData - Entry data
     * @returns {HTMLElement}
     */
    createEntryElement(entryData) {
        const { type, data, parsedData, errorMsg, timeStr, deltaStr } = entryData;

        const entry = document.createElement('div');
        entry.className = `monitor-entry ${type}`;
        entry.dataset.entryIndex = entryData.index;

        // Type label
        const typeLabels = { sent: 'TX', received: 'RX', error: 'ERROR', system: 'SYSTEM' };
        const typeLabel = typeLabels[type] || 'SYSTEM';

        const mainLine = document.createElement('div');
        mainLine.className = 'monitor-main-line';

        // Type badge
        const typeBadge = document.createElement('span');
        typeBadge.className = `monitor-type-badge ${type}`;
        typeBadge.textContent = typeLabel;
        mainLine.appendChild(typeBadge);

        // Content
        if (data instanceof Uint8Array) {
            const bytesContainer = this.createBytesContainer(data, parsedData, type);
            mainLine.appendChild(bytesContainer);

            const summary = document.createElement('span');
            summary.className = 'monitor-summary';
            summary.textContent = this.getFrameSummary(data, parsedData, type);
            mainLine.appendChild(summary);

            entry.dataset.hasDetails = 'true';
        } else {
            const messageSpan = document.createElement('span');
            messageSpan.className = 'monitor-message';
            messageSpan.textContent = errorMsg || data;
            mainLine.appendChild(messageSpan);
        }

        // Time info
        const timeInfo = document.createElement('span');
        timeInfo.className = 'monitor-time-info';

        const deltaSpan = document.createElement('span');
        deltaSpan.className = 'monitor-delta';
        deltaSpan.textContent = deltaStr;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'monitor-timestamp';
        timeSpan.textContent = timeStr;

        timeInfo.appendChild(deltaSpan);
        timeInfo.appendChild(timeSpan);
        mainLine.appendChild(timeInfo);

        entry.appendChild(mainLine);

        // Add expandable details
        if (entry.dataset.hasDetails === 'true') {
            const details = this.createDetailsElement(data, parsedData, type, timeStr, deltaStr);
            entry.appendChild(details);

            entry.addEventListener('click', (e) => {
                if (e.target.classList.contains('monitor-byte')) return;
                if (e.target.closest('.monitor-raw-container')) return;
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) return;
                entry.classList.toggle('expanded');
            });
        }

        return entry;
    }

    /**
     * Create bytes container with highlighting
     * @param {Uint8Array} data - Frame data
     * @param {Object} parsedData - Parsed data
     * @param {string} type - Entry type
     * @returns {HTMLElement}
     */
    createBytesContainer(data, parsedData, type) {
        const bytesContainer = document.createElement('span');
        bytesContainer.className = 'monitor-bytes';

        const byteInfo = this.getByteInfo(data, parsedData, type);

        Array.from(data).forEach((byte, index) => {
            const info = byteInfo[index] || { name: 'Unknown', desc: '', class: 'byte-unknown' };

            // Add separator between different byte groups
            if (index > 0 && !info.grouped) {
                const prevInfo = byteInfo[index - 1];
                if (prevInfo && prevInfo.class !== info.class) {
                    const separator = document.createElement('span');
                    separator.className = 'monitor-byte-separator';
                    bytesContainer.appendChild(separator);
                }
            }

            const byteSpan = document.createElement('span');
            byteSpan.className = `monitor-byte ${info.class || ''}`;
            byteSpan.textContent = this.formatByteValue(byte);
            byteSpan.dataset.index = index;
            byteSpan.dataset.value = byte;

            if (info.group) {
                byteSpan.dataset.group = info.group.join(',');
            }

            // Event listeners for tooltip
            byteSpan.addEventListener('mouseenter', (e) => {
                if (!this.tooltipPinned) {
                    this.highlightGroup(bytesContainer, info.group, true);
                    this.showTooltip(e, info, byte, index);
                }
            });

            byteSpan.addEventListener('mousemove', (e) => {
                if (!this.tooltipPinned) {
                    this.moveTooltip(e);
                }
            });

            byteSpan.addEventListener('mouseleave', (e) => {
                if (!this.tooltipPinned) {
                    this.highlightGroup(bytesContainer, info.group, false);
                    this.hideTooltip();
                }
            });

            byteSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                this.pinTooltip(bytesContainer, info, byte, index, e);
            });

            bytesContainer.appendChild(byteSpan);
        });

        return bytesContainer;
    }

    /**
     * Get byte information for frame
     * @param {Uint8Array} frame - Frame data
     * @param {Object} parsedData - Parsed data
     * @param {string} type - Entry type
     * @returns {Array}
     */
    getByteInfo(frame, parsedData, type) {
        const info = [];

        if (frame.length < 4) {
            for (let i = 0; i < frame.length; i++) {
                info[i] = { name: 'Data', desc: '', class: 'byte-data' };
            }
            return info;
        }

        // Slave ID
        info[0] = {
            name: 'Slave ID',
            desc: `Device address: ${frame[0]}`,
            class: 'byte-slave',
            group: [0]
        };

        // Function Code
        const fc = frame[1];
        const isError = (fc & 0x80) !== 0;
        const baseFc = isError ? fc & 0x7F : fc;

        info[1] = {
            name: 'Function Code',
            desc: isError
                ? `Error response for FC ${baseFc}`
                : functionCodeNames[fc] || `FC ${fc}`,
            class: isError ? 'byte-error' : 'byte-function',
            group: [1]
        };

        // Data bytes
        const dataEnd = frame.length - 2;
        for (let i = 2; i < dataEnd; i++) {
            info[i] = {
                name: 'Data',
                desc: `Byte ${i - 2} of data section`,
                class: 'byte-data',
                group: Array.from({ length: dataEnd - 2 }, (_, j) => j + 2)
            };
        }

        // CRC
        if (frame.length >= 4) {
            const crcLo = frame.length - 2;
            const crcHi = frame.length - 1;
            const crcValue = frame[crcLo] | (frame[crcHi] << 8);

            info[crcLo] = {
                name: 'CRC Low',
                desc: `CRC-16: 0x${crcValue.toString(16).toUpperCase().padStart(4, '0')}`,
                class: 'byte-crc',
                group: [crcLo, crcHi],
                grouped: true
            };
            info[crcHi] = {
                name: 'CRC High',
                desc: `CRC-16: 0x${crcValue.toString(16).toUpperCase().padStart(4, '0')}`,
                class: 'byte-crc',
                group: [crcLo, crcHi],
                grouped: true
            };
        }

        return info;
    }

    /**
     * Get frame summary string
     * @param {Uint8Array} frame - Frame data
     * @param {Object} parsedData - Parsed data
     * @param {string} type - Entry type
     * @returns {string}
     */
    getFrameSummary(frame, parsedData, type) {
        if (frame.length < 2) return '';

        const slaveId = frame[0];
        const fc = frame[1];
        const isError = (fc & 0x80) !== 0;

        if (isError) {
            const exCode = frame[2];
            return `ID:${slaveId} Error FC${fc & 0x7F} - ${exceptionCodeNames[exCode] || 'Unknown'}`;
        }

        const fcName = functionCodeNames[fc] || `FC${fc}`;

        if (type === 'sent') {
            if (frame.length >= 6) {
                const addr = (frame[2] << 8) | frame[3];
                const qty = (frame[4] << 8) | frame[5];
                return `ID:${slaveId} ${fcName} @${addr} x${qty}`;
            }
        } else if (type === 'received') {
            if (parsedData && parsedData.data) {
                const dataLen = parsedData.data.length;
                return `ID:${slaveId} ${fcName} [${dataLen} values]`;
            }
        }

        return `ID:${slaveId} ${fcName}`;
    }

    /**
     * Create details element
     * @param {Uint8Array} frame - Frame data
     * @param {Object} parsedData - Parsed data
     * @param {string} type - Entry type
     * @param {string} timeStr - Time string
     * @param {string} deltaStr - Delta string
     * @returns {HTMLElement}
     */
    createDetailsElement(frame, parsedData, type, timeStr, deltaStr) {
        const details = document.createElement('div');
        details.className = 'monitor-details';

        // Raw data
        const rawHex = Array.from(frame).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        const rawDec = Array.from(frame).join(' ');

        let html = `
            <div class="monitor-detail-row">
                <span class="label">Time:</span>
                <span class="value">${timeStr} ${deltaStr}</span>
            </div>
            <div class="monitor-detail-row">
                <span class="label">Length:</span>
                <span class="value">${frame.length} bytes</span>
            </div>
            <div class="monitor-detail-row">
                <span class="label">HEX:</span>
                <span class="value monitor-raw-container" data-raw="${rawHex}">${rawHex}</span>
            </div>
            <div class="monitor-detail-row">
                <span class="label">DEC:</span>
                <span class="value">${rawDec}</span>
            </div>
        `;

        // Parsed data
        if (parsedData && parsedData.data && parsedData.data.length > 0) {
            html += `
                <div class="monitor-detail-row">
                    <span class="label">Values:</span>
                    <span class="value">${parsedData.data.join(', ')}</span>
                </div>
            `;
        }

        details.innerHTML = html;
        return details;
    }

    /**
     * Format byte value based on current format
     * @param {number} byte - Byte value
     * @returns {string}
     */
    formatByteValue(byte) {
        return this.displayFormat === 'hex'
            ? byte.toString(16).toUpperCase().padStart(2, '0')
            : byte.toString().padStart(3, ' ');
    }

    /**
     * Set display format
     * @param {string} format - 'hex' or 'dec'
     */
    setDisplayFormat(format) {
        this.displayFormat = format;
        this.refreshDisplay();
    }

    /**
     * Refresh display with current format
     */
    refreshDisplay() {
        if (!this.monitorDisplay) return;

        const bytes = this.monitorDisplay.querySelectorAll('.monitor-byte');
        bytes.forEach(byteSpan => {
            const value = parseInt(byteSpan.dataset.value);
            byteSpan.textContent = this.formatByteValue(value);
        });
    }

    /**
     * Highlight byte group
     * @param {HTMLElement} container - Bytes container
     * @param {Array} group - Group indices
     * @param {boolean} highlight - Highlight state
     */
    highlightGroup(container, group, highlight) {
        if (!group || !container) return;

        container.querySelectorAll('.monitor-byte').forEach(byte => {
            const index = parseInt(byte.dataset.index);
            if (group.includes(index)) {
                byte.classList.toggle('highlight', highlight);
            }
        });
    }

    /**
     * Show tooltip
     * @param {Event} e - Mouse event
     * @param {Object} info - Byte info
     * @param {number} value - Byte value
     * @param {number} index - Byte index
     */
    showTooltip(e, info, value, index) {
        let tooltip = document.getElementById('byteTooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'byteTooltip';
            tooltip.className = 'byte-tooltip';
            document.body.appendChild(tooltip);
        }

        tooltip.innerHTML = `
            <div class="tooltip-title">${info.name}</div>
            <div class="tooltip-value">
                HEX: 0x${value.toString(16).toUpperCase().padStart(2, '0')} |
                DEC: ${value} |
                BIN: ${value.toString(2).padStart(8, '0')}
            </div>
            ${info.desc ? `<div class="tooltip-desc">${info.desc}</div>` : ''}
        `;

        this.positionTooltip(tooltip, e);
        tooltip.classList.add('visible');
    }

    /**
     * Move tooltip
     * @param {Event} e - Mouse event
     */
    moveTooltip(e) {
        const tooltip = document.getElementById('byteTooltip');
        if (tooltip && tooltip.classList.contains('visible')) {
            this.positionTooltip(tooltip, e);
        }
    }

    /**
     * Position tooltip near mouse
     * @param {HTMLElement} tooltip - Tooltip element
     * @param {Event} e - Mouse event
     */
    positionTooltip(tooltip, e) {
        const x = e.clientX + 15;
        const y = e.clientY - 10;

        const rect = tooltip.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width - 10;
        const maxY = window.innerHeight - rect.height - 10;

        tooltip.style.left = Math.min(x, maxX) + 'px';
        tooltip.style.top = Math.min(y, maxY) + 'px';
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById('byteTooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
        }
    }

    /**
     * Pin tooltip
     * @param {HTMLElement} container - Bytes container
     * @param {Object} info - Byte info
     * @param {number} value - Byte value
     * @param {number} index - Byte index
     * @param {Event} e - Click event
     */
    pinTooltip(container, info, value, index, e) {
        if (this.tooltipPinned && this.pinnedBytesContainer === container) {
            this.unpinTooltip();
            return;
        }

        this.unpinTooltip();

        this.tooltipPinned = true;
        this.pinnedBytesContainer = container;
        this.pinnedGroup = info.group;

        this.highlightGroup(container, info.group, true);
        this.showTooltip(e, info, value, index);

        const tooltip = document.getElementById('byteTooltip');
        if (tooltip) {
            tooltip.classList.add('pinned');
        }
    }

    /**
     * Unpin tooltip
     */
    unpinTooltip() {
        if (this.tooltipPinned) {
            this.highlightGroup(this.pinnedBytesContainer, this.pinnedGroup, false);
            this.hideTooltip();

            const tooltip = document.getElementById('byteTooltip');
            if (tooltip) {
                tooltip.classList.remove('pinned');
            }

            this.tooltipPinned = false;
            this.pinnedBytesContainer = null;
            this.pinnedGroup = null;
        }
    }

    /**
     * Initialize scroll controls
     */
    initScrollControls() {
        if (!this.monitorDisplay) return;

        const scrollBtn = document.getElementById('monitorScrollBtn');

        this.monitorDisplay.addEventListener('scroll', () => {
            if (this.isProgrammaticScroll) return;

            const currentScrollTop = this.monitorDisplay.scrollTop;
            const isAtBottom = this.monitorDisplay.scrollHeight - currentScrollTop - this.monitorDisplay.clientHeight < 50;
            const scrolledDown = currentScrollTop > this.lastScrollTop;

            if (isAtBottom && scrolledDown) {
                this.isUserScrolling = false;
                this.newMessageCount = 0;
            } else if (currentScrollTop < this.lastScrollTop) {
                this.isUserScrolling = true;
            }

            this.lastScrollTop = currentScrollTop;
            this.updateScrollButton();
        });

        if (scrollBtn) {
            scrollBtn.addEventListener('click', () => {
                this.scrollToBottom();
            });
        }
    }

    /**
     * Handle auto scroll
     */
    handleAutoScroll() {
        if (this.autoScroll && !this.isUserScrolling) {
            this.scrollToBottom();
        } else {
            this.newMessageCount++;
            this.updateScrollButton();
        }
    }

    /**
     * Scroll to bottom
     */
    scrollToBottom() {
        if (!this.monitorDisplay) return;

        this.isProgrammaticScroll = true;
        this.monitorDisplay.scrollTop = this.monitorDisplay.scrollHeight;
        this.isUserScrolling = false;
        this.newMessageCount = 0;
        this.lastScrollTop = this.monitorDisplay.scrollTop;
        this.updateScrollButton();
        this.isProgrammaticScroll = false;
    }

    /**
     * Update scroll button visibility
     */
    updateScrollButton() {
        const scrollBtn = document.getElementById('monitorScrollBtn');
        const countEl = document.getElementById('newMessageCount');

        if (!scrollBtn) return;

        scrollBtn.classList.toggle('visible', this.isUserScrolling);

        if (countEl) {
            countEl.textContent = this.newMessageCount > 99 ? '99+' : this.newMessageCount;
            countEl.style.display = this.newMessageCount > 0 ? 'inline' : 'none';
        }
    }

    /**
     * Trim DOM entries to limit
     */
    trimDomEntries() {
        if (!this.monitorDisplay) return;

        const maxDomEntries = 200;
        const excessCount = this.monitorDisplay.children.length - maxDomEntries;

        if (excessCount > 0) {
            for (let i = 0; i < excessCount; i++) {
                this.monitorDisplay.removeChild(this.monitorDisplay.firstChild);
            }
        }
    }

    /**
     * Update entry count display
     */
    updateEntryCount() {
        const countEl = document.getElementById('monitorEntryCount');
        if (countEl) {
            countEl.textContent = `${this.entries.length} packets`;
        }
    }

    /**
     * Initialize format toggle
     */
    initFormatToggle() {
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.dataset.format;
                this.setDisplayFormat(format);

                document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    /**
     * Initialize panel toggle
     */
    initPanelToggle() {
        const toggleBtn = document.getElementById('monitorToggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.togglePanel();
            });
        }
    }

    /**
     * Initialize resize handle
     */
    initResizeHandle() {
        const handle = document.getElementById('monitorResizeHandle');
        if (!handle || !this.panelElement) return;

        let startX, startWidth;

        const onMouseMove = (e) => {
            const dx = startX - e.clientX;
            const newWidth = Math.min(Math.max(startWidth + dx, 300), 800);
            this.panelWidth = newWidth;
            this.panelElement.style.width = newWidth + 'px';
            document.documentElement.style.setProperty('--monitor-panel-width', newWidth + 'px');
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            localStorage.setItem('monitorPanelWidth', this.panelWidth);
        };

        handle.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startWidth = this.panelElement.offsetWidth;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    /**
     * Toggle panel open/close
     */
    togglePanel() {
        this.panelOpen = !this.panelOpen;

        if (this.panelElement) {
            this.panelElement.classList.toggle('open', this.panelOpen);
        }

        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.classList.toggle('monitor-open', this.panelOpen);
        }

        localStorage.setItem('monitorPanelOpen', this.panelOpen);

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.MONITOR_TOGGLE, { open: this.panelOpen });
        }
    }

    /**
     * Open panel
     */
    openPanel() {
        if (!this.panelOpen) {
            this.togglePanel();
        }
    }

    /**
     * Close panel
     */
    closePanel() {
        if (this.panelOpen) {
            this.togglePanel();
        }
    }

    /**
     * Clear all entries
     */
    clear() {
        this.entries = [];
        this.lastEntryTime = null;

        if (this.monitorDisplay) {
            this.monitorDisplay.innerHTML = '<div class="placeholder">Waiting for data...</div>';
        }

        this.updateEntryCount();
    }

    /**
     * Load state from localStorage
     */
    load() {
        const panelOpen = localStorage.getItem('monitorPanelOpen');
        const panelWidth = localStorage.getItem('monitorPanelWidth');

        if (panelWidth) {
            this.panelWidth = parseInt(panelWidth);
            if (this.panelElement) {
                this.panelElement.style.width = this.panelWidth + 'px';
            }
        }

        if (panelOpen === 'true') {
            setTimeout(() => this.openPanel(), 100);
        }
    }
}
