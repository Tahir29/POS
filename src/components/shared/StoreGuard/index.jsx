'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';

import { selectActiveStoreId } from '@/store/slices/storeSlice';
import { selectIsAuthenticated } from '@/store/slices/authSlice';

/**
 * StoreGuard
 *
 * Wraps any client layout or page that requires an active store context.
 * Must always be used inside AuthGuard — assumes authentication is already confirmed.
 * If authenticated but no store is selected, redirects to /store-selection.
 * Renders nothing (null) while redirecting to prevent flash of protected content.
 *
 * Usage: wrap the (pos) layout children inside AuthGuard with this component.
 *
 * @param {{ children: React.ReactNode }} props
 */
export default function StoreGuard({ children }) {
  const router = useRouter();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const activeStoreId = useSelector(selectActiveStoreId);

  useEffect(() => {
    if (isAuthenticated && !activeStoreId) {
      router.replace('/store-selection');
    }
  }, [isAuthenticated, activeStoreId, router]);

  if (isAuthenticated && !activeStoreId) {
    return null;
  }

  return children;
}