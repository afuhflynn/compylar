import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileRepository } from "../analyzer.js";
import { repositoryLearn, repositoryMemory, repositoryRefresh } from "../services.js";
import { saveBrain } from "../storage.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "compylar-learning-"));
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "learning-fixture" }));
  await writeFile(path.join(root, "src", "auth.ts"), "export function requireAuth() { return true; }\n");
  const brain = await compileRepository(root, { ai: false, progress: false });
  await saveBrain(root, brain);
  return root;
}

describe("learned repository memory", () => {
  it("requires cited source evidence for agent discoveries and returns the stored finding", async () => {
    const root = await fixture();
    await expect(repositoryLearn(root, { kind: "flow", summary: "Auth guard protects server actions.", authority: "agent" })).rejects.toThrow("requires at least one");
    const finding = await repositoryLearn(root, {
      kind: "flow", summary: "Auth guard protects server actions.", authority: "agent",
      sources: [{ path: "src/auth.ts", startLine: 1, endLine: 1 }],
    });
    expect(finding.sources[0]?.sourceHash).toBeTruthy();
    await expect(repositoryMemory(root, { query: "guard" })).resolves.toMatchObject({
      learnedFindings: [expect.objectContaining({ id: finding.id, state: "current" })],
    });
  }, 15_000);

  it("marks cited agent learning stale when its evidence changes", async () => {
    const root = await fixture();
    await repositoryLearn(root, {
      kind: "constraint", summary: "Authentication is required.", authority: "agent",
      sources: [{ path: "src/auth.ts", startLine: 1, endLine: 1 }],
    });
    await writeFile(path.join(root, "src", "auth.ts"), "export function requireAuth() { return false; }\n");
    const refreshed = await repositoryRefresh(root, { ai: false, progress: false });
    expect(refreshed.brain?.learnedMemory?.findings[0]).toMatchObject({ state: "stale" });
  }, 15_000);
});
