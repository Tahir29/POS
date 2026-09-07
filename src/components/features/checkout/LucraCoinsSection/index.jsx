'use client';

// Lucira Coins (Nector's loyalty program) redemption — the cart-wide
// counterpart to DiscountSection, mutually exclusive with it (see
// cartSlice's redeemedCoins / applyLoyaltyCoins, and useCart.js's
// handleApplyLoyaltyCoins for the enforcement). Used identically in the
// mini cart drawer, the full cart page, and checkout — same reuse pattern
// DiscountSection itself already established.
//
// NOT EDITABLE (2026-09-08, product decision) — there's no amount input.
// Apply Coins always claims the full maxClaimable figure shown right next
// to it; Remove clears it back to zero. Nothing partial to type in.
//
// CLAIMABLE CAP: min(wallet balance, payable order total) — product
// decision 2026-09-08. `payableTotal` is passed in by the caller (each of
// the 3 screens already computes a live, server-priced total via
// useCheckoutPricing) rather than fetched here, so this component never
// disagrees with the CartSummary sitting right next to it.
//
// STUBBED DEBIT (2026-09-08) — applying coins here only sets the cart's
// own redeemedCoins figure; nothing is actually debited from the
// customer's Nector wallet yet. The real POST /wallettransactions call is
// blocked on a genuine identifier gap: Nector's own docs say it needs the
// lead's `_id` (or a merchant-assigned `customer_id`), but the
// GET /leads/{id}?mobile=... lookup this app uses doesn't return either
// field in its response body (confirmed live 2026-09-08 — see
// nectorService.js's getCustomerLoyalty and the proxy route's own header).
// checkout/page.jsx blocks completing a sale while coins are applied for
// exactly this reason (see that file's own comment) — so this UI can be
// tried end-to-end today (balance, apply, mutual exclusion, total
// deduction) without risking an uncollected discount ever reaching a real
// sale. Once the identifier gap is resolved, the debit call belongs in
// checkout's handlePaymentConfirmed, alongside placeOrder/placeInvoice.
//
// customerMobile comes from the ATTACHED session customer
// (useCustomerSession) — a cart/checkout screen only ever has one customer
// in play, unlike the standalone profile page's LucraCoinsCard, which has
// to guard against viewing a DIFFERENT customer than whoever's attached.

import { Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/cart/useCart';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useNectorLoyaltyPoints } from '@/hooks/customer/useNectorLoyaltyPoints';

/**
 * @param {{ payableTotal: number, isPricing?: boolean }} props
 *   payableTotal — this order's current payable amount (post-promo,
 *   pre-coins — e.g. useCheckoutPricing's amountDue).
 *   isPricing — distinguishes "cart is genuinely empty" from "still
 *   pricing, payableTotal just isn't real yet" (both read as
 *   maxClaimable <= 0 otherwise) — same two-reasons-two-hints split
 *   DiscountSection's own disabledHint already makes.
 */
export default function LucraCoinsSection({ payableTotal, isPricing = false }) {
  const { customerMobile } = useCustomerSession();
  const { appliedPromos, redeemedCoins, applyLoyaltyCoins, removeLoyaltyCoins } = useCart();
  const { points: balance, isFound, isLoading } = useNectorLoyaltyPoints(customerMobile, {
    enabled: !!customerMobile,
  });

  const maxClaimable = Math.max(0, Math.min(balance, Math.floor(payableTotal ?? 0)));
  const hasPromoApplied = appliedPromos.length > 0;
  const isApplied = redeemedCoins > 0;

  // No attached customer at all — nothing to redeem against (a guest sale
  // has no Nector lead to look up).
  if (!customerMobile) return null;

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-gradient-to-br from-amber-50 to-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground">Lucira Coins</h2>
          <div className="flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 shrink-0">
            <Coins size={16} className="text-amber-500" aria-hidden="true" />
            <span className="text-base font-bold text-foreground tabular-nums">—</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Checking Lucira Coins balance…</p>
      </section>
    );
  }

  // Not enrolled in Nector, or a real balance of zero — nothing to offer.
  // Deliberately hidden rather than shown as "0 Coins available", same
  // reasoning as the customer profile's own LucraCoinsCard for isFound.
  if (!isFound || balance <= 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-gradient-to-br from-amber-50 to-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Lucira Coins</h2>
          <p className="text-xs text-muted-foreground mt-0.5">1 Coin = 1 Rupee</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 shrink-0">
          <Coins size={16} className="text-amber-500" aria-hidden="true" />
          <span className="text-base font-bold text-foreground tabular-nums">
            {balance.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {isApplied ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-status-in-stock/10 px-3 py-2.5">
          <p className="text-sm font-semibold text-status-in-stock">
            {redeemedCoins.toLocaleString('en-IN')} Coins applied
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={removeLoyaltyCoins} className="h-8">
            Remove
          </Button>
        </div>
      ) : hasPromoApplied ? (
        <p className="text-xs text-muted-foreground">
          Remove the applied promo code before redeeming Lucira Coins.
        </p>
      ) : maxClaimable <= 0 ? (
        <p className="text-xs text-muted-foreground">
          {isPricing
            ? 'Still pricing your cart — coins can be applied once that’s done.'
            : 'Add items to your cart to redeem Lucira Coins.'}
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Claimable on this order: {maxClaimable.toLocaleString('en-IN')} Coins
          </p>
          <Button
            type="button"
            onClick={() => applyLoyaltyCoins(maxClaimable)}
            className="h-9 shrink-0"
          >
            Apply Coins
          </Button>
        </div>
      )}
    </section>
  );
}
