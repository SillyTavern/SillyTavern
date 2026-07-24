import { describe, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("toolchain contract: runtime declaration", () => {
  it("package.json declares engines.bun and does not list node as primary runtime", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    if (!pkg.engines || !pkg.engines.bun) {
      throw new Error("package.json does not declare engines.bun");
    }
    // node may appear as an override target but must not be the declared runtime.
    if (pkg.engines.node && !pkg.engines.bun) {
      throw new Error("package.json declares node as the runtime instead of bun");
    }
  });
});
