import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileRepository } from "../analyzer.js";
import { repositoryRefresh, repositoryStatus } from "../services.js";
import { loadBrain, saveBrain } from "../storage.js";

async function fixtureRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "compylar-status-"));
  await mkdir(path.join(root, "src"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ name: "status-fixture", scripts: { test: "vitest" } }),
  );
  await writeFile(path.join(root, "README.md"), "# Fixture\n");
  await writeFile(path.join(root, "src", "main.ts"), "export const answer = 42;\n");
  await writeFile(path.join(root, "src", "removed.ts"), "export const removed = true;\n");
  const brain = await compileRepository(root, { ai: false, progress: false });
  await saveBrain(root, brain);
  return root;
}

describe("knowledge status", () => {
  it("detects source, documentation, configuration, manifest, lockfile, additions, and deletions", async () => {
    const root = await fixtureRoot();
    await writeFile(path.join(root, "src", "main.ts"), "export const answer = 43;\n");
    await writeFile(path.join(root, "README.md"), "# Updated fixture\n");
    await writeFile(path.join(root, "tsconfig.json"), "{\"compilerOptions\":{}}\n");
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "status-fixture", version: "2.0.0" }));
    await writeFile(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    await writeFile(path.join(root, "src", "added.ts"), "export {};\n");
    await rm(path.join(root, "src", "removed.ts"));

    const status = await repositoryStatus(root);

    expect(status.stale).toBe(true);
    expect(status.changed).toEqual(expect.arrayContaining(["README.md", "package.json", "src/main.ts"]));
    expect(status.added).toEqual(expect.arrayContaining(["pnpm-lock.yaml", "src/added.ts", "tsconfig.json"]));
    expect(status.deleted).toContain("src/removed.ts");
  });

  it("refreshes stale knowledge with cache reuse and leaves a current baseline", async () => {
    const root = await fixtureRoot();
    await writeFile(path.join(root, "README.md"), "# Changed fixture\n");

    const refreshed = await repositoryRefresh(root, { ai: false, progress: false });

    expect(refreshed.refreshed).toBe(true);
    expect(refreshed.before.stale).toBe(true);
    expect(refreshed.after.stale).toBe(false);
    expect(refreshed.brain?.compiledAt).toBeTruthy();
  });

  it("keeps pre-manifest Brains compatible through their source hashes", async () => {
    const root = await fixtureRoot();
    const brain = await compileRepository(root, { ai: false, progress: false });
    delete brain.trackedFiles;
    await saveBrain(root, brain);

    expect((await repositoryStatus(root)).stale).toBe(false);
    await writeFile(path.join(root, "src", "main.ts"), "export const answer = 44;\n");
    expect((await repositoryStatus(root)).changed).toContain("src/main.ts");
  });

  it("loads a historical v2 Brain that predates status and analysis fields", async () => {
    const root = await fixtureRoot();
    const brain = await compileRepository(root, { ai: false, progress: false });
    const legacy = { ...brain } as Record<string, unknown>;
    delete legacy.status;
    delete legacy.analysis;
    await writeFile(path.join(root, ".compylar", "brain.json"), JSON.stringify(legacy));

    await expect(loadBrain(root)).resolves.toMatchObject({
      status: "complete",
      analysis: expect.objectContaining({ filesAnalyzed: 2 }),
    });
  });
});
