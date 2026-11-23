// src/lib/workflow/workflowConstants.js

export const WORKFLOW_STAGES = [
  {
    key: 'sales_review',
    stageKey: '1_sales_review',
    stepNumber: 1,
    label: 'Sales Review',
    shortLabel: 'Sales',
    description: 'Initial Sales Order Review',
  },
  {
    key: 'cad_team',
    stageKey: '2_cad_team',
    stepNumber: 2,
    label: 'CAD Team',
    shortLabel: 'CAD',
    description: 'CAD Design & Estimation',
  },
  {
    key: 'yogi_action',
    stageKey: '3_yogi_action',
    stepNumber: 3,
    label: 'Management Approval',
    shortLabel: 'Approval',
    description: 'Management Approval & ERP Push',
  },
  {
    key: 'po_fulfillment',
    stageKey: '4_po_fulfillment',
    stepNumber: 4,
    label: 'PO Fulfillment',
    shortLabel: 'PO',
    description: 'PO Generation & Inventory Fulfillment',
  },
  {
    key: 'vendor_ops',
    stageKey: '5_vendor_ops',
    alternateKeys: ['vendor_assignment'],
    stepNumber: 5,
    label: 'Vendor Ops',
    shortLabel: 'Vendor',
    description: 'Vendor Manufacturing & Ops',
  },
  {
    key: 'inward_qc',
    stageKey: '6_inward_qc',
    stepNumber: 6,
    label: 'Inward QC',
    shortLabel: 'QC',
    description: 'Quality Check & Physical Inspection',
  },
  {
    key: 'certificate_team',
    stageKey: '7_certificate_team',
    stepNumber: 7,
    label: 'Certificate Team',
    shortLabel: 'Cert',
    description: 'Diamond / Gemstone Certification',
  },
  {
    key: 'invoicing_huid',
    stageKey: '8_invoicing_huid',
    stepNumber: 8,
    label: 'HUID & Invoicing',
    shortLabel: 'HUID',
    description: 'Hallmarking & HUID Invoicing',
  },
  {
    key: 'purchase_invoice',
    stageKey: '9_purchase_invoice',
    stepNumber: 9,
    label: 'Purchase Invoice',
    shortLabel: 'PI',
    description: 'Purchase Invoice Verification',
  },
  {
    key: 'packaging',
    stageKey: '10_packaging',
    stepNumber: 10,
    label: 'Packaging',
    shortLabel: 'Pack',
    description: 'Box Packing & Labeling',
  },
  {
    key: 'shipping',
    stageKey: '11_shipping',
    stepNumber: 11,
    label: 'Shipping & Delivery',
    shortLabel: 'Shipping',
    description: 'Logistics, Tracking & Delivery',
  },
];

export const WORKFLOW_STEP_ORDER = WORKFLOW_STAGES.map((s) => s.key);

export function getStageMeta(stageKey) {
  if (!stageKey) return null;
  const normalized = String(stageKey).toLowerCase().replace(/^\d+_/, '');
  return (
    WORKFLOW_STAGES.find(
      (s) =>
        s.key === normalized ||
        s.stageKey === stageKey ||
        (s.alternateKeys && s.alternateKeys.includes(normalized))
    ) || {
      key: normalized,
      stageKey,
      stepNumber: 0,
      label: normalized.replace(/_/g, ' ').toUpperCase(),
      shortLabel: normalized,
      description: 'Workflow stage',
    }
  );
}

export const WORKFLOW_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    variant: 'secondary',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  },
  approved: {
    label: 'Approved',
    variant: 'default',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
  },
  in_production: {
    label: 'In Production',
    variant: 'default',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  },
  completed: {
    label: 'Completed',
    variant: 'default',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800',
  },
  delivered: {
    label: 'Delivered',
    variant: 'default',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'destructive',
    badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800',
  },
  rejected: {
    label: 'Rejected',
    variant: 'destructive',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
  },
};
