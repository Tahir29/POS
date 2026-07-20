'use client';

// src/components/shared/ListItemCard/index.jsx
//
// Shared tappable list-item card shell — the outer button, optional header +
// dashed divider, meta-row container, and optional footer were byte-identical
// (or near-identical) across OrderListItem, InvoiceListItem, and
// CustomerListItem. Each caller still owns its own row content (different
// fields, different icons) — this only extracts the structural wrapper.

export default function ListItemCard({ onSelect, header, footer, children }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-border bg-card text-left hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden"
    >
      {header && (
        <>
          <div className="px-4 pt-4 pb-3">
            <p className="text-[15px] font-semibold text-stone-800 tracking-tight">
              {header}
            </p>
          </div>
          <div className="mx-4 border-t border-dashed border-stone-200" />
        </>
      )}

      <div className="px-4 py-3 space-y-2">
        {children}
      </div>

      {footer && (
        <div className="flex items-center justify-between px-4 pb-4">
          {footer}
        </div>
      )}
    </button>
  );
}
