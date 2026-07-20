'use client';

// src/components/features/checkout/CheckoutPaymentSection/index.jsx
// Payment section at checkout — shows available customer balances first,
// then standard payment mode selection with split payment support.
//
// RESTYLED: balance rows now use a toggle switch (matching the design)
// instead of an "Apply" pill button — same underlying apply/un-apply
// logic, just a different control. Added a "Balances applied / Collected
// / Paid in full" summary line at the bottom, matching the design.
//
// INVOICE HELPERS (unchanged data source):
//   Scheme, Exchange, Credit Note, Old Gold, Advances
//
// STANDARD PAYMENT MODES:
//   Cash, Card, UPI, etc. — from PaymentReceiptMode/List, unchanged.

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { usePaymentModes } from '@/hooks/checkout/usePaymentModes';
import { useInvoiceHelpers } from '@/hooks/checkout/useInvoiceHelpers';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useSelector } from 'react-redux';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import PaymentModeSelector from '../PaymentModeSelector';
import PaymentAmountInput from '../PaymentAmountInput';
import APP_CONFIG from '@/constants/appConfig';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

// ── Invoice Helper Balance Row — toggle switch style ─────────────────────────

function HelperBalanceRow({ label, amount, modeCode, isApplied, onToggle, isLoading }) {
  if (isLoading) return null;
  if (!amount || amount <= 0) return null;

  return (
    <button
      type="button"
      onClick={() => onToggle({ modeCode, label, amount })}
      role="switch"
      aria-checked={isApplied}
      className={`
        flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left
        transition-colors
        ${isApplied ? 'border-primary/40 bg-primary/5' : 'border-stone-100 bg-stone-50'}
      `}
    >
      <div>
        <p className="text-xs font-medium text-stone-700">{label}</p>
        <p className="text-sm font-semibold text-primary mt-0.5">
          {APP_CONFIG.CURRENCY.INR_SYMBOL}{Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </p>
      </div>
      <Switch checked={isApplied} className="pointer-events-none" tabIndex={-1} aria-hidden="true" />
    </button>
  );
}

// ── CheckoutPaymentSection ────────────────────────────────────────────────────
export default function CheckoutPaymentSection({ onChange }) {
  const { total } = useCartTotals();
  const { paymentModes, isLoading: modesLoading, isError: modesError } = usePaymentModes();
  const { customerId } = useCustomerSession();
  const activeStoreId  = useSelector(selectActiveStoreId);

  const helpers = useInvoiceHelpers({
    partyId:   customerId,
    companyId: activeStoreId,
  });

  // payments: { modeId?, modeCode, modeName, amount (string), isHelper? }[]
  const [payments, setPayments] = useState([]);

  const selectedModeIds    = payments.filter((p) => p.modeId).map((p) => p.modeId);
  const appliedHelperCodes = payments.filter((p) => p.isHelper).map((p) => p.modeCode);

  // ── Standard mode toggle ──────────────────────────────────────────────────
  const handleModeToggle = (modeId) => {
    setPayments((prev) => {
      const exists = prev.find((p) => p.modeId === modeId);
      if (exists) return prev.filter((p) => p.modeId !== modeId);

      const mode    = paymentModes.find((m) => m.modeId === modeId);
      const nonHelperPaid = prev.filter((p) => !p.isHelper)
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const helperPaid = prev.filter((p) => p.isHelper)
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const remaining = Math.max(0, total - helperPaid - nonHelperPaid);
      const isFirst   = prev.filter((p) => !p.isHelper).length === 0;

      tracker.track(EVENTS.PAYMENT_SELECTED, {
        modeId,
        modeCode: mode?.modeCode ?? null,
        modeName: mode?.modeName ?? null,
      });

      return [
        ...prev,
        {
          modeId,
          modeCode: mode?.modeCode ?? '',
          modeName: mode?.modeName ?? 'Unknown',
          amount:   isFirst ? String(remaining) : '',
          isHelper: false,
        },
      ];
    });
  };

  // ── Helper balance toggle ─────────────────────────────────────────────────
  const handleHelperToggle = ({ modeCode, label, amount }) => {
    setPayments((prev) => {
      const exists = prev.find((p) => p.isHelper && p.modeCode === modeCode);
      if (exists) return prev.filter((p) => !(p.isHelper && p.modeCode === modeCode));
      return [
        ...prev,
        {
          modeId:   null,
          modeCode,
          modeName: label,
          amount:   String(Math.min(amount, total)),
          isHelper: true,
        },
      ];
    });
  };

  const handleAmountChange = (identifier, value) => {
    setPayments((prev) =>
      prev.map((p) =>
        (p.modeId === identifier || p.modeCode === identifier)
          ? { ...p, amount: value }
          : p
      )
    );
  };

  // Recompute single-mode pre-fill when total changes
  useEffect(() => {
    setPayments((prev) => {
      const nonHelpers = prev.filter((p) => !p.isHelper);
      if (nonHelpers.length !== 1) return prev;
      const helperPaid = prev.filter((p) => p.isHelper)
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const remaining = Math.max(0, total - helperPaid);
      return prev.map((p) => (!p.isHelper ? { ...p, amount: String(remaining) } : p));
    });
  }, [total]);

  // Notify parent
  useEffect(() => {
    onChange?.(
      payments.map((p) => ({
        modeId:   p.modeId   ?? undefined,
        modeCode: p.modeCode ?? '',
        modeName: p.modeName,
        amount:   Number(p.amount) || 0,
      }))
    );
  }, [payments]);

  const balancesApplied = payments.filter((p) => p.isHelper)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const collectedByMode = payments.filter((p) => !p.isHelper);
  const paidTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Math.round((total - paidTotal) * 100) / 100;
  const isBalanced = payments.length > 0 && remaining === 0;

  const helperItems = [
    { label: 'Scheme Balance',  code: 'Scheme',      data: helpers.scheme,     loading: helpers.scheme?.isLoading },
    { label: 'Exchange Credit', code: 'Exchange',    data: helpers.exchange,   loading: helpers.exchange?.isLoading },
    { label: 'Credit Note',     code: 'CreditNote',  data: helpers.creditNote, loading: helpers.creditNote?.isLoading },
    { label: 'Old Gold Value',  code: 'OldGold',     data: helpers.oldGold,    loading: helpers.oldGold?.isLoading },
    { label: 'Advance Paid',    code: 'Advances',    data: helpers.advances,   loading: helpers.advances?.isLoading },
  ];

  const hasVisibleHelpers = customerId && helperItems.some((h) => h.data?.amount > 0);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold text-stone-800">Payment</h2>

      {/* Invoice Helper Balances — only shown when customer attached + has balance */}
      {customerId && (
        <div className="flex flex-col gap-2">
          {helpers.isLoading && (
            <div className="flex items-center gap-2 text-xs text-stone-400 py-1">
              <Loader2 size={12} className="animate-spin" />
              Checking available balances…
            </div>
          )}
          {!helpers.isLoading && hasVisibleHelpers && (
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Available Balances</p>
          )}
          {helperItems.map((h) => (
            <HelperBalanceRow
              key={h.code}
              label={h.label}
              amount={h.data?.amount}
              modeCode={h.code}
              isApplied={appliedHelperCodes.includes(h.code)}
              onToggle={handleHelperToggle}
              isLoading={h.loading}
            />
          ))}
          {balancesApplied > 0 && (
            <p className="text-xs text-primary font-medium">
              {APP_CONFIG.CURRENCY.INR_SYMBOL}{balancesApplied.toLocaleString('en-IN')} applied to this order
            </p>
          )}
        </div>
      )}

      {/* Divider if helpers are shown */}
      {hasVisibleHelpers && (
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <div className="h-px flex-1 bg-stone-100" />
          <span>or pay with</span>
          <div className="h-px flex-1 bg-stone-100" />
        </div>
      )}

      {/* Standard payment modes */}
      <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Payment Method</p>
      <PaymentModeSelector
        paymentModes={paymentModes}
        selectedModeIds={selectedModeIds}
        onToggle={handleModeToggle}
        isLoading={modesLoading}
        isError={modesError}
      />

      {/* Amount inputs */}
      {payments.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-stone-100">
          {payments.map((p) => (
            <PaymentAmountInput
              key={p.modeId ?? p.modeCode}
              modeName={p.modeName}
              amount={p.amount}
              onChange={(value) => handleAmountChange(p.modeId ?? p.modeCode, value)}
            />
          ))}

          {/* Balances applied / Collected / Paid in full summary */}
          <div className="flex flex-col gap-1 text-sm pt-2 border-t border-stone-100">
            {balancesApplied > 0 && (
              <div className="flex items-center justify-between text-stone-500">
                <span>Balances applied</span>
                <span>−{APP_CONFIG.CURRENCY.INR_SYMBOL}{balancesApplied.toLocaleString('en-IN')}</span>
              </div>
            )}
            {collectedByMode.map((p) => (
              <div key={p.modeId ?? p.modeCode} className="flex items-center justify-between text-stone-500">
                <span>Collected ({p.modeName})</span>
                <span>{APP_CONFIG.CURRENCY.INR_SYMBOL}{(Number(p.amount) || 0).toLocaleString('en-IN')}</span>
              </div>
            ))}
            {isBalanced ? (
              <p className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <CheckCircle2 size={14} aria-hidden="true" />
                Paid in full
              </p>
            ) : (
              <div className="flex items-center justify-between font-medium">
                <span className="text-stone-500">
                  {remaining > 0 ? 'Remaining' : 'Over total'}
                </span>
                <span className={remaining > 0 ? 'text-destructive' : 'text-amber-600'}>
                  {APP_CONFIG.CURRENCY.INR_SYMBOL}{Math.abs(remaining).toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
