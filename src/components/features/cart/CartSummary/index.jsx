'use client';

// Subtotal / discount / total breakdown.
//
// REUSE NOTE: This component is intentionally pure/presentational and
// driven entirely by useCartTotals(). It is used in the Cart Drawer
// (Phase 8) and is designed to be reused as-is on the Checkout screen
// and any order review/confirmation step (Phase 9+) — do not add
// drawer-specific logic (e.g. close handlers) here.

import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { splitGst } from '@/lib/gst';

/**
 * @param {{
 *   totals?: {subTotal, taxAmount, netAmount, discount}|null,
 *   isPricing?: boolean,
 *   coinsRedeemed?: number,
 * }} props
 *   totals — server-priced figures for the ACTUAL stock pieces, after
 *   OrnaVerse's own promotion calculator has run (useCheckoutPricing). When
 *   present these win over the cart's own estimate, because they are what the
 *   document is raised at and what the customer is charged. Showing the cart
 *   estimate next to a Place Order button carrying the real figure is exactly
 *   the mismatch this prevents.
 *
 *   Every figure here comes from ONE source. Reading the discount off the
 *   cart while the total came from the priced pieces is what made this panel
 *   print a discount line and then not deduct it — the promo was visibly
 *   applied and the total never moved. `netAmount` is already net of the
 *   discount and re-taxed, so nothing is subtracted here.
 *
 *   coinsRedeemed (2026-09-08) — Lucira Coins applied against this order,
 *   ALREADY clamped by the caller to min(wallet balance, payable total) —
 *   see LucraCoinsSection's maxClaimable. Unlike the promo discount above,
 *   this is never folded into `totals` (coins aren't an OrnaVerse concept;
 *   OrnaVerse's own net_amount is untouched by it) — subtracted here,
 *   client-side, on top of `total`. Folded into the same single row as
 *   promoDiscount (2026-09-08, product decision) rather than its own
 *   separate line — a promo and coins are mutually exclusive (cartSlice's
 *   appliedPromos/redeemedCoins can't both be non-zero at once, see
 *   useCart.js/usePromoValidation.js's guards), so there's only ever one
 *   real number to show either way. The LABEL still says which one it was
 *   (2026-09-08, follow-up) — "Discount" for a promo, "Lucira Coins
 *   Redeemed" for coins — only the wording differs; the amount/total math
 *   is exactly the same either way.
 */
export default function CartSummary({ totals = null, isPricing = false, coinsRedeemed = 0 }) {
  const cart = useCartTotals();

  const subtotal = totals ? totals.subTotal  : cart.subtotal;
  const tax      = totals ? totals.taxAmount : cart.tax;
  const promoDiscount = totals ? (totals.discount ?? 0) : cart.discount;
  // Folded into one row for display — see coinsRedeemed's own doc comment
  // above. Kept as two separate inputs (not a single prop) because they
  // still mean different things internally: promoDiscount is real
  // OrnaVerse data already folded into `totals.netAmount`; coinsRedeemed is
  // a client-side deduction applied on top of it (see `total` below) —
  // only the ON-SCREEN row combines them.
  const discount = promoDiscount + coinsRedeemed;
  // Which mechanism actually produced `discount` — mutual exclusivity
  // means checking coinsRedeemed alone is enough to tell (see above).
  const discountLabel = coinsRedeemed > 0 ? 'Lucira Coins Redeemed' : 'Discount';

  // FIXED 2026-09-08 — Total used to be Math.round(netAmount) with no
  // corresponding line item, while Subtotal/Discount/Taxable Value/GST
  // above it all showed the exact decimal figure (maximumFractionDigits:
  // 2, never rounded) — the same mismatch CartItemRow's own per-line price
  // breakdown surfaces (those sum to the exact decimal netAmount too). The
  // displayed lines never actually added up to the displayed Total,
  // sometimes off by a few paise. Same round_off calculation
  // useCreateInvoice.js/useCreateOrder.js already send to OrnaVerse as its
  // own header field (roundedNet - netAmount) — shown here too now, so the
  // breakdown reconciles exactly with the rounded Total, the same way the
  // real document does. Whole-rupee rounding itself is unchanged (still
  // needed so the amount collected settles the invoice to exactly zero,
  // see useCheckoutPricing's own header) — only the missing line is added.
  const rawTotal   = totals ? totals.netAmount : cart.total;
  const roundedTotal = Math.round(rawTotal);
  const roundOff   = +(roundedTotal - rawTotal).toFixed(2);
  const total      = Math.max(0, roundedTotal - coinsRedeemed);
  // Bifurcated for display — see lib/gst.js. The combined `tax` above is
  // still what's actually summed into the header at submission time;
  // this just shows it the way a GST tax invoice is required to.
  const gst = splitGst(tax);

  return (
    <div className="flex flex-col gap-2 py-3" aria-busy={isPricing || undefined}>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Subtotal</span>
        <span className="font-medium text-foreground">
          ₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </span>
      </div>

      {discount > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{discountLabel}</span>
          <span className="font-medium text-status-in-stock">
            −₹{discount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Taxable value — shown only for server-priced totals, and only when
          a REAL promo (not coins — those never touch taxable value, they're
          a payment-side deduction, see coinsRedeemed's doc comment above)
          actually moved it. Mirrors the line their own POS shows between
          Discount and GST, so the two summaries can be read side by side
          when cross-checking a sale. */}
      {totals && promoDiscount > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Taxable Value</span>
          <span className="font-medium text-foreground">
            ₹{totals.taxableAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Shown as CGST + SGST, not one "GST" line — see lib/gst.js for why
          this split is exact for this business, not an estimate. Only the
          cart's own combined figure (pre-split) is the flat-3% estimate;
          the priced one is the server's real per-item tax total. */}
      {gst && (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>CGST (1.5%)</span>
            <span className="font-medium text-foreground">
              ₹{gst.cgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>SGST (1.5%)</span>
            <span className="font-medium text-foreground">
              ₹{gst.sgst.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
          </div>
        </>
      )}

      {roundOff !== 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Round Off</span>
          <span className="font-medium text-foreground">
            {roundOff > 0 ? '+' : '−'}₹{Math.abs(roundOff).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      <div className="h-px w-full bg-grad-hairline mt-1" aria-hidden="true" />

      <div className="flex items-center justify-between pt-1">
        <span className="text-base font-bold text-foreground">Total</span>
        <span className="font-heading text-xl font-semibold text-primary tabular-nums">
          ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
