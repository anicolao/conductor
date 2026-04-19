import { z } from 'zod';

/**
 * Represents a valid JSON value.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: JsonValue }
  | JsonValue[];

/**
 * Zod schema for a valid JSON value.
 */
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.undefined(),
    z.record(z.string(), JsonValueSchema),
    z.array(JsonValueSchema),
  ])
);

/**
 * Represents a valid JSON object.
 */
export type JsonObject = { [key: string]: JsonValue };

/**
 * Zod schema for a valid JSON object.
 */
export const JsonObjectSchema = z.record(z.string(), JsonValueSchema);
