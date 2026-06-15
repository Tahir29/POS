'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary screen.
 * Rendered by Next.js when an unhandled error occurs within a route segment.
 * Must be a Client Component per Next.js App Router requirements.
 *
 * @param {{ error: Error, reset: Function }} props
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    // Log to console in development — replace with error monitoring in production
    console.error('[Route Error]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8 text-center">
      <AlertTriangle size={48} className="text-destructive" aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          An unexpected error occurred. Try again — if the problem persists, contact support.
        </p>
      </div>
      <Button onClick={reset} className="gap-2">
        <RefreshCw size={16} aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}