// src/hooks/checkout/useCheckoutPricing.js
// Prices the ACTUAL STOCK PIECES in the cart, once, at checkout.
//
// WHY THIS EXISTS — the cart's price is not the sale price.
//
// The catalog fills a product's price from the item master's stored
// `item_rate` (catalogService.attachStaticPrice), and only re-prices live
// when that stored rate is 0 AND the item has a BOM
// (getLivePricesForItems). An item with a stale non-zero rate is therefore
// never re-priced, and the stored figure can be badly wrong: ADJLR00826
// shows ₹48,704.82 in the catalog while Helpers/SetSalesItems prices the
// very same piece at ₹107,840.02 — the stored rate omits the ₹60,888 of
// diamond in it. Verified live on UAT 2026-08-05; both the catalog-style
// and checkout-style pricing calls return 107,840.02, so this is a stale
// master value, not a difference between the two calls.
//
// Left unaddressed, the counter collects the catalog figure against an
// invoice raised at the real figure. That is not a cosmetic mismatch:
//   • Undercharging by ₹57,674 leaves a balance the customer never paid,
//     and OrnaVerse rejects the sale outright — "No credit facility is
//     allowed for 0010900616|Tahir Kutty" (live 400, 2026-08-05).
//   • It silently understates the till by the value of the stones.
//
// So checkout prices the real pieces BEFORE showing the payment section,
// and everything downstream — the amount displayed, the amount collected,
// and the line items actually submitted — comes from this one result.
// Pricing once also avoids a second SetSalesItems round trip at submit,
// which is the slow call in this flow (6-7s for a page of BOM items).

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { buildPricedLineItems, summarizeLineItems } from '@/services/checkoutPricingService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { useCart } from '@/hooks/cart/useCart';

/**
 * @param {number} documentId — document type being raised (54 invoice / 53 order)
 * @returns {{
 *   lineItems: object[]|null,   // ready for Create, minus sales_person_id
 *   totals:    object|null,     // authoritative header figures
 *   amountDue: number|null,     // what the customer must actually pay
 *   isLoading: boolean,
 *   error:     Error|null,
 * }}
 */
export function useCheckoutPricing(documentId) {
  const { items } = useCart();
  const activeStoreId = useSelector(selectActiveStoreId);

  // Keyed on the exact cart contents so editing the basket re-prices, but
  // simply revisiting checkout does not pay for the call again.
  const cartKey = items.map((i) => `${i.itemId}x${i.quantity}`).join('|');

  const query = useQuery({
    queryKey: ['checkout-pricing', activeStoreId, documentId, cartKey],
    enabled:  items.length > 0 && !!activeStoreId,
    // Rates move intraday, but not within the seconds a checkout takes;
    // re-fetching mid-payment would change the amount under the operator.
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: () => buildPricedLineItems({ items, activeStoreId, documentId }),
  });

  const lineItems = query.data ?? null;
  const totals = lineItems ? summarizeLineItems(lineItems) : null;

  return {
    lineItems,
    totals,
    // Rounded the same way the Create payload rounds net_amount, so the
    // collected amount can settle the invoice to exactly zero.
    amountDue: totals ? Math.round(totals.netAmount) : null,
    isLoading: query.isLoading,
    error:     query.error ?? null,
  };
}
