'use client';

// src/app/(pos)/checkout/page.jsx
// Checkout screen — Phase 9b.
// Assembles: CheckoutCustomerSummary, CheckoutDiscountSection,
// CheckoutPaymentSection, CheckoutOrderSummary (reuses CartSummary),
// PlaceOrderButton, OrderConfirmationScreen.
//
// Validation: checkoutSchema (customer attached, payments selected and
// balanced to cart total).
//
// Navigation-away guard: warns via the browser's native beforeunload
// dialog if the cart has items and no order has been placed yet
// (covers tab close / refresh). In-app route-change interception is not
// covered — App Router has no built-in navigation-blocker hook, and
// adding one is out of scope for this chunk.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import CheckoutCustomerSummary from '@/components/features/checkout/CheckoutCustomerSummary';
import CheckoutDiscountSection from '@/components/features/checkout/CheckoutDiscountSection';
import CheckoutPaymentSection from '@/components/features/checkout/CheckoutPaymentSection';
import CartSummary from '@/components/features/cart/CartSummary';
import PlaceOrderButton from '@/components/features/checkout/PlaceOrderButton';
import OrderConfirmationScreen from '@/components/features/checkout/OrderConfirmationScreen';
import { useCart } from '@/hooks/cart/useCart';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useRedirectOnCustomerChange } from '@/hooks/checkout/useRedirectOnCustomerChange';
import { useCreateOrder } from '@/hooks/checkout/useCreateOrder';
import { checkoutSchema } from '@/validators/checkoutSchema';

function CheckoutScreen() {
  const router = useRouter();
  const { items, isEmpty } = useCart();
  const { total } = useCartTotals();
  const { customerId } = useCustomerSession();
  const { placeOrder, isPlacingOrder, orderResult } = useCreateOrder();

  const [payments, setPayments] = useState([]);
  const [isBackConfirmOpen, setIsBackConfirmOpen] = useState(false);

  const itemCountAtLoad = useMemo(() => items.length, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Order placed successfully -> show confirmation screen instead of form
  const isConfirmed = !!orderResult;
  useRedirectOnCustomerChange(!isConfirmed);

  // Redirect away if the cart is empty and no order has just been placed
  // (e.g. associate navigated here directly with nothing in cart)
  useEffect(() => {
    if (isEmpty && !isConfirmed) {
      router.replace('/cart');
    }
  }, [isEmpty, isConfirmed, router]);

  // Warn on tab close / refresh if there's an unsaved cart and no order placed
  useEffect(() => {
    if (isConfirmed) return;

    const handleBeforeUnload = (e) => {
      if (items.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [items.length, isConfirmed]);

  const validation = checkoutSchema.safeParse({
    customerId,
    paymentModes: payments,
    totalAmount: total,
    cartTotal: total,
  });

  const isValid = validation.success;

  const handlePlaceOrder = () => {
    if (!isValid) return;
    placeOrder(payments);
  };

  const handleBack = () => {
    if (items.length > 0 && itemCountAtLoad > 0) {
      setIsBackConfirmOpen(true);
      return;
    }
    router.push('/cart');
  };

  if (isConfirmed) {
    const orderNo = orderResult?.Entity?.order_no ?? orderResult?.Entity?.order_id ?? '';
    const invoiceId = orderResult?.Entity?.invoice_id ?? null;
    return <OrderConfirmationScreen orderNo={orderNo} invoiceId={invoiceId} />;
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-28">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleBack}
          aria-label="Back to cart"
          className="min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Button>
        <h1 className="text-lg font-bold text-stone-800">Checkout</h1>
      </div>

      <div className="flex flex-col gap-4">
        <CheckoutCustomerSummary />
        <CheckoutDiscountSection />
        <CheckoutPaymentSection onChange={setPayments} />

        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-bold text-stone-800 mb-1">Order Summary</h2>
          <CartSummary />
        </section>
      </div>

      {/* Sticky footer with Place Order */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-white p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="max-w-5xl mx-auto w-full">
          <PlaceOrderButton
            isValid={isValid}
            isPlacingOrder={isPlacingOrder}
            onPlaceOrder={handlePlaceOrder}
          />
        </div>
      </div>

      <ConfirmDialog
        isOpen={isBackConfirmOpen}
        onOpenChange={setIsBackConfirmOpen}
        title="Leave checkout?"
        description="Your cart items will be kept, but any payment selections you've made here will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        confirmVariant="destructive"
        onConfirm={() => router.push('/cart')}
      />
    </div>
  );
}

export default function CheckoutPage() {
  return <CheckoutScreen />;
}