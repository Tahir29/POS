'use client';

// Full cost breakdown for the live-priced figure — mirrors OrnaVerse's own
// Invoice cart line breakdown (METAL / DIAMOND / LABOUR / SUBTOTAL /
// TAXABLE / TAX), captured live from their UAT POS 2026-08-26.
//
// REDESIGNED 2026-08-27, twice:
//   1st pass — flat wrap of stat chips → a vertical "receipt" (stacked rows,
//     header, highlighted total footer), moved beside the spec cards.
//   2nd pass (this one) — back to a HORIZONTAL layout per explicit request
//     (fits a per-product row on Cart/Checkout far better than a tall
//     vertical stack does), but keeping the receipt pass's polish: a header,
//     each figure in its own small card ("segment") rather than bare
//     label/value pairs, and Total still visually set apart as its own full-
//     width bar rather than just one more segment in the row. Segments are
//     flex-wrap + flex-1, NOT a fixed-column grid — that's what makes this
//     genuinely responsive: on a wide product-page placement they sit in one
//     tidy row, and on a narrow cart-line/mobile width they reflow into
//     however many rows are needed, each segment still evenly sized, rather
//     than overflowing or forcing horizontal scroll.
//
// NO field was dropped in either redesign — every figure the original flat
// version showed (Metal/Diamond/Stone/Colour Stone/Other, Making Charges,
// Subtotal, Taxable, Tax, Total) is still exactly here; only the layout and
// styling changed.
//
// Every figure here is a field already ON the SetSalesItems row
// useVariantPricing fetches for the headline price (see pricingService.js)
// — nothing new to price, just more of what already came back, shown.
//
// NO Discount segment here, unlike their cart line — that row is priced
// PRE-promotion (Helper/ApplyPromotions only ever runs once items are
// actually in the cart, at checkout's own pricing pass — see
// DiscountSection/useCheckoutPricing), so item_labour/metal_amount/etc.
// here can never disagree with a promo the way a stale discount figure
// could. The nearby DiscountSection is what actually handles a promo.

import { Receipt } from 'lucide-react';

const money = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function Segment({ label, value, muted = false }) {
  return (
    <div
      className={[
        'flex min-w-26 flex-1 basis-24 flex-col gap-1 rounded-xl px-3 py-2.5',
        muted ? 'bg-muted/40' : 'bg-muted/70',
      ].join(' ')}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums text-foreground">
        {money(value)}
      </span>
    </div>
  );
}

/**
 * @param {{ priced: object|null }} props
 *   priced — the row useVariantPricing returns (SetSalesItems' Entity
 *   shape) on the product page, or the equivalent `breakdown` object
 *   mapPricedLinesToCart builds per cart line on the cart/checkout pages.
 *   Renders nothing until it resolves — see the PDP's own "Calculating live
 *   price…" state for that in-between moment.
 */
export default function PriceBreakdown({ priced }) {
  if (!priced) return null;

  // Every material component that actually applies to this piece — most
  // items carry only two or three of these nonzero (this bracelet: Metal +
  // Diamond + Labour), and a component this design has none of (e.g. no
  // colour stone) is left out rather than shown as a bare "₹0" that reads
  // like a rendering gap.
  const materialSegments = [
    { label: 'Metal',        value: priced.metal_amount },
    { label: 'Diamond',      value: priced.diamond_amount },
    { label: 'Stone',        value: priced.stone_amount },
    { label: 'Colour Stone', value: priced.color_stone_amount },
    { label: 'Other',        value: priced.other_amount },
  ].filter((s) => s.value > 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-border bg-accent/5 px-4 py-3 sm:px-5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Receipt size={14} aria-hidden="true" />
        </span>
        <h3 className="text-xs font-bold uppercase tracking-wide text-foreground sm:text-sm">
          Price Breakdown
        </h3>
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-3 sm:gap-2.5 sm:px-5 sm:py-4">
        {materialSegments.map((s) => (
          <Segment key={s.label} label={s.label} value={s.value} />
        ))}
        {priced.item_labour > 0 && (
          <Segment label="Making Charges" value={priced.item_labour} />
        )}
        <Segment label="Subtotal" value={priced.sub_total} muted />
        <Segment label="Taxable Amount" value={priced.taxable_amount} muted />
        <Segment label="Tax (GST)" value={priced.tax_amount} muted />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-accent/5 px-4 py-3 sm:px-5">
        <span className="text-xs font-bold text-foreground sm:text-sm">Total (incl. GST)</span>
        <span className="text-base font-bold tabular-nums text-accent sm:text-lg">
          {money(priced.net_amount)}
        </span>
      </div>
    </div>
  );
}
