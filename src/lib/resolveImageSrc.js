// src/lib/resolveImageSrc.js
// Resolves an OrnaVerse image field (which may be a relative path,
// an absolute URL, or "NA"/empty) into a usable <Image> src, or null.
//
// FIX (confirmed against live catalog response): OrnaVerse returns relative
// image paths like "ProductImage/LJ-E00318-14YGLGD.jpg" with NO "uploads/"
// prefix, but the actual file is served from BASE_URL/uploads/<that path>,
// not BASE_URL/<that path>. Every relative path gets the "uploads/" segment
// inserted here — do this in one place, not per-component, since
// ProductCard, product detail gallery, cart, and orders all resolve images
// through this same function.

const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL
  ? `${process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL}/`.replace(/\/\/$/, '/')
  : '';

const UPLOAD_SEGMENT = 'upload/';

export function resolveImageSrc(raw) {
  if (!raw || raw === 'NA') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  // Strip any leading slash so we don't end up with "uploads//ProductImage/..."
  const cleaned = raw.replace(/^\/+/, '');

  // Guard against double-prefixing if a raw value ever already includes
  // "uploads/" (defensive — not observed in the current API, but cheap to guard).
  const withUploads = cleaned.toLowerCase().startsWith(UPLOAD_SEGMENT)
    ? cleaned
    : `${UPLOAD_SEGMENT}${cleaned}`;

  if (raw.startsWith('/')) return `/${withUploads}`;
  if (IMAGE_BASE_URL) return `${IMAGE_BASE_URL}${withUploads}`;
  return null;
}