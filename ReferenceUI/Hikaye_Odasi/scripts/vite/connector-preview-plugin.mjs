import { randomUUID } from "node:crypto";
import { access, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import getRawBody from "raw-body";

const moduleId = "virtual:sites-connector-preview";
const resolvedId = `\0${moduleId}`;
const endpoint = "/__sites_connector_preview/invoke";
const contextEndpoint = "/__sites_connector_preview/context";
const unavailable = {
  status: "binding_unavailable",
  message:
    "Connected apps need an active agent preview session in this preview.",
};
const uncertain = {
  status: "upstream_error",
  message:
    "The app did not return a confirmed result. The action may have completed; check before trying again.",
};

// A development-only adapter. The shared project directory connects the preview
// process to its owning agent even when they use different network namespaces.
export function connectorPreview() {
  const bridgeToken = randomUUID();
  let root;
  let server;
  async function readSession() {
    const session = JSON.parse(
      await readFile(path.join(root, "session.json"), "utf8"),
    );
    if (
      !/^[0-9a-f-]{36}$/.test(session.id) ||
      (session.expiresAt !== null && !(session.expiresAt > Date.now()))
    )
      throw new Error("Session ended");
    if (
      !Number.isInteger(session.timeoutMs) ||
      session.timeoutMs <= 0 ||
      session.timeoutMs > 2 ** 31 - 1
    )
      throw new Error("Invalid session deadline");
    return session;
  }
  return {
    name: "sites-connector-preview",
    apply: "serve",
    config(config) {
      return {
        server: {
          host: config.server?.host ?? "127.0.0.1",
          strictPort: true,
          fs: {
            deny: [
              ".env",
              ".env.*",
              "*.{crt,pem}",
              "**/.git/**",
              "**/.sites-runtime/**",
            ],
          },
          watch: { ignored: ["**/.sites-runtime/**"] },
        },
      };
    },
    configResolved(config) {
      root = path.join(config.root, ".sites-runtime", "connector-preview");
    },
    resolveId(id) {
      if (id === moduleId) return resolvedId;
    },
    load(id, options) {
      if (id !== resolvedId) return;
      if (
        this.environment?.name === "client" ||
        (!this.environment && !options?.ssr)
      ) {
        throw new Error(
          "Connected apps are only available in Site server routes.",
        );
      }
      // Auxiliary Workers load before Vite starts listening. strictPort keeps
      // this configured address stable when the server opens its socket.
      const url = `http://127.0.0.1:${server.config.server.port}${endpoint}`;
      const contextUrl = `http://127.0.0.1:${server.config.server.port}${contextEndpoint}`;
      return `export default { async getContext() {
        try {
          const response = await fetch(${JSON.stringify(contextUrl)}, {
            headers: { "X-Sites-Preview": ${JSON.stringify(bridgeToken)} }
          });
          return response.json();
        } catch { return { status: "upstream_error" }; }
      }, async invoke(connectorId, actionName, args) {
        const response = await fetch(${JSON.stringify(url)}, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Sites-Preview": ${JSON.stringify(bridgeToken)} },
          body: JSON.stringify({connectorId, actionName, arguments: args})
        });
        return response.json();
      } };`;
    },
    configureServer(vite) {
      server = vite;
      vite.middlewares.use(contextEndpoint, async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json");
        if (
          req.method !== "GET" ||
          req.headers["x-sites-preview"] !== bridgeToken
        ) {
          res.statusCode = 403;
          res.end(JSON.stringify(unavailable));
          return;
        }
        try {
          const session = await readSession();
          // Preview grants do not establish hosted catalog visibility.
          if (
            !Array.isArray(session.connectorIds) ||
            !session.connectorIds.every((id) => typeof id === "string")
          )
            throw new Error("Missing selected connectors");
          res.end(
            JSON.stringify({
              status: "success",
              connectors: session.connectorIds.map((connectorId) => ({
                connectorId,
                policy: "enabled",
                tools: null,
              })),
            }),
          );
        } catch {
          res.end(JSON.stringify({ status: "binding_unavailable" }));
        }
      });
      vite.middlewares.use(endpoint, async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json");
        if (
          req.method !== "POST" ||
          req.headers["x-sites-preview"] !== bridgeToken
        ) {
          res.statusCode = 403;
          res.end(JSON.stringify(unavailable));
          return;
        }
        let requestPath;
        let responsePath;
        let submitted = false;
        try {
          const session = await readSession();
          const raw = await getRawBody(req, { limit: 65536 });
          const call = JSON.parse(
            new TextDecoder("utf-8", { fatal: true }).decode(raw),
          );
          const body = JSON.stringify(call);
          const directory = path.join(root, session.id);
          const id = randomUUID();
          requestPath = path.join(directory, `${id}.request`);
          responsePath = path.join(directory, `${id}.response`);
          await writeFile(`${requestPath}.tmp`, body, { mode: 0o600 });
          await rename(`${requestPath}.tmp`, requestPath);
          submitted = true;
          // Read the owner's deadline per call, so a restarted session can use
          // longer provider waits without rebuilding or restarting the Site.
          const deadline = Math.min(
            session.expiresAt ?? Infinity,
            Date.now() + session.timeoutMs + 2000,
          );
          while (Date.now() < deadline) {
            try {
              res.end(await readFile(responsePath));
              return;
            } catch (error) {
              if (error.code !== "ENOENT") throw error;
              // Session shutdown removes the mailbox. Stop promptly even when
              // the configured provider deadline is several minutes away.
              await access(directory);
            }
            await delay(50);
          }
          res.end(JSON.stringify(uncertain));
        } catch {
          // raw-body pauses oversized requests; drain the remainder so the HTTP
          // connection can finish without retaining an unread request stream.
          req.resume();
          res.end(JSON.stringify(submitted ? uncertain : unavailable));
        } finally {
          await Promise.all(
            [requestPath, requestPath && `${requestPath}.tmp`, responsePath]
              .filter(Boolean)
              .map((file) => rm(file, { force: true })),
          );
        }
      });
    },
  };
}
