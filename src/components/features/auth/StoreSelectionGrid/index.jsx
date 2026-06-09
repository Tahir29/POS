'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { LogOut } from 'lucide-react';

import { useActiveStore } from '@/hooks/store/useActiveStore';
import { useAuth } from '@/hooks/auth/useAuth';
import StoreCard from '@/components/features/auth/StoreCard';
import TOAST from '@/constants/toastMessages';

import { Button } from '@/components/ui/button';

/**
 * StoreSelectionGrid
 *
 * Renders all available stores as selectable cards.
 * On selection, sets the active store in Redux and redirects to /dashboard.
 * Also provides a logout option in case the user needs to switch accounts.
 */
export default function StoreSelectionGrid() {
  const router = useRouter();
  const { availableStores, switchStore } = useActiveStore();
  const { logout } = useAuth();
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectStore = async (store) => {
    setIsSelecting(true);
    try {
      switchStore(store);
      const storeName = store.mailing_name ?? 'store';
      toast.success(TOAST.STORE.SWITCHED(storeName));
      router.replace('/dashboard');
    } catch {
      toast.error(TOAST.STORE.LOAD_FAILED);
      setIsSelecting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
            Lucira
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Point of Sale
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-10 shadow-sm">
          <h2 className="mb-2 text-lg font-medium text-neutral-800">
            Select a store
          </h2>
          <p className="mb-6 text-sm text-neutral-500">
            Choose the store you are operating in today.
          </p>

          {/* Store list */}
          {availableStores.length === 0 ? (
            <div className="rounded-lg bg-neutral-50 px-4 py-6 text-center">
              <p className="text-sm text-neutral-500">
                No stores are assigned to your account. Please contact your administrator.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableStores.map((store) => {
                const storeId = store.company_id;
                return (
                  <StoreCard
                    key={storeId}
                    store={store}
                    onSelect={handleSelectStore}
                    isSelecting={isSelecting}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Logout link */}
        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="gap-2 text-neutral-500 hover:text-neutral-700"
          >
            <LogOut size={14} aria-hidden="true" />
            Sign in with a different account
          </Button>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-neutral-400">
          Lucira Jewelry &copy; {new Date().getFullYear()}
        </p>

      </div>
    </div>
  );
}