'use client';

// src/components/features/auth/StoreSelectionGrid/index.jsx
//
// Store selection screen — searchable dropdown replaces the card list.
// Scales cleanly from 1 store to 100+ stores.
// Uses shadcn/ui Command (combobox pattern) for search + select.
//
// NOTE: The design mockup shows an address/city line under each store
// (e.g. "14 Hill Road, Bandra West, Mumbai"). The store object returned by
// useActiveStore only carries company_id / mailing_name / company_code —
// no address or city field exists on this record — so that line is
// intentionally omitted rather than fabricated. Revisit if OrnaVerse ever
// exposes store address fields.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { LogOut, ChevronsUpDown, Check, CheckCircle2, Store, ArrowRight } from 'lucide-react';

import { useActiveStore } from '@/hooks/store/useActiveStore';
import Logo from '@/components/shared/Logo';
import { useAuth }        from '@/hooks/auth/useAuth';
import TOAST              from '@/constants/toastMessages';

import { Button }   from '@/components/ui/button';
import { Label }    from '@/components/ui/label';
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
    <div className="flex min-h-screen bg-background">

      {/* ── Left — dark brand panel ─────────────────────────────────── */}
      <div className="relative hidden w-2/5 shrink-0 flex-col overflow-hidden bg-primary sm:flex">
        {/* Watermark — real brand icon asset, matches Login treatment */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 right-8 font-heading text-[280px] leading-none opacity-4 select-none"
        >
          <Logo variant="icon" color="white" width={250} height={68} priority />
        </span>

        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Logo variant="full" color="white" width={150} height={48} priority />
          <div className="mt-1 h-px w-10 bg-accent" aria-hidden="true" />

          <div className="mt-4">
            <p className="font-heading text-xl text-primary-foreground/70">Select Your</p>
            <p className="font-heading text-4xl text-primary-foreground">Store</p>
          </div>

          <p className="mt-2 max-w-[220px] text-sm text-primary-foreground/60">
            Choose the showroom you&rsquo;re working from today
          </p>
        </div>
      </div>

      {/* ── Right — store selection panel ───────────────────────────── */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-12">
        <div className="w-full max-w-md">

          {/* Logo shown only when the dark panel is hidden (small screens) */}
          <div className="mb-8 flex justify-center sm:hidden">
            <Logo variant="full" width={130} height={42} priority />
          </div>

          <p className="text-xs font-semibold tracking-[0.15em] text-accent">
            SHOWROOM
          </p>
          <h2 className="mt-2 mb-8 font-heading text-3xl text-foreground">
            Where are you today?
          </h2>

          {availableStores.length === 0 ? (
            <div className="rounded-lg bg-muted px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No stores are assigned to your account. Please contact your administrator.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">

              {/* Searchable store dropdown */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                  Select Store
                </Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-haspopup="listbox"
                      className="
                        flex w-full items-center justify-between
                        rounded-xl border border-input bg-card
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
                            <span className="font-medium text-foreground">
                              {selected.mailing_name}
                            </span>
                            {selected.company_code && (
                              <span className="text-xs text-muted-foreground">
                                {selected.company_code}
                              </span>
                            )}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Search or select a store…</span>
                      )}
                      <ChevronsUpDown size={16} className="text-muted-foreground shrink-0 ml-2" />
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
                                      <span className="text-xs text-muted-foreground">
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
              </div>

              {/* Selected store confirmation card */}
              {selected && (
                <div className="flex items-center justify-between gap-3 rounded-xl border-l-4 border-accent bg-card px-5 py-4 shadow-sm">
                  <div>
                    <p className="font-heading text-base text-foreground">
                      {selected.mailing_name}
                    </p>
                    {selected.company_code && (
                      <p className="mt-0.5 text-xs tracking-wide text-muted-foreground uppercase">
                        {selected.company_code}
                      </p>
                    )}
                  </div>
                  <CheckCircle2 size={20} className="shrink-0 text-accent" aria-hidden="true" />
                </div>
              )}

              {/* Confirm button */}
              <Button
                onClick={handleConfirm}
                variant="premium"
                disabled={!selected || isSelecting}
                className="mt-2 w-full min-h-[48px]"
              >
                {isSelecting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                    Opening store…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Continue to Dashboard
                    <ArrowRight size={16} aria-hidden="true" />
                  </span>
                )}
              </Button>

            </div>
          )}

          {/* Logout — not in the mockup, but kept for wrong-account recovery */}
          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut size={14} aria-hidden="true" />
              Not you? Sign out
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}