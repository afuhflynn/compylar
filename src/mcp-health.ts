import { performance } from "node:perf_hooks";
import { handleMcpRequest } from "./mcp.js";

export type McpHealthReport = {
  status: "healthy" | "failed";
  elapsedMs: number;
  server?: { name: string; version: string };
  tools?: string[];
  error?: string;
  action: string;
};

export type McpTransport = {
  request: (method: "initialize" | "tools/list") => Promise<unknown>;
  close: () => Promise<void>;
};

const defaultAction =
  "Run `compylar mcp .` from the repository root. Then use your agent's MCP panel or CLI to verify its separate configuration and trust approval.";

export async function probeMcpTransport(
  transport: McpTransport,
  now: () => number = performance.now.bind(performance),
): Promise<McpHealthReport> {
  const started = now();
  try {
    const initialized = await transport.request("initialize") as {
      serverInfo?: { name?: unknown; version?: unknown };
    };
    const name = initialized.serverInfo?.name;
    const version = initialized.serverInfo?.version;
    if (typeof name !== "string" || typeof version !== "string") {
      throw new Error("MCP initialize response did not include serverInfo.name and serverInfo.version.");
    }
    const listed = await transport.request("tools/list") as {
      tools?: Array<{ name?: unknown }>;
    };
    if (!Array.isArray(listed.tools)) {
      throw new Error("MCP tools/list response did not include a tools array.");
    }
    const tools = listed.tools
      .map((tool) => tool.name)
      .filter((name): name is string => typeof name === "string")
      .sort();
    return {
      status: "healthy",
      elapsedMs: now() - started,
      server: { name, version },
      tools,
      action: "Compylar's MCP protocol is healthy. Verify agent configuration and project trust separately.",
    };
  } catch (error) {
    return {
      status: "failed",
      elapsedMs: now() - started,
      error: error instanceof Error ? error.message : String(error),
      action: defaultAction,
    };
  } finally {
    await transport.close();
  }
}

export async function checkMcpHealth(root: string): Promise<McpHealthReport> {
  const request = async (method: "initialize" | "tools/list") => {
    const response = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: method === "initialize" ? 1 : 2,
        method,
        params: method === "initialize"
          ? { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "compylar-health", version: "1" } }
          : {},
      },
      root,
    );
    if (!response || !("result" in response)) {
      throw new Error(`MCP ${method} did not return a result.`);
    }
    return response.result;
  };
  return probeMcpTransport({ request, close: async () => undefined });
}
