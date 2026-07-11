// src/app/(pos)/transactions/page.jsx
'use client';

// PHASE 22.5 — Transaction Architecture Consolidation
//
// Single tabbed page covering all 6 POS transaction types:
//   Returns | Refunds | Credit Notes | Exchange | Buyback | URD Purchase
//
// ARCHITECTURE:
//   - One tab per transaction type. Each tab has two views: List (default)
//     and New (create form), toggled with the header "+ New" / "Cancel" button.
//   - This page is now the ONLY place transactions are created or viewed —
//     the previously-separate /returns, /exchange, /buyback, /urd-purchase
//     standalone pages (and their dedicated services/hooks) have been
//     deleted. Everything here runs on transactionService.js via
//     useTransactionLists.js + useTransactionMutations.js.
//   - Deep-linkable: /transactions?tab=returns opens straight to a tab
//     (dashboard Quick Actions link here).
//
// SCHEMA FACTS:
//   - All transaction rows share: transaction_id, document_no,
//     document_date, party_id, party_name, net_amount
//   - normalizeTransaction (from useTransactionLists) maps these to:
//     transactionId, documentNo, documentDate, customerId,
//     customerName, amount
//   - "NA" string values already nulled out by normalizer
//   - company_id (NOT current_company_id) is the field OrnaVerse expects
//     for POS transaction List/Create calls — current_company_id is the
//     Inventory/ProductCatalog-specific convention, confirmed fixed in
//     transactionService.js as part of this consolidation.
//
// KNOWN GAP (flagged, not guessed):
//   RefundDetailsRow carries a `ledger_id` field in the OrnaVerse schema.
//   No ledger-picker UI exists anywhere in this app yet, so the Refund
//   form below omits it (left undefined) rather than inventing a value.
//   If OrnaVerse rejects a refund detail for missing ledger_id, this is
//   the first place to look — needs a live Postman/UAT check.

import { Suspense, useState, useCallback } from 'react';
import { useSelector }                     from 'react-redux';
import { useRouter, useSearchParams }      from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver }                     from '@hookform/resolvers/zod';
import { z }                               from 'zod';
import { toast }                           from 'react-toastify';
import {
  RotateCcw,
  CreditCard,
  FileText,
  ArrowLeftRight,
  ShoppingBag,
  Coins,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Plus,
  Trash2,
  X,
  Calendar,
  User,
  Hash,
  IndianRupee,
  AlertCircle,
}                                          from 'lucide-react';

import {
  useReturns,
  useRefunds,
  useCreditNotes,
  useExchanges,
  useBuybacks,
  useURDPurchases,
}                                          from '@/hooks/transactions/useTransactionLists';
import {
  useCreateReturn,     usePostReturn,
  useCreateRefund,     useAddRefundDetail, useAddRefundReceipt,
  useCreateCreditNote, usePostCreditNote,
  useCreateExchange,   usePostExchange,
  useCreateBuyback,    usePostBuyback,
  useCreateURDPurchase,usePostURDPurchase,
}                                          from '@/hooks/transactions/useTransactionMutations';
import { usePaymentModes }                from '@/hooks/checkout/usePaymentModes';
import { selectActiveStoreId }            from '@/store/slices/storeSlice';
import { selectCartCustomerId, selectCartCustomerName } from '@/store/slices/cartSlice';
import APP_CONFIG                         from '@/constants/appConfig';

import PageLoader                          from '@/components/shared/PageLoader';
import { Button }                          from '@/components/ui/button';
import { Input }                           from '@/components/ui/input';
import { Label }                           from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.Message ??
    error?.response?.data?.message ??
    error?.message ??
    'Something went wrong.'
  );
}

// ─── Shared field-level building blocks ────────────────────────────────────────

function FormField({ label, required, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error.message}</p>}
    </div>
  );
}

function PaymentModeSelect({ control, name, paymentModes, modesLoading, onSelect }) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const selected = paymentModes.find((m) => m.modeId === field.value);
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm"
              >
                <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
                  {modesLoading ? 'Loading…' : selected ? selected.modeName : 'Select payment mode'}
                </span>
                <ChevronDown size={14} className="text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
              {paymentModes.map((mode) => (
                <DropdownMenuItem
                  key={mode.modeId}
                  onSelect={() => {
                    field.onChange(mode.modeId);
                    onSelect?.(mode);
                  }}
                >
                  {mode.modeName}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }}
    />
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

// ─── Returns — New form ─────────────────────────────────────────────────────────

const returnLineItemSchema = z.object({
  item_id:    z.coerce.number().min(1, 'Required'),
  pieces:     z.coerce.number().min(1, 'Min 1'),
  item_rate:  z.coerce.number().min(0, 'Required'),
  net_amount: z.coerce.number().min(0, 'Required'),
});

const returnSchema = z.object({
  ref_transaction_id: z.coerce.number().min(1, 'Enter the original invoice ID'),
  document_date:      z.string().min(1, 'Required'),
  line_items:         z.array(returnLineItemSchema).min(1, 'Add at least one item'),
  refund_mode_id:     z.coerce.number().min(1, 'Select refund method'),
});

function ReturnNewForm({ onDone }) {
  const storeId       = useSelector(selectActiveStoreId);
  const customerId    = useSelector(selectCartCustomerId);
  const customerName  = useSelector(selectCartCustomerName);
  const { paymentModes, isLoading: modesLoading } = usePaymentModes();

  const createReturn = useCreateReturn({ onSuccess: () => {} });
  const postReturn    = usePostReturn({ onSuccess: () => onDone() });

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      ref_transaction_id: '',
      document_date:      todayISO(),
      line_items: [{ item_id: '', pieces: 1, item_rate: '', net_amount: '' }],
      refund_mode_id: '',
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' });
  const watchedItems = watch('line_items');
  const total = watchedItems.reduce((sum, i) => sum + (Number(i.net_amount) || 0), 0);

  const onSubmit = async (data) => {
    if (!customerId) return toast.error('Attach a customer to the session before creating a return.');
    try {
      const createRes = await createReturn.mutateAsync({
        party_id: customerId, company_id: storeId,
        document_date: data.document_date, currency_id: APP_CONFIG.CURRENCY.INR_ID,
        ref_transaction_id: data.ref_transaction_id,
        line_items: data.line_items.map((i) => ({
          item_id: Number(i.item_id), pieces: Number(i.pieces),
          item_rate: Number(i.item_rate), net_amount: Number(i.net_amount),
        })),
        receipt_details: [{ mode_id: data.refund_mode_id, amount: total }],
      });
      const transactionId = createRes?.EntityId;
      if (!transactionId) throw new Error('Return creation failed — no EntityId returned.');
      await postReturn.mutateAsync(transactionId);
      reset();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isSubmitting = createReturn.isPending || postReturn.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <CustomerBanner customerId={customerId} customerName={customerName} />

      <FormField label="Original Invoice ID" required error={errors.ref_transaction_id}>
        <Input type="number" inputMode="numeric" placeholder="transaction_id from invoice" {...register('ref_transaction_id')} className="h-11" />
        <p className="text-xs text-stone-400">Find this on the printed invoice or in the Invoices list.</p>
      </FormField>

      <FormField label="Return Date" required error={errors.document_date}>
        <Input type="date" {...register('document_date')} className="h-11" />
      </FormField>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Items Being Returned <span className="text-destructive">*</span></Label>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs"
            onClick={() => append({ item_id: '', pieces: 1, item_rate: '', net_amount: '' })}>
            <Plus size={12} /> Add Item
          </Button>
        </div>
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-xl border border-stone-200 bg-stone-50 p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Item {index + 1}</span>
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="text-stone-400 hover:text-destructive" aria-label="Remove item">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Item ID" required error={errors.line_items?.[index]?.item_id}>
                <Input type="number" inputMode="numeric" {...register(`line_items.${index}.item_id`)} className="h-9 text-sm" />
              </FormField>
              <FormField label="Pieces" required>
                <Input type="number" inputMode="numeric" min={1} {...register(`line_items.${index}.pieces`)} className="h-9 text-sm" />
              </FormField>
              <FormField label="Rate (₹)" required>
                <Input type="number" inputMode="decimal" {...register(`line_items.${index}.item_rate`)} className="h-9 text-sm" />
              </FormField>
              <FormField label="Net Amount (₹)" required>
                <Input type="number" inputMode="decimal" {...register(`line_items.${index}.net_amount`)} className="h-9 text-sm" />
              </FormField>
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="flex justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium">
          <span className="text-stone-500">Total Return Amount</span>
          <span className="text-stone-800">{formatINR(total)}</span>
        </div>
      )}

      <FormField label="Refund Method" required error={errors.refund_mode_id}>
        <PaymentModeSelect control={control} name="refund_mode_id" paymentModes={paymentModes} modesLoading={modesLoading} />
      </FormField>

      <Button type="submit" disabled={isSubmitting || !customerId} className="h-12 mt-1">
        {isSubmitting ? 'Processing Return…' : 'Submit Return'}
      </Button>
    </form>
  );
}

// ─── Exchange / Buyback / URD Purchase — shared metal line-item form ───────────
// All three share the same weight/purity/rate shape, differing only in
// whether an item_name description field and a receipt (payout) section
// are shown. Configured per type rather than duplicated three times.

const METAL_TYPE_CONFIGS = {
  exchange: {
    amountField: 'exchange_value',
    hasReceipt:  false, // exchange value is applied as invoice credit, not paid out directly
    hasItemName: true,
    createHook:  useCreateExchange,
    postHook:    usePostExchange,
    submitLabel: 'Submit Exchange',
    processingLabel: 'Processing Exchange…',
  },
  buyback: {
    amountField: 'amount',
    hasReceipt:  true,
    hasItemName: true,
    createHook:  useCreateBuyback,
    postHook:    usePostBuyback,
    submitLabel: 'Submit Buyback',
    processingLabel: 'Processing Buyback…',
  },
  urd: {
    amountField: 'amount',
    hasReceipt:  true,
    hasItemName: false,
    createHook:  useCreateURDPurchase,
    postHook:    usePostURDPurchase,
    submitLabel: 'Submit URD Purchase',
    processingLabel: 'Processing Purchase…',
  },
};

function buildMetalLineItemSchema(config) {
  const shape = {
    metal_type_id: z.coerce.number().min(1, 'Required'),
    weight:        z.coerce.number().min(0.001, 'Required'),
    purity:        z.coerce.number().min(1, 'Required'),
    rate:          z.coerce.number().min(0, 'Required'),
    [config.amountField]: z.coerce.number().min(0, 'Required'),
  };
  if (config.hasItemName) shape.item_name = z.string().min(1, 'Required');
  return z.object(shape);
}

function buildMetalFormSchema(config) {
  const shape = {
    document_date: z.string().min(1, 'Required'),
    line_items:    z.array(buildMetalLineItemSchema(config)).min(1, 'Add at least one item'),
  };
  if (config.hasReceipt) shape.payout_mode_id = z.coerce.number().min(1, 'Select payment mode');
  return z.object(shape);
}

function emptyMetalLineItem(config) {
  const item = { metal_type_id: '', weight: '', purity: '', rate: '', [config.amountField]: '' };
  if (config.hasItemName) item.item_name = '';
  return item;
}

function MetalLineItemForm({ type, onDone }) {
  const config = METAL_TYPE_CONFIGS[type];
  const storeId      = useSelector(selectActiveStoreId);
  const customerId   = useSelector(selectCartCustomerId);
  const customerName = useSelector(selectCartCustomerName);
  const { paymentModes, isLoading: modesLoading } = usePaymentModes();

  const create = config.createHook({ onSuccess: () => {} });
  const post   = config.postHook({ onSuccess: () => onDone() });

  const schema = buildMetalFormSchema(config);

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      document_date: todayISO(),
      line_items: [emptyMetalLineItem(config)],
      ...(config.hasReceipt ? { payout_mode_id: '' } : {}),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' });
  const watchedItems = watch('line_items');
  const total = watchedItems.reduce((sum, i) => sum + (Number(i[config.amountField]) || 0), 0);

  const onSubmit = async (data) => {
    if (!customerId) return toast.error('Attach a customer to the session before submitting.');
    try {
      const payload = {
        party_id: customerId, company_id: storeId,
        document_date: data.document_date, currency_id: APP_CONFIG.CURRENCY.INR_ID,
        line_items: data.line_items.map((i) => {
          const line = {
            metal_type_id: Number(i.metal_type_id),
            weight:        Number(i.weight),
            purity:        Number(i.purity),
            rate:          Number(i.rate),
            [config.amountField]: Number(i[config.amountField]),
          };
          if (config.hasItemName) line.item_name = i.item_name;
          return line;
        }),
      };
      if (config.hasReceipt) {
        payload.receipt_details = [{ mode_id: data.payout_mode_id, amount: total }];
      }
      const createRes = await create.mutateAsync(payload);
      const transactionId = createRes?.EntityId;
      if (!transactionId) throw new Error('Creation failed — no EntityId returned.');
      await post.mutateAsync(transactionId);
      reset();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isSubmitting = create.isPending || post.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <CustomerBanner customerId={customerId} customerName={customerName} />

      <FormField label="Date" required error={errors.document_date}>
        <Input type="date" {...register('document_date')} className="h-11" />
      </FormField>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Line Items <span className="text-destructive">*</span></Label>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs"
            onClick={() => append(emptyMetalLineItem(config))}>
            <Plus size={12} /> Add Item
          </Button>
        </div>
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-xl border border-stone-200 bg-stone-50 p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Item {index + 1}</span>
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="text-stone-400 hover:text-destructive" aria-label="Remove item">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            {config.hasItemName && (
              <FormField label="Description" required error={errors.line_items?.[index]?.item_name}>
                <Input placeholder="e.g. 22k gold chain, worn" {...register(`line_items.${index}.item_name`)} className="h-9 text-sm" />
              </FormField>
            )}
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Metal Type ID" required error={errors.line_items?.[index]?.metal_type_id}>
                <Input type="number" inputMode="numeric" {...register(`line_items.${index}.metal_type_id`)} className="h-9 text-sm" />
              </FormField>
              <FormField label="Weight (g)" required>
                <Input type="number" inputMode="decimal" step="0.001" {...register(`line_items.${index}.weight`)} className="h-9 text-sm" />
              </FormField>
              <FormField label="Purity" required>
                <Input type="number" inputMode="numeric" placeholder="e.g. 750" {...register(`line_items.${index}.purity`)} className="h-9 text-sm" />
              </FormField>
              <FormField label="Rate (₹/g)" required>
                <Input type="number" inputMode="decimal" {...register(`line_items.${index}.rate`)} className="h-9 text-sm" />
              </FormField>
              <FormField label={config.amountField === 'exchange_value' ? 'Exchange Value (₹)' : 'Amount (₹)'} required>
                <Input type="number" inputMode="decimal" {...register(`line_items.${index}.${config.amountField}`)} className="h-9 text-sm" />
              </FormField>
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="flex justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium">
          <span className="text-stone-500">Total</span>
          <span className="text-stone-800">{formatINR(total)}</span>
        </div>
      )}

      {config.hasReceipt && (
        <FormField label="Payout Method" required error={errors.payout_mode_id}>
          <PaymentModeSelect control={control} name="payout_mode_id" paymentModes={paymentModes} modesLoading={modesLoading} />
        </FormField>
      )}

      <Button type="submit" disabled={isSubmitting || !customerId} className="h-12 mt-1">
        {isSubmitting ? config.processingLabel : config.submitLabel}
      </Button>
    </form>
  );
}

// ─── Credit Notes — New form ────────────────────────────────────────────────────
// Issued as a lump-sum store credit rather than an itemised return — matches
// CreditNoteRow, which supports a header net_amount without requiring
// line_items to be populated for a simple issuance.

const creditNoteSchema = z.object({
  document_date:      z.string().min(1, 'Required'),
  net_amount:         z.coerce.number().min(1, 'Enter an amount'),
  ref_transaction_id: z.coerce.number().optional(),
  narration:          z.string().optional(),
});

function CreditNoteNewForm({ onDone }) {
  const storeId       = useSelector(selectActiveStoreId);
  const customerId    = useSelector(selectCartCustomerId);
  const customerName  = useSelector(selectCartCustomerName);

  const create = useCreateCreditNote({ onSuccess: () => {} });
  const post   = usePostCreditNote({ onSuccess: () => onDone() });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: { document_date: todayISO(), net_amount: '', ref_transaction_id: '', narration: '' },
  });

  const onSubmit = async (data) => {
    if (!customerId) return toast.error('Attach a customer to the session before submitting.');
    try {
      const createRes = await create.mutateAsync({
        party_id: customerId, company_id: storeId,
        document_date: data.document_date, currency_id: APP_CONFIG.CURRENCY.INR_ID,
        net_amount: Number(data.net_amount),
        ref_transaction_id: data.ref_transaction_id ? Number(data.ref_transaction_id) : undefined,
        narration: data.narration || undefined,
      });
      const transactionId = createRes?.EntityId;
      if (!transactionId) throw new Error('Credit note creation failed — no EntityId returned.');
      await post.mutateAsync(transactionId);
      reset();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isSubmitting = create.isPending || post.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <CustomerBanner customerId={customerId} customerName={customerName} />

      <FormField label="Date" required error={errors.document_date}>
        <Input type="date" {...register('document_date')} className="h-11" />
      </FormField>

      <FormField label="Credit Amount (₹)" required error={errors.net_amount}>
        <Input type="number" inputMode="decimal" placeholder="0.00" {...register('net_amount')} className="h-11" />
      </FormField>

      <FormField label="Linked Invoice ID (optional)">
        <Input type="number" inputMode="numeric" placeholder="transaction_id, if related to a specific invoice" {...register('ref_transaction_id')} className="h-11" />
      </FormField>

      <FormField label="Narration (optional)">
        <Input placeholder="Reason for issuing credit" {...register('narration')} className="h-11" />
      </FormField>

      <Button type="submit" disabled={isSubmitting || !customerId} className="h-12 mt-1">
        {isSubmitting ? 'Processing Credit Note…' : 'Issue Credit Note'}
      </Button>
    </form>
  );
}

// ─── Refunds — New form ─────────────────────────────────────────────────────────
// Three-step flow: createRefund() header → addRefundDetail() line →
// addRefundReceipt() payment mode (this last call finalises the refund,
// there is no separate Post step for refunds).
//
// ledger_id on RefundDetailsRow is intentionally omitted — see file header note.

const refundSchema = z.object({
  document_date: z.string().min(1, 'Required'),
  amount:        z.coerce.number().min(1, 'Enter an amount'),
  mode_id:       z.coerce.number().min(1, 'Select payment mode'),
  narration:     z.string().optional(),
});

function RefundNewForm({ onDone }) {
  const storeId       = useSelector(selectActiveStoreId);
  const customerId    = useSelector(selectCartCustomerId);
  const customerName  = useSelector(selectCartCustomerName);
  const { paymentModes, isLoading: modesLoading } = usePaymentModes();

  const create     = useCreateRefund({ onSuccess: () => {} });
  const addDetail  = useAddRefundDetail({ onSuccess: () => {} });
  const addReceipt = useAddRefundReceipt({ onSuccess: () => onDone() });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    resolver: zodResolver(refundSchema),
    defaultValues: { document_date: todayISO(), amount: '', mode_id: '', narration: '' },
  });

  const onSubmit = async (data) => {
    if (!customerId) return toast.error('Attach a customer to the session before submitting.');
    try {
      const createRes = await create.mutateAsync({
        party_id: customerId, company_id: storeId,
        document_date: data.document_date, currency_id: APP_CONFIG.CURRENCY.INR_ID,
        total_amount: Number(data.amount),
        narration: data.narration || undefined,
      });
      const transactionId = createRes?.EntityId;
      if (!transactionId) throw new Error('Refund creation failed — no EntityId returned.');

      await addDetail.mutateAsync({
        transaction_id: transactionId,
        amount:         Number(data.amount),
        mode_id:        data.mode_id,
      });

      await addReceipt.mutateAsync({
        transaction_id: transactionId,
        party_id:       customerId,
        company_id:     storeId,
        amount:         Number(data.amount),
        mode_id:        data.mode_id,
      });

      reset();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isSubmitting = create.isPending || addDetail.isPending || addReceipt.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <CustomerBanner customerId={customerId} customerName={customerName} />

      <FormField label="Date" required error={errors.document_date}>
        <Input type="date" {...register('document_date')} className="h-11" />
      </FormField>

      <FormField label="Refund Amount (₹)" required error={errors.amount}>
        <Input type="number" inputMode="decimal" placeholder="0.00" {...register('amount')} className="h-11" />
      </FormField>

      <FormField label="Refund Method" required error={errors.mode_id}>
        <PaymentModeSelect control={control} name="mode_id" paymentModes={paymentModes} modesLoading={modesLoading} />
      </FormField>

      <FormField label="Narration (optional)">
        <Input placeholder="Reason for refund" {...register('narration')} className="h-11" />
      </FormField>

      <Button type="submit" disabled={isSubmitting || !customerId} className="h-12 mt-1">
        {isSubmitting ? 'Processing Refund…' : 'Submit Refund'}
      </Button>
    </form>
  );
}

// ─── Transaction Detail Sheet (unchanged from prior version) ──────────────────

function TransactionDetailSheet({ transaction, onClose }) {
  if (!transaction) return null;
  const raw = transaction.raw ?? {};

  const headerRows = [
    { icon: Hash,        label: 'Document No', value: transaction.documentNo ?? `#${transaction.transactionId}` },
    { icon: Calendar,    label: 'Date',        value: formatDate(transaction.documentDate) },
    { icon: User,        label: 'Customer',    value: transaction.customerName ?? '—' },
    { icon: IndianRupee, label: 'Amount',      value: formatINR(transaction.amount) },
  ];

  const skipKeys = new Set(['transaction_id', 'document_no', 'document_date', 'party_id', 'party_name', 'net_amount', 'company_id', 'current_company_id']);

  const extraRows = Object.entries(raw)
    .filter(([k, v]) => !skipKeys.has(k) && v !== null && v !== undefined && v !== 'NA' && v !== '' && typeof v !== 'object')
    .map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: String(v) }));

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-background border-l border-border z-50 flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground">Transaction</p>
            <p className="text-sm font-semibold text-foreground">{transaction.documentNo ?? `#${transaction.transactionId}`}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 transition-colors" aria-label="Close">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="bg-muted/30 rounded-xl p-4 flex flex-col gap-3">
            {headerRows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium text-foreground break-words">{value}</p>
                </div>
              </div>
            ))}
          </div>
          {extraRows.length > 0 && (
            <div className="flex flex-col gap-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Additional Details</p>
              <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                {extraRows.map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <p className="text-xs text-muted-foreground capitalize">{label}</p>
                    <p className="text-xs font-medium text-foreground text-right max-w-[55%] break-words">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function TransactionRow({ item, onSelect }) {
  return (
    <button onClick={() => onSelect(item)} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left">
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.documentNo ?? `#${item.transactionId}`}</p>
        <p className="text-xs text-muted-foreground truncate">{item.customerName ?? 'Unknown customer'}</p>
        <p className="text-xs text-muted-foreground">{formatDate(item.documentDate)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className="text-sm font-semibold text-foreground tabular-nums">{formatINR(item.amount)}</p>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="rounded-xl border border-border overflow-hidden animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between px-4 py-3.5 border-b border-border last:border-0">
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="h-4 bg-muted rounded w-32" />
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-3 bg-muted rounded w-20" />
          </div>
          <div className="h-4 bg-muted rounded w-16" />
        </div>
      ))}
    </div>
  );
}

function TransactionList({ hook: useHook, emptyMessage }) {
  const [skip, setSkip]         = useState(0);
  const [selected, setSelected] = useState(null);

  const { items, totalCount, take, isLoading, isFetching, isError, refetch } = useHook({ skip });

  const totalPages  = Math.max(1, Math.ceil(totalCount / take));
  const currentPage = Math.floor(skip / take) + 1;

  const handlePrev = useCallback(() => setSkip((s) => Math.max(0, s - take)), [take]);
  const handleNext = useCallback(() => setSkip((s) => s + take), [take]);

  if (isLoading) return <ListSkeleton />;

  if (isError) return (
    <div className="flex flex-col items-center gap-3 py-12">
      <p className="text-sm text-muted-foreground">Failed to load transactions.</p>
      <button onClick={refetch} className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  );

  if (!items.length) return <p className="text-sm text-muted-foreground text-center py-12">{emptyMessage}</p>;

  return (
    <>
      {isFetching && !isLoading && (
        <div className="flex justify-center py-2">
          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
        </div>
      )}
      <div className="rounded-xl border border-border overflow-hidden">
        {items.map((item) => (
          <TransactionRow key={item.transactionId ?? item.documentNo} item={item} onSelect={setSelected} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <button onClick={handlePrev} disabled={skip === 0} className="text-xs font-medium text-primary disabled:text-muted-foreground disabled:cursor-not-allowed">← Previous</button>
          <p className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</p>
          <button onClick={handleNext} disabled={currentPage >= totalPages} className="text-xs font-medium text-primary disabled:text-muted-foreground disabled:cursor-not-allowed">Next →</button>
        </div>
      )}
      {selected && <TransactionDetailSheet transaction={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'returns',      label: 'Returns',      icon: RotateCcw,      hook: useReturns,      emptyMessage: 'No return transactions found.',      NewForm: (props) => <ReturnNewForm {...props} /> },
  { id: 'refunds',      label: 'Refunds',      icon: CreditCard,     hook: useRefunds,      emptyMessage: 'No refund transactions found.',      NewForm: (props) => <RefundNewForm {...props} /> },
  { id: 'credit-notes', label: 'Credit Notes', icon: FileText,       hook: useCreditNotes,  emptyMessage: 'No credit notes found.',             NewForm: (props) => <CreditNoteNewForm {...props} /> },
  { id: 'exchange',     label: 'Exchange',     icon: ArrowLeftRight, hook: useExchanges,    emptyMessage: 'No exchange transactions found.',    NewForm: (props) => <MetalLineItemForm type="exchange" {...props} /> },
  { id: 'buyback',      label: 'Buyback',      icon: ShoppingBag,    hook: useBuybacks,     emptyMessage: 'No buyback transactions found.',     NewForm: (props) => <MetalLineItemForm type="buyback" {...props} /> },
  { id: 'urd',          label: 'URD Purchase', icon: Coins,          hook: useURDPurchases, emptyMessage: 'No URD purchase transactions found.',NewForm: (props) => <MetalLineItemForm type="urd" {...props} /> },
];

function TabBar({ tabs, activeId, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = id === activeId;
        return (
          <button key={id} onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'}`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function TransactionsScreen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = TABS.find((t) => t.id === searchParams.get('tab'))?.id ?? TABS[0].id;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [view, setView]           = useState('list'); // 'list' | 'new'
  const storeId = useSelector((state) => state.store.activeStoreId);

  const activeTabConfig = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  const handleTabChange = (id) => {
    setActiveTab(id);
    setView('list');
    router.replace(`/transactions?tab=${id}`, { scroll: false });
  };

  return (
    <div className="p-4 pb-8 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Returns, refunds, and post-sale activity</p>
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
          <p className="text-sm text-muted-foreground">No store selected. Please switch to a store to view transactions.</p>
        </div>
      )}

      {storeId && (
        <>
          <TabBar tabs={TABS} activeId={activeTab} onChange={handleTabChange} />

          {view === 'list' && (
            <TransactionList key={activeTab} hook={activeTabConfig.hook} emptyMessage={activeTabConfig.emptyMessage} />
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

export default function TransactionsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <TransactionsScreen />
    </Suspense>
  );
}
