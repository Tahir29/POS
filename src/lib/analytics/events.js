// src/lib/analytics/events.js
// Centralised event name constants.
// Agent events prefixed with agent_, customer session events are the core tracking.

const EVENTS = {
  // ── Agent (no session, just logs) ────────────────
  AGENT_LOGIN:           'agent_login',
  AGENT_LOGOUT:          'agent_logout',
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
  CATEGORY_FILTERED:     'category_filtered',
  BARCODE_SCANNED:       'barcode_scanned',

  // ── Cart ─────────────────────────────────────────
  CART_ITEM_ADDED:       'cart_item_added',
  CART_ITEM_REMOVED:     'cart_item_removed',
  CART_OPENED:           'cart_opened',
  CART_CLEARED:          'cart_cleared',

  // ── Checkout ─────────────────────────────────────
  CHECKOUT_STARTED:      'checkout_started',
  ORDER_PLACED:          'order_placed',
  PAYMENT_SELECTED:      'payment_selected',
  PROMO_APPLIED:         'promo_applied',

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

export default EVENTS;