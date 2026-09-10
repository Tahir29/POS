// src/lib/karat.js
//
// Derives ProductCard's expected karat_code ("14", "925") from Items/Retrieve's
// karat_name ("14KT", "Silver925"), which has no karat_code field of its own —
// both shapes reduce to their leading digits, so no lookup table is needed.
export function deriveKaratCode(karatName) {
  if (!karatName) return null;
  const digits = karatName.match(/\d+/);
  return digits ? digits[0] : null;
}
