// src/lib/resolveImageSrc.js
// Resolves an OrnaVerse image field (which may be a relative path,
// an absolute URL, or "NA"/empty) into a usable <Image> src, or null.

const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL
  ? `${process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL}/`.replace(/\/\/$/, '/')
  : '';

export function resolveImageSrc(raw) {
  if (!raw || raw === 'NA') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return raw;
  if (IMAGE_BASE_URL) return `${IMAGE_BASE_URL}${raw}`;
  return null;
}