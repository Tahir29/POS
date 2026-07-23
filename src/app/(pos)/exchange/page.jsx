'use client';

// src/app/(pos)/exchange/page.jsx
//
// Exchange Module
//
// Customer brings old jewellery → staff values it → exchange credit is
// created → credit appears in invoice helpers at checkout and can be
// applied as a payment offset against a new purchase.
//
// TWO TABS:
//   History  — past exchange transactions (read-only)
//   New      — record a new old-jewellery exchange

import { Suspense, useState } from 'react';
import { useSelector } from 'react-redux';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeftRight, Plus, AlertCircle } from 'lucide-react';

import { useExchanges }      from '@/hooks/exchange/useExchanges';
import { useCreateExchange } from '@/hooks/exchange/useCreateExchange';
import { selectActiveStoreId }   from '@/store/slices/storeSlice';
import { selectCartCustomerId, selectCartCustomerName } from '@/store/slices/cartSlice';
import APP_CONFIG from '@/constants/appConfig';
import { todayDateString } from '@/lib/dateUtils';

import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import MetalTypeSelect from '@/components/shared/MetalTypeSelect';
import PillTabs from '@/components/shared/PillTabs';
import RemoveLineItemButton from '@/components/shared/RemoveLineItemButton';
import CustomerAttachedBanner from '@/components/shared/CustomerAttachedBanner';

// ── Schema ────────────────────────────────────────────────────
const exchangeLineSchema = z.object({
  item_name:      z.string().min(1, 'Describe the item'),
  metal_type_id:  z.coerce.number().min(1, 'Select metal type'),
  gross_weight:   z.coerce.number().min(0.001, 'Enter weight'),
  net_weight:     z.coerce.number().min(0.001, 'Enter net weight'),
  purity:         z.coerce.number().min(1, 'Enter purity (e.g. 750)'),
  rate:           z.coerce.number().min(1, 'Enter rate per gram'),
  exchange_value: z.coerce.number().min(0, 'Enter exchange value'),
});

const exchangeSchema = z.object({
  document_date: z.string().min(1, 'Required'),
  line_items:    z.array(exchangeLineSchema).min(1, 'Add at least one item'),
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
  const pageSize = APP_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE ?? 50;
  const { exchanges, totalCount, isLoading, isError, refetch } = useExchanges({ page, pageSize });
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

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
        <p className="text-sm">Failed to load exchange records.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (exchanges.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
        <ArrowLeftRight size={28} className="opacity-40" />
        <p className="text-sm">No exchange records found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {exchanges.map((ex) => (
        <div key={ex.transactionId} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">{ex.documentNo ?? `#${ex.transactionId}`}</p>
              <p className="text-xs text-muted-foreground">{formatDate(ex.documentDate)}</p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 capitalize">
              {ex.status}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{ex.partyName || '—'}</span>
            <span className="font-semibold text-foreground">{formatCurrency(ex.exchangeValue)}</span>
          </div>
        </div>
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ── New Exchange Tab ──────────────────────────────────────────
function NewExchangeTab() {
  const storeId      = useSelector(selectActiveStoreId);
  const customerId   = useSelector(selectCartCustomerId);
  const customerName = useSelector(selectCartCustomerName);
  const createExchange = useCreateExchange();

  const today = todayDateString();

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(exchangeSchema),
    defaultValues: {
      document_date: today,
      line_items: [{
        item_name: '', metal_type_id: '', gross_weight: '',
        net_weight: '', purity: '', rate: '', exchange_value: '',
      }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' });

  // Auto-compute exchange_value = net_weight * purity/1000 * rate
  const watchedItems = watch('line_items');
  const totalExchangeValue = watchedItems.reduce((sum, item) => {
    const nw     = Number(item.net_weight)   || 0;
    const purity = Number(item.purity)       || 0;
    const rate   = Number(item.rate)         || 0;
    return sum + (nw * (purity / 1000) * rate);
  }, 0);

  const handleAutoCompute = (index) => {
    const item   = watchedItems[index];
    const nw     = Number(item.net_weight) || 0;
    const purity = Number(item.purity)     || 0;
    const rate   = Number(item.rate)       || 0;
    const value  = nw * (purity / 1000) * rate;
    setValue(`line_items.${index}.exchange_value`, value.toFixed(2));
  };

  const onSubmit = async (data) => {
    if (!customerId) return;
    await createExchange.mutateAsync({
      party_id:      customerId,
      company_id:    storeId,
      document_date: data.document_date,
      currency_id:   APP_CONFIG.CURRENCY.INR_ID,
      line_items:    data.line_items.map((item) => ({
        item_name:      item.item_name,
        metal_type_id:  Number(item.metal_type_id),
        gross_weight:   Number(item.gross_weight),
        net_weight:     Number(item.net_weight),
        purity:         Number(item.purity),
        rate:           Number(item.rate),
        exchange_value: Number(item.exchange_value),
      })),
    });
    reset({
      document_date: today,
      line_items: [{
        item_name: '', metal_type_id: '', gross_weight: '',
        net_weight: '', purity: '', rate: '', exchange_value: '',
      }],
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

      {/* Customer context */}
      <CustomerAttachedBanner
        customerId={customerId}
        customerName={customerName}
        emptyMessage="Attach a customer from the header before recording an exchange."
      />

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ex_date">Exchange Date <span className="text-destructive">*</span></Label>
        <Input id="ex_date" type="date" max={today} {...register('document_date')} className="h-11" />
        {errors.document_date && <p className="text-xs text-destructive">{errors.document_date.message}</p>}
      </div>

      {/* Line items */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Items Being Exchanged <span className="text-destructive">*</span></Label>
          <Button
            type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs"
            onClick={() => append({
              item_name: '', metal_type_id: '', gross_weight: '',
              net_weight: '', purity: '', rate: '', exchange_value: '',
            })}
          >
            <Plus size={12} /> Add Item
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="rounded-xl border border-border bg-muted p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
              {fields.length > 1 && (
                <RemoveLineItemButton onClick={() => remove(index)} />
              )}
            </div>

            {/* Item description */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Description <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Gold necklace 22k" {...register(`line_items.${index}.item_name`)} className="h-9 text-sm" />
              {errors.line_items?.[index]?.item_name && (
                <p className="text-xs text-destructive">{errors.line_items[index].item_name.message}</p>
              )}
            </div>

            {/* Metal type */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Metal Type <span className="text-destructive">*</span></Label>
              <MetalTypeSelect control={control} name={`line_items.${index}.metal_type_id`} placeholder="Select metal" />
              {errors.line_items?.[index]?.metal_type_id && (
                <p className="text-xs text-destructive">{errors.line_items[index].metal_type_id.message}</p>
              )}
            </div>

            {/* Weight + purity grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'gross_weight', label: 'Gross Wt (g)' },
                { id: 'net_weight',   label: 'Net Wt (g)' },
                { id: 'purity',       label: 'Purity (e.g. 750)' },
                { id: 'rate',         label: 'Rate (₹/g)' },
              ].map(({ id, label }) => (
                <div key={id} className="flex flex-col gap-1">
                  <Label className="text-xs">{label} <span className="text-destructive">*</span></Label>
                  <Input
                    type="number" inputMode="decimal" step="any" min={0}
                    {...register(`line_items.${index}.${id}`, {
                      onBlur: () => handleAutoCompute(index),
                    })}
                    className="h-9 text-sm"
                  />
                </div>
              ))}
            </div>

            {/* Exchange value — auto-computed but editable */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Exchange Value (₹) <span className="text-destructive">*</span></Label>
                <button
                  type="button"
                  onClick={() => handleAutoCompute(index)}
                  className="text-xs text-primary underline"
                >
                  Auto-compute
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                <Input
                  type="number" inputMode="decimal" step="any" min={0}
                  {...register(`line_items.${index}.exchange_value`)}
                  className="h-9 text-sm pl-6"
                />
              </div>
              {errors.line_items?.[index]?.exchange_value && (
                <p className="text-xs text-destructive">{errors.line_items[index].exchange_value.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      {totalExchangeValue > 0 && (
        <div className="flex justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium">
          <span className="text-muted-foreground">Total Exchange Credit</span>
          <span className="text-status-in-stock font-semibold">{formatCurrency(totalExchangeValue)}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground -mt-2">
        This exchange credit will appear as an available balance at checkout for this customer.
      </p>

      <Button type="submit" disabled={createExchange.isPending || !customerId} className="h-12">
        {createExchange.isPending ? 'Processing…' : 'Record Exchange'}
      </Button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────
function ExchangeScreen() {
  const [activeTab, setActiveTab] = useState('new');

  const TABS = [
    { key: 'new',     label: 'New Exchange' },
    { key: 'history', label: 'History' },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 pb-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 pt-2">
        <ArrowLeftRight size={20} className="text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">Exchange</h1>
      </div>

      <PillTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />

      {activeTab === 'new'     && <NewExchangeTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  );
}

export default function ExchangePage() {
  return (
    <Suspense>
      <ExchangeScreen />
    </Suspense>
  );
}
