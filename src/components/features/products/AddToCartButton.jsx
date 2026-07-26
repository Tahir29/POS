'use client';

// src/components/features/products/AddToCartButton.jsx
// Primary CTA on the product detail screen.
// Dispatches cart/addItem Redux action.
// Shows TOAST.CART.ITEM_ADDED(itemName) on success.
//
// Enabled by default — out of stock items can be added as made-to-order.
// Stock status display is handled separately by StockStatusBadge.
// Disabled when there's no valid price (item_rate === 0 means this variant
// was never costed) — adding it would silently put a ₹0 line item into a
// real sale, which only gets caught much later at checkout.
//
// FIX (2026-07-26): `unitPrice` is now a required prop, resolved once by
// the page (product/[itemId]/page.jsx handles live-priced items via
// SetSalesItems there) and passed down through ProductStickyActionBar.
// This component used to re-derive its own price straight from
// `product.item_rate` — for any item needing live pricing, item_rate is
// always 0, so that recomputation always came back null and permanently
// disabled the button even when a real live price was showing on-screen
// and had already been added to the cart total. Never recompute price
// here; always trust the caller's resolved value.

import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addItem } from '@/store/slices/cartSlice';
import { resolveImageSrc } from '@/lib/resolveImageSrc';
import TOAST from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS, { GA_ECOMMERCE_EVENTS } from '@/lib/analytics/events';

/**
 * @param {{
 *   product:          object,
 *   quantity:         number,
 *   unitPrice:        number | null,
 *   selectedSizeId:   number | null,
 *   selectedSizeName: string | null,
 *   primaryImage:     { src: string, alt: string|null } | null,
 *   disabled?:        boolean,
 * }} props
 */
export default function AddToCartButton({
  product,
  quantity,
  unitPrice = null,
  selectedSizeId,
  selectedSizeName,
  primaryImage = null,
  disabled = false,
}) {
  const dispatch = useDispatch();

  const isDisabled = !product || disabled || unitPrice == null;

  // ── Resolve image ─────────────────────────────────────────────────────────
  // Priority 1: Shopify image (src is already an absolute URL)
  // Priority 2: OrnaVerse image field (handles relative paths + "NA")
  const resolvedImage =
    primaryImage?.src ??
    resolveImageSrc(product?.image_url ?? product?.image) ??
    null;


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
      styleId:    product.style_id         ?? null,
      attributes: {
        karat:      product.karat_name       ?? null,
        metalColor: product.metal_color_name ?? null,
      },
    }));

    tracker.trackEcommerce(GA_ECOMMERCE_EVENTS.ADD_TO_CART, EVENTS.CART_ITEM_ADDED, {
      currency: 'INR',
      value:    unitPrice * quantity,
      items: [{
        item_id:   String(product.item_id),
        item_name: product.item_name ?? 'Unknown Product',
        item_sku:  product.item_code ?? '',
        price:     unitPrice,
        quantity,
      }],
    });

    toast.success(TOAST.CART.ITEM_ADDED(product.item_name ?? 'Item'));
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