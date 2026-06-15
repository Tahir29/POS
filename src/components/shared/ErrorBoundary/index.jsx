// src/components/shared/ErrorBoundary/index.jsx
'use client';

import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ErrorBoundary
 *
 * A React class-based error boundary that catches unhandled JS errors
 * in the component subtree and displays a fallback UI instead of
 * crashing the entire app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 * With custom fallback:
 *   <ErrorBoundary fallback={<p>Custom error UI</p>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 * NOTE: React error boundaries must be class components — hooks cannot
 * implement componentDidCatch. This is the only class component in the
 * codebase; all others are functional components.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Replace with error monitoring (e.g. Sentry) in production
    console.error('[ErrorBoundary caught]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Allow consumer to supply a fully custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center">
          <AlertTriangle
            size={40}
            className="text-destructive"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              An unexpected error occurred in this section. You can try
              again or refresh the page.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={this.handleReset}
            className="gap-2"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}