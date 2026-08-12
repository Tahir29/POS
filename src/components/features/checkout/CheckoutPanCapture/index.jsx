'use client';

// src/components/features/checkout/CheckoutPanCapture/index.jsx
// Mandatory PAN capture once the order total crosses the statutory
// ₹2,00,000 threshold (Income Tax Rule 114B — not a store policy, see
// APP_CONFIG.COMPLIANCE). The customer's latest record may already carry a
// PAN from a past visit; if not, staff must enter and SAVE one here.
//
// Place Order stays gated on the SAVED value (via onPanResolved), not just
// a locally-typed one — an unsaved PAN doesn't actually satisfy the
// requirement, since nothing durable was recorded against the customer.
// Reusing useRetrieveCustomer/useUpdateCustomer (the same pair the customer
// Edit tab uses) means the "on file" state updates itself for free once the
// save succeeds and its query invalidation refetches the customer.

import { useEffect, useState } from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useRetrieveCustomer } from '@/hooks/customer/useRetrieveCustomer';
import { useUpdateCustomer } from '@/hooks/customer/useUpdateCustomer';
import { PAN_REGEX } from '@/validators/customerSchema';
import APP_CONFIG from '@/constants/appConfig';

/**
 * @param {{
 *   totalAmount: number,
 *   onPanResolved: (pan: string|null) => void,
 * }} props
 */
export default function CheckoutPanCapture({ totalAmount, onPanResolved }) {
  const { customerId, isAttached } = useCustomerSession();
  const panRequired = totalAmount > APP_CONFIG.COMPLIANCE.PAN_MANDATORY_THRESHOLD;

  const { customer, isLoading } = useRetrieveCustomer(customerId, {
    enabled: isAttached && panRequired,
  });
  const updateCustomer = useUpdateCustomer();

  const [value, setValue] = useState('');

  const panOnFile = customer?.customerPan ?? null;

  // Report the resolved PAN (or null) up to the checkout page's validation
  // every time it changes — including back to null if the threshold no
  // longer applies (e.g. a promo or removed item drops the total back down).
  useEffect(() => {
    onPanResolved(panRequired ? panOnFile : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panRequired, panOnFile]);

  if (!isAttached || !panRequired) return null;

  if (panOnFile) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold text-foreground mb-2">
          PAN Details <span className="text-destructive">*</span>
        </h2>
        <p className="flex items-center gap-1.5 text-sm text-status-in-stock">
          <CheckCircle2 size={15} className="shrink-0" aria-hidden="true" />
          PAN on file: <span className="font-mono font-semibold">{panOnFile}</span>
        </p>
      </section>
    );
  }

  const isValid = PAN_REGEX.test(value);

  const handleSave = () => {
    if (!isValid || !customer?.raw) return;
    updateCustomer.mutate({
      partyId: customerId,
      originalRaw: customer.raw,
      formChanges: { pan_no: value, party_name: customer.customerName },
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-bold text-foreground mb-1">
        PAN Details <span className="text-destructive">*</span>
      </h2>
      <p className="flex items-center gap-1.5 text-xs text-status-made-order mb-3">
        <ShieldAlert size={13} className="shrink-0" aria-hidden="true" />
        PAN is mandatory for orders above ₹{APP_CONFIG.COMPLIANCE.PAN_MANDATORY_THRESHOLD.toLocaleString('en-IN')}
      </p>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            placeholder="ABCDE1234F"
            maxLength={10}
            disabled={isLoading || updateCustomer.isPending}
            aria-label="Customer PAN"
            className="h-11 uppercase"
          />
          {value.length > 0 && !isValid && (
            <p className="mt-1 text-xs text-destructive">Enter a valid PAN (e.g. ABCDE1234F)</p>
          )}
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!isValid || isLoading || updateCustomer.isPending}
          className="h-11 shrink-0"
        >
          {updateCustomer.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </section>
  );
}
