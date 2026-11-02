import { WorkerEntrypoint } from "cloudflare:workers";
import binding from "virtual:sites-connector-preview";

// Local-only RPC target. The Site entrypoint scopes it to each request; the Node
// adapter relays each call to the owning agent.
export class ConnectorPreview extends WorkerEntrypoint {
  async getContext() {
    return binding.getContext?.() ?? { status: "binding_unavailable" };
  }

  async invoke(connectorId, actionName, args) {
    return binding.invoke(connectorId, actionName, args);
  }
}
const worker = { fetch() { return new Response("Not found", { status: 404 }); } };

export default worker;
