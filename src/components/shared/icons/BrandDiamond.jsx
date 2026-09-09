// src/components/shared/icons/BrandDiamond.jsx
//
// The small four-point diamond/sparkle mark from Lucira's OWN icon logo —
// the accent dot over the "i" in the wordmark, and the standalone glyph in
// the icon-only variant (see components/shared/Logo's LOGOS.icon SVGs,
// served from Shopify CDN). Not lucide's generic gem/rhombus — this is the
// brand's actual mark, traced from its own path data:
//
//   M314.295 818.8 C297.495 818.8 263.995 852.3 263.995 869.1
//     C263.995 852.3 230.495 818.8 213.695 818.8
//     C230.495 818.8 263.995 785.3 263.995 768.5
//     C263.995 785.2 297.495 818.8 314.295 818.8 Z
//
// (four points at ~(264±50.3, 818.8) and (264, 818.8±50.3), each corner
// pinched inward by a cubic curve back toward center — a proper 4-point
// sparkle, not a straight-edged rhombus). Recentered to the origin and
// scaled by 0.2 so it drops into a standard 24x24 icon viewBox at the same
// proportions as the source mark, replacing every lucide Diamond/Sparkle
// use in the auth screens with the actual brand shape.
//
// Filled, not stroked — the source mark has no outline, just a solid
// shape — so `fill` (defaulting to currentColor, same convention as
// lucide's `stroke` default) is what colors it, not `stroke`.

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
