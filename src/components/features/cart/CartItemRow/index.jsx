'use client';

// src/components/features/cart/CartItemRow/index.jsx
// Single cart line item: image, name, SKU, attributes, quantity control,
// unit price, line total, and a remove action.

import { useState } from 'react';
import Image from 'next/image';
import { Trash2, ImageOff } from 'lucide-react';
import CartItemQuantityControl from '@/components/features/cart/CartItemQuantityControl';
import { resolveImageSrc } from '@/lib/resolveImageSrc';

/**
 * @param {{
 *   item: object,
 *   onUpdateQuantity: (item: object, quantity: number) => void,
 *   onRemove: (item: object) => void,
 * }} props
 */
export default function CartItemRow({ item, onUpdateQuantity, onRemove }) {
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
    <div className="flex gap-3 py-3 border-b border-stone-100 last:border-b-0">
      {/* Thumbnail */}
      <div className="relative shrink-0 h-16 w-16 rounded-lg overflow-hidden bg-stone-100 flex items-center justify-center">
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
          <ImageOff size={20} className="text-stone-300" aria-hidden="true" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-stone-800 leading-snug line-clamp-2">
            {item.itemName ?? 'Unknown Product'}
          </p>
          <button
            type="button"
            onClick={() => onRemove(item)}
            aria-label={`Remove ${item.itemName ?? 'item'} from cart`}
            className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-stone-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>

        {item.sku && (
          <p className="text-xs text-stone-400">SKU: {item.sku}</p>
        )}

        {metaParts.length > 0 && (
          <p className="text-xs text-stone-500">{metaParts.join(' • ')}</p>
        )}

        <div className="flex items-end justify-between mt-1">
          <CartItemQuantityControl
            quantity={item.quantity}
            onIncrement={() => onUpdateQuantity(item, item.quantity + 1)}
            onDecrement={() => onUpdateQuantity(item, item.quantity - 1)}
          />

          <div className="text-right">
            <p className="text-xs text-stone-400">
              ₹{item.unitPrice.toLocaleString('en-IN')} each
            </p>
            <p className="text-sm font-bold text-stone-800">
              ₹{lineTotal.toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}