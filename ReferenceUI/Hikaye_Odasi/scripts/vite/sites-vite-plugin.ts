// Vendored from @openai/sites-vite-plugin 0.2.0 (openai/sites#9).
// See sites-vite-plugin.LICENSE for the upstream MIT license.
import { access, cp, mkdir, rm } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const localUserId = "local_seedy";
const localEmail = "seedy@sites.test";
const localFullName = "Seedy";
const localCookieName = "__sites_local_auth";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const localAddresses = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const authPaths = new Set([
  "/signin-with-chatgpt",
  "/signout-with-chatgpt",
  "/callback",
]);

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export function sites({ mockAuth = true } = {}): Plugin {
  let root = process.cwd();
  let command: "build" | "serve" = "build";

  return {
    name: "sites",
    configResolved(config) {
      root = config.root;
      command = config.command;
    },
    configureServer(server) {
      if (!mockAuth) return;
      const secure = Boolean(server.config.server.https);

      server.config.logger.info(`Sites local sign-in: ${localEmail}`);
      server.middlewares.use((request, response, next) => {
        for (const name of Object.keys(request.headers)) {
          if (name.startsWith("oai-authenticated-user-")) {
            removeHeader(request, name);
          }
        }

        let authority: URL;
        let url: URL;
        try {
          authority = new URL(
            `${secure ? "https" : "http"}://${request.headers.host}`,
          );
          url = new URL(request.url ?? "/", authority);
        } catch {
          if (authPaths.has((request.url ?? "/").split("?")[0])) {
            respond(response, 403);
          } else {
            next();
          }
          return;
        }

        const hostname = authority.hostname
          .replace(/^\[|\]$/g, "")
          .toLowerCase();
        if (
          !localHosts.has(hostname) ||
          !localAddresses.has(request.socket.remoteAddress ?? "") ||
          url.origin !== authority.origin
        ) {
          if (authPaths.has(url.pathname)) respond(response, 403);
          else next();
          return;
        }

        const cookies = (request.headers.cookie ?? "")
          .split(";")
          .map((cookie) => cookie.trim())
          .filter(Boolean);
        const signInCookies = cookies
          .filter((cookie) => cookie.startsWith(`${localCookieName}=`))
          .map((cookie) => cookie.slice(localCookieName.length + 1));
        const applicationCookies = cookies.filter(
          (cookie) => !cookie.startsWith(`${localCookieName}=`),
        );
        if (applicationCookies.length !== cookies.length) {
          removeHeader(request, "cookie");
          if (applicationCookies.length) {
            setHeader(request, "cookie", applicationCookies.join("; "));
          }
        }

        if (url.pathname === "/callback") {
          respond(response, 501);
          return;
        }

        const signIn = url.pathname === "/signin-with-chatgpt";
        const signOut = url.pathname === "/signout-with-chatgpt";
        if (!signIn && !signOut) {
          if (signInCookies.length === 1 && signInCookies[0] === "1") {
            setHeader(request, "oai-authenticated-user-id", localUserId);
            setHeader(request, "oai-authenticated-user-email", localEmail);
            setHeader(
              request,
              "oai-authenticated-user-full-name",
              localFullName,
            );
            setHeader(
              request,
              "oai-authenticated-user-full-name-encoding",
              "percent-encoded-utf-8",
            );
          }
          next();
          return;
        }

        if (
          (request.headers.origin && request.headers.origin !== url.origin) ||
          request.headers["sec-fetch-site"] === "cross-site"
        ) {
          respond(response, 403);
          return;
        }

        if (
          request.headers["next-router-prefetch"] !== undefined ||
          request.headers["x-middleware-prefetch"] === "1" ||
          [request.headers.purpose, request.headers["sec-purpose"]].some(
            (value) =>
              typeof value === "string" &&
              value
                .split(/[;,]/)
                .some((part) => part.trim().toLowerCase() === "prefetch"),
          )
        ) {
          respond(response, 204);
          return;
        }

        if (
          request.method !== "GET" &&
          (!signOut || request.method !== "POST")
        ) {
          response.setHeader("Allow", signIn ? "GET" : "GET, POST");
          respond(response, 405);
          return;
        }

        response.statusCode = request.method === "POST" ? 303 : 302;
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader(
          "Location",
          safeReturn(url.searchParams.get("return_to")),
        );
        response.setHeader(
          "Set-Cookie",
          `${localCookieName}=${signIn ? "1" : ""}; Path=/; ${
            signOut ? "Max-Age=0; " : ""
          }HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
        );
        response.end();
      });
    },
    async closeBundle() {
      if (command !== "build") return;

      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfig = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      await rm(outputDirectory, { recursive: true, force: true });
      await mkdir(outputDirectory, { recursive: true });

      await cp(hostingConfig, resolve(outputDirectory, "hosting.json"));
      if (await exists(drizzleSource)) {
        await cp(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }
    },
  };
}

function removeHeader(request: IncomingMessage, name: string): void {
  delete request.headers[name];
  for (let index = request.rawHeaders.length - 2; index >= 0; index -= 2) {
    if (request.rawHeaders[index]?.toLowerCase() === name) {
      request.rawHeaders.splice(index, 2);
    }
  }
}

function setHeader(
  request: IncomingMessage,
  name: string,
  value: string,
): void {
  removeHeader(request, name);
  request.headers[name] = value;
  request.rawHeaders.push(name, value);
}

function respond(response: ServerResponse, status: number): void {
  response.statusCode = status;
  response.setHeader("Cache-Control", "private, no-store");
  response.end();
}

function safeReturn(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost" || authPaths.has(url.pathname)) {
      return "/";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
