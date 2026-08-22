// src/validators/customerProfileSchema.js
//
// Guards the ONE thing that matters at this boundary: that we're about to
// key a Mongo document on a real Ornaverse party_id, and that what we're
// storing is actually an object. We deliberately do NOT enumerate every
// CustomerRow field here — that's Ornaverse's own schema, it can carry any
// field, and re-declaring it here would just drift out of sync with theirs
// over time (the same trap this codebase has avoided everywhere else, e.g.
// checkoutSchema.js never re-derives OrnaVerse's own document shapes).

import { z } from 'zod';

export const customerProfileSchema = z.object({
  party_id: z.number().int().positive(),
  profile:  z.record(z.string(), z.any()),
});
