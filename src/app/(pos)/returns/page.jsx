'use client';

// src/app/(pos)/returns/page.jsx
//
// Returns Module — Phase 22
//
// TWO-PANEL FLOW:
//   1. List tab  — shows past returns (read-only history)
//   2. New tab   — staff enters original invoice transaction_id,
//                  selects items to return, picks refund mode, submits
//
// The "New Return" flow does NOT do a live invoice lookup — staff enters
// the invoice transaction_id from the printed invoice. This keeps the flow
// fast and avoids needing a separate invoice-search UI in this screen.
// If OrnaVerse rejects an invalid ref_transaction_id, the error toast is shown.

import { Suspense, useState } from 'react';
import { useSelector } from 'react-redux';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, RotateCcw, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

import { useReturns }      from '@/hooks/returns/useReturns';
import { useCreateReturn } from '@/hooks/returns/useCreateReturn';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { selectCartCustomerId, selectCartCustomerName } from '@/store/slices/cartSlice';
import APP_CONFIG from '@/constants/appConfig';
import { todayDateString } from '@/lib/dateUtils';

import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import PaymentModeSelect from '@/components/shared/PaymentModeSelect';
import PillTabs from '@/components/shared/PillTabs';
import RemoveLineItemButton from '@/components/shared/RemoveLineItemButton';
import CustomerAttachedBanner from '@/components/shared/CustomerAttachedBanner';
import PaymentStatusBadge, { mapReturnStatus } from '@/components/shared/PaymentStatusBadge';
import { usePaymentModes } from '@/hooks/checkout/usePaymentModes';

// ── Zod schema ────────────────────────────────────────────────
const returnLineItemSchema = z.object({
  item_id:    z.coerce.number().min(1, 'Required'),
  item_name:  z.string().optional(),
  pieces:     z.coerce.number().min(1, 'Min 1'),
  item_rate:  z.coerce.number().min(0, 'Required'),
  net_amount: z.coerce.number().min(0, 'Required'),
});

const returnSchema = z.object({
  ref_transaction_id: z.coerce.number().min(1, 'Enter the original invoice ID'),
  document_date:      z.string().min(1, 'Required'),
  line_items:         z.array(returnLineItemSchema).min(1, 'Add at least one item'),
  refund_mode_id:     z.coerce.number().min(1, 'Select refund method'),
  refund_mode_name:   z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────
function formatCurrency(amount) {
  return `₹${Number(amount ?? 0).toLocaleString('en-IN')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN');
}

// ── Returns List Tab ──────────────────────────────────────────
function ReturnsListTab() {
  const [page, setPage] = useState(1);
  const { returns, totalCount, isLoading, isError, refetch } = useReturns({ page });

  const pageSize   = APP_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE ?? 50;
  const totalPages = Math.ceil(totalCount / pageSize);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <AlertCircle size={20} />
        <p className="text-sm">Failed to load returns.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (returns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
        <RotateCcw size={28} className="opacity-40" />
        <p className="text-sm">No returns found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {returns.map((ret) => (
        <div key={ret.transactionId} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">{ret.documentNo ?? `#${ret.transactionId}`}</p>
              <p className="text-xs text-muted-foreground">{formatDate(ret.documentDate)}</p>
            </div>
            <PaymentStatusBadge status={mapReturnStatus(ret.status)} size="sm" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{ret.partyName || '—'}</span>
            <span className="font-semibold text-foreground">{formatCurrency(ret.netAmount)}</span>
          </div>
        </div>
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ── New Return Tab ────────────────────────────────────────────
function NewReturnTab() {
  const storeId      = useSelector(selectActiveStoreId);
  const customerId   = useSelector(selectCartCustomerId);
  const customerName = useSelector(selectCartCustomerName);

  const createReturn = useCreateReturn();
  const { paymentModes, isLoading: modesLoading } = usePaymentModes();

  const today = todayDateString();

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      ref_transaction_id: '',
      document_date:      today,
      line_items: [{ item_id: '', item_name: '', pieces: 1, item_rate: '', net_amount: '' }],
      refund_mode_id:   '',
      refund_mode_name: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' });

  const watchedItems = watch('line_items');
  const totalReturnAmount = watchedItems.reduce((sum, item) => sum + (Number(item.net_amount) || 0), 0);

  const onSubmit = async (data) => {
    if (!customerId) {
      toast.error('Attach a customer to the session before creating a return.');
      return;
    }

    await createReturn.mutateAsync({
      party_id:           customerId,
      company_id:         storeId,
      document_date:      data.document_date,
      currency_id:        APP_CONFIG.CURRENCY.INR_ID,
      ref_transaction_id: data.ref_transaction_id,
      line_items: data.line_items.map((item) => ({
        item_id:    Number(item.item_id),
        pieces:     Number(item.pieces),
        item_rate:  Number(item.item_rate),
        net_amount: Number(item.net_amount),
      })),
      receipt_details: [{
        mode_id:  data.refund_mode_id,
        amount:   totalReturnAmount,
      }],
    });

    reset({
      ref_transaction_id: '',
      document_date:      today,
      line_items: [{ item_id: '', item_name: '', pieces: 1, item_rate: '', net_amount: '' }],
      refund_mode_id:   '',
      refund_mode_name: '',
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

      {/* Customer context */}
      <CustomerAttachedBanner
        customerId={customerId}
        customerName={customerName}
        emptyMessage="Attach a customer from the header before submitting a return."
      />

      {/* Original invoice ID */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ret_ref_id">
          Original Invoice ID <span className="text-destructive">*</span>
        </Label>
        <Input
          id="ret_ref_id"
          type="number"
          inputMode="numeric"
          placeholder="Enter transaction_id from invoice"
          {...register('ref_transaction_id')}
          className="h-11"
        />
        {errors.ref_transaction_id && (
          <p className="text-xs text-destructive">{errors.ref_transaction_id.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Find the transaction ID on the printed invoice or in the Invoices list.
        </p>
      </div>

      {/* Return date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ret_date">Return Date <span className="text-destructive">*</span></Label>
        <Input id="ret_date" type="date" max={today} {...register('document_date')} className="h-11" />
        {errors.document_date && (
          <p className="text-xs text-destructive">{errors.document_date.message}</p>
        )}
      </div>

      {/* Line items */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Items Being Returned <span className="text-destructive">*</span></Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => append({ item_id: '', item_name: '', pieces: 1, item_rate: '', net_amount: '' })}
          >
            <Plus size={12} /> Add Item
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="rounded-xl border border-border bg-muted p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
              {fields.length > 1 && (
                <RemoveLineItemButton onClick={() => remove(index)} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Item ID <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="item_id"
                  {...register(`line_items.${index}.item_id`)}
                  className="h-9 text-sm"
                />
                {errors.line_items?.[index]?.item_id && (
                  <p className="text-xs text-destructive">{errors.line_items[index].item_id.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs">Pieces <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  {...register(`line_items.${index}.pieces`)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs">Rate (₹) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...register(`line_items.${index}.item_rate`)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-xs">Net Amount (₹) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...register(`line_items.${index}.net_amount`)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
        ))}

        {errors.line_items?.root && (
          <p className="text-xs text-destructive">{errors.line_items.root.message}</p>
        )}
        {typeof errors.line_items === 'object' && errors.line_items?.message && (
          <p className="text-xs text-destructive">{errors.line_items.message}</p>
        )}
      </div>

      {/* Total */}
      {totalReturnAmount > 0 && (
        <div className="flex justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium">
          <span className="text-muted-foreground">Total Return Amount</span>
          <span className="text-foreground">{formatCurrency(totalReturnAmount)}</span>
        </div>
      )}

      {/* Refund mode */}
      <div className="flex flex-col gap-1.5">
        <Label>Refund Method <span className="text-destructive">*</span></Label>
        <PaymentModeSelect
          control={control}
          name="refund_mode_id"
          paymentModes={paymentModes}
          modesLoading={modesLoading}
          placeholder="Select refund method"
          onSelect={(mode) => setValue('refund_mode_name', mode.modeName)}
        />
        {errors.refund_mode_id && (
          <p className="text-xs text-destructive">{errors.refund_mode_id.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={createReturn.isPending || !customerId}
        className="h-12 mt-1"
      >
        {createReturn.isPending ? 'Processing Return…' : 'Submit Return'}
      </Button>

    </form>
  );
}

// ── Page wrapper ──────────────────────────────────────────────
function ReturnsScreen() {
  const [activeTab, setActiveTab] = useState('list');

  const TABS = [
    { key: 'list', label: 'Return History' },
    { key: 'new',  label: 'New Return' },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 pb-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <RotateCcw size={20} className="text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Returns</h1>
      </div>

      {/* Tab bar */}
      <PillTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'list' && <ReturnsListTab />}
      {activeTab === 'new'  && <NewReturnTab />}
    </div>
  );
}

export default function ReturnsPage() {
  return (
    <Suspense>
      <ReturnsScreen />
    </Suspense>
  );
}