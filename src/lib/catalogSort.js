// src/lib/catalogSort.js
//
// Extracted from catalog/page.jsx (2026-08-24) so the "Available at other
// stores" section (OtherStoreSection) can sort its own list the exact same
// way the primary catalog grid does, instead of drifting out of sync with a
// second, hand-copied comparator.

export function getWeight(product) {
  return product.net_weight ?? product.weight ?? 0;
}

export function getPrice(product) {
  return product.price ?? null;
}

/**
 * Shared comparator for both search-mode and browse-mode sorting.
 * Items with no price (not every product has one — see
 * catalogService.enrichWithPrice) always sort after priced ones,
 * regardless of ascending/descending direction.
 */
export function compareProducts(a, b, sortBy) {
  switch (sortBy) {
    case 'name_asc':  return (a.item_name ?? '').localeCompare(b.item_name ?? '');
    case 'name_desc': return (b.item_name ?? '').localeCompare(a.item_name ?? '');
    case 'price_asc':
    case 'price_desc': {
      const pa = getPrice(a);
      const pb = getPrice(b);
      if (pa == null && pb == null) return 0;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return sortBy === 'price_asc' ? pa - pb : pb - pa;
    }
    case 'weight_asc':  return getWeight(a) - getWeight(b);
    case 'weight_desc': return getWeight(b) - getWeight(a);
    default: return 0;
  }
}

/**
 * THE ONLY sort step, for both browse and search mode (and now the
 * other-stores lane too), applied ONCE — after live prices are merged in.
 * Sorting unpriced rows straight off the catalog/inventory endpoints made
 * price_asc/price_desc a no-op (comparing null against null); this must
 * only ever run after a price has been merged onto each row.
 */
export function sortProducts(products, sortBy) {
  return [...products].sort((a, b) => compareProducts(a, b, sortBy));
}

/**
 * FIXED 2026-09-04 — the "infinite scroll jump" bug: catalog/page.jsx used
 * to run sortProducts() above over the FULL accumulated list on every
 * change to pricedDisplayProducts, including every new page fetchNextPage()
 * pulled in. Under name_asc (the default) or weight_*, a freshly-fetched
 * page's items are NOT alphabetically/weight-adjacent to the ones already
 * on screen — the server returns pages in its own order, not pre-sorted —
 * so a full re-sort INTERLEAVES the new page's rows in among the ones the
 * operator was already scrolling past, snapping every card below the
 * insertion point to a new position. Confirmed: name/weight are static
 * fields known from the very first fetch, so nothing about an
 * already-rendered card's sort key can legitimately change later — any
 * reordering of it is pure pagination noise, never a real correction.
 *
 * Price is the one exception: a still-pricing card's price genuinely
 * resolves asynchronously after the card is already on screen (see
 * compareProducts' own price-branch comment on why that settle-into-place
 * behaviour is intentional there). So under price_asc/price_desc, a card
 * whose price just went from unresolved to real is deliberately allowed to
 * move — everything else stays frozen in its last rendered position.
 *
 * @param {object[]} prevOrder — this function's own return value from the
 *   last call (or [] on first render / whenever the caller decides to reset
 *   — e.g. sortBy, filters, or store changed and a fresh sort is actually
 *   wanted).
 * @param {object[]} nextItems — the latest full, unsorted, possibly-larger
 *   list (this is pricedDisplayProducts in catalog/page.jsx — SAME items as
 *   before plus whatever the newest page/price update added).
 * @param {string} sortBy
 * @returns {object[]} the next stable order — pass this back in as
 *   `prevOrder` on the following call.
 */
export function stableSortProducts(prevOrder, nextItems, sortBy) {
  const isPriceSort = sortBy === 'price_asc' || sortBy === 'price_desc';
  const nextById = new Map(nextItems.map((p) => [p.item_id, p]));

  // Carry over everything still present, in EXACTLY its previous relative
  // order — unless (price sort only) this item's price just settled from
  // null to a real number, in which case it's held back to be re-inserted
  // in sorted position below, same as a brand-new row would be.
  const frozen = [];
  const resettling = [];
  const carriedIds = new Set();

  for (const prevItem of prevOrder) {
    const fresh = nextById.get(prevItem.item_id);
    if (!fresh) continue; // no longer in the list at all (e.g. OOS toggle) — drop it
    carriedIds.add(fresh.item_id);
    const justSettled = isPriceSort && getPrice(prevItem) == null && getPrice(fresh) != null;
    (justSettled ? resettling : frozen).push(fresh);
  }

  // Whatever's in nextItems that wasn't already accounted for above — a
  // newly-fetched page's rows. Sorted among themselves (and any
  // just-settled rows) and appended AFTER the frozen prefix, never spliced
  // into the middle of it.
  const brandNew = nextItems.filter((p) => !carriedIds.has(p.item_id));
  const appended = [...resettling, ...brandNew].sort((a, b) => compareProducts(a, b, sortBy));

  return [...frozen, ...appended];
}
