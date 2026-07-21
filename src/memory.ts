import crypto from "node:crypto";
import { Evidence, LearnedFinding, MemoryChunk, RepositoryBrain, RepositoryMemory, RepositoryProfile } from "./types.js";

type DraftChunk = Omit<MemoryChunk, "createdAt" | "updatedAt" | "lastVerifiedAt">;

const hash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);

const confidence = (evidence: Evidence[]): MemoryChunk["confidence"] =>
  evidence.some((item) => item.confidence === "high")
    ? "high"
    : evidence.some((item) => item.confidence === "medium")
      ? "medium"
      : "low";

function sourceFingerprint(brain: RepositoryBrain, sourcePaths: string[]) {
  const sourceHashes = new Map(brain.files.map((file) => [file.path, file.hash]));
  const trackedHashes = new Map(
    (brain.trackedFiles ?? []).map((file) => [
      file.path,
      file.hash ?? `${file.size}:${file.mtimeMs}`,
    ]),
  );
  return hash(
    [...new Set(sourcePaths)]
      .sort()
      .map((file) => `${file}:${sourceHashes.get(file) ?? trackedHashes.get(file) ?? "missing"}`)
      .join("\n"),
  );
}

function draft(
  brain: RepositoryBrain,
  input: Omit<DraftChunk, "schemaVersion" | "sourceFingerprint" | "confidence">,
): DraftChunk {
  const sourcePaths = [...new Set(input.sourcePaths)].sort();
  return {
    ...input,
    sourcePaths,
    schemaVersion: 1,
    sourceFingerprint: sourceFingerprint(brain, sourcePaths),
    confidence: confidence(input.evidence),
  };
}

/** Builds compact facts agents can retrieve without reopening source files. */
function deriveChunks(brain: RepositoryBrain): DraftChunk[] {
  const chunks: DraftChunk[] = [];
  const rootManifest = "package.json";
  chunks.push(
    draft(brain, {
      id: "repository:root",
      kind: "repository",
      title: `${brain.repo.name} repository`,
      summary: `${brain.packages.length} package(s), ${brain.files.length} analyzed source file(s), ${brain.routes.length} verified route(s), and ${brain.dependencyGraph.filter((edge) => edge.kind === "internal").length} resolved internal dependency edge(s).`,
      sourcePaths: [rootManifest],
      evidence: [{ source: rootManifest, detail: "repository package boundary", confidence: "high" }],
    }),
  );
  for (const pkg of brain.packages) {
    const manifest = pkg.relativePath === "." ? "package.json" : `${pkg.relativePath}/package.json`;
    chunks.push(
      draft(brain, {
        id: `package:${pkg.relativePath}`,
        kind: "package",
        title: pkg.name,
        summary: `${pkg.framework} package with ${pkg.fileCount} source file(s), ${pkg.symbolCount} symbol(s), and ${pkg.routeCount} route(s).`,
        sourcePaths: [manifest],
        evidence: pkg.evidence,
      }),
    );
  }
  for (const file of brain.files) {
    const symbols = brain.symbols.filter((symbol) => symbol.file === file.path);
    chunks.push(
      draft(brain, {
        id: `module:${file.path}`,
        kind: "module",
        title: file.path,
        summary: `Exports: ${file.exports.join(", ") || "none"}; imports: ${file.imports.join(", ") || "none"}; symbols: ${symbols.map((symbol) => symbol.name).join(", ") || "none"}.`,
        sourcePaths: [file.path],
        evidence: file.evidence,
      }),
    );
    const edges = brain.dependencyGraph.filter((edge) => edge.from === file.path);
    if (edges.length) {
      const internalTargets = edges.filter((edge) => edge.kind === "internal").map((edge) => edge.to);
      chunks.push(
        draft(brain, {
          id: `dependency:${file.path}`,
          kind: "dependency",
          title: `Dependencies of ${file.path}`,
          summary: edges.map((edge) => `${edge.kind}: ${edge.to}`).join("; "),
          // A dependency fact is only current while both the importing module
          // and its resolved internal targets retain their fingerprints.
          sourcePaths: [file.path, ...internalTargets],
          evidence: edges.flatMap((edge) => edge.evidence),
        }),
      );
    }
  }
  for (const fact of brain.facts ?? []) chunks.push(draft(brain, {
    id: `fact:${fact.kind}:${fact.source}:${fact.line}:${fact.name}`, kind: fact.kind === "documentation" || fact.kind === "setup" ? "documentation" : "configuration",
    title: fact.name, summary: fact.summary, sourcePaths: [fact.source], evidence: [{ source: fact.source, line: fact.line, detail: fact.kind, confidence: fact.confidence }],
  }));
  for (const route of brain.routes) {
    chunks.push(
      draft(brain, {
        id: `route:${route.file}:${route.path}`,
        kind: "route",
        title: `${route.kind} ${route.path}`,
        summary: `${route.router} ${route.kind}${route.methods.length ? `; methods: ${route.methods.join(", ")}` : ""}.`,
        sourcePaths: [route.file],
        evidence: route.evidence,
      }),
    );
  }
  const tracked = brain.trackedFiles ?? [];
  for (const file of tracked.filter((item) => /(?:^|\/)(?:package\.json|tsconfig(?:\.[^/]+)?\.json|vite\.config\.|next\.config\.|eslint|prettier|vitest\.config\.|pnpm-workspace\.yaml)/.test(item.path))) {
    chunks.push(draft(brain, {
      id: `configuration:${file.path}`,
      kind: "configuration",
      title: file.path,
      summary: "Repository configuration tracked for freshness and reproducible behavior.",
      sourcePaths: [file.path],
      evidence: [{ source: file.path, detail: "tracked configuration file", confidence: "high" }],
    }));
  }
  for (const file of tracked.filter((item) => /(?:^|\/)(?:README|CONTRIBUTING|ARCHITECTURE|RULES|AGENTS)\.md$/i.test(item.path))) {
    chunks.push(draft(brain, {
      id: `documentation:${file.path}`,
      kind: "documentation",
      title: file.path,
      summary: "Repository documentation tracked as durable engineering context.",
      sourcePaths: [file.path],
      evidence: [{ source: file.path, detail: "tracked repository documentation", confidence: "high" }],
    }));
  }
  for (const file of brain.files.filter((item) => /(?:^|\/)(?:index|main|cli)\.[cm]?[jt]sx?$/.test(item.path))) {
    chunks.push(draft(brain, {
      id: `entry-point:${file.path}`,
      kind: "entry-point",
      title: file.path,
      summary: `Potential source entry point; exports: ${file.exports.join(", ") || "none"}.`,
      sourcePaths: [file.path],
      evidence: file.evidence,
    }));
  }
  const testFiles = brain.files.filter((file) => /(?:^|\/)(?:test|tests)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file.path));
  if (testFiles.length) {
    chunks.push(
      draft(brain, {
        id: "test-strategy:repository",
        kind: "test-strategy",
        title: "Repository test strategy",
        summary: `${testFiles.length} test source file(s) are present in the analyzed scope.`,
        sourcePaths: testFiles.map((file) => file.path),
        evidence: testFiles.flatMap((file) => file.evidence),
      }),
    );
  }
  return chunks.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Reconciles stable memory chunk identities. Callers need only provide the
 * current Brain and, on refresh, its prior memory graph.
 */
export function reconcileMemory(
  brain: RepositoryBrain,
  previous?: RepositoryMemory,
): RepositoryMemory {
  const now = brain.compiledAt;
  const prior = new Map((previous?.chunks ?? []).map((chunk) => [chunk.id, chunk]));
  const chunks: MemoryChunk[] = [];
  const changes: RepositoryMemory["changes"] = { created: [], updated: [], reused: [], removed: [] };
  for (const next of deriveChunks(brain)) {
    const old = prior.get(next.id);
    if (old && old.schemaVersion === next.schemaVersion && old.sourceFingerprint === next.sourceFingerprint) {
      chunks.push(old);
      changes.reused.push(next.id);
    } else {
      chunks.push({
        ...next,
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
        lastVerifiedAt: now,
      });
      changes[old ? "updated" : "created"].push(next.id);
    }
  }
  const currentIds = new Set(chunks.map((chunk) => chunk.id));
  changes.removed = [...prior.keys()].filter((id) => !currentIds.has(id)).sort();
  return { schemaVersion: 1, chunks, changes, reconciledAt: now };
}

/** A compact, deterministic answer for broad repository-orientation questions. */
export function deriveRepositoryProfile(brain: RepositoryBrain): RepositoryProfile {
  const paths = [...brain.files.map((file) => file.path), ...(brain.trackedFiles ?? []).map((file) => file.path)];
  const directoryCounts = new Map<string, number>();
  for (const file of paths) {
    const parts = file.split("/");
    const top = parts[0];
    if (parts.length > 1 && top && !top.includes(".")) directoryCounts.set(top, (directoryCounts.get(top) ?? 0) + 1);
  }
  const purpose = (directory: string) => ({
    app: "application routes, pages, layouts, and handlers",
    pages: "Pages Router routes and API handlers",
    src: "primary application source",
    lib: "shared application logic",
    components: "reusable UI components",
    prisma: "Prisma data schema and migrations",
    tests: "automated tests",
    scripts: "repository automation scripts",
    docs: "project documentation",
  }[directory] ?? "tracked repository area");
  const stack = [...new Set(brain.packages.flatMap((pkg) => [
    pkg.framework === "unknown" ? "" : pkg.framework,
    ...Object.keys(pkg.dependencies),
  ]).filter(Boolean))].sort();
  const entryPoints = [
    ...brain.routes.map((route) => `${route.kind} ${route.path} (${route.file})`),
    ...brain.files
      .filter((file) => /(?:^|\/)(?:index|main|cli)\.[cm]?[jt]sx?$/.test(file.path))
      .map((file) => file.path),
  ].slice(0, 40);
  const evidence = [
    ...brain.packages.flatMap((pkg) => pkg.evidence),
    ...brain.routes.flatMap((route) => route.evidence),
  ].slice(0, 40);
  return {
    summary: brain.architectureSummary,
    stack,
    directories: [...directoryCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, 20)
      .map(([path]) => ({ path, purpose: purpose(path) })),
    entryPoints,
    evidence,
    unknowns: paths.some((file) => /^README(?:\.md)?$/i.test(file))
      ? ["Repository purpose is inferred from deterministic structure; documentation prose is not interpreted automatically."]
      : ["No repository README was tracked; human product intent is unknown."],
  };
}

export function reconcileLearnedMemory(
  brain: RepositoryBrain,
  findings: LearnedFinding[] = [],
): LearnedFinding[] {
  const hashes = new Map(brain.files.map((file) => [file.path, file.hash]));
  return findings.map((finding) => {
    if (finding.authority === "human" || finding.state !== "current") return finding;
    const stale = finding.sources.some((source) => hashes.get(source.path) !== source.sourceHash);
    return stale ? { ...finding, state: "stale" as const } : finding;
  });
}
