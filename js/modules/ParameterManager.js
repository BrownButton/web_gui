/**
 * ParameterManager - 파라미터 관리
 *
 * Features:
 *   - 파라미터 로드/저장 (localStorage)
 *   - CSV 가져오기/내보내기
 *   - 파라미터 읽기/쓰기
 *   - 필터링 및 검색
 */

import { EVENTS } from '../core/EventBus.js';

export class ParameterManager {
    constructor(eventBus = null, communication = null) {
        this.eventBus = eventBus;
        this.comm = communication;

        // Parameters list
        this.parameters = [];

        // Filters
        this.typeFilter = 'all';
        this.implementedFilter = 'all';
        this.searchText = '';
    }

    /**
     * Initialize parameter manager
     */
    init() {
        this.initUI();
        this.load();
    }

    /**
     * Initialize UI event listeners
     */
    initUI() {
        // Add parameter button
        const addBtn = document.getElementById('addParamBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddModal());
        }

        // Save parameter button
        const saveBtn = document.getElementById('saveParamBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveNewParameter());
        }

        // Import/Export buttons
        const importBtn = document.getElementById('importCsvBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importCSV());
        }

        const exportBtn = document.getElementById('exportCsvBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportCSV());
        }

        const loadDefaultBtn = document.getElementById('loadDefaultBtn');
        if (loadDefaultBtn) {
            loadDefaultBtn.addEventListener('click', () => this.loadDefaultCSV());
        }

        // Filter buttons
        document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.setTypeFilter(filter);
            });
        });

        // Search input
        const searchInput = document.getElementById('paramSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchText = e.target.value;
                this.render();
            });
        }
    }

    /**
     * Load parameters from localStorage
     */
    load() {
        const stored = localStorage.getItem('modbusParameters');
        if (stored) {
            try {
                this.parameters = JSON.parse(stored);
                this.render();
            } catch (e) {
                console.error('Failed to load parameters:', e);
            }
        } else {
            this.loadDefaultCSV();
        }

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.PARAM_LOADED, { count: this.parameters.length });
        }
    }

    /**
     * Save parameters to localStorage
     */
    save() {
        localStorage.setItem('modbusParameters', JSON.stringify(this.parameters));

        if (this.eventBus) {
            this.eventBus.emit(EVENTS.PARAM_SAVED, { count: this.parameters.length });
        }
    }

    /**
     * Get all parameters
     * @returns {Array}
     */
    getAll() {
        return [...this.parameters];
    }

    /**
     * Get filtered parameters
     * @returns {Array}
     */
    getFiltered() {
        return this.parameters.filter(param => {
            // Type filter
            if (this.typeFilter !== 'all' && param.type !== this.typeFilter) {
                return false;
            }

            // Implemented filter
            if (this.implementedFilter !== 'all' && param.implemented !== this.implementedFilter) {
                return false;
            }

            // Search filter
            if (this.searchText) {
                const search = this.searchText.toLowerCase();
                const nameMatch = param.name?.toLowerCase().includes(search);
                const addressMatch = param.address?.toLowerCase().includes(search);
                const descMatch = param.description?.toLowerCase().includes(search);
                if (!nameMatch && !addressMatch && !descMatch) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Set type filter
     * @param {string} filter - Filter value
     */
    setTypeFilter(filter) {
        this.typeFilter = filter;
        this.render();
    }

    /**
     * Add new parameter
     * @param {Object} param - Parameter object
     */
    add(param) {
        this.parameters.push({
            id: Date.now(),
            ...param,
            value: null,
            lastUpdate: null
        });
        this.save();
        this.render();
    }

    /**
     * Remove parameter by ID
     * @param {number} id - Parameter ID
     */
    remove(id) {
        this.parameters = this.parameters.filter(p => p.id !== id);
        this.save();
        this.render();
    }

    /**
     * Show add parameter modal
     */
    showAddModal() {
        const modal = document.getElementById('addParamModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    /**
     * Hide add parameter modal
     */
    hideAddModal() {
        const modal = document.getElementById('addParamModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Save new parameter from modal
     */
    saveNewParameter() {
        const name = document.getElementById('paramName')?.value.trim();
        const address = parseInt(document.getElementById('paramAddress')?.value) || 0;
        const functionCode = parseInt(document.getElementById('paramFunction')?.value) || 3;

        if (!name) {
            alert('Please enter a parameter name');
            return;
        }

        this.add({ name, address, functionCode });
        this.hideAddModal();
    }

    /**
     * Render parameters list
     */
    render() {
        const paramList = document.getElementById('paramList');
        const paramCount = document.getElementById('paramCount');

        if (!paramList) return;

        const filtered = this.getFiltered();

        if (paramCount) {
            paramCount.textContent = `${filtered.length} / ${this.parameters.length} parameters`;
        }

        if (filtered.length === 0) {
            paramList.innerHTML = '<p class="placeholder">No parameters match the filter criteria.</p>';
            return;
        }

        // Render would continue here - simplified for now
        paramList.innerHTML = filtered.map(param => `
            <div class="param-item" data-id="${param.id}">
                <span class="param-address">${param.address}</span>
                <span class="param-name">${param.name}</span>
                <span class="param-value">${param.value ?? '-'}</span>
            </div>
        `).join('');
    }

    /**
     * Import CSV file
     */
    importCSV() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.parseCSV(event.target.result);
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    /**
     * Parse CSV content
     * @param {string} content - CSV content
     */
    parseCSV(content) {
        const lines = content.split('\n');
        this.parameters = [];

        // Skip header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',');
            if (parts.length >= 2) {
                this.parameters.push({
                    id: Date.now() + i,
                    type: parts[0]?.trim() || 'Holding',
                    address: parts[1]?.trim() || '0',
                    name: parts[2]?.trim() || '',
                    description: parts[3]?.trim() || '',
                    unit: parts[4]?.trim() || '',
                    implemented: parts[5]?.trim() || 'N',
                    value: null,
                    lastUpdate: null
                });
            }
        }

        this.save();
        this.render();
    }

    /**
     * Export to CSV
     */
    exportCSV() {
        let csv = 'Type,Address,Name,Description,Unit,Implemented\n';

        for (const param of this.parameters) {
            csv += `${param.type},${param.address},"${param.name}","${param.description || ''}",${param.unit || ''},${param.implemented || 'N'}\n`;
        }

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'parameters.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Load default CSV
     */
    async loadDefaultCSV() {
        try {
            const response = await fetch('data/parameters.csv');
            if (response.ok) {
                const content = await response.text();
                this.parseCSV(content);
            }
        } catch (e) {
            console.error('Failed to load default CSV:', e);
        }
    }

    /**
     * Read parameter value
     * @param {Object} param - Parameter object
     * @returns {Promise<Object>}
     */
    async readParameter(param) {
        if (!this.comm) return null;

        const address = parseInt(param.address, 16) || parseInt(param.address);
        const fc = param.type === 'Input' ? 4 : 3;

        try {
            const result = await this.comm.readHoldingRegisters(1, address, 1);
            if (result.success && result.parsed?.data?.length > 0) {
                param.value = result.parsed.data[0];
                param.lastUpdate = new Date();
                this.save();
                this.render();

                if (this.eventBus) {
                    this.eventBus.emit(EVENTS.PARAM_READ, { param, value: param.value });
                }
            }
            return result;
        } catch (e) {
            console.error('Read parameter error:', e);
            return null;
        }
    }

    /**
     * Write parameter value
     * @param {Object} param - Parameter object
     * @param {number} value - Value to write
     * @returns {Promise<Object>}
     */
    async writeParameter(param, value) {
        if (!this.comm) return null;

        const address = parseInt(param.address, 16) || parseInt(param.address);

        try {
            const result = await this.comm.writeSingleRegister(1, address, value);
            if (result.success) {
                param.value = value;
                param.lastUpdate = new Date();
                this.save();
                this.render();

                if (this.eventBus) {
                    this.eventBus.emit(EVENTS.PARAM_WRITTEN, { param, value });
                }
            }
            return result;
        } catch (e) {
            console.error('Write parameter error:', e);
            return null;
        }
    }
}
