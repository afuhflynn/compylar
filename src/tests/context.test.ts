import { describe, expect, it } from "vitest";
import {
  buildContext,
  buildContextResult,
  contextMarkdown,
} from "../context.js";
import { RepositoryBrain } from "../types.js";

const brain: RepositoryBrain = {
  brainVersion: 3,
  repo: {
    name: "demo",
    rootPath: "/tmp/demo",
    packageManager: "pnpm",
    isWorkspace: false,
  },
  compiledAt: "now",
  fingerprint: "abc",
  status: "complete",
  analysis: {
    filesDiscovered: 1,
    filesAnalyzed: 1,
    filesSkipped: 0,
    bytesAnalyzed: 100,
    durationMs: 1,
    limits: { maxFiles: 25000, maxFileSize: 1048576, maxTotalBytes: 262144000 },
  },
  packages: [
    {
      name: "demo",
      rootPath: "/tmp/demo",
      relativePath: ".",
      framework: "nextjs",
      scripts: { dev: "next dev" },
      dependencies: {},
      devDependencies: {},
      fileCount: 1,
      symbolCount: 1,
      routeCount: 1,
      evidence: [
        { source: "package.json", detail: "package", confidence: "high" },
      ],
    },
  ],
  files: [
    {
      path: "app/dashboard/page.tsx",
      packageName: "demo",
      kind: "tsx",
      hash: "1",
      lines: 1,
      imports: [],
      exports: ["default"],
      preview: "export default function Dashboard() {}",
      diagnostics: [],
      evidence: [
        {
          source: "app/dashboard/page.tsx",
          detail: "source",
          confidence: "high",
        },
      ],
    },
  ],
  symbols: [
    {
      name: "Dashboard",
      kind: "function",
      file: "app/dashboard/page.tsx",
      packageName: "demo",
      line: 1,
      exported: true,
      signature: "function Dashboard()",
    },
  ],
  routes: [
    {
      path: "/dashboard",
      file: "app/dashboard/page.tsx",
      packageName: "demo",
      router: "next-app",
      kind: "page",
      methods: [],
      evidence: [
        {
          source: "app/dashboard/page.tsx",
          detail: "route",
          confidence: "high",
        },
      ],
    },
  ],
  dependencyGraph: [],
  diagnostics: [],
  ignored: [],
  architectureSummary: "1 package analyzed",
  ai: { status: "not-configured" },
};

describe("context builder", () => {
  it("returns metadata first and makes source previews opt-in", () => {
    const pack = buildContext(brain, "update dashboard authentication");
    expect(pack.selectedFiles[0].path).toBe("app/dashboard/page.tsx");
    expect(pack.selectedFiles[0].preview).toBeUndefined();
    expect(contextMarkdown(pack)).not.toContain("export default function Dashboard");
    expect(pack.budget).toMatchObject({ limitTokens: 2000, includesPreviews: false });

    const withPreview = buildContext(brain, "update dashboard authentication", {
      includePreview: true,
      budgetTokens: 1000,
    });
    expect(withPreview.selectedFiles[0].preview).toContain("export default function Dashboard");
    expect(withPreview.budget).toMatchObject({ limitTokens: 1000, includesPreviews: true });

    expect(() => buildContext(brain, "update dashboard authentication", {
      includePreview: true,
      budgetTokens: 100,
    })).toThrow("at least 512");
  });
});
describe("context ranking", () => {
  it("ignores stopwords when explaining matches", () => {
    const pack = buildContext(brain, "add authentication to the dashboard");
    expect(pack.selectedFiles[0].reason).not.toMatch(
      /(?:^|[,; ])to(?:[,; ]|$)/,
    );
  });

  it("reports ambiguity instead of selecting generic files", () => {
    const result = buildContextResult(brain, "what is happening");
    expect(result.status).toBe("needs-clarification");
    expect(result.mutationAllowed).toBe(false);
    expect(result).toMatchObject({
      intent: "ambiguous",
      actionability: "ambiguous",
    });
  });

  it("fails closed when a requested system has no repository evidence", () => {
    const result = buildContextResult(brain, "How does authentication work?");
    expect(result.status).toBe("context-ready");
    if (result.status === "context-ready") {
      expect(result.selectedFiles).toEqual([]);
      expect(result.systems).toEqual([]);
      expect(result.coverage).toMatchObject({ decision: "insufficient-index" });
      expect(result.coverage.unresolved).toContain("no-evidence");
    }
  });

  it("requires clarification for debugging requests without a target or symptom", () => {
    const result = buildContextResult(brain, "fix it");
    expect(result).toMatchObject({ status: "needs-clarification", intent: "ambiguous" });
  });

  it("requires clarification for debugging requests that omit a reproducible symptom", () => {
    const result = buildContextResult(brain, "fix dashboard loading");
    expect(result.status).toBe("needs-clarification");
    expect(result).toMatchObject({
      intent: "ambiguous",
      actionability: "ambiguous",
      mutationAllowed: false,
    });
    expect(result.missingInformation).toContain("observed symptom");
  });

  it("ranks exact path matches above incidental text matches", () => {
    const result = buildContextResult(brain, "dashboard");
    expect(result.status).toBe("context-ready");
    if (result.status === "context-ready") {
      expect(result.selectedFiles[0].reason).toContain("path match");
    }
  });

  it("retrieves a connected submission system instead of isolated keyword files", () => {
    const flowBrain: RepositoryBrain = {
      ...brain,
      files: [
        ...brain.files,
        ...["app/api/challenges/[slug]/submit/route.ts", "lib/submissions/service.ts", "prisma/schema.prisma", "components/challenge/submit-button.tsx"].map((file) => ({
          ...brain.files[0], path: file, preview: "", imports: [], exports: [],
        })),
      ],
      symbols: [
        ...brain.symbols,
        { name: "submitChallenge", kind: "function", file: "app/api/challenges/[slug]/submit/route.ts", packageName: "demo", line: 1, exported: true, signature: "submitChallenge" },
        { name: "createSubmission", kind: "function", file: "lib/submissions/service.ts", packageName: "demo", line: 1, exported: true, signature: "createSubmission" },
        { name: "Submission", kind: "type", file: "prisma/schema.prisma", packageName: "demo", line: 1, exported: true, signature: "model Submission" },
      ],
      dependencyGraph: [
        { from: "components/challenge/submit-button.tsx", to: "app/api/challenges/[slug]/submit/route.ts", kind: "internal", packageName: "demo", evidence: [] },
        { from: "app/api/challenges/[slug]/submit/route.ts", to: "lib/submissions/service.ts", kind: "internal", packageName: "demo", evidence: [] },
        { from: "lib/submissions/service.ts", to: "prisma/schema.prisma", kind: "internal", packageName: "demo", evidence: [] },
      ],
    };
    const result = buildContext(flowBrain, "how does challenge submission work?");
    expect(result.systems).toEqual([
      expect.objectContaining({
        name: "challenge submission",
        files: expect.arrayContaining([
          "components/challenge/submit-button.tsx",
          "app/api/challenges/[slug]/submit/route.ts",
          "lib/submissions/service.ts",
          "prisma/schema.prisma",
        ]),
      }),
    ]);
    expect(result.coverage).toMatchObject({ decision: "memory-sufficient" });
  });

  it("answers broad repository questions from the profile rather than incidental files", () => {
    const result = buildContext(brain, "What is this project? What does it do? What is the tech stack?");
    expect(result.queryPlan.strategy).toBe("repository-profile");
    expect(result.selectedFiles).toEqual([]);
    expect(result.coverage.decision).toBe("memory-sufficient");
    expect(result.overview?.stack).toContain("nextjs");
  });

  it("does not call architecture memory sufficient when the explicit semantic index is absent", () => {
    const result = buildContext({ ...brain, semanticIndex: { schemaVersion: 1, status: "absent", coverage: [], blockers: [], unknowns: [], findingCount: 0 } }, "How does the dashboard architecture work?");
    expect(result.coverage).toMatchObject({ decision: "insufficient-index" });
    expect(result.coverage.unresolved).toContain("semantic-architecture-memory-not-complete");
    expect(result.queryPlan.sourceReadRequired).toBe(true);
  });
});
