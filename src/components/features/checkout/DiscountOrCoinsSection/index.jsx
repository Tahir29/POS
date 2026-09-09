'use client';

// Tabbed container for the cart/checkout's two mutually-exclusive discount
// mechanisms — a promo code (DiscountSection) and Lucira Coins
// (LucraCoinsSection) can never both be active at once (see cartSlice's
// appliedPromos/redeemedCoins and their mutual-exclusion guards in
// useCart.js's handleApplyLoyaltyCoins / usePromoValidation.js's
// 'coins_active' check). Showing both stacked, always, wasted space on an
// option that's already unavailable once the other is picked — cramped in
// the mini cart drawer, and read as redundant on the full cart/checkout
// pages. One tab strip, one panel shown at a time instead.
//
// Default tab follows whichever mechanism is ALREADY applied, so
// re-opening the cart mid-sale doesn't hide an active discount behind the
// other tab; falls back to Discount when neither is applied. Read once at
// mount (useState initializer) — once the operator picks a tab manually,
// it stays picked for the rest of this mount rather than fighting that
// choice by re-deciding on every render (same one-shot pattern the
// customer profile page's own initial-tab logic already uses).

import { useState } from 'react';
import PillTabs from '@/components/shared/PillTabs';
import DiscountSection from '@/components/features/checkout/DiscountSection';
import LucraCoinsSection from '@/components/features/checkout/LucraCoinsSection';
import { useCart } from '@/hooks/cart/useCart';
import { useCustomerSession } from '@/hooks/customer/useCustomerSession';

const TABS = ['discount', 'coins'];
const TAB_LABELS = { discount: 'Discount', coins: 'Lucira Coins' };

/**
 * @param {{ payableTotal: number, isPricing?: boolean }} props — forwarded
 *   to LucraCoinsSection only; DiscountSection fetches its own pricing (see
 *   that component's own header for why).
 */
export default function DiscountOrCoinsSection({ payableTotal, isPricing = false }) {
  const { redeemedCoins } = useCart();
  const { customerMobile } = useCustomerSession();
  const [tab, setTab] = useState(() => (redeemedCoins > 0 ? 'coins' : 'discount'));

  // FIXED 2026-09-09 — Lucira Coins are tied to a customer's own Nector
  // wallet (looked up by customerMobile — see LucraCoinsSection's own
  // header); there is no such thing as a guest's coin balance. Before this,
  // the tab strip always showed BOTH tabs regardless of whether a customer
  // was attached, so a guest cart showed a perfectly clickable "Lucira
  // Coins" tab that rendered nothing at all once tapped (LucraCoinsSection
  // returns null with no customerMobile) — a dead end with no explanation.
  // Hidden entirely instead, same as a real loyalty program only ever
  // offering itself to an identified customer; no single-tab strip left
  // behind either, since with only one mechanism available there's nothing
  // to switch between — DiscountSection renders directly.
  if (!customerMobile) {
    return <DiscountSection />;
  }

  return (
    <div className="flex flex-col gap-3">
      <PillTabs
        tabs={TABS}
        value={tab}
        onChange={setTab}
        getKey={(t) => t}
        getLabel={(t) => TAB_LABELS[t]}
      />
      {tab === 'discount' && <DiscountSection />}
      {tab === 'coins' && <LucraCoinsSection payableTotal={payableTotal} isPricing={isPricing} />}
    </div>
  );
}
