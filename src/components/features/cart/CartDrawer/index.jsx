'use client';

// src/components/features/cart/CartDrawer/index.jsx
// Slide-in cart panel, opened from the header cart badge.
// Uses the shared BottomSheet primitive (bottom sheet on mobile,
// right side sheet on tablet).

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import BottomSheet from '@/components/shared/BottomSheet';
import CartItemRow from '@/components/features/cart/CartItemRow';
import CartEmptyState from '@/components/features/cart/CartEmptyState';
import CartSummary from '@/components/features/cart/CartSummary';
import CartCustomerTag from '@/components/features/cart/CartCustomerTag';
import AppliedPromoTag from '@/components/shared/AppliedPromoTag';
import ProceedToCheckoutButton from '@/components/features/cart/ProceedToCheckoutButton';
import { useCart } from '@/hooks/cart/useCart';
import { EASE_PREMIUM, DURATION } from '@/lib/motion';

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
    appliedPromos,
    isEmpty,
    removeItem,
    updateQuantity,
    detachCustomer,
    removePromo,
  } = useCart();
  const reduceMotion = useReducedMotion();

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
            {appliedPromos.map((promo) => (
              <AppliedPromoTag
                key={promo.promoCode}
                promoCode={promo.promoCode}
                discountAmount={promo.discountAmount}
                onRemove={() => removePromo(promo.promoCode)}
              />
            ))}
          </div>

          {/* Items — enter/exit + reorder motion (Step C Priority 3). Each
              row's own key already exists (itemId+sizeId+styleId); wrapping
              it in a layout-animated motion.div is what actually gives add/
              remove a transition instead of an instant reflow. Reduced-
              motion collapses every transition to 0 rather than skipping
              the wrapper entirely, so layout reflow still happens correctly. */}
          <div className="flex flex-col">
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
        </div>
      )}
    </BottomSheet>
  );
}