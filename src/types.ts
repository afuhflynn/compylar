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
  kind: z.string().min(1),
  hash: z.string(),
  lines: z.number().int().nonnegative(),
  imports: z.array(z.string()),
  exports: z.array(z.string()),
  preview: z.string(),
  diagnostics: z.array(z.string()),
  evidence: z.array(EvidenceSchema),
});
export const PrismaModelSchema = z.object({
  name: z.string(), file: z.string(), line: z.number().int().positive(),
  fields: z.array(z.object({ name: z.string(), type: z.string(), line: z.number().int().positive() })),
  relations: z.array(z.object({ field: z.string(), target: z.string(), line: z.number().int().positive() })),
  kind: z.enum(["model", "enum"]),
});
export const ReferenceSchema = z.object({
  from: z.string(), to: z.string(), symbol: z.string(), line: z.number().int().positive(),
  kind: z.enum(["call", "reference", "test"]), confidence: z.enum(["high", "medium"]),
});
export const GuardSchema = z.object({
  file: z.string(), line: z.number().int().positive(), kind: z.enum(["middleware", "proxy", "guard-call"]),
  name: z.string(), matcher: z.array(z.string()),
});
export const CapabilitySchema = z.object({
  adapter: z.string(),
  status: z.enum(["active", "not-detected", "structural-only"]),
  facts: z.array(z.string()),
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
  declaration: z.string().optional(),
});
export const RouteSchema = z.object({
  path: z.string(),
  file: z.string(),
  packageName: z.string(),
  router: z.string().min(1),
  kind: z.string().min(1),
  methods: z.array(z.string()),
  evidence: z.array(EvidenceSchema),
});
export const PackageSchema = z.object({
  name: z.string(),
  rootPath: z.string(),
  relativePath: z.string(),
  framework: z.string().min(1),
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
export const RepositoryFactSchema = z.object({
  kind: z.enum(["documentation", "setup", "script", "environment", "schema", "server-action", "job"]),
  name: z.string(), summary: z.string(), source: z.string(), line: z.number().int().positive(),
  excerpt: z.string().optional(), confidence: z.enum(["high", "medium", "low"]),
});
export const MemoryChunkSchema = z.object({
  id: z.string(),
  kind: z.enum(["repository", "package", "module", "route", "dependency", "test-strategy", "entry-point", "configuration", "documentation"]),
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
export const LearnedFindingSchema = z.object({
  id: z.string(),
  kind: z.enum(["flow", "system", "constraint", "convention", "gotcha", "decision", "task-outcome", "unknown"]),
  summary: z.string().min(1),
  authority: z.enum(["compiler", "agent", "human"]),
  sources: z.array(z.object({
    path: z.string(),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    sourceHash: z.string(),
  })),
  originQuestion: z.string().optional(),
  createdAt: z.string(),
  verifiedAt: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  state: z.enum(["current", "stale", "superseded", "archived"]),
  supersedes: z.string().optional(),
  stableKey: z.string().min(1).optional(),
  systems: z.array(z.string().min(1)).default([]),
});
export const LearnedMemorySchema = z.object({
  schemaVersion: z.literal(1),
  findings: z.array(LearnedFindingSchema),
});
export const SemanticMemoryCategorySchema = z.enum([
  "foundation", "system", "flow", "contract", "test-guarantee", "convention", "unknown",
]);
export const SemanticIndexSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(["absent", "in-progress", "complete", "partially-stale", "structurally-stale"]),
  sourceFingerprint: z.string().optional(),
  manifestHash: z.string().optional(),
  artifactPath: z.string().optional(),
  artifactHash: z.string().optional(),
  producerVersion: z.string().optional(),
  completedAt: z.string().optional(),
  coverage: z.array(SemanticMemoryCategorySchema),
  blockers: z.array(z.string()),
  unknowns: z.array(z.string()),
  findingCount: z.number().int().nonnegative(),
});
export const SemanticIndexManifestSchema = z.object({
  schemaVersion: z.literal(1),
  producer: z.object({ name: z.literal("codebase-index"), version: z.string().min(1) }),
  generatedAt: z.string(),
  brainFingerprint: z.string().min(1),
  artifact: z.object({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/i) }),
  verification: z.object({ complete: z.boolean(), blockers: z.array(z.string()) }),
  coverage: z.array(SemanticMemoryCategorySchema),
  unknowns: z.array(z.string()),
  findings: z.array(z.object({
    key: z.string().min(1),
    kind: z.enum(["flow", "system", "constraint", "convention", "gotcha", "unknown"]),
    summary: z.string().min(1),
    confidence: z.enum(["high", "medium", "low"]),
    sources: z.array(z.object({ path: z.string(), startLine: z.number().int().positive(), endLine: z.number().int().positive() })).min(1),
  })),
});
export const MemoryDeltaManifestSchema = z.object({
  schemaVersion: z.literal(1),
  task: z.string().min(1),
  findings: z.array(z.object({
    key: z.string().min(1),
    kind: z.enum(["flow", "system", "constraint", "convention", "gotcha", "decision", "task-outcome", "unknown"]),
    summary: z.string().min(1),
    systems: z.array(z.string().min(1)).min(1),
    confidence: z.enum(["high", "medium", "low"]),
    sources: z.array(z.object({ path: z.string(), startLine: z.number().int().positive(), endLine: z.number().int().positive() })).min(1),
  })),
  dismissal: z.object({ reason: z.string().min(1), sources: z.array(z.object({ path: z.string(), startLine: z.number().int().positive(), endLine: z.number().int().positive() })).min(1) }).optional(),
}).refine((value) => value.findings.length > 0 || value.dismissal !== undefined, { message: "A memory delta needs a finding or a cited dismissal." });
export const RepositoryProfileSchema = z.object({
  summary: z.string(),
  stack: z.array(z.string()),
  directories: z.array(z.object({ path: z.string(), purpose: z.string() })),
  entryPoints: z.array(z.string()),
  evidence: z.array(EvidenceSchema),
  unknowns: z.array(z.string()),
});
export const BrainSchema = z.object({
  brainVersion: z.literal(4),
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
  learnedMemory: LearnedMemorySchema.optional(),
  semanticIndex: SemanticIndexSchema.optional(),
  facts: z.array(RepositoryFactSchema).optional(),
  profile: RepositoryProfileSchema.optional(),
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
  prisma: z.array(PrismaModelSchema).optional(),
  references: z.array(ReferenceSchema).optional(),
  guards: z.array(GuardSchema).optional(),
  capabilities: z.array(CapabilitySchema).optional(),
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
export type PrismaModel = z.infer<typeof PrismaModelSchema>;
export type RepositoryReference = z.infer<typeof ReferenceSchema>;
export type RepositoryGuard = z.infer<typeof GuardSchema>;
export type RepositoryCapability = z.infer<typeof CapabilitySchema>;
export type MemoryChunk = z.infer<typeof MemoryChunkSchema>;
export type RepositoryMemory = z.infer<typeof RepositoryMemorySchema>;
export type LearnedFinding = z.infer<typeof LearnedFindingSchema>;
export type LearnedMemory = z.infer<typeof LearnedMemorySchema>;
export type SemanticMemoryCategory = z.infer<typeof SemanticMemoryCategorySchema>;
export type SemanticIndex = z.infer<typeof SemanticIndexSchema>;
export type SemanticIndexManifest = z.infer<typeof SemanticIndexManifestSchema>;
export type MemoryDeltaManifest = z.infer<typeof MemoryDeltaManifestSchema>;
export type RepositoryProfile = z.infer<typeof RepositoryProfileSchema>;
export type RepositoryFact = z.infer<typeof RepositoryFactSchema>;
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
  brainVersion: 4;
  status: "context-ready";
  intent: "implementation" | "debugging" | "explanation" | "overview";
  actionability: "actionable" | "underspecified";
  mutationAllowed: false;
  retrievalMode: "deterministic" | "ai-assisted";
  confidence: "high" | "medium" | "low";
  task: string;
  generatedAt: string;
  taskSummary: string;
  queryPlan: {
    strategy: "repository-profile" | "exact-lookup" | "system-retrieval" | "targeted-read";
    normalizedQuestion: string;
    sourceReadRequired: boolean;
  };
  overview?: RepositoryProfile;
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
  learnedFindings: Array<Pick<LearnedFinding, "id" | "kind" | "summary" | "authority" | "sources" | "confidence" | "state" | "systems">>;
  relevantPackages: string[];
  architectureNotes: string[];
  constraints: string[];
  agentInstructions: string[];
  assumptions: string[];
  excludedContext: string[];
  missingInformation: string[];
  candidateAreas: string[];
  systems: Array<{
    name: string;
    files: string[];
    relationships: Array<{ from: string; to: string; kind: string }>;
  }>;
  coverage: {
    decision: "memory-sufficient" | "targeted-read-required" | "insufficient-index";
    unresolved: string[];
  };
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
  brainVersion: 4;
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
