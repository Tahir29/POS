'use client';

// src/components/features/checkout/CheckoutPaymentSection/index.jsx
// Payment mode selection and amount entry, including split payment support.
// Lifts payment state ({ modeId, modeName, amount }[]) to the parent
// checkout page via onChange — needed by checkoutSchema validation and
// useCreateOrder's payload construction.

import { useEffect, useState } from 'react';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { usePaymentModes } from '@/hooks/checkout/usePaymentModes';
import PaymentModeSelector from '../PaymentModeSelector';
import PaymentAmountInput from '../PaymentAmountInput';

/**
 * @param {{
 *   onChange?: (payments: { modeId: number, modeName: string, amount: number }[]) => void,
 * }} props
 */
export default function CheckoutPaymentSection({ onChange }) {
  const { total } = useCartTotals();
  const { paymentModes, isLoading, isError } = usePaymentModes();

  // payments: { modeId, modeName, amount (string for controlled input) }[]
  const [payments, setPayments] = useState([]);

  const selectedModeIds = payments.map((p) => p.modeId);

  const handleToggle = (modeId) => {
    setPayments((prev) => {
      const exists = prev.find((p) => p.modeId === modeId);
      if (exists) {
        return prev.filter((p) => p.modeId !== modeId);
      }
      const mode = paymentModes.find((m) => m.modeId === modeId);
      const isFirst = prev.length === 0;
      return [
        ...prev,
        {
          modeId,
          modeName: mode?.modeName ?? 'Unknown',
          // Pre-fill the full total when it's the only/first mode selected,
          // so single-payment is a one-tap flow.
          amount: isFirst ? String(total) : '',
        },
      ];
    });
  };

  const handleAmountChange = (modeId, value) => {
    setPayments((prev) =>
      prev.map((p) => (p.modeId === modeId ? { ...p, amount: value } : p))
    );
  };

  // Recompute the pre-filled single-mode amount if the cart total changes
  // while exactly one mode is selected (e.g. promo applied after selection).
  useEffect(() => {
    setPayments((prev) => {
      if (prev.length !== 1) return prev;
      return [{ ...prev[0], amount: String(total) }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // Notify parent of normalized payment state
  useEffect(() => {
    onChange?.(
      payments.map((p) => ({
        modeId: p.modeId,
        modeName: p.modeName,
        amount: Number(p.amount) || 0,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments]);

  const paidTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remaining = Math.round((total - paidTotal) * 100) / 100;
  const isBalanced = payments.length > 0 && remaining === 0;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-bold text-stone-800">Payment</h2>

      <PaymentModeSelector
        paymentModes={paymentModes}
        selectedModeIds={selectedModeIds}
        onToggle={handleToggle}
        isLoading={isLoading}
        isError={isError}
      />

      {payments.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-stone-100">
          {payments.map((p) => (
            <PaymentAmountInput
              key={p.modeId}
              modeName={p.modeName}
              amount={p.amount}
              onChange={(value) => handleAmountChange(p.modeId, value)}
            />
          ))}

          {payments.length > 1 && (
            <div className="flex items-center justify-between text-sm pt-1">
              <span className="text-stone-500">
                {remaining === 0
                  ? 'Fully allocated'
                  : remaining > 0
                    ? `₹${remaining.toLocaleString('en-IN')} remaining`
                    : `₹${Math.abs(remaining).toLocaleString('en-IN')} over total`}
              </span>
              <span className={isBalanced ? 'text-emerald-600 font-medium' : 'text-destructive font-medium'}>
                ₹{paidTotal.toLocaleString('en-IN')} / ₹{total.toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}