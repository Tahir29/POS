'use client';

// src/components/features/schemes/EnrollmentDetailSheet.jsx
//
// Per-enrollment detail: month-by-month payment schedule + payment
// (receipt) history. Both sourced from confirmed-working read endpoints
// (SchemeMonthlyDetails/List, SchemeReceipt/List) that existed in
// schemeService.js but were never wired to any UI — see
// useSchemeMonthlyDetails.js / useSchemeReceiptHistory.js.

import { useState } from 'react';
import { AlertCircle, CalendarClock, Receipt } from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';
import PillTabs from '@/components/shared/PillTabs';
import { useSchemeMonthlyDetails } from '@/hooks/schemes/useSchemeMonthlyDetails';
import { useSchemeReceiptHistory } from '@/hooks/schemes/useSchemeReceiptHistory';
import { formatCurrency, formatDate } from '@/lib/schemeFormat';

const TABS = [
  { key: 'schedule', label: 'Schedule' },
  { key: 'payments', label: 'Payments' },
];

function LoadingRow() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function ErrorRow({ label }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-stone-400">
      <AlertCircle size={20} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function EmptyRow({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-stone-400">
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
      {months.map((month) => (
        <div
          key={month.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-stone-800">Month {month.monthId}</p>
            <p className="text-xs text-stone-400">
              Due {formatDate(month.dueDate)}
              {month.isPaid && month.paidOnDate && ` · Paid ${formatDate(month.paidOnDate)}`}
              {month.isPaid && month.delayDays > 0 && ` (${month.delayDays}d late)`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-sm font-semibold text-stone-700">{formatCurrency(month.amount)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              month.isPaid
                ? 'bg-emerald-50 text-emerald-700'
                : month.isOverdue
                  ? 'bg-red-50 text-red-600'
                  : 'bg-stone-100 text-stone-500'
            }`}>
              {month.isPaid ? 'Paid' : month.isOverdue ? 'Overdue' : 'Upcoming'}
            </span>
          </div>
        </div>
      ))}
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
            <p className="text-sm font-medium text-stone-800">{receipt.documentNo ?? `Receipt #${receipt.id}`}</p>
            <p className="text-xs text-stone-400">
              {formatDate(receipt.documentDate)}
              {receipt.modeName && ` · ${receipt.modeName}`}
            </p>
          </div>
          <span className="text-sm font-semibold text-stone-700 shrink-0">
            {formatCurrency(receipt.amount)}
          </span>
        </div>
      ))}
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
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm flex flex-col gap-1">
          <p className="font-medium text-stone-800">{enrollment.schemeName}</p>
          <p className="text-stone-500">{enrollment.partyName} · {enrollment.mobile}</p>
          <p className="text-stone-500">
            Monthly: {formatCurrency(enrollment.schemeAmount)} · Tenure: {enrollment.tenure} months
          </p>
        </div>

        <PillTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />

        {activeTab === 'schedule' && <ScheduleTab enrollmentId={enrollment.enrollmentId} />}
        {activeTab === 'payments' && <PaymentsTab enrollmentId={enrollment.enrollmentId} />}
      </div>
    </BottomSheet>
  );
}
