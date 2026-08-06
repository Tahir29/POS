'use client';

// src/app/(pos)/checkout/page.jsx
// Checkout screen — ONE price, ONE flow, no mode to choose.
//
// THERE IS DELIBERATELY NO "COMPLETE AS" CHOICE. A Bill Now / Place Order
// selector briefly lived here and was removed: it made the operator classify
// a sale before knowing how it would be paid, and — because the two modes
// priced different things — showed two different figures for the same item
// on the same screen. In front of a customer that is a trust problem, not a
// UX wrinkle.
//
// Nothing is lost by removing it, because neither half was ever really the
// operator's decision:
//
//   WHAT IT COSTS  is a fact about the goods. Priced once by
//     useCheckoutPricing, from the physical piece when the shelf can supply
//     the basket and from the item master when it can't (made-to-order).
//     Same figure from catalog through to the posted document.
//
//   WHICH DOCUMENT is a consequence of what the customer pays:
//     in stock + paid in full  → POS/Invoice/Create (54)
//     advance, nothing, or MTO → POS/Order/Create (53), balance carried
//
// Exactly one document per sale — raising both would book the same goods
// twice. (Their ERP can later fulfil an order into an invoice via "Fulfill
// from order"; that contract is uncaptured, so it isn't wired here.)
//
// FLOW:
//   1. Customer must be attached (checkoutSchema enforces this)
//   2. Basket priced live — the ONLY source of any figure shown, collected,
//      or submitted, including the promo discount
//   3. Payment collected: anything from nothing up to the total
//   4. place*({ paymentModes, pricedLineItems, promotionDetails })
//   5. On success → OrderConfirmationScreen for whichever document was raised
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
import { useCreateOrder }             from '@/hooks/checkout/useCreateOrder';
import { useCheckoutPricing }         from '@/hooks/checkout/useCheckoutPricing';
import { mapPricedLinesToCart }       from '@/services/checkoutPricingService';
import { useBackGuard } from '@/contexts/NavigationGuardContext';
import { useSmartBack }  from '@/hooks/navigation/useSmartBack';
import { checkoutSchema }             from '@/validators/checkoutSchema';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
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
  } = useCreateInvoice();

  const {
    placeOrder,
    isPlacingOrder,
    orderResult,
  } = useCreateOrder();

  // Prices the real stock pieces up front and resolves the promo against
  // them. `amountDue` — not the cart's catalog-derived total — is what the
  // customer is asked to pay, because the catalog figure can omit stone value
  // entirely and would leave the document short-paid (see useCheckoutPricing).
  const {
    lineItems: pricedLineItems,
    totals: pricedTotals,
    promotionDetails,
    isStockBacked,
    amountDue,
    isLoading: isPricing,
    error: pricingError,
  } = useCheckoutPricing();

  // Until pricing resolves there is no trustworthy figure to collect
  // against, so fall back to the cart estimate only for display.
  const payableTotal = amountDue ?? total;

  const [payments, setPayments]     = useState([]);
  const [salesPersonId, setSalesPersonId] = useState(null);
  const [panNumber, setPanNumber]   = useState(null);
  const [isBackConfirmOpen, setIsBackConfirmOpen] = useState(false);

  const pricedByCartIndex = useMemo(
    () => mapPricedLinesToCart(items, pricedLineItems),
    [items, pricedLineItems]
  );

  const amountCollected = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const isSubmitting = isPlacingInvoice || isPlacingOrder;

  // The document follows from the money, not from a mode the operator picked.
  // Settled in full against goods the shelf can actually supply → invoice;
  // anything else (part-paid, unpaid, or made-to-order) → order, with the
  // remainder carried as balance_amount.
  const isPaidInFull = payableTotal > 0
    && Math.abs(amountCollected - payableTotal) < 0.01;
  const isOrderMode  = !isStockBacked || !isPaidInFull;
  const documentType = isOrderMode ? 'order' : 'invoice';

  // Track whether a sale has been successfully completed
  const result = orderResult ?? invoiceResult;
  const isConfirmed = !!result;
  const confirmedType = orderResult ? 'order' : 'invoice';

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
    // Any amount from nothing up to the total is acceptable — how much is
    // collected is what decides which document gets raised, so there is no
    // "wrong" amount to block on. Overpaying still is.
    allowPartialPayment: true,
  });
  // Never allow a sale to be submitted against the provisional cart figure —
  // it can differ from the document by the value of the stones.
  const isValid = validation.success && !!pricedLineItems && !isPricing && !pricingError;

  const handlePlaceOrder = async () => {
    if (!isValid || isSubmitting) return;

    // The lines already carry the promotion (applied and re-taxed by
    // Helper/ApplyPromotions inside useCheckoutPricing), and promotionDetails
    // is the server's own row for the document. Both go in exactly as
    // received — the same resolution that quoted the figure the operator just
    // collected against.
    const submission = {
      paymentModes: payments,
      salesPersonId,
      pricedLineItems,
      promotionDetails,
    };

    if (isOrderMode) await placeOrder(submission);
    else             await placeInvoice(submission);
  };

  // ── Confirmation screen ────────────────────────────────────────────────────
  if (isConfirmed && result) {
    return (
      <OrderConfirmationScreen
        transactionId={result.transactionId}
        documentType={confirmedType}
        // document_no is loaded by the screen's own Retrieve; the EntityId is
        // passed so it can fetch immediately.
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

          {/* Mandatory PAN once the sale crosses the statutory threshold.
              Judged on the PRICED payable — against the cart's catalog
              estimate a sale worth well over the threshold could read as
              under it, and the PAN would never be asked for. */}
          <CheckoutPanCapture totalAmount={payableTotal} onPanResolved={setPanNumber} />

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

          {/* Promo code / discount — the saving shown per promo is the
              server's own promotion_amount, not a local estimate. */}
          <CheckoutDiscountSection
            promotionDetails={promotionDetails}
            isPricing={isPricing}
          />
        </div>
        <div className="flex flex-col gap-5 w-full">
          {/* Order items — same CartItemRow used on the Cart page, read-only here */}
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-1">
              Order Items <span className="text-muted-foreground font-normal text-xs">({items.length} item{items.length !== 1 ? 's' : ''})</span>
            </h2>
            <div>
              {items.map((item, index) => (
                <CartItemRow
                  key={`${item.itemId}-${item.sizeId}-${item.styleId}`}
                  item={item}
                  readOnly
                  // What this line is really being sold at. The cart's own
                  // figure is the item master's nominal spec; an invoice
                  // bills a physical piece whose actual weight sets the
                  // price. See CartItemRow for the worked example.
                  priced={pricedByCartIndex.get(index) ?? null}
                />
              ))}
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
          <CheckoutPaymentSection
            onChange={setPayments}
            amountDue={amountDue}
            allowPartial
          />

          {/* Made-to-order is stated, not asked. The operator can't invoice a
              piece that isn't on the shelf, so this explains up front why the
              sale will be booked as an order however it's paid — rather than
              letting them find out at the confirmation screen. */}
          {!isPricing && !!pricedLineItems && !isStockBacked && (
            <p className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              Not in stock at this store — this will be booked as an order and
              billed when the piece arrives.
            </p>
          )}

          {/* Pricing state — the operator must know the figure isn't final
              yet, and must not be left guessing if it fails outright. */}
          {isPricing && (
            <p className="text-xs text-muted-foreground">
              Pricing items against today&apos;s rates…
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
            isPlacingOrder={isSubmitting}
            onPlaceOrder={handlePlaceOrder}
            amountDue={amountDue}
            amountCollected={amountCollected}
            isPricing={isPricing}
            documentType={documentType}
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