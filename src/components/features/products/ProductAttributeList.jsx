'use client';

// src/components/features/products/ProductAttributeList/index.jsx
// Renders product attributes returned from Attributes/List as a
// labeled chip grid. Attributes are grouped by attribute_type_name
// when present, otherwise rendered as a flat list.

/**
 * @param {{ attributes: object[] }} props
 * Each attribute object expected shape:
 *   { attribute_id, attribute_name, attribute_type_id, attribute_type_name }
 */
export default function ProductAttributeList({ attributes = [] }) {
  if (!attributes.length) return null;

  // ── Group by attribute_type_name if available ─────────────────────────────
  const grouped = attributes.reduce((acc, attr) => {
    const group = attr.attribute_type_name ?? attr.attribute_type ?? 'Attributes';
    if (!acc[group]) acc[group] = [];
    acc[group].push(attr);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(grouped).map(([groupName, attrs]) => (
        <div key={groupName} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            {groupName}
          </h3>
          <div className="flex flex-wrap gap-2">
            {attrs.map((attr) => (
              <span
                key={attr.attribute_id ?? attr.attribute_name}
                className="
                  inline-flex items-center
                  px-3 py-1.5 rounded-full
                  text-xs font-medium
                  bg-amber-50 text-amber-800
                  border border-amber-200
                "
              >
                {attr.attribute_name}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
