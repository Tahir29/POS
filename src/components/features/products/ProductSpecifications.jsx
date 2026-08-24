'use client';

// Card-based product specifications layout — light-grey boxes, 2 per row,
// matching the reference design (2026-07-26 revamp). Empty sections hidden
// entirely.
//
// Each card's "i" button opens a bottom sheet (side sheet on tablet+, same
// BottomSheet primitive used elsewhere on this page — reviews, etc.) with
// static explainer content for that section. Only "Metal" has real content
// so far (confirmed content + Shopify-hosted reference images); the other
// three cards fall back to a generic placeholder until their content is
// supplied — see SPEC_INFO_CONTENT below to add more.

import { useState } from 'react';
import Image from 'next/image';
import { Info } from 'lucide-react';
import BottomSheet from '@/components/shared/BottomSheet';

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

// Static/educational, not per-product — same convention as ProductTrustSection.
// Add new keys here (matching a SpecCard's `title`) as content is supplied.

const SPEC_INFO_CONTENT = {
  Metal: {
    sections: [
      {
        heading: 'KARAT',
        image: 'https://cdn.shopify.com/s/files/1/0739/8516/3482/files/Frame_1437257497_1_c572a805-3945-45f8-bf40-c47876e90aed.png',
        imageAlt: 'Karat options — 9KT (37.5% gold), 14KT (58.5% gold), 18KT (75% gold)',
      },
      {
        heading: 'COLOR',
        image: 'https://cdn.shopify.com/s/files/1/0739/8516/3482/files/Frame_1437257497_a6e4ef63-b2e7-4278-8c32-38b167679ebd.png',
        imageAlt: 'Metal color options — Yellow Gold, Rose Gold, White Gold',
      },
      {
        heading: 'NET WT.',
        text: 'Net Wt. indicates only the weight of Metal from the Total Weight of the jewelry.',
      },
    ],
  },
  Dimension: {
    // Side-by-side columns (Height / Width) rather than full-width stacked
    // sections — matches the reference layout, unlike Metal's Karat/Color.
    columns: [
      {
        heading: 'HEIGHT',
        image: 'https://cdn.shopify.com/s/files/1/0739/8516/3482/files/Frame_1437257497_ef0e1883-fce6-4ae5-8f5f-7d767cc4a343.png',
        imageAlt: 'Height — the vertical measurement of the jewelry from the bottom to the top of the jewelry',
      },
      {
        heading: 'WIDTH',
        image: 'https://cdn.shopify.com/s/files/1/0739/8516/3482/files/Frame_1437257497_4df01e1c-7846-4b7d-a1ae-48e44907e308.png',
        imageAlt: 'Width — the horizontal measurement across the jewelry from one side to the other',
      },
    ],
    sections: [
      {
        heading: 'GROSS WT.',
        text: 'Gross Weight indicates the total weight of the jewelry, including the metal, diamonds, gemstones, and all other components used in the piece.',
      },
    ],
  },
  Diamond: {
    sections: [
      {
        heading: 'POSITION',
        image: 'https://cdn.shopify.com/s/files/1/0739/8516/3482/files/Frame_1437257503_e5b7f116-3848-44e1-b838-e3691c85d5a2.png',
        imageAlt: 'Diamond position options — Center, Side',
      },
      {
        heading: 'QUALITY',
        image: 'https://cdn.shopify.com/s/files/1/0739/8516/3482/files/Frame_1437257505_d217c271-1e27-4513-b571-c6464e313e2b.png',
        imageAlt: 'Diamond quality options — VVS-VS, E-F',
      },
      {
        heading: 'SHAPE',
        image: 'https://cdn.shopify.com/s/files/1/0739/8516/3482/files/Frame_1437257506_6987bc69-acbf-4dfb-b2e0-df136b4f6ed5.png',
        imageAlt: 'Diamond shape options — Emerald, Oval, Cushion, Round, Princess, Pear, Marquise, Heart',
        imageHeight: 480,
      },
      {
        heading: 'QUANTITY',
        text: 'Quantity indicates the total number of Diamonds used in the jewelry.',
      },
      {
        heading: 'CARAT',
        text: 'Carat (ct) is the standard unit of measurement used to indicate the weight of Diamonds used in the jewelry.',
      },
    ],
  },
};

function SpecInfoColumn({ heading, image, imageAlt }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
        {heading}
      </h3>
      {image ? (
        <div className="w-full overflow-hidden rounded-2xl bg-muted">
          <Image
            src={image}
            alt={imageAlt ?? heading}
            width={375}
            height={317}
            className="h-auto w-full"
          />
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-muted">
          <span className="text-xs text-muted-foreground/70">Image coming soon</span>
        </div>
      )}
    </div>
  );
}

function SpecInfoSheetBody({ title }) {
  const content = title ? SPEC_INFO_CONTENT[title] : null;

  if (!content) {
    return (
      <p className="text-sm text-muted-foreground">
        More details about {title?.toLowerCase()} will be added here soon.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {content.columns && (
        <div className="grid grid-cols-2 gap-4">
          {content.columns.map((col) => (
            <SpecInfoColumn key={col.heading} {...col} />
          ))}
        </div>
      )}
      {content.sections?.map((section) => (
        <div key={section.heading} className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
            {section.heading}
          </h3>
          {section.image && (
            <div className="overflow-hidden rounded-2xl bg-muted">
              <Image
                src={section.image}
                alt={section.imageAlt ?? section.heading}
                width={768}
                height={section.imageHeight ?? 240}
                className="h-auto w-full"
              />
            </div>
          )}
          {section.text && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {section.text}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function SpecRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}

function SpecCard({ icon, title, rows, onOpenInfo }) {
  const hasAny = rows.some(({ value }) => Boolean(value));
  if (!hasAny) return null;

  return (
    <div className="rounded-2xl bg-muted p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-foreground shrink-0" aria-hidden="true">
              {icon}
            </span>
          )}
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
            {title}
          </h3>
        </div>
        <button
          type="button"
          aria-label={`About ${title}`}
          onClick={() => onOpenInfo(title)}
          className="text-muted-foreground/50 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
        >
          <Info size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col">
        {rows.map(({ label, value }) => (
          <SpecRow key={label} label={label} value={value} />
        ))}
      </div>
    </div>
  );
}

const ICON_URLS = {
  metal: 'https://cdn.shopify.com/s/files/1/0739/8516/3482/files/PDPIcons_metal.svg',
  dimension: 'https://cdn.shopify.com/s/files/1/0739/8516/3482/files/PDPIcons_dimension.svg',
  diamond: 'https://cdn.shopify.com/s/files/1/0739/8516/3482/files/PDPIcons_diamond.svg',
  classification: 'https://cdn.shopify.com/s/files/1/0739/8516/3482/files/PDPIcons_diamond.svg',
};

function SpecIcon({ src, alt }) {
  return (
    <img src={src} alt={alt} width={14} height={14} className="shrink-0" loading="lazy" />
  );
}

const MetalIcon = () => <SpecIcon src={ICON_URLS.metal} alt="Metal" />;
const DimensionIcon = () => <SpecIcon src={ICON_URLS.dimension} alt="Dimension" />;
const DiamondIcon = () => <SpecIcon src={ICON_URLS.diamond} alt="Diamond" />;
const TagIcon = () => <SpecIcon src={ICON_URLS.classification} alt="Classification" />;

export default function ProductSpecifications({ product }) {
  const [infoTitle, setInfoTitle] = useState(null);

  if (!product) return null;

  const metalPurity = val(product.karat_name)
    ?? (product.purity && product.purity !== 0 ? String(product.purity) : null);
  const metalColor  = val(product.metal_color_name);
  const metalType   = val(product.metal_name);
  const netWeight   = formatWeight(product.net_weight);

  const height        = formatDimension(product.height);
  const width         = formatDimension(product.width);
  const depth         = formatDimension(product.depth);
  const length         = formatDimension(product.length);
  const grossWeight   = formatWeight(product.weight);
  const stoneWeight   = formatWeight(product.stone_weight);
  const diamondWeight = formatWeight(product.diamond_weight);
  const pointerCt     = formatCarats(product.pointer_weight);

  const diamondPieces    = product.diamond_pieces      > 0 ? String(product.diamond_pieces)     : null;
  const diamondCarats    = formatCarats(product.diamond_weight);
  const stonePieces      = product.stone_pieces        > 0 ? String(product.stone_pieces)       : null;
  const colorStonePieces = product.color_stone_pieces  > 0 ? String(product.color_stone_pieces) : null;
  const colorStoneWeight = formatWeight(product.color_stone_weight);
  const otherPieces      = product.other_pieces        > 0 ? String(product.other_pieces)       : null;
  const otherWeight      = formatWeight(product.other_weight);

  const itemGroup   = val(product.item_group_name);
  const category    = val(product.type_name);
  const subCategory = val(product.sub_type_name);
  const collection  = val(product.collection_name);
  const brand       = val(product.brand_name);
  const baseItem    = val(product.base_item);
  const hsn         = val(product.hsn);
  const sku         = val(product.item_code ?? product.sku);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

        <SpecCard
          icon={<MetalIcon />}
          title="Metal"
          onOpenInfo={setInfoTitle}
          rows={[
            { label: 'Purity',     value: metalPurity },
            { label: 'Color',      value: metalColor },
            { label: 'Metal Type', value: metalType },
            { label: 'Net Wt',     value: netWeight },
          ]}
        />

        <SpecCard
          icon={<DimensionIcon />}
          title="Dimension"
          onOpenInfo={setInfoTitle}
          rows={[
            { label: 'Height',       value: height },
            { label: 'Width',        value: width },
            { label: 'Length',       value: length },
            { label: 'Depth',        value: depth },
            { label: 'Gross Wt',     value: grossWeight },
            { label: 'Stone Wt',     value: stoneWeight },
            { label: 'Diamond Wt',   value: diamondWeight },
            { label: 'Diamond (ct)', value: pointerCt },
          ]}
        />

        <SpecCard
          icon={<DiamondIcon />}
          title="Diamond"
          onOpenInfo={setInfoTitle}
          rows={[
            { label: 'Quantity',            value: diamondPieces },
            { label: 'Carat',               value: diamondCarats },
            { label: 'Stone Pieces',        value: stonePieces },
            { label: 'Colour Stone Pieces', value: colorStonePieces },
            { label: 'Colour Stone Weight', value: colorStoneWeight },
            { label: 'Other Pieces',        value: otherPieces },
            { label: 'Other Weight',        value: otherWeight },
          ]}
        />

        <SpecCard
          icon={<TagIcon />}
          title="Classification"
          onOpenInfo={setInfoTitle}
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

      <BottomSheet
        isOpen={!!infoTitle}
        onClose={() => setInfoTitle(null)}
        // BottomSheet now uppercases its own title (2026-08-23) — this used
        // to do it manually here since this was the one sheet that needed
        // it; passing the real-case string now so aria-label reads normally.
        title={infoTitle}
      >
        <SpecInfoSheetBody title={infoTitle} />
      </BottomSheet>
    </>
  );
}
