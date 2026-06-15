// src/constants/queryKeys.js
// All TanStack Query cache keys for Lucira POS.
// Pattern: [module, operation, ...params]
// Source of truth: CODING_STANDARDS.md Section 6

export const QUERY_KEYS = {

  // ── STORES ───────────────────────────────────────────────
  STORES: {
    USER_STORES: () => ['stores', 'user-stores'],
  },

  // ── SETTINGS ─────────────────────────────────────────────
  SETTINGS: {
    APP:           () => ['settings', 'app'],
    PAYMENT_MODES: () => ['settings', 'payment-modes'],
  },

  // ── CATEGORIES ───────────────────────────────────────────
  CATEGORIES: {
    TYPES:       () => ['categories', 'types'],
    SUBTYPES:    () => ['categories', 'subtypes'],
    ITEM_GROUPS: () => ['categories', 'item-groups'],
  },

  // ── ITEMS ────────────────────────────────────────────────
  ITEMS: {
    LIST:     (params) => ['items', 'list', params],
    DETAIL:   (itemId) => ['items', 'detail', itemId],
    NEW:      ()       => ['items', 'new'],
    FEATURED: ()       => ['items', 'featured'],
    SIZES:    ()       => ['items', 'sizes'],
    ATTRIBUTES: (typeId) => ['items', 'attributes', typeId],
    SEARCH: (params) => [
      'items',
      'search',
      {
        q: params.item_search,
        groups: params.item_group_ids,
        types: params.type_ids,
        subs: params.sub_type_ids,
        fw: params.from_weight,
        tw: params.to_weight,
        fdw: params.from_diamond_weight,
        tdw: params.to_diamond_weight,
      },
    ],
  },

  // ── CATALOG ──────────────────────────────────────────────
  CATALOG: {
    PRODUCTS:         (params) => ['catalog', 'products', params],
    STOCK_BY_STORES:  (itemId) => ['catalog', 'stock-by-stores', itemId],
  },

  // ── INVENTORY ────────────────────────────────────────────
  INVENTORY: {
    STOCK: (itemCode) => ['inventory', 'stock', itemCode],
  },

  // ── FULFILLMENT ──────────────────────────────────────────
  FULFILLMENT: {
    LIST: (params) => ['fulfillment', 'list', params],
  },

  // ── CUSTOMERS ────────────────────────────────────────────
  CUSTOMERS: {
    LOOKUP: (mobile) => ['customers', 'lookup', mobile],
    LIST:   (params) => ['customers', 'list', params],
    ALL:    (companyId) => ['customers', 'name-search', companyId]
  },

  // ── ORDERS ───────────────────────────────────────────────
  ORDERS: {
    LIST:           (params)    => ['orders', 'list', params],
    DETAIL:         (orderId)   => ['orders', 'detail', orderId],
    INVOICE_LIST:   (params)    => ['orders', 'invoice-list', params],
    INVOICE_DETAIL: (invoiceId) => ['orders', 'invoice-detail', invoiceId],
    ITEM_STATUS:    (params)    => ['orders', 'item-status', params],
  },

  // ── CRM ──────────────────────────────────────────────────
  CRM: {
    PROMOTION: (promoCode) => ['crm', 'promotion', promoCode],
  },

  // ── SCHEMES ──────────────────────────────────────────────
  SCHEMES: {
    LIST:        ()             => ['schemes', 'list'],
    ENROLLMENTS: (params)       => ['schemes', 'enrollments', params],
    MATURITY:    (enrollmentId) => ['schemes', 'maturity', enrollmentId],
    FORECLOSE:   (enrollmentId) => ['schemes', 'foreclose', enrollmentId],
    CANCELLATION:(enrollmentId) => ['schemes', 'cancellation', enrollmentId],
  },

};