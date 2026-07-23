'use client';

// src/components/shared/CustomerAttachedBanner/index.jsx
//
// The "customer attached / not attached" banner shown at the top of every
// transaction-family form (repair, estimation, returns, exchange, buyback,
// urd-purchase, schemes/enroll, transactions) — was copy-pasted verbatim
// in each, hardcoding emerald-200/amber-200 instead of the app's own
// status-in-stock/status-made-order tokens.

export default function CustomerAttachedBanner({
  customerId,
  customerName,
  attachedLabel = 'Customer:',
  emptyMessage = 'Attach a customer from the header before submitting.',
}) {
  return (
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
        <p className="text-status-made-order">⚠ {emptyMessage}</p>
      )}
    </div>
  );
}
