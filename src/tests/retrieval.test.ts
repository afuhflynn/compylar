import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileRepository } from "../analyzer.js";
import { repositoryLookup, repositoryRoutes } from "../services.js";

async function retrievalFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "compylar-retrieval-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ name: "retrieval-fixture", dependencies: { typescript: "^5.0.0" } }),
  );
  await writeFile(
    path.join(root, "src", "submissions.ts"),
    "export type SubmissionDetail = { id: string; score: number };\nexport const submit = () => undefined;\n",
  );
  return root;
}

describe("repository lookup", () => {
  it("returns an exact symbol definition and location without source previews", async () => {
    const root = await retrievalFixture();
    const brain = await compileRepository(root, { ai: false, progress: false });
    const result = await repositoryLookup(root, "SubmissionDetail", brain);

    expect(result.matches).toEqual([
      expect.objectContaining({
        kind: "symbol",
        match: "exact",
        name: "SubmissionDetail",
        definition: "export type SubmissionDetail = { id: string; score: number };",
        source: "src/submissions.ts",
        line: 1,
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain("preview");
  });

  it("returns evidence-backed near symbol matches when an exact type is absent", async () => {
    const root = await retrievalFixture();
    const brain = await compileRepository(root, { ai: false, progress: false });
    const result = await repositoryLookup(root, "SubmissionResult", brain);

    expect(result.matches).toEqual([
      expect.objectContaining({
        kind: "symbol",
        match: "partial",
        name: "SubmissionDetail",
        source: "src/submissions.ts",
      }),
    ]);
  });

  it("filters verified routes without reopening source files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "compylar-routes-"));
    await mkdir(path.join(root, "app", "api", "challenges"), { recursive: true });
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ name: "routes-fixture", dependencies: { next: "^16.0.0" } }),
    );
    await writeFile(
      path.join(root, "app", "api", "challenges", "route.ts"),
      "export async function GET() { return Response.json({}); }\n",
    );
    const brain = await compileRepository(root, { ai: false, progress: false });

    await expect(repositoryRoutes(root, { query: "challenge", kind: "api", limit: 1 }, brain)).resolves.toEqual([
      expect.objectContaining({ path: "/api/challenges", kind: "api", file: "app/api/challenges/route.ts" }),
    ]);
  });
});
