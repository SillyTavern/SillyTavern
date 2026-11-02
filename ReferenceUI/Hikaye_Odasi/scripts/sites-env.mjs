import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureToolEnvironment } from "./tool-environment.mjs";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
configureToolEnvironment(projectRoot);

process.chdir(projectRoot);
for (const directory of [
  path.dirname(process.env.WRANGLER_LOG_PATH),
  process.env.WRANGLER_REGISTRY_PATH,
  process.env.MINIFLARE_REGISTRY_PATH,
]) {
  mkdirSync(directory, { recursive: true });
}
