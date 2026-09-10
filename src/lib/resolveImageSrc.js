// src/lib/resolveImageSrc.js
// Resolves an OrnaVerse image field (relative path, absolute URL, or
// "NA"/empty) into a usable <Image> src, or null.
//
// OrnaVerse relative paths (e.g. "ProductImage/x.jpg") are served from
// BASE_URL/upload/<path> — singular "upload". Do NOT "correct" this to
// "uploads" — that 404s against the live server; singular is verified correct.

const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL
  ? `${process.env.NEXT_PUBLIC_ORNAVERSE_BASE_URL}/`.replace(/\/\/$/, '/')
  : '';

const UPLOAD_SEGMENT = 'upload/';

export function resolveImageSrc(raw) {
  if (!raw || raw === 'NA') return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  // Recognize our own already-resolved output ("/api/upload/...") and return
  // it unchanged — a second pass would double-prefix "upload/" and 404.
  if (raw.startsWith('/api/upload/')) return raw;

  // Strip any leading slash so we don't end up with "upload//ProductImage/..."
  const cleaned = raw.replace(/^\/+/, '');

  // Guard against double-prefixing if a raw value ever already includes "upload/".
  const withUpload = cleaned.toLowerCase().startsWith(UPLOAD_SEGMENT)
    ? cleaned
    : `${UPLOAD_SEGMENT}${cleaned}`;

  if (raw.startsWith('/')) return `/${withUpload}`;
  if (IMAGE_BASE_URL) return `${IMAGE_BASE_URL}${withUpload}`;
  return null;
}