'use client';

// src/components/features/products/ProductSpecifications.jsx
//
// Card-based product specifications layout.
// Two-column grid on tablet (Metal + Dimension side by side).
// Diamond/Stone and Classification full-width below.
// Empty sections hidden entirely.

// ── Value helpers ─────────────────────────────────────────────────────────────

function val(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && v === 0) return null;
  const str = String(v).trim();
  if (str === 'NA' || str === 'N/A' || str === '0') return null;
  return str;
}

function formatWeight(value) {
  if (value === null || value === undefined) return null;
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return null;
  return `${num.toFixed(3)} g`;
}

function formatCarats(value) {
  if (value === null || value === undefined) return null;
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return null;
  return `${num.toFixed(2)} ct`;
}

function formatDimension(value) {
  if (value === null || value === undefined) return null;
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return null;
  return `${num} mm`;
}

// ── Primitives ────────────────────────────────────────────────────────────────

function SpecRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-stone-100 last:border-0">
      <span className="text-sm text-stone-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-stone-800 text-right">{value}</span>
    </div>
  );
}

function SpecCard({ icon, title, rows, info }) {
  const hasAny = rows.some(({ value }) => Boolean(value));
  if (!hasAny) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50/80">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-amber-600 shrink-0" aria-hidden="true">
              {icon}
            </span>
          )}
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
            {title}
          </h3>
        </div>
        {info && (
          <span className="text-stone-300" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
          </span>
        )}
      </div>
      {/* Body */}
      <div className="px-4 py-1">
        {rows.map(({ label, value }) => (
          <SpecRow key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

const MetalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3c-4.97 0-9 2.24-9 5s4.03 5 9 5 9-2.24 9-5-4.03-5-9-5z"/>
    <path d="M3 8c0 2.76 4.03 5 9 5s9-2.24 9-5"/>
    <path d="M3 13c0 2.76 4.03 5 9 5s9-2.24 9-5"/>
  </svg>
);

const DimensionIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7h18M3 12h10M3 17h10M17 12l4 5-4-5 4-5-4 5z"/>
  </svg>
);

const DiamondIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.57a2.41 2.41 0 0 0 3.41 0l7.59-7.57a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0Z"/>
  </svg>
);

const TagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.3-7.3a1 1 0 0 0 0-1.41z"/>
    <path d="M7 7h.01"/>
  </svg>
);

// ── ProductSpecifications ─────────────────────────────────────────────────────

export default function ProductSpecifications({ product }) {
  if (!product) return null;

  // ── Metal ─────────────────────────────────────────────────────────────────
  const metalPurity = val(product.karat_name)
    ?? (product.purity && product.purity !== 0 ? String(product.purity) : null);
  const metalColor  = val(product.metal_color_name);
  const metalType   = val(product.metal_name);
  const hallmark    = val(product.hallmark ?? product.hallmark_no);
  const netWeight   = formatWeight(product.net_weight);

  // ── Dimension / Weight ────────────────────────────────────────────────────
  const height        = formatDimension(product.height);
  const width         = formatDimension(product.width);
  const length        = formatDimension(product.length);
  const grossWeight   = formatWeight(product.weight);
  const stoneWeight   = formatWeight(product.stone_weight ?? product.color_stone_weight);
  const diamondWeight = formatWeight(product.diamond_weight);
  const pointerCt     = formatCarats(product.pointer_weight);

  // ── Diamond & Stone ───────────────────────────────────────────────────────
  const diamondPieces    = product.diamond_pieces      > 0 ? String(product.diamond_pieces)     : null;
  const diamondQuality   = val(product.diamond_quality);
  const diamondShape     = val(product.diamond_shape);
  const diamondCarats    = formatCarats(product.diamond_carat ?? product.diamond_weight);
  const stonePieces      = product.stone_pieces        > 0 ? String(product.stone_pieces)       : null;
  const colorStonePieces = product.color_stone_pieces  > 0 ? String(product.color_stone_pieces) : null;
  const colorStoneWeight = formatWeight(product.color_stone_weight);
  const otherPieces      = product.other_pieces        > 0 ? String(product.other_pieces)       : null;
  const otherWeight      = formatWeight(product.other_weight);

  // ── Classification ────────────────────────────────────────────────────────
  const itemGroup   = val(product.item_group_name);
  const category    = val(product.type_name);
  const subCategory = val(product.sub_type_name);
  const collection  = val(product.collection_name);
  const brand       = val(product.brand_name);
  const baseItem    = val(product.base_item);
  const hsn         = val(product.hsn);
  const sku         = val(product.item_code ?? product.sku);

  return (
    <div className="flex flex-col gap-3">

      {/* Row 1 — Metal + Dimension side by side on tablet */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SpecCard
          icon={<MetalIcon />}
          title="Metal"
          rows={[
            { label: 'Purity',     value: metalPurity },
            { label: 'Color',      value: metalColor },
            { label: 'Metal Type', value: metalType },
            { label: 'Net Wt',     value: netWeight },
            { label: 'Hallmark',   value: hallmark },
          ]}
        />

        <SpecCard
          icon={<DimensionIcon />}
          title="Dimension"
          rows={[
            { label: 'Height',       value: height },
            { label: 'Width',        value: width },
            { label: 'Length',       value: length },
            { label: 'Gross Wt',     value: grossWeight },
            { label: 'Stone Wt',     value: stoneWeight },
            { label: 'Diamond Wt',   value: diamondWeight },
            { label: 'Diamond (ct)', value: pointerCt },
          ]}
        />
      </div>

      {/* Row 2 — Diamond & Stone full width */}
      <SpecCard
        icon={<DiamondIcon />}
        title="Diamond"
        rows={[
          { label: 'Quality',             value: diamondQuality },
          { label: 'Shape',               value: diamondShape },
          { label: 'Quantity',            value: diamondPieces },
          { label: 'Carat',               value: diamondCarats },
          { label: 'Stone Pieces',        value: stonePieces },
          { label: 'Colour Stone Pieces', value: colorStonePieces },
          { label: 'Colour Stone Weight', value: colorStoneWeight },
          { label: 'Other Pieces',        value: otherPieces },
          { label: 'Other Weight',        value: otherWeight },
        ]}
      />

      {/* Row 3 — Classification full width */}
      <SpecCard
        icon={<TagIcon />}
        title="Classification"
        rows={[
          { label: 'Item Group',   value: itemGroup },
          { label: 'Category',     value: category },
          { label: 'Sub-Category', value: subCategory },
          { label: 'Collection',   value: collection },
          { label: 'Brand',        value: brand },
          { label: 'Base Item',    value: baseItem },
          { label: 'HSN Code',     value: hsn },
          { label: 'SKU',          value: sku },
        ]}
      />

    </div>
  );
}
