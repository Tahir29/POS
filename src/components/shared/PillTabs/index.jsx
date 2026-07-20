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
//   'pill' (default) — rounded-full, bg-primary active / bg-stone-100 idle
//   'chip'            — rounded-lg, optional leading icon, horizontally
//                        scrollable (the transactions/repair TabBar look)
//
// `tabs` accepts either an array of plain keys (with getLabel resolving
// display text, e.g. from a TAB_LABELS map) or an array of richer objects —
// getKey/getLabel/getIcon default to the {key,label,icon} shape.

import {
  Tabs, TabsList, TabsTrigger,
} from '@/components/ui/tabs';

const VARIANT_TRIGGER = {
  pill: 'shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors '
    + 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none '
    + 'data-[state=inactive]:bg-stone-100 data-[state=inactive]:text-stone-500 data-[state=inactive]:hover:bg-stone-200',
  chip: 'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors '
    + 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none '
    + 'data-[state=inactive]:bg-muted/40 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/70',
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
        className={`h-auto w-fit justify-start gap-1 rounded-none bg-transparent p-0 ${
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
