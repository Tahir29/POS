// The two lookups a POS Return needs before it can be created.
//
// WHY THIS EXISTS — root cause of the long-running Return/Create 500s
// (resolved 2026-07-30 by capturing OrnaVerse's own UAT Returns journey):
// a return line item CANNOT be hand-built from typed item_id/rate/qty. The
// server expects the ~186-field computed object produced by
// Helpers/SetReturnItems, whose own input is the full nested sold-item
// record from POS/InvoiceItems/List (get_child:true). Every attempt to
// synthesise that shape — from an Order line, from an Invoice line, by
// adding the individually-missing fields — returned an opaque 500.
//
// Mirrors the sales side conceptually: SetSalesItems : new sale ::
// SetReturnItems : return.

import axiosInstance from '@/lib/axios/axiosInstance';
import API from '@/constants/apiEndpoints';

/**
 * Items this customer has actually purchased, i.e. what they're allowed to
 * return. Each row is the FULL nested item (get_child:true) and carries
 * ref_transaction_id / ref_document_id pointing back at the original
 * invoice — that linkage is what ties the return to the sale, so never
 * strip it before handing the row to calculateReturnItems().
 *
 * @param {{ partyId: number, take?: number }} params
 * @returns {Promise<object[]>} sold-item rows
 */
export async function getSoldItems({ partyId, take = 25 }) {
  if (!partyId) return [];
  const response = await axiosInstance.post(API.RETURNS.SOLD_ITEMS, {
    Take:             take,
    party_id:         partyId,
    transaction_type: 1,      // 1 = sold items
    get_child:        true,   // essential — brings item_components[] etc.
    IncludeColumns: [
      'item_code', 'item_line_no', 'pieces', 'weight',
      'net_weight', 'sku', 'document_no',
    ],
  });
  return response.data?.Entities ?? [];
}

/**
 * Prices selected sold items for RETURN. Pass the sold-item rows through
 * UNMODIFIED (same contract as calculateItemRates/SetSalesItems — the
 * server needs the whole shape to recompute against).
 *
 * is_tax_applicable:false and calculate_rates:false mirror what OrnaVerse's
 * own Returns screen sends: a return reverses the ORIGINAL sale's figures
 * rather than re-pricing at today's metal rate, which is why rates aren't
 * recalculated here (unlike the sales-side SetSalesItems call).
 *
 * @param {{ items: object[], documentDate?: Date }} params
 * @returns {Promise<object[]>} line items ready for Return/Create
 */
export async function calculateReturnItems({ items, documentDate = new Date() }) {
  if (!items?.length) return [];
  const response = await axiosInstance.post(API.HELPERS.SET_RETURN_ITEMS, {
    selected_products: items,
    exchange_rate:     1,
    // their UI sends a bare JS Date string here, not ISO
    document_date:     documentDate.toDateString(),
    is_tax_applicable: false,
    calculate_rates:   false,
  });
  return response.data?.Entities ?? [];
}

/**
 * Same, for BUY BACK. Separate endpoint rather than a flag — a buyback is
 * the store re-purchasing the piece (valued as goods) rather than reversing
 * a sale, so the server prices it differently.
 *
 * Its request notably omits `calculate_rates` entirely; sending the return
 * variant's body shape here is not equivalent.
 *
 * @param {{ items: object[], documentDate?: Date }} params
 * @returns {Promise<object[]>} line items ready for BuyBack/Create
 */
export async function calculateBuybackItems({ items, documentDate = new Date() }) {
  if (!items?.length) return [];
  const response = await axiosInstance.post(API.HELPERS.SET_BUYBACK_ITEMS, {
    selected_products: items,
    document_date:     documentDate.toDateString(),
    exchange_rate:     1,
    is_tax_applicable: false,
  });
  return response.data?.Entities ?? [];
}

/**
 * Same, for EXCHANGE.
 *
 * IMPORTANT — an Exchange document is ONE-SIDED, exactly like a Return.
 * Confirmed live 2026-07-30: it carries a single `line_items` array (the
 * item coming back) and NO replacement item. Completing it simply raises
 * the customer's credit; they then buy the replacement as a normal sale
 * that spends that credit. So "exchange" here does not mean "swap in one
 * document" — don't model a second line-item set for it.
 *
 * @param {{ items: object[], documentDate?: Date }} params
 * @returns {Promise<object[]>} line items ready for Exchange/Create
 */
export async function calculateExchangeItems({ items, documentDate = new Date() }) {
  if (!items?.length) return [];
  const response = await axiosInstance.post(API.HELPERS.SET_EXCHANGE_ITEMS, {
    selected_products: items,
    document_date:     documentDate.toDateString(),
    exchange_rate:     1,
    is_tax_applicable: false,
  });
  return response.data?.Entities ?? [];
}
