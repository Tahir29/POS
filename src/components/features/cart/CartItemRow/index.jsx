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
 *   priced?: { lineTotal: number, unitPrice: number, skus: string[] } | null,
 * }} props
 *   priced — what this line is ACTUALLY being sold at, from
 *   useCheckoutPricing. It must win over the cart's own figure.
 *
 *   The cart price is the item MASTER's — a nominal spec. A sale bills the
 *   physical piece, whose real weight decides the price: the master for
 *   LJ-BR0121-14YGLGD-7 is 2.030g net → ₹30,877.20, while the two bracelets
 *   actually in the case weigh 1.349g → ₹23,507.56 and 1.620g → ₹26,742.80
 *   (metal is ₹9,440 per net gram in all three; verified on UAT 2026-08-05).
 *   Showing "₹30,877.20 each" beside a total of ₹23,507.56 reads as a bug
 *   and misquotes the customer — hence the SKU of the actual piece is shown
 *   too, so the counter knows which one it is billing.
 */
export default function CartItemRow({
  item, onUpdateQuantity, onRemove, readOnly = false, priced = null,
}) {
  const [imgError, setImgError] = useState(false);

  const unitPrice = priced ? priced.unitPrice : item.unitPrice;
  const lineTotal = priced ? priced.lineTotal : item.unitPrice * item.quantity;
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

        {/* The physical piece(s) this line will consume. Only an invoice
            claims stock — an order is a booking, so there is nothing to name
            and `priced.skus` comes back empty. */}
        {priced?.skus?.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Piece{priced.skus.length > 1 ? 's' : ''}: {priced.skus.join(', ')}
          </p>
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
            {/* Capped at 2dp: live prices carry fractional paise
                (226444.105), and the default shows 3 — "₹2,26,444.105 each"
                reads like a rendering fault next to a rounded total. */}
            <p className="text-xs text-muted-foreground tabular-nums">
              ₹{unitPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })} each
            </p>
            <p className="text-sm font-bold text-foreground tabular-nums">
              ₹{lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
