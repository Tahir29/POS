'use client';

// src/components/features/checkout/CheckoutCustomerSummary/index.jsx
// Read-only customer summary for the checkout screen. Reads
// useCustomerSession (single source of truth, shared with
// HeaderCustomerControl / CartCustomerTag). "Change" reopens
// CustomerSessionSheet. If no customer is attached, prompts the
// associate to attach one before order submission.

import { useState } from 'react';
import { AlertCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CustomerDisplayCard from '@/components/features/customers/CustomerDisplayCard';
import CustomerSessionSheet from '@/components/features/customers/CustomerSessionSheet';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';

export default function CheckoutCustomerSummary() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { customerId, customerName, customerMobile, isAttached } = useCustomerSession();

  const customer = isAttached
    ? { customerId, customerName, customerMobile }
    : null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-stone-800">Customer</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsSheetOpen(true)}
          className="text-primary"
        >
          {isAttached ? 'Change' : 'Attach'}
        </Button>
      </div>

      {isAttached ? (
        <CustomerDisplayCard customer={customer} />
      ) : (
        <button
          type="button"
          onClick={() => setIsSheetOpen(true)}
          className="flex items-center gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-3 text-left min-h-[44px]"
        >
          <AlertCircle size={18} className="text-amber-600 shrink-0" aria-hidden="true" />
          <span className="text-sm text-amber-700">
            No customer attached. Tap to attach a customer before placing the order.
          </span>
        </button>
      )}

      <CustomerSessionSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      />
    </section>
  );
}