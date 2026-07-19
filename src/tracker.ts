import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { CompileConfig } from "./config.js";

export type TrackedFile = {
  path: string;
  hash?: string;
  size: number;
  mtimeMs: number;
};

type TrackOptions = {
  config: Pick<CompileConfig, "ignore" | "maxFileSize">;
  excludedPaths?: string[];
  baseline?: Iterable<TrackedFile>;
};

const hash = (content: Buffer) =>
  crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);

/**
 * Captures the lightweight repository manifest used to decide whether a Brain
 * is still trustworthy. It deliberately tracks more than source code: package
 * metadata, configuration, documentation, and new files can all change the
 * context an agent should receive.
 */
export async function trackRepository(
  root: string,
  options: TrackOptions,
): Promise<TrackedFile[]> {
  const absoluteRoot = path.resolve(root);
  const baseline = new Map(
    [...(options.baseline ?? [])].map((file) => [file.path, file]),
  );
  const excluded = (options.excludedPaths ?? []).filter(
    (value) => value && value !== ".",
  );
  const names = await fg("**/*", {
    cwd: absoluteRoot,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: [
      ...options.config.ignore,
      ...excluded.map((directory) => `${directory}/**`),
    ],
  });
  const tracked: TrackedFile[] = [];
  for (const relativePath of names.sort()) {
    const normalizedPath = relativePath.replace(/\\/g, "/");
    const absolutePath = path.join(absoluteRoot, relativePath);
    try {
      const stat = await fs.stat(absolutePath);
      const prior = baseline.get(normalizedPath);
      if (prior && prior.size === stat.size && prior.mtimeMs === stat.mtimeMs) {
        tracked.push(prior);
        continue;
      }
      tracked.push({
        path: normalizedPath,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        hash:
          stat.size <= options.config.maxFileSize
            ? hash(await fs.readFile(absolutePath))
            : undefined,
      });
    } catch {
      // A file can disappear between enumeration and stat; the next status
      // check will observe it consistently without failing the whole command.
    }
  }
  return tracked;
}
