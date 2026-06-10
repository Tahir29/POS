'use client';

// src/components/features/catalog/CategoryFilter/index.jsx

// Only these names are shown in the filter bar.
// Partial match used — "Mangalsutra" will match "Mangalsutra Chains" etc.
// To add more: just add the name to this list.
const ALLOWED_CATEGORIES = [
  'Rings',
  'Earrings',
  'Bangles',
  'Bracelets',
  'Necklaces',
  'Mangalsutra',
  'Bestsellers',
];

// Converts a category name to a URL slug
// e.g. "Mangalsutra Chains" → "mangalsutra-chains"
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
        'shrink-0 min-h-[36px] px-4 py-1.5 rounded-full text-sm font-medium',
        'border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        isActive
          ? 'bg-primary border-primary text-primary-foreground shadow-sm'
          : 'bg-card border-border text-muted-foreground hover:border-accent hover:text-accent',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ── CategoryFilter ────────────────────────────────────────────────────────────

export default function CategoryFilter({
  categories        = [],
  activeCategorySlug,
  hasActiveFilters,
  onSelectCategory,
  onClearFilters,
}) {
  // Match each allowed name against API categories using partial/includes match.
  // "Mangalsutra" will match "Mangalsutra Chains", "Mangalsutra Set" etc.
  const visibleCategories = ALLOWED_CATEGORIES
  .map((allowedName) => {
    const allowed = allowedName.toLowerCase();
    const match = categories.find((c) => {
      const apiName = c.type_name?.toLowerCase() ?? '';
      // Exact match first
      if (apiName === allowed) return true;
      // StartsWith — "mangalsutra" matches "mangalsutra chains"
      if (apiName.startsWith(allowed)) return true;
      return false;
    });
    return match ? { ...match, displayName: allowedName } : null;
  })
  .filter(Boolean);

  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 py-2.5 md:px-6 scrollbar-none">

      {/* All */}
      <CategoryChip
        label="All"
        isActive={activeCategorySlug === null}
        onClick={() => onSelectCategory(null)}
      />

      {/* Allowed category chips */}
      {visibleCategories.map((cat) => {
        // Use our clean display name for the slug, not the full API name
        // So "Mangalsutra Chains" → slug is "mangalsutra" not "mangalsutra-chains"
        const slug     = toSlug(cat.displayName);
        const isActive = activeCategorySlug === slug;

        return (
          <CategoryChip
            key={cat.type_id}
            label={cat.displayName}
            isActive={isActive}
            onClick={() => onSelectCategory(isActive ? null : slug)}
          />
        );
      })}

      {/* Spacer */}
      <div className="flex-1 min-w-[8px]" aria-hidden="true" />

      {/* Clear */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="
            shrink-0 min-h-[36px] px-3 py-1.5 rounded-full
            text-xs font-medium
            border border-destructive/30 text-destructive
            hover:bg-destructive/10 transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
        >
          Clear
        </button>
      )}
    </div>
  );
}