// src/lib/productFlip.js
//
// Cross-route shared-element state for the Product Card → Product Detail
// transition (Phase 2 Step C, Priority 1).
//
// Next.js unmounts the catalog page entirely before the product detail page
// mounts — the two never coexist in the DOM the way a single-page shared
// layout would let them. So the classic "read the DOM, mutate it, animate
// from the old state" GSAP Flip pattern doesn't directly apply; instead the
// CARD captures `Flip.getState()` (a plain snapshot of rect + the tracked
// style props, not a live element reference) for its own image right before
// navigating, stashes it here, and the DETAIL page reads it back once its
// own hero image mounts and plays `Flip.from(state, { targets: heroEl })`
// against it. This is the standard cross-route variant of Flip — see
// ProductCard.handleTap / ProductDetailScreen's flip effect for the two ends.
//
// HARD CONSTRAINT (locked 2026-08, do not relax): navigation must NEVER
// depend on this resolving. Capturing state is a synchronous, cheap DOM
// read (getBoundingClientRect under the hood) — router.push() in the card
// fires immediately after, never awaiting anything here or the dynamic
// gsap import that precedes it. If the detail page finds nothing (direct
// URL nav, refresh, back/forward, a slow first-ever gsap chunk load that
// lost the race, or simply a different item), it renders with no
// transition at all — that IS the graceful fallback, not an error path.

let pending = null; // { itemId, state, capturedAt }

// A stashed state older than this almost certainly belongs to an abandoned
// or superseded navigation (e.g. the operator tapped a card, then tapped a
// different one before the first one's page ever mounted) — playing a
// transition from a stale rect would be actively wrong, so it's simply
// dropped rather than replayed.
const MAX_AGE_MS = 4000;

/**
 * Called from ProductCard right before router.push(), while its image is
 * still mounted. Best-effort — any failure here just means no transition
 * plays, never a thrown error visible to the operator.
 *
 * @param {number|string} itemId
 * @param {HTMLElement} element — the card's image container
 * @param {object} Flip — the gsap/Flip module (caller already imported it)
 */
export function captureCardFlipState(itemId, element, Flip) {
  if (!element || itemId == null) return;
  try {
    const state = Flip.getState(element, { props: 'borderRadius' });
    pending = { itemId: String(itemId), state, capturedAt: Date.now() };
  } catch {
    pending = null;
  }
}

/**
 * Called once from the product detail page after its hero image mounts.
 * One-shot: consuming a state (fresh or not) always clears it, so a stale
 * or already-used capture can never be replayed on a later visit.
 *
 * @param {number|string} itemId
 * @returns {object|null} the Flip state to animate from, or null if there's
 *   nothing usable (wrong item, too old, or nothing was ever captured).
 */
export function consumeCardFlipState(itemId) {
  const captured = pending;
  pending = null;
  if (!captured || itemId == null) return null;
  if (captured.itemId !== String(itemId)) return null;
  if (Date.now() - captured.capturedAt > MAX_AGE_MS) return null;
  return captured.state;
}
