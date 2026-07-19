import { describe, expect, it } from "vitest";
import { enrichArchitecture, enrichContext } from "../ai.js";
import { buildContext } from "../context.js";
import { RepositoryBrain } from "../types.js";

const brain = {
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
      scripts: {},
      dependencies: {},
      devDependencies: {},
      fileCount: 1,
      symbolCount: 0,
      routeCount: 0,
      evidence: [],
    },
  ],
  files: [
    {
      path: "app/page.tsx",
      packageName: "demo",
      kind: "tsx",
      hash: "1",
      lines: 1,
      imports: [],
      exports: ["default"],
      preview: "export default function Home() {}",
      diagnostics: [],
      evidence: [],
    },
  ],
  symbols: [],
  routes: [],
  dependencyGraph: [],
  diagnostics: [],
  ignored: [],
  architectureSummary: "1 package analyzed",
  ai: { status: "not-configured" },
} satisfies RepositoryBrain;

describe("context AI boundary", () => {
  it("falls back explicitly when no provider is configured", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const result = await enrichContext(
      buildContext(brain, "explain the home page"),
    );
    expect(result.ai.status).toBe("not-configured");
    expect(result.retrievalMode).toBe("deterministic");
    if (previous) process.env.OPENAI_API_KEY = previous;
  });

  it("does not call an AI provider when project mode is off, even if a key exists", async () => {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";

    const result = await enrichArchitecture(brain, {
      provider: "openai",
      mode: "off",
      model: "configured-model",
      timeoutMs: 1,
    });

    expect(result).toEqual({ status: "not-configured" });
    if (previous) process.env.OPENAI_API_KEY = previous;
    else delete process.env.OPENAI_API_KEY;
  });
});
