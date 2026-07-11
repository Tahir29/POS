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

import CartItemRow from '@/components/features/cart/CartItemRow';
import CartEmptyState from '@/components/features/cart/CartEmptyState';
import CartSummary from '@/components/features/cart/CartSummary';
import CartCustomerTag from '@/components/features/cart/CartCustomerTag';
import AppliedPromoTag from '@/components/features/cart/AppliedPromoTag';
import ProceedToCheckoutButton from '@/components/features/cart/ProceedToCheckoutButton';
import { useCart } from '@/hooks/cart/useCart';
import { useRedirectOnCustomerChange } from '@/hooks/checkout/useRedirectOnCustomerChange';

export default function CartPage() {
  useRedirectOnCustomerChange();

  const {
    items,
    customerName,
    customerMobile,
    appliedPromoCode,
    isEmpty,
    removeItem,
    updateQuantity,
    detachCustomer,
    removePromo,
  } = useCart();

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
            <AppliedPromoTag
              promoCode={appliedPromoCode}
              onRemove={removePromo}
            />
          </div>

          <div className="rounded-xl border border-stone-200 bg-white px-4">
            {items.map((item) => (
              <CartItemRow
                key={`${item.itemId}-${item.sizeId}-${item.styleId}`}
                item={item}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            ))}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <CartSummary />
          </div>

          {/* Sticky footer */}
          <div className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-white p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
            <div className="max-w-5xl mx-auto w-full">
              <ProceedToCheckoutButton />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
