import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileRepository, discoverPackages } from "./analyzer.js";
import { enrichContext } from "./ai.js";
import { buildContextResult, type ContextOptions } from "./context.js";
import { buildAnalytics } from "./analytics.js";
import { listSnapshots, loadBrain, loadSnapshot, saveBrain } from "./storage.js";
import { loadConfig } from "./config.js";
import { trackRepository } from "./tracker.js";
import { deriveRepositoryProfile, reconcileLearnedMemory, reconcileMemory } from "./memory.js";
import { LearnedFinding, MemoryDeltaManifest, MemoryDeltaManifestSchema, RepositoryBrain, SemanticIndexManifest, SemanticIndexManifestSchema, SemanticMemoryCategory } from "./types.js";

export async function repositoryBrain(root: string) {
  return loadBrain(path.resolve(root));
}

export async function repositoryAnalytics(root: string) {
  return buildAnalytics(await repositoryBrain(root));
}

export async function repositoryOverview(root: string) {
  const brain = await repositoryBrain(root);
  return brain.profile ?? deriveRepositoryProfile(brain);
}

export const semanticMemoryChecklist = [
  "foundation",
  "system",
  "flow",
  "contract",
  "test-guarantee",
  "convention",
  "unknown",
] as const;

const absentSemanticIndex = () => ({ schemaVersion: 1 as const, status: "absent" as const, coverage: [], blockers: [], unknowns: [], findingCount: 0 });
const manifestPath = (root: string) => path.join(root, ".compylar", "semantic-index.json");
const sha256 = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");

export function reconcileSemanticIndex(brain: RepositoryBrain, previous?: RepositoryBrain["semanticIndex"]) {
  if (!previous || previous.status === "absent") return previous ?? absentSemanticIndex();
  if (previous.sourceFingerprint === brain.fingerprint) return previous;
  return { ...previous, status: "partially-stale" as const };
}

/** Creates the local deterministic substrate; the agent then performs the cited semantic index. */
export async function repositoryBootstrap(
  root: string,
  options: Parameters<typeof compileRepository>[1] = {},
) {
  const absoluteRoot = path.resolve(root);
  const existing = await repositoryBrain(absoluteRoot).catch(() => undefined);
  if (existing) {
    const semanticComplete = existing.semanticIndex?.status === "complete";
    return {
      created: false,
      nextAction: semanticComplete ? "retrieve-memory" as const : "full-index" as const,
      baseline: existing.compiledAt,
      fingerprint: existing.fingerprint,
      requiredFindings: semanticMemoryChecklist,
      message: semanticComplete
        ? "A current semantic Repository Brain already exists. Retrieve memory first; only perform the scoped index requested by sync."
        : "A deterministic baseline exists, but its semantic index is incomplete. Run the bundled codebase-index workflow and ingest its manifest before feature work.",
    };
  }
  const brain = await compileRepository(absoluteRoot, { ...options, ai: false });
  brain.semanticIndex = absentSemanticIndex();
  if (brain.status !== "cancelled") await saveBrain(absoluteRoot, brain);
  return {
    created: true,
    nextAction: "full-index" as const,
    baseline: brain.compiledAt,
    fingerprint: brain.fingerprint,
    requiredFindings: semanticMemoryChecklist,
    message: "Deterministic baseline created. Run the bundled codebase-index workflow, write CODEBASE_INDEX.md plus .compylar/semantic-index.json, then run compylar ingest-index before feature work.",
  };
}

const structuralPath = (file: string) =>
  /(?:^|\/)(?:package(?:-lock)?\.json|pnpm-workspace\.yaml|pnpm-lock\.yaml|tsconfig(?:\.[^/]+)?\.json|next\.config\.|vite\.config\.|prisma\/|app\/.+\/(?:page|layout|route)\.[cm]?[jt]sx?$)/.test(file);

/** Plans the smallest trustworthy re-index scope without mutating the Brain. */
export async function repositorySync(root: string) {
  const brain = await repositoryBrain(root);
  const status = await repositoryStatus(root);
  const changedPaths = [...status.added, ...status.changed, ...status.deleted].sort();
  if ((brain.semanticIndex?.status ?? "absent") !== "complete") {
    return {
      action: "semantic-index" as const,
      changedPaths,
      affectedPaths: [],
      requiredFindings: [...semanticMemoryChecklist],
      reason: "The deterministic Brain has no current validated semantic index. Run the bundled codebase-index workflow and ingest its manifest.",
    };
  }
  if (!status.stale) {
    return { action: "current" as const, changedPaths, affectedPaths: [], requiredFindings: [] as string[] };
  }
  if (changedPaths.some(structuralPath)) {
    return {
      action: "structural-index" as const,
      changedPaths,
      affectedPaths: changedPaths,
      requiredFindings: [...semanticMemoryChecklist],
      reason: "A manifest, workspace/configuration, schema, or route boundary changed.",
    };
  }
  const changed = new Set(changedPaths);
  const dependents = brain.dependencyGraph
    .filter((edge) => edge.kind === "internal" && changed.has(edge.to))
    .map((edge) => edge.from);
  return {
    action: "delta-index" as const,
    changedPaths,
    affectedPaths: [...new Set([...changedPaths, ...dependents])].sort(),
    requiredFindings: ["system", "flow", "contract", "test-guarantee", "unknown"],
    reason: "Update only changed files, their direct dependents, related tests, and affected cited memory.",
  };
}

/** Validates and ingests the bundled codebase-index manifest into durable semantic memory. */
export async function repositoryIngestIndex(root: string, inputPath = manifestPath(path.resolve(root))) {
  const absoluteRoot = path.resolve(root);
  const brain = await repositoryBrain(absoluteRoot);
  const raw = await fs.readFile(inputPath, "utf8");
  const manifest = SemanticIndexManifestSchema.parse(JSON.parse(raw)) as SemanticIndexManifest;
  if (manifest.brainFingerprint !== brain.fingerprint) {
    throw new Error("Semantic index was built for a different repository baseline. Run compylar refresh, then regenerate the index manifest.");
  }
  const artifactPath = path.resolve(absoluteRoot, manifest.artifact.path);
  if (!artifactPath.startsWith(`${absoluteRoot}${path.sep}`) && artifactPath !== absoluteRoot) throw new Error("Semantic index artifact must be inside the repository.");
  const artifact = await fs.readFile(artifactPath);
  if (sha256(artifact) !== manifest.artifact.sha256) throw new Error("Semantic index artifact hash does not match its manifest.");
  const required = new Set<SemanticMemoryCategory>(semanticMemoryChecklist);
  const coverage = new Set(manifest.coverage);
  const missing = [...required].filter((category) => !coverage.has(category));
  if ((!manifest.verification.complete || missing.length) && !manifest.verification.blockers.length) {
    throw new Error(`Semantic index is incomplete: missing ${missing.join(", ") || "verification"}. Document blockers instead of claiming completion.`);
  }
  const files = new Map(brain.files.map((file) => [file.path, file]));
  const existing = reconcileLearnedMemory(brain, brain.learnedMemory?.findings);
  const now = new Date().toISOString();
  const created: LearnedFinding[] = [];
  const retained: LearnedFinding[] = [];
  for (const item of manifest.findings) {
    const sources = item.sources.map((source) => {
      const file = files.get(source.path);
      if (!file || source.endLine < source.startLine || source.endLine > file.lines) throw new Error(`Invalid semantic-index citation ${source.path}:${source.startLine}-${source.endLine}.`);
      return { ...source, sourceHash: file.hash };
    });
    const same = existing.find((finding) => finding.stableKey === item.key && finding.state === "current" && finding.summary === item.summary && JSON.stringify(finding.sources) === JSON.stringify(sources));
    if (same) { retained.push(same); continue; }
    for (const prior of existing) if (prior.stableKey === item.key && prior.state === "current") prior.state = "superseded";
    created.push({ id: `${item.kind}:${crypto.randomUUID()}`, stableKey: item.key, kind: item.kind, summary: item.summary, authority: "agent", sources, createdAt: now, verifiedAt: now, confidence: item.confidence, state: "current", systems: [] });
  }
  brain.learnedMemory = { schemaVersion: 1, findings: [...existing, ...created] };
  brain.semanticIndex = {
    schemaVersion: 1,
    status: manifest.verification.complete && !missing.length ? "complete" : "partially-stale",
    sourceFingerprint: brain.fingerprint,
    manifestHash: sha256(raw), artifactPath: manifest.artifact.path, artifactHash: manifest.artifact.sha256,
    producerVersion: manifest.producer.version, completedAt: now, coverage: manifest.coverage,
    blockers: manifest.verification.blockers, unknowns: manifest.unknowns, findingCount: manifest.findings.length,
  };
  await saveBrain(absoluteRoot, brain);
  return { status: brain.semanticIndex.status, created: created.length, reused: retained.length, coverage: brain.semanticIndex.coverage, blockers: brain.semanticIndex.blockers };
}

export async function repositoryContext(root: string, task: string, ai = false, options: ContextOptions = {}) {
  const result = buildContextResult(await repositoryBrain(root), task, options);
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
    learnedFindings: (brain.learnedMemory?.findings ?? [])
      .filter((finding) => finding.state === "current")
      .filter((finding) => !query || `${finding.kind} ${finding.summary} ${finding.sources.map((source) => source.path).join(" ")}`.toLowerCase().includes(query))
      .slice(0, 40),
  };
}

export type LearnInput = {
  kind: LearnedFinding["kind"];
  summary: string;
  authority: LearnedFinding["authority"];
  sources?: Array<{ path: string; startLine: number; endLine: number }>;
  originQuestion?: string;
  confidence?: LearnedFinding["confidence"];
  stableKey?: string;
  systems?: string[];
};

/** Store a compact, durable finding. Agent/compiler findings require current source citations. */
export async function repositoryLearn(root: string, input: LearnInput) {
  const brain = await repositoryBrain(root);
  const now = new Date().toISOString();
  const sources = input.sources ?? [];
  if (input.authority !== "human" && sources.length === 0) {
    throw new Error("Code-derived learning requires at least one --source path:startLine-endLine citation.");
  }
  const files = new Map(brain.files.map((file) => [file.path, file]));
  const cited = sources.map((source) => {
    const file = files.get(source.path);
    if (!file) throw new Error(`Learning source is not an analyzed source file: ${source.path}`);
    if (source.endLine < source.startLine || source.endLine > file.lines) {
      throw new Error(`Invalid source range for ${source.path}: ${source.startLine}-${source.endLine}`);
    }
    return { ...source, sourceHash: file.hash };
  });
  const finding: LearnedFinding = {
    id: `${input.kind}:${crypto.randomUUID()}`,
    kind: input.kind,
    summary: input.summary.trim(),
    authority: input.authority,
    sources: cited,
    originQuestion: input.originQuestion,
    createdAt: now,
    verifiedAt: now,
    confidence: input.confidence ?? (input.authority === "human" ? "medium" : "high"),
    state: "current",
    stableKey: input.stableKey,
    systems: [...new Set(input.systems ?? [])].sort(),
  };
  const reconciled = reconcileLearnedMemory(brain, brain.learnedMemory?.findings);
  if (finding.stableKey) {
    for (const prior of reconciled) {
      if (prior.stableKey === finding.stableKey && prior.state === "current") {
        prior.state = "superseded";
        finding.supersedes = prior.id;
      }
    }
  }
  brain.learnedMemory = {
    schemaVersion: 1,
    findings: [...reconciled, finding],
  };
  await saveBrain(path.resolve(root), brain);
  return finding;
}

export async function repositoryMemoryReview(root: string, task: string, files: string[] = [], changed: string[] = []) {
  const brain = await repositoryBrain(root);
  const selected = new Set([...files, ...changed]);
  const current = (brain.learnedMemory?.findings ?? []).filter((finding) => finding.state === "current");
  const relevant = current.filter((finding) => !selected.size || finding.sources.some((source) => selected.has(source.path)));
  const systems = [...new Set(relevant.flatMap((finding) => finding.systems))];
  const uncovered = ["system", "flow", "constraint", "convention", "test-guarantee"].filter((category) => !relevant.some((finding) => finding.kind === category || (category === "test-guarantee" && finding.kind === "system")));
  return {
    task, requiresReview: Boolean(files.length || changed.length), files: [...selected], systems,
    currentFindings: relevant, uncovered,
    template: { schemaVersion: 1, task, findings: [], instructions: "Add cited findings, or replace this template with a cited dismissal. Empty sources are intentionally invalid." },
  };
}

export async function repositoryCommitMemory(root: string, raw: unknown) {
  const manifest = MemoryDeltaManifestSchema.parse(raw) as MemoryDeltaManifest;
  const created: LearnedFinding[] = [];
  for (const item of manifest.findings) {
    created.push(await repositoryLearn(root, { kind: item.kind, summary: item.summary, authority: "agent", sources: item.sources, originQuestion: manifest.task, confidence: item.confidence, stableKey: item.key, systems: item.systems }));
  }
  if (manifest.dismissal) {
    created.push(await repositoryLearn(root, { kind: "task-outcome", summary: `Memory review dismissed: ${manifest.dismissal.reason}`, authority: "agent", sources: manifest.dismissal.sources, originQuestion: manifest.task, confidence: "medium", stableKey: `dismissal:${sha256(`${manifest.task}:${manifest.dismissal.reason}`)}`, systems: ["repository-workflow"] }));
  }
  return { task: manifest.task, committed: created.length, findings: created };
}

export async function repositorySystems(root: string, query?: string) {
  const brain = await repositoryBrain(root);
  const needle = query?.toLowerCase();
  const findings = (brain.learnedMemory?.findings ?? []).filter((finding) => finding.state === "current");
  const names = [...new Set(findings.flatMap((finding) => finding.systems))].filter((name) => !needle || name.toLowerCase().includes(needle));
  return names.map((name) => {
    const scoped = findings.filter((finding) => finding.systems.includes(name));
    return { name, findings: scoped, coverage: [...new Set(scoped.map((finding) => finding.kind))], sources: [...new Set(scoped.flatMap((finding) => finding.sources.map((source) => source.path)))], freshness: scoped.every((finding) => finding.state === "current") ? "current" : "stale" };
  });
}

export type RepositoryLookupMatch = {
  kind: "symbol" | "memory" | "route" | "learned" | "prisma" | "fact";
  match: "exact" | "partial";
  name: string;
  definition: string;
  source: string;
  line?: number;
  confidence: "high" | "medium" | "low";
};

export type RepositoryLookup = {
  query: string;
  baseline: string;
  matches: RepositoryLookupMatch[];
};

export type RepositoryLookupOptions = { exact?: boolean; kind?: RepositoryLookupMatch["kind"]; limit?: number; full?: boolean };

export async function repositoryLookup(
  root: string,
  query: string,
  suppliedBrain?: RepositoryBrain,
  options: RepositoryLookupOptions = {},
): Promise<RepositoryLookup> {
  const brain = suppliedBrain ?? await repositoryBrain(root);
  const needle = query.trim().toLowerCase();
  const queryTerms = new Set(
    query.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length >= 3),
  );
  const overlapsQuery = (value: string) =>
    value.toLowerCase().includes(needle) || value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).some((term) => queryTerms.has(term));
  const symbolMatches = brain.symbols
    .filter((symbol) => overlapsQuery(symbol.name))
    .map((symbol): RepositoryLookupMatch => ({
      kind: "symbol",
      match: symbol.name.toLowerCase() === needle ? "exact" : "partial",
      name: symbol.name,
      definition: options.full ? (symbol.declaration ?? symbol.signature) : symbol.signature.slice(0, 240),
      source: symbol.file,
      line: symbol.line,
      confidence: "high",
    }));
  const memoryMatches = (brain.memory?.chunks ?? [])
    .filter((chunk) => `${chunk.title} ${chunk.summary} ${chunk.sourcePaths.join(" ")}`.toLowerCase().includes(needle))
    .map((chunk): RepositoryLookupMatch => ({
      kind: "memory",
      match: chunk.title.toLowerCase() === needle ? "exact" : "partial",
      name: chunk.title,
      definition: chunk.summary,
      source: chunk.sourcePaths[0] ?? "<repository>",
      line: chunk.evidence[0]?.line,
      confidence: chunk.confidence,
    }));
  const routeMatches = brain.routes
    .filter((route) => `${route.path} ${route.file}`.toLowerCase().includes(needle))
    .map((route): RepositoryLookupMatch => ({
      kind: "route",
      match: route.path.toLowerCase() === needle ? "exact" : "partial",
      name: route.path,
      definition: `${route.kind} route${route.methods.length ? `; methods: ${route.methods.join(", ")}` : ""}`,
      source: route.file,
      line: route.evidence[0]?.line,
      confidence: route.evidence[0]?.confidence ?? "medium",
    }));
  const learnedMatches = (brain.learnedMemory?.findings ?? [])
    .filter((finding) => finding.state === "current")
    .filter((finding) => overlapsQuery(`${finding.id} ${finding.kind} ${finding.summary}`))
    .map((finding): RepositoryLookupMatch => ({
      kind: "learned", match: finding.id.toLowerCase() === needle ? "exact" : "partial", name: finding.id,
      definition: finding.summary, source: finding.sources[0]?.path ?? "<human>", line: finding.sources[0]?.startLine,
      confidence: finding.confidence,
    }));
  const prismaMatches = (brain.prisma ?? [])
    .filter((model) => overlapsQuery(`${model.name} ${model.fields.map((field) => `${field.name} ${field.type}`).join(" ")}`))
    .map((model): RepositoryLookupMatch => ({
      kind: "prisma", match: model.name.toLowerCase() === needle ? "exact" : "partial", name: model.name,
      definition: `${model.kind} ${model.name}: ${model.fields.map((field) => `${field.name}: ${field.type}`).join(", ")}`,
      source: model.file, line: model.line, confidence: "high",
    }));
  const factMatches = (brain.facts ?? []).filter((fact) => overlapsQuery(`${fact.kind} ${fact.name} ${fact.summary}`)).map((fact): RepositoryLookupMatch => ({ kind: "fact", match: fact.name.toLowerCase() === needle ? "exact" : "partial", name: fact.name, definition: fact.summary, source: fact.source, line: fact.line, confidence: fact.confidence }));
  const rank = (item: RepositoryLookupMatch) =>
    (item.match === "exact" ? 0 : 10) + (item.kind === "fact" ? 0 : item.kind === "symbol" ? 1 : item.kind === "prisma" ? 2 : item.kind === "learned" ? 3 : item.kind === "memory" ? 4 : 6);
  const all = [...factMatches, ...symbolMatches, ...prismaMatches, ...learnedMatches, ...memoryMatches, ...routeMatches]
    .filter((match) => !options.kind || match.kind === options.kind)
    .filter((match) => !options.exact || match.match === "exact");
  const exact = all.filter((match) => match.match === "exact");
  return {
    query,
    baseline: brain.compiledAt,
    matches: (exact.length ? exact : all)
      .sort((left, right) => rank(left) - rank(right) || left.source.localeCompare(right.source) || left.name.localeCompare(right.name))
      .slice(0, options.limit ?? 8),
  };
}

export async function repositoryFacts(root: string, kinds: NonNullable<RepositoryBrain["facts"]>[number]["kind"][], query?: string) {
  const brain = await repositoryBrain(root); const needle = query?.toLowerCase();
  return (brain.facts ?? []).filter((fact) => kinds.includes(fact.kind)).filter((fact) => !needle || `${fact.name} ${fact.summary}`.toLowerCase().includes(needle));
}

export async function repositoryLearned(root: string, filters: { query?: string; state?: LearnedFinding["state"]; limit?: number } = {}) {
  const brain = await repositoryBrain(root);
  const query = filters.query?.toLowerCase().trim();
  return (brain.learnedMemory?.findings ?? [])
    .filter((finding) => !filters.state || finding.state === filters.state)
    .filter((finding) => !query || `${finding.id} ${finding.kind} ${finding.summary}`.toLowerCase().includes(query))
    .slice(0, filters.limit ?? 40);
}

export async function repositoryReferences(root: string, symbol: string) {
  const brain = await repositoryBrain(root);
  const definitions = brain.symbols.filter((item) => item.name === symbol);
  return { symbol, definitions, callers: (brain.references ?? []).filter((item) => item.symbol === symbol && item.kind === "call"), tests: (brain.references ?? []).filter((item) => item.symbol === symbol && item.kind === "test"), guards: (brain.guards ?? []).filter((item) => item.name === symbol) };
}

export async function repositoryCompileDiff(root: string, fromId?: number, toId?: number) {
  const snapshots = await listSnapshots(root);
  const chosen = fromId !== undefined && toId !== undefined
    ? [snapshots.find((item) => item.id === fromId), snapshots.find((item) => item.id === toId)]
    : [snapshots[1], snapshots[0]];
  if (!chosen[0] || !chosen[1]) throw new Error("Compile diff requires two stored snapshots.");
  const [before, after] = await Promise.all([loadSnapshot(root, chosen[0].id), loadSnapshot(root, chosen[1].id)]);
  if (!before || !after) throw new Error("Requested compile snapshot is unavailable.");
  const delta = (left: string[], right: string[]) => ({ added: right.filter((item) => !left.includes(item)), removed: left.filter((item) => !right.includes(item)) });
  return {
    from: chosen[0], to: chosen[1],
    files: delta(before.files.map((file) => `${file.path}:${file.hash}`), after.files.map((file) => `${file.path}:${file.hash}`)),
    symbols: delta(before.symbols.map((item) => `${item.file}:${item.line}:${item.name}`), after.symbols.map((item) => `${item.file}:${item.line}:${item.name}`)),
    routes: delta(before.routes.map((item) => `${item.kind}:${item.path}:${item.file}`), after.routes.map((item) => `${item.kind}:${item.path}:${item.file}`)),
    prisma: delta((before.prisma ?? []).map((item) => item.name), (after.prisma ?? []).map((item) => item.name)),
  };
}

export async function repositoryStatus(root: string) {
  const brain = await repositoryBrain(root);
  const absoluteRoot = path.resolve(root);
  const config = await loadConfig(absoluteRoot);
  const discovered = await discoverPackages(absoluteRoot, config);
  const hasRepositoryManifest = Boolean(brain.trackedFiles);
  const isManagedIndexArtifact = (file: string) => file === "CODEBASE_INDEX.md" || file === ".compylar/semantic-index.json";
  const baseline = (brain.trackedFiles ?? brain.files.map((file) => ({
    path: file.path,
    hash: file.hash,
    size: 0,
    mtimeMs: 0,
  }))).filter((file) => !isManagedIndexArtifact(file.path));
  const current = await trackRepository(absoluteRoot, {
    config,
    excludedPaths: discovered.ignored.map((item) => item.path),
    baseline,
  });
  const before = new Map(baseline.map((file) => [file.path, file]));
  const sourceExtensions = new Set(
    brain.files.map((file) => path.extname(file.path)),
  );
  const comparable = (hasRepositoryManifest
    ? current
    : current.filter((file) => sourceExtensions.has(path.extname(file.path))))
    .filter((file) => !isManagedIndexArtifact(file.path));
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
    semanticIndex: brain.semanticIndex ?? absentSemanticIndex(),
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
  brain.learnedMemory = {
    schemaVersion: 1,
    findings: reconcileLearnedMemory(brain, previous.learnedMemory?.findings),
  };
  brain.semanticIndex = reconcileSemanticIndex(brain, previous.semanticIndex);
  if (brain.status !== "cancelled") await saveBrain(path.resolve(root), brain);
  const after = await repositoryStatus(root);
  return { refreshed: true, before, after, brain };
}

export async function repositoryRoutes(
  root: string,
  filters: { area?: string; kind?: RepositoryBrain["routes"][number]["kind"]; query?: string; limit?: number } = {},
  suppliedBrain?: RepositoryBrain,
) {
  const brain = suppliedBrain ?? await repositoryBrain(root);
  const query = filters.query?.toLowerCase();
  return brain.routes.filter((route) => {
    const area = route.path.split("/").filter(Boolean)[0] ?? "home";
    return (!filters.area || area === filters.area) &&
      (!filters.kind || route.kind === filters.kind) &&
      (!query || `${route.path} ${route.file} ${route.packageName}`.toLowerCase().includes(query));
  }).slice(0, filters.limit ?? 100);
}

export async function repositoryDependencies(root: string, filters: { kind?: RepositoryBrain["dependencyGraph"][number]["kind"]; query?: string } = {}) {
  const brain = await repositoryBrain(root);
  const query = filters.query?.toLowerCase();
  return brain.dependencyGraph.filter((edge) =>
    (!filters.kind || edge.kind === filters.kind) &&
    (!query || `${edge.from} ${edge.to} ${edge.packageName}`.toLowerCase().includes(query)),
  );
}
