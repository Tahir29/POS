'use client';

// src/components/features/orders/OrderDetailSheet/index.jsx

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

import BottomSheet from '@/components/shared/BottomSheet';
import PrintInvoiceButton from '@/components/features/checkout/PrintInvoiceButton';
import Logo from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { useCancelOrder } from '@/hooks/orders/useCancelOrder';

// ── Helpers ───────────────────────────────────────────────────
function Row({ label, value, bold, border }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={`flex justify-between ${border ? 'border-t border-stone-100 pt-2' : ''}`}>
      <span className="text-stone-500">{label}</span>
      <span className={bold ? 'font-bold text-stone-800' : 'font-medium text-stone-800'}>
        {value}
      </span>
    </div>
  );
}

function formatCurrency(amount) {
  return amount != null ? `₹${Number(amount).toLocaleString('en-IN')}` : null;
}

const STATUS_LABELS = {
  paid:    'Paid',
  partial: 'Partially Paid',
  due:     'Payment Due',
};

// ── Order content — all raw accesses use optional chaining ────
function OrderContent({ raw, status }) {
  if (!raw) return null;

  const lineItems = raw.line_items     ?? [];
  const payments  = raw.receipt_details ?? [];

  return (
    <div className="flex flex-col gap-2 text-sm">
      <Row label="Order No." value={raw.document_no} />
      <Row
        label="Date"
        value={raw.document_date
          ? new Date(raw.document_date).toLocaleDateString('en-IN')
          : null}
      />
      <Row label="Customer" value={raw.party_name} />
      <Row label="Mobile"   value={raw.mobile} />
      <Row label="Email"    value={raw.email} />
      <Row label="Store"    value={raw.company_name} />
      <Row label="Status"   value={STATUS_LABELS[status] ?? null} />

      {lineItems.length > 0 && (
        <div className="border-t border-stone-100 pt-2 flex flex-col gap-1.5">
          <span className="text-stone-500 text-xs font-medium uppercase tracking-wide">Items</span>
          {lineItems.map((item, i) => (
            <div key={item.transaction_item_id ?? i} className="flex justify-between gap-2">
              <div className="min-w-0">
                <p className="text-stone-700 truncate">{item.item_name}</p>
                {item.item_code && (
                  <p className="text-xs text-stone-400 truncate">{item.item_code}</p>
                )}
              </div>
              <span className="font-medium text-stone-800 shrink-0">
                {formatCurrency(item.gross_amount ?? item.net_amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <Row label="Subtotal"   value={formatCurrency(raw.net_amount)} border />
      <Row label="Discount"   value={raw.discount ? `– ${formatCurrency(raw.discount)}` : null} />
      <Row label="Tax"        value={formatCurrency(raw.tax_amount)} />
      <Row label="Total"      value={formatCurrency(raw.gross_amount)} bold border />
      <Row label="Received"   value={formatCurrency(raw.receipt_amount)} />
      <Row
        label="Balance Due"
        value={(raw.balance_amount ?? 0) > 0 ? formatCurrency(raw.balance_amount) : null}
      />

      {payments.length > 0 && (
        <div className="border-t border-stone-100 pt-2 flex flex-col gap-1.5">
          <span className="text-stone-500 text-xs font-medium uppercase tracking-wide">Payments</span>
          {payments.map((p, i) => (
            <div key={p.receipt_id ?? i} className="flex justify-between gap-2">
              <span className="text-stone-700">{p.mode_name}</span>
              <span className="font-medium text-stone-800">{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Cancel confirmation inline banner ─────────────────────────
function CancelConfirmBanner({ onConfirm, onDismiss, isPending }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="shrink-0 text-destructive mt-0.5" />
        <p className="text-sm text-destructive font-medium">
          Cancel this order? This cannot be undone.
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          className="flex-1"
          disabled={isPending}
          onClick={onConfirm}
        >
          {isPending ? 'Cancelling…' : 'Yes, Cancel Order'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={isPending}
          onClick={onDismiss}
        >
          Keep Order
        </Button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function OrderDetailSheet({ order, isOpen, onClose }) {
  const raw = order?.raw ?? null;
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const cancelOrderMutation = useCancelOrder();

  const handleClose = () => {
    setShowCancelConfirm(false);
    onClose();
  };

  // Only show cancel for orders with an outstanding balance
  const isCancellable = !!(raw && (raw.balance_amount ?? 0) > 0 && raw.transaction_id);

  const handleConfirmCancel = async () => {
    if (!raw?.transaction_id) return;
    await cancelOrderMutation.mutateAsync(raw.transaction_id);
    setShowCancelConfirm(false);
    handleClose();
  };

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={handleClose} title="Order">
        {raw ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <OrderContent raw={raw} status={order?.status} />
            </div>

            <PrintInvoiceButton />

            {isCancellable && !showCancelConfirm && (
              <Button
                variant="outline"
                className="w-full border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                onClick={() => setShowCancelConfirm(true)}
              >
                Cancel Order
              </Button>
            )}

            {isCancellable && showCancelConfirm && (
              <CancelConfirmBanner
                onConfirm={handleConfirmCancel}
                onDismiss={() => setShowCancelConfirm(false)}
                isPending={cancelOrderMutation.isPending}
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-stone-500 text-center py-4">
            Order details unavailable.
          </p>
        )}
      </BottomSheet>

      {/* Print portal — only render when raw exists AND we're in the browser */}
      {raw && typeof document !== 'undefined' && createPortal(
        <div id="invoice-print-area" className="hidden print:block p-6 bg-white">
          <div className="flex justify-center items-center py-8 mb-8 border-b border-stone-100">
            <Logo variant="full" color="brown" width={140} height={44} />
          </div>
          <OrderContent raw={raw} status={order?.status} />
        </div>,
        document.body
      )}
    </>
  );
}