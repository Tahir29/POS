'use client';

// src/app/(pos)/cart/page.jsx
// Standalone cart page. Reuses the same components as CartDrawer
// (CartItemRow, CartEmptyState, CartSummary, CartCustomerTag,
// AppliedPromoTag, ProceedToCheckoutButton) in a full-page layout.
//
// Needed as a real navigation target: the checkout page redirects here
// (router.replace('/cart')) when the cart is empty.
//
// Back button now lives in the global Header (see useSmartBack /
// BACK_FALLBACKS: /cart → /catalog) — no local back button here anymore.

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import CartItemRow from '@/components/features/cart/CartItemRow';
import CartEmptyState from '@/components/features/cart/CartEmptyState';
import CartSummary from '@/components/features/cart/CartSummary';
import CartCustomerTag from '@/components/features/cart/CartCustomerTag';
import AppliedPromoTag from '@/components/shared/AppliedPromoTag';
import ProceedToCheckoutButton from '@/components/features/cart/ProceedToCheckoutButton';
import { useCart } from '@/hooks/cart/useCart';
import { useRedirectOnCustomerChange } from '@/hooks/checkout/useRedirectOnCustomerChange';
import { EASE_PREMIUM, DURATION } from '@/lib/motion';

export default function CartPage() {
  useRedirectOnCustomerChange();

  const {
    items,
    customerName,
    customerMobile,
    appliedPromos,
    isEmpty,
    removeItem,
    updateQuantity,
    detachCustomer,
    removePromo,
  } = useCart();
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-28 p-4 md:p-6">

      {isEmpty ? (
        <CartEmptyState />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {/* <CartCustomerTag
              customerName={customerName}
              customerMobile={customerMobile}
              onDetach={detachCustomer}
            /> */}
            {appliedPromos.map((promo) => (
              <AppliedPromoTag
                key={promo.promoCode}
                promoCode={promo.promoCode}
                discountAmount={promo.discountAmount}
                onRemove={() => removePromo(promo.promoCode)}
              />
            ))}
          </div>

          {/* Same enter/exit + reorder treatment as CartDrawer (Step C
              Priority 3) — kept identical between the two so the item list
              feels the same whether reached via the drawer or this page. */}
          <div className="rounded-xl border border-border bg-card px-4">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.div
                  key={`${item.itemId}-${item.sizeId}-${item.styleId}`}
                  layout={!reduceMotion}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                  transition={{ duration: reduceMotion ? 0 : DURATION.standard, ease: EASE_PREMIUM }}
                >
                  <CartItemRow
                    item={item}
                    onUpdateQuantity={updateQuantity}
                    onRemove={removeItem}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <CartSummary />
          </div>

          {/* Sticky footer */}
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
