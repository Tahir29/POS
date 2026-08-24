// POS Repair workflow — full lifecycle management.
// All functions are pure HTTP wrappers — no business logic.
//
// REPAIR WORKFLOW:
//   1. RepairIn   — customer drops item at store (intake, assessment, estimation)
//   2. RepairOut  — item sent to craftsman/workshop for work
//   3. RepairInvoice — item returned to customer, billing raised
//
// Each stage has its own create/post flow.
// RepairInvoice has its own helpers (GET_SCHEME, GET_ADVANCES, etc.)
// mirroring the main invoice helpers but scoped to repair transactions.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import APP_CONFIG from '@/constants/appConfig';

// ─── REPAIR ORDER (the workshop job the intake is raised against) ─────────────
//
// Confirmed 2026-08-01 off real posted UAT records (see [[repair-flow-contract]]).
//
// A Repair In line item is NOT free-typed — it is COPIED from a Repair Order
// line and points back at it. Real record: Repair In REPI-06-26-027 line
// carries ref_document_id 75, ref_transaction_id 122, ref_transaction_item_id
// 146, i.e. the line of order FCS-REP-06-26-2.
//
// Repair Order lines are ~188-key objects; the Repair In line is a ~47-key
// subset. mapOrderLineToRepairInLine() below performs exactly that projection,
// copying only fields observed on a real Repair In line — nothing invented.

/** document_id of the workshop Repair Order. */
export const REPAIR_ORDER_DOCUMENT_ID = 75;

/**
 * repair_type — read out of OrnaVerse's own bundle (RepairForm,
 * formKey "Inventory.Repair"). It drives which items can be picked.
 */
export const REPAIR_TYPE = {
  STOCK_ITEM:    1,  // repairing a piece from our own stock
  CUSTOMER_ITEM: 2,  // repairing something the customer bought from us
};

/** "Where will this be repaired?" — their counter's toggle. */
export const REPAIR_LOCATION_TYPE = {
  OUR_WORKSHOP: 1,
  HEAD_OFFICE:  2,
};

/**
 * Sold items eligible for repair.
 *
 * `transaction_type: 3` is the repair-specific value — Return/Buyback/
 * Exchange use 1 and Credit Note uses 4. Confirmed from their client source,
 * which also refuses with "Please select Party to proceed" when repair_type
 * is CUSTOMER_ITEM and no party is set.
 *
 * @param {{ partyId: number, companyId: number, take?: number }} params
 */
export async function getRepairableSoldItems({ partyId, companyId, take = 25 }) {
  if (!partyId) return [];
  const response = await axiosInstance.post(API.REPAIR.REPAIR_SOLD_ITEMS, {
    Take: take,
    party_id: partyId,
    company_id: companyId,
    transaction_type: 3,
    get_child: true,
  });
  return response.data?.Entities ?? [];
}

/**
 * Prices picked items for a Repair Order.
 *
 * Captured live 2026-08-01: their counter calls Helpers/SetReturnItems — the
 * SAME helper Return uses — with document_id 75 and labour/tax off. Line
 * items are server-computed, so this is the only correct way to build them.
 *
 * @param {{ selectedProducts: object[], companyId: number }} params
 */
export async function priceRepairItems({ selectedProducts, companyId }) {
  const response = await axiosInstance.post(API.HELPERS.SET_RETURN_ITEMS, {
    selected_products:    selectedProducts,
    is_labour_applicable: false,
    is_tax_applicable:    false,
    document_id:          REPAIR_ORDER_DOCUMENT_ID,
    exchange_rate:        1,
    company_id:           companyId,
  });
  return response.data?.Entities ?? response.data ?? [];
}

/**
 * Resolves the stock location a repair lands in.
 *
 * Every real Repair Order on this tenant carries `location_id: 2`, which
 * `CompanyWiseLocations/List` names "Repair". Matched by name rather than
 * hardcoded, since the id is per-tenant. Falls back to the first location.
 *
 * @param {number} companyId
 * @returns {Promise<number|null>}
 */
export async function getRepairLocationId(companyId) {
  const response = await axiosInstance.post(API.REPAIR.COMPANY_LOCATIONS, {
    Take: 50,
    company_id: companyId,
  });
  const rows = response.data?.Entities ?? [];
  const repairLocation = rows.find(
    (l) => /^repair$/i.test((l.location_name ?? l.name ?? '').trim()),
  );
  return (repairLocation ?? rows[0])?.location_id ?? null;
}

/**
 * Builds the Inventory/Repair Entity.
 *
 * Field list transcribed from their own `RepairForm` definition
 * (formKey "Inventory.Repair", 49 fields) in
 * /esm/_chunks/chunk-CJSQNCGC.js — their Save button never fires a Create on
 * this tenant, so the payload could not be captured from traffic.
 * See [[repair-flow-contract]].
 *
 * CONFIRMED BROKEN live 2026-08-14, independent of anything this function
 * builds: Inventory/Repair/Create returns a generic 500 even for a bare
 * 4-field payload ({document_id, document_date, party_id, company_id}),
 * and adding financial_year_id/ledger_id/repair_type/location_id on top
 * changes nothing. Since this document type has never been captured from
 * real traffic (see above), there's no known-good payload to diff against —
 * unlike Order/Return/etc., which each eventually got fixed by comparing
 * against a real captured request. Every Repair Order visible via
 * Inventory/Repair/List right now (e.g. HO-REP-08-26-1 for Tahir Kutty,
 * transaction_id 130) predates this app entirely. Needs OrnaVerse's team.
 */
export function buildRepairOrderPayload({
  partyId, partyName, phoneCode, address, stateName,
  companyId, financialYearId, ledgerId,
  documentDate, deliveryDate,
  repairType = REPAIR_TYPE.CUSTOMER_ITEM,
  repairLocationType = REPAIR_LOCATION_TYPE.OUR_WORKSHOP,
  repairLocation, locationId,
  lineItems, narration, remark,
  allowBackdatedEntry, numberOfBackdatedDays, isDocumentNumberEditable,
  autoPosting, isTaxApplicable,
}) {
  const sum = (field) =>
    +lineItems.reduce((s, l) => s + (Number(l[field]) || 0), 0).toFixed(3);
  const money = (field) =>
    +lineItems.reduce((s, l) => s + (Number(l[field]) || 0), 0).toFixed(2);

  const subTotal = money('sub_total');
  const netAmount = money('net_amount') || subTotal;

  return {
    // document_no deliberately omitted — the server assigns it.
    document_id:   REPAIR_ORDER_DOCUMENT_ID,
    document_date: documentDate,
    delivery_date: deliveryDate ?? null,
    party_id:      partyId,
    party_name:    partyName ?? '',
    phone_code:    phoneCode ?? '',
    address:       address ?? '',
    state_name:    stateName ?? '',
    company_id:        companyId,
    financial_year_id: financialYearId,
    ledger_id:         ledgerId,
    currency_id:   103,
    exchange_rate: 1,
    user_id:       null,
    ref_transaction_id: 0,
    // what kind of repair, and where it happens
    repair_type:          repairType,
    repair_location_type: repairLocationType,
    repair_location:      repairLocation,
    location_id:          locationId,
    is_transferred:       false,
    // aggregates, summed from the priced lines
    pieces:     sum('pieces'),
    weight:     sum('weight'),
    net_weight: sum('net_weight'),
    sub_total:      subTotal,
    base_sub_total: subTotal,
    taxable_amount: money('taxable_amount') || subTotal,
    tax_amount:     money('tax_amount'),
    discount:       money('discount'),
    additional_charges: 0,
    round_off:      0,
    net_amount:      netAmount,
    base_net_amount: netAmount,
    bill_no: '', bill_date: null, challan_no: '', challan_date: null,
    narration: narration ?? '',
    remark:    remark ?? '',
    payable_ledger_id:    155,
    receivable_ledger_id: 173,
    is_document_number_editable: isDocumentNumberEditable ?? false,
    allow_backdated_entry:       allowBackdatedEntry ?? true,
    number_of_backdated_days:    numberOfBackdatedDays ?? 60,
    auto_posting:      autoPosting ?? true,
    is_tax_applicable: isTaxApplicable ?? false,
    line_items: lineItems,
  };
}

/**
 * Creates a Repair Order (document 75).
 * @param {object} entity — output of buildRepairOrderPayload()
 */
export async function createRepairOrder(entity) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_ORDER_CREATE, {
    Entity: entity,
  });
  return response.data;
}

/**
 * Posts a Repair Order. Document 75 is auto_posting TRUE on this tenant, so
 * callers should gate on their own header config rather than calling blindly.
 * @param {number} transactionId
 */
export async function postRepairOrder(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_ORDER_POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Repair orders available to raise an intake against.
 * @param {{ partyId?: number, take?: number, company_id?: number }} params
 * @returns {Promise<object[]>}
 */
export async function getRepairOrders({ partyId, take = 50, company_id } = {}) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_ORDER_LIST, {
    Take: take,
    party_id: partyId ?? undefined,
    company_id: company_id ?? undefined,
  });
  return response.data?.Entities ?? [];
}

/**
 * Full repair order including its line_items — the source for an intake.
 * @param {number} transactionId
 */
export async function getRepairOrderDetail(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_ORDER_RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data?.Entity ?? null;
}

// Identity the intake must NOT inherit from the order — the server assigns
// its own, or the value becomes a back-reference instead.
const ORDER_OWNED_LINE_FIELDS = [
  'transaction_item_id', 'transaction_id',
  'document_no', 'document_date', 'document_status',
  'is_posted', 'posting_date', 'row_version',
];

/**
 * Projects a Repair Order line into the Repair In line the server expects.
 *
 * The line is passed through LARGELY INTACT — including nested
 * `item_components[]` — rather than rebuilt from a field whitelist. A first
 * attempt copied ~24 selected fields and `RepairIn/Create` returned a generic
 * 500: these are server-computed objects (a real intake line has 47 keys with
 * nested components), and trimming them is the same mistake that broke
 * Order/Return/Exchange before the Set*Items helpers were found. The order's
 * own object is the closest thing to ground truth we have, so it is what gets
 * sent, minus the identity the intake can't inherit.
 *
 * @param {object} orderLine — a line_items[] entry from getRepairOrderDetail()
 * @param {object} order     — the parent order entity
 */
export function mapOrderLineToRepairInLine(orderLine, order) {
  const line = { ...orderLine };
  for (const field of ORDER_OWNED_LINE_FIELDS) delete line[field];

  // Nested components carry the ORDER line's ids; drop them so the server
  // re-keys them against the intake it is creating.
  if (Array.isArray(orderLine.item_components)) {
    line.item_components = orderLine.item_components.map((c) => {
      const comp = { ...c };
      delete comp.transaction_item_id;
      delete comp.transaction_bom_id;
      return comp;
    });
  }

  // bag_no on the intake mirrors the order's new_bag_no when present.
  if (!line.bag_no && orderLine.new_bag_no) line.bag_no = orderLine.new_bag_no;

  return {
    ...line,
    document_id: APP_CONFIG.DOCUMENT_TYPES.REPAIR_IN,
    party_id:    order.party_id,
    company_id:  order.company_id,
    financial_year_id: order.financial_year_id,
    // ← what makes this an intake AGAINST that order
    ref_document_id:         REPAIR_ORDER_DOCUMENT_ID,
    ref_transaction_id:      order.transaction_id,
    ref_transaction_item_id: orderLine.transaction_item_id,
  };
}

/**
 * Convenience: order + its lines, already projected for a Repair In.
 * @param {number} transactionId
 */
export async function getRepairOrderAsIntakeLines(transactionId) {
  const order = await getRepairOrderDetail(transactionId);
  if (!order) return { order: null, lines: [] };
  const lines = (order.line_items ?? []).map((l) => mapOrderLineToRepairInLine(l, order));
  return { order, lines };
}

/** document_id of the POS Repair In (see APP_CONFIG.DOCUMENT_TYPES.REPAIR_IN). */
const REPAIR_IN_DOCUMENT_ID = 117;

/**
 * Builds the RepairIn Entity from an order + its already-projected lines.
 *
 * CONFIRMED live 2026-08-14: `document_id` is REQUIRED at the header level,
 * not just on each line item — omitting it returns a plain 400 "document_id
 * is required." (not the generic 500 everything else in this file produces),
 * so this is a real, confirmed contract fix, not a guess.
 *
 * Everything else here is deliberately minimal — createRepairIn's own JSDoc
 * says only party_id/company_id/document_date/line_items are required, and
 * that held up: a header of exactly these 5 fields (this one plus those 4)
 * passed validation cleanly. What's still unconfirmed is line_items itself —
 * see the header note on createRepairIn.
 *
 * @param {{ order: object, lines: object[], documentDate?: string }} params
 */
export function buildRepairInPayload({ order, lines, documentDate }) {
  return {
    document_id:       REPAIR_IN_DOCUMENT_ID,
    party_id:          order.party_id,
    company_id:        order.company_id,
    financial_year_id: order.financial_year_id,
    document_date:     documentDate ?? order.document_date,
    line_items:        lines,
  };
}

/**
 * Paginated list of repair intake records.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getRepairIns({ take = 50, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_IN_LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single repair intake.
 * @param {number} transactionId
 * @returns {Promise<object>} { Entity: RepairInRow }
 */
export async function getRepairInDetail(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_IN_RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a repair intake (customer drops item).
 * @param {object} repairInEntity — see buildRepairInPayload()
 *   Required: document_id, party_id, company_id, document_date, line_items[]
 *   (document_id confirmed required 2026-08-14 — see buildRepairInPayload)
 * @returns {Promise<object>} SaveResponse { EntityId }
 *
 * NOT FULLY WORKING YET — confirmed live 2026-08-14 against a real existing
 * order (HO-REP-08-26-1, transaction_id 130, for Tahir Kutty): a header-only
 * Create (empty line_items) succeeds cleanly (EntityId 41, then cancelled to
 * clean up). Adding the REAL projected line item — via
 * getRepairOrderAsIntakeLines(130), the exact function this file already
 * provides for this purpose — still returns a generic 500. So the intended
 * flow (previously never wired into the UI at all — see repair/page.jsx)
 * is now correctly wired, but the underlying Create is not yet proven to
 * accept a real line item. Needs the same live-capture treatment that
 * eventually fixed Order/Return: this is one step further than those got.
 * Also worth knowing: Inventory/Repair/Create (the workshop order this
 * whole chain starts from) currently 500s even on a bare 4-field payload —
 * confirmed the same day — so on this tenant right now, nothing downstream
 * of a NEW repair intake can be created end-to-end regardless of this fix.
 */
export async function createRepairIn(repairInEntity) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_IN_CREATE, {
    Entity: repairInEntity,
  });
  return response.data;
}

/**
 * Post (finalise) a repair intake.
 * @param {number} transactionId
 * @returns {Promise<object>} PostResponse
 */
export async function postRepairIn(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_IN_POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Cancel a repair intake.
 * @param {number} transactionId
 * @returns {Promise<object>} OrnaVerse response
 */
export async function cancelRepairIn(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_IN_CANCEL, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Paginated list of repair-out records.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getRepairOuts({ take = 50, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_OUT_LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Create a repair-out (send item to craftsman).
 * @param {object} repairOutEntity — RepairOutRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createRepairOut(repairOutEntity) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_OUT_CREATE, {
    Entity: repairOutEntity,
  });
  return response.data;
}

/**
 * Post (finalise) a repair-out.
 * @param {number} transactionId
 * @returns {Promise<object>} PostResponse
 */
export async function postRepairOut(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_OUT_POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Paginated list of repair invoices.
 * @param {{ take?: number, skip?: number, company_id?: number }} params
 * @returns {Promise<object>} { Entities[], TotalCount }
 */
export async function getRepairInvoices({ take = 50, skip = 0, company_id } = {}) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_INVOICE_LIST, {
    Take:       take,
    Skip:       skip,
    company_id: company_id ?? undefined,
  });
  return response.data;
}

/**
 * Full detail of a single repair invoice.
 * @param {number} transactionId
 * @returns {Promise<object>} { Entity: RepairInvoiceRow }
 */
export async function getRepairInvoiceDetail(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_INVOICE_RETRIEVE, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a repair invoice (item ready, bill the customer).
 * @param {object} repairInvoiceEntity — RepairInvoiceRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createRepairInvoice(repairInvoiceEntity) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_INVOICE_CREATE, {
    Entity: repairInvoiceEntity,
  });
  return response.data;
}

/**
 * Post (finalise) a repair invoice.
 * @param {number} transactionId
 * @returns {Promise<object>} PostResponse
 */
export async function postRepairInvoice(transactionId) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_INVOICE_POST, {
    EntityId: transactionId,
  });
  return response.data;
}

/**
 * Create a payment receipt against a repair invoice.
 * @param {object} receiptEntity — RepairInvoiceReceiptRow fields
 * @returns {Promise<object>} SaveResponse { EntityId }
 */
export async function createRepairInvoiceReceipt(receiptEntity) {
  const response = await axiosInstance.post(API.REPAIR.REPAIR_INVOICE_RECEIPT, {
    Entity: receiptEntity,
  });
  return response.data;
}

/**
 * Get customer's advance payments available for repair invoice.
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getRepairInvoiceAdvances({ party_id, company_id }) {
  const response = await axiosInstance.post(
    API.REPAIR.REPAIR_INVOICE_HELPERS_GET_ADVANCES,
    { party_id, company_id }
  );
  return response.data;
}

/**
 * Get customer's scheme balance available for repair invoice.
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getRepairInvoiceScheme({ party_id, company_id }) {
  const response = await axiosInstance.post(
    API.REPAIR.REPAIR_INVOICE_HELPERS_GET_SCHEME,
    { party_id, company_id }
  );
  return response.data;
}

/**
 * Get customer's credit note balance available for repair invoice.
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getRepairInvoiceCreditNote({ party_id, company_id }) {
  const response = await axiosInstance.post(
    API.REPAIR.REPAIR_INVOICE_HELPERS_GET_CREDIT,
    { party_id, company_id }
  );
  return response.data;
}

/**
 * Get customer's exchange value available for repair invoice.
 * @param {{ party_id: number, company_id: number }} params
 */
export async function getRepairInvoiceExchange({ party_id, company_id }) {
  const response = await axiosInstance.post(
    API.REPAIR.REPAIR_INVOICE_HELPERS_GET_EXCHANGE,
    { party_id, company_id }
  );
  return response.data;
}