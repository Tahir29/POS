'use client';

// src/app/(pos)/repair/page.jsx
//
// Repair workflow — 3 linked stages, one tab each:
//   Repair In  — customer drops off an item for repair (intake)
//   Repair Out — item sent to the craftsman/workshop
//   Repair Invoice — item back, customer billed and paid
//
// Confirmed 2026-07-16 via real API data: each stage's line item carries a
// real catalog item_id (repairs here are on items this store actually
// sold/tracks, found by SKU) — RepairOut references the RepairIn
// transaction it came from (ref_transaction_id), and RepairInvoice
// references the RepairOut it's billing. Reuses ItemSearchPicker from the
// Exchange/Buyback rebuild for the intake item lookup, and a lightweight
// "pick from recent records" list for the Out/Invoice stages instead of
// re-searching the catalog (staff pick the specific job, not an item).
//
// Same systemic AccessDenied blocker as every other POS transaction Create
// endpoint applies here too (confirmed via direct API test) — payloads are
// built correctly and ready for when OrnaVerse resolves the OAuth scope gap.

import { Suspense, useState } from 'react';
import { useSelector }        from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver }        from '@hookform/resolvers/zod';
import { z }                  from 'zod';
import { toast }              from 'react-toastify';
import {
  Wrench, Hammer, Receipt, ChevronRight,
  RefreshCw, Plus, X,
} from 'lucide-react';

import {
  useRepairIns, useRepairOuts, useRepairInvoices,
} from '@/hooks/repair/useRepairLists';
import {
  useCreateRepairIn,      usePostRepairIn,
  useCreateRepairOut,     usePostRepairOut,
  useCreateRepairInvoice, usePostRepairInvoice, useCreateRepairInvoiceReceipt,
} from '@/hooks/repair/useRepairMutations';
import { usePaymentModes }     from '@/hooks/checkout/usePaymentModes';
import ItemSearchPicker        from '@/components/features/transactions/ItemSearchPicker';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { selectCartCustomerId, selectCartCustomerName } from '@/store/slices/cartSlice';
import APP_CONFIG               from '@/constants/appConfig';
import { todayDateString } from '@/lib/dateUtils';

import PageLoader from '@/components/shared/PageLoader';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import PaymentModeSelect from '@/components/shared/PaymentModeSelect';
import PillTabs from '@/components/shared/PillTabs';
import ListRowsSkeleton from '@/components/shared/ListRowsSkeleton';
import CustomerAttachedBanner from '@/components/shared/CustomerAttachedBanner';

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

// Picks one record from a recent-records list (Repair In, for Repair Out;
// Repair Out, for Repair Invoice) — staff pick the specific job by document
// number, not a fresh catalog search.
function RecordPicker({ records, isLoading, selected, onSelect, emptyMessage }) {
  if (isLoading) return <p className="text-xs text-muted-foreground py-2">Loading…</p>;
  if (records.length === 0) return <p className="text-xs text-muted-foreground py-2">{emptyMessage}</p>;

  if (selected) {
    const item = selected.lineItems?.[0];
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-input bg-muted/30 px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{selected.documentNo}</p>
          <p className="truncate text-xs text-muted-foreground">
            {selected.customerName} {item?.item_name ? `· ${item.item_name}` : ''}
          </p>
        </div>
        <button type="button" onClick={() => onSelect(null)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Change selection">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
      {records.map((r) => (
        <button
          key={r.transactionId}
          type="button"
          onClick={() => onSelect(r)}
          className="flex w-full flex-col gap-0.5 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted/50"
        >
          <span className="text-sm font-medium text-foreground">{r.documentNo}</span>
          <span className="text-xs text-muted-foreground">{r.customerName} · {formatDate(r.documentDate)}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Repair In — New form ───────────────────────────────────────────────────────
// Intake: customer drops off an item. Item found by SKU search against the
// master catalog (same picker used for Exchange/Buyback) since repairs here
// are on items this store's own catalog tracks.

const repairInSchema = z.object({
  document_date: z.string().min(1, 'Required'),
  item: z.object({ item_id: z.number() }).nullable().refine((v) => v !== null, { message: 'Select an item' }),
  pieces: z.coerce.number().min(1, 'Min 1'),
  weight: z.coerce.number().min(0, 'Required'),
  bag_no: z.string().optional(),
  certificate_no: z.string().optional(),
  huid: z.string().optional(),
  narration: z.string().optional(),
});

function RepairInNewForm({ onDone }) {
  const storeId       = useSelector(selectActiveStoreId);
  const customerId    = useSelector(selectCartCustomerId);
  const customerName  = useSelector(selectCartCustomerName);

  const create = useCreateRepairIn({ onSuccess: () => {} });
  const post   = usePostRepairIn({ onSuccess: () => onDone() });

  const { register, handleSubmit, control, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(repairInSchema),
    defaultValues: {
      document_date: todayDateString(), item: null, pieces: 1, weight: '',
      bag_no: '', certificate_no: '', huid: '', narration: '',
    },
  });

  const handleItemSelect = (item) => {
    setValue('item', item);
    setValue('weight', item.weight ?? item.net_weight ?? '');
  };

  const onSubmit = async (data) => {
    if (!customerId) return toast.error('Attach a customer to the session before submitting.');
    try {
      const createRes = await create.mutateAsync({
        party_id: customerId, company_id: storeId,
        document_date: data.document_date, currency_id: APP_CONFIG.CURRENCY.INR_ID,
        line_items: [{
          item_id:        data.item.item_id,
          item_code:      data.item.item_code,
          item_name:      data.item.item_name,
          pieces:         Number(data.pieces),
          weight:         Number(data.weight),
          bag_no:         data.bag_no || undefined,
          certificate_no: data.certificate_no || undefined,
          huid:           data.huid || undefined,
          narration:      data.narration || undefined,
        }],
      });
      const transactionId = createRes?.EntityId;
      if (!transactionId) throw new Error('Repair intake failed — no EntityId returned.');
      await post.mutateAsync(transactionId);
      reset();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isSubmitting = create.isPending || post.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <CustomerAttachedBanner customerId={customerId} customerName={customerName} />

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
        <FormField label="Weight (g)" required error={errors.weight}>
          <Input type="number" inputMode="decimal" step="0.001" {...register('weight')} className="h-9 text-sm" />
        </FormField>
      </div>

      <div className="rounded-xl border border-border bg-muted p-3 flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tracking (optional)</p>
        <FormField label="Bag No.">
          <Input {...register('bag_no')} className="h-9 text-sm" placeholder="e.g. BAG314" />
        </FormField>
        <FormField label="Certificate No.">
          <Input {...register('certificate_no')} className="h-9 text-sm" />
        </FormField>
        <FormField label="HUID">
          <Input {...register('huid')} className="h-9 text-sm" />
        </FormField>
      </div>

      <FormField label="Narration (optional)">
        <Input {...register('narration')} className="h-11" placeholder="What needs repair" />
      </FormField>

      <Button type="submit" disabled={isSubmitting || !customerId} className="h-12 mt-1">
        {isSubmitting ? 'Recording Intake…' : 'Record Repair Intake'}
      </Button>
    </form>
  );
}

// ─── Repair Out — New form ──────────────────────────────────────────────────────
// Send an intake item to the craftsman. Picks the RepairIn job it belongs
// to (ref_transaction_id) rather than searching the catalog again — the
// item is already identified.

const repairOutSchema = z.object({
  document_date: z.string().min(1, 'Required'),
  location_id: z.coerce.number().min(1, 'Required'),
  item_rate: z.coerce.number().min(0, 'Required'),
});

function RepairOutNewForm({ onDone }) {
  const storeId = useSelector(selectActiveStoreId);
  const { items: repairIns, isLoading: repairInsLoading } = useRepairIns({});
  const [selectedIn, setSelectedIn] = useState(null);

  const create = useCreateRepairOut({ onSuccess: () => {} });
  const post   = usePostRepairOut({ onSuccess: () => onDone() });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(repairOutSchema),
    defaultValues: { document_date: todayDateString(), location_id: '', item_rate: '' },
  });

  const onSubmit = async (data) => {
    if (!selectedIn) return toast.error('Select the repair intake this item belongs to.');
    const item = selectedIn.lineItems?.[0];
    if (!item) return toast.error('Selected intake has no item on record.');
    try {
      const createRes = await create.mutateAsync({
        party_id: selectedIn.customerId, company_id: storeId,
        document_date: data.document_date, currency_id: APP_CONFIG.CURRENCY.INR_ID,
        ref_transaction_id: selectedIn.transactionId,
        line_items: [{
          item_id:    item.item_id,
          item_code:  item.item_code,
          item_name:  item.item_name,
          pieces:     item.pieces ?? 1,
          weight:     item.weight,
          location_id: Number(data.location_id),
          item_rate:  Number(data.item_rate),
        }],
      });
      const transactionId = createRes?.EntityId;
      if (!transactionId) throw new Error('Repair-out failed — no EntityId returned.');
      await post.mutateAsync(transactionId);
      reset();
      setSelectedIn(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isSubmitting = create.isPending || post.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <FormField label="Repair Intake" required>
        <RecordPicker
          records={repairIns}
          isLoading={repairInsLoading}
          selected={selectedIn}
          onSelect={setSelectedIn}
          emptyMessage="No repair intakes found."
        />
      </FormField>

      <FormField label="Date" required error={errors.document_date}>
        <Input type="date" max={todayDateString()} {...register('document_date')} className="h-11" />
      </FormField>

      {/* No confirmed location/workshop master list exists in this app yet —
          plain numeric input until one is built. */}
      <FormField label="Workshop/Location ID" required error={errors.location_id}>
        <Input type="number" inputMode="numeric" {...register('location_id')} className="h-11" />
      </FormField>

      <FormField label="Estimated Labour Cost (₹)" required error={errors.item_rate}>
        <Input type="number" inputMode="decimal" {...register('item_rate')} className="h-11" />
      </FormField>

      <Button type="submit" disabled={isSubmitting || !selectedIn} className="h-12 mt-1">
        {isSubmitting ? 'Sending…' : 'Send to Craftsman'}
      </Button>
    </form>
  );
}

// ─── Repair Invoice — New form ───────────────────────────────────────────────────
// Item is back from the craftsman — bill the customer. Picks the RepairOut
// job it's completing, sets the final charge, and takes payment.

const repairInvoiceSchema = z.object({
  document_date: z.string().min(1, 'Required'),
  item_rate: z.coerce.number().min(0, 'Required'),
  mode_id: z.coerce.number().min(1, 'Select payment mode'),
});

function RepairInvoiceNewForm({ onDone }) {
  const storeId = useSelector(selectActiveStoreId);
  const { items: repairOuts, isLoading: repairOutsLoading } = useRepairOuts({});
  const { paymentModes, isLoading: modesLoading } = usePaymentModes();
  const [selectedOut, setSelectedOut] = useState(null);

  const create      = useCreateRepairInvoice({ onSuccess: () => {} });
  const post        = usePostRepairInvoice({ onSuccess: () => {} });
  const addReceipt  = useCreateRepairInvoiceReceipt({ onSuccess: () => onDone() });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    resolver: zodResolver(repairInvoiceSchema),
    defaultValues: { document_date: todayDateString(), item_rate: '', mode_id: '' },
  });

  const onSubmit = async (data) => {
    if (!selectedOut) return toast.error('Select the repair job this invoice is for.');
    const item = selectedOut.lineItems?.[0];
    if (!item) return toast.error('Selected job has no item on record.');

    const itemRate = Number(data.item_rate);
    const selectedMode = paymentModes.find((m) => m.modeId === Number(data.mode_id));

    try {
      const createRes = await create.mutateAsync({
        party_id: selectedOut.customerId, company_id: storeId,
        document_date: data.document_date, currency_id: APP_CONFIG.CURRENCY.INR_ID,
        ref_transaction_id: selectedOut.transactionId,
        line_items: [{
          item_id:    item.item_id,
          item_code:  item.item_code,
          item_name:  item.item_name,
          pieces:     item.pieces ?? 1,
          weight:     item.weight,
          item_rate:  itemRate,
          sub_total:  itemRate,
          net_amount: itemRate,
        }],
      });
      const transactionId = createRes?.EntityId;
      if (!transactionId) throw new Error('Repair invoice failed — no EntityId returned.');
      await post.mutateAsync(transactionId);

      // ledger_id sourced from the selected mode — same pattern as Refund
      // and Scheme Receipt (see usePaymentModes.js normalizeMode).
      await addReceipt.mutateAsync({
        transaction_id: transactionId,
        party_id:       selectedOut.customerId,
        company_id:     storeId,
        amount:         itemRate,
        mode_id:        Number(data.mode_id),
        ledger_id:      selectedMode?.ledgerId ?? undefined,
      });

      reset();
      setSelectedOut(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isSubmitting = create.isPending || post.isPending || addReceipt.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <FormField label="Repair Job" required>
        <RecordPicker
          records={repairOuts}
          isLoading={repairOutsLoading}
          selected={selectedOut}
          onSelect={setSelectedOut}
          emptyMessage="No repair-out jobs found."
        />
      </FormField>

      <FormField label="Date" required error={errors.document_date}>
        <Input type="date" max={todayDateString()} {...register('document_date')} className="h-11" />
      </FormField>

      <FormField label="Labour Charge (₹)" required error={errors.item_rate}>
        <Input type="number" inputMode="decimal" {...register('item_rate')} className="h-11" />
      </FormField>

      <FormField label="Payment Method" required error={errors.mode_id}>
        <PaymentModeSelect control={control} name="mode_id" paymentModes={paymentModes} modesLoading={modesLoading} />
      </FormField>

      <Button type="submit" disabled={isSubmitting || !selectedOut} className="h-12 mt-1">
        {isSubmitting ? 'Billing…' : 'Create Repair Invoice'}
      </Button>
    </form>
  );
}

// ─── List views ───────────────────────────────────────────────────────────────

function RepairList({ hook: useHook, emptyMessage }) {
  const { items, isLoading, isError, refetch } = useHook({});

  if (isLoading) return <ListRowsSkeleton />;

  if (isError) return (
    <div className="flex flex-col items-center gap-3 py-12">
      <p className="text-sm text-muted-foreground">Failed to load records.</p>
      <button onClick={refetch} className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  );

  if (!items.length) return <p className="text-sm text-muted-foreground text-center py-12">{emptyMessage}</p>;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {items.map((item) => (
        <div key={item.transactionId} className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border last:border-0">
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{item.documentNo ?? `#${item.transactionId}`}</p>
            <p className="text-xs text-muted-foreground truncate">{item.customerName ?? 'Unknown customer'}</p>
            <p className="text-xs text-muted-foreground">{formatDate(item.documentDate)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {item.amount != null && <p className="text-sm font-semibold text-foreground tabular-nums">{formatINR(item.amount)}</p>}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'in',      label: 'Repair In',      icon: Wrench,  hook: useRepairIns,      emptyMessage: 'No repair intakes found.', NewForm: (props) => <RepairInNewForm {...props} /> },
  { id: 'out',     label: 'Repair Out',     icon: Hammer,  hook: useRepairOuts,     emptyMessage: 'No repair-out records found.', NewForm: (props) => <RepairOutNewForm {...props} /> },
  { id: 'invoice', label: 'Repair Invoice', icon: Receipt, hook: useRepairInvoices, emptyMessage: 'No repair invoices found.', NewForm: (props) => <RepairInvoiceNewForm {...props} /> },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function RepairScreen() {
  const storeId = useSelector((state) => state.store.activeStoreId);
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [view, setView]           = useState('list');

  const activeTabConfig = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const handleTabChange = (id) => {
    setActiveTab(id);
    setView('list');
  };

  return (
    <div className="p-4 pb-8 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Repair</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Intake, craftsman handoff, and billing</p>
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
          <p className="text-sm text-muted-foreground">No store selected. Please switch to a store to view repairs.</p>
        </div>
      )}

      {storeId && (
        <>
          <PillTabs
            tabs={TABS}
            value={activeTab}
            onChange={handleTabChange}
            getKey={(t) => t.id}
            variant="chip"
            scrollable
            className="pb-1 -mx-4 px-4"
          />

          {view === 'list' && (
            <RepairList key={activeTab} hook={activeTabConfig.hook} emptyMessage={activeTabConfig.emptyMessage} />
          )}

          {view === 'new' && (
            <div key={`new-${activeTab}`} className="rounded-xl border border-border bg-card p-4">
              <activeTabConfig.NewForm onDone={() => setView('list')} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function RepairPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RepairScreen />
    </Suspense>
  );
}
