import { z } from 'zod';

/**
 * Zod validation schema for the Login form.
 * Validates username and password before the API call is made.
 */
export const loginSchema = z.object({
  username: z
    .string()
    .min(1, { message: 'Username is required' }),

  password: z
    .string()
    .min(1, { message: 'Password is required' }),
});