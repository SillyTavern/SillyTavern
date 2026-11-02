import { readFileSync } from "node:fs";

export function readExecutionProfile() {
  let settings;
  try {
    settings = JSON.parse(readFileSync(new URL("../.sites-runtime/execution-profile.json", import.meta.url), "utf8"));
  } catch (error) {
    // Clean clones and remote builds have no checkout-local selection.
    if (error.code === "ENOENT") return "portable";
    throw error;
  }
  if (!["managed-linux", "portable"].includes(settings?.executionProfile)) {
    throw new Error("Invalid local execution profile; rerun the Sites plugin's configure-execution-profile.mjs.");
  }
  return settings.executionProfile;
}
