'use client';

/**
 * SearchResultsCount
 * Displays a count summary above the product grid in search mode.
 * Shows a skeleton-style pulse when results are loading.
 *
 * Props:
 *   count      — number  — total results returned
 *   query      — string  — the active search term (may be empty in filter-only mode)
 *   isLoading  — boolean
 */
export default function SearchResultsCount({ count, query, isLoading }) {
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading search results"
        className="h-5 w-48 rounded bg-gray-200 animate-pulse"
      />
    );
  }

  const hasQuery = query && query.trim().length > 0;

  return (
    <p
      aria-live="polite"
      aria-atomic="true"
      className="text-sm text-gray-500"
    >
      {count === 0 ? (
        hasQuery ? (
          <>
            No results for{' '}
            <span className="font-semibold text-gray-700">"{query}"</span>
          </>
        ) : (
          'No products match the current filters.'
        )
      ) : (
        <>
          <span className="font-semibold text-gray-800">{count}</span>
          {count === 1 ? ' product' : ' products'}
          {hasQuery && (
            <>
              {' '}for{' '}
              <span className="font-semibold text-gray-700">"{query}"</span>
            </>
          )}
        </>
      )}
    </p>
  );
}