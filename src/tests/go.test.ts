import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileRepository } from "../analyzer.js";

describe("Go adapter", () => {
  it("indexes Go functions, imports, tests, and net/http routes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "compylar-go-"));
    await writeFile(path.join(root, "go.mod"), "module example.com/demo\ngo 1.22\n");
    await writeFile(path.join(root, "main.go"), "package main\nimport \"net/http\"\nfunc Health(w http.ResponseWriter, r *http.Request) {}\nfunc main() { http.HandleFunc(\"/health\", Health) }\n");
    await writeFile(path.join(root, "main_test.go"), "package main\nimport \"testing\"\nfunc TestHealth(t *testing.T) { Health(nil, nil) }\n");
    const brain = await compileRepository(root, { ai: false, progress: false });
    expect(brain.packages[0].framework).toBe("go");
    expect(brain.symbols.map((symbol) => symbol.name)).toEqual(expect.arrayContaining(["Health", "main", "TestHealth"]));
    expect(brain.routes).toEqual(expect.arrayContaining([expect.objectContaining({ path: "/health", router: "go-net-http" })]));
    expect(brain.capabilities).toEqual(expect.arrayContaining([expect.objectContaining({ adapter: "go", status: "active" })]));
  });
});
