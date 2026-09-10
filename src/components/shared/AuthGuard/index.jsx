'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';

import { selectIsAuthenticated } from '@/store/slices/authSlice';

// Wraps a client layout/page that requires authentication. Redirects to
// /login when Redux's isAuthenticated is false, rendering nothing in the
// meantime to avoid a flash of protected content.
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