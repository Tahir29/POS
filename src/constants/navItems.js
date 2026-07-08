// src/constants/navItems.js
//
// Single source of truth for sidebar navigation config. Extracted out of
// Sidebar/index.jsx so other pieces of the shell (e.g. Header's page-title
// lookup) can reuse the same labels instead of maintaining a second,
// duplicate list that could drift out of sync.

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
} from 'lucide-react';

export const NAV_ITEMS = [
  { label: 'Dashboard',    href: '/dashboard',    icon: LayoutDashboard },
  { label: 'Catalog',      href: '/catalog',      icon: ShoppingBag     },
  { label: 'Cart',         href: '/cart',         icon: ShoppingCart    },
  { label: 'Orders',       href: '/orders',       icon: ClipboardList   },
  { label: 'Invoices',     href: '/invoices',     icon: FileText        },
  { label: 'Customers',    href: '/customers',    icon: Users           },
  { label: 'Schemes',      href: '/schemes',      icon: BookOpen        },
  // { label: 'Transfers',    href: '/transfers',    icon: ArrowLeftRight  },
  // { label: 'Reservations', href: '/reservations', icon: Bookmark, comingSoon: true },
  { label: 'Reports',      href: '/reports',      icon: BarChart2       },
];

export const BOTTOM_ITEMS = [
  { label: 'Settings', href: '/settings', icon: Settings },
];
