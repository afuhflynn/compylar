import { z } from "zod";

export const EvidenceSchema = z.object({
  source: z.string(),
  line: z.number().int().positive().optional(),
  detail: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});
export const SourceFileSchema = z.object({
  path: z.string(),
  packageName: z.string(),
  kind: z.enum(["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs"]),
  hash: z.string(),
  lines: z.number().int().nonnegative(),
  imports: z.array(z.string()),
  exports: z.array(z.string()),
  preview: z.string(),
  diagnostics: z.array(z.string()),
  evidence: z.array(EvidenceSchema),
});
export const SymbolSchema = z.object({
  name: z.string(),
  kind: z.enum([
    "function",
    "class",
    "interface",
    "type",
    "variable",
    "enum",
    "namespace",
  ]),
  file: z.string(),
  packageName: z.string(),
  line: z.number().int().positive(),
  exported: z.boolean(),
  signature: z.string(),
});
export const RouteSchema = z.object({
  path: z.string(),
  file: z.string(),
  packageName: z.string(),
  router: z.enum(["next-app", "next-pages"]),
  kind: z.enum(["page", "layout", "api"]),
  methods: z.array(z.string()),
  evidence: z.array(EvidenceSchema),
});
export const PackageSchema = z.object({
  name: z.string(),
  rootPath: z.string(),
  relativePath: z.string(),
  framework: z.enum(["nextjs", "typescript", "unknown"]),
  scripts: z.record(z.string()),
  dependencies: z.record(z.string()),
  devDependencies: z.record(z.string()),
  fileCount: z.number().int().nonnegative(),
  symbolCount: z.number().int().nonnegative(),
  routeCount: z.number().int().nonnegative(),
  evidence: z.array(EvidenceSchema),
});
export const TrackedFileSchema = z.object({
  path: z.string(),
  hash: z.string().optional(),
  size: z.number().int().nonnegative(),
  mtimeMs: z.number().nonnegative(),
});
export const MemoryChunkSchema = z.object({
  id: z.string(),
  kind: z.enum(["repository", "package", "module", "route", "dependency", "test-strategy"]),
  title: z.string(),
  summary: z.string(),
  sourcePaths: z.array(z.string()),
  sourceFingerprint: z.string(),
  evidence: z.array(EvidenceSchema),
  confidence: z.enum(["high", "medium", "low"]),
  schemaVersion: z.literal(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastVerifiedAt: z.string(),
});
export const RepositoryMemorySchema = z.object({
  schemaVersion: z.literal(1),
  chunks: z.array(MemoryChunkSchema),
  changes: z.object({
    created: z.array(z.string()),
    updated: z.array(z.string()),
    reused: z.array(z.string()),
    removed: z.array(z.string()),
  }),
  reconciledAt: z.string(),
});
export const BrainSchema = z.object({
  brainVersion: z.literal(2),
  repo: z.object({
    name: z.string(),
    rootPath: z.string(),
    packageManager: z.string(),
    isWorkspace: z.boolean(),
  }),
  compiledAt: z.string(),
  fingerprint: z.string(),
  trackedFiles: z.array(TrackedFileSchema).optional(),
  memory: RepositoryMemorySchema.optional(),
  status: z.enum(["complete", "partial", "cancelled", "failed"]),
  analysis: z.object({
    filesDiscovered: z.number().int().nonnegative(),
    filesAnalyzed: z.number().int().nonnegative(),
    filesSkipped: z.number().int().nonnegative(),
    bytesAnalyzed: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    limits: z.object({
      maxFiles: z.number().int().positive(),
      maxFileSize: z.number().int().positive(),
      maxTotalBytes: z.number().int().positive(),
    }),
  }),
  packages: z.array(PackageSchema),
  files: z.array(SourceFileSchema),
  symbols: z.array(SymbolSchema),
  routes: z.array(RouteSchema),
  dependencyGraph: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      kind: z.enum(["internal", "external", "unresolved"]),
      packageName: z.string(),
      evidence: z.array(EvidenceSchema),
    }),
  ),
  diagnostics: z.array(
    z.object({
      severity: z.enum(["error", "warning", "info"]),
      message: z.string(),
      file: z.string().optional(),
      line: z.number().int().positive().optional(),
    }),
  ),
  ignored: z.array(z.object({ path: z.string(), reason: z.string() })),
  architectureSummary: z.string(),
  ai: z.object({
    status: z.enum([
      "not-configured",
      "pending",
      "completed",
      "timed-out",
      "failed",
    ]),
    model: z.string().optional(),
    summary: z.string().optional(),
    error: z.string().optional(),
  }),
});
export type Evidence = z.infer<typeof EvidenceSchema>;
export type RepositoryFile = z.infer<typeof SourceFileSchema>;
export type RepositoryBrain = z.infer<typeof BrainSchema>;
export type MemoryChunk = z.infer<typeof MemoryChunkSchema>;
export type RepositoryMemory = z.infer<typeof RepositoryMemorySchema>;
export type PackageUnit = z.infer<typeof PackageSchema>;
export type CompileLimits = {
  maxFiles: number;
  maxFileSize: number;
  maxTotalBytes: number;
};
export type CompileCheckpoint = {
  version: 1;
  rootPath: string;
  files: RepositoryBrain["files"];
  symbols: RepositoryBrain["symbols"];
  routes: RepositoryBrain["routes"];
  dependencyGraph: RepositoryBrain["dependencyGraph"];
  filesDiscovered: number;
  filesSkipped: number;
  bytesAnalyzed: number;
};
export type ProgressEvent = {
  phase:
    | "discover"
    | "enumerate"
    | "hash"
    | "parse"
    | "extract"
    | "resolve"
    | "persist"
    | "ai";
  current: number;
  total: number;
  message: string;
  packageName?: string;
  file?: string;
};
export type ContextPack = {
  brainVersion: 2;
  status: "context-ready";
  intent: "implementation" | "debugging" | "explanation" | "overview";
  actionability: "actionable" | "underspecified";
  mutationAllowed: false;
  retrievalMode: "deterministic" | "ai-assisted";
  confidence: "high" | "medium" | "low";
  task: string;
  generatedAt: string;
  taskSummary: string;
  selectedFiles: Array<{
    path: string;
    packageName: string;
    score: number;
    reason: string;
    symbols: string[];
    preview?: string;
  }>;
  memoryChunks: Array<{
    id: string;
    kind: MemoryChunk["kind"];
    title: string;
    summary: string;
    sourcePaths: string[];
    confidence: MemoryChunk["confidence"];
  }>;
  relevantPackages: string[];
  architectureNotes: string[];
  constraints: string[];
  agentInstructions: string[];
  assumptions: string[];
  excludedContext: string[];
  missingInformation: string[];
  candidateAreas: string[];
  budget: {
    limitTokens: number;
    estimatedTokens: number;
    includesPreviews: boolean;
    excludedEvidence: Array<{ path: string; reason: "budget" | "preview-not-requested" }>;
  };
  ai: {
    status: "not-requested" | "not-configured" | "completed" | "timed-out" | "failed" | "invalid";
    model?: string;
    interpretation?: string;
    error?: string;
  };
};
export type ContextClarification = {
  brainVersion: 2;
  status: "needs-clarification";
  intent: "ambiguous";
  actionability: "ambiguous";
  mutationAllowed: false;
  task: string;
  reason: string;
  missingInformation: string[];
  candidateAreas: string[];
  suggestions: string[];
};
export type ContextResult = ContextPack | ContextClarification;
