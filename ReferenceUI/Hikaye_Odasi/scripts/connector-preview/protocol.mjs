import { z } from "zod";

const name = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[^\s/\x00-\x1f\x7f]+$/u);
const fields = { connectorId: name, actionName: name };

// Reject extra invocation fields: account selection and native tool names belong
// to the owning agent, not to the generated Site's request envelope.
export const invocationSchema = z
  .object({ ...fields, arguments: z.record(z.unknown()) })
  .strict();
export const grantSchema = z
  .object({ ...fields, readOnly: z.literal(true) })
  .strict();
export const grantsSchema = z.array(grantSchema);

// Only the owning agent sets these limits. Sessions otherwise last until their
// owner closes them; Node timers need a signed 32-bit millisecond duration.
const duration = z
  .number()
  .int()
  .positive()
  .max(2 ** 31 - 1);
export const sessionOptionsSchema = z
  .object({
    timeoutMs: duration.default(120000),
    maxConcurrent: z.number().int().positive().safe().default(64),
    lifetimeMs: duration.optional(),
    maxCalls: z.number().int().positive().safe().optional(),
  })
  .strict();

// The pipe carries JSON-RPC responses and a stop notification. Provider failures
// still travel inside result as MCP results; JSON-RPC errors mean driver failure.
export const driverMessageSchema = z.union([
  z.object({ jsonrpc: z.literal("2.0"), method: z.literal("stop") }).strict(),
  z
    .object({
      jsonrpc: z.literal("2.0"),
      id: z.string().uuid(),
      result: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      jsonrpc: z.literal("2.0"),
      id: z.string().uuid(),
      error: z
        .object({
          code: z.number().int(),
          message: z.string(),
          data: z.unknown().optional(),
        })
        .strict(),
    })
    .strict(),
]);
