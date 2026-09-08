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
  FileSpreadsheet,
  BookOpen,
  ArrowLeftRight,
  Bookmark,
  Settings,
  Wrench,
  Footprints,
} from 'lucide-react';

export const NAV_ITEMS = [
  { label: 'Dashboard',    href: '/dashboard',    icon: LayoutDashboard },
  { label: 'Catalog',      href: '/catalog',      icon: ShoppingBag     },
  { label: 'Cart',         href: '/cart',         icon: ShoppingCart    },
  { label: 'Orders',       href: '/orders',       icon: ClipboardList   },
  { label: 'Invoices',     href: '/invoices',     icon: FileText        },
  { label: 'Transactions', href: '/transactions', icon: ArrowLeftRight  },
  { label: 'Repair',       href: '/repair',       icon: Wrench          },
  { label: 'Estimation',   href: '/estimation',   icon: FileSpreadsheet },
  { label: 'Customers',    href: '/customers',    icon: Users           },
  { label: 'Schemes',      href: '/schemes',      icon: BookOpen        },
  // ADDED 2026-09-08 — our own walk-in log (see lib/mongo/walkins.js's
  // header for why this exists instead of an OrnaVerse endpoint).
  { label: 'Walk-ins',     href: '/walkins',      icon: Footprints      },
];

export const BOTTOM_ITEMS = [
  { label: 'Settings', href: '/settings', icon: Settings },
];
