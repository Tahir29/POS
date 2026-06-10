'use client';

// src/components/features/products/AddToCartButton/index.jsx
// Primary CTA on the product detail screen.
// Dispatches cart/addItem Redux action.
// Shows TOAST.CART.ITEM_ADDED(itemName) on success.
// Disabled when: out of stock, or size required but not selected.

import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { ShoppingCart } from 'lucide-react';
import { addItem } from '@/store/slices/cartSlice';
import TOAST from '@/constants/toastMessages';

/**
 * @param {{
 *   product: object,         — full product detail object
 *   quantity: number,
 *   selectedSizeId: number | null,
 *   selectedSizeName: string | null,
 *   stockStatus: 'in_stock' | 'low_stock' | 'out_stock' | null,
 *   hasSizes: boolean,       — true if this product type has sizes
 * }} props
 */
export default function AddToCartButton({
  product,
  quantity,
  selectedSizeId,
  selectedSizeName,
  stockStatus,
  hasSizes,
}) {
  const dispatch = useDispatch();

  const isOutOfStock    = stockStatus === 'out_stock';
  const needsSizeSelect = hasSizes && !selectedSizeId;
  const isDisabled      = isOutOfStock || needsSizeSelect;

  // ── Resolve price ─────────────────────────────────────────────────────────
  // Try all known OrnaVerse price field names
  const unitPrice =
    product?.sale_price   ??
    product?.price        ??
    product?.mrp          ??
    product?.rate         ??
    0;

  // ── Resolve image ─────────────────────────────────────────────────────────
  const rawImage = product?.image_url ?? product?.image ?? null;

  const handleAddToCart = () => {
    if (isDisabled || !product) return;

    // Cart item shape from ARCHITECTURE.md cartSlice definition
    dispatch(addItem({
      itemId:    product.item_id,
      itemCode:  product.item_code   ?? '',
      itemName:  product.item_name   ?? 'Unknown Product',
      sku:       product.item_code   ?? '',
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
      sizeId:    selectedSizeId  ?? null,
      sizeName:  selectedSizeName ?? null,
      image:     rawImage,
      styleId:   product.style_id ?? null,
      attributes: {},
    }));

    toast.success(TOAST.CART.ITEM_ADDED(product.item_name ?? 'Item'));
  };

  // ── Button label logic ────────────────────────────────────────────────────
  const label = isOutOfStock
    ? 'Out of Stock'
    : needsSizeSelect
      ? 'Select a Size'
      : 'Add to Cart';

  return (
    <button
      type="button"
      onClick={handleAddToCart}
      disabled={isDisabled}
      aria-label={label}
      className={`
        flex flex-1 items-center justify-center gap-2
        min-h-[52px] px-6 rounded-xl
        text-base font-semibold
        transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2
        ${isOutOfStock
          ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
          : needsSizeSelect
            ? 'bg-amber-100 text-amber-700 cursor-default'
            : 'bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white shadow-sm hover:shadow-md'
        }
      `}
    >
      {!isOutOfStock && (
        <ShoppingCart size={20} aria-hidden="true" className="shrink-0" />
      )}
      {label}
    </button>
  );
}
