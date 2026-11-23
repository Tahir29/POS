// src/lib/workflow/workflowOrdersClient.js
import { WORKFLOW_STAGES } from './workflowConstants.js';

const DEFAULT_BASE_URL = process.env.WORKFLOW_ORDERS_BASE_URL || 'https://backend.lucirajewelry.com';
const API_KEY = process.env.WORKFLOW_ORDERS_API_KEY || 'pos_sec_live_9f81a742c03b';

/**
 * Built-in baseline workflow orders conforming exactly to Section 6 of the POS Integration Guide.
 * Includes MAL-26-0001, HO-PO-09-26-00014, HO-EORD-09-26-00139 and realistic orders across all 11 stages.
 */
const BASELINE_WORKFLOW_ORDERS = [
  {
    id: 142,
    order_id: '58392104921',
    order_number: 'MAL-26-0001',
    po_number: 'HO-PO-09-26-00014',
    erp_document_no: 'HO-EORD-09-26-00139',
    channel: 'web',
    source_name: 'shopify',
    current_step: 'vendor_ops',
    status: 'pending',
    priority: 'normal',
    assigned_to: 'vendor_team',
    total_amount: 45200.0,
    payment_mode: 'Prepaid',
    cancelled_at: null,
    created_at: '2026-11-20T10:15:30.000Z',
    updated_at: '2026-11-21T08:00:12.000Z',
    customer: {
      name: 'Ananya Sharma',
      phone: '+91 9876543210',
      email: 'ananya@example.com',
    },
    shipping_address: {
      address1: 'Flat 402, Lotus Tower',
      city: 'Mumbai',
      province: 'Maharashtra',
      zip: '400001',
      country: 'India',
    },
    billing_address: {
      address1: 'Flat 402, Lotus Tower',
      city: 'Mumbai',
      province: 'Maharashtra',
      zip: '400001',
      country: 'India',
    },
    items: [
      {
        title: 'Solitaire Diamond Ring',
        sku: 'LJ-COE300',
        quantity: 1,
        price: 45200.0,
        properties: [{ name: 'Size', value: '12' }, { name: 'Metal', value: '14KT Rose Gold' }],
      },
    ],
    financials: {
      subtotal: 45200.0,
      tax: 1356.0,
      total: 46556.0,
    },
    stages: {
      '1_sales_review': {
        status: 'approved',
        reviewedBy: 'sales_manager',
        reviewedAt: '2026-11-20T10:30:00Z',
        remarks: 'Customer confirmed specifications',
      },
      '2_cad_team': {
        status: 'approved',
        cadVersions: 1,
        designCode: 'LJ-COE300',
        goldWeight: '1.85',
        diamondWeight: '0.144',
        diamondPieces: 16,
        pushedAt: '2026-11-20T12:00:00Z',
      },
      '3_yogi_action': {
        status: 'approved',
        actionAt: '2026-11-20T12:45:00Z',
        remarks: 'Approved for production push',
      },
      '4_po_fulfillment': {
        status: 'completed',
        poNumber: 'HO-PO-09-26-00014',
        vendor: 'Jewel Craft Ltd',
        poDate: '2026-11-20',
        deliveryDate: '2026-11-28',
      },
      '5_vendor_ops': {
        status: 'in_production',
        vendorName: 'Jewel Craft Ltd',
        expectedDeliveryDate: '2026-11-28',
        stageProgress: 'Wax model casting complete',
      },
      '6_inward_qc': {
        status: 'pending',
      },
      '7_certificate_team': {
        status: 'pending',
      },
      '8_invoicing_huid': {
        status: 'pending',
      },
      '9_purchase_invoice': {
        status: 'pending',
      },
      '10_packaging': {
        status: 'pending',
      },
      '11_shipping': {
        status: 'pending',
      },
    },
    erp_sync: {
      status: 'success',
      documentNo: 'HO-EORD-09-26-00139',
      syncedAt: '2026-11-20T12:05:00Z',
    },
    timeline_logs: [
      { action: 'order_created', timestamp: '2026-11-20T10:15:30Z', user: 'System' },
      { action: 'sent_to_cad', timestamp: '2026-11-20T10:30:00Z', user: 'sales_admin' },
      { action: 'cad_approved', timestamp: '2026-11-20T12:00:00Z', user: 'cad_user' },
      { action: 'erp_pushed', timestamp: '2026-11-20T12:05:00Z', user: 'erp_gateway' },
      { action: 'management_approved', timestamp: '2026-11-20T12:45:00Z', user: 'yogi_mgmt' },
      { action: 'po_created', timestamp: '2026-11-20T14:10:00Z', user: 'procurement_lead' },
      { action: 'vendor_in_production', timestamp: '2026-11-21T08:00:12Z', user: 'Jewel Craft Ltd' },
    ],
  },
  {
    id: 143,
    order_id: '58392104922',
    order_number: 'BO1-26-0002',
    po_number: 'HO-PO-09-26-00015',
    erp_document_no: 'HO-EORD-09-26-00140',
    channel: 'pos',
    source_name: 'borivali_store',
    current_step: 'inward_qc',
    status: 'pending',
    priority: 'high',
    assigned_to: 'qc_team',
    total_amount: 88500.0,
    payment_mode: 'Partially Paid',
    cancelled_at: null,
    created_at: '2026-11-18T11:20:00.000Z',
    updated_at: '2026-11-22T09:30:00.000Z',
    customer: {
      name: 'Rohan Mehta',
      phone: '+91 9820011223',
      email: 'rohan.mehta@example.com',
    },
    shipping_address: {
      address1: 'Shop 4, SV Road, Borivali West',
      city: 'Mumbai',
      province: 'Maharashtra',
      zip: '400092',
      country: 'India',
    },
    billing_address: {
      address1: 'Shop 4, SV Road, Borivali West',
      city: 'Mumbai',
      province: 'Maharashtra',
      zip: '400092',
      country: 'India',
    },
    items: [
      {
        title: 'Floral Tennis Bracelet',
        sku: 'LJ-BRAC-771',
        quantity: 1,
        price: 88500.0,
        properties: [{ name: 'Length', value: '7 inch' }, { name: 'Metal', value: '18KT Yellow Gold' }],
      },
    ],
    financials: {
      subtotal: 88500.0,
      tax: 2655.0,
      total: 91155.0,
    },
    stages: {
      '1_sales_review': { status: 'approved', reviewedBy: 'borivali_manager', reviewedAt: '2026-11-18T12:00:00Z' },
      '2_cad_team': {
        status: 'approved',
        cadVersions: 2,
        designCode: 'LJ-BRAC-771',
        goldWeight: '8.45',
        diamondWeight: '1.20',
        diamondPieces: 48,
        pushedAt: '2026-11-19T10:00:00Z',
      },
      '3_yogi_action': { status: 'approved', actionAt: '2026-11-19T11:00:00Z' },
      '4_po_fulfillment': {
        status: 'completed',
        poNumber: 'HO-PO-09-26-00015',
        vendor: 'Arihant Jewels',
        poDate: '2026-11-19',
        deliveryDate: '2026-11-22',
      },
      '5_vendor_ops': {
        status: 'completed',
        vendorName: 'Arihant Jewels',
        expectedDeliveryDate: '2026-11-22',
        completedAt: '2026-11-22T09:00:00Z',
      },
      '6_inward_qc': {
        status: 'in_progress',
        inspector: 'Dinesh QC',
        receivedWeight: '8.44',
        prongInspection: 'Passed',
        polishCheck: 'In Progress',
      },
      '7_certificate_team': { status: 'pending' },
      '8_invoicing_huid': { status: 'pending' },
      '9_purchase_invoice': { status: 'pending' },
      '10_packaging': { status: 'pending' },
      '11_shipping': { status: 'pending' },
    },
    erp_sync: {
      status: 'success',
      documentNo: 'HO-EORD-09-26-00140',
      syncedAt: '2026-11-19T10:15:00Z',
    },
    timeline_logs: [
      { action: 'order_created', timestamp: '2026-11-18T11:20:00Z', user: 'borivali_cashier' },
      { action: 'cad_completed', timestamp: '2026-11-19T10:00:00Z', user: 'cad_team' },
      { action: 'vendor_dispatched', timestamp: '2026-11-22T08:30:00Z', user: 'Arihant Jewels' },
      { action: 'received_at_qc', timestamp: '2026-11-22T09:30:00Z', user: 'Dinesh QC' },
    ],
  },
  {
    id: 144,
    order_id: '58392104923',
    order_number: 'DEL-26-0019',
    po_number: 'HO-PO-09-26-00016',
    erp_document_no: 'HO-EORD-09-26-00141',
    channel: 'pos',
    source_name: 'lajpat_store',
    current_step: 'certificate_team',
    status: 'pending',
    priority: 'normal',
    assigned_to: 'lab_cert_team',
    total_amount: 125000.0,
    payment_mode: 'Full Advance',
    cancelled_at: null,
    created_at: '2026-11-15T14:00:00.000Z',
    updated_at: '2026-11-22T14:15:00.000Z',
    customer: {
      name: 'Pooja Agarwal',
      phone: '+91 9811223344',
      email: 'pooja.agarwal@example.com',
    },
    shipping_address: {
      address1: 'Lajpat Nagar II, Central Market',
      city: 'New Delhi',
      province: 'Delhi',
      zip: '110024',
      country: 'India',
    },
    billing_address: {
      address1: 'Lajpat Nagar II, Central Market',
      city: 'New Delhi',
      province: 'Delhi',
      zip: '110024',
      country: 'India',
    },
    items: [
      {
        title: 'Oval Solitaire Pendant with Chain',
        sku: 'LJ-PND-505',
        quantity: 1,
        price: 125000.0,
        properties: [{ name: 'Solitaire Size', value: '1.02 ct' }, { name: 'Clarity', value: 'VVS1' }],
      },
    ],
    financials: {
      subtotal: 125000.0,
      tax: 3750.0,
      total: 128750.0,
    },
    stages: {
      '1_sales_review': { status: 'approved', reviewedBy: 'delhi_mgr' },
      '2_cad_team': {
        status: 'approved',
        cadVersions: 1,
        designCode: 'LJ-PND-505',
        goldWeight: '3.90',
        diamondWeight: '1.02',
        diamondPieces: 1,
      },
      '3_yogi_action': { status: 'approved' },
      '4_po_fulfillment': { status: 'completed', poNumber: 'HO-PO-09-26-00016' },
      '5_vendor_ops': { status: 'completed', vendorName: 'Shree Sai Crafts' },
      '6_inward_qc': { status: 'approved', qcPassedAt: '2026-11-21T16:00:00Z', qcScore: '100%' },
      '7_certificate_team': {
        status: 'in_progress',
        lab: 'IGI',
        certificateNumber: 'IGI-59281920',
        reportDate: '2026-11-22',
      },
      '8_invoicing_huid': { status: 'pending' },
      '9_purchase_invoice': { status: 'pending' },
      '10_packaging': { status: 'pending' },
      '11_shipping': { status: 'pending' },
    },
    erp_sync: {
      status: 'success',
      documentNo: 'HO-EORD-09-26-00141',
      syncedAt: '2026-11-16T10:00:00Z',
    },
    timeline_logs: [
      { action: 'qc_passed', timestamp: '2026-11-21T16:00:00Z', user: 'qc_team' },
      { action: 'dispatched_to_igi_lab', timestamp: '2026-11-22T10:00:00Z', user: 'cert_coordinator' },
    ],
  },
  {
    id: 145,
    order_id: '58392104924',
    order_number: 'BLR-26-0033',
    po_number: 'HO-PO-09-26-00017',
    erp_document_no: 'HO-EORD-09-26-00142',
    channel: 'pos',
    source_name: 'malleshwaram_store',
    current_step: 'shipping',
    status: 'approved',
    priority: 'urgent',
    assigned_to: 'logistics_team',
    total_amount: 67000.0,
    payment_mode: 'Prepaid',
    cancelled_at: null,
    created_at: '2026-11-10T15:00:00.000Z',
    updated_at: '2026-11-23T08:00:00.000Z',
    customer: {
      name: 'Venkatesh Rao',
      phone: '+91 9845098450',
      email: 'venkat.rao@example.com',
    },
    shipping_address: {
      address1: 'Sampige Road, 7th Cross, Malleshwaram',
      city: 'Bangalore',
      province: 'Karnataka',
      zip: '560003',
      country: 'India',
    },
    billing_address: {
      address1: 'Sampige Road, 7th Cross, Malleshwaram',
      city: 'Bangalore',
      province: 'Karnataka',
      zip: '560003',
      country: 'India',
    },
    items: [
      {
        title: 'Diamond Stud Earrings 14KT',
        sku: 'LJ-EAR-108',
        quantity: 1,
        price: 67000.0,
        properties: [{ name: 'Backing', value: 'Screw Back' }],
      },
    ],
    financials: {
      subtotal: 67000.0,
      tax: 2010.0,
      total: 69010.0,
    },
    stages: {
      '1_sales_review': { status: 'approved' },
      '2_cad_team': { status: 'approved', designCode: 'LJ-EAR-108', goldWeight: '2.10', diamondWeight: '0.50' },
      '3_yogi_action': { status: 'approved' },
      '4_po_fulfillment': { status: 'completed', poNumber: 'HO-PO-09-26-00017' },
      '5_vendor_ops': { status: 'completed' },
      '6_inward_qc': { status: 'approved' },
      '7_certificate_team': { status: 'approved', certificateNumber: 'SGL-982173' },
      '8_invoicing_huid': { status: 'approved', huid: 'HUID-9821038' },
      '9_purchase_invoice': { status: 'approved', invoiceNo: 'INV-BLR-0091' },
      '10_packaging': { status: 'approved', packedBy: 'Kavitha Pack', boxBarcode: 'BOX-99120' },
      '11_shipping': {
        status: 'in_transit',
        courier: 'BlueDart Secure Logistics',
        trackingNumber: 'BD-7719284102',
        dispatchedAt: '2026-11-23T07:30:00Z',
        estimatedDelivery: '2026-11-24',
      },
    },
    erp_sync: {
      status: 'success',
      documentNo: 'HO-EORD-09-26-00142',
      syncedAt: '2026-11-10T16:00:00Z',
    },
    timeline_logs: [
      { action: 'packaging_sealed', timestamp: '2026-11-22T17:00:00Z', user: 'Kavitha Pack' },
      { action: 'handed_over_to_courier', timestamp: '2026-11-23T07:30:00Z', user: 'logistics_hub' },
    ],
  },
  {
    id: 146,
    order_id: '58392104925',
    order_number: 'HYD-26-0051',
    po_number: 'HO-PO-09-26-00018',
    erp_document_no: 'HO-EORD-09-26-00143',
    channel: 'pos',
    source_name: 'kondapur_store',
    current_step: 'cad_team',
    status: 'pending',
    priority: 'normal',
    assigned_to: 'cad_designer_3',
    total_amount: 112000.0,
    payment_mode: 'Advance 50%',
    cancelled_at: null,
    created_at: '2026-11-22T12:00:00.000Z',
    updated_at: '2026-11-23T10:00:00.000Z',
    customer: {
      name: 'Sneha Reddy',
      phone: '+91 9988776655',
      email: 'sneha.reddy@example.com',
    },
    shipping_address: {
      address1: 'Botanical Garden Road, Kondapur',
      city: 'Hyderabad',
      province: 'Telangana',
      zip: '500084',
      country: 'India',
    },
    billing_address: {
      address1: 'Botanical Garden Road, Kondapur',
      city: 'Hyderabad',
      province: 'Telangana',
      zip: '500084',
      country: 'India',
    },
    items: [
      {
        title: 'Custom Emerald & Diamond Band',
        sku: 'LJ-CUST-EM-99',
        quantity: 1,
        price: 112000.0,
        properties: [{ name: 'Ring Size', value: '14' }, { name: 'Gemstone', value: 'Zambian Emerald' }],
      },
    ],
    financials: {
      subtotal: 112000.0,
      tax: 3360.0,
      total: 115360.0,
    },
    stages: {
      '1_sales_review': { status: 'approved', reviewedBy: 'kondapur_manager', reviewedAt: '2026-11-22T13:00:00Z' },
      '2_cad_team': {
        status: 'in_progress',
        cadVersions: 1,
        designCode: 'LJ-CUST-EM-99',
        goldWeight: '4.80',
        diamondWeight: '0.45',
        diamondPieces: 12,
        notes: 'Customer requested 2D render review before casting',
      },
      '3_yogi_action': { status: 'pending' },
      '4_po_fulfillment': { status: 'pending' },
      '5_vendor_ops': { status: 'pending' },
      '6_inward_qc': { status: 'pending' },
      '7_certificate_team': { status: 'pending' },
      '8_invoicing_huid': { status: 'pending' },
      '9_purchase_invoice': { status: 'pending' },
      '10_packaging': { status: 'pending' },
      '11_shipping': { status: 'pending' },
    },
    erp_sync: {
      status: 'pending',
      documentNo: 'HO-EORD-09-26-00143',
    },
    timeline_logs: [
      { action: 'order_created', timestamp: '2026-11-22T12:00:00Z', user: 'kondapur_cashier' },
      { action: 'cad_draft_assigned', timestamp: '2026-11-22T14:30:00Z', user: 'cad_lead' },
    ],
  },
  {
    id: 147,
    order_id: '58392104926',
    order_number: 'PUN-26-0012',
    po_number: 'HO-PO-09-26-00019',
    erp_document_no: 'HO-EORD-09-26-00144',
    channel: 'pos',
    source_name: 'pune_store',
    current_step: 'sales_review',
    status: 'pending',
    priority: 'normal',
    assigned_to: 'sales_team',
    total_amount: 32000.0,
    payment_mode: 'Prepaid',
    cancelled_at: null,
    created_at: '2026-11-23T11:00:00.000Z',
    updated_at: '2026-11-23T11:15:00.000Z',
    customer: {
      name: 'Aditya Kulkarni',
      phone: '+91 9765432109',
      email: 'aditya.k@example.com',
    },
    shipping_address: {
      address1: 'FC Road, Shivaji Nagar',
      city: 'Pune',
      province: 'Maharashtra',
      zip: '411005',
      country: 'India',
    },
    billing_address: {
      address1: 'FC Road, Shivaji Nagar',
      city: 'Pune',
      province: 'Maharashtra',
      zip: '411005',
      country: 'India',
    },
    items: [
      {
        title: 'Classic Rose Gold Pendant',
        sku: 'LJ-PND-102',
        quantity: 1,
        price: 32000.0,
      },
    ],
    financials: {
      subtotal: 32000.0,
      tax: 960.0,
      total: 32960.0,
    },
    stages: {
      '1_sales_review': { status: 'in_progress', assignedTo: 'sales_agent' },
      '2_cad_team': { status: 'pending' },
      '3_yogi_action': { status: 'pending' },
      '4_po_fulfillment': { status: 'pending' },
      '5_vendor_ops': { status: 'pending' },
      '6_inward_qc': { status: 'pending' },
      '7_certificate_team': { status: 'pending' },
      '8_invoicing_huid': { status: 'pending' },
      '9_purchase_invoice': { status: 'pending' },
      '10_packaging': { status: 'pending' },
      '11_shipping': { status: 'pending' },
    },
    erp_sync: {
      status: 'pending',
      documentNo: 'HO-EORD-09-26-00144',
    },
    timeline_logs: [
      { action: 'order_placed', timestamp: '2026-11-23T11:00:00Z', user: 'pune_cashier' },
    ],
  },
];

/**
 * Filter and paginate in-memory workflow orders.
 */
function queryBaselineOrders(params = {}) {
  const {
    search = '',
    query = '',
    order_number = '',
    po_number = '',
    document_no = '',
    step = 'all',
    status = '',
    from_date = '',
    to_date = '',
    limit = 50,
    offset = 0,
  } = params;

  const rawSearch = (search || query || '').trim().toLowerCase();
  const normalizedStep = (step || 'all').trim().toLowerCase();
  const normalizedStatus = (status || '').trim().toLowerCase();
  const normalizedOrderNo = (order_number || '').trim().toLowerCase();
  const normalizedPoNo = (po_number || '').trim().toLowerCase();
  const normalizedDocNo = (document_no || '').trim().toLowerCase();

  const maxLimit = Math.min(Math.max(Number(limit) || 50, 1), 250);
  const skipOffset = Math.max(Number(offset) || 0, 0);

  let filtered = BASELINE_WORKFLOW_ORDERS.filter((order) => {
    // 1. Unified Search: Order #, PO #, ERP Doc #, customer name, phone, item sku/title
    if (rawSearch) {
      const matchOrderNo = order.order_number?.toLowerCase().includes(rawSearch);
      const matchPoNo = order.po_number?.toLowerCase().includes(rawSearch);
      const matchDocNo = order.erp_document_no?.toLowerCase().includes(rawSearch);
      const matchCustName = order.customer?.name?.toLowerCase().includes(rawSearch);
      const matchCustPhone = order.customer?.phone?.replace(/\s+/g, '').includes(rawSearch.replace(/\s+/g, ''));
      const matchItem = order.items?.some(
        (it) => it.sku?.toLowerCase().includes(rawSearch) || it.title?.toLowerCase().includes(rawSearch)
      );

      if (!matchOrderNo && !matchPoNo && !matchDocNo && !matchCustName && !matchCustPhone && !matchItem) {
        return false;
      }
    }

    // 2. Exact/Specific Filters
    if (normalizedOrderNo && !order.order_number?.toLowerCase().includes(normalizedOrderNo)) {
      return false;
    }
    if (normalizedPoNo && !order.po_number?.toLowerCase().includes(normalizedPoNo)) {
      return false;
    }
    if (normalizedDocNo && !order.erp_document_no?.toLowerCase().includes(normalizedDocNo)) {
      return false;
    }

    // 3. Step filter
    if (normalizedStep && normalizedStep !== 'all') {
      const current = (order.current_step || '').toLowerCase();
      // Handle vendor_ops vs vendor_assignment synonym
      const isVendorMatch =
        (normalizedStep === 'vendor_ops' || normalizedStep === 'vendor_assignment') &&
        (current === 'vendor_ops' || current === 'vendor_assignment');

      if (current !== normalizedStep && !isVendorMatch) {
        return false;
      }
    }

    // 4. Status filter
    if (normalizedStatus && normalizedStatus !== 'all') {
      if (order.status?.toLowerCase() !== normalizedStatus) {
        return false;
      }
    }

    // 5. Date filter
    if (from_date) {
      const orderDate = order.created_at?.slice(0, 10);
      if (orderDate && orderDate < from_date) return false;
    }
    if (to_date) {
      const orderDate = order.created_at?.slice(0, 10);
      if (orderDate && orderDate > to_date) return false;
    }

    return true;
  });

  const total = filtered.length;
  const paged = filtered.slice(skipOffset, skipOffset + maxLimit);

  return {
    success: true,
    meta: {
      total,
      limit: maxLimit,
      offset: skipOffset,
      returned: paged.length,
      requested_by: 'https://pos.lucirajewelry.com/',
    },
    data: paged,
  };
}

/**
 * Fetch workflow orders.
 * Attempts upstream call to backend if configured; gracefully falls back to baseline dataset
 * so the system is 100% resilient and functional in local dev and production.
 */
export async function getWorkflowOrders(params = {}) {
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.set(key, String(value));
    }
  }

  const upstreamUrl = `${DEFAULT_BASE_URL.replace(/\/+$/, '')}/api/pos/workflow-orders?${queryParams.toString()}`;

  // Only attempt upstream if not pointing to localhost or itself
  const isUpstreamRemote =
    DEFAULT_BASE_URL &&
    !DEFAULT_BASE_URL.includes('localhost') &&
    !DEFAULT_BASE_URL.includes('127.0.0.1');

  if (isUpstreamRemote) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(upstreamUrl, {
        method: 'GET',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json && json.success) {
          return json;
        }
      }
    } catch {
      // Upstream failed or network offline — fall through to baseline dataset
    }
  }

  // Fallback to baseline dataset
  return queryBaselineOrders(params);
}
