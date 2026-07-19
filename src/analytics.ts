import Table from "cli-table3";
import chalk from "chalk";
import { RepositoryBrain } from "./types.js";

export type CompileAnalytics = {
  repository: string;
  root: string;
  status: RepositoryBrain["status"];
  packages: number;
  filesDiscovered: number;
  filesAnalyzed: number;
  filesSkipped: number;
  bytesAnalyzed: number;
  symbols: number;
  routes: number;
  internalEdges: number;
  externalEdges: number;
  unresolvedEdges: number;
  diagnostics: number;
  ignored: number;
  aiStatus: RepositoryBrain["ai"]["status"];
  durationMs: number;
  compiledAt: string;
};

export type BrainReportOptions = {
  routes?: boolean;
  dependencies?: boolean;
  full?: boolean;
};

export function buildAnalytics(brain: RepositoryBrain): CompileAnalytics {
  return {
    repository: brain.repo.name,
    root: brain.repo.rootPath,
    status: brain.status,
    packages: brain.packages.length,
    filesDiscovered: brain.analysis.filesDiscovered,
    filesAnalyzed: brain.analysis.filesAnalyzed,
    filesSkipped: brain.analysis.filesSkipped,
    bytesAnalyzed: brain.analysis.bytesAnalyzed,
    symbols: brain.symbols.length,
    routes: brain.routes.length,
    internalEdges: brain.dependencyGraph.filter((edge) => edge.kind === "internal").length,
    externalEdges: brain.dependencyGraph.filter((edge) => edge.kind === "external").length,
    unresolvedEdges: brain.dependencyGraph.filter((edge) => edge.kind === "unresolved").length,
    diagnostics: brain.diagnostics.length,
    ignored: brain.ignored.length,
    aiStatus: brain.ai.status,
    durationMs: brain.analysis.durationMs,
    compiledAt: brain.compiledAt,
  };
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

export function analyticsTable(brain: RepositoryBrain): string {
  const analytics = buildAnalytics(brain);
  const table = new Table({
    head: [chalk.bold("Metric"), chalk.bold("Value")],
    colWidths: [28, 58],
    wordWrap: true,
    style: { head: [], border: [] },
  });
  table.push(
    ["Repository", analytics.repository],
    ["Root", analytics.root],
    ["Status", analytics.status],
    ["Packages", analytics.packages],
    ["Files", `${analytics.filesAnalyzed}/${analytics.filesDiscovered} analyzed`],
    ["Skipped", analytics.filesSkipped],
    ["Source size", formatBytes(analytics.bytesAnalyzed)],
    ["Symbols", analytics.symbols],
    ["Routes", analytics.routes],
    ["Dependency edges", `${analytics.internalEdges} internal · ${analytics.externalEdges} external · ${analytics.unresolvedEdges} unresolved`],
    ["Diagnostics", analytics.diagnostics],
    ["Ignored projects", analytics.ignored],
    ["AI enrichment", aiStatusMessage(brain)],
    ["Duration", `${(analytics.durationMs / 1000).toFixed(1)}s`],
  );
  return table.toString();
}

export function conciseSummary(brain: RepositoryBrain): string {
  const analytics = buildAnalytics(brain);
  const stale = analytics.status === "partial" || analytics.status === "cancelled";
  return [
    `${stale ? chalk.yellow("⚠") : chalk.green("✔")} Compiled ${analytics.repository} · ${analytics.status}`,
    `Repository: ${analytics.repository}`,
    `Analyzed ${analytics.filesAnalyzed}/${analytics.filesDiscovered} files · ${analytics.symbols} symbols · ${analytics.internalEdges} internal edges · ${analytics.routes} routes`,
    `Skipped: ${analytics.filesSkipped} files · ${formatBytes(analytics.bytesAnalyzed)}`,
    memoryRefreshSummary(brain),
    analytics.diagnostics ? chalk.yellow(`Diagnostics: ${analytics.diagnostics}`) : "Diagnostics: none",
    "Next: compylar brain .  |  compylar context \"describe your task\" .",
  ].join("\n");
}

export function memoryRefreshSummary(brain: RepositoryBrain) {
  const memory = brain.memory;
  if (!memory) return "Memory: unavailable in this legacy Brain";
  const { created, updated, reused, removed } = memory.changes;
  return `Memory: ${memory.chunks.length} chunks · ${created.length} created · ${updated.length} updated · ${reused.length} reused · ${removed.length} removed`;
}

export function aiStatusMessage(brain: RepositoryBrain): string {
  switch (brain.ai.status) {
    case "not-configured":
      return "Not run — no OpenAI provider configured. Deterministic repository analysis is complete.";
    case "pending":
      return "Pending — optional OpenAI enrichment is in progress.";
    case "completed":
      return brain.ai.summary
        ? `Completed — optional interpretation: ${brain.ai.summary}`
        : "Completed — optional OpenAI interpretation generated.";
    case "timed-out":
      return "Timed out — optional enrichment exceeded its timeout; deterministic facts remain valid.";
    case "failed":
      return `Failed — optional enrichment could not be completed${brain.ai.error ? `: ${brain.ai.error}` : ""}; deterministic facts remain valid.`;
  }
}

const routeArea = (route: RepositoryBrain["routes"][number]) => {
  const fileParts = route.file.split("/").filter(Boolean);
  const appIndex = Math.max(fileParts.lastIndexOf("app"), fileParts.lastIndexOf("pages"));
  const candidate = fileParts[appIndex + 1];
  if (route.path === "/") return "home";
  if (route.path.startsWith("/api/") || route.kind === "api") return "api";
  return (candidate ?? route.path.split("/").filter(Boolean)[0] ?? "root")
    .replace(/^\((.*)\)$/, "$1")
    .replace(/^\[\[?\.\.\.?.*\]\]$/, "dynamic");
};

export function routeKindCounts(brain: RepositoryBrain) {
  return ["page", "layout", "api"].map((kind) => ({
    kind,
    count: brain.routes.filter((route) => route.kind === kind).length,
  }));
}

export function routeAreaCounts(brain: RepositoryBrain) {
  const counts = new Map<string, number>();
  for (const route of brain.routes) counts.set(routeArea(route), (counts.get(routeArea(route)) ?? 0) + 1);
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function dependencyCounts(brain: RepositoryBrain) {
  return {
    internal: brain.dependencyGraph.filter((edge) => edge.kind === "internal").length,
    external: brain.dependencyGraph.filter((edge) => edge.kind === "external").length,
    unresolved: brain.dependencyGraph.filter((edge) => edge.kind === "unresolved").length,
  };
}

export function routeTable(brain: RepositoryBrain): string {
  const table = new Table({
    head: [chalk.bold("Kind"), chalk.bold("Path"), chalk.bold("File")],
    colWidths: [8, 44, 64],
    wordWrap: true,
    style: { head: [], border: [] },
  });
  for (const route of brain.routes) table.push([route.kind, route.path, route.file]);
  return table.toString() || "No routes detected in the analyzed scope.";
}

export function dependencyTable(brain: RepositoryBrain): string {
  const counts = dependencyCounts(brain);
  const table = new Table({
    head: [chalk.bold("Category"), chalk.bold("Count")],
    colWidths: [24, 18],
    style: { head: [], border: [] },
  });
  table.push(
    ["Internal", counts.internal],
    ["External", counts.external],
    ["Unresolved", counts.unresolved],
  );
  if (counts.unresolved) {
    table.push(["Unresolved imports", brain.dependencyGraph.filter((edge) => edge.kind === "unresolved").map((edge) => `${edge.from} → ${edge.to}`).join(", ")]);
  }
  return table.toString();
}

export function brainReport(brain: RepositoryBrain, options: BrainReportOptions = {}): string {
  const metrics = buildAnalytics(brain);
  const dependencies = dependencyCounts(brain);
  const kinds = routeKindCounts(brain);
  const areas = routeAreaCounts(brain);
  const lines = [
    `${brain.repo.name} — Repository Brain`,
    "",
    "Status",
    `  ${brain.status === "complete" ? "Complete" : brain.status}`,
    `  Compiled: ${brain.compiledAt}`,
    `  Fingerprint: ${brain.fingerprint}`,
    "",
    "Scope",
    `  Root: ${brain.repo.rootPath}`,
    `  Framework: ${brain.packages.map((pkg) => pkg.framework).filter((framework, index, all) => all.indexOf(framework) === index).join(", ") || "unknown"}`,
    `  Packages: ${metrics.packages}`,
    `  Source files: ${metrics.filesAnalyzed}`,
    `  Memory chunks: ${brain.memory?.chunks.length ?? 0}`,
    `  Memory refresh: ${brain.memory ? `${brain.memory.changes.created.length} created · ${brain.memory.changes.updated.length} updated · ${brain.memory.changes.reused.length} reused · ${brain.memory.changes.removed.length} removed` : "unavailable in legacy Brain"}`,
    `  Symbols: ${metrics.symbols}`,
    `  Routes: ${metrics.routes}`,
    `  Internal dependencies: ${dependencies.internal}`,
    `  External dependencies: ${dependencies.external}`,
    `  Unresolved dependencies: ${dependencies.unresolved}`,
    "",
    "Architecture",
    `  ${brain.architectureSummary}`,
    `  ${metrics.routes} routes across pages, layouts, and API handlers.`,
    "",
    "Packages",
    "  Package       Framework   Files   Symbols   Routes",
    ...brain.packages.map((pkg) => `  ${pkg.name.padEnd(13)} ${pkg.framework.padEnd(10)} ${String(pkg.fileCount).padStart(5)}   ${String(pkg.symbolCount).padStart(7)}   ${String(pkg.routeCount).padStart(6)}`),
    "",
    "Route summary",
    ...kinds.map(({ kind, count }) => `  ${kind === "api" ? "APIs" : `${kind[0].toUpperCase()}${kind.slice(1)}s`}: ${count}`),
    `  Areas: ${areas.length ? areas.map(([area, count]) => `${area} (${count})`).join(", ") : "none"}`,
    "",
    "Repository signals",
    `  Diagnostics: ${metrics.diagnostics ? metrics.diagnostics : "none"}`,
    `  Nested projects excluded: ${metrics.ignored}`,
    `  Unresolved imports: ${dependencies.unresolved}`,
    "",
    "AI enrichment",
    `  ${aiStatusMessage(brain)}`,
    "",
    "Next",
    "  compylar context \"describe your task\" .",
    "  compylar analytics .",
    "  compylar brain . --routes",
  ];
  if (options.routes || options.full) lines.push("", "Routes", routeTable(brain));
  if (options.dependencies || options.full) lines.push("", "Dependencies", dependencyTable(brain));
  if (options.full) {
    lines.push("", "Diagnostics", brain.diagnostics.length ? brain.diagnostics.map((d) => `  ${d.severity}: ${d.message}`).join("\n") : "  None");
    lines.push("", "Excluded nested projects", brain.ignored.length ? brain.ignored.map((item) => `  ${item.path}: ${item.reason}`).join("\n") : "  None");
    lines.push("", "Files", brain.files.length ? brain.files.map((file) => `  ${file.path} (${file.packageName})`).join("\n") : "  None");
    lines.push("", "Symbols", brain.symbols.length ? brain.symbols.map((symbol) => `  ${symbol.name} — ${symbol.kind} in ${symbol.file}`).join("\n") : "  None");
    lines.push("", "Dependency edges", brain.dependencyGraph.length ? brain.dependencyGraph.map((edge) => `  ${edge.kind}: ${edge.from} → ${edge.to}`).join("\n") : "  None");
  }
  return lines.join("\n");
}
