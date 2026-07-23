'use client';

// src/components/features/cart/CartItemRow/index.jsx
// Single cart line item: image, name, SKU, attributes, quantity control,
// unit price, line total, and a remove action.
//
// readOnly MODE (new): when true, hides the qty stepper and remove button,
// showing a plain "N ×" static label instead — used to reuse this exact
// row on the Checkout "Order Items" summary (per instruction: no need to
// build a second item-list component there) where editing doesn't belong.

import { useState } from 'react';
import Image from 'next/image';
import { Trash2, ImageOff } from 'lucide-react';
import CartItemQuantityControl from '@/components/features/cart/CartItemQuantityControl';
import { resolveImageSrc } from '@/lib/resolveImageSrc';

/**
 * @param {{
 *   item: object,
 *   onUpdateQuantity?: (item: object, quantity: number) => void,
 *   onRemove?: (item: object) => void,
 *   readOnly?: boolean,
 * }} props
 */
export default function CartItemRow({ item, onUpdateQuantity, onRemove, readOnly = false }) {
  const [imgError, setImgError] = useState(false);

  const lineTotal = item.unitPrice * item.quantity;
  const imageSrc = resolveImageSrc(item.image);
  const showImage = imageSrc && !imgError;

  // Build a compact attribute/size summary line, skipping empty values.
  const metaParts = [
    item.sizeName,
    item.attributes?.karat,
    item.attributes?.metalColor,
  ].filter(Boolean);

  return (
    <div className="flex gap-3 py-3 border-b border-border last:border-b-0">
      {/* Thumbnail */}
      <div className="relative shrink-0 h-16 w-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
        {showImage ? (
          <Image
            src={imageSrc}
            alt={item.itemName ?? 'Product image'}
            fill
            sizes="64px"
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImageOff size={20} className="text-muted-foreground/50" aria-hidden="true" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
            {item.itemName ?? 'Unknown Product'}
          </p>
          {!readOnly && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item)}
              aria-label={`Remove ${item.itemName ?? 'item'} from cart`}
              className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {item.sku && (
          <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
        )}

        {metaParts.length > 0 && (
          <p className="text-xs text-muted-foreground">{metaParts.join(' • ')}</p>
        )}

        <div className="flex items-end justify-between mt-1">
          {readOnly ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {item.quantity} ×
            </span>
          ) : (
            <CartItemQuantityControl
              quantity={item.quantity}
              onIncrement={() => onUpdateQuantity(item, item.quantity + 1)}
              onDecrement={() => onUpdateQuantity(item, item.quantity - 1)}
            />
          )}

          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              ₹{item.unitPrice.toLocaleString('en-IN')} each
            </p>
            <p className="text-sm font-bold text-foreground">
              ₹{lineTotal.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
