// src/lib/analytics/events.js
// Centralised event name constants.
//
// Every custom event must be identifiable as coming from the POS app once
// it lands in GA4 — but nobody defining a new event below should have to
// remember to type "POS_" by hand (easy to forget, easy to typo). So this
// file defines bare event keys in RAW_EVENTS and the POS_ prefix is
// applied ONCE, programmatically, when building the exported EVENTS
// object. Add new events to RAW_EVENTS with a plain snake_case value —
// the prefix is automatic.
//
// GA_ECOMMERCE_EVENTS (below) are the exception — these are GA4's own
// RESERVED ecommerce event names (view_item, add_to_cart, begin_checkout,
// purchase, ...). Never prefix these: GA4 only populates its automatic
// Monetization/Ecommerce reports when it sees these exact, unprefixed
// strings, and a new GA4 property (built directly against this data)
// needs that default behavior intact. tracker.trackEcommerce() fires
// both — the reserved name (for GA4's built-in reports) and the
// POS_-prefixed equivalent (for custom Explore analysis) — see tracker.js.

const PREFIX = 'POS_';

const RAW_EVENTS = {
  // ── Agent (no session, just logs) ────────────────
  AGENT_LOGIN:           'agent_login',
  AGENT_LOGOUT:          'agent_logout',
  AGENT_IDLE_LOGOUT:     'agent_idle_logout',
  STORE_SELECTED:        'store_selected',
  STORE_SWITCHED:        'store_switched',

  // ── Customer Session ─────────────────────────────
  SESSION_START:         'session_start',
  SESSION_END:           'session_end',
  SESSION_IDLE_TIMEOUT:  'session_idle_timeout',

  // ── Navigation ───────────────────────────────────
  PAGE_VIEW:             'page_view',

  // ── Catalog ──────────────────────────────────────
  PRODUCT_VIEWED:        'product_viewed',
  PRODUCT_SEARCHED:      'product_searched',
  PRODUCT_SEARCH_EMPTY:  'product_search_empty',
  CATEGORY_FILTERED:     'category_filtered',
  BARCODE_SCANNED:       'barcode_scanned',
  BARCODE_SCAN_FAILED:   'barcode_scan_failed',

  // ── Cart ─────────────────────────────────────────
  CART_ITEM_ADDED:       'cart_item_added',
  CART_ITEM_REMOVED:     'cart_item_removed',
  CART_ITEM_QTY_CHANGED: 'cart_item_qty_changed',
  CART_OPENED:           'cart_opened',
  CART_CLEARED:          'cart_cleared',

  // ── Checkout ─────────────────────────────────────
  CHECKOUT_STARTED:      'checkout_started',
  PAYMENT_SELECTED:      'payment_selected',
  PROMO_APPLIED:         'promo_applied',
  PROMO_FAILED:          'promo_failed',
  PROMO_SIMILAR_BLOCKED: 'promo_similar_blocked',
  ORDER_PLACED:          'order_placed',
  ORDER_FAILED:          'order_failed',

  // ── Orders ────────────────────────────────────────
  ORDER_CANCELLED:        'order_cancelled',
  ORDER_CANCEL_FAILED:    'order_cancel_failed',

  // ── Returns ───────────────────────────────────────
  RETURN_CREATED:         'return_created',
  RETURN_POSTED:          'return_posted',
  RETURN_CANCELLED:       'return_cancelled',
  RETURN_FAILED:          'return_failed',

  // ── Refunds ───────────────────────────────────────
  REFUND_CREATED:         'refund_created',
  REFUND_RECEIPT_ADDED:   'refund_receipt_added',
  REFUND_DELETED:         'refund_deleted',
  REFUND_FAILED:          'refund_failed',

  // ── Credit Notes ────────────────────────────────────
  CREDIT_NOTE_CREATED:    'credit_note_created',
  CREDIT_NOTE_POSTED:     'credit_note_posted',
  CREDIT_NOTE_CANCELLED:  'credit_note_cancelled',
  CREDIT_NOTE_FAILED:     'credit_note_failed',

  // ── Exchange ─────────────────────────────────────
  EXCHANGE_CREATED:       'exchange_created',
  EXCHANGE_POSTED:        'exchange_posted',
  EXCHANGE_CANCELLED:     'exchange_cancelled',
  EXCHANGE_FAILED:        'exchange_failed',

  // ── Buyback ──────────────────────────────────────
  BUYBACK_CREATED:        'buyback_created',
  BUYBACK_POSTED:         'buyback_posted',
  BUYBACK_CANCELLED:      'buyback_cancelled',
  BUYBACK_FAILED:         'buyback_failed',

  // ── URD Purchase ─────────────────────────────────
  URD_PURCHASE_CREATED:   'urd_purchase_created',
  URD_PURCHASE_POSTED:    'urd_purchase_posted',
  URD_PURCHASE_CANCELLED: 'urd_purchase_cancelled',
  URD_PURCHASE_FAILED:    'urd_purchase_failed',

  // ── Repair ───────────────────────────────────────
  REPAIR_IN_CREATED:       'repair_in_created',
  REPAIR_IN_POSTED:        'repair_in_posted',
  REPAIR_IN_CANCELLED:     'repair_in_cancelled',
  REPAIR_IN_FAILED:        'repair_in_failed',
  REPAIR_OUT_CREATED:      'repair_out_created',
  REPAIR_OUT_POSTED:       'repair_out_posted',
  REPAIR_OUT_FAILED:       'repair_out_failed',
  REPAIR_INVOICE_CREATED:  'repair_invoice_created',
  REPAIR_INVOICE_POSTED:   'repair_invoice_posted',
  REPAIR_INVOICE_FAILED:   'repair_invoice_failed',
  REPAIR_RECEIPT_CREATED:  'repair_receipt_created',
  REPAIR_RECEIPT_FAILED:   'repair_receipt_failed',

  // ── Estimation ───────────────────────────────────
  ESTIMATION_CREATED:      'estimation_created',
  ESTIMATION_POSTED:       'estimation_posted',
  ESTIMATION_CANCELLED:    'estimation_cancelled',
  ESTIMATION_FAILED:       'estimation_failed',

  // ── Daily Closing ────────────────────────────────
  DAILY_CLOSING_CREATED:   'daily_closing_created',
  DAILY_CLOSING_FAILED:    'daily_closing_failed',

  // ── Schemes ──────────────────────────────────────
  SCHEME_ENROLLED:         'scheme_enrolled',
  SCHEME_ENROLL_FAILED:    'scheme_enroll_failed',
  SCHEME_PAYMENT_RECORDED: 'scheme_payment_recorded',
  SCHEME_PAYMENT_FAILED:   'scheme_payment_failed',

  // ── Settings ─────────────────────────────────────
  METAL_RATE_ADDED:        'metal_rate_added',
  METAL_RATE_ADD_FAILED:   'metal_rate_add_failed',

  // ── Customer ─────────────────────────────────────
  CUSTOMER_SEARCHED:     'customer_searched',
  CUSTOMER_SELECTED:     'customer_selected',
  CUSTOMER_CREATED:      'customer_created',
  CUSTOMER_DETACHED:     'customer_detached',

  // ── UI Interactions ──────────────────────────────
  CLICK:                 'click',
  CUSTOMIZE_OPENED:      'customize_opened',
  CUSTOMIZE_CONFIRMED:   'customize_confirmed',
};

// Applies PREFIX once, centrally — nothing above ever types "POS_" by hand.
const EVENTS = Object.fromEntries(
  Object.entries(RAW_EVENTS).map(([key, value]) => [key, `${PREFIX}${value}`])
);

// GA4 reserved ecommerce event names — never prefix these, GA4 matches on
// the literal string. https://support.google.com/analytics/answer/9267735
export const GA_ECOMMERCE_EVENTS = {
  VIEW_ITEM:        'view_item',
  ADD_TO_CART:      'add_to_cart',
  REMOVE_FROM_CART: 'remove_from_cart',
  VIEW_CART:        'view_cart',
  BEGIN_CHECKOUT:   'begin_checkout',
  ADD_PAYMENT_INFO: 'add_payment_info',
  PURCHASE:         'purchase',
};

export default EVENTS;
