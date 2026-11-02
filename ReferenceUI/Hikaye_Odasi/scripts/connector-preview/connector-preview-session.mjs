import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { JSONRPCClient } from "json-rpc-2.0";
import { createPreviewBinding } from "./host-binding.mjs";
import {
  driverMessageSchema,
  grantsSchema,
  sessionOptionsSchema,
} from "./protocol.mjs";

// The agent starts this script through its terminal tool after creating a local
// Site and selecting connector read actions, following references/app-integrations.md#local-preview:
//   node <site-directory>/scripts/connector-preview/connector-preview-session.mjs <site-directory> <grants.json>
// During the agent development loop, the Site preview writes requests into a shared folder.
// This script checks each request with host-binding.mjs, then asks the agent over
// stdout to call the connector. The agent returns the tool result through stdin,
// and this script writes it back for the Site. The agent stops the script when
// previewing ends; neither the browser nor a deployed Site starts this process.
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    concurrency: { type: "string" },
    "timeout-ms": { type: "string" },
    "lifetime-ms": { type: "string" },
    "max-calls": { type: "string" },
  },
});
const [project, grantsFile] = positionals;
if (positionals.length !== 2 || !path.isAbsolute(project)) {
  throw new Error(
    "Usage: node connector-preview-session.mjs <absolute-site-directory> <grants.json> [--concurrency 64] [--timeout-ms 120000] [--lifetime-ms N] [--max-calls N]",
  );
}
const limits = sessionOptionsSchema.parse(
  Object.fromEntries(
    [
      ["maxConcurrent", values.concurrency],
      ["timeoutMs", values["timeout-ms"]],
      ["lifetimeMs", values["lifetime-ms"]],
      ["maxCalls", values["max-calls"]],
    ]
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, Number(value)]),
  ),
);
const grants = grantsSchema.parse(
  JSON.parse(await readFile(grantsFile, "utf8")),
);
const root = path.join(project, ".sites-runtime", "connector-preview");
const id = randomUUID();
const directory = path.join(root, id);
const descriptor = path.join(root, "session.json");
const active = new Set();
const rpc = new JSONRPCClient(
  (message) =>
    new Promise((resolve, reject) => {
      process.stdout.write(`${JSON.stringify(message)}\n`, (error) =>
        error ? reject(error) : resolve(),
      );
    }),
);
const emit = (method, params) => rpc.notify(method, params);
let closing = false;
const binding = createPreviewBinding({
  ...limits,
  tools: grants.map((grant) => ({
    ...grant,
    async invoke(args) {
      const requestId = randomUUID();
      // JSON-RPC owns response matching and pending-call cleanup. Do not put an
      // RPC timeout here: uncertain calls occupy their slot until they settle.
      const response = await rpc.requestAdvanced({
        jsonrpc: "2.0",
        id: requestId,
        method: "invoke",
        params: {
          connectorId: grant.connectorId,
          actionName: grant.actionName,
          arguments: args,
        },
      });
      if (!closing)
        emit("receipt", { id: requestId, at: new Date().toISOString() });
      if (response.error)
        throw new Error("The agent did not confirm a connector result.");
      return response.result;
    },
  })),
});
await mkdir(directory, { recursive: true, mode: 0o700 });
try {
  // One owner per project. A crashed session must be explicitly cleaned up;
  // never silently take over another agent's connector session.
  await writeFile(
    descriptor,
    JSON.stringify({
      id,
      expiresAt:
        limits.lifetimeMs === undefined ? null : Date.now() + limits.lifetimeMs,
      timeoutMs: limits.timeoutMs,
      connectorIds: [...new Set(grants.map((grant) => grant.connectorId))],
    }),
    { flag: "wx", mode: 0o600 },
  );
} catch (error) {
  binding.close();
  await rm(directory, { recursive: true, force: true });
  throw error;
}
async function serve(name) {
  active.add(name);
  try {
    const body = await readFile(path.join(directory, name), "utf8");
    const response = await binding.fetch(
      new Request("http://preview/invoke", { method: "POST", body }),
    );
    if (!closing) {
      const output = path.join(
        directory,
        name.replace(".request", ".response"),
      );
      await writeFile(`${output}.tmp`, await response.text(), { mode: 0o600 });
      await rename(`${output}.tmp`, output);
    }
  } catch {
    // A timed-out caller can remove its request. The native call is never retried.
  } finally {
    await rm(path.join(directory, name), { force: true });
    active.delete(name);
  }
}
let scanning = false;
// The mailbox crosses network namespaces through the shared project directory.
// Atomic renames keep the reader from seeing partially written messages.
const poller = setInterval(async () => {
  if (closing || scanning) return;
  scanning = true;
  try {
    for (const name of await readdir(directory)) {
      if (/^[0-9a-f-]{36}\.request$/.test(name) && !active.has(name))
        void serve(name);
    }
  } catch (error) {
    if (!closing) {
      emit("session_error", { code: error.code });
      void close();
    }
  } finally {
    scanning = false;
  }
}, 50);
const expiry =
  limits.lifetimeMs === undefined
    ? undefined
    : setTimeout(() => {
        void close();
      }, limits.lifetimeMs);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
const input = createInterface({ input: process.stdin, terminal: false });
input.on("line", (line) => {
  try {
    const message = driverMessageSchema.parse(JSON.parse(line));
    if (message.method === "stop") {
      void close();
      return;
    }
    rpc.receive(message);
  } catch {
    emit("invalid_driver_message");
  }
});
async function close() {
  if (closing) return;
  closing = true;
  clearInterval(poller);
  clearTimeout(expiry);
  binding.close();
  rpc.rejectAllPendingRequests("The connector preview session ended.");
  await rm(descriptor, { force: true });
  await rm(directory, { recursive: true, force: true });
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  input.close();
  process.stdin.pause();
  emit("closed");
}
input.on("close", () => {
  void close();
});
process.stdin.on("data", (chunk) => {
  if (chunk.includes(3)) void close();
});
process.on("SIGTERM", () => {
  void close();
});
process.on("SIGINT", () => {
  void close();
});
emit("ready", {
  expiresInSeconds:
    limits.lifetimeMs === undefined ? null : limits.lifetimeMs / 1000,
  maxCalls: limits.maxCalls ?? null,
  maxConcurrent: limits.maxConcurrent,
  timeoutMs: limits.timeoutMs,
});
