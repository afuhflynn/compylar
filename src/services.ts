import path from "node:path";
import { compileRepository, discoverPackages } from "./analyzer.js";
import { enrichContext } from "./ai.js";
import { buildContextResult } from "./context.js";
import { buildAnalytics } from "./analytics.js";
import { loadBrain, saveBrain } from "./storage.js";
import { loadConfig } from "./config.js";
import { trackRepository } from "./tracker.js";
import { reconcileMemory } from "./memory.js";
import { RepositoryBrain } from "./types.js";

export async function repositoryBrain(root: string) {
  return loadBrain(path.resolve(root));
}

export async function repositoryAnalytics(root: string) {
  return buildAnalytics(await repositoryBrain(root));
}

export async function repositoryContext(root: string, task: string, ai = false) {
  const result = buildContextResult(await repositoryBrain(root), task);
  if (result.status === "needs-clarification" || !ai) return result;
  const config = await loadConfig(path.resolve(root));
  return enrichContext(result, { ...config.ai, mode: "optional" });
}

export async function repositoryMemory(
  root: string,
  filters: { query?: string; sourcePaths?: string[] } = {},
) {
  const brain = await repositoryBrain(root);
  const query = filters.query?.toLowerCase().trim();
  const paths = new Set(filters.sourcePaths ?? []);
  const chunks = (brain.memory?.chunks ?? []).filter((chunk) =>
    (!query || `${chunk.title} ${chunk.summary} ${chunk.sourcePaths.join(" ")}`.toLowerCase().includes(query)) &&
    (!paths.size || chunk.sourcePaths.some((source) => paths.has(source))),
  );
  return {
    schemaVersion: brain.memory?.schemaVersion ?? 1,
    baseline: brain.compiledAt,
    chunks: chunks.slice(0, 40),
  };
}

export async function repositoryStatus(root: string) {
  const brain = await repositoryBrain(root);
  const absoluteRoot = path.resolve(root);
  const config = await loadConfig(absoluteRoot);
  const discovered = await discoverPackages(absoluteRoot, config);
  const hasRepositoryManifest = Boolean(brain.trackedFiles);
  const baseline = brain.trackedFiles ?? brain.files.map((file) => ({
    path: file.path,
    hash: file.hash,
    size: 0,
    mtimeMs: 0,
  }));
  const current = await trackRepository(absoluteRoot, {
    config,
    excludedPaths: discovered.ignored.map((item) => item.path),
    baseline,
  });
  const before = new Map(baseline.map((file) => [file.path, file]));
  const sourceExtensions = new Set(
    brain.files.map((file) => path.extname(file.path)),
  );
  const comparable = hasRepositoryManifest
    ? current
    : current.filter((file) => sourceExtensions.has(path.extname(file.path)));
  const after = new Map(comparable.map((file) => [file.path, file]));
  const added = [...after.keys()].filter((file) => !before.has(file));
  const changed = [...after.keys()].filter((file) => {
    const previous = before.get(file);
    const next = after.get(file);
    return Boolean(
      previous &&
        next &&
        (previous.hash !== next.hash ||
          (hasRepositoryManifest &&
            (previous.size !== next.size || previous.mtimeMs !== next.mtimeMs))),
    );
  });
  const deleted = [...before.keys()].filter((file) => !after.has(file));
  const packageFor = (file: string) =>
    brain.packages
      .slice()
      .sort((a, b) => b.relativePath.length - a.relativePath.length)
      .find(
        (pkg) =>
          pkg.relativePath === "." ||
          file === pkg.relativePath ||
          file.startsWith(`${pkg.relativePath}/`),
      )?.name ?? brain.repo.name;
  return {
    baseline: brain.compiledAt,
    currentScan: new Date().toISOString(),
    tracker: hasRepositoryManifest ? "repository-manifest" : "legacy-source-baseline",
    stale: Boolean(added.length || changed.length || deleted.length),
    added,
    changed,
    deleted,
    affectedPackages: [...new Set([...added, ...changed, ...deleted].map(packageFor))],
  };
}

export async function repositoryRefresh(
  root: string,
  options: Parameters<typeof compileRepository>[1] = {},
) {
  const previous = await repositoryBrain(root);
  const before = await repositoryStatus(root);
  if (!before.stale) return { refreshed: false, before, after: before };
  const brain = await compileRepository(path.resolve(root), {
    ...options,
    resume: true,
  });
  brain.memory = reconcileMemory(brain, previous.memory);
  if (brain.status !== "cancelled") await saveBrain(path.resolve(root), brain);
  const after = await repositoryStatus(root);
  return { refreshed: true, before, after, brain };
}

export async function repositoryRoutes(root: string, filters: { area?: string; kind?: RepositoryBrain["routes"][number]["kind"]; query?: string } = {}) {
  const brain = await repositoryBrain(root);
  const query = filters.query?.toLowerCase();
  return brain.routes.filter((route) => {
    const area = route.path.split("/").filter(Boolean)[0] ?? "home";
    return (!filters.area || area === filters.area) &&
      (!filters.kind || route.kind === filters.kind) &&
      (!query || `${route.path} ${route.file} ${route.packageName}`.toLowerCase().includes(query));
  });
}

export async function repositoryDependencies(root: string, filters: { kind?: RepositoryBrain["dependencyGraph"][number]["kind"]; query?: string } = {}) {
  const brain = await repositoryBrain(root);
  const query = filters.query?.toLowerCase();
  return brain.dependencyGraph.filter((edge) =>
    (!filters.kind || edge.kind === filters.kind) &&
    (!query || `${edge.from} ${edge.to} ${edge.packageName}`.toLowerCase().includes(query)),
  );
}
