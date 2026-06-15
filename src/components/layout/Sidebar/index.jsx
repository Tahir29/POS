'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/shared/Logo';
import {
  LayoutDashboard,
  ShoppingBag,
  ShoppingCart,
  Users,
  ClipboardList,
  FileText,
  BookOpen,
  ArrowLeftRight,
  Bookmark,
  Settings,
  BarChart2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/ui/useSidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';



// ── Nav config ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Dashboard',    href: '/dashboard',    icon: LayoutDashboard },
  { label: 'Catalog',      href: '/catalog',      icon: ShoppingBag     },
  { label: 'Cart',         href: '/cart',         icon: ShoppingCart    },
  { label: 'Orders',       href: '/orders',       icon: ClipboardList   },
  { label: 'Invoices',     href: '/invoices',     icon: FileText        },
  { label: 'Customers',    href: '/customers',    icon: Users           },
  { label: 'Schemes',      href: '/schemes',      icon: BookOpen        },
  { label: 'Transfers',    href: '/transfers',    icon: ArrowLeftRight  },
  { label: 'Reservations', href: '/reservations', icon: Bookmark        },
  { label: 'Reports',      href: '/reports',      icon: BarChart2       },
];

const BOTTOM_ITEMS = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

// ── SidebarNavItem ────────────────────────────────────────────────────────────

function SidebarNavItem({ item, collapsed }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;

  const linkContent = (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        isActive
          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        collapsed && 'justify-center px-2'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon size={20} aria-hidden="true" className="shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right">
          <p>{item.label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { sidebarOpen, toggle } = useSidebar();

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out shrink-0',
        sidebarOpen ? 'w-56' : 'w-16'
      )}
      aria-label="Main navigation"
    >
      {/* ── Logo ─────────────────────────────────────────── */}
      <div
        className={cn(
          'flex items-center border-b border-sidebar-border min-h-[64px]',
          sidebarOpen ? 'px-4 gap-3' : 'justify-center px-2'
        )}
      >
        {sidebarOpen ? (
          <Logo variant="full" color="white" height={32} width={110} />
        ) : (
          <Logo variant="icon" color="white" height={24} width={24} />
        )}
      </div>

      {/* ── Main Nav ─────────────────────────────────────── */}
      <nav
        className="flex flex-col gap-1 flex-1 overflow-y-auto p-2"
        aria-label="Primary"
      >
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem key={item.href} item={item} collapsed={!sidebarOpen} />
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* ── Bottom Nav ───────────────────────────────────── */}
      <nav className="flex flex-col gap-1 p-2" aria-label="Secondary">
        {BOTTOM_ITEMS.map((item) => (
          <SidebarNavItem key={item.href} item={item} collapsed={!sidebarOpen} />
        ))}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* ── Collapse toggle ───────────────────────────────── */}
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className={cn(
            'w-full min-h-[44px] text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent',
            !sidebarOpen && 'px-0 justify-center'
          )}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? (
            <span className="flex items-center gap-2">
              <ChevronLeft size={16} aria-hidden="true" />
              <span className="text-xs">Collapse</span>
            </span>
          ) : (
            <ChevronRight size={16} aria-hidden="true" />
          )}
        </Button>
      </div>
    </aside>
  );
}
