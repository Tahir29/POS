'use client';

// src/components/features/checkout/CheckoutPanCapture/index.jsx
// Mandatory PAN capture once the order total crosses the statutory
// ₹2,00,000 threshold (Income Tax Rule 114B — not a store policy, see
// APP_CONFIG.COMPLIANCE). The customer's latest record may already carry a
// PAN from a past visit; if not, staff must enter and SAVE one here.
//
// OrnaVerse's own Create validation wants BOTH a PAN number AND a document
// on file ("Please upload PAN & its number", confirmed live 2026-08-14) —
// but the document half is a genuine SERVER-SIDE BLOCKER, not a missing
// client feature. Isolated by testing Customer/Update directly against UAT
// with a real customer (party_id 1215, reverted after):
//   - pan_no alone updates fine (200).
//   - pan_document = '' (empty string) updates fine (200).
//   - pan_document = ANY non-empty value — a short plain filename, a
//     base64 blob, doesn't matter — returns a generic 500 "Exception".
// There is also no dedicated document-upload endpoint anywhere in the
// 4,091-endpoint API (only Master/ItemImageUpload, which is item-specific
// and requires item_id/item_code) — so there is currently NO call shape
// that persists a PAN document to OrnaVerse. Same class of bug as
// dailyClosingService.js's own 500; flag to OrnaVerse's team with the
// repro above rather than re-guessing encodings here.
//
// Given that, this component:
//   - saves the PAN NUMBER for real (that part works and gates Place Order,
//     same as before this fix — gating on the document too would make
//     checkout above the threshold permanently impossible, which is worse
//     than today's honest "may still be rejected at submit").
//   - lets staff attach the file so they have it in hand at the counter,
//     clearly labeled as NOT saved to OrnaVerse — a local-only aid, not a
//     silent fake success.
//
// Reusing useRetrieveCustomer/useUpdateCustomer (the same pair the customer
// Edit tab uses) means the "on file" state updates itself for free once the
// number save succeeds and its query invalidation refetches the customer.

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShieldAlert, Paperclip, X, AlertTriangle } from 'lucide-react';
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

  const panOnFile = customer?.customerPan ?? null;

  // Resolved on the NUMBER alone — see header note on why the document
  // can't be part of this gate today. onPanResolved still only ever
  // reports a SAVED value, never the locally-typed one.
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
    updateCustomer.mutate({
      partyId: customerId,
      originalRaw: customer.raw,
      formChanges: { pan_no: value, party_name: customer.customerName },
    });
  };

  // Document attach — same small block whether the number is already on
  // file or still being entered, since OrnaVerse can't take it either way.
  const documentBlock = (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
        aria-label="PAN card or document (kept for your reference only)"
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
      <p className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground">
        <AlertTriangle size={13} className="shrink-0 mt-0.5 text-status-made-order" aria-hidden="true" />
        Kept on this screen for your reference only — OrnaVerse&apos;s document
        upload is down server-side right now, so this file is not saved to
        the customer record. Follow your store&apos;s manual process for filing
        it until that&apos;s fixed.
      </p>
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
