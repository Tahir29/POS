'use client';

// Subtotal / discount / total breakdown. Pure/presentational, driven by
// useCartTotals() unless server-priced `totals` is supplied — reused as-is
// across the Cart Drawer, Checkout, and order review; keep it free of
// drawer-specific logic (e.g. close handlers).

import { useCartTotals } from '@/hooks/cart/useCartTotals';
import { splitGst } from '@/lib/gst';

/**
 * @param {{
 *   totals?: {subTotal, taxAmount, netAmount, discount}|null,
 *   isPricing?: boolean,
 *   coinsRedeemed?: number,
 * }} props
 *   totals - server-priced figures for the actual stock pieces (after the
 *   promotion calculator runs), which win over the cart's own estimate
 *   since they're what the customer is actually charged. netAmount is
 *   already net of discount and re-taxed.
 *
 *   coinsRedeemed - Lucira Coins applied to this order, already clamped by
 *   the caller to the payable total. Not an ERP concept, so it's never
 *   folded into `totals`; subtracted client-side on top of the total.
 *   Promo discount and coins are mutually exclusive, so they share one
 *   display row (label switches between "Discount" and "Lucira Coins
 *   Redeemed") even though they come from different sources.
 */
export default function CartSummary({ totals = null, isPricing = false, coinsRedeemed = 0 }) {
  const cart = useCartTotals();

  const subtotal = totals ? totals.subTotal  : cart.subtotal;
  const tax      = totals ? totals.taxAmount : cart.tax;
  const promoDiscount = totals ? (totals.discount ?? 0) : cart.discount;
  // promoDiscount (real data, already folded into totals.netAmount) and
  // coinsRedeemed (a client-side deduction applied on top, see `total`
  // below) are kept as separate inputs but combined into one display row.
  const discount = promoDiscount + coinsRedeemed;
  const discountLabel = coinsRedeemed > 0 ? 'Lucira Coins Redeemed' : 'Discount';

  // Total is rounded to a whole rupee (so the amount collected settles the
  // invoice exactly); roundOff is shown as its own line so the displayed
  // figures reconcile exactly with the rounded Total.
  const rawTotal   = totals ? totals.netAmount : cart.total;
  const roundedTotal = Math.round(rawTotal);
  const roundOff   = +(roundedTotal - rawTotal).toFixed(2);
  const total      = Math.max(0, roundedTotal - coinsRedeemed);
  // Bifurcated into CGST/SGST for display — see lib/gst.js. The combined
  // `tax` above is still what's summed into the header at submission time.
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

      {/* Taxable value — shown only for server-priced totals with a real
          promo applied (coins are a payment-side deduction and never touch it). */}
      {totals && promoDiscount > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Taxable Value</span>
          <span className="font-medium text-foreground">
            ₹{totals.taxableAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Shown as CGST + SGST rather than one "GST" line — see lib/gst.js. */}
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
