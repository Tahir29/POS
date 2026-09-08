'use client';

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
// from order" — wired 2026-08-19: OrderDetailSheet's FulfillOrderAction
// hydrates the cart from a ready order line and lands here like any other
// sale; useCreateInvoice threads fulfillmentOrderId/OrderNo through onto
// the Invoice/Create payload. See the header comment on
// API.ORDER_FULFILLMENT for what's confirmed vs. still unverified about
// that reference actually closing the source order out server-side.)
//
// FLOW:
//   1. Customer must be attached (checkoutSchema enforces this)
//   2. Basket priced live — the ONLY source of any figure shown, collected,
//      or submitted, including the promo discount
//   3. Payment collected: anything from nothing up to the total
//   4. PAYMENT CONFIRMATION GATE (2026-09-07, see handlePlaceOrderClick
//      below) — "Place Order"/"Complete Sale" no longer submits directly.
//      The payment modes selected here (Cash/Card/UPI/...) are collected on
//      a PHYSICAL terminal the agent operates separately — this app has no
//      way to know whether that machine actually approved the charge, so it
//      must not assume success just because a mode/amount was typed in.
//      Clicking Place Order instead opens a Yes/No confirmation ("has the
//      payment actually gone through on the terminal?"):
//        Yes → place*({ paymentModes, pricedLineItems, promotionDetails })
//              actually runs now, for the first time in this flow.
//        No  → nothing is ever submitted — no draft, no partial document —
//              straight to /order-failed?reason=declined.
//   5. On success → cart is cleared and the operator is sent to
//      /order-success?transactionId=&documentType= (a real route now, not
//      an inline swap — see that page's own header for why).
//      On a genuine save failure after Yes (network/server error, payment
//      already taken) → /order-failed?reason=error&message=... instead.
//
// NAVIGATION GUARD:
//   - Redirects to /cart if cart is empty and no sale placed
//   - useRedirectOnCustomerChange redirects to /catalog on customer switch
//   - beforeunload warns on tab close/refresh while cart has items

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import ConfirmDialog    from '@/components/shared/ConfirmDialog';
import CheckoutCustomerSummary  from '@/components/features/checkout/CheckoutCustomerSummary';
import CheckoutPanCapture       from '@/components/features/checkout/CheckoutPanCapture';
import DiscountOrCoinsSection   from '@/components/features/checkout/DiscountOrCoinsSection';
import CheckoutPaymentSection   from '@/components/features/checkout/CheckoutPaymentSection';
import CheckoutTrustStrip       from '@/components/features/checkout/CheckoutTrustStrip';
import SalesPersonSelect        from '@/components/features/checkout/SalesPersonSelect';
import { useSalesPersonOptions } from '@/hooks/schemes/useSalesPersonOptions';
import CartItemRow              from '@/components/features/cart/CartItemRow';
import CartSummary              from '@/components/features/cart/CartSummary';
import PlaceOrderButton         from '@/components/features/checkout/PlaceOrderButton';
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
import { redeemLoyaltyCoins } from '@/services/nectorService';
import { QUERY_KEYS } from '@/constants/queryKeys';

// Same formatting convention as PlaceOrderButton's own local `money()` —
// used here for the payment-confirmation dialog's description.
const money = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function CheckoutScreen() {
  const router  = useRouter();
  const queryClient = useQueryClient();
  const { items, isEmpty, clearCartKeepCustomer, removeItem, redeemedCoins } = useCart();
  const { total }          = useCartTotals();
  const { customerId, customerMobile } = useCustomerSession();
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

  // Lucira Coins (2026-09-08) — re-derived here, not trusted from
  // redeemedCoins as-is, same reasoning as cart/page.jsx and CartDrawer's
  // identical clamp.
  const coinsRedeemed = Math.max(0, Math.min(redeemedCoins, payableTotal));
  const hasCoinsApplied = coinsRedeemed > 0;

  // FIXED 2026-09-08 (product decision) — coins used to sit entirely
  // outside checkout: `isValid` was hard-blocked whenever any were applied,
  // because the real Nector debit (see nectorService.js's
  // redeemLoyaltyCoins) can't be confirmed to actually work — its
  // lead-identifier gap is still unresolved. Now folded in the same way a
  // promo discount already is: `finalPayableTotal` is what CheckoutPaymentSection/
  // PlaceOrderButton/isPaidInFull collect against, same as `amountDue`
  // always was for a promo. The debit itself stays a best-effort call
  // AFTER the sale (see handlePaymentConfirmed) — a failure there no
  // longer blocks completing the sale, it just means the coins may not
  // actually be deducted from the customer's real Nector wallet this time.
  // That trade-off was an explicit product decision, not something this
  // code silently assumes.
  const finalPayableTotal = Math.max(0, payableTotal - coinsRedeemed);

  const [payments, setPayments]     = useState([]);
  const [salesPersonId, setSalesPersonId] = useState(null);
  // ADDED 2026-09-08 — resolves salesPersonId to a real name for
  // ORDER_PLACED's analytics event (see orderTracking.js — used to send
  // only the bare employee id). Same query SalesPersonSelect below already
  // makes (QUERY_KEYS.HR.EMPLOYEES_BY_COMPANY(activeStoreId)) — React
  // Query serves this from cache, not a second network call.
  const { salesPersons } = useSalesPersonOptions(activeStoreId);
  const salesPersonName = salesPersons.find((p) => p.employee_id === salesPersonId)?.employee_name ?? null;
  const [panNumber, setPanNumber]   = useState(null);
  const [isBackConfirmOpen, setIsBackConfirmOpen] = useState(false);
  // Payment-confirmation gate (2026-09-07) — see this file's header comment.
  const [isPaymentConfirmOpen, setIsPaymentConfirmOpen] = useState(false);

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
  //
  // Compared against finalPayableTotal, not payableTotal (2026-09-08) —
  // judged against what the customer actually still owes after coins,
  // same as it already was for a promo discount (amountDue was always
  // post-promo). The `payableTotal > 0` guard itself is UNCHANGED and
  // still reads the pre-coins figure on purpose: it means "pricing has
  // actually resolved to a real number" (payableTotal is 0/undefined
  // before that), not "there's something left to pay" — coins can now
  // legitimately zero out finalPayableTotal (covering the ENTIRE amount),
  // and that's still a fully-paid sale (amountCollected is legitimately 0
  // too in that case) — checking `finalPayableTotal > 0` instead would
  // have wrongly failed exactly that case.
  const isPaidInFull = payableTotal > 0
    && Math.abs(amountCollected - finalPayableTotal) < 0.01;
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

  // Clear the basket and hand off to /order-success once the sale is
  // confirmed. This used to be an inline component swap on this same page
  // (OrderConfirmationScreen) — moved to a real route (2026-09-07, see that
  // page's own header for why) — so this effect now does both jobs that
  // used to be split across two places: clearing the cart (still gated on
  // isConfirmed, not done inside the mutation's own onSuccess — doing it
  // there dropped the customer one render too early and the guards above
  // bounced the operator to /cart before the redirect below ever fired),
  // and actually leaving this page.
  //
  // clearCartKeepCustomer, NOT clearCart (2026-09-07) — plain clearCart()
  // resets cart/slice's customerId/customerName/customerMobile/
  // customerAddress back to null along with the items, since those fields
  // live in the SAME slice and clearCart returns initialState wholesale.
  // That meant completing a sale silently detached the customer too — the
  // header showed nobody attached the moment the operator landed on
  // /order-success, indistinguishable from tapping "Remove". Explicit
  // product decision: a completed sale must not end the customer's
  // session — only a manual detach or the agent's own logout should.
  // clearCartKeepCustomer resets everything else (items, promos, gift
  // card/voucher, fulfillment refs) but carries the four customer fields
  // forward unchanged.
  useEffect(() => {
    if (isConfirmed && result) {
      if (!isEmpty) clearCartKeepCustomer();
      // coinsRedeemed carried forward via the URL (2026-09-08) — see
      // order-success/page.jsx's own header for why: not an OrnaVerse
      // document field, so there's nowhere else for that screen to read it
      // back from. Deliberately NOT in this effect's deps below —
      // clearCartKeepCustomer() resets Redux's own redeemedCoins to 0
      // synchronously, and adding it as a dep would re-fire this exact
      // effect on that change (isConfirmed/result are still true) with
      // coinsRedeemed now 0, overwriting the correct URL just pushed a
      // moment earlier with a wrong one. Reads the value already captured
      // in this render's closure instead, which is correct.
      router.replace(
        `/order-success?transactionId=${result.transactionId}&documentType=${confirmedType}&coinsRedeemed=${coinsRedeemed}`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed, result, confirmedType, isEmpty, clearCartKeepCustomer, router]);

  // Fire begin_checkout once per visit to this screen with items in cart
  //
  // ENRICHED 2026-09-08 — this used to send only item_id/name/sku/price/
  // quantity, same bare shape as ORDER_PLACED used to before that event
  // was enriched (see orderTracking.js's toOrderItems) — no karat/metal/
  // colour/weight/gemstone at all, even though every cart line now carries
  // that full detail in its own `attributes` (see AddToCartButton.jsx/
  // productAttributes.js). Same field NAMES as toOrderItems uses (
  // item_category/item_karat/item_metal/...) so a funnel comparing
  // begin_checkout against purchase for the same product sees consistent
  // keys, not two different schemas for the same underlying attribute.
  useEffect(() => {
    if (isEmpty) return;
    tracker.trackEcommerce(GA_ECOMMERCE_EVENTS.BEGIN_CHECKOUT, EVENTS.CHECKOUT_STARTED, {
      value:    total,
      currency: 'INR',
      items:    items.map((item) => ({
        item_id:           String(item.itemId),
        item_name:         item.itemName,
        item_sku:          item.sku,
        item_category:     item.attributes?.category ?? null,
        item_sub_category: item.attributes?.sub_category ?? null,
        item_brand:        item.attributes?.brand ?? null,
        item_collection:   item.attributes?.collection ?? null,
        item_karat:        item.attributes?.karat ?? null,
        item_metal:        item.attributes?.metal ?? null,
        item_color:        item.attributes?.metal_color ?? null,
        item_size:         item.sizeName ?? item.attributes?.size_name ?? null,
        item_weight:       item.attributes?.net_weight ?? item.attributes?.gross_weight ?? null,
        gemstone_type:     item.attributes?.gemstone_type ?? null,
        gemstone_color:    item.attributes?.gemstone_color ?? null,
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

  // Validate checkout state before allowing submission — finalPayableTotal
  // (post-coins), not payableTotal, is what's actually being collected
  // against (2026-09-08, same reasoning as isPaidInFull above).
  const validation = checkoutSchema.safeParse({
    customerId,
    salesPersonId,
    paymentModes: payments,
    totalAmount:  finalPayableTotal,
    cartTotal:    finalPayableTotal,
    panNumber,
    // Any amount from nothing up to the total is acceptable — how much is
    // collected is what decides which document gets raised, so there is no
    // "wrong" amount to block on. Overpaying still is.
    allowPartialPayment: true,
  });
  // Never allow a sale to be submitted against the provisional cart figure —
  // it can differ from the document by the value of the stones.
  //
  // No longer gated on !hasCoinsApplied (2026-09-08, reversed product
  // decision) — a sale used to be blocked outright while coins were
  // applied, since the real Nector debit call still has an unresolved
  // identifier gap (see nectorService.js's redeemLoyaltyCoins). Per
  // explicit product decision, that's now accepted as a known trade-off
  // rather than a hard block: the sale completes with coins folded into
  // the payable total (see finalPayableTotal above) exactly like a promo
  // discount, and the debit is attempted best-effort AFTER the sale (see
  // handlePaymentConfirmed) — if it fails, the sale still stands.
  const isValid = validation.success && !!pricedLineItems && !isPricing && !pricingError;

  // "Place Order"/"Complete Sale" no longer submits anything by itself — it
  // only opens the payment-confirmation gate. See this file's header
  // comment for why: the payment itself is taken on a physical terminal
  // this app cannot see the result of.
  const handlePlaceOrderClick = () => {
    if (!isValid || isSubmitting) return;
    setIsPaymentConfirmOpen(true);
  };

  // "Yes, payment received" — only now does the actual create/post call
  // run. The lines already carry the promotion (applied and re-taxed by
  // Helper/ApplyPromotions inside useCheckoutPricing), and promotionDetails
  // is the server's own row for the document. Both go in exactly as
  // received — the same resolution that quoted the figure the operator just
  // collected against.
  const handlePaymentConfirmed = async () => {
    const submission = {
      paymentModes: payments,
      salesPersonId,
      salesPersonName,
      pricedLineItems,
      promotionDetails,
    };

    try {
      if (isOrderMode) await placeOrder(submission);
      else             await placeInvoice(submission);
      // Success is handled by the isConfirmed effect above (clears cart,
      // redirects to /order-success) once orderResult/invoiceResult lands —
      // nothing further to do here.

      // Lucira Coins — best-effort debit, AFTER the sale (2026-09-08,
      // product decision). Deliberately NOT awaited into the try/catch
      // flow above and never re-thrown: this is a real POS sale that has
      // ALREADY completed by this point (placeOrder/placeInvoice already
      // succeeded) — a failure to debit Nector must never look like the
      // SALE failed, send the operator to /order-failed, or otherwise
      // touch what just happened. See redeemLoyaltyCoins's own header for
      // exactly why this is expected to fail until the lead-identifier gap
      // is resolved; failures are only logged, never surfaced to the
      // operator or the customer.
      if (hasCoinsApplied && customerMobile) {
        redeemLoyaltyCoins({
          mobile:      customerMobile,
          amount:      coinsRedeemed,
          title:       'POS Redemption',
          description: `Redeemed at checkout — ${documentType} for ${customerId ?? 'customer'}`,
        }).then((result) => {
          if (result.ok) {
            // Invalidate the cached balance (2026-09-08) — everywhere this
            // customer's Lucira Coins balance is shown (the customer
            // profile's Points tab, this same cart/checkout flow if
            // revisited) reads it via useNectorLoyaltyPoints, keyed on
            // mobile (QUERY_KEYS.NECTOR.LOYALTY). Without this, a real,
            // successful debit would still show the STALE pre-redemption
            // balance until that query's own staleTime happened to expire.
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NECTOR.LOYALTY(customerMobile) });
          } else {
            console.warn('[LucraCoins] best-effort debit did not succeed:', result.reason);
          }
        });
      }
    } catch (error) {
      // placeOrder/placeInvoice's own onError already toasted OrnaVerse's
      // specific reason and left the operator's cart/payment entries
      // exactly as they were (see useCreateOrder.js/useCreateInvoice.js) —
      // this is a DIFFERENT, more urgent case than a simple decline: the
      // terminal already took the money (the operator just confirmed
      // "Yes") but OUR OWN save then failed, so it gets its own dedicated
      // page rather than leaving the operator to notice/re-read the toast.
      const message = error?.serverMessage ?? error?.message ?? null;
      const query = message ? `&message=${encodeURIComponent(message)}` : '';
      router.push(`/order-failed?reason=error${query}`);
    }
  };

  // "No, payment declined" — nothing is ever submitted. No draft document
  // exists to cancel/roll back; the cart and any typed payment rows are
  // left exactly as they are so "Try Again" on the failed page can just
  // return to a fresh checkout attempt with the same basket.
  const handlePaymentDeclined = () => {
    tracker.track(EVENTS.PAYMENT_DECLINED, {
      documentType,
      value: isOrderMode ? amountCollected : finalPayableTotal,
    });
    router.push('/order-failed?reason=declined');
  };

  // While isConfirmed is true, the effect above is already clearing the
  // cart and navigating to /order-success — this brief loading state is
  // only what's on screen for the one render in between, never a
  // destination of its own.
  if (isConfirmed) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
      </div>
    );
  }

  // ── Checkout form ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-32 p-4 md:p-6">
      <p className="text-sm text-muted-foreground -mb-2">Review your order and complete the payment</p>

      <div className='grid grid-cols-1 items-start gap-5 lg:grid-cols-2'>
        <div className="flex flex-col gap-5 w-full">
          <CheckoutCustomerSummary />

          {/* Mandatory PAN once the sale crosses the statutory threshold.
              Judged on the PRICED payable — against the cart's catalog
              estimate a sale worth well over the threshold could read as
              under it, and the PAN would never be asked for. */}
          {/* key={customerId} (SEC fix 2026-09-04): CheckoutPanCapture keeps
              its own local state (value being typed, justSavedPan, the
              attached file) — none of that is customer-scoped by anything
              other than this key. Without it, switching customers mid-
              checkout (CustomerSessionSheet's header control works from any
              page, checkout included, and no longer prompts before
              switching — see that component's own header comment) left the
              OUTGOING customer's just-saved PAN sitting in state, and the
              component showed it as "PAN on file" for the newly-attached
              customer — a real cross-customer PAN leak on a compliance-
              mandated field, confirmed in an earlier security review. A key
              change forces React to unmount/remount with fresh state
              instead of reusing the instance across customers. */}
          <CheckoutPanCapture key={customerId} totalAmount={payableTotal} onPanResolved={setPanNumber} />

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

          {/* Promo code / discount OR Lucira Coins — tabbed (2026-09-08),
              never both stacked (see DiscountOrCoinsSection's own header):
              the two are mutually exclusive, so showing both at once was
              redundant. DiscountSection is self-contained (2026-08-26) —
              fetches its own pricing via useCheckoutPricing rather than
              taking it as props, since it's no longer checkout-exclusive
              (see that component's header). */}
          <DiscountOrCoinsSection payableTotal={payableTotal} isPricing={isPricing} />
        </div>
        <div className="flex flex-col gap-5 w-full">
          {/* Order items — same CartItemRow used on the Cart page, read-only
              here except for removal: quantity still can't be edited from
              checkout, but a wrongly-picked line can be dropped without
              abandoning checkout and going back to the cart. Removing
              re-keys useCheckoutPricing's query (see cartKey there), so the
              remaining lines re-price automatically. */}
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
                  onRemove={removeItem}
                  // What this line is really being sold at. The cart's own
                  // figure is the item master's nominal spec; an invoice
                  // bills a physical piece whose actual weight sets the
                  // price. See CartItemRow for the worked example.
                  priced={pricedByCartIndex.get(index) ?? null}
                  // Full price breakup requested on checkout's Order Items
                  // too (2026-08-26) — mini cart drawer deliberately excluded.
                  showPriceBreakdown
                />
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-bold text-foreground mb-1">Order Summary</h2>
            {/* Driven by the priced stock pieces, so this reads the same
                figure as the Place Order button and the amount collected. */}
            <CartSummary totals={pricedTotals} isPricing={isPricing} coinsRedeemed={coinsRedeemed} />
          </section>

          {/* Payment modes + invoice helper balances.
              key={customerId} (SEC fix 2026-09-04, same class as
              CheckoutPanCapture above): `payments` here can include applied
              invoice-helper balances (Scheme, Exchange Credit, Old Gold,
              Advances) sourced from useInvoiceHelpers({ partyId: customerId
              }) — each row carries a creditRef back to that SPECIFIC
              customer's balance. Without a remount, switching customers
              mid-checkout left a previously-applied balance sitting in
              state and still counted toward the total for the NEWLY
              attached customer — misapplying one customer's credit/exchange
              balance to another's invoice. The key forces a fresh mount
              (empty payments, re-synced to the parent via this component's
              own onChange effect) for every customer. */}
          {/* finalPayableTotal, not amountDue (2026-09-08) — the amount
              actually collected here is post-coins, same as it was already
              post-promo (amountDue itself is server-priced, post-promo). */}
          <CheckoutPaymentSection
            key={customerId}
            onChange={setPayments}
            amountDue={finalPayableTotal}
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

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card p-4 sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div className="max-w-6xl mx-auto w-full flex flex-col items-center gap-2">
          <PlaceOrderButton
            isValid={isValid}
            isPlacingOrder={isSubmitting}
            onPlaceOrder={handlePlaceOrderClick}
            amountDue={finalPayableTotal}
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

      {/* Payment-confirmation gate (2026-09-07) — see this file's header
          comment. Only "Yes" actually calls placeOrder/placeInvoice;
          dismissing via backdrop/Escape just closes this and leaves the
          operator back on the form (ConfirmDialog only fires onCancel for
          an explicit "No" click, never for a plain dismiss). */}
      <ConfirmDialog
        isOpen={isPaymentConfirmOpen}
        onOpenChange={setIsPaymentConfirmOpen}
        title="Confirm payment on terminal"
        description={
          isOrderMode
            ? `Has the advance of ${money(amountCollected)} been completed on the payment terminal? Confirming will place the order — declining will not save anything.`
            : `Has the payment of ${money(finalPayableTotal)} been completed on the payment terminal? Confirming will generate the invoice — declining will not save anything.`
        }
        confirmLabel="Yes, Payment Received"
        cancelLabel="No, Declined"
        confirmVariant="default"
        onConfirm={handlePaymentConfirmed}
        onCancel={handlePaymentDeclined}
      />

    </div>
  );
}

export default function CheckoutPage() {
  return <CheckoutScreen />;
}