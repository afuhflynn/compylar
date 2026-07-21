import { ContextClarification, ContextPack, ContextResult, RepositoryBrain } from "./types.js";
import { deriveRepositoryProfile } from "./memory.js";

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "for", "from", "in", "into",
  "is", "of", "on", "or", "the", "to", "with", "does", "do", "how", "work", "works",
]);
const AMBIGUOUS_TERMS = new Set([
  "what", "happening", "happen", "going", "on", "status", "thing", "things",
  "stuff", "something", "overview", "everything",
]);
const IMPLEMENTATION_TERMS = new Set([
  "add", "build", "change", "create", "implement", "modify", "refactor", "remove", "update",
]);
const DEBUGGING_TERMS = new Set([
  "broken", "bug", "crash", "debug", "error", "fail", "fix", "issue", "loading", "slow", "timeout", "why",
]);
const EXPLANATION_TERMS = new Set([
  "describe", "explain", "flow", "understand", "where", "work", "works",
]);
const SYNONYMS: Record<string, string[]> = {
  auth: ["authentication", "authorization", "login", "signin", "sign-in"],
  authentication: ["auth", "authorization", "login", "signin", "sign-in"],
  login: ["auth", "authentication", "signin", "sign-in"],
  loading: ["pending", "spinner", "fetch", "fetching"],
};

export type ContextIntent = ContextPack["intent"] | "ambiguous";
export type ContextOptions = {
  includePreview?: boolean;
  budgetTokens?: number;
};
const DEFAULT_CONTEXT_BUDGET_TOKENS = 2000;
const MIN_CONTEXT_BUDGET_TOKENS = 512;
const estimatedTokens = (value: unknown) => Math.ceil(Buffer.byteLength(JSON.stringify(value), "utf8") / 4);

const tokenize = (task: string) =>
  task
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .map((term) => term.replace(/^-+|-+$/g, ""))
    .filter((term) => term.length > 2 && !STOPWORDS.has(term));

function candidateAreas(brain: RepositoryBrain): string[] {
  const areas = new Set<string>();
  const genericAreas = new Set(["app", "pages", "lib", "components", "ui", "actions", "utils", "hooks"]);
  for (const route of brain.routes) {
    const segment = route.path.split("/").filter(Boolean)[0];
    if (segment && !genericAreas.has(segment)) areas.add(segment.replace(/^\((.*)\)$/, "$1"));
  }
  for (const file of brain.files) {
    const parts = file.path.split("/");
    const appIndex = Math.max(parts.indexOf("app"), parts.indexOf("pages"));
    const area = parts[appIndex + 1];
    if (area && !area.includes(".") && !genericAreas.has(area)) areas.add(area.replace(/^\((.*)\)$/, "$1"));
  }
  return [...areas].sort().slice(0, 12);
}

function classify(task: string, terms: string[]): { intent: ContextIntent; ambiguous: boolean } {
  const lower = task.toLowerCase();
  const hasConcreteTerm = terms.some((term) => !AMBIGUOUS_TERMS.has(term));
  if (!hasConcreteTerm || terms.length === 0 || /^(what|how|why)\s+(is|are|does|do)?\s*(this|that|it|happening|going on)?\s*\??$/i.test(lower.trim())) {
    return { intent: "ambiguous", ambiguous: true };
  }
  if (terms.some((term) => IMPLEMENTATION_TERMS.has(term))) {
    return { intent: "implementation", ambiguous: false };
  }
  if (terms.some((term) => DEBUGGING_TERMS.has(term))) {
    return { intent: "debugging", ambiguous: false };
  }
  if (terms.some((term) => EXPLANATION_TERMS.has(term))) {
    return { intent: "explanation", ambiguous: false };
  }
  return { intent: "overview", ambiguous: false };
}

function missingInformation(intent: ContextPack["intent"], terms: string[]): string[] {
  if (intent === "debugging" && terms.length <= 3) {
    return ["observed symptom", "expected behavior", "reproduction details"];
  }
  if (intent === "implementation" && terms.length <= 2) {
    return ["desired behavior", "scope of the change", "acceptance criteria"];
  }
  return [];
}

function clarification(brain: RepositoryBrain, task: string): ContextClarification {
  const areas = candidateAreas(brain);
  return {
    brainVersion: 4,
    status: "needs-clarification",
    intent: "ambiguous",
    actionability: "ambiguous",
    mutationAllowed: false,
    task,
    reason: "The request does not identify a feature, symptom, or repository area.",
    missingInformation: ["target area", "observed behavior", "desired outcome"],
    candidateAreas: areas,
    suggestions: areas.slice(0, 3).map((area) => `explain the ${area} flow`),
  };
}

function expandedTerms(terms: string[]): Set<string> {
  return new Set(terms.flatMap((term) => [term, ...(SYNONYMS[term] ?? [])]));
}

const codeTokens = (value: string) => tokenize(value).filter((term) => !STOPWORDS.has(term));

function expandSystem(brain: RepositoryBrain, seeds: string[], maxDepth = 3) {
  const visited = new Set(seeds);
  let frontier = [...seeds];
  const degree = new Map<string, number>();
  for (const edge of brain.dependencyGraph.filter((item) => item.kind === "internal")) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
  }
  for (let depth = 0; depth < maxDepth && frontier.length; depth += 1) {
    const next: string[] = [];
    for (const edge of brain.dependencyGraph.filter((item) => item.kind === "internal")) {
      // Shared barrels/types are useful only when they were query seeds. Do not
      // let a high-degree hub turn every consumer into task context.
      if (frontier.includes(edge.from) && !visited.has(edge.to) && (seeds.includes(edge.to) || (degree.get(edge.to) ?? 0) <= 12)) { visited.add(edge.to); next.push(edge.to); }
      if (frontier.includes(edge.to) && !visited.has(edge.from) && (seeds.includes(edge.from) || (degree.get(edge.from) ?? 0) <= 12)) { visited.add(edge.from); next.push(edge.from); }
    }
    frontier = next;
  }
  const files = [...visited].filter((file) => brain.files.some((item) => item.path === file));
  const relationships = brain.dependencyGraph
    .filter((edge) => edge.kind === "internal" && visited.has(edge.from) && visited.has(edge.to))
    .map((edge) => ({ from: edge.from, to: edge.to, kind: edge.kind }));
  return { files, relationships };
}

function buildDeterministicContext(
  brain: RepositoryBrain,
  task: string,
  intent: Exclude<ContextIntent, "ambiguous">,
  options: ContextOptions = {},
): ContextPack {
  const budgetTokens = options.budgetTokens ?? DEFAULT_CONTEXT_BUDGET_TOKENS;
  if (budgetTokens < MIN_CONTEXT_BUDGET_TOKENS) {
    throw new Error(`Context budget must be at least ${MIN_CONTEXT_BUDGET_TOKENS} tokens; smaller requests cannot carry a trustworthy context contract.`);
  }
  const includePreview = options.includePreview === true;
  const terms = tokenize(task);
  const broadOverview = intent === "overview" && /\b(this|the)?\s*(project|repository|codebase|app)\b/i.test(task);
  const searchableTerms = expandedTerms(terms);
  const scored = brain.files.map((file) => {
    const symbols = brain.symbols.filter((symbol) => symbol.file === file.path);
    const route = brain.routes.find((item) => item.file === file.path);
    const pathTokens = file.path.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const symbolTokens = symbols.flatMap((symbol) => codeTokens(`${symbol.name} ${symbol.signature}`));
    const haystackTokens = new Set([
      ...pathTokens,
      file.packageName.toLowerCase(),
      ...file.imports.flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/)),
      ...file.exports.flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/)),
      ...symbolTokens,
    ]);
    const hits = [...searchableTerms].filter((term) => haystackTokens.has(term));
    const exactPathHits = terms.filter((term) => pathTokens.includes(term));
    const exactSymbolHits = terms.filter((term) => symbols.some((symbol) => symbol.name.toLowerCase() === term));
    const routePathTokens = route?.path.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean) ?? [];
    const routeMatch = route && [...searchableTerms].some((term) => routePathTokens.includes(term));
    const graphHits = brain.dependencyGraph.filter((edge) => edge.from === file.path || edge.to === file.path).length;
    const score =
      hits.length * 2 +
      exactPathHits.length * 5 +
      exactSymbolHits.length * 6 +
      Math.min(graphHits, 3) +
      (routeMatch ? 2 : 0);
    return { file, symbols, route, routeMatch, score, hits, exactPathHits, exactSymbolHits };
  }).sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path));
  const selected = broadOverview
    ? []
    : scored.filter((item) => item.hits.length > 0 || item.exactPathHits.length > 0 || item.exactSymbolHits.length > 0 || item.routeMatch).slice(0, 4);
  const expanded = selected.length ? expandSystem(brain, selected.map((item) => item.file.path)) : { files: [], relationships: [] };
  const byPath = new Map(scored.map((item) => [item.file.path, item]));
  const fallback = selected.length
    ? [...selected, ...expanded.files.filter((file) => !selected.some((item) => item.file.path === file)).map((file) => byPath.get(file)).filter((item): item is typeof scored[number] => Boolean(item))].slice(0, 12)
    : [];
  const relevantPackages = [...new Set(fallback.map((item) => item.file.packageName))];
  const selectedPaths = new Set(fallback.map((item) => item.file.path));
  const memoryChunks = (brain.memory?.chunks ?? [])
    .filter(
      (chunk) =>
        chunk.kind === "repository" ||
        chunk.sourcePaths.some((source) => selectedPaths.has(source)),
    )
    .slice(0, 12)
    .map((chunk) => ({
      id: chunk.id,
      kind: chunk.kind,
      title: chunk.title,
      summary: chunk.summary,
      sourcePaths: chunk.sourcePaths,
      confidence: chunk.confidence,
    }));
  const learnedFindings = (brain.learnedMemory?.findings ?? [])
    .filter((finding) => finding.state === "current")
    .filter((finding) => broadOverview || finding.sources.some((source) => selectedPaths.has(source.path)))
    .slice(0, 12)
    .map(({ id, kind, summary, authority, sources, confidence, state, systems }) => ({ id, kind, summary, authority, sources, confidence, state, systems }));
  const missing = missingInformation(intent, terms);
  const architectureQuestion = /\b(?:architecture|system|flow|state|design|constraint|invariant|tradeoff)\b/i.test(task);
  const semanticArchitectureReady = brain.semanticIndex === undefined || (brain.semanticIndex.status === "complete" && (brain.learnedMemory?.findings ?? []).some((finding) => finding.state === "current" && finding.systems.length > 0));
  const systemTerms = terms.filter((term) => ![...IMPLEMENTATION_TERMS, ...DEBUGGING_TERMS, ...EXPLANATION_TERMS].includes(term));
  const systems: ContextPack["systems"] = expanded.files.length >= 2 ? [{
    name: systemTerms.slice(0, 3).join(" ") || "related repository system",
    files: expanded.files,
    relationships: expanded.relationships,
  }] : [];
  const confidence = broadOverview ? "high" : systems.length ? "high" : selected.length ? "medium" : "low";

  const selectedFiles: ContextPack["selectedFiles"] = fallback.map((item) => ({
    path: item.file.path,
    packageName: item.file.packageName,
    score: item.score,
    reason: [
      item.exactPathHits.length ? `path match: ${item.exactPathHits.join(", ")}` : "",
      item.exactSymbolHits.length ? `symbol match: ${item.exactSymbolHits.join(", ")}` : "",
      item.hits.length ? `repository terms: ${item.hits.join(", ")}` : "",
      item.routeMatch ? `route: ${item.route?.path}` : "",
      !item.hits.length && !item.route ? "fallback high-signal file" : "",
    ].filter(Boolean).join("; "),
    symbols: item.symbols.map((symbol) => `${symbol.name} (${symbol.kind}, line ${symbol.line})`),
  }));
  const base: Omit<ContextPack, "budget"> = {
    brainVersion: 4,
    status: "context-ready",
    intent,
    actionability: missing.length ? "underspecified" : "actionable",
    mutationAllowed: false,
    retrievalMode: "deterministic",
    confidence,
    task,
    generatedAt: new Date().toISOString(),
    taskSummary: `${intent === "debugging" ? "Investigate" : intent === "explanation" ? "Explain" : intent === "overview" ? "Describe" : "Plan"}: ${task}. Use verified evidence before proposing changes.`,
    queryPlan: {
      strategy: broadOverview ? "repository-profile" : systems.length ? "system-retrieval" : selected.length ? "exact-lookup" : "targeted-read",
      normalizedQuestion: broadOverview ? "repository overview" : systemTerms.join(" ") || task,
      sourceReadRequired: (architectureQuestion && !semanticArchitectureReady) || (!broadOverview && (!systems.length || intent === "implementation" || intent === "debugging")),
    },
    overview: broadOverview ? (brain.profile ?? deriveRepositoryProfile(brain)) : undefined,
    selectedFiles,
    memoryChunks,
    learnedFindings,
    relevantPackages,
    architectureNotes: [
      brain.architectureSummary,
      ...brain.packages.filter((pkg) => relevantPackages.includes(pkg.name)).map((pkg) => `${pkg.name}: ${pkg.framework}, ${pkg.fileCount} files, scripts: ${Object.keys(pkg.scripts).join(", ") || "none"}`),
      ...(brain.ai.summary ? [`AI interpretation (non-authoritative): ${brain.ai.summary}`] : []),
    ],
    constraints: [
      brain.routes.length ? `${brain.routes.length} verified routes exist; preserve their owning package boundaries.` : "No verified application routes were found in the analyzed scope.",
      brain.diagnostics.length ? `${brain.diagnostics.length} diagnostics require review before relying on complete knowledge.` : "No parser diagnostics were recorded.",
      "This context is read-only evidence; mutation requires separate harness authorization.",
    ],
    agentInstructions: [
      "Reflect the request and ask for missing details before editing when actionability is underspecified.",
      broadOverview ? "Answer from the repository profile; do not reopen source merely to restate architecture." : "Read only the selected, current source range when implementation detail is truly required.",
      "Use the package, route, symbol, and dependency evidence to trace the task.",
      "Treat deterministic facts as authoritative; call out assumptions before inventing missing behavior.",
    ],
    assumptions: [],
    excludedContext: brain.files.filter((file) => !fallback.some((item) => item.file.path === file.path)).slice(0, 12).map((file) => file.path),
    missingInformation: missing,
    candidateAreas: candidateAreas(brain),
    systems,
    coverage: {
      decision: architectureQuestion && !semanticArchitectureReady ? "insufficient-index" : broadOverview || systems.length ? "memory-sufficient" : selected.length ? "targeted-read-required" : "insufficient-index",
      unresolved: architectureQuestion && !semanticArchitectureReady ? ["semantic-architecture-memory-not-complete"] : broadOverview ? (brain.profile ?? deriveRepositoryProfile(brain)).unknowns : systems.length ? [] : selected.length ? ["missing-contract"] : ["no-evidence"],
    },
    ai: { status: "not-requested" },
  };
  const excludedEvidence: ContextPack["budget"]["excludedEvidence"] = [];
  const pack = (): ContextPack => ({
    ...base,
    budget: {
      limitTokens: budgetTokens,
      estimatedTokens: 0,
      includesPreviews: includePreview,
      excludedEvidence,
    },
  });
  const measure = () => estimatedTokens(pack());
  while (measure() > budgetTokens && selectedFiles.length > 1) {
    const removed = selectedFiles.pop()!;
    excludedEvidence.push({ path: removed.path, reason: "budget" });
  }
  if (!includePreview) {
    for (const file of selectedFiles) excludedEvidence.push({ path: file.path, reason: "preview-not-requested" });
  } else {
    for (const file of selectedFiles) {
      const preview = fallback.find((item) => item.file.path === file.path)?.file.preview ?? "";
      if (!preview || measure() >= budgetTokens) {
        excludedEvidence.push({ path: file.path, reason: "budget" });
        continue;
      }
      let lower = 0;
      let upper = preview.length;
      while (lower < upper) {
        const length = Math.ceil((lower + upper) / 2);
        file.preview = preview.slice(0, length);
        if (measure() <= budgetTokens) lower = length;
        else upper = length - 1;
      }
      file.preview = preview.slice(0, lower);
      if (lower < preview.length) excludedEvidence.push({ path: file.path, reason: "budget" });
      if (!lower) delete file.preview;
    }
  }
  let result = pack();
  while (estimatedTokens(result) > budgetTokens) {
    const previewFile = [...selectedFiles].reverse().find((file) => file.preview);
    if (previewFile?.preview) {
      const excessCharacters = (estimatedTokens(result) - budgetTokens) * 4;
      previewFile.preview = previewFile.preview.slice(0, Math.max(0, previewFile.preview.length - excessCharacters));
      if (!previewFile.preview) delete previewFile.preview;
      result = pack();
      continue;
    }
    if (selectedFiles.length <= 1) break;
    const removed = selectedFiles.pop()!;
    excludedEvidence.push({ path: removed.path, reason: "budget" });
    result = pack();
  }
  result.budget.estimatedTokens = estimatedTokens(result);
  if (result.budget.estimatedTokens > budgetTokens) {
    throw new Error(`Context cannot fit the ${budgetTokens}-token budget without dropping required contract fields. Increase --budget.`);
  }
  return result;
}

export function buildContext(brain: RepositoryBrain, task: string, options: ContextOptions = {}): ContextPack {
  const terms = tokenize(task);
  const classified = classify(task, terms);
  if (classified.ambiguous) {
    throw new Error("Context request needs clarification before retrieval.");
  }
  return buildDeterministicContext(brain, task, classified.intent as Exclude<ContextIntent, "ambiguous">, options);
}

export function buildContextResult(brain: RepositoryBrain, task: string, options: ContextOptions = {}): ContextResult {
  const terms = tokenize(task);
  const classified = classify(task, terms);
  if (classified.intent === "debugging" && missingInformation("debugging", terms).length) {
    return {
      ...clarification(brain, task),
      reason: "Debugging requires a target area, observed symptom, expected behavior, and reproduction details.",
      missingInformation: missingInformation("debugging", terms),
    };
  }
  return classified.ambiguous
    ? clarification(brain, task)
    : buildDeterministicContext(brain, task, classified.intent as Exclude<ContextIntent, "ambiguous">, options);
}

export function contextMarkdown(pack: ContextPack) {
  return [
    `# Compylar Context Pack`,
    ``,
    `> Generated from Repository Brain v${pack.brainVersion} at ${pack.generatedAt}. Deterministic facts are authoritative; AI interpretation is labeled.`,
    ``,
    `## Request`,
    pack.task,
    ``,
    `- Intent: ${pack.intent}`,
    `- Actionability: ${pack.actionability}`,
    `- Retrieval: ${pack.retrievalMode} (${pack.confidence} confidence)`,
    `- Mutation allowed: no`,
    ``,
    `## Task summary`,
    pack.taskSummary,
    ``,
    ...(pack.overview ? [
      `## Repository overview`,
      pack.overview.summary,
      ``,
      `Stack: ${pack.overview.stack.join(", ") || "not deterministically identified"}`,
      ``,
      `Directories:`,
      ...pack.overview.directories.map((directory) => `- \`${directory.path}\`: ${directory.purpose}`),
      ``,
      `Entry points:`,
      ...(pack.overview.entryPoints.length ? pack.overview.entryPoints.map((entry) => `- ${entry}`) : ["- None identified."]),
      ``,
    ] : []),
    `## Query plan`,
    `- Strategy: ${pack.queryPlan.strategy}`,
    `- Normalized question: ${pack.queryPlan.normalizedQuestion}`,
    `- Source read required: ${pack.queryPlan.sourceReadRequired ? "yes, only a targeted current range" : "no"}`,
    ``,
    `## Memory coverage`,
    `- ${pack.coverage.decision}`,
    ...pack.coverage.unresolved.map((item) => `- ${item}`),
    ``,
    ...(pack.systems.length ? [
      `## Retrieved systems`,
      ...pack.systems.flatMap((system) => [
        `### ${system.name}`,
        `Files: ${system.files.map((file) => `\`${file}\``).join(", ")}`,
        ...system.relationships.map((edge) => `- ${edge.from} → ${edge.to} (${edge.kind})`),
        ``,
      ]),
    ] : []),
    ...(pack.missingInformation.length ? ["## Missing information", ...pack.missingInformation.map((item) => `- ${item}`), ""] : []),
    `## Relevant packages`,
    ...pack.relevantPackages.map((pkg) => `- \`${pkg}\``),
    ``,
    `## Relevant files`,
    ...pack.selectedFiles.flatMap((file) => [
      `### \`${file.path}\``,
      `Package: \`${file.packageName}\` · score: ${file.score} · ${file.reason}`,
      file.symbols.length ? `Symbols: ${file.symbols.join(", ")}` : "Symbols: none extracted",
      "",
      ...(file.preview ? ["```typescript", file.preview, "```"] : ["Preview: not included; request --include-preview when implementation detail is needed."]),
      "",
    ]),
    ...(pack.memoryChunks.length ? [
      `## Reusable memory`,
      ...pack.memoryChunks.flatMap((chunk) => [
        `### ${chunk.title}`,
        `${chunk.kind} · ${chunk.confidence} confidence · sources: ${chunk.sourcePaths.map((source) => `\`${source}\``).join(", ")}`,
        chunk.summary,
        "",
      ]),
    ] : []),
    ...(pack.learnedFindings.length ? [
      `## Learned memory`,
      ...pack.learnedFindings.flatMap((finding) => [
        `### ${finding.kind}: ${finding.summary}`,
        `${finding.authority} · ${finding.confidence} confidence · sources: ${finding.sources.length ? finding.sources.map((source) => `\`${source.path}:${source.startLine}-${source.endLine}\``).join(", ") : "human-authoritative"}`,
        ``,
      ]),
    ] : []),
    `## Architecture notes`,
    ...pack.architectureNotes.map((note) => `- ${note}`),
    ``,
    `## Constraints`,
    ...pack.constraints.map((note) => `- ${note}`),
    ``,
    `## Agent instructions`,
    ...pack.agentInstructions.map((note) => `- ${note}`),
    ``,
    `## AI interpretation`,
    pack.ai.status === "completed" && pack.ai.interpretation ? pack.ai.interpretation : `- ${pack.ai.status}`,
    ``,
    `## Assumptions`,
    ...(pack.assumptions.length ? pack.assumptions.map((note) => `- ${note}`) : ["- None recorded."]),
    ``,
    `## Excluded context`,
    ...(pack.excludedContext.length ? pack.excludedContext.map((file) => `- \`${file}\``) : ["- None."]),
    ``,
    `## Request budget`,
    `- ${pack.budget.estimatedTokens}/${pack.budget.limitTokens} estimated tokens · previews ${pack.budget.includesPreviews ? "requested" : "not requested"}`,
    ...(pack.budget.excludedEvidence.length ? pack.budget.excludedEvidence.map((item) => `- \`${item.path}\`: ${item.reason}`) : ["- No evidence omitted by the request budget."]),
    ``,
  ].join("\n");
}
