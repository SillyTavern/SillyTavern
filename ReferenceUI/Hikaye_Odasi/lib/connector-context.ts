import { AsyncLocalStorage } from "node:async_hooks";
import type { ConnectorBinding } from "./connector-contract.mjs";

// Capture the trusted capability before Vinext derives its revalidation context,
// which does not retain custom execution-context props. Never share across requests.
const bindings = new AsyncLocalStorage<ConnectorBinding | undefined>();

export function runWithConnectorBinding<T>(
  binding: ConnectorBinding | undefined,
  run: () => T,
): T {
  return bindings.run(binding, run);
}

export function getConnectorBinding(): ConnectorBinding | undefined {
  return bindings.getStore();
}
