'use client';

// src/components/shared/CustomerAttachedBanner/index.jsx
//
// The "customer attached / not attached" banner shown at the top of every
// transaction-family form (repair, estimation, returns, exchange, buyback,
// urd-purchase, schemes/enroll, transactions) — was copy-pasted verbatim
// in each, hardcoding emerald-200/amber-200 instead of the app's own
// status-in-stock/status-made-order tokens.
//
// Empty state is clickable — opens the same CustomerSessionSheet the
// header's "Add Customer" control opens, so the associate doesn't have to
// go find the header button. Same pattern as CheckoutCustomerSummary's
// "Attach" prompt: a local sheet instance reading/writing the one shared
// useCustomerSession source of truth, not a second copy of the state.
//
// Portal to document.body rather than rendering CustomerSessionSheet inline:
// every page that uses this banner (repair/estimation/transactions/
// schemes-enroll) wraps its whole body in a react-hook-form <form>, and
// CustomerSessionSheet's search step (CustomerLookupInput) renders its own
// <form> — nested inline, that's invalid HTML and React 19 logs a hydration
// error. `mounted` starts false so the portal branch renders nothing on the
// server/first client pass (matching SSR output) and only reaches for
// document after the post-hydration effect runs — the same guard shape as
// ProductImageZoomModal's portal.

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import CustomerSessionSheet from '@/components/features/customers/CustomerSessionSheet';

export default function CustomerAttachedBanner({
  customerId,
  customerName,
  attachedLabel = 'Customer:',
  emptyMessage = 'Attach a customer from the header before submitting.',
}) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <>
      <div
        className={`rounded-xl border p-3 text-sm ${
          customerId
            ? 'border-status-in-stock/30 bg-status-in-stock/10'
            : 'border-status-made-order/30 bg-status-made-order/10'
        }`}
      >
        {customerId ? (
          <p className="text-status-in-stock">
            {attachedLabel} <strong>{customerName}</strong>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setIsSheetOpen(true)}
            className="w-full text-left text-status-made-order underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-sm"
          >
            ⚠ {emptyMessage}
          </button>
        )}
      </div>

      {mounted && createPortal(
        <CustomerSessionSheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
        />,
        document.body,
      )}
    </>
  );
}
