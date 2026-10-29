export const TICKET_STATUS = {
  AWAITING_CAD:               'awaiting_cad',
  AWAITING_CUSTOMER_FEEDBACK: 'awaiting_customer_feedback',
  APPROVED:                   'approved',
  ORDER_PLACED:               'order_placed',
  CANCELLED:                  'cancelled',
};

export const TICKET_STATUS_LABELS = {
  awaiting_cad:               'Awaiting CAD design',
  awaiting_customer_feedback: 'Design shared – awaiting customer feedback',
  approved:                   'Design approved – order in process',
  order_placed:               'Order placed',
  cancelled:                  'Cancelled',
};

export const ticketStatusLabel = (status) => TICKET_STATUS_LABELS[status]
  ?? (status ? String(status).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—');

export const CAD_REMINDER_DAYS = 10;

export const TICKET_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
export const TICKET_FILE_MAX_BYTES = 4 * 1024 * 1024;
export const TICKET_MAX_FILES = 10;
