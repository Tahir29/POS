'use client'

import { TooltipProvider } from '@/components/ui/tooltip';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import PageLoader from '@/components/shared/PageLoader';
import ScrollToTopButton from '@/components/shared/ScrollToTopButton';

/**
 * AppShell — the root layout wrapper for all operational POS screens.
 * Composes: Sidebar (left) + right column (Header on top, main content below).
 * TooltipProvider wraps the entire shell so Sidebar tooltips (collapsed state) work correctly.
 */
export default function AppShell({ children }) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main
            className="flex-1 overflow-y-auto"
            id="main-content"
            role="main"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
        <PageLoader />
        <ScrollToTopButton />
      </div>
    </TooltipProvider>
  );
}