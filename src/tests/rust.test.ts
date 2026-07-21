import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileRepository } from "../analyzer.js";

describe("Rust adapter", () => {
  it("indexes Cargo source, definitions, tests, and Axum route declarations", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "compylar-rust-"));
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "Cargo.toml"), "[package]\nname = 'demo'\nversion = '0.1.0'\n[dependencies]\naxum = '0.8'\n");
    await writeFile(path.join(root, "src", "lib.rs"), "use axum::Router;\npub struct User;\npub fn health() {}\npub fn routes() { Router::new().route(\"/health\", get(health)); }\n#[test]\nfn health_test() { health(); }\n");
    const brain = await compileRepository(root, { ai: false, progress: false });
    expect(brain.packages[0].framework).toBe("rust");
    expect(brain.symbols.map((symbol) => symbol.name)).toEqual(expect.arrayContaining(["User", "health", "routes", "health_test"]));
    expect(brain.routes).toEqual(expect.arrayContaining([expect.objectContaining({ path: "/health", router: "axum" })]));
    expect(brain.capabilities).toEqual(expect.arrayContaining([expect.objectContaining({ adapter: "rust", status: "active" })]));
  });
});
