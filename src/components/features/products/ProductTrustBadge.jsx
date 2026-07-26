'use client';

import { ShieldCheck, RefreshCw, Truck, Coins } from 'lucide-react';

// Each badge is its own light-bg box (was 4 items loose inside one outer
// card) — every icon shares the same accent tint instead of a different
// color per badge (the mismatched per-badge colors, e.g. IGI's green, read
// as random rather than a deliberate system). Buyback's icon changed from
// Gem (already used elsewhere for "diamond/stone", not "cash back") to
// Coins, which actually reads as "money back".
const TRUST_BADGES = [
  { icon: ShieldCheck, title: 'IGI Certified',         subtitle: 'Every diamond graded' },
  { icon: RefreshCw,   title: 'Lifetime Exchange',     subtitle: '100% value back' },
  { icon: Truck,       title: 'Free Insured Shipping', subtitle: 'Fully protected' },
  { icon: Coins,       title: 'Lifetime Buyback',      subtitle: 'Transparent rates' },
];

export default function ProductTrustBadge() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {TRUST_BADGES.map(({ icon: Icon, title, subtitle }) => (
        <div key={title} className="flex items-center gap-2.5 rounded-2xl bg-muted p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Icon size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight truncate">
              {title}
            </p>
            <p className="text-xs text-muted-foreground leading-tight truncate">
              {subtitle}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
