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
// RESOLVED 2026-07-16: RefundDetailsRow's ledger_id is now sourced from the
// selected payment mode's own ledger_id (confirmed real field via
// PaymentReceiptMode/List and Refund/List) — see RefundNewForm below.
//
// STILL BLOCKED (all 6 types, confirmed via direct API test 2026-07-16):
// every Create endpoint here (Return/Refund/CreditNote/Exchange/Buyback/
// URDPurchase) returns the same AccessDenied as POS/Order/Create and
// POS/Invoice/Create — a systemic OAuth-client scope gap on OrnaVerse's
// side, not a payload issue. See useCreateInvoice.js for the full history.

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
  RefreshCw,
  Plus,
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
import { useURDMasterItem }                from '@/hooks/transactions/useURDMasterItem';
import ItemSearchPicker                    from '@/components/features/transactions/ItemSearchPicker';
import { selectActiveStoreId }            from '@/store/slices/storeSlice';
import { selectCartCustomerId, selectCartCustomerName } from '@/store/slices/cartSlice';
import APP_CONFIG                         from '@/constants/appConfig';
import { todayDateString }                 from '@/lib/dateUtils';

import PageLoader                          from '@/components/shared/PageLoader';
import PaymentModeSelect                   from '@/components/shared/PaymentModeSelect';
import PillTabs                            from '@/components/shared/PillTabs';
import RemoveLineItemButton                from '@/components/shared/RemoveLineItemButton';
import ListRowsSkeleton                    from '@/components/shared/ListRowsSkeleton';
import { Button }                          from '@/components/ui/button';
import { Input }                           from '@/components/ui/input';
import { Label }                           from '@/components/ui/label';

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
      document_date:      todayDateString(),
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
        <Input type="date" max={todayDateString()} {...register('document_date')} className="h-11" />
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
                <RemoveLineItemButton onClick={() => remove(index)} />
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
        <div className="flex justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium">
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
// All three share the same weight/purity/rate shape, differing in how the
// line item's `item_id` is resolved and whether a receipt (payout) section
// is shown. Configured per type rather than duplicated three times.
//
// REBUILT 2026-07-16 — the original version invented `metal_type_id` +
// freeform `item_name` fields that don't match OrnaVerse's real schema.
// Confirmed via real Exchange/Buyback/URD Retrieve data: line items
// reference a genuine master `item_id` (Exchange/Buyback: the actual piece
// the customer is handing in, found by SKU search — see ItemSearchPicker;
// URD: a fixed generic "URD GOLD" master item, see useURDMasterItem and
// appConfig.js URD_MASTER_ITEMS for why it can't be searched). weight/
// purity/item_rate are pre-filled from the resolved item but stay editable,
// since a buyback/exchange appraisal rate can legitimately differ from the
// item's original sale rate.

const METAL_TYPE_CONFIGS = {
  exchange: {
    amountField: 'exchange_value',
    hasReceipt:  false, // exchange value is applied as invoice credit, not paid out directly
    pickerMode:  'search',
    createHook:  useCreateExchange,
    postHook:    usePostExchange,
    submitLabel: 'Submit Exchange',
    processingLabel: 'Processing Exchange…',
  },
  buyback: {
    amountField: 'amount',
    hasReceipt:  true,
    pickerMode:  'search',
    createHook:  useCreateBuyback,
    postHook:    usePostBuyback,
    submitLabel: 'Submit Buyback',
    processingLabel: 'Processing Buyback…',
  },
  urd: {
    amountField: 'amount',
    hasReceipt:  true,
    pickerMode:  'fixed',
    createHook:  useCreateURDPurchase,
    postHook:    usePostURDPurchase,
    submitLabel: 'Submit URD Purchase',
    processingLabel: 'Processing Purchase…',
  },
};

function buildMetalLineItemSchema(config) {
  const shape = {
    weight:     z.coerce.number().min(0.001, 'Required'),
    purity:     z.coerce.number().min(0, 'Required'),
    item_rate:  z.coerce.number().min(0, 'Required'),
    [config.amountField]: z.coerce.number().min(0, 'Required'),
  };
  if (config.pickerMode === 'search') {
    shape.item = z.object({ item_id: z.number() }).nullable()
      .refine((v) => v !== null, { message: 'Select an item' });
  }
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
  const item = { weight: '', purity: '', item_rate: '', [config.amountField]: '' };
  if (config.pickerMode === 'search') item.item = null;
  return item;
}

function MetalLineItemForm({ type, onDone }) {
  const config = METAL_TYPE_CONFIGS[type];
  const storeId      = useSelector(selectActiveStoreId);
  const customerId   = useSelector(selectCartCustomerId);
  const customerName = useSelector(selectCartCustomerName);
  const { paymentModes, isLoading: modesLoading } = usePaymentModes();
  const { item: urdItem, isLoading: urdItemLoading } = useURDMasterItem('GOLD');

  const create = config.createHook({ onSuccess: () => {} });
  const post   = config.postHook({ onSuccess: () => onDone() });

  const schema = buildMetalFormSchema(config);

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      document_date: todayDateString(),
      line_items: [emptyMetalLineItem(config)],
      ...(config.hasReceipt ? { payout_mode_id: '' } : {}),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' });
  const watchedItems = watch('line_items');
  const total = watchedItems.reduce((sum, i) => sum + (Number(i[config.amountField]) || 0), 0);

  // Pre-fill weight/purity/item_rate from the picked item — still editable
  // afterwards, since the appraised rate can differ from the item's own rate.
  const handleItemSelect = (index, item) => {
    setValue(`line_items.${index}.item`, item);
    setValue(`line_items.${index}.weight`, item.weight ?? item.net_weight ?? '');
    setValue(`line_items.${index}.purity`, item.purity ?? '');
    setValue(`line_items.${index}.item_rate`, item.item_rate ?? '');
  };

  const onSubmit = async (data) => {
    if (!customerId) return toast.error('Attach a customer to the session before submitting.');
    if (config.pickerMode === 'fixed' && !urdItem) {
      return toast.error('URD Gold master item is still loading — try again in a moment.');
    }
    try {
      const payload = {
        party_id: customerId, company_id: storeId,
        document_date: data.document_date, currency_id: APP_CONFIG.CURRENCY.INR_ID,
        line_items: data.line_items.map((i) => {
          const resolvedItem = config.pickerMode === 'fixed' ? urdItem : i.item;
          return {
            item_id:   resolvedItem.item_id,
            item_code: resolvedItem.item_code,
            item_name: resolvedItem.item_name,
            weight:    Number(i.weight),
            purity:    Number(i.purity),
            item_rate: Number(i.item_rate),
            [config.amountField]: Number(i[config.amountField]),
          };
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
        <Input type="date" max={todayDateString()} {...register('document_date')} className="h-11" />
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
                <RemoveLineItemButton onClick={() => remove(index)} />
              )}
            </div>

            {config.pickerMode === 'search' && (
              <FormField label="Item" required error={errors.line_items?.[index]?.item}>
                <Controller
                  name={`line_items.${index}.item`}
                  control={control}
                  render={({ field: itemField }) => (
                    <ItemSearchPicker
                      selectedItem={itemField.value}
                      onSelect={(item) => handleItemSelect(index, item)}
                      onClear={() => setValue(`line_items.${index}.item`, null)}
                    />
                  )}
                />
              </FormField>
            )}

            {config.pickerMode === 'fixed' && (
              <div className="rounded-lg border border-input bg-muted/30 px-3 py-2.5 text-sm">
                {urdItemLoading ? (
                  <p className="text-muted-foreground">Loading URD Gold item…</p>
                ) : urdItem ? (
                  <>
                    <p className="font-medium text-foreground">{urdItem.item_name}</p>
                    <p className="text-xs text-muted-foreground">{urdItem.item_code} · fixed item used for every old-gold purchase</p>
                  </>
                ) : (
                  <p className="text-destructive">Could not load the URD Gold master item.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <FormField label="Weight (g)" required error={errors.line_items?.[index]?.weight}>
                <Input type="number" inputMode="decimal" step="0.001" {...register(`line_items.${index}.weight`)} className="h-9 text-sm" />
              </FormField>
              <FormField label="Purity" required error={errors.line_items?.[index]?.purity}>
                <Input type="number" inputMode="decimal" step="0.01" placeholder="e.g. 0.75" {...register(`line_items.${index}.purity`)} className="h-9 text-sm" />
              </FormField>
              <FormField label="Rate (₹/g)" required error={errors.line_items?.[index]?.item_rate}>
                <Input type="number" inputMode="decimal" {...register(`line_items.${index}.item_rate`)} className="h-9 text-sm" />
              </FormField>
              <FormField label={config.amountField === 'exchange_value' ? 'Exchange Value (₹)' : 'Amount (₹)'} required error={errors.line_items?.[index]?.[config.amountField]}>
                <Input type="number" inputMode="decimal" {...register(`line_items.${index}.${config.amountField}`)} className="h-9 text-sm" />
              </FormField>
            </div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="flex justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium">
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
    defaultValues: { document_date: todayDateString(), net_amount: '', ref_transaction_id: '', narration: '' },
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
        <Input type="date" max={todayDateString()} {...register('document_date')} className="h-11" />
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
// ledger_id on RefundDetailsRow — confirmed required 2026-07-16 via real
// Refund/List data, sourced from the selected payment mode's own ledger_id
// field (see usePaymentModes.js normalizeMode).

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
    defaultValues: { document_date: todayDateString(), amount: '', mode_id: '', narration: '' },
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

      // ledger_id — confirmed 2026-07-16 via real Refund/List data that
      // RefundDetailsRow genuinely carries this field. Sourced from the
      // selected payment mode's own ledger_id (see usePaymentModes.js).
      const selectedMode = paymentModes.find((m) => m.modeId === Number(data.mode_id));

      await addDetail.mutateAsync({
        transaction_id: transactionId,
        amount:         Number(data.amount),
        mode_id:        data.mode_id,
        ledger_id:      selectedMode?.ledgerId ?? undefined,
      });

      await addReceipt.mutateAsync({
        transaction_id: transactionId,
        party_id:       customerId,
        company_id:     storeId,
        amount:         Number(data.amount),
        mode_id:        data.mode_id,
        ledger_id:      selectedMode?.ledgerId ?? undefined,
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
        <Input type="date" max={todayDateString()} {...register('document_date')} className="h-11" />
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


function TransactionList({ hook: useHook, emptyMessage }) {
  const [skip, setSkip]         = useState(0);
  const [selected, setSelected] = useState(null);

  const { items, totalCount, take, isLoading, isFetching, isError, refetch } = useHook({ skip });

  const totalPages  = Math.max(1, Math.ceil(totalCount / take));
  const currentPage = Math.floor(skip / take) + 1;

  const handlePrev = useCallback(() => setSkip((s) => Math.max(0, s - take)), [take]);
  const handleNext = useCallback(() => setSkip((s) => s + take), [take]);

  if (isLoading) return <ListRowsSkeleton rows={5} lines={3} />;

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
