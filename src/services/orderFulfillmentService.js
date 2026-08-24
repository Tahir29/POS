// "Fulfill from order" — an Order (53) raised earlier, converted into an
// Invoice (54) once the piece is ready to bill.
//
// CONFIRMED 2026-08-19 by driving OrnaVerse's own "Fulfill from order"
// dialog live on UAT and capturing the network calls — see the header
// comment on API.ORDER_FULFILLMENT (apiEndpoints.js) for the full contract,
// what "Ready To Invoice" actually depends on (a separate ERP-side
// warehouse pipeline, not anything the counter POS can trigger), and what
// remains unverified (the actual Invoice/Create payload for a genuine
// fulfillment case — every live candidate found on UAT hit the same
// inconsistency their own system has between the two list endpoints).

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';
import APP_CONFIG from '@/constants/appConfig';

/**
 * Order lines that have passed OrnaVerse's own live stock-allocation check
 * and are ready to be loaded into an Invoice. Powers "Fulfill from order"'s
 * default ("Ready to invoice") tab.
 *
 * Confirmed empty response shape: `{ Entities: [], TotalCount: 0 }` — an
 * empty list here is the NORMAL case (most open orders aren't ready yet),
 * not an error.
 *
 * @param {{ partyId: number }} params
 * @returns {Promise<object[]>}
 */
export async function getReadyToInvoiceLines({ partyId }) {
  if (!partyId) return [];
  const response = await axiosInstance.post(API.ORDER_FULFILLMENT.READY_TO_INVOICE, {
    party_id:               partyId,
    validate_against_stock: true,
    document_id:            APP_CONFIG.DOCUMENT_TYPES.POS_INVOICE,
    document_status:        1,
  });
  return response.data?.Entities ?? [];
}

/**
 * Every open order line for this party, regardless of readiness — each row
 * carries `status_id`/`reason_status_description` ("New", "Ready To
 * Invoice", ...). Powers "Fulfill from order"'s "All open" tab, so staff can
 * see WHY nothing is ready yet rather than just an empty screen.
 *
 * @param {{ partyId: number }} params
 * @returns {Promise<object[]>}
 */
export async function getAllOpenOrderLines({ partyId }) {
  if (!partyId) return [];
  const response = await axiosInstance.post(API.ORDER_FULFILLMENT.ALL_OPEN, {
    document_id: APP_CONFIG.DOCUMENT_TYPES.POS_ORDER,
    party_ids:   [partyId],
    Take:        500,
  });
  return response.data?.Entities ?? [];
}

/**
 * Maps a fulfillment line (from either endpoint above) into the shape
 * cartSlice's CartItem expects.
 *
 * Field names are CONFIRMED for ALL_OPEN (Inventory/OrderItemFulfilment/List)
 * — a real row was captured live: { item_id, item_code, item_name, pieces,
 * net_amount, image, document_no, transaction_id, ... }. READY_TO_INVOICE
 * (POS/OrderItems/List) never returned a non-empty response in testing (see
 * the header comment on API.ORDER_FULFILLMENT for why), so its exact row
 * shape is UNCONFIRMED — assumed to match ALL_OPEN's since both describe the
 * same underlying order line, with fallback field names tried defensively
 * rather than assumed outright.
 *
 * unitPrice here is a display estimate only (net_amount / pieces) —
 * buildPricedLineItems re-prices against today's rates and re-claims a
 * physical stock piece at submission, same as any other cart item.
 *
 * @param {object} line — a row from getReadyToInvoiceLines/getAllOpenOrderLines
 * @returns {object} CartItem
 */
export function mapFulfillmentLineToCartItem(line) {
  const pieces = line.pieces ?? line.quantity ?? 1;
  const netAmount = line.net_amount ?? line.sub_total ?? 0;
  return {
    itemId:     line.item_id,
    itemCode:   line.item_code ?? line.code ?? null,
    itemName:   line.item_name ?? line.item_code ?? 'Item',
    sku:        line.sku ?? null,
    quantity:   pieces,
    unitPrice:  pieces > 0 ? +(netAmount / pieces).toFixed(2) : 0,
    styleId:    line.style_id ?? null,
    sizeId:     line.item_size_id ?? null,
    sizeName:   line.size_name ?? null,
    attributes: {},
    image:      line.image ?? null,
  };
}
