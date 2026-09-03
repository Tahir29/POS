'use client';

// Custom Estimation panel — price a bespoke piece not in the catalog.
// Calculate-only for now: see customEstimationService.js for why Save is
// deliberately not wired here (confirmed-broken Estimation/Create).

import { useState } from 'react';
import { AlertTriangle, Calculator } from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';
import InlineLoader from '@/components/shared/InlineLoader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCustomEstimateItems } from '@/hooks/estimation/useCustomEstimateItems';
import { useCustomEstimateQuote } from '@/hooks/estimation/useCustomEstimateQuote';

function formatINR(amount) {
  if (amount == null) return '—';
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function ItemPickerSheet({ isOpen, onClose, onSelect }) {
  const { items, isLoading, isError, refetch } = useCustomEstimateItems();

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Select Custom Estimate Item">
      {isLoading && <InlineLoader className="py-12" label="Loading items…" />}

      {isError && (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-muted-foreground">Failed to load items.</p>
          <button onClick={refetch} className="text-xs font-medium text-primary">Retry</button>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState title="No items are marked Custom Estimate." className="border-0 py-12" />
      )}

      {!isLoading && !isError && items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <button
              key={item.item_id}
              type="button"
              onClick={() => { onSelect(item); onClose(); }}
              className="flex flex-col items-start gap-0.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:bg-muted transition-colors"
            >
              <span className="text-sm font-medium text-foreground">{item.item_name}</span>
              <span className="text-xs text-muted-foreground">
                {item.item_code} · {item.karat_name} {item.metal_name}
              </span>
            </button>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

export default function CustomEstimatePanel() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [weight, setWeight] = useState('');
  const { quote, reset, result, error, isLoading } = useCustomEstimateQuote();

  const handleSelect = (item) => {
    setSelectedItem(item);
    setWeight('');
    reset();
  };

  const handleChangeItem = () => {
    setSelectedItem(null);
    setWeight('');
    reset();
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Custom estimate</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Isolated from Scan / Browse. Only items marked Custom Estimate on item master appear here.
          </p>
        </div>

        {!selectedItem ? (
          <Button type="button" onClick={() => setPickerOpen(true)} className="w-full">
            Select item
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-border bg-muted p-3 text-sm">
              <p className="font-medium text-foreground">{selectedItem.item_name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedItem.item_code} · {selectedItem.karat_name} {selectedItem.metal_name}
              </p>
              <button type="button" onClick={handleChangeItem} className="mt-1 text-xs font-medium text-primary">
                Change item
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom_weight">Weight (grams) <span className="text-destructive">*</span></Label>
              <Input
                id="custom_weight"
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0.000"
                className="h-11"
              />
            </div>

            <Button
              type="button"
              onClick={() => quote(selectedItem, Number(weight))}
              disabled={isLoading || !weight}
              className="w-full gap-2"
            >
              <Calculator size={16} /> {isLoading ? 'Calculating…' : 'Calculate Estimate'}
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Estimate Summary</h3>

        {!result && !error && !isLoading && (
          <p className="text-sm text-muted-foreground">Select a custom estimate item to begin.</p>
        )}

        {isLoading && <InlineLoader className="py-8" label="Pricing…" />}

        {error && !isLoading && <p className="text-sm text-destructive">{error}</p>}

        {result && !isLoading && !error && (
          <dl className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Weight</dt>
              <dd className="font-medium text-foreground">{result.net_weight}g</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Rate</dt>
              <dd className="font-medium text-foreground">{formatINR(result.item_rate)}/g</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sub Total</dt>
              <dd className="font-medium text-foreground">{formatINR(result.sub_total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tax</dt>
              <dd className="font-medium text-foreground">{formatINR(result.tax_amount)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5 mt-0.5">
              <dt className="font-medium text-foreground">Net Amount</dt>
              <dd className="text-base font-semibold text-foreground">{formatINR(result.net_amount)}</dd>
            </div>
          </dl>
        )}

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground border-t border-border pt-2 mt-1">
          <AlertTriangle size={13} className="shrink-0 mt-0.5 text-status-made-order" aria-hidden="true" />
          This is a live quote only — saving custom estimates is blocked by a confirmed
          server-side issue on OrnaVerse&apos;s end (Estimation/Create fails on any real
          line item), not something wrong with your input.
        </p>
      </div>

      <ItemPickerSheet isOpen={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleSelect} />
    </div>
  );
}