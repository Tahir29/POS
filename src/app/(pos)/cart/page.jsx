'use client';

// src/app/(pos)/cart/page.jsx
// Standalone cart page. Reuses the same Phase 8 components as
// CartDrawer (CartItemRow, CartEmptyState, CartSummary, CartCustomerTag,
// AppliedPromoTag, ProceedToCheckoutButton) in a full-page layout.
//
// Needed as a real navigation target: the checkout page redirects here
// (router.replace('/cart')) when the cart is empty, and this route was
// previously an empty placeholder file, causing a runtime error
// ("default export is not a React Component").

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CartItemRow from '@/components/features/cart/CartItemRow';
import CartEmptyState from '@/components/features/cart/CartEmptyState';
import CartSummary from '@/components/features/cart/CartSummary';
import CartCustomerTag from '@/components/features/cart/CartCustomerTag';
import AppliedPromoTag from '@/components/features/cart/AppliedPromoTag';
import ProceedToCheckoutButton from '@/components/features/cart/ProceedToCheckoutButton';
import { useCart } from '@/hooks/cart/useCart';
import { useRedirectOnCustomerChange } from '@/hooks/checkout/useRedirectOnCustomerChange';

export default function CartPage() {
  const router = useRouter();
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
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-28">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => router.push('/catalog')}
          aria-label="Back to catalog"
          className="min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Button>
        <h1 className="text-lg font-bold text-stone-800">Cart</h1>
      </div>

      {isEmpty ? (
        <CartEmptyState />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <CartCustomerTag
              customerName={customerName}
              customerMobile={customerMobile}
              onDetach={detachCustomer}
            />
            <AppliedPromoTag
              promoCode={appliedPromoCode}
              onRemove={removePromo}
            />
          </div>

          <div className="flex flex-col">
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