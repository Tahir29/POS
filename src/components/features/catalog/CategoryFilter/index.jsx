'use client';

// src/components/features/catalog/CategoryFilter/index.jsx
// Three-tier filter panel for the catalog screen.
// Tier 1: Item Groups (top-level tabs — e.g. Gold, Silver, Diamond)
// Tier 2: Categories (Types) — shown as horizontal chips
// Tier 3: Sub-categories (SubTypes) — filtered by selected category
// Also includes the Out-of-Stock toggle.
//
// Pure presentational — all state lives in CatalogPage via useCatalogFilters.

// ── Item Group Tabs ───────────────────────────────────────────────────────────

function ItemGroupTabs({ groups, activeGroupId, onSelect }) {
  return (
    <div
      className="flex gap-1 overflow-x-auto pb-1 scrollbar-none"
      role="tablist"
      aria-label="Product groups"
    >
      {/* "All" sentinel */}
      <button
        type="button"
        role="tab"
        aria-selected={activeGroupId === null}
        onClick={() => onSelect(null)}
        className={[
          'min-h-11 shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1',
          activeGroupId === null
            ? 'bg-amber-600 text-white shadow-sm'
            : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
        ].join(' ')}
      >
        All
      </button>

      {groups.map((group) => {
        const id = group.item_group_id;
        const isActive = activeGroupId === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(id)}
            className={[
              'min-h-11 shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1',
              isActive
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200',
            ].join(' ')}
          >
            {group.item_group_name}
          </button>
        );
      })}
    </div>
  );
}

// ── Category Chips ────────────────────────────────────────────────────────────

function CategoryChips({ categories, activeCategoryId, onSelect }) {
  if (!categories.length) return null;

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Product categories"
    >
      {categories.map((cat) => {
        const id = cat.type_id;
        const isActive = activeCategoryId === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(isActive ? null : id)}
            aria-pressed={isActive}
            className={[
              'min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1',
              isActive
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50',
            ].join(' ')}
          >
            {cat.type_name}
          </button>
        );
      })}
    </div>
  );
}

// ── Sub-Category Chips ────────────────────────────────────────────────────────

function SubCategoryChips({ subTypes, activeSubTypeId, onSelect }) {
  if (!subTypes.length) return null;

  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Product sub-categories"
    >
      {subTypes.map((sub) => {
        const id = sub.sub_type_id;
        const isActive = activeSubTypeId === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(isActive ? null : id)}
            aria-pressed={isActive}
            className={[
              'min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1',
              isActive
                ? 'border-stone-700 bg-stone-800 text-white'
                : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:bg-stone-50',
            ].join(' ')}
          >
            {sub.sub_type_name}
          </button>
        );
      })}
    </div>
  );
}

// ── OOS Toggle + Clear Filters ────────────────────────────────────────────────

function FilterMeta({ showOos, onToggleOos, hasActiveFilters, onClearFilters }) {
  return (
    <div className="flex items-center justify-between">
      {/* Out-of-stock toggle */}
      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 select-none">
        <button
          type="button"
          role="switch"
          aria-checked={showOos}
          onClick={onToggleOos}
          className={[
            'relative inline-flex h-6 w-10 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
            showOos ? 'bg-amber-600' : 'bg-stone-200',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
              showOos ? 'translate-x-5' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
        <span className="text-sm text-stone-600">Show out-of-stock</span>
      </label>

      {/* Clear filters — only visible when something is active */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="min-h-9 rounded-lg px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ── CategoryFilter (root) ─────────────────────────────────────────────────────

/**
 * @param {{
 *   itemGroups: object[],
 *   categories: object[],
 *   subTypes: object[],
 *   activeGroupId: number | null,
 *   activeCategoryId: number | null,
 *   activeSubTypeId: number | null,
 *   showOos: boolean,
 *   hasActiveFilters: boolean,
 *   onSelectGroup: (id: number | null) => void,
 *   onSelectCategory: (id: number | null) => void,
 *   onSelectSubType: (id: number | null) => void,
 *   onToggleOos: () => void,
 *   onClearFilters: () => void,
 * }} props
 */
export default function CategoryFilter({
  itemGroups = [],
  categories = [],
  subTypes = [],
  activeGroupId,
  activeCategoryId,
  activeSubTypeId,
  showOos,
  hasActiveFilters,
  onSelectGroup,
  onSelectCategory,
  onSelectSubType,
  onToggleOos,
  onClearFilters,
}) {
  // Sub-types filtered to the active category only
  const visibleSubTypes = activeCategoryId
    ? subTypes.filter((s) => s.type_id === activeCategoryId)
    : [];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stone-100 bg-white p-4 shadow-sm">
      {/* Tier 1 — Item groups */}
      {itemGroups.length > 0 && (
        <ItemGroupTabs
          groups={itemGroups}
          activeGroupId={activeGroupId}
          onSelect={onSelectGroup}
        />
      )}

      {/* Divider */}
      {itemGroups.length > 0 && categories.length > 0 && (
        <hr className="border-stone-100" />
      )}

      {/* Tier 2 — Categories */}
      {categories.length > 0 && (
        <CategoryChips
          categories={categories}
          activeCategoryId={activeCategoryId}
          onSelect={onSelectCategory}
        />
      )}

      {/* Tier 3 — Sub-categories (only when a category is selected and has subs) */}
      {visibleSubTypes.length > 0 && (
        <SubCategoryChips
          subTypes={visibleSubTypes}
          activeSubTypeId={activeSubTypeId}
          onSelect={onSelectSubType}
        />
      )}

      {/* OOS toggle + clear */}
      <FilterMeta
        showOos={showOos}
        onToggleOos={onToggleOos}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
      />
    </div>
  );
}
