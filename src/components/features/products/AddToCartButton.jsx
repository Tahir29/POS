'use client';

// Enabled by default — out of stock items can be added as made-to-order.
// Disabled only when there's no valid price, since that would silently put
// a ₹0 line item into a real sale.
//
// `unitPrice` is a required prop resolved once by the page and passed down
// through ProductStickyActionBar — never re-derive a price from
// `product.item_rate` here, it is not a usable price (0 for most items).

import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addItem } from '@/store/slices/cartSlice';
import { openCart } from '@/store/slices/uiSlice';
import { resolveImageSrc } from '@/lib/resolveImageSrc';
import TOAST from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS, { GA_ECOMMERCE_EVENTS } from '@/lib/analytics/events';
import { buildProductAttributes } from '@/lib/analytics/productAttributes';

/**
 * @param {{
 *   product:          object,
 *   quantity:         number,
 *   unitPrice:        number | null,
 *   selectedSizeId:   number | null,
 *   selectedSizeName: string | null,
 *   primaryImage:     { src: string, alt: string|null } | null,
 *   stockStatus?:     'in_stock' | 'out_stock' | 'error' | null,
 *   pricedItem?:      object|null, — live-priced SetSalesItems row: the
 *     real price breakup, per-piece sku, and component weights, none of
 *     which live on `product`.
 *   disabled?:        boolean,
 * }} props
 *   stockStatus — passed down from ProductStickyActionBar rather than read
 *   from product.has_stock (which Items/Retrieve doesn't reliably carry).
 *   Carried onto the cart line as hasStock so Cart/Checkout can show an
 *   In Stock/Made to Order badge per line — see CartItemRow.
 */
export default function AddToCartButton({
  product,
  quantity,
  unitPrice = null,
  selectedSizeId,
  selectedSizeName,
  primaryImage = null,
  stockStatus = null,
  pricedItem = null,
  disabled = false,
}) {
  const dispatch = useDispatch();

  const isDisabled = !product || disabled || unitPrice == null;

  // Priority 1: Shopify image (already absolute URL). Priority 2: OrnaVerse
  // image field (handles relative paths + "NA"). `primaryImage` MUST already
  // be colour-matched to `product` (the active variant) by the caller — see
  // products/[itemId]/page.jsx's activePrimaryImage — this component has no
  // colour context of its own to re-derive the right image from.
  const resolvedImage =
    primaryImage?.src ??
    resolveImageSrc(product?.image_url ?? product?.image) ??
    null;


  // `productUrl` is this app's own staff-facing product route (no product
  // handle is resolved anywhere in this codebase, only the numeric id) —
  // built as an ABSOLUTE url since it travels into WebEngage/GA and,
  // eventually, an actual communication (email/push) where a bare path
  // resolves against nothing.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const productUrl = product?.item_id != null ? `${origin}/products/${product.item_id}` : null;

  // Built once via the shared productAttributes.js builder; used for both
  // the cart line's own `attributes` and this event's webengageExtra below,
  // so anything that later reads this cart line already has the full
  // detail without re-deriving it.
  const hasStockBool = stockStatus === 'in_stock' ? true : stockStatus === 'out_stock' ? false : null;
  const fullAttributes = buildProductAttributes({
    product,
    pricedItem: pricedItem,
    image: resolvedImage,
    productUrl,
    selectedSizeId,
    selectedSizeName,
    hasStock: hasStockBool,
  });

  const handleAddToCart = () => {
    if (isDisabled) return;

    dispatch(addItem({
      itemId:     product.item_id,
      itemCode:   product.item_code        ?? '',
      itemName:   product.item_name        ?? 'Unknown Product',
      sku:        product.item_code        ?? '',
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
      sizeId:     selectedSizeId           ?? product.item_size_id   ?? null,
      sizeName:   selectedSizeName         ?? product.item_size_name ?? null,
      image:      resolvedImage,
      hasStock:   hasStockBool,
      styleId:    product.style_id         ?? null,
      productUrl,
      attributes: fullAttributes,
    }));

    // GA4's `items[]` stays close to its reserved shape; the full product
    // detail (photo, link, gemstone/price breakup — needed for a useful
    // "you left this in your cart" retargeting message) goes into
    // webengageExtra (fullAttributes) instead, same PII-safe split every
    // other event in this app follows (see tracker.js's own jsdoc).
    tracker.trackEcommerce(GA_ECOMMERCE_EVENTS.ADD_TO_CART, EVENTS.CART_ITEM_ADDED, {
      currency: 'INR',
      value:    unitPrice * quantity,
      items: [{
        item_id:       String(product.item_id),
        item_name:     product.item_name ?? 'Unknown Product',
        item_sku:      product.item_code ?? '',
        item_category: product.type_name ?? product.item_group_name ?? undefined,
        item_brand:    product.brand_name ?? undefined,
        item_variant:  [product.karat_name, product.metal_color_name].filter(Boolean).join(' ') || undefined,
        price:         unitPrice,
        quantity,
      }],
    }, {
      ...fullAttributes,
      price_unit:  unitPrice,
      price_total: unitPrice * quantity,
      quantity,
    });

    toast.success(TOAST.CART.ITEM_ADDED(product.item_name ?? 'Item'));

    // Every Add to Cart opens the mini cart (2026-08-24) — the item was
    // landing in the cart correctly already, but nothing surfaced it; a
    // toast alone doesn't show WHAT'S actually in the cart now, and the
    // operator had to remember to check manually. CartDrawer itself is
    // global (mounted once in Header, driven by uiSlice's cartOpen), so
    // this is the single place every Add to Cart flows through.
    dispatch(openCart());
  };

  return (
    <Button
      type="button"
      variant="premium"
      onClick={handleAddToCart}
      disabled={isDisabled}
      aria-label="Add to Cart"
      className="flex-1 min-h-[52px] px-6 text-base font-semibold"
    >
      <ShoppingCart size={20} aria-hidden="true" className="shrink-0" />
      Add to Cart
    </Button>
  );
}