'use client';

import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  RotateCcw,
  ArrowLeftRight,
  Gem,
  Coins,
  CreditCard,
  FileText,
  BookOpen,
  ClipboardCheck,
  BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── QUICK ACTION CONFIG ───────────────────────────────────────
//
// PHASE 22.5 — all six transaction types (Returns, Refunds, Credit Notes,
// Exchange, Buyback, URD Purchase) now live as tabs on the single
// /transactions page, which supports deep-linking via ?tab=<id>. The
// previously-separate /returns, /exchange, /buyback, /urd-purchase pages
// have been deleted, so these tiles route there instead. Refunds and
// Credit Notes are new tiles — they had no create UI anywhere before.

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
    href:        '/transactions?tab=returns',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
  {
    id:          'refund',
    label:       'Refund',
    description: 'Refund customer',
    icon:        CreditCard,
    href:        '/transactions?tab=refunds',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
  {
    id:          'credit-note',
    label:       'Credit Note',
    description: 'Issue store credit',
    icon:        FileText,
    href:        '/transactions?tab=credit-notes',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
  {
    id:          'exchange',
    label:       'Exchange',
    description: 'Item exchange',
    icon:        ArrowLeftRight,
    href:        '/transactions?tab=exchange',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
  {
    id:          'buyback',
    label:       'Buyback',
    description: 'Buy from customer',
    icon:        Gem,
    href:        '/transactions?tab=buyback',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
  {
    id:          'urd-purchase',
    label:       'URD Purchase',
    description: 'Record purchase',
    icon:        Coins,
    href:        '/transactions?tab=urd',
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