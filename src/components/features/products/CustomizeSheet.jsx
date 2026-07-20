'use client';

// src/components/features/products/CustomizeSheet.jsx
//
// Customize sheet — shown when user taps "Customize" on product detail.
// Uses shared BottomSheet (bottom on mobile, side sheet on tablet).
//
// FIXES:
//   1. Stock detection uses raw variants array — checks ALL matching variants.
//   2. OOS variants selectable as "Made to Order" (amber dot).
//   3. MTO fallback: when no exact variant exists but all options selected,
//      builds a pseudo-variant from base product + selections.
//   4. canConfirm allows OOS and MTO variants.
//   5. State resets cleanly on sheet close.

import { useState, useCallback, useMemo } from 'react';
import { Store } from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';
import { Skeleton } from '@/components/ui/skeleton';

// ── Metal color gradient map ──────────────────────────────────────────────────
const COLOR_GRADIENTS = {
  yellow: 'linear-gradient(147.45deg, #c59922 17.98%, #ead59e 48.14%, #c59922 83.84%)',
  rose:   'linear-gradient(154.36deg, #f2b5b5 10.36%, #f8dbdb 68.09%)',
  white:  'linear-gradient(143.06deg, #dfdfdf 29.61%, #f3f3f3 48.83%, #dfdfdf 66.43%)',
};

function resolveGradient(name) {
  if (!name) return COLOR_GRADIENTS.white;
  const lc = name.toLowerCase();
  if (lc.includes('yellow')) return COLOR_GRADIENTS.yellow;
  if (lc.includes('rose'))   return COLOR_GRADIENTS.rose;
  if (lc.includes('white'))  return COLOR_GRADIENTS.white;
  return COLOR_GRADIENTS.yellow;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      <Skeleton className="h-3 w-40" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-3 w-28 mt-2" />
      <div className="flex gap-2">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-3 w-28 mt-2" />
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ── Stock status dot ──────────────────────────────────────────────────────────
// Green = in stock, Amber = made to order (OOS), null = no dot

function StockDot({ status, isSelected }) {
  if (status === 'in_stock') {
    return (
      <span
        aria-label="In stock"
        className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-emerald-500"
      />
    );
  }
  if (status === 'made_to_order') {
    return (
      <span
        aria-label="Made to order"
        className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-amber-400"
      />
    );
  }
  return null;
}

// ── Metal colour card ─────────────────────────────────────────────────────────

function MetalColorCard({ color, karat, isSelected, stockStatus, onClick }) {
  const gradient = resolveGradient(color.name);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={[
        'relative flex flex-col items-center justify-center gap-2',
        'rounded-2xl border py-4 px-2',
        'transition-all duration-150 min-h-[88px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'border-foreground bg-card shadow-sm'
          : 'border-border bg-card hover:border-accent/60',
      ].join(' ')}
    >
      <StockDot status={stockStatus} isSelected={isSelected} />

      <span
        aria-hidden="true"
        className="w-6 h-6 rounded-full shrink-0"
        style={{ background: gradient }}
      />

      <span className="flex flex-col items-center leading-tight text-center">
        {karat && (
          <span className="text-[11px] font-semibold text-foreground">
            {karat.name}
          </span>
        )}
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {color.name}
        </span>
      </span>
    </button>
  );
}

// ── Karat pill ────────────────────────────────────────────────────────────────

function KaratPill({ karat, isSelected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={[
        'min-h-[40px] px-5 py-2 rounded-xl text-sm font-semibold',
        'border transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'bg-primary border-primary text-primary-foreground shadow-sm'
          : 'bg-card border-border text-foreground hover:border-accent/60',
      ].join(' ')}
    >
      {karat.name}
    </button>
  );
}

// ── Size chip ─────────────────────────────────────────────────────────────────

function SizeChip({ size, isSelected, stockStatus, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={[
        'relative min-h-[48px] px-2 rounded-xl',
        'border text-sm font-medium',
        'flex items-center justify-center',
        'transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'bg-primary border-primary text-primary-foreground shadow-sm'
          : 'bg-card border-border text-foreground hover:border-accent/60',
      ].join(' ')}
    >
      <StockDot status={stockStatus} isSelected={isSelected} />
      {size.name}
    </button>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ label, value }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      {value && (
        <p className="text-[11px] font-semibold text-accent">
          {value}
        </p>
      )}
    </div>
  );
}

// ── Confirm button label ──────────────────────────────────────────────────────

function buildConfirmLabel(variant, sizes, selectedSizeId) {
  if (!variant) return 'Select options to continue';

  const parts = [];
  if (variant.karat_name       && variant.karat_name       !== 'NA') parts.push(variant.karat_name);
  if (variant.metal_color_name && variant.metal_color_name !== 'NA') parts.push(variant.metal_color_name);

  const sizeName = sizes.find((s) => s.id === selectedSizeId)?.name;
  if (sizeName) parts.push(`Size ${sizeName}`);

  const isMTO = variant._isMTO || (variant.pieces ?? 0) === 0;
  const stockLabel = isMTO ? ' (Made to Order)' : '';
  if (parts.length === 0) return 'Confirm';
  return `Confirm — ${parts.join(' · ')}${stockLabel}`;
}

// ── CustomizeSheet ────────────────────────────────────────────────────────────

export default function CustomizeSheet({
  isOpen,
  onClose,
  product,
  selectedVariant = null,
  variants        = [],
  metalColors     = [],
  karats          = [],
  sizes           = [],
  variantStock    = new Map(),
  storesByItemId  = new Map(),
  findVariant,
  onConfirm,
  isLoading,
}) {
  const [selectedMetalColorId, setSelectedMetalColorId] = useState(null);
  const [selectedKaratId,      setSelectedKaratId]      = useState(null);
  const [selectedSizeId,       setSelectedSizeId]       = useState(null);

  // Seed from product defaults every time the sheet opens.
  // FIX: previously did this in a useEffect keyed on [isOpen], which React
  // Compiler flags (setState-synchronously-in-effect risks a cascading
  // render). This sheet stays mounted across open/close for its slide
  // transition, so remounting via `key` (the fix used on the product
  // detail page for the same class of problem) isn't an option here — it
  // would break the close animation. Instead this uses React's documented
  // "adjust state during render" pattern: track the previous isOpen in a
  // plain useState and compare during render, calling setState only when
  // the tracked value actually changes. This runs synchronously during
  // render (not in an effect), so there's no extra render pass.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      const source = selectedVariant ?? product;
      setSelectedMetalColorId(source?.metal_color_id ?? null);
      setSelectedKaratId(source?.karat_id             ?? null);
      setSelectedSizeId(source?.item_size_id          ?? null);
    }
  }

  // ── Variant matching ──────────────────────────────────────────────────────
  // Try to find an exact variant first
  const exactVariant = findVariant
    ? findVariant(selectedMetalColorId, selectedKaratId, selectedSizeId)
    : null;

  const hasSizes       = sizes.length > 0;
  const hasMetalColors = metalColors.length > 0;
  const hasKarats      = karats.length > 0;

  const metalOk    = !hasMetalColors || selectedMetalColorId != null;
  const karatOk    = !hasKarats      || selectedKaratId      != null;
  const sizeOk     = !hasSizes       || selectedSizeId       != null;
  const allSelected = metalOk && karatOk && sizeOk;

  // ── MTO fallback ──────────────────────────────────────────────────────────
  // When no exact variant exists but user has selected all options,
  // build a pseudo-variant from base product + selections.
  // This enables Made-to-Order for any valid combination.
  const mtoFallback = useMemo(() => {
    if (exactVariant || !allSelected || !product) return null;
    const karatName      = karats.find((k) => k.id === selectedKaratId)?.name      ?? '';
    const metalColorName = metalColors.find((c) => c.id === selectedMetalColorId)?.name ?? '';
    const sizeName       = sizes.find((s) => s.id === selectedSizeId)?.name        ?? '';
    return {
      ...product,
      item_id:          product.item_id,
      item_code:        product.item_code,
      item_name:        product.item_name,
      karat_id:         selectedKaratId,
      karat_name:       karatName,
      metal_color_id:   selectedMetalColorId,
      metal_color_name: metalColorName,
      item_size_id:     selectedSizeId ?? null,
      item_size_name:   sizeName || null,
      pieces:           0,
      _isMTO:           true,
    };
  }, [exactVariant, allSelected, product, selectedKaratId, selectedMetalColorId, selectedSizeId, karats, metalColors, sizes]);

  // Use exact variant when available, MTO fallback otherwise
  const matchedVariant = exactVariant ?? mtoFallback;
  const canConfirm     = allSelected && !!matchedVariant;

  // ── In-stock store list for the currently matched variant ────────────────
  // MTO (no real exact-variant match, or zero stock everywhere) always hides
  // this — there's no store to point to. Recomputes on every selection
  // change, so switching to a different variant updates/hides it live.
  const matchedVariantStores = useMemo(() => {
    if (!matchedVariant || matchedVariant._isMTO || matchedVariant.item_id == null) return [];
    const stores = storesByItemId.get(matchedVariant.item_id) ?? [];
    return stores.filter((s) => (s.pieces ?? 0) > 0);
  }, [matchedVariant, storesByItemId]);

  // ── Stock helpers — use raw variants array ────────────────────────────────

  const getComboStockStatus = useCallback((metalColorId, karatId) => {
    const matching = variants.filter((v) => {
      const matchMetal = metalColorId == null || v.metal_color_id === metalColorId;
      const matchKarat = karatId      == null || v.karat_id       === karatId;
      return matchMetal && matchKarat;
    });
    if (!matching.length) return null; // combo doesn't exist — no dot
    const hasStock = matching.some((v) => (v.pieces ?? 0) > 0);
    return hasStock ? 'in_stock' : 'made_to_order';
  }, [variants]);

  const getSizeStockStatus = useCallback((sizeId) => {
    const matching = variants.filter((v) => {
      const matchMetal = selectedMetalColorId == null || v.metal_color_id === selectedMetalColorId;
      const matchKarat = selectedKaratId      == null || v.karat_id       === selectedKaratId;
      const matchSize  = v.item_size_id === sizeId;
      return matchMetal && matchKarat && matchSize;
    });
    if (!matching.length) return null; // combo doesn't exist — no dot
    const hasStock = matching.some((v) => (v.pieces ?? 0) > 0);
    return hasStock ? 'in_stock' : 'made_to_order';
  }, [variants, selectedMetalColorId, selectedKaratId]);

  // ── Section label helpers ──────────────────────────────────────────────────
  const metalKaratValue = (() => {
    const k = karats.find((k) => k.id === selectedKaratId)?.name;
    const c = metalColors.find((c) => c.id === selectedMetalColorId)?.name;
    const parts = [k, c].filter(Boolean);
    return parts.length ? parts.join(' ') : null;
  })();

  const sizeValue = sizes.find((s) => s.id === selectedSizeId)?.name ?? null;

  // ── Confirm handler ────────────────────────────────────────────────────────
  const handleConfirm = () => {
    onConfirm(matchedVariant);
    onClose();
  };

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footer = (
    <button
      type="button"
      onClick={handleConfirm}
      disabled={!canConfirm}
      className={[
        'w-full min-h-[52px] rounded-xl font-semibold text-sm',
        'transition-all duration-150 tracking-wide uppercase',
        canConfirm
          ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
          : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60',
      ].join(' ')}
    >
      {canConfirm
        ? buildConfirmLabel(matchedVariant, sizes, selectedSizeId)
        : !metalOk || !karatOk
          ? 'Select a colour and karat to continue'
          : !sizeOk
            ? 'Select a size to continue'
            : 'Select options to continue'
      }
    </button>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Customize"
      footer={footer}
      maxWidth="max-w-lg"
    >
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="flex flex-col gap-6">

          {/* ── Metal colour + karat combined cards ──────────────────────── */}
          {hasMetalColors && hasKarats ? (
            <div className="flex flex-col gap-3">
              <SectionLabel
                label="Select Gold Colour & Karat"
                value={metalKaratValue}
              />
              <div className="grid grid-cols-3 gap-3">
                {/* Karat-first ordering: all 14KT options (any colour)
                    together, then all 18KT — not grouped by colour. */}
                {karats.flatMap((karat) =>
                  metalColors.map((color) => {
                    const isSelected =
                      selectedMetalColorId === color.id &&
                      selectedKaratId      === karat.id;
                    const stockStatus = getComboStockStatus(color.id, karat.id);

                    return (
                      <MetalColorCard
                        key={`${karat.id}-${color.id}`}
                        color={color}
                        karat={karat}
                        isSelected={isSelected}
                        stockStatus={stockStatus}
                        onClick={() => {
                          setSelectedMetalColorId(color.id);
                          setSelectedKaratId(karat.id);
                        }}
                      />
                    );
                  })
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">In Stock</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[10px] text-muted-foreground">Made to Order</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {hasMetalColors && (
                <div className="flex flex-col gap-3">
                  <SectionLabel label="Metal Colour" value={metalColors.find((c) => c.id === selectedMetalColorId)?.name} />
                  <div className="flex flex-wrap gap-2">
                    {metalColors.map((color) => (
                      <MetalColorCard
                        key={color.id}
                        color={color}
                        karat={null}
                        isSelected={selectedMetalColorId === color.id}
                        stockStatus={getComboStockStatus(color.id, null)}
                        onClick={() => setSelectedMetalColorId(
                          selectedMetalColorId === color.id ? null : color.id
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}

              {hasKarats && (
                <div className="flex flex-col gap-3">
                  <SectionLabel label="Purity / Karat" value={karats.find((k) => k.id === selectedKaratId)?.name} />
                  <div className="flex flex-wrap gap-2">
                    {karats.map((k) => (
                      <KaratPill
                        key={k.id}
                        karat={k}
                        isSelected={selectedKaratId === k.id}
                        onClick={() => setSelectedKaratId(
                          selectedKaratId === k.id ? null : k.id
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Divider ─────────────────────────────────────────────────── */}
          {(hasMetalColors || hasKarats) && hasSizes && (
            <hr className="border-border" />
          )}

          {/* ── Size grid ───────────────────────────────────────────────── */}
          {hasSizes && (
            <div className="flex flex-col gap-3">
              <SectionLabel
                label={`Select ${product?.type_name ? `${product.type_name} ` : ''}Size`}
                value={sizeValue ? `${sizeValue}` : null}
              />
              <div className="grid grid-cols-5 gap-2">
                {sizes.map((size) => (
                  <SizeChip
                    key={size.id}
                    size={size}
                    isSelected={selectedSizeId === size.id}
                    stockStatus={getSizeStockStatus(size.id)}
                    onClick={() => setSelectedSizeId(
                      selectedSizeId === size.id ? null : size.id
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── No options ──────────────────────────────────────────────── */}
          {!hasMetalColors && !hasKarats && !hasSizes && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No customization options available for this product.
            </p>
          )}

          {/* ── Matched variant summary card ────────────────────────────── */}
          {matchedVariant && (
            <div className={[
              'rounded-xl border px-4 py-3',
              matchedVariant._isMTO
                ? 'bg-amber-50/60 border-amber-200'
                : (matchedVariant.pieces ?? 0) > 0
                  ? 'bg-emerald-50/60 border-emerald-200'
                  : 'bg-amber-50/60 border-amber-200',
            ].join(' ')}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {matchedVariant.item_name}
                </p>
                <span className={[
                  'text-[11px] font-semibold px-2 py-0.5 rounded-full text-nowrap',
                  matchedVariant._isMTO || (matchedVariant.pieces ?? 0) === 0
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700',
                ].join(' ')}>
                  {matchedVariant._isMTO
                    ? 'Made to Order'
                    : (matchedVariant.pieces ?? 0) > 0 ? 'In Stock' : 'Made to Order'
                  }
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {matchedVariant._isMTO
                  ? `${matchedVariant.karat_name} · ${matchedVariant.metal_color_name}${matchedVariant.item_size_name ? ` · Size ${matchedVariant.item_size_name}` : ''}`
                  : <>SKU: {matchedVariant.item_code}{(matchedVariant.pieces ?? 0) > 0 && ` · ${matchedVariant.pieces} pc${matchedVariant.pieces !== 1 ? 's' : ''}`}</>
                }
              </p>

              {/* In-stock store list — hidden entirely for MTO/no-stock
                  variants, shown when this exact variant has real stock
                  somewhere. Updates live as the selection changes above. */}
              {matchedVariantStores.length > 0 && (
                <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-emerald-200/60">
                  <Store size={13} className="shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-emerald-700">
                    In stock at{' '}
                    <span className="font-medium">
                      {matchedVariantStores.map((s) => s.companyname).join(', ')}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </BottomSheet>
  );
}