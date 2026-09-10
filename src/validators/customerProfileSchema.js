// src/validators/customerProfileSchema.js
// Guards party_id + profile object shape only — deliberately does not
// enumerate CustomerRow fields, since that's OrnaVerse's schema to own
// and would drift out of sync if re-declared here.

import { z } from 'zod';

export const customerProfileSchema = z.object({
  party_id: z.number().int().positive(),
  profile:  z.record(z.string(), z.any()),
});
