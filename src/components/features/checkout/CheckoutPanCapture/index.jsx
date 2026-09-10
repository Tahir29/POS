'use client';

// Mandatory PAN capture once the order total crosses the statutory
// ₹2,00,000 threshold (Income Tax Rule 114B — see APP_CONFIG.COMPLIANCE).
//
// Only the PAN NUMBER is ever saved to OrnaVerse and gates Place Order
// (checkoutSchema.js). The document attach below is local-only, for the
// operator's own reference — OrnaVerse has no working way to persist a
// PAN document (Customer/Update 500s on any non-empty pan_document, and
// there's no dedicated upload endpoint), so it is never sent anywhere.
//
// Reuses useRetrieveCustomer/useUpdateCustomer (same pair as the customer
// Edit tab) so the "on file" state refreshes for free after a save.

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShieldAlert, Paperclip, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useRetrieveCustomer } from '@/hooks/customer/useRetrieveCustomer';
import { useUpdateCustomer } from '@/hooks/customer/useUpdateCustomer';
import { PAN_REGEX } from '@/validators/customerSchema';
import APP_CONFIG from '@/constants/appConfig';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — local-only, no upload call to size against
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

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
  const [fileError, setFileError] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null); // { name } — local-only, never sent
  const fileInputRef = useRef(null);
  // Set the instant a Save succeeds this session — OrnaVerse masks pan_no
  // on every read (see below), so the refetch can never confirm it.
  const [justSavedPan, setJustSavedPan] = useState(null);

  // OrnaVerse's Party/Retrieve masks any saved PAN as "**********" rather
  // than returning the real number. A masked value is truthy but fails
  // PAN_REGEX, so gate on PAN_REGEX rather than truthiness — otherwise a
  // returning customer's masked PAN reads as "on file" while checkoutSchema
  // still silently rejects it and blocks Place Order.
  const rawPanOnFile = customer?.customerPan ?? null;
  const fetchedPanOnFile = rawPanOnFile && PAN_REGEX.test(rawPanOnFile) ? rawPanOnFile : null;

  // The mask above applies unconditionally, including immediately after a
  // successful save — so fall back to the value handleSave already
  // confirmed valid and the server accepted, rather than waiting on a
  // refetch that can never pass PAN_REGEX.
  const panOnFile = fetchedPanOnFile ?? justSavedPan;

  // Resolved on the number alone — see header note on the document.
  // Only ever reports a saved value (fetched or just-saved), never the
  // still-being-typed one.
  useEffect(() => {
    onPanResolved(panRequired ? panOnFile : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panRequired, panOnFile]);

  if (!isAttached || !panRequired) return null;

  const isValid = PAN_REGEX.test(value);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file after an error
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError('Use a JPG, PNG, or PDF file.');
      setAttachedFile(null);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError('File is too large — max 5MB.');
      setAttachedFile(null);
      return;
    }
    setFileError(null);
    setAttachedFile({ name: file.name });
  };

  const handleSave = () => {
    if (!isValid || !customer?.raw) return;
    const savedValue = value;
    updateCustomer.mutate({
      partyId: customerId,
      originalRaw: customer.raw,
      formChanges: { pan_no: savedValue, party_name: customer.customerName },
    }, {
      // Confirms THIS transaction's PAN immediately — see panOnFile's
      // comment above on why the refetch alone can never do this.
      onSuccess: () => setJustSavedPan(savedValue),
    });
  };

  // Rendered in both the "on file" and entry-form branches below — see
  // header note: this is local-only and never persisted or sent anywhere.
  const documentBlock = (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
        aria-label="PAN card or document (for your reference only)"
      />
      {attachedFile ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2">
          <span className="flex items-center gap-1.5 text-sm text-foreground truncate">
            <Paperclip size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{attachedFile.name}</span>
          </span>
          <button
            type="button"
            onClick={() => setAttachedFile(null)}
            aria-label="Remove attached file"
            className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={15} />
          Attach PAN card / document
        </Button>
      )}
      {fileError && <p className="mt-1 text-xs text-destructive">{fileError}</p>}
    </div>
  );

  if (panOnFile) {
    return (
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-bold text-foreground mb-2">
          PAN Details <span className="text-destructive">*</span>
        </h2>
        <p className="flex items-center gap-1.5 text-sm text-status-in-stock mb-3">
          <CheckCircle2 size={15} className="shrink-0" aria-hidden="true" />
          PAN on file: <span className="font-mono font-semibold">{panOnFile}</span>
        </p>
        {documentBlock}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-bold text-foreground mb-1">
        PAN Details <span className="text-destructive">*</span>
      </h2>
      <p className="flex items-center gap-1.5 text-xs text-status-made-order mb-3">
        <ShieldAlert size={13} className="shrink-0" aria-hidden="true" />
        PAN is mandatory for orders above ₹{APP_CONFIG.COMPLIANCE.PAN_MANDATORY_THRESHOLD.toLocaleString('en-IN')}
      </p>

      <div className="flex flex-col gap-3">
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
        {documentBlock}
      </div>
    </section>
  );
}
