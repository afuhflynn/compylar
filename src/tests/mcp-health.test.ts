import { describe, expect, it } from "vitest";
import { probeMcpTransport } from "../mcp-health.js";

describe("MCP health", () => {
  it("confirms a server handshake and reports its discovered tools", async () => {
    const methods: string[] = [];
    const report = await probeMcpTransport(
      {
        request: async (method) => {
          methods.push(method);
          return method === "initialize"
            ? { serverInfo: { name: "compylar", version: "0.1.0" } }
            : { tools: [{ name: "compylar_status" }, { name: "compylar_context" }] };
        },
        close: async () => undefined,
      },
      () => methods.length,
    );

    expect(methods).toEqual(["initialize", "tools/list"]);
    expect(report).toMatchObject({
      status: "healthy",
      server: { name: "compylar", version: "0.1.0" },
      tools: ["compylar_context", "compylar_status"],
      elapsedMs: 2,
    });
  });

  it("returns an actionable failure when the handshake is malformed", async () => {
    const report = await probeMcpTransport({
      request: async () => ({}),
      close: async () => undefined,
    });

    expect(report).toMatchObject({
      status: "failed",
      action: expect.stringMatching(/mcp/i),
    });
  });
});
