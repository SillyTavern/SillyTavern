import { describe, it } from "bun:test";
import { spawnSync } from "node:child_process";

describe("toolchain contract: typecheck", () => {
  it("resolves tsconfig.base.json without config errors (exit 0)", () => {
    const res = spawnSync("bun", ["run", "typecheck"], { encoding: "utf8" });
    if (res.status !== 0) {
      throw new Error(
        `typecheck exited ${res.status}\n${res.stdout ?? ""}${res.stderr ?? ""}`,
      );
    }
  });
});
