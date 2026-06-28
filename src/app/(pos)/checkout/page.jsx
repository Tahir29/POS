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

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button }       from '@/components/ui/button';
import { Input }        from '@/components/ui/input';
import { Label }        from '@/components/ui/label';
import ConfirmDialog    from '@/components/shared/ConfirmDialog';
import CheckoutCustomerSummary  from '@/components/features/checkout/CheckoutCustomerSummary';
import CheckoutDiscountSection  from '@/components/features/checkout/CheckoutDiscountSection';
import CheckoutPaymentSection   from '@/components/features/checkout/CheckoutPaymentSection';
import CartSummary              from '@/components/features/cart/CartSummary';
import PlaceOrderButton         from '@/components/features/checkout/PlaceOrderButton';
import OrderConfirmationScreen  from '@/components/features/checkout/OrderConfirmationScreen';
import { useCart }                    from '@/hooks/cart/useCart';
import { useCartTotals }              from '@/hooks/cart/useCartTotals';
import { useCustomerSession }         from '@/hooks/customer/useCustomerSession';
import { useRedirectOnCustomerChange } from '@/hooks/checkout/useRedirectOnCustomerChange';
import { useCreateInvoice }           from '@/hooks/checkout/useCreateInvoice';
import { checkoutSchema }             from '@/validators/checkoutSchema';

function CheckoutScreen() {
  const router  = useRouter();
  const { items, isEmpty } = useCart();
  const { total }          = useCartTotals();
  const { customerId }     = useCustomerSession();

  const {
    placeInvoice,
    isPlacingInvoice,
    invoiceResult,
    reset: resetInvoice,
  } = useCreateInvoice();

  const [payments, setPayments]     = useState([]);
  const [narration, setNarration]   = useState('');
  const [isBackConfirmOpen, setIsBackConfirmOpen] = useState(false);

  // Track whether a sale has been successfully completed
  const isConfirmed = !!invoiceResult;

  // Stop customer-switch redirect once sale is confirmed
  useRedirectOnCustomerChange(!isConfirmed);

  // Redirect to cart if empty and no sale placed
  useEffect(() => {
    if (isEmpty && !isConfirmed) {
      router.replace('/cart');
    }
  }, [isEmpty, isConfirmed, router]);

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
    paymentModes: payments,
    totalAmount:  total,
    cartTotal:    total,
  });
  const isValid = validation.success;

  const handlePlaceOrder = async () => {
    if (!isValid || isPlacingInvoice) return;
    await placeInvoice({
      paymentModes: payments,
      narration:    narration.trim() || undefined,
    });
  };

  const handleBack = () => {
    if (items.length > 0) {
      setIsBackConfirmOpen(true);
      return;
    }
    router.push('/cart');
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
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-28">

      {/* Header */}
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

        {/* Customer attached to this sale */}
        <CheckoutCustomerSummary />

        {/* Promo code / discount */}
        <CheckoutDiscountSection />

        {/* Payment modes + invoice helper balances */}
        <CheckoutPaymentSection onChange={setPayments} />

        {/* Optional narration / notes */}
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="checkout-narration" className="text-sm font-bold text-stone-800">
              Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Input
              id="checkout-narration"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Add a note to this invoice…"
              className="h-11"
              maxLength={200}
            />
          </div>
        </section>

        {/* Order summary */}
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-bold text-stone-800 mb-1">Order Summary</h2>
          <CartSummary />
        </section>

      </div>

      {/* Sticky Place Order button */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-white p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="max-w-5xl mx-auto w-full">
          <PlaceOrderButton
            isValid={isValid}
            isPlacingOrder={isPlacingInvoice}
            onPlaceOrder={handlePlaceOrder}
          />
        </div>
      </div>

      {/* Back confirmation dialog */}
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