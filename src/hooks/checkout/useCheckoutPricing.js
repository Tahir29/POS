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
//
// DISCOUNT — recomputed HERE against the REAL subtotal, not trusted from the
// cart. Two separate bugs, both now fixed:
//
//   1. `totals`/`amountDue` used to be the raw, pre-discount server total:
//      applying/removing a promo code changed cartSlice's own discountAmount
//      but never touched this hook's output, so the Total shown, the Place
//      Order button, and the amount the operator was told to collect never
//      moved when a promo was applied or removed. Meanwhile
//      buildInvoiceEntity/buildOrderEntity DID subtract a discount when
//      assembling the actual net_amount sent to OrnaVerse — so the invoice
//      was quietly raised for less than what was collected (a phantom
//      overpayment / negative balance_amount).
//
//   2. Even once wired up, subtracting cartSlice's discountAmount would still
//      be WRONG for a percentage promo: that figure is "X% of the CATALOG
//      subtotal" (cartSlice's own estimate, computed for cart-page display),
//      not "X% of what's actually being billed". The two subtotals can differ
//      by 2-3x (see the header comment above — stale catalog item_rate vs the
//      real stock-piece price), so a "20% off" promo priced against the wrong
//      base is not actually 20% off the invoice. A promo's discount is only
//      correct when computed against the SAME subtotal it is being subtracted
//      from — so it's recomputed here, per promo, against rawTotals.subTotal
//      (the real, server-priced subtotal), using the exact same
//      computePromotionDiscount used everywhere else a promo amount is shown.
//
// Rounded the same way buildInvoiceEntity/buildOrderEntity round net_amount,
// so this hook's amountDue is the one figure that is displayed, validated
// (checkoutSchema), collected (CheckoutPaymentSection), and invoiced
// (useCreateInvoice/useCreateOrder) — they can no longer disagree.

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { buildPricedLineItems, summarizeLineItems } from '@/services/checkoutPricingService';
import { computePromotionDiscount } from '@/lib/normalizers/promotion';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { useCart } from '@/hooks/cart/useCart';

/**
 * @param {number} documentId — document type being raised (54 invoice / 53 order)
 * @returns {{
 *   lineItems: object[]|null,   // ready for Create, minus sales_person_id
 *   totals:    object|null,     // authoritative header figures, netAmount post-discount
 *   amountDue: number|null,     // what the customer must actually pay, post-discount
 *   isLoading: boolean,
 *   error:     Error|null,
 * }}
 */
export function useCheckoutPricing(documentId) {
  const { items, appliedPromos } = useCart();
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
  const rawTotals = lineItems ? summarizeLineItems(lineItems) : null;

  const discount = rawTotals
    ? +appliedPromos
        .reduce((sum, p) => sum + computePromotionDiscount(p.promoDetails, rawTotals.subTotal), 0)
        .toFixed(2)
    : 0;

  // Mirrors buildInvoiceEntity/buildOrderEntity's own discountedNet/roundedNet
  // math exactly, so the figure quoted here is the figure submitted there.
  const discountedNet = rawTotals
    ? +Math.max(0, rawTotals.netAmount - discount).toFixed(2)
    : null;
  const amountDue = discountedNet != null ? Math.round(discountedNet) : null;
  const totals = rawTotals
    ? { ...rawTotals, netAmount: discountedNet, discount }
    : null;

  return {
    lineItems,
    totals,
    amountDue,
    isLoading: query.isLoading,
    error:     query.error ?? null,
  };
}
