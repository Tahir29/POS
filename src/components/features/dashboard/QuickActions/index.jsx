'use client';

import { useRouter } from 'next/navigation';
import { ShoppingBag, Users, ClipboardList, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── QUICK ACTION CONFIG ───────────────────────────────────────

/**
 * Central config for all quick-action tiles.
 * Adding a new action = adding one entry here. No JSX changes needed.
 */
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
    id:          'customer-lookup',
    label:       'Customer',
    description: 'Find or create',
    icon:        Users,
    href:        '/customers',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
  {
    id:          'todays-orders',
    label:       "Today's Orders",
    description: 'View & manage',
    icon:        ClipboardList,
    href:        '/orders',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
  {
    id:          'scheme-enroll',
    label:       'Scheme Enroll',
    description: 'Enroll customer',
    icon:        BookOpen,
    href:        '/schemes/enroll',
    accent:      'bg-card text-foreground border border-border hover:bg-accent',
  },
];

// ── QUICK ACTION BUTTON ───────────────────────────────────────

/**
 * QuickActionButton
 *
 * A single tappable tile for a primary POS action.
 * Meets the 44×44px minimum touch target requirement.
 * Uses router.push for navigation (not <Link>) so the component
 * remains fully controllable and testable.
 *
 * @param {{ action: object, onClick: Function }} props
 */
function QuickActionButton({ action, onClick }) {
  const Icon = action.icon;

  return (
    <button
      type="button"
      onClick={() => onClick(action.href)}
      aria-label={`${action.label} — ${action.description}`}
      className={cn(
        // Layout
        'flex flex-col items-center justify-center gap-2',
        'rounded-xl p-4 min-h-[96px] w-full',
        // Transition
        'transition-all duration-150 active:scale-[0.97]',
        // Focus ring
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        // Accent (per-action color)
        action.accent
      )}
    >
      <Icon size={24} aria-hidden="true" className="shrink-0" />
      <div className="text-center">
        <p className="text-sm font-semibold leading-tight">{action.label}</p>
        <p className="text-xs opacity-70 leading-tight mt-0.5">{action.description}</p>
      </div>
    </button>
  );
}

// ── QUICK ACTION GRID ─────────────────────────────────────────

/**
 * QuickActionGrid
 *
 * Renders the 2×2 grid of quick-action tiles for the dashboard.
 * On wider tablets the grid spreads to 4 columns.
 *
 * No props required — all config comes from QUICK_ACTIONS above.
 */
export default function QuickActionGrid() {
  const router = useRouter();

  const handleNavigate = (href) => {
    router.push(href);
  };

  return (
    <section aria-labelledby="quick-actions-heading">
      <h2
        id="quick-actions-heading"
        className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3"
      >
        Quick Actions
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
