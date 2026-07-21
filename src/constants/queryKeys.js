// src/constants/queryKeys.js
// All TanStack Query cache keys for Lucira POS.
//
// RULES:
//   - Every entry is a factory function — no plain strings/arrays
//   - Pattern: [module, operation, ...discriminators]
//   - Discriminators must make the key unique per data set
//   - Keep keys stable — changing a key busts the cache for all users
//
// REMOVED: SETTINGS.APP (getSettings endpoint removed from API)
// REMOVED: FULFILLMENT (not a POS feature)
// MOVED:   ORDERS.INVOICE_* → INVOICES.* (invoices are their own module now)

export const QUERY_KEYS = {

  // ── STORES ───────────────────────────────────────────────────────────────
  STORES: {
    USER_STORES: () => ['stores', 'user-stores'],
  },

  // ── HR ───────────────────────────────────────────────────────────────────
  HR: {
    EMPLOYEE_BY_USER: (userId) => ['hr', 'employee-by-user', userId],
    EMPLOYEES_BY_COMPANY: (companyId) => ['hr', 'employees-by-company', companyId],
  },

  // ── SETTINGS ─────────────────────────────────────────────────────────────
  SETTINGS: {
    PAYMENT_MODES:        () => ['settings', 'payment-modes'],
    PAYMENT_MODES_REFUND: () => ['settings', 'payment-modes-refund'],
    TAXES:                (companyId) => ['settings', 'taxes', companyId],
    METAL_RATE_TODAY:     () => ['settings', 'metal-rate-today'],
    REASON_CODES:         () => ['settings', 'reason-codes'],
    METAL_RATE:           (metalTypeId) => ['settings', 'metal-rate', metalTypeId],
    ALL_RATES:            () => ['settings', 'all-rates'],
  },

  // ── EXCHANGE RATE ──────────────────────────────────────────────────────────
  EXCHANGE_RATE: {
    GET: (currencyId, companyId) => ['exchange-rate', currencyId, companyId],
  },

  // ── LOCATION ─────────────────────────────────────────────────────────────
  LOCATION: {
    COUNTRIES: ()            => ['location', 'countries'],
    STATES:    (countryId)   => ['location', 'states', countryId],
    CITIES:    (stateId)     => ['location', 'cities', stateId],
  },

  // ── CATEGORIES ───────────────────────────────────────────────────────────
  CATEGORIES: {
    TYPES:       () => ['categories', 'types'],
    SUBTYPES:    () => ['categories', 'subtypes'],
    ITEM_GROUPS: () => ['categories', 'item-groups'],
  },

  // ── ITEMS (Master catalogue) ──────────────────────────────────────────────
  ITEMS: {
    LIST:            (params)  => ['items', 'list', params],
    DETAIL:          (itemId)  => ['items', 'detail', itemId],
    NEW:             ()        => ['items', 'new'],
    FEATURED:        ()        => ['items', 'featured'],
    SIZES:           ()        => ['items', 'sizes'],
    ATTRIBUTES:      (typeId)  => ['items', 'attributes', typeId],
    DESIGN_VARIANTS: (styleId) => ['items', 'design-variants', styleId],
    MASTER_SEARCH:   (query)   => ['items', 'master-search', query],
    PRICING:         (itemId)  => ['items', 'pricing', itemId],
    SEARCH: (params) => ['items', 'search', {
      q:    params.item_search,
      grp:  params.item_group_ids,
      typ:  params.type_ids,
      sub:  params.sub_type_ids,
      fw:   params.from_weight,
      tw:   params.to_weight,
      fdw:  params.from_diamond_weight,
      tdw:  params.to_diamond_weight,
    }],
  },

  // ── CATALOG (Live store inventory) ────────────────────────────────────────
  CATALOG: {
    PRODUCTS:              (params)  => ['catalog', 'products', params],
    ALL:                   (storeId) => ['catalog', 'all', storeId],
    SKU_SEARCH:            (query, storeId) => ['catalog', 'sku-search', query, storeId],
    STOCK_BY_STORES:       (itemId)  => ['catalog', 'stock-by-stores', itemId],
    STOCK_BY_STORES_BATCH: (itemIds) => ['catalog', 'stock-by-stores-batch', itemIds],
  },

  // ── INVENTORY ─────────────────────────────────────────────────────────────
  INVENTORY: {
    STOCK: (itemCode) => ['inventory', 'stock', itemCode],
  },

  // ── CUSTOMERS ────────────────────────────────────────────────────────────
  CUSTOMERS: {
    LOOKUP:   (mobile)    => ['customers', 'lookup', mobile],
    RETRIEVE: (partyId)   => ['customers', 'detail', partyId],
    LIST:     (params)    => ['customers', 'list', params],
    ALL:      (companyId) => ['customers', 'all', companyId],
  },

  // ── PARTY ADDRESS ─────────────────────────────────────────────────────────
  PARTY_ADDRESS: {
    LIST: (partyId) => ['party-address', 'list', partyId],
  },

  // ── ORDERS ───────────────────────────────────────────────────────────────
  ORDERS: {
    LIST:            (params)     => ['orders', 'list', params],
    ALL:             (companyId)  => ['orders', 'all', companyId],
    DETAIL:          (orderId)    => ['orders', 'detail', orderId],
    CUSTOMER_ORDERS: (customerId) => ['orders', 'customer', customerId],
  },

  // ── INVOICES ─────────────────────────────────────────────────────────────
  INVOICES: {
    LIST:   (params)    => ['invoices', 'list', params],
    ALL:    (companyId) => ['invoices', 'all', companyId],
    DETAIL: (invoiceId) => ['invoices', 'detail', invoiceId],
  },

  // ── INVOICE HELPERS (checkout available balances) ─────────────────────────
  INVOICE_HELPERS: {
    ADVANCES:        (partyId, companyId) => ['invoice-helpers', 'advances',   partyId, companyId],
    CREDIT_NOTE:     (partyId, companyId) => ['invoice-helpers', 'credit-note',partyId, companyId],
    EXCHANGE:        (partyId, companyId) => ['invoice-helpers', 'exchange',   partyId, companyId],
    OLD_GOLD:        (partyId, companyId) => ['invoice-helpers', 'old-gold',   partyId, companyId],
    SCHEME:          (partyId, companyId) => ['invoice-helpers', 'scheme',     partyId, companyId],
    PARTY_DAILY_CASH:(partyId, companyId) => ['invoice-helpers', 'daily-cash', partyId, companyId],
  },

  // ── RETURNS ──────────────────────────────────────────────────────────────
  RETURNS: {
    LIST:   (params)          => ['returns', 'list', params],
    DETAIL: (transactionId)   => ['returns', 'detail', transactionId],
  },

  // ── REFUNDS ──────────────────────────────────────────────────────────────
  REFUNDS: {
    LIST:   (params)    => ['refunds', 'list', params],
    DETAIL: (refundId)  => ['refunds', 'detail', refundId],
  },

  // ── CREDIT NOTES ─────────────────────────────────────────────────────────
  CREDIT_NOTES: {
    LIST:   (params)          => ['credit-notes', 'list', params],
    DETAIL: (transactionId)   => ['credit-notes', 'detail', transactionId],
  },

  // ── EXCHANGE ─────────────────────────────────────────────────────────────
  EXCHANGE: {
    LIST:   (params)          => ['exchange', 'list', params],
    DETAIL: (transactionId)   => ['exchange', 'detail', transactionId],
  },

  // ── BUY BACK ─────────────────────────────────────────────────────────────
  BUYBACK: {
    LIST:   (params)          => ['buyback', 'list', params],
    DETAIL: (transactionId)   => ['buyback', 'detail', transactionId],
  },

  // ── URD PURCHASE ─────────────────────────────────────────────────────────
  URD_PURCHASE: {
    LIST:   (params)          => ['urd-purchase', 'list', params],
    DETAIL: (transactionId)   => ['urd-purchase', 'detail', transactionId],
  },

  // ── REPAIR ───────────────────────────────────────────────────────────────
  REPAIR: {
    REPAIR_INS:          (params)          => ['repair', 'repair-ins', params],
    REPAIR_IN_DETAIL:    (transactionId)   => ['repair', 'repair-in-detail', transactionId],
    REPAIR_OUTS:         (params)          => ['repair', 'repair-outs', params],
    REPAIR_INVOICES:     (params)          => ['repair', 'repair-invoices', params],
    REPAIR_INVOICE_DETAIL:(transactionId)  => ['repair', 'repair-invoice-detail', transactionId],
  },

  // ── ESTIMATION / QUOTATION ────────────────────────────────────────────────
  ESTIMATION: {
    LIST:   (params)          => ['estimation', 'list', params],
    DETAIL: (transactionId)   => ['estimation', 'detail', transactionId],
  },

  // ── DAILY CLOSING ─────────────────────────────────────────────────────────
  DAILY_CLOSING: {
    LIST:   (companyId)  => ['daily-closing', 'list', companyId],
    DETAIL: (closingId)  => ['daily-closing', 'detail', closingId],
  },

  // ── CRM ──────────────────────────────────────────────────────────────────
  CRM: {
    PROMOTION:              (promoCode)   => ['crm', 'promotion', promoCode],
    PROMOTION_LIST:         ()            => ['crm', 'promotion-list'],
    GIFT_VOUCHER_CHECK:     (voucherCode) => ['crm', 'gift-voucher-check', voucherCode],
  },

  // ── CUSTOMER HISTORY ──────────────────────────────────────────────────────
  CUSTOMER_HISTORY: {
    TRANSACTIONS:      (customerId) => ['customer-history', 'transactions',      customerId],
    ITEM_TRANSACTIONS: (customerId) => ['customer-history', 'item-transactions',  customerId],
    TOTAL_RECEIPTS:    (customerId) => ['customer-history', 'total-receipts',     customerId],
    TOTAL_PROMOTIONS:  (customerId) => ['customer-history', 'total-promotions',   customerId],
  },

  // ── REWARDS / LOYALTY ─────────────────────────────────────────────────────
  REWARDS: {
    POINTS:          (customerId) => ['rewards', 'points',  customerId],
    LOYALTY_HISTORY: (customerId) => ['rewards', 'history', customerId],
  },

  // ── SCHEMES ──────────────────────────────────────────────────────────────
  SCHEMES: {
    LIST:                ()               => ['schemes', 'list'],
    ENROLLMENTS:         (params)         => ['schemes', 'enrollments', params],
    ENROLLMENT_DETAIL:   (enrollmentId)   => ['schemes', 'enrollment-detail', enrollmentId],
    CUSTOMER_ENROLLMENTS:(customerId)     => ['schemes', 'enrollments', 'customer', customerId],
    RECEIPT_LIST:        (enrollmentId)   => ['schemes', 'receipts', enrollmentId],
    MONTHLY_DETAILS:     (enrollmentId)   => ['schemes', 'monthly-details', enrollmentId],
    MATURITY:            (enrollmentId)   => ['schemes', 'maturity',     enrollmentId],
    FORECLOSE:           (enrollmentId)   => ['schemes', 'foreclose',    enrollmentId],
    CANCELLATION:        (enrollmentId)   => ['schemes', 'cancellation', enrollmentId],
  },

  // ── ANALYTICS ────────────────────────────────────────────────────────────
  ANALYTICS: {
    SKU_VELOCITY:           (companyId, from, to) => ['analytics', 'sku-velocity',          companyId, from, to],
    CATEGORY_PERFORMANCE:   (companyId, from, to) => ['analytics', 'category-performance',   companyId, from, to],
    GROSS_PROFIT:           (companyId, from, to) => ['analytics', 'gross-profit',           companyId, from, to],
    MONTHLY_REVENUE:        (companyId)           => ['analytics', 'monthly-revenue',         companyId],
    MONTHLY_REVENUE_DETAIL: (companyId)           => ['analytics', 'monthly-revenue-detail',  companyId],
    REORDER_SIGNAL:         (companyId)           => ['analytics', 'reorder-signal',          companyId],
    POS_DASHBOARD:          (companyId, from, to) => ['analytics', 'pos-dashboard',           companyId, from, to],
    AI_INSIGHTS:            (companyId, from, to) => ['analytics', 'ai-insights',             companyId, from, to],
  },

  // ── REPORTS ──────────────────────────────────────────────────────────────
  REPORTS: {
    POS_RECEIPTS:          (companyId, from, to) => ['reports', 'pos-receipts',           companyId, from, to],
    POS_RECEIPTS_DETAILED: (companyId, from, to) => ['reports', 'pos-receipts-detailed',  companyId, from, to],
    POS_TAX_DETAILS:       (companyId, from, to) => ['reports', 'pos-tax-details',        companyId, from, to],
    RETURN_STATUS:         (companyId, from, to) => ['reports', 'return-status',          companyId, from, to],
    EXCHANGE_STATUS:       (companyId, from, to) => ['reports', 'exchange-status',        companyId, from, to],
    CREDIT_NOTE_STATUS:    (companyId, from, to) => ['reports', 'credit-note-status',     companyId, from, to],
    BUYBACK_STATUS:        (companyId, from, to) => ['reports', 'buyback-status',         companyId, from, to],
    URD_PURCHASE_STATUS:   (companyId, from, to) => ['reports', 'urd-purchase-status',    companyId, from, to],
    SCHEME_HISTORY:        (companyId, from, to) => ['reports', 'scheme-history',         companyId, from, to],
    INVOICE_REPORT:        (params)              => ['reports', 'invoice-report',          params],
    SALES_WEEKLY:          (companyId)           => ['reports', 'sales-weekly',            companyId],
    SALES_MONTHLY:         (companyId)           => ['reports', 'sales-monthly',           companyId],
    SALES_QUARTERLY:       (companyId)           => ['reports', 'sales-quarterly',         companyId],
  },

  // ── SHOPIFY ──────────────────────────────────────────────────────────────
  // external_product_id lives on StyleRow (Style/Retrieve), NOT ProductCatalogRow
  SHOPIFY: {
    PRODUCT_IMAGES: (externalProductId) => ['shopify', 'product-images', externalProductId],
  },

  // ── REVIEWS (Nector) ─────────────────────────────────────────────────────
  // Keyed by Shopify product id (external_product_id) — reviews are indexed
  // by Shopify's catalog, not OrnaVerse's item_id.
  REVIEWS: {
    SUMMARY: (shopifyProductId) => ['reviews', 'summary', shopifyProductId],
    LIST:    (shopifyProductId) => ['reviews', 'list', shopifyProductId],
  },

};