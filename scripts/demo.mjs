import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.execPath, [path.join(root, "dist", "cli.js"), "demo"], {
  cwd: root,
  stdio: "inherit",
});

if (result.status !== 0) process.exitCode = result.status ?? 1;
