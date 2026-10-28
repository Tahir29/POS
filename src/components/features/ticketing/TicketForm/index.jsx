'use client';

import { useState } from 'react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';

import TicketRequestFields, { EMPTY_SPECS } from '@/components/features/ticketing/TicketRequestFields';
import SalesPersonSelect from '@/components/features/checkout/SalesPersonSelect';
import CustomerAttachedBanner from '@/components/shared/CustomerAttachedBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSalesPersonOptions } from '@/hooks/schemes/useSalesPersonOptions';
import { useCreateTicket } from '@/hooks/ticketing/useTickets';
import { selectActiveStoreId } from '@/store/slices/storeSlice';
import {
  selectCartCustomerId, selectCartCustomerName, selectCartCustomerMobile, selectCartCustomerContactMobile,
} from '@/store/slices/cartSlice';
import { isMaskedValue } from '@/lib/normalizers/customer';

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

export default function TicketForm({ onCreated }) {
  const storeId        = useSelector(selectActiveStoreId);
  const customerId     = useSelector(selectCartCustomerId);
  const customerName   = useSelector(selectCartCustomerName);
  const customerMobile = useSelector(selectCartCustomerMobile);
  const contactMobile  = useSelector(selectCartCustomerContactMobile);
  const knownMobile    = contactMobile ?? (customerMobile && !isMaskedValue(customerMobile) ? customerMobile : null);
  const { salesPersons } = useSalesPersonOptions(storeId);
  const createTicket = useCreateTicket();

  const [salesPersonId, setSalesPersonId] = useState(null);
  const [typedMobile, setTypedMobile] = useState('');
  const [specs, setSpecs] = useState(EMPTY_SPECS);
  const [files, setFiles] = useState([]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!customerId) return toast.error('Assign a customer from the header before raising a ticket.');
    const salesPerson = salesPersons.find((p) => p.employee_id === salesPersonId);
    if (!salesPerson) return toast.error('Select the sales person.');
    if (!specs.category) return toast.error('Select the jewellery category.');
    if (specs.requirement_notes.trim().length < 3) return toast.error('Describe the customer requirement.');
    if (!files.length) return toast.error('Add at least one reference image.');
    const phone = parsePhoneNumberFromString(String(knownMobile ?? typedMobile), 'IN');
    if (!phone?.isValid()) return toast.error("Enter the customer's mobile number.");

    createTicket.mutate(
      {
        customer: {
          party_id: customerId,
          name: customerName,
          mobile: phone.number,
        },
        sales_person: { id: salesPerson.employee_id, name: salesPerson.employee_name },
        specs,
        file_ids: files.map((f) => f.id),
      },
      {
        onSuccess: (ticket) => {
          toast.success(`Ticket ${ticket.ticket_number} created and sent to the CAD team.`);
          onCreated?.(ticket);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <CustomerAttachedBanner
        customerId={customerId}
        customerName={customerName}
        emptyMessage="Assign or create the customer from the header before raising a ticket."
      />

      <Section title="Customer & sales person">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {customerId && !knownMobile && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ticket-mobile">Customer mobile <span className="text-destructive">*</span></Label>
              <Input
                id="ticket-mobile"
                type="tel"
                inputMode="tel"
                className="h-11"
                placeholder="10-digit mobile number"
                value={typedMobile}
                onChange={(e) => setTypedMobile(e.target.value)}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">Needed because the customer was found by name, so only the masked number is available.</p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Sales person <span className="text-destructive">*</span></Label>
            <SalesPersonSelect companyId={storeId} value={salesPersonId} onChange={setSalesPersonId} />
          </div>
        </div>
      </Section>

      <Section title="Customer requirement">
        <TicketRequestFields specs={specs} onSpecsChange={setSpecs} files={files} onFilesChange={setFiles} requireFiles />
      </Section>

      <Button type="submit" className="h-12 w-full sm:w-auto sm:self-end sm:px-8" disabled={createTicket.isPending}>
        {createTicket.isPending ? 'Creating ticket…' : 'Create ticket'}
      </Button>
    </form>
  );
}
