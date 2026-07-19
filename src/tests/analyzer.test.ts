import { describe, expect, it } from "vitest";
import path from "node:path";
import { compileRepository } from "../analyzer.js";

describe("repository compiler", () => {
  it("does not attribute a nested standalone app to the root package", async () => {
    const brain = await compileRepository(path.resolve("."), { ai: false });
    expect(brain.repo.name).toBe("compylar");
    expect(brain.routes).toHaveLength(0);
    expect(
      brain.ignored.some((item) => item.path === "examples/nextjs-demo"),
    ).toBe(true);
    expect(
      brain.files.every(
        (file) => !file.path.startsWith("examples/nextjs-demo/"),
      ),
    ).toBe(true);
  }, 15_000);

  it("detects routes when the demo app is compiled directly", async () => {
    const brain = await compileRepository(
      path.resolve("examples/nextjs-demo"),
      { ai: false },
    );
    expect(brain.routes.map((route) => route.path)).toEqual([
      "/api/health",
      "/dashboard",
      "/",
      "/",
    ]);
    expect(
      brain.routes.find((route) => route.kind === "api")?.methods,
    ).toContain("GET");
  });

  it("keeps pnpm workspace packages separate", async () => {
    const brain = await compileRepository(
      path.resolve("examples/workspace-demo"),
      { ai: false },
    );
    expect(brain.repo.isWorkspace).toBe(true);
    expect(brain.packages.map((pkg) => pkg.name)).toEqual([
      "workspace-demo",
      "workspace-demo-web",
    ]);
    expect(brain.routes[0].packageName).toBe("workspace-demo-web");
  });

  it("returns a bounded partial brain when the file limit is reached", async () => {
    const brain = await compileRepository(path.resolve("."), {
      ai: false,
      maxFiles: 1,
      progress: false,
    });
    expect(brain.status).toBe("partial");
    expect(brain.analysis.filesAnalyzed).toBe(1);
    expect(brain.analysis.limits.maxFiles).toBe(1);
    expect(brain.analysis.filesSkipped).toBeGreaterThan(0);
  });
});
