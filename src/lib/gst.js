// src/lib/gst.js
//
// GST bifurcation for display only — reconstructs the CGST+SGST split from
// a combined tax_amount for screens that don't have the real per-line
// breakdown (cart estimate, order/invoice summaries). Does not change what's
// computed or stored; Invoice/Order Create already gets the real breakdown
// from OrnaVerse's own tax engine.
//
// Assumes intra-state (CGST+SGST) only — does NOT handle inter-state sales
// (which would be a single IGST 3% line, depending on place_of_supply).
// Revisit if this business starts invoicing across state lines.

/**
 * @param {number|null|undefined} taxAmount
 * @returns {{ cgst: number, sgst: number } | null} null when there's no tax to split
 */
export function splitGst(taxAmount) {
  const amount = Number(taxAmount) || 0;
  if (amount <= 0) return null;
  const cgst = +(amount / 2).toFixed(2);
  // Remainder rather than a second /2, so the two halves always sum back
  // to the exact original amount.
  const sgst = +(amount - cgst).toFixed(2);
  return { cgst, sgst };
}
