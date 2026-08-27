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

  STORES: {
    USER_STORES: () => ['stores', 'user-stores'],
  },

  HR: {
    EMPLOYEE_BY_USER: (userId) => ['hr', 'employee-by-user', userId],
    EMPLOYEES_BY_COMPANY: (companyId) => ['hr', 'employees-by-company', companyId],
  },

  SETTINGS: {
    PAYMENT_MODES:        () => ['settings', 'payment-modes'],
    PAYMENT_MODES_REFUND: () => ['settings', 'payment-modes-refund'],
    BANK_POS_ACCOUNTS:    () => ['settings', 'bank-pos-accounts'],
    TAXES:                (companyId) => ['settings', 'taxes', companyId],
    METAL_RATE_TODAY:     () => ['settings', 'metal-rate-today'],
    // dateKey (a plain YYYY-MM-DD string, not a Date) so the key itself
    // rolls over at midnight without a timer — see useMetalRates.js.
    METAL_RATE:           (karatId, companyId, dateKey) => ['settings', 'metal-rate', karatId, companyId, dateKey],
    REASON_CODES:         () => ['settings', 'reason-codes'],
  },

  EXCHANGE_RATE: {
    GET: (currencyId, companyId) => ['exchange-rate', currencyId, companyId],
  },

  // ── DOCUMENT CONFIG (financial year + per-document-type ledger config) ────
  DOCUMENT_CONFIG: {
    FINANCIAL_YEARS:    ()          => ['document-config', 'financial-years'],
    DOCUMENT_NUMBERING: ()          => ['document-config', 'document-numbering'],
  },

  LOCATION: {
    COUNTRIES: ()            => ['location', 'countries'],
    STATES:    (countryId)   => ['location', 'states', countryId],
    CITIES:    (stateId)     => ['location', 'cities', stateId],
  },

  CATEGORIES: {
    TYPES:       () => ['categories', 'types'],
    SUBTYPES:    () => ['categories', 'subtypes'],
    ITEM_GROUPS: () => ['categories', 'item-groups'],
  },

  // ── ITEMS (Master catalogue) ──────────────────────────────────────────────
  ITEMS: {
    LIST:            (params)  => ['items', 'list', params],
    DETAIL:          (itemId)  => ['items', 'detail', itemId],
    ATTRIBUTES:      (typeId)  => ['items', 'attributes', typeId],
    DESIGN_VARIANTS: (styleId) => ['items', 'design-variants', styleId],
    MASTER_SEARCH:   (query)   => ['items', 'master-search', query],
    // companyId is part of the key because the price depends on WHICH
    // physical piece this store has on the shelf — see priceItemAsSold.
    PRICING:         (itemId, companyId) => ['items', 'pricing', itemId, companyId],
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
    CATEGORY_SEARCH:       (typeIds, storeId) => ['catalog', 'category-search', typeIds, storeId],
    STOCK_BY_STORES:       (itemId)  => ['catalog', 'stock-by-stores', itemId],
    STOCK_BY_STORES_BATCH: (itemIds) => ['catalog', 'stock-by-stores-batch', itemIds],
    // Live SetSalesItems price for ONE catalog card. Per-item (not per-page)
    // so returning to /catalog reuses every price already fetched instead of
    // re-running the whole 6-7s-per-batch pipeline — see useLiveCatalogPrices,
    // which batches the network calls behind these individual keys.
    //
    // storeId is part of the key for the same reason as ITEMS.PRICING: the
    // price depends on which physical piece this store holds.
    //
    // epoch is a signature of the canary items' current price (see
    // usePricingEpoch). It is what lets these entries be cached INDEFINITELY
    // rather than on a timer: the cached price cannot go wrong while the
    // epoch holds, and the moment anything moves a real price the epoch
    // changes, every key below it changes with it, and the whole catalog
    // reprices. Keep epoch LAST so ['catalog','price'] stays a usable prefix.
    PRICE:                 (itemId, storeId, epoch) => ['catalog', 'price', itemId, storeId, epoch],
    // The canary re-price itself. Keyed by the frozen canary id list so a
    // different canary set can never be mistaken for a price movement.
    PRICE_EPOCH:           (storeId, canaryIds) => ['catalog', 'price-epoch', storeId, canaryIds],
  },

  INVENTORY: {
    STOCK: (itemCode) => ['inventory', 'stock', itemCode],
  },

  CUSTOMERS: {
    LOOKUP:   (mobile)    => ['customers', 'lookup', mobile],
    RETRIEVE: (partyId)   => ['customers', 'detail', partyId],
    LIST:     (params)    => ['customers', 'list', params],
    ALL:      (companyId) => ['customers', 'all', companyId],
    // Read-only fetch for the customer profile page's Wishlist tab —
    // independent of wishlistSlice, which only ever describes whichever
    // customer is currently ATTACHED to the POS session, not whichever
    // customer's profile an operator happens to be viewing (those are
    // often different people).
    WISHLIST: (partyId) => ['customers', 'wishlist', partyId],
  },

  // PARTY_ADDRESS removed 2026-08-27 — matches apiEndpoints.js's
  // PARTY_ADDRESS removal (dead: no service or hook ever used this key).

  ORDERS: {
    LIST:            (params)     => ['orders', 'list', params],
    CUSTOMER_ORDERS: (customerId, storeId) => ['orders', 'customer', customerId, storeId],
    DETAIL:          (orderId)    => ['orders', 'detail', orderId],
  },

  // ── ORDER FULFILLMENT ("Fulfill from order") ──────────────────────────────
  ORDER_FULFILLMENT: {
    READY_TO_INVOICE: (partyId) => ['order-fulfillment', 'ready', partyId],
    ALL_OPEN:          (partyId) => ['order-fulfillment', 'all-open', partyId],
  },

  INVOICES: {
    LIST:   (params)    => ['invoices', 'list', params],
    ALL:    (companyId) => ['invoices', 'all', companyId],
    DETAIL: (invoiceId) => ['invoices', 'detail', invoiceId],
  },

  // ── INVOICE HELPERS (checkout available balances) ─────────────────────────
  // ADVANCES/CREDIT_NOTE/EXCHANGE/OLD_GOLD/SCHEME collapsed into one RECEIPTS
  // key 2026-08-18 — one call (POSReceiptsSelect/List) now backs all 5
  // category totals; see useInvoiceHelpers.js.
  INVOICE_HELPERS: {
    RECEIPTS:        (partyId)            => ['invoice-helpers', 'receipts',   partyId],
    PARTY_DAILY_CASH:(partyId, companyId) => ['invoice-helpers', 'daily-cash', partyId, companyId],
  },

  // ── REPAIR INVOICE HELPERS (billing-time available balances) ──────────────
  REPAIR_INVOICE_HELPERS: {
    ADVANCES:    (partyId, companyId) => ['repair-invoice-helpers', 'advances',    partyId, companyId],
    SCHEME:      (partyId, companyId) => ['repair-invoice-helpers', 'scheme',      partyId, companyId],
    CREDIT_NOTE: (partyId, companyId) => ['repair-invoice-helpers', 'credit-note', partyId, companyId],
    EXCHANGE:    (partyId, companyId) => ['repair-invoice-helpers', 'exchange',    partyId, companyId],
  },

  RETURNS: {
    LIST:       (params)        => ['returns', 'list', params],
    DETAIL:     (transactionId) => ['returns', 'detail', transactionId],
    SOLD_ITEMS: (partyId)       => ['returns', 'sold-items', partyId],
  },

  REFUNDS: {
    LIST:             (params)   => ['refunds', 'list', params],
    DETAIL:           (refundId) => ['refunds', 'detail', refundId],
    CUSTOMER_CREDITS: (partyId)  => ['refunds', 'customer-credits', partyId],
  },

  CREDIT_NOTES: {
    LIST:   (params)          => ['credit-notes', 'list', params],
    DETAIL: (transactionId)   => ['credit-notes', 'detail', transactionId],
  },

  EXCHANGE: {
    LIST:   (params)          => ['exchange', 'list', params],
    DETAIL: (transactionId)   => ['exchange', 'detail', transactionId],
  },

  BUYBACK: {
    LIST:   (params)          => ['buyback', 'list', params],
    DETAIL: (transactionId)   => ['buyback', 'detail', transactionId],
  },

  URD_PURCHASE: {
    LIST:   (params)          => ['urd-purchase', 'list', params],
    DETAIL: (transactionId)   => ['urd-purchase', 'detail', transactionId],
  },

  REPAIR: {
    // Workshop repair orders (document 75) — the source an intake is raised
    // against. Distinct from the three POS repair documents below.
    ORDERS:              (params)          => ['repair', 'orders', params],
    ORDER_DETAIL:        (transactionId)   => ['repair', 'order-detail', transactionId],
    SOLD_ITEMS:          (params)          => ['repair', 'sold-items', params],
    LOCATION:            (companyId)       => ['repair', 'location', companyId],
    REPAIR_INS:          (params)          => ['repair', 'repair-ins', params],
    REPAIR_IN_DETAIL:    (transactionId)   => ['repair', 'repair-in-detail', transactionId],
    REPAIR_OUTS:         (params)          => ['repair', 'repair-outs', params],
    REPAIR_INVOICES:     (params)          => ['repair', 'repair-invoices', params],
    REPAIR_INVOICE_DETAIL:(transactionId)  => ['repair', 'repair-invoice-detail', transactionId],
  },

  ESTIMATION: {
    LIST:   (params)          => ['estimation', 'list', params],
    DETAIL: (transactionId)   => ['estimation', 'detail', transactionId],
  },

  DAILY_CLOSING: {
    LIST:   (companyId)  => ['daily-closing', 'list', companyId],
    DETAIL: (closingId)  => ['daily-closing', 'detail', closingId],
    // System-recorded receipt totals for a given store+date, used to
    // reconcile the manually-typed EOD form — see useDailyClosingReconciliation.
    RECONCILIATION: (companyId, dateString) => ['daily-closing', 'reconciliation', companyId, dateString],
  },

  CRM: {
    PROMOTION:              (promoCode)   => ['crm', 'promotion', promoCode],
    PROMOTION_LIST:         ()            => ['crm', 'promotion-list'],
    GIFT_VOUCHER_CHECK:     (voucherCode) => ['crm', 'gift-voucher-check', voucherCode],
  },

  CUSTOMER_HISTORY: {
    TRANSACTIONS:      (customerId) => ['customer-history', 'transactions',      customerId],
    ITEM_TRANSACTIONS: (customerId) => ['customer-history', 'item-transactions',  customerId],
    TOTAL_RECEIPTS:    (customerId) => ['customer-history', 'total-receipts',     customerId],
    TOTAL_PROMOTIONS:  (customerId) => ['customer-history', 'total-promotions',   customerId],
  },

  CUSTOMER_360: {
    ALL: (customerId, storeId) => ['customer-360', 'all', customerId, storeId],
  },

  REWARDS: {
    POINTS:          (customerId) => ['rewards', 'points',  customerId],
    LOYALTY_HISTORY: (customerId) => ['rewards', 'history', customerId],
  },

  SCHEMES: {
    LIST:                ()               => ['schemes', 'list'],
    ENROLLMENTS:         (params)         => ['schemes', 'enrollments', params],
    ENROLLMENT_DETAIL:   (enrollmentId)   => ['schemes', 'enrollment-detail', enrollmentId],
    CUSTOMER_ENROLLMENTS:(customerId, storeId) => ['schemes', 'enrollments', 'customer', customerId, storeId],
    RECEIPT_LIST:        (enrollmentId)   => ['schemes', 'receipts', enrollmentId],
    MONTHLY_DETAILS:     (enrollmentId)   => ['schemes', 'monthly-details', enrollmentId],
    MATURITY:            (enrollmentId)   => ['schemes', 'maturity',     enrollmentId],
    FORECLOSE:           (enrollmentId)   => ['schemes', 'foreclose',    enrollmentId],
    CANCELLATION:        (enrollmentId)   => ['schemes', 'cancellation', enrollmentId],
  },

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