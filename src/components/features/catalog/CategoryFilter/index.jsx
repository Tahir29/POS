'use client';

// src/components/features/catalog/CategoryFilter/index.jsx
// Horizontal scrolling category chip bar.
// Active chip: filled dark brown (primary). Inactive: outlined pill.
// Matches target UI design exactly.

const ALLOWED_CATEGORIES = [
  'Rings',
  'Earrings',
  'Bangles',
  'Bracelets',
  'Necklaces',
  'Pendants',
  'Mangalsutra',
  'Bestsellers',
];

function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

// ── CategoryChip ──────────────────────────────────────────────────────────────

function CategoryChip({ label, isActive, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={[
        'shrink-0 min-h-[36px] px-5 py-1.5 rounded-full text-sm font-medium',
        'border transition-all duration-150 whitespace-nowrap',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        isActive
          ? 'bg-primary border-primary text-white shadow-sm'
          : 'bg-white border-border text-stone-600 hover:border-primary/50 hover:text-primary',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ── CategoryFilter ────────────────────────────────────────────────────────────

/**
 * @param {object}      props
 * @param {object[]}    props.categories          - Raw API categories array
 * @param {string|null} props.activeCategorySlug  - Active slug from URL
 * @param {boolean}     props.hasActiveFilters    - Whether any filter is active
 * @param {function}    props.onSelectCategory    - Called with slug or null
 * @param {function}    props.onClearFilters      - Clears all filters
 */
export default function CategoryFilter({
  categories = [],
  activeCategorySlug,
  hasActiveFilters,
  onSelectCategory,
  onClearFilters,
}) {
  const visibleCategories = ALLOWED_CATEGORIES
    .map((allowedName) => {
      const allowed = allowedName.toLowerCase();
      const match = categories.find((c) => {
        const apiName = c.type_name?.toLowerCase() ?? '';
        if (apiName === allowed) return true;
        if (apiName.startsWith(allowed)) return true;
        return false;
      });
      return match ? { ...match, displayName: allowedName } : null;
    })
    .filter(Boolean);

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">

      {/* ALL chip */}
      <CategoryChip
        label="ALL"
        isActive={!activeCategorySlug}
        onClick={() => onSelectCategory(null)}
      />

      {/* Category chips */}
      {visibleCategories.map((cat) => {
        const slug     = toSlug(cat.displayName);
        const isActive = activeCategorySlug === slug;
        return (
          <CategoryChip
            key={cat.type_id}
            label={cat.displayName.toUpperCase()}
            isActive={isActive}
            onClick={() => onSelectCategory(isActive ? null : slug)}
          />
        );
      })}

      {/* Clear filters — only when a non-category filter is active */}
      {hasActiveFilters && activeCategorySlug && (
        <>
          <div className="w-px h-5 bg-border shrink-0 mx-1" aria-hidden="true" />
          <button
            type="button"
            onClick={onClearFilters}
            className="shrink-0 min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring whitespace-nowrap"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}