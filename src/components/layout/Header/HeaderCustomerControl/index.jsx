'use client';

// Header-level "Customer" control — shows attached customer or
// "Add Customer" prompt, opens CustomerSessionSheet.
// Available on every POS screen, independent of cart/checkout.
//
// Attached state restyled as a pill (initials avatar + name + mobile +
// detach) to match the new dashboard header design. Reuses the existing
// --status-in-stock green token rather than introducing a new color.
// Unattached state is unchanged from the original ghost-button treatment.

import { useState } from 'react';
import { useSelector } from 'react-redux';
import { UserPlus, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import CustomerSessionSheet from '@/components/features/customers/CustomerSessionSheet';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { selectCheckoutInProgress } from '@/store/slices/uiSlice';
import { cn } from '@/lib/utils';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function HeaderCustomerControl() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { isAttached, customerName, customerMobile, detach } = useCustomerSession();
  // FIXED 2026-09-09 — CONFIRMED real risk: this control is reachable from
  // every screen, checkout included, with no guard of its own. Detaching or
  // switching customers while a payment confirmation is in flight
  // (checkout/page.jsx's handlePaymentConfirmed) could redirect checkout
  // away before it ever saw the sale complete — the sale still goes
  // through server-side, but the operator never gets the confirmation
  // screen and could re-submit, risking a duplicate charge. See
  // uiSlice.js's setCheckoutInProgress for the full mechanism.
  const checkoutInProgress = useSelector(selectCheckoutInProgress);

  const guardedSheetOpen = () => {
    if (checkoutInProgress) {
      toast.error('A sale is being processed — please wait for it to finish before switching customers.');
      return;
    }
    setSheetOpen(true);
  };

  const guardedDetach = () => {
    if (checkoutInProgress) {
      toast.error('A sale is being processed — please wait for it to finish before removing this customer.');
      return;
    }
    detach();
  };

  if (!isAttached) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          onClick={guardedSheetOpen}
          // rounded-full removed 2026-08-23 — was overriding the base
          // Button's own corner radius with a pill shape; every other
          // rectangular control in the app was flattened to the small
          // brand-consistent radius (see globals.css's --radius scale
          // comment), and this button isn't a circle/pill by function the
          // way an avatar or icon-only button is, so it shouldn't look like
          // one either. Falls back to the Button component's default.
          className="flex items-center gap-2 min-h-[44px] px-4"
          aria-label="Add customer"
        >
          <UserPlus size={16} aria-hidden="true" />
          <span className="hidden md:inline text-sm font-medium">Add Customer</span>
        </Button>

        <CustomerSessionSheet
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          // Pill shape removed 2026-08-23 — this chip and the inner name
          // button below both keep only the avatar (a genuine circle) and
          // the detach "X" (a genuine icon-only circular button) rounded;
          // the chip itself is a rectangular container, same treatment as
          // every other card/panel in the app now.
          'flex items-center gap-2 rounded-sm pl-1.5 pr-2 py-1.5 min-h-[40px]',
          'border border-status-in-stock/20 bg-status-in-stock/10'
        )}
      >
        <button
          type="button"
          onClick={guardedSheetOpen}
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          aria-label={`Customer: ${customerName}. Tap to view details.`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-status-in-stock text-[10px] font-bold text-white">
            {getInitials(customerName)}
          </span>
          <span className="hidden sm:flex items-center gap-1 text-sm font-medium text-status-in-stock">
            <span className="truncate max-w-[120px]">{customerName}</span>
            {customerMobile && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{customerMobile}</span>
              </>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={guardedDetach}
          aria-label={`Remove customer ${customerName}`}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-status-in-stock/70 hover:bg-status-in-stock/20 hover:text-status-in-stock focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>

      <CustomerSessionSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
