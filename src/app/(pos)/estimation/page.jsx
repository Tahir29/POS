'use client';

// src/app/(pos)/estimation/page.jsx
//
// Estimation / Quotation — give a customer a price quote before they
// commit to a purchase. Confirmed 2026-07-16 via real API data: line items
// reference a genuine catalog item_id (same shape as Invoice line items),
// so this reuses ItemSearchPicker from the Exchange/Buyback/Repair rebuild.
//
// UNLIKE every other POS transaction type here, Create and Post are NOT
// chained together automatically — Post means "customer agreed, convert
// this quote into a sale," which is a deliberate action taken later (maybe
// days later), not an automatic finalisation step. So Create just saves
// the draft quote; Convert/Cancel are separate per-record actions in the list.
//
// Same systemic AccessDenied blocker as every other POS transaction Create
// endpoint applies here too (confirmed via direct API test).

import { Suspense, useState } from 'react';
import { useSelector }        from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver }        from '@hookform/resolvers/zod';
import { z }                  from 'zod';
import { toast }              from 'react-toastify';
import { FileText, ChevronRight, RefreshCw, Plus, X, Check, Ban } from 'lucide-react';

import { useEstimations } from '@/hooks/estimation/useEstimationList';
import {
  useCreateEstimation, usePostEstimation, useCancelEstimation,
} from '@/hooks/estimation/useEstimationMutations';
import ItemSearchPicker        from '@/components/features/transactions/ItemSearchPicker';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { selectCartCustomerId, selectCartCustomerName } from '@/store/slices/cartSlice';
import APP_CONFIG from '@/constants/appConfig';
import { todayDateString } from '@/lib/dateUtils';

import PageLoader from '@/components/shared/PageLoader';
import ListRowsSkeleton from '@/components/shared/ListRowsSkeleton';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount) {
  if (amount == null) return '—';
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.Message ??
    error?.response?.data?.message ??
    error?.message ??
    'Something went wrong.'
  );
}

function FormField({ label, required, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error.message}</p>}
    </div>
  );
}

function CustomerBanner({ customerId, customerName }) {
  return (
    <div className={`rounded-xl border p-3 text-sm ${customerId ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      {customerId
        ? <p className="text-emerald-700">Customer: <strong>{customerName}</strong></p>
        : <p className="text-amber-700">⚠ Attach a customer from the header before submitting.</p>}
    </div>
  );
}

// ─── New Estimation form ────────────────────────────────────────────────────────

const estimationSchema = z.object({
  document_date: z.string().min(1, 'Required'),
  item: z.object({ item_id: z.number() }).nullable().refine((v) => v !== null, { message: 'Select an item' }),
  pieces: z.coerce.number().min(1, 'Min 1'),
  item_rate: z.coerce.number().min(0, 'Required'),
});

function EstimationNewForm({ onDone }) {
  const storeId       = useSelector(selectActiveStoreId);
  const customerId    = useSelector(selectCartCustomerId);
  const customerName  = useSelector(selectCartCustomerName);

  const create = useCreateEstimation({ onSuccess: () => onDone() });

  const { register, handleSubmit, control, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(estimationSchema),
    defaultValues: { document_date: todayDateString(), item: null, pieces: 1, item_rate: '' },
  });

  const handleItemSelect = (item) => {
    setValue('item', item);
    setValue('item_rate', item.item_rate ?? '');
  };

  const onSubmit = async (data) => {
    if (!customerId) return toast.error('Attach a customer to the session before submitting.');
    try {
      const pieces = Number(data.pieces);
      const itemRate = Number(data.item_rate);
      const amount = pieces * itemRate;
      await create.mutateAsync({
        party_id: customerId, company_id: storeId,
        document_date: data.document_date, currency_id: APP_CONFIG.CURRENCY.INR_ID,
        line_items: [{
          item_id:    data.item.item_id,
          item_code:  data.item.item_code,
          item_name:  data.item.item_name,
          pieces,
          item_rate:  itemRate,
          sub_total:  amount,
          net_amount: amount,
        }],
      });
      reset();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <CustomerBanner customerId={customerId} customerName={customerName} />

      <FormField label="Date" required error={errors.document_date}>
        <Input type="date" max={todayDateString()} {...register('document_date')} className="h-11" />
      </FormField>

      <FormField label="Item" required error={errors.item}>
        <Controller
          name="item"
          control={control}
          render={({ field }) => (
            <ItemSearchPicker
              selectedItem={field.value}
              onSelect={handleItemSelect}
              onClear={() => setValue('item', null)}
            />
          )}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-2">
        <FormField label="Pieces" required error={errors.pieces}>
          <Input type="number" inputMode="numeric" min={1} {...register('pieces')} className="h-9 text-sm" />
        </FormField>
        <FormField label="Quoted Rate (₹)" required error={errors.item_rate}>
          <Input type="number" inputMode="decimal" {...register('item_rate')} className="h-9 text-sm" />
        </FormField>
      </div>

      <Button type="submit" disabled={create.isPending || !customerId} className="h-12 mt-1">
        {create.isPending ? 'Saving Quote…' : 'Save Quote'}
      </Button>
    </form>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────

function EstimationRow({ item, onConverted }) {
  const [showActions, setShowActions] = useState(false);
  const post   = usePostEstimation({ onSuccess: () => setShowActions(false) });
  const cancel = useCancelEstimation({ onSuccess: () => setShowActions(false) });

  const isOpen = !item.isOrdered && !item.isClosed;

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => isOpen && setShowActions((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{item.documentNo ?? `#${item.transactionId}`}</p>
          <p className="text-xs text-muted-foreground truncate">{item.customerName ?? 'Unknown customer'}</p>
          <p className="text-xs text-muted-foreground">{formatDate(item.documentDate)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.isOrdered && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Converted</span>}
          {item.isClosed && !item.isOrdered && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">Cancelled</span>}
          <p className="text-sm font-semibold text-foreground tabular-nums">{formatINR(item.amount)}</p>
          {isOpen && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {showActions && isOpen && (
        <div className="flex gap-2 px-4 pb-3">
          <Button
            size="sm" variant="outline" className="flex-1 gap-1.5"
            disabled={post.isPending}
            onClick={() => post.mutateAsync(item.transactionId).then(onConverted)}
          >
            <Check className="w-3.5 h-3.5" /> {post.isPending ? 'Converting…' : 'Convert to Sale'}
          </Button>
          <Button
            size="sm" variant="outline" className="flex-1 gap-1.5 text-destructive hover:text-destructive"
            disabled={cancel.isPending}
            onClick={() => cancel.mutateAsync(item.transactionId)}
          >
            <Ban className="w-3.5 h-3.5" /> {cancel.isPending ? 'Cancelling…' : 'Cancel Quote'}
          </Button>
        </div>
      )}
    </div>
  );
}

function EstimationList() {
  const { items, isLoading, isError, refetch } = useEstimations({});

  if (isLoading) return <ListRowsSkeleton />;

  if (isError) return (
    <div className="flex flex-col items-center gap-3 py-12">
      <p className="text-sm text-muted-foreground">Failed to load quotations.</p>
      <button onClick={refetch} className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  );

  if (!items.length) return <p className="text-sm text-muted-foreground text-center py-12">No quotations found.</p>;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {items.map((item) => (
        <EstimationRow key={item.transactionId} item={item} onConverted={refetch} />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function EstimationScreen() {
  const storeId = useSelector((state) => state.store.activeStoreId);
  const [view, setView] = useState('list');

  return (
    <div className="p-4 pb-8 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Estimation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Price quotes before a purchase</p>
        </div>
        {storeId && (
          <Button
            size="sm"
            variant={view === 'new' ? 'outline' : 'default'}
            className="gap-1.5 shrink-0"
            onClick={() => setView((v) => (v === 'new' ? 'list' : 'new'))}
          >
            {view === 'new' ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> New</>}
          </Button>
        )}
      </div>

      {!storeId && (
        <div className="rounded-xl border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No store selected. Please switch to a store to view quotations.</p>
        </div>
      )}

      {storeId && view === 'list' && <EstimationList />}

      {storeId && view === 'new' && (
        <div className="rounded-xl border border-border bg-card p-4">
          <EstimationNewForm onDone={() => setView('list')} />
        </div>
      )}
    </div>
  );
}

export default function EstimationPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <EstimationScreen />
    </Suspense>
  );
}
