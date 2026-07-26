'use client';

// src/app/(pos)/products/[itemId]/page.jsx
//
// Product detail screen — revamped layout (split panel, sticky ATC bar,
// image zoom, trust/certification sections) while preserving every piece
// of existing functionality not shown in the static mockup:
//   - CustomizeSheet (variant customization) — untouched, fully retained
//   - CrossStoreStockPanel — retained, copy adjusted to match design
//   - Made-to-order hint for OOS items — retained
//   - All existing hooks/data flow — untouched
//
// NEW in this revamp:
//   - Quantity now lives on the page (was hardcoded to 1) so the sticky
//     bottom Total reflects it live
//   - Image zoom modal (react-zoom-pan-pinch) via ProductImageGallery
//   - Sticky bottom action bar (Total + Quantity + Add to Cart)
//   - Static trust/certification sections (ProductTrustSection) — NOT
//     per-product data, see that component's header comment

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { toast }     from 'react-toastify';

import { useProductDetail }     from '@/hooks/products/useProductDetail';
import { useStockByStores }     from '@/hooks/products/useStockByStores';
import { useProductAttributes } from '@/hooks/products/useProductAttributes';
import { useDesignVariants }    from '@/hooks/products/useDesignVariants';
import { useShopifyProductImages } from '@/hooks/products/useShopifyProductImages';
import { useVariantPricing }    from '@/hooks/products/useVariantPricing';

import ProductImageGallery   from '@/components/features/products/ProductImageGallery';
import ProductSpecifications from '@/components/features/products/ProductSpecifications';
import ProductAttributeList  from '@/components/features/products/ProductAttributeList';
import ProductBreadcrumb     from '@/components/features/products/ProductBreadcrumb';
import ProductDetailSkeleton from '@/components/features/products/ProductDetailSkeleton';
import CrossStoreStockPanel  from '@/components/features/products/CrossStoreStockPanel';
import ProductTrustBadge     from '@/components/features/products/ProductTrustBadge';
import CustomizeSheet        from '@/components/features/products/CustomizeSheet';
import ProductStickyActionBar from '@/components/features/products/ProductStickyActionBar';
import ProductTrustSection   from '@/components/features/products/ProductTrustSection';
import ProductReviewsList    from '@/components/features/products/ProductReviewsList';

import TOAST      from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS, { GA_ECOMMERCE_EVENTS } from '@/lib/analytics/events';
import { formatPrice } from '@/lib/priceUtils';
import { Settings2, CheckCircle2 } from 'lucide-react';

const selectActiveStoreId   = (s) => s.store.activeStoreId;
const selectActiveStoreName = (s) => s.store.activeStoreName;

// ── Not found ─────────────────────────────────────────────────────────────────

function ProductNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 px-6 text-center">
      <p className="text-lg font-semibold text-foreground">Product not found</p>
      <p className="text-sm text-muted-foreground">
        This product may have been removed or the link is invalid.
      </p>
    </div>
  );
}

// ── ProductDetailScreen ───────────────────────────────────────────────────────

function ProductDetailScreen() {
  const { itemId } = useParams();
  const activeStoreId   = useSelector(selectActiveStoreId);
  const activeStoreName = useSelector(selectActiveStoreName);

  // ── Server state ──────────────────────────────────────────────────────────
  const {
    data:      product,
    isLoading: detailLoading,
    isError:   detailError,
  } = useProductDetail(itemId);

  const { data: attributes = [] } = useProductAttributes(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  // Declared before useStockByStores below so the "Stock Across Stores"
  // panel can be scoped to whichever variant is currently confirmed, not
  // always the base product.
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);

  // Cross-store stock for the confirmed variant when one is selected,
  // otherwise the base product. MTO variants have no real item_id to check
  // (see CrossStoreStockPanel's hide condition below) — falls back to the
  // product's own id, which is fine since the panel is hidden in that case.
  //
  // This is also now the ONLY source used to derive the base product's
  // stock status (see baseStockStatus below) — the separate GetStock-by-SKU
  // endpoint (useProductStock, removed 2026-07-26) was confirmed live to
  // return an empty result for real in-catalog SKUs, and its fallback
  // optimistically defaulted to "in stock" with zero real signal behind it.
  // That caused a real, user-reported bug: the "In stock at {store}" banner
  // showed true for a store with genuinely zero pieces, while this exact
  // per-store data (same call, already correct) showed it had no row for
  // that store at all. Deriving both from the same source keeps them
  // consistent by construction.
  const { data: storeStocks = [], isLoading: storeStocksLoading } = useStockByStores(
    selectedVariant?.item_id ?? product?.item_id
  );

  // Current store's stock qty. Not a hard cap on quantity — customers can
  // order more than what's physically in stock; anything beyond this is
  // fulfilled as Made to Order (see madeToOrderQty below).
  const currentStoreStock = useMemo(
    () => storeStocks.find((s) => s.company_id === activeStoreId) ?? null,
    [storeStocks, activeStoreId]
  );
  const availableStock = currentStoreStock?.pieces > 0 ? currentStoreStock.pieces : 0;

  // ── Variants ──────────────────────────────────────────────────────────────
  const {
    variants,
    externalProductId,
    metalColors,
    variantStock,
    storesByItemId,
    karats,
    sizes,
    findVariant,
    hasVariants,
    isLoading: variantsLoading,
  } = useDesignVariants(product?.style_id ?? null, activeStoreId);

  // ── Shopify images ────────────────────────────────────────────────────────
    const { images: shopifyImages, videos: shopifyVideos, primaryImage, isLoading: shopifyImagesLoading } = useShopifyProductImages(externalProductId);

  // Gallery is genuinely "loading" while either: variants are still
  // resolving (which is what determines externalProductId in the first
  // place), or the Shopify images fetch itself is in flight. Combining both
  // avoids the gallery flashing a hard "no image" state before either has
  // had a chance to return data.
  const imagesLoading = variantsLoading || shopifyImagesLoading;

  // Reset when navigating to a different product
  // useEffect(() => {
  //   setSelectedVariant(null);
  //   setCustomizeOpen(false);
  //   setQuantity(1);
  // }, [itemId]);

  useEffect(() => {
    if (detailError) toast.error(TOAST.GENERIC.SOMETHING_WRONG);
  }, [detailError]);

  // view_item — fires once per product once its detail has actually loaded
  useEffect(() => {
    if (!product) return;
    const unitPrice =
      product.item_rate  ||
      product.sale_price ||
      product.price      ||
      product.mrp        ||
      product.rate       ||
      null;

    tracker.trackEcommerce(GA_ECOMMERCE_EVENTS.VIEW_ITEM, EVENTS.PRODUCT_VIEWED, {
      currency: 'INR',
      value:    unitPrice ?? undefined,
      items: [{
        item_id:   String(product.item_id),
        item_name: product.item_name ?? 'Unknown Product',
        item_sku:  product.item_code ?? '',
        price:     unitPrice,
      }],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.item_id]);

  // ── Derived ───────────────────────────────────────────────────────────────
  // Base product's stock status at the CURRENT store — derived from the
  // same real per-store data (GetStockByStores) that powers "Stock Across
  // Stores" below, not a separate/looser signal. No row for the active
  // store in that response means genuinely zero pieces there.
  //
  // Binary only (in_stock / out_stock) — matches the variant path below and
  // the rest of this page's UI (tag, banner, details block all only ever
  // render two states). A 1-3-piece "low_stock" tier was tried here and
  // fixed on 2026-07-26 — the UI doesn't have a third visual state for it,
  // so it was showing as an unexplained "Low Stock" tag for a genuinely
  // in-stock product.
  const baseStockStatus = storeStocksLoading
    ? null
    : availableStock > 0 ? 'in_stock' : 'out_stock';

  // Active item = selected variant (if customized) else original product
  const activeItem = selectedVariant ?? product;

  // A confirmed variant counts as Made to Order either because it's the
  // pseudo-fallback (_isMTO — no real SKU exists for that combo) or because
  // it's a real SKU with zero stock everywhere — same condition CustomizeSheet
  // itself uses for the "Made to Order" badge, kept in sync here so "Stock
  // Across Stores" hides in both cases, not just the fallback one.
  const isSelectedVariantMTO = !!selectedVariant &&
    (selectedVariant._isMTO || (selectedVariant.pieces ?? 0) === 0);

  // Downstream `stockStatus` always means "status of whatever is currently
  // active" — base product, or the confirmed customized variant — so the
  // floating image badge, in-stock banner, MTO hint, and sticky bar all stay
  // in sync with customization instead of being frozen on the base product.
  // Variant stock is real per-store data (see useDesignVariants), so this is
  // binary in_stock/out_stock rather than distinguishing low_stock.
  const stockStatus = selectedVariant
    ? (isSelectedVariantMTO ? 'out_stock' : 'in_stock')
    : baseStockStatus;

  // Karat/color/size + SKU for whichever item is active — feeds the
  // always-visible "product details" block below the price.
  const na = (v) => (v && v !== 'NA' ? v : null);
  const activeKarat = na(activeItem?.karat_name);
  const activeColor = na(activeItem?.metal_color_name);
  const activeSize  = na(activeItem?.item_size_name);
  const activeDetailsLine =
    [activeKarat, activeColor].filter(Boolean).join(' · ') +
    (activeSize ? ` · Size ${activeSize}` : '');
  const activeCode = activeItem?.item_code ?? null;

  // item_rate === 0 means this SKU was never given a static price — its
  // real sell price floats with today's metal rate (see pricingService.js
  // / apiEndpoints.js HELPERS block). Fetch it live via SetSalesItems
  // rather than falling through to stale fields (Shopify-synced `price` is
  // a snapshot, not today's rate — confirmed live 2026-07-22 the two can
  // differ by ~12%).
  const needsLivePricing = !!activeItem && (activeItem.item_rate ?? 0) === 0;
  const {
    data:      livePricing,
    isLoading: pricingLoading,
    isError:   pricingError,
    refetch:   refetchPricing,
  } = useVariantPricing(needsLivePricing ? activeItem : null);

  // sub_total (rate + labour, pre-tax) is the analog of item_rate here —
  // matches how item_rate itself is pre-tax for statically-priced items
  // (is_tax_inclusive: false), so this doesn't change the existing
  // tax-exclusive display convention.
  const effectiveRate = needsLivePricing ? livePricing?.sub_total : activeItem?.item_rate;

  const price = formatPrice(
    effectiveRate          ??
    activeItem?.sale_price ??
    activeItem?.price      ??
    activeItem?.mrp        ??
    activeItem?.rate
  );

  const numericUnitPrice =
    effectiveRate          ||
    activeItem?.sale_price ||
    activeItem?.price      ||
    activeItem?.mrp        ||
    activeItem?.rate       ||
    null;

  const hasDiscount = !!(activeItem?.compare_price && numericUnitPrice && activeItem.compare_price > numericUnitPrice);
  const discountPct = hasDiscount ? Math.round((1 - numericUnitPrice / activeItem.compare_price) * 100) : null;
  const saveAmount  = hasDiscount ? formatPrice(activeItem.compare_price - numericUnitPrice) : null;

  // No stock-based ceiling — quantity is only bounded by QuantitySelector's
  // own internal sane default (99) inside ProductStickyActionBar.
  const madeToOrderQty = Math.max(0, quantity - availableStock);

  // Show Customize button when product has a style_id
  const hasCustomization = !!product?.style_id;

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const handleCustomizeConfirm = useCallback((variant) => {
    if (variant) setSelectedVariant(variant);
  }, []);

  // ── Loading / error ───────────────────────────────────────────────────────
  if (detailLoading) return <ProductDetailSkeleton />;
  if (detailError || !product) return <ProductNotFound />;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full">

      <div className="flex flex-col gap-8 pb-6 px-4 pt-4 md:gap-10 md:px-6 md:pt-5">

        <ProductBreadcrumb product={product} />

        <div className="flex flex-col xl:flex-row gap-6 md:gap-8">

          {/* Left — Image gallery */}
          <div className="w-full xl:w-[45%] shrink-0">
            <ProductImageGallery product={activeItem} shopifyImages={shopifyImages} shopifyVideos={shopifyVideos} activeColorName={activeItem?.metal_color_name ?? null} isLoading={imagesLoading} stockStatus={stockStatus} />
          </div>

          {/* Right — Info + actions */}
          <div className="flex flex-col gap-4 flex-1 min-w-0">

            {/* SKU */}
            {product.item_code && (
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {product.item_code}
              </p>
            )}

            {/* Product name */}
            <h1 className="font-heading text-xl text-foreground leading-snug md:text-3xl">
              {product.item_name ?? 'Product'}
            </h1>

            {/* Price + discount */}
            <div>
              <div className="flex items-baseline gap-2">
                {needsLivePricing && pricingLoading ? (
                  <p className="text-sm font-medium text-muted-foreground">Calculating live price…</p>
                ) : price ? (
                  <p className="font-heading text-3xl text-primary">{price}</p>
                ) : needsLivePricing && pricingError ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-status-made-order">
                    Could not calculate live price
                    <button
                      type="button"
                      onClick={() => refetchPricing()}
                      className="font-semibold underline underline-offset-2 hover:text-status-made-order/80"
                    >
                      Retry
                    </button>
                  </p>
                ) : (
                  // Live pricing came back empty, or this SKU has no static
                  // rate and isn't a BOM item live pricing could resolve —
                  // say so explicitly rather than leaving a blank where the
                  // price should be, since a customized selection implies
                  // real purchase intent.
                  <p className="text-sm font-medium text-status-made-order">
                    Price not available for this option — needs costing before it can be sold
                  </p>
                )}
                {hasDiscount && (
                  <>
                    <p className="text-base text-muted-foreground line-through">
                      {formatPrice(activeItem.compare_price)}
                    </p>
                    <span className="text-sm font-semibold text-status-in-stock">
                      {discountPct}% OFF
                    </span>
                  </>
                )}
              </div>
              {hasDiscount && saveAmount && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Save {saveAmount}
                </p>
              )}
            </div>

            {/* In-stock-at-current-store banner */}
            {stockStatus === 'in_stock' && activeStoreName && (
              <div className="flex items-center gap-2.5 rounded-xl bg-status-in-stock/10 border border-status-in-stock/20 px-4 py-3">
                <CheckCircle2 size={18} className="shrink-0 text-status-in-stock" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-status-in-stock">
                    In stock at {activeStoreName}
                  </p>
                  <p className="text-xs text-status-in-stock/70">
                    Ready to bill · take home today
                  </p>
                </div>
              </div>
            )}

            {/* Product details — karat/color/size + SKU, with a live
                in-stock/out-of-stock indicator. Always visible (reflects the
                base product on first load, then whichever variant is
                confirmed via Customize) rather than only appearing after
                customizing, so availability is never hidden behind an
                interaction. */}
            {(activeDetailsLine || activeCode) && (
              <div className="rounded-xl bg-secondary/40 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  {activeDetailsLine && (
                    <p className="font-medium text-foreground">{activeDetailsLine}</p>
                  )}
                  {stockStatus && (
                    <span
                      className={`flex shrink-0 items-center gap-1.5 text-xs font-semibold ${
                        stockStatus === 'out_stock' ? 'text-status-error' : 'text-status-in-stock'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          stockStatus === 'out_stock' ? 'bg-status-error' : 'bg-status-in-stock'
                        }`}
                        aria-hidden="true"
                      />
                      {stockStatus === 'out_stock' ? 'Out of Stock' : 'In Stock'}
                    </span>
                  )}
                </div>
                {activeCode && (
                  <p className="text-xs text-muted-foreground mt-0.5">{activeCode}</p>
                )}
              </div>
            )}

            {/* Customize button — shown when design has variants */}
            {hasCustomization && (
              <button
                type="button"
                onClick={() => setCustomizeOpen(true)}
                className="
                  flex items-center justify-between w-full
                  px-4 py-3 rounded-xl min-h-[48px]
                  border border-border bg-card
                  hover:border-accent active:bg-secondary/50
                  transition-colors
                "
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Settings2 size={16} className="text-accent shrink-0" />
                  {selectedVariant ? 'Change Customization' : 'Customize this piece'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {selectedVariant
                    ? `${selectedVariant.karat_name} · ${selectedVariant.metal_color_name}`
                    : 'Metal · Size'
                  }
                </span>
              </button>
            )}

            {/* Made-to-order hint for out of stock items */}
            {stockStatus === 'out_stock' && (
              <p className="text-sm text-primary">
                This item is currently out of stock — can be ordered as Made to Order.
              </p>
            )}

            {/* Availability at other stores — hidden once the confirmed
                customization is Made to Order (no real stock anywhere to
                report), shown for the base product or any in-stock variant */}
            {!isSelectedVariantMTO && (
              <CrossStoreStockPanel
                storeStocks={storeStocks}
                isLoading={storeStocksLoading}
              />
            )}

          </div>
        </div>

        <ProductTrustBadge />

        <ProductSpecifications product={activeItem} />

        <ProductTrustSection />

        {/* {attributes.length > 0 && (
          <ProductAttributeList attributes={attributes} />
        )} */}

        {/* Customer reviews — infinite scroll, bottom of page. Uses the
            same externalProductId already resolved above for Shopify
            images, so this adds zero extra OrnaVerse calls. */}
        <ProductReviewsList shopifyProductId={externalProductId} />

      </div>

      {/* Sticky bottom action bar */}
      <ProductStickyActionBar
        unitPrice={numericUnitPrice}
        quantity={quantity}
        onQuantityChange={setQuantity}
        availableStock={availableStock}
        madeToOrderQty={madeToOrderQty}
        product={activeItem}
        selectedSizeId={selectedVariant?.item_size_id ?? null}
        selectedSizeName={selectedVariant?.item_size_name ?? null}
        stockStatus={stockStatus}
        primaryImage={primaryImage}
      />

      {/* Customize sheet — fully retained, untouched logic */}
      <CustomizeSheet
        isOpen={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        product={product}
        selectedVariant={selectedVariant}
        variants={variants}
        metalColors={metalColors}
        karats={karats}
        sizes={sizes}
        variantStock={variantStock}
        storesByItemId={storesByItemId}
        findVariant={findVariant}
        onConfirm={handleCustomizeConfirm}
        isLoading={variantsLoading}
      />

    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductDetailScreen />
    </Suspense>
  );
}