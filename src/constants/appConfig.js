// src/constants/appConfig.js
// Application-wide fixed constants for Lucira POS.
//
// CHANGES FROM PREVIOUS VERSION:
//   REMOVED: ORDER.POS_CHANNEL_ID — blocker gone. POS/Order/Create needs no channel.
//   REMOVED: ORDER.DEFAULT_STATUS — status is derived from balance_amount, never sent
//   REMOVED: GIFT.CARD_TYPE/VOUCHER_TYPE — vouchers handled via CRM endpoints directly
//   REMOVED: SETTINGS block — AppSettings endpoint removed from new API spec
//   ADDED:   PAGINATION entries for new modules
//   ADDED:   STALE_TIME.ANALYTICS
//   ADDED:   REPAIR.STAGES, ESTIMATION.STATUSES for UI state tracking

import { ORNAVERSE_AUTH } from '@/lib/ornaverse/authConfig';

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
    // CONFIRMED 2026-08-07 off a live SchemeEnrollment/Create capture on
    // Lucira's own UAT tenant (lucira.uat.ornaverse.in) — see
    // Lucira_Scheme_Module_Documentation.md §4. Real payload example:
    // { document_no: "HO-SEN-08-26-12", document_id: 125, ... }
    SCHEME_ENROLLMENT: 125, // prefix "HO-SEN"
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
  //
  // This combined rate is still all that's computed/stored here — the real
  // CGST+SGST split (confirmed live 2026-08-17 in OrnaVerse's own
  // per-line item_taxes[], via SetSalesItems + summarizeLineItems) already
  // happens server-side regardless of this constant. lib/gst.js's
  // splitGst() reconstructs that same 50/50 split for display wherever
  // only the combined tax_amount is at hand (cart estimate, order/invoice
  // summaries) — a display-time bifurcation, not a second calculation.
  TAX: {
    GST_RATE: 0.03,
  },

  // ── AUTHENTICATION ────────────────────────────────────────────────────────
  // CLIENT_ID / GRANT_TYPE_PASSWORD / SCOPE now come from ornaverse/authConfig.js,
  // which derives them from the SAME ACTIVE_ENV flag upstream.js uses — flip
  // ACTIVE_ENV in ornaverse/environment.js and the upstream URL, the
  // server-injected secret, AND these three fields all switch together. See authConfig.js
  // for the full per-environment values and why they differ (confidential
  // vs public client, client_credentials vs password grant, offline_access
  // support) — this used to be 3 values hand-copied here on every
  // environment switch, which is exactly what caused the 2026-08-22 LIVE
  // cutover to 401 on every request (upstream.js flipped to LIVE, this
  // block didn't, so the browser kept sending UAT's client_id to LIVE's
  // token endpoint — "invalid_client" on login, no valid bearer token
  // after that for anything).
  //
  // GRANT_TYPE_REFRESH stays here (not env-derived): only UAT's
  // password grant issues a refresh_token at all — see the SCOPE note in
  // authConfig.js. On LIVE this constant is simply unused; interceptors.js's
  // refresh branch requires a truthy refreshToken and one never exists
  // there, so it re-authenticates via client_credentials instead.
  AUTH: {
    ...ORNAVERSE_AUTH,
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
  },

  // ── STALE TIMES (milliseconds) ────────────────────────────────────────────
  STALE_TIME: {
    STATIC:    30 * 60 * 1000, // 30 min — categories, payment modes, schemes, location
    CATALOG:    5 * 60 * 1000, // 5 min  — product catalog, item detail
    CUSTOMER:   5 * 60 * 1000, // 5 min  — customer data
    ORDERS:     2 * 60 * 1000, // 2 min  — orders, invoices, transactions
    STOCK:      1 * 60 * 1000, // 1 min  — live stock levels
    ANALYTICS: 10 * 60 * 1000, // 10 min — analytics charts (slow-changing)
    // 24h (2026-08-23) — "master data" that only changes when someone edits
    // a product in OrnaVerse/Shopify: the whole-store catalog list
    // (useAllCatalog) and per-item Shopify photos (useShopifyProductImages).
    // Paired with lib/queryPersister.js, which persists exactly these two
    // to IndexedDB so a page reload doesn't re-fetch them either. NEVER use
    // this for price — see usePricingEpoch.js for why price stays on a
    // live change-detector instead of any timer, however long.
    MASTER_DATA: 24 * 60 * 60 * 1000,
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

  SEARCH: {
    DEBOUNCE_MS:      300,
    MIN_QUERY_LENGTH:   2,
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

  // ── ORDER STATUS ───────────────────────────────────────────────────────────
  // CANCELLED/DRAFT come straight from the API's own document_status (2/0) —
  // confirmed live 2026-09-03 against a real UAT invoice (HO-LJ-0726-009,
  // document_status: 2, balance_amount: 0) that was displaying as "Paid"
  // because document_status was never looked at. PAID/PARTIAL/DUE remain
  // derived client-side from balance_amount + receipt_amount, but only for
  // a Posted (1) document — see deriveDocumentStatus() in useCustomerOrders.js,
  // the one place this precedence is actually applied.
  //
  // document_status: 2 (Cancelled)              → CANCELLED
  // document_status: 0 (Draft)                  → DRAFT
  // document_status: 1 (Posted), balance <= 0                        → PAID
  // document_status: 1 (Posted), balance > 0 && receipt_amount > 0   → PARTIAL
  // document_status: 1 (Posted), balance > 0 && receipt_amount == 0  → DUE
  ORDER_STATUS: {
    PAID:      'paid',
    PARTIAL:   'partial',
    DUE:       'due',
    CANCELLED: 'cancelled',
    DRAFT:     'draft',
  },

};

export default APP_CONFIG;