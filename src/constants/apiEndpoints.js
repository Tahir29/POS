// src/constants/apiEndpoints.js
// Maps every OrnaVerse Advantage API endpoint used in Lucira POS.
// All API calls use POST method per OrnaVerse design convention.
// Source of truth: API_MAPPING.md

const API = {

  // ── AUTHENTICATION ────────────────────────────────────────
  AUTH: {
    GENERATE_TOKEN: 'connect/token',
    REFRESH_TOKEN:  'connect/token',
  },

  // ── STORES ───────────────────────────────────────────────
  STORES: {
    GET_USER_STORES: 'Services/Administration/Stores/GetUserStores',
  },

  // ── SETTINGS ─────────────────────────────────────────────
  SETTINGS: {
    GET_SETTINGS:      'Services/Administration/AppSettings/Retrieve',
    UPDATE_SETTINGS:   'Services/Administration/AppSettings/Update',
    GET_PAYMENT_MODES: 'Services/Administration/PaymentReceiptMode/List',
  },

  // ── CATEGORIES ───────────────────────────────────────────
  CATEGORIES: {
    GET_TYPES:       'Services/Master/Type/List',
    GET_SUBTYPES:    'Services/Master/SubType/List',
    GET_ITEM_GROUPS: 'Services/Master/ItemGroups/List',
  },

  // ── PRODUCTS / ITEMS ─────────────────────────────────────
  ITEMS: {
    LIST:            'Services/Master/Items/List',
    RETRIEVE:        'Services/Master/Items/Retrieve',
    SIZES:           'Services/Master/ItemsSizes/List',
    ATTRIBUTES:      'Services/Master/Attributes/List',
    STYLES:          'Services/Master/Style/List',
    DESIGNS:         'Services/Master/Style/GetDesigns',
    DESIGN_DETAIL:   'Services/Master/Style/Retrieve',
    IMAGE_UPLOAD:    'Services/Master/ItemImageUpload/UploadBase64',
  },

  // ── CATALOG ──────────────────────────────────────────────
  CATALOG: {
    GET_PRODUCTS:        'Services/Inventory/ProductCatalog/List',
    GET_STOCK_BY_STORES: 'Services/Inventory/ProductCatalog/GetStockByStores',
  },

  // ── INVENTORY ────────────────────────────────────────────
  INVENTORY: {
    GET_STOCK: 'Services/Inventory/GetStock',
  },

  // ── FULFILLMENT ──────────────────────────────────────────
  FULFILLMENT: {
    LIST: 'Services/Inventory/OrderItemFulfilment/List',
  },

  // ── CUSTOMERS ────────────────────────────────────────────
  CUSTOMERS: {
    GET_CUSTOMER:    'Services/POS/Customer/GetCustomer',
    CREATE_CUSTOMER: 'Services/MarketPlace/Customer/Generate',
    LIST:            'Services/POS/Customer/List'
  },

  // ── ORDERS — POS ─────────────────────────────────────────
  ORDERS: {
    LIST:           'Services/POS/Order/List',
    RETRIEVE:       'Services/POS/Order/Retrieve',
    INVOICE_LIST:   'Services/POS/Invoice/List',
    INVOICE_DETAIL: 'Services/POS/Invoice/Retrieve',
  },

  // ── ORDERS — MARKETPLACE ─────────────────────────────────
  MARKETPLACE: {
    CREATE_ORDER:      'Services/MarketPlace/Order/Generate',
    CREATE_RETURN:     'Services/MarketPlace/Return/CreateReturn',
    ORDER_ITEM_STATUS: 'Services/MarketPlace/Order/GetOrderItemStatus',
  },

  // ── CRM ──────────────────────────────────────────────────
  // NOTE: Gift Card and Gift Voucher URLs are missing from the
  // OrnaVerse API collection. Marked null until confirmed.
  CRM: {
    GET_PROMOTION:        'Services/CRM/Promotion/GetPromotion',
    VALIDATE_GIFT_CARD:   null,
    VALIDATE_GIFT_VOUCHER: null,
  },

  // ── SCHEMES ──────────────────────────────────────────────
  SCHEMES: {
    LIST:              'Services/CRM/Schemes/List',
    ENROLLMENTS_LIST:  'Services/POS/SchemeEnrollment/List',
    ENROLL:            'Services/POS/SchemeEnrollment/Create',
    RECEIPT:           'Services/POS/SchemeReceipt/Create',
    MATURITY_BENEFIT:  'Services/Helper/GetSchemeMaturityBenefit',
    FORECLOSE_BENEFIT: 'Services/Helper/GetSchemeForcloseBenefit',
    CANCELLATION:      'Services/Helper/GetSchemeCancellation',
  },

  // ── COSTING ──────────────────────────────────────────────
  COSTING: {
    ADD_METAL_RATE: 'Services/Costing/MetalRates/Create',
  },

};

export default API;