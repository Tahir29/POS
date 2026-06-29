'use client';

// src/app/(pos)/daily-closing/page.jsx
//
// Daily Closing — End of Day Screen
//
// TWO TABS:
//   History — past closing records for this store
//   New Closing — EOD form: date, opening balance, per-mode sales totals, notes
//
// The form collects sales by payment mode manually (staff enters the
// physical cash count + card/UPI totals from the day). OrnaVerse stores
// this as the official EOD record.
//
// Field note: the exact DailyClosingRow schema is not confirmed from a
// live Postman response. The fields used here match the API endpoint
// comment in apiEndpoints.js. If OrnaVerse returns a validation error,
// check the response body for the correct field names.

import { Suspense, useState } from 'react';
import { useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ClipboardCheck, AlertCircle, ChevronDown } from 'lucide-react';

import { useDailyClosing }       from '@/hooks/dailyClosing/useDailyClosing';
import { useCreateDailyClosing } from '@/hooks/dailyClosing/useCreateDailyClosing';
import { selectActiveStoreId }   from '@/store/slices/storeSlice';

import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';

// ── Schema ────────────────────────────────────────────────────
const closingSchema = z.object({
  closing_date:     z.string().min(1, 'Required'),
  opening_balance:  z.coerce.number().min(0, 'Enter 0 or above'),
  cash_sales:       z.coerce.number().min(0, 'Enter 0 or above'),
  card_sales:       z.coerce.number().min(0, 'Enter 0 or above'),
  upi_sales:        z.coerce.number().min(0, 'Enter 0 or above'),
  other_sales:      z.coerce.number().min(0, 'Enter 0 or above'),
  notes:            z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────
function formatCurrency(n) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN');
}

// ── History Tab ───────────────────────────────────────────────
function HistoryTab() {
  const [page, setPage] = useState(1);
  const { closings, totalCount, isLoading, isError, refetch } = useDailyClosing({ page });
  const totalPages = Math.ceil(totalCount / 30);

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
        <p className="text-sm">Failed to load closing records.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (closings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-stone-400">
        <ClipboardCheck size={28} className="opacity-40" />
        <p className="text-sm">No closing records yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {closings.map((c) => (
        <div key={c.closingId} className="rounded-xl border border-stone-200 bg-white p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-stone-800">{formatDate(c.closingDate)}</p>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              Closed
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="text-stone-500">Opening</span>
            <span className="text-right font-medium text-stone-700">{formatCurrency(c.openingBalance)}</span>

            <span className="text-stone-500">Cash Sales</span>
            <span className="text-right font-medium text-stone-700">{formatCurrency(c.cashSales)}</span>

            <span className="text-stone-500">Card Sales</span>
            <span className="text-right font-medium text-stone-700">{formatCurrency(c.cardSales)}</span>

            <span className="text-stone-500">UPI Sales</span>
            <span className="text-right font-medium text-stone-700">{formatCurrency(c.upiSales)}</span>

            {c.otherSales > 0 && (
              <>
                <span className="text-stone-500">Other</span>
                <span className="text-right font-medium text-stone-700">{formatCurrency(c.otherSales)}</span>
              </>
            )}

            <span className="text-stone-500 border-t border-stone-100 pt-1 mt-1">Total Sales</span>
            <span className="text-right font-bold text-stone-800 border-t border-stone-100 pt-1 mt-1">
              {formatCurrency(c.totalSales)}
            </span>

            <span className="text-stone-500">Closing Balance</span>
            <span className="text-right font-medium text-stone-700">{formatCurrency(c.closingBalance)}</span>
          </div>

          {c.notes && (
            <p className="text-xs text-stone-400 border-t border-stone-100 pt-2">{c.notes}</p>
          )}
        </div>
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-stone-400">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ── New Closing Tab ───────────────────────────────────────────
function NewClosingTab() {
  const storeId      = useSelector(selectActiveStoreId);
  const createClosing = useCreateDailyClosing();

  const today = new Date().toISOString().split('T')[0];

  const {
    register, handleSubmit, watch, reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(closingSchema),
    defaultValues: {
      closing_date:    today,
      opening_balance: '',
      cash_sales:      '',
      card_sales:      '',
      upi_sales:       '',
      other_sales:     '0',
      notes:           '',
    },
  });

  // Live total
  const watched = watch(['cash_sales', 'card_sales', 'upi_sales', 'other_sales', 'opening_balance']);
  const [cashSales, cardSales, upiSales, otherSales, openingBalance] = watched.map(Number);
  const totalSales     = (cashSales || 0) + (cardSales || 0) + (upiSales || 0) + (otherSales || 0);
  const closingBalance = (openingBalance || 0) + (cashSales || 0); // cash in hand at EOD

  const onSubmit = async (data) => {
    const totalSalesCalc = Number(data.cash_sales) + Number(data.card_sales) +
                           Number(data.upi_sales)  + Number(data.other_sales);
    const closingBalanceCalc = Number(data.opening_balance) + Number(data.cash_sales);

    await createClosing.mutateAsync({
      company_id:      storeId,
      closing_date:    data.closing_date,
      opening_balance: Number(data.opening_balance),
      cash_sales:      Number(data.cash_sales),
      card_sales:      Number(data.card_sales),
      upi_sales:       Number(data.upi_sales),
      other_sales:     Number(data.other_sales),
      total_sales:     totalSalesCalc,
      closing_balance: closingBalanceCalc,
      notes:           data.notes || '',
    });

    reset({
      closing_date:    today,
      opening_balance: '',
      cash_sales:      '',
      card_sales:      '',
      upi_sales:       '',
      other_sales:     '0',
      notes:           '',
    });
  };

  const Field = ({ id, label, name, required }) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">₹</span>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="0.00"
          {...register(name)}
          className="h-11 pl-7"
        />
      </div>
      {errors[name] && <p className="text-xs text-destructive">{errors[name].message}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dc_date">Closing Date <span className="text-destructive">*</span></Label>
        <Input id="dc_date" type="date" {...register('closing_date')} className="h-11" />
        {errors.closing_date && <p className="text-xs text-destructive">{errors.closing_date.message}</p>}
      </div>

      {/* Opening balance */}
      <Field id="dc_opening"  label="Opening Cash Balance" name="opening_balance" required />

      {/* Sales by mode */}
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex flex-col gap-4">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Sales by Payment Mode</p>
        <Field id="dc_cash"  label="Cash Sales"  name="cash_sales"  required />
        <Field id="dc_card"  label="Card Sales"  name="card_sales"  required />
        <Field id="dc_upi"   label="UPI Sales"   name="upi_sales"   required />
        <Field id="dc_other" label="Other Sales" name="other_sales" />
      </div>

      {/* Live summary */}
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-stone-500">Total Sales</span>
          <span className="font-semibold text-stone-800">{formatCurrency(totalSales)}</span>
        </div>
        <div className="flex justify-between border-t border-stone-100 pt-2">
          <span className="text-stone-500">Closing Cash Balance</span>
          <span className="font-bold text-stone-800">{formatCurrency(closingBalance)}</span>
        </div>
        <p className="text-xs text-stone-400">Closing balance = opening balance + cash sales</p>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dc_notes">Notes (optional)</Label>
        <Input id="dc_notes" {...register('notes')} className="h-11" placeholder="Any remarks for today's closing" />
      </div>

      <Button
        type="submit"
        disabled={createClosing.isPending}
        className="h-12 mt-1"
      >
        {createClosing.isPending ? 'Saving Closing…' : 'Submit Day Close'}
      </Button>

    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────
function DailyClosingScreen() {
  const [activeTab, setActiveTab] = useState('new');

  const TABS = [
    { key: 'new',     label: 'Close Today' },
    { key: 'history', label: 'History' },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 pb-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 pt-2">
        <ClipboardCheck size={20} className="text-stone-400" />
        <h1 className="text-xl font-semibold text-stone-800">Daily Closing</h1>
      </div>

      <div className="flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'new'     && <NewClosingTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  );
}

export default function DailyClosingPage() {
  return (
    <Suspense>
      <DailyClosingScreen />
    </Suspense>
  );
}
