'use client';

// Lucira Coins (Nector's loyalty program) redemption — cart-wide
// counterpart to DiscountSection, mutually exclusive with it (enforced in
// useCart.js's handleApplyLoyaltyCoins). Not editable: Apply always claims
// the one redemption Nector itself says is available on this exact cart
// total; Remove clears it to zero.
//
// CONFIRMED LIVE 2026-09-22 — the claimable amount is NOT min(balance,
// total): Nector has its own real eligibility rules (this tenant's real
// minimum cart is ₹10,000, plus a max-discount cap) that only the
// cart-total-aware `checkout` "list" call actually knows — a flat balance
// lookup can't tell you what's redeemable. useNectorCheckoutInfo is that
// call; useNectorLoyaltyPoints (plain balance, no amount) is kept only to
// distinguish "not enrolled" from "enrolled, nothing redeemable yet". The
// real debit (performNectorRedemption) fires in checkout/page.jsx's
// handlePaymentConfirmed, after the sale — see that file's own comment.

import { Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/cart/useCart';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useNectorLoyaltyPoints } from '@/hooks/customer/useNectorLoyaltyPoints';
import { useNectorCheckoutInfo } from '@/hooks/checkout/useNectorCheckoutInfo';

/**
 * @param {{ payableTotal: number, isPricing?: boolean }} props
 *   payableTotal — current payable amount (post-promo, pre-coins, e.g.
 *   useCheckoutPricing's amountDue). This is exactly the `amount` Nector's
 *   own eligibility check is run against — checkout/page.jsx's redemption
 *   call must use the SAME figure, or the two can disagree on what was
 *   actually available.
 *   isPricing — distinguishes an empty cart from one still pricing (both
 *   otherwise read as no redemption available).
 */
export default function LucraCoinsSection({ payableTotal, isPricing = false }) {
  const { customerMobile } = useCustomerSession();
  const { appliedPromos, redeemedCoins, applyLoyaltyCoins, removeLoyaltyCoins } = useCart();
  const { points: balance, isFound, isLoading } = useNectorLoyaltyPoints(customerMobile, {
    enabled: !!customerMobile,
  });
  const {
    promotion, isEligible, isLoading: isLoadingEligibility,
  } = useNectorCheckoutInfo(customerMobile, payableTotal, {
    // Only worth checking once there's a real, priced total to check
    // against and a coin balance actually worth checking for.
    enabled: !!customerMobile && isFound && balance > 0 && (payableTotal ?? 0) > 0,
  });

  const claimableAmount = Number(promotion?.fiat_value) || 0;
  const hasPromoApplied = appliedPromos.length > 0;
  const isApplied = redeemedCoins > 0;

  // No attached customer — a guest sale has no Nector lead to look up.
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
      ) : !isFound ? (
        <p className="text-xs text-muted-foreground">Not enrolled in Lucira Coins yet.</p>
      ) : (payableTotal ?? 0) <= 0 ? (
        <p className="text-xs text-muted-foreground">
          {isPricing
            ? 'Still pricing your cart — coins can be applied once that’s done.'
            : 'Add items to your cart to redeem Lucira Coins.'}
        </p>
      ) : isLoadingEligibility ? (
        <p className="text-xs text-muted-foreground">Checking what’s redeemable on this order…</p>
      ) : !isEligible ? (
        <p className="text-xs text-muted-foreground">
          Not redeemable on this order yet — add more to your cart to unlock a discount.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {promotion?.title || `Redeem for ₹${claimableAmount.toLocaleString('en-IN')} off`}
          </p>
          <Button
            type="button"
            onClick={() => applyLoyaltyCoins(claimableAmount)}
            className="h-9 shrink-0"
          >
            Apply Coins
          </Button>
        </div>
      )}
    </section>
  );
}
