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
// HEADER FIELDS (2026-07-28) — the "AccessDenied" framing below is STALE.
// Confirmed live 2026-07-28 that Return/Create actually returns the same
// generic 500 Order/Invoice/Create had before their header-field fix, not
// AccessDenied — see [[pos-cash-checkout-status]] memory. Applied the same
// fix here (financial_year_id/ledger_id/document_id/document_no/party
// identity/aggregate weight/receipt+balance — see
// transactionHeaderService.buildTransactionHeaderFields, useOrderHeaderConfig)
// across all 6 flows below, UNVERIFIED LIVE per the user's explicit
// direction to code this without a live round-trip per flow (unlike Order,
// which went through 3 rounds of live retest-and-discover). Treat a
// continued 500 on any of these as "run the same live-capture diagnostic
// used for Order" rather than assuming AccessDenied again.

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
  Check,
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
import { useSoldItems }                    from '@/hooks/transactions/useSoldItems';
import { useOrderHeaderConfig }            from '@/hooks/checkout/useOrderHeaderConfig';
import { buildTransactionHeaderFields }    from '@/services/transactionHeaderService';
import { calculateReturnItems, calculateBuybackItems, calculateExchangeItems } from '@/services/returnItemsService';
import EmptyState                          from '@/components/shared/EmptyState';
import ErrorState                          from '@/components/shared/ErrorState';
import InlineLoader                        from '@/components/shared/InlineLoader';
import ItemSearchPicker                    from '@/components/features/transactions/ItemSearchPicker';
import { selectActiveStoreId }            from '@/store/slices/storeSlice';
import { selectCartCustomerId, selectCartCustomerName, selectCartCustomerMobile } from '@/store/slices/cartSlice';
import APP_CONFIG                         from '@/constants/appConfig';
import { todayDateString }                 from '@/lib/dateUtils';

import PageLoader                          from '@/components/shared/PageLoader';
import PaymentModeSelect                   from '@/components/shared/PaymentModeSelect';
import PillTabs                            from '@/components/shared/PillTabs';
import RemoveLineItemButton                from '@/components/shared/RemoveLineItemButton';
import CustomerAttachedBanner               from '@/components/shared/CustomerAttachedBanner';
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

// ─── Returns — New form ─────────────────────────────────────────────────────────

// REBUILT 2026-07-30 to match how a return actually works.
//
// The old form asked staff to type item_id / pieces / rate / net_amount by
// hand and referenced the original invoice by typed transaction_id. That
// could never succeed: Return/Create requires the ~186-field computed line
// item from Helpers/SetReturnItems, and hand-built line items produced a
// long run of opaque 500s. Confirmed by capturing OrnaVerse's own UAT
// Returns journey — see returnItemsService.js.
//
// Real flow (theirs, now ours): pick from what the customer actually BOUGHT
// (POS/InvoiceItems/List) → price it for return (SetReturnItems) → Create →
// Post. This is also better UX: no typing item IDs off a printed bill, and
// the customer can only return things they genuinely purchased.
// Return and Buy Back are the SAME journey with a different pricing helper
// and document type — which is exactly how OrnaVerse models it too (their
// Returns screen has Return / Exchange / Buy Back as three modes sharing one
// "Sold Item" picker). Configured here rather than duplicated.
const SOLD_ITEM_FLOWS = {
  return: {
    documentTypeId: APP_CONFIG.DOCUMENT_TYPES.RETURN,
    priceItems:     calculateReturnItems,
    createHook:     useCreateReturn,
    postHook:       usePostReturn,
    itemsLabel:     'Items Being Returned',
    emptyTitle:     'No purchases found for this customer.',
    emptyHint:      'Only previously sold items can be returned.',
    totalLabel:     'Total Return Amount',
    submitLabel:    'Submit Return',
    busyLabel:      'Processing Return…',
    // A return reverses a sale, so backdating stays closed.
    allowBackdatedEntry: false,
  },
  buyback: {
    documentTypeId: APP_CONFIG.DOCUMENT_TYPES.BUYBACK,
    priceItems:     calculateBuybackItems,
    createHook:     useCreateBuyback,
    postHook:       usePostBuyback,
    itemsLabel:     'Items Being Bought Back',
    emptyTitle:     'No purchases found for this customer.',
    emptyHint:      'Buy Back here covers pieces this store previously sold.',
    totalLabel:     'Total Buy Back Amount',
    submitLabel:    'Submit Buy Back',
    busyLabel:      'Processing Buy Back…',
    // Their captured BuyBack/Create sends allow_backdated_entry:true —
    // a buyback can legitimately be dated to when the piece came in.
    allowBackdatedEntry: true,
  },
  // Exchange is ONE-SIDED at the document level — confirmed live
  // 2026-07-30. It does NOT carry a replacement item; completing it just
  // raises the customer's credit (their balance rose by exactly the
  // exchange value), and the replacement is then bought as a normal sale
  // paid with that credit. Structurally identical to Return/Buy Back, so
  // it belongs here rather than in the metal-weights form.
  exchange: {
    documentTypeId: APP_CONFIG.DOCUMENT_TYPES.EXCHANGE,
    priceItems:     calculateExchangeItems,
    createHook:     useCreateExchange,
    postHook:       usePostExchange,
    itemsLabel:     'Items Being Exchanged',
    emptyTitle:     'No purchases found for this customer.',
    emptyHint:      'Only previously sold pieces can be exchanged.',
    totalLabel:     'Exchange Credit',
    submitLabel:    'Submit Exchange',
    busyLabel:      'Processing Exchange…',
    allowBackdatedEntry: true,
    // NOTE: unlike Return/Buy Back, Exchange's document type has
    // auto_posting:FALSE — so the explicit Post step genuinely runs here.
    // That's handled generically off headerConfig.autoPosting.
    helperText: 'This raises store credit for the customer. Ring up the replacement piece as a normal sale and pay with that credit.',
  },
};

const soldItemFlowSchema = z.object({
  document_date: z.string().min(1, 'Required'),
  selected_keys: z.array(z.string()).min(1, 'Select at least one item'),
});

// A sold-item row has no single stable id, so identify it the way the
// document itself does: original document + line number.
const soldItemKey = (row) => `${row.document_no ?? ''}#${row.item_line_no ?? ''}`;

function SoldItemFlowForm({ flow, onDone }) {
  const config         = SOLD_ITEM_FLOWS[flow];
  const storeId        = useSelector(selectActiveStoreId);
  const customerId     = useSelector(selectCartCustomerId);
  const customerName   = useSelector(selectCartCustomerName);
  const headerConfig   = useOrderHeaderConfig(config.documentTypeId);
  const { soldItems, isLoading: soldLoading, isError: soldError, refetch: refetchSold } =
    useSoldItems(customerId);

  const createDoc = config.createHook({ onSuccess: () => {} });
  const postDoc   = config.postHook({ onSuccess: () => onDone() });
  const [isPricing, setIsPricing] = useState(false);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(soldItemFlowSchema),
    defaultValues: { document_date: todayDateString(), selected_keys: [] },
  });

  const selectedKeys = watch('selected_keys');
  const selectedRows = soldItems.filter((r) => selectedKeys.includes(soldItemKey(r)));

  const toggleItem = (row) => {
    const key = soldItemKey(row);
    setValue(
      'selected_keys',
      selectedKeys.includes(key)
        ? selectedKeys.filter((k) => k !== key)
        : [...selectedKeys, key],
      { shouldValidate: true },
    );
  };

  const onSubmit = async (data) => {
    if (!customerId) return toast.error('Attach a customer to the session first.');
    if (!headerConfig.isReady) return toast.error('Store configuration is still loading — try again in a moment.');
    try {
      setIsPricing(true);
      // Pass the sold-item rows through UNMODIFIED — the pricing helper needs
      // the full nested shape (incl. the ref_* linkage to the original sale).
      const line_items = await config.priceItems({
        items: selectedRows,
        documentDate: new Date(data.document_date),
      });
      setIsPricing(false);
      if (!line_items.length) throw new Error('Could not price the selected items.');

      const sum = (f) => +line_items.reduce((s, li) => s + (li[f] ?? 0), 0).toFixed(2);
      const subTotal = sum('sub_total');
      const taxAmount = sum('tax_amount');
      const netRaw = sum('net_amount');

      const createRes = await createDoc.mutateAsync({
        ...buildTransactionHeaderFields({
          subTotal, taxableAmount: subTotal, taxAmount, netAmount: netRaw,
          pieces: sum('pieces'), weight: sum('weight'), netWeight: sum('net_weight'),
          customerId, customerName,
          activeStoreId: storeId,
          headerConfig,
          documentTypeId: config.documentTypeId,
          receiptAmount: Math.round(netRaw),
          documentDate: data.document_date,
          forReturn: true,
          allowBackdatedEntry: config.allowBackdatedEntry,
        }),
        line_items,
        remark: '',
        // No receipt_details and no header-level ref_transaction_id — neither
        // a Return nor a Buy Back carries them (the per-line ref_* fields
        // already tie back to the original sale). Confirmed against their
        // captured payloads; sending either is what previously 500'd.
      });
      const transactionId = createRes?.EntityId;
      if (!transactionId) throw new Error('Creation failed — no EntityId returned.');
      // Only Post when the document type isn't already auto-posting.
      // Confirmed live 2026-07-30: these document types have
      // auto_posting:true, so Create ALSO posts (posting_date/posted_by come
      // back populated) and a follow-up Post fails with
      // {"Code":"AlreadyPosted","Message":"[pos].[return] is already posted!"}.
      if (!headerConfig.autoPosting) {
        await postDoc.mutateAsync(transactionId);
      }
      reset();
    } catch (err) {
      setIsPricing(false);
      toast.error(getErrorMessage(err));
    }
  };

  const total = selectedRows.reduce((s, r) => s + (r.net_amount ?? 0), 0);

  const isSubmitting = isPricing || createDoc.isPending || postDoc.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <CustomerAttachedBanner customerId={customerId} customerName={customerName} />

      <FormField label="Date" required error={errors.document_date}>
        <Input type="date" max={todayDateString()} {...register('document_date')} className="h-11" />
      </FormField>

      <div className="flex flex-col gap-2">
        <Label>
          {config.itemsLabel} <span className="text-destructive">*</span>
        </Label>
        <p className="text-xs text-muted-foreground -mt-1">
          Pick from what this customer has purchased — tap to select.
        </p>

        {!customerId ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Attach a customer to see their purchases.
          </p>
        ) : soldLoading ? (
          <InlineLoader className="py-6" label="Loading purchases…" />
        ) : soldError ? (
          <ErrorState className="py-6" title="Couldn't load purchases." onRetry={() => refetchSold()} />
        ) : soldItems.length === 0 ? (
          <EmptyState
            className="border-0 py-6"
            icon={RotateCcw}
            title={config.emptyTitle}
            description={config.emptyHint}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {soldItems.map((row) => {
              const key = soldItemKey(row);
              const isSelected = selectedKeys.includes(key);
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => toggleItem(row)}
                  aria-pressed={isSelected}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors min-h-[44px] ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-muted hover:bg-muted/70'
                  }`}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="truncate text-sm font-medium text-foreground">
                      {row.item_name ?? row.item_code ?? `Item ${row.item_line_no}`}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {row.sku} · {row.document_no}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatINR(row.net_amount)}
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {errors.selected_keys && (
          <p className="text-xs text-destructive">{errors.selected_keys.message}</p>
        )}
      </div>

      {total > 0 && (
        <div className="flex justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium">
          <span className="text-muted-foreground">{config.totalLabel}</span>
          <span className="text-foreground">{formatINR(total)}</span>
        </div>
      )}

      {config.helperText && selectedRows.length > 0 && (
        <p className="rounded-xl border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
          {config.helperText}
        </p>
      )}

      {/* No refund/payout method picker here on purpose. Neither a Return
          nor a Buy Back carries receipt_details (confirmed against
          OrnaVerse's own payloads — sending them is rejected); both raise
          the customer's credit instead. Settling that credit in cash is a
          separate Refund / Credit Note document, so asking for a mode here
          would collect a value we'd silently discard. */}

      <Button
        type="submit"
        disabled={isSubmitting || !customerId || selectedRows.length === 0}
        className="h-12 mt-1"
      >
        {isSubmitting ? config.busyLabel : config.submitLabel}
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

// Only URD Purchase still belongs here. Returns, Buy Back and Exchange all
// moved to SoldItemFlowForm on 2026-07-30: each is the store taking back a
// piece it previously SOLD, so each needs the sold-item picker plus its own
// Helpers/Set*Items pricing call — not hand-typed metal weights. That
// mirrors OrnaVerse's own POS, where all three are modes of one Returns
// screen sharing a single "Sold Item" picker.
//
// URD Purchase is genuinely different: old gold walks in off the street and
// was never sold by us, so there's no sold-item record to price against and
// hand-entered weight/purity/rate is the correct model.
const METAL_TYPE_CONFIGS = {
  urd: {
    amountField: 'amount',
    hasReceipt:  true,
    pickerMode:  'fixed',
    createHook:  useCreateURDPurchase,
    postHook:    usePostURDPurchase,
    submitLabel: 'Submit URD Purchase',
    processingLabel: 'Processing Purchase…',
    documentTypeId: APP_CONFIG.DOCUMENT_TYPES.URD_PURCHASE,
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
  const customerMobile = useSelector(selectCartCustomerMobile);
  const { paymentModes, isLoading: modesLoading } = usePaymentModes();
  const { item: urdItem, isLoading: urdItemLoading } = useURDMasterItem('GOLD');
  const headerConfig = useOrderHeaderConfig(config.documentTypeId);

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
    if (!headerConfig.isReady) return toast.error('Store configuration is still loading — try again in a moment.');
    try {
      const line_items = data.line_items.map((i) => {
        const resolvedItem = config.pickerMode === 'fixed' ? urdItem : i.item;
        const amount = Number(i[config.amountField]);
        return {
          item_id:   resolvedItem.item_id,
          item_code: resolvedItem.item_code,
          item_name: resolvedItem.item_name,
          weight:    Number(i.weight),
          purity:    Number(i.purity),
          item_rate: Number(i.item_rate),
          [config.amountField]: amount,
          sub_total: amount,
          taxable_amount: amount,
          net_amount: amount,
        };
      });
      const totalWeight = line_items.reduce((s, i) => s + i.weight, 0);

      const payload = {
        ...buildTransactionHeaderFields({
          subTotal: total, taxableAmount: total, taxAmount: 0, netAmount: total,
          pieces: line_items.length, weight: totalWeight, netWeight: totalWeight,
          customerId, customerName, customerMobile,
          activeStoreId: storeId,
          headerConfig,
          documentTypeId: config.documentTypeId,
          receiptAmount: config.hasReceipt ? total : 0,
          documentDate: data.document_date,
        }),
        line_items,
        // NO receipt_details for ANY of these three — see ReturnNewForm above.
        // Confirmed live on UAT 2026-07-29: receipt_details exists only on
        // Order/Invoice; on Exchange/BuyBack/URDPurchase every real record has
        // it `undefined`, and sending it 500s the Create. config.hasReceipt is
        // now only used to drive the payout-method FIELD and the header's
        // receipt_amount — not a receipt_details array.
      };
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
      <CustomerAttachedBanner customerId={customerId} customerName={customerName} />

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
          <div key={field.id} className="rounded-xl border border-border bg-muted p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
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
          <span className="text-muted-foreground">Total</span>
          <span className="text-foreground">{formatINR(total)}</span>
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
  const customerMobile = useSelector(selectCartCustomerMobile);
  // document_id — reusing RETURN's (55/"PSR"): CreditNote/List returned rows
  // identical to Return/List in the confirmed live sample, so standalone
  // CreditNote/Create's own document_id is unconfirmed. See
  // [[transactions-duplicate-implementations]].
  const headerConfig = useOrderHeaderConfig(APP_CONFIG.DOCUMENT_TYPES.RETURN);

  const create = useCreateCreditNote({ onSuccess: () => {} });
  const post   = usePostCreditNote({ onSuccess: () => onDone() });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: { document_date: todayDateString(), net_amount: '', ref_transaction_id: '', narration: '' },
  });

  const onSubmit = async (data) => {
    if (!customerId) return toast.error('Attach a customer to the session before submitting.');
    if (!headerConfig.isReady) return toast.error('Store configuration is still loading — try again in a moment.');
    try {
      const amount = Number(data.net_amount);
      const createRes = await create.mutateAsync({
        ...buildTransactionHeaderFields({
          subTotal: amount, taxableAmount: amount, taxAmount: 0, netAmount: amount,
          customerId, customerName, customerMobile,
          activeStoreId: storeId,
          headerConfig,
          documentTypeId: APP_CONFIG.DOCUMENT_TYPES.RETURN,
          documentDate: data.document_date,
        }),
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
      <CustomerAttachedBanner customerId={customerId} customerName={customerName} />

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
  const customerMobile = useSelector(selectCartCustomerMobile);
  const { paymentModes, isLoading: modesLoading } = usePaymentModes();
  const headerConfig = useOrderHeaderConfig(APP_CONFIG.DOCUMENT_TYPES.REFUND);

  const create     = useCreateRefund({ onSuccess: () => {} });
  const addDetail  = useAddRefundDetail({ onSuccess: () => {} });
  const addReceipt = useAddRefundReceipt({ onSuccess: () => onDone() });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    resolver: zodResolver(refundSchema),
    defaultValues: { document_date: todayDateString(), amount: '', mode_id: '', narration: '' },
  });

  const onSubmit = async (data) => {
    if (!customerId) return toast.error('Attach a customer to the session before submitting.');
    if (!headerConfig.isReady) return toast.error('Store configuration is still loading — try again in a moment.');
    try {
      const amount = Number(data.amount);
      const createRes = await create.mutateAsync({
        ...buildTransactionHeaderFields({
          subTotal: amount, taxableAmount: amount, taxAmount: 0, netAmount: amount,
          customerId, customerName, customerMobile,
          activeStoreId: storeId,
          headerConfig,
          documentTypeId: APP_CONFIG.DOCUMENT_TYPES.REFUND,
          receiptAmount: amount,
          documentDate: data.document_date,
        }),
        total_amount: amount,
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
      <CustomerAttachedBanner customerId={customerId} customerName={customerName} />

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
  { id: 'returns',      label: 'Returns',      icon: RotateCcw,      hook: useReturns,      emptyMessage: 'No return transactions found.',      NewForm: (props) => <SoldItemFlowForm flow="return" {...props} /> },
  { id: 'refunds',      label: 'Refunds',      icon: CreditCard,     hook: useRefunds,      emptyMessage: 'No refund transactions found.',      NewForm: (props) => <RefundNewForm {...props} /> },
  { id: 'credit-notes', label: 'Credit Notes', icon: FileText,       hook: useCreditNotes,  emptyMessage: 'No credit notes found.',             NewForm: (props) => <CreditNoteNewForm {...props} /> },
  { id: 'exchange',     label: 'Exchange',     icon: ArrowLeftRight, hook: useExchanges,    emptyMessage: 'No exchange transactions found.',    NewForm: (props) => <SoldItemFlowForm flow="exchange" {...props} /> },
  { id: 'buyback',      label: 'Buyback',      icon: ShoppingBag,    hook: useBuybacks,     emptyMessage: 'No buyback transactions found.',     NewForm: (props) => <SoldItemFlowForm flow="buyback" {...props} /> },
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
        <p className="text-sm text-muted-foreground">Returns, refunds, and post-sale activity</p>
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
