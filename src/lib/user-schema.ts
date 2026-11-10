import { z } from 'astro/zod';

// one schema for the form and the API, so they can't drift apart.
// The z.string({ error }) messages cover a missing or non-string field (API callers), not just bad values.
export const createUserSchema = z.object({
  email: z
    .string({ error: 'Enter a valid email address' })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Enter a valid email address' }).max(254)),
  name: z
    .string({ error: 'Enter your name' })
    .trim()
    .min(1, { error: 'Enter your name' })
    .max(100, { error: 'Name is too long' }),
});

// email is the identity key, so PATCH only touches name (strict = unknown keys get a 400)
export const updateUserSchema = createUserSchema.pick({ name: true }).strict();

export const listQuerySchema = z.object({
  cursor: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

// field -> first message, the shape the form needs to paint errors inline
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}
