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

import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { ShoppingCart } from 'lucide-react';
import { addItem } from '@/store/slices/cartSlice';
import { resolveImageSrc } from '@/lib/resolveImageSrc';
import TOAST from '@/constants/toastMessages';

/**
 * @param {{
 *   product:          object,
 *   quantity:         number,
 *   selectedSizeId:   number | null,
 *   selectedSizeName: string | null,
 *   primaryImage:     { src: string, alt: string|null } | null,
 *   disabled?:        boolean,
 * }} props
 */
export default function AddToCartButton({
  product,
  quantity,
  selectedSizeId,
  selectedSizeName,
  primaryImage = null,
  disabled = false,
}) {
  const dispatch = useDispatch();

  // ── Resolve price ─────────────────────────────────────────────────────────
  // A real jewellery item is never actually free — treat 0 the same as
  // missing (see catalogService.enrichWithPrice for the same rule elsewhere).
  const unitPrice =
    product?.item_rate  ||
    product?.sale_price ||
    product?.price      ||
    product?.mrp        ||
    product?.rate       ||
    null;

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

    toast.success(TOAST.CART.ITEM_ADDED(product.item_name ?? 'Item'));
  };

  return (
    <button
      type="button"
      onClick={handleAddToCart}
      disabled={isDisabled}
      aria-label="Add to Cart"
      className="
        flex flex-1 items-center justify-center gap-2
        min-h-[52px] px-6 rounded-xl
        text-base font-semibold
        bg-accent hover:bg-accent/90 active:scale-[0.98]
        text-accent-foreground shadow-sm hover:shadow-md
        transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
      "
    >
      <ShoppingCart size={20} aria-hidden="true" className="shrink-0" />
      Add to Cart
    </button>
  );
}