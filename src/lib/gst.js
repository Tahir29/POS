// src/lib/gst.js
//
// GST bifurcation for display. This business's GST is a flat 3%, and it is
// always exactly 1.5% CGST + 1.5% SGST on a real intra-state sale — not an
// assumption, confirmed live 2026-08-17 against a real posted invoice
// (HO-LJ-0826-017): its line's item_taxes[] carries two independently
// ledgered rows, CGST ₹1,637.10 and SGST ₹1,637.10, an exact half of the
// ₹3,274.20 header tax_amount. See appConfig.js TAX.GST_RATE for the rate
// itself and why a flat rate is correct for this business.
//
// This only reconstructs that split for screens that only have the combined
// tax_amount to hand (cart estimate, order/invoice summaries) — it does not
// change what's computed or stored. Invoice/Order Create already gets the
// real per-line breakdown from OrnaVerse's own tax engine (SetSalesItems'
// item_taxes[], summed into the header by summarizeLineItems) regardless of
// what this displays.
//
// NOT handled: inter-state sales, which would be IGST 3% (one line, not
// two) rather than CGST+SGST. That depends on the customer's billing state
// vs. the store's own state (place_of_supply) — not something to derive
// from a total amount alone. Every real invoice checked so far on this
// tenant used CGST+SGST, so that's the only case this covers; revisit if
// this business starts invoicing across state lines.

/**
 * @param {number|null|undefined} taxAmount
 * @returns {{ cgst: number, sgst: number } | null} null when there's no tax to split
 */
export function splitGst(taxAmount) {
  const amount = Number(taxAmount) || 0;
  if (amount <= 0) return null;
  const cgst = +(amount / 2).toFixed(2);
  // Remainder rather than a second /2, so the two halves always sum back
  // to the exact original amount even when it has an odd paisa.
  const sgst = +(amount - cgst).toFixed(2);
  return { cgst, sgst };
}
