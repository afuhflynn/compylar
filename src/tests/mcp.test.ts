import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { handleMcpRequest } from "../mcp.js";
import { COMPYLAR_VERSION } from "../version.js";

function resultOf(value: Awaited<ReturnType<typeof handleMcpRequest>>) {
  return value && "result" in value ? value.result : undefined;
}

async function fixtureRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "compylar-mcp-"));
  await mkdir(path.join(root, ".compylar"));
  await writeFile(
    path.join(root, ".compylar", "brain.json"),
    JSON.stringify({
      brainVersion: 2,
      repo: {
        name: "fixture",
        rootPath: root,
        packageManager: "pnpm",
        isWorkspace: false,
      },
      compiledAt: "now",
      fingerprint: "fixture-fingerprint",
      status: "complete",
      analysis: {
        filesDiscovered: 1,
        filesAnalyzed: 1,
        filesSkipped: 0,
        bytesAnalyzed: 100,
        durationMs: 1,
        limits: {
          maxFiles: 25_000,
          maxFileSize: 1_048_576,
          maxTotalBytes: 262_144_000,
        },
      },
      packages: [
        {
          name: "fixture",
          rootPath: root,
          relativePath: ".",
          framework: "nextjs",
          scripts: {},
          dependencies: {},
          devDependencies: {},
          fileCount: 1,
          symbolCount: 1,
          routeCount: 1,
          evidence: [],
        },
      ],
      files: [
        {
          path: "app/dashboard/page.tsx",
          packageName: "fixture",
          kind: "tsx",
          hash: "1",
          lines: 1,
          imports: [],
          exports: ["default"],
          preview: "export default function Dashboard() {}",
          diagnostics: [],
          evidence: [],
        },
      ],
      symbols: [
        {
          name: "Dashboard",
          kind: "function",
          file: "app/dashboard/page.tsx",
          packageName: "fixture",
          line: 1,
          exported: true,
          signature: "function Dashboard()",
        },
      ],
      routes: [
        {
          path: "/dashboard",
          file: "app/dashboard/page.tsx",
          packageName: "fixture",
          router: "next-app",
          kind: "page",
          methods: [],
          evidence: [],
        },
      ],
      dependencyGraph: [],
      diagnostics: [],
      ignored: [],
      architectureSummary: "1 package analyzed",
      ai: { status: "not-configured" },
    }) + "\n",
  );
  return root;
}

describe("Compylar MCP server", () => {
  it("supports initialize and tool discovery without repository writes", async () => {
    const root = await fixtureRoot();
    const initialized = await handleMcpRequest(
      { jsonrpc: "2.0", id: 1, method: "initialize" },
      root,
    );
    expect(resultOf(initialized)).toMatchObject({
      serverInfo: { name: "compylar", version: COMPYLAR_VERSION },
      capabilities: { tools: {} },
    });
    const listed = await handleMcpRequest(
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      root,
    );
    const tools = (resultOf(listed) as { tools: Array<{ name: string }> })
      .tools;
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "compylar_brain",
        "compylar_analytics",
        "compylar_context",
        "compylar_memory",
        "compylar_status",
        "compylar_routes",
        "compylar_dependencies",
      ]),
    );
  });

  it("returns structured read-only context and blocks other repository scopes", async () => {
    const root = await fixtureRoot();
    const context = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "compylar_context",
          arguments: { task: "explain the dashboard flow" },
        },
      },
      root,
    );
    const contextResult = resultOf(context) as {
      structuredContent: { status: string; mutationAllowed: boolean };
    };
    expect(contextResult.structuredContent).toMatchObject({
      status: "context-ready",
      mutationAllowed: false,
    });

    const blocked = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "compylar_brain",
          arguments: { repository: "/tmp/other" },
        },
      },
      root,
    );
    expect(resultOf(blocked)).toMatchObject({ isError: true });
  });

  it("returns compact reusable memory without permitting mutations", async () => {
    const root = await fixtureRoot();
    const memory = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: {
          name: "compylar_memory",
          arguments: { query: "dashboard" },
        },
      },
      root,
    );
    const result = resultOf(memory) as {
      structuredContent: { schemaVersion: number; chunks: unknown[] };
    };
    expect(result.structuredContent).toMatchObject({ schemaVersion: 1 });
    expect(Array.isArray(result.structuredContent.chunks)).toBe(true);
  });

  it("returns protocol errors instead of prompting for missing or invalid input", async () => {
    const root = await fixtureRoot();
    expect(
      await handleMcpRequest(
        { jsonrpc: "2.0", id: 5, method: "notifications/initialized" },
        root,
      ),
    ).toBeUndefined();

    const missingTask = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: { name: "compylar_context", arguments: {} },
      },
      root,
    );
    expect(resultOf(missingTask)).toMatchObject({ isError: true });

    const unknown = await handleMcpRequest(
      { jsonrpc: "2.0", id: 7, method: "not-a-method" },
      root,
    );
    expect(unknown).toMatchObject({ error: { code: -32601 } });

    const missingBrainRoot = await mkdtemp(
      path.join(os.tmpdir(), "compylar-mcp-empty-"),
    );
    const missingBrain = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: { name: "compylar_brain", arguments: {} },
      },
      missingBrainRoot,
    );
    expect(resultOf(missingBrain)).toMatchObject({ isError: true });
  });
});
