'use client';

// src/components/shared/RemoveLineItemButton/index.jsx
//
// Shared trash-icon button for removing a row from a react-hook-form
// field array. Was copy-pasted independently 6x across buyback, exchange,
// urd-purchase, returns, and transactions (x2) with the same classes but
// a drifted aria-label (missing entirely in 2 of them, "Remove" in one,
// "Remove item" in the rest) — standardized here.

import { Trash2 } from 'lucide-react';

export default function RemoveLineItemButton({ onClick, label = 'Remove item' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-stone-400 hover:text-destructive"
    >
      <Trash2 size={14} />
    </button>
  );
}
