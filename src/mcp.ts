import path from "node:path";
import { buildAnalytics } from "./analytics.js";
import {
  repositoryAnalytics,
  repositoryBrain,
  repositoryContext,
  repositoryMemory,
  repositoryDependencies,
  repositoryRoutes,
  repositoryStatus,
} from "./services.js";
import { COMPYLAR_VERSION } from "./version.js";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

const toolDefinitions = [
  {
    name: "compylar_brain",
    description: "Return the latest deterministic Repository Brain summary.",
    inputSchema: { type: "object", properties: { repository: { type: "string" } } },
  },
  {
    name: "compylar_analytics",
    description: "Return deterministic repository compile metrics.",
    inputSchema: { type: "object", properties: { repository: { type: "string" } } },
  },
  {
    name: "compylar_context",
    description: "Retrieve read-only, evidence-backed context for a task. It never authorizes edits.",
    inputSchema: {
      type: "object",
      required: ["task"],
      properties: {
        task: { type: "string", description: "The user's repository task or question." },
        ai: { type: "boolean", description: "Opt into evidence-constrained AI reranking." },
        repository: { type: "string" },
      },
    },
  },
  {
    name: "compylar_memory",
    description: "Retrieve compact, evidence-backed memory chunks without reading repository files.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional text to match chunk title, summary, or source path." },
        sourcePaths: { type: "array", items: { type: "string" }, description: "Optional source paths whose chunks should be returned." },
        repository: { type: "string" },
      },
    },
  },
  {
    name: "compylar_status",
    description: "Check whether the working tree is stale compared with the latest Brain.",
    inputSchema: { type: "object", properties: { repository: { type: "string" } } },
  },
  {
    name: "compylar_routes",
    description: "Return verified routes, optionally filtered by area, kind, or query.",
    inputSchema: {
      type: "object",
      properties: {
        area: { type: "string" },
        kind: { type: "string", enum: ["page", "layout", "api"] },
        query: { type: "string" },
        repository: { type: "string" },
      },
    },
  },
  {
    name: "compylar_dependencies",
    description: "Return verified dependency edges, optionally filtered by kind or query.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["internal", "external", "unresolved"] },
        query: { type: "string" },
        repository: { type: "string" },
      },
    },
  },
];

const response = (id: JsonRpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const errorResponse = (id: JsonRpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

function argsOf(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== "object") return {};
  const args = (params as { arguments?: unknown }).arguments;
  return args && typeof args === "object" ? args as Record<string, unknown> : params as Record<string, unknown>;
}

function scopedRoot(configuredRoot: string, args: Record<string, unknown>) {
  const requested = typeof args.repository === "string" ? path.resolve(args.repository) : configuredRoot;
  if (requested !== configuredRoot) throw new Error(`Repository is outside the configured MCP scope: ${requested}`);
  return configuredRoot;
}

async function callTool(name: string, args: Record<string, unknown>, configuredRoot: string) {
  const root = scopedRoot(configuredRoot, args);
  switch (name) {
    case "compylar_brain": {
      const brain = await repositoryBrain(root);
      return {
        repository: brain.repo,
        status: brain.status,
        compiledAt: brain.compiledAt,
        fingerprint: brain.fingerprint,
        architectureSummary: brain.architectureSummary,
        analytics: buildAnalytics(brain),
        ai: brain.ai,
      };
    }
    case "compylar_analytics":
      return repositoryAnalytics(root);
    case "compylar_context": {
      if (typeof args.task !== "string" || !args.task.trim()) throw new Error("compylar_context requires a non-empty task");
      return repositoryContext(root, args.task, args.ai === true);
    }
    case "compylar_memory":
      return repositoryMemory(root, {
        query: typeof args.query === "string" ? args.query : undefined,
        sourcePaths: Array.isArray(args.sourcePaths)
          ? args.sourcePaths.filter((value): value is string => typeof value === "string")
          : undefined,
      });
    case "compylar_status":
      return repositoryStatus(root);
    case "compylar_routes":
      return repositoryRoutes(root, {
        area: typeof args.area === "string" ? args.area : undefined,
        kind: args.kind === "page" || args.kind === "layout" || args.kind === "api" ? args.kind : undefined,
        query: typeof args.query === "string" ? args.query : undefined,
      });
    case "compylar_dependencies":
      return repositoryDependencies(root, {
        kind: args.kind === "internal" || args.kind === "external" || args.kind === "unresolved" ? args.kind : undefined,
        query: typeof args.query === "string" ? args.query : undefined,
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function handleMcpRequest(request: JsonRpcRequest, configuredRoot: string) {
  if (request.method === "notifications/initialized" || request.method === "notifications/cancelled") return undefined;
  if (request.method === "initialize") {
    return response(request.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "compylar", version: COMPYLAR_VERSION },
      instructions: "Compylar is persistent, read-only repository memory. Before repository work, call compylar_status. If it is stale, refresh with the local CLI before relying on context. Use compylar_memory or compylar_context for evidence; ask for clarification and approval before edits.",
    });
  }
  if (request.method === "tools/list") return response(request.id, { tools: toolDefinitions });
  if (request.method === "tools/call") {
    const params = (request.params ?? {}) as { name?: unknown; arguments?: unknown };
    if (typeof params.name !== "string") return errorResponse(request.id, -32602, "tools/call requires a tool name");
    try {
      const result = await callTool(params.name, argsOf(params), configuredRoot);
      return response(request.id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      });
    } catch (error) {
      return response(request.id, {
        isError: true,
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
      });
    }
  }
  if (request.id === undefined || request.id === null) return undefined;
  return errorResponse(request.id, -32601, `Method not found: ${request.method ?? ""}`);
}

export async function runMcpServer(configuredRoot: string) {
  const root = path.resolve(configuredRoot);
  process.stdin.resume();
  const keepAlive = setInterval(() => undefined, 2_147_483_647);
  try {
    await consumeMcpInput(root);
  } finally {
    clearInterval(keepAlive);
  }
}

async function consumeMcpInput(root: string) {
  process.stdin.setEncoding("utf8");
  let buffer = "";
  let queue = Promise.resolve();
  const processLine = (line: string) => {
    queue = queue.then(async () => {
      if (!line.trim()) return;
      let request: JsonRpcRequest;
      try {
        request = JSON.parse(line) as JsonRpcRequest;
      } catch {
        process.stdout.write(`${JSON.stringify(errorResponse(null, -32700, "Invalid JSON"))}\n`);
        return;
      }
      const result = await handleMcpRequest(request, root);
      if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
    });
  };
  await new Promise<void>((resolve) => {
    process.stdin.on("data", (chunk: string) => {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        processLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    });
    process.stdin.once("end", () => {
      if (buffer) processLine(buffer);
      void queue.then(resolve);
    });
  });
}
