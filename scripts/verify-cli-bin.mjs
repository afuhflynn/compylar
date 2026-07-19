import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(projectRoot, "dist", "cli.js");

await access(cli, constants.F_OK);
if (process.platform !== "win32") {
  const mode = (await stat(cli)).mode;
  if ((mode & 0o111) === 0) {
    throw new Error(`CLI entrypoint is not executable: ${cli}`);
  }
}
