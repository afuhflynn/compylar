import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { BrainSchema, CompileCheckpoint, RepositoryBrain } from "./types.js";
import { defaultConfig } from "./config.js";
import { brainReport } from "./analytics.js";

export function stateDir(root: string) {
  return path.join(root, ".compylar");
}
export function brainPath(root: string) {
  return path.join(stateDir(root), "brain.json");
}
export function databasePath(root: string) {
  return path.join(stateDir(root), "brain.db");
}
export function checkpointPath(root: string) {
  return path.join(stateDir(root), "checkpoint.json");
}
function brainMarkdown(brain: RepositoryBrain) {
  return brainReport(brain) + "\n";
}
export async function saveConfig(root: string) {
  await mkdir(stateDir(root), { recursive: true });
  await writeFile(
    path.join(stateDir(root), "config.json"),
    JSON.stringify(
      {
        version: 1,
        storage: "sqlite",
        sourceExtensions: [
          "ts",
          "tsx",
          "js",
          "jsx",
          "mts",
          "cts",
          "mjs",
          "cjs",
        ],
        ...defaultConfig(),
      },
      null,
      2,
    ) + "\n",
  );
}
export async function saveBrain(root: string, brain: RepositoryBrain) {
  await mkdir(stateDir(root), { recursive: true });
  const db = new DatabaseSync(databasePath(root));
  db.exec(
    "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS snapshots (id INTEGER PRIMARY KEY, compiled_at TEXT NOT NULL, fingerprint TEXT NOT NULL, brain_json TEXT NOT NULL); CREATE INDEX IF NOT EXISTS snapshots_compiled_at ON snapshots(compiled_at);",
  );
  const insert = db.prepare(
    "INSERT INTO snapshots (compiled_at, fingerprint, brain_json) VALUES (?, ?, ?)",
  );
  insert.run(brain.compiledAt, brain.fingerprint, JSON.stringify(brain));
  db.close();
  await writeFile(brainPath(root), JSON.stringify(brain, null, 2) + "\n");
  await writeFile(path.join(stateDir(root), "brain.md"), brainMarkdown(brain));
  await rm(checkpointPath(root), { force: true });
}
export async function saveCheckpoint(
  root: string,
  checkpoint: CompileCheckpoint,
) {
  await mkdir(stateDir(root), { recursive: true });
  await writeFile(checkpointPath(root), JSON.stringify(checkpoint));
}
export async function loadCheckpoint(
  root: string,
): Promise<CompileCheckpoint | undefined> {
  try {
    return JSON.parse(
      await readFile(checkpointPath(root), "utf8"),
    ) as CompileCheckpoint;
  } catch {
    return undefined;
  }
}
export async function loadBrain(root: string): Promise<RepositoryBrain> {
  let raw: string;
  try {
    raw = await readFile(brainPath(root), "utf8");
  } catch {
    throw new Error(
      `No compiled knowledge found for ${root}. Run: compylar compile ${root}`,
    );
  }
  try {
    return BrainSchema.parse(JSON.parse(raw));
  } catch (error) {
    throw new Error(
      `Compiled knowledge is corrupt or from an unsupported schema in ${brainPath(root)}. Run: compylar compile ${root}. Details: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
export async function listSnapshots(root: string) {
  try {
    const db = new DatabaseSync(databasePath(root));
    const rows = db
      .prepare(
        "SELECT id, compiled_at as compiledAt, fingerprint FROM snapshots ORDER BY id DESC",
      )
      .all() as Array<{ id: number; compiledAt: string; fingerprint: string }>;
    db.close();
    return rows;
  } catch {
    return [];
  }
}
