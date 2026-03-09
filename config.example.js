/**
 * SpeakX Dashboards — Central Configuration
 *
 * To enable live data from Redash:
 * 1. Copy this file to config.js:  cp config.example.js config.js
 * 2. Set REDASH_USER_API_KEY to your Redash personal API key
 *    (Redash → Profile → Account → API Key)
 * 3. Ensure Redash has CORS headers enabled for your dashboard domain
 *    (Add `add_header 'Access-Control-Allow-Origin' '*';` in nginx config)
 * 4. If REDASH_USER_API_KEY is empty, dashboards use embedded snapshot data
 */
window.SPEAKX = window.SPEAKX || {};

window.SPEAKX.CONFIG = {
  REDASH_URL: 'https://redash-proxy.speakx-proxy.workers.dev',  // CORS proxy for Redash
  REDASH_USER_API_KEY: '',  // ← Your Redash user API key (Profile → Account → API Key)
  DATA_SOURCE_ID: 1,        // prod-gcp-db

  // Legacy saved query map (kept for reference)
  QUERIES: {
    d0_daily:        { id: 1270, apiKey: '', label: 'D0 Daily Conversion & Installs' },
    weekly_revenue:  { id: 1267, apiKey: '', label: 'Weekly Revenue by Payment #' },
    marketing_ads:   { id: 1124, apiKey: '', label: 'Marketing Ad Insights' },
    cohort_green:    { id: 1269, apiKey: '', label: 'Green Cohort MOM Activation' },
    ab_livekit:      { id: 1197, apiKey: '', label: 'AB Experiment Results' },
  },

  // ═══════════════════════════════════════════════
  // SQL TEMPLATES — Used by DataLoader.fetchSQL()
  // Each key maps to a dashboard dataset
  // ═══════════════════════════════════════════════
  SQL: {
    // ── D0 Funnel Dashboard ──
    d0_daily_funnel: "SELECT install_date AS dt, SUM(installs) AS installs, SUM(fs_shown) AS fs_shown, SUM(ob_completed) AS ob_completed, SUM(login_users) AS login_users, SUM(premium_load) AS premium_load, SUM(premium_ctr) AS premium_ctr, SUM(checkout_load) AS checkout_load, SUM(order_created) AS order_created, SUM(payments) AS payments, SUM(d0_cancellations) AS d0_cancellations FROM d0_conversion_funnel WHERE install_date >= CURRENT_DATE - INTERVAL '90 days' GROUP BY install_date ORDER BY install_date",

    d0_channel_funnel: "SELECT channel AS channel_group, SUM(installs) AS installs, SUM(fs_shown) AS fs_shown, SUM(ob_completed) AS ob_completed, SUM(login_users) AS login_users, SUM(premium_load) AS premium_load, SUM(checkout_load) AS checkout_load, SUM(payments) AS payments, SUM(d0_cancellations) AS d0_cancellations, ROUND(SUM(payments)*100.0/NULLIF(SUM(installs),0),2) AS cvr FROM d0_conversion_funnel WHERE install_date >= CURRENT_DATE - INTERVAL '90 days' GROUP BY channel ORDER BY SUM(installs) DESC",

    d0_weekly_funnel: "SELECT DATE_TRUNC('week', install_date)::DATE AS week_start, SUM(installs) AS installs, SUM(fs_shown) AS fs_shown, SUM(ob_completed) AS ob_completed, SUM(login_users) AS login_users, SUM(premium_load) AS premium_load, SUM(checkout_load) AS checkout_load, SUM(payments) AS payments, SUM(d0_cancellations) AS d0_cancellations, ROUND(SUM(payments)*100.0/NULLIF(SUM(installs),0),2) AS cvr FROM d0_conversion_funnel WHERE install_date >= CURRENT_DATE - INTERVAL '180 days' GROUP BY 1 ORDER BY 1",

    d0_campaign_data: "SELECT tracker_campaign_name AS campaign, channel AS channel_group, SUM(installs) AS installs, SUM(payments) AS payments, ROUND(SUM(payments)*100.0/NULLIF(SUM(installs),0),2) AS cvr, ROUND(SUM(d0_cancellations)*100.0/NULLIF(SUM(payments),0),2) AS cancel_rate FROM d0_conversion_funnel WHERE install_date >= CURRENT_DATE - INTERVAL '90 days' GROUP BY 1,2 HAVING SUM(installs) >= 500 ORDER BY SUM(installs) DESC",

    // ── Marketing Dashboard ──
    mkt_daily_channel: "SELECT install_date AS dt, CASE WHEN channel IN ('Google','Meta','Organic') THEN channel ELSE 'Other Paid' END AS channel_group, SUM(installs) AS installs, SUM(payments) AS payments, ROUND(SUM(payments)*100.0/NULLIF(SUM(installs),0),2) AS cvr FROM d0_conversion_funnel WHERE install_date >= CURRENT_DATE - INTERVAL '60 days' GROUP BY 1, 2 ORDER BY 1, 2",

    mkt_revenue_daily: "SELECT date(created_at_ist) AS dt, COUNT(*) FILTER (WHERE duration = '7') AS trial_txns, COALESCE(SUM(amount/100) FILTER (WHERE duration = '7'), 0) AS trial_revenue, COUNT(*) FILTER (WHERE duration != '7') AS monthly_txns, COALESCE(SUM(amount/100) FILTER (WHERE duration != '7'), 0) AS monthly_revenue FROM daily_payments WHERE status IN ('SUCCESS','REFUNDED') AND (payment_method != 'ADMIN_GRANT' OR payment_method IS NULL) AND amount > 100 AND created_at_ist >= CURRENT_DATE - INTERVAL '60 days' GROUP BY 1 ORDER BY 1",

    mkt_weekly_channel: "SELECT DATE_TRUNC('week', install_date)::DATE AS week_start, CASE WHEN channel IN ('Google','Meta','Organic') THEN channel ELSE 'Other Paid' END AS channel_group, SUM(installs) AS installs, SUM(payments) AS payments, ROUND(SUM(payments)*100.0/NULLIF(SUM(installs),0),2) AS cvr FROM d0_conversion_funnel WHERE install_date >= CURRENT_DATE - INTERVAL '180 days' GROUP BY 1, 2 ORDER BY 1, 2",

    mkt_lang_data: "SELECT lang, SUM(installs) AS installs, SUM(payments) AS payments, ROUND(SUM(payments)*100.0/NULLIF(SUM(installs),0),2) AS cvr FROM d0_conversion_funnel WHERE install_date >= CURRENT_DATE - INTERVAL '90 days' AND lang IS NOT NULL GROUP BY lang ORDER BY SUM(installs) DESC",

    // ── Revenue Dashboard ──
    rev_daily: "SELECT date(created_at_ist) AS dt, COALESCE(SUM(amount/100) FILTER (WHERE duration = '7'), 0) AS trial, COALESCE(SUM(amount/100) FILTER (WHERE duration != '7'), 0) AS monthly, COALESCE(SUM(amount/100), 0) AS total, COUNT(*) FILTER (WHERE duration = '7') AS \"tTxn\", COUNT(*) FILTER (WHERE duration != '7') AS \"mTxn\", COUNT(*) AS txn FROM daily_payments WHERE status IN ('SUCCESS','REFUNDED') AND (payment_method != 'ADMIN_GRANT' OR payment_method IS NULL) AND amount > 100 AND created_at_ist >= CURRENT_DATE - INTERVAL '60 days' GROUP BY 1 ORDER BY 1",

    rev_weekly: "SELECT DATE_TRUNC('week', date(created_at_ist))::DATE AS week_start, COALESCE(SUM(amount/100) FILTER (WHERE duration = '7'), 0) AS trial, COALESCE(SUM(amount/100) FILTER (WHERE duration != '7'), 0) AS monthly, COALESCE(SUM(amount/100), 0) AS total, COUNT(DISTINCT user_id) AS payers, ROUND(SUM(amount/100)::numeric / NULLIF(COUNT(DISTINCT user_id), 0), 2) AS arpu FROM daily_payments WHERE status IN ('SUCCESS','REFUNDED') AND (payment_method != 'ADMIN_GRANT' OR payment_method IS NULL) AND amount > 100 AND created_at_ist >= CURRENT_DATE - INTERVAL '180 days' GROUP BY 1 ORDER BY 1",

    rev_payment_method: "SELECT CASE WHEN payment_method ILIKE '%upi%' OR payment_method ILIKE '%gpay%' OR payment_method ILIKE '%phonepe%' OR payment_method ILIKE '%paytm%' THEN 'UPI' WHEN payment_method ILIKE '%card%' OR payment_method ILIKE '%visa%' OR payment_method ILIKE '%mastercard%' THEN 'Card' WHEN payment_method ILIKE '%net%' THEN 'NetBanking' WHEN payment_method ILIKE '%wallet%' THEN 'Wallet' ELSE COALESCE(payment_method, 'Unknown') END AS method, SUM(amount/100) AS revenue, COUNT(*) AS txns FROM daily_payments WHERE status = 'SUCCESS' AND amount > 100 AND created_at_ist >= CURRENT_DATE - INTERVAL '30 days' GROUP BY 1 ORDER BY revenue DESC",

    rev_by_type: "SELECT type AS checkout_type, duration AS plan, SUM(amount/100) AS revenue, COUNT(*) AS txns FROM daily_payments WHERE status IN ('SUCCESS','REFUNDED') AND amount > 100 AND created_at_ist >= CURRENT_DATE - INTERVAL '30 days' GROUP BY 1,2 ORDER BY revenue DESC",

    rev_success_rate: "SELECT date(created_at_ist) AS dt, COUNT(*) AS attempts, COUNT(*) FILTER (WHERE status = 'SUCCESS') AS success, ROUND(COUNT(*) FILTER (WHERE status = 'SUCCESS') * 100.0 / NULLIF(COUNT(*), 0), 1) AS success_rate FROM daily_payments WHERE amount > 100 AND created_at_ist >= CURRENT_DATE - INTERVAL '30 days' GROUP BY 1 ORDER BY 1",

    rev_providers: "SELECT payment_provider AS provider, SUM(amount/100) FILTER (WHERE status = 'SUCCESS') AS revenue, COUNT(*) FILTER (WHERE status = 'SUCCESS') AS success_txns, COUNT(*) AS total_txns, ROUND(COUNT(*) FILTER (WHERE status = 'SUCCESS') * 100.0 / NULLIF(COUNT(*), 0), 1) AS success_rate FROM daily_payments WHERE amount > 100 AND created_at_ist >= CURRENT_DATE - INTERVAL '30 days' GROUP BY 1 ORDER BY revenue DESC",

    // ── Cohort Dashboard (green cohort from trial_user_consumption) ──
    cohort_green_weekly: "SELECT DATE_TRUNC('week', trial_payment_date)::DATE AS w, COUNT(*) AS t, COUNT(*) FILTER (WHERE trial_green_cohort_users = 'Yes') AS g, ROUND(COUNT(*) FILTER (WHERE trial_green_cohort_users = 'Yes') * 100.0 / NULLIF(COUNT(*), 0), 1) AS gp, ROUND(AVG(trial_practice_days)::numeric, 2) AS pd, ROUND(AVG(d0_lesson_count + d1_lesson_count + d2_lesson_count)::numeric / NULLIF(AVG(trial_practice_days), 0), 1) AS dl FROM trial_user_consumption WHERE trial_payment_date >= CURRENT_DATE - INTERVAL '180 days' GROUP BY 1 ORDER BY 1",

    // ── AB Experiments Dashboard ──
    ab_experiment_summary: "SELECT exp.key::int AS e, exp.value::text AS b, SUM(installs) AS i, SUM(fs_shown) AS fs, SUM(ob_completed) AS ob, SUM(login_users) AS lo, SUM(checkout_load) AS ck, SUM(order_created) AS \"or\", SUM(payments) AS p, ROUND(SUM(payments)*100.0/NULLIF(SUM(installs),0),2) AS cvr FROM d0_conversion_funnel, jsonb_each_text(test_bucket) AS exp WHERE install_date >= CURRENT_DATE - INTERVAL '90 days' AND test_bucket IS NOT NULL AND jsonb_typeof(test_bucket) = 'object' AND exp.value IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 2",

    ab_daily_trend: "SELECT install_date::text AS d, exp.key::int AS e, exp.value::text AS b, ROUND(SUM(payments)*100.0/NULLIF(SUM(installs),0),2) AS c FROM d0_conversion_funnel, jsonb_each_text(test_bucket) AS exp WHERE install_date >= CURRENT_DATE - INTERVAL '30 days' AND test_bucket IS NOT NULL AND jsonb_typeof(test_bucket) = 'object' AND exp.value IS NOT NULL GROUP BY 1, 2, 3 ORDER BY 1, 2, 3",
  },

  REFRESH_INTERVAL: 0,
  DATE_FORMAT: 'en-IN',
};
