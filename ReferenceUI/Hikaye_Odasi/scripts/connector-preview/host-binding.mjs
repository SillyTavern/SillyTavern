import { Readable } from "node:stream";
import { setMaxListeners } from "node:events";
import getRawBody from "raw-body";
import { z } from "zod/v4";
import {
  grantSchema,
  invocationSchema,
  sessionOptionsSchema,
} from "./protocol.mjs";

// Checks connector calls while the agent builds and tests a Site locally.
// connector-preview-session.mjs uses this helper after the agent chooses the read
// actions the Site may use. For each Site request, it checks that selection and
// the session limits before asking the agent to make the actual tool call.
// It also handles timeouts, shutdown, and which result fields reach the Site.
// This runs in the agent's temporary session, not in the deployed Site.
const messages = {
  invalid_request: "This app request is invalid or too large.",
  binding_unavailable:
    "Connected apps need an active agent preview session in this preview.",
  tool_not_allowed: "This preview cannot use the requested app action.",
  rate_limited:
    "A request limit was reached while using this connector. Please wait before trying again.",
  tool_error: "An error was reported while running this connector action.",
  upstream_error:
    "The app did not return a confirmed result. The action may have completed; check before trying again.",
};
const failure = (status) => ({ status, message: messages[status] });
const reply = (result) =>
  Response.json(result, { headers: { "Cache-Control": "no-store" } });
const requestIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9._:-]{1,128}$/)
  .optional()
  .catch(undefined);
const resultSchema = z.object({
  error: z.never().optional(),
  status: z.never().optional(),
  content: z.array(z.object({ type: z.string() }).catchall(z.json())),
  structuredContent: z.json().optional(),
  isError: z.boolean().optional(),
  requestId: requestIdSchema,
});

export function createPreviewBinding({ tools, ...options }) {
  const { lifetimeMs, timeoutMs, maxCalls, maxConcurrent } =
    sessionOptionsSchema.parse(options);
  const grants = new Map();
  for (const tool of tools) {
    const { invoke, ...grant } = tool;
    if (!grantSchema.safeParse(grant).success || typeof invoke !== "function")
      throw new Error(
        "Preview tools must be authenticated, resolved read actions.",
      );
    const key = JSON.stringify([tool.connectorId, tool.actionName]);
    if (grants.has(key))
      throw new Error(
        "Ambiguous connector action; the host must resolve its connection first.",
      );
    grants.set(key, tool.invoke);
  }
  const expiresAt =
    lifetimeMs === undefined ? Infinity : Date.now() + lifetimeMs;
  const ended = new AbortController();
  setMaxListeners(maxConcurrent, ended.signal);
  const expiry =
    lifetimeMs === undefined
      ? undefined
      : setTimeout(() => ended.abort(), lifetimeMs);
  expiry?.unref();
  let remaining = maxCalls ?? Infinity;
  let active = 0;

  return {
    close() {
      clearTimeout(expiry);
      ended.abort();
    },
    async fetch(request) {
      if (ended.signal.aborted || Date.now() >= expiresAt)
        return reply(failure("binding_unavailable"));
      if (
        request.method !== "POST" ||
        new URL(request.url).pathname !== "/invoke"
      )
        return reply(failure("invalid_request"));
      let call;
      try {
        const body = await readBounded(request, 65536);
        call = invocationSchema.parse(JSON.parse(body));
      } catch {
        return reply(failure("invalid_request"));
      }
      // Recheck after reading the request; shutdown can happen while it streams.
      if (ended.signal.aborted || Date.now() >= expiresAt)
        return reply(failure("binding_unavailable"));
      const invoke = grants.get(
        JSON.stringify([call.connectorId, call.actionName]),
      );
      if (!invoke || remaining === 0) return reply(failure("tool_not_allowed"));
      if (active >= maxConcurrent) return reply(failure("rate_limited"));
      active++;
      remaining--;
      let deadline;
      let onEnd;
      try {
        const result = await Promise.race([
          // A timeout ends our wait, not the provider call. Count that work
          // against concurrency until it settles, without blocking other slots.
          Promise.resolve()
            .then(() => invoke(call.arguments))
            .then(publicResult)
            .finally(() => {
              active--;
            }),
          new Promise((resolve) => {
            deadline = setTimeout(
              () => resolve(failure("upstream_error")),
              timeoutMs,
            );
          }),
          new Promise((resolve) => {
            onEnd = () => resolve(failure("upstream_error"));
            ended.signal.addEventListener("abort", onEnd, { once: true });
          }),
        ]);
        if (ended.signal.aborted || Date.now() >= expiresAt)
          return reply(failure("upstream_error"));
        if (
          new TextEncoder().encode(JSON.stringify(result)).byteLength >
          8 * 1024 * 1024
        )
          return reply(failure("upstream_error"));
        return reply(result);
      } catch {
        return reply(failure("upstream_error"));
      } finally {
        clearTimeout(deadline);
        ended.signal.removeEventListener("abort", onEnd);
      }
    },
  };
}

export async function readBounded(request, limit) {
  if (!request.body) throw new Error("Missing body");
  const stream = Readable.fromWeb(request.body);
  try {
    // raw-body owns byte limits and stream errors; strict decoding rejects
    // malformed UTF-8 instead of silently changing the caller's arguments.
    return new TextDecoder("utf-8", { fatal: true }).decode(
      await getRawBody(stream, { limit }),
    );
  } finally {
    stream.destroy();
  }
}

function publicResult(result) {
  const parsed = resultSchema.safeParse(result);
  if (!parsed.success) return failure("upstream_error");
  result = parsed.data;
  // Native tools return MCP results; convert once at the preview host boundary.
  // Never accept provider-authored top-level status or transport metadata.
  const payload = {
    content: result.content,
    // Like the hosted binding, preserve every JSON value, including null.
    ...(result.structuredContent !== undefined
      ? { structuredContent: result.structuredContent }
      : {}),
  };
  const requestId =
    result.requestId === undefined ? {} : { requestId: result.requestId };
  if (result.isError === true) {
    const detail = result.structuredContent;
    if (detail?.error_code === "RATE_LIMITED") {
      const retryAfterMs =
        readRetryAfterMs(detail.retry_after_seconds) ??
        readRetryAfterMs(detail.retry_after);
      return {
        ...failure("rate_limited"),
        ...requestId,
        ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
      };
    }
    const invalidArguments =
      detail?.error_code === "INVALID_ARGUMENT" &&
      detail.error_data?.type === "invalid_action_arguments" &&
      detail.error_data?.failure_stage === "argument_binding";
    return {
      ...failure(invalidArguments ? "invalid_request" : "tool_error"),
      result: payload,
      ...requestId,
    };
  }
  return { status: "success", result: payload, ...requestId };
}

function readRetryAfterMs(value) {
  let milliseconds;
  if (
    typeof value === "number" ||
    (typeof value === "string" && /^\d+$/.test(value.trim()))
  ) {
    milliseconds = Number(value) * 1000;
  } else if (
    typeof value === "string" &&
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(
      value.trim(),
    )
  ) {
    milliseconds = Math.max(0, Date.parse(value) - Date.now());
  }
  return Number.isSafeInteger(milliseconds) && milliseconds >= 0
    ? milliseconds
    : undefined;
}
