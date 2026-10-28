import { z } from 'zod';
import { TICKET_MAX_FILES } from '@/lib/ticketing/constants';

const text = (max = 100) => z.string().trim().max(max);
const optionalText = (max = 100) => z.preprocess((v) => v ?? undefined, text(max).optional()).transform((v) => v || null);
const optionalAmount = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z.coerce.number().nonnegative().nullable(),
);
const fileIds = z.array(z.string().regex(/^[a-f0-9]{32}$/)).max(TICKET_MAX_FILES);

const stoneSchema = z.object({
  item_group: text().min(1, 'Stone item group is required'),
  shape:      optionalText(),
  color:      optionalText(),
  quality:    optionalText(),
  type:       optionalText(),
  pieces:     z.coerce.number().int().positive(),
  weight:     optionalAmount,
});

export const ticketSpecsSchema = z.object({
  category:          text().min(1, 'Category is required'),
  metal:             optionalText(),
  karat:             optionalText(),
  size:              optionalText(),
  budget:            optionalAmount,
  gold_weight:       optionalAmount,
  stones:            z.array(stoneSchema).max(20).default([]),
  requirement_notes: text(2000).min(3, 'Describe the customer requirement'),
});

export const createTicketSchema = z.object({
  customer: z.object({
    party_id: z.coerce.number().int().positive(),
    name:     text(200).min(1),
    mobile:   optionalText(30),
  }),
  sales_person: z.object({
    id:   z.coerce.number().int().positive(),
    name: text(200).min(1),
  }),
  specs:    ticketSpecsSchema,
  file_ids: fileIds.min(1, 'Add at least one reference image'),
});

export const ticketActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('update_request'), specs: ticketSpecsSchema, file_ids: fileIds.default([]) }),
  z.object({ action: z.literal('approve_design'), version: z.coerce.number().int().positive() }),
  z.object({
    action:   z.literal('reject_design'),
    version:  z.coerce.number().int().positive(),
    feedback: text(2000).min(3, 'Enter the customer feedback for the CAD team'),
  }),
  z.object({ action: z.literal('cancel'), reason: text(1000).min(3, 'Enter the cancellation reason') }),
]);
