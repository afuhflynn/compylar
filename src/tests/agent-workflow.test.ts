import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { repositoryBootstrap, repositoryIngestIndex, repositorySync } from "../services.js";
import { loadBrain } from "../storage.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "compylar-workflow-"));
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "workflow-fixture" }));
  await writeFile(path.join(root, "src", "service.ts"), "export const service = 1;\n");
  await writeFile(path.join(root, "src", "app.ts"), "import { service } from './service.js';\nexport { service };\n");
  return root;
}

async function completeSemanticIndex(root: string) {
  const baseline = await repositoryBootstrap(root, { ai: false, progress: false });
  const artifact = "# Codebase Index\n\n- Service flow (source: `src/service.ts:1-1`)\n";
  await writeFile(path.join(root, "CODEBASE_INDEX.md"), artifact);
  await writeFile(path.join(root, ".compylar", "semantic-index.json"), JSON.stringify({
    schemaVersion: 1, producer: { name: "codebase-index", version: "test" }, generatedAt: new Date().toISOString(), brainFingerprint: baseline.fingerprint,
    artifact: { path: "CODEBASE_INDEX.md", sha256: crypto.createHash("sha256").update(artifact).digest("hex") },
    verification: { complete: true, blockers: [] }, coverage: ["foundation", "system", "flow", "contract", "test-guarantee", "convention", "unknown"], unknowns: [],
    findings: [{ key: "service-flow", kind: "flow", summary: "The service module is consumed by the application entry module.", confidence: "high", sources: [{ path: "src/service.ts", startLine: 1, endLine: 1 }] }],
  }, null, 2));
  await repositoryIngestIndex(root);
  return baseline;
}

describe("agent memory workflow", () => {
  it("bootstraps a deterministic baseline and returns the required semantic-memory checklist", async () => {
    const root = await fixture();
    const result = await repositoryBootstrap(root, { ai: false, progress: false });
    expect(result).toMatchObject({ created: true, nextAction: "full-index" });
    expect(result.requiredFindings).toEqual(expect.arrayContaining(["foundation", "system", "flow", "unknown"]));
  }, 15_000);

  it("ingests a complete cited deep index and does not require another full index", async () => {
    const root = await fixture();
    await expect(completeSemanticIndex(root)).resolves.toBeDefined();
    await expect(repositoryBootstrap(root, { ai: false, progress: false })).resolves.toMatchObject({ created: false, nextAction: "retrieve-memory" });
    await expect(repositorySync(root)).resolves.toMatchObject({ action: "current" });
    await expect(loadBrain(root)).resolves.toMatchObject({ semanticIndex: { status: "complete" } });
  }, 15_000);

  it("rejects an uncited or incomplete deep index instead of marking semantic memory complete", async () => {
    const root = await fixture();
    const baseline = await repositoryBootstrap(root, { ai: false, progress: false });
    const artifact = "# Codebase Index\n";
    await writeFile(path.join(root, "CODEBASE_INDEX.md"), artifact);
    await writeFile(path.join(root, ".compylar", "semantic-index.json"), JSON.stringify({
      schemaVersion: 1, producer: { name: "codebase-index", version: "test" }, generatedAt: new Date().toISOString(), brainFingerprint: baseline.fingerprint,
      artifact: { path: "CODEBASE_INDEX.md", sha256: crypto.createHash("sha256").update(artifact).digest("hex") },
      verification: { complete: true, blockers: [] }, coverage: ["foundation"], unknowns: [], findings: [],
    }));
    await expect(repositoryIngestIndex(root)).rejects.toThrow(/incomplete/i);
    await expect(repositorySync(root)).resolves.toMatchObject({ action: "semantic-index" });
  }, 15_000);

  it("uses a bounded delta sync for ordinary source changes and includes direct dependents", async () => {
    const root = await fixture();
    await completeSemanticIndex(root);
    await writeFile(path.join(root, "src", "service.ts"), "export const service = 2;\n");
    await expect(repositorySync(root)).resolves.toMatchObject({
      action: "delta-index",
      changedPaths: ["src/service.ts"],
      affectedPaths: expect.arrayContaining(["src/service.ts", "src/app.ts"]),
    });
  }, 15_000);

  it("escalates routing and manifest changes to a structural deep index", async () => {
    const root = await fixture();
    await completeSemanticIndex(root);
    await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "workflow-fixture", version: "2.0.0" }));
    await expect(repositorySync(root)).resolves.toMatchObject({ action: "structural-index" });
  }, 15_000);
});
