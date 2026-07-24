import { describe, it } from "bun:test";
import { spawnSync } from "node:child_process";

describe("toolchain contract: legacy lockfiles", () => {
  it("no legacy npm/yarn/pnpm lockfiles are git-tracked", () => {
    const res = spawnSync(
      "git",
      ["ls-files", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
      { encoding: "utf8" },
    );
    const tracked = (res.stdout ?? "").trim();
    if (tracked.length > 0) {
      throw new Error(`Legacy lockfiles still tracked:\n${tracked}`);
    }
  });
});
