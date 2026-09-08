// src/validators/walkInSchema.js
//
// Guards the walk-in record POST body — see lib/mongo/walkins.js for why
// this collection exists at all (OrnaVerse has no listing endpoint for
// this data, so this app keeps its own log).

import { z } from 'zod';

export const recordWalkInSchema = z.object({
  mobile:           z.string().min(1),
  customerName:     z.string().nullable().optional(),
  walkInCustomerId: z.number().int().nullable().optional(),
  company_id:       z.number().int().positive(),
  companyName:      z.string().nullable().optional(),
  companyCode:      z.string().nullable().optional(),
  agentUsername:    z.string().nullable().optional(),
});
