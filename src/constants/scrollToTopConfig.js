// src/constants/scrollToTopConfig.js
// Pages where the ScrollToTopButton is shown. Add new routes here as
// long-scrolling pages are built — no changes needed to the component
// itself.
//
// Each entry is a pathname prefix (matched via startsWith), so dynamic
// routes (e.g. /products/[itemId]) are covered by their base path.

export const SCROLL_TO_TOP_PAGES = [
  '/catalog',
  '/products',   // covers /products/[itemId] (product detail)
  '/invoices',
  '/customers',
];

/**
 * @param {string} pathname - current route pathname (from usePathname)
 * @returns {boolean}
 */
export function isScrollToTopEnabled(pathname) {
  if (!pathname) return false;
  return SCROLL_TO_TOP_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`)
  );
}