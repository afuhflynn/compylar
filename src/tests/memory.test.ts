import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileRepository } from "../analyzer.js";
import { buildContext } from "../context.js";
import { repositoryRefresh } from "../services.js";
import { saveBrain } from "../storage.js";

async function fixtureRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "compylar-memory-"));
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "memory-fixture" }));
  await writeFile(path.join(root, "README.md"), "# Memory fixture\n");
  await writeFile(path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: {} }));
  await writeFile(path.join(root, "src", "index.ts"), "export * from './alpha.js';\n");
  await writeFile(path.join(root, "src", "alpha.ts"), "export const alpha = 1;\n");
  await writeFile(path.join(root, "src", "beta.ts"), "export const beta = 2;\n");
  const brain = await compileRepository(root, { ai: false, progress: false });
  await saveBrain(root, brain);
  return { root, brain };
}

describe("Repository Memory", () => {
  it("derives typed, evidence-backed chunks from verified repository facts", async () => {
    const { brain } = await fixtureRoot();

    expect(brain.memory?.schemaVersion).toBe(1);
    expect(brain.memory?.chunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "module:src/alpha.ts",
          kind: "module",
          sourcePaths: ["src/alpha.ts"],
          evidence: expect.arrayContaining([
            expect.objectContaining({ source: "src/alpha.ts" }),
          ]),
        }),
        expect.objectContaining({ id: "package:." }),
        expect.objectContaining({ id: "documentation:README.md", kind: "documentation" }),
        expect.objectContaining({ id: "configuration:tsconfig.json", kind: "configuration" }),
        expect.objectContaining({ id: "entry-point:src/index.ts", kind: "entry-point" }),
      ]),
    );
  });

  it("refreshes only chunks whose source evidence changed", async () => {
    const { root, brain: before } = await fixtureRoot();
    const unchanged = before.memory?.chunks.find(
      (chunk) => chunk.id === "module:src/beta.ts",
    );
    await writeFile(path.join(root, "src", "alpha.ts"), "export const alpha = 3;\n");

    const refreshed = await repositoryRefresh(root, { ai: false, progress: false });
    const chunks = refreshed.brain?.memory?.chunks ?? [];

    expect(refreshed.brain?.memory?.changes.updated).toContain("module:src/alpha.ts");
    expect(chunks.find((chunk) => chunk.id === "module:src/beta.ts")).toEqual(unchanged);
  });

  it("includes task-relevant chunks in deterministic agent context", async () => {
    const { brain } = await fixtureRoot();
    const context = buildContext(brain, "explain alpha");

    expect(context.memoryChunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "repository:root" }),
        expect.objectContaining({ id: "module:src/alpha.ts" }),
      ]),
    );
  });
});
