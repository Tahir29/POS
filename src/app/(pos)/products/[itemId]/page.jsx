'use client';

// Product detail screen — split panel with sticky add-to-cart bar, image
// zoom, and trust/certification sections. Pricing and stock status are
// always resolved live (see useVariantPricing/useStockByStores usage below)
// rather than read from stale catalog snapshot fields.

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';
import { toast }     from 'react-toastify';
import { useReducedMotion } from 'motion/react';

import { useProductDetail }     from '@/hooks/products/useProductDetail';
import { useStockByStores }     from '@/hooks/products/useStockByStores';
import { useDesignVariants }    from '@/hooks/products/useDesignVariants';
import { useShopifyProductImages } from '@/hooks/products/useShopifyProductImages';
import { useVariantPricing }    from '@/hooks/products/useVariantPricing';

import ProductImageGallery   from '@/components/features/products/ProductImageGallery';
import ProductSpecifications from '@/components/features/products/ProductSpecifications';
import ProductBreadcrumb     from '@/components/features/products/ProductBreadcrumb';
import ProductDetailSkeleton from '@/components/features/products/ProductDetailSkeleton';
import CrossStoreStockPanel  from '@/components/features/products/CrossStoreStockPanel';
import ProductTrustBadge     from '@/components/features/products/ProductTrustBadge';
import CustomizeSheet        from '@/components/features/products/CustomizeSheet';
import PriceBreakdown        from '@/components/features/products/PriceBreakdown';
import ProductStickyActionBar from '@/components/features/products/ProductStickyActionBar';
import ProductTrustSection   from '@/components/features/products/ProductTrustSection';
import ProductReviewsList    from '@/components/features/products/ProductReviewsList';
import ProductReviewSummaryLink from '@/components/features/products/ProductReviewSummaryLink';
import RecentlyViewedCarousel from '@/components/features/products/RecentlyViewedCarousel';
import WishlistButton         from '@/components/features/products/WishlistButton';
import { useRecordProductView } from '@/hooks/products/useRecentlyViewed';
import { deriveKaratCode } from '@/lib/karat';
import { resolveImageSrc } from '@/lib/resolveImageSrc';
import { resolveActiveProductImage } from '@/lib/productImages';

import TOAST      from '@/constants/toastMessages';
import tracker from '@/lib/analytics/tracker';
import EVENTS, { GA_ECOMMERCE_EVENTS } from '@/lib/analytics/events';
import { buildProductAttributes } from '@/lib/analytics/productAttributes';
import { formatPrice } from '@/lib/priceUtils';
import { Settings2, CheckCircle2, Copy, Check } from 'lucide-react';

const selectActiveStoreId   = (s) => s.store.activeStoreId;
const selectActiveStoreName = (s) => s.store.activeStoreName;
const selectActiveStoreCode = (s) => s.store.activeStoreCode;
const selectCartCustomerId       = (s) => s.cart.customerId;
const selectCartCustomerName     = (s) => s.cart.customerName;
const selectCartCustomerMobile   = (s) => s.cart.customerMobile;
const selectCartCustomerAddress  = (s) => s.cart.customerAddress;

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
  const activeStoreCode = useSelector(selectActiveStoreCode);
  const cartCustomerId      = useSelector(selectCartCustomerId);
  const cartCustomerName    = useSelector(selectCartCustomerName);
  const cartCustomerMobile  = useSelector(selectCartCustomerMobile);
  const cartCustomerAddress = useSelector(selectCartCustomerAddress);

  // ── Server state ──────────────────────────────────────────────────────────
  const {
    data:      product,
    isLoading: detailLoading,
    isError:   detailError,
  } = useProductDetail(itemId);

  // ── UI state ──────────────────────────────────────────────────────────────
  // Declared before useStockByStores so "Stock Across Stores" can scope to
  // whichever variant is currently confirmed, not just the base product.
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const reduceMotion = useReducedMotion();

  // Cross-store stock for the confirmed variant, else the base product (MTO
  // variants have no real item_id — falls back to the product's id, which is
  // safe since the panel is hidden for MTO anyway). Also the sole source for
  // baseStockStatus below — do not reintroduce a separate SKU-based stock
  // call here (see baseStockStatus comment for why).
  const {
    data: storeStocks = [],
    isLoading: storeStocksLoading,
    isError: storeStocksError,
    refetch: refetchStoreStocks,
  } = useStockByStores(selectedVariant?.item_id ?? product?.item_id);

  // Not a hard cap on quantity — anything beyond this is fulfilled as
  // Made to Order (see madeToOrderQty below).
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
    storesByItemId,
    karats,
    sizes,
    findVariant,
    hasVariants,
    isLoading: variantsLoading,
  } = useDesignVariants(product?.style_id ?? null, activeStoreId);

  // ── Shopify images ────────────────────────────────────────────────────────
  // Raw `primaryImage` (images[0]) is deliberately unused here — it's
  // colour-agnostic; see activePrimaryImage below.
  const { images: shopifyImages, videos: shopifyVideos, isLoading: shopifyImagesLoading } = useShopifyProductImages(externalProductId);

  // Combines both loading flags so the gallery doesn't flash "no image"
  // before variants (which resolve externalProductId) have settled.
  const imagesLoading = variantsLoading || shopifyImagesLoading;

  useEffect(() => {
    if (detailError) toast.error(TOAST.GENERIC.SOMETHING_WRONG);
  }, [detailError]);


  // ── Derived ───────────────────────────────────────────────────────────────
  // Base stock status at the current store, derived from the same
  // GetStockByStores data as "Stock Across Stores" (no row for the active
  // store means genuinely zero pieces). Binary only (in_stock/out_stock) —
  // the UI has no third visual state, so don't reintroduce a "low_stock"
  // tier here. 'error' stays a distinct state, never folded into
  // 'out_stock' — a failed check must not read as a confirmed zero.
  const baseStockStatus = storeStocksLoading
    ? null
    : storeStocksError
      ? 'error'
      : availableStock > 0 ? 'in_stock' : 'out_stock';

  // Active item = selected variant (if customized) else original product
  const activeItem = selectedVariant ?? product;

  // Colour-matched image for the cart line — reuses ProductImageGallery's
  // own colour-filtering logic (lib/productImages.js) instead of the
  // colour-blind raw primaryImage, so the cart line always shows the photo
  // matching the variant actually selected.
  const activePrimaryImage = useMemo(
    () => resolveActiveProductImage(shopifyImages, activeItem?.metal_color_name ?? null, activeItem, resolveImageSrc),
    [shopifyImages, activeItem]
  );

  // MTO = pseudo-fallback (_isMTO, no real SKU for that combo) or a real SKU
  // with zero stock everywhere — same condition CustomizeSheet uses for its
  // badge, kept in sync so "Stock Across Stores" hides in both cases.
  const isSelectedVariantMTO = !!selectedVariant &&
    (selectedVariant._isMTO || (selectedVariant.pieces ?? 0) === 0);

  // "Status of whatever is currently active" — base product or confirmed
  // variant — so the badge/banner/MTO hint/sticky bar stay in sync with
  // customization instead of freezing on the base product.
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

  // Copy-to-clipboard for the SKU line.
  const [skuCopied, setSkuCopied] = useState(false);
  const skuCopyTimeoutRef = useRef(null);
  useEffect(() => () => clearTimeout(skuCopyTimeoutRef.current), []);

  const handleCopySku = useCallback(async (sku) => {
    if (!sku) return;
    try {
      await navigator.clipboard.writeText(sku);
      toast.success(TOAST.CATALOG.SKU_COPIED(sku));
      setSkuCopied(true);
      clearTimeout(skuCopyTimeoutRef.current);
      skuCopyTimeoutRef.current = setTimeout(() => setSkuCopied(false), 1500);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — say so
      // rather than leaving the click looking like it did nothing.
      toast.error(TOAST.CATALOG.COPY_FAILED);
    }
  }, []);

  // ALWAYS price live via SetSalesItems — the only source that agrees with
  // what checkout actually bills. Stored item_rate/Shopify price are stale
  // snapshots (see numericUnitPrice comment below for why neither is a
  // usable fallback).
  const {
    data:      livePricing,
    isLoading: pricingLoading,
    isError:   pricingError,
    refetch:   refetchPricing,
  } = useVariantPricing(activeItem ?? null);

  // sub_total is rate + labour, PRE-TAX (cart adds GST itself, so the
  // display stays tax-exclusive and the cart total lands on invoice
  // net_amount). Deliberately NO fallback to item_rate/sale_price/price/mrp
  // — those are stale snapshots, and quoting one then billing the live
  // figure is exactly the mismatch this path prevents. If pricing hasn't
  // resolved, or the server prices it at 0 (currently every Silver925
  // item), price stays null and AddToCartButton stays disabled.
  const numericUnitPrice = (livePricing?.sub_total ?? 0) > 0
    ? livePricing.sub_total
    : null;

  const price = formatPrice(numericUnitPrice);

  // Scannable per-piece SKU — distinct from activeCode/product.item_code,
  // the catalog/style code. Only livePricing ever carries a genuine sku
  // (product.sku on the master record is always empty); null until a piece
  // is actually priced. The barcode/QR scanner reads this value, not the
  // item code — hence showing both.
  const activeSku = livePricing?.sku && livePricing.sku.trim() ? livePricing.sku : null;

  // view_item — fires once per product, only once live price has resolved
  // (waiting costs a beat but keeps the reported value equal to what's
  // actually charged). The webengageExtra bag below (see tracker.js jsdoc)
  // never reaches GA4 — WebEngage only, flat scalars only (its SDK only
  // accepts string/number/boolean/Date per attribute; omitNullish() in
  // tracker.js strips anything not on hand).
  const trackedItemIdRef = useRef(null);
  useEffect(() => {
    if (!product || numericUnitPrice == null) return;
    if (trackedItemIdRef.current === product.item_id) return;
    trackedItemIdRef.current = product.item_id;

    tracker.trackEcommerce(GA_ECOMMERCE_EVENTS.VIEW_ITEM, EVENTS.PRODUCT_VIEWED, {
      currency: 'INR',
      value:    numericUnitPrice,
      items: [{
        item_id:   String(product.item_id),
        item_name: product.item_name ?? 'Unknown Product',
        item_sku:  product.item_code ?? '',
        price:     numericUnitPrice,
      }],
    }, {
      // Shared builder (productAttributes.js) — same activeItem-then-product
      // fallback and live-priced livePricing this page always used.
      ...buildProductAttributes({
        product,
        activeItem,
        pricedItem: livePricing,
        image: activePrimaryImage?.src ?? null,
        productUrl: product?.item_id != null
          ? `${typeof window !== 'undefined' ? window.location.origin : ''}/products/${product.item_id}`
          : null,
        selectedSizeId: activeItem?.item_size_id ?? null,
        selectedSizeName: activeSize,
        hasStock: stockStatus === 'in_stock' ? true : stockStatus === 'out_stock' ? false : null,
      }),
      // Kept as its own key (distinct from productAttributes.js's `sku`)
      // for continuity with existing WebEngage segments built on product_sku.
      product_sku: activeSku,
      product_stock_status: stockStatus,
      price_currency: 'INR',
      // customer_id always resolves to a real POS id or the literal string
      // "guest" — never omitted — so a guest view is never indistinguishable
      // from one where the id failed to reach this call.
      customer_id:              cartCustomerId ?? 'guest',
      customer_name:            cartCustomerName,
      customer_mobile:          cartCustomerMobile,
      customer_city:            cartCustomerAddress?.city,
      customer_state:           cartCustomerAddress?.state,
      customer_country:         cartCustomerAddress?.country,
      customer_zip:             cartCustomerAddress?.zip,
      store_id:                 activeStoreId,
      store_code:               activeStoreCode,
      store_name:               activeStoreName,
    });
  }, [
    product, numericUnitPrice, activeItem, activeSku, activeKarat, activeColor, activeSize,
    livePricing, activePrimaryImage, stockStatus, cartCustomerId, cartCustomerName, cartCustomerMobile,
    cartCustomerAddress, activeStoreId, activeStoreCode, activeStoreName,
  ]);

  // Quantity has no stock-based ceiling — bounded only by
  // QuantitySelector's own internal default (99) inside ProductStickyActionBar.
  const madeToOrderQty = Math.max(0, quantity - availableStock);

  const hasCustomization = !!product?.style_id;

  // Must run before the loading/error early returns (hooks can't be
  // conditional); no-ops internally while product is null. Passes the raw
  // stockStatus, NOT a stockStatus === 'in_stock' boolean — collapsing
  // 'loading'/'error'/'out_stock' into one false would record has_stock:false
  // for products that are actually in stock (see useRecordProductView's own
  // comment).
  useRecordProductView(product, stockStatus);

  // Keyed to activeItem (selectedVariant ?? product), NOT always the base
  // product the way useRecordProductView above deliberately stays —
  // "recently viewed" is about which page you were on, a wishlist is "I want
  // THIS one" (the confirmed customization, not the page's default).
  // item_id is always safe here, including the MTO pseudo-fallback (it sets
  // item_id to the base product's real id). Every other field falls back to
  // `product` because a matched variant row isn't guaranteed to carry every
  // field ProductCard wants (see useDesignVariants.js's documented shape).
  // has_stock mirrors stockStatus (currently active), not baseStockStatus.
  const wishlistProduct = useMemo(() => {
    if (!activeItem?.item_id) return null;
    return {
      item_id:    activeItem.item_id,
      item_code:  activeItem.item_code  ?? product.item_code  ?? null,
      item_name:  activeItem.item_name  ?? product.item_name  ?? null,
      image:      activeItem.image      ?? product.image      ?? null,
      image_url:  activeItem.image_url  ?? product.image_url  ?? null,
      image_1:    activeItem.image_1    ?? product.image_1    ?? null,
      metal_id:   activeItem.metal_id   ?? product.metal_id   ?? null,
      // Items/Retrieve (and Style/Retrieve variants) have no karat_code
      // field — only the human karat_name ("14KT") — hence the conversion.
      karat_code: deriveKaratCode(activeItem.karat_name ?? product.karat_name),
      // Items/Retrieve only has the full color name, not the catalog list's
      // short code — see lib/metalColor.js.
      metal_color_code: activeItem.metal_color_code ?? product.metal_color_code ?? null,
      metal_color_name: activeItem.metal_color_name ?? product.metal_color_name ?? null,
      has_stock:  stockStatus === 'in_stock' ? true : stockStatus === 'out_stock' ? false : null,
      net_weight: activeItem.net_weight ?? product.net_weight ?? null,
      weight:     activeItem.weight     ?? product.weight     ?? null,
      style_id:   product.style_id ?? null,
      // Only ever a confirmed selection — a bare, uncustomized product has
      // no size chosen yet, so this stays null until Customize is confirmed.
      item_size_id:   selectedVariant?.item_size_id   ?? null,
      item_size_name: selectedVariant?.item_size_name ?? null,
    };
  }, [activeItem, product, selectedVariant, stockStatus]);

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

          <div className="w-full xl:w-[45%] shrink-0">
            <ProductImageGallery product={activeItem} shopifyImages={shopifyImages} shopifyVideos={shopifyVideos} activeColorName={activeItem?.metal_color_name ?? null} isLoading={imagesLoading} stockStatus={stockStatus} />
          </div>

          <div className="flex flex-col gap-4 flex-1 min-w-0">

            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-4 min-w-0">
                {product.item_code && (
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {product.item_code}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopySku(product.item_code)}
                      aria-label={`Copy item code ${product.item_code}`}
                      title="Copy item code"
                      className="flex items-center justify-center w-5 h-5 shrink-0 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {skuCopied
                        ? <Check size={12} className="text-status-in-stock" aria-hidden="true" />
                        : <Copy size={12} aria-hidden="true" />}
                    </button>
                  </div>
                )}

                <h1 className="font-heading text-xl text-foreground leading-snug md:text-3xl">
                  {product.item_name ?? 'Product'}
                </h1>

                {/* Click smooth-scrolls to Customer Reviews at the bottom; hidden when there are none. */}
                <ProductReviewSummaryLink shopifyProductId={externalProductId} />
              </div>

              {wishlistProduct && (
                <WishlistButton
                  product={wishlistProduct}
                  reduceMotion={reduceMotion}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-sm transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              )}
            </div>

            {/* No strikethrough/"% OFF": compare_price is a stale master field —
                showing a discount against a mismatched figure is worse than none. */}
            <div>
              <div className="flex items-baseline gap-2">
                {pricingLoading ? (
                  <p className="text-sm font-medium text-muted-foreground">Calculating live price…</p>
                ) : price ? (
                  <p className="font-heading text-3xl text-primary">{price}</p>
                ) : pricingError ? (
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
                  // Server prices this at 0 (currently every Silver925 item on
                  // this tenant — OrnaVerse's own POS also totals it at 0).
                  <p className="text-sm font-medium text-status-made-order">
                    Price not available for this option — needs costing before it can be sold
                  </p>
                )}
              </div>
            </div>

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

            {/* Always visible (base product, then confirmed variant) so
                availability is never hidden behind an interaction. */}
            {(activeDetailsLine || activeCode) && (
              <div className="rounded-xl bg-secondary/40 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  {activeDetailsLine && (
                    <p className="font-medium text-foreground">{activeDetailsLine}</p>
                  )}
                  {stockStatus && (
                    <span
                      className={`flex shrink-0 items-center gap-1.5 text-xs font-semibold ${
                        stockStatus === 'error' ? 'text-status-made-order'
                        : stockStatus === 'out_stock' ? 'text-status-error'
                        : 'text-status-in-stock'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          stockStatus === 'error' ? 'bg-status-made-order'
                          : stockStatus === 'out_stock' ? 'bg-status-error'
                          : 'bg-status-in-stock'
                        }`}
                        aria-hidden="true"
                      />
                      {stockStatus === 'error' ? 'Stock Unknown' : stockStatus === 'out_stock' ? 'Made to Order' : 'In Stock'}
                    </span>
                  )}
                </div>
                {activeCode && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Item Code: {activeCode}
                    {activeSku && <> · SKU: {activeSku}</>}
                  </p>
                )}
              </div>
            )}

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

            {stockStatus === 'out_stock' && (
              <p className="text-sm text-primary">
                This item is currently out of stock — can be ordered as Made to Order.
              </p>
            )}

            {/* Only reachable for the base-product path — selectedVariant's
                own MTO/in-stock branch above never produces 'error'. */}
            {stockStatus === 'error' && (
              <p className="flex items-center gap-2 text-sm font-medium text-status-made-order">
                Couldn&apos;t check stock for this item
                <button
                  type="button"
                  onClick={() => refetchStoreStocks()}
                  className="font-semibold underline underline-offset-2 hover:text-status-made-order/80"
                >
                  Retry
                </button>
              </p>
            )}

            {/* Hidden once the confirmed customization is Made to Order (no real stock anywhere to report). */}
            {!isSelectedVariantMTO && (
              <CrossStoreStockPanel
                storeStocks={storeStocks}
                isLoading={storeStocksLoading}
                isError={storeStocksError}
                onRetry={refetchStoreStocks}
              />
            )}

            {/* Full-width, placed before the spec cards: cost first, then composition. */}
            {numericUnitPrice != null && <PriceBreakdown priced={livePricing} />}

          </div>
        </div>

        <ProductTrustBadge />

        <ProductSpecifications product={activeItem} pricedItem={livePricing} />

        <ProductTrustSection />

        {/* Reuses externalProductId already resolved for Shopify images — no extra OrnaVerse calls. */}
        <ProductReviewsList shopifyProductId={externalProductId} />

        {/* Only ever populated for an attached customer — see useRecordProductView above. */}
        <RecentlyViewedCarousel excludeItemId={product.item_id} />

      </div>

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
        primaryImage={activePrimaryImage}
        // Threaded through to AddToCartButton so its analytics/cart-line
        // attributes carry the real price breakup — must be the live-priced
        // entity, never the item master's stale rate.
        pricedItem={livePricing}
      />

      <CustomizeSheet
        isOpen={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        product={product}
        selectedVariant={selectedVariant}
        variants={variants}
        metalColors={metalColors}
        karats={karats}
        sizes={sizes}
        storesByItemId={storesByItemId}
        findVariant={findVariant}
        onConfirm={handleCustomizeConfirm}
        isLoading={variantsLoading}
        activeStoreId={activeStoreId}
        activeStoreName={activeStoreName}
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