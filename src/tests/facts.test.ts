import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileRepository } from "../analyzer.js";
import { repositoryFacts, repositoryLookup } from "../services.js";
import { saveBrain } from "../storage.js";

it("extracts safe setup, scripts, environment, schema, actions, and jobs as repository facts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "compylar-facts-"));
  await mkdir(path.join(root, "app")); await mkdir(path.join(root, "prisma"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "facts", scripts: { test: "vitest run" } }));
  await writeFile(path.join(root, "README.md"), "# Facts\n\n## Setup\nRun pnpm install.\n");
  await writeFile(path.join(root, ".env.example"), "DATABASE_URL=postgres://example\n");
  await writeFile(path.join(root, "prisma", "schema.prisma"), "model User { id String @id }\n");
  await writeFile(path.join(root, "app", "actions.ts"), "'use server';\nexport async function createUser() {}\n");
  await writeFile(path.join(root, "jobs.ts"), "inngest.createFunction({ id: 'welcome' }, { event: 'user.created' }, async () => {});\n");
  const brain = await compileRepository(root, { ai: false, progress: false }); await saveBrain(root, brain);
  expect(brain.facts).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "script", name: "facts:test" }), expect.objectContaining({ kind: "environment", name: "DATABASE_URL" }), expect.objectContaining({ kind: "schema", name: "model User" }), expect.objectContaining({ kind: "server-action", name: "createUser" }), expect.objectContaining({ kind: "job" })]));
  await expect(repositoryFacts(root, ["environment"])).resolves.toEqual([expect.objectContaining({ name: "DATABASE_URL" })]);
  expect((brain.facts ?? []).filter((fact) => fact.kind === "job")).toHaveLength(1);
  await expect(repositoryLookup(root, "DATABASE_URL", undefined, { kind: "fact" })).resolves.toMatchObject({ matches: [expect.objectContaining({ kind: "fact" })] });
}, 15_000);
