// src/constants/appConfig.js
// Application-wide fixed constants for Lucira POS.
//
// CHANGES FROM PREVIOUS VERSION:
//   REMOVED: ORDER.POS_CHANNEL_ID — blocker gone. POS/Order/Create needs no channel.
//   REMOVED: ORDER.DEFAULT_STATUS — status is derived from balance_amount, never sent
//   REMOVED: GIFT.CARD_TYPE/VOUCHER_TYPE — vouchers handled via CRM endpoints directly
//   REMOVED: SETTINGS block — AppSettings endpoint removed from new API spec
//   ADDED:   PAGINATION entries for new modules
//   ADDED:   STALE_TIME.ANALYTICS, STALE_TIME.REPORTS
//   ADDED:   REPAIR.STAGES, ESTIMATION.STATUSES for UI state tracking

const APP_CONFIG = {

  // ── METAL TYPE IDs ────────────────────────────────────────────────────────
  // Fixed constants defined by OrnaVerse — never change these values
  METAL_TYPES: {
    GOLD:      106,
    SILVER:    107,
    PLATINUM:  108,
    PALLADIUM: 109,
    ALLOY:     111,
  },

  // ── CURRENCY ──────────────────────────────────────────────────────────────
  CURRENCY: {
    INR_ID:     103,
    INR_CODE:   'INR',
    INR_SYMBOL: '₹',
  },

  // ── AUTHENTICATION ────────────────────────────────────────────────────────
  AUTH: {
    CLIENT_ID:                 'api_access',
    SCOPE:                     'openid offline_access',
    GRANT_TYPE_PASSWORD:       'password',
    GRANT_TYPE_REFRESH:        'refresh_token',
    TOKEN_REFRESH_THRESHOLD_MS: 5 * 60 * 1000, // refresh proactively 5 min before expiry
  },

  // ── PAGINATION ────────────────────────────────────────────────────────────
  // Take: 0 = fetch all (use only for small/static datasets)
  PAGINATION: {
    DEFAULT_TAKE:       50,
    CATALOG_TAKE:       100,
    ORDERS_TAKE:        50,
    INVOICES_TAKE:      100,
    TRANSACTIONS_TAKE:  50,   // returns, refunds, exchange, buyback, URD, repair
    SCHEMES_TAKE:       0,    // fetch all — small dataset
    CATEGORIES_TAKE:    0,    // fetch all — small static dataset
    CUSTOMERS_TAKE:     50,   // paginated browse
    CUSTOMERS_ALL_TAKE: 5000, // one-off full fetch for name search
    ANALYTICS_TAKE:     12,   // months for revenue charts
    REPORTS_TAKE:       100,
  },

  // ── STALE TIMES (milliseconds) ────────────────────────────────────────────
  STALE_TIME: {
    STATIC:    30 * 60 * 1000, // 30 min — categories, payment modes, schemes, location
    CATALOG:    5 * 60 * 1000, // 5 min  — product catalog, item detail
    CUSTOMER:   5 * 60 * 1000, // 5 min  — customer data
    ORDERS:     2 * 60 * 1000, // 2 min  — orders, invoices, transactions
    STOCK:      1 * 60 * 1000, // 1 min  — live stock levels
    ANALYTICS: 10 * 60 * 1000, // 10 min — analytics charts (slow-changing)
    REPORTS:    5 * 60 * 1000, // 5 min  — operational reports
  },

  // ── SESSION ───────────────────────────────────────────────────────────────
  SESSION: {
    IDLE_TIMEOUT_MS: 5 * 60 * 1000,
    WARNING_BEFORE:  30 * 1000,
    CLICK_DEBOUNCE:  300,
  },

  // ── SEARCH ────────────────────────────────────────────────────────────────
  SEARCH: {
    DEBOUNCE_MS:      300, // ms to wait before triggering search
    MIN_QUERY_LENGTH:   2, // minimum chars before triggering search
  },

  // ── STOCK ─────────────────────────────────────────────────────────────────
  STOCK: {
    LOW_STOCK_THRESHOLD: 3, // items at or below this count show "Low Stock"
  },

  // ── PAYMENT MODES ─────────────────────────────────────────────────────────
  // Controls which modes from PaymentReceiptMode/List appear at checkout.
  //
  // A mode is SHOWN at checkout if:
  //   only_for_pos === true  OR  mode_code is in ALLOWLIST
  // AND NOT in DENYLIST
  //
  // DENYLIST excludes internal adjustment modes that appear as payment modes
  // in OrnaVerse but are not customer-facing cash payment instruments.
  // These are handled via their own dedicated screens (exchange, scheme, etc).
  //
  // ALLOWLIST ensures Cash/Card/UPI always appear even if OrnaVerse hasn't
  // flagged them only_for_pos yet.
  PAYMENT_MODES: {
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

  // ── REPAIR STAGES ─────────────────────────────────────────────────────────
  // Used by the repair module UI to show workflow progress.
  // Maps to the POS/RepairIn → POS/RepairOut → POS/RepairInvoice stages.
  REPAIR: {
    STAGES: {
      INTAKE:   'intake',   // RepairIn created
      WORKSHOP: 'workshop', // RepairOut posted (with craftsman)
      READY:    'ready',    // RepairOut received back (RepairIn returned)
      INVOICED: 'invoiced', // RepairInvoice created and posted
    },
  },

  // ── ESTIMATION STATUSES ───────────────────────────────────────────────────
  // Used by the estimation module UI to show quotation state.
  ESTIMATION: {
    STATUSES: {
      DRAFT:     'draft',     // created, not yet posted
      CONVERTED: 'converted', // posted → became an invoice/order
      CANCELLED: 'cancelled', // customer declined
    },
  },

  // ── ORDER STATUS (derived, not returned by API) ───────────────────────────
  // Status is computed client-side from balance_amount + receipt_amount.
  // Never sent to the API — only used for display and filtering.
  //
  // balance_amount <= 0                        → PAID
  // balance_amount > 0 && receipt_amount > 0   → PARTIAL
  // balance_amount > 0 && receipt_amount == 0  → DUE
  ORDER_STATUS: {
    PAID:    'paid',
    PARTIAL: 'partial',
    DUE:     'due',
  },

};

export default APP_CONFIG;