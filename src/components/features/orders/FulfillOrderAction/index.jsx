'use client';

// src/components/features/orders/FulfillOrderAction/index.jsx
// "Fulfill from order" entry point, added to OrderDetailSheet — checks
// whether any of THIS order's lines have cleared OrnaVerse's own
// stock-allocation check, and if so, loads them into a fresh Invoice cart.
//
// See the header comment on API.ORDER_FULFILLMENT (apiEndpoints.js) and
// orderFulfillmentService.js for the full contract: what's confirmed live,
// and what remains unverified (the actual Invoice/Create round trip for a
// genuine fulfillment case — every real candidate found on UAT hit the same
// "Ready To Invoice" inconsistency their own system has between its two
// list endpoints).
//
// "Not ready yet" is the NORMAL case, not an error — moving a line from
// New to Ready happens entirely in OrnaVerse's ERP admin (Inventory →
// Order Fulfilment: a warehouse/manufacturing pipeline with its own tools —
// Work Order, Purchase Order, Allocate Stock, Shipment), never at the sales
// counter. This component can only check and load; it can't make a line
// ready.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useOrderFulfillment } from '@/hooks/checkout/useOrderFulfillment';
import { useCart } from '@/hooks/cart/useCart';

/**
 * @param {{ raw: object }} props — the order's raw OrderRow (order.raw from
 *   OrderDetailSheet — party_id, party_name, mobile, document_no,
 *   transaction_id all confirmed present).
 */
export default function FulfillOrderAction({ raw }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const cart = useCart();

  const { readyLines, allOpenLines, isLoadingReady, isLoadingAll } = useOrderFulfillment({
    partyId: raw?.party_id,
    enabled: checked,
  });

  if (!raw?.transaction_id || !raw?.party_id) return null;

  // Scope the party-wide ready/all-open lists down to THIS order — matches
  // Ornaverse's own copy ("Select one or more lines from the same order"),
  // just pre-filtered since this button lives on one specific order already.
  const thisOrderReady = readyLines.filter((l) => l.document_no === raw.document_no);
  const thisOrderStatus = allOpenLines.find((l) => l.document_no === raw.document_no);

  const isLoading = isLoadingReady || isLoadingAll;

  const doLoad = () => {
    cart.loadFromOrder({
      order: {
        partyId:       raw.party_id,
        partyName:     raw.party_name,
        mobile:        raw.mobile,
        transactionId: raw.transaction_id,
        documentNo:    raw.document_no,
      },
      lines: thisOrderReady,
    });
    router.push('/checkout');
  };

  const handleLoadClick = () => {
    // Loading wholesale-replaces the cart (cartSlice.hydrateFromOrder) —
    // warn before discarding an in-progress cart for someone else, same
    // guard pattern CustomerSessionSheet uses for a customer switch.
    if (!cart.isEmpty && cart.customerId && cart.customerId !== raw.party_id) {
      setShowSwitchConfirm(true);
      return;
    }
    doLoad();
  };

  return (
    <>
      {!checked ? (
        <Button variant="outline" className="w-full gap-2" onClick={() => setChecked(true)}>
          <PackageCheck size={16} aria-hidden="true" />
          Fulfill from Order
        </Button>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Checking fulfillment status…
        </div>
      ) : thisOrderReady.length > 0 ? (
        <Button variant="premium" className="w-full gap-2" onClick={handleLoadClick}>
          <PackageCheck size={16} aria-hidden="true" />
          Load {thisOrderReady.length} item{thisOrderReady.length > 1 ? 's' : ''} to Invoice
        </Button>
      ) : (
        <p className="rounded-lg border border-border bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          Not ready to invoice yet
          {thisOrderStatus?.reason_status_description
            ? ` (status: ${thisOrderStatus.reason_status_description})`
            : ''}
          . This moves through OrnaVerse&apos;s own fulfillment pipeline —
          check back once it clears there.
        </p>
      )}

      <ConfirmDialog
        isOpen={showSwitchConfirm}
        onOpenChange={setShowSwitchConfirm}
        title="Replace current cart?"
        description={`Loading this order will clear your current cart and attach ${raw.party_name ?? 'this order\'s customer'} instead.`}
        confirmLabel="Load Order"
        cancelLabel="Keep Current Cart"
        confirmVariant="default"
        onConfirm={() => { setShowSwitchConfirm(false); doLoad(); }}
        onCancel={() => setShowSwitchConfirm(false)}
      />
    </>
  );
}
