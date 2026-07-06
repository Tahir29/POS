'use client';

import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  RotateCcw,
  ArrowLeftRight,
  Gem,
  Coins,
  BookOpen,
  ClipboardCheck,
  BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── QUICK ACTION CONFIG ───────────────────────────────────────
//
// Expanded from 4 to 8 tiles to match the new dashboard design and the
// already-agreed dashboard plan (post-sale modules: returns, exchange,
// buyback, URD purchase, scheme payment, day close). All routes below
// were confirmed to already exist in src/app/(pos)/ before wiring —
// no new pages required.
//
// "Scheme Payment" links to /schemes (no dedicated payment sub-route
// exists yet) rather than /schemes/enroll, since paying an existing
// enrollment is a different action from enrolling a new one.

const QUICK_ACTIONS = [
  {
    id:          'new-sale',
    label:       'New Sale',
    description: 'Browse catalog',
    icon:        ShoppingBag,
    href:        '/catalog',
    accent:      'bg-primary text-primary-foreground hover:bg-primary/90',
  },
  {
    id:          'new-return',
    label:       'New Return',
    description: 'Process a return',
    icon:        RotateCcw,
    href:        '/returns',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
  {
    id:          'exchange',
    label:       'Exchange',
    description: 'Item exchange',
    icon:        ArrowLeftRight,
    href:        '/exchange',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
  {
    id:          'buyback',
    label:       'Buyback',
    description: 'Buy from customer',
    icon:        Gem,
    href:        '/buyback',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
  {
    id:          'urd-purchase',
    label:       'URD Purchase',
    description: 'Record purchase',
    icon:        Coins,
    href:        '/urd-purchase',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
  {
    id:          'scheme-payment',
    label:       'Scheme Payment',
    description: 'Collect instalment',
    icon:        BookOpen,
    href:        '/schemes',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
  {
    id:          'day-close',
    label:       'Day Close',
    description: 'Close today',
    icon:        ClipboardCheck,
    href:        '/daily-closing',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
  {
    id:          'reports',
    label:       'Reports',
    description: 'View reports',
    icon:        BarChart2,
    href:        '/reports',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
];

// ── QUICK ACTION BUTTON ───────────────────────────────────────

function QuickActionButton({ action, onClick }) {
  const Icon = action.icon;

  return (
    <button
      type="button"
      onClick={() => onClick(action.href)}
      aria-label={`${action.label} — ${action.description}`}
      className={cn(
        'flex flex-col items-center justify-center gap-1.5',
        'rounded-lg p-2.5 min-h-[76px] w-full',
        'transition-all duration-150 active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        action.accent
      )}
    >
      <Icon size={18} aria-hidden="true" className="shrink-0" />
      <div className="text-center">
        <p className="text-[11px] font-semibold leading-tight">{action.label}</p>
      </div>
    </button>
  );
}

// ── QUICK ACTION GRID ─────────────────────────────────────────

export default function QuickActionGrid() {
  const router = useRouter();

  const handleNavigate = (href) => {
    router.push(href);
  };

  return (
    <section aria-labelledby="quick-actions-heading" className="rounded-xl border border-border bg-card p-5">
      <h2
        id="quick-actions-heading"
        className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3"
      >
        Quick Actions
      </h2>

      <div className="grid grid-cols-4 gap-2.5">
        {QUICK_ACTIONS.map((action) => (
          <QuickActionButton
            key={action.id}
            action={action}
            onClick={handleNavigate}
          />
        ))}
      </div>
    </section>
  );
}