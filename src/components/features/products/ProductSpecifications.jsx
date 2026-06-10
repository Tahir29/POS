'use client';

// src/components/features/products/ProductSpecifications/index.jsx
//
// Displays product specifications from the Items/Retrieve response.
// Sections (Metal, Weight, Stone, Classification) are hidden entirely
// when all their values resolve to empty — so stone-only or metal-only
// items don't show empty section headings.
//
// NA / zero / null / undefined are all treated as empty via val().

// ── Value helpers ─────────────────────────────────────────────────────────────

/** Returns null for: null, undefined, "", "NA", "N/A", numeric 0, string "0" */
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

// ── Presentational components ─────────────────────────────────────────────────

function SpecRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-stone-100 last:border-0">
      <span className="text-sm text-stone-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-stone-800 text-right">{value}</span>
    </div>
  );
}

/**
 * Section renders only when at least one row has a non-empty value.
 * rows: Array<{ label: string, value: string | null }>
 */
function Section({ title, rows }) {
  const hasAny = rows.some(({ value }) => Boolean(value));
  if (!hasAny) return null;

  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-700">
        {title}
      </h3>
      <div className="rounded-xl border border-stone-100 bg-white px-4">
        {rows.map(({ label, value }) => (
          <SpecRow key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  );
}

// ── ProductSpecifications ─────────────────────────────────────────────────────

export default function ProductSpecifications({ product }) {
  if (!product) return null;

  // ── Metal ─────────────────────────────────────────────────────────────────
  // Primary API fields: metal_name, karat_name, metal_color_name
  const metalType   = val(product.metal_name);
  const metalPurity = val(product.karat_name)
    ?? (product.purity && product.purity !== 0 ? String(product.purity) : null);
  const metalColor  = val(product.metal_color_name);
  const hallmark    = val(product.hallmark ?? product.hallmark_no);

  // ── Weight ────────────────────────────────────────────────────────────────
  // API fields: weight (gross), net_weight, stone_weight, diamond_weight, pointer_weight
  const grossWeight   = formatWeight(product.weight);
  const netWeight     = formatWeight(product.net_weight);
  const stoneWeight   = formatWeight(product.stone_weight ?? product.color_stone_weight);
  const diamondWeight = formatWeight(product.diamond_weight);
  const pointerCt     = formatCarats(product.pointer_weight);

  // ── Stone ─────────────────────────────────────────────────────────────────
  const stonePieces      = product.stone_pieces        > 0 ? String(product.stone_pieces)       : null;
  const diamondPieces    = product.diamond_pieces      > 0 ? String(product.diamond_pieces)     : null;
  const colorStonePieces = product.color_stone_pieces  > 0 ? String(product.color_stone_pieces) : null;
  const otherPieces      = product.other_pieces        > 0 ? String(product.other_pieces)       : null;
  const colorStoneWeight = formatWeight(product.color_stone_weight);
  const otherWeight      = formatWeight(product.other_weight);

  // ── Classification ────────────────────────────────────────────────────────
  // val() handles "NA" → null for all string fields
  const itemGroup   = val(product.item_group_name);
  const category    = val(product.type_name);
  const subCategory = val(product.sub_type_name);
  const collection  = val(product.collection_name);
  const brand       = val(product.brand_name);
  const baseItem    = val(product.base_item);
  const hsn         = val(product.hsn);
  const sku         = val(product.item_code ?? product.sku);

  return (
    <div className="flex flex-col gap-4">

      <Section
        title="Metal Details"
        rows={[
          { label: 'Metal Type',      value: metalType },
          { label: 'Purity / Karat',  value: metalPurity },
          { label: 'Metal Colour',    value: metalColor },
          { label: 'Hallmark',        value: hallmark },
        ]}
      />

      <Section
        title="Weight"
        rows={[
          { label: 'Gross Weight',    value: grossWeight },
          { label: 'Net Weight',      value: netWeight },
          { label: 'Stone Weight',    value: stoneWeight },
          { label: 'Diamond Weight',  value: diamondWeight },
          { label: 'Diamond (ct)',    value: pointerCt },
        ]}
      />

      <Section
        title="Stone Details"
        rows={[
          { label: 'Stone Pieces',         value: stonePieces },
          { label: 'Diamond Pieces',       value: diamondPieces },
          { label: 'Colour Stone Pieces',  value: colorStonePieces },
          { label: 'Colour Stone Weight',  value: colorStoneWeight },
          { label: 'Other Pieces',         value: otherPieces },
          { label: 'Other Weight',         value: otherWeight },
        ]}
      />

      <Section
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
