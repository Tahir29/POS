'use client';

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
import { Input } from '@/components/ui/input';
import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { usePaymentModes } from '@/hooks/checkout/usePaymentModes';
import { useBankPosAccounts } from '@/hooks/checkout/useBankPosAccounts';
import { useInvoiceHelpers } from '@/hooks/checkout/useInvoiceHelpers';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useSelector } from 'react-redux';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import PaymentModeSelector from '../PaymentModeSelector';
import PaymentAmountInput from '../PaymentAmountInput';
import BankPosSelect from '../BankPosSelect';
import APP_CONFIG from '@/constants/appConfig';
import tracker from '@/lib/analytics/tracker';
import EVENTS from '@/lib/analytics/events';

function HelperBalanceRow({ label, amount, modeCode, rows, isApplied, onToggle, isLoading }) {
  if (isLoading) return null;
  if (!amount || amount <= 0) return null;

  const handleToggle = () => onToggle({ modeCode, label, amount, rows });

  // role="switch" on a <div>, not a real <button> (2026-08-27) — the visual
  // Switch rendered inside is ITSELF a real <button> under the hood (Radix's
  // SwitchPrimitive.Root renders role="switch" as an actual <button>, see
  // ui/switch.jsx), so this used to be a <button> containing another
  // <button>. Same failure mode already fixed once in this codebase for
  // ProductCard's wishlist heart (see that file's own comment): the
  // browser's HTML parser auto-closes the OUTER button the instant it
  // meets the nested one, silently detaching everything after that point
  // from this row's real click target — confirmed live 2026-08-27, this is
  // what a customer with an Exchange Credit balance (or any second helper
  // balance row) hit at checkout: a React hydration error that broke the
  // payment section, one repro away from an order that never actually
  // reaches Create. tabIndex + onKeyDown reproduce real button/switch
  // keyboard behaviour (Enter/Space), which a plain div gets neither of
  // for free. The inner <Switch> stays purely decorative — already
  // pointer-events-none/tabIndex=-1/aria-hidden, unchanged here.
  return (
    <div
      role="switch"
      aria-checked={isApplied}
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      }}
      className={`
        flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-left
        transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        ${isApplied ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted'}
      `}
    >
      <div>
        <p className="text-xs font-medium text-foreground/80">{label}</p>
        <p className="text-sm font-semibold text-primary mt-0.5">
          {APP_CONFIG.CURRENCY.INR_SYMBOL}{Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </p>
      </div>
      <Switch checked={isApplied} className="pointer-events-none" tabIndex={-1} aria-hidden="true" />
    </div>
  );
}

/**
 * @param {{ onChange: Function, amountDue?: number, allowPartial?: boolean }} props
 *   amountDue — the live-priced total. Payment must be collected against
 *   this, not the cart's catalog estimate, which can omit stone value and
 *   leave the document short-paid. Falls back to the cart total only while
 *   pricing is still resolving.
 *   allowPartial — true when raising an ORDER, where the customer leaves an
 *   advance and the rest is due on collection. Only the wording changes: an
 *   unpaid remainder is a blocking error on an invoice and the normal case on
 *   an order, so it must not be shown in red as something to fix.
 */
export default function CheckoutPaymentSection({ onChange, amountDue, allowPartial = false }) {
  const { total: cartTotal } = useCartTotals();
  const total = amountDue ?? cartTotal;
  const { paymentModes, isLoading: modesLoading, isError: modesError } = usePaymentModes();
  const { bankPosAccounts } = useBankPosAccounts();
  const { customerId } = useCustomerSession();
  const activeStoreId  = useSelector(selectActiveStoreId);

  const helpers = useInvoiceHelpers({
    partyId:   customerId,
    companyId: activeStoreId,
  });

  // payments: { key, modeId?, modeCode, modeName, amount (string), isHelper?,
  //   helperCategory?, creditRef? }[]
  // `key` is the stable per-row identity used everywhere below instead of
  // modeId/modeCode — needed because one helper category (e.g. "Credit
  // Note") can now be backed by several distinct source receipts, each its
  // own payments[] entry, and they'd otherwise collide on a shared modeCode
  // (e.g. two Return receipts both carry mode_code "Return").
  const [payments, setPayments] = useState([]);
  // Tracks the last `total` the single-mode pre-fill below has already run
  // against — lets a render-time comparison detect "total changed" without
  // an effect. See ProductSearchBar's identical pattern/comment for why:
  // calling setPayments conditionally here, mid-render, re-renders with the
  // corrected amount before anything paints, instead of painting the
  // stale amount first and correcting it a frame later the way the
  // previous useEffect(..., [total]) version did.
  const [lastPricedTotal, setLastPricedTotal] = useState(total);

  // OrnaVerse rejects the sale with "Cannot accept Cash above 199999.00" once
  // a party's cash receipts for the day reach the limit (s.269ST). Two things
  // make that error unusable at the counter, both confirmed live 2026-08-05:
  //
  //   • It is an AGGREGATE-PER-PARTY-PER-DAY check, not a check on this
  //     payment. GetPartyDailyCash read 3,60,950.66 for a customer whose
  //     invoice was being paid entirely by UPI, and the sale was still
  //     refused — cash on THIS invoice was zero.
  //   • The message names "Cash" either way, so an operator paying by card
  //     or UPI is told to fix something that isn't there.
  //
  // Surfacing the party's own running total turns an unexplainable rejection
  // into a fact the operator can act on (take a different tender, or split
  // the sale across days).
  const dailyCashTaken = helpers.dailyCash?.amount ?? 0;
  const cashHeadroom   = Math.max(0, APP_CONFIG.COMPLIANCE.CASH_DAILY_LIMIT - dailyCashTaken);
  const isCashBlocked  = !helpers.dailyCash?.isLoading && cashHeadroom <= 0;

  const selectedModeIds = payments.filter((p) => p.modeId).map((p) => p.modeId);
  const appliedHelperCategories = [...new Set(
    payments.filter((p) => p.isHelper).map((p) => p.helperCategory)
  )];

  // Bank-settled tenders need to say which bank account the money lands in;
  // Cash (and helper balances — Scheme/Exchange/Credit Note/Old Gold/
  // Advances, none of which touch a bank) don't.
  const requiresBank = (p) => !p.isHelper && p.modeCode !== 'Cash';

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
          key:      modeId,
          modeId,
          modeCode: mode?.modeCode ?? '',
          modeName: mode?.modeName ?? 'Unknown',
          amount:   isFirst ? String(remaining) : '',
          isHelper: false,
          bankPosId: null,
          refNo:    '',
        },
      ];
    });
  };

  // The amounts these toggles show are real (useInvoiceHelpers.js reads them
  // from POSReceiptsSelect/List, confirmed 2026-08-18 — see its header
  // comment). Applying one now references the actual source receipt(s) it
  // draws from — CONFIRMED 2026-08-19 by reading OrnaVerse's own compiled
  // POS client's `buildReceiptFromCredit` (see documentFields.js's header
  // comment for the full field-by-field contract) while their UAT was down
  // for a live capture. A category can be backed by several distinct
  // receipts (e.g. four separate Return documents making up one "Credit
  // Note" total), so toggling one on allocates the applied amount across
  // its underlying `rows` — oldest/first row first, up to each row's own
  // balance — producing one payments[] entry PER receipt actually drawn
  // from, not one flat entry for the whole category. CONFIRMED SETTLING
  // 2026-08-19 — see documentFields.js's header comment for the live
  // transaction (HO-LJ-0826-018) that proved the applied receipt's balance
  // actually decrements server-side, not just cosmetically shows as applied.
  function allocateCreditRows(rows, amountToApply) {
    const entries = [];
    let remaining = amountToApply;
    for (const row of rows ?? []) {
      if (remaining <= 0) break;
      const balance = Number(row.balance_amount) || 0;
      if (balance <= 0) continue;
      const take = Math.min(balance, remaining);
      entries.push({ row, amount: take });
      remaining -= take;
    }
    return entries;
  }

  const handleHelperToggle = ({ modeCode, label, amount, rows }) => {
    setPayments((prev) => {
      const exists = prev.some((p) => p.isHelper && p.helperCategory === modeCode);
      if (exists) return prev.filter((p) => !(p.isHelper && p.helperCategory === modeCode));

      // FIXED: this used to cap against the grand `total` alone, ignoring
      // money already collected from other payment modes or other already-
      // applied helper balances — same `remaining` handleModeToggle already
      // computes above, just not reused here. Real failure this caused: due
      // ₹10,000, operator enters ₹5,000 Cash, then applies an ₹8,000
      // Exchange Credit balance — the old capping let the full ₹8,000
      // through, pushing paid total to ₹13,000 ("Over total"), which then
      // silently failed checkoutSchema's "Advance cannot be more than the
      // order total" check and blocked Place Order until the operator
      // manually edited the helper row's amount down.
      const nonHelperPaid = prev.filter((p) => !p.isHelper)
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const helperPaid = prev.filter((p) => p.isHelper)
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const remaining = Math.max(0, total - helperPaid - nonHelperPaid);
      const applyAmount = Math.min(amount, remaining);
      const allocations = allocateCreditRows(rows, applyAmount);
      const entries = allocations.map(({ row, amount: rowAmount }) => ({
        key:            row.receipt_id ?? `${modeCode}-${row.transaction_id}`,
        modeId:         null,
        modeCode:       row.mode_code,
        // Mirrors OrnaVerse's own payment screen, which labels an applied
        // credit as "<Type> (<document_no>)" — e.g. "Exchange (HO-EXC-07-26-00001)".
        modeName:       `${label} (${row.document_no})`,
        amount:         String(rowAmount),
        isHelper:       true,
        helperCategory: modeCode,
        creditRef:      row,
      }));
      return [...prev, ...entries];
    });
  };

  const handleAmountChange = (key, value) => {
    setPayments((prev) => prev.map((p) => (p.key === key ? { ...p, amount: value } : p)));
  };

  const handleBankChange = (key, bankPosId) => {
    setPayments((prev) => prev.map((p) => (p.key === key ? { ...p, bankPosId } : p)));
  };

  const handleRefNoChange = (key, refNo) => {
    setPayments((prev) => prev.map((p) => (p.key === key ? { ...p, refNo } : p)));
  };

  // Recompute single-mode pre-fill when total changes — during render, not
  // in an effect (see lastPricedTotal's comment above).
  if (total !== lastPricedTotal) {
    setLastPricedTotal(total);
    setPayments((prev) => {
      const nonHelpers = prev.filter((p) => !p.isHelper);
      if (nonHelpers.length !== 1) return prev;
      const helperPaid = prev.filter((p) => p.isHelper)
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
      const remaining = Math.max(0, total - helperPaid);
      return prev.map((p) => (!p.isHelper ? { ...p, amount: String(remaining) } : p));
    });
  }

  // Notify parent.
  // ledgerId + raw travel with each row because receipt_details[] needs them:
  // their payload carries the mode's ledger_id (the account the receipt posts
  // against), mode_type, mode_sub_type and allow_partial, all of which live on
  // the PaymentReceiptMode row. Flattening to four fields here is what used to
  // strip them. See lib/checkout/documentFields.buildReceiptDetails.
  //
  // bankPosId/bankLedgerId/refNo (confirmed 2026-08-14 via a real network
  // capture of OrnaVerse's own client completing a Credit Card + bank sale
  // on their UAT panel — see documentFields.js's header comment for the
  // full contract this is built against):
  //   - bank_pos is the bank account's NUMERIC id (not its code string —
  //     that's what caused the earlier 500).
  //   - ledger_id on the receipt row becomes the BANK ACCOUNT's ledger_id
  //     once one is selected, not the payment mode's own ledger_id.
  //   - ref_no is a real, required field for bank-settled modes in their
  //     own UI ("Reference *") — not an always-empty placeholder.
  useEffect(() => {
    onChange?.(
      payments.map((p) => {
        const mode = paymentModes.find((m) => m.modeId === p.modeId);
        const bankAccount = p.bankPosId != null
          ? bankPosAccounts.find((a) => a.id === p.bankPosId)
          : null;
        return {
          // null, not undefined — checkoutSchema's modeId is nullable() (a
          // real value for a payment mode, null for an applied credit), and
          // Zod's nullable() does not also accept undefined.
          modeId:       p.modeId   ?? null,
          modeCode:     p.modeCode ?? '',
          modeName:     p.modeName,
          amount:       Number(p.amount) || 0,
          ledgerId:     bankAccount?.ledgerId ?? mode?.ledgerId ?? null,
          raw:          mode?.raw ?? null,
          bankPosId:    bankAccount?.id ?? null,
          refNo:        p.refNo ?? '',
          // Carried through so buildReceiptDetails can build the credit
          // linkage (ref_no/ref_document_id/ref_transaction_id/mode_sub_type)
          // instead of a normal tender row — see its header comment.
          creditRef:    p.creditRef ?? null,
        };
      })
    );
  }, [payments, paymentModes, bankPosAccounts]);

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
  ]; // each `data.rows` is the underlying POSReceiptsSelect rows for that bucket — see useInvoiceHelpers.js

  const hasVisibleHelpers = customerId && helperItems.some((h) => h.data?.amount > 0);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-bold text-foreground">Payment</h2>

      {customerId && (
        <div className="flex flex-col gap-2">
          {helpers.isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 size={12} className="animate-spin" />
              Checking available balances…
            </div>
          )}
          {!helpers.isLoading && hasVisibleHelpers && (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Available Balances</p>
          )}
          {helperItems.map((h) => (
            <HelperBalanceRow
              key={h.code}
              label={h.label}
              amount={h.data?.amount}
              modeCode={h.code}
              rows={h.data?.rows}
              isApplied={appliedHelperCategories.includes(h.code)}
              onToggle={handleHelperToggle}
              isLoading={h.loading}
            />
          ))}
          {balancesApplied > 0 && (
            <p className="text-xs text-primary font-medium">
              {APP_CONFIG.CURRENCY.INR_SYMBOL}{balancesApplied.toLocaleString('en-IN', { maximumFractionDigits: 2 })} applied to this order
            </p>
          )}
        </div>
      )}

      {hasVisibleHelpers && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          <span>or pay with</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment Method</p>

      {/* Cash ceiling — see the note beside cashHeadroom above. Stated before
          the operator picks a tender, because OrnaVerse's own rejection
          arrives after Place Order and blames "Cash" even when none was
          taken. */}
      {isCashBlocked ? (
        <p className="rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-xs text-status-error">
          This customer has already taken{' '}
          {APP_CONFIG.CURRENCY.INR_SYMBOL}
          {dailyCashTaken.toLocaleString('en-IN', { maximumFractionDigits: 2 })} in cash today,
          so no further cash can be accepted (limit{' '}
          {APP_CONFIG.CURRENCY.INR_SYMBOL}
          {APP_CONFIG.COMPLIANCE.CASH_DAILY_LIMIT.toLocaleString('en-IN')}).
          OrnaVerse will refuse this sale until the cash total resets tomorrow —
          including when it is paid entirely by another method.
        </p>
      ) : dailyCashTaken > 0 && (
        <p className="text-xs text-muted-foreground">
          Cash available for this customer today:{' '}
          {APP_CONFIG.CURRENCY.INR_SYMBOL}
          {cashHeadroom.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </p>
      )}

      <PaymentModeSelector
        paymentModes={paymentModes}
        selectedModeIds={selectedModeIds}
        onToggle={handleModeToggle}
        isLoading={modesLoading}
        isError={modesError}
      />

      {payments.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          {payments.map((p) => (
            <div key={p.key} className="flex flex-col gap-1.5">
              <PaymentAmountInput
                modeName={p.modeName}
                amount={p.amount}
                onChange={(value) => handleAmountChange(p.key, value)}
              />
              {requiresBank(p) && (
                <>
                  <BankPosSelect
                    value={p.bankPosId}
                    onChange={(bankPosId) => handleBankChange(p.key, bankPosId)}
                  />
                  {/* Reference — required in OrnaVerse's own UI for
                      bank-settled modes ("Reference *"), confirmed
                      2026-08-14. Plain text, no format validated server-side
                      beyond "present". */}
                  <Input
                    value={p.refNo ?? ''}
                    onChange={(e) => handleRefNoChange(p.key, e.target.value)}
                    placeholder="Reference number"
                    className="h-10"
                    aria-label={`Reference for ${p.modeName}`}
                  />
                </>
              )}
            </div>
          ))}

          <div className="flex flex-col gap-1 text-sm pt-2 border-t border-border">
            {balancesApplied > 0 && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Balances applied</span>
                <span>−{APP_CONFIG.CURRENCY.INR_SYMBOL}{balancesApplied.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            )}
            {collectedByMode.map((p) => (
              <div key={p.key} className="flex items-center justify-between text-muted-foreground">
                <span>Collected ({p.modeName})</span>
                <span>{APP_CONFIG.CURRENCY.INR_SYMBOL}{(Number(p.amount) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            ))}
            {isBalanced ? (
              <p className="flex items-center gap-1.5 text-status-in-stock font-medium">
                <CheckCircle2 size={14} aria-hidden="true" />
                Paid in full
              </p>
            ) : (
              <div className="flex items-center justify-between font-medium">
                <span className="text-muted-foreground">
                  {remaining < 0
                    ? 'Over total'
                    : allowPartial ? 'Balance on collection' : 'Remaining'}
                </span>
                <span
                  className={
                    remaining < 0
                      ? 'text-status-made-order'
                      : allowPartial ? 'text-foreground/80' : 'text-destructive'
                  }
                >
                  {APP_CONFIG.CURRENCY.INR_SYMBOL}{Math.abs(remaining).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
