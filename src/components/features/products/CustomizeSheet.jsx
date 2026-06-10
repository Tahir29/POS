'use client';

// src/components/features/products/CustomizeSheet/index.jsx
//
// Customize sheet — shown when user taps "Customize" on product detail.
// Uses shared BottomSheet (bottom on mobile, side sheet on tablet).
//
// Displays:
//   - Metal Color chips  (Yellow Gold, White Gold, Rose Gold)
//   - Karat chips        (14KT, 18KT)
//   - Size chips         (only when product has sizes)
//
// Selecting a combination finds the matching variant from style_variants[].
// On confirm — calls onConfirm(variant) with the matched item.

import { useState, useEffect } from 'react';
import BottomSheet from '@/components/shared/BottomSheet';

// ── Option chip ───────────────────────────────────────────────────────────────

function OptionChip({ label, isSelected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isSelected}
      className={[
        'min-h-[40px] px-4 py-2 rounded-xl text-sm font-medium',
        'border transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'bg-primary border-primary text-primary-foreground shadow-sm'
          : disabled
            ? 'bg-muted border-border text-muted-foreground opacity-40 cursor-not-allowed'
            : 'bg-card border-border text-foreground hover:border-accent hover:text-accent',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}

// ── CustomizeSheet ────────────────────────────────────────────────────────────

/**
 * @param {{
 *   isOpen:       boolean,
 *   onClose:      () => void,
 *   product:      object,          — current item (for defaults)
 *   metalColors:  { id, name }[],
 *   karats:       { id, name }[],
 *   sizes:        { id, name }[],
 *   findVariant:  (metalColorId, karatId, sizeId) => object | null,
 *   onConfirm:    (variant: object | null) => void,
 *   isLoading:    boolean,
 * }} props
 */
export default function CustomizeSheet({
  isOpen,
  onClose,
  product,
  metalColors = [],
  karats      = [],
  sizes       = [],
  findVariant,
  onConfirm,
  isLoading,
}) {
  // Initialise selections from current product
  const [selectedMetalColorId, setSelectedMetalColorId] = useState(null);
  const [selectedKaratId,      setSelectedKaratId]      = useState(null);
  const [selectedSizeId,       setSelectedSizeId]        = useState(null);

  // When sheet opens, pre-select current product's values
  useEffect(() => {
    if (isOpen && product) {
      setSelectedMetalColorId(product.metal_color_id ?? null);
      setSelectedKaratId(product.karat_id            ?? null);
      setSelectedSizeId(product.item_size_id          ?? null);
    }
  }, [isOpen, product]);

  // Find matching variant based on current selections
  const matchedVariant = findVariant
    ? findVariant(selectedMetalColorId, selectedKaratId, selectedSizeId)
    : null;

  const hasSizes = sizes.length > 0;

  // ── Footer ────────────────────────────────────────────────────────────────
  const canConfirm = !hasSizes
    ? !!matchedVariant
    : !!matchedVariant && !!selectedSizeId;

  const footer = (
    <button
      type="button"
      onClick={() => { onConfirm(matchedVariant); onClose(); }}
      disabled={!canConfirm}
      className={[
        'w-full min-h-[48px] rounded-xl font-semibold text-sm transition-all duration-150',
        canConfirm
          ? 'bg-primary hover:bg-primary/90 text-primary-foreground active:scale-[0.98]'
          : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60',
      ].join(' ')}
    >
      {canConfirm
        ? `Confirm — ${matchedVariant?.karat_name ?? ''} ${matchedVariant?.metal_color_name ?? ''}${selectedSizeId ? ` · Size ${sizes.find((s) => s.id === selectedSizeId)?.name ?? ''}` : ''}`
        : hasSizes && !selectedSizeId
          ? 'Select a size to continue'
          : 'Select options to continue'
      }
    </button>
  );

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Customize"
      footer={footer}
      maxWidth="max-w-lg"
    >
      {isLoading ? (
        // Loading skeleton
        <div className="flex flex-col gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              <div className="flex gap-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-10 w-20 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* Metal Color */}
          {metalColors.length > 0 && (
            <Section title="Metal Colour">
              {metalColors.map((mc) => (
                <OptionChip
                  key={mc.id}
                  label={mc.name}
                  isSelected={selectedMetalColorId === mc.id}
                  onClick={() => setSelectedMetalColorId(
                    selectedMetalColorId === mc.id ? null : mc.id
                  )}
                />
              ))}
            </Section>
          )}

          {/* Karat */}
          {karats.length > 0 && (
            <Section title="Purity / Karat">
              {karats.map((k) => (
                <OptionChip
                  key={k.id}
                  label={k.name}
                  isSelected={selectedKaratId === k.id}
                  onClick={() => setSelectedKaratId(
                    selectedKaratId === k.id ? null : k.id
                  )}
                />
              ))}
            </Section>
          )}

          {/* Size — only for products with sizes */}
          {hasSizes && (
            <Section title="Size">
              <div className="grid grid-cols-5 gap-2 w-full">
                {sizes.map((s) => (
                  <OptionChip
                    key={s.id}
                    label={s.name}
                    isSelected={selectedSizeId === s.id}
                    onClick={() => setSelectedSizeId(
                      selectedSizeId === s.id ? null : s.id
                    )}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* No options available */}
          {metalColors.length === 0 && karats.length === 0 && !hasSizes && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No customization options available for this product.
            </p>
          )}

          {/* Matched variant summary */}
          {matchedVariant && (
            <div className="rounded-xl bg-secondary/50 px-4 py-3 text-sm text-foreground">
              <p className="font-medium">
                {matchedVariant.item_name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                SKU: {matchedVariant.item_code}
              </p>
            </div>
          )}

        </div>
      )}
    </BottomSheet>
  );
}
