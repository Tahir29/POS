// src/lib/catalogSort.js
//
// Shared sort logic for the catalog grid and the "Available at other
// stores" section, so both stay in sync via one comparator.

export function getWeight(product) {
  return product.net_weight ?? product.weight ?? 0;
}

export function getPrice(product) {
  return product.price ?? null;
}

/**
 * Shared comparator for both search-mode and browse-mode sorting.
 * Items with no price always sort after priced ones, regardless of
 * ascending/descending direction.
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
 * THE ONLY sort step, for both browse and search mode (and the other-stores
 * lane), applied ONCE — after live prices are merged in. Must only run
 * after a price has been merged onto each row, or price_asc/price_desc
 * becomes a no-op (comparing null against null).
 */
export function sortProducts(products, sortBy) {
  return [...products].sort((a, b) => compareProducts(a, b, sortBy));
}

/**
 * Keeps already-rendered cards frozen in place across pagination/price
 * updates, instead of re-sorting the full accumulated list (which would
 * interleave each newly-fetched page's rows in among cards already on
 * screen, snapping everything below the insertion point to a new position).
 * name/weight are static from the first fetch, so an already-rendered
 * card's position should never change under those sorts — only under
 * price_asc/price_desc is a card allowed to move, when its price settles
 * from unresolved to real after it's already on screen.
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

  // A newly-fetched page's rows — sorted among themselves (and any
  // just-settled rows) and appended AFTER the frozen prefix, never spliced
  // into the middle of it.
  const brandNew = nextItems.filter((p) => !carriedIds.has(p.item_id));
  const appended = [...resettling, ...brandNew].sort((a, b) => compareProducts(a, b, sortBy));

  return [...frozen, ...appended];
}
