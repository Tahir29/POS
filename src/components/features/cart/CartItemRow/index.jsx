'use client';

// Single cart line item: image, name, SKU, an In Stock/Made to Order badge,
// attributes, quantity control, unit price, line total, a remove action, and
// (opt-in — see showPriceBreakdown below) the full per-product cost breakup.
//
// readOnly MODE: when true, hides the qty stepper, showing a plain "N ×"
// static label instead — used to reuse this exact row on the Checkout
// "Order Items" summary (per instruction: no need to build a second
// item-list component there), where changing HOW MANY of a piece is being
// bought doesn't belong once pricing/payment is already underway.
//
// Removing a line entirely is independent of readOnly (2026-08-24) — the
// checkout page had no way to drop an item that shouldn't be in the sale
// (wrong pick, customer changed their mind) short of abandoning checkout
// and going back to the cart. Whether the trash icon shows is governed
// purely by whether an onRemove handler was passed, same as the qty
// stepper's onUpdateQuantity — readOnly only ever meant "no quantity
// editing here", not "no removal".

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import StockStatusBadge from '@/components/shared/StockStatusBadge';
import CartItemQuantityControl from '@/components/features/cart/CartItemQuantityControl';
import PriceBreakdown from '@/components/features/products/PriceBreakdown';

/**
 * @param {{
 *   item: object,
 *   onUpdateQuantity?: (item: object, quantity: number) => void,
 *   onRemove?: (item: object) => void,
 *   readOnly?: boolean,
 *   priced?: { lineTotal: number, unitPrice: number, discount: number, skus: string[], breakdown: object } | null,
 *   showPriceBreakdown?: boolean,
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
 *
 *   showPriceBreakdown (2026-08-26, default false) — renders the same
 *   Metal/Diamond/.../Total(incl. GST) card the product detail page shows
 *   (see components/products/PriceBreakdown), sourced from priced.breakdown,
 *   below this line's own details. Cart page and checkout's "Order Items"
 *   summary opt in (per-product breakup requested for both); the mini cart
 *   drawer deliberately does NOT — it's a quick glance/edit surface, not
 *   where a customer reviews a full cost breakup per piece.
 */
export default function CartItemRow({
  item, onUpdateQuantity, onRemove, readOnly = false, priced = null, showPriceBreakdown = false,
}) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);

  const unitPrice = priced ? priced.unitPrice : item.unitPrice;
  const lineTotal = priced ? priced.lineTotal : item.unitPrice * item.quantity;
  // item.image is ALREADY a fully-resolved src by the time it lands here —
  // AddToCartButton (and every other cart-populating path: order
  // fulfillment restore, cart hydration) resolves it exactly once before
  // storing it. Used to call resolveImageSrc AGAIN here, which is only
  // harmless for an absolute Shopify URL (it short-circuits unchanged) —
  // for a resolved relative OrnaVerse path it isn't idempotent: a second
  // pass on "/api/upload/ProductImage/x.jpg" doesn't match the "starts with
  // upload/" guard (it starts with "api/"), so it prepended ANOTHER
  // "upload/" and produced a nonsense path that 404s — confirmed live
  // 2026-08-24, this was the entire reason the mini cart showed no image
  // for an item whose own product page displayed it correctly. Fixed here
  // AND made resolveImageSrc itself recognize its own output (see that
  // file) as a second line of defense.
  const imageSrc = item.image ?? null;
  const showImage = imageSrc && !imgError;

  const handleViewProduct = () => {
    if (item.itemId) router.push(`/products/${item.itemId}`);
  };

  const metaParts = [
    item.sizeName,
    item.attributes?.karat,
    item.attributes?.metalColor,
  ].filter(Boolean);

  // In Stock / Made to Order per line (2026-08-24) — same signal
  // ProductCard/the product detail page already show for this product,
  // carried onto the cart item at add-to-cart time (see AddToCartButton).
  // null for a line added before this field existed or via a path that
  // doesn't set it (order fulfillment, abandoned-cart restore);
  // StockStatusBadge already renders nothing for a null status.
  const stockStatus = item.hasStock === true ? 'in_stock'
    : item.hasStock === false ? 'out_stock'
    : null;

  return (
    <div className="flex flex-col gap-3 py-3 border-b border-border last:border-b-0">
      <div className="flex gap-3">
        {/* Thumbnail — clickable through to the product page (2026-08-24),
            same target as the name button below. Plain <button>, not nested
            inside anything else interactive, so no button-in-button conflict
            the way ProductCard's heart icon had to work around. */}
        <button
          type="button"
          onClick={handleViewProduct}
          disabled={!item.itemId}
          aria-label={`View ${item.itemName ?? 'product'}`}
          className="relative shrink-0 h-16 w-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
        >
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
            // Same Logo asset as ProductCard's / ProductImageGallery's own
            // no-image state (2026-08-24) — a missing-photo cart line
            // shouldn't look like a rendering error with a generic broken-
            // image glyph; it's a real, expected state (most catalog rows
            // genuinely have no photo asset yet), so it gets the same small
            // brand touch as everywhere else instead of its own throwaway icon.
            <Logo variant="icon" color="brown" width={24} height={24} className="opacity-40" />
          )}
        </button>

        {/* Two-column split (2026-08-24), not one stacked column with the
            remove button floated into the name's row — that forced the whole
            top row up to the remove button's own 44px touch-target height
            regardless of the name's actual (single-line) height, which read
            as an oversized gap before the SKU line that none of the other
            lines below it had. Left = every product detail, stacked tight;
            right = remove button pinned top, price pinned bottom (via its own
            mt-auto — works whether or not a remove button is even present,
            since the outer row's default stretch gives this column the
            left column's full height to push against). */}
        <div className="flex-1 min-w-0 flex justify-between gap-2">
          <div className="min-w-0 flex flex-col gap-1">
            <button
              type="button"
              onClick={handleViewProduct}
              disabled={!item.itemId}
              className="text-left text-sm font-semibold text-foreground leading-snug line-clamp-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm disabled:cursor-default disabled:hover:no-underline"
            >
              {item.itemName ?? 'Unknown Product'}
            </button>

            {/* item.sku is a holdover name for the CATALOG code (set from
                product.item_code at add-to-cart time, see AddToCartButton) —
                not a real per-piece sku. Labeled "Item Code" so it's never
                confused with the scannable one below. */}
            {item.sku && (
              <p className="text-xs text-muted-foreground">Item Code: {item.sku}</p>
            )}

            {/* The physical piece(s) this line will consume — the REAL,
                scannable sku(s) (e.g. "LJ11255071"), from useCheckoutPricing.
                Only an invoice claims stock — an order is a booking, so there
                is nothing to name and `priced.skus` comes back empty. */}
            {priced?.skus?.length > 0 && (
              <p className="text-xs text-muted-foreground">
                SKU{priced.skus.length > 1 ? 's' : ''}: {priced.skus.join(', ')}
              </p>
            )}

            {metaParts.length > 0 && (
              <p className="text-xs text-muted-foreground">{metaParts.join(' • ')}</p>
            )}

            {stockStatus && (
              <div>
                <StockStatusBadge status={stockStatus} size="sm" />
              </div>
            )}

            <div className="mt-1">
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
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end">
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(item)}
                aria-label={`Remove ${item.itemName ?? 'item'} from cart`}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            )}

            <div className="text-right mt-auto">
              {/* Capped at 2dp: live prices carry fractional paise
                  (226444.105), and the default shows 3 — "₹2,26,444.105 each"
                  reads like a rendering fault next to a rounded total. */}
              <p className="text-xs text-muted-foreground">
                ₹{unitPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })} each
              </p>
              <p className="text-sm font-bold text-foreground">
                ₹{lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </p>
              {/* Per-line share of the cart's discount (2026-08-26) — how much
                  of an applied promo landed on THIS piece specifically, not
                  just the cart-wide total. A component-scoped promo ("20% Off
                  Diamond") can legitimately give ₹0 here on a line with no
                  diamond even while it discounts a different line — that's
                  correct, so this only renders when this line got something. */}
              {priced?.discount > 0 && (
                <p className="text-xs font-medium text-status-in-stock">
                  −₹{priced.discount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} off
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full per-product cost breakup (2026-08-26) — same card the product
          detail page shows, reused verbatim (see this prop's own JSDoc for
          which screens opt in). Nothing to show until pricing has actually
          resolved this line (priced?.breakdown), same gate PriceBreakdown
          itself applies for a null `priced`. */}
      {showPriceBreakdown && priced?.breakdown && (
        <PriceBreakdown priced={priced.breakdown} />
      )}
    </div>
  );
}
