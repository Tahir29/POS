// Lucira's own four-point diamond/sparkle mark (the accent over the "i" in
// the wordmark, and the icon-only Logo variant's glyph) — not a generic
// lucide gem/rhombus. Traced from the brand's source path data, recentered
// and scaled by 0.2 into a standard 24x24 viewBox. Filled, not stroked: the
// source mark has no outline, so `fill` (defaults to currentColor) is what
// colors it.

export default function BrandDiamond({ size = 24, className, fill = 'currentColor', ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      className={className}
      {...props}
    >
      <path d="M22.06 12C18.7 12 12 18.7 12 22.06C12 18.7 5.3 12 1.94 12C5.3 12 12 5.3 12 1.94C12 5.3 18.7 12 22.06 12Z" />
    </svg>
  );
}
