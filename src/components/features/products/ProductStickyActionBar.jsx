'use client';

// src/components/features/products/ProductStickyActionBar/index.jsx
//
// Fixed bottom bar: Total (unit price × quantity) + QuantitySelector + AddToCartButton.
//
// Quantity is intentionally NOT capped by physical stock — customers can
// order more than what's on the shelf; anything beyond availableStock is
// fulfilled as Made to Order. We surface that as a clear, non-blocking
// notice rather than disabling the stepper or the Add to Cart button.

import { PackagePlus } from 'lucide-react';
import QuantitySelector  from '@/components/features/products/QuantitySelector';
import AddToCartButton   from '@/components/features/products/AddToCartButton';

// Sane upper bound for the stepper itself — not a stock cap, just a
// reasonable ceiling to stop the +/- control scrolling forever.
const QUANTITY_CEILING = 99;

function formatINR(value) {
  if (value == null) return null;
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

/**
 * @param {{
 *   unitPrice: number|null,
 *   quantity: number,
 *   onQuantityChange: (n: number) => void,
 *   availableStock?: number,
 *   madeToOrderQty?: number,
 *   product: object,
 *   selectedSizeId?: number|null,
 *   selectedSizeName?: string|null,
 *   stockStatus?: string|null,
 *   primaryImage?: object|null,
 * }} props
 */
export default function ProductStickyActionBar({
  unitPrice,
  quantity,
  onQuantityChange,
  availableStock = 0,
  madeToOrderQty = 0,
  product,
  selectedSizeId,
  selectedSizeName,
  stockStatus,
  primaryImage,
}) {
  const total = unitPrice != null ? unitPrice * quantity : null;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-20 border-t border-border bg-card px-4 py-3 md:px-6">
      <div className="max-w-5xl mx-auto">

        {/* Made-to-Order notice — non-blocking, quantity is never capped */}
        {madeToOrderQty > 0 && (
          <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-700">
            <PackagePlus size={13} className="shrink-0" aria-hidden="true" />
            <span>
              {availableStock > 0
                ? `${availableStock} available now · ${madeToOrderQty} more will be Made to Order`
                : `All ${madeToOrderQty} will be Made to Order`}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">

          {/* Total */}
          <div className="shrink-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Total
            </p>
            <p className="font-heading text-xl text-foreground leading-tight">
              {total != null ? formatINR(total) : '—'}
            </p>
          </div>

          {/* Quantity — not capped by stock */}
          <QuantitySelector
            quantity={quantity}
            onChange={onQuantityChange}
            maxQty={QUANTITY_CEILING}
          />

          {/* Add to Cart — always enabled regardless of stock vs quantity */}
          <AddToCartButton
            product={product}
            quantity={quantity}
            selectedSizeId={selectedSizeId}
            selectedSizeName={selectedSizeName}
            stockStatus={stockStatus}
            primaryImage={primaryImage}
          />
        </div>
      </div>
    </div>
  );
}