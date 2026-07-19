// src/lib/analytics/events.js
// Centralised event name constants.
//
// Every custom event is prefixed POS_ so it's unmistakably identifiable as
// coming from the POS app once it lands in GA4 (Explore/custom reports,
// alongside whatever else feeds the same GA4 property).
//
// GA_ECOMMERCE_EVENTS (below) are the exception — these are GA4's own
// RESERVED ecommerce event names (view_item, add_to_cart, begin_checkout,
// purchase, ...). GA4 only populates its automatic Monetization/Ecommerce
// reports when it sees these exact, unprefixed names. tracker.trackEcommerce()
// fires both: the reserved name (for GA4's built-in reports) and the
// POS_-prefixed equivalent (for your own custom analysis) — see tracker.js.

const EVENTS = {
  // ── Agent (no session, just logs) ────────────────
  AGENT_LOGIN:           'POS_agent_login',
  AGENT_LOGOUT:          'POS_agent_logout',
  AGENT_IDLE_LOGOUT:     'POS_agent_idle_logout',
  STORE_SELECTED:        'POS_store_selected',
  STORE_SWITCHED:        'POS_store_switched',

  // ── Customer Session ─────────────────────────────
  SESSION_START:         'POS_session_start',
  SESSION_END:           'POS_session_end',
  SESSION_IDLE_TIMEOUT:  'POS_session_idle_timeout',

  // ── Navigation ───────────────────────────────────
  PAGE_VIEW:             'POS_page_view',

  // ── Catalog ──────────────────────────────────────
  PRODUCT_VIEWED:        'POS_product_viewed',
  PRODUCT_SEARCHED:      'POS_product_searched',
  PRODUCT_SEARCH_EMPTY:  'POS_product_search_empty',
  CATEGORY_FILTERED:     'POS_category_filtered',
  BARCODE_SCANNED:       'POS_barcode_scanned',
  BARCODE_SCAN_FAILED:   'POS_barcode_scan_failed',

  // ── Cart ─────────────────────────────────────────
  CART_ITEM_ADDED:       'POS_cart_item_added',
  CART_ITEM_REMOVED:     'POS_cart_item_removed',
  CART_ITEM_QTY_CHANGED: 'POS_cart_item_qty_changed',
  CART_OPENED:           'POS_cart_opened',
  CART_CLEARED:          'POS_cart_cleared',

  // ── Checkout ─────────────────────────────────────
  CHECKOUT_STARTED:      'POS_checkout_started',
  PAYMENT_SELECTED:      'POS_payment_selected',
  PROMO_APPLIED:         'POS_promo_applied',
  PROMO_FAILED:          'POS_promo_failed',
  PROMO_SIMILAR_BLOCKED: 'POS_promo_similar_blocked',
  ORDER_PLACED:          'POS_order_placed',
  ORDER_FAILED:          'POS_order_failed',

  // ── Customer ─────────────────────────────────────
  CUSTOMER_SEARCHED:     'POS_customer_searched',
  CUSTOMER_SELECTED:     'POS_customer_selected',
  CUSTOMER_CREATED:      'POS_customer_created',
  CUSTOMER_DETACHED:     'POS_customer_detached',

  // ── UI Interactions ──────────────────────────────
  CLICK:                 'POS_click',
  CUSTOMIZE_OPENED:      'POS_customize_opened',
  CUSTOMIZE_CONFIRMED:   'POS_customize_confirmed',
};

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
