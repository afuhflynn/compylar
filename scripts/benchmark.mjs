import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { benchmarkRepository } from "../dist/benchmark.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "examples", "nextjs-demo");
const benchmarkRoot = await mkdtemp(path.join(os.tmpdir(), "compylar-benchmark-"));

try {
  await cp(fixture, benchmarkRoot, { recursive: true });
  await rm(path.join(benchmarkRoot, ".compylar"), { recursive: true, force: true });
  const dashboard = path.join(benchmarkRoot, "lib", "dashboard.ts");
  const report = await benchmarkRepository({
    root: benchmarkRoot,
    task: "add authentication to the dashboard",
    mutate: async () => {
      await writeFile(
        dashboard,
        `${await readFile(dashboard, "utf8")}\nexport const requiresAuthentication = true;\n`,
      );
    },
  });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(benchmarkRoot, { recursive: true, force: true });
}
