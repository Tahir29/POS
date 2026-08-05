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
import { ShieldCheck } from 'lucide-react';
import ConfirmDialog    from '@/components/shared/ConfirmDialog';
import CheckoutCustomerSummary  from '@/components/features/checkout/CheckoutCustomerSummary';
import CheckoutPanCapture       from '@/components/features/checkout/CheckoutPanCapture';
import CheckoutDiscountSection  from '@/components/features/checkout/CheckoutDiscountSection';
import CheckoutPaymentSection   from '@/components/features/checkout/CheckoutPaymentSection';
import CheckoutTrustStrip       from '@/components/features/checkout/CheckoutTrustStrip';
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
import { useCheckoutPricing }         from '@/hooks/checkout/useCheckoutPricing';
import { useBackGuard } from '@/contexts/NavigationGuardContext';
import { useSmartBack }  from '@/hooks/navigation/useSmartBack';
import { checkoutSchema }             from '@/validators/checkoutSchema';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import APP_CONFIG from '@/constants/appConfig';
import tracker from '@/lib/analytics/tracker';
import EVENTS, { GA_ECOMMERCE_EVENTS } from '@/lib/analytics/events';

function CheckoutScreen() {
  const router  = useRouter();
  const { items, isEmpty, clearCart } = useCart();
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

  // Prices the real stock pieces up front. `amountDue` — not the cart's
  // catalog-derived total — is what the customer is asked to pay, because
  // the catalog figure can omit stone value entirely and would leave the
  // invoice short-paid (see useCheckoutPricing).
  const {
    lineItems: pricedLineItems,
    totals: pricedTotals,
    amountDue,
    isLoading: isPricing,
    error: pricingError,
  } = useCheckoutPricing(APP_CONFIG.DOCUMENT_TYPES.POS_INVOICE);

  // Until pricing resolves there is no trustworthy figure to collect
  // against, so fall back to the cart estimate only for display.
  const payableTotal = amountDue ?? total;

  // Per-item priced totals from the SAME real stock-piece pricing that
  // Order Summary reads (pricedTotals) — so "Order Items" above it can never
  // show the stale catalog price next to the real total below it. Grouped by
  // item_id: buildPricedLineItems returns one row per physical piece, so a
  // cart line for qty 3 becomes 3 rows here, summed back into one line.
  const pricedNetByItemId = useMemo(() => {
    if (!pricedLineItems) return null;
    const map = new Map();
    for (const row of pricedLineItems) {
      const prev = map.get(row.item_id) ?? { net: 0, count: 0 };
      map.set(row.item_id, { net: prev.net + (row.net_amount ?? 0), count: prev.count + 1 });
    }
    return map;
  }, [pricedLineItems]);

  const [payments, setPayments]     = useState([]);
  const [salesPersonId, setSalesPersonId] = useState(null);
  const [panNumber, setPanNumber]   = useState(null);
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

  // Clear the basket only once the sale is confirmed and this screen has
  // committed to showing the confirmation. Doing it inside the mutation's
  // onSuccess (where it used to live) dropped the customer one render too
  // early and the navigation guards above bounced the operator to /cart
  // before the invoice number was ever displayed.
  useEffect(() => {
    if (isConfirmed && !isEmpty) {
      clearCart();
    }
  }, [isConfirmed, isEmpty, clearCart]);

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
    totalAmount:  payableTotal,
    cartTotal:    payableTotal,
    panNumber,
  });
  // Never allow a sale to be submitted against the provisional cart figure —
  // it can differ from the invoice by the value of the stones.
  const isValid = validation.success && !!pricedLineItems && !isPricing && !pricingError;

  const handlePlaceOrder = async () => {
    if (!isValid || isPlacingInvoice) return;
    // discount: the SAME figure already shown as the Total/Discount here and
    // validated by checkoutSchema — computed against the real stock-piece
    // subtotal (useCheckoutPricing), not cartSlice's catalog-based estimate.
    // Passed explicitly so useCreateInvoice bills exactly what was quoted,
    // rather than re-deriving a different (wrong-basis) figure internally.
    await placeInvoice({
      paymentModes: payments,
      salesPersonId,
      pricedLineItems,
      discount: pricedTotals?.discount ?? 0,
    });
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
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-32 p-4 md:p-6">
      <p className="text-sm text-muted-foreground -mb-2">Review your order and complete the payment</p>

      <div className='grid grid-cols-1 items-start gap-5 lg:grid-cols-2'>
        <div className="flex flex-col gap-5 w-full">
          {/* Customer attached to this sale */}
          <CheckoutCustomerSummary />

          {/* Mandatory PAN once the order crosses the statutory threshold */}
          <CheckoutPanCapture totalAmount={total} onPanResolved={setPanNumber} />

          {/* Sales person — required, mirrors the vendor's own POS Sale screen */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-2">
              Sales Person <span className="text-destructive">*</span>
            </h2>
            <SalesPersonSelect
              companyId={activeStoreId}
              value={salesPersonId}
              onChange={setSalesPersonId}
            />
          </section>

          {/* Promo code / discount — shown against the real stock-piece
              subtotal so "you saved ₹X" here matches what's actually
              subtracted from the invoice (see useCheckoutPricing). */}
          <CheckoutDiscountSection realSubtotal={pricedTotals?.subTotal} />
        </div>
        <div className="flex flex-col gap-5 w-full">
          {/* Order items — same CartItemRow used on the Cart page, read-only here */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-1">
              Order Items <span className="text-muted-foreground font-normal text-xs">({items.length} item{items.length !== 1 ? 's' : ''})</span>
            </h2>
            <div>
              {items.map((item) => {
                const priced = pricedNetByItemId?.get(item.itemId);
                const displayUnitPrice = priced ? priced.net / (priced.count || 1) : undefined;
                return (
                  <CartItemRow
                    key={`${item.itemId}-${item.sizeId}-${item.styleId}`}
                    item={item}
                    readOnly
                    displayUnitPrice={displayUnitPrice}
                  />
                );
              })}
            </div>
          </section>

          {/* Order summary */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-1">Order Summary</h2>
            {/* Driven by the priced stock pieces, so this reads the same
                figure as the Place Order button and the amount collected. */}
            <CartSummary totals={pricedTotals} isPricing={isPricing} />
          </section>

          {/* Payment modes + invoice helper balances */}
          <CheckoutPaymentSection onChange={setPayments} amountDue={amountDue} />

          {/* Pricing state — the operator must know the figure isn't final
              yet, and must not be left guessing if it fails outright. */}
          {isPricing && (
            <p className="text-xs text-muted-foreground">
              Pricing items against today's rates…
            </p>
          )}
          {pricingError && (
            <p className="text-sm text-status-error">
              {pricingError.serverMessage ?? pricingError.message}
            </p>
          )}
        </div>
      </div>

      {/* Reassurance strip — exchange/certification/warranty + accepted payment networks */}
      <CheckoutTrustStrip />

      {/* Sticky Place Order button */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="max-w-6xl mx-auto w-full flex flex-col items-center gap-2">
          <PlaceOrderButton
            isValid={isValid}
            isPlacingOrder={isPlacingInvoice}
            onPlaceOrder={handlePlaceOrder}
            amountDue={amountDue}
            isPricing={isPricing}
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck size={13} className="text-accent" aria-hidden="true" />
            Secure checkout · Your data is safe with us
          </p>
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