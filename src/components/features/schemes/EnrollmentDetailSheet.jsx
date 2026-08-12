'use client';

// src/components/features/schemes/EnrollmentDetailSheet.jsx
//
// Per-enrollment detail: month-by-month payment schedule + payment
// (receipt) history. Both sourced from confirmed-working read endpoints
// (SchemeMonthlyDetails/List, SchemeReceipt/List) that existed in
// schemeService.js but were never wired to any UI — see
// useSchemeMonthlyDetails.js / useSchemeReceiptHistory.js.

import { useState } from 'react';
import { AlertCircle, CalendarClock, Receipt, Calculator } from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';
import PillTabs from '@/components/shared/PillTabs';
import PaymentStatusBadge, { mapScheduleStatus } from '@/components/shared/PaymentStatusBadge';
import { useSchemeMonthlyDetails } from '@/hooks/schemes/useSchemeMonthlyDetails';
import { useSchemeReceiptHistory } from '@/hooks/schemes/useSchemeReceiptHistory';
import { useSchemeBenefits } from '@/hooks/schemes/useSchemeBenefits';
import { formatCurrency, formatDate } from '@/lib/schemeFormat';

const TABS = [
  { key: 'schedule', label: 'Schedule' },
  { key: 'payments', label: 'Payments' },
  { key: 'closure',  label: 'Closure' },
];

const CLOSURE_ACTIONS = [
  {
    key: 'maturity',
    label: 'Maturity',
    hint: 'What the customer receives at the end of the full tenure.',
  },
  {
    key: 'foreclose',
    label: 'Foreclosure',
    hint: 'Early exit, with a reduced benefit.',
  },
  {
    key: 'cancellation',
    label: 'Cancellation',
    hint: 'Exit with no benefit — refund of what was paid in.',
  },
];

// Response shape confirmed live 2026-08-01 against a fully-paid enrollment:
//   { total_benefit, principal_paid, total_payout, ontime_rate, delayed_rate,
//     grace_days, Installments: [{ due_date, paid_date, installment_amount,
//       delay_days, days_held, applied_rate, benefit_amount, is_delayed }] }
// Unknown keys still render (de-snake-cased) rather than being dropped, in
// case foreclosure/cancellation return extra fields.
const BENEFIT_FIELDS = {
  principal_paid: { label: 'Principal Paid', format: 'money' },
  total_benefit:  { label: 'Benefit Earned', format: 'money' },
  total_payout:   { label: 'Total Payout',   format: 'money', emphasis: true },
  ontime_rate:    { label: 'On-time Rate',   format: 'rate' },
  delayed_rate:   { label: 'Delayed Rate',   format: 'rate' },
  grace_days:     { label: 'Grace Period',   format: 'days' },
  // seen on the enrollment entity itself
  invested_amount: { label: 'Invested',      format: 'money' },
  benifit_amount:  { label: 'Benefit',       format: 'money' }, // API's spelling
  total_payable:   { label: 'Total Payable', format: 'money' },
};

// Order matters: principal, then what it earned, then the total.
const BENEFIT_ORDER = [
  'principal_paid', 'total_benefit', 'total_payout',
  'ontime_rate', 'delayed_rate', 'grace_days',
];

function formatBenefitValue(key, value) {
  switch (BENEFIT_FIELDS[key]?.format) {
    case 'money': return formatCurrency(value);
    case 'rate':  return `${(Number(value) * 100).toFixed(2)}%`;
    case 'days':  return `${value} days`;
    default:      return String(value);
  }
}

function prettyLabel(key) {
  return BENEFIT_FIELDS[key]?.label
    ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Sorts known fields into a sensible order, unknown ones last. */
function orderBenefitRows(entries) {
  return entries.sort(([a], [b]) => {
    const ia = BENEFIT_ORDER.indexOf(a), ib = BENEFIT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

function LoadingRow() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function ErrorRow({ label }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
      <AlertCircle size={20} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function EmptyRow({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
      <Icon size={24} className="opacity-40" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

// ── Monthly schedule ──────────────────────────────────────────
function ScheduleTab({ enrollmentId }) {
  const { data: months = [], isLoading, isError } = useSchemeMonthlyDetails(enrollmentId);

  if (isLoading) return <LoadingRow />;
  if (isError)   return <ErrorRow label="Failed to load payment schedule." />;
  if (!months.length) return <EmptyRow icon={CalendarClock} label="No schedule available yet." />;

  return (
    <div className="flex flex-col gap-2">
      {months.map((month) => {
        const rawStatus = month.isPaid ? 'paid' : month.isOverdue ? 'overdue' : 'upcoming';
        return (
          <div
            key={month.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Month {month.monthId}</p>
              <p className="text-xs text-muted-foreground">
                Due {formatDate(month.dueDate)}
                {month.isPaid && month.paidOnDate && ` · Paid ${formatDate(month.paidOnDate)}`}
                {month.isPaid && month.delayDays > 0 && ` (${month.delayDays}d late)`}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(month.amount)}</span>
              <PaymentStatusBadge
                status={mapScheduleStatus(rawStatus)}
                labelOverride={month.isPaid ? 'Paid' : month.isOverdue ? 'Overdue' : 'Upcoming'}
                size="sm"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Payment history ───────────────────────────────────────────
function PaymentsTab({ enrollmentId }) {
  const { data: receipts = [], isLoading, isError } = useSchemeReceiptHistory(enrollmentId);

  if (isLoading) return <LoadingRow />;
  if (isError)   return <ErrorRow label="Failed to load payment history." />;
  if (!receipts.length) return <EmptyRow icon={Receipt} label="No payments recorded yet." />;

  return (
    <div className="flex flex-col gap-2">
      {receipts.map((receipt) => (
        <div
          key={receipt.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{receipt.documentNo ?? `Receipt #${receipt.id}`}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(receipt.documentDate)}
              {receipt.modeName && ` · ${receipt.modeName}`}
            </p>
          </div>
          <span className="text-sm font-semibold text-foreground shrink-0 tabular-nums">
            {formatCurrency(receipt.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Closure calculators ───────────────────────────────────────
// Read-only: these work out what a customer WOULD get. Nothing is closed,
// cancelled or paid out here.
function ClosureTab({ enrollmentId }) {
  const { calculate, kind, result, error, isLoading } = useSchemeBenefits(enrollmentId);

  const payload = result?.Entity ?? result;
  const rows = payload && typeof payload === 'object'
    ? orderBenefitRows(
        Object.entries(payload).filter(([, v]) => v != null && typeof v !== 'object'),
      )
    : [];
  const installments = Array.isArray(payload?.Installments) ? payload.Installments : [];
  const delayedCount = installments.filter((i) => i.is_delayed).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        These only calculate a figure — nothing is closed or paid out.
      </p>

      <div className="flex flex-col gap-2">
        {CLOSURE_ACTIONS.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => calculate(action.key)}
            disabled={isLoading}
            className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-60"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{action.label}</span>
              <span className="block text-xs text-muted-foreground">{action.hint}</span>
            </span>
            <Calculator size={16} className="shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      {isLoading && <LoadingRow />}

      {error && !isLoading && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {result && !isLoading && !error && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-3">
          <p className="text-sm font-medium text-foreground">
            {CLOSURE_ACTIONS.find((a) => a.key === kind)?.label} calculation
          </p>
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">No figures returned.</p>
          ) : (
            <dl className="flex flex-col gap-1">
              {rows.map(([key, value]) => {
                const emphasis = BENEFIT_FIELDS[key]?.emphasis;
                return (
                  <div
                    key={key}
                    className={`flex items-baseline justify-between gap-3 ${
                      emphasis ? 'mt-1 border-t border-border pt-2' : ''
                    }`}
                  >
                    <dt className={emphasis
                      ? 'text-sm font-medium text-foreground'
                      : 'text-xs text-muted-foreground'}>
                      {prettyLabel(key)}
                    </dt>
                    <dd className={`tabular-nums ${
                      emphasis
                        ? 'text-base font-semibold text-foreground'
                        : 'text-sm font-medium text-foreground'
                    }`}>
                      {formatBenefitValue(key, value)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}

          {installments.length > 0 && (
            <p className="border-t border-border pt-2 text-xs text-muted-foreground">
              Calculated across {installments.length} instalment
              {installments.length === 1 ? '' : 's'}
              {delayedCount > 0
                ? ` · ${delayedCount} paid late, charged at the delayed rate`
                : ' · all paid on time'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sheet ──────────────────────────────────────────────────────
export default function EnrollmentDetailSheet({ enrollment, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('schedule');

  if (!enrollment) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Enrollment Details">
      <div className="flex flex-col gap-4">

        {/* Summary */}
        <div className="rounded-xl border border-border bg-muted p-3 text-sm flex flex-col gap-1">
          <p className="font-medium text-foreground">{enrollment.schemeName}</p>
          <p className="text-muted-foreground">{enrollment.partyName} · {enrollment.mobile}</p>
          <p className="text-muted-foreground">
            Monthly: {formatCurrency(enrollment.schemeAmount)} · Tenure: {enrollment.tenure} months
          </p>
        </div>

        <PillTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />

        {activeTab === 'schedule' && <ScheduleTab enrollmentId={enrollment.enrollmentId} />}
        {activeTab === 'payments' && <PaymentsTab enrollmentId={enrollment.enrollmentId} />}
        {activeTab === 'closure'  && <ClosureTab  enrollmentId={enrollment.enrollmentId} />}
      </div>
    </BottomSheet>
  );
}
