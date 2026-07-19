import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { benchmarkRepository } from "../benchmark.js";

describe("repository benchmark", () => {
  it("reports selected context, detected changes, reusable memory, and elapsed operations", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "compylar-benchmark-"));
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "benchmark-fixture" }));
    await writeFile(path.join(root, "src", "dashboard.ts"), "export const dashboard = 'ready';\n");
    await writeFile(path.join(root, "src", "other.ts"), "export const other = true;\n");
    let tick = 0;

    const report = await benchmarkRepository({
      root,
      task: "explain dashboard",
      mutate: () => writeFile(path.join(root, "src", "dashboard.ts"), "export const dashboard = 'updated';\n"),
      now: () => ++tick,
    });

    expect(report.selectedFiles).toContain("src/dashboard.ts");
    expect(report.change.changed).toContain("src/dashboard.ts");
    expect(report.memory.updated).toContain("module:src/dashboard.ts");
    expect(report.memory.reused).toContain("module:src/other.ts");
    expect(report.elapsedMs).toEqual({ compile: 1, context: 1, status: 1, refresh: 1, total: 4 });
  }, 15_000);
});
