/**
 * SpeakX Dashboards — Central Configuration
 *
 * To enable live data from Redash:
 * 1. Set REDASH_URL to your Redash instance (e.g., 'https://redash.yourdomain.com')
 * 2. Ensure Redash has CORS headers enabled for your dashboard domain
 *    (Add `add_header 'Access-Control-Allow-Origin' '*';` in nginx config)
 * 3. If REDASH_URL is empty, dashboards fall back to embedded snapshot data
 */
window.SPEAKX = window.SPEAKX || {};

window.SPEAKX.CONFIG = {
  REDASH_URL: '', // ← Set your Redash URL here

  // Query map: each entry has the saved query ID and its public API key
  QUERIES: {
    d0_daily:        { id: 1270, apiKey: 'TEqLkrWQB9ZQLqllklqt9gM1MrYnmsqXTJCAlgTX', label: 'D0 Daily Conversion & Installs' },
    weekly_revenue:  { id: 1267, apiKey: 'OchEW33UF8AvmMZtfXcASy9okBLWm3GNAgBOs7ON', label: 'Weekly Revenue by Payment #' },
    marketing_ads:   { id: 1124, apiKey: 'r0dugFjEzMVTocQourXYsKhMVm2yEHa75wVUyDbp', label: 'Marketing Ad Insights' },
    cohort_green:    { id: 1269, apiKey: '', label: 'Green Cohort MOM Activation' },
    ab_livekit:      { id: 1197, apiKey: '9jwuaHXoXEgWmY8n3M5pl9c3e1BsL5sfozJMWsm0', label: 'AB Experiment Results' },
  },

  // Refresh interval in minutes (0 = manual only)
  REFRESH_INTERVAL: 0,

  // Date format helpers
  DATE_FORMAT: 'en-IN',
};
