import path from "node:path";
import { performance } from "node:perf_hooks";
import { compileRepository } from "./analyzer.js";
import { buildContextResult } from "./context.js";
import { repositoryRefresh, repositoryStatus } from "./services.js";
import { saveBrain } from "./storage.js";

export type RepositoryBenchmark = {
  repository: string;
  task: string;
  selectedFiles: string[];
  change: { added: string[]; changed: string[]; deleted: string[] };
  memory: { chunks: number; created: string[]; updated: string[]; reused: string[]; removed: string[] };
  elapsedMs: { compile: number; context: number; status: number; refresh: number; total: number };
};

type BenchmarkOptions = {
  root: string;
  task: string;
  mutate: () => Promise<void>;
  now?: () => number;
};

export async function benchmarkRepository(
  options: BenchmarkOptions,
): Promise<RepositoryBenchmark> {
  const root = path.resolve(options.root);
  const now = options.now ?? performance.now.bind(performance);
  const started = now();
  const initial = await compileRepository(root, { ai: false, progress: false });
  await saveBrain(root, initial);
  const compiled = now();

  const context = buildContextResult(initial, options.task);
  if (context.status !== "context-ready") {
    throw new Error(
      `Benchmark task needs clarification: ${context.missingInformation.join(", ")}.`,
    );
  }
  const contextualized = now();

  await options.mutate();
  const status = await repositoryStatus(root);
  const checked = now();
  if (!status.stale) {
    throw new Error("Benchmark mutation did not make repository knowledge stale.");
  }
  const refreshed = await repositoryRefresh(root, { ai: false, progress: false });
  if (!refreshed.refreshed || !refreshed.brain?.memory) {
    throw new Error("Benchmark refresh did not produce refreshed repository memory.");
  }
  const completed = now();
  const changes = refreshed.brain.memory.changes;

  return {
    repository: initial.repo.name,
    task: options.task,
    selectedFiles: context.selectedFiles.map((file) => file.path),
    change: {
      added: status.added,
      changed: status.changed,
      deleted: status.deleted,
    },
    memory: {
      chunks: refreshed.brain.memory.chunks.length,
      created: changes.created,
      updated: changes.updated,
      reused: changes.reused,
      removed: changes.removed,
    },
    elapsedMs: {
      compile: compiled - started,
      context: contextualized - compiled,
      status: checked - contextualized,
      refresh: completed - checked,
      total: completed - started,
    },
  };
}
