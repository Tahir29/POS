// src/hooks/checkout/useCheckoutPricing.js
// Prices the ACTUAL STOCK PIECES in the cart, once, at checkout — the
// catalog's displayed price is not the sale price (it comes from a possibly
// stale item-master rate, only re-priced live when zero AND the item has a
// BOM), so checkout re-prices before showing the payment section and every
// downstream figure (displayed amount, collected amount, submitted line
// items) is derived from this one result. Pricing once also avoids a second
// slow SetSalesItems round trip at submit.
//
// Promotions are priced here too, by the server: a promotion's percentage
// applies to a component of the item (diamond/making-charges/whole-value,
// selected by `discount_calc_on`), not the subtotal, and the server re-taxes
// after discounting. So Helper/ApplyPromotions runs inside this same query
// and its output lines ARE the line items — everything downstream (summary,
// Place Order, Create payload) is a sum of what those lines carry; nothing
// is recomputed locally.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import {
  buildPricedLineItems,
  applyPromotionsToLines,
  summarizeLineItems,
} from '@/services/checkoutPricingService';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { useCart } from '@/hooks/cart/useCart';
import APP_CONFIG from '@/constants/appConfig';

/**
 * Prices the basket once. Takes no document type — it works out whether the
 * shelf can supply the basket and prices accordingly, and the document that
 * gets raised follows from what the customer pays. See buildPricedLineItems.
 *
 * @returns {{
 *   lineItems: object[]|null,   // post-promotion, ready for Create
 *   totals:    object|null,     // header figures, summed from those lines
 *   promotionDetails: object[], // the document's promotion_details[]
 *   isStockBacked: boolean,     // true = can be invoiced; false = order only
 *   documentId: number|null,    // what this basket was priced as
 *   discount:  number,          // server-computed promotion value
 *   promoCodes:string[],
 *   amountDue: number|null,     // what the customer must actually pay
 *   isLoading: boolean,
 *   error:     Error|null,
 * }}
 */
export function useCheckoutPricing() {
  const { items, appliedPromos } = useCart();
  const activeStoreId = useSelector(selectActiveStoreId);

  // Keyed on the exact cart contents AND the promotions applied, so changing
  // either re-prices, but simply revisiting checkout does not pay for the
  // calls again.
  const cartKey  = items.map((i) => `${i.itemId}x${i.quantity}`).join('|');
  const promoKey = appliedPromos.map((p) => p.promoCode).join('|');

  const query = useQuery({
    queryKey: ['checkout-pricing', activeStoreId, cartKey, promoKey],
    enabled:  items.length > 0 && !!activeStoreId,
    // Rates move intraday, but not within the seconds a checkout takes;
    // re-fetching mid-payment would change the amount under the operator.
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { lineItems, isStockBacked } = await buildPricedLineItems({ items, activeStoreId });
      const documentId = isStockBacked
        ? APP_CONFIG.DOCUMENT_TYPES.POS_INVOICE
        : APP_CONFIG.DOCUMENT_TYPES.POS_ORDER;
      const promoted = await applyPromotionsToLines({
        lineItems, appliedPromos, documentId,
      });
      return { ...promoted, isStockBacked, documentId };
    },
  });

  const lineItems        = query.data?.lineItems ?? null;
  const promotionDetails = query.data?.promotionDetails ?? [];
  const totals = lineItems ? summarizeLineItems(lineItems) : null;

  return {
    lineItems,
    totals,
    promotionDetails,
    isStockBacked: query.data?.isStockBacked ?? false,
    documentId:    query.data?.documentId ?? null,
    // Already net of the promotion — the lines came back discounted and
    // re-taxed, so there is nothing further to subtract here.
    discount:   totals?.discount ?? 0,
    promoCodes: appliedPromos.map((p) => p.promoCode),
    // Rounded the same way the Create payload rounds net_amount, so the
    // collected amount can settle the invoice to exactly zero.
    amountDue: totals ? Math.round(totals.netAmount) : null,
    isLoading: query.isLoading,
    error:     query.error ?? null,
  };
}
