'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'motion/react';
import { ShoppingCart, LogOut, ChevronDown, Store, ArrowLeft, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/auth/useAuth';
import { useActiveStore } from '@/hooks/store/useActiveStore';
import { useCartItemCount } from '@/hooks/cart/useCartItemCount';
import { useSmartBack } from '@/hooks/navigation/useSmartBack';
import { useSidebar } from '@/hooks/ui/useSidebar';
import { openCart, closeCart, selectCartOpen } from '@/store/slices/uiSlice';
import StoreSelectModal from '@/components/features/auth/StoreSelectModal';
import CartDrawer from '@/components/features/cart/CartDrawer';
import HeaderCustomerControl from '@/components/layout/Header/HeaderCustomerControl';
import { NAV_ITEMS, BOTTOM_ITEMS } from '@/constants/navItems';
import { cn } from '@/lib/utils';
import { EASE_PREMIUM, DURATION } from '@/lib/motion';

// Derives the header title from the SAME NAV_ITEMS/BOTTOM_ITEMS the
// Sidebar uses — no second hardcoded label list to keep in sync.
// Routes not present in nav config (e.g. detail/sub-pages) fall back
// to a capitalized version of the last path segment.

const ALL_NAV_ITEMS = [...NAV_ITEMS, ...BOTTOM_ITEMS];

function usePageTitle() {
  const pathname = usePathname();

  // Dynamic routes not covered by NAV_ITEMS — checked before the generic
  // fallback so we don't show a raw numeric ID as the page title.
  if (pathname.startsWith('/products/')) return 'Product Detail';

  const match = ALL_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );
  if (match) return match.label;

  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1] ?? 'Lucira POS';
  return last
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function CartBadge({ onOpen }) {
  const itemCount = useCartItemCount();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative min-h-[44px] min-w-[44px]"
      onClick={onOpen}
      aria-label={`Cart — ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
    >
      <ShoppingCart size={20} aria-hidden="true" />
      <AnimatePresence>
        {itemCount > 0 && (
          <motion.span
            key={itemCount > 99 ? '99+' : itemCount}
            className={cn(
              'absolute -top-0.5 -right-1 flex h-5 w-5 items-center justify-center',
              'rounded-full bg-primary text-primary-foreground text-xs font-bold',
              'pointer-events-none'
            )}
            aria-hidden="true"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ duration: DURATION.micro, ease: EASE_PREMIUM }}
          >
            {itemCount > 99 ? '99+' : itemCount}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}

function StoreIndicator({ onOpen }) {
  const { activeStoreName, availableStores } = useActiveStore();
  const hasMultipleStores = availableStores.length > 1;

  return (
    <button
      type="button"
      onClick={hasMultipleStores ? onOpen : undefined}
      aria-label={
        hasMultipleStores
          ? `Active store: ${activeStoreName ?? 'None'}. Tap to switch.`
          : `Active store: ${activeStoreName ?? 'None'}`
      }
      className={cn(
        'flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 min-h-[44px]',
        'text-sm font-medium text-foreground transition-colors duration-standard ease-premium',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        hasMultipleStores ? 'hover:bg-accent hover:shadow-sm cursor-pointer' : 'cursor-default'
      )}
    >
      <Store size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      {/* Text hidden below 1200px (2026-08-23) — icon-only at tablet width,
          where this sits alongside HeaderCustomerControl/CartBadge/UserMenu
          in a fixed-width row that doesn't have room for the full store
          name; was previously just `sm:inline` (640px), wide enough that
          the header's action cluster still overflowed on real tablet
          viewports. min-[1200px] is an arbitrary Tailwind breakpoint, not
          one of the named sm/md/lg/xl ones — chosen to match this specific
          overflow point, not a new app-wide breakpoint. */}
      <span className="hidden min-[1200px]:inline truncate max-w-[140px]">
        {activeStoreName ?? '—'}
      </span>
      {hasMultipleStores && (
        <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

// Trigger shows a circular initials avatar (matches the dashboard redesign
// reference) instead of a generic person icon — still the same DropdownMenu
// underneath, sign-out functionality unchanged.

function getInitial(name) {
  return name?.trim()?.[0]?.toUpperCase() ?? '?';
}

function UserMenu() {
  const { user, logout } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary transition-colors duration-standard ease-premium hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`User menu — signed in as ${user?.username ?? 'Staff'}`}
        >
          {getInitial(user?.username)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Signed in as <span className="truncate">{user?.username ?? 'Staff'}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="text-destructive focus:text-white cursor-pointer"
        >
          <LogOut size={15} aria-hidden="true" className="mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Header() {
  const dispatch = useDispatch();
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const cartOpen = useSelector(selectCartOpen);
  const pageTitle = usePageTitle();
  const { canGoBack, goBack } = useSmartBack();
  const { toggle: toggleSidebar } = useSidebar();

  return (
    <>
      <header
        className="flex items-center justify-between gap-4 border-b bg-card px-4 min-h-[64px] shrink-0"
        role="banner"
      >
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label="Toggle navigation menu"
            className="min-h-[40px] min-w-[40px] shrink-0 md:hidden"
          >
            <Menu size={18} aria-hidden="true" />
          </Button>
          {canGoBack && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goBack}
              aria-label="Go back"
              className="min-h-[40px] min-w-[40px] shrink-0"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Button>
          )}
          <h1 className="font-heading text-xl text-foreground truncate">
            {pageTitle}
          </h1>
        </div>

        {/* Spacer — pushes the action cluster to the right on wide screens */}
        <div className="hidden flex-1 md:block" />

        <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
          <HeaderCustomerControl />
          <CartBadge onOpen={() => dispatch(openCart())} />
          <StoreIndicator onOpen={() => setStoreModalOpen(true)} />
          <UserMenu />
        </div>
      </header>

      {/* Store switcher modal — rendered outside header flow */}
      <StoreSelectModal
        isOpen={storeModalOpen}
        onClose={() => setStoreModalOpen(false)}
      />

      {/* Cart drawer — rendered outside header flow, available on every POS screen */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => dispatch(closeCart())}
      />
    </>
  );
}