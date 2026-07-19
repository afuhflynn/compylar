import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { benchmarkRepository } from "../dist/benchmark.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "examples", "nextjs-demo");
const demoRoot = await mkdtemp(path.join(os.tmpdir(), "compylar-first-run-"));
const formatMs = (value) => `${value.toFixed(value < 10 ? 1 : 0)}ms`;

try {
  await cp(fixture, demoRoot, { recursive: true });
  await rm(path.join(demoRoot, ".compylar"), { recursive: true, force: true });
  const dashboard = path.join(demoRoot, "lib", "dashboard.ts");
  const report = await benchmarkRepository({
    root: demoRoot,
    task: "add authentication to the dashboard",
    mutate: async () => {
      await writeFile(
        dashboard,
        `${await readFile(dashboard, "utf8")}\nexport const requiresAuthentication = true;\n`,
      );
    },
  });

  console.log("\nCompylar — first-run proof\n");
  console.log(`Repository: ${report.repository}`);
  console.log(`Task: ${report.task}`);
  console.log(`Context selected: ${report.selectedFiles.join(", ")}`);
  console.log(`Change detected: ${report.change.changed.join(", ") || "none"}`);
  console.log(`Memory refresh: ${report.memory.updated.length} updated · ${report.memory.reused.length} reused · ${report.memory.created.length} created · ${report.memory.removed.length} removed`);
  console.log(`Elapsed: compile ${formatMs(report.elapsedMs.compile)} · context ${formatMs(report.elapsedMs.context)} · status ${formatMs(report.elapsedMs.status)} · refresh ${formatMs(report.elapsedMs.refresh)}`);
  console.log("\nNext: run `compylar compile . --no-ai` in a repository, then install the skill for your coding agent.");
} finally {
  await rm(demoRoot, { recursive: true, force: true });
}
