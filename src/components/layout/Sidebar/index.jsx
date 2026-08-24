'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/shared/Logo';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/ui/useSidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { NAV_ITEMS, BOTTOM_ITEMS } from '@/constants/navItems';

function SidebarNavItem({ item, collapsed, onNavigate }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;

  const linkContent = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-standard ease-premium min-h-[44px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        isActive
          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        collapsed && 'justify-center px-2'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon size={20} aria-hidden="true" className="shrink-0" />
      {!collapsed && (
        <span className='flex items-center gap-2 truncate'>
          <span className='truncate'>{item.label}</span>
          {item.comingSoon && (
            <span className="shrink-0 rounded-full bg-sidebar-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-sidebar-foreground/60">Soon</span>
          )}
        </span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right">
          <p>{item.label}{item.comingSoon ? ' (Coming Soon)' : ''}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

export default function Sidebar() {
  const { sidebarOpen, toggle, close } = useSidebar();

  // Below `md`, sidebarOpen doubles as "mobile drawer visible" — the drawer
  // is either fully off-canvas or fully open with labels, never icon-only.
  // At `md` and up it keeps its original meaning: expanded (w-56) vs
  // collapsed-to-icons (w-16), always visible either way.
  const collapsed = !sidebarOpen;

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'flex flex-col border-r border-sidebar-border bg-sidebar shadow-lg shrink-0',
          'fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'md:relative md:inset-auto md:z-auto md:translate-x-0 md:transition-[width] md:duration-300 md:ease-in-out',
          sidebarOpen ? 'md:w-56' : 'md:w-16'
        )}
        aria-label="Main navigation"
      >
        <div
          className={cn(
            'flex items-center border-b border-sidebar-border min-h-[64px] px-4 gap-3',
            !sidebarOpen && 'md:justify-center md:px-2'
          )}
        >
          <span className={cn(!sidebarOpen && 'md:hidden')}>
            <Logo variant="full" color="white" height={32} width={110} />
          </span>
          <span className={cn('hidden', !sidebarOpen && 'md:inline')}>
            <Logo variant="icon" color="white" height={24} width={24} />
          </span>
        </div>

        <nav
          className="flex flex-col gap-1 flex-1 overflow-y-auto p-2"
          aria-label="Primary"
        >
          {NAV_ITEMS.map((item) => (
            <SidebarNavItem key={item.href} item={item} collapsed={collapsed} onNavigate={close} />
          ))}
        </nav>

        <Separator className="bg-sidebar-border" />

        <nav className="hidden flex-col gap-1 p-2" aria-label="Secondary">
          {BOTTOM_ITEMS.map((item) => (
            <SidebarNavItem key={item.href} item={item} collapsed={collapsed} onNavigate={close} />
          ))}
        </nav>

        <Separator className="bg-sidebar-border" />

        {/* ── Collapse toggle — collapses to icon-rail at md+, closes the drawer below md ── */}
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={cn(
              'w-full min-h-[44px] text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent',
              !sidebarOpen && 'md:px-0 md:justify-center'
            )}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <span className={cn('flex items-center gap-2', !sidebarOpen && 'md:hidden')}>
              <ChevronLeft size={16} aria-hidden="true" />
              <span className="text-xs">Collapse</span>
            </span>
            <span className={cn('hidden', !sidebarOpen && 'md:inline')}>
              <ChevronRight size={16} aria-hidden="true" />
            </span>
          </Button>
        </div>
      </aside>
    </>
  );
}
