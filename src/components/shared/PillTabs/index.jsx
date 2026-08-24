'use client';

// src/components/shared/PillTabs/index.jsx
//
// Shared horizontal tab strip built on shadcn/Radix Tabs — replaces the
// hand-rolled "TABS.map + button + activeTab === key ternary" pattern that
// was independently copy-pasted across ~10 pages (schemes, returns,
// daily-closing, exchange, urd-purchase, buyback, transactions, repair,
// customers/[customerId], CustomerDetailSheet), plus a byte-identical local
// `TabBar` duplicated in both transactions/page.jsx and repair/page.jsx.
//
// Two visual variants match the two designs already in use:
//   'pill' (default) — segmented control: one shared bg-muted "track", the
//                       active tab a raised bg-primary segment inset inside
//                       it. Restyled 2026-08-24 to match lucirajewelry.com's
//                       own tab design (e.g. its "Price Breakup / Price
//                       Comparison" toggle) — this used to be two entirely
//                       separate rounded-full chips with a gap between them
//                       (still visible in 'chip' below, which keeps that
//                       look on purpose — see its own note).
//   'chip'            — rounded-lg, optional leading icon, horizontally
//                        scrollable (the transactions/repair TabBar look).
//                        Left AS-IS: it's a scrollable icon+label nav strip,
//                        not a 2-3-option toggle, and the site has nothing
//                        resembling it to match against.
//
// `tabs` accepts either an array of plain keys (with getLabel resolving
// display text, e.g. from a TAB_LABELS map) or an array of richer objects —
// getKey/getLabel/getIcon default to the {key,label,icon} shape.

import {
  Tabs, TabsList, TabsTrigger,
} from '@/components/ui/tabs';

// PREMIUM REVAMP (2026-07-22): 'pill' used to hardcode stone-100/stone-500/
// stone-200 for its inactive state (the same drift found in ListItemCard) —
// now routes through the same bg-muted/text-muted-foreground tokens the
// 'chip' variant already used correctly. Both variants also pick up the
// new premium timing tokens.
//
// rounded-md, not rounded-full (2026-08-24, 'pill' only) — matches the
// small, flattened corner radius the rest of the app now uses everywhere
// (see globals.css's --radius scale comment); the website's own tabs use
// the same small-radius language, not a full pill either.
// flex-1 + text-center, 'pill' only (2026-08-24) — the segmented track now
// spans the full width available (see VARIANT_LIST_WIDTH below) instead of
// hugging its content, so each segment has to grow to fill and share that
// width evenly rather than sitting shrink-0/left-aligned with dead space
// after it. 'chip' stays shrink-0: it's a scrollable strip that's supposed
// to hug its own content width, not stretch.
//
// Explicit h-8/h-9 (2026-08-24) — shadcn's base TabsTrigger (ui/tabs.jsx)
// sizes itself to `h-[calc(100%-1px)]`, a PERCENTAGE of TabsList's height.
// That only resolves correctly against a parent with a definite height, and
// TabsList here is `h-auto` (has been since before today's redesign) — so
// the percentage has nothing definite to resolve against and every trigger
// fell back to its own small content-driven height instead. Invisible on
// the OLD design (both states rendered at that same short height, so
// nothing looked mismatched), but glaring on the new segmented-track look:
// live-verified on the customer detail sheet, the active "Profile" segment
// rendered at 19px inside a 36px track, leaving a visible sliver of the
// unfilled bg-muted track showing above it. A fixed height sidesteps the
// percentage-resolution problem entirely rather than fighting it.
const VARIANT_TRIGGER = {
  pill: 'h-8 flex-1 rounded-md px-4 py-1.5 text-xs font-medium text-center transition-colors duration-standard ease-premium '
    + 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm '
    + 'data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground',
  chip: 'h-9 flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors duration-standard ease-premium '
    + 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none '
    + 'data-[state=inactive]:bg-muted/40 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/70',
};

// The shared "track" background — only 'pill' gets one; 'chip' stays
// transparent (each chip already carries its own background/gap, and a
// shared track behind a horizontally-scrolling icon strip wouldn't read as
// one grouped control the way a 2-3-option toggle does).
const VARIANT_LIST = {
  pill: 'gap-1 rounded-md bg-muted p-1',
  chip: 'gap-1 bg-transparent p-0',
};

// 'pill' spans the full width offered by its container (2026-08-24) instead
// of sizing to its own content — matches the site's own toggle, which reads
// as a section-width control, not a small content-hugging chip row. 'chip'
// keeps hugging its content: it's a scrollable nav strip that should never
// stretch to fill a whole row.
const VARIANT_LIST_WIDTH = {
  pill: 'w-full',
  chip: 'w-fit',
};

export default function PillTabs({
  tabs,
  value,
  onChange,
  getKey = (t) => t.key ?? t,
  getLabel = (t) => t.label ?? t,
  getIcon = (t) => t.icon,
  variant = 'pill',
  scrollable = false,
  className = '',
}) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList
        className={`h-auto justify-start ${VARIANT_LIST_WIDTH[variant]} ${VARIANT_LIST[variant]} ${
          scrollable ? 'flex-nowrap overflow-x-auto scrollbar-none' : 'flex-wrap'
        } ${className}`}
      >
        {tabs.map((tab) => {
          const Icon = getIcon(tab);
          return (
            <TabsTrigger key={getKey(tab)} value={String(getKey(tab))} className={VARIANT_TRIGGER[variant]}>
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {getLabel(tab)}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
