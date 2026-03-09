/**
 * SpeakX Dashboards — Shared Module
 * Data fetching, filter management, and common utilities
 */
window.SPEAKX = window.SPEAKX || {};

// ═══════════════════════════════════════════════
// DATA FETCHING — Redash API with fallback
// ═══════════════════════════════════════════════
window.SPEAKX.DataLoader = {
  _cache: {},

  /**
   * Fetch query results from Redash, falling back to embedded data.
   * @param {string} queryName — key in CONFIG.QUERIES
   * @returns {Promise<Array|null>} — array of row objects, or null if unavailable
   */
  async fetch(queryName) {
    const cfg = window.SPEAKX.CONFIG;
    if (!cfg || !cfg.REDASH_URL) return null;

    const q = cfg.QUERIES[queryName];
    if (!q || !q.apiKey) return null;

    const cacheKey = queryName + '_' + q.id;
    if (this._cache[cacheKey]) return this._cache[cacheKey];

    try {
      const url = cfg.REDASH_URL + '/api/queries/' + q.id + '/results.json?api_key=' + q.apiKey;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const rows = json.query_result?.data?.rows || [];
      this._cache[cacheKey] = rows;
      return rows;
    } catch (err) {
      console.warn('[SpeakX] Failed to fetch ' + queryName + ': ' + err.message + '. Using embedded data.');
      return null;
    }
  },

  /** Force-refresh a query (bypasses cache) */
  async refresh(queryName) {
    const cfg = window.SPEAKX.CONFIG;
    var cacheKey = queryName + '_' + (cfg?.QUERIES?.[queryName]?.id || '');
    delete this._cache[cacheKey];
    return this.fetch(queryName);
  },

  /**
   * Execute a SQL template from CONFIG.SQL via Redash API.
   * Requires REDASH_USER_API_KEY in config.
   * @param {string} sqlKey — key in CONFIG.SQL
   * @returns {Promise<Array|null>} — array of row objects, or null on failure
   */
  async fetchSQL(sqlKey) {
    var cfg = window.SPEAKX.CONFIG;
    if (!cfg || !cfg.REDASH_URL || !cfg.REDASH_USER_API_KEY) return null;

    var sql = cfg.SQL && cfg.SQL[sqlKey];
    if (!sql) return null;

    var cacheKey = 'sql_' + sqlKey;
    if (this._cache[cacheKey]) return this._cache[cacheKey];

    try {
      var url = cfg.REDASH_URL + '/api/query_results';
      var res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Key ' + cfg.REDASH_USER_API_KEY
        },
        body: JSON.stringify({
          data_source_id: cfg.DATA_SOURCE_ID || 1,
          query: sql,
          max_age: 1800
        })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var json = await res.json();

      // If Redash returned a job (query is executing), poll for results
      if (json.job) {
        json = await this._pollJob(json.job.id, cfg);
      }

      var rows = json.query_result && json.query_result.data && json.query_result.data.rows || [];
      this._cache[cacheKey] = rows;
      return rows;
    } catch (err) {
      console.warn('[SpeakX] fetchSQL(' + sqlKey + ') failed: ' + err.message);
      return null;
    }
  },

  /** Poll a Redash job until it completes */
  async _pollJob(jobId, cfg) {
    var maxAttempts = 60;
    for (var i = 0; i < maxAttempts; i++) {
      await new Promise(function(r) { setTimeout(r, 1000); });
      var res = await fetch(cfg.REDASH_URL + '/api/jobs/' + jobId, {
        headers: { 'Authorization': 'Key ' + cfg.REDASH_USER_API_KEY }
      });
      var json = await res.json();
      var status = json.job && json.job.status;
      if (status === 3) {
        var resultId = json.job.query_result_id;
        var resResult = await fetch(cfg.REDASH_URL + '/api/query_results/' + resultId, {
          headers: { 'Authorization': 'Key ' + cfg.REDASH_USER_API_KEY }
        });
        return await resResult.json();
      }
      if (status === 4 || status === 5) {
        throw new Error('Query failed: ' + (json.job.error || 'unknown'));
      }
    }
    throw new Error('Query timed out after ' + maxAttempts + 's');
  },

  /** Clear all cached data (used by Refresh button) */
  clearCache() {
    this._cache = {};
  }
};


// ═══════════════════════════════════════════════
// FILTER ENGINE — Creates filter bars and manages state
// ═══════════════════════════════════════════════
window.SPEAKX.Filters = {
  _state: {},
  _onChange: null,

  /**
   * Initialize a filter bar inside a container element.
   * @param {string} containerId — DOM element ID for the filter bar
   * @param {Array} filterDefs — array of filter definitions
   * @param {Function} onChange — callback(filterState) when any filter changes
   *
   * Filter definition shapes:
   *   { type:'dateRange', key:'dateRange', label:'Date Range', defaultDays:30 }
   *   { type:'select', key:'channel', label:'Channel', options:[{value,text},...] }
   *   { type:'multiSelect', key:'platforms', label:'Platform', options:[{value,text},...] }
   */
  init(containerId, filterDefs, onChange) {
    this._onChange = onChange;
    const container = document.getElementById(containerId);
    if (!container) return;

    // Build filter bar using DOM API
    const bar = document.createElement('div');
    bar.className = 'spx-filter-bar';

    filterDefs.forEach(f => {
      const group = document.createElement('div');
      group.className = 'spx-filter-group';

      const label = document.createElement('label');
      label.className = 'spx-filter-label';
      label.textContent = f.label;
      group.appendChild(label);

      if (f.type === 'dateRange') {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - (f.defaultDays || 30));
        const fmtDate = d => d.toISOString().slice(0, 10);
        this._state[f.key] = { start: fmtDate(start), end: fmtDate(end) };

        const wrap = document.createElement('div');
        wrap.className = 'spx-date-inputs';

        const startInput = document.createElement('input');
        startInput.type = 'date';
        startInput.className = 'spx-input';
        startInput.id = 'spx-f-' + f.key + '-start';
        startInput.value = fmtDate(start);

        const sep = document.createElement('span');
        sep.className = 'spx-date-sep';
        sep.textContent = 'to';

        const endInput = document.createElement('input');
        endInput.type = 'date';
        endInput.className = 'spx-input';
        endInput.id = 'spx-f-' + f.key + '-end';
        endInput.value = fmtDate(end);

        wrap.appendChild(startInput);
        wrap.appendChild(sep);
        wrap.appendChild(endInput);
        group.appendChild(wrap);

        startInput.addEventListener('change', () => {
          this._state[f.key].start = startInput.value;
          this._fireChange();
        });
        endInput.addEventListener('change', () => {
          this._state[f.key].end = endInput.value;
          this._fireChange();
        });
      }
      else if (f.type === 'select') {
        this._state[f.key] = f.options[0]?.value || 'all';
        const select = document.createElement('select');
        select.className = 'spx-input spx-select';
        select.id = 'spx-f-' + f.key;
        f.options.forEach(o => {
          const opt = document.createElement('option');
          opt.value = o.value;
          opt.textContent = o.text;
          select.appendChild(opt);
        });
        group.appendChild(select);
        select.addEventListener('change', () => {
          this._state[f.key] = select.value;
          this._fireChange();
        });
      }
      else if (f.type === 'multiSelect') {
        this._state[f.key] = f.options.map(o => o.value);
        const chipGroup = document.createElement('div');
        chipGroup.className = 'spx-chip-group';
        chipGroup.id = 'spx-f-' + f.key;
        f.options.forEach(o => {
          const btn = document.createElement('button');
          btn.className = 'spx-chip active';
          btn.dataset.key = f.key;
          btn.dataset.value = o.value;
          btn.textContent = o.text;
          btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            this._state[f.key] = [...chipGroup.querySelectorAll('.spx-chip.active')].map(c => c.dataset.value);
            this._fireChange();
          });
          chipGroup.appendChild(btn);
        });
        group.appendChild(chipGroup);
      }

      bar.appendChild(group);
    });

    // Action buttons (blur toggle + refresh)
    const actGroup = document.createElement('div');
    actGroup.className = 'spx-filter-group spx-filter-actions';

    // Blur toggle button
    const blurBtn = document.createElement('button');
    blurBtn.className = 'spx-btn-blur';
    blurBtn.id = 'spx-blur-toggle';
    blurBtn.title = 'Hide sensitive numbers (Ctrl+B)';
    blurBtn.textContent = '\uD83D\uDC41 Hide Numbers';
    var isBlurred = localStorage.getItem('spx-blur') === '1';
    if (isBlurred) {
      document.body.classList.add('spx-blur-active');
      blurBtn.classList.add('active');
      blurBtn.textContent = '\uD83D\uDC41\u200D\uD83D\uDDE8 Numbers Hidden';
    }
    blurBtn.addEventListener('click', function() {
      document.body.classList.toggle('spx-blur-active');
      var on = document.body.classList.contains('spx-blur-active');
      localStorage.setItem('spx-blur', on ? '1' : '0');
      blurBtn.classList.toggle('active', on);
      blurBtn.textContent = on ? '\uD83D\uDC41\u200D\uD83D\uDDE8 Numbers Hidden' : '\uD83D\uDC41 Hide Numbers';
    });
    actGroup.appendChild(blurBtn);

    // Refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'spx-btn-refresh';
    refreshBtn.id = 'spx-refresh';
    refreshBtn.title = 'Refresh data from Redash';
    refreshBtn.textContent = '\u21BB Refresh';
    refreshBtn.addEventListener('click', () => {
      window.SPEAKX.DataLoader._cache = {};
      this._fireChange();
      this.setStatus('Refreshing data...', 'loading');
    });
    actGroup.appendChild(refreshBtn);
    bar.appendChild(actGroup);

    // Keyboard shortcut: Ctrl+B toggles blur
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        blurBtn.click();
      }
    });

    container.appendChild(bar);

    // Data status indicator
    const status = document.createElement('div');
    status.className = 'spx-data-status';
    status.id = 'spx-data-status';
    container.appendChild(status);
  },

  /** Get current filter state */
  getState() { return JSON.parse(JSON.stringify(this._state)); },

  /** Set the data status message */
  setStatus(text, type) {
    const el = document.getElementById('spx-data-status');
    if (!el) return;
    var icon = type === 'live' ? '\uD83D\uDFE2' : type === 'snapshot' ? '\uD83D\uDFE1' : type === 'loading' ? '\u23F3' : '\uD83D\uDD34';
    el.textContent = '';
    var span = document.createElement('span');
    span.className = 'spx-status-dot';
    span.textContent = icon;
    el.appendChild(span);
    el.appendChild(document.createTextNode(' ' + text));
    el.className = 'spx-data-status spx-status-' + (type || 'info');
  },

  _fireChange() {
    if (this._onChange) this._onChange(this.getState());
  }
};


// ═══════════════════════════════════════════════
// DATA FILTERING — Apply filter state to datasets
// ═══════════════════════════════════════════════
window.SPEAKX.FilterData = {
  /**
   * Filter an array of objects by date range.
   * @param {Array} data — row objects
   * @param {string} dateField — key containing the date string
   * @param {object} range — { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
   */
  byDateRange(data, dateField, range) {
    if (!range || !range.start || !range.end) return data;
    return data.filter(function(row) {
      var d = row[dateField];
      return d >= range.start && d <= range.end;
    });
  },

  /**
   * Filter by a single-select value.
   * @param {Array} data
   * @param {string} field — key in each row
   * @param {string} value — selected value ('all' = no filter)
   */
  bySelect(data, field, value) {
    if (!value || value === 'all') return data;
    return data.filter(function(row) { return row[field] === value; });
  },

  /**
   * Filter by multi-select values.
   * @param {Array} data
   * @param {string} field
   * @param {Array<string>} values
   */
  byMultiSelect(data, field, values) {
    if (!values || values.length === 0) return [];
    return data.filter(function(row) { return values.indexOf(row[field]) !== -1; });
  }
};


// ═══════════════════════════════════════════════
// COMMON UTILITIES
// ═══════════════════════════════════════════════
window.SPEAKX.Utils = {
  /** Format large numbers Indian-style (L, K) */
  fN: function(n) {
    if (n >= 10000000) return (n / 10000000).toFixed(2) + 'Cr';
    if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString('en-IN');
  },

  /** Format currency (INR) */
  fCur: function(v) {
    if (v >= 1e7) return '\u20B9' + (v / 1e7).toFixed(2) + 'Cr';
    if (v >= 1e5) return '\u20B9' + (v / 1e5).toFixed(1) + 'L';
    if (v >= 1e3) return '\u20B9' + (v / 1e3).toFixed(1) + 'K';
    return '\u20B9' + v.toFixed(0);
  },

  /** Percentage helper */
  pct: function(a, b) { return b ? ((a / b) * 100).toFixed(1) : '0'; },

  /** Short date (e.g., "3 Feb") */
  shortDate: function(s) {
    var d = new Date(s + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  },

  /** Destroy a Chart.js instance safely */
  destroyChart: function(chartRef) {
    if (chartRef && typeof chartRef.destroy === 'function') chartRef.destroy();
    return null;
  }
};
