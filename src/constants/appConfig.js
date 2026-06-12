// src/constants/appConfig.js
// Application-wide fixed constants for Lucira POS.
// Source of truth: API_MAPPING.md and ARCHITECTURE.md

const APP_CONFIG = {

  // ── METAL TYPE IDs ───────────────────────────────────────
  // Fixed constants defined by OrnaVerse — never change these
  METAL_TYPES: {
    GOLD:      106,
    SILVER:    107,
    PLATINUM:  108,
    PALLADIUM: 109,
    ALLOY:     111,
  },

  // ── CURRENCY ─────────────────────────────────────────────
  CURRENCY: {
    INR_ID: 103,
    INR_CODE: 'INR',
    INR_SYMBOL: '₹',
  },

  // ── AUTH ─────────────────────────────────────────────────
  AUTH: {
    CLIENT_ID:  'api_access',
    SCOPE:      'openid offline_access',
    GRANT_TYPE_PASSWORD: 'password',
    GRANT_TYPE_REFRESH:  'refresh_token',
    // Refresh token proactively if within this many ms of expiry
    TOKEN_REFRESH_THRESHOLD_MS: 5 * 60 * 1000, // 5 minutes
  },

  // ── PAGINATION ───────────────────────────────────────────
  PAGINATION: {
    DEFAULT_TAKE:    50,
    CATALOG_TAKE:    100,
    ORDERS_TAKE:     50,
    INVOICES_TAKE:   100,
    SCHEMES_TAKE:    0,   // 0 = fetch all (small dataset)
    CATEGORIES_TAKE: 0,   // 0 = fetch all (small dataset)
  },

  // ── STALE TIMES (milliseconds) ───────────────────────────
  STALE_TIME: {
    STATIC:    30 * 60 * 1000,  // 30 min — categories, payment modes, schemes
    CATALOG:    5 * 60 * 1000,  // 5 min  — product catalog, item detail
    CUSTOMER:   5 * 60 * 1000,  // 5 min  — customer data
    ORDERS:     2 * 60 * 1000,  // 2 min  — orders, invoices, enrollments
    STOCK:      1 * 60 * 1000,  // 1 min  — live stock levels
  },

  // ── SEARCH ───────────────────────────────────────────────
  SEARCH: {
    DEBOUNCE_MS:    500,  // ms to wait before firing search API call
    MIN_QUERY_LENGTH: 2,  // minimum characters before triggering search
  },

  // ── POS CHANNEL ──────────────────────────────────────────
  // NOTE: This value must be confirmed with OrnaVerse before
  // the Create Order API is used in Phase 9 (Checkout).
  ORDER: {
    POS_CHANNEL_ID: null, // TODO: confirm with OrnaVerse integration team
    DEFAULT_STATUS: 'paid',
  },

  // ── STOCK ────────────────────────────────────────────────
  STOCK: {
    LOW_STOCK_THRESHOLD: 3, // items at or below this count show "Low Stock"
  },

  // ── GIFT CARDS & VOUCHERS ────────────────────────────────
  // NOTE: URLs for these endpoints are missing from the OrnaVerse
  // API collection. Deferred until URLs are confirmed.
  GIFT: {
    CARD_TYPE:    1,
    VOUCHER_TYPE: 2,
  },

};

export default APP_CONFIG;