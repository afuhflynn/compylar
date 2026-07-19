import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(projectRoot, "dist");

if (path.dirname(output) !== projectRoot || path.basename(output) !== "dist") {
  throw new Error("Refusing to clean an unexpected build output path.");
}

await rm(output, { recursive: true, force: true });
