'use client';

// src/components/features/auth/StoreSelectionGrid/index.jsx
//
// Store selection screen — searchable dropdown replaces the card list.
// Scales cleanly from 1 store to 100+ stores.
// Uses shadcn/ui Command (combobox pattern) for search + select.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { LogOut, ChevronsUpDown, Check, Store } from 'lucide-react';

import { useActiveStore } from '@/hooks/store/useActiveStore';
import Logo from '@/components/shared/Logo';
import { useAuth }        from '@/hooks/auth/useAuth';
import TOAST              from '@/constants/toastMessages';

import { Button }   from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export default function StoreSelectionGrid() {
  const router = useRouter();
  const { availableStores, switchStore } = useActiveStore();
  const { logout } = useAuth();

  const [open, setOpen]           = useState(false);
  const [selected, setSelected]   = useState(null);   // store object
  const [isSelecting, setIsSelecting] = useState(false);

  // ── Confirm selection ─────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!selected || isSelecting) return;
    setIsSelecting(true);
    try {
      switchStore(selected);
      toast.success(TOAST.STORE.SWITCHED(selected.mailing_name ?? 'store'));
      router.replace('/dashboard');
    } catch {
      toast.error(TOAST.STORE.LOAD_FAILED);
      setIsSelecting(false);
    }
  };

  // ── Pick from dropdown ────────────────────────────────────────────────────
  const handleSelect = (store) => {
    setSelected(store);
    setOpen(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <Logo variant="full" width={140} height={44} priority />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card px-8 py-10 shadow-sm">
          <h2 className="mb-1 text-lg font-medium text-neutral-800">
            Select a store
          </h2>
          <p className="mb-6 text-sm text-neutral-500">
            Choose the store you are operating in today.
          </p>

          {availableStores.length === 0 ? (
            <div className="rounded-lg bg-neutral-50 px-4 py-6 text-center">
              <p className="text-sm text-neutral-500">
                No stores are assigned to your account. Please contact your administrator.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">

              {/* Searchable store dropdown */}
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    className="
                      flex w-full items-center justify-between
                      rounded-xl border border-border bg-card
                      px-4 py-3 min-h-[52px]
                      text-sm text-left
                      hover:border-ring
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                      transition-colors
                    "
                  >
                    {selected ? (
                      <span className="flex items-center gap-3">
                        <Store size={16} className="text-accent shrink-0" />
                        <span className="flex flex-col">
                          <span className="font-medium text-neutral-800">
                            {selected.mailing_name}
                          </span>
                          {selected.company_code && (
                            <span className="text-xs text-neutral-400">
                              {selected.company_code}
                            </span>
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className="text-neutral-400">Search or select a store…</span>
                    )}
                    <ChevronsUpDown size={16} className="text-neutral-400 shrink-0 ml-2" />
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                  sideOffset={4}
                >
                  <Command>
                    <CommandInput placeholder="Search stores…" />
                    <CommandList>
                      <CommandEmpty>No stores found.</CommandEmpty>
                      <CommandGroup>
                        {availableStores.map((store) => {
                          const isActive = selected?.company_id === store.company_id;
                          return (
                            <CommandItem
                              key={store.company_id}
                              value={`${store.mailing_name} ${store.company_code ?? ''}`}
                              onSelect={() => handleSelect(store)}
                              className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer"
                            >
                              <span className="flex items-center gap-3">
                                <Store
                                  size={15}
                                  className={isActive ? 'text-accent' : 'text-muted-foreground'}
                                />
                                <span className="flex flex-col">
                                  <span className={`text-sm font-medium ${isActive ? 'text-accent' : 'text-foreground'}`}>
                                    {store.mailing_name}
                                  </span>
                                  {store.company_code && (
                                    <span className="text-xs text-neutral-400">
                                      {store.company_code}
                                    </span>
                                  )}
                                </span>
                              </span>
                              {isActive && (
                                <Check size={15} className="text-accent shrink-0" />
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Confirm button */}
              <Button
                onClick={handleConfirm}
                disabled={!selected || isSelecting}
                className="
                  w-full min-h-[48px] rounded-xl
                  bg-primary hover:bg-primary/90
                  text-primary-foreground font-semibold text-sm
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                {isSelecting ? 'Opening store…' : 'Continue'}
              </Button>

            </div>
          )}
        </div>

        {/* Logout */}
        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut size={14} aria-hidden="true" />
            Sign in with a different account
          </Button>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Lucira Jewelry &copy; {new Date().getFullYear()}
        </p>

      </div>
    </div>
  );
}
