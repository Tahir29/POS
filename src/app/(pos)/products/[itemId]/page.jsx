'use client';

// src/app/(pos)/products/[itemId]/page.jsx
//
// Product detail screen.
// - No quantity selector here — quantity lives in mini cart only
// - "Customize" button opens CustomizeSheet (BottomSheet)
// - Selecting a variant updates the item added to cart
// - Products without style_id still show ATC directly

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { toast }     from 'react-toastify';

import { useProductDetail }     from '@/hooks/products/useProductDetail';
import { useProductStock }      from '@/hooks/products/useProductStock';
import { useStockByStores }     from '@/hooks/products/useStockByStores';
import { useProductAttributes } from '@/hooks/products/useProductAttributes';
import { useDesignVariants }    from '@/hooks/products/useDesignVariants';

import ProductImageGallery   from '@/components/features/products/ProductImageGallery';
import ProductSpecifications from '@/components/features/products/ProductSpecifications';
import ProductAttributeList  from '@/components/features/products/ProductAttributeList';
import ProductBreadcrumb     from '@/components/features/products/ProductBreadcrumb';
import ProductDetailSkeleton from '@/components/features/products/ProductDetailSkeleton';
import CrossStoreStockPanel  from '@/components/features/products/CrossStoreStockPanel';
import CustomizeSheet        from '@/components/features/products/CustomizeSheet';
import AddToCartButton       from '@/components/features/products/AddToCartButton';
import StockStatusBadge, {
  deriveStockStatus,
  deriveStockStatusFromProduct,
} from '@/components/shared/StockStatusBadge';

import APP_CONFIG from '@/constants/appConfig';
import TOAST      from '@/constants/toastMessages';
import { Settings2 } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(amount) {
  if (amount === null || amount === undefined) return null;
  const num = parseFloat(amount);
  if (isNaN(num) || num === 0) return null;
  return new Intl.NumberFormat('en-IN', {
    style:                'currency',
    currency:             APP_CONFIG.CURRENCY.INR_CODE ?? 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

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

  // ── Server state ──────────────────────────────────────────────────────────
  const {
    data:      product,
    isLoading: detailLoading,
    isError:   detailError,
  } = useProductDetail(itemId);

  const { data: stockData }                                    = useProductStock(product?.item_code);
  const { data: storeStocks = [], isLoading: storeStocksLoading } = useStockByStores(product?.item_id);
  const { data: attributes = [] }                              = useProductAttributes(product?.type_id ?? null);

  // ── Variants ──────────────────────────────────────────────────────────────
  const {
    variants,
    metalColors,
    variantStock,
    karats,
    sizes,
    findVariant,
    hasVariants,
    isLoading: variantsLoading,
  } = useDesignVariants(product?.style_id ?? null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Selected variant — starts as null, updated when user customizes
  // The "active item" for ATC is selectedVariant ?? product
  const [selectedVariant, setSelectedVariant] = useState(null);

  // Reset when navigating to a different product
  useEffect(() => {
    setSelectedVariant(null);
    setCustomizeOpen(false);
  }, [itemId]);

  useEffect(() => {
    if (detailError) toast.error(TOAST.GENERIC.SOMETHING_WRONG);
  }, [detailError]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const stockStatus = stockData
    ? deriveStockStatus(stockData)
    : product
      ? deriveStockStatusFromProduct(product)
      : null;

  // Active item = selected variant (if customized) else original product
  const activeItem = selectedVariant ?? product;

  const price = formatPrice(
    activeItem?.item_rate  ??
    activeItem?.sale_price ??
    activeItem?.price      ??
    activeItem?.mrp        ??
    activeItem?.rate
  );

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
    <div className="flex flex-col gap-6 pb-10">

      <ProductBreadcrumb product={product} />

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">

        {/* Left — Image gallery */}
        <div className="w-full md:w-[45%] shrink-0">
          <ProductImageGallery product={activeItem} />
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
          <h1
            className="text-xl font-bold text-foreground leading-snug md:text-2xl font-abhaya"
          >
            {product.item_name ?? 'Product'}
          </h1>

          {/* Stock badge */}
          <StockStatusBadge status={stockStatus} size="md" />

          {/* Price */}
          <div className='flex items-center justify-start gap-2'>
            {price && (
              <p className="text-2xl font-bold text-primary">{price}</p>
            )}
            {product.compare_price && (
              <p className="text-2xl font-bold text-muted underline">{formatPrice(product.compare_price)}</p>
            )}
          </div>

          {/* Selected variant summary */}
          {selectedVariant && (
            <div className="rounded-xl bg-secondary/40 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">
                {selectedVariant.karat_name} · {selectedVariant.metal_color_name}
                {selectedVariant.item_size_name ? ` · Size ${selectedVariant.item_size_name}` : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedVariant.item_code}
              </p>
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
                {selectedVariant ? 'Change Customization' : 'Customize'}
              </span>
              <span className="text-xs text-muted-foreground">
                {selectedVariant
                  ? `${selectedVariant.karat_name} ${selectedVariant.metal_color_name}`
                  : `${product.karat_name ?? ''} ${product.metal_color_name ?? ''}`.trim() || 'Choose options'
                }
              </span>
            </button>
          )}

          {/* Add to Cart — uses activeItem (variant or original) */}
          <AddToCartButton
            product={activeItem}
            quantity={1}
            selectedSizeId={selectedVariant?.item_size_id ?? null}
            selectedSizeName={selectedVariant?.item_size_name ?? null}
            stockStatus={stockStatus}
          />

          {/* Made-to-order hint for out of stock items */}
          {stockStatus === 'out_stock' && (
            <p className="text-sm text-primary">
              This item is currently out of stock — can be ordered as Made to Order.
            </p>
          )}

          {/* Stock Across Stores — shown above ATC so user sees availability first */}
          <CrossStoreStockPanel
            storeStocks={storeStocks}
            isLoading={storeStocksLoading}
          />

        </div>
      </div>

      <ProductSpecifications product={activeItem} />

      {attributes.length > 0 && (
        <ProductAttributeList attributes={attributes} />
      )}

      {/* Customize sheet */}
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
