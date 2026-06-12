'use client';

// src/components/features/cart/CartDrawer/index.jsx
// Slide-in cart panel, opened from the header cart badge.
// Uses the shared BottomSheet primitive (bottom sheet on mobile,
// right side sheet on tablet).

import BottomSheet from '@/components/shared/BottomSheet';
import CartItemRow from '@/components/features/cart/CartItemRow';
import CartEmptyState from '@/components/features/cart/CartEmptyState';
import CartSummary from '@/components/features/cart/CartSummary';
import CartCustomerTag from '@/components/features/cart/CartCustomerTag';
import AppliedPromoTag from '@/components/features/cart/AppliedPromoTag';
import ProceedToCheckoutButton from '@/components/features/cart/ProceedToCheckoutButton';
import { useCart } from '@/hooks/cart/useCart';

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
    appliedPromoCode,
    isEmpty,
    removeItem,
    updateQuantity,
    detachCustomer,
    removePromo,
  } = useCart();

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Cart"
      footer={
        !isEmpty && (
          <div className="flex flex-col gap-3">
            <CartSummary />
            <ProceedToCheckoutButton onNavigate={onClose} />
          </div>
        )
      }
    >
      {isEmpty ? (
        <CartEmptyState onNavigate={onClose} />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Tags */}
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

          {/* Items */}
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
        </div>
      )}
    </BottomSheet>
  );
}