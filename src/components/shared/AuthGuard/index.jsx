'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';

import { selectIsAuthenticated } from '@/store/slices/authSlice';

/**
 * AuthGuard
 *
 * Wraps any client layout or page that requires authentication.
 * Reads isAuthenticated from Redux — if false, redirects to /login.
 * Renders nothing (null) while redirecting to prevent flash of protected content.
 *
 * Usage: wrap the (pos) layout children with this component.
 *
 * @param {{ children: React.ReactNode }} props
 */
export default function AuthGuard({ children }) {
  const router = useRouter();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return children;
}