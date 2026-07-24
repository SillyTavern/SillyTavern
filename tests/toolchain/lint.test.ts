import { describe, it } from "bun:test";
import { spawnSync } from "node:child_process";

describe("toolchain contract: lint", () => {
  it("runs Biome without configuration errors (code-level findings allowed)", () => {
    const res = spawnSync("bun", ["run", "lint"], { encoding: "utf8" });
    const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
    // A config error would say "configuration resulted in errors" or "Found an unknown key".
    // Pre-existing code issues (exit 1) are expected and deferred per Step 0 spec.
    if (/configuration resulted in errors|Found an unknown key/i.test(out)) {
      throw new Error("Biome lint failed with a CONFIG error:\n" + out);
    }
  });
});
