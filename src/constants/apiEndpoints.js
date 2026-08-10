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
    GET_STOCK:          'Services/Inventory/GetStock',
    STOCK_JOURNAL_LIST: 'Services/Inventory/StockJournal/List',
    // Path is Services/POS/... (not Inventory/...) despite living in this
    // group — grouped here for cohesion with STOCK_JOURNAL_LIST since it's
    // fired immediately after it in the barcode-scan flow, confirmed live
    // 2026-08-10 off lucira.uat.ornaverse.in/pos's own network capture.
    ITEM_ENQUIRIES_CREATE: 'Services/POS/ItemEnquiries/Create',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS (rate calculation)
  // SET_SALES_ITEMS is the real per-variant price calculator — GET_RATE is
  // NOT used for this (confirmed 2026-07-22: OrnaVerse's own live UI never
  // calls GetRate when a variant is selected, only SetSalesItems). GetRate
  // itself remains unconfirmed/unwired — a bare { item_id } 500s (generic
  // unhandled exception), do not guess its contract further.
  //
  // SET_SALES_ITEMS contract — confirmed live 2026-07-22 against both
  // OrnaVerse's live tenant and our own UAT tenant (see pricingService.js):
  //   POST { selected_products: [ <full item object as returned by
  //     Style/Retrieve's style_variants[] or Items/Retrieve, unmodified —
  //     including its placeholder item_rate:0/item_labour:0 and full
  //     item_components[] BOM> ], price_list_id: 0, calculate_rates: true,
  //     document_date: <now, UTC string>, document_id: 52,
  //     exchange_rate: 1, generate_line_no: false, generate_lot_no: false,
  //     is_labour_applicable: true, is_purchase: false,
  //     is_tax_applicable: true }
  //   → { Entities: [ <same item shape, but item_rate/item_labour/
  //       sub_total/tax_amount/net_amount/item_components[].rate all
  //       recomputed against TODAY's live metal/stone rates> ] }
  //
  // document_id: 52 is a document-TYPE constant (same concept as our own
  // Invoice type being 54 — see useCreateInvoice.js), not a specific
  // order/transaction instance — confirmed portable across both tenants.
  // Stateless: response always comes back with ref_document_id: 0 and
  // ref_transaction_id: 0 — nothing is created or staged server-side, so
  // this is safe to call from a pure price-preview context (product detail
  // / customize sheet) before any cart or order exists.
  //
  // COSTING.GET_ALL_RATES / GET_METAL_RATE below are a DIFFERENT thing
  // (raw metal/stone/labour rate tables) — also unverified, zero callers
  // anywhere in this codebase despite existing since an earlier session.
  // ─────────────────────────────────────────────────────────────────────────
  // SET_RETURN_ITEMS is the RETURNS counterpart of SET_SALES_ITEMS —
  // discovered 2026-07-30 by capturing OrnaVerse's own UAT Returns journey.
  // A return line item CANNOT be hand-built (that was the cause of the long
  // run of opaque 500s on Return/Create): the server expects the ~186-field
  // computed object this endpoint returns.
  //
  // Confirmed request shape (their own UI):
  //   POST { selected_products: [ <full sold-item object from
  //          POS/InvoiceItems/List with get_child:true — 189 fields,
  //          carrying ref_transaction_id/ref_document_id back to the
  //          original invoice> ],
  //          exchange_rate: 1, document_date: <Date.toDateString()>,
  //          is_tax_applicable: false, calculate_rates: false }
  //   → { Entities: [ <line item ready to drop into Return/Create> ] }
  // SET_BUYBACK_ITEMS / SET_EXCHANGE_ITEMS are the same idea for Buy Back
  // and Exchange (all confirmed 2026-07-30 from capture sessions). Both
  // omit calculate_rates, unlike the return variant:
  //   POST { selected_products: [...], document_date, exchange_rate: 1,
  //          is_tax_applicable: false }
  HELPERS: {
    GET_RATE:           'Services/Helpers/GetRate',
    SET_SALES_ITEMS:    'Services/Helpers/SetSalesItems',
    SET_RETURN_ITEMS:   'Services/Helpers/SetReturnItems',
    SET_BUYBACK_ITEMS:  'Services/Helpers/SetBuyBackItems',
    SET_EXCHANGE_ITEMS: 'Services/Helpers/SetExchangeItems',
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
  // WALK-IN
  // Store-entry customer check: staff enters mobile; if registered, returns
  // Customer + WalkInRecorded:true (also WRITES a customer_visits row against
  // the active store, resolved server-side from the token — NOT a pure read).
  // If unregistered, returns { WalkInRecorded: false } with no Customer —
  // caller opens the New Customer signup form.
  // Confirmed via live UAT test 2026-07-19. Request: { mobile }. Only sending
  // `mobile` works — adding company_id/current_company_id causes a 500.
  // Response.Customer.mobile is pre-masked by the API (******9999); the
  // per-visit rows under customer_visits[].mobile come back unmasked.
  // Because every call records a visit, only fire this once per staff
  // submission — never speculatively (e.g. on keystroke).
  // ─────────────────────────────────────────────────────────────────────────
  WALKIN: {
    LOOKUP: 'Services/POS/WalkIn/Lookup',
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
  // Customer returns items from a previous purchase.
  // Flow (confirmed 2026-07-30 by capturing OrnaVerse's own UAT journey):
  //   1. SOLD_ITEMS  → what this customer has actually bought (returnable)
  //   2. HELPERS.SET_RETURN_ITEMS → price the chosen piece(s) for return
  //   3. CREATE → POST
  //
  // SOLD_ITEMS (POS/InvoiceItems/List) confirmed request:
  //   { Take: 25, party_id, transaction_type: 1, get_child: true,
  //     IncludeColumns: [item_code,item_line_no,pieces,weight,net_weight,sku,document_no] }
  // get_child:true is ESSENTIAL — it returns the full nested item
  // (item_components etc.) that SET_RETURN_ITEMS needs as input.
  // transaction_type:1 = sold items.
  // ─────────────────────────────────────────────────────────────────────────
  RETURNS: {
    CREATE:     'Services/POS/Return/Create',
    POST:       'Services/POS/Return/Post',
    CANCEL:     'Services/POS/Return/Cancel',
    RETRIEVE:   'Services/POS/Return/Retrieve',
    LIST:       'Services/POS/Return/List',
    SOLD_ITEMS: 'Services/POS/InvoiceItems/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REFUNDS
  // Cash/payment refund to customer
  // ─────────────────────────────────────────────────────────────────────────
  // A Refund PAYS OUT credit that a Return / Exchange / Buy Back already
  // raised — it has no line items of its own. Confirmed 2026-07-31 by
  // capturing the ERP's own Refund dialog (there is no Refund screen in
  // their POS UI; only the ERP at /POS/Refund has one).
  //
  //   CUSTOMER_CREDITS ({ party_id }) → that customer's OUTSTANDING credits
  //     (already-settled ones are filtered out server-side). Each row is a
  //     Return/Exchange/Buy Back document and carries the transaction_id
  //     that the refund receipt must reference.
  //   CREATE  → ONE call, with details[] and receipts[] nested.
  //
  // ADD_DETAIL / ADD_RECEIPT are NOT needed — the old three-call sequence
  // (create → RefundDetails/Create → RefundReceipts/Create) never linked to
  // a credit document at all, so it created refunds that settled nothing.
  REFUNDS: {
    CREATE:           'Services/POS/Refund/Create',
    UPDATE:           'Services/POS/Refund/Update',
    DELETE:           'Services/POS/Refund/Delete',
    RETRIEVE:         'Services/POS/Refund/Retrieve',
    LIST:             'Services/POS/Refund/List',
    CUSTOMER_CREDITS: 'Services/POS/POSReceiptsSelect/List',
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
    // The WORKSHOP repair order (document_id 75, prefix "REP"), created in
    // Inventory — NOT one of the three POS repair documents below. A Repair In
    // line item is copied from one of these orders' lines and points back at it
    // via ref_document_id 75 / ref_transaction_id / ref_transaction_item_id.
    // Confirmed 2026-08-01 off real posted records; see [[repair-flow-contract]].
    REPAIR_ORDER_LIST:     'Services/Inventory/Repair/List',
    REPAIR_ORDER_RETRIEVE: 'Services/Inventory/Repair/Retrieve',
    REPAIR_ORDER_CREATE:   'Services/Inventory/Repair/Create',
    REPAIR_ORDER_POST:     'Services/Inventory/Repair/Post',
    REPAIR_ORDER_CANCEL:   'Services/Inventory/Repair/Cancel',
    // Sold items eligible for repair. NOTE transaction_type 3 — Return/Buyback/
    // Exchange use 1 and Credit Note uses 4. Three journeys, three values.
    REPAIR_SOLD_ITEMS:     'Services/POS/InvoiceItems/List',
    // Stock locations per company. A repair lands in the one named "Repair"
    // (location_id 2 on this tenant) — matches every real Repair Order record.
    COMPANY_LOCATIONS:     'Services/Administration/CompanyWiseLocations/List',
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
  // DOCUMENT CONFIG (per-document-type header fields for Order/Invoice Create)
  // Confirmed live 2026-07-28 via OrnaVerse's own OAuth client_credentials
  // token: root-caused the Order/Invoice/Create 500s to two entirely-missing
  // header fields that neither endpoint's 400 validation ever complained
  // about, so they went undetected until we captured a real working payload
  // from OrnaVerse's own frontend and cross-checked it against v1.json:
  //
  //   financial_year_id — NOT a customer/document field. FinancialYear/List
  //   returns { financial_year_id, from_date, to_date, financial_year_code }
  //   rows with no company/document scoping at all — resolve by finding the
  //   row where from_date <= today <= to_date. Confirmed live: FY 2025-2026
  //   (id 1) and FY 2026-2027 (id 3, current as of 2026-07).
  //
  //   ledger_id — NOT sourced from the customer (CustomerRow only has
  //   payable_ledger_id/receivable_ledger_id/wip_ledger_id/loss_ledger_id,
  //   confirmed via v1.json schema — no bare ledger_id). It's the document
  //   TYPE's own configured control ledger: DocumentNumberingRow, keyed by
  //   (document_id, company_id). Confirmed live: document_id 53 (RPO/Order),
  //   company_id 1 (HO) → ledger_id 182 — an EXACT match to the real
  //   ledger_id captured from OrnaVerse's own successful Order/Create.
  //   Same row also carries is_tax_applicable/auto_posting/
  //   is_document_number_editable — send those from here too rather than
  //   hardcoding, since they're genuinely per-document-type config, not
  //   universal constants.
  // ─────────────────────────────────────────────────────────────────────────
  DOCUMENT_CONFIG: {
    FINANCIAL_YEAR_LIST:   'Services/Administration/FinancialYear/List',
    DOCUMENT_NUMBERING_LIST: 'Services/Administration/DocumentNumbering/List',
    // The print/preview formats configured for a document type. Captured
    // from OrnaVerse's own POS 2026-08-05: immediately after Invoice/Create
    // they call this with { document_id, is_disabled: false } and offer the
    // operator a "Select Report" choice. For POS Invoice (54) this tenant
    // returns three — "E Certificate", "New Invoice Format" and
    // "New Invoice Format WO Header".
    //
    // There is no GeneratePDF: Services/POS/Invoice/GeneratePDF, which this
    // app used to call, returns 500 on UAT. Rendering goes through
    // REPORT_RENDER below instead.
    DOCUMENT_REPORTS_LIST: 'Services/Administration/DocumentReports/List',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REPORT RENDERING
  //
  // NOTE THE MISSING "Services/" — these are MVC endpoints on the OrnaVerse
  // web app, not the OAuth-protected JSON API, and they are COOKIE
  // authenticated. Posting a bearer token to them returns the ERP's own
  // "Login to your account" page (verified 2026-08-05), so they cannot be
  // called through our axios instance. Their own client posts a plain form
  // to them from the browser; see InvoiceReportButton for how we do the same.
  //
  // Body (application/x-www-form-urlencoded), all four from the
  // DocumentReports row:
  //   key, opt (JSON params, e.g. {"transaction_id":1207}),
  //   reportFile, reportFolder, reportSubFolder
  //
  // RENDER returns an HTML document their UI shows in an iframe preview;
  // PRINT_RENDER is the print variant.
  //
  // Not currently referenced via these constants — InvoiceReportButton
  // hardcodes 'Print/Render' directly (see its own header comment for why).
  // Kept here as the documented contract for that endpoint regardless.
  // ─────────────────────────────────────────────────────────────────────────
  REPORT_RENDER: {
    RENDER:       'Print/Render',
    PRINT_RENDER: 'Print/PrintRender',
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
  },


};

export default API;