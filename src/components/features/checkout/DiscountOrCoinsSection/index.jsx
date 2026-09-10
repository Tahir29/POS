'use client';

// Tabbed container for the cart's two mutually-exclusive discount
// mechanisms — a promo code (DiscountSection) and Lucira Coins
// (LucraCoinsSection) can never both be active at once (see cartSlice's
// appliedPromos/redeemedCoins). One tab strip, one panel at a time.
//
// Default tab follows whichever mechanism is already applied (read once
// at mount), falling back to Discount when neither is.

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

  // Lucira Coins need an attached customer (looked up by customerMobile);
  // a guest cart has no coin balance, so skip the tab strip entirely
  // rather than show a "Lucira Coins" tab that renders nothing.
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
