import { z } from "zod/v4";

/** Validate and project runtime results onto the public connector response. */
export function connectorResponse(result: unknown): Response {
  try {
    // Keep server-only parsing lazy so client recovery UI can tree-shake it out.
    const requestId = z
      .string()
      .regex(/^[A-Za-z0-9._:-]{1,128}$/)
      .optional()
      .catch(undefined);
    const envelope = {
      error: z.never().optional(),
      content: z.never().optional(),
      structuredContent: z.never().optional(),
      isError: z.never().optional(),
      requestId,
    };
    const content = z.object({
      content: z.array(z.object({ type: z.string() }).catchall(z.json())),
      structuredContent: z.json().optional(),
      isError: z.never().optional(),
      error: z.never().optional(),
    });
    const failure = z.object({
      ...envelope,
      status: z
        .string()
        .min(1)
        .refine((value) => value !== "success"),
      message: z.string().min(1),
      retryAfterMs: z.number().int().nonnegative().safe().optional(),
      result: content.optional(),
    });
    const success = z.object({
      ...envelope,
      status: z.literal("success"),
      result: content,
      message: z.never().optional(),
      retryAfterMs: z.never().optional(),
    });
    const schema =
      result !== null &&
      typeof result === "object" &&
      "status" in result &&
      result.status === "success"
        ? success
        : failure;
    const parsed = schema.safeParse(result);
    if (parsed.success) {
      // As in the binding contract, JSON status determines the outcome.
      return Response.json(parsed.data, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
  } catch {
    // Cyclic or otherwise non-serializable runtime values are also unconfirmed.
  }
  return Response.json(
    {
      status: "upstream_error",
      message:
        "The app did not return a confirmed result. The action may have completed; check before trying again.",
    },
    { status: 502, headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Presentation only. The caller supplies the starter's server-generated SIWC URL. */
export function connectorErrorRecovery(
  error: { status: string; message: string },
  connectorName: string,
  reconnectHref: string,
): { message: string; action?: { label: string; href: string } } {
  if (error.status === "reauthentication_required") {
    return {
      message: error.message,
      action: { label: `Connect ${connectorName}`, href: reconnectHref },
    };
  }
  // Other outcomes do not prove that consent is missing or that replay is safe.
  return { message: error.message };
}
