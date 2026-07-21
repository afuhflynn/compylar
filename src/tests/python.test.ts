import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileRepository } from "../analyzer.js";

describe("Python adapter", () => {
  it("indexes Python definitions, imports, pytest tests, and FastAPI routes as normal Brain facts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "compylar-python-"));
    await mkdir(path.join(root, "tests"), { recursive: true });
    await writeFile(path.join(root, "pyproject.toml"), "[project]\nname = 'demo-api'\ndependencies = ['fastapi']\n");
    await writeFile(path.join(root, "app.py"), "from fastapi import FastAPI\nfrom service import greet\napp = FastAPI()\n@app.get('/health')\ndef health(): return {'ok': True}\n");
    await writeFile(path.join(root, "service.py"), "def greet(name: str) -> str:\n    return f'hello {name}'\n");
    await writeFile(path.join(root, "tests", "test_service.py"), "from service import greet\ndef test_greet():\n    assert greet('Ada') == 'hello Ada'\n");
    const brain = await compileRepository(root, { ai: false, progress: false });
    expect(brain.files.map((file) => file.path)).toEqual(expect.arrayContaining(["app.py", "service.py", "tests/test_service.py"]));
    expect(brain.packages[0].framework).toBe("python");
    expect(brain.symbols.map((symbol) => symbol.name)).toEqual(expect.arrayContaining(["health", "greet", "test_greet"]));
    expect(brain.routes).toEqual(expect.arrayContaining([expect.objectContaining({ path: "/health", methods: ["GET"] })]));
    expect(brain.references).toEqual(expect.arrayContaining([expect.objectContaining({ symbol: "greet", kind: "test" })]));
    expect(brain.capabilities).toEqual(expect.arrayContaining([expect.objectContaining({ adapter: "python", status: "active" }), expect.objectContaining({ adapter: "fastapi", status: "active" })]));
  });
});
