'use client';

// Slide-in cart panel, opened from the header cart badge.
// Uses the shared BottomSheet primitive (bottom sheet on mobile,
// right side sheet on tablet).

import { useMemo } from 'react';
import BottomSheet from '@/components/shared/BottomSheet';
import CartItemRow from '@/components/features/cart/CartItemRow';
import CartEmptyState from '@/components/features/cart/CartEmptyState';
import CartSummary from '@/components/features/cart/CartSummary';
import CartCustomerTag from '@/components/features/cart/CartCustomerTag';
import DiscountSection from '@/components/features/checkout/DiscountSection';
import ProceedToCheckoutButton from '@/components/features/cart/ProceedToCheckoutButton';
import { useCart } from '@/hooks/cart/useCart';
import { useCheckoutPricing } from '@/hooks/checkout/useCheckoutPricing';
import { mapPricedLinesToCart } from '@/services/checkoutPricingService';

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 * }} props
 */
export default function CartDrawer({ isOpen, onClose }) {
  const {
    items,
    customerName,
    customerMobile,
    isEmpty,
    removeItem,
    updateQuantity,
    detachCustomer,
  } = useCart();

  // Same query DiscountSection/the cart page/checkout all share, keyed on
  // cart contents + applied promo codes — applying a code anywhere shows up
  // everywhere with zero extra requests. See cart/page.jsx's own comment.
  const { lineItems: pricedLineItems, totals: pricedTotals, isLoading: isPricing } = useCheckoutPricing();
  const pricedByCartIndex = useMemo(
    () => mapPricedLinesToCart(items, pricedLineItems),
    [items, pricedLineItems]
  );

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Cart"
      footer={
        !isEmpty && (
          <div className="flex flex-col gap-3">
            <CartSummary totals={pricedTotals} isPricing={isPricing} />
            <ProceedToCheckoutButton onNavigate={onClose} />
          </div>
        )
      }
    >
      {isEmpty ? (
        <CartEmptyState onNavigate={onClose} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <CartCustomerTag
              customerName={customerName}
              customerMobile={customerMobile}
              onDetach={detachCustomer}
            />
            <DiscountSection />
          </div>

          <div className="flex flex-col">
            {items.map((item, index) => (
              <CartItemRow
                key={`${item.itemId}-${item.sizeId}-${item.styleId}`}
                item={item}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
                priced={pricedByCartIndex.get(index) ?? null}
              />
            ))}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}