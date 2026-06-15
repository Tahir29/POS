// src/components/layout/Header/index.jsx
'use client';

import { useState } from 'react';
import { ShoppingCart, User, LogOut, ChevronDown, Store, ChevronRight } from 'lucide-react';
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
import StoreSelectModal from '@/components/features/auth/StoreSelectModal';
import CartDrawer from '@/components/features/cart/CartDrawer';
import HeaderCustomerControl from '@/components/layout/Header/HeaderCustomerControl';
import { cn } from '@/lib/utils';

// ── CART BADGE ────────────────────────────────────────────────

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
      {itemCount > 0 && (
        <span
          className={cn(
            'absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center',
            'rounded-full bg-primary text-primary-foreground text-xs font-bold',
            'pointer-events-none'
          )}
          aria-hidden="true"
        >
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </Button>
  );
}

// ── STORE INDICATOR ───────────────────────────────────────────

/**
 * StoreIndicator
 * Tappable button that opens the in-session store switcher modal.
 * Only shows the chevron when multiple stores are available.
 */
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
        'flex items-center gap-1.5 text-sm text-muted-foreground rounded-lg px-2 py-1.5 min-h-[44px]',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        hasMultipleStores
          ? 'hover:bg-accent hover:text-accent-foreground cursor-pointer'
          : 'cursor-default'
      )}
    >
      <Store size={15} aria-hidden="true" className="shrink-0" />
      <span className="hidden sm:inline truncate max-w-[160px]">
        {activeStoreName ?? '—'}
      </span>
      {hasMultipleStores && (
        <ChevronRight size={13} aria-hidden="true" className="shrink-0 opacity-60" />
      )}
    </button>
  );
}

// ── USER MENU ─────────────────────────────────────────────────

function UserMenu() {
  const { user, logout } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 min-h-[44px] px-3"
          aria-label="User menu"
        >
          <User size={18} aria-hidden="true" />
          <span className="hidden md:inline text-sm font-medium max-w-[120px] truncate">
            {user?.username ?? 'Staff'}
          </span>
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
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

// ── HEADER ────────────────────────────────────────────────────

export default function Header() {
  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <header
        className="flex items-center justify-between border-b bg-card px-4 min-h-[64px] shrink-0"
        role="banner"
      >
        {/* Left — store context */}
        <StoreIndicator onOpen={() => setStoreModalOpen(true)} />

        {/* Right — actions */}
        <div className="flex items-center gap-1">
          <HeaderCustomerControl />
          <CartBadge onOpen={() => setCartOpen(true)} />
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
        onClose={() => setCartOpen(false)}
      />
    </>
  );
}