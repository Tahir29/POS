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

  // ── URD PURCHASE MASTER ITEMS ─────────────────────────────────────────────
  // Generic "unregistered dealer" gold placeholder item used as the line
  // item on every URD Purchase — confirmed 2026-07-16 via a real URD
  // Purchase's line item (item_id 46875, item_code "URD GOLD", is_urd: true).
  // Hardcoded rather than searched: Items/List silently excludes is_urd
  // items from EVERY query (item_search, item_ids, is_urd filter all
  // return zero rows for this exact item_id) even though Items/Retrieve
  // returns it fine — the same "filter silently ignored" pattern seen
  // elsewhere in this API. Only Gold is confirmed; if the store buys old
  // silver/platinum too, get those item_ids the same way (Retrieve by ID,
  // not List) and add them here.
  URD_MASTER_ITEMS: {
    GOLD: 46875,
  },

  // ── CURRENCY ──────────────────────────────────────────────────────────────
  CURRENCY: {
    INR_ID:     103,
    INR_CODE:   'INR',
    INR_SYMBOL: '₹',
  },

  // ── DOCUMENT TYPES ────────────────────────────────────────────────────────
  // document_id constants for DocumentNumbering rows — confirmed live
  // 2026-07-28 (see documentConfigService.js / useOrderHeaderConfig.js).
  // Each row carries that document type's control ledger_id + posting flags,
  // keyed by (document_id, company_id) — required on Order/Invoice Create.
  DOCUMENT_TYPES: {
    POS_INVOICE:     54,  // prefix "LJ"
    POS_ORDER:       53,  // prefix "RPO"
    // Confirmed live 2026-07-28 by reading real document_no prefixes off
    // each endpoint's own List response (ground truth, not guessed from
    // DocumentNumbering's prefix text) — see [[transactions-duplicate-implementations]]
    // memory for the broader context on these transaction flows.
    RETURN:          55,  // prefix "PSR"
    // CONFIRMED 2026-08-01 off OrnaVerse's own New CreditNote form — Credit
    // Note is its OWN document type, not a Return. The old note here guessed
    // they might share id 55; they don't.
    //   • auto_posting: TRUE → Create also posts. Do NOT call CreditNote/Post
    //     after Create or it fails AlreadyPosted (same bug fixed on 5 flows).
    //   • is_tax_applicable: TRUE → the party MUST have a tax_reg_type set,
    //     or OrnaVerse rejects it. See [[credit-notes-findings]].
    //   • ledger_id 129, number_of_backdated_days 60.
    CREDIT_NOTE:     123, // prefix "CRN"
    REFUND:          126, // prefix "RFD"
    EXCHANGE:        56,  // prefix "EXC"
    BUYBACK:         97,  // prefix "BYB"
    URD_PURCHASE:    104, // prefix "URD"
    REPAIR_IN:       117, // prefix "REPI"
    REPAIR_OUT:      118, // prefix "RPO" (distinct document_id from POS_ORDER
                           // despite the same prefix text — this store's own config)
    REPAIR_INVOICE:  119, // prefix "RIN"
    SCHEME_RECEIPT:  99,  // prefix "SPY"
    ESTIMATION:      52,  // prefix "QTN" — same constant pricingService.js
                           // already uses for the stateless SetSalesItems
                           // preview call, confirmed live via the full
                           // DocumentNumbering/List prefix dump 2026-07-28.
  },

  // ── COMPLIANCE ────────────────────────────────────────────────────────────
  // Income Tax Rule 114B: PAN is mandatory on a sale once the transaction
  // value crosses ₹2,00,000, regardless of payment mode — this is a
  // statutory threshold, not a store policy, so it isn't configurable per
  // store/scheme the way PAYMENT_MODES is.
  COMPLIANCE: {
    PAN_MANDATORY_THRESHOLD: 200000,
    // Income Tax s.269ST: cash receipts from one person in a single day may
    // not reach ₹2,00,000, so the largest acceptable amount is 1,99,999.
    // OrnaVerse enforces this server-side and reports it as "Cannot accept
    // Cash above 199999.00" — matched here so the counter can see the limit
    // before submitting rather than after.
    //
    // Confirmed live 2026-08-05 that their check is on the PARTY'S RUNNING
    // DAILY TOTAL (POSInvoice/GetPartyDailyCash), not on the payment being
    // made: a customer at 3,60,950.66 for the day had a fully-UPI invoice
    // refused with the same cash message.
    CASH_DAILY_LIMIT: 199999,
  },

  // ── TAX ───────────────────────────────────────────────────────────────────
  // GST on gold/silver/diamond jewellery in India is a flat 3% (CGST 1.5% +
  // SGST 1.5% for an intra-state sale), unlike most goods' slab rates — so a
  // single flat rate here is correct for this business, not a simplification.
  // Applied to the taxable value (subtotal after discount) in cartSlice's
  // recalculateTotals, the single source of truth for cart/checkout totals.
  TAX: {
    GST_RATE: 0.03,
  },

  // ── AUTHENTICATION ────────────────────────────────────────────────────────
  // UAT OrnaVerse client (2026-07-29) — client_id/scope only, no secret.
  // Confirmed from the UAT admin panel's "Edit OAuth Client (api_access)"
  // screen: OAuth Client Type is **Public**, so no client_secret exists for
  // this client at all (public clients are secretless by definition — that's
  // the whole distinction from a confidential client). Nothing to park in
  // .env.local for UAT; ORNAVERSE_UAT_CLIENT_SECRET stays unset.
  //
  // GRANT_TYPE_PASSWORD is 'password' — the UAT client's allowed Grant Types
  // are exactly Password / Authorization Code / Refresh Token. It was briefly
  // set to 'client_credentials' during the LIVE service-account work; against
  // this public client that produced a misleading
  // 400 "The 'client_secret' or 'client_assertion' parameter must be
  // specified when using the client credentials grant" — which reads like a
  // missing-secret problem but is really "that grant isn't enabled for this
  // client, so it assumed you must be a confidential client." Don't chase a
  // nonexistent UAT secret if this reappears; check the grant type first.
  //
  // NOTE for switching back to LIVE: LIVE's client IS confidential and its
  // secret lives in .env.local as ORNAVERSE_LIVE_CLIENT_SECRET (server-only,
  // injected by the api/[...path] proxy — never in this browser-shipped
  // file). LIVE also used client_credentials; if reverting, both CLIENT_ID
  // and GRANT_TYPE_PASSWORD here need to go back alongside route.js's
  // ACTIVE_ENV.
  AUTH: {
    CLIENT_ID:                 '65948cb671ae46e1a04653f505e29332',
    SCOPE:                     'profile email',
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
    EMPLOYEES_ALL_TAKE: 5000, // one-off full fetch for name search
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
  // IDLE_TIMEOUT_MS       — customer detached from cart after this long idle
  // STAFF_IDLE_TIMEOUT_MS — agent fully logged out after this long idle
  SESSION: {
    IDLE_TIMEOUT_MS:       10 * 60 * 1000,
    STAFF_IDLE_TIMEOUT_MS: 20 * 60 * 1000,
    WARNING_BEFORE:        30 * 1000,
    CLICK_DEBOUNCE:        300,
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