import { describe, expect, it } from "vitest";
import {
  buildContext,
  buildContextResult,
  contextMarkdown,
} from "../context.js";
import { RepositoryBrain } from "../types.js";

const brain: RepositoryBrain = {
  brainVersion: 2,
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
  it("selects matching files and includes source evidence", () => {
    const pack = buildContext(brain, "update dashboard authentication");
    expect(pack.selectedFiles[0].path).toBe("app/dashboard/page.tsx");
    expect(contextMarkdown(pack)).toContain(
      "export default function Dashboard",
    );
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

  it("marks underspecified debugging requests as read-only context", () => {
    const result = buildContextResult(brain, "fix dashboard loading");
    expect(result.status).toBe("context-ready");
    expect(result).toMatchObject({
      intent: "debugging",
      actionability: "underspecified",
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
});
