// src/lib/resolveImageSrc.js
// Resolves an OrnaVerse image field (which may be a relative path,
// an absolute URL, or "NA"/empty) into a usable <Image> src, or null.
//
// FIX (confirmed against live catalog response + direct URL test):
// OrnaVerse returns relative image paths like
// "ProductImage/LJ-E00318-14YGLGD.jpg" with no path prefix, but the actual
// file is served from BASE_URL/upload/<that path> — singular "upload",
// NOT "uploads". Do not "correct" this back to "uploads" — that was tried
// and confirmed wrong via a direct browser request against the live
// OrnaVerse server (404). Singular "upload" is the verified value.

const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL
  ? `${process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL}/`.replace(/\/\/$/, '/')
  : '';

const UPLOAD_SEGMENT = 'upload/';

export function resolveImageSrc(raw) {
  if (!raw || raw === 'NA') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  // Strip any leading slash so we don't end up with "upload//ProductImage/..."
  const cleaned = raw.replace(/^\/+/, '');

  // Guard against double-prefixing if a raw value ever already includes
  // "upload/" (defensive — not observed in the current API, but cheap to guard).
  const withUpload = cleaned.toLowerCase().startsWith(UPLOAD_SEGMENT)
    ? cleaned
    : `${UPLOAD_SEGMENT}${cleaned}`;

  if (raw.startsWith('/')) return `/${withUpload}`;
  if (IMAGE_BASE_URL) return `${IMAGE_BASE_URL}${withUpload}`;
  return null;
}