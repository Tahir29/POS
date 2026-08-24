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
    // bg-primary wrapper (2026-08-24 fix) — this used to share the exact
    // same bg-muted as ProductSpecifications' cards right below it, so the
    // two sections had no visual seam and read as one merged block. #5A413F
    // is this app's --primary token (confirmed in globals.css — the same
    // brown every CTA/button already uses), reused here rather than a
    // one-off hex so it stays in sync if the brand color ever changes.
    // Grid: 1 col mobile / 2 tablet / 4 desktop, not the old fixed
    // 2-then-4 — that skipped straight from 2 columns to 4 with no
    // dedicated mobile single-column state.
    <div className="rounded-2xl bg-primary p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {TRUST_BADGES.map(({ icon: Icon, title, subtitle }) => (
          // bg-primary-foreground/10, not bg-muted (2026-08-24) — a light
          // box on the new dark bg-primary wrapper instead of one that was
          // only ever designed to sit on a plain white page background.
          <div key={title} className="flex items-center gap-2.5 rounded-2xl bg-primary-foreground/10 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-primary-foreground">
              <Icon size={17} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              {/* truncate removed (2026-08-24) — was cutting titles and
                  subtitles off mid-word ("IGI Certifi…", "Every diamo…")
                  the moment the box got narrower than its content; these
                  are short enough to just wrap onto a second line instead
                  of needing to fit on exactly one. text-foreground/
                  text-muted-foreground swapped for text-primary-foreground
                  (full/70% opacity) — the old dark-gray tones were meant
                  for a light bg-muted box, not this dark bg-primary one. */}
              <p className="text-sm font-semibold leading-tight text-primary-foreground">
                {title}
              </p>
              <p className="text-xs leading-tight text-primary-foreground/70">
                {subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
