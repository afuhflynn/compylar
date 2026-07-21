import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageRoot = () => path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function runDemo() {
  const root = packageRoot();
  const fixture = path.join(root, "examples", "nextjs-demo");
  const demoRoot = await mkdtemp(path.join(os.tmpdir(), "compylar-demo-"));
  const run = (...args: string[]) => {
    const result = spawnSync(process.execPath, [path.join(root, "dist", "cli.js"), ...args], {
      cwd: root,
      stdio: "inherit",
    });
    if (result.status !== 0) throw new Error(`Demo command failed: compylar ${args.join(" ")}`);
  };

  try {
    await cp(fixture, demoRoot, { recursive: true });
    await rm(path.join(demoRoot, ".compylar"), { recursive: true, force: true });

    console.log("\n1/5 Compile persistent repository memory\n");
    run("compile", demoRoot, "--no-ai", "--quiet");

    console.log("\n2/5 Retrieve task context without rediscovering the repository\n");
    run("context", "add authentication to the dashboard", demoRoot);

    const dashboard = path.join(demoRoot, "lib", "dashboard.ts");
    await writeFile(
      dashboard,
      `${await readFile(dashboard, "utf8")}\nexport const requiresAuthentication = true;\n`,
    );

    console.log("\n3/5 Detect exactly what changed\n");
    run("status", demoRoot);

    console.log("\n4/5 Refresh changed knowledge and reuse the rest\n");
    run("refresh", demoRoot, "--no-ai", "--quiet");

    console.log("\n5/5 Inspect the refreshed Brain\n");
    run("brain", demoRoot);
  } finally {
    await rm(demoRoot, { recursive: true, force: true });
  }
}
