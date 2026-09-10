'use client';

// "Customer attached / not attached" banner shown at the top of every
// transaction-family form (repair, estimation, returns, exchange, buyback,
// urd-purchase, schemes/enroll, transactions). Empty state opens the same
// CustomerSessionSheet as the header's "Add Customer" control, reading/
// writing the shared useCustomerSession source of truth.
//
// Rendered via a portal to document.body rather than inline: these pages
// wrap their body in a react-hook-form <form>, and CustomerSessionSheet's
// search step renders its own nested <form> — invalid HTML that triggers a
// React 19 hydration error if not portaled out. `mounted` (useHasMounted)
// stays false through the server/first client pass to match SSR output.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import CustomerSessionSheet from '@/components/features/customers/CustomerSessionSheet';
import { useHasMounted } from '@/hooks/ui/useHasMounted';

export default function CustomerAttachedBanner({
  customerId,
  customerName,
  attachedLabel = 'Customer:',
  emptyMessage = 'Assign a customer from the header before submitting.',
}) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const mounted = useHasMounted();

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
