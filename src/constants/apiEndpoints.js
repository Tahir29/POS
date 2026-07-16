// src/constants/apiEndpoints.js
//
// Single source of truth for every OrnaVerse API endpoint used in Lucira POS.
// All calls use POST. All paths verified against v1.json (3932 endpoints, June 2026).
//
// ARCHITECTURE DECISIONS (do not re-litigate):
//  - Order creation: POS/Order/Create → POS/Order/Post (native POS flow, no Marketplace)
//  - Invoice creation: POS/Invoice/Create → POS/Invoice/Post (native POS flow)
//  - Customer create/update: POS/Customer/Create + POS/Customer/Update (native POS)
//  - MarketPlace namespace removed — no longer needed for any POS operation
//
// SCHEMA NOTES (field names confirmed from spec, never assume):
//  - UsersCompanyRow:      store name = mailing_name  (NO company_name field)
//  - POS.CustomerRow:      key = party_id, name = party_name
//  - POS.OrderRow:         key = transaction_id, number = document_no, date = document_date
//                          amount = net_amount, status DERIVED from balance_amount + receipt_amount
//  - POS.InvoiceRow:       identical structure to OrderRow
//  - Master.StyleRow:      external_product_id lives HERE (Shopify link)
//  - ProductCatalogRow:    NO external_product_id — price field = price (not item_rate)
//  - SchemeEnrollmentRow:  benifit_amount — API typo, preserve exactly in code
//  - OrderItemsRow:        item_rate = unit price on line items (different from catalog price)

const API = {

  // ─────────────────────────────────────────────────────────────────────────
  // AUTHENTICATION
  // Identity server — not in v1.json spec (separate service, always POST)
  // ─────────────────────────────────────────────────────────────────────────
  AUTH: {
    GENERATE_TOKEN: 'connect/token',
    REFRESH_TOKEN:  'connect/token',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // STORES
  // Response: Entities[] of UsersCompanyRow
  // Fields: company_id, company_code, mailing_name, is_disabled
  // ─────────────────────────────────────────────────────────────────────────
  STORES: {
    GET_USER_STORES: 'Services/Administration/Stores/GetUserStores',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HR — EMPLOYEE
  // EmployeeRow.user_id links back to UsersCompanyRow.user_id (from GetUserStores).
  // Used to resolve the logged-in user's employee_id, which OrnaVerse expects
  // as `sales_person_id` on SchemeEnrollment/Create (confirmed field name via v1.json).
  // ─────────────────────────────────────────────────────────────────────────
  HR: {
    EMPLOYEE_LIST: 'Services/HR/Employee/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SETTINGS & CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────
  SETTINGS: {
    GET_PAYMENT_MODES:        'Services/Administration/PaymentReceiptMode/List',
    GET_PAYMENT_MODES_REFUND: 'Services/Administration/PaymentReceiptMode/PaymentModesForRefund',
    GET_TAXES:                'Services/Common/GetTaxes',
    CHECK_METAL_RATE_TODAY:   'Services/Common/Common/CheckMetalRateForToday',
    GET_REASON_CODES:         'Services/Administration/Reason/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LOCATION MASTER
  // Cascading dropdowns: Country → State → City
  // Used in customer create/update forms
  // ─────────────────────────────────────────────────────────────────────────
  LOCATION: {
    COUNTRIES: 'Services/Master/Countries/List',
    STATES:    'Services/Master/States/List',
    CITIES:    'Services/Master/Cities/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORIES
  // Static datasets — fetch once, cache for session
  // ─────────────────────────────────────────────────────────────────────────
  CATEGORIES: {
    GET_TYPES:       'Services/Master/Type/List',
    GET_SUBTYPES:    'Services/Master/SubType/List',
    GET_ITEM_GROUPS: 'Services/Master/ItemGroups/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ITEMS / PRODUCTS (Master data)
  // Items = master SKU catalogue with full specifications
  // external_product_id (Shopify) lives on StyleRow from DESIGN_DETAIL
  // NOT on ProductCatalogRow — never try to read it from catalog
  // ─────────────────────────────────────────────────────────────────────────
  ITEMS: {
    LIST:          'Services/Master/Items/List',
    RETRIEVE:      'Services/Master/Items/Retrieve',
    SIZES:         'Services/Master/ItemsSizes/List',
    ATTRIBUTES:    'Services/Master/Attributes/List',
    DESIGNS:       'Services/Master/Style/GetDesigns',
    DESIGN_DETAIL: 'Services/Master/Style/Retrieve',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CATALOG (Live store inventory)
  // Always send current_company_id = activeStoreId
  // Price field on ProductCatalogRow = price (NOT item_rate)
  // has_stock (boolean), current_company_pieces (int)
  // ─────────────────────────────────────────────────────────────────────────
  CATALOG: {
    GET_PRODUCTS:              'Services/Inventory/ProductCatalog/List',
    GET_STOCK_BY_STORES:       'Services/Inventory/ProductCatalog/GetStockByStores',
    GET_STOCK_BY_STORES_BATCH: 'Services/Inventory/ProductCatalog/GetStockByStoresBatch',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INVENTORY
  // ─────────────────────────────────────────────────────────────────────────
  INVENTORY: {
    GET_STOCK: 'Services/Inventory/GetStock',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMERS
  // All native POS endpoints — MarketPlace/Customer/Generate scrapped
  // Key: party_id | Name: party_name | Mobile: mobile
  // Address: city_id/state_id/country_id + city_name/state_name/country_name
  // ─────────────────────────────────────────────────────────────────────────
  CUSTOMERS: {
    GET_CUSTOMER: 'Services/POS/Customer/GetCustomer',
    LIST:         'Services/POS/Customer/List',
    RETRIEVE:     'Services/POS/Customer/Retrieve',
    CREATE:       'Services/POS/Customer/Create',
    UPDATE:       'Services/POS/Customer/Update',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PARTY ADDRESS
  // Customer address book CRUD
  // ─────────────────────────────────────────────────────────────────────────
  PARTY_ADDRESS: {
    LIST:   'Services/Master/PartyAddress/List',
    CREATE: 'Services/Master/PartyAddress/Create',
    UPDATE: 'Services/Master/PartyAddress/Update',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ORDERS (POS native)
  // Flow: Create → (optional Update) → Post
  // Key: transaction_id | Number: document_no | Date: document_date
  // Amount: net_amount | Status DERIVED (not a field):
  //   balance_amount <= 0                        → "paid"
  //   balance_amount > 0 && receipt_amount > 0   → "partial"
  //   balance_amount > 0 && receipt_amount == 0  → "due"
  // ─────────────────────────────────────────────────────────────────────────
  ORDERS: {
    CREATE:         'Services/POS/Order/Create',
    UPDATE:         'Services/POS/Order/Update',
    POST:           'Services/POS/Order/Post',
    CANCEL:         'Services/POS/Order/Cancel',
    RETRIEVE:       'Services/POS/Order/Retrieve',
    LIST:           'Services/POS/Order/List',
    APPLY_DISCOUNT: 'Services/POS/Order/ApplyAdditionalDiscount',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INVOICES (POS native)
  // Flow: Create → (optional Update) → Post
  // Same field structure as OrderRow + is_insured boolean
  // ─────────────────────────────────────────────────────────────────────────
  INVOICES: {
    CREATE:         'Services/POS/Invoice/Create',
    UPDATE:         'Services/POS/Invoice/Update',
    POST:           'Services/POS/Invoice/Post',
    CANCEL:         'Services/POS/Invoice/Cancel',
    RETRIEVE:       'Services/POS/Invoice/Retrieve',
    LIST:           'Services/POS/Invoice/List',
    GENERATE_PDF:   'Services/POS/Invoice/GeneratePDF',
    APPLY_DISCOUNT: 'Services/POS/Invoice/ApplyAdditionalDiscount',
    DAY_WISE_SALES: 'Services/POS/Invoice/DayWiseSalesList',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INVOICE RECEIPTS (payment entries against an invoice)
  // mode_id, mode_name, amount per receipt row
  // ─────────────────────────────────────────────────────────────────────────
  INVOICE_RECEIPTS: {
    CREATE:           'Services/POS/InvoiceReceipt/Create',
    LIST:             'Services/POS/InvoiceReceipt/List',
    VALIDATE_VOUCHER: 'Services/POS/InvoiceReceipt/ValidateVoucher',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INVOICE HELPERS
  // Fetch available balances for a customer at checkout time
  // Call before rendering payment section to show what customer can apply
  // ─────────────────────────────────────────────────────────────────────────
  INVOICE_HELPERS: {
    GET_ADVANCES:        'Services/POS/POSInvoice/GetAdvances',
    GET_CREDIT_NOTE:     'Services/POS/POSInvoice/GetCreditNote',
    GET_EXCHANGE:        'Services/POS/POSInvoice/GetExchange',
    GET_OLD_GOLD:        'Services/POS/POSInvoice/GetOldGold',
    GET_SCHEME:          'Services/POS/POSInvoice/GetScheme',
    GET_PARTY_DAILY_CASH:'Services/POS/POSInvoice/GetPartyDailyCash',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // RETURNS
  // Customer returns items from a previous invoice
  // Flow: Create → Post
  // ─────────────────────────────────────────────────────────────────────────
  RETURNS: {
    CREATE:   'Services/POS/Return/Create',
    POST:     'Services/POS/Return/Post',
    CANCEL:   'Services/POS/Return/Cancel',
    RETRIEVE: 'Services/POS/Return/Retrieve',
    LIST:     'Services/POS/Return/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REFUNDS
  // Cash/payment refund to customer
  // ─────────────────────────────────────────────────────────────────────────
  REFUNDS: {
    CREATE:      'Services/POS/Refund/Create',
    UPDATE:      'Services/POS/Refund/Update',
    DELETE:      'Services/POS/Refund/Delete',
    RETRIEVE:    'Services/POS/Refund/Retrieve',
    LIST:        'Services/POS/Refund/List',
    ADD_DETAIL:  'Services/POS/RefundDetails/Create',
    ADD_RECEIPT: 'Services/POS/RefundReceipts/Create',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CREDIT NOTES
  // Store credit issued to customer (can be redeemed at next purchase)
  // Flow: Create → Post
  // ─────────────────────────────────────────────────────────────────────────
  CREDIT_NOTES: {
    CREATE:   'Services/POS/CreditNote/Create',
    POST:     'Services/POS/CreditNote/Post',
    CANCEL:   'Services/POS/CreditNote/Cancel',
    RETRIEVE: 'Services/POS/CreditNote/Retrieve',
    LIST:     'Services/POS/CreditNote/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EXCHANGE
  // Customer brings old jewellery, exchanges for new piece
  // Flow: Create → Post
  // ─────────────────────────────────────────────────────────────────────────
  EXCHANGE: {
    CREATE:   'Services/POS/Exchange/Create',
    POST:     'Services/POS/Exchange/Post',
    CANCEL:   'Services/POS/Exchange/Cancel',
    RETRIEVE: 'Services/POS/Exchange/Retrieve',
    LIST:     'Services/POS/Exchange/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BUY BACK
  // Store buys old jewellery from customer outright (no exchange)
  // Flow: Create → Post
  // ─────────────────────────────────────────────────────────────────────────
  BUYBACK: {
    CREATE:   'Services/POS/BuyBack/Create',
    POST:     'Services/POS/BuyBack/Post',
    CANCEL:   'Services/POS/BuyBack/Cancel',
    RETRIEVE: 'Services/POS/BuyBack/Retrieve',
    LIST:     'Services/POS/BuyBack/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // URD PURCHASE (Old Gold / Unregistered Dealer)
  // Purchase of raw old gold from customer or unregistered dealer
  // Flow: Create → Post
  // ─────────────────────────────────────────────────────────────────────────
  URD_PURCHASE: {
    CREATE:   'Services/POS/URDPurchase/Create',
    POST:     'Services/POS/URDPurchase/Post',
    CANCEL:   'Services/POS/URDPurchase/Cancel',
    RETRIEVE: 'Services/POS/URDPurchase/Retrieve',
    LIST:     'Services/POS/URDPurchase/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REPAIR
  // Full repair workflow: customer drops item → repair out → repair in → invoice
  // RepairIn = item comes in for repair
  // RepairOut = item goes to craftsman
  // RepairInvoice = billing when item is returned to customer
  // ─────────────────────────────────────────────────────────────────────────
  REPAIR: {
    REPAIR_IN_CREATE:      'Services/POS/RepairIn/Create',
    REPAIR_IN_POST:        'Services/POS/RepairIn/Post',
    REPAIR_IN_CANCEL:      'Services/POS/RepairIn/Cancel',
    REPAIR_IN_RETRIEVE:    'Services/POS/RepairIn/Retrieve',
    REPAIR_IN_LIST:        'Services/POS/RepairIn/List',
    REPAIR_OUT_CREATE:     'Services/POS/RepairOut/Create',
    REPAIR_OUT_POST:       'Services/POS/RepairOut/Post',
    REPAIR_OUT_LIST:       'Services/POS/RepairOut/List',
    REPAIR_INVOICE_CREATE:   'Services/POS/RepairInvoice/Create',
    REPAIR_INVOICE_POST:     'Services/POS/RepairInvoice/Post',
    REPAIR_INVOICE_RETRIEVE: 'Services/POS/RepairInvoice/Retrieve',
    REPAIR_INVOICE_LIST:     'Services/POS/RepairInvoice/List',
    REPAIR_INVOICE_RECEIPT:  'Services/POS/RepairInvoiceReceipt/Create',
    REPAIR_INVOICE_HELPERS_GET_ADVANCES:  'Services/POS/POSRepairInvoice/GetAdvances',
    REPAIR_INVOICE_HELPERS_GET_SCHEME:    'Services/POS/POSRepairInvoice/GetScheme',
    REPAIR_INVOICE_HELPERS_GET_CREDIT:    'Services/POS/POSRepairInvoice/GetCreditNote',
    REPAIR_INVOICE_HELPERS_GET_EXCHANGE:  'Services/POS/POSRepairInvoice/GetExchange',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ESTIMATION / QUOTATION
  // Generate price estimate before order — can be converted to invoice
  // Flow: Create → (optional Post to convert to order) | or Cancel
  // ─────────────────────────────────────────────────────────────────────────
  ESTIMATION: {
    CREATE:   'Services/POS/Estimation/Create',
    UPDATE:   'Services/POS/Estimation/Update',
    POST:     'Services/POS/Estimation/Post',
    CANCEL:   'Services/POS/Estimation/Cancel',
    RETRIEVE: 'Services/POS/Estimation/Retrieve',
    LIST:     'Services/POS/Estimation/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DAILY CLOSING
  // End-of-day reconciliation — no Post step, Create finalises
  // ─────────────────────────────────────────────────────────────────────────
  DAILY_CLOSING: {
    CREATE:   'Services/POS/DailyClosing/Create',
    RETRIEVE: 'Services/POS/DailyClosing/Retrieve',
    LIST:     'Services/POS/DailyClosing/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CRM
  // Promotions, gift vouchers
  // ─────────────────────────────────────────────────────────────────────────
  CRM: {
    // NOTE: GetPromotion does NOT filter by the code you send it — confirmed
    // 2026-07-15 by testing directly: it returns the same fixed record
    // regardless of input. Use LIST + client-side matching for code
    // validation instead (see promotionService.listPromotions).
    GET_PROMOTION:                'Services/CRM/Promotion/GetPromotion',
    LIST:                         'Services/CRM/Promotion/List',
    APPLY_PROMOTIONS:             'Services/Helper/ApplyPromotions',
    REVERSE_PROMOTION:            'Services/Helper/ReversePromotion',
    GIFT_VOUCHER_CHECK_UTILIZATION: 'Services/CRM/GiftVoucherTransactions/CheckUtilization',
    GIFT_VOUCHER_REDEEM:          'Services/CRM/GiftVoucherTransactions/CheckRedeem',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMER HISTORY
  // Full purchase/transaction history per customer
  // ─────────────────────────────────────────────────────────────────────────
  CUSTOMER_HISTORY: {
    TRANSACTIONS:      'Services/Reports/CustomerHistory/Transactions',
    ITEM_TRANSACTIONS: 'Services/Reports/CustomerHistory/ItemTransactions',
    TOTAL_RECEIPTS:    'Services/Reports/CustomerHistory/TotalReceipts',
    TOTAL_PROMOTIONS:  'Services/Reports/CustomerHistory/TotalPromotions',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REWARDS / LOYALTY POINTS
  // ─────────────────────────────────────────────────────────────────────────
  REWARDS: {
    GET_POINTS:      'Services/CRM/CustomerRewards/GetCustomerPoints',
    LOYALTY_HISTORY: 'Services/CRM/CustomerRewards/LoyaltyHistories',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SCHEMES (Jewellery savings/instalment schemes)
  // IMPORTANT: benifit_amount is an API-side typo — preserve exactly in code
  // Enrollment flow: ENROLL → monthly RECEIPT_CREATE payments → maturity/foreclose
  // ─────────────────────────────────────────────────────────────────────────
  SCHEMES: {
    LIST:                'Services/CRM/Schemes/List',
    ENROLLMENTS_LIST:    'Services/POS/SchemeEnrollment/List',
    ENROLL:              'Services/POS/SchemeEnrollment/Create',
    ENROLLMENT_RETRIEVE: 'Services/POS/SchemeEnrollment/Retrieve',
    RECEIPT_CREATE:      'Services/POS/SchemeReceipt/Create',
    RECEIPT_LIST:        'Services/POS/SchemeReceipt/List',
    MONTHLY_DETAILS:     'Services/POS/SchemeMonthlyDetails/List',
    MATURITY_BENEFIT:    'Services/Helper/GetSchemeMaturityBenefit',
    FORECLOSE_BENEFIT:   'Services/Helper/GetSchemeForcloseBenefit',
    CANCELLATION:        'Services/Helper/GetSchemeCancellation',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EXCHANGE RATE
  // Required on Order/Invoice Create alongside currency_id — confirmed via
  // direct UAT test 2026-07-16: currency_id 103 (INR) returns exchange_rate: 1.
  // ─────────────────────────────────────────────────────────────────────────
  EXCHANGE_RATE: {
    GET: 'Services/Administration/ExchangeRate/GetExchangeRate',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // COSTING / METAL RATES
  // Daily gold/silver/platinum rate updates
  // ─────────────────────────────────────────────────────────────────────────
  COSTING: {
    ADD_METAL_RATE: 'Services/Costing/MetalRates/Create',
    GET_METAL_RATE: 'Services/Helpers/GetMetalRate',
    GET_ALL_RATES:  'Services/Helpers/GetAllRates',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ANALYTICS
  // Business intelligence for store managers
  // ─────────────────────────────────────────────────────────────────────────
  ANALYTICS: {
    SKU_VELOCITY:           'Services/Analytics/SKUVelocity',
    CATEGORY_PERFORMANCE:   'Services/Analytics/CategoryPerformance',
    GROSS_PROFIT:           'Services/Analytics/GrossProfit',
    MONTHLY_REVENUE:        'Services/Analytics/MonthlyRevenueSummary/List',
    MONTHLY_REVENUE_DETAIL: 'Services/Analytics/MonthlyRevenueDetail/List',
    REORDER_SIGNAL:         'Services/Analytics/ReorderSignal',
    AI_ASK:                 'Services/Reporting/AIAnalytics/Ask',
    AI_INSIGHTS:            'Services/Reporting/AIAnalytics/GetInsights',
    POS_DASHBOARD:          'Services/Reports/POSDashbaord/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REPORTS (Operational POS reports)
  // ─────────────────────────────────────────────────────────────────────────
  REPORTS: {
    POS_RECEIPTS:          'Services/Reports/POSReceiptsReport/List',
    POS_RECEIPTS_DETAILED: 'Services/Reports/POSReceiptsDetailedReport/List',
    POS_TAX_DETAILS:       'Services/Reports/POSTaxDetails/List',
    RETURN_STATUS:         'Services/Reports/ReturnStatusReport/List',
    EXCHANGE_STATUS:       'Services/Reports/ExchangeStatusReport/List',
    CREDIT_NOTE_STATUS:    'Services/Reports/CreditNoteStatusReport/List',
    BUYBACK_STATUS:        'Services/Reports/BuyBackStatusReport/List',
    URD_PURCHASE_STATUS:   'Services/Reports/URDPurchseStatusReport/List',
    SCHEME_HISTORY:        'Services/Reports/SchemeHistoryReport/List',
    INVOICE_REPORT:        'Services/POS/InvoiceReport/List',
    SALES_WEEKLY:          'Services/POS/SalesFilters/WeeklySales',
    SALES_MONTHLY:         'Services/POS/SalesFilters/MonthlySales',
    SALES_QUARTERLY:       'Services/POS/SalesFilters/QuarterlySales',
  },

};

export default API;