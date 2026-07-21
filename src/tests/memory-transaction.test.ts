import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileRepository } from "../analyzer.js";
import { repositoryCommitMemory, repositoryMemoryReview, repositorySystems } from "../services.js";
import { saveBrain } from "../storage.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "compylar-memory-transaction-"));
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "memory-transaction" }));
  await writeFile(path.join(root, "src", "auth.ts"), "export function requireAuth() { return true; }\n");
  const brain = await compileRepository(root, { ai: false, progress: false });
  await saveBrain(root, brain);
  return root;
}

describe("memory transactions", () => {
  it("reviews deep work and commits a system-scoped durable fact", async () => {
    const root = await fixture();
    await expect(repositoryMemoryReview(root, "harden auth", ["src/auth.ts"])).resolves.toMatchObject({ requiresReview: true, uncovered: expect.arrayContaining(["flow"]) });
    await repositoryCommitMemory(root, {
      schemaVersion: 1, task: "harden auth",
      findings: [{ key: "auth-guard", kind: "constraint", summary: "Server actions require the auth guard.", systems: ["authentication"], confidence: "high", sources: [{ path: "src/auth.ts", startLine: 1, endLine: 1 }] }],
    });
    await expect(repositorySystems(root, "auth")).resolves.toMatchObject([{ name: "authentication", coverage: ["constraint"] }]);
  }, 15_000);

  it("supersedes a stable fact rather than appending competing architecture claims", async () => {
    const root = await fixture();
    const manifest = (summary: string) => ({ schemaVersion: 1 as const, task: "auth research", findings: [{ key: "auth-guard", kind: "constraint" as const, summary, systems: ["authentication"], confidence: "high" as const, sources: [{ path: "src/auth.ts", startLine: 1, endLine: 1 }] }] });
    await repositoryCommitMemory(root, manifest("The guard is required."));
    await repositoryCommitMemory(root, manifest("The guard is required before server actions."));
    const systems = await repositorySystems(root, "auth");
    expect(systems[0]?.findings).toHaveLength(1);
    expect(systems[0]?.findings[0]?.summary).toContain("before server actions");
  }, 15_000);

  it("requires a cited dismissal when no durable finding is produced", async () => {
    const root = await fixture();
    await expect(repositoryCommitMemory(root, { schemaVersion: 1, task: "inspect auth", findings: [] })).rejects.toThrow(/finding or a cited dismissal/i);
    await expect(repositoryCommitMemory(root, { schemaVersion: 1, task: "inspect auth", findings: [], dismissal: { reason: "No reusable behavior was discovered.", sources: [{ path: "src/auth.ts", startLine: 1, endLine: 1 }] } })).resolves.toMatchObject({ committed: 1 });
  }, 15_000);
});
