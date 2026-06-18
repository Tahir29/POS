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
    CUSTOMERS_TAKE:  50,  // Customer directory — TotalCount ~1400, paginated
    CUSTOMERS_ALL_TAKE: 5000, // One-off larger fetch for name search
  },

  // ── STALE TIMES (milliseconds) ───────────────────────────
  STALE_TIME: {
    STATIC:    30 * 60 * 1000,  // 30 min — categories, payment modes, schemes
    CATALOG:    5 * 60 * 1000,  // 5 min  — product catalog, item detail
    CUSTOMER:   5 * 60 * 1000,  // 5 min  — customer data
    ORDERS:     2 * 60 * 1000,  // 2 min  — orders, invoices, enrollments
    STOCK:      1 * 60 * 1000,  // 1 min  — live stock levels
  },

  // ── SESSION ──────────────────────────────────────────────
  SESSION: {
    IDLE_TIMEOUT_MS: 5 * 60 * 1000,
    WARNING_BEFORE: 30 * 1000,
    CLICK_DEBOUNCE: 300,
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

  // ── PAYMENT MODES (Checkout — Phase 9b) ──────────────────
  // A payment mode from PaymentReceiptMode/List is shown at checkout if:
  //   only_for_pos === true  OR  mode_code is in ALLOWLIST
  // ...and is NOT in DENYLIST (modes that are only_for_pos but aren't
  // customer-facing payment instruments — exchanges, returns, schemes, etc).
  //
  // ALLOWLIST exists to surface modes OrnaVerse hasn't flagged only_for_pos
  // yet (e.g. UPI). If OrnaVerse later sets only_for_pos: true for a code
  // already in ALLOWLIST, it's harmless — the OR makes it redundant.
  PAYMENT_MODES: {
    // NOTE: Cash, Credit Card, Debit Card, and UPI all have
    // only_for_pos: false in the current OrnaVerse data, but are
    // standard customer payment instruments for a retail POS — included
    // here explicitly. Revisit if OrnaVerse later sets only_for_pos: true
    // for these (the OR makes this redundant, not conflicting).
    ALLOWLIST: ['Cash', 'Credit Card', 'Debit Card', 'UPI'],
    DENYLIST: [
      'Exchange',
      'Return',
      'Old Gold',
      'Order Advance',
      'Scheme Payment',
      'scheme Enrollment',
      'Spin the Wheel',
      'Spin the Wheel :-Coin',
      'GoKwik',
      'Razorpay',
    ],
  },

};

export default APP_CONFIG;