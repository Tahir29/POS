'use client';

// src/components/features/checkout/CheckoutPaymentSection/index.jsx
// Payment section at checkout — shows available customer balances first,
// then standard payment mode selection with split payment support.
//
// INVOICE HELPERS (new — shown when customer is attached):
//   Scheme, Exchange, Credit Note, Old Gold, Advances
//   Each shows the available balance and an "Apply" toggle.
//   Applied amounts are added as additional payment entries.
//
// STANDARD PAYMENT MODES:
//   Cash, Card, UPI, etc. — from PaymentReceiptMode/List
//   Filtered by ALLOWLIST/DENYLIST in appConfig.
//
// Parent receives: onChange({ modeId, modeCode, modeName, amount }[])

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { usePaymentModes } from '@/hooks/checkout/usePaymentModes';
import { useInvoiceHelpers } from '@/hooks/checkout/useInvoiceHelpers';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useSelector } from 'react-redux';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import PaymentModeSelector from '../PaymentModeSelector';
import PaymentAmountInput from '../PaymentAmountInput';
import APP_CONFIG from '@/constants/appConfig';

// ── Invoice Helper Balance Row ────────────────────────────────────────────────
// Shows a single available balance (scheme, exchange, etc.) with apply toggle.
function HelperBalanceRow({ label, amount, modeCode, isApplied, onToggle, isLoading }) {
  if (isLoading) return null;
  if (!amount || amount <= 0) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5">
      <div>
        <p className="text-xs font-medium text-stone-700">{label}</p>
        <p className="text-sm font-semibold text-primary mt-0.5">
          {APP_CONFIG.CURRENCY.INR_SYMBOL}{Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onToggle({ modeCode, label, amount })}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          isApplied
            ? 'bg-primary text-primary-foreground'
            : 'bg-white border border-stone-200 text-stone-600 hover:border-primary/40'
        }`}
      >
        {isApplied ? 'Applied' : 'Apply'}
      </button>
    </div>
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

  const paidTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Math.round((total - paidTotal) * 100) / 100;
  const isBalanced = payments.length > 0 && remaining === 0;

  const helperItems = [
    { label: 'Scheme Balance',  code: 'Scheme',      data: helpers.scheme,     loading: helpers.scheme?.isLoading },
    { label: 'Exchange Value',  code: 'Exchange',    data: helpers.exchange,   loading: helpers.exchange?.isLoading },
    { label: 'Credit Note',     code: 'CreditNote',  data: helpers.creditNote, loading: helpers.creditNote?.isLoading },
    { label: 'Old Gold Value',  code: 'OldGold',     data: helpers.oldGold,    loading: helpers.oldGold?.isLoading },
    { label: 'Advance Payment', code: 'Advances',    data: helpers.advances,   loading: helpers.advances?.isLoading },
  ];

  const hasVisibleHelpers = customerId && helperItems.some((h) => h.data?.amount > 0);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4">
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

          {payments.length > 1 && (
            <div className="flex items-center justify-between text-sm pt-1">
              <span className="text-stone-500">
                {remaining === 0
                  ? 'Fully allocated'
                  : remaining > 0
                    ? `${APP_CONFIG.CURRENCY.INR_SYMBOL}${remaining.toLocaleString('en-IN')} remaining`
                    : `${APP_CONFIG.CURRENCY.INR_SYMBOL}${Math.abs(remaining).toLocaleString('en-IN')} over total`}
              </span>
              <span className={`font-medium ${isBalanced ? 'text-emerald-600' : 'text-destructive'}`}>
                {APP_CONFIG.CURRENCY.INR_SYMBOL}{paidTotal.toLocaleString('en-IN')} / {APP_CONFIG.CURRENCY.INR_SYMBOL}{total.toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
