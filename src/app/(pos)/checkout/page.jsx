'use client';

// src/app/(pos)/checkout/page.jsx
// Checkout screen — direct POS billing via POS/Invoice/Create → Post.
//
// FLOW:
//   1. Customer must be attached (checkoutSchema enforces this)
//   2. Payment modes selected + amounts balanced to cart total
//   3. Optional narration/notes for the invoice
//   4. placeInvoice({ paymentModes, narration }) → Create → Post
//   5. On success → OrderConfirmationScreen with transactionId
//
// NAVIGATION GUARD:
//   - Redirects to /cart if cart is empty and no sale placed
//   - useRedirectOnCustomerChange redirects to /catalog on customer switch
//   - beforeunload warns on tab close/refresh while cart has items

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import ConfirmDialog    from '@/components/shared/ConfirmDialog';
import CheckoutCustomerSummary  from '@/components/features/checkout/CheckoutCustomerSummary';
import CheckoutDiscountSection  from '@/components/features/checkout/CheckoutDiscountSection';
import CheckoutPaymentSection   from '@/components/features/checkout/CheckoutPaymentSection';
import SalesPersonSelect        from '@/components/features/checkout/SalesPersonSelect';
import CartItemRow              from '@/components/features/cart/CartItemRow';
import CartSummary              from '@/components/features/cart/CartSummary';
import PlaceOrderButton         from '@/components/features/checkout/PlaceOrderButton';
import OrderConfirmationScreen  from '@/components/features/checkout/OrderConfirmationScreen';
import { useCart }                    from '@/hooks/cart/useCart';
import { useCartTotals }              from '@/hooks/cart/useCartTotals';
import { useCustomerSession }         from '@/hooks/customer/useCustomerSession';
import { useRedirectOnCustomerChange } from '@/hooks/checkout/useRedirectOnCustomerChange';
import { useCreateInvoice }           from '@/hooks/checkout/useCreateInvoice';
import { useBackGuard } from '@/contexts/NavigationGuardContext';
import { useSmartBack }  from '@/hooks/navigation/useSmartBack';
import { checkoutSchema }             from '@/validators/checkoutSchema';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import tracker from '@/lib/analytics/tracker';
import EVENTS, { GA_ECOMMERCE_EVENTS } from '@/lib/analytics/events';

function CheckoutScreen() {
  const router  = useRouter();
  const { items, isEmpty } = useCart();
  const { total }          = useCartTotals();
  const { customerId }     = useCustomerSession();
  const activeStoreId      = useSelector(selectActiveStoreId);
  const { goBack, clearGuard } = useSmartBack();

  const {
    placeInvoice,
    isPlacingInvoice,
    invoiceResult,
    reset: resetInvoice,
  } = useCreateInvoice();

  const [payments, setPayments]     = useState([]);
  const [salesPersonId, setSalesPersonId] = useState(null);
  const [isBackConfirmOpen, setIsBackConfirmOpen] = useState(false);

  // Track whether a sale has been successfully completed
  const isConfirmed = !!invoiceResult;

  // Intercept the GLOBAL back button (Header) when there are unsaved
  // payment selections — shows the "Leave checkout?" dialog instead of
  // navigating immediately. Returning `false` tells useSmartBack this
  // page is handling navigation itself for now.
  const backGuard = useCallback(() => {
    if (items.length > 0 && !isConfirmed) {
      setIsBackConfirmOpen(true);
      return false;
    }
    return true;
  }, [items.length, isConfirmed]);
  useBackGuard(backGuard);

  const handleConfirmLeave = () => {
    // Clear our own guard first so the second goBack() call (below)
    // doesn't just re-open this same dialog.
    clearGuard();
    setIsBackConfirmOpen(false);
    goBack();
  };

  // Stop customer-switch redirect once sale is confirmed
  useRedirectOnCustomerChange(!isConfirmed);

  // Redirect to cart if empty and no sale placed
  useEffect(() => {
    if (isEmpty && !isConfirmed) {
      router.replace('/cart');
    }
  }, [isEmpty, isConfirmed, router]);

  // Fire begin_checkout once per visit to this screen with items in cart
  useEffect(() => {
    if (isEmpty) return;
    tracker.trackEcommerce(GA_ECOMMERCE_EVENTS.BEGIN_CHECKOUT, EVENTS.CHECKOUT_STARTED, {
      value:    total,
      currency: 'INR',
      items:    items.map((item) => ({
        item_id:   String(item.itemId),
        item_name: item.itemName,
        item_sku:  item.sku,
        price:     item.unitPrice,
        quantity:  item.quantity,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn on tab close / page refresh while cart has items and sale not done
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

  // Validate checkout state before allowing submission
  const validation = checkoutSchema.safeParse({
    customerId,
    salesPersonId,
    paymentModes: payments,
    totalAmount:  total,
    cartTotal:    total,
  });
  const isValid = validation.success;

  const handlePlaceOrder = async () => {
    if (!isValid || isPlacingInvoice) return;
    await placeInvoice({ paymentModes: payments, salesPersonId });
  };

  // ── Confirmation screen ────────────────────────────────────────────────────
  if (isConfirmed && invoiceResult) {
    return (
      <OrderConfirmationScreen
        transactionId={invoiceResult.transactionId}
        // document_no will be loaded by useInvoiceDetail inside the screen
        // but pass the EntityId so it can fetch immediately
      />
    );
  }

  // ── Checkout form ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-28 p-4 md:p-6">
      <div className='flex align-top justify-center gap-4'>
        <div className="flex flex-col gap-4 w-full">
          {/* Customer attached to this sale */}
          <CheckoutCustomerSummary />

          {/* Order items — same CartItemRow used on the Cart page, read-only here */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold text-stone-800 mb-1">
              Order Items <span className="text-muted-foreground font-normal text-xs">({items.length} item{items.length !== 1 ? 's' : ''})</span>
            </h2>
            <div>
              {items.map((item) => (
                <CartItemRow
                  key={`${item.itemId}-${item.sizeId}-${item.styleId}`}
                  item={item}
                  readOnly
                />
              ))}
            </div>
          </section>

          {/* Order summary */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold text-stone-800 mb-1">Order Summary</h2>
            <CartSummary />
          </section>
        </div>
        <div className="flex flex-col gap-4 w-full">
          {/* Sales person — required, mirrors the vendor's own POS Sale screen */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold text-stone-800 mb-2">
              Sales Person <span className="text-destructive">*</span>
            </h2>
            <SalesPersonSelect
              companyId={activeStoreId}
              value={salesPersonId}
              onChange={setSalesPersonId}
            />
          </section>

          {/* Promo code / discount */}
          <CheckoutDiscountSection />

          {/* Payment modes + invoice helper balances */}
          <CheckoutPaymentSection onChange={setPayments} />
        </div>
      </div>

      <div className="flex flex-col gap-4">

        

        

        

        

      </div>

      {/* Sticky Place Order button */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="max-w-5xl mx-auto w-full">
          <PlaceOrderButton
            isValid={isValid}
            isPlacingOrder={isPlacingInvoice}
            onPlaceOrder={handlePlaceOrder}
          />
        </div>
      </div>

      {/* Back confirmation dialog — triggered via the global Header back button */}
      <ConfirmDialog
        isOpen={isBackConfirmOpen}
        onOpenChange={setIsBackConfirmOpen}
        title="Leave checkout?"
        description="Your cart items will be kept, but any payment selections you've made here will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        confirmVariant="destructive"
        onConfirm={handleConfirmLeave}
      />

    </div>
  );
}

export default function CheckoutPage() {
  return <CheckoutScreen />;
}