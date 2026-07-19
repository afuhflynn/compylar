import { describe, expect, it } from "vitest";
import {
  analyticsTable,
  brainReport,
  buildAnalytics,
  conciseSummary,
  memoryRefreshSummary,
} from "../analytics.js";
import { RepositoryBrain } from "../types.js";

const brain = {
  repo: {
    name: "demo",
    rootPath: "/tmp/demo",
    packageManager: "pnpm",
    isWorkspace: false,
  },
  status: "complete",
  compiledAt: "now",
  fingerprint: "abc",
  analysis: {
    filesDiscovered: 4,
    filesAnalyzed: 3,
    filesSkipped: 1,
    bytesAnalyzed: 2048,
    durationMs: 250,
    limits: { maxFiles: 100, maxFileSize: 1000, maxTotalBytes: 10000 },
  },
  packages: [],
  files: [],
  symbols: [],
  routes: [],
  dependencyGraph: [],
  diagnostics: [],
  ignored: [],
  architectureSummary: "demo",
  ai: { status: "not-configured" },
  brainVersion: 2,
} satisfies RepositoryBrain;

describe("compile analytics", () => {
  it("derives deterministic metrics from the Brain", () => {
    expect(buildAnalytics(brain)).toMatchObject({
      repository: "demo",
      filesDiscovered: 4,
      filesAnalyzed: 3,
      filesSkipped: 1,
      durationMs: 250,
    });
  });

  it("renders a readable static report", () => {
    const output = analyticsTable(brain);
    expect(output).toContain("Files");
    expect(output).toContain("3/4 analyzed");
    expect(output).toContain("0.3s");
  });

  it("renders a bounded executive Brain report with grouped route counts", () => {
    const report = brainReport({
      ...brain,
      packages: [
        {
          name: "demo",
          rootPath: "/tmp/demo",
          relativePath: ".",
          framework: "nextjs",
          scripts: {},
          dependencies: {},
          devDependencies: {},
          fileCount: 3,
          symbolCount: 4,
          routeCount: 2,
          evidence: [],
        },
      ],
      routes: [
        {
          path: "/",
          file: "app/page.tsx",
          packageName: "demo",
          router: "next-app",
          kind: "page",
          methods: [],
          evidence: [],
        },
        {
          path: "/dashboard",
          file: "app/dashboard/page.tsx",
          packageName: "demo",
          router: "next-app",
          kind: "page",
          methods: [],
          evidence: [],
        },
      ],
    });
    expect(report).toContain("Routes: 2");
    expect(report).toContain("Pages: 2");
    expect(report).toContain("Areas: dashboard (1), home (1)");
    expect(report).not.toContain("app/page.tsx");
  });

  it("keeps route inventories out of the default report and exposes them on request", () => {
    const route = {
      path: "/dashboard",
      file: "app/dashboard/page.tsx",
      packageName: "demo",
      router: "next-app" as const,
      kind: "page" as const,
      methods: [],
      evidence: [],
    };
    const expanded = brainReport(
      { ...brain, routes: [route] },
      { routes: true },
    );
    expect(expanded).toContain("Kind");
    expect(expanded).toContain("app/dashboard/page.tsx");
  });

  it("explains optional AI enrichment without presenting it as a compiler error", () => {
    expect(brainReport(brain)).toContain(
      "Not run — no OpenAI provider configured",
    );
    expect(conciseSummary(brain)).not.toContain("AI enrichment");
  });

  it("makes memory reuse visible in human-readable reports", () => {
    const withMemory = {
      ...brain,
      memory: {
        schemaVersion: 1 as const,
        chunks: [],
        changes: {
          created: ["module:new.ts"],
          updated: ["module:changed.ts"],
          reused: ["module:stable.ts", "package:."],
          removed: [],
        },
        reconciledAt: "now",
      },
    } satisfies RepositoryBrain;

    expect(memoryRefreshSummary(withMemory)).toContain("1 created");
    expect(memoryRefreshSummary(withMemory)).toContain("2 reused");
    expect(conciseSummary(withMemory)).toContain("Memory");
  });
});
