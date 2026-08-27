'use client';

// Standalone cart page. Reuses the same components as CartDrawer
// (CartItemRow, CartEmptyState, CartSummary, CartCustomerTag,
// AppliedPromoTag, ProceedToCheckoutButton) in a full-page layout.
//
// Needed as a real navigation target: the checkout page redirects here
// (router.replace('/cart')) when the cart is empty.
//
// Back button now lives in the global Header (see useSmartBack /
// BACK_FALLBACKS: /cart → /catalog) — no local back button here anymore.

import { useMemo } from 'react';
import CartItemRow from '@/components/features/cart/CartItemRow';
import CartEmptyState from '@/components/features/cart/CartEmptyState';
import CartSummary from '@/components/features/cart/CartSummary';
import CartCustomerTag from '@/components/features/cart/CartCustomerTag';
import DiscountSection from '@/components/features/checkout/DiscountSection';
import ProceedToCheckoutButton from '@/components/features/cart/ProceedToCheckoutButton';
import { useCart } from '@/hooks/cart/useCart';
import { useCheckoutPricing } from '@/hooks/checkout/useCheckoutPricing';
import { mapPricedLinesToCart } from '@/services/checkoutPricingService';
import { useRedirectOnCustomerChange } from '@/hooks/checkout/useRedirectOnCustomerChange';

export default function CartPage() {
  useRedirectOnCustomerChange();

  const {
    items,
    customerName,
    customerMobile,
    isEmpty,
    removeItem,
    updateQuantity,
    detachCustomer,
  } = useCart();

  // Same query DiscountSection itself fetches (keyed on cart contents +
  // applied promo codes) — applying a code here shows up on checkout with
  // zero extra requests, and this page gets the real per-line discount
  // breakdown for free instead of the cart's own always-₹0 estimate (see
  // cartSlice's recalculateTotals for why that stays 0 client-side).
  const { lineItems: pricedLineItems, totals: pricedTotals, isLoading: isPricing } = useCheckoutPricing();
  const pricedByCartIndex = useMemo(
    () => mapPricedLinesToCart(items, pricedLineItems),
    [items, pricedLineItems]
  );

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-28 p-4 md:p-6">

      {isEmpty ? (
        <CartEmptyState />
      ) : (
        <>
          {/* FIXED: imported (and customerName/customerMobile/detachCustomer
              already destructured above) but never actually rendered — this
              standalone page showed no indication of which customer was
              attached, and no way to detach them, unlike CartDrawer, which
              renders this same component. Restoring it to match, per this
              file's own header comment on what it's supposed to reuse. */}
          <CartCustomerTag
            customerName={customerName}
            customerMobile={customerMobile}
            onDetach={detachCustomer}
          />
          <DiscountSection />

          <div className="rounded-xl border border-border bg-card px-4">
            {items.map((item, index) => (
              <CartItemRow
                key={`${item.itemId}-${item.sizeId}-${item.styleId}`}
                item={item}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
                // Per-line discount bifurcation (2026-08-26) — see
                // CartItemRow's own comment on the discount field. Same
                // pricedByCartIndex checkout builds; empty until a promo
                // actually gives something, so this is a no-op line-total
                // change for a cart with no discount applied.
                priced={pricedByCartIndex.get(index) ?? null}
                // Full price breakup requested on the cart page specifically
                // (2026-08-26) — see CartItemRow's own JSDoc for why the
                // mini cart drawer deliberately doesn't get this too.
                showPriceBreakdown
              />
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <CartSummary totals={pricedTotals} isPricing={isPricing} />
          </div>

          <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
            <div className="max-w-5xl mx-auto w-full">
              <ProceedToCheckoutButton />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
