'use client';

// src/app/(pos)/buyback/page.jsx
// Buy Back — store purchases finished jewellery outright from customer.
// Customer receives cash/payment; no new purchase required.

import { Suspense, useState } from 'react';
import { useSelector } from 'react-redux';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShoppingBag, Plus, Trash2, AlertCircle, ChevronDown } from 'lucide-react';

import { useBuybacks }      from '@/hooks/buyback/useBuybacks';
import { useCreateBuyback } from '@/hooks/buyback/useCreateBuyback';
import { usePaymentModes }  from '@/hooks/checkout/usePaymentModes';
import { selectActiveStoreId }   from '@/store/slices/storeSlice';
import { selectCartCustomerId, selectCartCustomerName } from '@/store/slices/cartSlice';
import APP_CONFIG from '@/constants/appConfig';

import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const METAL_TYPES = APP_CONFIG.METAL_TYPES ?? [
  { id: 1, name: 'Gold' }, { id: 2, name: 'Silver' }, { id: 3, name: 'Platinum' },
];

const lineSchema = z.object({
  item_name:     z.string().min(1, 'Describe the item'),
  metal_type_id: z.coerce.number().min(1, 'Select metal'),
  gross_weight:  z.coerce.number().min(0.001, 'Required'),
  net_weight:    z.coerce.number().min(0.001, 'Required'),
  purity:        z.coerce.number().min(1, 'Required'),
  rate:          z.coerce.number().min(1, 'Required'),
  amount:        z.coerce.number().min(0, 'Required'),
});

const buybackSchema = z.object({
  document_date:   z.string().min(1, 'Required'),
  line_items:      z.array(lineSchema).min(1, 'Add at least one item'),
  payout_mode_id:  z.coerce.number().min(1, 'Select payout method'),
  payout_mode_name:z.string().optional(),
});

function formatCurrency(n) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
}
function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN') : '—';
}

// ── History Tab ───────────────────────────────────────────────
function HistoryTab() {
  const [page, setPage] = useState(1);
  const pageSize = APP_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE ?? 50;
  const { buybacks, totalCount, isLoading, isError, refetch } = useBuybacks({ page, pageSize });
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  if (isError) return (
    <div className="flex flex-col items-center gap-3 py-16 text-stone-500">
      <AlertCircle size={20} />
      <p className="text-sm">Failed to load buyback records.</p>
      <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
    </div>
  );

  if (buybacks.length === 0) return (
    <div className="flex flex-col items-center gap-2 py-16 text-stone-400">
      <ShoppingBag size={28} className="opacity-40" />
      <p className="text-sm">No buyback records found.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {buybacks.map((b) => (
        <div key={b.transactionId} className="rounded-xl border border-stone-200 bg-white p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-stone-800">{b.documentNo ?? `#${b.transactionId}`}</p>
              <p className="text-xs text-stone-400">{formatDate(b.documentDate)}</p>
            </div>
            <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
              Buyback
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">{b.partyName || '—'}</span>
            <span className="font-semibold text-stone-800">{formatCurrency(b.netAmount)}</span>
          </div>
        </div>
      ))}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-xs text-stone-400">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// ── New Buyback Tab ───────────────────────────────────────────
function NewBuybackTab() {
  const storeId      = useSelector(selectActiveStoreId);
  const customerId   = useSelector(selectCartCustomerId);
  const customerName = useSelector(selectCartCustomerName);
  const createBuyback = useCreateBuyback();
  const { paymentModes, isLoading: modesLoading } = usePaymentModes();
  const today = new Date().toISOString().split('T')[0];

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(buybackSchema),
    defaultValues: {
      document_date: today,
      line_items: [{ item_name: '', metal_type_id: '', gross_weight: '', net_weight: '', purity: '', rate: '', amount: '' }],
      payout_mode_id: '', payout_mode_name: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' });
  const watchedItems = watch('line_items');

  const totalAmount = watchedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const handleAutoCompute = (index) => {
    const item = watchedItems[index];
    const value = (Number(item.net_weight) || 0) * ((Number(item.purity) || 0) / 1000) * (Number(item.rate) || 0);
    setValue(`line_items.${index}.amount`, value.toFixed(2));
  };

  const onSubmit = async (data) => {
    if (!customerId) return;
    const total = data.line_items.reduce((s, i) => s + Number(i.amount), 0);
    await createBuyback.mutateAsync({
      party_id:      customerId,
      company_id:    storeId,
      document_date: data.document_date,
      currency_id:   APP_CONFIG.CURRENCY.INR_ID,
      line_items: data.line_items.map(item => ({
        item_name:     item.item_name,
        metal_type_id: Number(item.metal_type_id),
        gross_weight:  Number(item.gross_weight),
        net_weight:    Number(item.net_weight),
        purity:        Number(item.purity),
        rate:          Number(item.rate),
        amount:        Number(item.amount),
      })),
      receipt_details: [{ mode_id: Number(data.payout_mode_id), amount: total }],
    });
    reset({
      document_date: today,
      line_items: [{ item_name: '', metal_type_id: '', gross_weight: '', net_weight: '', purity: '', rate: '', amount: '' }],
      payout_mode_id: '', payout_mode_name: '',
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* Customer */}
      <div className={`rounded-xl border p-3 text-sm ${customerId ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        {customerId
          ? <p className="text-emerald-700">Customer: <strong>{customerName}</strong></p>
          : <p className="text-amber-700">⚠ Attach a customer before recording a buyback.</p>}
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bb_date">Buyback Date <span className="text-destructive">*</span></Label>
        <Input id="bb_date" type="date" {...register('document_date')} className="h-11" />
        {errors.document_date && <p className="text-xs text-destructive">{errors.document_date.message}</p>}
      </div>

      {/* Items */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Items Being Bought Back <span className="text-destructive">*</span></Label>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs"
            onClick={() => append({ item_name: '', metal_type_id: '', gross_weight: '', net_weight: '', purity: '', rate: '', amount: '' })}>
            <Plus size={12} /> Add Item
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Item {index + 1}</span>
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="text-stone-400 hover:text-destructive">
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Description <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Gold bangle 22k" {...register(`line_items.${index}.item_name`)} className="h-9 text-sm" />
              {errors.line_items?.[index]?.item_name && <p className="text-xs text-destructive">{errors.line_items[index].item_name.message}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Metal Type <span className="text-destructive">*</span></Label>
              <select {...register(`line_items.${index}.metal_type_id`)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
                <option value="">Select metal</option>
                {METAL_TYPES.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'gross_weight', label: 'Gross Wt (g)' },
                { id: 'net_weight',   label: 'Net Wt (g)' },
                { id: 'purity',       label: 'Purity' },
                { id: 'rate',         label: 'Rate (₹/g)' },
              ].map(({ id, label }) => (
                <div key={id} className="flex flex-col gap-1">
                  <Label className="text-xs">{label} <span className="text-destructive">*</span></Label>
                  <Input type="number" inputMode="decimal" step="any" min={0}
                    {...register(`line_items.${index}.${id}`, { onBlur: () => handleAutoCompute(index) })}
                    className="h-9 text-sm" />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Payout Amount (₹) <span className="text-destructive">*</span></Label>
                <button type="button" onClick={() => handleAutoCompute(index)} className="text-xs text-primary underline">Auto-compute</button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">₹</span>
                <Input type="number" inputMode="decimal" step="any" min={0} {...register(`line_items.${index}.amount`)} className="h-9 text-sm pl-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      {totalAmount > 0 && (
        <div className="flex justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium">
          <span className="text-stone-500">Total Payout to Customer</span>
          <span className="text-stone-800 font-semibold">{formatCurrency(totalAmount)}</span>
        </div>
      )}

      {/* Payout mode */}
      <div className="flex flex-col gap-1.5">
        <Label>Payout Method <span className="text-destructive">*</span></Label>
        <Controller name="payout_mode_id" control={control} render={({ field }) => {
          const selected = paymentModes.find(m => m.modeId === Number(field.value));
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm">
                  <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
                    {modesLoading ? 'Loading…' : selected ? selected.modeName : 'Select payout method'}
                  </span>
                  <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                {paymentModes.map(mode => (
                  <DropdownMenuItem key={mode.modeId} onSelect={() => { field.onChange(mode.modeId); setValue('payout_mode_name', mode.modeName); }}>
                    {mode.modeName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }} />
        {errors.payout_mode_id && <p className="text-xs text-destructive">{errors.payout_mode_id.message}</p>}
      </div>

      <Button type="submit" disabled={createBuyback.isPending || !customerId} className="h-12">
        {createBuyback.isPending ? 'Processing…' : 'Record Buyback'}
      </Button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────
function BuybackScreen() {
  const [activeTab, setActiveTab] = useState('new');
  const TABS = [{ key: 'new', label: 'New Buyback' }, { key: 'history', label: 'History' }];

  return (
    <div className="flex flex-col gap-4 p-4 pb-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 pt-2">
        <ShoppingBag size={20} className="text-stone-400" />
        <h1 className="text-xl font-semibold text-stone-800">Buy Back</h1>
      </div>
      <div className="flex gap-1">
        {TABS.map(tab => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'new'     && <NewBuybackTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  );
}

export default function BuybackPage() {
  return <Suspense><BuybackScreen /></Suspense>;
}
