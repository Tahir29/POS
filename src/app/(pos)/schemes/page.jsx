'use client';

// src/app/(pos)/schemes/page.jsx
// Schemes module — two tabs:
//   Schemes    — available scheme products (existing SchemeCard grid)
//   Enrollments — customer enrollments with inline receipt payment

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RefreshCw, LayoutGrid, Plus, X, AlertCircle } from 'lucide-react';

import { useSchemes }            from '@/hooks/schemes/useSchemes';
import { useSchemeEnrollments }  from '@/hooks/schemes/useSchemeEnrollments';
import { useSchemeReceipt }      from '@/hooks/schemes/useSchemeReceipt';
import { usePaymentModes }       from '@/hooks/checkout/usePaymentModes';
import { selectActiveStoreId }   from '@/store/slices/storeSlice';
import { selectCartCustomerId, selectCartCustomerName } from '@/store/slices/cartSlice';
import APP_CONFIG from '@/constants/appConfig';
import { todayDateString } from '@/lib/dateUtils';

import SchemeCard  from '@/components/features/schemes/SchemeCard';
import PageLoader  from '@/components/shared/PageLoader';
import BottomSheet from '@/components/shared/BottomSheet';
import PaymentModeSelect from '@/components/shared/PaymentModeSelect';
import PillTabs    from '@/components/shared/PillTabs';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';

// ── Helpers ───────────────────────────────────────────────────
function formatCurrency(n) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN');
}

const STATUS_STYLES = {
  active:    'bg-emerald-50 text-emerald-700',
  completed: 'bg-blue-50    text-blue-700',
  inactive:  'bg-stone-100  text-stone-500',
  matured:   'bg-blue-50    text-blue-700',
  default:   'bg-stone-100  text-stone-500',
};

// ── Receipt payment schema ────────────────────────────────────
const receiptSchema = z.object({
  amount:        z.coerce.number().min(1, 'Enter amount'),
  mode_id:       z.coerce.number().min(1, 'Select payment mode'),
  mode_name:     z.string().optional(),
  document_date: z.string().min(1, 'Required'),
});

// ── Receipt Sheet ─────────────────────────────────────────────
function ReceiptSheet({ enrollment, isOpen, onClose }) {
  const storeId = useSelector(selectActiveStoreId);
  const { paymentModes, isLoading: modesLoading } = usePaymentModes();
  const createReceipt = useSchemeReceipt();

  const today = todayDateString();

  const {
    register, handleSubmit, control, setValue, reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      amount:        enrollment?.schemeAmount ?? '',
      mode_id:       '',
      mode_name:     '',
      document_date: today,
    },
  });

  const onSubmit = async (data) => {
    const amount = Number(data.amount);
    // ledger_id — confirmed 2026-07-16 via real SchemeReceipt/List data,
    // sourced from the selected mode's own ledger_id (see usePaymentModes.js).
    const selectedMode = paymentModes.find((m) => m.modeId === Number(data.mode_id));

    await createReceipt.mutateAsync({
      scheme_enrollment_id: enrollment.enrollmentId,
      party_id:             enrollment.partyId,
      company_id:           storeId,
      document_date:        data.document_date,
      currency_id:          APP_CONFIG.CURRENCY.INR_ID,
      exchange_rate:        1,
      amount,
      scheme_receipt_details: [{
        mode_id:   Number(data.mode_id),
        amount,
        ledger_id: selectedMode?.ledgerId ?? undefined,
      }],
    });
    reset();
    onClose();
  };

  if (!enrollment) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Record Payment">
      <div className="flex flex-col gap-4">

        {/* Enrollment summary */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm flex flex-col gap-1">
          <p className="font-medium text-stone-800">{enrollment.schemeName}</p>
          <p className="text-stone-500">
            Monthly: {formatCurrency(enrollment.schemeAmount)} ·{' '}
            Paid so far: {formatCurrency(enrollment.investedAmount)}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

          {/* Amount */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rcpt_amount">
              Amount (₹) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">₹</span>
              <Input
                id="rcpt_amount"
                type="number"
                inputMode="decimal"
                {...register('amount')}
                className="h-11 pl-7"
              />
            </div>
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          {/* Payment mode */}
          <div className="flex flex-col gap-1.5">
            <Label>Payment Mode <span className="text-destructive">*</span></Label>
            <PaymentModeSelect
              control={control}
              name="mode_id"
              paymentModes={paymentModes}
              modesLoading={modesLoading}
              placeholder="Select mode"
              onSelect={(mode) => setValue('mode_name', mode.modeName)}
            />
            {errors.mode_id && <p className="text-xs text-destructive">{errors.mode_id.message}</p>}
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rcpt_date">Payment Date <span className="text-destructive">*</span></Label>
            <Input id="rcpt_date" type="date" max={today} {...register('document_date')} className="h-11" />
            {errors.document_date && <p className="text-xs text-destructive">{errors.document_date.message}</p>}
          </div>

          <Button type="submit" disabled={createReceipt.isPending} className="h-11">
            {createReceipt.isPending ? 'Recording…' : 'Record Payment'}
          </Button>
        </form>
      </div>
    </BottomSheet>
  );
}

// ── Schemes Tab ───────────────────────────────────────────────
function SchemesTab() {
  const { schemes, isLoading, isError, refetch } = useSchemes();

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-6">
        <p className="text-sm text-muted-foreground text-center">Failed to load schemes. Please try again.</p>
        <button onClick={() => refetch()} className="flex items-center gap-2 text-sm font-medium text-primary">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (schemes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 p-6">
        <LayoutGrid className="w-10 h-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground text-center">No schemes available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Enroll CTA */}
      <Button asChild className="w-full gap-2">
        <Link href="/schemes/enroll">
          <Plus size={16} /> Enroll Customer
        </Link>
      </Button>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {schemes.map((scheme) => (
          <SchemeCard key={scheme.scheme_id} scheme={scheme} />
        ))}
      </div>
    </div>
  );
}

// ── Enrollments Tab ───────────────────────────────────────────
function EnrollmentsTab() {
  const customerId   = useSelector(selectCartCustomerId);
  const customerName = useSelector(selectCartCustomerName);

  // If customer is attached, show their enrollments; else show all store enrollments
  const { data: enrollments = [], isLoading, isError, refetch } =
    useSchemeEnrollments(customerId ? { partyId: customerId } : {});

  const [receiptTarget, setReceiptTarget] = useState(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-stone-500">
        <AlertCircle size={20} />
        <p className="text-sm">Failed to load enrollments.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Context banner */}
      {customerId && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Showing enrollments for <strong>{customerName}</strong>
        </div>
      )}

      {enrollments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-stone-400">
          <LayoutGrid size={28} className="opacity-40" />
          <p className="text-sm">
            {customerId ? 'No enrollments for this customer.' : 'No enrollments found.'}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/schemes/enroll"><Plus size={14} className="mr-1" /> Enroll Now</Link>
          </Button>
        </div>
      ) : (
        enrollments.map((enrollment) => (
          <div key={enrollment.enrollmentId} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-stone-800">{enrollment.schemeName}</p>
                <p className="text-xs text-stone-400">{enrollment.partyName} · {enrollment.mobile}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                STATUS_STYLES[enrollment.status] ?? STATUS_STYLES.default
              }`}>
                {enrollment.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-stone-500">Monthly</span>
              <span className="text-right font-medium text-stone-700">
                {formatCurrency(enrollment.schemeAmount)}
              </span>

              <span className="text-stone-500">Tenure</span>
              <span className="text-right font-medium text-stone-700">
                {enrollment.tenure} months
              </span>

              <span className="text-stone-500">Invested</span>
              <span className="text-right font-medium text-stone-700">
                {formatCurrency(enrollment.investedAmount)}
              </span>

              {enrollment.benefitAmount > 0 && (
                <>
                  <span className="text-stone-500">Benefit</span>
                  <span className="text-right font-medium text-emerald-700">
                    {formatCurrency(enrollment.benefitAmount)}
                  </span>
                </>
              )}

              <span className="text-stone-500">Enrolled</span>
              <span className="text-right text-stone-500 text-xs">
                {formatDate(enrollment.documentDate)}
              </span>
            </div>

            {enrollment.hasPendingInstallment && (
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => setReceiptTarget(enrollment)}
              >
                Record Payment
              </Button>
            )}
          </div>
        ))
      )}

      {/* Receipt sheet */}
      <ReceiptSheet
        enrollment={receiptTarget}
        isOpen={!!receiptTarget}
        onClose={() => setReceiptTarget(null)}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
function SchemesScreen() {
  const [activeTab, setActiveTab] = useState('schemes');

  const TABS = [
    { key: 'schemes',     label: 'Schemes' },
    { key: 'enrollments', label: 'Enrollments' },
  ];

  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">Schemes</h1>
      </div>

      <div className="mb-4">
        <PillTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === 'schemes'     && <SchemesTab />}
      {activeTab === 'enrollments' && <EnrollmentsTab />}
    </div>
  );
}

export default function SchemesPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <SchemesScreen />
    </Suspense>
  );
}