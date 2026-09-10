'use client';

// Lucira Coins (Nector's loyalty program) redemption — cart-wide
// counterpart to DiscountSection, mutually exclusive with it (enforced in
// useCart.js's handleApplyLoyaltyCoins). Not editable: Apply always claims
// the full claimable amount (min of wallet balance and payable total);
// Remove clears it to zero.
//
// Debiting the Nector wallet is not wired up yet — applying coins here
// only updates local cart state (cartSlice's redeemedCoins), pending a
// merchant/lead identifier that the current Nector lookup doesn't return.
// checkout/page.jsx blocks completing a sale while coins are applied
// until that's resolved; the real debit call belongs in checkout's
// handlePaymentConfirmed once it is.

import { Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/hooks/cart/useCart';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';
import { useNectorLoyaltyPoints } from '@/hooks/customer/useNectorLoyaltyPoints';

/**
 * @param {{ payableTotal: number, isPricing?: boolean }} props
 *   payableTotal — current payable amount (post-promo, pre-coins, e.g.
 *   useCheckoutPricing's amountDue).
 *   isPricing — distinguishes an empty cart from one still pricing (both
 *   otherwise read as maxClaimable <= 0).
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

  // Not enrolled, or a real balance of zero — hidden rather than shown as
  // "0 Coins available" (same as the profile page's LucraCoinsCard).
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
