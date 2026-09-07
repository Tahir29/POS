'use client';

// Enabled by default — out of stock items can be added as made-to-order.
// Stock status display is handled separately by StockStatusBadge.
// Disabled when there's no valid price — the item couldn't be priced live,
// so adding it would silently put a ₹0 line item into a real sale, caught
// only much later at checkout. On this tenant that currently covers every
// Silver925 item, which OrnaVerse itself prices at 0.
//
// FIX (2026-07-26): `unitPrice` is a required prop, resolved once by the
// page (product/[itemId]/page.jsx prices via SetSalesItems) and passed down
// through ProductStickyActionBar. This component used to re-derive its own
// price from `product.item_rate`. Never do that — item_rate is not a usable
// price (see the PRICING note in catalogService.js), and it is 0 for most
// items, which used to permanently disable the button even while a real
// price was on screen. Always trust the caller's resolved value.

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

/**
 * @param {{
 *   product:          object,
 *   quantity:         number,
 *   unitPrice:        number | null,
 *   selectedSizeId:   number | null,
 *   selectedSizeName: string | null,
 *   primaryImage:     { src: string, alt: string|null } | null,
 *   stockStatus?:     'in_stock' | 'out_stock' | 'error' | null,
 *   disabled?:        boolean,
 * }} props
 *   stockStatus — ProductStickyActionBar already computes and passes this
 *   (the page's own "currently active" status, in sync with customization —
 *   see products/[itemId]/page.jsx); NOT read from product.has_stock, which
 *   Items/Retrieve doesn't reliably carry (that field belongs to
 *   ProductCatalogRow). Carried onto the cart line as hasStock (2026-08-24)
 *   so the Cart page/drawer/Checkout can show an In Stock/Made to Order
 *   badge per line — see CartItemRow.
 */
export default function AddToCartButton({
  product,
  quantity,
  unitPrice = null,
  selectedSizeId,
  selectedSizeName,
  primaryImage = null,
  stockStatus = null,
  disabled = false,
}) {
  const dispatch = useDispatch();

  const isDisabled = !product || disabled || unitPrice == null;

  // ── Resolve image ─────────────────────────────────────────────────────────
  // Priority 1: Shopify image (src is already an absolute URL)
  // Priority 2: OrnaVerse image field (handles relative paths + "NA")
  //
  // `primaryImage` MUST already be colour-matched to `product` (the active
  // variant) by the caller — see products/[itemId]/page.jsx's
  // activePrimaryImage (lib/productImages.js's resolveActiveProductImage).
  // FIXED 2026-09-08: this used to receive useShopifyProductImages' raw,
  // colour-AGNOSTIC images[0] directly, so adding the same style in two
  // different metal colours to the cart showed the same photo on both
  // lines — whichever colour Shopify happened to list first for that
  // product, regardless of what was actually selected. This component
  // itself has no colour context of its own to re-derive the right image
  // from, so it stays a dumb "trust whatever the caller resolved" — the
  // fix lives entirely in what gets passed in.
  const resolvedImage =
    primaryImage?.src ??
    resolveImageSrc(product?.image_url ?? product?.image) ??
    null;


  // Same product page every add-to-cart happens from today (AddToCartButton
  // has exactly one caller — products/[itemId]/page.jsx, confirmed via
  // grep) — so `productUrl` here is always this app's own staff-facing
  // product route, not a public Shopify storefront link (see cartSlice's
  // own comment on why: no product HANDLE is resolved anywhere in this
  // codebase, only the numeric Shopify id, which isn't a usable path).
  // ABSOLUTE, not the bare path — this is meant to travel into WebEngage/GA
  // and, eventually, an actual communication (email/push), where a bare
  // "/products/123" resolves against nothing. window.location.origin is
  // this deployment's own real origin (UAT or LIVE, whichever is actually
  // running) with no new env var needed; guarded for the (here, never
  // actually hit) SSR case since this file has no server-render path of
  // its own — it only ever runs from a real browser click.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const productUrl = product?.item_id != null ? `${origin}/products/${product.item_id}` : null;
  const weightLabel = (product?.net_weight ?? product?.weight) != null
    ? `${Number(product.net_weight ?? product.weight).toFixed(3)} g`
    : null;

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
      hasStock:   stockStatus === 'in_stock' ? true : stockStatus === 'out_stock' ? false : null,
      styleId:    product.style_id         ?? null,
      productUrl,
      attributes: {
        karat:      product.karat_name       ?? null,
        metalColor: product.metal_color_name ?? null,
        weight:     product.net_weight ?? product.weight ?? null,
      },
    }));

    // ENRICHED 2026-09-08 — this used to send only item_id/name/sku/price/
    // quantity to GA4's shared ecommerce `items[]`, and NOTHING to
    // WebEngage beyond that same bare set (no third argument at all). A
    // retargeting message ("you left this in your cart") needs a photo and
    // a link back to the exact product to be useful, and full specs so the
    // customer recognises which piece it actually is — none of that
    // reached either destination before. GA4's `items[]` stays close to
    // its own reserved shape (a couple of extra non-PII keys is fine — GA4
    // ignores unknown item keys); the full product detail (image, specs,
    // product_url) goes in webengageExtra instead, same PII-safe split
    // every other event in this app already follows (see tracker.js's own
    // jsdoc) — none of this is customer PII, but keeping the split
    // consistent means GA4's own ecommerce reports never silently pick up
    // extra fields nobody asked for.
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
      product_item_id:      product.item_id,
      product_item_code:    product.item_code,
      product_item_name:    product.item_name,
      product_url:          productUrl,
      product_image_url:    resolvedImage,
      product_karat:        product.karat_name ?? null,
      product_metal:        product.metal_name ?? null,
      product_metal_color:  product.metal_color_name ?? null,
      product_weight:       weightLabel,
      product_size:         selectedSizeName ?? product.item_size_name ?? null,
      price_unit:           unitPrice,
      price_total:          unitPrice * quantity,
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